import type { Intention } from './intention';

export { type UnitNeed, type Force, type NeedGrant, type Grant, allocate };

/** Units a plan run asks for: every unit matching it. */
interface UnitNeed<TUnit> {
  // Names the need in the decision record.
  readonly name: string;
  matches({ unit }: { unit: TUnit }): boolean;
}

/** What an Intention may direct: the units Allocation granted it. */
interface Force<TUnit> {
  readonly units: ReadonlySet<TUnit>;
}

/** The units granted for one need. */
interface NeedGrant<TUnit> {
  readonly need: string;
  readonly units: readonly TUnit[];
}

/** What Allocation granted one Intention on the agenda. */
interface Grant<TOutcome, TBeliefs, TUnit> {
  readonly intention: Intention<TOutcome, TBeliefs, TOutcome, TUnit>;
  readonly force: Force<TUnit>;
  // In the order the Intention's run declared its needs.
  readonly needs: readonly NeedGrant<TUnit>[];
}

interface AllocateArgs<TOutcome, TBeliefs, TUnit> {
  agenda: readonly Intention<TOutcome, TBeliefs, TOutcome, TUnit>[];
  // Every unit of the agent, in the order needs are served from.
  units: readonly TUnit[];
  beliefs: TBeliefs;
  now: number;
}

/**
 * The only owner of units. Each unit goes to the first Intention on the
 * agenda with a need it matches, for the first such need; a unit no need
 * matches stays free. Needs are asked anew every round, so an Intention that
 * no longer needs a unit loses it without releasing anything.
 */
function allocate<TOutcome, TBeliefs, TUnit>({
  agenda,
  units,
  beliefs,
  now,
}: AllocateArgs<TOutcome, TBeliefs, TUnit>): Grant<
  TOutcome,
  TBeliefs,
  TUnit
>[] {
  const granted = new Set<TUnit>();

  return agenda.map((intention) => {
    const forceUnits = new Set<TUnit>();
    const needs: NeedGrant<TUnit>[] = [];

    for (const need of intention.needs({ beliefs, now })) {
      const needUnits: TUnit[] = [];

      for (const unit of units) {
        if (!granted.has(unit) && need.matches({ unit })) {
          granted.add(unit);
          forceUnits.add(unit);
          needUnits.push(unit);
        }
      }

      needs.push({ need: need.name, units: needUnits });
    }

    return { intention, force: { units: forceUnits }, needs };
  });
}
