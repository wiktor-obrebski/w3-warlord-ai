export { type BuildOrder, type WorkerTargets };

/**
 * How a strategy builds up its economy: the buildings to put up first, and
 * the gold and lumber workers to reach, stage by stage.
 */
interface BuildOrder {
  // Names the build order, and with it the RunEconomy Desire following it.
  readonly name: string;
  // The rawcodes of the buildings to put up first, in order.
  readonly opening: readonly number[];
  // Each stage is reached before the next; workers are trained until the
  // last one is reached.
  readonly workerTargets: readonly WorkerTargets[];
}

/** How many workers harvest each resource. */
interface WorkerTargets {
  readonly gold: number;
  readonly lumber: number;
}
