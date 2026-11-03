# Brief 380 — Detail pass: the world map

*Written 2026-11-03 by the planning agent from the owner's walkthrough of the same day.
Concept: [concept_detail_pass.md](../concept_detail_pass.md), "7. World map": read its list
first; the item numbers below are that list's, and the owner's wish is what counts.*

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, `docs/reference/UI_STYLE.md`,
[concept_world_map.md](../concept_world_map.md) (amended by this brief),
[concept_guild_hall.md](../concept_guild_hall.md),
[concept_progression_ledger.md](../concept_progression_ledger.md),
[concept_content_roadmap.md](../concept_content_roadmap.md) (the ladder, and T-294), GDD §8,
§10 and §14.

Code to start from (verify; the captures in `research/world_w2`, `world_w3` are from 30
October): `src/ui/components/atlas/` (`WorldPage.jsx`, `worldMapLayout.js`, `AtlasScreen.jsx`,
`RegionList.jsx`, `ArrivalCard.jsx`), `src/ui/components/encyclopedia/` (how it moves around),
`src/systems/world/` (`frontier.js`, `cellRegion.js`, `Arrival.js`), `src/config/guildUpgrades.js`,
`src/utils/Formatters.js` (`formatCompact`), `MatRegionName.jsx`.

## Phases

M1 first; M2 and M3 build on the owner's pick; M4 may run beside them; M5 last.

| Phase | What | Tier |
|---|---|---|
| M1 | **Mock-ups of the hexes** (no game code; item 2): "more detail and refinement on the hexes, perhaps showing a terrain sample", "anything we can do to make the hexes look better". Two or three looks from the real ground and art, with the map at its new size and the cell states and ring lines of items 3 and 5. Say for each what is code-drawn and what would want the owner's hex art (art list), and what it costs: a static picture of 36 or more cells, built once. Saved under `docs/active/research/world_hexes/`. **M2 starts once the owner has picked.** | builder |
| M2 | **The map** (items 1, 2, 3, 4, 5). Bigger, and moved around like the encyclopedia. The picked hex look. **States**: settled and settle-able full colour; a cell you can settle right now stands out (a gold outline or small pulse, show both); next to you but too expensive or behind a ring star, darkened; not next to anything you hold, black and white; any cell full colour on hover. Contents stay visible, as ruled. **No hexes outside the third ring unless accessible.** **Ring lines**: a decorated border along the edges where rings meet, no numbers. | builder |
| M3 | **The hover tip, the panel, no tabs** (items 7, 8, 9, 10, 11, 12, and the tabs). **Tip**: the title is the area's name ("Elderfield"), the terrain types underneath ("Mountain Rivers"); no ring; the price in our item style, inventory values in the 9.9k shorthand (`formatCompact`). ⚠️ `World.cellName` gives "Highland Ores" today and a Region gets its name when settled: find how to name a cell before that, from its seed. Stop and report if that means changing what saves hold. **Panel**: thinner; yields and drops here, not the tip; a larger, more prominent Settle button; no "The guild is here" text; a larger, more prominent flag. **The tabs go** (owner). Travel is already on the panel; ⚠️ the Regions page also holds renaming a place, its map preview and facts, and a save from before worlds relies on it: move what a settled cell needs onto its panel, and say what you did with the rest. | builder |
| M4 | **A Guild Hall star per ring** (item 6). Ring 1 open from the start, as the tutorial needs. A star allows settling ring 2, another ring 3, then one per wild ring; a cell behind one reads as locked, and says why. Machinery first, then a **CMS change pack** with the stars for the owner to review (brief 200; a pack, never `data/`). Prices follow the ledger's algorithm; Hall prices otherwise wait for the Hall balance pass. ⚠️ **The ledger must count these stars** in reach and the pace curve, or every ring reads earlier than it is: extend checks F and the budgets. Coordinate with T-294 (the ladder's rungs, cell prices). **Expect WORK CHANGED** on anything that settles beyond ring 1; a bench scenario may need the star. | engineer |
| M5 | **Ceremony on settling** (items 13, 14). **A title reveal**: the place's name and terrain types large across the mat, with a fanfare, building on the existing Region name reveal. **A hero leads the way**: heroes walk in from the mat's edge. ⚠️ Keep it short and skippable: a player settles dozens of places, and the arrival fight, offline catch-up and travel to a place already settled must be unaffected (no ceremony on travel). Stop and report if heroes walking in touches the engine beyond a drawn walk. | builder |

## Done when

- Gate green (`TESTING.md`). M1 to M3 and M5: engine work **same**. M4's WORK CHANGED
  accepted by the director.
- In the running game, named as verified: every cell state seen, including hover; a wild
  ring hidden until accessible, then shown; a ring-2 cell locked without the star and open with
  it; the map dragged around; a place renamed; a settle with its ceremony, then travel back and
  forth without one; a tutorial's first settle unaffected.
- The ledger shows ring 2 and ring 3 later by the stars' cost; checks F pass on 100 of 100
  worlds; the first pack passes the gate.
- `bench:draw --compare` once per eye-check batch.
- GDD §8, §9 and §10, `UI_STYLE.md` and `concept_world_map.md`'s "Built pieces" updated.
- **Eye-checks**: the hex pick after M1 (no game change); one look after M2 and M3; one after
  M4 and M5 together.

## Owner to-do

- Pick from the hex mock-ups.
- In the CMS, review the ring stars' pack, then Sync on `main`.
- Art when convenient: hex cells (art list, the world map cells row).
