import type { ActorControlPolicy, ActorControlProvider } from './actor-control';

export { createActorControlArbiter, type ActorControlArbiter };

// A source is the Plan or Controller instance being updated.
interface Claim<TRequest> {
  holder: object;
  // The request that granted the claim or last renewed it.
  request: TRequest;
  // The number of the holder's update that last granted or renewed the claim.
  renewedInUpdate: number;
}

/**
 * Keeps at most one controlling source per Actor and runs the control
 * leases. Whether a request takes an Actor held by another source, or by
 * none, is left to the policy the arbiter was created with.
 */
interface ActorControlArbiter<TActor, TRequest> {
  /**
   * Runs one update of the source with control scoped to it. The source's
   * claims not renewed during the update expire when it ends.
   */
  update({
    source,
    run,
  }: {
    source: object;
    run: ({
      control,
    }: {
      control: ActorControlProvider<TActor, TRequest>;
    }) => void;
  }): void;

  /**
   * Releases the claims of sources no longer active, which will not update
   * again to let them expire.
   */
  releaseInactive({
    activeSources,
  }: {
    activeSources: ReadonlySet<object>;
  }): void;
}

function createActorControlArbiter<TActor, TRequest>({
  policy,
}: {
  policy: ActorControlPolicy<TRequest>;
}): ActorControlArbiter<TActor, TRequest> {
  const claims = new Map<TActor, Claim<TRequest>>();
  let updateCount = 0;

  const requestControl = ({
    requester,
    updateNumber,
    actor,
    request,
  }: {
    requester: object;
    updateNumber: number;
    actor: TActor;
    request: TRequest;
  }): boolean => {
    const currentClaim = claims.get(actor) ?? null;

    if (currentClaim !== null && currentClaim.holder === requester) {
      currentClaim.request = request;
      currentClaim.renewedInUpdate = updateNumber;
      return true;
    }

    if (!policy({ request, currentClaim })) {
      return false;
    }

    claims.set(actor, {
      holder: requester,
      request,
      renewedInUpdate: updateNumber,
    });

    return true;
  };

  const releaseClaims = ({
    shouldRelease,
  }: {
    shouldRelease: ({ claim }: { claim: Claim<TRequest> }) => boolean;
  }) => {
    const released: TActor[] = [];

    for (const [actor, claim] of claims) {
      if (shouldRelease({ claim })) {
        released.push(actor);
      }
    }

    for (const actor of released) {
      claims.delete(actor);
    }
  };

  return {
    update({ source, run }) {
      updateCount += 1;
      const updateNumber = updateCount;

      run({
        control: {
          request({ actor, request }) {
            return requestControl({
              requester: source,
              updateNumber,
              actor,
              request,
            });
          },
        },
      });

      releaseClaims({
        shouldRelease: ({ claim }) =>
          claim.holder === source && claim.renewedInUpdate !== updateNumber,
      });
    },

    releaseInactive({ activeSources }) {
      releaseClaims({
        shouldRelease: ({ claim }) => !activeSources.has(claim.holder),
      });
    },
  };
}
