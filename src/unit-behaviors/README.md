# Unit Behaviors

What every own unit does on every step. A unit's owner, the run of the Intention that Allocation granted it to, gives it a Directive (`contracts/directives.ts`): a task from a closed vocabulary, such as Move, Harvest, Build, or Produce, and the reason for it. The mind hands the Unit Behaviors the Directives each run's step returns, and the unit's behavior turns its Directive into orders. Each step starts by bringing the status of every Directive in effect up to date; the runs read those statuses to see how the Directives they gave are going. `tasks.ts` says, for each task, how a unit shows it carries the task out and which order starts it.

A lasting task, such as Harvest, is ordered once, unless the unit already carries it out, and ends once the unit stops; a single-order task, such as Produce, is done once ordered. A unit takes at most one order per step, so a Produce with a rally points the rally in a step of its own. A unit a probe ordered in the step is left alone until the next.

Reflexes keep the units alive, whatever their Directive: so far, worker safety (`worker-safety.ts`), which makes attacked workers flee. At the start of every step, before the Intentions run, the reflexes claim the units they protect. A claimed unit stays its owner's, but the mind leaves it out of its owner's force, so no run directs or probes it; once the unit is safe, the reflex no longer claims it. A Directive left unfinished when the reflex took its unit over starts anew once the reflex lets go.

A Guard Tower without a Directive in progress picks its own targets (`tower-targeting.ts`). Once a second, the visible enemies are ranked by priority, then by lowest life, the same ranking for every tower, and each tower attacks the best one in its range, so overlapping towers focus their fire. A tower still upgrading is left alone.

Unit Behaviors read only the Beliefs and act only through the capabilities the mind gives them.
