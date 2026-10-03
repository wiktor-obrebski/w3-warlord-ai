function WarlordAIMain(warlord_bot_player)
    local timer = CreateTimer()
    TimerStart(timer, 0.0, false, function()
        DestroyTimer(timer)
        WarlordRunBundle(warlord_bot_player)
    end)
end

function WarlordRunBundle(warlord_bot_player)
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

    environment.warlord_bot_player = warlord_bot_player

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

    runProtected(chunk)
end

do
    local startMeleeAI = StartMeleeAI
    StartMeleeAI = function (player, script)
        if GetAIDifficulty(player) == AI_DIFFICULTY_NORMAL then
            return installBotPlayer(player)
        end

        return startMeleeAI(player, script)
    end
end

local realGetPlayerSlotState = GetPlayerSlotState
local facadePlayers = {}
local transferredPlayers = {}

function installBotPlayer(botPlayer)
    local warlordPlayer = findEmptyPlayerSlot()

    if warlordPlayer == nil then
        error("No empty player slot available for Warlord AI")
    end

    transferPlayerOwnership(botPlayer, warlordPlayer)
    WarlordAIMain(warlordPlayer)

    facadePlayers[botPlayer] = true
    transferredPlayers[warlordPlayer] = true

    SetPlayerName(warlordPlayer, "Warlord AI")

    installPlayerSlotStateOverride()

    return warlordPlayer
end

function findEmptyPlayerSlot()
    for playerIndex = 0, bj_MAX_PLAYERS - 1 do
        local player = Player(playerIndex)

        if realGetPlayerSlotState(player) == PLAYER_SLOT_STATE_EMPTY then
            return player
        end
    end

    return nil
end

function transferPlayerOwnership(fromPlayer, toPlayer)
    local group = CreateGroup()

    GroupEnumUnitsOfPlayer(group, fromPlayer, nil)

    ForGroup(group, function()
        SetUnitOwner(GetEnumUnit(), toPlayer, true)
    end)

    DestroyGroup(group)

    SetPlayerStartLocation(
        toPlayer,
        GetPlayerStartLocation(fromPlayer)
    )

    SetPlayerColor(
        toPlayer,
        GetPlayerColor(fromPlayer)
    )

    SetPlayerState(
        toPlayer,
        PLAYER_STATE_RESOURCE_GOLD,
        GetPlayerState(fromPlayer, PLAYER_STATE_RESOURCE_GOLD)
    )

    SetPlayerState(
        toPlayer,
        PLAYER_STATE_RESOURCE_LUMBER,
        GetPlayerState(fromPlayer, PLAYER_STATE_RESOURCE_LUMBER)
    )

    SetPlayerState(
        toPlayer,
        PLAYER_STATE_RESOURCE_HERO_TOKENS,
        GetPlayerState(fromPlayer, PLAYER_STATE_RESOURCE_HERO_TOKENS)
    )
end

function installPlayerSlotStateOverride()
    GetPlayerSlotState = function(player)
        if transferredPlayers[player] then
            return PLAYER_SLOT_STATE_PLAYING
        end

        if facadePlayers[player] then
            return PLAYER_SLOT_STATE_LEFT
        end

        return realGetPlayerSlotState(player)
    end
end
