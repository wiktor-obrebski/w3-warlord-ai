# Unit Behaviors

What every own unit does on every step. A unit's owner, so far the run of an Intention holding it under actor control, gives it a Directive (`contracts/directives.ts`): a task from a closed vocabulary, such as Move, Harvest, Build, or Produce, and the reason for it. The unit's behavior turns the Directive into orders, and the progress `give` returns tells the run how it is going. `tasks.ts` says, for each task, how a unit shows it carries the task out and which order starts it.

A lasting task, such as Harvest, is ordered once, unless the unit already carries it out, and ends once the unit stops; a single-order task, such as Produce, is done once ordered. A unit takes at most one order per step, so a Produce with a rally points the rally in a step of its own. A unit a probe ordered in the step is left alone until the next.

Reflexes keep the units alive, whatever their Directive: so far, worker safety (`worker-safety.ts`), which makes attacked workers flee. At the start of every step, before the Intentions run, the reflexes claim the units they protect with preemptive actor control, which takes them from whatever held them, so no run directs or probes them; once a unit is safe, they stop requesting it and it is free again. A Directive left unfinished when the reflex took its unit over starts anew once the reflex lets go.

Unit Behaviors read only the Beliefs and act only through the capabilities the mind gives them.
