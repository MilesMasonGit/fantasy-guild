# Standalone Combat Balancer (SCB) — Concept & Implementation Plan

> **Document status:** v2 — rewritten 2026-07-10 after a design review with the project owner.
> The original v1 draft treated the SCB as a win-rate-focused test script with a fixed
> enemy-archetype matrix; both of those ideas were revised or rejected during review.
> All locked decisions from that review are recorded in **Appendix A** — check there
> before re-deriving a decision. Open questions live in **Appendix B**.

---

## 1. What the SCB Is and Why It Exists

The **Standalone Combat Balancer (SCB)** is a headless Monte Carlo simulation tool that
runs the game's real combat engine outside the game — no UI, no DOM, no real-time clock —
so it can simulate tens of thousands of fights in seconds and report what the numbers
actually do.

### The balance philosophy it serves

Combat in *Fantasy Guild Idle* is a **value generator**, not a boss gauntlet. The player
sets a hero up to win fights over and over inside the Area Deck Loop. A fight's worth is
measured by how *cheaply* and *quickly* it converts time and resources into loot and XP:

*   **Rapid kills produce more loot.** Time-to-Kill (TTK) is the primary balance dial,
    not win rate. An on-level hero losing an on-level fight should be rare; an on-level
    hero killing *slowly* or *expensively* is the interesting failure mode.
*   **Attrition is the real boss.** Killing 10 chickens in a row is the early game;
    killing 1,000 Demon Wizards in a row without breaking the loop cycle is the late
    game. What kills heroes in an idle loop is accumulated damage across a chain of
    fights, not any single duel. The SCB must measure *sustainability*, not just duels.
*   **Randomness should flavor, not decide.** The engine will contain RNG (hit rolls,
    damage spread, crits, block), but a well-built hero should produce *consistent*
    kills. High volatility in fight outcomes is itself a balance defect the SCB flags.

### The SCB's three jobs

1.  **Audit content.** Given the game's database of equippable items and enemies, report
    each one's real mathematical impact and flag outliers (overpowered, underpowered,
    mis-leveled, too swingy).
2.  **Answer design questions on demand.** "What does +5 Armor actually buy a level-20
    hero?" "Can this build sustain the Sunken Bog enemy roster?" — answered with
    simulations instead of guesses.
3.  **Guard against regressions.** Whenever a combat formula, item, status effect, or
    enemy is changed, re-running the standard audit suite shows exactly what shifted
    across the whole game — before players ever see it.

---

## 2. Prerequisites & Build Order

The SCB is deliberately the **last** of three linked workstreams (locked decision):

1.  **The 15-skill system** — the new skill set (4 combat + 11 loop skills) that feeds
    stat derivation. (See `skill_mapping_concept.md`.)
2.  **The 7-stat combat engine** — the proper implementation of the combat mechanics
    described in `combat_mechanics_concept.md` (HP, Armor, Block, Damage, Accuracy,
    Crit, Speed).
3.  **The SCB itself** — built on top of, and importing, that engine.

> [!IMPORTANT]
> **The shared-module rule (locked decision).** The new combat engine is written as a
> **pure, standalone JavaScript module** with zero dependencies on the UI, the DOM,
> game state stores, or real-time timers. The live game imports this module. The SCB
> imports **the exact same module**. There is never a "simulator copy" of the combat
> rules, so the simulator can never drift out of sync with the game — if the SCB says
> a fight takes 14 seconds, the game agrees, by construction.
>
> Practical consequence: the SCB is not just a test tool — it is the *first consumer*
> of the new engine, and its needs (listed in §3) are **requirements on the engine's
> design**, to be honored when the engine is built.

### Note on the current codebase

The combat code that exists today (`src/utils/CombatFormulas.js`,
`src/systems/combat/`) implements an **older design** — attacker-skill vs.
defender-skill hit rolls, percentage defence reduction, no Armor/Block/Crit stats — and
the current `data/enemies.json` schema matches that old engine. Both are slated for
replacement by the 7-stat engine. The SCB targets the **new** engine only; nothing in
this document should be built against the legacy combat code.

---

## 3. Requirements the SCB Imposes on the Shared Combat Engine

For the shared-module rule to work, the engine must be built with these properties from
day one. (These cost almost nothing if designed in, and are painful to retrofit.)

### A. Headless & pure
The engine is a set of functions/classes that take data in and return data out. No
`setTimeout`, no rendering, no reading global game state. The *game* wraps it in
real-time pacing and animation; the *SCB* calls it in a tight loop.

### B. Simulated clock
The engine advances combat by explicit time steps ("advance the fight by X
milliseconds") rather than waiting on real time. This is what lets the SCB run 10,000
fights in seconds while the game plays the same fight over 15 real seconds.

### C. Seeded randomness (reproducibility)
All RNG (hit rolls, damage spread, crit, block) flows through a **seedable random
number generator** the engine receives as an input, rather than raw `Math.random()`.

*Plain-language explanation:* a "seed" is a starting number for the dice-roller. Two
runs with the same seed roll the *exact same dice* and produce identical fights. This
does **not** reduce how random combat feels in the game (the game passes a fresh seed
every fight) — it means that when the SCB flags a weird result, we can re-run that
exact simulation and watch the same fight happen again, instead of chasing a ghost.

### D. Data-driven entities
Heroes and enemies enter the engine as plain data objects. Nothing about a fighter is
hard-coded.

*   **Hero entity:** hero level, the 4 combat skill levels (Melee/Ranged/Magic/Defense),
    an equipment list, and active pre-combat statuses/buffs. The engine derives the 7
    combat stats from these per the derivation matrix in `combat_mechanics_concept.md`.
*   **Naked hero baseline (locked decision):** a hero with no equipment is a *complete,
    functional fighter* — level and skills alone provide baseline HP, Damage, attack
    Speed, and the rest. Equipment modifies and specializes; it is never required for
    the math to run. This is what makes clean baseline testing possible.
*   **Enemy entity:** level/tier, the same 7 stats, style (melee/ranged/magic), status
    behaviors (e.g., "applies Poison on hit"), and its loot/XP payload.

### E. The RPS layer
The melee/ranged/magic rock-paper-scissors triangle **survives** into the new engine
(locked decision), implemented as a *modifier layer on top of the 7 stats* — a
favorable matchup grants bonuses (e.g., to Damage and Accuracy) rather than being a
separate hidden formula. The SCB therefore treats style matchup as one more input
dimension to sweep, and every audit reports per-matchup results.

### F. Pluggable status-effect registry
Status effects (Poison, Bleed, Stun, Burning, buffs, immunities…) do not exist yet.
When they are built, they must be **defined as data in a registry** — each status
declaring its trigger (on hit, per tick, on fight start…), magnitude, duration, and
stacking rule — rather than as one-off code scattered through the engine.

The payoff for the SCB: it reads the same registry. **Any status effect added during
development is automatically picked up and included in the audit suite** with zero SCB
changes — a new "Frostbite" status gets baseline-vs-delta tested the same night it's
authored (locked decision: this auto-inclusion is a core requirement, since statuses
will be added continuously during development).

### G. Fight transcript output
The engine can optionally emit a structured log of a single fight (every roll, hit,
mitigation, status tick). The game ignores this; the SCB uses it to power drill-down
views ("show me *why* this fight went long") and to debug flagged anomalies.

---

## 4. Simulation Modes

The SCB runs the engine in four modes, from micro to macro.

### Mode 1 — Duel
One hero configuration vs. one enemy, N times (default 1,000+, seeded). The atomic unit
every other mode is built from. Outputs the per-fight metrics in §5.

### Mode 2 — Gauntlet (attrition) ★ the centerpiece
One hero configuration vs. a **stream of enemies** — the same enemy repeated, or a
weighted mix representing a real Area's roster — fought back-to-back, carrying HP,
energy, and lingering statuses from fight to fight, under a configurable **recovery
model**:

*   **No recovery:** raw endurance. Output: *Kills-to-Death* — how many enemies fall
    before the hero does.
*   **Fixed recovery:** X HP (and/or energy, status cleansing) restored between fights,
    approximating rest slots and cheap sustain in the loop.
*   **Consumable budget:** a finite supply of food/potions consumed by the same rules
    the game uses, approximating a provisioned adventure loop.

The key analytical output is the **sustainability verdict**: compare *average HP lost
per kill* against *recovery per kill*. If recovery ≥ loss (with enough margin to absorb
bad-luck streaks), the chain is **sustainable — effectively infinite kills**; the report
then says how much margin exists. If not, the chain is finite and the report says how
long it lasts. "Can this build farm 1,000 Demon Wizards?" is answered here.

Gauntlet mode is also where sustain-oriented items (healing food, HP buffers,
regeneration effects) reveal their true value — they look near-worthless in a single
duel and become build-defining across a chain, and the SCB must price that correctly.

### Mode 3 — Component Delta Testing
The methodology for pricing a single item, status, or stat point:

1.  **Baseline:** run Duel + Gauntlet for a reference hero at the target level.
2.  **Inject exactly one component** (the item under audit, a status, or a raw stat
    increment like `+5 Armor`).
3.  **Re-run identically** (same seeds, same enemies) and diff every metric.

The measured differences — faster TTK, cheaper kills, longer chains — normalize into a
**Power Weight** for that component *in that context*.

**Contexts, not archetypes (locked decision).** The v1 draft delta-tested only a naked
hero against four synthetic enemy archetypes (Tank/Evader/Sponge/Controller). That was
rejected as unrealistic: real hero builds and real enemies both live on a spectrum, and
an item's value depends on the kit around it. Instead, each component is delta-tested
across a grid of:

*   **Hero contexts:** the naked baseline hero, *plus* a curated **Reference Build
    Library** (§6) of realistic kits.
*   **Enemy contexts:** real enemies from the game database in the component's level
    band (§7), across style matchups.

The result is a **Power Profile** — a small table, not a single number — showing where
the component is strong, where it's dead weight, and whether any context exists where
it's degenerate.

### Mode 4 — Database Audit (batch)
The nightly-driver mode: sweep **every equippable item** and **every enemy** in the
database through Modes 1–3 automatically, emit the full HTML report (§9), and diff it
against the previous report so formula changes show their blast radius. This is the
regression safety net.

---

## 5. Metrics

Reported for every simulation, in priority order:

| Metric | What it tells us | Primary? |
|---|---|---|
| **TTK (Time-to-Kill)** | Seconds of simulated time to kill one enemy. The core value dial — faster kills = more loot per hour. | ★ Primary |
| **HP Loss per Kill** | Average damage absorbed per enemy killed. The attrition cost of farming this enemy. | ★ Primary |
| **Kills-to-Death / Sustainability** | Gauntlet output: chain length under each recovery model, or "sustainable" with margin. | ★ Primary |
| **Volatility** | Spread (not just min/max — a percentile spread like "90% of fights fall between X and Y") of TTK and HP loss. High spread = RNG deciding outcomes = design defect. Especially important because a *sustainable-on-average* chain can still die to variance spikes. | ★ Primary |
| **Resource Drain per Kill** | Energy and consumables spent per kill, once those costs are wired into the engine. | Secondary |
| **Value Rate** | Loot value + XP generated per simulated hour (uses TTK + drop tables + item `baseValue`). The "is this enemy worth farming?" number. | Secondary (later phase) |
| **Win Rate** | Survival percentage. Retained as a sanity check only — in a healthy configuration it should be ~100%, and any dip below that is itself a flag. | Demoted (locked decision) |

### Statistical honesty
Monte Carlo results are estimates with noise. The SCB must:

*   Report run counts alongside every number, and use enough runs per mode that the
    noise band is smaller than the differences we act on (delta tests need more runs
    than headline audits; the tool should say when a delta is within noise —
    "no measurable effect" is a valid and important result).
*   Use **paired seeds** for delta tests (baseline and injected runs see the same dice),
    which removes most of the noise from the comparison for free.

---

## 6. The Reference Build Library

A small, curated, **data-defined** set of realistic hero loadouts per level band —
e.g., at level 20: a heavy-armor melee tank, a glass-cannon ranged build, a
block/evasion build, a magic build with status gear. Stored as plain data files the
SCB reads, so designers add or adjust reference builds without touching SCB code.

Purpose:

*   Gives Component Delta Testing (§4, Mode 3) realistic contexts — "+10% Crit" prices
    very differently on a slow heavy hitter vs. a fast dagger build.
*   Gives Gauntlet audits a standard cast of protagonists, so "can a reasonable level-30
    build sustain this Area?" has a concrete meaning.
*   Grows organically: when a new gear family or build style enters the game, a
    matching reference build is added, and every subsequent audit covers it.

The naked baseline hero remains in the library permanently as context zero — it's the
cleanest measurement, just no longer the *only* one.

---

## 7. Enemy Auditing (both directions)

Items are only half the database. The same machinery audits enemies:

*   **Mis-leveling detection:** every enemy is fought by the reference builds of its
    intended tier. An enemy whose TTK, HP-loss-per-kill, or sustainability cost is an
    outlier versus its tier peers gets flagged as under- or over-tuned for its level.
*   **Roster/Area analysis:** Gauntlet mode over an Area's actual enemy mix answers
    "is this Area's combat density survivable for its intended level band?"
*   **Synthetic stress dummies (demoted, retained):** the v1 archetype matrix is no
    longer the core methodology, but hand-built extreme dummies (all-Armor, all-Block,
    huge-HP, status-spam) survive as *diagnostic instruments* — when a real audit flags
    something odd, sweeping the component against stress dummies quickly isolates
    *which stat interaction* is responsible. They are a debugging magnifying glass,
    not the lens the game is balanced through.

---

## 8. Prescriptive Flagging

The audit's job is to *point*, loudly and specifically. Scoped for v1 (locked decision):

*   **Flags, not auto-recommendations.** v1 emits severity-ranked flags —
    `OVERPOWERED` (strong in every context, no counters), `UNDERPOWERED` (no context
    where it matters), `SPECIALIZED` (strong somewhere, dead elsewhere — usually
    healthy!), `VOLATILE` (outcome spread too wide), `MISPRICED` (power wildly out of
    line with its level/tier peers) — each with the numbers behind it and links to
    sample fight transcripts. Auto-generated fix suggestions ("reduce damage 75%") are
    a possible later layer, not v1.
*   **Stacking checks:** a component that is fine alone can be degenerate when stacked
    (Block/avoidance especially — three stacked Block sources compound viciously).
    Audits include a ×2/×3-stack pass for stackable components and flag super-linear
    scaling.

### The "power budget" question (deferred — plain-language explainer)
To call an item *mis*-priced, the SCB needs a yardstick for what an item of a given
level *should* be worth — like a salary band for gear. Two ways to get one:

*   **Empirical:** compare each item to the median Power Weight of other items at the
    same level, and flag outliers. Self-bootstrapping, but blind if the whole database
    drifts strong or weak together.
*   **Authored curve:** the designer declares "a full level-N loadout should add up to
    about X total power," and the SCB measures against that.

**Decision deferred** (owner call, 2026-07-10): start with the empirical approach when
audits first run, and revisit an authored curve once real data exists and the concept
is better understood. Tracked in Appendix B.

---

## 9. Output: The HTML Dashboard (locked decision)

The SCB's face is a **local HTML report** — a file the audit run generates, opened in a
browser. No terminal reading required.

*   **Overview page:** headline stats, flag counts by severity, "what changed since the
    last run" diff.
*   **Items table:** every audited item — sortable/filterable by level, slot, Power
    Weight, flags. Click an item → its full Power Profile (per build context, per
    enemy, per style matchup), stack test, and sample fight transcripts.
*   **Enemies table:** the same, from the enemy side — TTK/tier scatter, mis-level
    flags, per-Area roster sustainability.
*   **Gauntlet explorer:** pick a build + an enemy roster + a recovery model, see the
    sustainability verdict and the survival curve.
*   **Run history:** reports are kept (timestamped JSON alongside the HTML), so any two
    runs can be diffed — the regression-testing backbone.

Implementation note: static files (JSON data + a self-contained HTML/JS viewer), no
server required. Likely launched via a simple npm script the owner can run, or run by
Claude during balance sessions.

---

## 10. Implementation Phases (the plan)

Each phase ends with a smoke test, mirroring the project's roadmap practice. Phases
assume the 15-skill system and the 7-stat engine land first (§2); SCB Phase S0 overlaps
with engine construction by design.

*   **Phase S0 — Engine contract.** While the 7-stat engine is being built, hold it to
    the §3 requirements (pure module, simulated clock, seeded RNG, data-driven
    entities, status registry, transcripts). Deliverable: the engine passes a "headless
    harness" check — a script runs one full fight with a fixed seed and gets an
    identical transcript every time.
    *Smoke test: same seed → byte-identical fight transcript, twice.*

*   **Phase S1 — Duel runner.** The SCB core: load hero/enemy data, run N seeded duels,
    compute §5 metrics, dump JSON. Command-line only.
    *Smoke test: 10,000 duels complete in seconds; metrics stable across re-runs with
    the same seed set; naked level-20 hero vs. an on-level enemy produces sane numbers.*

*   **Phase S2 — Gauntlet mode.** Enemy streams, carried state, the three recovery
    models, Kills-to-Death and the sustainability verdict.
    *Smoke test: a deliberately weak build shows finite kills; a deliberately strong
    build shows "sustainable"; adding recovery moves the needle the right direction.*

*   **Phase S3 — Batch audit + HTML dashboard.** Sweep the full item and enemy
    databases; generate the §9 report with tables, flags, and run-history diffing.
    *Smoke test: owner opens the HTML file, sorts the items table, clicks into one
    item's profile, and can read it without explanation.*

*   **Phase S4 — Delta testing + Reference Build Library.** Component injection with
    paired seeds, the build library data format, Power Profiles, stack tests, and the
    full v1 flag set.
    *Smoke test: a known-strong test item gets flagged OVERPOWERED; a placebo item
    (+0 to everything) reports "no measurable effect."*

*   **Phase S5 — Status-effect harness.** When the status registry exists: automatic
    discovery and delta-testing of every registered status, both hero-side (on-hit
    effects) and enemy-side (statuses applied *to* the hero, priced in Gauntlet mode).
    *Smoke test: author a new throwaway status in the registry, re-run the audit, and
    it appears in the report with a Power Profile — zero SCB code changes.*

*   **Later / not scoped:** Value Rate economics (loot value per hour), auto-generated
    balance recommendations, authored power-budget curves, loop-level simulation
    (combat slots embedded in full deck cycles with real rest-slot spacing).

---

## 11. Preparation & Risks

### Preparation work (valuable now, before any engine code exists)

In order of leverage:

1.  **Balance Targets document.** Design intent written as numbers: target on-level
    fight duration, unattended-play expectations, the gear-vs-level power split,
    level-gap punishment curves, acceptable outcome variance. Every flag the SCB
    raises is secretly a comparison against these targets — they must be authored by
    the project owner, and they require zero code. *(**Done 2026-07-10** — see
    `balance_targets_concept.md`; its §7 maps each target to the SCB check it becomes.)*
2.  **The 7-stat formula spec.** `combat_mechanics_concept.md` says *where* each stat
    comes from, but not the curves — HP per level, enemy stat budgets per tier, RPS
    modifier sizes. This is the hard design work the engine build needs anyway; the
    SCB's first real job (before any items exist) is validating these base curves:
    naked hero vs. on-level enemy must hit the Balance Targets at every level band.
    *(**Drafted 2026-07-10** — see `combat_formula_spec.md`: structures owner-locked,
    numeric constants ⚠ provisional pending the curve explorer.)*
3.  **The item-families decision.** Hundreds of items should almost certainly be
    generated from ~15–25 scaling *families* (Copper → Iron → Steel…) rather than
    hand-authored individually. If so, the SCB validates ~25 scaling rules instead of
    500 items, and generated items are born balanced; only unique items need
    individual audits. This decision shapes the new equipment/enemy JSON schemas and
    should be made before content authoring starts. *(Open — Appendix B7.)*
4.  **Optional: a disposable curve-explorer prototype.** A throwaway calculator for
    eyeballing whether the formula spec produces sane fights, built *before* the real
    engine. Explicitly exempt from the shared-module rule (A1) because it gets
    deleted — it is a sketchpad, never a reference.

### Known risks & mitigations

| Risk | Why it matters | Mitigation |
|---|---|---|
| **No baseline to check against.** The SCB can only measure deviation from a baseline that doesn't exist yet. | "Overpowered" is meaningless without authored design intent. | Balance Targets doc + formula spec come first (prep items 1–2); curve-first calibration before item audits. |
| **A buggy simulator misleads with confidence.** | Bad flags erode trust or, worse, get acted on. | "Verify the verifier": a small suite of fights simple enough to compute by hand, which the engine must reproduce exactly (folded into Phase S0's smoke test). |
| **Information overload, not compute.** JS can run a million fights in seconds; the real failure mode is a dashboard nobody opens after week two. | A tool that isn't read is a tool that doesn't exist. | Front page shows *only* flags and diffs-since-last-run; everything else is behind a click. Treat this as a standing design principle for every future dashboard addition. |
| **Exotic statuses escape the harness.** Auto-testing (A8) only works for statuses expressible in the registry vocabulary (trigger, magnitude, duration, stacking). | One custom-coded status breaks the "every status is audited automatically" guarantee. | Accept the constraint now, while zero statuses exist: registry-expressible is the norm; custom-coded behavior is rare, deliberate, and gets a hand-written SCB test as its price of admission. |
| **The SCB is blind outside combat.** It can't see crafting cost, drop rarity, deck-slot opportunity cost, loop synergies, or fun. | A "balanced" item can be boring; a "weak" item can be great for the game. | The SCB informs, the designer decides — flags are evidence, never verdicts. Economy-side balancing (power vs. acquisition cost) is a separate future tool, deliberately out of scope. |
| **Sequencing churn.** The SCB is downstream of two unbuilt systems (15 skills, 7-stat engine); detailed SCB design against a moving spec wastes effort. | Rework if the engine spec shifts under it. | Keep SCB work at concept level (this doc) until the engine spec stabilizes; the §3 engine requirements are the contract, and they're deliberately about *shape*, not numbers. |

---

## Appendix A — Decision Log (design review, 2026-07-10)

| # | Decision | Rationale |
|---|---|---|
| A1 | **Shared-module architecture.** The new 7-stat combat engine is one pure JS module; the game and the SCB both import it. No simulator copy of the rules, ever. | Eliminates drift between simulator and game by construction. |
| A2 | **Build order:** 15 skills → 7-stat combat engine → SCB. This document is a plan; nothing is implemented yet. | Skills feed stat derivation; the engine must exist before the balancer that exercises it. |
| A3 | **RPS triangle survives** in the new engine, as a modifier layer on the 7 stats (e.g., bonus Damage/Accuracy on favorable matchup). | Preserves style identity without adding hidden formulas outside the 7-stat frame. |
| A4 | **Balance around TTK and value generation, not win rate.** Win rate is a sanity check; heroes should win on-level fights routinely unless left unattended for very long. | Combat is a value generator in an idle loop; speed and cost of kills is what matters. |
| A5 | **Attrition analysis is crucial** (Gauntlet mode is a centerpiece, not an extra). Late game requires ~1,000-kill sustainable chains. | The real failure mode in an idle loop is accumulated damage across fights. |
| A6 | **Naked heroes are complete fighters** — level + skills provide baseline HP, Damage, Speed, etc. with no equipment. | Enables clean baselines; equipment specializes rather than enables. |
| A7 | **The four-archetype enemy matrix is rejected** as the core methodology; replaced by real-database enemy contexts + a Reference Build Library. Synthetic dummies are demoted to diagnostic tools. | Hero builds and enemies live on a spectrum; four fixed dummies misprice items. |
| A8 | **Status effects will be data-driven** (registry), and the SCB auto-includes any registered status in audits with no SCB changes. | Statuses will be added continuously during development and must be testable immediately. |
| A9 | **Output is a local HTML dashboard**, not console output. | The project owner doesn't work in a terminal. |
| A10 | **Seeded RNG throughout the engine.** Randomness stays in the design (hit/damage/crit/block rolls), but every simulation is reproducible, and consistent kill performance is the design target (high volatility is a flag). | Reproducibility for debugging flagged results; owner intent that combat produce consistent kills. |
| A11 | **v1 flags, no auto-recommendations.** Severity-ranked flags with evidence; suggested fixes are a possible later layer. | Auto-recommendation is much harder and lower-trust than detection; keep v1 credible. |

## Appendix B — Open Questions

| # | Question | Notes / when to resolve |
|---|---|---|
| B1 | **Power-budget yardstick** — empirical (compare to level peers) vs. authored curve ("a level-N loadout is worth X"). | Owner deferred (didn't yet have full context). Start empirical in Phase S3/S4; revisit once the first real audit data exists. |
| B2 | **Recovery-model numbers for Gauntlet mode** — how much between-fight recovery does a real loop actually provide (rest-slot frequency, consumable throughput)? | Depends on Area Deck Loop tuning; parameterize in S2, calibrate against real deck layouts later. |
| B3 | ~~**Energy's role in combat sustain**~~ | **Resolved 2026-07-10 (owner):** no energy cost in combat — HP/food is the only combat attrition currency; energy stays a loop-task resource. See `combat_formula_spec.md` F4. |
| B4 | ~~**Enemy behaviors beyond stats**~~ | **Resolved 2026-07-10 (owner):** enemies are stat blocks + style + optional statuses; no ability scripting. See `combat_formula_spec.md` F5 and its §6 budget-trade rule. |
| B5 | **Status-effect catalog** — the actual starter list of statuses (durations, stacking rules, tick math). Doesn't exist yet. | Author alongside the engine's status registry; SCB Phase S5 consumes it as-is. |
| B6 | **Loot-value economics for Value Rate** — item `baseValue` exists in `data/items.json`; is it trustworthy enough to compute gold-per-hour, or does it need its own audit first? | Later phase; not blocking. |
| B7 | ~~**Item generation strategy**~~ | **Resolved 2026-07-10 (owner):** generated tier families (one per 5-level enemy band) + hand-authored uniques priced against the same slot budgets. See `combat_formula_spec.md` F6 / §4. |
