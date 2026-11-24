# Brief 770 — Audit fixes: gathering and making

*Written 2026-11-21 by the planning agent from the Systems Audit, groups 4 (Gathering: A8 Fishing, A7
Forestry, A6 Mining, A9 Farming) and 5 (Making: A10 Smithing, A11 Crafting, A12 Cooking, A13
Construction, A14 Alchemy rules only, A5 the Shop). Cards: [A8](../audit/A8_fishing.md),
[A7](../audit/A7_forestry.md), [A6](../audit/A6_mining.md), [A9](../audit/A9_farming.md),
[A10](../audit/A10_smithing.md), [A11](../audit/A11_crafting.md), [A12](../audit/A12_cooking.md),
[A13](../audit/A13_construction.md), [A14](../audit/A14_alchemy.md), [A5](../audit/A5_shop.md). Most of
these two groups is content (the approved plans built as change packs); this brief is the code that
goes with them. Runs after briefs 730 (Effects), 740/750 (Combat) and 760 (The living mat). Owner answers
2026-11-21 folded in.*

**What the player gets.** A hero who runs out of bait or seed stops and says so instead of carrying on
silently or standing idle; fishing ready for the amended Fishing plan (every water fished with bait
except the Trap, which catches Raw Shrimp with none; better waters ask a rod tier and the bait picks
the fish within a water; the Fish Shoal a rich spot that runs out, with better catches); a resting vein that
no longer looks like a Stone Outcrop; and the dead fields the CMS still offers on stations, recipes
and camps cleared away, so what the owner authors is what the game reads.

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, `docs/reference/ARCHITECTURE.md` (the tick, the board's
work and flags, the content boundary), the cards above ("What really happens underneath", "Owner
feedback"), [the silent moments topic](../audit/topic_silent_moments.md) (the speech bubble for
"out of something the work needs"). For G1 and G2, the **amended** [content_fishing.md](../content_fishing.md)
(amended 2026-11-21 to the owner's rulings; G2 follows the amended plan). Where things are (read 2026-11-21 at `50cd9b2f`; check the code, it wins):

- **Fishing**: `src/systems/board/Fishing.js` (bait from a carried consumable the Bank holds, else the
  basic pool, `:14-24`, `:41-52`), `src/config/registries/catchPools.js:74`; the content check's
  no-bait warning `src/systems/core/toolRule.js:105-147`; CMS water pricing
  `cms/src/engine/sim/fieldAdapter.js:116-124`; the Fish Shoal rolls each output alone
  (`BoardRunner.js:346-348`, `data/tokens.json` `token_fish_shoal`); tool kinds
  `src/config/registries/toolKinds.js:20-27` (a `fishing_net` kind no item uses, `:25, 43`).
- **No seed**: `Fields.js:22` (the Field stops, saying "Needs Wheat Seed" on its growth alert),
  `WorkCheck.js:28, 37` (`AWAY` reasons: the hero lets go, no word), `problemMark.js:35, 164`.
- **Saying it**: `Flags.js:296-306` (`TOOL_NEEDED`, `INPUT_NEEDED`), `CalloutLayer.jsx:134-151`
  (the Token says it, `calloutText.needsInput`), `heroSpeech.js` (the hero says it).
- **Resting veins**: `Respawn.js:92-102` (`restingSpriteOf`: no resting sprite draws the vein's own
  art greyed); every vein names the shared `t_vein_stone` rock in `data/`.
- **Camps**: `Camps.js:21, 104-107` (a camp's written `reach` is never read).
- **Stations and recipes**: `RecipeResolver.js:175-187` (a station's own cycle time and XP are a
  fallback no station reaches), `wearRule.js:60-85` and `Charges.js:216-219, 249` (stations never
  wear, so a recipe's `stationChargeCost` is never spent; ⚠️ the resolver zeroes it for a Foundation,
  check what reads it there), `tokenConstants.js:135-195` (`RETIRED_STATION_KINDS`, still written on
  55 recipes).

## Phases

| Phase | Tickets | What | Tier |
|---|---|---|---|
| G1 | T-623, T-629 | **Out of bait or seed: the hero leaves and says so.** One rule for a gathering job whose input is missing (owner 2026-11-20, "like out of arrows", T-573): at a water, a hero with no bait the water takes does not fish: **bait must be carried** in a consumable cell and still held by the Bank, as today and as arrows are (planning agent's call 2026-11-21; bait in the Bank alone does not do); at a Field, a hero with no seed to sow does not wait. Either way the hero lets go of the Token as they do for a resting vein and says what is missing, **always "Needs X"** (owner 2026-11-21): "Needs Worm Bait", "Needs Wheat Seed", whether they ran dry or never had any, in brief 795 M2's shared running-out bubble, which clears when the Bank holds the item again; the Field keeps its yellow mark. **No basic pool any more, except the Trap** (owner 2026-11-21): `Fishing.js` stops falling back to a no-bait pool; the one bait-free catch is a pool worked with a Trap, which catches Raw Shrimp with no bait, so a hero with a Trap fishes without bait and never says Needs. The content check stops warning about a water without a bait-free pool and warns instead about a pool that takes no bait unless it asks a Trap; the CMS prices a water from its first bait's pool (the Trap's pool where that is all it has). If a pool cannot yet name the tool kind it asks, stop and report: G2 adds tool gating, and the Trap's exception may ride there. Share the "leaves" helper with T-573 (brief 750 S2): if it has landed, use it; if not, build it here so T-573 can use it. The words are M2's bubble, not a message of G1's own. ⚠️ The bench's calibration setup `coast` (`bench/calibration/setups.mjs:157-166`) fishes with no bait: give it bait and say so in the report. | builder |
| G2 | T-622 (code part), T-604 | **Fishing for the amended plan; the Fish Shoal runs out.** ⚠️ **On hold, don't start** (planning agent, 2026-11-24): the owner's second review round makes water ground and fishing spots Tokens that come and go (content_fishing.md points 16 to 26); once the owner approves the plan this phase becomes its own brief. *Rewritten 2026-11-24 to the owner's review* ([content_fishing.md](../content_fishing.md), "Amended 2026-11-24"). Build what it needs in code and nothing else: **a fish asks a tool kind (Rod, Harpoon, Trap), never a tier**; the tool's tier stays out of the gate (it lends speed, T-515, and **less Bait per catch**: a per-tool reduction the pack authors). **Bait is one item spent per catch, an amount per fish** (more for rarer fish), carried in a consumable cell; Raw Shrimp at the Trap spends none, every other catch does; out of it, "Needs Bait" (G1's bubble). **Lures pick the fish**: a lure is an item carried in a stack, naming one fish; it picks that fish's pool if the water holds it, and **may break each catch** (a chance the pack authors). **No lure**: roll among the water's fish the hero's tool kind and Fishing level allow, the catch taking the **longest cycle** of those. A lure for a fish above the hero's level: "Needs Fishing N". A lure for a fish this water lacks: the lureless roll, the lure not spent, "No Salmon here" once in the bubble. The water's Token card lists every fish it holds (sprite, tool kind, level, greyed while out of reach, the lure that picks it); hovering a water shows its possible fish in the speech bubble (brief 830 section 12.3's bubble). Which fish a water holds comes from its kind plus the Region's biome (the pack and the world tables author it). **One Trap catch per water**, no lure. Add the Harpoon tool kind (`toolKinds.js`, the CMS); the Lobster Pot is not a kind. The **Fish Shoal** (T-604): a **rich node that runs out**: pools like any water, one catch a cycle spending one of its big charge pool, gone when spent, its better catches authored in the CMS (its second model goes). The CMS's Catch pools block offers what this needs (tool kind, Bait amount, the lure that picks a pool). If the plan leaves a code rule open, **stop and report** it for the owner rather than choosing. | builder |
| G3 | T-628, T-630 (code parts) | **Gathering leftovers in code.** A resting vein: drawn as its own art greyed with its countdown (the placeholder until the owner's spent-vein pictures, owner 2026-11-20: "its own picture, no message"; planning agent's call 2026-11-21 for the placeholder; the greyed fallback already exists, `Respawn.js:98`), nothing announced; correct the comment at `Respawn.js:94` that says every vein names one rock; the content agent's pack clears the shared `t_vein_stone` from the veins. When the owner drops a spent-vein picture, adding it is a routine art swap (manifest entry, the vein's Resting sprite in the CMS). Camps: drop the never-read `reach` field from the camp block in the CMS and its type, and have the content audit name any left in `data/` until the owner's Sync clears it. Tool kinds: the `fishing_net` kind and its retired tag go (`toolKinds.js:25, 43`); nothing uses it. | builder-lite |
| G4 | T-633, T-635 (code parts) | **Making leftovers in code.** The CMS stops offering what the game never reads, and the code that only served it goes: a **station's own cycle time and XP** (every station's are 12 s and 0, never reached, `RecipeResolver.js:185`; the fallback stays for Tokens with no recipe, such as nodes); a **recipe's station charge cost** (stations never wear; check first what the Foundation path reads, and stop and report if a Foundation spends it); the **retired station kinds** (`RETIRED_STATION_KINDS`): the CMS no longer writes them, the content audit lists the recipes still naming one, and the leftover reader goes once the owner's Sync has cleared all 55. The **four retired stations** (Campfire, Ceramics Kiln, Grandma's Kitchen, Fighter's Academy, T-633): once the owner has deleted them in the CMS and Synced, grep `src/` and `cms/src/` for their ids (lessons, the Starter Camp, tests, comments such as `wearRule.js:17`) and clear what named them. Never hand-edit `data/`: the field removals reach `data/` by the owner's Sync on `main`. | builder-lite |

**Order and parallel work.** G1 first: its rulings are final and it needs no content. G2 waits for the
amended Fishing plan's approval and runs after G1 (both edit `Fishing.js`); the content agent's
Fishing pack (T-622) and the Shoal's pools (T-604) come **after** G2 merges, because today's content
check would refuse pools with no basic catch. G3 and G4 touch other files and may run beside G1 or
G2 (G3 edits `toolKinds.js`, as G2 may: G3 first). G4's last step (the retired kinds' reader, the
four stations' ids) waits for the owner's Syncs. Two code agents at a time.

**Depends on.** **G1 after brief 795 M2**: T-623 and T-629 use M2's shared running-out bubble, which
says "Needs X", keyed by item (T-497). T-573 (no shot without arrows, brief 750 S2) shares G1's
"leaves" rule: either order works, the second reuses the first's helper. T-515 (better tools faster,
brief 730 D6) is the speed half of "tools gate and speed"; G2 does not redo it. T-604 is filed in the
living mat group but says to land with the Fishing overhaul: it is built here (brief 760 lists it as
moved to 770).

## Done when

- Gate green; bench work check per phase:
  - **G1: expect WORK CHANGED** only if a work setup fishes without bait or works a Field without
    seed; the builder lists which setups do (the calibration `coast` setup does; the work check's
    scenarios must be read). Otherwise same work.
  - **G2: same work** for today's content (no shipped pool asks a tier; the Shoal's change moves the
    fingerprint only if a scenario places a Shoal: say which); the change arrives with the pack.
  - **G3, G4: same work.**
- Seen in the running game (QA panel): a hero at a River with no bait leaves and says Needs Worm Bait,
  and fishes again once given bait; a hero with a Trap catching Raw Shrimp with no bait; a hero at a Field with no Wheat Seed leaves and says so, the Field's mark
  stays; a copper vein mined out shows its own art greyed with its countdown, not the Stone
  Outcrop; after the Fishing pack, two waters catching different fish, a water that asks a better rod
  refusing a plain one, two baits picking different fish at one water, and a Fish Shoal fished with
  rod and bait until its charges run out. The CMS: no camp reach, no station
  cycle time or XP, no station charge cost on a recipe, no retired station kind offered.
- Tickets closed into `docs/archive/tickets_done.md` (T-623, T-628, T-629, T-604; T-622, T-630,
  T-633, T-635 once their content parts have landed too).

**Eye-check: yes**, two short looks: G1 and G3 together (running out of bait or seed; a resting vein);
fishing after G2 and the Fishing pack (the waters, the gear, the Shoal). G4 is CMS-only: one line in
STATUS.

## Handled outside this brief

- **Content agent**, as change packs the owner reviews and Syncs on `main`:
  - T-622: the Fishing pack, from the amended plan (after G2).
  - T-604: the Fish Shoal's catch pools (better than plain water's) and its big charge pool (after G2).
  - T-624: the Mining and Forestry plan; each metal tier of node asks that tier of tool (no code:
    a tool's tier already gates at nodes); rare finds per T-553.
  - T-625: the Farming plan (no sickle).
  - T-626, T-627: every gathered item gets a job or is cut; nodes run out after about five uses
    (after the planning agent writes both rules into `CONTENT_PHILOSOPHY.md`).
  - T-628: each vein's resting sprite cleared from the shared rock (so G3's greyed placeholder
    shows); later each ore's own spent picture once drawn.
  - T-630: the content leftovers (XP off the curve, the duplicate Adamantine vein, the Blackberry
    Bush, Lemon and Lime, the Beehive, tree tags, the Copper Woodaxe, seedling values, unused pickaxe
    effects).
  - T-632, T-634: the making plans, one building per skill with its variants, Construction to 99.
    The engine side of one building per skill is already built (brief 630 B1, merged 18b0ab43); no
    other code is known to be needed. If a pack meets a shape the game cannot do, the content agent
    says so and the director files a ticket.
  - T-633: the four stations retired in the CMS. T-635: the content leftovers (the Leather Hat's
    level, ingots and the Torch feeding nothing, Copper Nails, the coins item, the Stone
    Foundation's icon, the Iron Dagger and Sword levels, the unused Copper Anvil).
- **Planning agent**: T-622 (amend `content_fishing.md` first), T-626 and T-627 (the two content
  rules), T-631 (GDD on gathering) and T-636 (GDD §5 Making and the Shop), after the packs land.
- **Not in this brief**: none of the groups' director tickets is left out.

## Owner to-do

In this order:

1. Approve the amended Fishing plan (planning agent) so G2 can start.
2. After G2 merges: review the content agent's Fishing pack and the Fish Shoal's pools, Sync on
   `main`.
3. Any time (no code waits): review and Sync the Mining and Forestry, Farming, gathering leftovers
   and making packs as the content agent stages them; delete the four retired stations in the CMS
   and Sync (then tell the director, who greps for their ids, G4).
4. Art, when you like: a spent-vein picture per ore (copper, coal, iron, silver, gold, mythril,
   adamantium, darkmetal; stone and the deposits as the plan keeps them), dropped into
   `public/assets/tokens/ore/`.
