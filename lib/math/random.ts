export { type Random, SEEDED_RANDOM_MAX_SEED, createSeededRandom };

/** A source of random numbers. */
interface Random {
  /** A number from `min` to `max`. */
  real({ min, max }: { min: number; max: number }): number;
}

// 2^31 - 1, the Park-Miller generator's modulus.
const Modulus = 2147483647;

const SEEDED_RANDOM_MAX_SEED = Modulus - 1;

/**
 * A Park-Miller "minimal standard" generator: the same seed gives the same
 * numbers, in Node.js and in Lua with 32-bit integers and single-precision
 * floats alike. `seed` is a whole number from 1 to `SEEDED_RANDOM_MAX_SEED`.
 */
function createSeededRandom({ seed }: { seed: number }): Random {
  if (Math.floor(seed) !== seed || seed < 1 || seed > SEEDED_RANDOM_MAX_SEED) {
    throw new Error(
      `Seeded random: the seed must be a whole number from 1 to ${SEEDED_RANDOM_MAX_SEED}, not ${seed}.`
    );
  }

  let state = seed;

  const nextFraction = () => {
    state = nextState({ state });

    return state / Modulus;
  };

  return {
    real({ min, max }) {
      return min + (max - min) * nextFraction();
    },
  };
}

const Multiplier = 16807;
// Modulus = Multiplier * Quotient + Remainder.
const Quotient = 127773;
const Remainder = 2836;

// Schrage's method computes Multiplier * state modulo Modulus without any
// intermediate reaching 2^31, so 32-bit integers never wrap. The one
// division is rounded: its exact result is a whole number, which a
// single-precision float may miss by a fraction.
function nextState({ state }: { state: number }): number {
  const low = state % Quotient;
  const high = Math.round((state - low) / Quotient);
  const product = Multiplier * low - Remainder * high;

  return product > 0 ? product : product + Modulus;
}
