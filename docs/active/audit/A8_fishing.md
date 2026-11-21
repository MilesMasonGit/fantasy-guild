# A8: Fishing
*Read at tag audit-build (1c04f5f6), 2026-11-20.*

## In one paragraph

A hero with a rod (or a trap at the coast) works a water Token: each cycle
lands one fish picked from a weighted pool chosen by the tool and the bait
carried; a bait is spent from the Bank. Four waters exist (Coast, River,
Lake, Bog Pool), seven fish, two baits, a rod, a better rod and a trap. With
no bait the hero silently fishes the basic pool. The better rod does nothing;
River, Lake and Bog Pool hold the same two fish; the Shrimp Coast and the
Fish Shoal fish by a second model. Your rulings already set the direction:
an overhaul (fish tiers each with its bait, the catch chosen by place and
gear), no fishing without bait, the Shoal fishing like other water (T-604).

## What the player sees and does

- **Waters** (never run out):

  | Water | Level | Rod, no bait | Rod with bait | Trap |
  |---|---|---|---|---|
  | Coast (Starter Camp) | 1 | Tropical 85, Salmon 10, Swordfish 5 | Shrimp Bait: 50/40/10 | Raw Shrimp; with Worm Bait Shrimp 60, Lobster 40 |
  | River | 1 | Trout 70, Salmon 30 | Worm Bait: 40/60 | — |
  | Lake | 1 | Trout 85, Salmon 15 | Worm Bait: 50/50 | — |
  | Bog Pool | 15 | Trout 90, Salmon 10 | Worm Bait: 70/30 | — |

- **Shrimp Coast**: a node giving 1 Raw Shrimp every 3 s with a rod, no bait,
  1000 uses.
- **Baits**: Worm Bait (from Worms: 10% from wheat and lavender, 30% from the
  Frog) and Shrimp Bait (from Raw Shrimp), made two at a time by Crafting.
- **Rods**: Fishing Rod (starter), Fine Fishing Rod (tier 2, "Keen Line"),
  Trap (starter, Coast only). A Fishing Hut is a fishing camp.
- **Cooking**: Cooked Trout needs Cooking 35, though trout is the commonest
  fish; Salmon has only Lavender Salmon (35); Tropical, Shrimp at level 1.

## What really happens underneath

- **The first carried bait** a pool takes is used; one is spent per catch
  (Preservation can keep it); a failed cycle keeps it.
- **No bait**: the basic pool, silently. Your ruling says no fishing without
  bait (the hero stops and says so, like arrows, T-573).
- **The rod's tier does nothing**, and Keen Line raises every fish alike, so
  it changes nothing. A net tool kind and a net effect exist with no item.
- **The catch** gets Yield, Double Loot, Giant Harvest and Double Item.
- **The content check and CMS pricing** assume a no-bait pool (the check
  warns without one; water is priced from it), which clashes with your ruling.
- **The approved Fishing roadmap** (content_fishing.md, 2026-11-04) says
  better tools gate fish (harpoons) and bait is optional; both clash with
  later rulings. It also retires the Shrimp Coast, still in the world.
- **The Fishing Hut's** written reach (280) is never read; camps use 240.
- **The Shrimp Trawler Potion** has no effect (ruled to buff Raw Shrimp,
  T-526).

## What the owner controls in the CMS

The Catch pools block (tool, bait, weighted catches); bait items; rods'
tiers. Not in the CMS: first pool wins, one catch a cycle, one bait a catch,
grid order for bait, tier ignored at water.

## What it touches, and where it overlaps another system

- **Ranged** (A16, done): out of ammo stops the same way (T-573).
- **Events** (A4, done): the Fish Shoal (T-604).
- **Equipment** (A29, done): tools faster by tier (T-515 leaves fishing to
  this overhaul).
- **Cooking** (A12): fish recipes and levels.
- **Telling the player**: the silent moments topic.

## Where it differs from the GDD

- GDD: "no content yet"; four waters ship. No Dock and no sea water exist.
- GDD: with no bait the basic pool; your ruling says no fishing.

## Try this (in the tagged build, with the QA panel)

1. **Set-up**: a new game (it has a Coast). QA panel: Worm Bait, Shrimp Bait,
   a Fine Fishing Rod; place a River.
2. **Fish the Coast** with no bait, then with Shrimp Bait: the odds shift.
3. **Fish the River** with Worm Bait until it runs out: the hero carries on
   with no word.
4. **Swap to the Fine Fishing Rod**: no difference.
5. Ask yourself: how should fish tiers, baits and places fit together?

## Owner feedback (2026-11-20)

Interviewed together with the Gathering group, without playing first.

- **The approved plans**: build all four now; the Fishing plan amended first
  to the rulings.
- **Items with no use**: every gathered item has a job.
- **Tool tiers**: better nodes need better tools, and better tools are
  faster.
- **Uses**: "One rule, generally going to be around 5."
- **A resting vein**: its own picture, no message.
- **No seed**: the hero says so, like bait.
- Leftovers filed as offered.

## What it became

- **T-622** (planning agent, content agent): build the Fishing plan, amended first.
- **T-623** (director): no fishing without bait.
- **T-624** (content agent): build the Mining and Forestry plan; tools gate.
- **T-625** (content agent): build the Farming plan.
- **T-626** (planning agent, content agent): every gathered item has a job.
- **T-627** (planning agent, content agent): nodes run out after about five uses.
- **T-628** (director; owner art): a resting vein has its own picture.
- **T-629** (director): no seed, the hero says so.
- **T-630** (content agent; director): gathering leftovers.
- **T-631** (planning agent): GDD on gathering.

All ten tickets cover the whole Gathering group, blocked on it; the group is ready to brief.

## Evidence

- Waters, pools → `data/tokens.json:307, 3626, 3684, 5043`; Shrimp Coast → `:403`; Fish Shoal → `:6576`
- Cycle: tool, bait, pool, spend → `src/systems/board/Fishing.js:22-52, 84-88`, `src/systems/board/HeroTools.js:49-55`, `src/config/registries/catchPools.js:36-44, 74`; landing → `src/systems/board/BoardRunner.js:299-343, 312-321`
- Tier ignored → `src/config/registries/toolKinds.js:95-108`; Keen Line → `data/effects.json` (`effect_keen_line`, CATCH_WEIGHT with no category), `src/config/registries/modifierPalette.js:547`
- Baits and recipes → `data/items.json:1816-1848`, `data/tokenRecipes.json:2020, 2054`; fish recipes → `data/tokenRecipes.json` (`recipe_cooked_trout` level 35)
- Check and pricing clash → `src/systems/core/toolRule.js:105-147`, `cms/src/engine/fieldAdapter.js:116-124`
- Fishing Hut reach unread → `data/tokens.json:6021`, `src/systems/board/Camps.js:21, 104-107`
- Roadmap → `docs/active/content_fishing.md`
- GDD → `docs/reference/GDD.md:410-445`
