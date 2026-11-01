import type { Intention } from './intention';

export {
  type UnitNeed,
  type Money,
  type Needs,
  type Force,
  type NeedGrant,
  type Grant,
  allocate,
};

/** Units a plan run asks for: those matching it, up to a count. */
interface UnitNeed<TUnit> {
  // Names the need in the decision record.
  readonly name: string;
  matches({ unit }: { unit: TUnit }): boolean;
  // The most units it takes; every matching unit when absent.
  readonly max?: number;
}

/** An amount of each resource, such as gold or lumber. */
type Money<TResource extends string> = Readonly<Record<TResource, number>>;

/** What a plan run asks Allocation for now. */
interface Needs<TUnit, TResource extends string> {
  readonly units: readonly UnitNeed<TUnit>[];
  // What the run is about to spend; nothing when absent.
  readonly money?: Money<TResource>;
}

/** What an Intention may use: the units and money Allocation granted it. */
interface Force<TUnit, TResource extends string> {
  readonly units: ReadonlySet<TUnit>;
  readonly money: Money<TResource>;
}

/** The units granted for one need. */
interface NeedGrant<TUnit> {
  readonly need: string;
  readonly units: readonly TUnit[];
}

/** What Allocation granted one Intention on the agenda. */
interface Grant<TOutcome, TBeliefs, TUnit, TResource extends string> {
  readonly intention: Intention<TOutcome, TBeliefs, TOutcome, TUnit, TResource>;
  readonly force: Force<TUnit, TResource>;
  // In the order the Intention's run declared its unit needs.
  readonly needs: readonly NeedGrant<TUnit>[];
}

interface AllocateArgs<TOutcome, TBeliefs, TUnit, TResource extends string> {
  agenda: readonly Intention<TOutcome, TBeliefs, TOutcome, TUnit, TResource>[];
  // Every unit of the agent, in the order needs are served from.
  units: readonly TUnit[];
  // The money the agent has.
  stock: Money<TResource>;
  beliefs: TBeliefs;
  now: number;
}

/**
 * The only owner of units and money. It walks the agenda in order: each unit
 * goes to the first Intention with a need it matches, for the first such
 * need with room left, and each Intention's money need is reserved, as far
 * as it can be, from what the Intentions before it left of the stock. Needs
 * are asked anew every round, so an Intention that no longer needs a unit or
 * money loses it without releasing anything.
 */
function allocate<TOutcome, TBeliefs, TUnit, TResource extends string>({
  agenda,
  units,
  stock,
  beliefs,
  now,
}: AllocateArgs<TOutcome, TBeliefs, TUnit, TResource>): Grant<
  TOutcome,
  TBeliefs,
  TUnit,
  TResource
>[] {
  const granted = new Set<TUnit>();
  const available = { ...stock };

  return agenda.map((intention) => {
    const { units: unitNeeds, money: moneyNeed } = intention.needs({
      beliefs,
      now,
    });
    const forceUnits = new Set<TUnit>();
    const needs: NeedGrant<TUnit>[] = [];

    for (const need of unitNeeds) {
      const needUnits: TUnit[] = [];

      for (const unit of units) {
        if (need.max !== undefined && needUnits.length >= need.max) {
          break;
        }

        if (!granted.has(unit) && need.matches({ unit })) {
          granted.add(unit);
          forceUnits.add(unit);
          needUnits.push(unit);
        }
      }

      needs.push({ need: need.name, units: needUnits });
    }

    return {
      intention,
      force: { units: forceUnits, money: reserve({ moneyNeed, available }) },
      needs,
    };
  });
}

interface ReserveArgs<TResource extends string> {
  moneyNeed: Money<TResource> | undefined;
  // What is left of the stock; reduced by what is reserved.
  available: Record<TResource, number>;
}

function reserve<TResource extends string>({
  moneyNeed,
  available,
}: ReserveArgs<TResource>): Money<TResource> {
  const reserved = { ...available };

  for (const resource in reserved) {
    const amount = Math.min(moneyNeed?.[resource] ?? 0, available[resource]);

    reserved[resource] = amount;
    available[resource] -= amount;
  }

  return reserved;
}
