# Changelog

All notable changes to Fantasy Guild are recorded here. Version 0.3.0 is the
project's first tagged baseline — everything before it was untagged development.

## [Unreleased]

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
  Empty, hazard and locked slots are skipped — they aren't cards.
- **Action cards can now be put in decks** (`CARD_TYPES.ACTION` is slottable).
- Groundwork, dormant until content exists: a Mutator can name specific tokens
  to *strip* from a card (a targeted cure, never a blanket cleanse), and can
  mark itself *consumed on use* (spent when worked) versus permanent. Which
  Mutators are which is decided when the catalog is authored.

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
