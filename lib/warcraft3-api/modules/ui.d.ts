declare module "@lib/warcraft3-api/ui" {
  /**
   * Returns: nothing
   *
   * Displays a trigger message to player.
   *
   * The text line fades out in the end.
   *
   * @param toPlayer (player) target player
   * @param x (real) new text box position (default is 0, clamped to: 0.0-1.0)
   * @param y (real) new text box position (default is 0, clamped to: 0.0-1.0)
   * @param message (string) text (supports color codes)
   *
   * @bug Changing x or y moves the entire text box, including previously displayed lines.
   *   An example is shown at
   *   [Luashine/DisplayTextToPlayer-position](https://github.com/Luashine/wc3-test-maps/blob/master/DisplayTextToPlayer-position/DisplayTextToPlayer-position.md)
   * @note The text lines are bottom-left aligned: text continues to the right and new lines
   *   continue upwards.
   * @note This is equivalent to `DisplayTimedTextToPlayer` with `duration` of `StringLength(message) * 0.1 + 3.0`.
   * @note See: `DisplayTimedTextToPlayer`, `DisplayTimedTextFromPlayer`, `BlzDisplayChatMessage`.
   * @patch 1.00
   */
  export function DisplayTextToPlayer(toPlayer: player, x: number, y: number, message: string): void;
}
