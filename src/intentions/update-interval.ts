// Game clock readings on bot ticks can land just short of a whole interval;
// without the tolerance such an update would slip to the next tick.
const CLOCK_TOLERANCE_SECONDS = 0.01;

/**
 * Lets an intention progress less often than every bot tick.
 */
export class UpdateInterval {
  private readonly seconds: number;
  private nextUpdateAt: number | undefined;

  public constructor(seconds: number) {
    this.seconds = seconds;
  }

  /**
   * Whether an update is due now. A due update starts the next interval, so
   * call this once per tick and update when it returns true.
   */
  public claim(now: number): boolean {
    if (
      this.nextUpdateAt !== undefined &&
      now + CLOCK_TOLERANCE_SECONDS < this.nextUpdateAt
    ) {
      return false;
    }

    this.nextUpdateAt = now + this.seconds;

    return true;
  }
}
