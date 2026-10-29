import * as W3TimerApi from '@lib/warcraft3-api/timer';

export { type GameClock, startGameClock, readGameClock };

type GameClock = W3TimerApi.timer;

function startGameClock(): GameClock {
  const clock = W3TimerApi.CreateTimer();
  W3TimerApi.TimerStart(clock, ClockSeconds, false, () => undefined);

  return clock;
}

/** Game seconds since the clock was started. */
function readGameClock({ clock }: { clock: GameClock }): number {
  return W3TimerApi.TimerGetElapsed(clock);
}

// Long enough never to expire during a game.
const ClockSeconds = 10_000_000;
