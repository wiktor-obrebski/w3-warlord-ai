# Reusable Controllers

Controllers assembled by more than one Intention.

A Controller starts private, inside the module of the Intention that uses it (`components/intentions/<intention>/`). It moves here only once a second Intention really needs it; anticipated reuse is not a reason to move it.

Each reusable Controller is its own module, `controllers/<controller>/`, with its `*.ctrl.ts` and any scoped `*.beliefs.ts` and `*.assessments.ts` it needs. It depends on no Intention: whatever it needs from its owner, such as the units to protect, it receives through its assemble function.

Intentions do not import reusable Controllers. An Intention declares in its Capabilities that it needs such a Controller, and Deliberation supplies it. The implementation is shared, but every instance has a single owner, with its own execution state and Scoped Beliefs.
