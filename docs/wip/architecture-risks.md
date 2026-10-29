# Architecture Risks and Open Questions

Where **Chain of Command** is still unproven or undecided. It uses the terms of the [architecture](architecture.md), set in _**bold italics**_.

1. **Calibration.** The _**agenda**_ is only as good as the _**ranks**_ and _**weights**_ feeding it. No formula picks good values, but tuning can be made safe:
   - _**Ranks**_ keep fixed meanings, so the hardest comparisons, such as a lethal threat against creeping, never come down to numbers.
   - _**Weights**_ are values in gold, computed from game facts, so whether one is right can be argued and checked ([section 4.5](architecture.md#45-desires)). What stays hand-set is a handful of named knobs, such as how much a hero level is worth, how far ahead to look, and how much risk to accept: the _**playbook**_'s style knobs.
   - _**Proposals**_ come from few places, the _**concerns**_ and the _**playbooks**_, and _**interruption costs**_ are named losses valued in one place.
   - Each [scenario](../research/rts-scenario-analysis.md) becomes a test of the decision it should produce, such as a fresh expansion's raid beating an ongoing harassment, or a lone Footman not recalling the hero. Changing a value function or a knob reruns them all, so tuning cannot silently break earlier decisions.
   - When a game goes wrong, the _**decision record**_ shows which term was misjudged, so that estimate is fixed rather than the final number.
2. **The _combat estimate_.** Fight or flight at every level depends on it.
   - Start with a cheap strength estimate (AMAI's and PurpleWave's) plus named modifiers ([ideas](../research/rts-ideas.md#2-computing-the-combat-estimate)).
   - Calibrate it with in-game probes, and add simulation only where decisions go wrong.
3. **_Strategy recognition_.** Under fog, recognition is often ambiguous, and a wrong call becomes a wrong _**adaptation**_. _**Adaptations**_ scale with the recognition's confidence, scouting resolves close calls, and accuracy can be measured offline against recorded games ([ideas](../research/rts-ideas.md#6-measuring-inference-offline)).
4. **Cost in Lua.** A _**Unit Behavior**_ for every own unit every tick, plus inference, must run fast enough inside the game's thread. Measure early in the game; if ticks run long, schedule the work more carefully ([ideas](../research/rts-ideas.md#5-scheduling-work-within-the-budget)).
5. **Game data.** Extract it from the game's own files and version it by client build, so _**Knowledge**_ matches the patch being played.
6. **Map data.** Map knowledge comes from the build-map tooling, and its format still needs a contract. The map also changes during a game, and keeping the map in _**Beliefs**_ current must stay cheap enough in Lua.
7. **Order semantics.**
   - Scripts cannot queue orders, and re-issued attacks restart.
   - Ability and item orders need verifying in the game, skill by skill.
   - An order native's result is not always reliable: a build order reports failure even when the unit accepts it, so a refusal must be confirmed from what the unit does next.
8. **What _Perception_ can read.** Some _**Beliefs**_ the scenarios rely on may not be readable through natives, or not fairly; shop and Tavern stock above all. Each needs an in-game probe. A fact that cannot be read must be inferred, for example stock from a failed purchase.
9. **Automating end-to-end tests.** See the open questions in [testability](architecture-testability.md).
10. **Persistence across games.** Whether a map script can keep an opponent model between games is unknown. Without it, the opponent model lasts one game.
11. **The generic _Intention_ runtime must stay small.**
    - It earns its place only by removing duplication from _**Intention kinds**_.
    - Anything that cannot be explained in a paragraph belongs to a kind, not to the runtime.
12. **The enemy's whereabouts and intent.** Estimates of where unseen heroes and armies are may be poor. The bot reacts to what it sees and infers; it does not model the opponent's decisions, such as baiting, coming back to defend, or trading bases.
13. **Fine timing.** Last hits and stepping out of Blizzard need damage and spell prediction within a 0.1 s tick.
