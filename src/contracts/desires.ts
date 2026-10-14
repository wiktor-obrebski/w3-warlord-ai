import type { Desire, DesireExpressionProvider } from '@lib/bdi';

export {
  type WarlordDesireOutcome,
  type WarlordDesire,
  type WarlordDesireExpression,
};

/** Keep the enemy under pressure. */
interface ApplyPressure {
  readonly kind: 'ApplyPressure';
}

/** Keep workers and other economic assets alive. */
interface ProtectEconomicAssets {
  readonly kind: 'ProtectEconomicAssets';
}

/** Get the most out of the bot's military assets. */
interface UseMilitaryAssetsEffectively {
  readonly kind: 'UseMilitaryAssetsEffectively';
}

/** Every outcome the bot can desire. */
type WarlordDesireOutcome =
  | ApplyPressure
  | ProtectEconomicAssets
  | UseMilitaryAssetsEffectively;

type WarlordDesire = Desire<WarlordDesireOutcome>;

type WarlordDesireExpression = DesireExpressionProvider<WarlordDesireOutcome>;
