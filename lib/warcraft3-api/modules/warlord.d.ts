declare module "@lib/warcraft3-api/warlord" {
  /**
   * Wraps a timer or trigger callback so an error raised in it is reported
   * like a startup error. The startup `xpcall` only protects startup
   * execution, not callbacks Warcraft invokes later.
   *
   * @note Provided by `runtime/runtime-template.lua`, not Warcraft.
   */
  export function guard(callback: () => void): () => void;
}
