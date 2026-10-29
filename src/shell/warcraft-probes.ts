import * as W3UnitApi from '@lib/warcraft3-api/unit';
import * as W3TerrainApi from '@lib/warcraft3-api/terrain';
import type { WarcraftProbes } from '../contracts/probes';
import type { Perception } from './perception';

export { createWarcraftProbes };

/**
 * The direct Warcraft calls the mind may still make; see `WarcraftProbes`.
 * A call for a unit that no longer exists counts as refused.
 */
function createWarcraftProbes({
  perception,
}: {
  perception: Perception;
}): WarcraftProbes {
  const { unitIds, destructableIds } = perception;

  return {
    tryBuild({ unit, building, point }) {
      const builder = unitIds.handleOf({ id: unit });

      return (
        builder !== undefined &&
        W3UnitApi.IssueBuildOrderById(builder, building, point.x, point.y)
      );
    },

    tryHarvest({ unit, destructable }) {
      const worker = unitIds.handleOf({ id: unit });
      const tree = destructableIds.handleOf({ id: destructable });

      return (
        worker !== undefined &&
        tree !== undefined &&
        W3UnitApi.IssueTargetOrder(worker, 'harvest', tree)
      );
    },

    tryAttack({ unit, target }) {
      const attacker = unitIds.handleOf({ id: unit });
      const attacked = unitIds.handleOf({ id: target });

      return (
        attacker !== undefined &&
        attacked !== undefined &&
        W3UnitApi.IssueTargetOrder(attacker, 'attack', attacked)
      );
    },

    // Terrain pathing is static map knowledge, so reading it is fair.
    isWalkable({ point }) {
      // IsTerrainPathable is inverted: it returns false where the pathing
      // type is set, i.e. where the point is walkable.
      return !W3TerrainApi.IsTerrainPathable(
        point.x,
        point.y,
        W3TerrainApi.PATHING_TYPE_WALKABILITY
      );
    },

    isInRange({ unit, target, range }) {
      const from = unitIds.handleOf({ id: unit });
      const to = unitIds.handleOf({ id: target });

      return (
        from !== undefined &&
        to !== undefined &&
        W3UnitApi.IsUnitInRange(from, to, range)
      );
    },
  };
}
