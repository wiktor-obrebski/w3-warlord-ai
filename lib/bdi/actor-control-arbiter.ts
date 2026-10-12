import type { ActorControlPolicy, ActorControlProvider } from './actor-control';

export { createActorControlArbiter, type ActorControlArbiter };

interface ActorControlArbiterUpdateArgs {
  source: object;
  run: () => void;
}

interface ActorControlArbiterReleaseInactiveArgs {
  activeSources: ReadonlySet<object>;
}

/**
 * Keeps at most one controlling source per Actor and runs the control
 * leases. Whether a request takes an Actor held by another source, or by
 * none, is left to the policy the arbiter was created with.
 */
interface ActorControlArbiter<TActor, TRequest> {
  /**
   * The actor control given to every Plan and Controller. It acts for the
   * source whose update is running and throws outside of one.
   */
  readonly actorControl: ActorControlProvider<TActor, TRequest>;

  /**
   * Runs one update of the source, during which `actorControl` acts for it.
   * The source's claims not renewed during the update expire when it ends.
   */
  update({ source, run }: ActorControlArbiterUpdateArgs): void;

  /**
   * Releases the claims of sources no longer active, which will not update
   * again to let them expire.
   */
  releaseInactive({
    activeSources,
  }: ActorControlArbiterReleaseInactiveArgs): void;
}

interface CreateActorControlArbiterArgs<TRequest> {
  policy: ActorControlPolicy<TRequest>;
}

function createActorControlArbiter<TActor, TRequest>({
  policy,
}: CreateActorControlArbiterArgs<TRequest>): ActorControlArbiter<
  TActor,
  TRequest
> {
  const claims = new Map<TActor, Claim<TRequest>>();
  let updateCount = 0;
  let runningUpdate: SourceUpdate | null = null;

  const requestControl = ({
    requester,
    actor,
    request,
  }: RequestControlArgs<TActor, TRequest>): boolean => {
    const currentClaim = claims.get(actor) ?? null;

    if (currentClaim !== null && currentClaim.holder === requester.source) {
      currentClaim.request = request;
      currentClaim.renewedInUpdate = requester.updateNumber;
      return true;
    }

    if (!policy({ request, currentClaim })) {
      return false;
    }

    claims.set(actor, {
      holder: requester.source,
      request,
      renewedInUpdate: requester.updateNumber,
    });

    return true;
  };

  const releaseClaims = ({ shouldRelease }: ReleaseClaimsArgs<TRequest>) => {
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
    actorControl: {
      request({ actor, request }) {
        if (runningUpdate === null) {
          throw new Error(
            'Actor control arbiter: actor requested outside a source update.'
          );
        }

        return requestControl({ requester: runningUpdate, actor, request });
      },
    },

    update({ source, run }) {
      updateCount += 1;
      const sourceUpdate: SourceUpdate = { source, updateNumber: updateCount };

      // Not reset in a `finally`: TSTL rethrows from it, so the error report
      // would lose the original traceback. An error ends the cycle, and the
      // next update replaces the stale value.
      runningUpdate = sourceUpdate;
      run();
      runningUpdate = null;

      releaseClaims({
        shouldRelease: ({ claim }) =>
          claim.holder === source &&
          claim.renewedInUpdate !== sourceUpdate.updateNumber,
      });
    },

    releaseInactive({ activeSources }) {
      releaseClaims({
        shouldRelease: ({ claim }) => !activeSources.has(claim.holder),
      });
    },
  };
}

// A source is the Plan or Controller instance being updated.
interface Claim<TRequest> {
  holder: object;
  // The request that granted the claim or last renewed it.
  request: TRequest;
  // The number of the holder's update that last granted or renewed the claim.
  renewedInUpdate: number;
}

interface SourceUpdate {
  source: object;
  updateNumber: number;
}

interface RequestControlArgs<TActor, TRequest> {
  requester: SourceUpdate;
  actor: TActor;
  request: TRequest;
}

interface ReleaseClaimsArgs<TRequest> {
  shouldRelease: ({ claim }: { claim: Claim<TRequest> }) => boolean;
}
