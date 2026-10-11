import type { ActorControlProvider } from "./actor-control";
import type { ExecutionComponent } from "./execution-component";

interface Claim {
  source: ExecutionComponent;
  preemptive: boolean;
  // The source update that last renewed the claim.
  renewedIn: number;
}

/**
 * Decides which source controls each Actor: at most one at a time.
 */
export interface ActorControlArbiter<TActor> {
  /**
   * Runs one update of the source with control scoped to it. The source's
   * claims not renewed during the update expire when it ends.
   */
  update(
    source: ExecutionComponent,
    run: (control: ActorControlProvider<TActor>) => void,
  ): void;

  /**
   * Releases the claims of sources no longer active, which will not update
   * again to let them expire.
   */
  releaseInactive(activeSources: readonly ExecutionComponent[]): void;
}

export function createActorControlArbiter<TActor>(): ActorControlArbiter<TActor> {
  const claims = new Map<TActor, Claim>();
  let lastUpdate = 0;

  const request = (
    source: ExecutionComponent,
    updateId: number,
    actor: TActor,
    preemptive: boolean,
  ): boolean => {
    const claim = claims.get(actor);

    if (claim?.source === source) {
      claim.preemptive = preemptive;
      claim.renewedIn = updateId;
      return true;
    }

    if (claim && (claim.preemptive || !preemptive)) {
      return false;
    }

    claims.set(actor, { source, preemptive, renewedIn: updateId });

    return true;
  };

  const release = (isReleased: (claim: Claim) => boolean) => {
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
        request(actor, options) {
          return request(source, updateId, actor, options?.preempt === true);
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
