import type { Desire, Proposal } from '@lib/chain-of-command';

export {
  type PlaybookName,
  type ExecuteStrategy,
  type EstablishTowerPosition,
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

/**
 * Guard Towers established next to the enemy main and kept repaired, funded
 * by a home economy.
 */
interface EstablishTowerPosition {
  readonly kind: 'EstablishTowerPosition';
}

/** Every outcome the bot can desire. */
type WarlordOutcome = ExecuteStrategy | EstablishTowerPosition;

type WarlordProposal = Proposal<WarlordOutcome>;

type WarlordDesire = Desire<WarlordOutcome>;
