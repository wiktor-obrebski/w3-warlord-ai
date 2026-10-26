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
   * Real-world time in milliseconds since the Unix epoch, or `undefined`
   * when Warcraft's Lua offers no wall clock. Accurate to about a second;
   * finer differences between readings are accurate on Windows.
   *
   * @note Differs between players, so it must never affect game state.
   * @note Provided by `runtime/runtime-template.lua`, not Warcraft.
   */
  export function readWallClockMilliseconds(): number | undefined;
}
