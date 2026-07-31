# Area Deck Rework — Implementation Roadmap (v1)

The authoritative build plan for the design locked in
[`area_deck_rework_concept_v3.md`](area_deck_rework_concept_v3.md) (decisions **D-1 … D-40**).

> **This doc is the plan; the concept doc is the *why*.** Where they disagree, the concept
> doc wins on intent and this doc wins on sequencing. Neither re-opens a locked decision.

---

## 0. How to use this document

**For the owner (plain language).** The work is broken into **18 components**, each a
self-contained chunk that can be built, checked and committed on its own. They are
grouped into **7 layers** only to express *ordering* — "you can't split the Outpost banner
before you've decided what a banner is." Within a layer, components are largely
independent.

Each component says four things:

* **Reuse** — existing code that already does this, or nearly does.
* **Change** — existing code that gets modified.
* **New** — code that doesn't exist yet.
* **Delete** — code that this design retires.

**Branch plan.** Today we're on `cms-rework`. The sequence:

1. Finish and merge the CMS rework to `main` (it's a prerequisite — see C-0).
2. Tag `main` as a rollback baseline (e.g. `v0.4.0`) *before* any rework code lands.
3. Create a long-lived branch `area-deck-rework` off `main`.
4. Build components in layer order, **one commit per component**, so any single piece can
   be rolled back without losing the others.
5. Merge back to `main` when the whole thing is verified end to end.

**Reuse verdict up front.** This rework is far less destructive than it first looks. The
loop engine, the slot-management API, the ranked guild-upgrade system, the modifier
aggregator, the status-effect engine and the save/migration machinery are all
**structurally correct already** — most components are *re-pointing* existing systems
rather than replacing them. The genuine rewrites are the Outpost banner split (C-10) and
the hero inventory grid (C-7). Details are called out per component.

---

## 1. Implementation Status

| # | Component | Layer | Size | Verdict | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| C-0 | CMS rework + authoring pipeline | 0 Prereq | — | External | ✅ Done 2026-07-31 — paused at Phase 4, merged, tagged `v0.4.1` |
| C-1 | Area slot model → fixed 4 identical | 1 Data | S | Mostly delete | ✅ Done — 4 slots enforced in code, all slot types retired, CMS editor replaced |
| C-2 | Per-area binders (card ownership) | 1 Data | M | Reshape existing | ✅ Done — `BinderManager` owns the shape; Single-Copy Rule reversed |
| C-2b | Area binder UI (pips, silhouettes, on-banner) | 1 Data | M | Replace UI | ✅ Done — binder on the banner, three-state pips, pack button |
| C-2c | The Universal Bucket | 1 Data | M | New, reuses allocations | ⬜ Not started |
| C-3 | Composable card effects & schema | 1 Data | L | **New abstraction** | 🟡 Slices 1–2 done — registry + engine wiring; all `cardType` branches gone from LoopRunner. Next: CMS effect editor |
| C-4 | Buff effects & sequencing | 2 Loop | M | New logic, existing hooks | ⬜ Not started |
| C-5 | Hazard Task cards | 2 Loop | S | Re-home existing | ⬜ Not started |
| C-6 | Prep Phase & loop structure | 2 Loop | M | Extend LoopRunner | ⬜ Not started |
| C-7 | Hero 9-slot flexible grid | 3 Hero | L | **Rewrite** | ⬜ Not started |
| C-8 | Consumption engine (25% rule) | 3 Hero | M | Extend existing | ⬜ Not started |
| C-9 | Defeat penalties rework | 3 Hero | S | Re-point existing | ⬜ Not started |
| C-10 | Outpost banner split | 4 Outpost | L | **Rewrite** | ⬜ Not started |
| C-11 | Global aura system | 4 Outpost | S | Extend existing | ⬜ Not started |
| C-12 | Guild tree Outpost cards | 4 Outpost | M | Extend existing | ⬜ Not started |
| C-13 | Crafting upkeep | 4 Outpost | S | Re-point existing | ⬜ Not started |
| C-14 | Per-area pack economy | 5 Economy | M | Reshape existing | ⬜ Not started |
| C-15 | Exponential scaling & big numbers | 5 Economy | M | New | ⬜ Not started |
| C-16 | Two-area vertical slice & content | 5 Economy | L | Content work | ⬜ Not started |
| C-19 | Binder Mastery (completion reward) | 5 Economy | S | Rewrite dormant system | ⬜ Not started |
| C-17 | Retirement sweep | 6 Cleanup | M | Delete | ⬜ Not started |
| C-18 | Test baseline restoration | 6 Cleanup | M | Update | ⬜ Not started |

*Size:* S ≈ one short session · M ≈ one full session · L ≈ two or more.

---

## Layer 0 — Prerequisite

### C-0 — CMS rework & authoring pipeline

**Goal:** land the in-flight CMS rework before this one starts.

**Why it blocks:** almost every component in Layer 1 changes the *shape of authored card
data* — slot types, card ownership by area, boost archetypes, hazard payloads. Doing that
while the CMS's own data model is mid-rework means authoring the same schema twice. The
CMS is also the tool used to *create* the area content that C-16 depends on.

**Action:** finish `cms-rework`, merge to `main`, tag a baseline. Then start here.

> ⚠ Known hazard carried over from the CMS work: **"Sync to Game" destroys unmodelled
> content until CMS Phase 3 is done.** Confirm that's resolved before authoring rework data.

---

## Layer 1 — Data & Schema Foundations

### C-1 — Area slot model → fixed 4 identical slots

*Implements D-1, D-2.*

| | |
| :--- | :--- |
| **Reuse** | `AreaStateManager.buildDeckSlotsForArea()` already builds slots from area data — it just needs a simpler input. `DeckSlotManager` slot/unslot/swap API is unchanged. |
| **Change** | `data/cards/area/areas.json` — all four areas currently author **4–6 slots** with mixed `slotType` values (`regular` / `specialized` + `specializedTags` / `locked` + `hazard`). Collapse every area to exactly 4 plain slots. `DeckSlotManager.getAvailableCardsForSlot()` drops its tag-gating branch. |
| **New** | Nothing. |
| **Delete** | The `specialized` / `locked` slot-type branches wherever they're honoured; the `specializedTags` and per-slot `hazard` fields in area data; the CMS editor UI for authoring slot types. |
| **Depends on** | C-0. |
| **Verify** | Every unlocked area shows exactly 4 slots, all accepting any owned area card. `DeckSlotRules.test.js` updated and green. |
| **Risk** | Low. This is mostly subtraction. Note the per-slot `hazard` payloads being deleted here are *re-homed* by C-5 — don't lose the tuning values (`bleed`, `damagePerPass: 4`, `tickTime: 2000`) when deleting. |

**As built.** The count is enforced in **code**, not trusted from data: `buildDeckSlotsForArea`
now always emits `DECK_SLOT_COUNT` (4) slots, taking authored `templateId`s for the first four
and ignoring the rest. An area authored with three or six slots still plays correctly, so the
invariant cannot drift. A slot is now just `{ templateId, progress, status }` — `slotType`,
`specializedTags`, `isLocked` and `hazard` are all gone.

Touched beyond the roadmap's prediction:

* **`MutatorStamping`** — the "skip hazard slots" rule went with them; only empty slots are
  skipped now.
* **`StateSchema`** — the `slotType` must-be-a-string validation is retired.
* **UI** — `RowHazardCard` deleted, and the hazard/locked branches removed from
  `bannerCenters`, `bannerFocus`, `bannerCards` and `DeploymentPanel`. The **hazard badge
  survives**, re-pointed at cards carrying a `hazard` effect (D-8).
* **CMS `AreaEditor`** — the whole `DeckSlotsEditor` (slot-type dropdown, tag input, hazard
  fields, add/remove/reorder) replaced with a fixed four-row **starter deck** picker. This is
  the work CMS Phase 7 would have expanded on; cancelling it was right.

**Data note:** Sunken Bog was pre-slotting `task_rocky_outcrop`, a **Misty Mountains** card
(the duplicate id resolved in 179b938 kept the Misty Mountains definition). Under D-3 cards are
area-exclusive, so that starter entry was dropped. Sunken Bog and Whispering Woods now start
with four empty slots and no cards of their own — a content gap for C-16, not a bug.

---

### C-2 — Per-area binders (card ownership)

*Implements D-3, D-6, D-9, D-13, D-43, D-47.*

**The single most important structural change in the whole rework.** Ownership moves from
one global pile to per-area binders. Note this is *ownership logic only* — the binder **UI**
is C-2b and the **Universal Bucket** is C-2c, deliberately split out.

| | |
| :--- | :--- |
| **Reuse** | **`collection.playsets` is already `{templateId: count 0-4}`** — the copy-limited slotting of D-9 and the 4-copy cap of D-13 are *already the shape of the data*. `collection.unlockedAreaSets` already exists. `DeckSlotManager.getAllocations()` already counts copies allocated across slots — exactly the "own N to slot N" check, and it's reused wholesale by C-2c. |
| **Change** | Re-key ownership from `playsets[templateId]` to per-area binders — `playsets[areaId][templateId]`. Every read site follows (`DeckSlotManager`, `CollectionManager`, `binderCatalog.js`). `getAvailableCardsForSlot()` filters to the banner's own area binder. Guild Hall becomes an ordinary 4-slot area with its own binder (D-47), its current cards forming its pool (D-50). |
| **New** | Binder-completion state per area (all cards at 4 → pool empty → packs unsold). |
| **Delete** | **`DeckSlotManager.moveCardBetweenAreas()`** — cards are permanently bound to their area (D-43), so cross-area movement becomes illegal by design. |
| **Depends on** | C-0, C-1. |
| **Verify** | Owning 3 copies allows 3 slots and refuses a 4th. The same Boost owned in two areas works in both, independently. A maxed card disappears from its area's pool. No path exists to move a card between areas. |
| **Risk** | Medium. The ownership re-key touches every read site, so grep `playsets` exhaustively before starting. **No save migration is needed** — old saves are refused outright (see §3), so this component only has to be correct for new games. |

**As built.** Ownership moved behind a new **`BinderManager`** rather than re-keying `playsets`
inline everywhere. That matters because the shape changes twice more — the Universal Bucket
takes universals out (C-2c) and the guild tree takes Outpost cards out (C-12) — so routing
every reader through one API makes those edits local instead of another codebase sweep.

**Routing rule:** a card with a home area → `collection.binders[areaId][templateId]`; anything
else → the legacy global `collection.playsets`. Stations are the only remaining global users
and keep working untouched until C-12 (D-64) removes their `areaId`.

> ⚠ **The find that wasn't in the plan: the Single-Copy Rule.** `DeckSlotManager` enforced
> *"max 1 copy of a template per area deck"* — which **directly contradicts D-9's 4× farm
> loop**, the headline strategy of the whole rework. It is now removed: you may stack a card
> as many times as you own copies. This was load-bearing enough that it would have blocked
> Strategy 1 entirely, and nothing in the roadmap flagged it.

Also corrected during the build: `reconcileOwnership` initially fell back to the *containing*
area for cards with no home area, while `getOwned` routed those to the global map — the two
disagreed, so a card could be granted somewhere reads never looked. Both now route identically.

**Consequences for later components:** `getAllocations` no longer scans all areas for an
area-scoped card (D-43 makes that impossible), `moveCardBetweenAreas` is deleted, and
`buildCardCatalog` gained a **compatibility view** that unions every unlocked binder so the
existing global card UI keeps working until C-2b replaces it with the per-area binder page.

---

### C-2b — Area binder UI

*Implements D-41, D-42, D-44, D-45, D-48, D-49.*

Split from C-2 because it's a **UI replacement**, not an ownership change — different skills,
different risk, different commit.

| | |
| :--- | :--- |
| **Reuse** | `binderCatalog.js` (`buildCardCatalog`, `DEPLOYMENT_FILTERS`) already computes owned-vs-deployed per card — that *is* the pip data. `ActiveCardFace` at the sm/128 tier already renders half-size card faces. Silhouette rendering for unowned cards already existed in the old `CollectionBinderModal`. The dnd-kit drag system stays. |
| **Change** | The binder moves **onto the area banner** beside its 4 deck slots (D-42), replacing the global drawer flow. Drag distance collapses from "across the UI" to "within one banner". The pack **buy button moves here too** (D-48). |
| **New** | **The four-pip indicator (D-45):** ○ empty = not collected, ● full = owned and free, ⬤ coloured = currently slotted. Pip count equals the card's actual maximum, so uniques show **one** pip (D-49) — the component must render a variable-width pip row. Locked silhouettes for the unowned remainder of the pool (D-44), with an "X of Y collected" counter. |
| **Delete** | **`BinderTabManager.js`** entirely, `collection.binder` state (`tabOrder`, `tabDefs`, `cardOverrides`, `maxTabs`), the Guild Hall "binder tabs" upgrade node, and the drawer's `CardsTab.jsx` (338 lines) — all of it exists to organise a global pile that no longer exists (D-41). |
| **Depends on** | C-2. |
| **Verify** | Opening an area shows its 4 slots, its binder page, its pool progress and its buy button together. Pips update live as cards are slotted. A unique Boost shows one pip. No global card view remains. |
| **Risk** | Medium. Mostly deletion plus one new indicator component. The pip widget is the piece worth getting right first — it carries three meanings at once and appears on every card. |

**As built.** `CardPips` + `AreaBinder` render inside the existing deck focus view, so the
binder sits directly beside the four slots it feeds. `FocusScaffold` gained a `headerRight`
slot for the completion counter and pack button.

> ⚠ **Root-cause bug found here, pre-dating the rework.** Card JSON declares its home region
> as **`areaId`**, but `cardRegistry` exposes it as **`areaSet`** and defaulted it to `null` —
> the two names were never reconciled, so **`getCardsByAreaSet` had been returning nothing for
> every task card**. Per-area pools made it visible. Normalised in `processJsonCard`; this also
> fixes area-name sorting in the collection views, which had been silently blank.

**A second bug, mine:** `BinderManager` granted copies of *unknown* template ids straight into
the global map (unknown → no home area → global, capped at the default 4). Found by fat-fingering
a card id during live testing. Now refused with a warning, with a regression test.

**Also required, beyond the roadmap's list:** `CardsTab` exported `CardInspection`, used by the
shared `InspectionPanel`, so it was extracted to its own file before deletion. And the station
slot's only card source was that pane — stations are still globally owned until C-12 — so the
drawer's Cards pane became a small **Stations** pane rather than disappearing. That pane is
explicitly temporary and retires with C-10/C-12.

**Deferred to C-2c:** the binder currently shows *every* card in an area's pool. Universals are
excluded by D-46 but have no separate home until the Universal Bucket exists.

---

### C-2c — The Universal Bucket

*Implements D-46, D-51, D-52, D-53.*

The one deliberate survival of the global-pile model, and it needs its own component
because it spans *all* banners.

| | |
| :--- | :--- |
| **Reuse** | **`DeckSlotManager.getAllocations(templateId)` already spans every area's slots** — global allocation tracking is the exact behaviour the bucket needs, and it already exists. `GuildUpgradeManager`'s ranked nodes supply copies (D-51), the same mechanism as C-12. |
| **Change** | Universals are excluded from every area binder and every pack pool. Slotting one consumes a global copy; unslotting returns it. |
| **New** | A **side panel beside the banner list that scrolls independently** (D-53), showing each universal with global availability ("Campfire: 1 free of 4"). Cap of 4 copies (D-52), rendered with the same four-pip widget from C-2b. |
| **Delete** | Nothing. |
| **Depends on** | C-2b (shares the pip component), C-12 (shares the ranked-node mechanism). |
| **Verify** | Four Campfires can go all into one area or one each into four. Slotting in area A reduces the free count shown on area B's view. Copies survive reload. |
| **Risk** | Medium — two specific traps. **(1) Layout:** D-53's side panel competes for horizontal space with the always-visible inspection column added in the UI overhaul; resolve that before building. **(2) Sync:** the same bucket renders next to every banner, so free-copy counts must update everywhere at once. The Phase 7 lesson applies — shallow subscriptions won't re-render on in-place mutation. |

---

### C-3 — Composable card effects & schema

*Implements D-8, D-10, D-60, D-61.* **Upgraded from "add some fields" to "build an effect system" by D-60.**

> **The architectural constraint (D-60):** a card carries a **list of effects**, and any card may
> carry any combination — work output, aura buff, next-card buff, hazard, heal. A Task card
> that yields resources *and* buffs later cards is a first-class target. **The engine must never
> branch on card type to decide capability.** This is the card-side twin of D-54.

| | |
| :--- | :--- |
| **Reuse** | The card template registry, `CardValidator`, and `data/schemas/task-card.schema.json` as the pattern. ⚠ **Correction after reading the code:** `TraitRegistry` mostly generates **UI** descriptors and *is* type-branched (`generateTaskTraits`, `generateCombatTraits`…). But the **dispatch** in `LoopRunner` is already trait-keyed — `card.traits.find(t => t.type === 'workcycle')` → `completeWorkCycle` — and **Mutator cards already are the D-60 hybrid**: an ordinary card that takes normal Work Time *and* stamps a token, no-oping when the trait is absent. So this component formalises an existing, proven pattern rather than inventing one. |
| **Change** | `cardType` demotes from a **capability discriminator** to a **label** used only for pack pools and display. Effect resolution keys off the effect list instead. |
| **New** | An **effect registry** (id, payload shape, resolver) so a new effect kind is authoring plus one resolver, never an engine rewrite. Schema fields: **home area** (one, or `universal`), **`maxCopies`** (authored per card, D-61 — drives the pip count in C-2b), and the **effect list**. CMS needs an effect-list editor. |
| **Delete** | Type-branching wherever it decides what a card can *do* — specifically `template.cardType === 'consumable'` in `_completeActiveSlot` and the `slot.hazard` branch in `_activateSlot`. |
| **Depends on** | C-0. Runs in parallel with C-2. |
| **Verify** | Author a hybrid card that yields ore **and** buffs the next card, with no engine change. Author a unique hybrid (`maxCopies: 1`) and a four-copy buff card — both work. |
| **Risk** | **Medium-high, and raised by D-60.** This is now a foundational abstraction that C-4, C-5 and every future card depends on. Getting the effect payload shape wrong is expensive to unwind later, so design it against three or four concrete example cards — including the hybrid — before writing the registry. |

**Slice plan.** *(1)* ✅ Registry, legacy bridge, derived type, tests — pure, no engine
changes (0ef32a5). *(2)* ✅ Engine wiring — `LoopRunner` dispatches through the registry and
**every `cardType` branch is gone** (there turned out to be four, not two). *(3)* CMS
effect-list editor + `maxCopies` field.

**Slice 2 detail — the four branches removed from `LoopRunner`:**

| Was | Now |
| :--- | :--- |
| `cardType === 'consumable'` in `_activateSlot` | `isConsumptionCard(effects)` — restores and does nothing else |
| `cardType === 'consumable'` in `_completeActiveSlot` | same check, then `resolveOnComplete` |
| `cardType === 'combat'` in `_activateSlot` | `deriveCardType(effects) === COMBAT` |
| `cardType === 'combat'` in `_tickCombat` guard | same derivation |
| `cardType !== 'consumable'` in `_applyDeathPenalties` | walks item-backed `restore` effects |

⚠ **Trap avoided:** branching naively on "has a combat effect" would have changed **legacy
ambush** behaviour — those cards carry an `enemyId` *and* item outputs but run the task path
today. `deriveCardType` encodes the rule (fights **and** yields nothing → combat), so ambush
cards keep their current behaviour exactly.

`_resolveConsumable` is deleted; its logic is the `restore` resolver. Resolvers live in
`systems/cards/effects/effectResolvers.js`, which documents per kind whether it is resolved
there or still engine-owned (`work_output` → WorkProcessor, `combat` → CombatProcessor,
`token_stamp` → MutatorStamping, `buff` → C-4). Each migrates with its owning component.

**Still slot-level, retired by C-1:** the `slot.hazard` terrain branch. It is *slot* data, not
card data — D-8's card-borne hazards are already supported by the `hazard` effect and its
resolver.

**Effect model as built (slice 1):**

| | |
| :--- | :--- |
| **Phases** | `on_draw` → `on_activate` → `on_complete`, run in that order. Fixed set, per owner decision — a new timing need is a visible engine change, not something an author invents. |
| **Buff reach** | `self` / `next_card` / `loop` (D-10). Kept separate from phase because they're orthogonal: an effect *fires* at a moment and *lasts* for a span. |
| **Built-in kinds** | `work_output`, `hazard`, `restore`, `buff`, `token_stamp`, `combat`. |
| **Values** | **Raw absolute numbers** per card (owner decision). This sits comfortably with D-65 because recipes already carry `targetEV`/`autoBalance` — the CMS *generates* balanced values, so the tier curve lives in the authoring tool and the runtime just reads numbers. |
| **Type** | Fully derived from effects, never authored. Extends the CMS's `inferCardType` (L13: type derived from content) one layer down — CMS reads authored fields, game reads effects. Tie-break: **work output wins the label**, so a hybrid reads as a Task. |

---

## Layer 2 — Loop Mechanics

### C-4 — Buff effects & sequencing

*Implements D-10, D-60.*

Now the **buff effect resolvers** in C-3's registry, not a "Boost card" subsystem — any card carrying an aura or next-card effect flows through here.

| | |
| :--- | :--- |
| **Reuse** | `ModifierAggregator` + `AreaModifiers.getAreaAggregator(areaId)` already apply per-area stat modifiers and are already multiplied into `StatProcessor.calculateWorkcycleStats`. Buff effects ride this existing path. `SlotTokens` already demonstrates per-slot effect stamping. |
| **Change** | `LoopRunner._activateSlot()` resolves whatever effects the card carries: an **aura** effect registers modifiers on the area aggregator for the rest of the loop; a **next-card** effect arms a one-shot consumed by the following slot. Loop-wrap clears auras — the existing `clearAreaTokens(areaId)` on wrap is the model. **A card with both a work output and a buff runs both**, which is exactly the hybrid D-60 requires. |
| **New** | The aura and next-card resolvers; UI showing each card's buff reach on the banner. |
| **Delete** | Nothing. |
| **Depends on** | C-3. |
| **Verify** | An aura in slot 1 buffs slots 2–4; the same card in slot 4 buffs nothing. A next-card effect buffs only the following slot. A hybrid card yields its output *and* applies its buff. All clear on loop wrap. |
| **Risk** | Medium — lifecycle bugs here are invisible: a modifier that fails to clear silently compounds every loop. Add a test asserting the aggregator is empty at loop wrap. |

---

### C-5 — Hazard Task cards

*Implements D-8, D-11.*

| | |
| :--- | :--- |
| **Reuse** | `LoopRunner` **already has a hazard damage path** — `_forcedRetreat(areaId, areaState, heroId, cause)` handles the hazard-death case today, and hazard cards already pass `null` to `_recordCardUse`. `StatusEffectSystem` is available if hazards should apply a status rather than flat damage. |
| **Change** | Move the hazard trigger from the *slot* to the *card template*. Damage fires **once per execution** of the card (D-11), inside `_completeActiveSlot()` or at execution start. |
| **New** | Card-authored hazard payloads (schema from C-3); UI showing where damage came from. |
| **Delete** | The slot-level hazard reading (deleted in C-1). |

**Hazard tuning values rescued from the slot data before C-1 deleted it** — re-home these onto cards:

| Area | Type | Damage per pass | Tick time |
| :--- | :--- | :--- | :--- |
| Whispering Woods | `bleed` | 4 | 2000 ms |
| Misty Mountains | `slow` | 0 | 4000 ms |
| Sunken Bog | `poison` | 8 | 2000 ms |

Note `slow` did **zero** damage — its whole cost was the 4s hold. That's a *time* hazard, not a
damage one, and the `hazard` effect (damage-only) can't express it. Either author it as a
speed-debuff `buff` with negative value, or accept that slow-type hazards are cut.
| **Depends on** | C-1, C-3. |
| **Verify** | A loop with 4 hazard cards takes 4× the damage of a loop with 1. Death still routes through `_forcedRetreat`. |
| **Risk** | Low. The plumbing exists; this is a relocation. |

---

### C-6 — Prep Phase & loop structure

*Implements D-15, D-20, D-25, D-25b, D-28.*

| | |
| :--- | :--- |
| **Reuse** | **`DeckSlotManager` already calls `resetAreaLoop(areaId)` on every slot/unslot/swap** — D-25 ("editing stops the loop; it restarts from the top") is *already implemented*. `LoopRunner._beginDraw` / `_advance` already model draw and shuffle intermissions, and `DRAW_TIME_MS` / `SHUFFLE_TIME_MS` are already tunables. `_materializeCard` already builds ephemeral cards, which is exactly what a prep card is. |
| **Change** | Extend the loop cursor to run a **variable-length prep sequence before slot 0**: one ephemeral card per equipped potion, ~2s each. Energy is charged on **Task** draws only (D-28) — `ENERGY_DRAW_COST` must not apply to prep cards. |
| **New** | `PREP_CARD_TIME_MS` in `loopConstants.js`; prep-phase state on `areaState`; banner UI rendering the prep cards ahead of the four slots. |
| **Delete** | Nothing. |
| **Depends on** | C-7 (needs to know what the hero has equipped), C-8. |
| **Verify** | 4 potions → ~8s of prep before slot 1. Prep cards cost no energy. Editing the banner mid-loop stops it and restarts from prep. |
| **Risk** | Medium — the loop cursor currently assumes a fixed 4-slot cycle. Widening it to "N prep + 4 slots" touches `_advance`, progress-bar publishing (`PROGRESS_EVENT_TICK_INTERVAL`) and the banner's slot-index rendering. |

---

## Layer 3 — Hero

### C-7 — Hero 9-slot flexible grid

*Implements D-7, D-18, D-54, D-55.* **This is a genuine rewrite, and its defining requirement is extensibility.**

> **The architectural constraint (D-54):** the owner intends to keep adding gear categories —
> `quiver`, `gloves`, `boots` are planned, and `trinket` is expected to split into `ring` (cap 2)
> and `amulet` (cap 1). **Adding a category must be an authoring change with no engine edit.**
> Build the category list and its caps as *data*; a hardcoded enum here will have to be torn
> out within months.

| | |
| :--- | :--- |
| **Reuse** | The **two-layer model already in `equipmentConstants.js` is conceptually right** — items declare a *category* (`equipSlot`), heroes carry *slot instances*, and `resolveTargetSlot()` maps between them. Keep that idea; make the tables data. `EquipmentManager` (equip/unequip/modifier recalc), `EquipmentValidator`, `DurabilitySystem` and the dnd-kit drag system all survive. **22 gear items keep their existing tags — no item re-authoring.** |
| **Change** | Replace **6 named slot instances** (`hand1, hand2, hat, chest, trinket1, trinket2`) with **9 generic slots** plus a per-category cap check (D-55). `SLOT_CATEGORY`, `CATEGORY_SLOTS`, `SLOT_ORDER`, `SLOT_INFO` and `createEmptyEquipment()` all stop being fixed constants and become derived from a category table. `DockEquipmentGrid.jsx` goes from 2×3 named slots to a 3×3 grid of mixed content. |
| **New** | A **category registry** (id, cap, icon, label) that new categories can be added to by authoring alone. A generic 9-slot array on the hero. A cap validator replacing named-slot resolution. Duplicate-consumable suppression (D-18). |
| **Delete** | Named-slot assumptions throughout. ⚠ **`getPrimaryWeaponSlot()` is the trap** — combat asks it which weapon drives the hero's style and which burns durability, and it answers "the first occupied hand". Generic slots have no ordering, so this needs a deliberate replacement rule (e.g. first `hand`-category item in grid order) or combat breaks silently. |
| **Depends on** | C-0. Independent of Layers 1–2. |
| **Verify** | A hero holds 6 gear + 3 consumables, or 2 gear + 7 consumables. A second chestpiece is refused; a second hand item is allowed. Adding a `boots` category via data alone works with no code change — **test this explicitly, it's the whole point.** `HeroDock.test.js` and `EquipmentRequirements.test.js` updated and green. |
| **Risk** | **High.** Named slots are assumed in combat stat resolution, durability, the dock UI, defeat penalties and save data. No migration needed (old saves are refused, §3), but every *reader* of the old shape must be found — grep before starting. |

---

### C-8 — Consumption engine (three classes)

*Implements D-17, D-20, D-27, D-31, D-56.*

> **Terminology settled in round 13:** there are **three** classes, not two. **Food** and **Drink**
> are capped sustenance on the 25% rule. **Consumable** is a third, **uncapped** class —
> potions, scrolls, runes, summons — and *one of each* fires in the Prep Phase every loop.

| | |
| :--- | :--- |
| **Reuse** | **`LoopRunner._resolveConsumable()` already does the sustenance work** — reads `item.restoreAmount`, checks `item.tags` for `drink`, calls `HeroManager.modifyHeroEnergy` / `modifyHeroHp`. **Food and Drink already exist as equippable item classes**: 9 items carry `equipSlot: 'food'`, 2 carry `equipSlot: 'drink'`, and there are 12 `restoreAmount` fields — survivors from before CR-029. Reinstating hero-carried sustenance needs almost no item re-authoring. `RegenSystem` already ticks HP/energy and is the natural home for the threshold watcher. `StatusEffectSystem` already applies timed buffs, so Consumable effects ride it unchanged. |
| **Change** | Move consumption from *"a consumable card occupies a deck slot"* to *"the hero's grid drives it"*. Drink fires **at the draw**, before energy is charged (D-27). Food fires **whenever HP < 25%**, in or out of combat; in combat it pauses the attack cycle and grants the enemy a free hit. |
| **New** | **The `Consumable` item class does not exist yet** — no `equipSlot: 'potion'`, no scrolls, no runes, no summons. It needs a class definition with an effect payload (rather than `restoreAmount`), plus the items themselves. The 25% threshold watcher; the combat-eating interrupt in `CombatAttackProcessor` / `CombatProcessor`; auto-restock from the Guild Bank; consumption rendered as a card. `CONSUME_THRESHOLD = 0.25` in `loopConstants.js`. |
| **Delete** | The consumable-as-deck-slot-card model (`cardType: 'consumable'` slotting) — deck slots hold Task and Boost cards only. `CONSUMPTION_TIME_MS`'s "empty-slot penalty" meaning goes away. |
| **Depends on** | C-7. |
| **Verify** | A hero at 20% energy drinks, then draws. A hero below 25% HP mid-fight eats and visibly takes a free hit. Six different Consumables all fire at prep; two copies of one fire once (D-18). An unstocked hero keeps working and falters. |
| **Risk** | Medium-high. Two distinct hazards: the **combat-eating interrupt** (watch item **W-2**, the eat/get-hit spiral — instrument it so the spiral is *observable*), and the fact that **`Consumable` being uncapped means prep time is the only balancing force** (D-56). Prep duration and buff potency have to be tuned as a pair, or a wall of scrolls is strictly correct. |

---

### C-9 — Defeat penalties & the retreat path

*Implements D-19, D-57.*

| | |
| :--- | :--- |
| **Reuse** | **`LoopRunner._applyDeathPenalties()` already implements both penalties** exactly as D-19 specifies — 25% consumable stack loss and a 10%-per-piece gear loss, driven by `DEFEAT_PENALTY` in `loopConstants.js`. No behavioural change wanted. `WoundedSystem` and `HeroAssignmentManager` both already exist. |
| **Change** | Two re-points. **(1)** The consumable-loss loop iterates **`areaState.deckSlots`** looking for `cardType: 'consumable'` — consumables no longer live in deck slots, so it must iterate the **hero's 9-slot grid**. **(2)** `_forcedRetreat()` currently sets `areaState.mode = 'stationed'` to retreat the hero into the area's Outpost face; that mode dies with C-10. Replace it with **unassigning the hero back to the roster** (D-57) via `HeroAssignmentManager`, leaving the banner heroless and stopped. |
| **New** | Nothing — both mechanisms exist. |
| **Delete** | `DEFEAT_PENALTY.GEAR_LOSS_EXEMPT_SLOTS`, an empty array left from CR-029: either populate it or drop it. The `AREA_EVENTS.MODE_SWITCHED` publish in the retreat path. |
| **Depends on** | C-7, C-8, C-10. |
| **Verify** | Defeat destroys 25% of banked stacks for grid consumables, rolls gear loss per equipped piece, and leaves the hero unassigned with the banner idle and clearly signposted. |
| **Risk** | Low mechanically — but ⚠ **the severity is now stacked**: defeat costs banked consumables, possibly permanent gear, all production time, *and* a manual re-deployment, while heroes are deliberately scarce (D-24). Four penalties on one event. Flag for playtest; `DEFEAT_PENALTY` is the tuning hook if it lands too hard. |

---

## Layer 4 — Outposts

### C-10 — Outpost banner split

*Implements D-16, D-21, D-35, D-38.* **This is the largest rewrite.**

| | |
| :--- | :--- |
| **Reuse** | `StationSlotManager` (slot/unslot/selectRecipe/setProductionMode) and `StationManager` (the crafting tick) are both **structurally correct** — they just stop being *per-area* and become *per-Outpost-banner*. `StationSlotManager` already tracks **owned vs. slotted copies across areas**, which is exactly the allocation model Outposts need. The banner rendering stack (`AreaBannerContainer` / `AreaBannerRow` / `BannerLayout` / `RefProgressBar`) serves a second banner type. **`AreaManagerScreen.jsx` already exists** and is where playmat membership and ordering live (D-58, D-59). `data/stations.json` (5 stations) and the `station` card type survive. |
| **Change** | Outposts stop being a *mode* of an area and become their own banner entities with their own state. `areaState.mode` and the whole adventure↔stationed toggle disappear. Area banners render adventure only. **Outposts join the playmat as ordinary rows** the player can reorder or remove (D-58). Station cards **drop `areaId`** (D-64). |
| **New** | Outpost banner state (a small guild-wide list, not per-area); a banner row component for a **single-card** Outpost; Outpost unlock progression (start at 1, grow to ~3–4) with a card granted on each unlock (D-35). **Playmat membership** as a first-class state (on/off, D-59) applying to areas *and* Outposts, with "off" halting work **and unassigning the hero** (D-67). |
| **Delete** | **`src/systems/loop/ModeManager.js`** in its entirety (89 lines — its only job is the adventure↔stationed toggle). The `stationSlots` concept on areas. `AREA_EVENTS.MODE_SWITCHED` and its subscribers. `areaId` on station card data. |
| **Depends on** | C-1. |
| **Verify** | Outpost banners appear in the playmat list, reorderable among areas; an area banner has no mode toggle; unlocking an Outpost grants a card; swapping the installed card halts and restarts production; taking a banner off the playmat stops it and returns its hero to the roster, and putting it back restores deck, binder and progress intact. |
| **Risk** | **High** — this touches state shape, the banner UI stack, the event vocabulary and save data. Do it as its own commit with nothing else in flight. |

---

### C-11 — Global aura system

*Implements D-16, D-23.*

| | |
| :--- | :--- |
| **Reuse** | **`AreaModifiers.js` is 45 lines and already does exactly this, one scope down.** It hands out per-area `ModifierAggregator`s, rebuilds them on load via `StationSlotManager.rehydrateBuffs()`, and they're already multiplied into `StatProcessor.calculateWorkcycleStats`. A global aggregator is the same pattern with one instance. **`stations.json` already carries a `passiveBuff` field** (null on Wood Kiln) — the authoring hook exists. |
| **Change** | Add a **global** aggregator alongside the per-area ones; Outpost card auras register there instead of on an area. Stat resolution multiplies both (global × area). |
| **New** | Global aggregator instance + its rehydration on load. Additive stacking for duplicate auras (D-23) — the aggregator already sums modifiers by source, so registering two Smithies as distinct sources should stack naturally. **Passive Outpost cards** (D-62): craft nothing, emit a strong aura, and are the natural home for D-22's unstaffed cards. |
| **Delete** | Nothing — per-area aggregators are still used by buff effects (C-4). |
| **Depends on** | C-10. |
| **Verify** | A Smithy in one Outpost boosts mining in *every* area. Two Smithies double it. A Passive Outpost emits its aura with no hero assigned. Auras survive a save/reload. |
| **Risk** | Low mechanically — the highest-leverage reuse in the rework. Two things to hold onto: don't forget rehydration (a silently-empty aggregator after reload is the classic failure), and **keep the three aura tiers separated in tuning** (D-62): station incidental < Passive Outpost < in-deck Boost card. If a Passive's aura is weaker than a station's, nobody will ever install one. |

---

### C-12 — Guild tree Outpost cards

*Implements D-34, D-36, D-37.*

| | |
| :--- | :--- |
| **Reuse** | **`GuildUpgradeManager` is already exactly the right shape** — it stores `progress.guildUpgrades` as ranks, exposes `getRank` / `getNextCost` / `purchase`, and **recomputes effects from ranks on load**. D-37's "rank N grants N copies" is a natural fit. `GuildHallScreen.jsx` already renders the tree. |
| **Change** | Add Outpost cards as a new node *category* whose effect is "grant N copies of card X" rather than a numeric stat bonus. Add area-unlock gating on node visibility (D-36). |
| **New** | Node definitions for each Outpost card; owned-copies display in the tree UI. |
| **Delete** | Nothing. |
| **Depends on** | C-10. |
| **Verify** | Buying rank 2 of the Smithy node yields two installable Smithy cards. Alchemist Lab is hidden until its region unlocks. |
| **Risk** | Low. Note the existing curves in `GuildUpgradeManager` are placeholders — they need real numbers under C-15's scaling. |

---

### C-13 — Crafting upkeep

*Implements D-4, D-29.*

| | |
| :--- | :--- |
| **Reuse** | `StationManager._tickArea` already charges craft energy and already pauses with `'paused_no_energy'` and auto-resumes. `DEFAULT_CRAFT_ENERGY` (15) is the fallback, and **recipes already author their own `energyCost`** (e.g. Charcoal costs 3). **Recipe gating is kept wholesale (D-63)** — 21 recipes are already tied to subskills with `levelRequirement`, and stations carry `skillCap`; none of that changes. |
| **Change** | The energy top-up source: `StationManager._tryStationDrink()` currently sips from a **station-side Drink slot**. It must instead defer to the hero's own grid via the C-8 threshold rule. |
| **New** | Nothing — C-8 provides the mechanism. |
| **Delete** | `StationSlotManager.setStationDrink()`, the station `drink` state field, `_tryStationDrink()`, and the Drink-slot UI. This is the CR-029 reversal made concrete. |
| **Depends on** | C-8, C-10. |
| **Verify** | A crafter with drinks in their grid runs indefinitely; one without stalls at `paused_no_energy` with clear UI signalling. |
| **Risk** | Low. |

---

## Layer 5 — Economy & Progression

### C-14 — Per-area pack economy

*Implements D-13, D-14, D-32.*

| | |
| :--- | :--- |
| **Reuse** | `CollectionManager` already has the full pack flow — cost lookup, pool generation, exhaustion checking, buy, and **`pendingPackOptions` persisted so a bought-but-unclaimed pack survives reload (CR-040)**. `PackShopScreen.jsx` and `PackOpeningOverlay` exist. Crucially, `checkUnifiedExhaustion()` already models "the pool can run dry" — that's D-13's completable binder. |
| **Change** | Everything unified becomes per-area: `getUnifiedPackCost` → per-area curve, `getUnifiedPool` → the area's remaining pool, `buyUnifiedPack` → `buyAreaPack(areaId)`. Cost curve gains a **per-area baseline** plus in-area scaling (D-32). Pools contain **only** that area's native cards — universals are excluded entirely (D-46). |
| **New** | Pity counter guaranteeing the area's unique Boost by pack N (D-14). Per-area `packsBought` counters. Pool-completion state and "packs no longer sold" handling. |
| **Delete** | `collection.globalPacksBought`, `UNIFIED_PACK` constants, and the unified-pack code paths (in C-17). The global `PackShopScreen.jsx` retires or becomes a summary — buying moves to the banner (D-48, built in C-2b). |
| **Depends on** | C-2, C-2b, C-3. |
| **Verify** | Farmlands packs start ~100g and climb; a maxed card never appears again; the Boost is guaranteed by the pity threshold; a completed area's pack is unpurchasable. |
| **Risk** | Medium. `CollectionManager.test.js` will need substantial rewriting. |

---

### C-15 — Exponential scaling & big numbers

*Implements D-32, Appendix C.*

| | |
| :--- | :--- |
| **Reuse** | `InventoryFormatter` is the natural home for display formatting. `FormulaRegistry` centralises combat constants and is the model for how tunables should live in one place. |
| **Change** | Every economic constant gets a **tier dimension**: pack baselines, resource yields, gold income, gear values, craft outputs, guild upgrade costs. `inventory.maxStack` is currently `99999` — far too small for a 100M-scale economy. |
| **New** | **A scaling *function* keyed on tier index (D-65)**, not a hand-written table — every economic value derives from it. K/M/B/T number formatting. Precision-safety review anywhere values are summed or multiplied repeatedly. |
| **Delete** | Nothing. |
| **Depends on** | C-14. **No longer blocked on knowing the area count** — that's the point of D-65. |
| **Verify** | Adding a new tier produces sane numbers with **no retuning**. An Astral-Volcano-tier area displays correctly; no precision artifacts or `Infinity` at the top tier. |
| **Risk** | Medium-high, and **easy to underestimate**. Per watch item **W-7**, this must be in place *before* high-tier areas are authored. The risk has shifted shape: it's no longer "pick the right area count" but **"get the curve function right"**, since everything derives from it. |

---

### C-16 — Area gating & content sequence

*Implements D-30, D-39, D-40.*

| | |
| :--- | :--- |
| **Reuse** | The quest system already gates areas — `unlockQuestIds` on area cards, `areaStates[id].unlockQuestProgress`, `QuestBoardSystem` / `QuestTracker`, and auto-completing turn-ins. D-39 needs no new machinery. |
| **Change** | Author each area's unlock quest to demand **materials from the previous tier**, making progression economic. |
| **New** | **A two-area vertical slice, built first (owner call).** One area unlocked at the start and **one locked behind it** — because a single-area slice cannot exercise the unlock gate (D-39), which is the pacing spine of the entire game. Build both end to end — palette, unique Boost, pack pool, unlock quest, materials feeding a real crafting sink — and play until genuinely good. That pair becomes the template every later area is cloned from. |
| **Delete** | Nothing. |
| **Depends on** | C-3, C-14. |
| **Verify** | Area 1 is playable and its binder completable; area 2 unlocks **only** by turning in area-1 materials; every tier's raw materials have an ongoing crafting sink (watch item **W-5**). |
| **Risk** | **High, but content risk rather than code risk** — the largest time investment in the rework, and the part that decides whether the game is any good. **Data cleanup is in scope:** only 10 quests exist, and `area_mpftfwt8` — a deleted area — is still referenced by both `data/quests.json` and `data/encounters.json`. There are also quests pointing at nonexistent items, and Whispering Woods has zero cards. Clean these while authoring the slice, not after. *(The duplicate `task_rocky_outcrop` id and 11 orphaned card files were already resolved during the CMS rework — 179b938 and c64eb61.)* |

---

## Layer 6 — Cleanup

### C-17 — Retirement sweep

*Runs LAST, once everything works.*

Delete, in one commit, with tests green before and after:

| Target | Why |
| :--- | :--- |
| `src/systems/loop/ModeManager.js` | Adventure↔stationed toggle retired (D-16, C-10). |
| `src/systems/progression/BinderTabManager.js` + `collection.binder` | Manual tab filing retired — the global pile it organised is gone (D-41, C-2b). |
| `src/ui/components/drawer/CardsTab.jsx` | The global card view; binders now live on banners (D-42, C-2b). |
| `DeckSlotManager.moveCardBetweenAreas()` | Cards are permanently area-bound (D-43, C-2). |
| Guild Hall "binder tabs" upgrade node | The thing it raised no longer exists (D-41). |
| `collection.mastery` state | Set when a playset hit 4/4 globally; superseded by per-area binder completion (C-19). |
| Station Drink slot: `setStationDrink`, `_tryStationDrink`, state field, UI | CR-029 reversal (D-4, C-13). |
| `collection.globalPacksBought`, `UNIFIED_PACK` | Replaced by per-area curves (C-14). |
| `gridConfig` / `validCells` / `hubPosition` in `areas.json` | Dead 2D-playmat data from the pre-deck-loop era. |
| `station_test_water_tower` | Throwaway test card from the original Phase 4. |
| Slot-type authoring: `specializedTags`, per-slot `hazard`, `slotType` | Retired by D-1 (C-1). |

**Risk:** low if genuinely last. The lesson from the previous rework holds — **delete only after everything works**, never alongside a feature commit.

---

### C-19 — Binder Mastery (completion reward)

*Implements D-66.* **Sits in Layer 5, built after C-14.**

| | |
| :--- | :--- |
| **Reuse** | Conceptually only. `MasterySystem.js` describes the right *shape* — evaluate completion, unlock a permanent per-area bonus, expose bonuses to stat resolution — and `ModifierAggregator` / `AreaModifiers` provide the delivery path the bonus should ride. |
| **Change** | Trigger moves from the dead `areaState.collectionProgress` / `setDef.deckList` path to **per-area binder completion** (C-2's state). Bonus delivery moves onto the area's `ModifierAggregator` rather than the old ad-hoc `getEffectiveBonuses` shape. |
| **New** | The completion evaluator against per-area binders, the authored bonus per area, and its UI on the binder page beside the "X of Y collected" counter. |
| **Delete** | The existing `MasterySystem.js` body — it reads `collectionProgress`, `setDef.deckList` and `completedQuestIds`, structures this rework replaces. **Treat this as a rewrite against new data, not a revival**; the file is a reference, not a foundation. Quest mastery is *not* being revived. |
| **Depends on** | C-2, C-14. |
| **Verify** | Completing an area's binder fires once, grants a permanent bonus visible in that area's stat resolution, and survives reload. It does not re-fire. |
| **Risk** | Low-medium. ⚠ **Tuning is the real risk (W-9):** the bonus must be worth the last few expensive packs without making a completed low-tier area better than the next tier up. The D-65 tier curve must still dominate. |

---

### C-18 — Test baseline restoration

The suite is **23 files** run by `npm test` (vitest). Expected impact:

| Test file | Impact |
| :--- | :--- |
| `DeckSlotRules.test.js` | Rewrite — slot types gone, copy-limited slotting per area, no cross-area moves. |
| `LoopRunnerFlow.test.js` | Extend — prep phase, variable-length loop. |
| `HeroDock.test.js` | Rewrite — 9-slot flexible grid. |
| `EquipmentRequirements.test.js` | Rewrite — type-uniqueness replaces named slots. |
| `StationCard.test.js` | Rewrite — Outposts are banners, not area modes. |
| `CollectionManager.test.js` | Rewrite — per-area packs. |
| `SaveRoundtrip.test.js`, `SaveDurability.test.js` | Extend — new schema; assert the version gate refuses a pre-rework save. |
| `StatusEffects.test.js`, `CombatFormulas.test.js`, `Mutators.test.js` | Should survive; verify combat-eating didn't disturb them. |

**New tests worth writing:** aura-modifier cleanup at loop wrap (C-4), global aggregator rehydration after reload (C-11), copy-limit enforcement (C-2), Universal Bucket allocation across multiple areas (C-2c), a data-only new equipment category (C-7, D-54), a data-only hybrid yield+buff card (C-3, D-60), and binder-completion firing exactly once (C-19).

---

## 2. Dependency Order

```
C-0  CMS
 └─> C-1  slot model ──┬─> C-5  hazards
     C-3  schema ──────┴─> C-4  boosts
     C-2  binders ──> C-2b binder UI ──┬─> C-2c universal bucket
                                       └─> C-14 packs ──┬─> C-15 scaling
                                                        ├─> C-16 content (2-area slice)
                                                        └─> C-19 binder mastery
     C-7  hero grid ──> C-8  consumption ──> C-6  prep phase
                             └──> C-9  defeat
                             └──> C-13 craft upkeep
     C-1 ──> C-10 outpost split ──┬─> C-11 global auras
                                  ├─> C-12 guild tree ──> C-2c (shares ranked nodes)
                                  └─> C-13 craft upkeep
                                            └──> C-17 cleanup ──> C-18 tests
```

**Three tracks can run in parallel** once C-0 and C-3 are done: the *card track* (C-1, C-2,
C-2b, C-4, C-5), the *hero track* (C-7, C-8, C-9), and the *Outpost track* (C-10, C-11,
C-12). They converge at C-6 (prep phase needs the hero grid), C-13 (upkeep needs both) and
C-2c (the bucket needs both the pip component and the ranked-node mechanism).

**Suggested first slice:** C-3 (schema) then C-1 (slot model) — small, low-risk, and they
unblock the most. **The binder chain C-2 → C-2b is the heart of the rework**; treat it as
the main event rather than one item among eighteen.

---

## 3. Cross-Cutting Concerns

**Saves: old saves are REFUSED, not migrated.** *(Q-R6 resolved, round 15.)*
Three components change save shape — C-2 (`playsets` → per-area binders), C-7 (6 named
equipment slots → 9-slot array), C-10 (Outpost state, `areaState.mode` removal).

**Correction to an earlier claim in this doc:** `SaveMigration.js` is **not** a migration
framework. It is 44 lines containing *no* migration logic — a hard version gate that throws
`IncompatibleSaveError` whenever `savedVersion !== GAME_VERSION`, then key-fills the matching
state from `INITIAL_STATE`. There is nothing to extend.

So the whole save story is: **bump `GAME_VERSION`, and the existing gate rejects old saves.**
One line. This is already the established pattern (the pre-rework `1.0.0` schema is refused
the same way), and it's correct here — saves referencing card ownership, equipment slots and
area modes that no longer exist can't be meaningfully rescued. Acceptable pre-release;
it would not be after launch.

**Version bump.** Per `CLAUDE.md`, five files carry the version and must move together:
`package.json`, `package-lock.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`,
`src-tauri/Cargo.lock`. Log changes in `CHANGELOG.md` under `## [Unreleased]` as they land.

**Verification.** Per `CLAUDE.md`, every component ends with `npm test` **and** an actual
run of `npm run dev` exercising the change. Note two known traps from prior sessions:
repeated Vite HMR corrupts the tick-handler module graph — hard-reload before trusting
loop behaviour — and browser screenshots time out on this app, so verify via the
accessibility tree and `window.Game` console probes.

---

## 4. Risk Register

| Risk | Component | Mitigation |
| :--- | :--- | :--- |
| Missed reader of an old state shape | C-2, C-7, C-10 | No migrations to get wrong (saves are refused), but every *reader* must be found — grep `playsets`, `equipment`, `areaState.mode` exhaustively before starting. |
| Named equipment slots assumed everywhere | C-7 | Grep for `EQUIPMENT_SLOTS`, `SLOT_CATEGORY`, `hand1` before starting; expect combat, durability, dock and defeat to all appear. Watch `getPrimaryWeaponSlot` specifically — it breaks silently. |
| Category list hardcoded, blocking planned gear types | C-7 | D-54 requires data-driven categories; test by adding `boots` with no engine edit. |
| Effect payload shape wrong, expensive to unwind | C-3 | D-60 makes this foundational. Design against 3–4 concrete cards — including a yield+buff hybrid — before writing the registry. |
| Aura tiers collapse into each other | C-11 | D-62 needs station < Passive < Boost kept separate; if a Passive is weaker than a station, it's dead content. |
| Uncapped Consumables balanced only by prep time | C-8 | Tune prep duration and buff potency together; verify a 6-scroll build isn't strictly optimal. |
| Defeat penalties stack four-deep | C-9 | Playtest early; `DEFEAT_PENALTY` is the hook. |
| Outpost split touches state + UI + events at once | C-10 | Its own commit, nothing else in flight, rollback tag beforehand. |
| Aura modifiers fail to clear or rehydrate | C-4, C-11 | Dedicated tests for both lifecycles; these fail silently otherwise. |
| Scaling retrofitted after content authoring | C-15 | Sequence C-15 before high-tier areas; decide area count at C-16 start. |
| Content volume is the real cost | C-16 | Decide target area count before writing code that assumes it. |
| Deleting too early | C-17 | Cleanup is last, always. |

---

## 5. Open Questions for the Review Pass

Surfaced by reading the code — **not** re-litigations of locked decisions. These are places
where the concept doc and the codebase disagree, or where a locked decision has an
implementation consequence that hasn't been chosen yet.

**~~Q-R1~~ — RESOLVED (round 13).** The code's categories win: `hand` (cap 2), `hat`, `chest`,
`trinket` (cap 2). The doc's Weapon/Boots/Helmet example was illustrative prose and has been
corrected. **The real requirement it exposed is D-54:** categories are data, not constants —
`quiver`, `gloves`, `boots` are planned and `trinket` splits into `ring`/`amulet`, so C-7 must
make adding one an authoring-only change.

**~~Q-R2~~ — RESOLVED (round 15).** Set mastery returns as a **binder-completion reward**
(D-66), rebuilt against per-area binders — a rewrite, not a revival, since the existing file
reads structures this rework replaces. Quest mastery is **not** revived. Built in C-19.

**~~Q-R3~~ — RESOLVED (round 12).** Universals are one global **Universal Bucket** (D-46):
owned, capped at 4, sourced from ranked guild-tree nodes, excluded from all area binders
and pools, allocated across areas by the player. Built in C-2c.

**~~Q-R4~~ — RESOLVED (round 13).** A defeated hero is **unassigned and returns to the roster**
(D-57). `_forcedRetreat` swaps its `mode = 'stationed'` line for a `HeroAssignmentManager`
unassign. Built in C-9.

**~~Q-R5~~ — RESOLVED (round 15).** Area count is **not** committed to. Scaling becomes a
**formula on tier index** (D-65), so adding areas is authoring rather than a retune. The risk
moves from "pick the right count" to "get the curve function right". Built in C-15.

**~~Q-R6~~ — RESOLVED (round 15).** Old saves are **refused**. Bump `GAME_VERSION`; the
existing gate does the rest. See §3.

**~~Q-19b~~ — RESOLVED (round 15).** Removing a banner from the playmat **unassigns its hero**
(D-67); binder, deck and progress persist. Built in C-10.

---

## ✅ Review complete

**All review questions are resolved.** Layers 1–6 were reviewed with the owner across rounds
12–15, and the concept doc carries no open design questions. This roadmap is ready to execute.

**Recommended build order for the first three slices:**

1. **C-0** — finish and merge the CMS rework, then tag a baseline off `main`.
2. **C-3** — the composable effect registry. It is now the foundational abstraction beneath
   C-4, C-5 and every future card, and **getting its payload shape wrong is the most
   expensive mistake available in this plan**. Design it against 3–4 concrete cards,
   including a yield+buff hybrid, before writing code.
3. **C-1** — the slot model. Small, mostly subtraction, and unblocks the card track.

The binder chain **C-2 → C-2b** is the heart of the rework and should be treated as the main
event, not one item among nineteen.
