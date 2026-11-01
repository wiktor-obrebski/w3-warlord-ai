import type { Desire, Proposal } from '@lib/chain-of-command';
import type { BuildOrder } from './build-order';

export {
  type PlaybookName,
  type ExecuteStrategy,
  type EstablishTowerPosition,
  type RunEconomy,
  type WarlordOutcome,
  type WarlordProposal,
  type WarlordDesire,
};

/** A strategy the bot can commit to, written down as a playbook. */
type PlaybookName = 'HumanTowerRush';

/** Commit to a strategy and follow its playbook. */
interface ExecuteStrategy {
  readonly kind: 'ExecuteStrategy';
  readonly playbook: PlaybookName;
}

/** Guard Towers established next to the enemy main and kept repaired. */
interface EstablishTowerPosition {
  readonly kind: 'EstablishTowerPosition';
}

/** A home economy, built up as the build order says. */
interface RunEconomy {
  readonly kind: 'RunEconomy';
  readonly buildOrder: BuildOrder;
}

/** Every outcome the bot can desire. */
type WarlordOutcome = ExecuteStrategy | EstablishTowerPosition | RunEconomy;

type WarlordProposal = Proposal<WarlordOutcome>;

type WarlordDesire = Desire<WarlordOutcome>;
