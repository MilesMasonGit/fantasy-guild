# Arrival and identity: tiles, story sites, fresh ideas (research, 2026-10-29)

*A design analyst's study for the world map draft
([concept_world_map.md](../concept_world_map.md)), developing the owner's two
picks (**assemble the mat from tiles**, **one story site per mat**) and
looking for fresh ideas on arrival and identity. Read-only; nothing decided.*

Numbers from the code: a map writes up to 64 Tokens at the 128 cap; ~5 Tokens
keep one hero busy, so 4–6 busy heroes ≈ 25–30 natural Tokens; a `Budget.js`
recipe is already a small bundle (ground, weighted nodes, one water kind,
camps, treasures); landmarks exist (fixed, not demolishable, show their needs);
Region rules already give place-wide bonuses (the machinery for a local
ability).

## What other games teach

Carcassonne (an open bag; reward finishing a feature) · Dorfromantik (calm
placing; tiles with small goals) · Islanders (choose 1 of 2 packs) · Against
the Storm (biomes change rules; a glade event solved with goods and workers,
sometimes help-or-loot) · Northgard (one special feature per territory) ·
Frostpunk (one authored question per scenario) · Slay the Spire (the act's
boss shown from the start) · Stardew (a broken thing in plain sight the
player repairs) · Terraria (loot found only in that biome) · Factorio and
Satisfactory (how resources lie changes how you build) · Timberborn (terrain
that matters) · idle zone games (a zone is just a bigger number: avoid).

## Tiles

**A tile is one feature that keeps one hero busy**: a patch (lake, outcrop,
grove, field, ruin) of 5–8 Tokens of mainly one skill, with its ground and,
where it fits, a small water; about an eighth of the mat's outer band. So
**4–6 tiles = the owner's 4–6 heroes of natural work**: kit tiles cover the
everyday skills, the specialty is one special tile with better things; the
rest stays building room. Each **kit archetype has a tile bag** (Riverside:
lake, reedbed, willow copse, clay bank, meadow field; Highland: outcrop,
tarn, fir stand, scree, goat pasture), shown openly; **every draw covers
Mining, Forestry, Fishing and Farming** (one slot each), only extras vary; the
ledger counts tiles per skill.

- **A. Lay the land (arrival only, you place)**: after the arrival fight the
  dark mat shows ~6 empty sockets around the Hall's clearing; the player
  drags 5 tiles (4 kit, 1 specialty) into them; one socket stays building
  land; a few named neighbour pairs give a small bonus (grove beside lake:
  "shaded bank", better fish); a "Let it settle" button auto-places. ~30 s
  per arrival, skippable. Reuses Budget; Layout needs socket outlines so a
  tile stays in its patch (lakes, ponds, tarns fit; a river across the mat
  doesn't). Medium cost.
- **B. The place grows**: 3 tiles on arrival, then milestones (fight cleared,
  first camp, a story-site stage) each offer one of two tiles; each new tile
  takes building room (a real trade). One decision every few hours. Medium+
  cost; arrival thinner.
- **C. Keep the hand**: see 5 tile cards, keep 4; the generator places them.
  A 5-second choice; low cost; loses "where does it go".

*Example (A)*: Willowbend (Riverside, ring 1, specialty Fishing) arrives dark
with four goblins by the water; cleared in ~10 min. Draw: Willow Copse (5
oaks), Clay Bank (5 copper), Reed Meadow (a Field, 2 bushes), Goblin Hollow;
specialty Trout Pool (a rare Silver Trout spot). The player sets the Trout
Pool by the copse (shaded bank), the Clay Bank by the pool, the Hollow in the
far corner, one socket free for a Logging Camp.

## Story sites

**One fixed Token per place**, like a landmark (not movable or demolishable;
inspecting shows the current stage's needs), with a **3–4 stage chain**: each
stage a hero job plus items paid in, using **skills the place's natural work
doesn't** (Construction, Smithing, Cooking, Alchemy, Combat), so sites even
out skills. 1 Token and at most one guardian: cheap on performance.

- **1. Restore it**: 2–3 authored site types per archetype, re-dressed and
  re-priced by ring (~15 types). Reward: a local ability (a Region rule:
  "veins here rest half as long") and the site becomes a working building
  found nowhere else (a mill grinding two for one). Low–medium cost; mostly
  authoring.
- **2. The site is the arrival**: the arrival enemies come from the site
  (goblins holed up in the mine); clearing them is stage 1; a later stage is
  a guardian. **Landmarks are simply big story sites** (a boss, 5–6 stages).
- **3. Restore or plunder**: the last stage offers restore (the ability and
  building) or plunder (a treasure, materials, and a hint revealing a hidden
  extra in a next-ring fog cell).

Against checklists: optional, no completion count; the next stage shows only
once one finishes; each stage visibly changes the Token; one site per place.

*Example*: **Greyhold Mine** (Highland, ring 2): arrival goblins at the adit
→ shore up the adit (Construction, 30 fir planks) → pump the flooded gallery
(a pump smithed from 10 copper bars) → the Cave Troll → relight the forge
("Deep Veins" for the Region; an iron-producing mine found only here) or
strip it (40 iron ore, a treasure, the Ashen Hills' rich vein revealed).
Riverside: the **Old Mill at Willowbend** (clear the race, rebuild the wheel,
fend off the river troll; restored, a mill grinding two for one; stripped,
millstones).

## Fresh ideas

1. **The fight is the reveal**: each arrival enemy stands on a dark socket;
   when it falls, that patch lights up and shows its tile.
2. **A signature item**: each place yields one named item found only there
   (Willowbend Trout); some later recipes ask for one from an earlier place,
   so old places keep meaning something.
3. **A field-journal page**: 5–7 small "firsts" per place; a full page hangs
   a pressed map in the Hall. A memory, not a grind.
4. **A resident**: one local person per place (a quest Token beside the Hall)
   with 2–3 favours; the last brings a hero candidate or a gift.
5. **Name it, mark it**: rename a settled place; the world map shows the
   guild's banner and the restored site's icon.

## The analyst's recommendation

Archetype kits as **tile bags** (four kit tiles, one per gathering skill, plus
a specialty tile, shown openly); arrival in **fixed sockets** with "Let it
settle" as the default, **revealed as the fight is won**; **one story site per
place that is the arrival**, with a restore-or-plunder chain using the skills
the tiles don't; landmarks as big sites; growth from the site and building,
not more draws; signature items later.
