# Content philosophy

*The owner's rules for what goes in the game, taken from their rulings in the content roadmap sessions of 2026-11-02 to 11-04 and confirmed by interview on 2026-11-04. The `/content` agent works from this. Where the owner rules something new, follow them and amend this page. The game's design pillars are in [GDD](GDD.md); the content itself is in the `content_*.md` pages under [concept_content_roadmap.md](../active/concept_content_roadmap.md).*

## What content is for

- **Discovery over grind.** New places and Tokens are why a player goes on: a Leyline that unlocks a kind of Magic, a Coral Reef, a Fallen Star. Not just bigger numbers.
- **Skills feed each other.** The interlock is the goal: most good items need more than one skill, so a guild needs many heroes in many jobs.
- **Fantasy gets stranger late.** Early content is familiar: copper, wheat, shrimp. Late content goes fantastical: Voidcap, Moonpetal, Dragonscale. The world widens as you climb.
- **Guidelines, not laws.** Variety per Token and per skill is deliberate. A pattern helps; one exception doesn't become a rule, and a rule doesn't flatten something interesting.

## Rules for items

- **No clutter.** "We have very limited space in our recipe list, so I don't want you to clutter it with items that have no practical purpose." Every item has a concrete job in play. An item with no user is flagged, and goes unless one is found. Something waiting on an unfinished system isn't clutter: "Kunai and Silver are not fully integrated yet, but I will want them to be" (2026-11-05).
- **Every gathered item has a job** (owner, 2026-11-20, T-626). Nothing is gathered that nothing uses: a wood, a stone, a fruit or a catch with no recipe, shop or quest gets a job in a making skill's plan, or it is cut from the node.
- **Gaps beat filler.** Leave a level open, for what later skills need. Don't invent something to fill it.
- **Ideas live apart.** Speculative things go in a "possible" list, clearly not recipes. Ideas and names are cheap: offer plenty, and expect most to be cut.
- **Base set, then specifics.** Settle a small base set first. Base items improve at each main tier ("Some base items will be available in every kind, such as chestplate and pickaxe"). Others are specific ("a Cleaver may only be Iron").
- **Formula over novelty.** A skill's items share a simple, explainable recipe: an Arrow is wood, feathers and arrowheads; a potion is one or two herbs, a weird item, and water or juice.
- **No tier ladders of one consumable** (owner, 2026-11-17). No Elixir of Valor I to V, no five tiers of one enchanted arrow: that is clutter. Tiered effects belong to hero gear and enemies. A consumable's effect may still carry a strength of its own ("an Elixir of Brambles gives its hero Thorns 3"), with no higher Elixir of Brambles.
- **Few middle steps.** A preparation step must earn its place. The owner has cut shafts, sickles, hinges and hoops.

## Rules for levels

- **Most skills are tiered, but not always every 20 levels.** Smithing and Fletching's main tiers start at 1, 20, 40, 60, 80, with silver and gold fitted in at 30 and 50. Construction is three-tiered. Ask how a new skill should tier.
- **An improved version arrives a tier later**: copper dagger at 2, iron dagger at 22.
- **One unlock per level**, as far as real items allow. Levels should feel like a reward, but gaps are better than filler.
- **Gather and use together, usually.** An ingredient's gathering level matches the first recipe that uses it ("If a salmon needs level 40 to be caught, it should be cooking level 40"). It doesn't apply everywhere: some items come from diverse sources.

## Weapon tiers (owner, 2026-11-20, T-566, T-568)

- **Every weapon asks a level in its own style by its tier**: a sword asks Melee, a bow Ranged, a staff Magic, a dagger Stealth. A metal weapon goes by its metal; a wooden bow or wand by the tier it sits in. This is the level to wield it, apart from the level to make it.
- **Fast, normal and slow deal about the same a second**: a fast weapon about two thirds of a normal one's hit, a slow one about four thirds.
- **Two hands pay more**: a two-handed weapon deals more a second than a one-handed weapon of the same metal, paying for the lost shield. How much more is the ledger's. *Waits (owner 2026-11-21): no two-handed weapon is on the lists now the Greatsword is cut, and none is added for it; the line applies to the first two-handed weapon a plan brings.*
- **No Crit Damage** (owner 2026-11-21): a crit is always double. A weapon, trait, gear piece or perk may raise crit chance (Stealth's way to hit hard), never the crit's size; crit chance stops at 75%.
- **The table is a starting point for authoring**, not code: the content agent checks every weapon against it; the ledger tunes the numbers.

| Tier | Level | Fast | Normal | Slow |
|---|---|---|---|---|
| Copper | 1 | 1 | 2 | 3 |
| Iron | 20 | 2 | 3 | 4 |
| Silver | 30 | 3 | 4 | 5 |
| Mythril | 40 | 3 | 5 | 7 |
| Gold | 50 | 4 | 6 | 8 |
| Adamantine | 60 | 5 | 7 | 9 |
| Darkmetal | 80 | 5 | 8 | 11 |

The levels follow the metals' amended ladder (copper 1, iron 20 and on, as in [Smithing](../active/content_smithing.md)), not T-566's "iron 15" (planning agent's call 2026-11-21, the owner may overturn). The ruling's own words, "copper 1, iron 15, silver 30", and the old proposal in code (gold 45, mythril 60, adamantine 75, darkmetal 90) are the old 15-level ladder; the damage columns keep the old proposal's order by position, so damage still rises with level.

## Who makes what

**Each skill has a clear identity.** If a skill gets crowded, add a skill or move items: Tailor exists because "Crafting will be too crowded with 3 combat skills worth of gear in it".

| Skill | Makes | Building |
|---|---|---|
| Smithing | Melee weapons, metal armour, Daggers, gathering tools, ingots, Nails, Arrowheads, Ring Bands, Chain, Gears | Blacksmith |
| Fletching | Bows, Crossbows, Arrows | Fletcher's Lodge |
| Enchanting | Wands, Staves, Tomes; enchants jewellery and gear; special weapons | Enchanter's Tower |
| Tailor | Stealth and Magic armour, Capes, String, fabrics, cloth for buildings | Tailor's Shop |
| Crafting | Ranged armour, jewellery, cut gems, Planks, Parchment, Books, Rods, Traps, Bait, Charcoal | Workshop |
| Cooking | Food (heals in fights), drinks (work buffs only; never heal) | Kitchen |
| Alchemy | Work potions, elixirs, poisons | Apothecary |
| Construction | Every building and Token that's built, on a Foundation | none |
| Mining, Forestry, Fishing, Farming | Gather; see below | Mining Camp, Logging Camp, Fishing Hut, Farmstead |
| Melee, Ranged, Magic, Stealth | Fight | War Camp |

Faith, Summoning, Science, Crime and Taming are still to design. Placeholder buildings: Chapel, Summoning Circle, Laboratory, Hideout, Stable.

## How the skills interlock

| From | Gives | To |
|---|---|---|
| Mining | Ores, Coal | Smithing |
| Mining | Stone tiers | Construction |
| Mining | Uncut gems | Crafting, then Enchanting |
| Mining | Clay, Quartz | Alchemy |
| Forestry | Wood | Smithing's handles, Fletching, Enchanting, Crafting's Planks |
| Forestry | Feathers | Fletching, Alchemy |
| Forestry | Bird Nests | Alchemy's Birdwatcher |
| Forestry | Bamboo | Crafting's Fine Rod |
| Forestry | Mushrooms | Alchemy, Cooking |
| Farming | Crops, fruit | Cooking |
| Farming | Herbs | Alchemy |
| Farming | Flax | Tailor |
| Fishing | Fish | Cooking |
| Fishing | Seaweed, Pearls | Alchemy |
| Combat | Hide, scales, meats, Silk, parts, Lizard Scale, Beeswax Comb | Crafting, Cooking, Tailor, Alchemy |
| Smithing | Arrowheads | Fletching |
| Smithing | Pickaxes, Woodaxes | Mining, Forestry: better ones reach better veins and trees |
| Smithing | Ring Bands, Silver and Gold Chain | Crafting's jewellery |
| Smithing | Chestplates | Enchanting |
| Smithing | Nails, Gears | Crafting, Construction |
| Tailor | String | Fletching, Crafting's rods |
| Tailor | Canvas, Sack, Sail, Drapes | Construction |
| Crafting | Blank Book | Enchanting's Tomes |
| Crafting | Jewellery | Enchanting |
| Crafting | Planks | Construction |
| Enchanting | Motes (Leylines) | Enchanting, Tailor's top tiers, Alchemy's elixirs |
| Cooking | Juices | Alchemy's strong potions |
| Alchemy | Poisons | Stealth, taken like an elixir (2026-11-21, T-587); Fletching's poison arrows, later |

**Every new item should say where it comes from and what it goes into.** A change to one skill's list usually touches others; carry it through.

## Jewellery (owner, 2026-11-21)

"Could have a wide variety of effects. Generally using rings for work boosts and amulets for combat boosts is a good idea. Instead of just making sets of boosts for different skills, I would want it to have more unique effects." Each gem gives a ring one work effect and an amulet one combat effect of its own (twelve in all, [content_crafting.md](../active/content_crafting.md)); gold carries twice silver's.

## Gathering

**Gathering is Tokens, not chains.** Mining, Forestry and Fishing have no item ladder. Their interest comes from creative Tokens in the gaps between tiers, each playing differently and supplying something useful: a Geode's burst, a Hollow Tree's birds, a Coral Reef.

**Nodes run out after about five uses** (owner, 2026-11-20, T-627): "One rule, generally going to be around 5." Veins rest and trees become Stumps after about five uses, the rich ones too; a Token that plays differently (a Hollow Tree that never falls, water that never runs out) is a choice made for it, not a drift.

**Farming** has no tool: progress is crop levels, places, and buildings that boost production. Tools gate the other gathering skills: each tier of node or water asks that tier of tool (pick, axe, rod, harpoon; owner 2026-11-20, T-624; fishing 2026-11-21). *Amended 2026-11-21 (content agent): a metal vein asks the pickaxe of the metal one tier below its own, since its own would be a loop (mythril to get mythril); the pack gate caught it. Trees, waters and other nodes have no such loop ([content_mining_forestry.md](../active/content_mining_forestry.md)).*

## Buildings

**One clear building per skill that needs one: a structure, not furniture.** Higher tiers are variants with different benefits, picked from a menu: Faster Work, Double Output, Save Materials, More XP, Wider Reach, Quick Refill, Rare Finds. Not every building has every type.

## Art

The owner draws. Plans say exactly what to draw: H have, A adapt, N new. Using existing art is welcome and it's worth checking what's drawn before proposing something, but **art doesn't limit the design**.

## Where content lives (owner, 2026-11-18)

- **One catalogue, many views.** Every planned item, Token, building and event is one entry in [content_catalogue.json](../active/content_catalogue.json). The chain pages keep the rulings and the reasoning, and the [Guild Art Board](https://claude.ai/artifact/FVnAmmtaiwuoNZCuHpt2za) is built from the catalogue: "This will be helpful for my art list." Links between entries go by id, so a name spelled two ways is caught. This amends the roadmap's 2026-11-02 "readable chain pages first".
- **Locks are per entry.** "I think I'll need to lock per entry, item or token. I'll probably start by building art that is either guaranteed to be used or could be used in a different spot if I need to." A locked entry's name, kind and look are settled; changing one needs the owner's say-so. Numbers stay the ledger's, locked or not.
- **Balancing has its own view** (owner, 2026-11-18): "Generally I want the game to be balanced according to the rules and parameters we set. We need the system to adjust the details like recipe inputs and XPH to keep the game smoothly balanced." The owner sets rules and dials; the system works out XP, counts, times and small unlock moves, and flags only the empty stretches content must fill ([concept_balancing_view.md](../active/concept_balancing_view.md)).

## Working with the owner

- **Big questions, then a full list.** A few multiple-choice questions on the shape, then a complete list to edit. Later, more reviews: "adjusting all the recipes in a skill".
- **No item-by-item questions.** Take the simplest choice and say so in a line.
- **When a new idea conflicts with an old rule: flag it once, follow the owner.** Say in a line what it changes and what's affected, do it, and record the amendment. Never argue, and never quietly keep the old rule.
- **Numbers are the ledger's.** Names, ingredients and rough levels are decided in a session; quantities, times, damage and prices come from balancing, by the formulas in [BALANCE_RULES.md](BALANCE_RULES.md).
