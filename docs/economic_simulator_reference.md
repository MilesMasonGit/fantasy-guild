# The Economic Simulator — reference

> **Status:** shipped, `v0.6.0` (2026-09-01). This describes what exists, not
> what was planned. The design is
> [`economic_simulator_plan_v1.md`](economic_simulator_plan_v1.md); the build
> history is [`economic_simulator_roadmap_v1.md`](economic_simulator_roadmap_v1.md),
> whose phase table records every deviation and every ruling made along the way.
> Where this document and the code disagree, **the code is right and this is
> stale** — say so and fix it.

---

## 1. What it is, in one paragraph

The CMS's **Recalculate** button derives the game's whole economy from a handful
of authored tags. You tell it *what a Token is for*; it works out what
everything is worth. It writes cycle times, item values, output quantities and
chances, XP, pool weights and Token scrap values — and where it cannot make
something work, it refuses and tells you which tag or dial to change.

## 2. The idea that makes it work

The economy is derived by **one assembly line, run left to right, on demand**.
Every pass reads only what earlier passes have settled.

```
1. TIME     Pick every cycle time from its Tempo band.        (needs no values)
2. ANCHOR   Elect exactly one anchor source per item.         (needs no values)
3. PRICE    Walk the chain bottom-up: anchors set item values,
            crafted items price as inputs + purpose profit.   (each value set once)
4. TUNE     Every non-anchor source is nudged into band by one
            lever, or refused with a remedy.
5. MAP      Pool weights, scrap values, the two-sided check.
6. XP       Derived from cycle time and Purpose.
7. CHECK    Progression guard, charge-lifetime outliers.
            Nothing changes here — failures become refusals.
```

**There is no loop.** Steps 1 and 2 do not depend on any value, and step 3 sets
each item's value exactly once, reading only values already set. Nothing
downstream feeds anything upstream.

That is the whole design. The engine this replaced iterated until numbers
stopped moving, which is where its oscillation problems came from. **If you ever
find yourself adding a loop that re-runs until stable, you are rebuilding the
thing this replaced.**

Two consequences worth holding onto:

* **Re-running changes nothing.** The sim never reads its own previous output
  (with exactly one deliberate exception — see *stickiness* below), so pressing
  Recalculate twice is a no-op. There are tests pinning this.
* **Value absorbs yield.** Changing an anchor's yield changes *the item's price*,
  not the Token's earnings. This inverts most designers' instinct and it is the
  single most important thing to understand before authoring.

## 3. The vocabulary you author

Four tags, on Tokens and Recipes. Everything else is derived.

| Tag | Values | What it means |
| :--- | :--- | :--- |
| **Tempo** | fast / medium / slow / heavy | How long a cycle takes. Resolves to a band, and the sim picks the middle. |
| **Purpose** | gph / iph / xph | What the thing is *for*. Sets both the gold target and the XP rate. |
| **Rarity** | common → uncommon → rare → epic → mythic | Drop weight in Map pools, and the scrap premium. |
| **Anchor** *(per output)* | flag | "This source sets this item's value." Overrides the default election. |

Plus **`downcycle`** on a recipe (a return leg — breaks things back into
ingredients), and per-output **intent**: `baseQty {min,max}`, `variable`,
`baseChance`.

### The Purpose seesaw

Purpose is the only per-Token pay lever, and it moves gold and XP in opposite
directions:

| Purpose | Gold factor | XP factor | Reads as |
| :--- | :--- | :--- | :--- |
| `gph` | 1.0 | 0.3 | Earning is the point. Pays well, teaches little. |
| `iph` | 0.35 | 0.5 | Feeds chains. Cheap output, high volume. |
| `xph` | 0.10 | 1.0 | Trains fast, pays a trickle. |

No conflict between gold and XP targets is possible, because **XP is derived,
never targeted independently**.

### Intent vs derived — the distinction the whole schema rests on

| You author (intent) | The sim writes (derived) |
| :--- | :--- |
| `sim.tempo`, `sim.purpose` | `config.cycleTimeMs`, `durationMs` |
| `baseQty {min,max}`, `variable`, `baseChance` | `minQty`, `maxQty`, `chance` |
| `anchor`, `downcycle` | item `value`, `valueSource` |
| `uses` (charges), skill, level, Map price/materials/pool | `config.xp`, recipe `xp` |
| rarity | pool entry `weight`, Token `scrapValue` |

⚠️ **The game reads only derived fields.** The sim reads only intent. If those
two ever diverge without a recorded tuning move behind it, a test fails — that
is the drift alarm in `EconSimTime.test.js`.

---

## 4. The code

All under `cms/src/engine/sim/`. Every pass is a pure function: no store access,
no file writes, no mutation of its inputs.

| File | Lines | What it does |
| :--- | ---: | :--- |
| `fieldAdapter.js` | 258 | **Read this first.** Normalises Tokens and Recipes into one shape at the edge, so no pass ever branches on entity kind for a field name. Tokens speak `config.skill`/`config.skillRequired`/`config.outputs`; recipes speak `skill`/`levelRequirement`/`outputs`. Also `liveCharges(def)` = `def.uses ?? null`. |
| `dials.js` | 350 | Every curve, factor, band and weight, with the plan section each came from. Pure defaults; the developer's turned copy lives in `useGlobalStore.simDials`. |
| `rows.js` | 67 | The audit-row shape (severity, code, what, why, remedies) and a stable sort. The sort is what makes two runs byte-identical. |
| `refusals.js` | 232 | The refusal catalogue as structured cards. Every remedy names a tag or a dial, never a raw number — there is a test enforcing that. |
| `tempoPass.js` | 179 | **Pass 1.** Cycle time = middle of the Tempo band at the entity's level, whole seconds. Units/hour. The untagged rule and the structural skip. |
| `anchorPass.js` | 271 | **Pass 2.** Elects one source per item: lowest level, ties to commoner rarity, then Token before Recipe. Explicit flag overrides. Stickiness. |
| `pricingPass.js` | 476 | **Pass 3.** Topological walk, root items first. Integer choice, multi-output splits, craft-margin floor, cycle refusal, downcycle cap. |
| `tuningPass.js` | 600 | **Pass 4.** The lever policy — one legible lever at a time, or refuse. |
| `mapPass.js` | 516 | **Pass 5.** Derived pool weights, aggregate-first scrap allocation, the two-sided Map check. |
| `xpPass.js` | 321 | **Pass 6.** XP per cycle, the mastery integration, day-in-reach projections. |
| `checkPass.js` | 257 | **Pass 7.** The progression guard and hours-first charge outliers. Derives nothing. |
| `simRunner.js` | 161 | Orchestrates all seven. Returns everything, writes nothing. |
| `writeBack.js` | 430 | The only thing that mutates. Turns results into today's field shapes, **strips retired fields on every run**, and migrates legacy flags *before* the passes run. |
| `churn.js` | 133 | What moved since last time: values changed, largest movers, refusals new and cleared. |
| `answers.js` | 151 | Per-entity "the sim answered" records, and the fingerprint driving the stale badge. |
| `chain.js` | 195 | An item's derivation as a sentence trail. Re-reads pricing details; recomputes no economics. |
| `dryRun.mjs` | 160 | A readable report over `data/`. ⚠️ **Does not run under plain `node`** — its import chain needs Vite. Use a scratch vitest file instead. |

### The one place that mutates

`writeBack.js` is deliberately the only writer, and it does three jobs:

1. **Migrates legacy intent before the passes run** — `isPrimarySource` → the
   `anchor` flag, and re-derives `tokenType`. ⚠️ Both must happen *before*, not
   after: the anchor pass reads them on the way in, and deriving on the way out
   only made the first run disagree with the second.
2. **Writes derived values** into the shapes the game already reads.
3. **Strips retired fields on every run** — so a stale browser workspace heals
   on its first Recalculate instead of resurrecting dead fields through Sync.

---

## 5. Where it plugs into the CMS

| Surface | File | Shows |
| :--- | :--- | :--- |
| Tempo / Purpose / downcycle controls | `shared/SimIntentControls.jsx` | The tags you author, on both editors |
| "The sim answered" panel | `shared/SimAnswer.jsx` | Cycle in band, anchor badge, tuning diff, earn gauge, lifetime line, inline refusals, stale badge |
| Chain inspector | `shared/ChainInspector.jsx` | An item's derivation as a sentence trail, in the Item editor |
| Anchor re-elect / dismiss | `shared/AnchorElections.jsx` | On the Economy Audit tab |
| Pace dials | `shared/PaceDials.jsx` | Both curves' pins, hours/day, what they integrate to |
| All other dials | `shared/SettingsModal.jsx` | Map check dials, purpose factors, tolerance |
| Audit + churn + Map table | `audit/AuditPanel.jsx` | Refusal cards, churn report, Map economics, day-in-reach |

Entry point: `useEntityStore.recalculateEconomy(globals)`. It adapts, runs
`simRunner`, writes back, re-derives token types and descriptions, runs
`auditConnectivity`, and publishes through `useSimulationStore.setAuditResults`.

⚠️ **`recalculateEconomy` is safe. `Sync` writes `data/` from the CMS store** —
so whatever is loaded in the browser becomes your content on disk. Loading the
wrong workspace and syncing has destroyed content in this project once.

---

## 6. Reading a refusal

Every card has three parts, and passes one test: *a designer who reads no
formulas knows which tag or dial to change next.*

```
Grapevine can't reach its earnings band.
  It earns 724g an hour, and a level 1 item source should earn about 420g.
  It inherits grapes at 1g, so it earns 1.72x too much, and neither its
  quantity range, its drop chance nor its cycle inside the fast band
  closes that.
  → Tag it a slower Tempo — a longer cycle is the one lever with real travel left.
  → Re-author the output's quantity range.
  → Flag a different source as this item's anchor.
  → Widen the non-anchor band dial, if this shape is common rather than a one-off.
```

**Severities:** Critical = unpriceable content. Warning = in-game but off-target.
Info = the sim exercised judgment you may want to see.

---

## 7. Things that will look like bugs and are not

* **A source can earn outside its band and still be fine.** Non-anchors get a
  band twice as wide, and the band judges the source's *total* profit/hour, not
  each output.
* **An item priced at 1g with a residual note** is the integer problem. Below
  about 2g there is often no whole number inside the band. The lever policy
  widens the yield until the price has somewhere to land.
* **Level-1 content over-teaches.** The minimum-1-XP rule means a fast level-1
  Token pays more XP/hour than its target. Accepted by the design (F8); it files
  an Info row.
* **The multi-output split compounds twice.** An output ten times scarcer is
  worth a hundred times more per unit, not ten. That is the inherited arithmetic
  and it is intentional — but it is steeper than it sounds.
* **A Token in several pools takes the highest scrap slice it earns anywhere.**
* **The XP curve does not flatten at 70 the way gold does**, so late-game XP
  numbers get very large. Accepted: XP is display, not economy.
* **The progression guard only checks the compounding stretch.** Above level 72
  the gold curve deliberately flattens, so band ordering breaks by construction.

## 8. Known gaps

* **Fixture-proven only** — enemy, gold and raw-item pool entries. No shipped
  pool contains one, and the Map editor offers `token`/`item` only. `Cartographer`
  will spawn a bogus item sprite for an unknown entry kind.
* **The re-elect button has never been clicked against real content.** All priced
  items' stored elections currently agree with the rule, so the row does not
  appear. The write path under it is proven by tests.
* **`useEntityStore` never passes `enemies` to `auditConnectivity`** — latent
  false Critical, waiting for the first item that only drops from a fight.
* **`dryRun.mjs` needs a Vite runner.**

## 9. Tests

~4,400 lines across 13 files, all under `src/tests/` — the CMS has no runner of
its own, so CMS engine code is tested across the project boundary.

`EconSimTime` · `EconSimTempo` · `EconSimAnchor` · `EconSimPricing` ·
`EconSimLevers` · `EconSimMaps` · `EconSimXP` · `EconSimGuards` ·
`EconSimRunner` · `EconSimAdversarial` · `CMSEconomyCutover` ·
`CMSConnectivityAudit` · `CMSSimIntentSeeding`

**`EconSimAdversarial.test.js` is the one to run first if you break something.**
It puts nine broken shapes in one workspace — a recipe cycle, an orphan item, a
token-output recipe, a downcycle chain, a deferred-only item, an untagged token,
an extreme-tag token, a token-less Map pool, an item-and-gold-heavy pool — and
runs the whole pipeline over them at once, asserting it terminates, refuses each
correctly, and stays idempotent. Both defects found in the final phase surfaced
only because those cases were combined rather than tested one at a time.

### ⚠️ The house rule for tests here

**Never name a shipped token, item, recipe or map id in a test.** The owner
authors content continuously, and tests that named content have broken a dozen
times while nothing was actually wrong. Assert the *rule* against whatever
content exists; use fixtures for specific shapes.
