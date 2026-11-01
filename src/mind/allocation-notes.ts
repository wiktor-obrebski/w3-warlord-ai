import type { WarlordGrant } from '../contracts/intentions';
import type { DecisionRecorder } from '../contracts/record';

export { noteGrantChanges };

interface NoteGrantChangesArgs {
  previousGrants: readonly WarlordGrant[];
  grants: readonly WarlordGrant[];
  recorder: DecisionRecorder;
}

/**
 * Notes every Intention whose units changed, with how many each of its needs
 * holds; the units themselves go to the note's fields.
 */
function noteGrantChanges({
  previousGrants,
  grants,
  recorder,
}: NoteGrantChangesArgs) {
  for (const grant of grants) {
    const previous = previousGrants.find(
      (candidate) => candidate.intention === grant.intention
    );
    const heldUnits = describeHeldUnits({ grant });

    if (
      heldUnits === (previous ? describeHeldUnits({ grant: previous }) : '')
    ) {
      continue;
    }

    const holdings = grant.needs
      .filter(({ units }) => units.length > 0)
      .map(({ need, units }) => `${units.length} ${need}`);

    recorder.note({
      message: `Allocation: ${grant.intention.desireId} holds ${holdings.length > 0 ? holdings.join(', ') : 'nothing'}.`,
      fields: { intention: grant.intention.desireId, units: heldUnits },
    });
  }
}

// Empty when the grant holds nothing.
function describeHeldUnits({ grant }: { grant: WarlordGrant }): string {
  return grant.needs
    .filter(({ units }) => units.length > 0)
    .map(({ need, units }) => `${need}: ${units.join(' ')}`)
    .join('; ');
}
