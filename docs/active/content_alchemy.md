Status: approved 2026-11-04, amended 2026-11-21 (Planned entries staged 2026-11-26 in the `2026-11-26-planned-*` packs, T-305; the owner reviews and Syncs)

# Content roadmap: Alchemy

*Part of session 5 of [concept_content_roadmap.md](concept_content_roadmap.md). Planning agent's list from the owner's answers, 2026-11-04. Names and rough levels are decided here; how strong, how long and how many are the ledger's.*

## The owner's rulings (2026-11-04)

- **"We'll have to plan out potion types and effects first."**
- **Three types: work potions, elixirs, poisons.**
- **"I don't want too many types of herbs."** About eight.
- **"Potions made with one or two herbs, a weird item to help act as a gate, and water or juice."**
- **Weird items**: first the items waiting for a job, then enemy drops.
- **Water early, juice for strong potions.**
- **Kept**: a hero carries potions and one is used automatically as work or a fight starts.

## Amended 2026-11-19 (owner)

- **Birdwatcher moves to level 1**, so a new hero can train Alchemy from the start (the balancing page found nothing to train before 5). Lavender stays on Farming 5, so the first potions wait on a Farming hero for about 15 minutes.
- **Its weird item becomes a Bird Nest** (agent's call): Feathers arrive with the Hollow Tree at Forestry 10, too late for level 1, while Bird Nests come from the Oak Tree from Forestry 1 and had no user. A potion that brings more nests while chopping, made from a nest, also suits it.

## Amended 2026-11-21 (Systems Audit, T-587, T-588)

The owner's ruling from the audit of Stealth ([A18](audit/A18_stealth.md)): "Optional consumable that can be used with stealth weapons. Works like a potion, providing a buff for a set of attacks if using a stealth weapon."

- **A poison works like an elixir, not a coating.** It is carried in a consumable cell and taken as a fight starts, but only by a hero holding a Stealth weapon; with any other weapon it stays in the bag.
- **Its buff lasts a set number of attacks** (a new "for N attacks" length in the CMS), not a number of fights. **Leftover attacks carry into later fights**; a new poison is taken only at a fight's start (owner 2026-11-21), so one that runs out mid-fight leaves the rest of that fight unpoisoned. Every attack counts, hit or miss.
- **Each poison says what it does**: Venom, more crit, Sunder and so on. So the three poisons on the list become three different effects, not three strengths of one, as the rule against ladders of one consumable asks (content agent's call which three; simplest: Venom, a crit poison and Sunder, at the levels they have).
- **Poisons are for Stealth only.** Ranged's poisoned arrows stay a possible Fletching recipe for later, a separate item.

## Types and effects

| Type | When it's used | Effects |
|---|---|---|
| **Work potion** | As a work cycle starts | Rare finds, more yield, faster work, more XP |
| **Elixir** | As a fight starts; lasts a few fights | Resist a damage type, more damage, more crit |
| **Poison** | As a fight starts, with a Stealth weapon only; lasts a set number of attacks, the rest carrying into later fights (amended 2026-11-21) | Each its own: Venom, more crit, Sunder |

## Herbs

Each Herb's Alchemy use opens at its Farming level. Planted at a Herb Garden, or wild in fitting places.

*This list (8 rows) now lives in the [content catalogue](content_catalogue.json); see it on the [Guild Art Board](https://claude.ai/artifact/FVnAmmtaiwuoNZCuHpt2za), filtered to Alchemy. The rulings and reasoning stay on this page.*

## Potions

*This list (21 rows) now lives in the [content catalogue](content_catalogue.json); see it on the [Guild Art Board](https://claude.ai/artifact/FVnAmmtaiwuoNZCuHpt2za), filtered to Alchemy. The rulings and reasoning stay on this page.*

**21 recipes, the rest of the levels open** for what enemies and later skills suggest.

**Art**: you've drawn 92 potion bottles, so most of these should be picks from what you have. New herbs: Mint, Sage, Nightshade, Mandrake, Moonpetal, Starflower, plus seeds.

## What this settles elsewhere

- **Jobs found**: Clay, Quartz, Seaweed, Mushrooms and Pearls now have users. Feathers and Bones gain another. Lizard Scale and Beeswax Comb, which lost their old recipes, take two of the late potions (2026-11-05).
- **Herbs join Farming's open levels** (5, 12, 20, 30, 35, 40, 60, 80).
- **Today's Shrimp Trawler Potion retires**; Birdwatcher's recipe changes; Ironskin and Valor move up.

## What this needs

- ~~Coating a weapon is new~~ Settled 2026-11-21 (T-587): a poison is taken like an elixir with a Stealth weapon, lasting a set number of attacks; the "for N attacks" length is new machinery (director). **Poison Arrows** could also be a Fletching recipe, at its open levels.
- **Enemy drops** for the late potions, from the enemy session.
- **Effects** need checking against the rules that exist; some may be new.

## Building it (2026-11-21, content agent)

- **In the Alchemy pack**: Birdwatcher (Lavender, Bird Nest, Water), Ironskin at 8 (Clay), Valor at 18 (Mint, Bones), the Prospector's Draught at 12 (Mint, Quartz: a small chance of an uncut gem while mining), Scholar's Tonic, Bountiful Draught, Greater Ironskin, Greater Valor, the Elixir of Legends and the Master's Draught; five herbs in Herb Gardens, their seeds in Bird Nests; the Giant Mushroom; Clay to the world's first ring and Quartz to the second, so Ironskin and the Prospector's Draught can be made where they open. The Shrimp Trawler Potion retires.
- **Numbers from the ledger's balance preview**: Birdwatcher's XP raised so Alchemy 1 to 8 trains; the work potions' boosts halved where they stacked past the target.
- **Held**: the three poisons (the "for N attacks" length, T-587); Angler's Luck and Green Thumb (Seaweed), Swift Hands (Feathers), the three wards (Motes), Keen Eye and the Grand Scholar's Tonic (Pearls); Sage and Nightshade, whose potions are all among those.

