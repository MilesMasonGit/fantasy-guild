# Changelog

All notable changes to Fantasy Guild are recorded here. Version 0.3.0 is the
project's first tagged baseline — everything before it was untagged development.

## [Unreleased]

### 7×7 Playmat Rework — Phase 0: Safety, Branch & Test Re-Pinning

Planning and safety work only. **No gameplay behaviour changes in this phase.**
See `playmat_roadmap_v1.md` for the full plan and `playmat_gap_analysis.md` for
the codebase audit behind it.

#### Added

- **`src/tests/ModifierScopes.test.js`** (15 tests) — rescues three modifier
  rules that were pinned only inside `GlobalAuras.test.js`, which Phase 1
  deletes along with the Outpost system it tests. Re-pinned against bare
  aggregators so they survive: duplicates stack additively (D-23), each copy
  needs a distinct source id, and runtime aggregators must rebuild from state
  after a load. Also pins the rule the adjacency work depends on — **every scope
  merges into one set of buckets** rather than resolving separately and
  multiplying (resolving separately gives ×1.95 where ×1.75 is correct).
- **`src/tests/BankOverflow.test.js`** (5 active, 5 skipped) — documents today's
  full-Bank behaviour (items are destroyed; the cycle is refused) and stages the
  D-138 inversion that Phase 3 enables.

#### Changed

- **Version 0.4.2 → 0.5.0** across all five files.
- **Save schema 0.5.0 → 0.6.0** (D-110). Older saves are refused with a message
  rather than migrated — nothing meaningful maps across the board rework.
- Nine superseded docs moved from the repo root to `docs/archive/`, which now
  explains what each was. The archive README also now points at the roadmap and
  gap analysis first, and carries an explicit warning that
  `playmat_skills_concept.md` is design-ahead and **not a build target**.

#### Fixed (documentation)

- **`RegenSystem` heals constantly, not only idle heroes.** Corrected in grid
  concept §8.1, D-136 and hero concept §3.6, all three of which said idle-only
  and derived the retreat mechanic from it. The conclusion survives on different
  grounds — retreat removes the damage source. Risk 14 stays closed.
- **`TokenAxes.js` must be kept, not retired.** Grid concept §10.3 grouped it
  with the card-mutator system; it is generic and is the only consumer path for
  YIELD/WORK_TIME/INPUT_COST. `GlobalModifiers.js` was omitted from §10.3
  entirely and is likewise kept.
- **Hero traits are not deleted** (§10.1) — they are already cosmetic, so the
  brief and the hero spec were right and §10.1 was the outlier.
- **The hero spec's "90 class perks + 90 trait perks re-home" is wrong** — there
  are 9 and 9, they carry no applied modifiers, and their `bonusSkills` name
  three skills that do not exist in the 15-skill system.

### 7×7 Playmat Rework — Phase 2: The Board — State, Grid & Placement

**The board is manipulable.** Tokens can be placed, shoved around and picked up;
heroes can be stationed and redeployed. Nothing produces anything yet — that is
Phase 4. This is deliberately the earliest possible read on the design's own
most uncertain claim, that *the board itself is enjoyable*.

#### Added

- `systems/board/adjacency.js` — D-81's 8-neighbour rule, the single most
  re-used primitive in the design. Precomputed at module load (the board is a
  fixed size forever) and frozen, so a stray `push` fails loudly instead of
  corrupting every later lookup. `dependentsOf` is the same neighbourhood named
  for wear, which is what D-126/D-157 need.
- `systems/board/BoardState.js` — tile, Tray and Token Bank primitives. Tiles
  are a **sparse map**, so an empty board costs nothing and the tick loop walks
  only what exists. The Token Bank caps **distinct types, never copies** (D-137)
  and draws a full Token before a partial one (D-77).
- `systems/board/Placement.js` — every displacement rule in one module, because
  they interlock. Incoming wins; displaced Tokens go to the Tray, displaced
  heroes to the Dock; any interruption forfeits the cycle (D-54/D-131).
- `config/registries/tokenRegistry.js` — ⚠️ **placeholder** Token types so there
  is something to place. No cycle behaviour; Phase 4 extends the shape and
  Phase 9 replaces the contents.
- `ui/components/board/Board.jsx`, `BoardTile.jsx`, `Tray.jsx` — the live board
  at 128px tiles (896px, D-171), replacing `BoardStub`. The Tray is permanent
  and load-bearing (D-107): an open Bank covers the board, so the only route
  from storage to a tile is Bank → Tray → Board.
- `DRAG_KIND.TOKEN` plus a Token drag ghost that blooms to **exactly tile-sized**
  over the board, so what you carry is already the size of the hole it goes into.
- Dev tools: fill the Tray, clear the board.
- 57 new tests — `Adjacency.test.js` (19, exhaustive across all 49 tiles) and
  `Placement.test.js` (38, every displacement path).

#### Fixed

- **The tile no longer draws a charge counter.** D-85 budgets a tile at exactly
  three things and lists "uses remaining" as *hover only*; a counter per tile put
  36 extra numbers on a full board. Moved to the tooltip — competing text
  elements on a full board dropped **85 → 49**. This is risk 7 (visual clutter
  killed the previous spatial playmat) caught by the standing check rather than
  in Phase 10.
- Removed a dead "Unlock Area Cards" dev button left over from Phase 1; it
  called a state setter that no longer existed and would have thrown on click.

### 7×7 Playmat Rework — Phase 1: Demolition & Dormancy

**The deck loop is deleted.** The game boots to an inert 7×7 board; placement
arrives in Phase 2. This is the clean-break phase — no feature flag, and the
game is deliberately unplayable in the ordinary sense until Phase 4.

#### Removed

- **The loop engine** — all of `systems/loop/` (`LoopRunner`, `DeckSlotManager`,
  `StationManager`, `StationSlotManager`, `OutpostManager`, `SlotFailures`,
  `LoopBuffs`, `AreaModifiers`) and all of `systems/area/`, plus `areaEvents.js`.
- **The card-mutator system** — `TokenRegistry.js`, `SlotTokens.js`,
  `MutatorStamping.js`, `CardTokenOverlay.jsx`. This is what frees the name
  "Token" for board objects.
- **The deck-loop UI** — the whole `banner/` folder (~2,900 lines), the binder
  modal and library, `ActiveCardFace`, `AreaManagerScreen`, `AreaUnlockOverlay`,
  `CardPips`, `CardInspection`, `ItemDurabilityBar`.
- **The pack economy** — `CollectionManager` and `PackOpeningOverlay` (D-153:
  Maps absorbed packs). The roadmap had these surviving until Phase 8 to be
  mined for the Cartographer; they were deleted early instead because the
  mechanics differ in every particular (per-area escalating price and
  pick-1-of-N versus flat within-theme price and a take-everything burst). Git
  history is the reference.
- **Item durability** (D-118) — `DurabilitySystem.js`. Token depletion is now
  the only wear mechanic. Defeat-loss is the only way gear leaves a hero.
- **9 of 14 Guild Upgrade nodes** — the universal-card grant, Outpost banners
  and seven station grants. `stack_size` retired separately: it added +50 to a
  ceiling of 1e12.
- Progression: `BinderManager`, `BinderMastery`. Dev tooling: the card-unlock
  modal and the deck-loop QA buttons.

#### Added

- `systems/board/boardEvents.js` — the board's event vocabulary, successor to
  `areaEvents.js`. Declared ahead of its publishers so surviving systems have
  something to subscribe to; `CYCLE_COMPLETE` is the universal unit of work
  (one kill counts as one cycle, D-129).
- `ui/components/board/BoardStub.jsx` + `boardConstants.js` — an inert 7×7 grid
  at 128px tiles (D-171), Guild Hall fixed at index 24 (D-106), rendered with the
  existing playmat floor art. Exists so the game still boots through the
  demolition, which is the only safety net a no-flag branch has.
- `systems/combat/DefeatPenalties.js` — D-74's rules, extracted from the deleted
  `LoopRunner._applyDeathPenalties` rather than lost with it.
- `ui/components/base/VitalBar.jsx` — rescued from the deleted banner folder.
- `state.board` in the schema (`tiles` / `tokenBank` / `tray`), with `GameState`
  accessors. Save roundtrip verified.

#### Changed

- **`TokenAxes.js` → `EffectAxes.js`** and **`GlobalModifiers.js` →
  `effects/GuildModifiers.js`** — both kept, per the gap analysis. `EffectAxes`
  is the only consumer path for YIELD/WORK_TIME/INPUT_COST.
- **The Hero Dock speaks tiles, not areas.** `describeActivity` takes
  `tile` / `tileStatus` / `tokenName`; its pip vocabulary is unchanged and is
  D-172's yellow idle-hero mark. ⚠️ Tile 0 is a valid index, so placement is
  tested with `== null` — a truthiness check would show a hero working the
  corner tile as "Reserve" forever.
- **Energy is muted** (D-183/D-184). Both cost constants now have zero
  consumers — the cut landed for free once card draws and Outposts were gone,
  needing no removal pass. The pool, Drink category and `tryDrink` stay dormant
  (~180 refs across ~45 files); the Dock's Energy bar is hidden.
- **Quests are muted** — the board tick is unregistered and `QuestTracker`
  short-circuits behind `QUESTS_ENABLED`. ⚠️ Its *area-unlock quest* half was
  deleted outright (§10.1 lists those), which is different from dormant.
- `data/cards/` → `data/archive/cards/`; the card glob is now empty.
- `StatusEffectSystem` decays cycle-duration buffs on `BOARD_EVENTS.CYCLE_COMPLETE`
  instead of a per-area card completion, and no longer clears statuses on
  "leaving an area" — a hero moving between tiles is the game's most frequent
  action, so clearing there would delete a buff the player just bought.

#### Tests

39 files/563 tests → **29 files/341 passing + 5 skipped**. `Mutators.test.js`
trimmed from 130 to 57 (three-bucket maths, tag derivation and the effect axes
survive; slot-token lifecycle, stamping, the Area Anchor and badge data go).
`DefeatPenalties` re-pointed at the extracted module. `SaveRoundtrip`'s
serialization case re-pointed from areas/outposts to board state, including that
an unlimited-use Token's `null` charges must not come back as `0`.

### Changed

- **Banner rows are one card slot narrower.** The width formula reserved six
  card slots, but both banner kinds render five — an area is Info / Hero /
  Active / Next / Deck, an Outpost is Info / Hero / Inputs / Output / Station.
  The sixth was left over from before Outposts split into their own banners
  (D-16), and showed as ~116px of dead space on the right of every banner. At
  the current card width the banner goes 784px → 668px.
- **Notifications default to the top right again**, reversing the earlier move
  to centre-bottom. The migration that used to rewrite stored `top_right`
  values onto `center_bottom` has been removed rather than left fighting the
  value it now rewrites to.
- **Master volume defaults to 0** while the game is in development. A one-time,
  marker-guarded migration also clears any master volume already in
  localStorage, so existing browsers go quiet too; raising it afterwards
  persists normally.
- **The Time Bank widget is hidden.** Parked behind a `SHOW_TIME_BANK` flag in
  `ReactRoot.jsx`, not deleted — the widget and `TimeBankManager` are untouched.

### Changed — Hero Dock

- **The activity badge is now a bare status pip.** Four colours and no words:
  red injured, yellow assigned-but-stopped, green working, blue available. The
  area name moved into the hover tooltip. Yellow deliberately covers *every*
  stopped state — out of inputs, out of energy, bank full, or a banner paused
  by hand — so the rule the player learns is simply "yellow means this hero
  isn't doing anything" (owner decision 2026-08-02).
- **Gear and skills now share the card body behind a toggle.** Both grids used
  to render stacked into a body too short to hold them, silently clipping the
  bottom rows of skills. One section shows at a time; the toggle is dock-wide
  rather than per-card, so two cards pinned for comparison always show the same
  side. The Edit button moved into that toggle row, where it no longer covers
  the ninth equipment slot.
- **HP and energy bars on the dock card header**, using the same `VitalBar` the
  banner hero cards use.
- **The dock now lifts to sit on an open bottom drawer.** It moved inside the
  play area, so it anchors to the bottom of the banner region rather than the
  screen: flush to the screen edge with no drawer open, resting exactly on the
  drawer's top edge when one opens, instead of covering its lowest band.

### Fixed

- **Crash when a hero with an equipped Consumable started a loop.** The Prep
  Phase branch of `ActiveCardCell` read `engine.GameState` in a component that
  never called `useEngine()`, so the banner threw `ReferenceError: engine is
  not defined` the moment an area entered `prepping`. Present since the Prep
  Phase landed (`d4dd4f0`); it only fired for heroes actually carrying a
  potion, scroll or rune, which is why it went unnoticed.
- **Food and drink can be equipped again.** Prepared dishes and drinks authored
  in `data/items.json` carried no `equipSlot`, so `EquipmentManager.equipItem`
  rejected every one of them with "Item cannot be equipped" — before any of the
  drag-and-drop code was reached. This was invisible in testing because the
  legacy item table in `itemRegistry.js` defines a parallel set of food ids
  (`apple`, `blueberry`, `drink_water`) that *do* declare an `equipSlot`; only
  the `item_*` ids the player can actually obtain were affected. Water, the
  three pies and both stew lines (six tiers) now declare `food`/`drink`.
- **Water restores energy again.** `item_water` had a `restoreType` but no
  `restoreAmount`, so drinking it did nothing. It now mirrors its legacy twin
  `drink_water` (20 energy).

### Changed

- **Raw ingredients are no longer hero food** (owner decision 2026-08-02).
  Single berries, carrot, celery, cherry, shrimp and steak stay pure crafting
  materials; only prepared dishes and drinks can be equipped. This is a
  deliberate change from the legacy table, which let heroes eat raw meat.
- `item_cherry_pie` gained a `restoreAmount` of 8, interpolated between
  blueberry pie (5) and blackberry pie (11). **Needs a balance review** — its
  `baseValue` is still 0 and it has no recipe.

## [0.4.2] — 2026-08-01

The **Area Deck Loop rework**, complete. Tagged `v0.4.2`. Outposts became their
own banners, card ownership moved into per-area binders, the economy went
per-area, and defeat has real consequences again.

**⚠ This release breaks save compatibility** — the save schema version moves to
`0.5.0` and older saves are refused, by design. (The save schema and the app
version are deliberately independent.)

### Area Deck Rework — Outposts are their own banners (C-10)

- **Outposts split off from areas.** An Outpost used to be the "stationed" face
  of an area banner, reached by a Wilds/Outpost toggle. It is now a **standalone
  banner** holding one card, and an area banner has a single face with no
  toggle. Outpost effects are guild-wide rather than limited to one region.
- **The playmat is yours to arrange.** Areas and Outposts sit in one list you
  can reorder, and any banner can be taken **off the playmat** — that stops its
  work and returns its hero to the roster, while keeping its deck, installed
  card and progress for when you put it back. Both live in the Area Manager.
- **The station Drink slot is gone.** A hero crafting at an Outpost drinks from
  their own loadout, exactly as they do in the wilds.
- **⚠ Save break.** The save schema version moves `0.4.0` → `0.5.0`, so saves
  from earlier versions are refused and a new game is required. (This is the
  save-schema gate only; it is independent of the app version.)

### Outpost cards come from the Guild Hall (C-12)

- **The guild tree is now the only source of Outpost cards.** They aren't
  crafted, dropped, or pulled from packs — you buy them as tree nodes, and
  **each rank grants another copy**, which is how aura stacking is supplied.
- **New "Outpost Banners" node.** You start with one banner and can establish up
  to four; each new one arrives with a card already installed rather than as an
  empty frame.
- **Cards for regions you haven't reached are hidden**, so the tree grows as you
  explore rather than showing a wall of locked rows.
- The Guild Hall now separates capacity upgrades, Outpost cards and Universal
  cards, and shows how many copies of each card you own.

### Cleanup (C-17, C-18)

- **Fixed: a hero could work two places at once** — staffing an area and an
  Outpost simultaneously, which quietly doubled a deliberately scarce resource.
- **Fixed:** the same hero could be added to the roster twice.
- Retired the leftovers of replaced systems: the unreachable Guild Bonuses
  window, dead map-fragment and pack-cost helpers, and stale fields in the area
  data.

### Losing a hero actually costs you (C-9)

- **A defeated hero comes home.** They're pulled off the banner entirely and
  recover in the roster, so the banner sits empty and clearly marked
  **Defeated** until you decide who goes back in — which may be someone else.
- **Defeat destroys supplies again.** A quarter of each consumable you were
  carrying is lost from the bank. This had quietly stopped working when
  consumables moved onto the hero's loadout grid; it was looking for them in
  the deck, where they no longer live.
- Equipped gear still has a chance to break permanently on defeat.

### Finishing a binder now means something (C-19)

- **Area Mastery.** Collect every card in an area and that area keeps a
  permanent bonus — so a completed region stays worth running once its packs
  stop selling. It shows as a badge beside the binder, fires once, and survives
  reloading.
- **Fixed (again, properly):** cards were still only dropping one item at a
  time. The earlier fix had been applied to the preview code rather than the
  code that actually hands out loot.

### The Whispering Woods opens up (C-16)

- **A second real area.** The Woods went from one card to eight — timber and
  forage routes, a spider-silk haul that poisons you, a woodsman's camp that
  both heals and speeds up everything after it, a Thorn Elemental to fight, and
  two Boosts: one that lights the whole loop and one that marks only the next
  card.
- **Areas now open by trade, not by button.** The Woods unlock when you hand
  over Guild Hall timber and flour; the Misty Mountains want rope braided from
  Woods spider silk. Every region pays for the next one.
- **Everything the Woods produces has a use** — silk becomes rope, glowcaps
  become a drink that keeps a hero working, yew burns down to charcoal.
- **Fixed:** cards were only ever dropping one item at a time no matter what
  their card said, two recipes consumed materials and produced nothing, and the
  Misty Mountains were unreachable because their unlock asked for an item that
  did not exist.

### Big numbers and authored prices (C-15)

- **Stacks no longer cap at 99.** Almost every item was limited to 99 in a
  stack, which quietly made any productive task fail once the bank filled.
  Items now hold effectively unlimited quantities; genuine one-off gear is
  unaffected.
- **Authored pack prices now actually apply.** Each area's hand-set price was
  being ignored, so every region charged the same. The Guild Hall, Whispering
  Woods and Misty Mountains now cost what their data says.
- **Huge numbers read properly** — quadrillions and beyond get short suffixes
  instead of a wall of digits, everywhere in the UI rather than in some places.

### Booster packs are per-area (C-14)

- **Each area sells its own packs, containing only its own cards.** Prices run
  on that area's own curve — the first pack is cheap and each one costs 20%
  more than the last, so completing a region is a real economic arc.
- **Buy at the banner**, next to the binder it fills. The old Pack Shop screen
  is now a read-only overview of every area's progress and next price.
- **Boosts are rare without being rigged.** The pool is drawn from copies you
  still need, so a one-of-a-kind Boost is naturally four times rarer than an
  ordinary card — and gets steadily likelier as the rest of the binder fills.
  No pity timer, no hidden drop table.
- **A finished binder stops selling packs**, and a maxed card never appears
  again.

### Crafting upkeep (C-13)

- **Crafters feed themselves from their own kit.** A hero working an Outpost
  drinks from their loadout grid exactly as they do in the wilds — the
  station-side Drink slot is gone entirely. Keep the bank stocked and they run
  unattended; let it run dry and they stall with a clear "Out of energy" on the
  banner.
- **Fixed a latent stall:** a recipe costing more than a quarter of a hero's
  energy could have hung forever with a full waterskin equipped, because the
  hero never got "low" enough to reach for it.

### Global Outpost auras (C-11)

- **Outpost auras now reach every area.** An installed Outpost card's buff is
  guild-wide rather than helping only the region it sits in — the reason
  Outposts are scarce and worth fighting over.
- **Duplicates stack additively.** Two copies of a +20% aura give +40%, not the
  compounded +44%.
- **Passive Outposts.** Three new cards that craft nothing and exist purely for
  their aura — the Guild Smithy, the Surveyor's Post (which carries *two*
  unrelated auras at once), and the Wayfarer's Rest, which runs with **no hero
  assigned at all**. Whether a card needs a body is now a per-card property.
- **Aura strength is the designer's to set,** with no fixed power tiers, and a
  card may carry a list of effects rather than a single one.
- **Fixed:** station buffs silently stopped working after the Outpost split, and
  a new game could start with no Outpost banner at all.

## [0.4.1] — 2026-07-31

A tooling and planning baseline, tagged `v0.4.1`. **No player-facing changes and
no save break** — the save schema version stays `0.4.0`, so existing saves load
normally. This tag exists as a clean rollback point before the Area Deck Rework
begins.

### CMS Rework (Phases 0–4 core)

The standalone content tool in `cms/` was reworked to catch up with the game and
make authoring faster and sync safe. Plan and decisions live in
`cms_rework_concept.md` and `cms_rework_roadmap_v1.md`.

- **Phase 1 — shared vocabulary.** The CMS now reads the game's own registries,
  so skills, card types, tags and equip slots flow game → CMS rather than being
  duplicated and drifting.
- **Phase 2 — round-trip import.** Game `data/` can be imported back into the
  CMS, giving a reconciliation path.
- **Phase 3 — field-level merge sync.** *The safety phase.* The destructive
  whole-file sync was replaced with a field-level merge plus preview and staged
  deletion. An unchanged import → sync is now a no-op, and edits write only the
  fields that changed, preserving mutators, tokens, `deckSlots` and card tags.
- **Phase 4 (core) — unified card model.** Card type is now derived from content
  (`inferCardType`) rather than hand-set; one unified `CardEditor` replaces the
  per-type editors, with a token picker, `cardType` write-back and an ambush
  guard. Recipe/station unification and the owner UX review remain outstanding.

### Data

- Retired 11 orphaned card files (22 cards) that no registry referenced.
- Resolved the duplicate `task_rocky_outcrop` id — the Misty Mountains
  definition is kept and the Sunken Bog copy removed.

### Documentation

- **Area Deck Rework designed in full** — `area_deck_rework_concept_v3.md`
  records 67 locked decisions with no open questions, and
  `area_deck_rework_roadmap_v1.md` breaks the build into 19 components across
  7 layers with a reuse/rewrite verdict per component.
- `CLAUDE.md` slimmed to working conventions; finished work archived in the new
  `PROJECT_HISTORY.md`.

## [0.4.0] — 2026-07-22

The Hero Dock rework, complete. Tagged as `v0.4.0`. Heroes now live in an
always-visible strip along the bottom of the screen; equipment expanded from
two slots to six; the Bench was retired; and the pop-out Heroes drawer is gone.
**This release breaks save compatibility** — the save schema version is
`0.4.0` and older saves are refused, by design.

### Hero Dock (Phase 0 — reality check & save break)

Groundwork for the Hero Dock rework. Nothing is player-visible yet.

- **Save compatibility is intentionally broken.** The save schema version moves
  from `0.2.0` to `0.4.0` because the coming phases remove the hero Bench
  outright and change hero equipment from two slots to six. Existing saves are
  refused with the standard incompatible-version message rather than migrated —
  the same deliberate choice the Area Deck Loop rework made.
- Architecture findings F1–F9 in `hero_dock_roadmap_v1.md` re-verified against
  the merged v0.3.1 code; none had drifted.

### Hero Dock (Phase 1 — six equipment slots)

**Heroes now carry six pieces of gear instead of two:** two Hands, a Hat, a
Chest, and two Trinkets.

- Either hand takes any weapon and both sets of bonuses count, so a hero
  wielding two weapons gets the benefit of both. Equipping fills the left hand
  first, then the right; a third weapon replaces whatever is in the left.
- Where the game needs to name *one* weapon — which fighting style the hero
  uses, and which weapon wears down when they swing — it uses the **primary**
  weapon, meaning the first occupied hand. A hero with a single weapon behaves
  exactly as before.
- Existing gear was reclassified: the twelve weapons became Hand items and the
  two armours became Chest items. **Hats and Trinkets have no items yet** —
  those arrive in the next phase.
- Armour wear now lands on the Chest slot, and a defender's Hat and Trinkets
  each have a chance to take incidental damage. (That roll previously targeted
  four slots that never existed, so it silently did nothing.)

### Hero Dock (Phase 2 — starter hats and trinkets)

**Eight new items**, so the four new slots have something to put in them.

- **Hats:** Straw Hat, Leather Cap, Miner's Helm, Iron Helm — a small armour
  ladder, with the Iron Helm gated behind Defence 5. These have no artwork yet
  and show their emoji until sprites are drawn.
- **Trinkets:** Sapphire Band (accuracy), Ruby Signet (damage), Emerald Pendant
  (damage reduction), Iron Chain (armour). These reuse the ring and amulet art
  already in the project.
- **Two are findable in normal play:** the Miner's Helm drops from Copper
  Miners, and the Iron Chain from Skeleton Warriors — an enemy that until now
  dropped nothing at all.

Every one of these was checked in-game to confirm it actually changes a number.
Several stat types the game *offers* on items turn out to be wired to nothing —
health bonuses, skill bonuses, evasion, and energy efficiency all register
silently and have no effect. The new gear deliberately avoids them. This is a
long-standing gap rather than a new one, and it is now documented for whoever
adds equipment next.

### Hero Dock (Phase 3 — the Bench is retired)

**There is no Bench any more.** Your roster is your roster: every hero you own
is one you can deploy.

- **Recruiting is refused when the roster is full**, rather than quietly
  parking the new hero on a bench you had to go and find. The message tells you
  what to do about it: retire a hero, or upgrade the Guild Hall for another
  slot.
- **You are never charged for a refused hire.** The check happens before any
  Influence is spent, and the candidates stay on offer, so you can make room
  and come back to them.
- Retiring a hero frees the slot immediately, and Guild Hall roster upgrades
  raise the cap as they always did.
- "Move to Bench" and "Move to Active Roster" are gone from the hero sheet.
  Deploying and retiring are the only roster actions now.

### Hero Dock (Phase 4 — the dock appears)

**Your heroes now live along the bottom of the screen, always visible.** No
more opening a drawer to see who you have.

- Each hero gets a tab showing their portrait, name, level, and what they are
  currently doing — the area they are deployed to, "Reserve" if they are idle,
  "Combat" while their area is fighting, or "Injured" if they are hurt.
- Tabs sit in a fixed order and overlap like cards held in a hand. Hovering one
  lifts it clear of its neighbours so you can read it.
- The dock floats over the play area rather than squashing it, and the banner
  list and Bank drawer both leave room so nothing ends up stranded underneath.

Clicking a tab does nothing yet — pulling a card open to see equipment and
skills comes next, followed by dragging heroes onto banners.

### Hero Dock (Phase 5 — pulling a card open)

**Click a hero's tab and their card pulls up out of the dock**, revealing
their six equipment slots and all fifteen skills underneath.

- **Two cards can be open at once**, side by side, for comparing heroes.
  Opening a third closes whichever has been open longest.
- Equipment shows as item icons in two rows of three; hover any slot to see
  what's in it. Skills show as a grid of icons and levels, with combat skills
  tinted apart from the rest — hover for the full name.
- Clicking a card's header closes just that card. Clicking anywhere outside
  the dock closes them all. Clicking inside an open card leaves it alone.

The card is the same object throughout: the strip shows its top edge, and
pinning slides the whole thing up so the rest comes into view.

### Hero Dock (Phase 6 — drag and drop)

**The dock is now how you move heroes and gear around.**

- **Drag a hero up onto a banner** to deploy them there.
- **Drag them back down onto the dock** to recall them — anywhere on the dock
  works, including onto another hero's tab. There's also a small ✕ in the
  corner of a deployed hero's card on the banner if you'd rather just click.
- **Drag an item from the Bank onto a hero's tab** to equip it. It goes to the
  right slot automatically, and swaps out whatever was there.
- **On an open card, click a piece of gear** to send it back to the Bank, or
  **drag it onto another hero's tab** to hand it straight over.

Dropping something somewhere invalid springs it back and changes nothing.

### Hero Dock (Phase 7 — Edit, and the old drawer is gone)

**The Hero Dock has fully replaced the pop-out Heroes drawer**, which no
longer exists. Neither does the Heroes button in the side menu — your heroes
are always on screen, so there was nothing left to open.

- **New Edit button** on an open hero card. It opens a small window where you
  can rename the hero, pick a new portrait from all 29 available, or retire
  them.
- **Retiring now explains itself.** A hero can only be retired if they're worth
  more Influence than a new recruit costs — previously the button just failed
  when you clicked it. Now it's greyed out and tells you why: *"This hero is
  worth less (1) than a new recruit costs (12). Level them up first."*
- Retirement still asks you to click twice to confirm.

Cards and items are unaffected — the Bank and Cards panes inspect exactly as
before.

### Hero Dock (Phase 8 — small screens and polish)

- **The dock collapses when it runs out of room.** Hero tabs shrink to small
  square portraits with a coloured dot showing whether that hero is deployed or
  hurt. Opening a hero still shows their full card. It only collapses when your
  roster genuinely doesn't fit, so a small guild keeps full-size tabs on a
  narrow window while a large one tidies itself away.
- **Tabs press down when you click them**, so a click feels distinct from the
  start of a drag.
- **Pulling a card open and pushing it closed now have their own sounds.**

### Hero Dock (Phase 9 — cleanup)

Removed the last of the pre-rework hero interface, which had been sitting in
the project unused since the deck-loop rework. No visible change; the game is
six files lighter and there is one less way for a future change to go wrong.

## [0.3.1] — 2026-07-21

The Card Mutators & Tokens feature, complete. Tagged as `v0.3.1`.

> **One check outstanding:** a token badge has not yet been *seen* rendering in
> the live game. Everything upstream of it is verified and the badge logic is
> unit-tested — see the note at the top of `mutator_roadmap_v1.md` for the
> 30-second manual check that closes it out.

### Card Mutators & Tokens (Phase 0 — scaffolding)

Inert groundwork for the Card Mutator system. Nothing is player-visible yet.

- New `CARD_TYPES.ACTION` card type, covering both Mutators (cards that stamp
  Tokens onto other cards) and consumables (cards that apply Status Effects).
  Which one a card is comes from its traits, not a separate field.
- New `src/config/registries/TokenRegistry.js` — the data-driven registry Tokens
  will be defined in. Ships with the schema and documentation only; the actual
  token catalog lands in a later phase.
- New `src/tests/Mutators.test.js` test scaffold.

### Card Mutators & Tokens (Phase 1 — Three-Bucket modifier engine)

The core maths that decides how buffs and penalties stack has been rebuilt.

- **Bonuses now stack in three separate piles, settled in order.** Flat bonuses
  ("+1 shrimp") are added up together with the card's own base value; then
  multipliers ("double it") are added up and applied; then percentages ("+25%")
  are added up and applied.
- **Nothing within a pile compounds.** Two multipliers of ×2 and ×3 give ×5.
  Two percentage bonuses of +25% and +50% give +75%, *not* +87.5% and not
  +175%. A percentage bonus never inflates another percentage bonus.
- Worked example: a task producing 1 shrimp, with a "+1 shrimp" effect, a
  "double fishing output" effect and a "+25% shrimp" effect, produces
  **5 shrimp** — `(1 + 1) × 2 × 1.25`.
- **A card with no modifiers comes out exactly at its base value**, and a pile
  of penalties can never push a result below zero.
- Speed sources that used to be multiplied together in a chain — the hero's own
  bonuses, an area's station buff, an equipped tool, and mastery — now all feed
  these shared piles. Tools and mastery count as percentage bonuses, so two
  +25% speed sources make a task 50% faster rather than 150% faster.
- **Work times and yields will have shifted.** That is expected: all current
  content is test content, and nothing was retuned to preserve the old numbers.

### Card Mutators & Tokens (Phase 2 — Card tags)

Every card now carries a list of descriptive labels — its **tags**. Mutators
will use these to decide which cards they can affect ("the next 3 Aquatic
cards"). Nothing is player-visible yet.

- **Tags are worked out automatically from what a card already says about
  itself.** No card in the catalog had to be hand-labelled. A card's tags come
  from its type, its skill, that skill's parent skill and category, a station's
  subskill, and whether the card can start an unexpected fight.
- Worked examples from the live catalog: *Shrimp River* → `Task, Aquatic,
  Gathering`; *Berry Bush Patch* → `Task, Nature, Gathering, Hazard` (it can
  spring a thorn elemental on you); *Wolf Den* → `Combat`; *Smelting Furnace* →
  `Station, Labor, Gathering, Smelting`.
- **Combat cards are tagged too**, which is what will let a future "Hex" mutator
  find and curse an upcoming fight.
- **Old skill names no longer leak into tags.** A card still written against the
  pre-15-skill `nautical` skill is tagged `Aquatic`, never `Nautical`, so only
  one label for a concept ever circulates.
- **Tags always use the same capitalisation** (`Fishing`, never `fishing`), so
  the same tag can never appear twice in two different spellings.
- A deliberately tiny hand-written override list exists for flavour a card's own
  data cannot express — currently one entry, the *Wishing Well*, which is a
  water card worked with the Nature skill.
- Tags are recalculated from the card catalog rather than saved, so a card
  definition change takes effect immediately and old saves need no migration.

### Card Mutators & Tokens (Phase 3 — Token data model & lifecycle)

The plumbing that lets a Token ride along on a card. Nothing stamps Tokens yet
— that is the next phase — so nothing is player-visible.

- **Tokens attach to deck slots, not to cards.** A card that hasn't been drawn
  yet doesn't exist as an object; a slot is just "this position holds the Shrimp
  River card". So a Mutator marks the *position*, and the mark is applied to the
  real card the moment that position comes up and the card is dealt.
- **A Token remembers almost nothing.** It stores only which token it is, which
  card stamped it, and how many charges it has. What it actually *does* is
  looked up fresh from the token registry every time it is applied — so
  retuning a Token takes effect immediately, everywhere, with no stale copies
  stranded on slots mid-game.
- **Stacking is by count, not by merging.** Five copies of the same Token on one
  card are five separate marks, each traceable back to the Mutator that placed
  it. That is what will later let the UI show a `×5` badge and still explain
  where every one of them came from.
- **Everything is wiped at the end of a Cycle** — one full pass through the
  deck — spent or not. Unused charges are never carried into the next Cycle.
  Tokens are also cleared when the loop is reset (a deck or hero change) and
  whenever a save is loaded.
- **Tokens are never saved.** A Token can live at most one Cycle, and anything
  that interrupts a Cycle clears them anyway, so loading a save always starts
  the Cycle clean. This keeps the save file format untouched.
- Effects are filed into the three stacking piles from Phase 1 — flat,
  multiplier, percentage — exactly as the Token's definition declares, so a
  Token's maths behaves identically to a gear bonus or a station buff.
- Groundwork for the three effect axes a Token can touch — **Yield**, **Work
  Time** and **Input Cost**. They are recorded but nothing reads them yet; the
  systems that spend them arrive in a later phase. Work Time is kept
  deliberately separate from work *speed*, so a Token that makes a card take
  longer can never be misread as making it faster.
- A Token can also be removed by name — the groundwork for cures that counter
  one specific affliction rather than sweeping away all bad effects.

### Card Mutators & Tokens (Phase 4 — ACTION cards & stamping)

Mutators now actually place their Tokens. Still no player-visible effect,
because what a Token *does* (change yield, time, cost) isn't wired until the
next phase — but the placing itself is live and tested.

- **Working a Mutator stamps its Token onto matching upcoming cards.** A
  Mutator is an ordinary card carrying a "stamp this token" instruction. When
  the Hero reaches it and works it, the engine walks the rest of the deck for
  this pass and marks the cards whose tags match — e.g. a Trawler marks the
  upcoming Aquatic cards.
- **Two targeting modes.** *Charges*: mark the first N matching cards, and any
  leftover charges with nothing to mark are wasted, never saved for later.
  *Area*: mark every matching card left in the pass.
- **Only ever looks forward.** A Mutator never affects a card already worked
  this pass, and never reaches into the next pass (which is wiped clean anyway).
  Empty slots and terrain hazards are skipped — there is no card there to mark.
- **Action cards can now be put in decks** (`CARD_TYPES.ACTION` is slottable).
- Groundwork, dormant until content exists: a Mutator can name specific tokens
  to *strip* from a card — a targeted cure, never a blanket cleanse.

### Card Mutators & Tokens (Phase 5 — Yield / Time / Cost axes)

Stamped Tokens now actually **do** something. This is the first phase with a
visible effect: a Token on a card changes what it produces, how long it takes,
or what it costs.

- **Yield** — a Token that boosts output scales the items a card produces
  (e.g. a Trawler doubling a fishing card's catch).
- **Work Time** — a Token that lengthens or shortens a card changes how long
  it takes to work, on top of any tool or station speed already in play.
- **Input Cost** — a Token can raise or lower how many ingredients a card
  consumes.
- **Hard floors (§10), in one place.** A card can never be driven below one
  second however much speed-up is stacked on it, and an input cost can never
  drop below one unit. The floors only bite once a Token has actually acted, so
  a naturally quick card is left alone.
- All three run through the same three-pile maths from Phase 1, so a Token
  stacks cleanly with gear, station buffs and (later) status effects.
- Verified against the real work-cycle pipeline: a 4-second fishing card
  becomes 8 seconds and yields double under a ×2 Trawler, and a ×2 time penalty
  fought with five stacked −20% speed-ups floors at one second rather than
  hitting zero.

### Card Mutators & Tokens (Phase 6 — Failure states)

Cards can now genuinely fail, and a failure costs the player the time they
spent without giving anything back.

- **Fixed: a card could pay out before checking it could afford itself.** Loot
  was granted first and the ingredients were only taken afterwards, so a card
  short on materials still handed over its output. The whole exchange is now
  decided up front — either a card produces *and* pays, or it does neither.
- **A card starved of ingredients fails.** The full work time is spent, nothing
  is produced, and nothing is consumed. Any Token riding that card is wasted
  all the same.
- **A card whose output has nowhere to go fails.** If the bank cannot store
  *any* of what a card could produce, the card fails rather than quietly
  binning the result. A card that could produce several different things only
  fails when there is room for none of them — one full stack no longer throws
  away the outputs that would have fit.
- **A failed card still resolves.** It is a full completion that happens to
  produce nothing, not a skipped turn — which is what later "at the end of a
  card" effects will hang off.
- **A failed card earns nothing at all** — no XP, no reward items, no quest
  progress. Previously a card could fail and still hand over its XP.
  Environmental effects are the exception: a hazard that poisons the hero
  still poisons them, because that is something the card *does* to you rather
  than something it pays you. The tool still takes its wear, since the hero
  spent the full time working.
- A cost-raising Token can now starve a card that would otherwise have
  succeeded, which is the intended trade-off: greedy combos need the supply
  chain to back them up.

Not yet visible: the "Failed!" stamp and the at-a-glance bottleneck view come
with the Token UI work.

### Card Mutators & Tokens (Phase 7 — Combat axis / Hex)

Mutators can now debuff enemies, not just tune the economy.

- **A Hex-style Token applies real Status Effects to the enemy** when the combat
  card comes up. The enemy is already poisoned the moment the fight starts, and
  the poison ticks its health down exactly as it would from any other source —
  it can even finish a weak enemy before the hero swings.
- This deliberately adds **no new combat maths**. The Token hands its statuses
  to the existing status engine, the same route a poison weapon already uses,
  so a hexed enemy is indistinguishable from one poisoned in a fight. Enemies
  have been able to carry statuses since the combat engine landed; this simply
  gives Mutators a way to put them there.
- A combat Token stamped onto an ordinary task card quietly does nothing rather
  than erroring.

### Card Mutators & Tokens (Phase 8 — Area Anchor)

An area can now apply its own global effect through a locked Mutator card
pinned to the front of its deck, instead of an invisible area-wide penalty. The
hero works it first each pass, and it broadcasts to the rest of the deck.

- **No new machinery was needed**, which was the point of this step: areas could
  already pin a locked card into a deck position, the loop already works a
  locked card like any other, and the "affect every matching card" mode built
  earlier does the broadcasting.
- **Fixed: locked cards were being skipped by mutator effects.** "Locked" only
  means *the player can't swap that card out* — the hero still works it. Any
  effect that sweeps the deck was ignoring those cards, which would have made a
  curse-the-next-enemy effect unable to touch the very enemies areas pin in
  place. Empty slots and terrain hazards are still skipped, since there is no
  card there to mark.
- An anchor never marks itself, and its effect is wiped at the end of the pass
  like any other — it has to be worked again next time round.

No area ships with an anchor yet; that arrives with the card catalog.

### Card Mutators & Tokens (Phase 9 — Token badges & failure marks)

The first phase you can actually *see*.

- **A failed card is now stamped "FAILED!"** — a red mark across the card face,
  on the card being worked and on every failed card in the deck view, so a
  supply bottleneck is obvious at a glance rather than something you infer from
  resources not appearing.
- The stamp explains itself on hover: whether the card ran short of materials
  or the bank had nowhere to put what it makes.
- **Tokens show as small badges on the card face**, including on cards not yet
  drawn — you can see what's waiting further down the deck and prepare for it.
- **Identical tokens condense into one badge with a count**, so fifty stacked
  effects read as a single icon with a "×50" rather than fifty icons.
- Hovering a badge traces the whole thing: what it does in numbers, what it
  means in words, and which card put it there.
- Three tokens are authored — Abundance, Trawler and Hex — along with the
  mutator cards that place them. (Cursed and its counter Dam were dropped:
  nothing in the game applies a curse, so both were decoration.)
- **Adding a Mutator to a deck now picks a slot where it can actually do
  something** — one with cards after it, since a Mutator only affects what
  comes later in the pass.

**Not finished:** the token badges have been proven by tests rather than seen
in play — that needs a Mutator sitting ahead of a matching card with the loop
running past it, which is a few seconds' work with a mouse.

### Fixed — crafting stations were classified as gathering

- **Smelting, smithing, toolsmithing, jewelry and baking now count as
  Processing rather than Gathering.** These subskills were still filed under
  the retired pre-15-skill groupings (`industry`, `culinary`), and `industry`
  bundled Mining — which genuinely is gathering — together with the smithing
  lines, which are not. Every crafting station therefore inherited the wrong
  skill category.
- This surfaced through the new card tags: a Smelting Furnace was tagged
  `Gathering`, meaning a future "double all Gathering output" effect would have
  wrongly boosted furnaces. Stations now tag as `Processing`.
- Subskill parents are now canonical 15-skill values throughout, so nothing
  relies on the legacy alias table any more.

## [0.3.0] — 2026-07-19

The Area Deck Loop release. This version replaces the original playmat/grid
system entirely, rebuilds combat and progression on top of it, and closes out a
full codebase review. It is the new baseline: `main` and this tag represent the
canonical game going forward.

### Area Deck Loop rework (Phases 0–9)

The playmat and its 2D grid are gone. Areas are now decks of cards that run on a
backend loop.

- Core data schema and state rebuilt around areas, decks, and cards.
- `LoopRunner` backend loop engine drives area progression.
- Station crafting integrated as a queue.
- Unified booster shop and card collection replacing the old acquisition paths.
- Area Banner Row frontend layout; sidebar retired in favour of a bottom folder
  drawer.
- Time Bank — offline progress is banked and fast-forwarded on return, and every
  timed system scales correctly under it.
- Phase 9 sweep deleted the legacy playmat code and the `USE_DECK_LOOP` feature
  flag; the deck loop is now the only system.

**Save compatibility with pre-0.3 saves is intentionally broken.** Old saves are
refused on load by design.

### Combat and heroes

- New 7-stat combat engine with a registry-driven status effects system
  (7 statuses, 5-second clock, damage-over-time can kill).
- 15-skill model: every hero carries all 15 skills; hero level is the average of
  the 4 combat skills; classes are cosmetic.
- Split combat theatre — hero animates on the hero card, enemy on the combat
  card — with aligned combatant info panels and a live attack-loop bar.
- Curve-explorer prototype for balance calibration.

### Content and systems

- Quest System v2: quest boards, main story quests, procedural quests, refresh.
- Binder rework: owned-only storage, small card tiles, no flicker.
- Pack opening with card-flip reveal, plus an instant-reveal setting.
- Visual-first recipe cards with ingredient icons and bank-reserve bars.
- Fixed bank tabs with sprite strip, select mode, and bulk-sell modal.
- Bank slot capacity is now a real, enforced limit.
- Guild Hall upgrades replace the retired Projects system.

### UI

- UI overhaul: bubble menu, split-pane drawer, sortable tabs, full-screen drawers.
- Hero side drawer as a full-height panel off the bubble bar.
- Pointer-tracked drag-and-drop system (dnd-kit) across cards, heroes, and items.
- Fluid typography pass; SilkPixel as the default face.
- Boot-time asset preloader for instant sprite load-in.
- Compact notification toasts, pinned bottom-centre, with a hide toggle.

### Desktop build

- The game is wrapped in a Tauri desktop shell with an app icon.
- Fonts are self-hosted so the desktop build works fully offline.
- Raw art datasets staged in `raw_assets/` instead of `public/`, so high-res
  masters no longer ship inside the build.

### Code review

A full 8-session review filed 55 tickets (CR-001–CR-055) with zero P0s, all
resolved across six fix waves. Highlights: timer remainders preserved under
time-scaling, hero area assignments always cleaned up on exit, save robustness
and schema cleanup, an infinite render loop in the hero drawer fixed, and a
large dead-code sweep removing orphaned pre-rework machinery. A regression test
net now covers the rework core engine (129 tests).

### Retired in this version

- Playmat / 2D grid system, and the `USE_DECK_LOOP` flag.
- Hero-carried food and drink slots (station Drink slot auto-sips instead).
- Projects system.
- Single active-area concept.
- Area Mastery — shelved dormant, not deleted.
