# WC3 Warlord AI — Agent Instructions

## Project

WC3 Warlord AI is a Warcraft III melee AI designed from first principles to behave more like a competent RTS player than a traditional scripted bot.

The AI should reason under fair-information constraints, maintain an explicit world model, pursue multiple concurrent goals, react to changing conditions, and remain understandable, testable, and debuggable.

The project is primarily written in **Wurst** and compiled to a standalone Warcraft III **`.ai` script** using AI-compatible JASS. Generated JASS is a build artifact, not the primary source.

For project architecture:

* [`docs/ARCHITECTURE_SITEMAP.md`](docs/ARCHITECTURE_SITEMAP.md) — **default architectural reference**. Read this for a quick understanding of the system, concepts, responsibilities, and where things belong.
* [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — **detailed architecture reference**. Consult it when deeper architectural context is relevant, such as when making architectural decisions, introducing or changing concepts, deciding file/module ownership or structure, modifying boundaries between subsystems, or when the sitemap is insufficient to answer an architectural question confidently.

Do **not** read the full architecture document by default for routine implementation work. Start from the sitemap and existing local code, and consult the detailed document when the task warrants it.

Do not duplicate architectural documentation in this file.

## Technical Requirements

* At the start of every new session, pull `main` from `origin` before inspecting or modifying the repository.

## Engineering Principles

Prefer simple, explicit, maintainable solutions.

* Solve the actual problem, not hypothetical future problems.
* Prefer the smallest design that cleanly satisfies current requirements.
* Avoid premature abstractions, unnecessary configurability, generic frameworks, and speculative extensibility.
* Do not introduce indirection merely to make code appear architecturally sophisticated.
* Prefer boring, obvious code over clever code.
* Fix root causes instead of layering workarounds over symptoms.
* Preserve clear ownership of concepts and state.
* Prefer one authoritative implementation or source of truth over parallel mechanisms.
* Reuse existing mechanisms when they fit cleanly.
* Do not force reuse when doing so makes the design less clear.
* Existing code is evidence, not authority. Do not preserve a bad design solely because it already exists.

Complexity must justify itself.

## Scope Discipline

Keep changes focused and reviewable.

* Make the smallest coherent change that fully solves the task.
* Do not perform unrelated cleanup, renaming, formatting, dependency upgrades, or refactoring.
* Do not expand the scope because another improvement is nearby.
* Separate independent refactoring from behavioral changes where practical.
* Preserve existing behavior unless changing it is intentional.
* If a requested approach creates unnecessary complexity or conflicts with the architecture, say so and propose the simpler or more correct alternative.

## Architecture

Use `docs/ARCHITECTURE_SITEMAP.md` as the normal guide to the architecture.

Consult `docs/ARCHITECTURE.md` when deeper understanding is needed, especially when:

* making or evaluating an architectural decision,
* introducing a new architectural concept,
* changing responsibilities or boundaries between components,
* deciding where new files, modules, or major functionality belong,
* changing important data or control flow,
* modifying architectural invariants,
* the sitemap leaves material ambiguity.

Do not load the detailed architecture merely as a precaution. Use it when it can materially affect the correctness of the change.

Important architectural constraints include:

* Reasoning code must respect the **fair-information boundary**.
* Raw Warcraft enemy state must not leak into reasoning layers.
* Perception is responsible for turning observable Warcraft state into project-defined observations.
* Beliefs and the world model may contain retained and inferred information, including uncertainty and provenance where useful.
* Goals, intentions, plans, controllers, and command arbitration have distinct responsibilities.
* Concurrent RTS activities should be modeled explicitly rather than hidden inside large monolithic state machines.
* Interrupt, suspend, resume, and abandon behavior should be explicit where relevant.
* Maintainability, explainability, debug visibility, and testability are architectural requirements, not optional extras.

Before introducing a new architectural concept, verify that an existing concept cannot represent it clearly.

Do not create overlapping abstractions with subtly different meanings.

## Working With Existing Code

Inspect relevant code and documentation before designing a solution.

* Follow established local conventions unless there is a concrete reason to change them.
* Understand call sites and data flow before changing shared abstractions.
* Search for existing implementations before adding another one.
* Do not infer behavior from names alone when the implementation can be inspected.
* Prefer understanding the current failure mode before modifying code intended to fix it.

When uncertainty materially affects the implementation, state it rather than guessing.

## Wurst / Warcraft AI Runtime Constraints

- Edit source, configuration, and tests; never treat `_build/`, generated output, or downloaded dependencies as source-of-truth. Patch upstream dependencies at their source.
- Fix root causes with small, focused changes. Avoid duplicated branches, special-case workarounds, and unrelated refactors.
- Add narrow tests for changed behavior. Fix relevant compiler warnings unless a warning is intentionally suppressed and explained.
- Search declarations and existing usages instead of guessing APIs or signatures.


Wurst compiles to JASS executed by Warcraft III's standalone **`.ai` runtime**, which has stricter limitations than normal map scripts.

Known constraints:

* The AI runs against `common.j` and `common.ai`; do not depend on `Blizzard.j` or helpers such as `BJDebugMsg`.
* Do not use normal callback mechanisms such as triggers, `ExecuteFunc`, timer callbacks, `ForGroup` callbacks, `Condition`, or `Filter`.
* Consequently, avoid Wurst facilities built on those mechanisms, including callback-based events, timers, groups, and closures.
* `StartThread` and AI `Sleep` are supported and are the normal mechanism for concurrent AI execution.
* Do not use `I2S` or Wurst conversions that lower to it.
* Wurst classes require explicit lifetime management; destroy instances when they are no longer needed.
* Do not assume Wurst standard-library functionality is AI-safe. Check its implementation or generated JASS when compatibility is uncertain.
* Lambdas and higher-order helpers are acceptable only when they compile to AI-safe JASS without forbidden callback machinery.

High-level Wurst syntax is not forbidden by itself. The generated JASS and runtime behavior determine whether a feature is safe.

### Validation

The project does not yet use automated tests.

For now:
* make sure changed Wurst code compiles:
`docker compose run --rm wurst ./bin/typecheck.sh`
* inspect generated JASS for AI-constrains compatibility when directly asked


Do not introduce a testing framework or new test infrastructure unless explicitly requested.

Never claim that something was compiled, checked, or verified unless it actually was.

### Building
After all work is done and typechecked, build the project with
`docker compose run --rm wurst ./bin/build.sh`

Do it only after some real changes has been introduced to the project.

## Documentation

Documentation should explain information that is valuable and non-obvious.

Document:

* architecture,
* important invariants,
* design decisions,
* unusual runtime constraints,
* non-obvious reasoning,
* behavior that future maintainers could otherwise misinterpret.

Do not document:

* trivial implementation details,
* obvious code,
* temporary reasoning that has no lasting value.

When a change makes existing architecture documentation inaccurate, update the relevant documentation in the same change.

Prefer linking to the authoritative document instead of copying the same explanation into several places.

## Comments

Prefer **self-documenting code over comments**.

Use clear names, small functions, explicit data structures, and straightforward control flow so the code explains itself without additional prose.

Before adding a comment, first ask whether the code can be made easier to understand instead.

Prefer:

* renaming variables or functions,
* extracting a well-named function,
* simplifying control flow,
* making an invariant explicit in the code,
* replacing clever code with a more obvious implementation,

over explaining difficult code with comments.

Use comments only when the relevant behavior remains genuinely non-obvious after reasonable simplification, for example:

* surprising Warcraft or AI-runtime behavior,
* an important invariant that cannot be expressed clearly in code,
* a deliberate workaround for an external limitation,
* a non-obvious tradeoff where the apparently simpler implementation would be incorrect.

Comments should explain **why the unusual code has to exist**, not restate what the code does.

Do not add comments as narration, section decoration, or summaries of straightforward code.

Remove comments that become redundant, misleading, or obsolete after the code changes.

## Git and Commits

Commits should form a useful engineering history.

* Each commit should represent one coherent change.
* Avoid mixing unrelated behavioral changes and refactoring.
* Keep commits reasonably small, but do not split one logical change into artificial fragments.
* Do not discard existing user changes.

Commit messages use this simple format:

```text
<description>.

[optional body]
```

The description should state clearly what the commit does and end with a period.

Examples:

```text
Add confidence tracking to retained beliefs.
```

```text
Move perception updates behind the observation boundary.
```

Do not use Conventional Commit prefixes such as `feat:`, `fix:`, or `refactor:`.

Use a commit body only when the description alone does not provide enough important context. Bodies should be uncommon. When needed, use the body to explain non-obvious rationale, constraints, or consequences rather than repeating the description or narrating the diff.

Do not commit, amend, rebase, force-push, push, or otherwise modify repository history unless explicitly requested.

When correcting work in the latest commit, amend that commit instead of creating a new one. Create a new commit when the work is a new change or the existing commit is already part of a pull request.

## Dependencies

Avoid adding dependencies unless they provide clear value that justifies their cost.

Before adding one, consider:

* whether the functionality is small enough to implement locally,
* maintenance burden,
* runtime constraints,
* build complexity,
* dependency stability,
* whether the dependency meaningfully reduces project complexity.

Do not upgrade unrelated dependencies as part of another task.

## Error Handling

Failures should be visible and diagnosable.

* Do not silently swallow unexpected errors or invalid states.
* Prefer explicit failure over continuing with corrupted assumptions.
* Preserve enough context to diagnose failures.
* Do not add defensive checks everywhere without understanding what invariant is being violated.
* If an impossible state becomes possible, investigate the broken invariant rather than normalizing it.

## Debugging

Debugging support is a first-class concern.

When investigating a problem:

1. Establish the observed behavior.
2. Trace the relevant state and decision path.
3. Identify the earliest incorrect assumption or transition.
4. Fix the underlying cause.
5. Add appropriate regression protection.

Prefer targeted instrumentation over large amounts of noisy logging.

Debug output should make it possible to understand **why** the AI made a decision, not merely which functions executed.

Remove temporary instrumentation when it no longer provides ongoing value.

## Performance

Do not optimize without evidence that optimization is needed.

However, Warcraft AI executes continuously during gameplay, so avoid obviously wasteful algorithms in frequently executed paths.

Prefer:

* clear algorithms,
* bounded work,
* sensible update frequencies,
* explicit caching where it has demonstrated value.

Do not trade substantial clarity for insignificant runtime savings.

## Agent Behaviour

When working in this repository:

* Inspect before modifying.
* Prefer evidence over assumptions.
* State uncertainty when it matters.
* Challenge incorrect premises.
* Avoid unnecessary complexity.
* Do not invent requirements.
* Do not expand scope without a concrete reason.
* Do not hide architectural problems behind patches.
* Preserve user changes.
* Leave the repository in a coherent state.

When several solutions are valid, prefer the one with the smallest conceptual and maintenance cost.
