import type { Directives } from '../contracts/directives';
import type { UnitId } from '../contracts/ids';
import type { WarlordForce } from '../contracts/intentions';
import type { WarcraftProbes } from '../contracts/probes';

export { type ForceGuard, createForceGuard };

interface ForceGuardWithinArgs {
  force: WarlordForce;
  run: () => void;
}

/**
 * Keeps plan runs to their Intentions' forces: the Directives and probes it
 * hands out throw for a unit outside the force of the Intention being
 * stepped, since a run directing a unit it was not granted is a bug.
 */
interface ForceGuard {
  readonly directives: Directives;
  readonly probes: WarcraftProbes;

  /** Steps an Intention, while the guard checks units against its force. */
  within({ force, run }: ForceGuardWithinArgs): void;
}

interface CreateForceGuardArgs {
  directives: Directives;
  probes: WarcraftProbes;
}

function createForceGuard({
  directives,
  probes,
}: CreateForceGuardArgs): ForceGuard {
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
    directives: {
      give(directive) {
        assertInForce({
          unit: directive.unit,
          use: `directed (${directive.reason})`,
        });
        return directives.give(directive);
      },
    },

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

    within({ force, run }) {
      // Not reset in a `finally`: TSTL rethrows from it, so the error report
      // would lose the original traceback. An error ends the step, and the
      // next Intention's step replaces the stale force.
      steppedForce = force;
      run();
      steppedForce = undefined;
    },
  };
}

interface AssertInForceArgs {
  unit: UnitId;
  // How the unit was used, for the error.
  use: string;
}
