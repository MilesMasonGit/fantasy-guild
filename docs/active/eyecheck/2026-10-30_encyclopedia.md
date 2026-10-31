# Eye-check 2026-10-30: the Encyclopedia and collection log (brief 300 E1+E2)

**Branch:** tell the director when you're ready. The director switches your
folder to `feat/encyclopedia`, starts the game at http://localhost:5173, and
switches back to `main` right after your look. ⚠️ **Don't Sync the CMS** while
on the branch.

**Save slot:** a **New Game in an empty slot** (the branch adds two collection
fields to the save; older saves load fine, but `main` can't use the new ticks
until this merges).

Shots (sent by phone too): `docs/active/research/encyclopedia_300/` (`e1_01`–`e1_08`,
`e2_01`–`e2_09`). The book, tick and back glyphs are placeholders (new,
unapproved pieces; on the art list).

## Checks

1. **The screen.** A sixth nav bubble (a book) opens the Encyclopedia full
   screen: tabs Items, Tokens, Enemies, Recipes, a list on the left, the entry
   on the right. Every entry is visible from the start.
   Verdict: ok / change: ___
2. **Search.** Type "iron": Iron Ore, Iron Ingot, the Iron Smithy and more.
   Verdict: ok / change: ___
3. **The tree.** Open Iron Ingot: "Made from" shows Iron Ore ×6 and Coal ×2,
   folded one level at a time. Click Iron Ore: it becomes the entry and shows
   its vein under "Comes from". The back arrow returns to Iron Ingot.
   Verdict: ok / change: ___
4. **Uses and sources.** On any entry, "Comes from" lists every source (node,
   drop, recipe, Shop) and "Used in" everything that spends it; every name is
   a link.
   Verdict: ok / change: ___
5. **Ticks.** Tab counts read like "Items 9/149". Mine a first Copper Ore: it
   gets a green tick, and nothing pops beyond the Bank's usual "New". Craft a
   first Copper Ingot: the recipe ticks. Beat a goblin: the enemy ticks.
   Verdict: ok / change: ___
6. **Links from cards and the Bank.** Click a Token on the mat: a book beside
   the card's X opens its entry; its recipe and ribbons (Needs, Tools, Makes,
   Drops) link too. In the Bank, a plain click on a tile opens that item's
   entry and closes the Bank.
   Verdict: ok / change: ___

## Questions (recommendation first; built = A)

a. A new run starts with: (A) the opening Bank items and Starter Camp Tokens
   already ticked (built); (B) everything at zero, ticking only what is gained.
b. A click on a Bank tile: (A) opens the entry (built); (B) only a small book
   on hover; (C) right-click.
c. A Token ticks: (A) once one has stood on your mat (built); (B) only once a
   hero has worked it (decorations would never tick).
d. A Places tab: (A) waits for the world map (built); (B) settled Regions now.
