declare module '@lib/warcraft3-api/math' {
  /**
   * Returns: integer
   *
   * Returns a random integer in the range [lowBound, highBound] (inclusive).
   * Bounds may be negative, but should be lowBound <= highBound.
   * When lowBound==highBound, always returns that number.
   *
   * The behaviour is a bit surprising if lowBound > highBound. See `GetRandomReal`
   * for a full description.
   *
   * @param lowBound (integer) The inclusive lower bound of the random number returned.
   * @param highBound (integer) The inclusive higher bound of the random number returned.
   *
   * @bug If you call `GetRandomInt(INT_MIN, INT_MAX)` or `GetRandomInt(INT_MAX, INT_MIN)`
   *   it will always return the same value, namely `INT_MIN` or `INT_MAX`.
   * @note See <http://hiveworkshop.com/threads/random.286109#post-3073222> for an overview of the algorithm used.
   * @note **Desyncs!** The random number generator is a global, shared resource.
   *   Do not change its state in local blocks asynchronously.
   * @note See: `GetRandomReal`, `SetRandomSeed`.
   * @patch 1.00
   */
  export function GetRandomInt(lowBound: number, highBound: number): number;

  /**
   * Returns: real
   *
   * When `lowBound<highBound` returns a real in range \[lowBound, highBound) that is: inclusive, exclusive.
   * When `lowBound==highBound`, always returns that number.
   *
   * When bounds are reversed `lowBound>highBound` then the behavior might surprise you.
   * For example, the min/mid/max limits for (1,-8\] are 1/5.5/10.
   * See the formula below or table at <https://github.com/lep/jassdoc/issues/151#issuecomment-2177178728>.
   *
   * **Example (Lua):**
   *
   * ````{.lua}
   * local lowSeed = 1229611
   * local midSeed = 7685839
   * local highSeed = 23999343
   *
   * SetRandomSeed(lowSeed)
   * string.format("%.16f", GetRandomReal(0, 0.002)) --> "0.00"
   * SetRandomSeed(lowSeed)
   * string.format("%.16f", GetRandomReal(-0.002, 0)) --> "-0.002"
   *
   * SetRandomSeed(midSeed)
   * string.format("%.16f", GetRandomReal(0, 50)) --> "25.000"
   *
   * SetRandomSeed(highSeed)
   * string.format("%.16f", GetRandomReal(0, 50)) --> "49.9999580383300781"
   * ````
   *
   * @note **Desyncs!** The random number generator is a global, shared resource. Do not change its state in local blocks asynchronously.
   * @note The bounds for generated values can be calculated with these formulas:
   *
   *   ````{.lua}
   *   function bounds(low, high)
   *       local min = low
   *       local delta = (low > high) and (low - high) or (high - low)
   *       local mid = low + delta / 2
   *       local max = low + delta
   *
   *       return min, mid, max
   *   end
   *   ````
   * @note See: `GetRandomInt`, `SetRandomSeed`.
   * @patch 1.00
   */
  export function GetRandomReal(lowBound: number, highBound: number): number;
}
