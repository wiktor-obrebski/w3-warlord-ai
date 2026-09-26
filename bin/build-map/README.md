# Build a Warlord AI map

`build-map.sh` copies a local Warcraft III map, embeds the packaged Lua bot,
and adds automatic startup.

The bot will start only for "Computer (Normal)" slots. 

## Requirements

- Bash, standard GNU/Linux utilities, and `smpq` on `PATH`.
- A Lua-enabled template map with a root `war3map.lua` and normal `main()` initialization.
- A packaged bundle defining `WarlordRunBundle()`.

Configure the template's player slots and disable default melee AI for Warlord's player beforehand. The script does not change those settings or convert JASS maps.

## Usage

Run:

```bash
./build-map.sh $SOURCE_MAP_PATH $NEW_BOT_MAP_PATH [_build/warlord-ai.lua]
```
