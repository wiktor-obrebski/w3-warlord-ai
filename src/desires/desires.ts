import { createOptionGeneration, OptionGeneration } from '@lib/bdi';
import type { WarlordDesireOutcome } from '../contracts/desires';

export { createDesires };

/**
 * Creates the bot's Option Generation, which keeps its permanent Desires and
 * the Desires its Intentions express.
 */
function createDesires(): OptionGeneration<WarlordDesireOutcome> {
  return createOptionGeneration<WarlordDesireOutcome>({
    // No outcome has parameters yet, so its kind is its whole identity.
    identify: ({ outcome }) => outcome.kind,
    permanentDesires: PermanentDesires,
    decayIntervals: DecayIntervals,
  });
}

const PermanentDesires: readonly WarlordDesireOutcome[] = [
  { kind: 'ProtectEconomicAssets' },
  { kind: 'ApplyPressure' },
  { kind: 'UseMilitaryAssetsEffectively' },
];

const DecayIntervals = 2;
