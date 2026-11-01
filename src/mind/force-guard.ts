import type { UnitId } from '../contracts/ids';
import type {
  WarlordForce,
  WarlordIntentionStep,
} from '../contracts/intentions';
import type { WarcraftProbes } from '../contracts/probes';

export { type ForceGuard, createForceGuard };

interface ForceGuardWithinArgs {
  force: WarlordForce;
  step: () => WarlordIntentionStep;
}

/**
 * Keeps plan runs to their Intentions' forces: the probes it hands out, and
 * the Directives a step returns, throw for a unit outside the force of the
 * Intention being stepped, since a run directing a unit it was not granted
 * is a bug.
 */
interface ForceGuard {
  readonly probes: WarcraftProbes;

  /** Steps an Intention, while the guard checks units against its force. */
  within({ force, step }: ForceGuardWithinArgs): WarlordIntentionStep;
}

interface CreateForceGuardArgs {
  probes: WarcraftProbes;
}

function createForceGuard({ probes }: CreateForceGuardArgs): ForceGuard {
  let steppedForce: WarlordForce | undefined;

  const assertInForce = ({ unit, use }: AssertInForceArgs) => {
    if (steppedForce === undefined) {
      throw new Error(
        `Force guard: unit ${unit} ${use} outside an Intention's step.`
      );
    }

    if (!steppedForce.units.has(unit)) {
      throw new Error(
        `Force guard: unit ${unit} ${use}, but its Intention was not granted it.`
      );
    }
  };

  return {
    probes: {
      tryBuild(args) {
        assertInForce({ unit: args.unit, use: 'probed with a build order' });
        return probes.tryBuild(args);
      },

      tryHarvest(args) {
        assertInForce({ unit: args.unit, use: 'probed with a harvest order' });
        return probes.tryHarvest(args);
      },

      tryAttack(args) {
        assertInForce({ unit: args.unit, use: 'probed with an attack order' });
        return probes.tryAttack(args);
      },

      isWalkable(args) {
        return probes.isWalkable(args);
      },

      isInRange(args) {
        return probes.isInRange(args);
      },
    },

    within({ force, step }) {
      // Not reset in a `finally`: TSTL rethrows from it, so the error report
      // would lose the original traceback. An error ends the step, and the
      // next Intention's step replaces the stale force.
      steppedForce = force;

      const intentionStep = step();

      for (const directive of intentionStep.directives) {
        assertInForce({
          unit: directive.unit,
          use: `directed (${directive.reason})`,
        });
      }

      steppedForce = undefined;

      return intentionStep;
    },
  };
}

interface AssertInForceArgs {
  unit: UnitId;
  // How the unit was used, for the error.
  use: string;
}
