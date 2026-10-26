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
   * Real-world time as the decimal digits of milliseconds since the Unix
   * epoch, or `undefined` when Warcraft's Lua offers no wall clock. Text,
   * because Warcraft's Lua integers are 32-bit and cannot hold the number.
   * Accurate to about a second; finer differences between readings are
   * accurate on Windows, and only whole seconds without `os.clock`.
   *
   * @note Differs between players, so it must never affect game state.
   * @note Provided by `runtime/runtime-template.lua`, not Warcraft.
   */
  export function readWallClockMillisecondsText(): string | undefined;

  /**
   * Lua's `os.clock` in seconds, for measuring durations, or `undefined`
   * when it is missing. Elapsed time on Windows, CPU time elsewhere.
   *
   * @note Differs between players, so it must never affect game state.
   * @note Provided by `runtime/runtime-template.lua`, not Warcraft.
   */
  export function readClockSeconds(): number | undefined;
}
