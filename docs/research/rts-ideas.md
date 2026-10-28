# Research: Ideas for the Proposed Architecture

Status: a companion to the architecture document, [`rts-behavior-architecture.md`](rts-behavior-architecture.md). It collects techniques the research found promising for parts of the proposed architecture. The architecture does not depend on any of them: each fills a place the architecture defines, and something simpler or better could fill it instead. None is proven in Warcraft III yet. The architecture document mentions each one where it would fit and links here. Terms of the architecture are set in _**bold italics**_.

Each idea says what it is, where it would fit, why it is promising, and what is still open.

## 1. Particles for unseen units

**What it is.** A way to estimate where enemy units are while nobody sees them, from EISBot. Each enemy unit seen leaves a particle where it was last seen. Over time:

- the particle drifts along likely routes, toward chokepoints;
- its weight decays, at a rate set per unit class;
- own vision removes it: a place seen empty holds no particles;
- a hero keeps an identified track, since there is only one of him.

Together, the particles give a probability of enemy presence for every place, and an estimate for every hero.

**Where it would fit.** An inference in _**Beliefs**_: where unseen enemy units probably are ([section 4.12](rts-behavior-architecture.md#412-the-enemy-model)). The _**threat assessment**_, the _**danger assessment**_, hero whereabouts, and scouting would read it. Without particles, the bot relies on _**contacts**_: the last known position of each unit and how long ago it was seen.

**Why it is promising.** In Weber, Mateas, and Jhala's tests ("A Particle Model for State Estimation in Real-Time Strategy Games", AIIDE 2011), particles placed enemy units with an accuracy of 0.739, against 0.669 for last-known positions, and EISBot won 78% of its games with them, against 67% without. Perfect information did no better (67%); the authors attribute this to scouting, whose units also distracted the opponent.

**Open questions.**

- What many particles cost in Lua, as slow inference running every second or two.
- Drifting needs the routes of the map as the bot believes it now, which the map in _**Beliefs**_ holds.
- The decay rates need tuning for Warcraft III's units.

## 2. Computing the combat estimate

**What it is.** A cheap way to compute the _**combat estimate**_: sum each side's strength over its units, then shift the result with named modifiers.

- **Strength.** A unit's value times its health fraction. AMAI's Warcraft III baselines value a unit at (food + level) / 2 and a hero at 2, plus 0.5 per level beyond 1, plus its abilities.
- **Named modifiers**, from PurpleWave: fighting near home, at a choke, caught by faster enemies, or already committed shifts the threshold for fighting. Each modifier has a name, so the _**decision record**_ shows why a fight was taken or refused.
- **Simulation only where needed.** A full combat simulation is added only for decisions the cheap estimate gets wrong.

**Where it would fit.** The _**combat estimate**_ is a _**Knowledge**_ function that every part uses ([section 4.3](rts-behavior-architecture.md#43-beliefs-and-knowledge)): _**Tactics**_ evaluating fights, the _**threat assessment**_, _**needs**_ measured in fighting strength, and _**plans**_ choosing camps.

**Why it is promising.** It is cheap enough for Lua and explained by its named terms. PurpleWave plays with it, and AMAI's baselines are already set for Warcraft III.

**Open questions.**

- How much sums miss of Warcraft III's specifics: spells, summons, armor and attack types, Defend.
- Calibrating it against fights in the game.
- The research skipped a study of combat models (SparCraft, Lanchester-law prediction, FAP); it matters once simulation is needed.

## 3. An opening language

**What it is.** A small text language for the _**opening book**_, after Steamhammer's: items to build or train, `N x` for repeats, `@ location` for placement, commands such as `go scout enemy start`, and barriers that wait until what came before is done.

```ts
// Illustrative opening, not a tuned build (sketch).
const fastBearsOpening = opening({
  steps: [
    '5 x wisp',
    'altar of elders',
    'wisp',
    'moon well',
    'go scout enemy start',
    'ancient of war',
    'train demon hunter',
    'go creep demon hunter with ancient of war',
    "hunter's hall",
    'barrier',
    'tree of ages',
  ],
});
```

**Where it would fit.** The _**playbook**_'s _**opening book**_, which the ExecuteOpening _**Intention**_ follows ([section 4.11](rts-behavior-architecture.md#411-strategy-playbooks-and-production)). Commands propose _**Desires**_, like the rest of the _**playbook**_.

**Why it is promising.** An opening becomes exact data that is quick to write, read, and change. Steamhammer writes its openings this way.

**Open questions.**

- Which commands Warcraft III openings need, such as creeping with the first hero.
- How a step waits for money and producers, which come from _**Allocation**_ like any other _**need**_.

## 4. A personality per game

**What it is.** Draw the _**playbook**_'s style knobs, such as aggression, risk tolerance, and persistence, once per game from the seeded random source. AMAI chooses a personality profile per game the same way.

**Where it would fit.** The _**playbook**_'s style knobs ([section 4.11](rts-behavior-architecture.md#411-strategy-playbooks-and-production)), which _**weights**_, _**latitude**_, and switching _**playbooks**_ read.

**Why it is promising.** The bot becomes harder to predict and exploit, and tests stay deterministic, because the random source is seeded.

**Open questions.** Which knobs vary, and how far, before variety costs more than it gains.

## 5. Scheduling work within the budget

**What it is.** PurpleWave's way of spreading work so that every frame stays within its budget:

- each kind of work has a weight and a guaranteed maximum number of skipped ticks, so nothing starves;
- long analyses resume across ticks;
- units are updated round-robin, those nearest a threat first;
- when ticks run long, cheaper algorithms take over.

**Where it would fit.** The paces of the tick ([section 4.13](rts-behavior-architecture.md#413-timing)), once measurements in the game show ticks running long. Until then, the architecture keeps no budgets.

**Why it is promising.** It keeps a bot with many units and analyses responsive. PurpleWave's withdrawal from a tournament over frame-time overruns shows what is at stake.

**Open questions.** How much Lua work a Warcraft III tick can afford, measured in the game, and which work has cheaper fallbacks.

## 6. Measuring inference offline

**What it is.** Measure how well the bot infers what it cannot see, outside the game:

- run _**strategy recognition**_ over recorded games whose strategies are known, and count how often, and how early, it is right;
- in tests, compare _**Beliefs**_ with the ground truth that the test harness knows and the bot does not, such as where the enemy army really is.

**Where it would fit.** _**Strategy recognition**_ and the other inferences in _**Beliefs**_ ([section 4.12](rts-behavior-architecture.md#412-the-enemy-model)), and the tests of [section 5](rts-behavior-architecture.md#5-testability).

**Why it is promising.** Otherwise, inference quality is invisible: a wrong guess shows only as a poor decision later. EISBot's particles were measured against the true positions, and Steamhammer found even a crude strategy recognizer a clear net win.

**Open questions.**

- Warcraft III replays record the players' commands, not the game state, so producing what the bot would have observed may need the game to play them back.
- Where to find recorded games with known strategies.
