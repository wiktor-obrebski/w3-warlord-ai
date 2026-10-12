export {
  type ActorControlProvider,
  type ActorControlClaim,
  type ActorControlPolicy,
};

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
interface ActorControlProvider<TActor, TRequest> {
  /**
   * Claims or renews control of the Actor. Returns whether the source now
   * controls it and so may order it.
   */
  request(actor: TActor, request: TRequest): boolean;
}

/**
 * The claim another source currently holds on an Actor.
 */
interface ActorControlClaim<TRequest> {
  /** The request that granted the claim or last renewed it. */
  readonly request: TRequest;
}

/**
 * Decides whether a request takes control of an Actor the requesting source
 * does not hold: one held by another source (`currentClaim`), or one held by
 * none (`currentClaim` is null). A source renewing its own claim is always
 * granted and never asks the policy.
 */
type ActorControlPolicy<TRequest> = (
  request: TRequest,
  currentClaim: ActorControlClaim<TRequest> | null
) => boolean;
