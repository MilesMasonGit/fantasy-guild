Status: draft

# The content roadmap: everything the game will contain

*Opened 2026-11-02 (owner). Many iterative sessions, each on one part of the
supply chain.*

## The goal (owner, 2026-11-02)

Lay out the essential roadmap of items, skills, recipes and so on, so that **when
the owner creates art, they know exactly what they are making**: specific food,
recipes and their ingredients, those supply chains, enemy drops, weapon effects,
all of it.

**What this adds to earlier docs**: [concept_basic_content.md](concept_basic_content.md)
covers the camp to plane 2 and [concept_skill_loops.md](concept_skill_loops.md)
how each skill plays. Neither lists the whole game. Roadmap sessions extend
them; they don't re-open their rulings.

## Where the game stands (counted from `data/` and the ledger's plan, 2026-11-02)

| Tier | Budget | Live items | Live Tokens | What it holds |
|---|---|---|---|---|
| 0 Starter Camp | 30 min | 49 | 41 | copper tools, weapons and armour; first food |
| 1 Plane 1 | 25 min | 32 | 28 | fruit, cooked meat and fish, Beer |
| 2 Plane 2 | 1 day | 47 | 29 | iron gear, leather, first potions |
| 3 and on | **none** | 41 | 33 | raw materials and three pickaxes |

- **The last tier holds five metals and five woods** (silver, gold, mythril,
  adamantine, darkmetal; birch, maple, cedar, mahogany, ebony) but no weapons,
  no armour, and no cooked food: only raw fruit and two drinks. **What those
  materials are for isn't designed yet.**
- **The first ritual is aimed at 1 to 3 months of play**
  ([concept_progression.md](concept_progression.md)), while budgets stop at about
  a day. Nearly all of the game's length has no plan.
- **Recipes by skill**: Construction 51, Smithing 34, Cooking 16, Crafting 11,
  Farming 3, Alchemy 2.
- **Seven specialist skills have no content**: Fletching, Faith, Summoning,
  Enchanting, Crime, Taming, Science. Arrows wait on Fletching.
- **The Planned list has 15 entries**, for the whole unmade game.
- **Every item has a sprite file**, and one Token (Coconut Tree) has none. That
  doesn't say which are final art: the roadmap's art column records that.

## How a session works

The agent brings a **full proposal for one chain** as tables; the owner edits it.
No item-by-item questions: the simplest choice is taken and said in a line.

Each entry records:

| Field | Example |
|---|---|
| Name and kind | Lavender Salmon, food |
| Rung | where on the ladder it arrives |
| Comes from | wild origin, enemy drop, or recipe |
| Made with | skill, rough level, station, ingredients |
| Used by | what needs it next; **nothing should be a dead end** |
| Art | have, adapt, or new |

**Names, ingredients and rough levels are decided here. Exact quantities, times
and prices are left to the ledger's balancing**, since they change as chains
join up. A chain that needs something not designed yet gets a stub and a line in
**Open links**, picked up when that chain's session comes round.

After each session the new art goes into [owner_art_list.md](owner_art_list.md).

## Session order (owner, 2026-11-02)

1. **The ladder**: the game's rungs from copper to the end, each rung's time
   budget, wood and level band. Everything else hangs from this.
2. **Food and drink**: Farming, Fishing, Cooking, drinks.
3. **Metal and gear**: Mining, Smithing, weapons per style, armour families.
4. **Wood and buildings**: Forestry, Construction, Crafting, stations.
5. **Herbs and potions**: Alchemy.
6. **Enemies**: the roster per rung, drops, bosses, weapon effects.
7. **Specialist skills**, one at a time.
8. **Roll-up**: the full art list, and the ledger run over the whole plan.

Later sessions will revise earlier ones; that is expected.

## Decisions

- **Where it lives** (owner, 2026-11-02): readable chain pages first. An approved
  chain goes into the CMS as Planned entries through a pack, so the ledger can
  check it; Planned entries never reach the game.
- **One rung per metal** (owner, 2026-11-02): seven rungs, copper, iron, silver,
  mythril, gold, adamantine, darkmetal (order amended the same day, see The ladder).
- **Tailor joins as a specialist skill** (owner, 2026-11-04), making 21 skills and eight specialists.
- **The seven specialist skills are confirmed for now and designed after the core
  chains** (owner, 2026-11-02); skills may still be added or cut later.
- **Food and drink is the first chain after the ladder** (owner, 2026-11-02).

## The ladder (owner, approved 2026-11-02)

**Amended by the owner, 2026-11-04: "each new tier to start every 20 levels. Copper is 1-19, Iron is 20-39, etc. We'll fit silver and gold in where it fits."** Metals open at copper 1, iron 20, silver 30, mythril 40, gold 50, adamantine 60, darkmetal 80. The table's "Opens at level" and its times below are from before this and must be worked out again; [Cooking's list](content_food_and_drink.md) still uses the old bands and follows when its pack is made. ⚠️ Darkmetal opens six levels sooner and iron five later, which moves the ledger's budgets.

| Rung | Plan tier | Wood | Opens at level | Mined with | Focused guild reaches it | Even spread reaches it | Rings (main-line cells, roughly) | What the player is chasing |
|---|---|---|---|---|---|---|---|---|
| **Copper** | 0, 1 | Oak | 1 | copper pick | start | start | Hall + ring 1 (7) | First tools and weapons, first fight, first place settled |
| **Iron** | 2 | Fir | 15 | copper pick | about 1.5 h | about 4 h | ring 2 (6) | Real gear in every style, leather, first potions, building your own nodes |
| **Silver** | 3 | Birch | 38 | iron pick | day 1 | day 2.5 | ring 2 (6) | First rings and amulets, gems start to matter, a new kind of enemy |
| **Mythril** | 4 | Maple | 50 | iron pick | day 4 | day 8 | ring 3 (4) | The next pickaxe, gear that feels magical |
| **Gold** | 5 | Cedar | 62 | mythril pick | day 9 | day 19 | ring 3 (4) | The best trinkets, the Hall's big upgrades, fine food |
| **Adamantine** | 6 | Mahogany | 74 | mythril pick | day 18 | day 36 | ring 3 (5) | Style bosses and party fights, specialised Regions |
| **Darkmetal** | 7 | Ebony | 86 | adamantine pick | day 29 | day 57 | ring 3 (5) | Level 99s, all 20 final challenges, the ritual (about day 86) |

*Focused: the guild pushes the 10 or so skills the chains need. Even spread: it
keeps all 20 moving. Most players fall in between. Reasoned from the curve, not
measured.*

- **The first ritual needs all 20 skills' final challenges** (owner, 2026-11-02),
  and stays aimed at about 3 months. Heroes hold their own levels and do one job
  each, so 8 heroes take 20 skills to 99 in 20 x (one skill's climb) / 8. Today's
  curve gives 79 days a skill, about 6.6 months in all, so **the curve speeds up
  instead** (next line). This counts one hero at 99 per skill. No slack: most
  players land a little over 3 months.
- **The pace curve's top changes** (owner, 2026-11-02): 12 hours a level at level
  60 (was 1 day), 1 day a level at 99 (was 3 days); level 40 and below unchanged.
  One skill's climb becomes about 34 days, all 20 about 86 days.
- **Silver and gold make no gathering tools** (owner, 2026-11-02): weapons, armour
  and trinkets (the rings and amulets are already drawn). Tools come in copper,
  iron, mythril, adamantine and darkmetal. **The iron pick mines silver and
  mythril; the mythril pick mines gold and adamantine; the adamantine pick mines
  darkmetal.** Hence mythril before gold.
- **Ledger budgets** are the curve's own times, since the ledger counts each skill
  by its own hero: silver 1 day, mythril 3 days, gold 7.5, adamantine 14.5,
  darkmetal 23, the top at 34.5 (time from a new game). The calendar above allows
  for skills waiting on free heroes.
- **Rough size, within about 30 %, specialist skills not counted**: about 230 more
  items, 145 more Tokens, 165 new sprites (about 115 items, 50 Tokens and enemies),
  against today's 175 items and 144 Tokens. Ores, ingots, woods, seedlings, veins
  and trees are drawn for every rung, and 45 enemy sprite files are unused; the
  drawing is mostly weapons, armour and food.
- **Tiers**: 0, 1 and 2 stay. Today's tier 3 splits into 3 to 7 by the table, each
  wood with its metal. Creature banners now in tier 3 stay at silver. Sites and the
  ritual go to darkmetal. Naming is **adamantine** throughout.

## Chain pages

- [Food and drink](content_food_and_drink.md): approved 2026-11-04; 99 Cooking recipes.
- [Smithing](content_smithing.md): approved 2026-11-04; 80 recipes, the rest of its levels open for later skills.
- [Fletching](content_fletching.md): approved 2026-11-04; 16 recipes, five woods, most levels open.
- [Enchanting](content_enchanting.md): approved 2026-11-04; 55 recipes, 44 levels open; Leylines give Motes.
- [Tailor](content_tailor.md): approved 2026-11-04; 56 recipes, 43 levels open.
- [Crafting](content_crafting.md): draft; 76 recipes, 23 levels open.

## Open links

*(Things one chain needs from another not yet designed.)*

- **Tailor is a new skill** (owner, 2026-11-04: "Crafting will be too crowded with 3 combat skills worth of gear in it"): Stealth and Magic gear, and String. Ranged gear stays in Crafting, Melee in Smithing. It's the 21st skill: the first ritual needs every skill's final challenge, and each skill adds about 4 days at 8 heroes, so the ladder's about 86 days moves. Needs its own list, a station, code and CMS support (T-304), and Crafting's notes change.
- **Arrows need Fletching**, which comes after the core chains. Metal and gear
  plans Ranged with arrows as stubs.
- **Fruit and their drinks in tier 3** (8 fruits, Lemonade, Limeade): the food and
  drink session places them on rungs.
- **Trinkets** (metal and gear): silver and gold rings and amulets, 12 of each drawn,
  need gems from Mining and a place in the two Trinket slots.
- **Boots and gloves** (metal and gear): the Planned leather boots and gloves have
  no slot; gear today is hand, hat, chest and two trinkets.
- **Axes and sickles don't gate** (metal and gear, wood): every tree takes a copper
  axe today, and only copper and iron axes and sickles exist as items.
- **The darkmetal pick has nothing to mine**: it becomes a requirement of Mining's
  final challenge (enemies and final challenges).
- **Cedar and ebony have no planted Forest** (wood and buildings), though their
  seedlings exist.
- **Specialist skills need work on earlier rungs** (specialist sessions): otherwise
  a focused guild could spend 57 days on darkmetal while they catch up.
- **Final challenges**: 20 sites, one per skill; the Planned list has 9 and older
  docs say 25, from before five skills were cut (roll-up).
- **Cell requirements follow the ring, not the rung**: every ring-3 cell asks for
  level 30 today, though it may hold darkmetal at 86; the requirement should follow
  the cell's rung, and "no iron to reach iron" should read by rung. Needs world
  tables and code (T-294); the origins pack moves silver and birch into ring 2.
- **The CMS still has the old plan**: tiers stop at 5, stages at 2, the curve is the
  old one, and gates (silver 30, gold 45, mythril 60, adamantine 75, darkmetal 90,
  and their woods) and gold's pick are unchanged. T-294 and a ledger-checked pack
  bring them in; the roll-up runs the ledger over the lot.
