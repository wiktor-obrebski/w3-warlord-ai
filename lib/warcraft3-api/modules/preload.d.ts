declare module '@lib/warcraft3-api/preload' {
  /**
   * Returns: nothing
   *
   * It does two things:
   *
   * 1. Try to read the file, and if "Allow Local Files" is enabled then also searches in the game folder
   *     - The order of priority is roughly this: local files, map MPQ, and finally game files as fallback
   * 2. Append filename to preload buffer
   *
   * Preloading exists to remove the stutter when you use a file/model/whatever for the first time.
   *
   * @param filename (string) Text string, supposed to be a file path to be preloaded. Max length: 259 characters (see Windows MAX_PATH).
   *
   *   NULL characters terminate the string and are stripped from output. Backslashes `\` (0x5c) are always escaped as `\\` so they read correctly when interpreted as a Jass string.
   *   All other characters are output as is. Be careful with double quotes (0x22) and line feed (0x0a), carriage return (0x0d).
   *
   * @note The game only reads to cache these files, does not load them. The reading is done in a separate thread and does not freeze the game. One file is not read twice, no matter how often you call Preload().
   * @note Trick: It does not escape double-quotes " on purpose (approved not a bug, it's a feature).
   *   It is possible to inject custom code in Preload files this way.
   * @note See: `PreloadEnd`, `PreloadStart`, `PreloadRefresh`, `PreloadEndEx`, `PreloadGenClear`, `PreloadGenStart`, `PreloadGenEnd`, `Preloader`.
   * @patch 1.00
   */
  export function Preload(filename: string): void;

  /**
   * Returns: nothing
   *
   * Clears all added file paths from the current preload buffer. Does not reset the timer.
   *
   * @note See: `Preload`, `PreloadEnd`, `PreloadStart`, `PreloadRefresh`, `PreloadEndEx`, `PreloadGenStart`, `PreloadGenEnd`, `Preloader`.
   * @patch 1.00
   */
  export function PreloadGenClear(): void;

  /**
   * Returns: nothing
   *
   * Starts an internal timer for preloads. The timer will be used and recorded by `PreloadGenEnd`. The timer represents the wall clock time (in seconds) spent between the calls `PreloadStart()` and `PreloadGenEnd()`.
   *
   * This function does not clear the previous buffer.
   *
   * The recorded time will be output as `call PreloadEnd( 0.123 )` in the saved preload file.
   *
   * @note See: `Preload`, `PreloadEnd`, `PreloadStart`, `PreloadRefresh`, `PreloadEndEx`, `PreloadGenClear`, `PreloadGenEnd`, `Preloader`.
   * @patch 1.00
   */
  export function PreloadGenStart(): void;

  /**
   * Returns: nothing
   *
   * Writes the current Preload buffer to specified file.
   * The first and final preload directives are `call PreloadStart()` and `call PreloadEnd( realTime )`. The value represents the time in seconds between the calls `PreloadStart` and `PreloadGenEnd`. There's no way to get this value with the API.
   *
   * Does not clear the buffer or timer after flushing. The file is overwritten. It's possible to specify subfolders: "myMapFolder/file.txt". Reforged: Any other tricks such as relative paths, UNC or drive letters will not write any files. Classic: possible to write to any path (verify?)
   *
   * **Example preload file:**
   *
   * 	function PreloadFiles takes nothing returns nothing
   *
   * 		call PreloadStart()
   * 		call Preload( "units\\human\\Knight\\Knight.mdx" )
   * 		call PreloadEnd( 2.5 )
   *
   * 	endfunction
   *
   * @param filename (string) The filepath to be written to. Max length for filename is 259 characters (see: Windows MAX_PATH).
   *
   * @note Before Reforged (which version?) you needed to enable "Allow Local Files" in registry.
   * @note **Save Path:**
   *
   *   Reforged:
   *
   *   - Windows: `%USERPROFILE%\Documents\Warcraft III\CustomMapData\`
   *   - MacOS: `~/Library/Application\ Support/Blizzard/Warcraft\ III/CustomMapData/`
   *
   *   Classic: ?
   * @note See: `Preload`, `PreloadEnd`, `PreloadStart`, `PreloadRefresh`, `PreloadEndEx`, `PreloadGenClear`, `PreloadGenStart`, `Preloader`.
   * @patch 1.00
   */
  export function PreloadGenEnd(filename: string): void;
}
