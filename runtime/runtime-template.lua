function WarlordRunBundle()
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

    local source = __WARLORD_BUNDLE_SOURCE__

    local sourceLines = {}
    for line in (source .. "\n"):gmatch("(.-)\n") do
        sourceLines[#sourceLines + 1] = line
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

    local ok, result = xpcall(chunk, function(err)
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
    end)

    if not ok then
        DisplayTimedTextToPlayer(
            Player(0), 0, 0, 60,
            "ERROR: " .. tostring(result)
        )
    end
end
