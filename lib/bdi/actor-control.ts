/**
 * Grants the Plan or Controller being updated the temporary exclusive right
 * to order Actors. Scoped to that source, so requests need not identify it.
 *
 * Control is a lease: a source's claims last only while it keeps requesting
 * the Actors in each of its updates. A claim not requested again during an
 * update expires when that update ends.
 *
 * `TRequest` describes how a source asks for an Actor, such as how urgently;
 * its meaning is defined by the agent's `ActorControlPolicy`.
 */
export interface ActorControlProvider<TActor, TRequest> {
  /**
   * Claims or renews control of the Actor. Returns whether the source now
   * controls it and so may order it.
   */
  request(actor: TActor, request?: TRequest): boolean;
}

/**
 * The claim currently held on an Actor by another source.
 */
export interface ActorControlClaim<TRequest> {
  /** The request that granted or last renewed the claim. */
  readonly request: TRequest | undefined;
}

/**
 * Decides whether a request may take control of an Actor that the requesting
 * source does not already control: either uncontrolled (`current` is
 * undefined) or controlled by another source. Renewing one's own claim is
 * always granted and never reaches the policy.
 */
export type ActorControlPolicy<TRequest> = (
  request: TRequest | undefined,
  current: ActorControlClaim<TRequest> | undefined,
) => boolean;
