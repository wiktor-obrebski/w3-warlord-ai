import type { Beliefs, EnemyBeliefs, SelfBeliefs } from '../contracts/beliefs';
import type { Observations } from '../contracts/observations';
import type { ObservedAttack, StartLocation } from '../contracts/world';

export { reviseBeliefs };

interface ReviseBeliefsArgs {
  // Undefined on the first step.
  previous: Beliefs | undefined;
  observations: Observations;
}

/** Revises the Beliefs, section by section, from a step's observations. */
function reviseBeliefs({ previous, observations }: ReviseBeliefsArgs): Beliefs {
  return {
    time: observations.world.time,
    self: reviseSelf({ previous: previous?.self, observations }),
    enemy: reviseEnemy({ observations }),
  };
}

interface ReviseSelfArgs {
  previous: SelfBeliefs | undefined;
  observations: Observations;
}

function reviseSelf({ previous, observations }: ReviseSelfArgs): SelfBeliefs {
  const { world, attacksStarted } = observations;
  const { lumberMills, buildingsUnderConstruction } = world.self;

  return {
    ...world.self,
    finishedLumberMills: lumberMills.filter(
      (mill) => !buildingsUnderConstruction.includes(mill)
    ),
    recentAttacks: reviseRecentAttacks({
      previous: previous?.recentAttacks ?? [],
      started: attacksStarted,
      now: world.time,
    }),
  };
}

interface ReviseEnemyArgs {
  observations: Observations;
}

function reviseEnemy({ observations }: ReviseEnemyArgs): EnemyBeliefs {
  const { world } = observations;
  const enemyStart = inferEnemyStart({
    otherStartLocations: world.otherStartLocations,
  });

  return {
    ...world.enemy,
    startPosition: enemyStart?.position,
    mainGoldMine: enemyStart?.goldMine,
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
