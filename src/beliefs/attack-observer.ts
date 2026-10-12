import * as W3PlayerApi from '@lib/warcraft3-api/player';
import * as W3TriggerApi from '@lib/warcraft3-api/trigger';
import * as W3UnitApi from '@lib/warcraft3-api/unit';
import * as WarlordApi from '@lib/warcraft3-api/warlord';
import { GameClock, readGameClock } from './game-clock';

export {
  type ObservedAttack,
  type AttackObserver,
  observeAttacksOn,
  takeObservedAttacks,
};

interface ObservedAttack {
  readonly attacker: W3UnitApi.unit;
  readonly attackedUnit: W3UnitApi.unit;
  // Game seconds at which the attack started.
  readonly time: number;
}

interface AttackObserver {
  pending: ObservedAttack[];
}

const NoAttacks: readonly ObservedAttack[] = [];

interface ObserveAttacksOnArgs {
  bot: W3PlayerApi.player;
  clock: GameClock;
}

/**
 * Queues attacks started on the bot's own units until they are taken. A
 * player sees these on their own units, so reporting them is fair; whether
 * the attacker itself may be reasoned about depends on its visibility.
 */
function observeAttacksOn({
  bot,
  clock,
}: ObserveAttacksOnArgs): AttackObserver {
  const observer: AttackObserver = { pending: [] };
  const trigger = W3TriggerApi.CreateTrigger();

  W3TriggerApi.TriggerRegisterPlayerUnitEvent(
    trigger,
    bot,
    W3TriggerApi.EVENT_PLAYER_UNIT_ATTACKED
  );
  W3TriggerApi.TriggerAddAction(
    trigger,
    WarlordApi.guard(() => recordAttack({ observer, clock }))
  );

  return observer;
}

interface TakeObservedAttacksArgs {
  observer: AttackObserver;
}

/** The attacks started since they were last taken, oldest first. */
function takeObservedAttacks({
  observer,
}: TakeObservedAttacksArgs): readonly ObservedAttack[] {
  if (observer.pending.length === 0) {
    return NoAttacks;
  }

  const attacks = observer.pending;
  observer.pending = [];

  return attacks;
}

interface RecordAttackArgs {
  observer: AttackObserver;
  clock: GameClock;
}

function recordAttack({ observer, clock }: RecordAttackArgs) {
  const attacker = W3TriggerApi.GetAttacker();
  const attackedUnit = W3TriggerApi.GetTriggerUnit();

  if (!attacker || !attackedUnit) {
    throw new Error(
      'Attack observer: attack event without attacker or attacked unit.'
    );
  }

  observer.pending.push({
    attacker,
    attackedUnit,
    time: readGameClock({ clock }),
  });
}
