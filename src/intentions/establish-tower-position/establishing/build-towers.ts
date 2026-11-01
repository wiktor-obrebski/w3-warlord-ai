import * as W3HumanApi from '@lib/warcraft3-api/human';
import { Point, Random, Vector } from '@lib/math';
import type { UnitId } from '../../../contracts/ids';
import type { Directives } from '../../../contracts/directives';
import type { WarlordForce, WarlordMoney } from '../../../contracts/intentions';
import type { WarcraftProbes } from '../../../contracts/probes';
import type { DecisionRecorder } from '../../../contracts/record';
import type { Beliefs } from '../../../contracts/beliefs';
import { TowerRushState } from '../tower-rush.state';
import {
  forwardPeasantsInForce,
  forgetSentToSafety,
  hideBehindClosestTower,
} from '../forward-workers';
import {
  allRushTowersBuilt,
  closestUnit,
  constructionProgress,
  isAvailableForwardPeasant,
  positionOf,
  RUSH_TOWER_COUNT,
  rushTowersAtLeast,
} from '../tower-rush.judgments';

export {
  type BuildTowersState,
  createBuildTowersState,
  updateBuildTowers,
  towerBuildCosts,
};

interface BuildTowersState {
  // Build orders whose builder is still busy with them.
  pendingTowerSites: TowerSite[];
  // Repair orders on unfinished towers whose helper is still busy with them.
  towerHelpers: TowerHelper[];
  // Whether a missing tower waits for the money reserved for it.
  waitingForMoney: boolean;
}

function createBuildTowersState(): BuildTowersState {
  return { pendingTowerSites: [], towerHelpers: [], waitingForMoney: false };
}

interface UpdateBuildTowersArgs {
  beliefs: Beliefs;
  rush: TowerRushState;
  buildTowersState: BuildTowersState;
  force: WarlordForce;
  directives: Directives;
  probes: WarcraftProbes;
  recorder: DecisionRecorder;
  random: Random;
}

/**
 * Returns where the rush towers stand once building them is finished.
 *
 * An accepted build order can still fail when the Peasant arrives (blocked
 * spot, missing resources), so towers are counted from what actually exists
 * or is on its way, and missing ones are re-ordered one Peasant at a time.
 * Once every tower is accounted for, free forward Peasants help unfinished
 * towers; only when all towers are built do they hide behind them, and
 * building ends once all of them are sent to hide.
 */
function updateBuildTowers({
  beliefs,
  rush,
  buildTowersState,
  force,
  directives,
  probes,
  recorder,
  random,
}: UpdateBuildTowersArgs): { towerPositions: Point[] | undefined } {
  const enemyMain = beliefs.enemy.startPosition;

  if (!enemyMain) {
    throw new Error('Tower rush: enemy start position not found.');
  }

  if (!beliefs.enemy.mainGoldMine) {
    throw new Error('Tower rush: enemy main gold mine not found.');
  }

  forgetAbandonedTowerSites({ beliefs, buildTowersState, recorder });
  forgetFinishedTowerHelpers({ beliefs, buildTowersState });

  const towerPositions = beliefs.self.scoutTowers.map((tower) =>
    positionOf({ beliefs, unit: tower })
  );
  const sitesAwaitingTower = buildTowersState.pendingTowerSites.filter(
    (site) => !hasStartedTower({ site, towerPositions })
  );
  const workersInForce = forwardPeasantsInForce({ beliefs, rush, force });
  const freeWorkers = workersInForce.filter((worker) =>
    isAvailableForwardPeasant({ beliefs, worker })
  );

  // Free Peasants keep ordering missing towers, each attempt searching from
  // the beginning. An ordered tower can still fail when its builder arrives,
  // so free Peasants only help or hide once every tower has started; until
  // then they stay free to retry a failed build.
  if (
    towerPositions.length + sitesAwaitingTower.length < RUSH_TOWER_COUNT &&
    canAffordAnotherTower({
      money: force.money,
      awaiting: sitesAwaitingTower.length,
      buildTowersState,
      recorder,
    })
  ) {
    const builder =
      freeWorkers[0] ??
      busyNonBuilder({ workersInForce, buildTowersState, recorder });

    if (builder) {
      forgetSentToSafety({ worker: builder, rush });
      buildTowersState.towerHelpers = buildTowersState.towerHelpers.filter(
        (help) => help.builder !== builder
      );
      orderScoutTower({
        worker: builder,
        rules: {
          mine: beliefs.enemy.mainGoldMine.position,
          enemyMain,
          occupied: [
            ...towerPositions,
            ...sitesAwaitingTower.map((site) => site.position),
          ],
          requireEnemyMainInReach: true,
        },
        buildTowersState,
        directives,
        probes,
        recorder,
        random,
      });
    }
  } else if (towerPositions.length >= RUSH_TOWER_COUNT) {
    if (allRushTowersBuilt({ beliefs })) {
      for (const worker of freeWorkers) {
        if (!rush.forwardWorkersSentToSafety.has(worker)) {
          hideBehindClosestTower({
            worker,
            towers: beliefs.self.scoutTowers,
            enemyMain,
            beliefs,
            rush,
            directives,
            recorder,
          });
        }
      }
    } else {
      for (const worker of freeWorkers) {
        helpUnfinishedTower({
          worker,
          beliefs,
          buildTowersState,
          directives,
          recorder,
        });
      }
    }
  }

  // From here the towers finish soon enough that the upgrade gold must
  // already be at hand, or the last upgrade waits for income.
  if (
    !rush.reservingForUpgrades &&
    rushTowersAtLeast({
      beliefs,
      lifeFraction: ReserveUpgradeMoneyLifeFraction,
    })
  ) {
    rush.reservingForUpgrades = true;
    recorder.note({
      message: 'Tower rush: reserving money for the Guard Tower upgrades.',
    });
  }

  return {
    towerPositions: towerBuildingFinished({ beliefs, rush })
      ? towerPositions
      : undefined,
  };
}

// A Scout Tower is paid when its builder places it, so a tower that has
// started costs nothing more.
function towerBuildCosts({ beliefs }: { beliefs: Beliefs }): WarlordMoney {
  const towersToBuild = Math.max(
    0,
    RUSH_TOWER_COUNT - beliefs.self.scoutTowers.length
  );

  return {
    gold: towersToBuild * ScoutTowerGoldCost,
    lumber: towersToBuild * ScoutTowerLumberCost,
  };
}

// Warcraft's listed costs; not verified in-game.
const ScoutTowerGoldCost = 30;
const ScoutTowerLumberCost = 20;
// Center distance at which a target still counts as within reach of the
// upgraded tower (Guard Tower range is 700). Not verified in-game.
const TowerReach = 700;
// The exact gold mine and Scout Tower footprints are not known here, so the
// search starts at the smallest plausible non-colliding distance and widens
// on rejection. The accepted distances are logged to tune these values.
const MinDistanceFromMine = 64;
const DistanceIncrease = 16;
const RejectionsPerDistanceIncrease = 10;
// Observed: a rooted Tree of Life attacks. It killed Peasants and towers
// placed about 450 from the enemy start location where it stands, and still
// occasionally reached towers at 560.
const MinDistanceFromEnemyMain = 620;
// A Scout Tower occupies a 128x128 square; the margin allows for Warcraft
// shifting the placement onto its build grid. Pending sites must be checked
// here because Warcraft only sees a tower once its construction has started.
const MinTowerCenterOffset = 160;
// How far Warcraft's grid snapping may move a tower from its ordered spot.
const StartedTowerMatchDistance = 64;
const AttemptsNextToFirstTower = 10;
const MaxBuildProgressWorthHelping = 0.5;
const ReserveUpgradeMoneyLifeFraction = 0.5;

interface CanAffordAnotherTowerArgs {
  money: WarlordMoney;
  // Towers ordered but not yet placed, still to be paid from the same money.
  awaiting: number;
  buildTowersState: BuildTowersState;
  recorder: DecisionRecorder;
}

// Notes when a missing tower starts waiting for its money.
function canAffordAnotherTower({
  money,
  awaiting,
  buildTowersState,
  recorder,
}: CanAffordAnotherTowerArgs): boolean {
  const affordable =
    money.gold >= (awaiting + 1) * ScoutTowerGoldCost &&
    money.lumber >= (awaiting + 1) * ScoutTowerLumberCost;

  if (!affordable && !buildTowersState.waitingForMoney) {
    recorder.note({
      message: `Tower rush: a Scout Tower waits for money (gold ${money.gold}, lumber ${money.lumber} reserved).`,
    });
  }

  buildTowersState.waitingForMoney = !affordable;

  return affordable;
}

interface TowerSite {
  builder: UnitId;
  position: Point;
}

interface TowerHelper {
  builder: UnitId;
  tower: UnitId;
}

interface PlacementRules {
  mine: Point;
  enemyMain: Point;
  occupied: Point[];
  requireEnemyMainInReach: boolean;
}

interface BusyNonBuilderArgs {
  workersInForce: readonly UnitId[];
  buildTowersState: BuildTowersState;
  recorder: DecisionRecorder;
}

// A missing tower must not wait for a free Peasant: Warcraft can keep a
// Peasant busy on its own, e.g. attacking or repairing, until the other
// towers finish. Any forward Peasant of the force that is not building a
// tower is taken off its order instead.
function busyNonBuilder({
  workersInForce,
  buildTowersState,
  recorder,
}: BusyNonBuilderArgs): UnitId | undefined {
  const builders = buildTowersState.pendingTowerSites.map(
    (site) => site.builder
  );
  const worker = workersInForce.find(
    (candidate) => !builders.includes(candidate)
  );

  if (worker) {
    recorder.note({
      message:
        'Tower rush: forward Peasant taken off its current order to build the missing tower.',
    });
  }

  return worker;
}

interface HelpUnfinishedTowerArgs {
  worker: UnitId;
  beliefs: Beliefs;
  buildTowersState: BuildTowersState;
  directives: Directives;
  recorder: DecisionRecorder;
}

// A tower without a living builder would never finish, so it is taken over
// first. Otherwise a second worker only pays off early in construction.
function helpUnfinishedTower({
  worker,
  beliefs,
  buildTowersState,
  directives,
  recorder,
}: HelpUnfinishedTowerArgs) {
  const unfinished = beliefs.self.scoutTowers.filter((tower) =>
    beliefs.self.buildingsUnderConstruction.includes(tower)
  );
  const abandoned = closestUnit({
    beliefs,
    units: unfinished.filter(
      (tower) => !hasLivingBuilder({ tower, beliefs, buildTowersState })
    ),
    to: worker,
  });
  const tower =
    abandoned ??
    closestUnit({
      beliefs,
      units: unfinished.filter(
        (tower) =>
          constructionProgress({ beliefs, building: tower }) <
          MaxBuildProgressWorthHelping
      ),
      to: worker,
    });

  if (!tower) {
    return;
  }

  // Human Peasants help an unfinished building through the repair order. A
  // helper whose repair is refused stays free, so it is forgotten on the
  // next update.
  directives.give({
    unit: worker,
    task: { kind: 'Repair', repairTarget: tower },
    reason: 'Tower rush: forward Peasant helps an unfinished tower',
  });
  buildTowersState.towerHelpers.push({ builder: worker, tower });
  recorder.note({
    message: `Tower rush: forward Peasant ${abandoned ? 'takes over' : 'helps'} a tower at ${Math.floor(constructionProgress({ beliefs, building: tower }) * 100)}% progress.`,
  });
}

interface HasLivingBuilderArgs {
  tower: UnitId;
  beliefs: Beliefs;
  buildTowersState: BuildTowersState;
}

// Builders and helpers are only remembered while they are alive and busy.
function hasLivingBuilder({
  tower,
  beliefs,
  buildTowersState,
}: HasLivingBuilderArgs): boolean {
  const towerPosition = positionOf({ beliefs, unit: tower });

  return (
    buildTowersState.pendingTowerSites.some(
      (site) =>
        new Vector({ start: site.position, end: towerPosition }).length <=
        StartedTowerMatchDistance
    ) || buildTowersState.towerHelpers.some((help) => help.tower === tower)
  );
}

interface ForgetFinishedTowerHelpersArgs {
  beliefs: Beliefs;
  buildTowersState: BuildTowersState;
}

// Helpers that are free again have finished or abandoned their help.
function forgetFinishedTowerHelpers({
  beliefs,
  buildTowersState,
}: ForgetFinishedTowerHelpersArgs) {
  buildTowersState.towerHelpers = buildTowersState.towerHelpers.filter(
    (help) =>
      beliefs.self.peasants.includes(help.builder) &&
      !isAvailableForwardPeasant({ beliefs, worker: help.builder }) &&
      beliefs.self.scoutTowers.includes(help.tower)
  );
}

interface TowerBuildingFinishedArgs {
  beliefs: Beliefs;
  rush: TowerRushState;
}

// A Peasant is only sent to safety once it is done building and helping, so
// building need not wait for it to arrive; upgrades can start meanwhile.
function towerBuildingFinished({
  beliefs,
  rush,
}: TowerBuildingFinishedArgs): boolean {
  const livingForwardPeasants = rush.forwardWorkers.filter((worker) =>
    beliefs.self.peasants.includes(worker)
  );

  return (
    (beliefs.self.scoutTowers.length >= RUSH_TOWER_COUNT ||
      livingForwardPeasants.length === 0) &&
    livingForwardPeasants.every((worker) =>
      rush.forwardWorkersSentToSafety.has(worker)
    )
  );
}

interface ForgetAbandonedTowerSitesArgs {
  beliefs: Beliefs;
  buildTowersState: BuildTowersState;
  recorder: DecisionRecorder;
}

// Before its tower starts, a site lasts only while its builder still carries
// the build order; any other order means the build was given up, even when
// Warcraft gave that order on its own. Once the tower has started, the site
// marks the tower's builder until the builder is free again.
function forgetAbandonedTowerSites({
  beliefs,
  buildTowersState,
  recorder,
}: ForgetAbandonedTowerSitesArgs) {
  const towerPositions = beliefs.self.scoutTowers.map((tower) =>
    positionOf({ beliefs, unit: tower })
  );

  buildTowersState.pendingTowerSites =
    buildTowersState.pendingTowerSites.filter((site) => {
      const started = hasStartedTower({ site, towerPositions });
      const builderAlive = beliefs.self.peasants.includes(site.builder);
      const builderBusy =
        builderAlive &&
        (beliefs.self.scoutTowerBuildOrderUnits.includes(site.builder) ||
          (started &&
            !isAvailableForwardPeasant({ beliefs, worker: site.builder })));

      if (!builderBusy && !started) {
        recorder.note({
          message:
            'Tower rush: Scout Tower build failed before it started; retrying.',
        });
      }

      return builderBusy;
    });
}

interface HasStartedTowerArgs {
  site: TowerSite;
  towerPositions: Point[];
}

function hasStartedTower({
  site,
  towerPositions,
}: HasStartedTowerArgs): boolean {
  return towerPositions.some(
    (tower) =>
      new Vector({ start: tower, end: site.position }).length <=
      StartedTowerMatchDistance
  );
}

interface OrderScoutTowerArgs {
  worker: UnitId;
  rules: PlacementRules;
  buildTowersState: BuildTowersState;
  directives: Directives;
  probes: WarcraftProbes;
  recorder: DecisionRecorder;
  random: Random;
}

// Spots covering both the mine and the main hall are preferred; covering
// only the mine is accepted once the whole search has found no such spot.
function orderScoutTower({
  worker,
  rules,
  buildTowersState,
  directives,
  probes,
  recorder,
  random,
}: OrderScoutTowerArgs) {
  for (const requireEnemyMainInReach of [true, false]) {
    const searchRules = { ...rules, requireEnemyMainInReach };
    const coverage = requireEnemyMainInReach
      ? 'covers the mine and main hall'
      : 'covers only the mine';

    if (
      orderScoutTowerNextToFirstTower({
        worker,
        rules: searchRules,
        buildTowersState,
        directives,
        probes,
        random,
      }).accepted
    ) {
      recorder.note({
        message: `Tower rush: Scout Tower ordered next to the first tower; ${coverage}.`,
      });
      return;
    }

    const { distanceFromMine } = orderScoutTowerNearMine({
      worker,
      rules: searchRules,
      buildTowersState,
      directives,
      probes,
      random,
    });

    if (distanceFromMine !== undefined) {
      recorder.note({
        message: `Tower rush: Scout Tower ordered ${distanceFromMine} from the mine; ${coverage}.`,
      });
      return;
    }
  }

  recorder.note({
    message: 'Tower rush: no Scout Tower placement accepted.',
  });
}

interface OrderScoutTowerNextToFirstTowerArgs {
  worker: UnitId;
  rules: PlacementRules;
  buildTowersState: BuildTowersState;
  directives: Directives;
  probes: WarcraftProbes;
  random: Random;
}

function orderScoutTowerNextToFirstTower({
  worker,
  rules,
  buildTowersState,
  directives,
  probes,
  random,
}: OrderScoutTowerNextToFirstTowerArgs): { accepted: boolean } {
  const firstTower = rules.occupied[0];

  if (!firstTower) {
    return { accepted: false };
  }

  for (let attempt = 0; attempt < AttemptsNextToFirstTower; attempt++) {
    const position = randomPointOnSquareAround({
      center: firstTower,
      halfSize: MinTowerCenterOffset,
      random,
    });

    if (
      tryOrderScoutTower({
        worker,
        position,
        rules,
        buildTowersState,
        directives,
        probes,
      }).accepted
    ) {
      return { accepted: true };
    }
  }

  return { accepted: false };
}

interface OrderScoutTowerNearMineArgs {
  worker: UnitId;
  rules: PlacementRules;
  buildTowersState: BuildTowersState;
  directives: Directives;
  probes: WarcraftProbes;
  random: Random;
}

// Returns the distance from the mine at which the tower was ordered, if it
// was.
function orderScoutTowerNearMine({
  worker,
  rules,
  buildTowersState,
  directives,
  probes,
  random,
}: OrderScoutTowerNearMineArgs): { distanceFromMine: number | undefined } {
  let distance = MinDistanceFromMine;
  let rejections = 0;

  while (distance <= TowerReach) {
    const position = randomPointAround({
      center: rules.mine,
      distance,
      random,
    });

    if (
      tryOrderScoutTower({
        worker,
        position,
        rules,
        buildTowersState,
        directives,
        probes,
      }).accepted
    ) {
      return { distanceFromMine: distance };
    }

    rejections++;

    if (rejections % RejectionsPerDistanceIncrease === 0) {
      distance += DistanceIncrease;
    }
  }

  return { distanceFromMine: undefined };
}

interface TryOrderScoutTowerArgs {
  worker: UnitId;
  position: Point;
  rules: PlacementRules;
  buildTowersState: BuildTowersState;
  directives: Directives;
  probes: WarcraftProbes;
}

// IssueBuildOrderById returns false for blocked or unbuildable spots (but
// true when only resources are missing), so the order itself is used as the
// placement test.
function tryOrderScoutTower({
  worker,
  position,
  rules,
  buildTowersState,
  directives,
  probes,
}: TryOrderScoutTowerArgs): { accepted: boolean } {
  const distanceToEnemyMain = new Vector({
    start: rules.enemyMain,
    end: position,
  }).length;
  const distanceToMine = new Vector({ start: rules.mine, end: position })
    .length;
  const passesRules =
    distanceToEnemyMain >= MinDistanceFromEnemyMain &&
    (!rules.requireEnemyMainInReach || distanceToEnemyMain <= TowerReach) &&
    distanceToMine <= TowerReach &&
    !overlapsTower({ position, towers: rules.occupied });
  const accepted =
    passesRules &&
    probes.tryBuild({
      unit: worker,
      building: W3HumanApi.Building.SCOUT_TOWER,
      point: position,
    });

  if (accepted) {
    buildTowersState.pendingTowerSites.push({ builder: worker, position });
    directives.give({
      unit: worker,
      task: {
        kind: 'Build',
        building: W3HumanApi.Building.SCOUT_TOWER,
        point: position,
      },
      reason: 'Tower rush: forward Peasant builds a Scout Tower',
    });
  }

  return { accepted };
}

interface RandomPointAroundArgs {
  center: Point;
  distance: number;
  random: Random;
}

function randomPointAround({
  center,
  distance,
  random,
}: RandomPointAroundArgs): Point {
  const angle = random.real({ min: 0, max: Math.PI * 2 });

  return center.translate({
    vector: new Vector({ x: distance, y: 0 }).rotate({ angle }),
  });
}

interface RandomPointOnSquareAroundArgs {
  center: Point;
  halfSize: number;
  random: Random;
}

// A point on the square of the given half-size, so that a tower placed there
// sits flush against the one at the center from any direction.
function randomPointOnSquareAround({
  center,
  halfSize,
  random,
}: RandomPointOnSquareAroundArgs): Point {
  const angle = random.real({ min: 0, max: Math.PI * 2 });
  const direction = new Vector({ x: 1, y: 0 }).rotate({ angle });
  const scale =
    halfSize / Math.max(Math.abs(direction.x), Math.abs(direction.y));

  return center.translate({ vector: direction.multiply({ scalar: scale }) });
}

interface OverlapsTowerArgs {
  position: Point;
  towers: Point[];
}

function overlapsTower({ position, towers }: OverlapsTowerArgs): boolean {
  return towers.some((tower) => {
    const offset = new Vector({ start: tower, end: position });

    return (
      Math.abs(offset.x) < MinTowerCenterOffset &&
      Math.abs(offset.y) < MinTowerCenterOffset
    );
  });
}
