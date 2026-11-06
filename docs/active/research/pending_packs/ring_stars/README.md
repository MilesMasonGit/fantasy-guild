# The ring stars' pack (brief 380 M4)

`2026-11-06-ring-stars.json`: 6 entries, all creates. A copy waits in `cms/incoming/` for the
owner's review in the CMS (Changes to review), then Sync on `main`.

- **The Compass** (`compass`), a new constellation, its name under the middle of its row.
- Five **ring stars**, one rank each, in a row left of the Hall past the Vault (between Crafting and
  Construction), each linked to the one before so they light in order; each wears a map outline.

| Star | Opens ring | Tier | Price (the ledger's proposal) | Lit at Typical |
|---|---|---|---|---|
| Charted Roads | 2 | 1 | 1,700 Cherry | 54 min (plane 1 ends at 55 min) |
| Far Horizons | 3 | 2 | 12,000 Trout | 22 h 52 min (plane 2 ends at 1 day) |
| Wild Lands | 4 (wild) | 3 | 110,000 Watermelon | about 2.2 days |
| Untamed Reaches | 5 (wild) | 3 | 160,000 Watermelon | about 4.1 days |
| Edge of the World | 6 (wild) | 3 | 230,000 Watermelon | about 6.7 days |

**How they are priced** (`src/systems/progression/ledger/pace.js`, `proposeRingPrice`): the tier's
material as for any Hall rank (the most-gathered material first had at that tier), as much as one
hero gathers at Typical from when it can start to the end of the stage the ring opens after (ring n
after stage n − 1). The wild rings' stages have no budget yet, so each wild star takes the world
tables' wild price growth (1.5, as wild cells' prices grow) times the hours of the star before.
The wild prices are placeholders until T-294 sets budgets for the later tiers.

**Checks** (the scratch copies are these files):
- `node cms/changePackTool.mjs check`: OK, 6 entries.
- `stamp`: nothing to stamp (creates only), against `data/` and `cms/plan/plan.json` (no autosave in
  the worktree: the owner's unsynced work was not seen; a create conflicts only if its id exists).
- `gate` (`gate.txt`): **PASS**. 39 entries later on the timeline (ring 3's content, 7 h 27 min to
  22 h 52 min; the Arcane ring 2 floor, 0 to 54 min), 0 problems added, 1 cleared (ring 3 opening
  69 % before plane 2 ends).
- `sweep.mjs`: checks F on 100 worlds before the pack: 0 pass, every failure the new ring-star
  check ("no star" for rings 2 to 6); with the pack, **1000 of 1000 pass**, every rule of the world
  kept (`sweep_100_worlds_before.txt`, `sweep_1000_worlds_with_pack.txt`).
- `roundtrip.mjs`: through the CMS's Sync shape (`hallSkyFile`) and back into the game's sky, every
  ring star keeps `opensRing`, its link, tier and price.
- `mirror.mjs`: the QA panel's fixture (`src/ui/dev/qaRingStars.js`) equals the pack.
- In the running game: `docs/active/research/world_map/built_m4/`.
