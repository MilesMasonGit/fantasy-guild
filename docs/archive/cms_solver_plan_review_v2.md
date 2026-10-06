# Review — CMS Balance Engine & Solver Architecture Plan v2

Reviewing [`cms_solver_plan_v2.md`](cms_solver_plan_v2.md). All numbers computed
from `data/tokens.json`, `data/maps.json` and `data/enemies.json`.

**Summary.** The core correction is right and important. Inverting the
derivation — item value comes *from* the velocity target rather than from Map
acquisition cost — dissolves both blocking issues in v1. An anchor Token's GPH is
now exactly its target **by construction**, so the levers no longer need to move
something they cannot move.

Four issues remain. Two are blocking, and one of them would turn the game's test
suite red.

---

## ✅ What v2 fixed

| v1 issue | Status |
| :--- | :--- |
| Quantity/chance algebraically inert for anchors | **Fixed.** Anchors are correct by construction; only non-anchors are solved. |
| Value chain and velocity targets ~8,000× apart | **Fixed.** Oakwood Grove now derives Oak Wood at exactly 2.0 g and 1200 g/hr, matching `mapRegistry.js`'s documented calibration. |
| Snapping could oscillate in the outer loop | **Fixed** (CMS-114: iteration cap + state hashing). |
| Ranges could destroy authored variance | **Fixed** (CMS-111: shift midpoint, preserve spread). |
| Enemies given a velocity target | **Partly fixed** — Stage 3 now has its own objective. See Blocking 2. |
| `--grep` / wrong test commands | **Fixed** for the game suite. |

---

## 🔴 Blocking 1 — "Cheapest path anchors" is actively harmful under the new model, and breaks D-116

### Each producer now derives a different value

Because value is a function of the producing Token's own cycle time and yield,
every producer of an item derives its own answer. Real content:

| Item | Producer | Level | Cycle | Qty | Derived value |
| :--- | :--- | ---: | ---: | ---: | ---: |
| **Oak Wood** | Heartwood | 1 | 10s | 8 | **0.42 g** |
| | Oakwood Grove | 1 | 12s | 2 | **2.00 g** |
| | Wind Trap | 0 | 30s | 1 | **10.00 g** |
| **Fish** | River Delta | 14 | 20s | 5 | 2.51 g |
| | Trout Stream | 1 | 14s | 1 | 4.67 g |
| **Glowcap** | Glowcap Hollow | 16 | 22s | 4 | 4.33 g |
| | Woodland Still | 1 | 18s | 1 | 6.00 g |

Oak Wood spans **24×** depending on which producer you ask.

### Why "cheapest" is now the wrong rule

§1.3 carries CMS-45 forward — *"multi-source items take the cheapest acquisition
path as their global sell value anchor."* Under v1 that meant "least gold to
obtain", which was sensible. Under v2 there is no acquisition cost in Stage 1;
the derived value is a measure of **how generous the Token is**. So "cheapest"
now selects **the most generous producer** — and here that is the **Heartwood**,
a Mythic that exists precisely to be exceptional (one copy ever placed, D-177).

Anchoring Oak Wood at the Heartwood's 0.42 g forces every other producer to be
solved upward to compensate:

- Oakwood Grove would sit at 252 g/hr against a 1200 g/hr target — it needs
  **~9.5 units per cycle** to recover, above the highest quantity in all shipped
  content (8).
- Wind Trap would sit at 50 g/hr — it needs **~24 units per cycle**.

Both would exceed the plan's own restraint rules and be refused, so most of the
Woodland economy becomes Critical audit errors on the first run.

### The part that breaks the build

**Wind Trap is a Passive Generator** (`requiresHero: false`). D-116 requires
passive generators to be **strictly worse per tile than the staffed equivalent**,
and `ContentRules.test.js` asserts it mechanically:

```js
expect(bestStaffed).toBeGreaterThan(passiveRate);
```

The solver's objective is to bring every non-anchor Token **to** the velocity
target. If it succeeds on Wind Trap, the passive equals the staffed Grove and
that assertion fails. **The solver's goal and a test-enforced content rule are
in direct conflict.**

Passive generators need to be excluded from velocity solving and given their own
rule — something like "solve to a fixed fraction of the staffed target" — or the
suite goes red the first time the solver runs.

### Suggested fix

Replace "cheapest path" with an **author-designated primary source**. There is
prior art: the old `valuePropagator.js` had exactly this — an `isPrimarySource`
flag on outputs, falling back to the first producer. That flag was dropped during
the rewrite and is worth reinstating, because under v2 the anchor choice is a
**design decision about which Token is representative**, not something derivable.

---

## 🔴 Blocking 2 — Stage 2's two charge formulas disagree by 157×, and Stage 3 has v1's cancellation problem

### Stage 2 contradicts itself

§2 offers two ways to set charges, with no rule for which applies:

```
Oakwood Grove — token slice 2.45 g, EV per cycle 4.00 g

Formula A (ROI-driven):   charges = lifetime value / EV per cycle
   at 10× usage multiplier  →     6 charges
   at 50× usage multiplier  →    31 charges

Formula B (AFK-driven):   charges = 16h × 3600 / cycle time
                          →  4800 charges   (authored value: 5000)
```

**157× apart.** Formula B matches the shipped content and D-176's AFK story
(*"5000 uses × 12s ≈ 16 hours… that is the number that matters for the AFK
story"*). Formula A does not survive contact with it.

And if Formula B wins, the implied lifetime ROI is **7,841×** — against the
plan's own proposed dial range of 10×–50×. The dial cannot express the answer.

**This is v1's blocking issue, relocated rather than resolved.** The underlying
truth is that a 200 g Map yielding ~16 hours of production *is* worth thousands
of times its price, and that is fine for an idle game — the gold sink works
through repeat purchasing and the progression price curve (D-96, D-99, D-166),
not through per-purchase ROI parity.

**Recommendation:** make the AFK target the *driver* of charges and demote ROI to
a **reported diagnostic** rather than a constraint. Trying to satisfy both will
either gut D-176's AFK design or produce a dial with no usable range.

### Stage 3 reintroduces the cancellation problem

Four items are obtainable **only** from enemy drops: `item_bones`, `item_beef`,
`hat_miners_helm`, `amulet_iron_chain`.

Stage 3's objective needs their values:

```
Σ (p_k × q_k × Value(Item_k))  =  TargetLootEV
```

But Stage 1 never values them — nothing produces them, so under CMS-86 they are
Critical audit errors, and every enemy becomes unsolvable.

The obvious fix — let the enemy anchor its own drops — recreates v1's exact
algebra. If `Value = TargetLootEV / (p·q)`, then `Σ p·q·Value = TargetLootEV`
identically, and tuning `p` or `q` changes nothing.

Stage 3 therefore needs the same treatment Stage 1 got: an **independent**
reference for enemy-only item values. `TargetLootEV` is also undefined — it is
given as `EncounterCost × CombatEVMultiplier`, but `EncounterCost` has no source
now that the combat model is deferred (CMS-2) and `mockBattle.js` is shelved.

---

## 🟠 Significant

### 3. The multi-output split needs a field that does not exist

§1.2 allocates value across outputs "based on authored weight / rarity factor
`w_i`". **Outputs have no weight field.** The schema is
`{ itemId, quantity | minQty/maxQty, chance }`.

CMS-105 settled that the split uses "rarity as a factor", which has to be derived
from what is authored — presumably scarcity, i.e. `1/(q·p)` — or a new field must
be added, which is a schema change with CMS editor impact. Either way it needs
stating. This is not academic: the Trout Stream is the only Token in the game
with multiple outputs *and* the only one with `chance < 100%`.

### 4. XP is never solved

`velocityCalculator.js` is described as "GPH/XPH target curves", and `xphTargets`
exists alongside `gphTargets`. But no stage solves XP. Tokens carry an authored
`xp` per cycle, CMS-10 names gold/XP-per-hour as a balance check, and pooled
recipes carry their own `xp` (CMS-70). Either XP is out of scope — which should
be said — or it needs a lever policy of its own, since `xp` is a free variable
with no D-164-style bound.

---

## 🟡 Smaller

### 5. The Resource branch still keys off an authoring accident

"Steady Metronome (Authored Chance = 100%)" versus "Probabilistic (< 100%)" still
makes solver behaviour depend on how a Token happened to be written, with a
discontinuity at 99%. In shipped content **exactly one output** is authored below
100% (Raw Shrimp at 60%), so the probabilistic branch is nearly dead on arrival.

Consider keying off something intentional — the Token's `tokenType`, or an
explicit authored flag — rather than the current value of the field being tuned.

### 6. The CMS still has no test runner

The verification plan specifies a unit suite for the pure calculators, but
`cms/package.json` has only `dev`, `build`, `lint`, `preview`. The root `npm test`
runs vitest over `src/tests`, not `cms/`. Adding a runner to the CMS is
reasonable for pure calculators, but it contradicts the standing "no automated
tests in the CMS" position and should be recorded as a decision rather than
appearing as a side effect.

*(The `ContentRules.test.js` command in v2 is correct and will work as written.)*

---

## What is good and should survive

- **The three-stage decomposition is the right model**, and matches the owner's
  framing precisely: per-cycle economics and lifetime capacity are genuinely
  different questions with different logic.
- **Deriving value from velocity** is the correct inversion, and it produces
  numbers that match the game's own documented calibration.
- **CMS-111's spread preservation** is a thoughtful fix — it protects authored
  feel from a solver that only sees expected value.
- **CMS-114's oscillation detection** correctly anticipates that snapping inside
  a fixed-point loop can limit-cycle.
- **The restraint and refusal rules** remain the strongest part of the document.
- Stage 3 being decoupled from time is the right reading of CMS-51.

---

## Suggested order

1. **Anchor selection** (Blocking 1) — reinstate an author-designated primary
   source, and carve passive generators out of velocity solving before they
   break `ContentRules`.
2. **Charges** (Blocking 2, first half) — decide that AFK duration drives
   charges and ROI is a diagnostic, or the two formulas will keep fighting.
3. **Enemy-only item values** (Blocking 2, second half) — needs an independent
   reference, and `EncounterCost` needs a definition that survives CMS-2.
4. Then the multi-output weight field, XP scope, and the smaller items.
