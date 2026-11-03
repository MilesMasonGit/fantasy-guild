# What else could the Guild Hall upgrade?

*Review for the owner's interview, 2026-11-03. Detail-pass Guild Hall item 13. Read from the docs,
`data/` and the code on the `planning` branch. Nothing was run in the game, so "works from a pack"
means the code reads it, not that it was seen on screen.*

**The short version.** A star can already move far more than today's sky uses, but only for **work**.
Fights get nothing from the Hall: the code refuses combat rules on a star, and kill XP ignores XP
bonuses. Today's stars also stop at tier 2, while the ladder runs to tier 7. So the gaps are
combat, the late game, and upgrades that change how you play instead of raising a number.

## 1. What can be upgraded today

47 stars (3 built in, 44 authored), 12 constellations. Authored stars have 86 ranks, **all at tiers 0 to 2**.

| Where | Stars | Top strength today |
|---|---|---|
| The Hearth | Bunk Beds; Infirmary; Larder (a second food); Trinket Case (a third trinket) | 8 heroes; wounds 30 % shorter |
| The Vault | Bank Tabs | 16 tabs of 64 kinds |
| The Well | Wishing Well; lap drops of oak, copper ore, stone, coal, shrimp, iron ore, fir | Lines of 1 to 30 items a lap |
| 9 skill constellations (Forestry, Mining, Smithing, Fishing, Farming, Cooking, Crafting, Construction, Alchemy) | XP, work speed, yield | XP +15 % (Construction +30 %); speed up to 19.9 % faster; yield up to +25 % |
| Some of those skills | Regrowth or rest (Forestry, Mining, Farming, Alchemy); Camp Reach (Forestry, Mining, Fishing, Farming) | Rest up to 30 % shorter; reach up to +45 % |

Decided and coming: a star per ring, the lap going from 10 minutes to 5. No constellation yet for the
4 combat skills or the 7 specialist skills.

## 2. Candidates

**How to read the columns**
- **Build**: **Pack** = content alone, the engine reads it today. **Small / Medium / Large code** = rough size of the code job.
- **Ledger** (can it count the star when pacing?): **Yes** = the rate calculator reads it. **No** = the ledger would list it as "not a rate". **After code** = countable once the calculator is taught it.
- **Feel**: **Number** = a dull bigger number. **Play** = changes what you do.
- ★ = my top ten, numbered. ☆ = a close runner-up.

### Already owed, not new
| Candidate | Player gets | Build | Ledger | Feel |
|---|---|---|---|---|
| **XP, speed and yield ranks for tiers 3 to 7** | The big late boosts the owner asked for (+100 % XP at the top). Today's best is +15 % | Pack (tiers 6 and 7 wait on T-294) | Yes | Number |

This is the largest hole in the sky and comes before everything below. Today's stars can't carry the
late game the 29 October ruling says needs them.

### Heroes
| Candidate | Player gets | Build | Ledger | Feel |
|---|---|---|---|---|
| ★3 **Bigger loadout grid** | 10 to 12 cells, not 9. More room for gear and consumables together | Medium: the grid's size is a fixed number and the screen draws 3 × 3 | No | **Play**: eases the gear-or-supplies choice |
| ★10 **Faster walking** (a stable, good boots) | Heroes visibly cross the mat quicker | Small: a new rule read by hero movement | Barely: the calculator ignores walking (under 1 % on small test boards) | **Play**: felt all the time, wider layouts stop costing |
| ☆ **Veteran recruits** | A late hero starts above level 1, so the eighth isn't useless on arrival | Small | After code; it shortens the ritual sum, so keep it modest | **Play** |
| **Second drink** (Cellar) | Two work buffs at once | Pack | No: Maxed counts one drink | Play |
| **Toolbelt** | Weapon, off-hand and tool together | Pack may do it (hand slots), but the equip code assumes two hands: check | No | Play: fighters still gather |
| **Infirmary, more ranks** | Shorter wounds, down to 1 minute at the floor | Pack | No | Number |
| **Tougher heroes** | More max HP for all | Small | No: fights are coarse | Number |
| **Faster healing** (a bath house) | Quicker than 1 HP per 10 s | Small | No | Number |
| **Eat sooner** | Heroes eat above 25 % HP | Small | No | Number |
| **Mentoring** | Part of a hero's XP goes to the guild's lowest in that skill | Medium | After code, and hard | Play, but it bends the 86-day ritual sum |

### Work and skills
| Candidate | Player gets | Build | Ledger | Feel |
|---|---|---|---|---|
| ★5 **Bonus finds** | Each skill's work sometimes gives something extra: a gem from a vein, a nest from a tree | Small: the Hall only carries rules with a number today; item finds need letting in | Yes (already on its list), once the star can hold it | **Play**: new supply lines, fits silver's "gems start to matter" |
| ★6 **Lucky doubles**: a named item, or a skill's whole drop | A chance of double. Aim it at a material that's holding you back | Pack | Yes | **Half and half**: choosing the item is the fun |
| ☆ **Better catches** (Catch Weight) | Rarer fish more often | Pack | Yes | Play for fishers |
| **Bigger harvests** (Crop Load) | Fields ripen with more harvests | Pack | Yes | Number |
| **Rest and regrowth for the rest** (more veins, herbs, trees) | More Token upgrades, as the owner listed | Pack | Yes | Number |
| **Faster spawners** | Forests and camps refill sooner | Small: spawn intervals read no rule today | After code | Number |
| **Thrift: spend fewer inputs** | Recipes cost less | Pack, **but poor**: see section 3 | Yes | Number |
| **Thrift as a chance** | A chance a cycle spends nothing | Small | After code | Number |
| **Longer drinks and elixirs** | Each dose lasts more than 10 cycles or fights | Small: one number, moved guild-wide | After code | Number, eases supply |
| **Larger forests** (family allowance) | More trees per Forest | Small | Partly | Number; eats the fixed 128 cap |
| **Fewer failures** | Failure chance down | Pack, **pointless today**: no effect in the library uses failure | Yes | Skip until it does |

### Combat
| Candidate | Player gets | Build | Ledger | Feel |
|---|---|---|---|---|
| ★1 **Combat XP by style** | The same XP stars the gathering skills have, for Melee, Ranged, Magic, Stealth | Small: kill XP skips the bonus today. A star aimed at Melee XP passes the audit and silently does nothing | After code: combat XP is "unread" | Number, **but fills a hole**: the ritual needs all four at 99 |
| ★2 **A constellation per style** | Damage, accuracy, dodge, crit, swing time, type damage and resistance for the whole guild | Medium: a bridge from the guild's rules to fights; today these are refused | No: can't tell if a fight is won | **Play** when aimed at types: prepare for a boss's weakness |
| ★4 **Defeat insurance** | Gear loss below 10 % a piece; consumable loss below 25 % of the stack | Small: two fixed numbers | No | **Play**: you dare a harder fight |
| **Food heals more** | Guild-wide Food Healing | Same bridge as ★2 | No | Number |
| **Faster camp spawns** | Enemies return sooner, for drops and XP | Small | After code | Number; only the interval, see section 3 |

### World and settling
| Candidate | Player gets | Build | Ledger | Feel |
|---|---|---|---|---|
| ★8 **Pioneer kit** | Each newly settled place starts with a free Foundation or starter building, more with ranks | Small to medium, in settling | No: it can see a building's price, not that it was free | **Play**: eases the game's recurring chore; respects "no saved layouts" and "no refund" |
| **Cheaper settling** | A percentage off a cell's price | Small | After code; waits on T-294's prices | Number |
| **Cheaper Shop** | A percentage off Shop Tokens | Small | After code | Number |
| **Larger mat** | More ground, same 128 Tokens | Large: terrain, saved places, the owner's laid-out camp. A code comment suggests it, but nothing is built | No | Play, but walks get longer |

### Bank and items
| Candidate | Player gets | Build | Ledger | Feel |
|---|---|---|---|---|
| ★7 **Hall collector radius** | The Hall sweeps loot around itself; ranks widen it. Later, warehouses | Large: T-175; ⚠️ the concept is a draft the owner is still holding | No: the calculator assumes loot is collected | **Play**: layout starts to matter, and fewer floor piles help speed |
| **Trophy room** | Finishing part of the collection log gives a small boost | Medium: the log's base exists, unshown | No | Play: a reason to find everything |

Further Vault stars re-open "Bank Tabs only" (section 3).

### Idle and offline
| Candidate | Player gets | Build | Ledger | Feel |
|---|---|---|---|---|
| ★9 **Longer time away** | Catch-up beyond 24 h, say 36 or 48 | Small: one number, ⚠️ but see section 3 on load time; 24 h is a recorded decision the owner may change | Doesn't move it: the ledger assumes daily check-ins | **Play**: a weekend away isn't wasted |
| **Well lines for later rungs** | Lap drops of silver, birch, bait, seeds, herbs | Pack | Yes | Number; don't undercut gathering |
| **Choose your lap** | Pick one Well line to double | Small to medium | After code | Play: small and frequent |
| **Better bounties** | More reward, or a new one sooner than 3 minutes (not more slots) | Small | No: bounties are untimed | Number; near the retired Notice Board |

### Comfort, and the sky itself
| Candidate | Player gets | Build | Ledger | Feel |
|---|---|---|---|---|
| ☆ **Capstone stars** | A strong star that opens only when a whole constellation is lit | Small: a star opens on *any* neighbour today, and a pack can't say "all" | Yes if it adds a rate | **Play**: a goal, not a shopping list; pairs with detail item 6's ceremony |
| ☆ **Standing orders** | A hero whose job ends takes a next job instead of waiting | Medium to large | No | **Play**: less tending; strong for idle |
| **Saved loadouts** | A hero swaps gear as their job changes | Medium | No | Play |
| **Pick-one stars** | Choose one of two paths in a constellation, so guilds differ | Medium; the ledger must handle choices | Hard | Play |

### Why these ten
1. **Combat XP**: fills a real hole cheaply. Four of the skills the ritual needs have no boost.
2. **Style constellations**: "hero capability" was named as a Hall job, and fights have none of it.
3. **Bigger grid**: the "more consumable room" already promised can't exist without it (section 3).
4. **Defeat insurance**: cheap, and changes a decision, not a number.
5. **Bonus finds**: a new source of materials, and useful at the rungs that lack content.
6. **Lucky doubles**: the only one here that works from a pack today, is fully counted, and has some choice in it.
7. **Collector**: the biggest change to how you play, but it needs the owner's approval first.
8. **Pioneer kit**: eases what the player repeats dozens of times.
9. **Time away**: the most-felt idle upgrade, and a one-number change.
10. **Faster walking**: felt every second, and almost no risk to pacing.

Five of the ten (★2, ★3, ★4, ★7, ★8) and most of the runners-up can't be counted by the ledger, which matters below.

## 3. Gaps and warnings

**Pacing and "mandatory"**
- **A rate star is mandatory by design**: the 29 October ruling says the curve assumes them. So every new
  rate star adds to what everyone must buy. Too many per skill, and the Hall turns into a chore list.
- **Bonuses multiply.** The owner's own example (+100 % XP, 40 % faster) is already 3.3 times the XP
  per hour, before buildings and drinks. Doubles, finds and harvests stack on top for items. The ledger's Maxed check (3× bound) will catch this, so
  expect some of the candidates to push it red.
- **Stars the ledger can't count have no price rule.** The owner's rule is "the algorithm sets prices",
  but the algorithm prices by payback, and these pay back nothing it can see. They need a plain rule,
  such as a price by tier. Worth asking in the interview.
- **The XP floor**: a positive bonus always adds at least 1 XP. A small XP star doubles a 1-XP cycle, and
  a second rank may add nothing. The ledger has already seen ranks come out equal.
- **The speed floor**: speed-ups cut at most 80 % of a time, and a cycle is never under 1 s. Late rest and
  speed ranks can run into it and give nothing.
- **The lap change**: lap length is a fixed number today, and the ledger reads it. At 10 minutes every
  Well line pays half what it was balanced on. Check this when it's built.

**Things that look possible but aren't**
- **"More consumable room"** (in the Hall concept) can't work as a star: consumables have no limit to
  raise, and the limit is the 9 cells of the grid. Likewise the Larder and Trinket Case give permission,
  not room: the kinds' limits already add up to 8 plus consumables, so they compete for the same 9 cells.
- **Thrift** rounds to whole items and never below 1. Nothing changes on a 1-item input, and small
  percentages change nothing on small recipes.
- **Lap income on the floor**: a Well or bounty item waits on the floor until collected, so a full Bank or an
  uncollected pile slows the income a star promises.

**Would break a ruling, so not proposed** (each re-opens one if wanted)
| Idea | Ruling it re-opens |
|---|---|
| Token cap star | Fixed at 128 (owner). I found no strong reason to re-open; 192 read 85 % on the slow laptop |
| Compass, Cartography Table, Notice Board slots | Retired. The map hides nothing to reveal: T-292 lists the hidden-modifier code as unused |
| **Outposts** (a settled place pays a small lap while you're elsewhere) | "Not chosen: outposts producing while you're away"; "only the active Region runs". It would be cheap (no simulation) and interesting, so I mention it, but it is **re-opening a ruling** |
| More Vault stars (stack sizes, slots) | "Bank Tabs only"; sorting and search stay free |
| Saved layouts, refunds, buildings that travel | "Not chosen" and "no refund" |
| A market or selling | No market selling |
| Stars that survive new game plus | "Nothing else carries over" |
| Stars with level gates (the code has an unused slot for this) | Gates are neighbours and materials, "nothing else gates them" |
| Upgrades only for one hero, or hero classes | Classless heroes; every star is guild-wide |
| The Hall looking different on the mat | "The Hall looks the same on the mat" |

**Speed limits on the game** (GDD §14)
- **More than 8 heroes** needs a performance pass, and the ritual sum is built on 8.
- **More enemies**: about 6 alive at once, 1 to 2 fights. So faster spawns, yes; larger camps, no.
- **Time away**: 24 h must load in under 30 s, and takes 19 s at the full mat. By simple scaling (not
  measured), 36 h is about 29 s and 48 h about 38 s, so 48 h waits on T-199.

**Sky and upkeep**
- **Clutter**: the owner already calls the sky cluttered. A star kind copied across all 20 skills is 20
  stars. Prefer ranks on existing stars, and one guild-wide star over one per skill, unless the skill
  really differs. The ledger also slows: about 7 s at seven stages with 36 stars.
- **Specialist skills** have no content, so their constellations wait for those sessions.
- **Don't gate plain convenience.** Sorting and search are free by ruling; the same thinking suits most
  information and "tell me" features.
- **Stale docs**, for a ticket: GDD §16 still says the Token cap grows with a Hall star; the Mat Tuner hint
  still mentions the Notice Board. The Wishing Well's text says 5 minutes and must change with the lap.

## 4. Sources

**This repo (read directly)**: `concept_guild_hall.md`, `concept_content_roadmap.md`,
`concept_progression_ledger.md`, `concept_progression.md`, `concept_world_map.md`, `concept_collectors.md`,
`concept_offline_progress.md`, `concept_detail_pass.md`, brief 380, GDD §4, §7, §8, §10, §14;
`data/hallStars.json`, `data/effects.json`; `guildUpgrades.js`, `hallStars.js`, `hallModifiers.js`,
`hallStarRule.js`, `modifierPalette.js`, `loopConstants.js`, `TileModifiers.js`, `OutputRules.js`,
`BoardRunner.js`, `CombatResolutionProcessor.js`, `DefeatPenalties.js`, `WoundedSystem.js`, `loadoutCaps.js`,
`equipmentCategories.js`, `SpawnerSystem.js`, `PassiveProduction.js`, `ledger/hall.js`, `ledger/settings.js`.

**Other games.** Melvor, Idle Clans and Stardew pages refused a direct read, so those lines rest on search
summaries of their wikis, and may be incomplete.

| Game | What it lets you upgrade | Idea it fed | Source |
|---|---|---|---|
| Melvor Idle | Mastery pool checkpoints at 10, 25, 50 and 95 %, varying by skill; Township buildings with some global bonuses | Capstones | [Mastery pool](https://wiki.melvoridle.com/w/Mastery_pool), [Township boosts](https://wiki.melvoridle.com/w/Township/Boosts) (search summary) |
| RuneScape (Old School) player-owned house | Restoration pool, portal nexus and jewellery box (fast travel), servant, costume room (saves bank space) | Infirmary, healing; the servant as a loot carrier | [Player-owned house](https://oldschool.runescape.wiki/w/Player-owned_house) (read) |
| Idle Clans | House tiers with XP boosts of 5 to 25 %; offline time, toolbelt and extra loadouts from the Upgrade dealership; clan "Gatherers" +5 % speed | Time away, Toolbelt, Saved loadouts | [Local market](https://wiki.idleclans.com/index.php/Local_market) (search summary) |
| Stardew Valley | Farmhouse upgrades, Well, Silo, Mill, Stable (a horse) | Faster walking | [Carpenter's Shop](https://stardewvalleywiki.com/Carpenter%27s_Shop) (search summary) |
| Factorio | Mining productivity, inserter capacity, worker robot speed and cargo, follower count, lab speed, toolbelt, steel axe | Bonus finds; ranks that keep going | [Research](https://wiki.factorio.com/Research) (read; the page didn't say which are endless) |

**Not checked**: how any candidate plays; whether Toolbelt works from a pack; load times beyond 24 h
(scaled, not measured). "Rough size of code" is my judgement from reading, not an engineer's estimate.
