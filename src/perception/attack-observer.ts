import * as W3PlayerApi from "@lib/warcraft3-api/player";
import * as W3TriggerApi from "@lib/warcraft3-api/trigger";
import * as W3UnitApi from "@lib/warcraft3-api/unit";
import { GameClock, readGameClock } from "./game-clock";

declare function guard(this: void, callback: (this: void) => void): (this: void) => void;

// Warcraft offers no way to read whom a unit is attacking, so attacks are
// observed as they start. An attack is reported for a while afterwards
// because slow attackers, such as siege units, start one only every few
// seconds.
const ATTACK_REPORT_SECONDS = 5;

interface ObservedAttack {
  attacker: W3UnitApi.unit;
  target: W3UnitApi.unit;
  time: number;
}

export interface AttackObserver {
  clock: GameClock;
  attacks: ObservedAttack[];
}

/**
 * Records attacks started on the bot's own units. A player sees these on
 * their own units, so reporting them is fair; whether the attacker itself
 * may be reasoned about is decided by visibility during perception.
 */
export function observeAttacksOn(
  bot: W3PlayerApi.player,
  clock: GameClock,
): AttackObserver {
  const observer: AttackObserver = { clock, attacks: [] };
  const trigger = W3TriggerApi.CreateTrigger();

  W3TriggerApi.TriggerRegisterPlayerUnitEvent(
    trigger,
    bot,
    W3TriggerApi.EVENT_PLAYER_UNIT_ATTACKED,
  );
  W3TriggerApi.TriggerAddAction(
    trigger,
    guard(() => recordAttack(observer)),
  );

  return observer;
}

/** The bot's unit the attacker recently started an attack on, if any. */
export function recentAttackTarget(
  observer: AttackObserver,
  attacker: W3UnitApi.unit,
): W3UnitApi.unit | undefined {
  return observer.attacks.find(
    (attack) => attack.attacker === attacker && isRecent(attack, observer),
  )?.target;
}

function recordAttack(observer: AttackObserver) {
  const attacker = W3TriggerApi.GetAttacker();
  const target = W3TriggerApi.GetTriggerUnit();

  if (!attacker || !target) {
    throw new Error("Attack observer: attack event without attacker or target.");
  }

  observer.attacks = observer.attacks.filter(
    (attack) => attack.attacker !== attacker && isRecent(attack, observer),
  );
  observer.attacks.push({ attacker, target, time: now(observer) });
}

function isRecent(attack: ObservedAttack, observer: AttackObserver): boolean {
  return now(observer) - attack.time <= ATTACK_REPORT_SECONDS;
}

function now(observer: AttackObserver): number {
  return readGameClock(observer.clock);
}
