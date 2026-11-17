# Brief 660 — Deep read: CMS renames and deletes meet old saves

*Written 2026-11-17 by the planning agent from the deep-read triage
([design check and answers](../review/design_check_2026-11-17.md); the owner's rename ruling of
2026-11-16 in [review/STATUS.md](../review/STATUS.md), D3 questions). Runs first with brief 650
(owner, 2026-11-17: the P1s lead).*

**What the player gets.** Renaming an item or a Token in the CMS no longer orphans it in every save:
loading follows the rename everywhere the id lives. A real delete no longer strands a save: a settled
place whose enemy was deleted can be worked again, a place priced in a deleted item can still be paid
for, the Bank does not lose slots to items it cannot show, a station keeps its recipe pick through a
Sync, and a gear slot holding a deleted item shows it as missing and can be cleared.

**Why this is not "old saves aren't protected".** That rule (owner, 2026-11-05) is about game versions.
These are the owner's own CMS edits meeting the save being played, ruled separately on 2026-11-16: saves
follow renames.

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, `docs/reference/ARCHITECTURE.md` (saves, the content boundary,
the CMS layer), and `docs/active/review/D3_saves_and_time_away.md` CR4-158 to CR4-163, plus
`D2_heroes_combat_gear_xp.md` CR4-127. **Stop and report** where the code disagrees with the finding.

## Phases

| Phase | Ticket (finding) | What | Tier |
|---|---|---|---|
| R1 | T-456 (CR4-158, CR4-159, CR4-162, CR4-163) | **A delete no longer strands a save.** (1) P1: a held mat counts as standing only arrival enemies whose type is still an enemy (`standingEnemies` filtering on `isEnemyDef(getTokenType(typeId))`), and `occupy` skips a row whose type is not; the ghost Token stays on the board (restoring the id restores the fight). (2) A place's price row naming an item with no definition is dropped from what `priceRows` asks, and the map says so. (3) Kinds with no definition take no Bank slot (`freeSlots`, `bankTabCounts`), their entries kept in `inv.items`. (4) A station's pick or a Field's crop not in the pool reads as "nothing picked" and is never deleted; it is overwritten only when the player picks. Nothing is removed from a save in any of the four. Test each with a fixture whose id is missing. | builder |
| R2 | T-455 (CR4-160, CR4-162, CR4-127) | **Saves follow a rename.** The CMS records each rename as old id to new id when an entity's id follows its name, kept in its workspace; the Sync writes the table into `data/` with the rest (a CMS-written file, like every other in `data/`; the pre-commit hook keeps it apart from code). `migrateState` applies the table on load everywhere an id lives: Bank keys, tab orders and overrides, loadouts, Tokens and loot on the live board and every Region's board, `state.world` cells (arrival rows and prices), station picks, collection lists, pins. Chains follow (a renamed twice). Widen the save check (`collectSaveRefs`) to every Region's board and the world's cells, and correct its wording (it promised the item "will start working again"). Recipes do not follow names today; leave them out unless that changes. Test: a fixture save, a rename table, every place rewritten. Then one real rename in the CMS on a scratch branch in a worktree: rename, Sync there, load a save, the item is back; reset nothing on `main`. | engineer |
| R3 | T-430 (CR4-127) | **A gear slot holding a deleted item.** The slot draws the missing item by its id, marked as missing content, instead of "+"; unequip, and an equip that displaces it, clears it with no Bank return instead of refusing with "Bank full" (the copy is thrown away, owner 2026-11-17). A held copy of an item that still exists but is no longer gear goes back to the Bank as today. After R2 (a renamed id must be followed before it can look deleted). | builder |

**Order.** R1 first (the P1), then R2, then R3. R1 and R2 both touch the load path: one at a time.

## Done when

- Gate green; bench work check: **same work** (no bench save holds a missing id).
- R1 and R3 in the running game with a QA fixture save holding a missing id: the place works, the Bank
  has its slots, the slot reads missing and clears. R2: the scratch-branch rename above, named as
  verified.
- Tickets closed into `docs/archive/tickets_done.md`.

**Eye-check: no.** One line in STATUS for the owner: "renaming an item or Token in the CMS now carries
over into your save; a deleted item in a hero's slot shows as missing and can be cleared."

## Owner to-do

None to build. After R2 lands, renames in the CMS are safe for the save being played; a real delete is
still a delete (the thing is gone from the save's point of view, but nothing breaks).
