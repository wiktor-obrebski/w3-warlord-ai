import * as W3PlayerApi from '@lib/warcraft3-api/player';
import * as W3TriggerApi from '@lib/warcraft3-api/trigger';
import * as W3UnitApi from '@lib/warcraft3-api/unit';
import * as WarlordApi from '@lib/warcraft3-api/warlord';
import { GameClock, readGameClock } from './game-clock';

export {
  type AttackObserver,
  type AttackEvent,
  observeAttacksOn,
  takeObservedAttacks,
};

interface AttackObserver {
  pending: AttackEvent[];
}

interface AttackEvent {
  readonly attacker: W3UnitApi.unit;
  // Whether the bot's player saw the attacker as the attack started.
  readonly attackerVisible: boolean;
  readonly attackedUnit: W3UnitApi.unit;
  // Game seconds at which the attack started.
  readonly time: number;
}

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
    WarlordApi.guard(() => recordAttack({ observer, bot, clock }))
  );

  return observer;
}

interface TakeObservedAttacksArgs {
  observer: AttackObserver;
}

/** The attacks started since they were last taken, oldest first. */
function takeObservedAttacks({
  observer,
}: TakeObservedAttacksArgs): readonly AttackEvent[] {
  if (observer.pending.length === 0) {
    return NoAttacks;
  }

  const attacks = observer.pending;
  observer.pending = [];

  return attacks;
}

const NoAttacks: readonly AttackEvent[] = [];

interface RecordAttackArgs {
  observer: AttackObserver;
  bot: W3PlayerApi.player;
  clock: GameClock;
}

function recordAttack({ observer, bot, clock }: RecordAttackArgs) {
  const attacker = W3TriggerApi.GetAttacker();
  const attackedUnit = W3TriggerApi.GetTriggerUnit();

  if (!attacker || !attackedUnit) {
    throw new Error(
      'Attack observer: attack event without attacker or attacked unit.'
    );
  }

  observer.pending.push({
    attacker,
    attackerVisible: W3UnitApi.IsUnitVisible(attacker, bot),
    attackedUnit,
    time: readGameClock({ clock }),
  });
}
