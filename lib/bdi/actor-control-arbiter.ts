import type {
  ActorControlPolicy,
  ActorControlProvider,
} from "./actor-control";
import type { ExecutionComponent } from "./execution-component";

interface Claim<TRequest> {
  source: ExecutionComponent;
  request: TRequest | undefined;
  // The source update that last renewed the claim.
  renewedIn: number;
}

/**
 * Keeps at most one controlling source per Actor and runs the control
 * leases. Whether a request may take an Actor is left to the policy it was
 * created with.
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
  let lastUpdate = 0;

  const request = (
    source: ExecutionComponent,
    updateId: number,
    actor: TActor,
    requested: TRequest | undefined,
  ): boolean => {
    const claim = claims.get(actor);

    if (claim?.source === source) {
      claim.request = requested;
      claim.renewedIn = updateId;
      return true;
    }

    if (!policy(requested, claim)) {
      return false;
    }

    claims.set(actor, { source, request: requested, renewedIn: updateId });

    return true;
  };

  const release = (isReleased: (claim: Claim<TRequest>) => boolean) => {
    const released: TActor[] = [];

    for (const [actor, claim] of claims) {
      if (isReleased(claim)) {
        released.push(actor);
      }
    }

    for (const actor of released) {
      claims.delete(actor);
    }
  };

  return {
    update(source, run) {
      lastUpdate += 1;
      const updateId = lastUpdate;

      run({
        request(actor, requested) {
          return request(source, updateId, actor, requested);
        },
      });

      release(
        (claim) => claim.source === source && claim.renewedIn !== updateId,
      );
    },

    releaseInactive(activeSources) {
      release((claim) => !activeSources.includes(claim.source));
    },
  };
}
