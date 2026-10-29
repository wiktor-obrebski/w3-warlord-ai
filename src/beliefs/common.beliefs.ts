import { CommonBeliefsModel } from '@lib/bdi';
import type { Point } from '@lib/math';
import type { Observations, ObservedWorld } from '../contracts/observations';
import type { Strategy } from '../contracts/strategy';
import type {
  GoldMine,
  ObservedAttack,
  StartLocation,
} from '../contracts/world';

export { type CommonObservation, type CommonBeliefs, createCommonBeliefsModel };

interface CommonObservation {
  readonly world: ObservedWorld;
  readonly attacksStarted: readonly ObservedAttack[];
  readonly currentStrategy: Strategy | null;
}

/**
 * Game knowledge broadly useful to the bot: the currently observed world,
 * where the enemy started, the attacks on the bot's units it still
 * remembers, and the strategy it has committed to.
 */
interface CommonBeliefs extends ObservedWorld {
  // Known only when the map has a single start location besides the bot's
  // own: then the enemy can only have started there.
  readonly enemyStartPosition?: Point;
  readonly enemyMainGoldMine?: GoldMine;
  // The latest attack of each visible attacker, and every attack by an
  // unseen one, while still recent; oldest first.
  readonly recentAttacks: readonly ObservedAttack[];
  // The strategy Deliberation committed to on the previous step, if any; not
  // the strategy the bot would currently prefer.
  readonly currentStrategy: Strategy | null;
}

interface CreateCommonBeliefsModelArgs {
  // The observations of the step being run.
  readObservations: () => Observations;
  // The bot's own strategy commitment, observed like the world.
  readCurrentStrategy: () => Strategy | null;
}

/**
 * Maintains the Common Beliefs every component reads, revised by the mind at
 * the start of every step from what Perception reported.
 */
function createCommonBeliefsModel({
  readObservations,
  readCurrentStrategy,
}: CreateCommonBeliefsModelArgs): CommonBeliefsModel<
  CommonBeliefs,
  CommonObservation
> {
  return {
    observe() {
      const { world, attacksStarted } = readObservations();

      return { world, attacksStarted, currentStrategy: readCurrentStrategy() };
    },

    revise({ previous, observation }) {
      const enemyStart = inferEnemyStart({
        otherStartLocations: observation.world.otherStartLocations,
      });

      return {
        ...observation.world,
        enemyStartPosition: enemyStart?.position,
        enemyMainGoldMine: enemyStart?.goldMine,
        currentStrategy: observation.currentStrategy,
        recentAttacks: reviseRecentAttacks({
          previous: previous?.recentAttacks ?? [],
          started: observation.attacksStarted,
          now: observation.world.time,
        }),
      };
    },
  };
}

interface InferEnemyStartArgs {
  otherStartLocations: readonly StartLocation[];
}

function inferEnemyStart({
  otherStartLocations,
}: InferEnemyStartArgs): StartLocation | undefined {
  return otherStartLocations.length === 1 ? otherStartLocations[0] : undefined;
}

// Warcraft offers no way to read whom a unit is attacking, so attacks are
// observed as they start and remembered for a short while afterwards. The
// window is kept short so units stop counting as attacked soon after the
// attacks end; slow attackers, such as siege units, start an attack only
// every few seconds and so are remembered only part of the time.
const AttackMemorySeconds = 1;

interface ReviseRecentAttacksArgs {
  previous: readonly ObservedAttack[];
  started: readonly ObservedAttack[];
  now: number;
}

// Unchanged memory is returned as it is, so it is not copied every tick.
// Unseen attackers cannot be told apart, so their attacks are all kept.
function reviseRecentAttacks({
  previous,
  started,
  now,
}: ReviseRecentAttacksArgs): readonly ObservedAttack[] {
  const isRecent = ({ attack }: { attack: ObservedAttack }) =>
    now - attack.time <= AttackMemorySeconds;

  if (
    started.length === 0 &&
    previous.every((attack) => isRecent({ attack }))
  ) {
    return previous;
  }

  let attacks = previous.filter((attack) => isRecent({ attack }));

  for (const attack of started) {
    if (attack.attacker !== null) {
      attacks = attacks.filter((known) => known.attacker !== attack.attacker);
    }

    attacks.push(attack);
  }

  return attacks;
}
