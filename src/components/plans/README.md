# Reusable Plans

Plans assembled by more than one Intention.

A Plan starts private, inside the module of the Intention that uses it (`components/intentions/<intention>/`). It moves here only once a second Intention really needs it; anticipated reuse is not a reason to move it.

Each reusable Plan is its own module, `plans/<plan>/`, with its `*.api.ts` entry point, its `*.plan.ts`, its own declaration of the Common Beliefs it needs (`*.common-beliefs.ts`), and any scoped `*.beliefs.ts` and `*.assessments.ts`. It depends on no Intention: whatever it needs from its owner, such as a target or a budget, it receives through its assemble function.

Intentions do not import reusable Plans. An Intention declares in its Capabilities that it needs such a Plan, and Deliberation supplies it. The implementation is shared, but every instance has a single owner, with its own execution state and Scoped Beliefs.
