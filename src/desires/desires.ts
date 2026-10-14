import type { OptionGeneration } from '@lib/bdi';
import type { WarlordDesireOutcome } from '../contracts/desires';
import { createOptionGeneration } from './option-generation/option-generation.api';

export { createDesires };

interface CreateDesiresArgs {
  /** How often, in game seconds, the runtime updates Intentions. */
  tickSeconds: number;
}

/**
 * Creates the bot's Option Generation, which keeps its permanent Desires and
 * the Desires its Intentions express.
 */
function createDesires({
  tickSeconds,
}: CreateDesiresArgs): OptionGeneration<WarlordDesireOutcome> {
  return createOptionGeneration({
    // No outcome has parameters yet, so its kind is its whole identity.
    identify: ({ outcome }) => outcome.kind,
    permanentDesires: PermanentDesires,
    tickSeconds,
  });
}

const PermanentDesires: readonly WarlordDesireOutcome[] = [
  { kind: 'MaintainEffectiveStrategy' },
  { kind: 'ProtectEconomicAssets' },
  { kind: 'UseMilitaryAssetsEffectively' },
];
