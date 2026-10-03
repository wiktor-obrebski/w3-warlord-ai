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
    -- wraps them with guard to get the same error reporting.
    environment.guard = function(callback)
        return function(...)
            runProtected(callback, ...)
        end
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
