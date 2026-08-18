# Retiring the Card system

**Owner decision, 2026-08-18: the card system is retired in favour of Tokens.**
Scope also decided: *delete the dead, and rehome the live engine properly* —
the still-used processors move to homes that describe what they actually do.

This document is the executable map. The analysis below is the hard part and is
already done; do not re-derive it, but **do re-verify** each claim before acting
on it, since the tree moves.

---

## The shape of the problem

`systems/cards/` is **not** uniformly dead. It is a working engine living inside
a retired feature's namespace. There are exactly **two doors** into the
subsystem from live code:

| Door | Importer | What it pulls |
|---|---|---|
| `CardManager` | `systems/core/EngineBootstrap.js:21,74` | registered into the engine DI object |
| `CombatProcessor` | `systems/board/BoardCombat.js` | the whole live combat chain |

Everything else in the cluster is internal.

### The good news

Both doors are thin:

- **Nothing consumes `engine.CardManager`.** It is registered in the DI object
  and never read — verified by grepping all of `src/ui` and `src/systems`.
- **The four live processors import exactly one symbol** from `CardManager`:
  `bumpCardRev`, which is itself just a re-export of
  `logic/CardManagerUtils.bumpCardRev`.

So the live engine's dependency on the card layer is one utility function and
one unused DI registration.

### The awkward news

Four live modules call `getCard()` against `cardRegistry`, whose content glob
(`DatabaseManager.cardFiles`) is deliberately `{}` — so those lookups return
nothing today:

| Module | Line | Call | Status |
|---|---|---|---|
| `WorkProcessor` | 45 | `getCardTemplate(card.templateId)` | reachable from live board combat |
| `QuestBoardSystem` | 133 | `getCard(poolEntry.cardId)` | quests are a **real** feature — handle with care |
| `GameState` | 55–56, 63 | `rehydrateList(state.cards.active / .library)`, `deriveCardTags` | those arrays no longer exist (round 1's CR-007) — no-ops |
| `DiscoveryManager` | 9 | imports `getCard` | check usage before assuming |

**`QuestBoardSystem` is the one to be careful with.** Quests are real; its card
pool is not. Removing the card lookup must not remove the quest board.

---

## Delete

Verify each is unreferenced *after* the rehoming step, then remove:

**Card content layer**
- `config/registries/cardRegistry.js` (390)
- `config/registries/cardConstants.js` (111)
- `config/registries/cards/specialCards.js` (3 entries)
- `config/cards/CardValidator.js`
- `config/cards/card-presets.js`

**Card assembly** (all internal to the cluster)
- `systems/cards/CardManager.js`
- `systems/cards/CardAssembler.js`
- `systems/cards/logic/CardFactory.js`
- `systems/cards/assembler/ModularSyncer.js`
- `systems/cards/assembler/SlotMapper.js`
- `systems/cards/assembler/TraitRegistry.js`

**Card-only registries** — each imported by nothing but `cardRegistry`
- `config/registries/invasionRegistry.js` (133)
- `config/registries/eventRegistry.js` (121)
- `config/registries/dungeonRegistry.js` (70)

**Also retired by owner decision (2026-08-18)**
- `config/registries/biomeRegistry.js` (350) — its main importer is
  `CardValidator`, which goes here anyway; only `utils/Formatters.js` remains
- `config/registries/tagRegistry.js` (211) — imported by `GameState` and
  `CardFactory`; the `GameState` use needs unpicking, not just deleting

Remember the barrel: `config/registries/index.js` re-exports several of these
and must be edited in the same commit.

## Keep and rehome

These are live. They should end up somewhere that names what they do, with
"card" dropped from the naming where it misleads.

| File | Rehome to | Note |
|---|---|---|
| `logic/CombatProcessor.js` | `systems/combat/` | entered from `BoardCombat` |
| `logic/CombatAttackProcessor.js` | `systems/combat/` | |
| `logic/CombatResolutionProcessor.js` | `systems/combat/` | |
| `logic/WorkProcessor.js` | `systems/board/` | it processes a tile's work cycle |
| `logic/CardPreflight.js` | `systems/board/` | rename away from "Card" |
| `logic/QuestProcessor.js` | `systems/quests/` | |
| `logic/RequirementProcessor.js` | `systems/quests/` | |
| `logic/RequirementRegistry.js` | `systems/quests/` | |
| `logic/CardManagerUtils.js` → just `bumpCardRev` | wherever the processors land | the only symbol the live engine needs |

⚠️ The word "card" is also used *inside* these files for the thing on a tile.
Renaming the concept in code is a larger judgement call than moving files —
**do the moves first, verify, then decide on renaming separately.** Do not do
both in one commit.

---

## Suggested order

Each step ends green, with its own commit.

1. **Decouple.** Point the four processors at `CardManagerUtils` directly for
   `bumpCardRev`; drop `CardManager` from `EngineBootstrap`'s DI object.
   Nothing else changes. Verify.
2. **Neutralise the dead lookups.** `GameState`'s card rehydration (no-ops on
   arrays that don't exist), `WorkProcessor`'s template lookup,
   `DiscoveryManager`'s import, and `QuestBoardSystem`'s card pool — the last
   with real care, since quests stay.
3. **Delete** the content and assembly layers plus the card-only registries, and
   edit the barrel. Re-run reachability afterwards.
4. **Rehome** the live processors. Moves only, no renames.
5. **Biomes and tags**, which are independent of the above but were retired in
   the same decision.
6. **Decision logs** — strike the entries tied to anything removed here
   (`playmat_decisions.md`, `cms_rework_v2_decisions.md`).

## Verification, every step

`npm test` (baseline 875 passed / 21 skipped), `npm run build`, then **run the
game and fight something** — the combat chain is the risk in this whole job, and
no test currently covers board loot end-to-end (that suite was retired in the
cleanup; see the Retired Tests Ledger).

⚠️ Before deleting anything, check `src/`, `cms/src/` **and** `src/tests/`.
`cms/src` imports seven modules straight out of the game's `src/` (CR2-010), and
the reachability tool knows nothing about it.
