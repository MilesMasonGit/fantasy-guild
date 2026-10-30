# Brief 300 — The encyclopedia and collection log

*Written 2026-10-29 by the planning agent from the owner's interview of the
same day. Concept: [concept_knowledge.md](../concept_knowledge.md), "The
encyclopedia and collection log" (read it whole; it reverses the 2026-10-09
spoiler rulings: **everything is visible**).*

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, `docs/reference/UI_STYLE.md`, the
concept section, [concept_progression_ledger.md](../concept_progression_ledger.md)
(the shared reach-and-tree engine), [brief 290](290_progression_ledger.md) L2,
GDD §9 (screens), §10 (saving), §14 (performance).

Code to start from (verify): `src/systems/progression/ledger/` (brief 290
L2's shared engine, data passed in), `src/systems/progression/RegistryManager.js`
(the game already records each item gained with its source, discovered
enemies, first kills: the base for the ticks), the toast notifications
(`src/systems/notifications/`, `ItemStubColumn.jsx`: the existing "New" pop),
the item, Token, enemy and recipe cards and the Bank tiles (for the links),
the ritual / new-run reset.

⚠️ **Order**: after brief 290 L2 (the tree engine) has merged. The game reads
the engine with the game's own registries passed in; it never reads the CMS.
⚠️ **Places** (world cells) join as a kind once the world map is built;
until then the Places tab can show settled Regions, or wait (director's call).

## Phases

| Phase | What | Tier |
|---|---|---|
| E1 | **The screen.** Its own button (with search) opens a full-screen encyclopedia, organised by kind (Items, Tokens, Enemies, Recipes; Places later). Every entry visible from the start. An entry shows what it is, **every source** (wild node, drop, recipe, Shop, side source), **the full ingredient tree folded** (open a level at a time), and **everything it is used in**. **Clicking a node in the tree makes it the focused entry**, so the player walks up and down the tree (with a back step). No wedge or cell shown. | builder (engineer if the tree view needs layout work) |
| E2 | **Ticks and links.** A tick on each entry once obtained, made, beaten or settled (from `RegistryManager` and the first-kill record; recipes on their first craft), progress per kind ("Items 48/149"); silent (the toast's "New" pop is enough); reset at the ritual with the run. A link to the entry from every inspected card and Bank item. | builder |

## Done when

- Gate green (`TESTING.md`); no engine work change (the screen reads only);
  the screen costs nothing while closed (§14).
- In the running game: search "iron" finds Iron Ore, Iron Ingot and the Iron
  Smithy; Iron Ingot's entry shows its tree to Iron Ore and Coal, clicking
  Iron Ore focuses it and shows its vein; the Copper Sword's card links to
  its entry; mining a first Copper Ore ticks it with no new pop beyond the
  toast's; a new run starts with no ticks.
- One eye-check after E2.

## Owner to-do

- Nothing in the CMS: entries come from the content as authored.
