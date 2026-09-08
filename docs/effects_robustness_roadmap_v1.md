# Effects Robustness — roadmap v1

> ## ⚠️ SUPERSEDED IN PART, 2026-09-08
>
> **P1, P2 and P4 are DONE and stand.** So do ER-1, ER-2, ER-5, ER-6 (the reach
> vocabulary) and ER-14…ER-16. §3's vocabulary sweep remains useful inventory.
>
> **P5, P6 and P7 are replaced** by
> [`effects_grammar_v2_roadmap.md`](effects_grammar_v2_roadmap.md), and
> **ER-3, ER-4 and ER-7…ER-13 are reopened** by it. The owner redirected the
> status absorb on 2026-09-08: statuses move into the **statement grammar**, not
> into the modifier aggregator, and the library becomes the single repository for
> every rule in the game. Read the v2 concept before acting on anything below the
> status table.

*The authoritative plan for the follow-up to Unified Effects. Written
2026-09-07. Unified Effects itself is
[`unified_effects_roadmap_v1.md`](unified_effects_roadmap_v1.md) (P1–P7, all
DONE) and its vision is [`concept_unified_effects.md`](concept_unified_effects.md).*

**Do not re-litigate §1.** Those are owner rulings from the 2026-09-07 session.
§2 is what the orientation found, §3 the vocabulary sweep, §4 the phase plan,
§5 the status table, §6 the questions still open.

---

## 1. Locked decisions

### Reach and scope

| # | Decision | Why |
|---|---|---|
| **ER-1** | **Reach becomes a declared vocabulary, not a hardcoded set of eight.** A small registry of rows — *this Token*, *this Token and its neighbours*, *every adjacent Token* (today), *every Token on the board* — with the same discipline as `TRIGGER_EVENTS`: **a row ships with its reader or not at all.** | Reach is currently a fact about the code (`neighboursOf(index)`), not a thing an author can choose. The owner's example — an effect that reaches nearby Tokens but never itself — is unauthorable, and so is every board-wide effect. |
| **ER-2** | **No radius, no rows, no columns, no direction.** The reach list is a handful of named rows, not a shape language. | Directional adjacency was ruled out of the concept (§7) and a 6×6 board does not need distance falloff. A shape language is how a small feature becomes a rules engine — the slope `restrictionPalette.js` already refuses. |
| **ER-5** | **A statement's reach defaults to `adjacent` by absence.** No migration writes a field onto existing content. | 20 Tokens and 17 library entries are authored against "the eight neighbours". Inferring today's behaviour from a missing field means the shipped game cannot change under this work — the trick `chargeMomentOf` already uses for the charge moment. |
| **ER-6** | **A reach a keyword cannot honour is not offered.** `Requires` and `Works as` are statements *about this Token* and take no reach at all. | Same rule as `KEYWORDS.filter`: legality is declared, never hoped for. An authorable option nothing reads is this project's most expensive recurring bug. |

### Scope of the project

| # | Decision | Why |
|---|---|---|
| **ER-3** | **No third bearer this project.** Heroes, maps and recipes stay non-bearers. Items and enemies are **proven with real authored content** instead. | Both shipped working machinery on 2026-09-07 and both have **zero** authored rules — all 54 items carry `effects: []` and the one enemy carries none. Adding a third bearer before either has ever run in play is building on unverified ground. |
| **ER-4** | **No new keywords.** The nine stand. The work is giving the axes that are already *named* a real reader, and fixing the places where an authored filter is ignored. | Every candidate keyword (`Removes`, `Prevents`, `Spawns`, `Transforms`, `Counts as`) is a new concept; every dead axis is a promise the data already makes and the engine already breaks. The broken promises come first. |

### The status absorb *(owner ruling, 2026-09-07)*

| # | Decision | Why |
|---|---|---|
| **ER-7** | **Statuses are absorbed into the effect library. `StatusEffectSystem`'s private effect vocabulary is retired.** A "status" becomes a named library effect applied to an entity **with a duration**. | Owner's call, and the code agrees: three of the five status effect types (`flat_armor`, `damage_pct`, `yield_pct`) are already axes in the palette with their own readers. Keeping both is the parallel vocabulary CR2-074 named, still standing after a project whose summary was *every rule in the game is a named effect*. |
| **ER-8** | **The five decay triggers are NOT carried over.** `tick`, `hit_taken`, `attack_attempt`, `combat_resolved` and `slot_resolved` are deleted. **Duration replaces them**, using `ModifierAggregator`'s existing `expiry`. | Owner's ruling: they are vocabulary from a retired system. `combat_resolved` and `slot_resolved` are named for the card-era loop; `hit_taken` and `attack_attempt` are per-swing bookkeeping that only makes sense inside a fight. One concept — *how long it lasts* — replaces five. |
| **ER-9** | **Stacks are retired.** Magnitude comes from the effect's authored value × its scale, exactly as it does everywhere else. UE-18's 1–5 cap is untouched. | The 99-stack model is the same retired system. It also removes the head-on collision between "stacks go to 99" and "a scale caps at 5", by deleting the thing that collided rather than by reopening a locked decision. |
| **ER-10** | **Enemies get a `ModifierAggregator`, exactly like a hero.** `card.combat.enemyStatuses` is retired with it. | Not optional. Four of the eight status reader call sites are enemy-side, `enemy.armor` is a plain number, and `calculateHitChance` already reads `attacker?.aggregator` — which an enemy does not have. Half the absorb is unbuildable without this, and it also cleans up what P7 wrote. |
| **ER-11** | **Four of the five status types collapse into existing axes. One does not.** `flat_armor`→`ARMOR`, `damage_pct`→`DAMAGE`, `yield_pct`→`YIELD`, `attack_fail`→`ACCURACY`. **`dot` becomes one new palette row** with a reader on the existing 5-second clock. | The collapse is why the absorb is worth doing — four mechanics stop being special cases. `dot` is genuinely absent: recurring damage is an *action on a clock*, not a sum an aggregator can resolve, and it is the mechanic three of the seven shipped statuses are built from. |
| **ER-12** | **The seven shipped statuses are RE-AUTHORED by hand, not translated.** `ContentAudit` names any that has not been. | The project's standing rule (`statementsOf`, `hasRetiredEffectData`): a quiet half-translation is the failure mode this whole line of work exists to remove. `attack_fail`→`ACCURACY` in particular is a *re-authoring* — a negative accuracy against a 5–95 clamp is not arithmetically the same as "25% chance per stack, capped at 80%". Pretending it is would be exactly that failure. |
| **ER-13** | **Statuses do not become CMS-authorable in this project.** A **minimal status readout ships with P6** (ER-17). | Owner's calls. Unify the vocabulary first and author second, so the shape settles before a data file and a CMS screen are built against it. |

### Closed on 2026-09-07, after the sweep

| # | Decision | Why |
|---|---|---|
| **ER-14** | **`Converts` gains a filter.** A conversion may aim its output at a named neighbour. | Owner's call, made with the D-40 tension stated: output can now appear on a tile that did no work. The expressive case — a Sigil turning Stone into Bricks and placing them on the adjacent Kiln — was judged worth it. An absent filter still means the firing tile, so nothing authored changes. |
| **ER-15** | **`STAT_BONUS` is retired from `EFFECT_TYPES`.** | "A generic stat bonus" in a 7-stat engine is a targeting question wearing an axis costume. The honest version is one axis per stat, which is what the combat rows already are. Deleting it makes the type list mean something again. |
| **ER-16** | **`board` reach ships uncapped**, relying on small values and the scale cap. | Consistent with D-23 for every other modifier. ⚠️ Two board-wide Tokens of one type genuinely double up and no audit warns — accepted knowingly, and recorded here so a later balance surprise is not read as a bug. |
| **ER-17** | **A minimal status readout ships with P6** — icons on the hero, hovered for the generated sentence. Not the full UI job. | The owner's standing rule is that work is verified by playing it. P6 is the largest and riskiest phase and is currently the only one with no way to watch it happen. Enough UI to see Poison land, tick and expire, and no more. |

## 2. What the orientation found

### 2.1 Reach is hardcoded, and "never me" is the half nobody can author

`applicableStatements` ([`TileModifiers.js`](../src/systems/board/TileModifiers.js))
walks `neighboursOf(index)`, and the source tile is never in that set.
`StatusApplication.applyToNeighbours` does the same on the triggered path. So:

* a Token cannot buff **its own** yield, work time or input cost;
* a Token cannot put a status on the hero working **it**;
* a Token cannot grant an item to **itself**;
* nothing authored can reach further than one tile, in any direction.

The only scope wider than adjacency is `getGlobalAggregator()`, and the only
thing that writes to it is the Guild Hall upgrade track. No authored effect can.

### 2.2 A triggered `Grants` silently ignores its own filter — a real bug

`Grants` declares `filter: true` and `when: OPTIONAL`, so an author can write
*"When a neighbour completes a cycle, grant 1 Copper to any adjacent Forge"* and
the sentence renders those words. But
[`TriggerSystem.runStatementActions`](../src/systems/board/TriggerSystem.js) drops
the item on **the firing Token's own tile** with no reference to `statement.to`
at all. The ambient path honours the filter; the triggered path does not.

This is precisely the failure the grammar exists to prevent: the sentence says
one thing and the runtime does another, with nothing to catch it. `Converts` has
the same shape, though there the tile is arguably right (D-40 puts every yield on
the board) — so `Converts` needs a **ruling** (§6 Q2), and `Grants` needs a
**fix**.

### 2.3 Four things are readable and unwritable

The condition the five combat axes were in before P7: queried in live code for
months, writable by no author. Four more are in it now.

| What | Its live reader | Why it matters |
|---|---|---|
| **`STATUS_IMMUNITY`** | `StatusEffectSystem.js:44` — `aggregator.query('STATUS_IMMUNITY', statusId)` | ⚠️ **Corrects the Unified Effects roadmap**, which deferred this as needing "category-scoped targeting the grammar has never had". It needs a **payload field**, the way `BONUS_DROP` carries `itemId`. One palette row. |
| **`mod.target.category`** | `ModifierAggregator._forEachMatching` — and `BoardRunner` passes `config.skill` on **every** `resolveAxis` call | Skill-scoped effects — *"+10% yield to Mining only"* — are fully wired and read. No statement payload has ever set the field. |
| **`mod.expiry`** | `_forEachMatching` skips expired mods; `purgeExpired` removes them | A **timed modifier already works**. This is the machinery ER-8's duration is built on, and it is why the absorb is smaller than it looks. |
| **`purge()`** | none — defined at `StatusEffectSystem.js:270` and **called by nothing** | Active cleansing (an Antidote) is written, tested by nothing, and unreachable from content. |

### 2.4 Five axes are named with no reader anywhere

`HP_REGEN`, `THORNS_REFLECT`, `STAT_BONUS`, `CHARGE_EXTEND`, `SELL_BONUS`. Unlike
the four above, these have no reader at all — so each is a palette row **plus** a
consumer, a small feature apiece rather than a row. Their natural homes exist:

| Axis | Where its reader would live |
|---|---|
| `HP_REGEN` | `src/systems/hero/RegenSystem.js` |
| `CHARGE_EXTEND` | `Charges.applyDelta` |
| `SELL_BONUS` | `src/systems/board/TokenBank.js` |
| `THORNS_REFLECT` | `CombatAttackProcessor` |
| `STAT_BONUS` | nowhere honest — see §6 Q3 |

### 2.5 The status engine, measured

The blast radius is **eight call sites**, which is what makes ER-7 tractable:

| Status type | Read at | Absorbs into |
|---|---|---|
| `flat_armor` | `CombatFormulas` ×4 (hero armor, enemy armor, and both UI ranges) | `ARMOR` — already a flat axis with a reader |
| `damage_pct` | `CombatFormulas` ×2 (`computeHeroDamage`, `getHeroDamageRange`) | `DAMAGE` — ⚠️ needs a **percentage bucket**; the P7 row is `buckets: ['flat']` |
| `yield_pct` | `LootSystem` ×1, via `getYieldMultiplier` | `YIELD` |
| `attack_fail` | `StatusEffectSystem.rollAttackFailure` ×1 | `ACCURACY` — ⚠️ a **re-authoring**, not a translation (ER-12) |
| `dot` | `StatusEffectSystem._fireStatusTick` ×1 | **nothing — needs a new row** (ER-11) |

What the status engine holds that the library does not, and what happens to it:

* **Stack models, `maxStacks`, layered durations** → retired (ER-9).
* **Five decay triggers** → retired, replaced by duration (ER-8).
* **`combatOnly` clearing and `clearAll` on defeat** → these are *lifecycle*, not
  vocabulary. Cleansing on defeat must survive the absorb; it is not a status
  concept, it is a rule about what dying costs.
* **⚠️ The `hero_downed` publish.** A DoT that empties a hero's HP bar announces
  it and `BoardCombat` runs the ordinary defeat. This branch was a log line and
  nothing else for months (CR2-070) and a poisoned hero worked on at 0 HP. **The
  new `dot` reader must publish it, and exactly one subscriber may kill.**
* **⚠️ The import discipline.** `StatusEffectSystem` must not import
  `BoardCombat` — that is a static cycle, which is why it announces rather than
  acts. Whatever owns the clock after the absorb inherits the same constraint.

### 2.6 The item and enemy bearers have never run on real content

All 54 items carry `effects: []`. `token_thorn_elemental` — the only enemy —
carries none. Everything P4, P6 and P7 built is proven by fixtures and by nothing
else. This is authoring, and the CMS is the only surface for it, so it is the
owner's to do; but until it is done, "the effects system is robust and
functional" is a claim about test doubles.

### 2.7 Nothing renders a status

Grepped across all of `src/ui` and `src/systems/board`: **no component reads
`hero.statuses`.** A hero can be poisoned to death with no visible sign of it.
Out of scope by ER-13, and recorded here because it is the reason every status
phase below is verified by test rather than by playing it (§6 Q5).

## 3. The vocabulary sweep

Every place the effect system offers an author a closed list, and what is missing
from it. This is the survey the owner asked for; it is **inventory, not a plan**
— rows become phases only when something wants them.

| Vocabulary | Where | Rows | The gap |
|---|---|---|---|
| **Keywords** | `statements.js` | 9 | None pursued (ER-4). Candidates considered and declined: `Removes`, `Prevents`, `Spawns`, `Transforms`, `Counts as`. |
| **Reach** | — | **0** | Does not exist. ER-1, P2. |
| **Filter modes** | `TARGET_MODES` | 3 (`all`, `tag`, `id`) | No negation (*"every adjacent Token NOT tagged Coast"*), no multi-tag, no empty-tile, and **no terrain** — despite a full terrain system shipping in v0.7.0. A Token that cares whether it sits on water cannot say so. |
| **Which keywords may filter** | `KEYWORDS.filter` | 5 of 9 | `Acts as`, `Requires`, `Restocks`, `Converts` cannot aim. `Acts as` always hits all eight, which is fine for one pickaxe and will not stay fine. |
| **Skill category** | `mod.target.category` | live, unauthorable | §2.3. *"+10% yield to Mining only"* is read on every cycle and writable by nobody. |
| **Buckets** | `MODIFIER_BUCKETS` | 3 | The six combat axes are `flat` only, because `ModifierAggregator.query` silently skips the other two. ⚠️ `DAMAGE` needs a percentage reader before `damage_pct` can absorb into it (ER-11). |
| **Duration** | `mod.expiry` | live, unauthorable | §2.3. The foundation ER-8 stands on. |
| **Trigger events** | `TRIGGER_EVENTS` | 10 rows / 6 bus events | Published and **not** offered: `TILE_CHANGED`, `HERO_MOVED`, `TOKEN_PLACED`, `TILE_PUSHED`, `SPRITE_COLLECTED`, `CHARGES_CHANGED`, `TRAY_CHANGED`. Not published at all: hero levels up, item sold, quest completed, hero wounded, status applied. The registry's own note calls `TILE_CHANGED`/`HERO_MOVED` "a bigger design surface, not ruled out". |
| **Trigger scopes** | `TRIGGER_SCOPES` | 3 (`adjacent`, `global`, `self`) | No *"the hero working me"* scope, and no board scope — the same hole ER-1 fills for reach, in the other half of the grammar. |
| **Charge moments** | `CHARGE_MOMENTS` | 2 | `on_fire`, `per_cycle`. P5 and P6 of Unified Effects each considered a row and correctly declined one. No known want. |
| **Restriction kinds** | `RESTRICTION_KINDS` | **1** | `adjacency_limit` only. No *"cannot be placed on water"* (terrain again), no *"only N of these on the board"*, no *"must be adjacent to something"*. The palette is explicitly built to take a second row cheaply and has never been given one. |
| **Item-relative targets** | UE-24 | 2 (`hero`, `enemy`) | `Applies` only. Deliberate and probably right — an item has one hero, so the other keywords have one honest reading. |
| **Statuses** | `STATUS_EFFECTS` | 7 | Absorbed (ER-7). Not authorable — code, not data (ER-13, §6 Q5). |
| **Status effect types** | `statusRegistry` | 5 | Retired (ER-11). |
| **Decay triggers** | `statusRegistry` | 5 | Retired (ER-8). |
| **Cleansing** | `purge()` | 1, unreachable | §2.3. Written, called by nothing. Would need a keyword (ER-4 says not now) or a negative-value convention. |

### The three biggest gaps this document does not close

Named so they are decided later rather than forgotten:

1. **Terrain is invisible to the effect system.** It appears twice above — as a
   filter mode and as a restriction kind — and a whole terrain feature shipped in
   v0.7.0 without content being able to react to it.
2. **The board has no "a thing was placed / a hero arrived" moment.** Both events
   are published; neither is offered. Every trigger today is about *work*, never
   about *arrangement*.
3. **Nothing can undo anything.** No cleanse, no dispel, no removal. `purge()` is
   the only such function in the codebase and it is unreachable.

## 4. The phases

One sitting each, verified in the real CMS and the real game before the next
starts, committed at the end.

### P1 — The filter tells the truth *(bug fix, no new vocabulary)*

Smallest and most urgent: an authored rule the sentence describes and the runtime
ignores is worse than a missing feature.

* `TriggerSystem.runStatementActions` honours `statement.to` for `Grants`,
  resolving the same neighbour set `StatusApplication.applyToNeighbours` already
  resolves, rather than dropping on the source tile.
* **`Converts` gains a filter** (ER-14): `filter: true` on the keyword, and the
  same resolved neighbour set for its `produces` list. An absent or `all` filter
  keeps today's behaviour — the firing tile — so nothing authored changes.
* `statementText` renders the `Converts` filter, so the sentence says where the
  output goes.
* `ContentAudit` learns to name a statement whose keyword accepts a filter and
  whose runtime path discards it, so this class of bug reports itself.

**Verified when** a fixture Token granting to a filtered neighbour puts the item
on the neighbour, a Token granting to `all` behaves exactly as it does today, a
filtered conversion produces onto the named neighbour, and `npm test` is back to
its known baseline failures.

### P2 — Reach as a declared vocabulary *(the owner's example)*

* New `src/config/registries/reachRegistry.js` — rows, labels, hints, and which
  keywords may use each (ER-6), shaped like `triggerRegistry.js`.
* Rows, each with its reader named in the same commit: `adjacent` (**the default
  by absence**, ER-5), `self`, `self_and_adjacent`, `board` (resolved through the
  existing global aggregator, not a new scope).
* `applicableStatements`, `applyToNeighbours` and `Restrictions` read the reach
  instead of assuming adjacency.
* `statementText` renders it, so *"to this Token"* and *"to every Token on the
  board"* are words the author reads back.
* CMS: a reach picker beside the filter, hidden on keywords that take none.

⚠️ **Self-reach and recursion.** A Token whose rule reaches itself is the same
shape as `SELF_CYCLE_COMPLETE`, which needed a structural guard rather than a
cooldown. Read the note on `TRIGGER_SCOPES.SELF` and `TriggerSystem`'s cascade cap
**before** wiring `self` into the triggered path.

⚠️ **`board` reach and the three-bucket formula.** Eight Sawmills already stack
uncapped (D-23), justified because effects are small. A board-wide effect is not
small by that argument. Check what `board` does to `applyThreeBucket` before
shipping the row, and expect the answer to be a cap or a ruling, not nothing.

**Verified when** a Token authored to buff itself does, one authored to buff
itself *and* its neighbours does both, every shipped Token behaves exactly as it
did, and the sentence reads correctly for all four rows.

⚠️ **Three things changed from the plan, all deliberate.**

**Reach is offered on three keywords, not on every filtered one.** `Provides`,
`Grants` and `Applies` declare `reach: true`. The four omissions each have a
reason, recorded on `KEYWORDS` in `statements.js`: `Requires`/`Works as` are
statements *about this Token* (ER-6 named these); `Acts as`/`Restocks` have no
filter, and giving them a reach without one would be half a targeting
vocabulary; `Converts` already names a **single destination** through its ER-14
filter, so "how far" adds nothing on top of "which one"; and `Cannot` is a
placement restriction read once by `Placement.js`, where a board-wide rule —
*"no more than three of these anywhere"* — is a genuinely useful and genuinely
different feature that should not arrive as fallout.

**`board` reach lands in the tile aggregators, not the global one.** ER-1 said
"resolved through the existing global aggregator". It resolves through
`applicableStatements` instead, which reaches the same buckets in `resolveAxis`
by a shorter road. The global aggregator is owned by the Guild Hall upgrade
track and is cleared on its own schedule; mixing content-authored modifiers into
something another system calls `clearAll` on is a stale-state bug waiting to
happen, and the per-tile path is rebuilt from board state every time by
construction.

**`applicableStatements` now walks every occupied tile, not eight neighbours.**
It has to: a board-reach source can sit anywhere. At most 36 tiles on a 6×6
board, and it runs on board changes and cycle completions — never per frame, as
the per-frame path reads the cached aggregator. A "does any Token have board
reach?" cache was considered and refused: a stale cache here is a silently
missing effect, which is the exact failure mode this project keeps paying for.

### P3 — Prove the two bearers *(authoring, with the owner)*

Not a code phase. The machinery from P4/P6/P7 meets real content for the first
time: real effects on a weapon (cost 0, permanent), a potion (cost 1, consumed
from the stack) and a tool; real rules on `token_thorn_elemental`, including a
hero-side combat number it scales. Then play them.

**Verified when** the effects fire in the running game, the popup names them, a
potion's stack visibly drains, an empty stack greys the slot without unequipping
(UE-22), and the enemy's rules demonstrably reach the hero fighting it.

⚠️ **Expect this phase to generate the real bug list.** Everything before it is
proven by fixtures.

### P4 — The readable-and-unwritable three

Three palette-level closes, together because they are the same kind of edit and
because **duration is a prerequisite for P6**.

* **`STATUS_IMMUNITY`** — a palette row carrying a `statusId` payload field, the
  way `BONUS_DROP` carries `itemId`. `buckets: ['flat']`, mirroring the P7 combat
  axes. The sentence reads the status by name, never by id.
* **Skill category** — an optional category field on a `Provides` payload,
  written to `mod.target.category`. The vocabulary already exists
  (`TARGET_CATEGORIES`); only the authoring does not.
* **Duration** — an optional lifetime on a statement, written to `mod.expiry`.
  Absent means permanent, which is every effect authored to date (ER-5's trick
  again).

**Verified when** an authored immunity stops the status landing and an un-immune
hero still takes it, and a Mining-scoped yield buff moves Mining and not Fishing.

⚠️ **Duration was cut from this phase and moved to P6, because it has no honest
reader yet.** The plan assumed `mod.expiry` could be authored here. It cannot:
every writer of a modifier today is *continuous* and re-registers on a rebuild —
`rebuildTile` calls `clearAll()` and re-adds, and `syncEquipmentModifiers` does
the same on every equipment change. An authored expiry would therefore be
refreshed before it could ever elapse, which is a silent no-op and exactly the
failure this project exists to remove. Nothing applies a modifier *at a moment*
until P6 makes a status do it, so duration ships there, with its reader.

⚠️ **Two extra closes came with this phase, both the same failure.** The palette
now declares `heroOnly` instead of three separate `group === 'Combat'` checks,
because `STATUS_IMMUNITY` has the property and is not combat. And the CMS now
**hides the reach and target pickers on a hero-only axis** — they were shown for
the combat axes since P7 and read by nothing, and adding the reach picker would
have made a second instance of it.

### P5 — Enemies get an aggregator

Structural, and P6 is unbuildable without it (ER-10).

* A `ModifierAggregator` on the fight, created with the enemy and destroyed with
  it, mirroring the hero's.
* `enemy.armor` and `enemy.blockChance` become seeds of it rather than plain
  fields read in four places.
* `card.combat.enemyStatuses` retired.
* The P7 enemy-side writes move onto it.

**Verified when** every combat number that reads an enemy reads it from one
place, and a fight behaves identically to today.

### P6 — The status absorb

The big one. ER-7 through ER-12.

* `dot` becomes a palette row with a reader on the existing 5-second clock.
  ⚠️ **It must publish `hero_downed`, and exactly one subscriber may kill**
  (CR2-070). ⚠️ It must not import `BoardCombat`.
* `DAMAGE` gains a percentage bucket and a reader for it.
* The eight `sumStatusEffect` call sites become aggregator reads.
* The five status effect types, the five decay triggers, and stacks are deleted.
* The seven shipped statuses are **re-authored by hand** as library entries with
  durations (ER-12); `ContentAudit` names any that has not been.
* `hero.statuses` reshapes — ⚠️ **save-resident and deliberately not stripped**
  ([`GameState.js:21`](../src/state/GameState.js)), so this needs a save
  migration, not just a code change.
* Cleansing on defeat survives as lifecycle, not as a status concept.

**Verified when** poison still kills, a wounded hero is still cleansed, a Well Fed
hero still hits harder, the numbers match what they were before, and every one of
those is checked in the running game — not only in tests.

### P7 — The remaining dead axes, one reader at a time

Each is a palette row **and** its consumer, in the same commit (the rule
`modifierPalette.js` states in its own header). `STAT_BONUS` may simply be retired
rather than built (§6 Q3).

### Deliberately out of scope

* **New keywords** (ER-4) — including a cleanse keyword, though §3 records that
  nothing in the game can undo anything.
* **Heroes, maps and recipes as bearers** (ER-3).
* **Radius, direction, shapes** (ER-2).
* **Statuses as CMS-authored content, and status UI** (ER-13).
* **Terrain-aware filters and restrictions** — §3's largest gap, and its own job.
* **Placement and arrival triggers** — §3's second gap, and its own job.
* **Balance.** Nothing authored uses any of this yet, so no number moves until P3
  does it deliberately.

## 5. Implementation status

| Phase | State | Notes |
|---|---|---|
| P1 The filter tells the truth | **DONE** 2026-09-07 | Triggered `Grants` honours its filter; `Converts` gained one (ER-14). One shared outbound resolver, so `StatusApplication` lost its duplicate loop. 15 new tests, 8 of which fail against the old behaviour. Suite back to its 10 baseline failures. |
| P2 Reach as a vocabulary | **DONE** 2026-09-08 | Four rows in `reachRegistry.js`, read by both the inbound and outbound resolvers. Offered on `Provides`/`Grants`/`Applies` only — see the note below. 20 new tests, 7 of which fail when reach is neutered. Suite back to its 10 baseline failures. |
| P3 Prove the two bearers | **NOT STARTED** | Owner authoring |
| P4 The readable-and-unwritable three | **DONE** 2026-09-08 | `STATUS_IMMUNITY` and the skill scope, both live-and-unwritable, now authorable. **Duration moved to P6** — no honest reader yet, see the note. 15 new tests, 3 of which fail when the wiring is removed. |
| P5 Enemies get an aggregator | **NOT STARTED** | Gates P6 |
| P6 The status absorb | **NOT STARTED** | Needs P4 + P5; needs a save migration |
| P7 The remaining dead axes | **NOT STARTED** | STAT_BONUS retired, not built (ER-15) |

## 6. Open questions

**None blocking.** All five opened by this document were closed by the owner on
2026-09-07:

* *Q1 — do statuses become library effects?* → **ER-7…ER-13.** Yes, fully
  absorbed, with the decay triggers and stacks retired as vocabulary from a
  system the game no longer runs.
* *Q2 — should `Converts` honour a filter?* → **ER-14.** Yes.
* *Q3 — is `STAT_BONUS` built or retired?* → **ER-15.** Retired.
* *Q4 — does `board` reach need a cap?* → **ER-16.** No cap.
* *Q5 — how is P6 verified?* → **ER-17.** A minimal status readout ships with it.

### Raised and deliberately not answered

These are recorded by §3 as inventory. None has a phase, and none should acquire
one as a side effect of another:

* **Terrain-aware filters and restrictions.**
* **Placement and arrival triggers** (`TILE_CHANGED`, `HERO_MOVED`).
* **A cleanse reachable from content** (`purge()` exists and is called by
  nothing).
* **Statuses as CMS-authored content** (ER-13 defers it; the shape should settle
  through P6 first).
