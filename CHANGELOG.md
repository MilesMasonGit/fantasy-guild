# Changelog

All notable changes to Fantasy Guild are recorded here. Version 0.3.0 is the
project's first tagged baseline — everything before it was untagged development.

## [Unreleased]

### Card Mutators & Tokens (Phase 0 — scaffolding)

Inert groundwork for the Card Mutator system. Nothing is player-visible yet.

- New `CARD_TYPES.ACTION` card type, covering both Mutators (cards that stamp
  Tokens onto other cards) and consumables (cards that apply Status Effects).
  Which one a card is comes from its traits, not a separate field.
- New `src/systems/effects/TokenRegistry.js` — the data-driven registry Tokens
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
