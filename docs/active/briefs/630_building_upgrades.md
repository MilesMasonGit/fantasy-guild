# Brief 630 — Building upgrades: one building per skill, then its variants

*Written 2026-11-12 by the planning agent from the owner's interview of the same day. Source:
[content_construction.md](../content_construction.md) (the buildings, the variant menu and the costs, approved
2026-11-04, amended 2026-11-12), [star_ideas_review.md](../star_ideas_review.md) (the picks), BALANCE_RULES section 5
(the boost budget: buildings carry the most speed), UI_STYLE's effect names. Code facts are a first look; verify
them. This brief takes over **T-307**.*

**What the owner wants.** Buildings are the big, local upgrades: a player builds up an area to make it strong for a
skill, even a place to powerlevel. First each skill gets **one clear building** (a structure, not furniture) in place
of today's stations; then its **variants**, each a new building with one effect on the Tokens in its reach. Stars are
the other half ([brief 620](620_star_upgrades.md)).

## The owner's rulings (2026-11-12)

- **Base buildings, then variants**: T-307 comes first in this brief.
- **Base buildings carry no effect**: they are where the work happens; the variants are the upgrades.
- **The variant menu is redrawn with the effect names** by the content agent and approved by the owner before the
  pack: Faster Work → **Speed**, Save Materials → **Preservation**, Double Output → **Double Loot**, Quick Refill →
  **Growth**, Rare Finds → **Lucky**, More XP → **XP**; **Wider Reach** (gone with brief 560's one standard reach) →
  **Refresh**; **Efficiency** and **Abundance** join (Building only); **Yield** may appear (Both).
- **XP comes from the planned skill variants** (Barracks, Arcane Library, Master's Study), each for its own skill.
  The content agent lists the skills left with no XP source once the Lore stars go (T-400) and asks the owner.
- **Neighbours**: **one Neighbours variant per skill**. It gives **Speed to nearby Tokens of the skills it trades
  with** (a Kitchen's Neighbours variant speeds Farming and Fishing in its reach). The content agent proposes the
  links; the owner approves them.
- **Support buildings stay** (Well, Composter, Beehive, Dock, Windmill, the Mines, Minecarts), using the effect names
  and retuned to the building budget. An effect on them that breaks the picks (an XP bonus, a Star-only effect)
  changes.
- Already ruled: Building-only effects are XP, Efficiency, Abundance and Neighbours (2026-11-11); one rule for every
  drop and every Token kind.

## Read first

`CLAUDE.md`, `docs/reference/ARCHITECTURE.md`, `docs/reference/TESTING.md`, `docs/reference/CONTENT_PHILOSOPHY.md`,
`content_construction.md` (all of it), BALANCE_RULES sections 5 and 6 (budget, payback, the one-off step rule).

Code to start from (verify):
- **Stations today**: recipes split by station kind (`stationKinds`: `recipePoolRegistry.js`, `tokenConstants.js`,
  `lifecycleAudit.js`; CMS tests `CMSStationKinds.test.js`). The tutorial and Limes's lessons
  (`src/systems/quests/`), the ledger and the Starter Camp (`data/starterCamp.json`) name today's stations.
- **Building effects today**: `data/effects.json` (authored in the CMS), e.g. `effect_faster_station` (−15 % on its
  own station), Mines and Quarry (`DOUBLE_DROP` 25 %), Minecart and Dock (`WORK_TIME` −20 % nearby), Well
  (`GROW_TIME`), Composter (`CROP_LOAD`), Beehive.
- **Camps**: `Camps.js` (a hero works every Token of the camp's skill in reach); the War Camp is new.
- Skills with no building yet in the registry: Fletching and Enchanting exist; **Tailor doesn't yet** (T-304).

## Needs

- Brief 590 (merged). Brief 620's C1 before this brief's pack, so the sizes are set against the same budget.
- **T-336** before any Lucky variant (Prospector's Camp, Bait Shop, Hunting Lodge).
- Tailor's Shop waits for T-304 (the Tailor skill); the five specialist buildings wait for their skills' sessions.

## Phases

| Phase | What | Tier |
|---|---|---|
| B1 | **One building per skill, the engine side** (T-307). Recipes stop being split by today's station kinds: each skill's building offers all of that skill's recipes, gated by the skill's level (the existing rule). The tutorial, Limes's lessons, the ledger and the Starter Camp name the new buildings. Old stations keep working until the owner deletes them (C1). Say what in the CMS changes (a station kind per skill, or none). ⚠️ Expect WORK CHANGED (the bench's camp builds today's stations): the engineer proposes how the bench follows. | engineer |
| B2 | **The War Camp rule**: a hero sent to it fights every enemy in its reach, one at a time, in their own style, as a camp works its Tokens. Check it against arrival fights and Guard Towers and say what you found. | engineer |
| C1 | **The base buildings** (content agent): Blacksmith, Kitchen, Workshop, Fletcher's Lodge, Apothecary, Enchanter's Tower and the War Camp, with costs by tier (`content_construction.md`), no effects; today's pictures stand in, each new structure on the owner's art list. The retired stations listed for the owner to delete in the CMS. A list to the owner first, then a pack; the owner accepts and Syncs on `main`. | content agent |
| C2 | **The variant table** (content agent, with the owner): each building's variants by the redrawn menu (above), with levels from the tiers (20, 40, 60, 80 later), plus one **Neighbours** variant per skill with its proposed links. The owner approves the table. | content agent |
| E1 | **Neighbours, if it needs code.** First check whether a variant's rules can already give Speed to nearby Tokens of a list of skills (one `provides WORK_TIME` rule per linked skill). Only if not, add what's missing. | builder |
| C3 | **The variants and the support buildings** (content agent): the approved variants as a pack, sized against the building budget (BALANCE_RULES section 5) and priced by payback; the support buildings retuned to the picks and names. Lucky variants after T-336. The owner accepts and Syncs on `main`. | content agent |

Order: B1, then C1; B2 alongside; C2 alongside B1; E1 after C2; then C3. The director greps `src/` and `cms/src/` for
every station id the owner deletes before the Sync is merged on.

## Done when

- Gate green (`TESTING.md`). **WORK CHANGED is expected** from B1 on (stations replaced) and from each content pack;
  the director records each new baseline.
- **Tests**: a building offering all of its skill's recipes by level; the War Camp taking each enemy in reach in
  turn; a Neighbours variant speeding only its linked skills in reach.
- **In the running game, named as verified**: build a Blacksmith and smelt and smith there; the tutorial and Limes
  pointing at the new buildings on a new game; a War Camp's hero clearing nearby enemies; one variant of each effect
  kind changing its Tokens' badges (brief 600); a Neighbours variant speeding a linked camp.
- `content_construction.md` set to **built** for what landed; GDD (buildings) updated; changelog entries; T-307
  closed.

**Eye-check: yes**: one after C1 (the new buildings in the Shop and on the mat, the tutorial), one after C3 (the
variants).

## Not in this brief

- Hall stars ([brief 620](620_star_upgrades.md)).
- Tailor's Shop until T-304; the specialist skills' buildings; the Guard Tower and Town Square (their own rules).
- Final art (the owner's; today's pictures stand in).

## Owner to-do

- Approve the base building list (C1) and the variant table with the Neighbours links (C2).
- Accept the packs and Sync on `main`; delete the retired stations in the CMS when C1 says.
- Name the XP sources for skills left without one, when the content agent asks.
- Two eye-checks; the new structures on your art list, at your pace.
