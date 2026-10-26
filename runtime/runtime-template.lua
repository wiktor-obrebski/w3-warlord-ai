function WarlordRunBundle(warlord_computer_player)
    local environment = setmetatable({}, { __index = _G })
    environment._G = environment

    -- Minimal TSTL compatibility, not a full debug library.
    environment.debug = {
        getinfo = function(level, options)
            if level == 1 and options == nil then
                return { short_src = "warlord.lua" }
            end
            return nil
        end,

        traceback = function(thread, message, level)
            return type(message) == "string" and message or ""
        end
    }

    local nativeError = error
    local errorLocations = setmetatable({}, { __mode = "k" })

    environment.error = function(value, level)
        if type(value) == "table" then
            local _, location = pcall(nativeError, "", 3)
            errorLocations[value] = location
            nativeError(value, 0)
        end

        nativeError(value, level == 0 and 2 or (level or 1) + 1)
    end

    -- The bundle's own globals are sandboxed in `environment`, one per bot;
    -- installation code needs the real table to override natives seen by
    -- Blizzard.j and to share state between bots.
    environment.map_globals = _G

    local source = __WARLORD_BUNDLE_SOURCE__

    local sourceLines = {}
    for line in (source .. "\n"):gmatch("(.-)\n") do
        sourceLines[#sourceLines + 1] = line
    end

    local function describeError(err)
        local location = type(err) == "table" and errorLocations[err]
        local message = (location or "") .. tostring(err)

        local maps = environment.__TS__sourcemap
        local map = maps and maps["warlord.lua"]

        return (message:gsub(
            "warlord[.]lua: *([0-9]+)",
            function(line)
                local luaLine = tonumber(line)
                local entry = map and (map[line] or map[luaLine])

                if entry == nil and map
                    and (sourceLines[luaLine] or ""):match("^[ \t]*error[(][ \t]*$")
                then
                    entry = map[tostring(luaLine + 1)] or map[luaLine + 1]
                end

                if type(entry) == "table" then
                    return entry.file .. ":" .. tostring(entry.line)
                end
                return "warlord.lua:" .. line
            end
        ))
    end

    local function runProtected(callback, ...)
        local ok, result = xpcall(callback, describeError, ...)

        if not ok then
            DisplayTimedTextToPlayer(
                Player(0), 0, 0, 60,
                "ERROR: " .. tostring(result)
            )
        end
    end

    -- Timer and trigger callbacks run outside the startup xpcall, so bot code
    -- wraps them with guard to get the same error reporting. Declared for
    -- TypeScript in @lib/warcraft3-api/warlord.
    environment.guard = function(callback)
        return function(...)
            runProtected(callback, ...)
        end
    end

    -- Real-world time for log records, as text: Warcraft's Lua integers
    -- are 32-bit, too small for milliseconds since the epoch, and seconds
    -- since the epoch may not fit a float exactly. os.time counts whole
    -- seconds; os.clock, elapsed time on Windows but CPU time elsewhere,
    -- adds the milliseconds and is re-anchored whenever it leaves the
    -- current os.time second, so seconds and milliseconds are kept apart.
    -- Declared for TypeScript in @lib/warcraft3-api/warlord.
    local function readOsNumber(read)
        if type(read) ~= "function" then
            return nil
        end
        local ok, number = pcall(read)
        return ok and type(number) == "number" and number or nil
    end

    local osTime = os and os.time
    local osClock = os and os.clock
    local anchorSeconds = readOsNumber(osTime)
    local anchorClock = readOsNumber(osClock)

    environment.readWallClockMillisecondsText = function()
        if anchorSeconds == nil then
            return nil
        end

        local wholeSeconds = osTime()
        if anchorClock == nil then
            return string.format("%d000", wholeSeconds)
        end

        local elapsed = osClock() - anchorClock
        local elapsedSeconds = math.floor(elapsed)
        if anchorSeconds + elapsedSeconds ~= wholeSeconds then
            anchorSeconds = wholeSeconds
            anchorClock = osClock()
            elapsed = 0
            elapsedSeconds = 0
        end

        -- A 32-bit float can round a fraction just below 1 up to 1000 ms.
        local milliseconds = math.min(
            math.floor((elapsed - elapsedSeconds) * 1000),
            999
        )
        return string.format("%d%03d", anchorSeconds + elapsedSeconds, milliseconds)
    end

    environment.readClockSeconds = function()
        if anchorClock == nil then
            return nil
        end
        return osClock()
    end

    -- TEMPORARY probe of Warcraft's Lua numbers and clocks; remove once
    -- its readings are recorded in lib/logger/README.md.
    do
        local loadClock = anchorClock
        local loadTime = anchorSeconds
        local probeTimer = CreateTimer()
        TimerStart(probeTimer, 2.0, false, environment.guard(function()
            DestroyTimer(probeTimer)
            local lines = {
                "Lua probe: " .. tostring(_VERSION),
                "maxinteger " .. tostring(math.maxinteger)
                    .. ", 2147483647 + 1 = " .. tostring(2147483647 + 1),
                "0.1 as %.17g " .. string.format("%.17g", 0.1)
                    .. ", 16777217.0 " .. tostring(16777217.0)
                    .. ", 1/3 " .. tostring(1 / 3),
                "os.time " .. tostring(osTime ~= nil) .. " " .. tostring(loadTime)
                    .. " -> " .. tostring(osTime and osTime()),
                "os.clock " .. tostring(osClock ~= nil) .. " " .. tostring(loadClock)
                    .. " -> " .. tostring(osClock and osClock()) .. " over 2 game s",
                "os.date " .. tostring(os ~= nil and os.date ~= nil),
                "wall clock text " .. tostring(environment.readWallClockMillisecondsText()),
            }
            for _, line in ipairs(lines) do
                DisplayTimedTextToPlayer(Player(0), 0, 0, 120, line)
            end
        end))
    end

    local chunk, loadError = load(
        source,
        "@warlord.lua",
        "t",
        environment
    )

    if not chunk then
        DisplayTimedTextToPlayer(
            Player(0), 0, 0, 60,
            "Bundle load error: " .. tostring(loadError)
        )
        return
    end

    runProtected(function()
        chunk().main(warlord_computer_player)
    end)
end

-- Runs synchronously so the bundle can install its player before the melee
-- initialization that follows `StartMeleeAI` sets up victory/defeat tracking.
do
    local startMeleeAI = StartMeleeAI
    StartMeleeAI = function (player, script)
        if GetAIDifficulty(player) == AI_DIFFICULTY_NORMAL then
            return WarlordRunBundle(player)
        end

        return startMeleeAI(player, script)
    end
end
