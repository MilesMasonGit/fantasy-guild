# Balance Solver — Lever Policy Brief

**Purpose.** This document briefs a design discussion about **which levers an
automated balance solver should tune, and where**. It is written to be read cold
— no prior knowledge of Fantasy Guild is assumed.

**The decision to make** is recorded as **CMS-107** in
[`cms_rework_v2_decisions.md`](cms_rework_v2_decisions.md), currently unresolved
and blocking Phase 8 of the CMS rework. The owner's words:

> "I prefer to tune yield or percentage chance of a drop. We have four levers —
> Drop Value, Frequency, Quantity, and Chance. Deciding on which to use and
> where is the tricky part, worth its own discussion."

Everything in §1–§5 is settled and should be treated as given. §6 is the actual
question. §7 lists the traps.

---

## 1. The game, in five minutes

Fantasy Guild is an **idle/incremental game**. The player runs a guild on a
**7×7 board** (the "playmat") of 49 tiles.

**Tokens** are the core object. A Token is placed on a tile and does something:

| Kind | Behaviour |
| :--- | :--- |
| **Resource** | Creates items from nothing on a repeating work cycle |
| **Station** | Consumes items and produces others |
| **Context** | Defines what an adjacent station makes; produces nothing itself |
| **Buff** | Nudges an adjacent Token's numbers |
| **Manager** | Restocks its neighbours automatically |
| **Market** | Consumes goods, outputs gold |
| **Enemy** | Fought rather than worked; drops loot |
| **Triggered** | No work cycle at all — reacts to events on a cooldown |

**Heroes** staff Tokens. A hero is a *gate*: most Tokens need one present, and
the hero must hold the required skill at the required level. Hero level does not
currently affect speed or output — that is deliberately deferred.

**The core loop:**

1. Buy a **Map** from the Cartographer for gold (plus a small material cost).
2. The Map **bursts** into 3–6 things drawn from its weighted pool — Tokens and
   raw items.
3. Place Tokens on the board, staff them with heroes, arrange them so context
   and buffs line up.
4. Tokens run work cycles, producing items onto the board.
5. Sell items for gold, or feed them into deeper production chains.
6. Buy more Maps.

**Two facts that shape everything:**

- **Tokens are consumable.** Almost every Token has finite **charges** (`uses`),
  spent one per completed cycle. When they run out the Token is gone. Maps are
  therefore the primary supply line, not a one-off purchase.
- **Adjacency does three jobs at once**: it defines recipes (a Smelter with an
  Ingot Mould beside it makes ingots; with nothing beside it makes *nothing*),
  it applies buffs, and it enables upgrades. Placement is the main strategic
  decision.

---

## 2. What the solver is for

Content is **hand-authored, per Token, with no formula** — a deliberate choice
(decision D-161). Every yield, cycle time, charge count and input cost is set
individually so each Token has character. The cost is that roughly 60 Tokens
eventually need hand-tuning, and hand-authored numbers do not scale.

The CMS (a separate authoring app in `cms/`) is being rebuilt to make that
tractable. Its balance engine has **two jobs**:

### Job 1 — Derive every item's value

The player never types an item's gold value. It is **derived** from the one
hand-authored anchor in the whole economy: **a Map's price**.

```
Map price (+ its material cost)
  → target total sell value of one burst      [Map price × a sell-ratio dial]
  → allocated across pool entries by rarity   [rarer entry = bigger slice]
  → cost to acquire one copy of a Token
  → ÷ that Token's charges  = cost per charge
  → ÷ its yield per cycle   = cost per unit item
  → the item's root value
```

Values then propagate downstream through production chains, with a markup per
processing step. The solver runs **iteratively until stable**, because the graph
is not a tree — items have multiple sources, and a Map's material cost is itself
priced by the same system.

### Job 2 — Keep earn rates in band

Each skill level has a target **gold per hour** and **XP per hour**. The solver
checks each Token's implied earn rate against its band, and — this is the part
under discussion — **adjusts something** when it falls outside.

Job 2 is where the levers live.

---

## 3. Why Job 2 is unavoidable, not optional

Value flows **one way**. An item takes its value from exactly one **anchor** —
the cheapest way to acquire it. Any *other* Token producing that same item
cannot also define its value; the value is already set. So that second Token's
own numbers have to be adjusted until its earn rate lands in band.

**This is most of the economy, not an edge case.** In current content, **6 of
the 15 produced items have more than one source**:

| Item | Produced by |
| :--- | :--- |
| Oak Wood | Oakwood Grove, Wind Trap, Heartwood |
| Yew Log | Yew Copse, Yew Stand |
| Copper Ore | Copper Seam, Silt Bed |
| Fish | Trout Stream, River Delta |
| Glowcap | Woodland Still, Forge, Glowcap Hollow |
| Spider Silk | Deep Kiln, Forge |

Every non-anchor Token in that table needs solving. The question is *what the
solver changes* to do it.

---

## 4. The four levers

Given a Token that produces item *X*, its gold-per-hour is roughly:

```
GPH  =  (value(X) × quantity × chance) / cycleTime  × 3600
```

Four terms, hence four levers.

### Lever 1 — Drop Value

The item's gold value.

**Effectively unavailable.** This is the anchor the whole chain derives from.
Changing it to fix one Token would change every other Token that touches that
item, and would defeat the derivation in §2. Named for completeness.

### Lever 2 — Frequency (cycle time)

How long one work cycle takes.

- **Continuous and fine-grained** — milliseconds.
- ⚠️ **Hard-bounded to 10–30 seconds** by decision D-164, and this is
  mechanically enforced by `ContentRules.test.js`. The band exists for feel: with
  eight heroes working, it produces roughly one completion every two or three
  seconds across the board — an unhurried rhythm where every drop registers.
- **Current content already spans the entire band**: cycle times in use are
  10s, 12s, 14s, 15s, 16s, 18s, 20s, 22s, 25s, 28s, 30s. Both bounds are
  occupied, so there is **at most a 3× range**, and for a Token already at 10s
  or 30s there is no headroom in one direction at all.
- The owner has expressed a preference *against* this lever.

### Lever 3 — Quantity (units per cycle)

How many units one completed cycle yields.

- **A small integer.** Current content uses 1, 2, 3, 4, 5, 6 and 8.
- **Coarse.** Going 2 → 3 is a 50% jump; 1 → 2 is 100%. There is nothing in
  between, so it cannot make small corrections.
- The engine *does* support a **min/max range** per output (e.g. "1–5"), which
  is finer-grained in expectation — a 1–5 range averages 3, and shifting to 2–5
  averages 3.5. **No shipped content uses ranges yet.**
- Highly legible to the player: "this makes 2 planks."
- One of the owner's two preferred levers.

### Lever 4 — Chance (probability of the drop)

The percentage chance an output actually appears on a completed cycle.

- **Continuous and fine-grained** — any percentage.
- **Barely used in current content**: the only values in use are **100% and
  60%**. Effectively an unexplored lever.
- ⚠️ **It changes how a Token feels**, not just what it earns. A 100%-chance
  Token is a metronome; a 40%-chance Token is a slot machine with the same
  average. Two Tokens can be identical on a spreadsheet and completely different
  to watch.
- Each output entry rolls **independently**, so a Token with several outputs can
  yield any combination of them in one cycle.
- The other of the owner's two preferred levers.

---

## 5. What is already decided — do not re-open

These are settled. Please treat them as constraints, not options.

| Ref | Decision |
| :--- | :--- |
| **D-161** | Every number is hand-authored per Token. No tier formula, no curve. |
| **D-164** | Cycle times stay in the 10–30s band. Test-enforced. |
| **D-175** | Rarity means **drop frequency only**. It is not a power tier. A Common Riverlands producer legitimately out-produces a Rare Woodland one. |
| **D-176** | Charges are per-Token and independent of rarity. `null` means unlimited. |
| **CMS-16** | Recalculation is **on demand**, never live as you type. |
| **CMS-14** | The solver **auto-corrects without asking**. No review-and-approve step. |
| **CMS-44/48** | Value derives from Map price, anchored in aggregate first, then allocated per entry by rarity. |
| **CMS-45** | A multi-source item anchors to its **cheapest** acquisition path. |
| **CMS-47** | Solving is **iterative until stable**, not a single top-down pass. |
| **CMS-86** | An item with no derivation chain is a **Critical audit error**, never a hand-typed number. |
| **CMS-103** | Rarity premium is strong: per-copy value is roughly inverse to draw weight. |
| **CMS-104** | Unlimited-charge Tokens use an assumed-lifetime dial. |
| **CMS-106** | Value flows one way; non-anchor Tokens are solved backwards into the velocity band. |
| **CMS-108** | The Map anchor uses gold **plus** material value, accepting the circularity. |

### The most important piece of context

The owner's framing on sell values, recorded as CMS-103, reshapes what
"accurate" means here:

> "Selling the tokens is really secondary. It almost doesn't matter what they
> sell for, as in optimal play the player is almost never selling tokens, always
> using them for their full value. I still want to give rarer drops a higher
> value so it feels right, but getting this slightly off really doesn't matter
> to gameplay."

**Precision on the sell side is not the goal.** It exists so a rare find feels
right. The numbers that matter are the ones governing whether a *production
chain* is worth running — the usage side. Any proposal that buys sell-side
accuracy at the cost of complexity elsewhere is a bad trade.

---

## 6. The actual questions

**Primary: which lever, and when?**

A policy is needed, not a single answer — plausibly a priority order with
conditions. Things that likely matter:

- **Does the Token kind change the answer?** A Resource creating from nothing,
  a Station transforming inputs, and an Enemy dropping loot are different
  situations. Combat has an additional constraint: decision CMS-51 explicitly
  ruled that enemy loot is judged on **total lifetime value versus acquisition
  cost**, with *no time dimension* — "how fast" is deferred as a combat-balance
  question. That may make cycle time meaningless for enemies.
- **Does the size of the correction change the answer?** A 5% miss and a 300%
  miss may want different levers — one fine, one coarse.
- **What happens when a lever hits its limit?** A Token already at a 30s cycle
  that still earns too much has nowhere to go on that lever. Fall through to the
  next lever, or flag it for a human?
- **Should quantity ranges (min/max) be preferred over fixed quantities**, given
  they give finer expected-value control while staying integers?
- **Is there a lever budget?** Should the solver change one thing per Token, or
  is it free to move several at once?

**Secondary: what should it refuse to do?**

The solver auto-corrects without approval (CMS-14), so its restraint matters as
much as its reach. When should it *decline* to fix something and raise an audit
warning for a human instead? Candidates: when a fix would need a cycle time
outside D-164, when it would push a chance below some legibility floor, when a
Token would need a yield of 0.

**Tertiary: does "in band" mean a point or a range?**

The existing velocity targets are single numbers per level bracket
(1200 g/hr at level 1, 1400 at 11, 10000 at 41, 176000 at 71 — a steep curve).
The old solver used a tolerance band around the target and only intervened
outside it. Whether that is still wanted, and how wide, affects how often the
solver touches anything at all.

---

## 7. Traps

Things that look like good ideas and are not, for reasons already established.

- **Deriving numbers from a tier formula.** D-161 rejected this deliberately.
  Per-Token character is the point; the solver corrects, it does not generate.
- **Making rarity drive power.** D-175 is explicit. Rarity affects how often you
  *find* a Token, and (via acquisition cost) what it is *worth* — never how
  strong it is.
- **Adding a time dimension to combat loot.** CMS-51 considered and rejected it.
- **A review-and-approve step for corrections.** CMS-14 rejected it: the entire
  point is not re-touching hundreds of items by hand when a dial moves.
- **Live recalculation.** CMS-16 chose explicit, on-demand recalculation.
- **Optimising the sell side.** See CMS-103 above.

---

## 8. Facts and figures

Current shipped content (placeholder quality — it will be re-authored in the
CMS, so treat these as *shape*, not as balance):

| | |
| :--- | :--- |
| Tokens | 41 |
| Maps | 2 (Woodland 200g, Riverlands 2,000g) |
| Items | 63 |
| Production routes | 24 |
| Produced items | 15, of which **6 have multiple sources** |
| Cycle times in use | 10s–30s, 11 distinct values, both bounds occupied |
| Yield quantities in use | 1, 2, 3, 4, 5, 6, 8 |
| Drop chances in use | **only 100% and 60%** |
| Charges | 33 Tokens finite (1–8000), **8 unlimited** |
| Burst size | 3–6 items per Map |
| Woodland pool | 29 entries, total weight 249, spread 1–26 |

A real chain, to show the shape:

```
Copper Seam    15s   nothing            → 2 Copper Ore
Charcoal Kiln  20s   4 Oak Wood         → 2 Charcoal
Smelter        22s   3 Copper Ore + 1 Charcoal → 1 Copper Ingot   [needs Ingot Mould adjacent]
Smelter        22s   2 Copper Ingot + 1 Yew Log → 1 Copper Sword  [needs Blade Mould adjacent]
```

Note the last two lines: a context Token beside the station decides *which*
recipe runs. Both use the station's cycle time — per-recipe cycle times exist
only for stations that opt into a shared skill-wide recipe pool.

---

## 9. Prior art in the codebase

An earlier version of this solver exists and **worked**, for a version of the
game that no longer exists (it was card-based). It is retained as reference:

| File | What it did |
| :--- | :--- |
| `cms/src/engine/taskSolver.js` | The closest prior art. Balanced entities against gold-per-hour targets by tuning **drop chances first**, falling back to **tick time** when chance hit 0% or 100%. Also snapped chances to round numbers (10s, then 5s, then 1s) so authored values stayed legible. |
| `cms/src/engine/valuePropagator.js` | Iterative value propagation from root items downstream. |
| `cms/src/engine/evCalculator.js` | Gold- and XP-per-minute calculations. |
| `cms/src/engine/connectivityAuditor.js` | Dangling-reference and unreachable-item detection. |

⚠️ **`taskSolver.js` already implements one answer to this brief's question** —
chance first, cycle time as fallback, with value-snapping for legibility. It is
worth reading before proposing something new. It was written for different
entity types and different constraints, so it is a starting point rather than a
verdict.

Engine-side, the runtime that consumes all of this:

| File | Relevance |
| :--- | :--- |
| `src/systems/board/BoardRunner.js` | The cycle engine. Shows exactly how quantity, chance, cycle time and modifiers combine at runtime. |
| `src/config/registries/tokenRegistry.js` | Token definitions load from `data/tokens.json`; also holds the output-range helpers. |
| `src/tests/ContentRules.test.js` | The mechanically-enforced content rules, including D-164's cycle band. **Any solver output must keep this suite green.** |

---

## 10. Recording the outcome

The result should land as **new numbered decisions from CMS-109 onward** in
[`cms_rework_v2_decisions.md`](cms_rework_v2_decisions.md), following the
existing format: the decision, *why*, what was rejected and why, and any cost
knowingly accepted. CMS-107 should be marked resolved and point at them.

House style for that log, worth matching:

- State the decision as a claim, not a description of a discussion.
- Always record the **rejected** alternatives — they are the most useful part
  when revisiting a decision months later.
- Name the cost being accepted, rather than presenting a choice as free.
- If a decision supersedes an earlier one, say so explicitly and leave the old
  one struck through rather than deleting it.
