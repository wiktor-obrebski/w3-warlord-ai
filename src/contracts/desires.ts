import type { Desire, DesireExpressionProvider } from '@lib/bdi';

export {
  type WarlordDesireOutcome,
  type WarlordDesire,
  type WarlordDesireExpression,
};

/** Keep executing a strategy that suits the situation. */
interface MaintainEffectiveStrategy {
  readonly kind: 'MaintainEffectiveStrategy';
}

/** Execute a Human tower rush. */
interface ExecuteTowerRushStrategy {
  readonly kind: 'ExecuteTowerRushStrategy';
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
  | MaintainEffectiveStrategy
  | ExecuteTowerRushStrategy
  | ProtectEconomicAssets
  | UseMilitaryAssetsEffectively;

type WarlordDesire = Desire<WarlordDesireOutcome>;

type WarlordDesireExpression = DesireExpressionProvider<WarlordDesireOutcome>;
