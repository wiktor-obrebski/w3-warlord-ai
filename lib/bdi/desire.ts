/**
 * A high-level state or principle the agent wants to achieve or maintain.
 *
 * A Desire carries no execution behavior; Deliberation decides which
 * Intentions, if any, pursue it.
 */
export interface Desire {
  /**
   * Stable identifier, unique among the agent's Desires.
   */
  readonly id: string;

  /**
   * Human-readable explanation, for diagnostics.
   */
  readonly description: string;
}
