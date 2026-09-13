# WC3 Warlord AI

**WC3 Warlord AI** is a Warcraft III melee AI designed to behave more like a competent player than a traditional scripted bot.

It is written in Wurst and compiled to JASS.

## Build

```sh
docker compose run --rm wurst
```

Output: `_build/w3-warlord.ai`

## Use

Copy `_build/w3-warlord.ai` to the Warcraft III `Scripts` directory using the
filename for the AI's race:

| Race | Filename |
| --- | --- |
| Human | `human.ai` |
| Orc | `orc.ai` |
| Undead | `undead.ai` |
| Night Elf | `elf.ai` |

### Linux

Warcraft III ignores replacement files in the local `Scripts` directory by
default. To load the custom AI, enable the `Allow Local Files` DWORD with value
`1` under
`HKEY_CURRENT_USER\Software\Blizzard Entertainment\Warcraft III` in the Wine
prefix used by Warcraft III.

See the [local files guide](https://www.hiveworkshop.com/threads/local-files.330849/)
for setup instructions.
