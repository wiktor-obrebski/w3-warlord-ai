import type { Beliefs } from '../../../contracts/beliefs';
import type { Directives } from '../../../contracts/directives';
import type { WarlordForce } from '../../../contracts/intentions';
import { TowerRushState } from '../tower-rush.state';
import { FORWARD_WORKER_COUNT } from '../tower-rush.judgments';

export { updateStart };

interface UpdateStartArgs {
  beliefs: Beliefs;
  rush: TowerRushState;
  force: WarlordForce;
  directives: Directives;
}

/**
 * The Peasants the run was granted become the forward workers, and answer
 * the Call to Arms.
 */
function updateStart({ beliefs, rush, force, directives }: UpdateStartArgs) {
  if (!beliefs.enemy.mainGoldMine) {
    throw new Error('Tower rush start: enemy main gold mine not found.');
  }

  rush.forwardWorkers = beliefs.self.peasants.filter((peasant) =>
    force.units.has(peasant)
  );

  if (rush.forwardWorkers.length < FORWARD_WORKER_COUNT) {
    throw new Error(
      `Tower rush start: expected ${FORWARD_WORKER_COUNT} forward workers, granted ${rush.forwardWorkers.length}.`
    );
  }

  for (const worker of rush.forwardWorkers) {
    directives.give({
      unit: worker,
      task: { kind: 'UseAbility', orderString: 'militia' },
      reason: 'Tower rush: forward worker answers the Call to Arms',
    });
  }
}
