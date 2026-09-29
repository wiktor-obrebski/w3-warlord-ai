declare module "@lib/warcraft3-api/timer" {
  export function CreateTimer(): timer;
  export function TimerStart(whichTimer: timer, timeout: number, periodic: boolean, handlerFunc: () => void): void;
}
