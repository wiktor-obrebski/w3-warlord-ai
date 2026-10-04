declare module "@lib/warcraft3-api/timer" {
  /**
   * @ai-generated A countdown that calls a function when it expires.
   *
   * @patch 1.00
   */
  export interface timer extends agent { __timer: never; }

  /**
   * Returns: timer
   *
   * @ai-generated Creates a new stopped timer.
   *
   * @patch 1.00
   */
  export function CreateTimer(): timer;

  /**
   * Returns: nothing
   *
   * Starts a previously created timer that calls a function when timeout reaches 0.
   *
   * It is affected by gamespeed at any point of it execution, if the gamespeed is changed at 50% of timeout duration, the rest of the timeout will be correctly affected by new gamespeed.
   *
   * @param whichTimer (timer) Handle to timer.
   * @param timeout (real) Delay in seconds.
   * @param periodic (boolean) True: repeat timer after expiration (loop).
   *   False: timer only runs once.
   * @param handlerFunc (code) Callback function to be executed when timer expires.
   *
   * @note See: `GetExpiredTimer` to retrieve the handle of the expired timer inside handlerFunc.
   * @note The table below shows how often a 0 millisecond timer is executed
   *   in comparison with `TriggerRegisterTimerEvent`
   *   (aka `TriggerRegisterTimerEventPeriodic`).
   *
   *   | Trigger or Timer \ Tick count  |   ROC 1.0 | Reforged 1.32.10 |
   *   |--------------------------------|----------:|-----------------:|
   *   | 1000ms Trigger periodic        |      1 Hz |             1 Hz |
   *   | 100ms Trigger periodic         |     10 Hz |            10 Hz |
   *   | 20ms Trigger periodic          |     50 Hz |            50 Hz |
   *   | 10ms Trigger periodic          |    100 Hz |           100 Hz |
   *   | 5ms Trigger periodic           |    200 Hz |           100 Hz |
   *   | 1ms Trigger periodic           |   1000 Hz |           100 Hz |
   *   | 0ms Trigger periodic           |  10077 Hz |           100 Hz |
   *   | 1ms Timer                      |   1000 Hz |          1000 Hz |
   *   | 0ms Timer                      |  10077 Hz |         10077 Hz |
   * @patch 1.00
   */
  export function TimerStart(whichTimer: timer, timeout: number, periodic: boolean, handlerFunc: () => void): void;

  /**
   * Returns: real
   *
   * @ai-generated Returns the time in seconds since the timer was started.
   *
   * @note If passed timer is paused or has expired,
   *   this function returns `(TimerGetTimeout - TimerGetRemaining)`.
   * @bug If passed timer was resumed by `ResumeTimer`,
   *   this function returns amount of time elapsed after last resuming.
   * @patch 1.00
   */
  export function TimerGetElapsed(whichTimer: timer): number;

  /**
   * Returns: nothing
   *
   * @ai-generated Destroys the timer and releases its handle.
   *
   * @bug Destroying does not pause timer, so if call of its callback is scheduled,
   *   then callback is called with `GetElapsedTimer` being `null`.
   * @patch 1.00
   */
  export function DestroyTimer(whichTimer: timer): void;
}
