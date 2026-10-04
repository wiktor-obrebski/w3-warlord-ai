import * as W3TimerApi from "@lib/warcraft3-api/timer";

// Long enough never to expire during a game.
const CLOCK_SECONDS = 10_000_000;

export type GameClock = W3TimerApi.timer;

export function startGameClock(): GameClock {
  const clock = W3TimerApi.CreateTimer();
  W3TimerApi.TimerStart(clock, CLOCK_SECONDS, false, () => undefined);

  return clock;
}

/** Game seconds since the clock was started. */
export function readGameClock(clock: GameClock): number {
  return W3TimerApi.TimerGetElapsed(clock);
}
