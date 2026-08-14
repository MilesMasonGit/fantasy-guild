# Review — CMS Balance Engine & Solver Architecture Plan

Reviewing [`cms_solver_plan.md`](cms_solver_plan.md) against the shipped code
and content. Findings are ordered by severity. Every number below was computed
from `data/tokens.json` and `data/maps.json` rather than estimated.

**Summary.** The architecture, file layout and restraint rules are sound and
worth keeping. Two findings are blocking: the plan's two primary levers are
**algebraically inert** for the majority of Tokens, and the value chain and the
velocity targets are calibrated roughly **four orders of magnitude apart**.
Neither is a coding error — both are consequences of the model that only show up
when you put real numbers through it.

---

## 🔴 Blocking 1 — Quantity and Chance cannot move GPH for an anchor Token

### The algebra

For a Token that **is** its item's anchor, the item's value is *defined* by that
Token's own output (CMS-44):

```
value(X)  =  A / (C · q · p)          A = acquisition cost, C = charges,
                                      q = quantity/cycle, p = drop chance
```

Its gold-per-hour is:

```
GPH  =  value(X) · q · p / cycleTime · 3600
     =  [A / (C · q · p)] · q · p / cycleTime · 3600
     =  A / (C · cycleTime) · 3600
```

**`q` and `p` cancel exactly.** For an anchor Token, GPH depends only on
acquisition cost, charge count and cycle time.

### Confirmed against real content

Oakwood Grove (weight 26 of 249, 5000 charges, 12s cycle, 2 Oak Wood at 100%),
using the plan's own formula and CMS-103's inverse-weight allocation:

| Quantity | Derived item value | Implied GPH |
| ---: | ---: | ---: |
| 1 | 0.000490 g | **0.1469** |
| 2 | 0.000245 g | **0.1469** |
| 4 | 0.000122 g | **0.1469** |
| 8 | 0.000061 g | **0.1469** |

| Chance | Derived item value | Implied GPH |
| ---: | ---: | ---: |
| 100% | 0.000245 g | **0.1469** |
| 50% | 0.000490 g | **0.1469** |
| 25% | 0.000979 g | **0.1469** |

Tuning either lever changes the item's *value* in exact inverse proportion,
leaving earn rate untouched. The solver would loop, adjust, and achieve nothing.

### Why this matters more than it first appears

The plan scopes Job 2 to non-anchor Tokens only (§1). But **anchors are the
majority**: of 15 produced items, 9 are single-source (their producer is an
anchor by definition) and 6 are multi-source (one anchor plus 8 non-anchors
between them). So roughly **15 of 23 production routes are anchors** — and under
this plan none of them is ever velocity-checked, while the 8 that are get a
lever policy the other 15 cannot use.

### What actually moves an anchor's GPH

Only three things, and the plan treats none of them as levers:

- **Charge count `C`** — authored, unbounded, and currently the dominant term.
- **Cycle time** — bounded to 10–30s, which the plan restricts to last resort.
- **Acquisition cost `A`** — a function of Map price and **pool weight**. Pool
  weight is authored and tunable, and is not in the plan's lever list at all.

A lever policy that ignores charges and pool weight is missing the two levers
that actually work on most of the content.

---

## 🔴 Blocking 2 — The value chain and the velocity targets differ by ~8,000×

Same Grove, same formula:

```
acquisition cost      2.45 g
charges               5000
lifetime output       10,000 Oak Wood
=> Oak Wood value     0.000245 g each
=> implied GPH        0.15 g/hr
   target GPH (lvl 1) 1200 g/hr
   ratio              1 : 8168
```

The design intent is documented and contradicts this directly.
`mapRegistry.js` records the Woodland price as *"calibrated against roughly
1,200 g/hr for one hero on an Oakwood Grove selling raw output."* For that to
hold, Oak Wood must be worth about **2 g**, not 0.000245 g.

### The tension is structural, not a tuning error

- A Map costs **200 g** and bursts into 3–6 things.
- One of those things is a Grove that will produce **10,000 Oak Wood**.
- If Oak Wood is worth 2 g, that single Grove is worth **20,000 g** of output
  from a 200 g Map.

So a Map returns something like 100× its price in usable value. That may be
entirely intended — CMS-15 and CMS-49 do say a pool should sell for *less* than
the Map price but be worth *more* when used. But CMS-49 frames usage value as
`base × usage ratio` with a modest ratio, and the real ratio implied here is in
the thousands. That is not a dial setting; it is a different derivation.

### Three ways out, and the plan should pick one explicitly

1. **The velocity targets are wrong.** `gphTargets` (1200 → 1400 → 10,000 →
   176,000) lives in `DEFAULT_GLOBALS`, which I flagged during Phase 0 as
   card-era leftovers. If they were tuned for the retired game, Job 2 is
   currently solving against a meaningless target and the numbers should be
   re-derived from the playmat economy.
2. **Charge counts are the anchor problem.** 5000 charges is ~16 hours of
   unattended runtime (D-176's AFK story), which is deliberate. But it makes
   per-unit acquisition cost vanishingly small. Deriving item value by dividing
   acquisition cost across lifetime output may simply be the wrong chain when
   lifetimes are that long.
3. **Sell value and usage value need separate derivations**, not one base times
   a ratio. Given CMS-103 explicitly says the sell side barely matters, the
   honest move may be to derive **usage** value from the velocity targets
   directly and let sell value fall out as a small fraction — inverting the
   direction CMS-44 currently specifies.

⚠️ Option 3 would amend CMS-44/49, so it needs the owner, not just an
implementation decision.

---

## 🟠 Significant

### 3. Enemies have no time dimension, so there is no GPH target to solve against

The plan puts enemies under "Velocity Alignment" and says *"cycle time ignored
(CMS-51)"* while still tuning toward a velocity band. But GPH is
value-per-**time**; remove time and the target is undefined.

CMS-51 is explicit that the enemy check is **total lifetime loot value versus
acquisition cost** — a *value* check, not a velocity one. Enemies need a
different objective function, not the same one with a term deleted.

### 4. CMS-49's usage value is missing entirely

The plan computes only `SellRatio` (§1.1). There is no usage-value derivation
anywhere, yet CMS-103 states plainly that the usage side is the one that matters
and the sell side is near-cosmetic. As written, the engine would compute the
unimportant half precisely and the important half not at all.

### 5. CMS-105's multi-output split is not in the formula

`Value = A / (charges × avgQuantity × dropChance)` assumes one output. The Trout
Stream yields **Fish and Raw Shrimp** from one charge, and CMS-105 settled that
the cost splits between them **with rarity as a factor**. The plan's formula
would assign the full charge cost to each output independently, double-counting
the Token's value.

This is also the only place in shipped content where `chance < 100%` appears
(Raw Shrimp at 60%) — so the one Token that exercises the plan's chance branch is
also the one its formula mishandles.

### 6. Snapping inside an iterative loop can oscillate

The plan combines value snapping (10% → 5% → 1%) with an outer relaxation loop
that feeds solver output back into the anchor (the mermaid diagram's
`VelocityCheck → MapAnchor` edge, required by CMS-108's material costs).

A fixed-point iteration over a **step function** is not guaranteed to converge —
it can settle into a two-state limit cycle where each pass flips a chance
between 45% and 50% forever. The plan specifies a convergence threshold
(`Δ < 0.01g`) but no iteration cap and no oscillation detection on the outer
loop. The old `runSimulation.js` capped at 10 iterations and broke early on
"no changes"; that guard should survive.

### 7. Using min/max ranges as a solver lever collides with CMS-41

CMS-41 introduced quantity ranges as an **authored feel** feature — "2–4 Oak
Wood" exists so a completion is worth watching. The plan authorises the solver to
rewrite ranges freely to hit expected-value targets (CMS-110).

Nothing stops it flattening an authored 1–5 range to 3–3 because that hits the
number, silently destroying the variance the author wanted. If ranges are a
solver lever, the plan needs a rule protecting authored spread — for example,
move the range's midpoint but preserve its width.

---

## 🟡 Smaller

### 8. The Resource policy branches on an authoring accident

"If authored with Chance < 100% → tune Chance; if 100% → tune Quantity" makes
solver behaviour depend on how the Token happened to be written, and is
discontinuous: 100% and 99% get different treatment. It is also nearly dead in
practice — **exactly one route in the entire game** is authored below 100%.

### 9. The CMS has no test infrastructure

The plan adds `cms/src/tests/tokenSolver.test.js` and runs
`npm test -- --grep ...`. But `cms/package.json` has only `dev`, `build`, `lint`
and `preview` — **no test script and no runner**. The root `npm test` runs vitest
over `src/tests`, not `cms/`. Also, vitest filters by name with `-t`, not
`--grep`.

Separately, the CMS deliberately has no automated suite — the standing
instruction is that verification there is manual click-through. Pure calculators
are a reasonable exception, but adding a runner to the CMS should be a conscious
decision recorded as such, not a side effect.

### 10. "~5% net margin scaling by level" is an unsourced constant

§1.4 introduces a specific balance figure that traces to no decision. CMS-15
already defines "production markup per step" as a tunable Global Value. It should
be a dial with an initial value, not a constant in the architecture.

### 11. The convergence check is trivially true

"Confirm that all 6 multi-source items converge to identical sell prices" — under
CMS-45 an item has exactly one value by construction, so this passes without
proving anything. The meaningful check is that each item's **non-anchor
producers** land inside the velocity band.

---

## What is good and should survive

- **The two-job split** (anchor/propagate, then solve) is the right decomposition.
- **The file layout** is clean, and `balanceRunner.js` as a single on-demand
  entry point matches CMS-16 well.
- **The restraint rules** (§ Invariants) are the strongest part of the document —
  no zero yields, a chance floor, hard D-164 bounds, refusal to fabricate values
  for unreachable items. An auto-correcting solver needs exactly this kind of
  explicit refusal list, and it is well judged.
- **Reusing `connectivityAuditor.js`** to surface refusals into the audit panel
  is the right reuse.
- **Locking crafting main outputs at 100% chance** is a good call — "crafting
  never fails to yield the main item" is a real design position, clearly stated.
- The plan correctly honours CMS-14, CMS-16, CMS-45, CMS-47, CMS-86 and CMS-104.

---

## Suggested order of resolution

1. **Settle Blocking 2 first** — whether the velocity targets or the value chain
   is wrong changes what the solver is even aiming at. This needs the owner.
2. **Then revisit the lever list** in light of Blocking 1: charges and pool
   weight belong in it, and the policy needs a branch for anchors versus
   non-anchors rather than by Token kind alone.
3. **Give enemies their own objective** (lifetime value vs acquisition cost).
4. Then the rest, which are ordinary implementation concerns.
