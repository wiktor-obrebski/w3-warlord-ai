import type { WarlordOutcome } from '../contracts/desires';

export { identifyOutcome };

/**
 * The identity of an outcome, its kind and its arguments, which also names
 * its Desire and Intention in the decision record.
 */
function identifyOutcome({ outcome }: { outcome: WarlordOutcome }): string {
  switch (outcome.kind) {
    case 'ExecuteStrategy':
      return `ExecuteStrategy{${outcome.playbook}}`;
    case 'EstablishTowerPosition':
    case 'OperateTowers':
      return outcome.kind;
  }
}
