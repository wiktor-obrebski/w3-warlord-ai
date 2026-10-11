import type {
  ActorControlPolicy,
  ActorControlProvider,
} from "./actor-control";
import type { ExecutionComponent } from "./execution-component";

interface Claim<TRequest> {
  holder: ExecutionComponent;
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
export interface ActorControlArbiter<TActor, TRequest> {
  /**
   * Runs one update of the source with control scoped to it. The source's
   * claims not renewed during the update expire when it ends.
   */
  update(
    source: ExecutionComponent,
    run: (control: ActorControlProvider<TActor, TRequest>) => void,
  ): void;

  /**
   * Releases the claims of sources no longer active, which will not update
   * again to let them expire.
   */
  releaseInactive(activeSources: readonly ExecutionComponent[]): void;
}

export function createActorControlArbiter<TActor, TRequest>(
  policy: ActorControlPolicy<TRequest>,
): ActorControlArbiter<TActor, TRequest> {
  const claims = new Map<TActor, Claim<TRequest>>();
  let updateCount = 0;

  const requestControl = (
    requester: ExecutionComponent,
    updateNumber: number,
    actor: TActor,
    request: TRequest,
  ): boolean => {
    const currentClaim = claims.get(actor) ?? null;

    if (currentClaim !== null && currentClaim.holder === requester) {
      currentClaim.request = request;
      currentClaim.renewedInUpdate = updateNumber;
      return true;
    }

    if (!policy(request, currentClaim)) {
      return false;
    }

    claims.set(actor, {
      holder: requester,
      request,
      renewedInUpdate: updateNumber,
    });

    return true;
  };

  const releaseClaims = (
    shouldRelease: (claim: Claim<TRequest>) => boolean,
  ) => {
    const released: TActor[] = [];

    for (const [actor, claim] of claims) {
      if (shouldRelease(claim)) {
        released.push(actor);
      }
    }

    for (const actor of released) {
      claims.delete(actor);
    }
  };

  return {
    update(source, run) {
      updateCount += 1;
      const updateNumber = updateCount;

      run({
        request(actor, request) {
          return requestControl(source, updateNumber, actor, request);
        },
      });

      releaseClaims(
        (claim) =>
          claim.holder === source && claim.renewedInUpdate !== updateNumber,
      );
    },

    releaseInactive(activeSources) {
      releaseClaims((claim) => !activeSources.includes(claim.holder));
    },
  };
}
