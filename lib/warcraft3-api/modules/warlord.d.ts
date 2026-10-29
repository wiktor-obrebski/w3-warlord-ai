declare module '@lib/warcraft3-api/warlord' {
  /**
   * Wraps a timer or trigger callback so an error raised in it is reported
   * like a startup error. The startup `xpcall` only protects startup
   * execution, not callbacks Warcraft invokes later.
   *
   * @note Provided by `runtime/runtime-template.lua`, not Warcraft.
   */
  export function guard(callback: () => void): () => void;

  /**
   * Registers the function called with every error the wrapper reports
   * in-game, from the startup `xpcall` and from callbacks wrapped with
   * `guard`, as the message shown: source-mapped to the TypeScript file and
   * line where the map is available. Errors before registration are only
   * shown. A later call replaces the listener. An error raised by the
   * listener itself is shown but never passed back to it.
   *
   * @note Provided by `runtime/runtime-template.lua`, not Warcraft.
   */
  export function setErrorListener(listener: (message: string) => void): void;

  /**
   * Real-world time as the decimal digits of milliseconds since the Unix
   * epoch, or `undefined` when Warcraft's Lua offers no wall clock. Text,
   * because Warcraft's Lua integers are 32-bit and cannot hold the number.
   * Accurate to about a second; finer differences between readings follow
   * `os.clock`.
   *
   * @note Differs between players, so it must never affect game state.
   * @note Provided by `runtime/runtime-template.lua`, not Warcraft.
   */
  export function readWallClockMillisecondsText(): string | undefined;

  /**
   * Lua's `os.clock` in seconds, for measuring durations, or `undefined`
   * when it is missing. In-game it follows real time, apparently since the
   * Warcraft process started. As a 32-bit float, it resolves a millisecond
   * only for the first 2^14 seconds, about 4.5 hours.
   *
   * @note Differs between players, so it must never affect game state.
   * @note Provided by `runtime/runtime-template.lua`, not Warcraft.
   */
  export function readClockSeconds(): number | undefined;
}
