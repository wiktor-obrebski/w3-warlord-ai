import * as W3PlayerApi from "@lib/warcraft3-api/player";
import * as W3TriggerApi from "@lib/warcraft3-api/trigger";
import * as W3UnitApi from "@lib/warcraft3-api/unit";
import * as WarlordApi from "@lib/warcraft3-api/warlord";
import { GameClock, readGameClock } from "./game-clock";

export interface ObservedAttack {
  readonly attacker: W3UnitApi.unit;
  readonly target: W3UnitApi.unit;
  // Game seconds at which the attack started.
  readonly time: number;
}

export interface AttackObserver {
  pending: ObservedAttack[];
}

const NO_ATTACKS: readonly ObservedAttack[] = [];

/**
 * Queues attacks started on the bot's own units until they are taken. A
 * player sees these on their own units, so reporting them is fair; whether
 * the attacker itself may be reasoned about depends on its visibility.
 */
export function observeAttacksOn(
  bot: W3PlayerApi.player,
  clock: GameClock,
): AttackObserver {
  const observer: AttackObserver = { pending: [] };
  const trigger = W3TriggerApi.CreateTrigger();

  W3TriggerApi.TriggerRegisterPlayerUnitEvent(
    trigger,
    bot,
    W3TriggerApi.EVENT_PLAYER_UNIT_ATTACKED,
  );
  W3TriggerApi.TriggerAddAction(
    trigger,
    WarlordApi.guard(() => recordAttack(observer, clock)),
  );

  return observer;
}

/** The attacks started since they were last taken, oldest first. */
export function takeObservedAttacks(
  observer: AttackObserver,
): readonly ObservedAttack[] {
  if (observer.pending.length === 0) {
    return NO_ATTACKS;
  }

  const attacks = observer.pending;
  observer.pending = [];

  return attacks;
}

function recordAttack(observer: AttackObserver, clock: GameClock) {
  const attacker = W3TriggerApi.GetAttacker();
  const target = W3TriggerApi.GetTriggerUnit();

  if (!attacker || !target) {
    throw new Error("Attack observer: attack event without attacker or target.");
  }

  observer.pending.push({ attacker, target, time: readGameClock(clock) });
}
