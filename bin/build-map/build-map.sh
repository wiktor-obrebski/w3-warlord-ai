#!/usr/bin/env bash
set -euo pipefail

if (( $# < 2 || $# > 4 )); then
  echo "Usage: $0 <input.w3x> <output.w3x> [_build/warlord-ai.lua]" >&2
  exit 1
fi

input=$(realpath -e -- "$1")
output=$(realpath -m -- "$2")
bundle=$(realpath -e -- "${3:-_build/warlord-ai.lua}")

if [[ "$input" == "$output" || "$bundle" == "$output" ]]; then
  echo 'Output must differ from the input map and bundle.' >&2
  exit 1
fi

mkdir -p -- "$(dirname -- "$output")"
work=$(mktemp -d "$(dirname -- "$output")/.warlord-map.XXXXXXXX")
trap 'rm -rf -- "$work"' EXIT

cp -- "$input" "$work/map.w3x"
cd "$work"
smpq -x map.w3x war3map.lua

if [[ ! -s war3map.lua ]]; then
  echo 'Expected a Lua-enabled map with a root war3map.lua.' >&2
  exit 1
fi

# Install before map code can capture or call the original AI starter.
{
  printf '\n-- W3 WARLORD INJECTION BEGIN\n'

  cat -- "$bundle"

  cat <<LUA
do
    local startMeleeAI = StartMeleeAI

    function StartMeleeAI(player, script)
        if GetAIDifficulty(player) == AI_DIFFICULTY_NORMAL then
            return WarlordAIMain(player)
        end

        return startMeleeAI(player, script)
    end
end
LUA

  printf '\n-- W3 WARLORD INJECTION END\n'

  cat war3map.lua
} > patched.lua
mv patched.lua war3map.lua

smpq -a -f map.w3x war3map.lua
mv -f -- map.w3x "$output"
echo "Generated $output"
