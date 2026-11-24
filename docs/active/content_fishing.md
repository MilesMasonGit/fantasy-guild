Status: approved 2026-11-04, amended 2026-11-21, **amended and approved 2026-11-24 by the owner's review** ([brief 850](briefs/850_fishing_spots.md); a CMS pack still to come)

# Content roadmap: Fishing

*Part of session 2 of [concept_content_roadmap.md](concept_content_roadmap.md). Planning agent's list from the owner's answers, 2026-11-04. Names and rough levels are decided here; weights and timings are the ledger's.*

## The owner's rulings (2026-11-04)

- **Better tools gate fish.** *Amended 2026-11-21 (owner): better waters ask a rod tier; bait picks the fish within a water (below).* ⚠️ Amends "a tool's tier never gates" ([GDD](../reference/GDD.md), brief 230 S5; `concept_skill_loops.md`).
- **Three tools: Rod, Trap, Harpoon.**
- **Special waters: Shipwreck, Oyster Bed**, with the Coral Reef and Shark-Infested Waters below.
- **Other catch: Seaweed.**
- **An Oyster item for the Oyster Bed.**
- **Special Tokens let certain fish spawn**: "A coral reef for tropical fish and Shark-Infested Waters for the Shark."
- **A fish's Cooking recipe opens at the Fishing level to catch it.** "If a salmon needs level 40 to be caught, it should be cooking level 40."
- **More special spots to come**, for interesting ingredients for Alchemy and other skills.
- **Kept**: water never runs out; water type, bait and tool choose the catch. *Amended 2026-11-21: bait is no longer optional except at the Trap, and each fish tier has its own bait (below).*

## Amended 2026-11-24: one Bait, lures pick the fish (owner review)

*The owner's review of the 21 Nov plan, before brief 770 G2. **It replaces every line below that it
clashes with**: the bait ladder, "better waters ask a rod tier", the Lobster Pot and the Bog Pool. The
items already shipped Planned in pack `2026-11-22-fishing-items` (the per-tier baits) are cut by the
next pack.*

> "You can hunt a shark with any kind of harpoon, but using a higher tier one will be more efficient.
> [...] The player changes the lure to pick what fish they want to catch." (owner)

1. **Three tool kinds: Rod, Harpoon, Trap.** The **Lobster Pot goes**. A fish asks a tool **kind**,
   never a tier: any rod catches any rod fish, any harpoon any harpoon fish. ⚠️ This takes back the
   11-04 "better tools gate fish" and the 21 Nov "better waters ask a rod tier" (Coral Reef no longer
   asks the Fine Rod, Shark-Infested Waters any harpoon); the GDD's "a tool's tier never gates" holds
   for Fishing again.
2. **Better rods and harpoons make higher fish practical**: a better tier is faster and **uses less
   Bait per catch**, and may carry bonuses of its own (yield, rare finds), as other tool families do
   (T-515). The content agent sets each tier's numbers with the ledger.
3. **One Bait for all fishing.** A single item, **Bait**, spent on every rod and harpoon catch, and
   **more of it for rarer fish** (a Shark asks more than a Trout). Made **mainly from Raw Shrimp**: a
   poor food for heroes, easy to gather in bulk, so it turns into a lot of Bait. Carried in a
   consumable cell, as today (bait in the Bank alone does not do). Out of Bait: "Needs Bait" (G1's rule).
4. **Lures pick the fish.** One lure per rod or harpoon fish (a Salmon Lure, a Shark Lure). A lure is
   **equipped in a stack** and has **a chance to break** each catch: one lure lands many fish, but a
   long expedition needs a supply. The lure carried picks which fish bite, if the water holds it.
5. **No lure: a random roll.** A hero fishing without a lure rolls among the water's fish their tool
   kind and Fishing level allow, and the catch takes **the longest cycle of those fish**. A lure is how
   you fish fast for one fish.
6. **The Fishing level still gates each fish**, and Cooking's recipe still opens at the same level. A
   lure for a fish above the hero's level: they don't fish there and say "Needs Fishing 40".
7. **The Trap: one Trap fish per area, no lure.** Each water (or special water) holds at most one Trap
   catch. **Raw Shrimp needs no Bait** (the free start); every other Trap catch (Lobster, Crab, Oyster)
   **spends Bait**.
8. **River and Lake are one water**: the same catch (both kept as looks). **The Bog Pool goes.**
9. **Seaweed is a Field fertiliser** (a Farming input) and **Pearls go into gear** (Enchanting or
   jewellery); the content agent places them in the pack.

10. **Which fish a place holds: the water's kind plus the Region's biome** (owner). A water's kind
    (Coast, River/Lake, a special water) sets its base catch; the biome adds or swaps a few (a warm
    Coast holds Tropical Fish). ⚠️ **Fish are a world resource to balance across the hex map** (owner):
    higher fish in later rings, and **every fish reachable somewhere** ([concept_atlas.md](concept_atlas.md),
    the ladder's rung mapping, T-294).
11. **The water's Token card lists every fish it holds, plainly** (owner): name and sprite, its tool
    kind and Fishing level, greyed with the level it asks while out of reach, and **which lure picks
    it**.
12. **The world map's resource view gets a section per gathering skill** (owner): what each place
    offers to Mining, Forestry, Fishing and Farming ([concept_world_map.md](concept_world_map.md)).
13. **A lure for a fish this water lacks**: the hero fishes the lureless random roll, **the lure is not
    used up**, and their bubble says "No Salmon here" once (owner).
14. **Hovering a fishing spot shows the fish that could be caught there** in its speech bubble (owner;
    the water's version of [concept_playmat_declutter.md](concept_playmat_declutter.md) §12.3); the
    card says which lure each needs.
15. **A Dock**, its own gathering foundation on the shore, offers the Fishing Hut, a Bait Shed and a
    Lure Workshop ([concept_gathering_foundations.md](concept_gathering_foundations.md), draft).

### Second round, 2026-11-24: spots, lures, the fish list, Bait

16. **Water is ground; fishing spots are Tokens that come and go** (owner). The mat's water cells
    (sea, river, lake) are terrain; **Fishing Spot** Tokens drift in on them and leave by themselves,
    with no player doing anything. Today's Coast, River and Lake Tokens go. A spot's fish come from
    the water it sits on plus the Region's biome (point 10).
17. **A spot moves on by chance**: each catch has a small chance the spot leaves (no counter); an
    unworked spot drifts off after a while (owner).
18. **When a spot goes, a hero ordered by hand stops; a Fishing Hut's hero moves to the next spot**
    in reach that fits their tool and level (owner). The Hut is what keeps fishing running.
19. **A new Dock building makes spots more common** in its reach (owner; name the content agent's,
    e.g. a Chum Station). The Fishing Hut keeps heroes moving; this one brings the fish.
20. **Spots don't count toward the Token cap** (owner), as events don't.
21. **Special waters are rare spot kinds** (owner): the Oyster Bed, Coral Reef, Shipwreck and
    Shark-Infested Waters drift in rarely on the right water and biome (a Coral Reef only on warm
    sea), each with **its own fixed catch**: lures don't matter there, only the tool kind, level and
    Bait. The **Fish Shoal** is the richest, an event ([content_events.md](content_events.md)).
22. **Three lures** (owner), early, mid and late in the main, **overlapping tiers**: a lure covers a
    few fish across bands (a Feather Lure: two early fish and one mid). **A map holds at most one fish
    per lure**, so a lure always means one fish there; the world tables enforce it.
23. **Harpoons take no lure, but spend Bait** (owner). A harpoon covers its own few fish, also
    overlapping (one mid, two late); without a lure it rolls among the harpoon fish the spot and
    level allow, as point 5.
24. **New late rod fish** so the late lure has fish, fresh and sea (owner; names the content agent's).
25. **Bait has many recipes, one per fish** (owner): a **Fishing** recipe turns a raw fish into
    Bait, **at the same Fishing level as catching that fish** ("if they can catch it, they can make
    it into bait"); **rarer fish give more Bait**. Raw Shrimp is the first, free from the Trap. Each
    gives very little XP. Other sensible materials may join (the content agent's). This replaces
    "Bait is made by Crafting".
26. **Seaweed is a rare by-catch at sea** (the rare-finds table), no lure or Trap slot of its own.

**The fish list, lean** (owner's rule: no kind without a gameplay job; subject to change, the content
agent's to fill within these rules): rod fish in three lure groups with overlap (early: Trout,
Anchovy; mid: Salmon, Tuna; late: two new rod fish, fresh and sea); harpoon fish (one mid, two late:
Swordfish, and the Shark at its own spot); Trap catches, one per water (Raw Shrimp free; Crab,
Lobster); the special spots' own (Oyster with a rare Pearl, Tropical Fish, the Shipwreck's goods).

**Planning agent's calls (simplest first; the content agent may move them):** Raw Shrimp is the
River and Lake's free Trap catch; Lobster is the Coast's Trap catch; Oyster the Oyster Bed's; **Crab**
(new, the owner's example) a Trap catch where a water has none, or cut if none is free. Lures are made by
Crafting (or the Dock's Lure Workshop). *Bait: point 25.*

## Amended 2026-11-21 (Systems Audit, T-622, T-623, T-604)

*Partly superseded 2026-11-24 (above): bait is one item, lures pick the fish, tiers never gate.*

The owner's rulings from the audit of Fishing ([A8](audit/A8_fishing.md)) and of events ([A4](audit/A4_events.md)). They replace the lines they clash with above.

- **No fishing without bait, with one exception.** A hero with no bait the water takes leaves the water and says so ("Needs Worm Bait"), as a hero with no arrows leaves a fight (T-623). There is no basic, bait-free catch any more, **except the Trap** (owner 2026-11-21): early fishing is a Trap with no bait, catching Raw Shrimp. It is the one bait-free catch, and how a new guild starts fishing.
- **Bait is carried**, in a consumable cell, as arrows are (planning agent's call 2026-11-21): bait in the Bank alone does not do. The Trap's Raw Shrimp needs none.
- **A fish's price includes its bait** (owner 2026-11-23), like any resource used in production: the ledger and the CMS price a catch with the bait it spent. Lands with the CMS's water pricing in the Fishing pack.
- **Each fish tier has its own bait.** A bait opens its tier's fish; reaching the next tier of fish means making the next bait. This replaces "bait stays Shrimp Bait and Worm Bait" below: the bait list grows with the fish.
- **The catch is chosen by place and gear**: the water (or special water), the tool kind (Rod, Trap, Lobster Pot, Harpoon) and the bait carried. Each water should hold a catch of its own, so where you fish matters (today River, Lake and Bog Pool hold the same two fish).
- **Better waters ask a rod tier; bait picks the fish within a water** (owner 2026-11-21). A water's catch asks a tool kind and, for the better waters, a tier of it, as veins ask a pickaxe tier: the Coral Reef asks the Fine Rod, Shark-Infested Waters the Darkmetal Harpoon. Within a water, the bait carried picks which fish bite. The Master Rod is faster and gates no fish of its own.
- **The Fish Shoal is a rich node that runs out** (T-604, owner 2026-11-21): its catch comes from pools, rod and bait pick the catch, like other water, but it holds a big pool of charges, spends one a catch and goes when they are spent, and its catches are better than plain water's. Its entry is with the events ([content_events.md](content_events.md)).
- **Better tools are faster** (T-515, "Fishing tiers wait on the A8 overhaul"): a better rod speeds the work, made the way other tool families are.

**What the content agent builds from this** (planning agent's calls, simplest first):

- **One bait per fish tier**, named by the content agent when it writes the pack; Worm Bait stays the first, Shrimp Bait the second. A new guild fishes first with the Trap, which needs no bait (owner 2026-11-21), so the first bait need not be in reach on day one.
- **A Bog Pool stays only with a catch of its own**; otherwise it goes, as the no-clutter rule says.
- **Treasure** for Fishing comes as a rare table (T-553), not as a fish.
- **The Master Rod loses its Salmon gate**: better waters ask a rod tier; within a water, bait picks the fish. The Harpoons, Trap and Lobster Pot gate by kind.

## Items ahead of the waters (2026-11-22)

*Superseded 2026-11-24: the per-tier baits below are replaced by one Bait and a lure per fish; the Master Rod stands; the Lobster Pot goes.*

The owner asked for Fishing's items while its waters wait for brief 770 G2. Pack `2026-11-22-fishing-items`:

- **Live**: the **Master Rod**, Crafting 42, from Maple Planks, Mythril Nails and a Beeswax Comb (the line, as the Fishing Rod has, since String waits on Tailor). It is a tier 3 rod; it gates no fish of its own, and is faster once T-515 lands.
- **One bait per fish tier** (content agent's names, simplest: each tier's bait is cut from the tier below's fish, as Shrimp Bait is from Raw Shrimp). All are Planned until G2 lets a pool ask for them:

| Fish tier | Fish | Bait | Made |
|---|---|---|---|
| Copper (1-19) | Raw Shrimp | none: the Trap | |
| Copper (1-19) | Trout, Seaweed | Worm Bait | Crafting, from a Worm |
| Iron (20-39) | Oyster, Tropical Fish | Shrimp Bait | Crafting, from Raw Shrimp |
| Mythril and Gold (40-59) | Salmon, Lobster | Trout Bait | Crafting 38, from a Trout |
| Adamantine (60-79) | Swordfish | Salmon Bait | Crafting 39, from a Salmon (Crafting 60 to 79 are full) |
| Darkmetal (80-99) | Shark | Swordfish Chum | Crafting 79, from a Swordfish |

- **Planned catches**: Seaweed, Oyster and Pearl, with their sources and users in their notes.
- **Held for G2**: the Lobster Pot and the two Harpoons (their tool kinds don't exist yet), the waters' pools, the Bog Pool's fate and the Fish Shoal. Those come in the waters pack after G2 merges, which also turns the Planned entries live.

## Fish and what catches them

Fish keep their order from [food and drink](content_food_and_drink.md), on the 20-level tiers.

*This list (9 rows) now lives in the [content catalogue](content_catalogue.json); see it on the [Guild Art Board](https://claude.ai/artifact/FVnAmmtaiwuoNZCuHpt2za), filtered to Fishing. The rulings and reasoning stay on this page.*

## Tools

*The seven tools (Trap, Fishing Rod, Fine Fishing Rod, Master Rod, Lobster Pot, Adamantine and Darkmetal Harpoon) are entries under Crafting and Smithing in the [content catalogue](content_catalogue.json); see them on the [Guild Art Board](https://claude.ai/artifact/FVnAmmtaiwuoNZCuHpt2za). Which tool each fish needs is on its entry.*

These fill open levels on [Crafting](content_crafting.md) and [Smithing](content_smithing.md).

## Special waters

*This list (4 rows) now lives in the [content catalogue](content_catalogue.json); see it on the [Guild Art Board](https://claude.ai/artifact/FVnAmmtaiwuoNZCuHpt2za), filtered to Fishing. The rulings and reasoning stay on this page.*

## Planning agent's calls

- **Waters stay Coast, River, Lake.** The Shrimp Coast goes, as ruled in October. Bog Pool could join River and Lake with the same fish; it isn't needed.
- **Bait stays Shrimp Bait and Worm Bait**: no more bait kinds until something needs it. *Amended 2026-11-21: each fish tier needs its own bait now.*
- **Harpoons on Adamantine and Darkmetal**, because those are Smithing's open levels. **Each fish waits for its Harpoon** (owner asked for the fix, 2026-11-07; [the gate rules](../reference/BALANCE_RULES.md) section 6): the Adamantine Harpoon is Smithing 63 and Swordfish Fishing 63; the Darkmetal Harpoon is Smithing 83 and Shark Fishing 83, since level 81 holds the Darkmetal Woodaxe that Ebony needs. Cooking's first recipe for each moves with it.

## What this changes

- **Cooking's fish levels now match** ([food and drink](content_food_and_drink.md)), and that list has moved to the 20-level tiers.
- **Today's Coast** gives Tropical Fish, Salmon and Swordfish with a plain rod, and Rivers give Salmon: those pools change. Every water loses its bait-free pool (T-623) except the Trap's Raw Shrimp.
- **Tool gating** needs a rule: a water's catch pool asks for a tool of a certain tier, which it doesn't today (brief 770 G2 builds it). Better waters ask a rod tier; bait picks the fish within a water.
- **Seaweed and Pearls** need their users, or they go by the no-clutter rule.
- **More special spots for Alchemy**: to come with its session.
- **A Fishing Hut's Wider Reach and Rare Finds** variants follow ([Construction](content_construction.md)).
- **The Fish Shoal's entry** in [content_events.md](content_events.md) ("4 fish a cycle", no bait) changes to catch pools with bait, a big charge pool that runs out, and better catches than plain water (T-604).
