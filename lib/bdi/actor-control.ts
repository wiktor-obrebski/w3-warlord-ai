export interface ActorControlRequestOptions {
  /**
   * Takes control from a source holding it normally. A preemptive claim is
   * itself never taken over.
   */
  readonly preempt?: boolean;
}

/**
 * Grants the Plan or Controller being updated the temporary exclusive right
 * to order Actors. Scoped to that source, so requests need not identify it.
 *
 * Control is a lease: a source's claims last only while it keeps requesting
 * the Actors in each of its updates. A claim not requested again during an
 * update expires when that update ends.
 */
export interface ActorControlProvider<TActor> {
  /**
   * Claims or renews control of the Actor. Returns whether the source now
   * controls it and so may order it.
   */
  request(actor: TActor, options?: ActorControlRequestOptions): boolean;
}
