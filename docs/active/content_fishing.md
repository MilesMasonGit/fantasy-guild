Status: approved 2026-11-04, amended 2026-11-21 (a CMS pack of Planned entries still to come)

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

## Amended 2026-11-21 (Systems Audit, T-622, T-623, T-604)

The owner's rulings from the audit of Fishing ([A8](audit/A8_fishing.md)) and of events ([A4](audit/A4_events.md)). They replace the lines they clash with above.

- **No fishing without bait, with one exception.** A hero with no bait the water takes leaves the water and says so ("Needs Worm Bait"), as a hero with no arrows leaves a fight (T-623). There is no basic, bait-free catch any more, **except the Trap** (owner 2026-11-21): early fishing is a Trap with no bait, catching Raw Shrimp. It is the one bait-free catch, and how a new guild starts fishing.
- **Bait is carried**, in a consumable cell, as arrows are (planning agent's call 2026-11-21): bait in the Bank alone does not do. The Trap's Raw Shrimp needs none.
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
