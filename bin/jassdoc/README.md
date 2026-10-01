# Jassdoc CLI

Small command-line wrapper for looking up Warcraft III JASS API documentation from Jassdoc.

It prints a ready-to-copy JSDoc-style comment followed by the original JASS declaration.

## Usage

```bash
./jassdoc.sh <symbol>
```

Example:

```bash
./jassdoc.sh GroupEnumUnitsOfPlayer
```

Example output:

```jass
/**
 * Returns: nothing
 *
 * Clears a group and then adds units of matching player to it.
 *
 * @param whichGroup (group) The group to be modified.
 * @param whichPlayer (player) The player whose units to consider for adding units.
 * @param filter (boolexpr) A filter function that is run for each considered unit.
 *
 * @note If the filter function is `null` (`nil` in Lua), all considered units will be added to the group.
 * @patch 1.00
 */
native GroupEnumUnitsOfPlayer takes group whichGroup, player whichPlayer, boolexpr filter returns nothing
```

## Database

The script uses `jass.db` generated from the [lep/jassdoc](https://github.com/lep/jassdoc) project.

If the database does not exist next to the script, a prebuilt version from [WurstScript/wurst-jassdoc-build](https://github.com/WurstScript/wurst-jassdoc-build) is downloaded automatically.

You can also override its location:

```bash
JASSDOC_DB=/path/to/jass.db ./jassdoc.sh GroupEnumUnitsOfPlayer
