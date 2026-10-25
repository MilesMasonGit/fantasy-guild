# Changelog

All notable changes to Fantasy Guild are recorded here. Version 0.3.0 is the
project's first tagged baseline — everything before it was untagged development.

## [Unreleased]

- **Drinks help heroes work, and work potions are spent one cycle at a time** (skill loops, work consumables). A new moment for carried items, **On Work Start**, fires as the hero carrying the item starts a work cycle, on any Token or only one skill's ("On Forestry Work Start"); a Token never hears it. A new lifetime, **for the cycle**, lasts until that cycle completes. A **drink** with an On Work Start rule is drunk from the Bank as its hero starts work and **lasts 10 work cycles** (one number for every drink, a placeholder, like an elixir's 10 fights), its rules working from that dose: "On Work Start: applies Coffee to the hero for the cycle", Coffee being faster work, or Beer more XP; a fresh one is drunk when the dose runs out, the count left is saved on the hero, and a fight is not a work cycle. A **work potion** (a Consumable with an On Work Start rule) is spent only when a cycle of its own skill starts, one potion for that one cycle, and kept while the hero does other work: the Birdwatcher, "On Forestry Work Start: applies Birdwatcher to the hero for the cycle", Birdwatcher granting a Bird Nest a quarter of the time as the cycle completes (an effect carried for a while now reaches a cycle's bonus drops). Both show the "used" bubble as they are drunk. **Nothing acts by sitting in the Bank any more**: a food, drink or potion's always-on rules do nothing (before, a potion saying "work 10 % faster" was a free buff for as long as the Bank held one); gear is unchanged. A carried rule with a moment now fires only on that moment, never again as the cycle ends. The CMS Item editor says how a food, drink or potion is used (an elixir 10 fights, a drink 10 work cycles, a work potion one cycle of its skill) and warns on an always-on rule one would ignore, as the content check does; the Rules line offers On Work Start with a skill and "for the cycle". Time away drinks, doses and drops exactly as live play does. No content changes until the content pack brings a first work potion and two drinks. The QA panel's **Work potions and drinks** section sets a forester with a Birdwatcher and a Coffee beside a miner who keeps their Birdwatcher, with a live readout. Captures: `docs/active/eyecheck/shots/2026-10-25_s6b_first_cycle.png`, `2026-10-25_s6b_readout.png`. (brief 230, S6b)
- **Felled trees can become Stumps that grow back beside their Forest, for a seedling** (skill loops, Forestry). A growing Token can now need another Token in its reach and pay for growing: a Stump grows into a Sapling only while a Forest of its species stands within reach (without one its clock stands still and it stays a Stump; a Forest planted beside it later carries on from where it stood), and pays one seedling from the Bank (then the loot on the mat) when it does; with none it stops at its finish and says "Needs Oak Seedling" over itself in the red "Needs Coal" look, then grows the moment one arrives. A Sapling whose Forest goes still finishes growing. A waiting Stump wears the yellow problem mark ("Needs an Oak Forest nearby to grow", "Needs Oak Seedling to grow"), its card and inspection say what it waits for, needs and pays, and the Token Summary counts it as blocked. A Forest can **plant within its own reach**: its Saplings land only within reach of it (nowhere free there: it waits and pays nothing), and its allowance counts the trees standing in its reach, a map's included, instead of every tree on the mat; other spawners, enemy camps included, keep the mat-wide count. A Token type can be marked **Can be cleared where a map placed it** (wild Forests and Stumps): the player may demolish one a map wrote; the Starter Camp's own Tokens stay as laid. A forester with nothing ready in reach but a Stump or Sapling growing back into work they could do **waits silently** for it, not idle, their flag's hover and Dock line saying "Waiting for Oak Stump", then "Waiting for Oak Sapling", and fells the tree the moment it stands; a Stump that is not coming back (no Forest, or stopped for want of its seedling) is nothing to wait for. The CMS Grows block has **Needs one of these in reach** and **Costs when it grows**, the Spawner block **Plants within its reach**, and the Token editor **Can be cleared where a map placed it**; the content check reports a missing Token or item in them. All opt-in: no shipped Token uses them yet, so nothing plays differently until the content pack. The Forest answer is worked out once per Token when its neighbours change, never per tick, what the Bank holds once per item per tick, and the forester's wait only when something asks, so time away costs about the same to catch up (a day with 56 felled Oaks regrowing and 8 foresters: 39 s before and after, headless); and the timed clocks now look up each Token type's work once instead of every tick, so today's growing Tokens catch up about a tenth faster. The QA panel's Forestry section lays out a Forest with two Oaks and a forester, a wild Stump with no Forest and a Birch Stump that stops for want of its seedling (a button gives one). Captures: `docs/active/eyecheck/shots/2026-10-24_s2a_forester_waiting.png`, `2026-10-24_s2a_stumps_waiting.png`. (brief 230, S2a)
- **Fishing: what bites depends on the water, the tool and the bait** (skill loops, fishing). A Token can now be **water**: the CMS Token editor's new **Catch pools** block gives it one weighted pool per tool and bait (a rod with no bait, a rod with worms, a net…; weights read as shares, 50, 40 and 10 being 50 %, 40 % and 10 %), and the pool with no bait is the water's basic catch. Each finished cycle lands one catch from the pool, in place of the Token's own Outputs, and it drops like any other loot (no pop for a rare one). The hero fishes with the first tool in their hands that the water has a pool for (a rod first and a net second fish with the rod); water takes any tool its pools name, **at any tier** ("Needs Fishing Rod or Fishing Net"), and two new tool kinds join the rod: the **Fishing Net** and the **Fishing Cage**. **Bait** is carried in a consumable cell: one is spent from the Bank per catch, and when it runs out the hero fishes the basic pool. A better rod gets its own bonus from a new Rules row, **Catch Weight** ("Provides 900% more bites of Dolphin"), which puts more weight on one fish. Water never runs out (whatever charges it authors) and a Dock in reach speeds it like any Work Time rule, to the standard floor. The Shrimp Coast's turning is kept only for old saves: a saved Shrimp Coast turns back into the Coast in a few minutes and stays one. A water's card lists every fish it can give; the Economy Audit counts a pool's fish as produced there and names pools that cannot work (an unknown tool, a bait that is not a Consumable, a tool that only catches with bait); renaming an item follows it into the pools. Time away catches exactly what live play does, bait running out on the same catch. No content changes until the content pack brings the waters, fish, bait and Docks. The QA panel's **Fishing** section lays out a lake with a Dock (a rod and worms, then plain), a river (a rod, no bait) and a sea (a net), with a live readout. Captures: `docs/active/eyecheck/shots/2026-10-24_s5_scene.png`, `2026-10-24_s5_lake_card.png`. (brief 230, S5)
- **A miner whose vein is resting waits quietly, and a furnace out of coal says so** (skill loops, the shared rules). A hero whose only work in reach is a resting Token they could work (a vein refilling) no longer says "No work in range." and no longer counts as idle: they wait silently, their flag's hover and their Dock line say "Waiting for Copper Vein", and they go back to it the moment it refills. A hero with truly nothing in reach still says "No work in range."; a hero waiting for another hero's fight still says "Waiting for Goblin.". A station its hero stands at that runs out of an input now says what is missing over itself, "Needs Coal", in the red "Needs Pickaxe" look, about once every 8 seconds; the hero stays unless other work in their flag's reach can run, and then they do that and come back (a hero who mines and smelts never gets stuck). The QA panel's Skill loops section lays out a miner waiting for a resting vein and a smith at a furnace with one coal, and a button adds a coal vein in the smith's reach. No content changes: no shipped Token rests yet. (brief 230, S1b)
- **Each station can offer only its own recipes, and drinks no longer heal** (skill loops, stations). A station's Works as rule can now name a **station kind** (Furnace, Smithy, Kitchen, Brewery, Workbench, Alchemy Table, Summoning Circle), and a recipe can name the kinds that make it (the CMS recipe editor's **Made at** boxes, which also list the stations that offer it); a station then lists only its kind's recipes, so a Furnace can smelt and a Smithy make tools though both work as Smithing, and a Campfire and a Kitchen share one list. It is opt-in on both sides: a recipe naming no kind is offered by every station of its skill and a station with no kind offers its whole skill, so nothing changes in play until the content pack tags the stations and recipes. The CMS Token editor's Recipes section has a **Station kind** choice (and the Rules line a matching "which station" word); the content check reports an unknown kind. A saved station set to a recipe its kind no longer offers says Choose a recipe; the Copper Anvil and the recipes that need it work as before. **Drinks never heal**, in a fight or out (the owner, 2026-10-24): a hurt hero eats food and otherwise waits for regen, the equipped drink stays in the Bank, and a drink's tooltip no longer says what it restores (the CMS no longer offers the field); drinks become work buffs in the next phase, and until then an equipped drink does nothing. Cooking's description now reads "Cooks food that heals heroes in fights, and drinks that help them work." The QA panel's Stations section lays out a QA Furnace and a QA Smithy whose recipe lists show only ingots and only tools, weapons and nails. Captures: `docs/active/eyecheck/shots/2026-10-24_s6a_furnace_recipes.png`, `2026-10-24_s6a_smithy_recipes.png`. (brief 230, S6a)
- **Speed-ups stack to a floor, things can grow faster, veins and trees can stay put, and stations and supports never wear out** (skill loops, the shared rules). Every speed-up of a time now stacks but together cuts at most 80 % of it (one number in the game's settings code; a CMS page for it can come later): five Minecarts at −20 % each on a 10 s vein give 2 s, where before they gave the 1 s minimum. A new Rules row, **Grow Time**, lets a Token speed how long its neighbours take to grow (a Sapling into a Tree) and to refill after a rest (a vein), stacking down to the same floor: "Makes nearby Oak Tokens grow and refill 20% faster." It can be aimed by tag or Token, or narrowed to a skill (a Sapling counts as the skill of the Tree it grows into); it reads from neighbours and the Region's rules, never a hero, and is worked out once per Token when its neighbours change, not every tick, so time away costs no more to catch up. A clock already counting keeps its time; only the finish moves, and the growth bubble and the inspection show the new time. The CMS Token editor has a **Stays where it stands** box: every copy of a Token marked so (trees, fruit trees, veins) can't be dragged or pushed wherever it came from, an old save included; it can still be demolished. **Stations and supports never wear out**: a Token that works as a station, or helps the Tokens near it by standing there (a context Token, a buff), is unlimited whatever charges it authors, and a saved copy's old number is cleared as its board loads. Grandma's Kitchen (5000), the Ceramics Kiln (1000), the Windmill (1000), the Coast (5000) and the Copper Anvil (20) became unlimited; the CMS no longer offers Charges on such a Token (a Clear button empties an old number) and the content check lists the five until they are cleared. A gathering node keeps its charges even when it helps its neighbours (the Blackberry Bush, the Shrimp Coast), but only its own gathering spends them: help is free (the owner, 2026-10-24), so nothing wears any more because a neighbour worked or won a fight beside it, and a recipe's context charge cost is no longer spent. No shipped content uses Grow Time or the new box yet. The QA panel's Skill loops section lays out a Sapling between two Grow Time Groves (30 s becomes 12 s), a 10 s vein that stays put in five Minecarts with a Miner on it (2 s cycles), and a Kitchen and a Windmill with no charges, with a live readout of each. (brief 230, S1a)
- **A selected nav orb wears a steady gold outline.** The open orb no longer swells, brightens or glows; it draws the kit's 1-art-pixel outline in gold (the same four art-pixel copies as the hover outline, always on while the orb is open, and gold wins over the white hover). Clicks, tooltips and drop targets are unchanged. Capture: `docs/active/research/no_hover_glow/after_orb_selected.png` (before: `before_orb_selected.png`). (T-252)
- **Speech bubbles and callouts in the pixel family.** A hero's words over their head, the hero bar's level-up alerts, the mat's quick callouts (a spawn, an effect, a refused drop or claim, "Needs Pickaxe") and the refusal said off the mat (a refused equip) now wear the chamfer pixel frame with its hard black shadow and a stepped pixel tail, like the work plate, instead of rounded boxes with soft shadows. White words; the frame is bronze for news, gold when it asks to be looked at (a hero with no work in range or waiting for a fight, a level-up) and red for a can't (a refused flag, drop, claim or equip). Words, places and timings are unchanged; a callout still rises and fades but no longer starts a little enlarged, and the bar's alerts sit 4 px higher so the longer tail clears the hero's name. The style sheet page shows the piece under "new, unapproved".
- **The nav orbs and a station's gear button hover with the white outline.** Resting the pointer on a nav orb no longer brightens it, glows or swells it, and the station gear no longer swells or presses in; both draw the game's 1-art-pixel white hover outline instead. A selected orb looks as before. (T-244)
- **Encounters** (the combat detail pass, part five). Every fight is one-on-one, bosses included: a second hero whose flag reaches a busy enemy takes the next thing in reach instead, or waits at their flag; a flag pinned to it waits beside it; either takes the enemy the moment it is free and meets it whole. The waiting hero says "Waiting for Goblin." and their flag and Dock line say so too ("Goblin: Ana is fighting it"). An enemy can be marked a **Boss** in the CMS: a boss never attacks first (it fights only the heroes sent at it), meets every hero at full health, and is never made by a rule, so it never ambushes. Bosses and guardians come from **camps of one**: an ordinary camp (a spawner) that keeps its one boss or guardian, with the usual Spawner fields. An enemy camp's clock now stands still while the camp is full, so a goblin, guardian or boss beaten in a full camp comes back one whole interval later instead of on the next moment (forests and mines unchanged); a guardian is simply a tough enemy whose camp stands by a rich node, and attacks whoever works there if it is hostile. A **Summoning Circle** is a Token whose work uses up a summon item and calls its boss beside it; any hero may work it. **Ambushes** got their teeth: an enemy a node's Spawns rule puts beside it (about 2% a finished cycle) attacks the hero who did the work, hostile or not, is beaten in one kill, and the node springs no other while it stands. The hero who beats an enemy now says "Goblin Beaten" rather than "Goblin Depleted". A QA panel section sets up a guardian camp by a rich vein, a goblin-haunted vein, a boss's den and a Summoning Circle. No content changes; what plays differently today is the Beaten line and the Goblin Camp's pace (a goblin beaten in a full camp is replaced 30 s later).
- **A station's recipe preview reads above its work plate.** Resting the pointer on a worked station's gear now opens the game's shared tooltip (the chamfer pixel frame, following the pointer) with the same words as before: the recipe, what it makes, what it needs and what it must stand beside. The old in-mat box drew under the work plate, which covered its lower half. (T-247)
- **Loot flies under the Bank and the Shop, not over them.** Loot collected off the mat now flies on the mat's own layer: over the mat, under the Bank and Shop drawers, the hero panel and the nav, so with the Shop open a flight that starts under it comes out from under its edge. While the Bank is open nothing flies (the mat is wholly under it and the item stubs are off screen, so flights only crossed the hero column); the counts land at once instead. A hero lifted from the dock still flies over everything to the pointer. Capture: `docs/active/research/particles_drawer/particles_drawer.png`. (T-241)
- **Poison, Burn and boss moves, built in the Rules system** (the combat detail pass, part four). A status is now an ordinary effect in the Rules library with a Status section in the CMS Effect editor: how many stacks it builds to and how many ticks it lasts (or the whole fight). Each landing adds a stack, its rules count once per stack, and every status ends with its fight (the kill, a knockout, the hero leaving), so no hero falls to poison on the way home; a status lands only on a fighter. Lingering effects now tick every 3 s instead of 5. The owner's first two: Poison stacks to 3 and deals 1 a stack a tick until the fight ends; Burn does not stack, deals 1 a tick for 3 ticks, and food heals half while it burns (a Shrimp heals 3, not 5). A Venomous enemy lands a Poison stack with every hit that leaves the hero standing, and a Hide Vest's "Poison stacks at most 1 lower" and an immunity name the status effect. A status tick that knocks a hero out is one ordinary defeat; one that finishes an enemy is a kill before it swings again. Boss moves: any enemy (and any hero's item) can carry rules on three new fight moments, On Swing (every Nth swing, before it is rolled), On Hit (every Nth landed hit) and On Health Below a share (once a fight), so a heavy strike is "On Every 4th Swing: applies Heavy Strike to the enemy for the swing", a status attack "On Every 3rd Hit: applies Burn to the hero", a heal "On Health Below 50%: heals 10 health on itself", +2 armour "...applies Stone Skin to the enemy for the fight" and an enrage "On Health Below 30%: applies Enrage to the enemy for the fight"; a move says its name over the enemy. The Rules editor gains those moments (with their count or share), Applies "for the swing" and aimed at the hero, and two rows: Swing Time and Food Healing; enemies now read Damage and Swing Time from effects on them. The old status engine (seven statuses on a 5 s clock that outlasted fights) is gone, and an older save's statuses are dropped on load. Nothing ships yet: Poison and Burn come with the combat content pack. The QA panel's Statuses and boss moves section sets up a Venomous goblin, a burning imp and a four-move warlord against fed Fighters, with a live readout of every status. (brief 220, C4)
- **Pixel kit inside the windows: square tiles, slots, buttons and switches** (the owner: the Bank's items still had soft borders; a second audit of everything smaller than a window). Bank item tiles and a hero's loadout slots are square with a hard 1-art-pixel line in the frames' own colour, keep their item-type tints, and on hover turn a little lighter with a white line (a filled slot's hover was red); empty slots, the Bank's tab squares and the Edit hero swatches are dark square wells, the open Bank tab and the current job a gold line, a chosen one a white line. Every boxed button in Settings, the save slots, Typography scale, Promotion, Edit hero and While you were away is now the kit's chamfer-framed button with its hard shadow: gold words and the shine for the main action, muted words for a second choice, red for Confirm on a delete or an undo. Settings' setting rows, the save-slot cards, the Typography size boxes and the Promotion trade box are no longer boxed (rows with spacing or faint lines between; a save row gets the white outline on hover, a red one while asking to delete). Switches are square pixel switches (Settings, Work Permissions' Priorities), sliders a flat bar with a square thumb, the boxes to type in and the selects square with the pixel line. Also squared: the top bar's Disallow and Demolish buttons, the job cards, the hero panel's bars and rows, the hero bar's page arrows and XP bars, the hero tabs, count badges and the loading bar; the gold glow on the hero bar's drop line is gone. Nothing a window says or does changed, and nothing new is drawn per frame. Round two of the audit, with what was left and why (item ribbons, the mat's bars, the speech bubbles, the nav orbs), is in `docs/active/research/pixel_frames/audit.md`. (T-242)
- **Who is working what: a plate under each hero at work** (the owner's backlog review; the owner picked mock-up C). While a hero works a Token, one small chamfer-framed plate sits on the seam between them, just below their feet and over any loot lying there. At rest it shows what is being made, with the work cycle filling along the plate's foot in whole art pixels, and the charges left, which simply count down; while the Token waits for an input, it names exactly what is missing as a red have/need pill (`0/6`) in a gold frame (red when it cannot go on) with the cycle held grey. Resting the pointer on the hero, the Token or the plate opens the full line (the hero's skill, the output, the charges and the time to the next one), each part explaining itself on hover; the Token's and the hero's names drop below it, and pressing the plate picks the Token up. It replaces the worked Token's own work bar, its "!" and its charges ring; a Token nobody works keeps its "!" and its hover rings. The floating "-1" and "+50" over Tokens are switched off: a restock still says "Restocked", but a Tool Rack or anvil worn by its neighbour, a refill after resting and an enemy's charge on a kill now change without a number. A fight has no plate yet: its place is kept for the fight's own link, built with the combat work. A `workPlate` draw switch lets the drawing bench price it. (T-239)
- **Supplies in fights: food heals, drinks wait, elixirs last ten fights** (the combat detail pass). Below 25 % HP a hero in a fight eats equipped food and loses that swing, as before (an 11 HP hero eats at 2 HP). Drinks no longer heal in a fight: an equipped drink stays in its slot, unspent, until drinks get their buffs; outside a fight a hurt hero still drinks after eating. Elixirs (the unlimited consumable slot) now work: an elixir is drunk as a fight starts and lasts 10 fights (one number for every elixir; each enemy engaged is one fight); every equipped elixir type works at once and their effects stack; a type is drunk again from the Bank when its last dose runs out, and keeps working for the rest of its 10 fights if the Bank runs dry. The count left is saved with the hero and plays out the same during time away. An elixir is an ordinary rule on the item: "When a fight starts, applies Valor to the hero for the fight", where Valor is an effect that provides +1 Damage; the Rules editor's Applies gains a "for the fight" switch (the effect lasts until that fight ends: the kill, or the hero leaving). A consumable without a fight rule (a potion for work) is never drunk by a fight. When a hero eats, drinks or drinks an elixir on the mat, a small bubble over their head shows the item's icon and what it did ("+5 ♥", or the elixir's name) for 1.5 s; none is drawn during a catch-up. Defeat keeps its cost (a quarter of each carried food and drink stack, a 10 % chance to lose each gear piece); elixirs stay exempt. No elixir ships yet: the first come with the combat content pack. (brief 220, C3)
- **Gear and enemies** (the combat detail pass, part two). A weapon now names its style or styles (a Dagger is Melee and Stealth), its damage and its speed, set in the CMS item editor's new Weapon fields; a hero equips only weapons of their own style, and the refusal says why where the item was dropped ("Mira fights with Magic: the Copper Sword is a Melee weapon"). Recruits hold no weapon ("Recruits fight barehanded: promote Bjorn to use the Copper Sword"); tools are unchanged. A hero always fights on their own style's side of the cycle, and a weapon of another style still in hand (from before a re-training) is not swung and its ability is off. A weapon or armour family's ability is a Rules effect every tier points at with its own strength, so an iron Spear pierces 2 where a copper one pierces 1. The Rules editor now offers Dodge, Pierce and Crit Chance, a Double Item Chance (a chance that one named item, when a kill or a work cycle drops it, comes out doubled: a Cleaver and Raw Beef) and a Status Stack Limit (a Hide Vest: Poison stacks at most 1 lower; at 0 it cannot land); a new rule on a combat stat starts as a flat amount, the only kind combat reads. Enemies gain five kinds the author ticks, none, one or two: Armoured (+2 armour, slow), Nimble (+15 Dodge), Swift (2/3 of the hit every 2 s), Brute (4/3 of the hit and at least 1 more, every 4 s) and Venomous (poisons on every hit it lands, today with the old Poison). In the CMS an enemy's HP, hit, armour, speed, XP, Dodge, Accuracy, Pierce and crit are shown filled from its level and kinds, and any can be typed over; changing the level moves the rest. No content changes: today's enemies and items fight exactly as before.
- **Combat runs on small, fixed numbers** (the combat detail pass). A hero has 10 HP plus their combat level (a Recruit 10, a level 99 hero 109), recomputed on every level-up and when a save loads: an older save's 50-or-more max HP becomes the new number and current HP is trimmed to it. A hit is fixed, no spread: the weapon's damage (a fist is 1) plus 1 per 20 combat levels plus any flat Damage from gear. About 1 swing in 10 misses (10 %, 1 point less per level above the enemy and more per level below, that part between 5 % and 25 %, then the enemy's Dodge added and the hero's Accuracy taken off, between 5 % and 40 %), and 1 in 20 crits for double, the doubling before armour. Armour takes 1 off every hit per point, a hit always does at least 1, and Pierce ignores that many armour points. The weapon sets the pace: fast 2 s, normal 3 s, slow 4 s. The style cycle is kept and now worth plus or minus 25 % damage, every percentage rounded to the nearest whole, halves up. Recruits punch for 1 every 3 s whatever they hold, with no style and no combat XP; a promoted hero with no weapon punches too. Enemies take their numbers from a level table (HP 20 + level, a hit of 1 + 1 per 20 levels, 1 armour per 30 levels, a swing every 3 s, XP 10 × 1.065^(level − 1)), tuned so a hero with their tier's weapon fights an enemy of their own level for 10 or more swings and 30 s or more; the table, the proposed weapon tiers and worked duels are in `concept_combat.md`. Older enemies' budget scale still shrinks their HP, hit and XP, so the shipped Goblin (6 HP) stays a pushover any Recruit beats in about 20 s, while the Goblin Chief (14 HP), a Cow or a Thorn Elemental (21 HP) now beat a Recruit and want a promoted hero with food. Heroes no longer heal in a fight (only food heals there) and heal 1 HP every 10 s outside one, half as fast as before. The old exponential growth curve, the damage spread and Block are gone; the Rules editor no longer offers Block Chance, and the CMS enemy preview shows HP, hit, armour, swing time and XP from the game's own table. Every swing draws its miss and crit from the game's random stream in a fixed order, so time away plays out the same fights as watching (a new test checks it). (brief 220, C1)
- **Dev tools tidied** (dev builds only, nothing in a shipped game changes). The floating Ground tuner and the QA panel's Terrain section (biome, water and placement buttons, ambient cues) are gone, and the floating TUNER button is retired: the Mat dials are now one collapsed section of the QA panel. (T-238)
- **Pixel frames on the game's windows** (the owner's backlog review: audit every window). Every hover tooltip now wears the small chamfer pixel frame with its hard black shadow 2 art pixels down-right, instead of a rounded box with a soft shadow and a thin gold edge; so do the Token Summary (the top bar's Token count), the While you were away screen and every window built on the shared window shell (the save slots, Settings, Edit hero, Job change, Promotion, Typography scale). The Bank drawer, the Shop drawer and the hero panel wear the studs frame instead of a soft shadow and a thin edge; the hero panel's green edge while an item dropped on it would recall is a green outline round the frame. All frames are one colour and fill with the frame's own dark panel colour. The Shop's rows are no longer boxed (the pointer gives a row the kit's white outline instead of a gold border), and the landmark block in a Token's card is a plain plate like the card's other blocks; the card's plates lost their slightly rounded corners. What each window says and does is unchanged, and the frames are static pictures, so nothing new is drawn per frame. The audit of every window, with what was left and why, is `docs/active/research/pixel_frames/audit.md`. (T-136)
- **The Atlas's Regions as a two-page spread** (the owner's backlog review). The left page lists every Region on its own area banner, drawn crisp at a whole-number scale, with its two names and the hero flag on the one the guild is in (the flag was hidden under the banner before); a click on a row selects it with a gold edge. The right page shows the selected Region (the one the guild is in when the book opens): its banner and names, its ground drawn small with its Tokens and the Guild Hall where it stands (the Cartography preview's own drawing, made once per Region chosen and only once the Regions page is first seen), its ground's biomes, how many of its own Tokens stand there, how many heroes have a flag there, its landmarks, and its Tokens as sprites with counts. Travel, Rename, Archive and Abandon (still asked first) moved from each row and its menu to buttons under the page and do exactly what they did; an archived Region, picked from the archive at the foot of the list, shows Restore. (T-237)
- **The Bank and Shop drawers reach the screen's edge, and opening the Bank moves the mat aside smoothly** (the owner's backlog review). Both drawers now run all the way to the left edge under the nav orbs as one panel: their header and toolbar bands pass under the orbs, with no mat showing through beside the Shop and no bare grey strip beside the Bank; the orbs stay on top and clickable, and the Shop's lip while you carry a Token stays beside the nav. Opening the Bank no longer snaps the mat narrower: as the drawer slides in, the mat glides aside, the top bar slides up off the screen and the item stubs slide off the right edge, in the drawer's own quarter second, and closing plays it back. The mat is only moved, never resized or redrawn, so opening and closing the Bank no longer stalls a frame each time (about 0.1 s before; the first opening in a session still takes about that once); with reduced motion asked for, the Bank opens and closes at once. (T-235, T-236)
- **Room for the web on the Guild Hall upgrade screen** (the owner's backlog review). The Guild Hall Effects list no longer takes a column on the left: resting the pointer on the Hall star in the middle of the sky shows it in a small chamfer-framed pop-up beside the star, and clicking the star pins it open; a second click on the star, Escape or a click anywhere else closes it (Escape closes the pop-up first, the screen with the next press). Clicking the Hall star no longer leaves the screen: Return to Playmat, Escape and the Guild Hall orb still do. The upgrade web takes the freed width and draws about a third bigger at 1920 x 1080. The Inspect panel on the right says and does the same as before but wears the pixel kit: a studs frame with its hard shadow, the kit's header (Inspect on the left, the red X on the right while an upgrade is shown), Return to Playmat as a chamfer-framed button, the Upgrade button as the kit's main action (chamfer frame, gold text, the shine on hover, greyed when the Bank is short), rank rows as plain lines with faint dividers instead of boxes, and no rounded corners, gradients or soft shadows; rank labels wrap instead of ending in an ellipsis. Nothing new is drawn per frame. (T-234)
- **Opening the Guild Hall looks up from the table to the night sky** (the owner's backlog review). The upgrade screen's sky lies above the wood table, and clicking the Guild Hall bubble glides the view up from the mat to it in a little over half a second: the mat, its top bar, the hero dock and the wood all slide down together while the sky, the star web and its side panels come down from above; the nav's bubbles stay where they are. Return to Playmat, Escape or the bubble again glides back down; turning back mid-glide goes back from where it is. A click or any key during a glide lands it at once; opening the Bank, the Shop, the Atlas or Settings from the Hall lands on the mat at once; when the computer asks for reduced motion it is the plain swap it was. At rest both screens are drawn exactly as before: on the sky the mat is put away, on the mat nothing of the Hall is kept. The glide waits for the screen it is moving to to be drawn first, so a slow first frame (the first open of a session readies the sky's pictures) delays it rather than cutting it short. The drawing bench has a `hallglide` scene that opens and closes the Hall every 1.5 s on the busy board. (T-194)
- **A calmer Guild Hall sky** (the owner's backlog review). While the upgrade screen is open, no item stubs or banners show over it; they live on as before and are there on the mat when you return (a banner waits until clicked; a stub that fades meanwhile is gone, as on the mat). Buying an upgrade still raises its Guild Upgrade banner, seen on the way back. The star field and clouds glide a little every frame instead of jumping one art pixel about every second; one line in `tailwind.css` (`--gi-sky-ease`) switches back to whole-pixel steps. The stars no longer twinkle and wear three looks: gold at their top rank, blue while the Bank can pay for their next rank right now, grey otherwise; a star with a rank stays bigger and a locked one dimmer. A star's white outline shows only under the pointer (or keyboard focus): no gold outline on an affordable star and none on the pinned one at rest. QA → Guild Hall sky has an Every star look button that also puts the next price of Bank Slots and Token Cap in the Bank. (T-231, T-232, T-233)
- **"New!" on an item stub goes away once you look at it.** Resting the pointer on a stub of an item found for the first time, or pinning it, clears its "New!" and gold frame for good; a stub you have not touched keeps it. (T-229)
- **The Bank's hero tabs show each hero as a portrait and a name, and Work Permissions is a real button** (the owner's backlog review). Each hero tab beside the open Bank is now a head-and-shoulders portrait cut from that hero's own class sprite (the first idle frame, facing left, drawn crisp at 2x) with the name under it, nothing else: every hero used to show the same Recruit picture, and the tab's HP bar and its working or wounded dot are gone (HP, what the hero is doing and wounds are in the tab's tooltip and the hero panel; a wounded hero's name is still red). The Work Permissions rows use the same portraits. Each class's portrait is cut once and kept. The horizontal hero bar under the mat is unchanged. The Work Permissions button is a solid chamfer-framed button at the bar's left end, under the mat's left corner instead of out at the column's edge; it shines when the pointer passes, sinks into its shadow when pressed and reads gold while open. Its drawer wears the chamfer frame and rises from below the screen past the hero bar into place (at once under reduced motion), and Combat is now its first column, before the Starting and Specialist skills; every permission works as before. Equipping an item plays the buttons' pixel shine once across the slot instead of the bounce and gold glow (none under reduced motion). (T-226, T-227, T-228)
- **One item, one hero** (the owner's backlog review). Equipping gear, a weapon or a tool now takes that copy out of the Bank and into the hero's hands, and taking it off puts it back: one Copper Pickaxe can be in one hero's hands at a time, so equipping eight heroes takes eight. Food, drink and potions are unchanged: every hero carrying one draws on the Bank's shared stack. When the Bank has no copy left and another hero holds one, the equip is refused ("Every Copper Pickaxe you own is already in use"). A copy that would go back to a full Bank (taking it off, or a swap that displaces it) stays with the hero and the refusal says so ("The Bank is full: Aela keeps the Copper Pickaxe"); nothing is lost and nothing goes over the Bank's limit. Dragging an item from one hero's slot onto another hero hands that hero's copy over, without the Bank. A held copy always counts (a tool in hand gathers with none left in the Bank), cannot be spent by a recipe, the Shop, a quest or an upgrade, and a lost fight that breaks it destroys the hero's own copy rather than one from the Bank. Moving a copy in or out is not a gain or a spend: no item stub, no rate, no catch-up line. An older save where several heroes share one copy gives the Bank's copies to heroes in roster order when it loads (before the offline catch-up) and empties the slots it can't cover, with one notice naming who lost what; a starter tool a hero holds is not handed out again. The QA panel has a Gear section: Fill the Bank, and Old save: heroes share one tool (rewrites the slot being played, then reloads it). (T-230)
- **Item tiles say what they are** (the owner's backlog review). The Bank has no inspect column any more, so its item grid takes the whole drawer; the search box moved into the Bank's header, between Select and the slot count, and still searches every tab. Resting the pointer on an item shows everything the column showed: its name, what kind of item it is and how many the Bank holds, Equippable: Hand (or Hat, Food, Drink…) for anything a hero can carry, a tool's kind and tier (Pickaxe, tier 2) or a two-handed weapon's both hands, what food or a drink restores, its tags and description, and for a map or modifier what it writes. The tooltip no longer says Drag to sort, or onto a hero to equip, and clicking a tile outside Select mode does nothing. Every Bank tile and every filled slot of a hero's loadout sits on a dark surface shaded by the item's type (materials stone, tools steel, food brown, drinks teal, potions violet, maps parchment, anything else plain), a little lighter than before and lighter again under the pointer, so dark sprite outlines read. A filled loadout slot shows a small pixel mark of its kind (hand, hat, chest, trinket, food, drink, consumable) in its bottom-right corner, and a consumable's count moved to the bottom-left; the marks are code-drawn placeholders until the owner's art (owner art list). The style sheet page shows the surfaces, the tooltip and the marks as new, unapproved. Nothing is drawn per frame; the tooltip is built only while shown. (T-223, T-224, T-225)
- **Picking up an enemy or a hero on the mat starts where it stands** (the owner's backlog review). Their carried picture (the enemy, or the hero's flag) used to appear near the mat's top-left corner and fly from there to the cursor; now it lifts off from the enemy or hero, as every other Token's does. The drag measured where its source was drawn without the source's own placement transform, and enemies and heroes on the mat are the things placed that way. Nothing else changes, and nothing new is measured during a drag. (T-222)
- **Quieter Tokens** (the owner's backlog review). A Token's name, shown when the pointer rests on it, now sits just below the Token, centred under it, instead of above it (a small Token's name drops below its hanging corner rings). A hero's name likewise sits under their feet instead of over their head. The faint ring under movable Tokens (bought and built Tokens and the Guild Hall) is gone; the grab cursor still tells a movable Token from a fixed one. A done quest no longer breathes a gold glow behind its art: it waits as it is, and resting the pointer on it still shows its tooltip with the claim line. The tutorial's pulsing yellow beacon rings (round the Guild Hall orb, Bunk Beds and the Upgrade button, and wherever a hovered tutorial quest pointed) are gone until the tutorial is redesigned; the steps themselves, their quest Tokens, tooltips and rewards, work as before. Nothing new is drawn per frame, and the beacons' lookups ten times a second are gone. (T-218, T-219, T-220)
- **Carrying a Token no longer washes the mat, and loot lands plainly** (the owner's backlog review). While a Token that cannot stand everywhere is carried, the ground it may stand on stays as it is; only the cells it may not stand on (water for a land Token, land for a boat) take a soft red tint, instead of a warm light over every allowed cell and a dark veil over the rest. When nothing on this mat is forbidden to it, nothing is drawn. Loot from a task still hops out of its Token in an arc with its shadow on the ground, bounces as before and steps onto a matching pile, but without the white afterimages behind the hop, a rare find's gold flash and star, the dissolve as it joins a pile or the pile's brightening; collected loot still flies to its stub or the Guild Hall, without the pixel trail behind it or the plink where it lands (a hero lifted from the dock keeps its trail). The five effects are switched off, not removed, each by one switch in `src/ui/utils/lootEffects.js`, for a better look later (T-196). Less to draw: no tinted copies made or animated per drop or per pile joined, no rare-drop listener, no pile listener per loot sprite, fewer squares per flight frame and a flight's canvas asleep about a tenth of a second sooner. (T-217, T-221)
- **The top bar is as wide as the mat, bigger, and wears the Region's banner** (the owner's backlog review). The bar above the mat now spans exactly the mat's width, whatever the window size or the Mat Tuner's mat size: the Region name at its left end, Tokens and Upkeep in its centre, Disallow and Demolish at the mat's right edge. While Disallow or Demolish is on, its words (and Allow all or Cancel all marks) take the centre in place of Tokens and Upkeep, wrapping to up to three lines. The Region's banner, the same picture the Atlas shows for it, lies behind the name at twice its size (up to 512 px across, showing the band just below its middle, where most banners have their horizon), crisp on the left and fading into the bar by the end of the bar's left part; the separate name badge and its pennant icon are gone. The Region name is in the display size (32 px), the only text in the bar that is. The bar is 76 px tall instead of 44 px, its text one size larger (title instead of body) and its icons 32 px instead of 16 px. With the new 12 x 6.5 mat the taller bar costs the mat nothing at 1920 x 1080 or 1366 x 768 (the mat's width is what limits it there). (T-212, T-213, T-214)
- **The mat is wider and shorter** (the owner's pick from four sizes): 12 steps wide and 6.5 tall, 1920 × 1040 u, instead of 11 by 7 (1760 × 1126). It holds about the same number of Tokens, and on a 1920 × 1080 window it now fills the width: the Tokens keep their size and stand about 7 % further apart on screen, and a taller top bar (up to about 40 px more) still leaves the mat at least as big as before. A save or a Region left with Tokens or flags past the new bottom edge has them pulled back inside, spaced like a drop, when it is loaded or travelled to (before the offline catch-up plays); nothing is ever removed, and a Token with no clear room says so over itself. New Regions are laid out on the new mat; the Starter Camp is centred on it. The dev build's Mat Tuner has a Mat shape row (the mat's height for its width) beside Mat size. The engine and drawing benches keep measuring their boards on the old mat, so their numbers stay comparable. (T-211)
- **A flag reaches all eight neighbours, its ring is easy to see, and Tokens keep a little more room** (the owner's backlog review). A hero now looks for work up to 240 u from their flag instead of 164 u: the Token under the flag and all eight around it, the diagonals included; each Scouting Flags rank still adds 40 u. A hostile enemy watches the same wider circle round its spawner. The reach ring shown while a flag or its hero is hovered, dragged or inspected (or while a dragged Token would land inside it) is now a crisp gold line drawn in whole art pixels with a hard black shadow one pixel down-right, instead of the faint dashed line; it shows at the same times as before. Every Token's invisible hitbox is 90 % of its art radius instead of 80 %, so two small Tokens sit at least 70 u apart instead of 61 u (a small beside a large 113 u instead of 100 u, two large 156 u instead of 138 u); new Regions are laid out with the same gaps, while Tokens already on a mat stay where they are. A dev device whose Mat Tuner stored the old untouched numbers (164 u, 80 %) gets the new ones. (T-215, T-216)
- **The mat's motion is pixel art now, and more of what happens shows** (the owner's animation picks). Everything below moves in whole art pixels, held and then jumped like the landing hop, never scaled, blurred, rotated or faded; nothing plays while nothing happens. A worked Token's hit reaction (shake, jitter, bob, sway, press, hop, pulse, thump) steps in whole pixels and three or so chips in the colour of what is worked (bark, ore, water, straw, sparks, shavings, steam, dust) pop off each strike. A hero finishing a cycle makes the Token's green outline blink white; a rule firing on a Token sends an echo of its outline out three pixels, and a neighbour's bonus first hops a spark across from the Token that gave it, then a small green +1 rises. A landed hit turns the enemy white for two frames, knocks it back with a speckled afterimage trailing, and a red damage number pops off it (every hit); a beaten enemy blinks three times, drops four pixels, dissolves a pixel at a time and leaves a little grey puff. A Token that becomes another (a sapling growing, a Foundation built) flashes its white outline instead of the gold glow. Loot hops out of its Token in an arc and bounces once, its shadow staying on the ground under it; joining a pile it steps over and dissolves. Collected loot flies with a short trail of hard pixels and lands with a four-pixel plink, and the Guild Hall dips a pixel as each lands, instead of the glowing smear and brightening (flights cost less to draw). A rare find (a drop from a line of 10 % or less) flashes gold and a star twinkles on it twice. A hero healed by food in a fight flashes green. Arriving in a Region, the Guild Hall lands first and the rest of the Tokens drop in one after another, rippling out from it. A spawned Token (a Forest's sapling, a quest from the Guild Hall) hops up out of its spawner, over it, and lands, and its "Spawned" callout waits for the landing. Picking something up flies it to the cursor in under a tenth of a second instead of jumping there. The QA panel has an Animation section that plays each of them on demand. (T-137, T-154, T-155)
- **Gathering tools are hero gear** (the owner's tools interview). Pickaxes, woodaxes, fishing rods and sickles are items a hero holds in one hand, beside a one-handed weapon; a two-handed weapon leaves no hand for a tool, and two tools let a hero do both jobs (taking up a two-handed weapon puts the tools down, and a tool puts a two-handed weapon down). A gathering Token names the kind of tool it needs and the lowest tier that will do: only a hero holding one may work it, so a hero with no pickaxe does their other allowed work and the vein they pass over says "Needs Pickaxe" in a speech bubble over it (again every few seconds while a hero stands idle because of it). A flag dropped on a Token its hero has no tool for plants as an area flag and the hero says "I need a Pickaxe to work Copper Ore Vein."; putting the tool down mid-work lets go of the Token. Tools only gate: no speed or yield. A pickaxe in hand is not a weapon. A new game's Bank holds one of each starter tool (an item's Tool marked Starter); new heroes arrive empty-handed, and the tutorial's second step is Equip a Tool. The Token card's Tools row names the tool to hold. The CMS item editor has Tool (kind), Tool Tier, Starter tool and, for other hand items, Hands; the Token editor has Needs tool and Lowest tool tier; the description says "Needs a Pickaxe in hand."; the Economy Audit and the boot check name a tool no hero can hold, a need no tool answers, and tool Tokens or recipes still asking for a nearby tool. The content (the tool items, which Tokens need which tool, the tool Tokens gone, the two tool recipes making items) is the owner's accepted change pack, synced from the CMS; the QA panel's tools preview that showed it before the Sync is gone. (T-126)
- **A hero's health bar counts as the hero.** Pressing the bar over a hurt hero's head now picks the hero up (moving their flag), a click opens them and a right-click recalls them, as an enemy's bar already did; before, the bar swallowed the press, so a flag under it could not be picked up there. (T-132)
- **Picking up and dropping are smooth again.** Since the item stubs arrived, every pickup and every drop made the browser restyle the whole screen (about 20 ms on a full mat, twice a drag), because of the rule that lets the pointer pass through the stubs and banners while something is carried; the rule now names only what it changes, and behaves the same. Picking up a Token from the mat draws the mat once instead of twice, and equipping by drop opens the hero sheet a frame after the drop instead of inside it. Nothing looks or plays differently. (T-033, T-186)
- **A banner's chime no longer uses up the game's random numbers.** The coin chime a milestone banner plays now takes its four recordings in turn instead of picking one at random, so showing a banner changes nothing else in the game: a catch-up (which shows no banners) plays out exactly as live play would, and the engine bench's work check no longer moves when banners do.
- **Housekeeping, nothing to see in play.** Dead code, stale comments and leftovers removed across the engine, the UI and the CMS (unused clock and combat fields, listeners nobody fires, unreachable Shop and Bank branches, drag CSS nothing sets, sprite entries for deleted art). Two small fixes ride along: the hero sheet's equip flash no longer leaves a timer running after it closes, and the build no longer ships the owner's `maybe`/`archive`/`waste` scrap folders. The CMS's "no skill" warning now says what really happens: no hero will work such a Token. (T-045 to T-068, T-093, T-094, T-103, T-139, T-163)
- **The Guild Hall is a night sky** (the owner's sky art): the upgrade screen now shows the owner's star field tiled at 2x with the see-through cloud layer over it at a quarter strength, both drifting one art pixel at a time in different directions (the stars cross a tile in about ten minutes, the nearer clouds in about five); the drift stops under reduced motion and nothing of the sky exists while the screen is closed. Every upgrade is one of the owner's pixel stars: a dim grey star while locked, a small twinkling blue star when it can be bought, a big blue star once bought and a big gold star at its top rank; the Guild Hall is the big gold pole star in the middle. Each star carries its name and rank (`Bank Slots 3/10`); the upgrade's picture now shows only in the details panel. Lines are a faint 1-pixel thread until both ends are lit, then bright white-gold; the four constellations (The Hearth, The Vault, The Compass, The Well) are faint names that brighten once every star in them is lit, and a constellation finished while you watch flashes briefly. Hovering a star fills the details panel on the right, and a click pins it there so its Upgrade button can be reached; the details panel now stays right of the sky even with the nav on the right. A star whose next rank the Bank can pay for has a gold outline instead of the bouncing badge. QA → Guild Hall sky sets every star state in one click. The upgrade web also can no longer be scrolled by focus (T-128). (brief 160 T3, T-171)
- **Kill loot follows the same rules as work.** A Token beside an enemy that gives more yield, a chance of double loot or a bonus drop now does so for each kill, exactly as for a station's cycle (the support Tokens already wore per kill). (T-017)
- **Drinks heal like food, and heroes have no energy.** Below a quarter of their HP a hero eats one of the food in their food slot and, if still below, drinks one from their drink slot, in a fight (one skipped attack for both) or out of it; a drink with no food to eat is drunk on its own. The Bank's tooltip on a drink now reads "+N HP". Energy, which nothing spent, is gone from heroes, saves, regeneration and the dev panel's Drain NRJ button. (T-098)
- **A skill level no longer makes a hero work faster.** The hidden +0.5 % work speed per level is gone: every hero runs a Token or recipe at its authored cycle time, so a levelled hero finishes fewer cycles than before (a level 50 hero a fifth fewer). The CMS simulator drops the same ramp, so the next Recalculate prices outputs for the plain cycle rate. (T-125)
- **Loading a save or starting a new game clears the per-hour rates.** The item stubs' "per hour" and the hero panel's XP per hour and time to level no longer show the previous game's numbers after switching saves. (T-022)
- **Removed an unused combat-XP dial.** `GLOBAL_COMBAT_XP_MULTIPLIER` (1.0) was never read; it is deleted rather than wired, so nothing in the game changes. (T-023)
- **Cartography is a crafting table** (the owner's Atlas rework): the left page holds your maps as a grid of their 64 px pictures with counts, Base Maps and Modifiers together; hover one for its name and what it adds, then click it into the next free slot or drag it onto a slot. The right page runs top to bottom: four slots (an empty one is a faint dashed outline of a map); the Region the slotted maps would make, drawn as a tiny real map (its ground and water exactly as the mat will draw them once settled, each Token a small copy of its own sprite, the Guild Hall in the middle, the map lying on the Region's banner); what it will hold as Token sprites with counts, biggest first (hover names them); then Reroll and Settle. The little map is drawn once each time the slots change or you reroll (a quick run of clicks draws it once), never while it sits there, and not at all while the Atlas is closed. Cancel is gone: click a slot, or drag its map off, to empty it, and closing the Atlas forgets the slots; as before, nothing leaves the Bank until Settle. After a Settle, the little map's place shows the new Region's name with Travel there and Stay here. The test maps from QA → Atlas show placeholder map pictures; real maps take theirs from their sprite in the CMS. The style sheet page shows the map tiles and slots as new, unapproved. (brief 160 T6)
- **The Atlas's section tabs run down the book's left side, and Region rows are slimmer** (the owner's Atlas rework): Cartography and Regions are cloth page tabs stacked down the book's left edge, coming out from under its cover (on the visible left of the book while the 4x book is cropped by the screen); the open one stands further out with a gold edge. Each Region row now shows only its banner, its two names, Travel and the menu: the Token sprites, the Token count, the heroes and the settled day are gone, and the Region the guild is in shows the hero flag instead of Here. Rows are shorter, so more fit on each page.
- **The Atlas pops up over the playmat** (the owner's look at the Atlas): opening it slides the owner's new book (separate left and right 256 px pages, the right with a drawn ribbon) up from below the screen and settles it over the mat in about 0.3 s, and closing slides it back down; the mat stays as it is behind it, with no table under the book and no dimming. Under reduced motion it appears and goes at once. The camera glide is gone from the Atlas (kept at the tag `atlas-camera-move` for a later screen). The book is always drawn at 4×: bigger than the screen, it stays centred and is cropped, and the panels keep to the parchment that shows. The drawing bench's `atlas` scene opens and closes it every 1.5 s. (brief 160)
- **The Atlas is the owner's book** (the owner's art): the code-drawn book is replaced by the owner's gold-edged page, drawn at exactly 4× (1024 × 512 for the open spread, the left page its mirror), lying on the wood table; the Cartography and Regions panels sit inside each page's parchment, clear of the gold border (the Region rows run down the left page and on down the right, scrolling with the arrow bars). (brief 160 T1b)
- **Every Region has its area banner** (the owner's Atlas interview): the Atlas's Regions section lays one row per Region over both pages of the tome, each row on that Region's banner picture with its names, its three most common Tokens, the day it was settled, its Token count and the heroes out there now in boxes over the art. The Starter Camp comes first, then by the day settled; the Region the guild is in reads Here, every other one has a gold Travel button, and a small "…" opens Rename, Archive and Abandon (Abandon still asks first and is refused for the Starter Camp and the Region you are in). Archived Regions sit behind an Archive button at the foot. A thin slice of the banner lies behind the Region name on the top bar, travelling shows the destination's banner across the mat for a moment with its name (a click skips it; no fade under reduced motion), and the Cartography layout preview lies over the banner of the Region it would settle. In the CMS each Base Map and the Starter Camp page have a Banner picker; without a pick the game chooses by the Region's main biome (forest: lush forest, coast: beach, mountain: snowy mountains, meadow: golden plains, flower meadow: farmland, cherry grove: hidden valley, yellowstone: desert oasis, volcano: desert monolith). (brief 160 T2)
- **The Atlas is an open tome on the map table** (the owner's Atlas interview): it now nearly fills the mat's area as a book lying open on wooden boards, with the game's usual panels laid over its two pages, instead of a box floating over the mat. Two cloth bookmark ribbons on the book's top edge switch between Cartography and Regions, with a quick stepped page turn (none when the computer asks for reduced motion). Cartography spreads over both pages: the slots and the maps the guild holds on the left, the big layout preview on the right with the Node Summary under it and Reroll, Cancel and Settle at the bottom right. Maps can be dragged onto a slot, from one slot to another (swapping with what is there), or off the slots to put them back; a click still slots a map into the next free slot, and a click on a slot still empties it. As before, nothing leaves the Bank until Settle and closing forgets the slots. Regions keeps its list for now. The book, the table and the ribbons are drawn in code until the owner draws them; QA has an Atlas section with Grant test maps, and the style sheet page shows the ribbons as new, unapproved. (brief 160 T1)
- **The recipe list opens inside the Token card** (the owner's recipe presentation pass): Change recipe (or Choose what to build on a Foundation, or the recipe gear on the mat) flips the card to a list on the same picture, grown to fit so every recipe stays on one line, its picture scaled up by whole steps to cover it; choosing a recipe flips it back, and Back or Escape returns without choosing. One line per recipe, by level: the inputs with have/need (red when short), Tokens it needs beside it as hollow bars (red when not there), the main output as the headline, byproducts muted with their chance, XP and time at the end. A thin line with a hero's face sits under the last recipe each hero whose Work Permissions allow the skill can run; the station's worker's face is ringed gold. The next two recipes nobody can run yet show as ??? with their level. A search box finds recipes by what they use or make. It opens on the current recipe, outlined gold. The old recipe window, its bands, level markers and the yellow helper line are gone. (brief 130)
- **Collected loot flies to its own item stub** (the owner's third look at the stubs): loot picked up off the mat flies to that item's stub instead of the Guild Hall, and the stub's count ticks up as each item lands. A new item's stub slides out at +0 as the flight starts, so the loot has somewhere to land. When the stub is out of view (scrolled away, or new below a full column), a copy of it pops out over the bottom stubs, takes the landings, then slides back; clicking the copy pins or clears that item. The Bank is credited at the moment of pickup as before; only the flight and the stub's count wait. With item stubs switched off in Settings, loot flies to the Guild Hall as before. (brief 150 N4)
- **Item stubs and banners replace the notifications sidebar** (the owner's notification interviews). Items gained and spent show as stubs flush against the right edge of the screen, under the top bar, sliding out of the side as they arrive (at the bottom of the stack) and back in as they go, and gliding to a new place when one above them leaves or is pinned: the amount, then the item's sprite, one stub per item showing its net flow (green when it is gaining, red when a station eats it faster than it comes in), fading five minutes after the item last moved. The column scrolls with the arrow bars once it is full, and Clear all removes every stub but the pinned ones. Hover a stub and the same box grows left over the mat into one line: the amount, the sprite, the item's name and its net per hour. Left-click pins or unpins a stub: pinned stubs sit at the top, always showing that one line, never fade and are saved with the game. Right-click clears a stub, or sets a pinned one back to +0. An item found for the first time shows in a gold frame led by "New!". What must not be missed drops in as a banner at the top centre, from behind the top bar: a recipe a level-up unlocks for the guild for the first time (one banner per level-up, however many recipes), a new hero, a promotion and a guild upgrade in gold with a chime and a shine; a knocked-out hero, a full Bank leaving items on the mat and a damaged or failed save in red with a warning tone. Each stays until clicked; three stack, then "+N" counts the rest, problems going first; hovering a banner about a hero outlines that hero. Level-ups no longer make a notification (the hero shows them), and a refused drop, quest claim, equip or crowded resize says why in a callout where it happened. The slot screen shows its own messages (a slot deleted, a save that cannot be loaded) on a plain line. The edge sidebar is gone and the mat gets its width; Settings → Notifications is one switch for the item stubs. The QA panel has a Notifications section for each check, and the style sheet page shows both pieces in its new, unapproved group; the gold and red frames are placeholders until drawn. (brief 150)
- **Ambient life on the mat** (the owner's visual style rounds: slow, lazy and subtle, long quiet stretches and now and then something happening): lakes, rivers, springs and the sea have a slow faint swell and a few sparkles that last half a second; about once in 45 seconds a gust crosses the mat from the west and the grass blades and tufts it passes lean one ground pixel and spring back (petals, moss, leaf litter, rock and sand ripples stay still; the grass keeps its colour); the volcano's lava cracks slowly brighten and dim in hard steps; leaves fall over the forest, petals drift over the cherry grove and embers rise from the volcano's lava, a handful at a time; small light birds (three pixels wide, one colour per biome) now and then fly in, sit a while on a Token nobody is working, turn their head, and fly off, three at most, at once if a hero starts work there, the Token is picked up or moved; and small cloud shadows, one shade and each keeping its shape, drift slowly east over everything. Nothing of the ground is redrawn: each effect has a thin layer of its own and touches only what moves, 8 steps a second on the sprites' clock; it all stops while the game is minimised, and is off when the computer asks for reduced motion. The Ground tuner has an Ambient life group (a switch per effect, sparkles, seconds between gusts and between birds, the bird's pixel size, particles, how many clouds, their size and shade), and QA → Terrain has A gust now and A bird now. (brief 190 P3)
- **A calmer, cleaner ground under the Tokens** (the owner's visual style rounds): every biome's ground is drawn in its Clean colours (less colourful, the grassy ground a touch towards olive and the woods towards blue-green so trees stand out, a little brighter where the round set it), and at twice the Tokens' pixel size: one ground pixel is two Token pixels, grass, earth, water, beaches, blends and props alike, while the Tokens keep theirs. The ground is drawn at that size, not shrunk: blades, tufts, pebbles and waves are sized for the bigger pixel and come about as often as the chosen picture shows. The ground's loud little things (flowers, blade tips, petals, shells, scree, props) are pulled about halfway towards the ground round them; water is left alone. The mat's edge has a darker rim in two hard steps, ragged, in place of the soft shadow. The Ground tuner has a new Ground look group (pixel size 1, 2 or 3, Clean colours on or off, how much and above what contrast decorations are quietened, the rim on or off, its width and darkness) and a Clean colours group (strength, hue and brightness for every look). Drawing the ground for a new window size is two to three times quicker. (brief 190 P1)
- **Tokens in a new Region stand in natural groves** (the owner's settled placement rounds): each kind grows in groves of uneven sizes, stretched one way, close together in the middle and looser at the edge, with about one in eight standing alone between groves. Berry bushes grow by a lake, river or pond; ore and stone of a grassy map lean towards another map's rock, and trees of a rocky map towards grass. A kind a map gives only one or two of (its next tier) grows near the mat's edge, so it feels found. An enemy camp sits in a nook near the edge with a grove of the commonest tree wrapped round the side facing the Guild Hall, and a treasure stands on a lake's (or a split river's) island when there is one, else in the most hidden spot away from the Hall. Biome areas still follow where the groves grow; every placement rule (spacing, the Hall's clearing, "Stands on", the water, the camp band, the Token cap) holds. Regions settled before keep their layout. QA → Terrain has a Placement row (a camp and a Test Chest with the rounds' mix of Tokens; a lake view that rolls on to a lake with an island). (brief 180 G7)
- **Biome borders are blended instead of drawn as a stepped seam** (the owner's settled world rounds): where two biomes' ground meet (a forest beside a mountain, a cherry grove beside the rock, a volcano beside a wood, a coast's sand beside either), the border is drawn in one of five styles: a mixed band of both grounds, islands of each in the other, fingers reaching across, a strip of bright lawn with rock or sand flecks between a wood and the rock or sand, or a fine fade with a touch of the other ground's colour in its middle. Each pair of grounds in a Region takes one style, picked by the Region's seed. Drawing only: where Tokens may stand is unchanged, water is never touched, and every shore of the sea keeps its beach. The Ground tuner's new Biome borders group turns it off, sets its width and names a style for a look; the dev panel has three more pairs (Yellowstone + Mountain, Cherry grove + Mountain, Volcano + Forest). Two biomes on the same ground (a meadow beside a forest) still share one look, so they show no border yet.
- **Water in every Region, with smooth shores** (the owner's settled world rounds): water is drawn from its own shapes, at the ground's pixel size, instead of in steps along the ground's cells. A meadow or flower meadow gets a lake (lobed, with islands and bays, up to a fifth of the mat), a river across the mat, a lake with its river, a river that splits round a teardrop island and may end in a small delta, or a river from a spring; a forest or cherry grove a pond; a mountain a tarn or a river; Yellowstone's milky blue sulphur springs are now real water ground with their pale yellow crust; the Coast's sea keeps its beach and loses its staircase shore. Rivers are wide (never narrower than a placing cell) and bend in long soft curves, never doubling back on themselves. In a Region of several biomes, each other biome gets a small water of its own (a pond, a tarn or a sulphur spring) in a gap of its own ground once the Tokens stand, where one fits. A new game's Starter Camp has a small pond near the camp. Lakes and rivers have a wet bank, a broken foam line, shallows, deep water and waves that grow longer with depth. Water never comes into the Guild Hall's clearing, a ground cell counts as water when the water covers half of it (a quarter where a river's middle runs through it), and no generated Token stands on drawn water. Regions settled before, and Starter Camps of older saves, keep their ground as it was. QA → Terrain has a Water row with a button per kind of water, and a Meadow button. (brief 180 G5)
- **The Token card.** Clicking a Token opens a card beside it in place of the old yellow sheet. The picture for what the Token is for fills the card behind its text (a Copper Vein shows the mine, a Furnace the smithy, a Kitchen the kitchen, the Shrimp Coast the fishing scene; a spawner shows the scene of what it spawns), and a Token with no picture for its activity yet gets a plain card. Top to bottom, each part only when it applies: the name and the red X; the skill and the level it needs with the XP a round of work gives; how long a round takes and the charges left (∞ when unlimited); the recipe it runs now, as item bars for what it needs (have/need, red when short), a hollow bar naming the tool it needs nearby, and what it makes with the chance on the rarer ones; a station's Change recipe button, which opens its recipe list; then its clocks with an icon each (respawn, next spawn with its family count, grow, turn). An enemy's card shows its name, its health bar with numbers, its combat skill, level and XP a kill, and what it drops with the chances. Hover any icon or number for the full sentence. One card at a time: clicking another Token moves it there, and clicking bare mat, the X or Esc closes it. A Token can name its own card picture in the CMS (Token editor, Card art). The card's small icons are placeholders until drawn; the style sheet page shows the card and its icons in its new, unapproved group. (brief 120 C3)
- **Hover in two steps.** Pointing at a Token, a hero or an enemy lights its white outline at once; rest the pointer on it for a moment (about a sixth of a second) and its name comes up above it with its rings (charges, quest, spawner, countdown), its recipe gear and its reach ring, and on a hero or an enemy the health bar. Sweeping the pointer across the mat shows only outlines, so nothing flickers on and off on the way. Heroes now show their name on hover too. The Guild Hall's and a quest's hover panels, and a Token's list of flags that passed it over, wait for the same rest. (brief 120 C2)
- **A calmer mat: a work bar and one problem mark.** A Token a hero is working shows a thin bar along its foot that fills once each work cycle, a pixel at a time, with no ring and no seconds; it stops and turns grey while the Token is stuck. A Token with a problem shows one mark at its centre: a yellow "!" while it is waiting for something you can give it (items, a Token beside it, more charges, a recipe chosen) and a red "!" when it can't go on (no room for what it makes, the Token cap full, a hero without the skill or level). Hover the mark for exactly what: "Needs Oak Wood", "Needs a Pickaxe nearby", "Token cap full", "Needs Mining 25/99". An unset station shows the yellow mark instead of the pulsing gear, and clicking the mark opens its recipe list; the gear itself now appears when you hover the station. The charges, quest and spawner rings and the countdown ring no longer pop up by themselves: hover a Token to see them. The -1 / +50 still floats up whenever charges change. Health bars show only when they say something: over a hero who is hurt, fighting or hovered, and over an enemy in a fight or hovered. Heroes no longer speak about what is blocking them; the mark says it. The style sheet page shows the problem mark and the work bar in its new, unapproved group. The "!" pictures are placeholders until drawn. (brief 120 C1)
- **The top bar restyled.** The bar over the mat now wears the studded pixel frame with a hard black shadow instead of the wood strip. On the left, three item bars: the name of the Region you are in (click it to open the Atlas), Tokens 45/128 (the count turns red when the mat is at its cap) and Upkeep per minute (hover it for one item bar per item with its own rate, plus what the Bank holds and who is using it). A Disallow or Demolish banner sits in the middle at the normal text size, its button beside it; the two toggles stay on the right. The bar is a little taller to fit. The Token and upkeep icons are placeholders until drawn. The frame is now one shared piece any panel can wear; the style sheet page shows it in the new, unapproved group.
- **Demolish mode beside Disallow mode.** The top bar has two labelled toggles on the right, Disallow and Demolish; only one is on at a time, and a second press or Esc ends it. While one is on, the bar's centre says what a click does, in plain words: "Disallow mode: click a Token so heroes won't work it. Click again to allow." or, in red, "Demolish mode: click Tokens to mark them. A Construction hero takes them down. Nothing is refunded." That banner is the one warning: after it, each click marks or unmarks a Token for demolition without asking, since a mark can be cancelled until the hero finishes. The banner carries the mode's batch button: Allow all for Disallow (now only shown in the mode), Cancel all marks for Demolish. Shift-click a Token in Disallow mode to disallow every Token of that type on the mat, or shift-click a disallowed one to allow them all again. The hovered Token's outline and the cursor take the mode's colour (muted grey for Disallow, red for Demolish), and the mat's dashed edge does too; the old hint on the mat is gone. In Demolish mode the Tokens that can't be demolished (the Starter Camp's, the Guild Hall, a map's own nodes, landmarks, quests, enemies) are dimmed, and clicking one says why over it. A click anywhere on a Token counts in a mode, its recipe gear and its marks included. Dragging on the mat pauses in both modes. A Token's inspection no longer has the Disallow switch or the Demolish and Cancel demolition buttons. The style sheet page shows the mode outlines and banners in its new, unapproved group. (brief 110 M2, T-166)
- **The Starter Camp stays put.** In a new game, every Token the Starter Camp lays down (today the Oak Forest and the Copper Mine) can't be dragged, is never pushed aside, and can't be demolished: clicking it in Demolish mode says "This came with the Starter Camp, so it cannot be demolished." They no longer show the faint "you can move me" ring. The Guild Hall still moves (and still can't be demolished), and anything you buy, craft or build in the camp moves and can be demolished as before. Saves from before this change keep their camp movable. In the dev QA panel, "Move and remove landmarks and camp Tokens" lifts the rule while ticked so the camp can be laid out again, and now takes effect on Tokens already on the mat. (brief 110 M1, T-165)
- **The shine.** Hover the Upgrade or Settle button and one fast, stepped diagonal glint sweeps across its face once, passing under the text and icons and never over art; nothing plays with reduced motion. The style sheet page shows it in the new, unapproved group. There is no Craft button in the game yet to carry it. (brief 140 H3)
- **The level-up moment.** When a hero levels a skill, that skill's icon and the new level float over the hero's head for about 30 seconds and follow them: the old number flashes a gold outline, then rolls up to the new one; several skills levelled together sit side by side, each fading on its own; after time away each hero's levelled skills roll from old to new once "While you were away" is closed. The LVL UP! speech line is gone from the mat. The hero bar's lasting alerts now read the level and the skill ("50 Stealth!"), one per skill; the mouse wheel pages through them like the arrows, which are now small pixel triangles, and each page slides in a few pixels. The style sheet page shows the float in its new, unapproved group. (brief 140 H2)
- **Work Permissions** (the old Work Rules, renamed everywhere you read it): a labelled launcher in its own slot at the left end of the hero bar, with a divider before the heroes, is now the only way in; the hero panel's Work rules link is gone. The drawer slides up above the hero bar as wide as its content (never wider than the mat) and centred on the part of the mat the hero panel leaves visible, hero names on the left and every skill column a 32 px square cell, so all of them fit beside the open hero panel; every skill column shows for everyone, Advanced and Master included. One **Combat** column replaces the combat-skill columns and Fight: a plain tick turns a hero's fighting on or off, and in Priorities mode it ranks fighting against their work (Combat 1, Fishing 2 sends them to enemies first). Hovering a column header says what the skill is for and what it feeds. The hero panel tidy: a locked skill's tooltip names the class that unlocks it (Requires Ranger), and the close X draws at its sprite's true size. (brief 140 H1)
- **One shared tooltip that follows the cursor** in the Bank, the Shop and the hero panel: the gold-edged dark box sits below and right of the pointer, clear of what is under it, flips left or up at the screen's edges, and hides while a button is held. The Bank's item tiles, Select, filter, capacity and locked-tab tips and the Shop rows' tips were plain browser tips before; the hero panel's skill rows used the top bar's tip. The style sheet page also shows the **proposed text sizes** (title 18 px, body 16 px, small 14 px, display 32 px at the default Text size, each scaled by the setting), waiting for the owner's OK; no panel uses them yet. Font sizes written in the shared components and the Bank, Shop and hero panel, and fonts written in the shared components, now say what actually renders, with nothing on screen changing.
- **One arrow-bar list everywhere a panel scrolls** (the Shop, the Inspect column, the Token inspect pop-up and a Guild Hall upgrade's rank list): no scrollbar; an arrow bar above and below with a small pixel triangle that dims at its end of the list but keeps its space, so the list never jumps (the Inspect column, the pop-up and the rank list used to hide the arrow instead); a click scrolls about two rows smoothly, holding keeps scrolling, the mouse wheel works as before. It joins the style sheet page as a shared piece. (brief 100 K2)
- **A style sheet page in the dev tools** (QA → Style Sheet): every standard UI piece from the style guide, live, for builders to copy and the owner to check. The shared pieces (colours, hover and alert outlines, the item ribbon, bars, tooltips) sit apart from a *new, unapproved* group of placeholders for pieces no screen shares yet (text sizes, pill, panel header and close X, main and icon buttons, tabs, pixel frames, the XP bar). The five colour meanings are now shared CSS variables (`--color-ui-red`, `-green`, `-gold`, `-white`, `-muted`); no screen changes look. (brief 100 K1)
- **Everyone fights: a Recruit can fight.** A hero with no combat skill fights exactly as a level 1 fighter with what they carry (their weapon decides the side of the matchup; unarmed is Melee). Their fights still drop loot but earn no combat XP until they are promoted, and promotion still starts the real combat skill at level 1. Recruits now have a Fight row in Work Permissions (on by default, like everyone), seek enemies in their flag radius when it is on, and are attacked by hostile enemies like anyone, fighting back. Hostile enemies now notice a hero by where their flag stands, the same on every side: a flag planted near one (inside the flag radius) draws an attack at once, wherever the hero is, and the hero walks up to fight; a hero only walking past, or stepping out of the Guild Hall beside it, is left alone. Moving a hero's flag away from a hostile enemy now lets them walk off, even mid-fight (the enemy is whole again); before, it attacked again at once. The tutorial's Win a Fight step can now be done in a new game.
- **Every ground is drawn by rules now, and four new biomes have theirs** (the owner's settled design rounds): the mountain's calm grey rock with alpine grass in broken seams, scree and gravel; the coast's golden sand with dune grass, ripples and shells, wet sand at the water, and a sea in depth steps with a broken foam line and waves that grow longer further out; the flower meadow, the pink cherry grove with green patches, Yellowstone's dark forest floor with milky blue sulphur lakes (kept off the Guild Hall), and the volcano's basalt, ash and lava seams, each a dev Region button in QA → Terrain. The forest takes twice the meadow's dappled shade; the Ground tuner gains Ground strength (calms every generated look's colours) and Sulphur lakes. (brief 180 G4)
- **The meadow and the forest are drawn by rules instead of a repeating sheet** (the owner's settled ground rules for each): soft clumps, mounds with a lit top and a shadow, blade strokes and tufts lit from the top-left, texture in patches, three kinds of grass in ragged zones (the meadow's tall, lawn and dry grass; the forest's ferns, lawn and leaf litter), and earth with clods, a lighter middle and a sunken edge that the grass reaches into. Shapes stay put on the mat; every stroke and edge is one Token pixel at any window size. The Ground tuner has a Generated grass section (stroke density, patches, zone scale, tall and dry amounts, earth amount, grass into earth, clump softness and size, mound strength, and a switch back to the old sheets); scatter on the generated grass is drawn unmuted.
- **Sync to Game warns before it removes content.** Before writing, the CMS compares what it is about to write with what `data/` holds; if any Token, item, map, recipe, effect or Starter Camp Token would disappear, nothing is written and a panel lists what would be removed and added, with Restore from Game instead and Sync anyway. Syncs that only add or edit go through as before.
- **The white hover outline, the green and red outlines and the carried shadow show again in the dev game.** Pictures drawn while the dev server was starting (after today's art rename, almost all of them) were answered with the game page instead of the image; the dev server now reads them straight from disk.
- **The Studio's Brighten material palettes button now uses the Gentle setting** (brightness 1.08, saturation 1.12, outlines at or below 40 kept) to match the re-baked art.
- **The ground has structure.** Each ground is drawn a little lighter or darker in large stepped areas several Tokens wide; worn earth covers about a tenth of a meadow in bigger organic patches with a darker rim and a lighter fringe of grass; scenery stands in small groups of one kind with open ground between. All of it is on new Ground tuner sliders, built once per Region, never per frame.
- **A carried Token or item is no longer brightened.** The drag filter (brightness 1.15, saturation 1.25) is gone because the art now carries that look; the lift and the pixel shadow are unchanged.
- **The Studio can brighten the Material Library to match the baked art.** The Recolor tab has a Brighten material palettes button that gives every palette the same brightness 1.15 and saturation 1.25 the sprites were baked with (colours at or below 40 kept), shows how many colours would change, asks once, and records the bake in the library so it can never run twice. The art script and the Studio share one colour function.
- **Hovering a Token brightens it less.** The art now carries its extra brightness and colour in the pictures themselves, so the hover lift is a smaller step (a touch brighter, a touch more colour) instead of stacking on top.
- **The art is filed by its new names.** Every picture now has the name and folder the naming rules give it (`docs/reference/ASSET_NAMING.md`): 710 moved, 64 unused files removed, the pictures themselves unchanged. The game, the CMS, the Studio and the art tools use the new names, and old names in content and saves keep drawing the same pictures; an old save's heroes and table background load with the new names. The CMS's Sprite Audit page has an Apply renames button that rewrites the content's old sprite names, for the owner to press and then Sync. The torch and the table backgrounds, which pointed at files with a different case or in a missing folder, now find their files; the Studio saves new art as `<kind>/<group>/<prefix>_<name>.png`; the adventurer hero, whose animation sheet was never drawn, shows its portrait instead of nothing, and the portrait picker drops one blank tile with no file behind it.
- **The dev panel Scatter Loot button throws real items.** It now scatters oak wood, blueberries and bones instead of three items that no longer exist.
- **Thrown loot lands exactly where it fell, and stays sharp.** Loot that arced onto the floor used to come to rest half a sprite up and to the left of its spot and was drawn slightly blurred; it now sits on its spot, like loot that arrives without an arc, and is drawn as crisply as the Tokens. The arc keeps its shape, and a pile sliding into a stack now starts from where the pile actually sits (T-183).
- **See where a Token may stand while you carry it.** Pick up a Token that needs a ground, or any Token in a Region with water, and the ground cells it may stand on light up while the rest go dark; let go and the grid is gone. A plain Token on dry ground everywhere (the Starter Camp, a Forest) shows nothing new. A drop on a dark cell is nudged to the nearest light one, or flies back saying what the Token needs. In the CMS, the Token editor's Lifecycle section has Stands on chips beside Landmark (Water, Shore, Grass, Rock, Sand; none ticked means anywhere dry). The dev panel's Terrain section has a button that places three test Tokens (one needs water, one the shore, one rock) to try it with (terrain T4).
- **A Token that needs water now refuses dry land.** A Token type can now say which grounds it stands on (Water, Shore, Grass, Rock or Sand; the Shore is dry land touching the water), and every way a Token lands obeys it: a drop on the wrong ground is nudged to the nearest spot it may stand on, or flies back saying what it needs (Needs water.), and a Shop purchase, a Token a recipe makes, a spawn, a push and a new Region's layout only ever put it on its ground. A Token with no grounds set stands anywhere dry, so in a Region with a sea nothing lands in the water any more; a Token already standing there stays until it is moved. On a Region with no water, the Starter Camp included, nothing changes. The boot check names a ground word the game does not know, and a map's node whose grounds that map can never give. The CMS field (Stands on) and the grid you see while placing come next; no Token sets grounds yet (terrain T3).
- **Ground under the Tokens (the Atlas, terrain).** The mat now has ground: grass, earth, rock, sand and the sea, in pixel art whose pixels are the same size as the Tokens' at every window size. Each Region draws the ground its maps wrote: a Forest's deeper grass, a Mountain's rock with patches of gravel, a Coast's sand and sea, with pale shallows, darker wet sand and a beach wherever the water meets the land; worn patches of earth through the grass; and small scattered flowers, mushrooms, bushes, pebbles and shells. Where two maps' grounds meet they blend along a wiggly edge. The Starter Camp is meadow. The ground is still: nothing you do on the mat changes it. The mat's rounded corners and soft dark rim are now part of the ground's picture. It is drawn once when you arrive in a Region and redrawn a quarter of a second after the window stops changing size, never while you play (brief 80, T2).
- **A Token's popups no longer cover its hero's speech.** When a hero working a Token has a speech bubble up and the Token pops a callout (an effect firing, "! Spawned …"), the callout now appears directly above the hero's bubbles in one column, the same small gap apart as bubbles of one kind, instead of on top of them; if the hero starts or stops speaking while it is up, it moves up or back down. Everything else about both kinds of bubble is unchanged (T-158).
- **The recipe gear stops pulsing.** On a station or Foundation with no recipe chosen, the gear no longer swells and glows: it keeps its place and size and wears a one-art-pixel gold outline whose colour steps between two golds (a pale gold and the usual one) on the same slow beat. It also no longer grows when hovered while it waits.
- **A minimised game stops drawing.** The desktop app kept drawing the mat at full speed while minimised, because its built-in browser is never told the window is down: wasted battery and graphics card. Now minimising the app (or hiding the game's browser tab) stops the mat's animation clocks (hero and enemy sprites, the cycle rings), and restoring it picks them up with one fresh frame, not a rush of the missed ones. The game itself keeps playing while minimised, exactly as before (brief 60, P2-10, T-117).
- **The Bank, Shop and Work Rules drawers close each other.** Opening one of the three, from its button, a hero panel link or a banner prompt, now closes whichever of the others is open; closing the open one leaves the plain mat. Panels and windows keep their own rules.
- **Hover is a thin white outline; the Guild Hall moves again.** Hovering a Token or a hero on the mat now shows only its white outline, exactly one art pixel wide and as sharp as the art; the little hop and the lift are gone, so nothing moves under the pointer. Movable Tokens still show the faint ring at their foot and the grab cursor. Heroes' and enemies' outlines are no longer cut off where the art reaches the edge of its animation frame (a bow's tip, the feet): they now go all the way round. The Guild Hall can be picked up and moved like anything you bought or built, and carries the faint ring; let go anywhere off the mat it flies back and says why, nothing but you ever pushes it aside, and it still cannot be demolished. Map nodes, landmarks and planted trees and crops stay fixed (T-146, T-147, T-148).
- **Tokens on the mat stay sharp and still.** Tokens could twitch by a pixel and go soft for a moment, then snap back: on a quiet mat about once a work cycle, on a busy one every few seconds. It happened whenever something animated behind them (a -1 rising over a Token, a Token hopping as it lands or refills, the Guild Hall flashing as loot arrives, a Token popping out of its spawner, an enemy walking): the browser then drew the Tokens in front of it apart from the mat, resampled, a little blurred and a pixel off. The animations that play among the resting Tokens (the hop, the flashes and glows, a spawn, an enemy walking, the quest halo, the recipe gear, a -1 on a Token nobody works) are now drawn by the game itself, so the Tokens around them stay drawn the one sharp way; a worked Token's -1, a walking hero and floor loot, drawn in front of them all, play as before. A Token's name label, which waits invisibly above every Token until hovered, is no longer drawn at all while hidden: its soft shadow alone had been enough to leave a few Tokens slightly blurred at rest. The animations look and time the same, and the label still fades in and out as before (T-145).
- **Lighter pick-up, carry and drop.** Every hero, flag, hero-bar figure, Shop row and Bank item you can drag now picks up through one shared drag handle, as the mat's Tokens already did, so the drag system's own bookkeeping during a drag (three times at a pickup, twice at a drop, each time the target under the pointer changes) no longer redraws each of them; the picture in your hand is no longer redrawn on every pointer move; the heroes in the bar and the hero tabs beside the Bank no longer redraw themselves after every drop just to wait out the reorder animation (only a hovered one still waits its 320 ms before lifting); and the mat's frame no longer redraws the boxes around the mat's drawing with it. Drags look, feel and land exactly as before. On the 128-Token board a pickup now redraws 20 to 38 % fewer components (by kind of drag), each pointer move about a quarter fewer, and a drop 10 to 24 % fewer, in two to four fewer screen updates (brief 60, P2-9).
- **Moving a Token re-stacks only that Token.** Every Token and flag on the mat now keeps its own place in the drawing order, so hovering a Token, moving one, a hero starting work or a new Token spawning changes that one Token's place and nobody else's; before, each of these renumbered every Token in front of it. On a full 128-Token mat a hover used to rewrite about 31 places and a move about 120; now 4 and 2, and the flags no longer redraw when a Token moves. Who is drawn in front of whom is the same as before. On a mat of more than about 220 Tokens and flags (the 256 cap) the bottom rows no longer share one place: a flag standing there no longer covers the Tokens standing lower than it, and those Tokens overlap in the right order (brief 60, P2-7).
- **The cartographer's tutorial (the Atlas).** The tutorial is now the cartographer's: eleven steps, one at a time, each quest's tooltip carrying his line (in quotes, signed The Cartographer) above a plain instruction. Recruit a Hero, Plant a Flag, Gather (3 times, anything), Collect Loot, Buy a Foundation (a Wood Foundation), Build a Station (anything built on it), Craft Something (any recipe at a station), Win a Fight (any enemy), Inspect an Old Site (click an endgame site; it pays the first maps: one of each Base Map that no map trades up into, read when you claim, so none until maps are authored in the CMS), Write a World (settle a Region in the Atlas) and Move the Guild (travel there). Every tutorial word is in one file for the owner to edit. The golden beacon now finds each step's target on today's screen: Plant a Flag points at a hero in the hero bar (it pointed at nothing since the bar was redone), and the Atlas steps point at the Atlas orb, then the Cartography tab, Settle and Travel there. The old Log an Oak Tree wording is gone, and a promotion now names the skills it needs (Requires Mining and Fishing at level 5) instead of the skills it carries forward. An old save's tutorial step is dropped and the new chain starts from the top (Atlas A8).
- **A worked Token's hit loop no longer gets a drawing layer of its own.** Chrome used to give every looping hit animation its own composited layer, and then every Token, hero, flag and name badge drawn over it needed one too; on a full 128-Token board that was about a third of all layers. The loop now runs without one. It looks and times the same (brief 60, P2-5).
- **Less redrawing after each game tick.** The game ticks ten times a second, and after a tick only what actually changed is drawn again: when one hero's flag changes, the other flags are left alone; when a Token spends a charge, its bubbles redraw but its picture, hit animation and name no longer do; and a hero who stays stuck on the same thing no longer redraws every speech bubble twice a second. A count bubble (charges, quest, spawner) now comes up in the same frame as the change that raised it, rather than a frame later, and still glides from the old number to the new one. On the realistic test mat this is about 40 % fewer component redraws and 30 % fewer screen updates while playing, with the game doing exactly the same work (brief 60, P2-8).
- **Cheaper loot, on the floor and in the air.** Loot dropping, being picked up, or a pile growing now redraws only that piece of loot, not every piece on the floor. The sparkling flight of collected loot to the Guild Hall is drawn on a canvas only as big as the flights and hidden while nothing flies, instead of one covering the whole window that was cleared and redrawn whole on every frame of every flight. Loot looks and flies as before, landing where it went with the same timing; a pile sliding into a stack no longer replays its slide when other loot changes in the same moment (brief 60, P2-6).
- **Hero and enemy animations share one clock.** The heroes on the mat, the same heroes in the hero bar, the hero panel's figure and the enemies used to each keep a timer of their own (16 on a working board) and each woke on its own; now one clock wakes once for whichever is due next and steps every sprite due by that frame together. Every sprite still shows the same frame at the same moment as before, at its own pace (a limping hero still walks at half speed), and a hero's strike still lands as the Token reacts. A hidden tab now does no animation work at all and catches up in one step when it comes back (brief 60, P2-3).
- **Trading maps up (the Atlas, upcycling).** In the Atlas's Cartography part, a map that trades up shows a small Trade 10 for 1 Mountain Map under its row: click it and the Bank gives that many of the map for one of the better map, at once, with no hero. One click is one trade (it never carries on into the map after). The control is greyed out while the guild holds too few, and hovering it says how many it needs and how many the guild holds; it also refuses when the Bank has no room for the new map. Which map trades into which, and how many it takes, is set on each map in the CMS; none ship yet (Atlas A12).
- **Demolish from the inspection; the discard bin is gone (the Atlas).** Click a Token and press Demolish: it wears a small Construction badge, its inspection says Marked for demolition (with the seconds left once a hero is on it), a hero with Construction walks over and takes it away, Demolished … pops up where it stood, and the Token count drops. Cancel demolition takes the mark off. Where a Token cannot be demolished (the Guild Hall, a landmark, a map's Tokens, an enemy) the inspection says why instead. A bounty quest has Dismiss bounty on its inspection: it leaves with no reward and a new bounty comes in its place; tutorial steps stay until claimed. The Bin tab, its nine places, pulling Tokens back out and the Discard all refund are removed, and the Token cap and spawner limits count only what is on the mat. The drag bench loses its two bin drags (Atlas A3b).
- **A cheaper tutorial beacon.** The golden ring that points at what a tutorial step needs no longer searches the whole page for its target on every frame (the game did that for the whole Recruit a Hero step, even with the Guild Hall shut). It now looks ten times a second, and follows its target smoothly only while the target is moving; it still appears when its target does, follows it when it slides or the window changes size, and goes when the target goes or the step is done. On a busy mat at a slow-PC speed this was about 4 % of the game's work (brief 60, P2-2).
- **A cheaper notification column.** While the Notifications tab is shut, its notifications are no longer drawn at all behind it (they used to be, invisibly, each with its own blur and slide); the tab's count still follows every notification. Hovering the tab shows the same notifications as before, already in place, and new ones slide in as always; the Collapse choice is kept while the tab is shut (brief 60, P2-4).
- **The Atlas screen.** A fifth bubble in the menu opens the Atlas over the mat, in two parts. **Regions** lists every Region the guild has settled, with its name (click it to rename), what it was written from, the day it was settled and its Token count: Travel there, Archive or Restore it, or Abandon it after a confirmation (never the Region the guild is in, nor the Starter Camp); travel waits while time away is still being played. **Cartography** lists the maps in the Bank: click one to put it in a slot (4 slots to start), and the table shows how many of each Token the maps write and a small drawing of the layout; Reroll shuffles the layout (a short pause between rerolls), Settle uses the maps up and offers to travel there, and Cancel or closing the screen gives everything back. Two new Guild Hall upgrades: the Cartography Table (one more slot a rank, up to 8) and the Token Cap (16 more Tokens a rank, from 128 up to 256), priced as placeholders (Atlas A6).
- **Demolition (the Atlas, engine half).** A Token can now be marked for demolition, and a hero with Construction walks over and takes it away: a short job (10 s for now), no refund, nothing dropped, and the Token count goes down. While it is marked the Token stops its own work (a station stops its recipe, a spawner stops spawning, a sapling stops growing) and is just a job; taking the mark off makes it itself again and loses the half-done demolition. The Guild Hall, landmarks, the Tokens a map wrote, quests and enemies cannot be marked. A marked Token stays marked through a save. There is no button yet: for now it is marked from the dev console (`Game.Demolition.mark(id)`), and the discard bin is still there until the next slice (Atlas A3a).
- **A cheaper work-cycle ring.** The ring a worked Token fills as its hero works now moves in small steps ten times a second, every Token's ring in the same frame, instead of each ring redrawing on frames of its own; on a busy mat that redrew the page on nearly every frame. It still fills from where the engine says the cycle is, empties when a round of work finishes, freezes grey when the Token is blocked, and a time-skip or catch-up lands it in the right place. The inspection's Time and XP rings now move in step with the Token's own ring (brief 60, P2-1).
- **Fixed and movable Tokens (the Atlas).** Map nodes, planted trees and crops (the Saplings and Sprouts a Forest, Orchard or Field puts out, and what they grow into), the endgame sites and the Guild Hall now stay where they are: they cannot be picked up, binned or shoved aside by a spawn, a growth or a build, but clicking one still inspects it. Everything you bought or built still moves, and shows a faint ring at its foot while at rest, lifting with the grab cursor when you hover it; fixed Tokens show neither. Enemies and quests move as before (Atlas A10).
- **Resource Tokens that come back (the Atlas, respawning resources).** A Token can now be set in the CMS, with a new Respawns block, to come back after it runs out instead of leaving the mat. A refilling Token, like an ore vein, stays where it is, greyed out with a countdown bubble (hover it: Refills in 12 s), then refills to full all at once and hops back to life; a regrowing Token, like a tree, turns into another Token (an Oak Sapling) that grows back into it. Its hero moves on to other work with no red alert, it is never counted under Tokens used up, a carried one rests in your hand, time away plays its rests like any other clock, and a tree a Forest spawned still counts toward the Forest's limit while it grows back. Nothing in the shipped content uses it yet: the respawn times are set on the veins and trees in the CMS (Atlas A2).
- **The Starter Camp (the Atlas, new game part).** A new game now opens in the Starter Camp, a Region laid out by hand: arrange the mat in a dev game (the QA panel's Starter Camp section can place any Token, endgame sites included, and has a switch to move and remove them), press Save this mat as the Starter Camp, then review the Tokens, their positions and the opening Bank on the CMS's new Starter Camp page (Bank counts are editable, Clear goes back to the default) and Sync to Game. Until one is synced, a new game opens as before: the Guild Hall, an Oak Forest, a Copper Mine, 3 Oak Seeds, 10 Oak Wood and 2 Wheat Seeds. A Token can now be marked a Landmark in the CMS Token editor: the endgame sites count toward the Token cap like any placed Token, are never pushed aside, cannot be moved (a drag puts it back where it stood), binned or removed, and inspecting one shows the skill, level and items its challenge needs (or says they are not written yet). The Starter Camp can never be abandoned (Atlas A7).
- **Maps are items (the Atlas, maps part).** Base Maps and Modifiers are authored in the CMS's rewritten Map editor (a Base Map's biome, points, which Tokens it writes and how often, its enemy camps and treasures; a Modifier's effects: more of a node, a better node instead, an enemy camp, a treasure), and each one is an item: Sync writes it into the items file, it sits in the Bank like any item, and inspecting it lists what it writes (40 Tokens: 30 × Oak Tree, …). Settling a Region from maps now uses the maps in the Bank and takes exactly the ones slotted (still from the dev console until the Atlas screen arrives). A claimed bounty now pays a map 1 time in 4 as well, drawn when you claim it. The economic simulator leaves maps alone, the boot check and the Economy Audit name a map that points at a missing Token or writes nothing, and the old Map code (the Map catalogue, its editor and simulator check, `data/maps.json`) is retired (T-110). No maps ship yet: they are authored in the CMS.
- **No more tier numbers in the recipe picker.** A recipe that needs a better Foundation or tool now names the first one that will do, such as Needs a Marble Foundation or better, or Beside an Iron Pickaxe or better, instead of Foundation tier 2 or higher. The rules sentences the game prints follow the same wording; the CMS still shows the numbers. A Token's description, which the CMS writes, still says Tier for now (Atlas A11).
- **Regions written from maps (the Atlas, second part).** A set of maps can now be turned into a new Region: the game works out how many of each Token the maps write (more maps of a kind, more of its Tokens; modifiers add Tokens, swap one for another, or add an enemy camp), lays them out around a clear space in the middle for the Guild Hall, with same kinds of tree or ore growing together and camps out towards the edge, and settling keeps that layout as the Region's mat, its Tokens fixed where they were written. Rerolling before settling moves the Tokens but never changes how many there are, and the maps are used up only when you settle. A map can also carry a rule for its whole Region (say, +10 % Forestry), which applies only while the guild is there. There are no map items or Cartography screen yet: for now this is reached from the dev console with placeholder maps (Atlas A4).
- **A Token in your hand cannot vanish.** While you carry a Token it pauses: its work cycle stops (its hero waits beside it), a fight with a carried enemy stops with no damage either way, and a Token that runs out of charges while carried stays in your hand. When you drop it, work and fights carry on exactly where they stopped, and a Token that ran out is used up where it lands (T-129).
- **Ambush rules.** A Token's Spawns rule can now have a chance, set in the CMS rules editor, where it reads On Cycle: a 5% chance to spawn Rock Elemental on the nearest free tile. The chance is rolled before the rule does anything, so a miss costs no charge and starts no cooldown; a rule-fired spawn waits while the mat is at its Token cap (one that replaces its own Token still happens); and an enemy a rule spawns belongs to the Token that made it, watching for heroes around that Token, so it attacks whoever is working it, offline too. Rules without a chance behave exactly as before. Nothing in the shipped content uses it yet (Atlas A9).
- **Regions and travel (the Atlas, first part).** The game can now hold several Regions, each with its own mat, and move the whole guild between them: the Guild Hall and the quests come along, loot lying on the floor is banked as the guild leaves (whatever the Bank cannot hold stays on that Region's floor), each Region keeps its own flags so going back puts every hero at the flag they left there, and a Region the guild leaves stays frozen exactly as it was until it comes back. There is no Atlas screen yet: for now a Region can only be made and visited from the dev console. The Token cap is now 128 (it was 80) and counts only the Region the guild is in. Saves from before this change cannot be loaded: start a new game.
- **Level-ups from time away show on the hero bar.** After loading a save, waking a sleeping PC or coming back to a background tab, the level-ups the game played while you were away now wait in the hero bar's bubbles like any other, and waking a sleeping PC no longer clears bubbles you had not read yet. Background-tab catch-ups count too, so the bar shows every level gained (director ruling).
- **Smoother pick-up and drop.** Picking up or dropping a hero, flag, Token or item no longer redraws everything else that can be dragged (every Token on the mat, the heroes and flags, the hero bar, the Shop and Bank rows), so the small hitch at the start and end of a drag is gone from most drags: on a busy board a pickup or drop now runs long in 0 to 13 of 50 drags instead of nearly all of them. A very full mat (about 320 Tokens) still hitches at most drops, and the Bank and the Shop now and then (T-033).
- **Dragging picks up what you press.** A hero standing in front of a flag no longer blocks it: a press on the clear space around a hero's figure (their own or a neighbour's) now reaches the flag or Token behind, and a hero facing left is pressed where they are actually drawn (it used to test the mirror image). A flag standing among Tokens can always be picked up by its cloth: over a Token, the coloured banner of a flag drawn in front of it now takes the press, while its pole, its grass and its empty corners still let the Token have it. The playmat no longer jumps up under the top bar after dragging a flag or hero near its edge. The drag bench now reaches every kind of drag 100 % of the time (T-105, T-106).
- **Drag bench sees hitches.** The drag bench (npm run bench:drag) now times every frame of each drag, not only how fast it starts: for the pickup, the carry and the drop it reports the longest frame and how many frames ran over 16.7 ms (a visible hitch), per kind of drag, plain and with bubbles showing. Its dev server now keeps its own Vite cache per checkout, so two worktrees' benches no longer share one (T-123).
- **The flag is just something to drag.** A hero's flag on the mat no longer carries the rules gear or the … idle badge; the work rules move to the hero bar. Hovering a flag still outlines it and shows the hero's name and how far they reach, and a hero with nothing to do still says No work in range. Drag the flag to move it, or onto the bar to call the hero home. While you drag it, a green dot marks the middle of every Token inside its reach that the hero could work.
- **Hero panel.** Clicking a hero in the bottom bar now opens the same full-height side panel the Bank uses, on the notification side, instead of a sheet rising from the bar, and it stays open when you open the Bank. At the top the hero idles at twice their mat size with their flag behind them, then the name, job and HP bar with its numbers (61 / 432). Below: the loadout grid, then every skill the hero holds in one list (combat first, then the 9 Starting skills, then Advanced and Master skills, which have their own background colour), each as icon, name and 25/99 with a thin XP bar; hovering a skill shows the exact XP in the game's own tooltip, and clicking it opens its numbers: XP this level, XP to the next, total XP, XP an hour and the time to the next level (22:06). Skills set aside at a job change follow, and skills the hero has never had sit in a Locked list at the bottom, shut until you open it. The red X closes the panel (so do Esc and a click on the mat); the quill opens the editor (name, portrait, flag colour, Change Job) and is a stand-in until its own icon is drawn. Once closed the panel no longer catches drops on the mat. The hero tabs beside the Bank now read like the bar: portrait, name and a thin HP bar in one thin frame, with the details in a tooltip on hover instead of the tab sliding out.
- **Hero bar: level-up bubbles that wait for you.** Each hero in the bottom bar now keeps a speech bubble for every skill that levelled, so after time away you can read every level gained by scanning the bar. Bubbles read LVL UP! 50 Melee! (+49), the same words as the mat's level-up bubble, with the numbers in a warmer colour and the (+n) only when two or more levels merged; a bubble takes one or two lines. Three show at a time, and small arrows page back through older ones. Clicking a bubble fades it out and clears just that one; clicking the hero clears all of theirs. The bar has no dark backdrop any more (it is the mat's edge with one thin line), the heroes stand a little further apart, spaced for 8, and the HP bar is slimmer (hover it for the number). Old unused dock code removed (T-044).
- **Work rules grid.** A Work Rules button (the orange gear) at the left end of the hero bar opens a drawer that rises from behind the bar, one row per hero (up to 8), with the mat still in view above it. Columns are every skill, combat then Starting then specialist under group headings, then one Fight column; a skill a hero doesn't hold is a blank, dimmed square. Each square shows a tick when allowed; the Priorities switch at the top shows every square's priority instead. Click to step up, right-click to step down (1 to 5, then off); a skill switched on starts at priority 1. Squares are shaded by the hero's level, darker at 1 and brighter at 99, and hovering one names the hero, skill and level. Click a hero's name to allow or disallow their whole row, or a skill's icon for that whole column. Hovering a row lights that hero on the mat. The button or Esc closes it; clicking the mat leaves it open. The hero panel has a small Work rules link that opens the drawer with that hero's row lit. The hover gear on heroes, the side rules panel and Copy rules to are gone.
- **The Time Bank is gone.** The hidden Time Bank (banked time away, spent at 2×, 5× or 10× speed) is removed with its widget, its speed-ups and its save field, now that the game plays the time you were away instead.
- **Loading bar and While you were away.** While the game catches up on time away (2 minutes or more), a loading bar covers the mat saying how long you were gone, so the game never looks frozen; it cannot be closed part-way. Then a While you were away panel lists the time away (and how much past the 24 hour limit was skipped) under plain headings: Items produced (made and waiting on the mat), Items banked, Items spent, Level-ups (Mining 50 → 51), Tokens used up, Heroes wounded and Fights won, leaving out anything that did not happen. Every item, Token, level-up and hero is shown as the Token inspection's Item Bar, wider here: the sprite grows on hover, and the count reads short (5.9k) until hovered, then exact (5,900). The bars fade and slide in one after another, and a long list scrolls inside the panel. **Return to the Guild** (or Esc) keeps the catch-up; **Load as I left it**, below it, asks first, then throws the catch-up away and reloads the game exactly as you left it, with no catch-up, after a closed game or a sleeping PC alike (Cancel or Esc keeps it).
- **The game plays the time you were away.** Loading a save now plays every second since it was written, up to 24 hours, through the real game in fast 1-second steps (24 hours of the bench's busy board took 24 s), then saves once; a crash or a closed window part-way keeps the save you loaded, and the next load tries again. A sleeping PC or a background browser tab catches up the same way when it wakes. Work cycles now keep the part of a second left over when they finish, so production is about 0.5 % higher than before, live and offline alike. Effects, loot timing and the rate readouts follow game time. The Time Bank no longer banks anything.
- **Stealth joins the combat matchups.** Combat styles now form a four-way cycle: Melee beats Ranged, Ranged beats Magic, Magic beats Stealth, and Stealth beats Melee (still +10 % damage and +7 to hit for the winner). Melee against Magic and Ranged against Stealth are even, so Magic no longer beats Melee. Enemies can be set to Stealth in the CMS Style dropdown, which now lists the four combat skills from the skill registry.
- **CMS content generator follows the skill list (class rework v2, part 3).** The AI generator in the CMS no longer defaults to Nature, a skill that no longer exists: its default skill and the skill list it gives the AI now come straight from the game's 25 skills. The design document now says the Oak Forest Map is gone, the Shop sells 10 Tokens and the tutorial has 11 steps.
- **Promotion rules (class rework v2, part 2).** A Recruit now qualifies for a basic class once two of their Starting skills reach level 10: Fighter needs Mining and Smithing, Ranger Forestry and Crafting, Wizard Alchemy and Cooking, Rogue Fishing and Crafting (the Change Job planner shows what is still missing). Promotion is now free: an Academy no longer uses up a charge per hero and never wears out, unless its price is set in the CMS. Mastery: an Advanced or Master skill that reaches level 99 is never set aside when the hero changes class; it stays on top of the new class's skills (Combat skills are set aside as usual).
- **New skills and classes (class rework v2, part 1).** Heroes now have 25 skills in four groups: 9 Starting skills every hero always keeps (Mining, Forestry, Fishing, Smithing, Crafting, Cooking, Farming, Alchemy, Construction), 4 Combat styles (Melee, Ranged, Magic and the new Stealth), 4 Advanced skills (Leadership, Fletching, Enchanting, Crime) and 8 Master skills. Logging is now called Forestry and keeps its picture; Explore and the old specialist skills are gone. The class tree is now Recruit, then 4 basic classes (Fighter, Ranger, Wizard, Rogue), then 8 master classes (Paladin, Knight, Beastmaster, Hunter, Necromancer, Scholar, Merchant, Assassin), shown that way in the Change Job planner. A new Recruit holds 9 skills, a basic class 11 and a master class 13. The new skills are placeholders with emoji icons until the specialist-skill rework. Content that still says Logging is read as Forestry automatically, in the game and in the CMS, so trees keep working and the next Sync to Game writes Forestry; the boot check and the CMS Economy Audit now name any Token, recipe or item that points at a skill or job that no longer exists. Not yet: basic classes have no skill requirement and promotion still uses one Academy charge (both change in the next part), and saves from before this change load with their old heroes (start a new game to test).
- **Project notes.** Subagent tiers raised for the Max plan (runner Sonnet, builder Opus, engineer Opus extra-high) and code phases may now run in parallel in git worktrees; the test suite is confirmed to run in a worktree once both node_modules folders are linked (T-066 closed).
- **Motion and polish.** A spawned Token pops out of its spawner and slides to its spot (not while the time bank replays time away; the new spawnMotion perf switch turns it off). Item flights now scale with distance: a short hop takes about a third of a second, a long flight up to 0.8 s. A collection quest's billboard shows the item it wants, centred on the poster. Dragging an item out of the Bank casts the hard pixel shadow instead of the old soft one (U8).
- **Token inspection.** Charges, time and XP now show as the same round bubbles the mat uses, and they update live while a hero works the Token: the time bubble counts down and the XP bubble fills with the cycle, and charges follow as they are spent. Skill icons are sharp (they were being smoothed into a blur). The popup has the hero speech bubbles' shape and tail, and the Heroes may work this switch is now Disallow (on means heroes will not work it, and the Token's disallow bubble shows on the mat) (U7).
- **Token Summary and Upkeep rework.** Click the Tokens counter to open the Token Summary (Esc or a click elsewhere closes it): one row per Token type with working, idle, blocked and disallowed counts, Tokens missing items pinned on top, the rest under their skill section with a spawner beside what it spawns, spawned Tokens included, and an In the bin line. Hovering a row lights every Token of that type on the mat. Hovering the counter shows a short explanation instead. The Upkeep panel now lists only what consumes (no Passive Production, no idle spawners) without boxed rows, and the Hall tooltip reads Passive Production, next in 4:57 (U6).
- **Passive Production.** The Guild Hall's free income is now called Passive Production and pays everything at once on one 5-minute timer, dropped as loot beside the Hall: its seeds (the Apple Seed now comes every 5 minutes, not 10) and the Wishing Well's Water, 10 per rank every 5 minutes with no hero needed (it used to need a hero's flag on the Hall, at 1 per rank every 10 seconds). Hovering the Hall shows one countdown and what it pays. A save from before loads with the timer picked up from the furthest-along old clock (T-099).
- **Token cap 80, spawned Tokens included.** The mat now holds up to 80 Tokens, and spawned ones (trees, rocks, goblins) count toward it along with placed ones, on the mat or in the bin; the Guild Hall and quests never count. The top bar and the Shop read Tokens 62/80. At the cap the Shop refuses a purchase (Token cap full), a station holds a Token it makes, and a spawner waits with a red bubble saying Token cap full, on top of its own family cap. A save already over 80 keeps every Token; adding just waits until the count is under. The cap is now a game value; the Mat Tuner keeps a dev override, off by default (T-102).
- **Foundation tiers.** A Foundation can now have a tier (1, 2, 3...) and a building recipe a minimum Foundation tier, set in the CMS. A Foundation builds every recipe at or below its tier, the same rule tools follow, so a tier 3 Foundation builds everything a tier 1 or 2 can; the recipe picker leaves out anything above the Foundation's tier and says when a recipe needs tier 2 or higher. A Foundation or recipe with no tier set counts as tier 1, so today's content builds exactly what it did. A Shop group of Foundations lists its choices by tier, then price.
- **Shop rows, arrows and groups.** The Shop list scrolls with an arrow bar at the top and bottom instead of a scrollbar. Every row is the same height with the Token drawn at 128 pixels on the right, ready to drag out onto the mat, and the cost in a 2 by 2 grid. A Token can now be given a Shop group in the CMS (Spawning and Building, Shop block): Tokens sharing a group name show as one row with a dropdown, and the chosen entry's picture and price are what you buy.
- **Fast drops on the bin.** Flicking a Token onto the bin edge and letting go straight away now bins it; before, a release in the first few milliseconds after the bin popped open dropped the Token on the mat underneath. A Token dragged back out of the bin still never drops back into it.
- **Grabbing follows each Token's own circle.** Tokens still draw at their bigger 2× size, but only a Token's own round body now answers a press, so art spilling over a neighbour no longer steals the click or drag; where two Tokens overlap, the press goes to the one whose centre is nearest, the same one the hover outline shows. A hero's art beside their figure no longer blocks the flag or Token behind it either.
- **Heroes stand a little further from their Token.** A hero working or fighting now stands 32 units from the Token's edge instead of 16, so in a fight the hero's health bar and the enemy's no longer touch, even with a four-digit HP number (T-112).
- **Health bar numbers and lingering hero bar.** The health bar now has its number (like 34/50) written on it all the time, so there is no hover tooltip; the bars are a little thicker to fit it. A hero's bar stays up for about 3 seconds after their fight ends, then goes.
- **Notifications and bin pop out over the playmat.** The notification column and the discard bin are now slim tabs on the screen edge that slide out over the mat while you hover them, so the playmat is about 290 pixels wider on a 1600 pixel window. Dragging a Token toward the bin edge opens it too.
- **Stuck spawner warning.** A spawner that cannot spawn now shows a small warning bubble in the middle of its Token the whole time: yellow "Needs Oak Seed to spawn" while it waits on an item, red "No room to spawn" when the mat is full. A single level-up reads "Leveled up Mining to 25!"; the "(+n)" shows only when two or more levels merge.
- **Callouts instead of alert marks.** The floating exclamation marks on Tokens are gone. A spawner now shows a quick "! Spawned Oak Tree" popup that fades, a named effect (like a bonus drop) pops its name over its Token the same way, and the hero who uses a Token up says "Oak Tree Depleted". A level-up on the mat reads "Leveled up Mining to 25! (+4)", with quick level-ups merged into one bubble. The "Hero went elsewhere" notification is dropped.
- **Combat health bars.** A fight now shows a thin health bar above the hero and above the enemy (and above an enemy you hover), gone when the fight ends; hover a bar to read the exact number, like 34/50. The enemy's round HP badge is gone.
- **Token bubbles rebuilt.** Each Token's round badges now sit inside its box in fixed spots (timer top-left, gear, spawner count and disallow mark in the middle, work cycle bottom-left, quest progress bottom-centre, charges bottom-right) and show only when useful: the work cycle while a hero works, counts for a moment after they change and on hover, timers on hover and in their last 10 seconds. Saplings, sprouts and young trees now show a growth timer; every count bubble glides when its number jumps; each bubble has a tooltip and still lets you grab the Token; the name label moved above the Token's box.
- **Binned Tokens now count toward their spawner's cap.** Putting a spawned Token (a sapling, a tree) in the discard bin no longer lets its Forest make another; the slot frees only when the Token is discarded for good.
- **A closed hero sheet no longer blocks drops on the mat.** The bottom hero sheet stayed in place invisibly after closing, so its equipment slots kept refusing Tokens and flags dropped over its area; it now disappears completely once its closing animation ends.
- **Tests follow the owner's content cuts (2026-10-07).** With Copper Rubble and every Map deleted in
  the CMS, the tests that relied on them were updated: the Oak Forest Map's chain test removed, 8
  golden render cases for deleted Tokens dropped, the first-Map rule skipped while no Maps ship.
  The suite is fully green for the first time in the crunch prep; the AssetManager failure is gone.
- **Environment cleanup before the crunch (2026-10-07).** Test runs are quiet (~380 lines instead of
  ~25,000) and faster (~70 s instead of ~110 s); 25 tombstone tests removed. About 3,500 lines of dead
  code and ~3,000 lines of unused CSS deleted (CSS bundle 215 → 141 kB), plus 3 unused packages and
  old one-off scripts. Misleading names fixed (the Shop's internal id, `BankDrawer`, Tray/Vault
  constants); the slot picker says "Heroes". Audio files moved out of doubled folders. Docs:
  `.ignore` hides the archive from searches, the changelog is split, TESTING.md gained the machine's
  quirks. Plan: `docs/active/hygiene_plan.md`.
- **Crunch briefs written (2026-10-07).** Ten ready-to-run briefs in `docs/active/briefs/` (quick
  fixes, UI rework, class rework v2, hero bar and panel, offline progress, drag, optimization,
  Atlas, terrain, Performance Envelope), from the owner's design interviews.
- **Certification run by the owner (2026-10-07).** The realistic board passes (99.1 % of frames in
  budget, no freezes); the kill stall is confirmed gone; the torture board misses (83 %); picking up
  a Token stalls ~90 ms in the dev build (T-033). Results in `docs/reference/PERFORMANCE.md`.
- **Performance baseline recorded (2026-10-07).** Engine and drawing baselines saved on the owner's
  PC; results, the per-system cost table and the drag success rates are in
  `docs/reference/PERFORMANCE.md`. The rings are over half the drawing cost of a realistic mat.
- **Measurement tools, part 2 (2026-10-07).** `npm run bench:draw` measures what drawing costs:
  each stress board, and S2 with the Bank, the Shop or a hero sheet open or with notification and
  loot bursts, in headless Chrome on the real GPU at CPU 1× and 4×, with a cost table per drawing
  switch, a baseline compare and an A/B mode. `npm run bench:drag` makes hundreds of real mouse
  drags of every kind on a busy mat and reports which ones fail and what blocked them. See
  `bench/README.md`, "Drawing and drag benches". No baseline is saved yet (the owner's quiet run).
- **Measurement tools, part 1 (2026-10-06).** `npm run build:perf` makes a production build that keeps
  the Perf HUD (into `dist-perf/`); `npm run check:perf-build` proves the normal build has none of it.
  15 per-system drawing switches (`?off=rings,speech` or `window.__perf.off(name)`) turn one
  system's drawing off at a time to measure its cost; they never change game logic. Dev and perf
  builds only.
- **Crunch order updated (2026-10-06).** The Atlas joins the crunch after deep optimization,
  followed by a terrain rework; markets stay undecided.
- **Comment-slimming pass (2026-10-06).** Comments only, about 610 files across `src/config`,
  `src/systems`, `src/ui`, `src/state`, `src/utils`, `cms/src` and `src/tests`: roughly 12,000 net
  lines removed, ticket and decision IDs gone, around 90 false comments deleted or corrected. One
  test (`DeadEventWiring`) now matches comment text instead of a ticket ID. Leftovers are T-103.
- **Owner rulings on the GDD questions (2026-10-06).** Recorded in the GDD and as tickets
  T-097..T-100; skill & class rework v2 and real offline progress became crunch tracks; a
  comment-slimming pass is briefed in `docs/active/brief_comment_slimming.md`.
- **Crunch prep: one backlog, a lean doc set, a real GDD (2026-10-06).** All open work now lives in
  `docs/reference/TICKETS.md` (96 tickets); docs are split into `docs/active/` (start at `NOW.md`),
  `docs/reference/` (GDD, tickets, testing) and one `docs/archive/`; CLAUDE.md describes director
  mode; the GDD was rebuilt from code surveys. The dead tile-era terrain table and its 6 expected
  test failures were deleted.

## [0.8.0] — tagged 2026-09-16, plus later work through 2026-10-05 (no version bump)

- **Mat Tokens no longer stop the keyboard Tab key (CR3-411).** Tabbing through the page used to
  walk through every one of the ~150 Tokens on the mat, one by one, and a screen reader would
  read instructions for picking one up with the keyboard — which was never wired up. Tab now
  skips the mat entirely.
- **No stray reach ring while dragging (CR3-410).** Carrying a Token across a hero or a flag used
  to light up that hero's reach ring, even though the Token would not land there. Now, while
  dragging, only the rings of flags the Token would actually land in show.
- **Escape during a drag now only cancels the drag (CR3-409).** Pressing Escape while carrying an
  item out of a hero's sheet used to also close that sheet; pressing it while carrying something
  out of the dock or Bank in disallow mode used to also turn disallow mode off. Now Escape cancels
  the drag alone, and a second press is needed to close the sheet or end disallow mode.
- **A crisp pixel look for shadows and highlights (Wave 5, CR3-350).** Tokens resting on the board
  no longer have a soft shadow. A Token you are dragging, and loot floating on the mat, cast a hard
  black pixel shadow instead. The soft green glow is gone too: a sharp coloured outline now shows a
  Token's or hero's state (green working, white hovered or selected, red alert). The outline is one
  pixel of the art, touching it only edge to edge, so it stays crisp and even. Busy boards draw
  noticeably faster as a result.
- **Charge and spawner count rings glide to their new value** instead of jumping.
- **Smoother drawing on busy mats; looks the same (Wave 4: CR3-007, 011, 301, 303, 351, 352, 353,
  354, 357, 458).**
- **The dock's HP bars keep up with a hero's health (CR3-300).** They used to only catch up when
  something else about the hero changed; now a hit or a heal shows right away, in both the bottom
  hero dock and the Bank's side panel.
- **The hero sheet beside the Bank no longer closes itself the moment you click inside it
  (CR3-450).** Clicking the Edit button, a skill row, or anywhere else in that panel now works as
  expected. Clicking the playmat (or anywhere else outside) still closes it, as intended.
- **The Guild Hall upgrade panel's Close button actually closes it now (CR3-451).** It used to
  clear the panel and instantly put the same upgrade right back.
- **A refused equip no longer pretends to succeed (CR3-405).** Dropping an item on a hero who
  already carries it, has no free slot, or is out of stock now sends the item back where it came
  from, plays no equip sound, and shows a short message saying why.
- **A crash on one part of the screen no longer blacks out the whole game (CR3-203).** The
  playmat, the hero dock, the Bank panel, and the Bank and Shop drawers each now catch their own
  render errors and show a small "Something went wrong here" panel with a Reload button, while
  everything else keeps working.
- **Reordering heroes in the Bank's side panel works now (CR3-457).** It already showed the drop
  line; dragging a hero to reorder there now actually moves it, the same as the bottom dock.
- **Settings tidy-up (CR3-033).** Four controls naming things that no longer exist (Large Tray
  Tokens, Card Badge Tooltips, Boost Tile Tooltips, Instant Pack Reveal) are gone. Nine more that
  do nothing yet (Theme Mode, Zoom to Cursor, Animations, Notification Position, Master Tooltips,
  Item Tooltips, System/Level Up/Loot Messages) are now shown disabled and marked "Coming soon"
  instead of looking live.
- **New ore vein art.** Copper, coal, iron, gold, silver, mythril, adamantine and darkmetal veins,
  and the Stone Outcrop, show their new vein pictures. New foundation, stone and plank art is
  ready to pick in the CMS.
- **The game's art is now versioned** (Git LFS), so every save point can bring back the art that
  went with it.
- **Code review round 3** (see `docs/review_v3/Z.md`): a speed benchmark (`npm run bench`) and an
  in-game performance overlay for developers (`?stress=realistic`).
- **Performance overlay (developers only).** Its mat figure is now labelled "mat subtree commits"
  (every redraw of anything on the mat), with "MatBoard itself" beside it (how often the mat as a
  whole redrew). The small FPS counter in the corner hides while the overlay is on.
- **A brand-new game is now saved complete straight away** (CR3-100). Before, the first save was
  written before the Guild Hall and the starting items were laid out, so if the game closed
  uncleanly in its first ten minutes, that slot loaded as an empty table with no Guild Hall.
- **Changing the PC's clock no longer disturbs the game (CR3-101).** While you're playing, elapsed
  time is now measured by a clock the PC can't move. Winding the system clock back used to make
  every working station "start a new cycle" over and over (and pay for it each time); winding it
  forward used to stuff the jump into the Time Bank. Neither happens now. Time away while the game
  is closed is unaffected — that still uses the real clock, as it should.
- **The Shop slides aside while you place something (CR3-402).** Carrying a Shop item out over the
  playmat now slides the Shop drawer out of the way so you can see where you're dropping it, and it
  slides back the moment you move back over the drawer — not just when you let go. Letting go back
  over the drawer still cancels, as before. Separately, with the Bank open, the playmat it was
  hiding is confirmed to take no clicks or drags at all, the same as it looks.
- **The hero dock shows the heroes (B10, FB-46).** Heroes stand in a dark strip under the mat, idling
  and seen from the waist up, with their name and health bar above their heads. Heroes out on the
  mat are darkened and lowered; hovering lifts a hero. Click and drag work as before.
- **The Guild Hall upgrade web (B9, TL-23).** The Hall screen is a web: the Guild Hall in the centre,
  upgrades around it joined by lines, lit gold where bought; an upgrade opens once anything linked
  to it is bought. The Effects list sits on the left. The 7×7 grid is gone.
- **Small Tokens (B8, TL-19, FB-18).** A Token can be Small in the CMS: half-size art, hit area and
  spacing, with full-size ring badges. The Oak Sapling, Apple Sapling and Wheat Sprout are small.
- **Goblins are hostile (B7.3).** Goblin and Goblin Chief now attack heroes near their camp; Cow and
  Thorn Elemental still fight only when attacked. Set through the CMS.
- **Hostile enemies and fight-back (B7.2, TL-16, TL-24).** An enemy marked Hostile (a new CMS
  checkbox) attacks a hero that comes within a flag's radius of its spawner. An attacked hero
  always fights back, whatever its rules say, then returns to its work.
- **Enemies move (B7.1, TL-16).** Enemies wander near the spawner that made them, walk after it when
  you move it, walk back if you drag them away, and stand still while fighting.
- **Quest Token UI (B6.2, FB-41, TL-18).** Hover a quest Token to read it: title (tagged
  *Tutorial* for a tutorial step), instruction, what's still needed, the reward, and "Click to
  claim" once done. Its progress stands in a parchment ring under it (`3/10`); a done quest glows
  gold until clicked, and clicking it claims (disallow mode never claims). The Quests section is
  gone from the notification column, and the tutorial highlights read the tutorial quest Token.
- **Quest Tokens engine (B6.1, FB-41–FB-43, TL-18).** Quests are Tokens now: the Guild Hall spawns
  them beside itself (spawned, so they never count toward the Token cap). Bounties arrive every 3
  minutes of game time up to 2 on the mat; a new Hall upgrade, the Notice Board, adds one a rank
  up to 5. The tutorial starts with its first step on the mat and brings the next one when a step
  is claimed. Claiming a finished quest drops its reward as loot beside it and the quest vanishes;
  bounties can be binned and discarded (no refund), tutorial steps can't. An older save's quests
  move onto the mat with their progress. No quest screen yet (B6.2): the sidebar is now empty.
- **Flags: no hitbox, and pinning (B5, FB-44, FB-45, TL-17).** A flag no longer blocks the pointer
  for a Token behind it. Drop a hero's flag onto a Token it can work to pin it there: the hero
  works only that Token, the flag moves with it, and when it runs out the flag stays as a normal
  area flag. A Token the hero can't work, or a spawner, just gets an area flag (with the hero
  saying why, for skill or level).
- **Shop: drag to buy (B4, FB-25, FB-27).** The Shop is a drawer from the left edge. Drag a Token
  onto the mat to buy it there; the drawer slides away to a thin lip while you drag. Tokens you
  can't afford or fit are dimmed and say what's missing. The Buy buttons and the Shop tab in the
  bottom drawer are gone.
- **The discard bin (B3.2, FB-34).** At the foot of the notification column: drag Tokens from the mat
  into a grid of nine slots (each shows the Token), drag any back out, see the refund, and press
  *Discard all (n)* to discard them and collect it. The inspection panel's Remove button is gone.
- **Discard bin engine and refunds (B3.1, TL-13).** Tokens can be held in a bin of nine off the mat
  (still counting toward the cap), taken back out unchanged, or discarded together for a refund:
  half the price of a bought Token, a charge-weighted half for consumables, half the Foundation and
  half the build cost for a built station, nothing for spawned Tokens. Built stations now remember
  what they were built from. No screen yet.
- **Disallow mode and Allow all (B2.3, FB-32).** A *Disallow mode* button in the bar: while it is
  on, the mat has a red dashed edge, clicking a Token heroes can work flips it allowed or
  disallowed, and nothing on the mat can be dragged (the dock and the Bank still can). Esc or the
  button ends it. *Allow all (n)* lets heroes work every Token again, at once.
- **Upkeep moves to the bar (B2.2, FB-29).** The bar shows `Upkeep 6/min`, every ongoing item
  cost added up, and hovering it opens the full Upkeep Summary. The Bank drawer's Upkeep toggle
  is gone.
- **A bar above the playmat, with the Token cap (B2.1, FB-28, FB-31).** A slim wooden strip over
  the mat holds mat controls. It shows `Tokens 7/12` (placed Tokens against the cap, the Guild
  Hall not counted), and hovering it lists placed Tokens by type with a red note for blocked or
  disallowed ones, then the spawned Tokens, which don't count. The Time Bank widget now lives in
  the bar (still switched off).
- **Spawner count and turn countdown become rings (B1.3, FB-5, FB-14).** A spawner's `3/5` is a
  green ring that fills to its cap, and a Coast's countdown a sky-blue ring that empties toward its
  next roll. Both always show, last in the ring row, and the corner badges they replace are gone.
- **Ring badges replace the progress bar (B1.2, TL-22, FB-3, FB-4).** Under a worked Token and its
  hero, one row of rings: the cycle (fills, seconds left inside), charges (empties, charges left)
  and, in a fight, the enemy's HP. The row centres under the pair, whichever side the hero stands.
  A blocked Token's cycle ring greys out. Hovering any Token with charges shows its charges ring;
  the old hover charge chip is gone.
- **A worked Token's problems move to its centre (B1.1, TL-22).** Need Items, Wrong Skill, Level
  Too Low and the rest are no longer labels on the progress bar: they are the red or yellow mark
  at the Token's centre (TL-14), staying until fixed. Hovering the Token opens the mark's bubble
  with the hint sentence and what is missing, wrapped to a readable width. The missing list now
  reads a station's chosen recipe, so a Furnace short of ore finally names the ore (the old bar
  never did). The bar hides while its Token is blocked; ring badges replace it next.
- **First pacing pass (Q9, FB-19).** Early gathering (Oak Tree, the three veins, Ripe Wheat, Apple
  Tree, Shrimp Coast) is tagged Quick and runs at 3 s (Coal Vein 4 s, where the calculator moved
  it); Oak Tree and the veins drop to 5 charges and Apple Tree to 3. Copper Ingot, Shrimp and Apple
  Juice are tagged Fast and run at 8 s; Charcoal, Torch, Copper Nails and Copper Pickaxe are tagged
  Fast at 6 s; the four builds and two plantings are tagged Heavy at 30 s. XP per cycle and item
  values re-derived from the new times: most of these producers now give 1 XP a cycle instead of
  2, and coal, the three seeds, raw shrimp and the ingots are cheaper (coal 4 → 1 g, copper ingot
  14 → 10 g).
- **A fifth tempo, Quick, and a wider Fast (TL-21).** Tokens and recipes can now be tagged
  *Quick*: 2–4 s at level 1 (a sync places a tuned producer at 3 s). *Fast* now reaches down to
  4 s (4–12 s, middle 8 s, was 8–12 s) so the bands still join up; Medium, Slow and Heavy are
  unchanged, and all scale with level by the same rule. Quick sits first in the CMS's Tempo buttons
  and Progression dropdowns, and the simulator's passes accept it.
- **Self-transforming Tokens roll a chance, and show a countdown (Q8: FB-14, FB-15, TL-12).** A
  Token with a *Turns* block no longer turns on a fixed timer: once per cycle it rolls its chance,
  and the Token it became rolls the same cycle and chance to turn back (defaults 1 min and 30%, so a
  Coast flips about every three minutes each way). `turns` is now `{ into, everyMs, chance }`, the
  chance a percent like every other chance in the content files; the old `lastsMs` is retired. The
  mat shows the time to the next roll as a small badge bottom-left (B1 will make it a ring), and the
  inspection panel reads e.g. *Next chance to turn into Shrimp Coast: in 34 s (30%)*. A roll held
  while the Token is in the hand, or won with nowhere to stand, is kept rather than re-rolled; one
  long tick (time bank, advance time) rolls once per whole cycle and carries the rest. The CMS
  *Spawning and Building* section edits the cycle and chance (*Roll every*, *Chance to turn*); the
  content audit checks the chance and warns about a leftover `lastsMs`.
- **The Shop has no inspect panel, and shows prices as item rows (Q7: FB-24, FB-26).** The Shop
  drawer no longer opens an *Inspect* column beside it, and clicking a Token's picture opens nothing;
  the Bank keeps its column. Each price line is now the standard item row used for costs elsewhere
  (icon, name, *have/need*), red when the Bank and the floor hold too few. Buying is unchanged: the
  Buy button, which names what is missing.
- **No hero dock on the Guild Hall upgrade screen (Q7: FB-47).** The horizontal hero dock under the
  board is left out while the Guild Hall upgrades are open, and comes back on the playmat.
- **Guild Hall upgrades show their art again (Q7: FB-40).** The Token art had moved into
  per-family folders (`tokens/upgrade/`, `tokens/chest/`) and the upgrade tracks still pointed at the
  old flat folder, so every upgrade but the Hall drew a broken image. Bunk Beds, Bank Slots, Bank
  Tabs and the Wishing Well point at their art again; Flag Radius has no art of its own and borrows
  the plain hero flag. A test now checks every upgrade's art exists.
- **The QA panel fits the window (Q7: FB-36, FB-37).** The open QA tester panel is capped at the
  window's height, and everything under its title scrolls inside it, so its bottom never runs off a
  short window. The *banner card width* slider is gone from it.
- **Speech bubbles read naturally for a Token that names no skill (Q7: FB-54).** Such a Token used
  to make its hero say *My the right level is too low…* or *I don't have the the right skill…*; it
  now reads *My level is too low to work {token}.* / *I don't have the skill to work {token}.*
- **The Guild Hall tooltip is as wide as its lines (Q5b follow-up).** Each trickle line now fits on
  one row, even with all-caps text on, capped to the window width. The flag tooltip is unchanged.
- **Spawners pay their upkeep from loot on the mat too (TL-20).** A spawner's per-spawn upkeep (a
  Forest's Oak Seed) is paid from the Bank first, then from matching loot lying anywhere on the mat,
  the same way recipe inputs already are. A spawner no longer shows *needs Oak Seed* while seeds it
  would use lie on the floor; the Upkeep Summary counts those seeds (*On the mat*) in its runs-out
  estimate, and the inspection line says *paid from the Bank, then loot on the mat*.
- **The Guild Hall has a proper hover tooltip (Q5b: FB-52).** Hovering the Hall now shows a
  game-styled panel, like the flag's, with its trickle income and a *next in* countdown that ticks
  every second, instead of the browser's plain hover text. It never gets in the way of dragging or
  clicking the Hall or collecting loot beside it, and hides during a drag.
- **Guild Hall trickle pays onto the mat as loot (Q5b: FB-53).** The Hall's seeds no longer go
  straight into the Bank: each payout drops as floating loot beside the Hall, like a gathered item,
  is collected on hover (or by auto-collect when that is on) and flies to the Hall. A full Bank loses
  nothing: the loot waits on the floor. A long fast-forward drops one pile per seed type holding every
  payout, and later drops fold into the pile already there.
- **Speech bubbles sit above the head, and speak up only when it matters (Q6: FB-20, FB-21, FB-22).**
  A hero's bubbles now sit with their tail just above the hero's head at every mat size (they used to
  cover the top of it, worse on a small mat). Everyday lines are gone: a hero no longer says
  *Working at Oak Tree.* on arriving at a job, and an unset station or Foundation no longer makes its
  hero say *Choose a recipe…* / *Choose what to build…* (the gear alone says it, as decided after Q1).
  Problems, level-ups and *No work in range.* still show. Every line a bubble can show, with its
  status, is listed in `docs/speech_bubble_lines.md` for the owner's audit.
- **Heroes in a fight attack once per attack; stuck heroes stand idle (Q6: FB-49, FB-50).** A hero
  fighting an enemy now stands idle and plays its attack animation once each time it really attacks
  (hit or miss), instead of swinging in a loop. The enemy's knockback on a landed hit now waits for
  the moment the blow lands in that animation. A hero on a Token that has a problem alert stands idle
  instead of swinging at nothing, by the same test that stops the Token reacting.
- **A Token left in another's place glows (Q6: FB-51).** A Token spawned *where its bearer stands*
  (for example a Stump left behind) now gets the same glow as a transform. Ordinary spawns keep the
  green notice. No shipped Token does this yet, so it is covered by tests only.
- **Loot flies to the Guild Hall (Q5: FB-16, FB-17).** Collected items now arc to the Guild Hall
  Token on the mat instead of the Item Bank button, following the Hall wherever it has been moved;
  the Hall brightens briefly as they land. If the Hall is not on screen (or is being carried), items
  fly to the Bank button as before. Items stay the size they were on the mat for the whole flight
  (they used to shrink). Banking is unchanged: a full Bank still leaves the loot on the mat.
- **Guild Hall trickle on hover (Q5: FB-30).** Hovering the Guild Hall shows its trickle income, for
  example *1 Oak Seed every 5 min (next in 2 min 3 s)*, one line per item it pays.
- **Hit animations and the transform glow (Q4: FB-10, FB-11).** A Token now reacts each time its hero
  strikes it, timed to the blow in the hero's working animation: Logging shakes side to side, Mining
  jitters, Fishing bobs slowly, Farming sways from the base, Smithing squashes down, Crafting hops,
  Cooking pulses twice, Construction thumps, Explore rustles. In a fight, each landed blow knocks the
  enemy back away from the hero with a brief red flash (a miss does nothing). Only the art moves; the
  Token's spot, badges and dragging are unchanged. When a Token becomes another (a sapling grows, a
  Coast turns, a Foundation is built), the new Token flashes white-gold with a soft glow for about a
  second. Reduced-motion settings drop the movement and keep a simple flash.
- **Alerts after Q2.** The red alert left where a used-up Token stood, and the refused-drop mark, now
  fade after 10 seconds like a notice (neither can be fixed). While the time bank replays time away,
  spawns raise no green notice, so you come back to a calm mat.
- **Layering on the mat (Q3: FB-1, FB-2).** Hero flags now layer like Tokens: a flag standing higher
  on the mat than a Token is drawn behind it, one lower is drawn in front (they used to draw on top of
  everything). The idle hero beside a flag layers with it. While a hero works a Token, that Token and
  its hero draw above every other Token and flag; when the work stops they drop back into place. With
  the pointer on a flag, the Token behind it no longer pops up over it.
- **Corner and centre badges (Q2: FB-5, FB-6, FB-7, FB-8, FB-33, FB-48, TL-14).** The green plus on
  workable Tokens is gone. A station or Foundation with something to choose shows the gear sprite in
  its top-left corner; with nothing chosen the gear pulses gently and there is no red alert (heroes
  still skip it); click the gear to choose. A disallowed Token shows the red disallow sprite top-right.
  Alerts sit at the centre of the Token: problems (red, yellow) stay until fixed or read, while green
  notices, such as a Token a spawner has just made or a restock, fade after about 10 seconds. A problem
  always covers a notice. Spawners show their live count against their cap, for example 2/5.
- **Spawned Tokens that grow can be moved (FB-12).** A Sapling (or a turning Coast) no longer grows
  or turns while you are dragging it, which used to swap it for a new Token mid-drag and lose the move.
  The change waits and happens where you put it down; its grow clock is kept.
- **Stations start with no recipe (TL-15, FB-13).** A station, however it arrives, is idle until
  you pick a recipe; heroes don't work it until then, and it says *Choose a recipe*. A picked recipe
  stays, including across saves; a saved recipe that no longer exists becomes no recipe.
- **Handoff.** The token lifecycle first build is done; follow-up work starts from
  `docs/KICKOFF_token_lifecycle_feedback.md`. Versions stay in 0.8.x (TL-11).
- **Shop purchases always find room.** When the area around the Guild Hall is crowded, a purchase (or
  a Token a station makes) goes to the nearest free spot on the mat instead of being refused.
- **Playtest pack** for the token lifecycle build: `docs/token_lifecycle_playtest_pack.md`.
- **A new game starts with an Oak Forest and a Copper Mine** beside the Guild Hall, and a few Oak
  Seeds, Wheat Seeds and Oak Wood in the Bank. The tutorial is rewritten around the new loop: recruit,
  plant a flag, log, collect, shop, build a Workbench, craft, farm and explore.
- **The Token Vault and Tray are gone.** Tokens live only on the mat: a Token a station makes (such
  as a Copper Pickaxe) is placed right beside it, and waits if the mat is full. The Vault drawer, its
  upgrades and right-click deposit are removed; item loot is unchanged.
- **Enemies drop everything they list.** Each line of an enemy's drops now rolls on its own chance, like
  gathering does, so a Goblin always drops Bones and sometimes Copper Ore as well.
- **Goblin Camps.** Buy a Goblin Camp at the Shop (10 Stone, 10 Oak Wood); it keeps up to 3 Goblins on
  the mat and now and then a tougher Goblin Chief. Heroes with a combat skill fight them for Bones,
  Copper Ore and, from Chiefs, Copper Ingots and Beeswax Combs.
- **Explore a Map; Map bursts are gone.** The Oak Forest Map is sold at the Shop and worked by an
  Explore hero: each trip spends a cooked Shrimp and a Torch for mixed loot (wood, seeds, ore, rarely a
  Beeswax Comb), and the Map is used up after five trips. Buying Maps to burst them open is removed.
- **Fixed: an unfinished recipe requirement could blank the game screen.** A recipe whose nearby
  requirement had no tier yet crashed the display; it is now read as tier 1 everywhere.
- **Processing and academies.** Wood and Stone Foundations in the Shop are built by Construction
  into a Workbench (Charcoal, Torches), Cooking Pot, Furnace (Copper Ingots) or a Fighter's Academy.
  A Copper Anvil bought with ingots lets the Furnace smith Copper Nails and wears out as it is used.
  Cooking burns Charcoal as fuel.
- **Farming.** Buy Farmland at the Shop and have a Farming hero plant it as a Wheat Field or an Apple
  Orchard. Fields grow Wheat that ripens and is harvested three times; Orchards grow Apple Trees.
  Each new plant costs one seed, and harvests sometimes return seeds. The Guild Hall also trickles
  Wheat and Apple Seeds.
- **Managers and the gold code are gone.** Spawners replace used-up Tokens, so Managers, their
  restock spots and the "waiting for a Manager" state are removed; a hero whose Token runs out
  moves on. The retired currency, selling and transaction code is deleted, and saves no longer
  carry gold.
- **Mines and the Coast in the Shop.** A Copper Mine, Coal Mine and Quarry (15 Oak Wood each) grow
  up to 3 veins or Stone Outcrops each, mined without a pickaxe; Stone is a new material. The Coast
  (10 Oak Wood) turns into a Shrimp Coast for a minute every few minutes, fished without a net.
- **Waiting spawners show it on the mat.** A spawner that can't pay its upkeep shows a yellow icon
  naming the missing item; one with no room shows a red icon. Both clear the moment the cause is fixed.
- **The Oak Forest is a spawner.** Buy it at the Shop for 10 Oak Wood; it plants Oak Saplings that
  grow into Oak Trees (up to 5), paying one Oak Seed each. Oak Trees need no axe, last 10 logging
  cycles and sometimes drop an Oak Seed. The Guild Hall gives an Oak Seed every 5 minutes, so a
  Forest never stalls for good.
- **Inspection shows lifecycle state.** Clicking a Token now shows its spawner count and cap, when it
  spawns next or what it is waiting for, how long until it grows or turns, a Foundation's build
  progress, and a trickle's pay.
- **Remove a placed Token.** Tokens you placed (not the Guild Hall, not spawned ones) have a Remove
  button with a confirm step. Removal is permanent and returns nothing; anything a spawner left
  behind stays.
- **Spawners, Foundations and growing Tokens get proper types**, so the content audit no longer
  calls them Tokens that do nothing.
- **Upkeep Summary.** An Upkeep button in the Item Bank shows every ongoing cost per minute, how
  long the Bank's stock will last, which Tokens are waiting for an item, trickle income, and which
  spawners are idle at their cap.
- **Building on Foundations.** A Foundation asks you to choose what to build; a hero with the right
  skill and level then works it, and when the build finishes the Foundation becomes that Token on
  the same spot. Recipes above the hero's level show as locked.
- **The Shop.** The Cartographer is now the Shop: it sells Tokens for items, grouped by skill,
  shows what the Bank has against each price, and places a purchase beside the Guild Hall. It shows
  how many placed Tokens the mat holds against its cap. Maps are still sold below.
- **Spawners and the trickle work.** A spawner Token grows new Tokens around itself on a clock, up to
  a cap shared by every spawner of that kind, paying an item from the Bank per spawn and waiting
  when it can't. A Token can also pay items into the Bank on a clock with no hero (for the Guild
  Hall). The QA panel lists each spawner kind's count and cap. No content uses them yet.
- **Gold is gone from play.** Nothing shows, earns or spends gold: selling is removed, coin loot
  and Markets pay nothing, and quests reward 10 Oak Wood instead of Maps. Maps are bought with Oak
  Wood until the Shop replaces them.
- **CMS: recipes that build.** A Construction or Farming recipe can be marked as built on a
  Foundation kind; its card then asks for the Token it builds, the building cost and the build time.
  Renaming a Token now also updates recipes that output it.
- **Content audit checks spawners, Foundations and the Shop.** Broken references, bad numbers
  and conflicting blocks are reported in plain English in the game's boot audit and in the CMS
  Economy Audit.
- **Tokens can grow and turn on a clock.** Engine support for a Token that becomes another after a
  time (a sapling into a tree) and one that turns into something else for a while and back (a Coast
  into a Shrimp Coast). Every Token now remembers whether the player placed it or it was spawned;
  spawns no longer push placed Tokens, and a Token cap for placed Tokens is in the Mat Tuner. No
  content uses it yet.
- **CMS: Spawning and Building.** The Token editor can author spawners, growing, turning,
  Foundations, shop prices and the Guild Hall trickle, and recipes can be marked as buildable on
  Foundation kinds. Sync to Game now carries all of them.
- **Recruits start with nine skills.** Construction (now a starting skill), and the new Farming and
  Explore join Mining, Logging, Fishing, Smithing, Crafting and Cooking. 
- **Promotion keeps every starting skill.** A promoted hero keeps all nine starting skills and adds
  the class's skills on top: 11 after the first promotion, 13 after the second.
- **Guild Hall upgrades cost items, not gold.** Each rank asks for Oak Wood (a placeholder: rank n
  costs 10 x n). The first recruit and the first Wishing Well rank stay free. The upgrade panel shows
  the price and how much the Bank holds.
- **Dev panel: give item and advance time.** The QA panel can put any amount of any item in the
  Bank and fast-forward the whole game by up to two hours per click.
- **Token lifecycle rework started.** Test baseline recorded and the final data shapes for
  spawners, growing, turning, Foundations, the Shop and the Guild Hall trickle written down
  (`docs/token_lifecycle_roadmap_v1.md` §0.4, §3.1). No gameplay change yet.
- **Hero speech bubbles.** A hero who cannot work their Token now says why in a bubble over their
  head, naming the specific thing: "I need a Pickaxe nearby to work Copper Ore Vein.", "I need Oak
  Wood to work Campfire.", too few charges, skill too low. The bubble follows the hero, never blocks
  the pointer, and clears the moment the problem does. A shortage of items waits 3 seconds before
  speaking. The on-Token alert icon no longer repeats these. Heroes also speak at key moments — starting work
  at a Token, running out of work, levelling a skill — with up to three bubbles stacked over one
  head; moments fade after 5 seconds. Bubbles from crowded heroes slide apart, or lift above one another,
  and stay inside the mat. (`docs/hero_speech_bubbles_roadmap_v1.md`)
- **The Cow animates.** It breathes and shifts in place at rest, turning to look the other way
  every so often, and rears up in an attack pose for as long as a hero is fighting it — facing
  whichever side that hero stands on. The first enemy with sprite-sheet animation; others get the
  same treatment as their art arrives.
- **A worked Token's progress bar hangs in the space below it**, wider than before and always
  visible while a hero works it — no need to hover. It used to hug the Token's bottom edge, a
  leftover from when a hero stood stacked on top; since heroes work from beside a Token, that
  space was sitting empty. The charge count and "assign a hero" badges (still hover-only) now sit
  right at the Token's own edge instead of shifting up to clear the old bar.
- **Saves remember what each hero was working on.** Load a game and every hero who was busy is
  standing back at their Token, carrying on, with its progress bar exactly where it was, which
  matters for Tokens with very long cycles. Heroes who weren't working yet start beside their flag.
- **Idle heroes potter about near their flag.** Instead of standing frozen, a hero with nothing to
  do pauses for a few seconds, strolls to a spot close by, and pauses again, never straying far
  from the flag. Work that turns up comes first. A new **Idle wander** slider in the Mat Tuner sets
  how far they stroll (0 keeps them standing still).
- **Heroes come and go through the Guild Hall.** A hero you send out walks out of the Guild Hall
  to their first job. Recall them and their flag disappears and they're back in the dock straight
  away, but on the mat they walk back into the Hall; send them out again on the way and they just
  turn around. A defeated hero limps home slowly, drained of colour.
- **Heroes no longer jump when they get back to their flag.** Every hero, working, walking,
  waiting or idle, is now one continuous figure on the mat, so walking home ends smoothly
  beside the flag. Heroes standing beside a Token always turn to face it.
- **Heroes walk** (Hero Movement, first slice). A hero now travels across the mat to the Token
  they're going to work, at a steady pace (a new **Walk speed** slider in the Mat Tuner — about
  15 seconds to cross the mat). The job's timer starts only when they arrive. They stop beside
  the Token on whichever side they came from and face it, and **the Token no longer shifts over
  to make room**. With nothing left to do they walk back to their flag. They pick their next job
  by what's nearest to where they're standing, not to the flag. Walking, working and facing use
  the hero's animation where the art exists (Recruit, Fighter, Ranger, Rogue, Wizard).
- **A Token you drop simply stays where you let go.** It used to replay a slide from its old
  spot, so it looked like it bounced over. Tokens the game moves (a push) still glide.
- **Only Tokens that care about their neighbours show a reach ring.** Tools, Tokens that need a
  tool nearby, buffs, Managers and "Cannot sit beside…" Tokens show one when hovered or dragged;
  plain resources, Maps and the Guild Hall no longer do.
- **Dragging a Token shows the reach of every flag it would land inside**, so you can see which
  heroes could pick it up before you let go.
- **The guild holds at most 8 heroes** (was 12). Bunk Beds now has 8 ranks at the same prices.
  A save that already has more heroes keeps every one of them, but can't recruit more.
- **Tokens no longer vanish into the retired Tray** (Free Playmat cleanup, 2026-09-21). The Tray
  was taken off the screen, but five things still quietly put Tokens into it, where nobody could
  see or reach them. Each now does what the playmat plan says:
  - **Right-clicking a Token on the mat sends it to the Vault.**
  - **The Vault's right-click, and the inspection panel's button (now "Place on Mat"), put the
    Token on the mat beside the Guild Hall.** No room there? It stays in the Vault.
  - **Dropping a copy on a matching Token to restock it**, when the leftover has nowhere to stand,
    sends the leftover back where it came from.
  - **Picking up a loose Token goes straight to the Vault.**
  - The QA panel's fill button fills the Vault.
- **Map bursts push their neighbours aside properly.** Tokens from a Map land on the mat and shove
  crowding Tokens outward — never into a spot a "Cannot" rule forbids, and never the Guild Hall a
  burst comes out of. If a push can't be done, the Token lands in the nearest free space instead;
  with no room anywhere it drops to the floor as loot rather than being lost. (The pushing that
  arrived with this work never actually succeeded — every burst fell back to "nearest free space".)
- **The Vault is open from the start** (FP-62). It used to wait for the tutorial step "Place a
  Dropped Token", which can no longer happen now that Map Tokens land on the mat.
- **Tutorial 5 is now "Move a New Token"** — drag one of the Tokens your Map just produced. Saves
  already on the old step pick up the new one when loaded.
- **"Requires an nearby Pickaxe" reads "Requires a nearby Pickaxe"** again, and the CMS writes
  "nearby" too — its description writer still said "adjacent", so the next Sync to Game would
  have put the old word back in every Token's description.
- **The Scouting Flags upgrade takes effect at once**: flags re-check for work and the reach ring
  redraws the moment a rank is bought, and the bonus is part of the save.
- **Free Playmat (Slice 1.10):** Renamed "adjacent" to "nearby" throughout the game interface and rules to match the new playmat mechanics.
- **Free Playmat (Slice 1.11):** Finalized tuning defaults and bumped versions for the v0.8.0 release.

- **The playmat can change size while you play** (Free Playmat slice 1.6d, third part). The
  developer Mat Tuner has a new **Mat size** slider — 6 to 20 steps, shipping at 11, which is
  exactly the mat you have now (1760 × 1126). The mat keeps its shape as it grows and shrinks.
  What happens when you move it:
  - **Growing the mat moves nothing.** Everything stays exactly where you put it, with more
    bare mat around it.
  - **Shrinking it pulls stranded Tokens back inside**, and spaces them apart from their new
    neighbours by the same rule a hand-placed Token follows — so they come back in tidy rather
    than in a heap on the edge.
  - **Flags are pulled in but never shuffled sideways**, so a hero keeps working what they were
    working. A spot a Manager owes a Token is pulled in too.
  - **Nothing is ever lost.** A Token with nowhere clear to go stays on the mat, visible,
    overlapping a neighbour, and you are told how many ended up crowded.
  - **New games now stand the Guild Hall in the middle of the mat.** It used to start half a
    step down and to the right of centre — a leftover from the old grid, which had no true
    middle square. Existing saves are untouched; only a brand-new game looks different.

- **The old grid is gone from the code** (Free Playmat slice 1.6d, second part). Nothing looks or
  behaves differently — this slice only deletes things. Underneath the playmat the game still kept a
  hidden grid of 36 numbered squares, and a lot of the engine still asked its questions in terms of
  it: which square is this Token on, which squares are empty, who is working square 14. All of that
  has been deleted. A Token is now known only by its own identity and by where it stands on the mat,
  which is how the playmat has actually worked since the previous slice. The Guild Hall upgrade board
  is a separate diagram, still has its own squares, and is untouched.

- **Tokens now sit anywhere on the playmat** (Free Playmat slice 1.6d, first part). The board
  has no squares left: a Token stays exactly where you let go of it, and you can group things
  as closely or as loosely as you like. What you might notice:
  - **A Token lands where you drop it.** No more jumping to the nearest square — two Tokens can
    sit almost touching (about a third of the old square's spacing apart).
  - **A drop with no room shuffles aside** to the nearest free spot instead of shoving whatever
    was already there. **Nothing on the board is ever rearranged behind your back any more** —
    dropping a Token onto another no longer pushes it away or bumps it to the Tray.
  - **A drop with nowhere at all to go flies back** to where it came from with a short note.
    Nothing is ever lost.
  - **A drop that would break a "Cannot" rule slides to the nearest spot that obeys it**, and
    only flies back if there is no such spot nearby — it tells you which rule refused it.
  - **Dropping a Token on a matching copy still restocks it**, and any charges left over stay
    on the board right beside the copy rather than going to the Tray.
  - **The practice outline is gone.** The mat is now a plain darker surface with a soft rounded
    edge — a placeholder until it gets its proper artwork.
  - **The Tray's mini board is now a small picture of the whole mat**, so placing a Token while
    a drawer covers the board puts it exactly where you point, just as on the real board.
  - **The drag preview ring shows where the Token will really land**, including the shuffle, and
    disappears when there is no room.
  - **A Manager restocking a spot you have since built on** now puts the Token beside it rather
    than on top.
  - New developer Mat Tuner sliders: **Token hitbox**, **Overlap allowed** and **Nudge reach**,
    which change how close the next drop can land.

- **The playmat now draws everything where it actually stands** (Free Playmat slice 1.6c,
  second part). The board is no longer a grid of squares on screen: each Token, hero and flag
  is drawn at its own place on the mat. Dropping, working, fighting and restocking all behave
  exactly as before — only the drawing has changed. What you might notice:
  - **Flags stand exactly where you drop them, and several can share a spot.** They used to
    shuffle sideways in threes, with a "+2" chip hiding the rest; now they simply overlap.
  - **A faint outline shows where Tokens can still land**, on a slightly darker mat. Temporary,
    until Tokens can sit anywhere.
  - **Hovering picks the Token you are really pointing at** — the round art rather than an
    invisible square around it — so two Tokens close together no longer steal each other's
    hover, and the one you point at comes to the front.
  - **A Token's sheet follows it** when it is pushed aside or moved somewhere else.
  - **A spot waiting for a restock shows a grey ghost** of the Token it is owed, with its red
    Restock bar, instead of an empty square.
  - **News about a Token that has just gone** — it ran dry, or a drop was refused — now appears
    at the spot it stood on.
  - Under the hood, the board wakes only the Token a message is about, instead of every Token
    on the mat checking every message.

- **The playmat is now a bigger mat, with today's board sitting in its middle** (Free Playmat
  slice 1.6c, first part). Everything still looks and plays like the 6×6 board, drawn in the
  centre of a wider mat, and every drop on the board now lands at the point you let go. What
  you might notice:
  - **A flag stands exactly where you drop it** — from the Dock, or dragging a flag or a hero
    already on the board — instead of jumping to the middle of a square.
  - **A Token dropped well outside the board area flies back** with a short note, "Place inside
    the play area for now." This is temporary, until Tokens can sit anywhere.
  - **Loot sparkles and Map bursts start from the right spot on smaller windows.** They used to
    start further from their Token the more the board was shrunk to fit.
  - **A Map that cannot be put on a square goes back where it lay**, not to the top-left corner.

- **Fights, promotions, rules, spawned Tokens and the board's messages now follow each
  Token itself, not the square it sits on** (Free Playmat slice 1.6b, second half). This
  finishes moving the game's rules off squares — the next step towards placing Tokens
  anywhere. The board still looks and plays as before. What you might notice:
  - **A monster you move in the middle of a fight keeps its injuries**, and a promotion
    offer stays with its training Token wherever you put it — both now simply belong to
    the Token.
  - **Loot from a Map that has nowhere else to come from now flies out of the Guild Hall.**
    It used to come from a square in the bottom-right corner, a leftover from the old
    7×7 board.
  - **A "Converts" rule with several matching destinations now picks the nearest one**,
    and only on a tie the one put on the board first.
  - **"Spawns on the nearest free tile" now measures straight-line distance**, so a free
    square directly beside the Token wins over a diagonal one; **"Spawns on a random free
    tile" now prefers roomier spots** over ones crowded by neighbours.

- **The game's "what is near this Token?" rules no longer think in squares** (Free Playmat
  slice 1.6b, first half). Buffs, tools and context beside a station, tool wear, Managers,
  neighbour triggers, "Cannot" placement rules and the way a flag picks its hero's job now
  all look at each Token itself and its position on the board, instead of the square it
  sits on — the next step towards placing Tokens anywhere. The board still looks and plays
  as before, with one small difference: **when two choices are exactly tied** — two
  Managers equally close to an empty spot, two equally near jobs for a flag, or a
  conversion with two matching destinations — **the one put on the board first now wins**,
  where before the one on the lower-numbered square did.

- **The save format has changed, and new games start with the Guild Hall already on the
  board** (Free Playmat slice 1.6a). Behind the scenes the board now remembers each Token
  by where it sits rather than by which square it is on — the groundwork for placing
  Tokens anywhere. **Saves from earlier versions will not load**; start a new game. A new
  game now opens with the Guild Hall standing on the board and an empty Tray, instead of
  the Hall waiting in the Tray. Everything else plays exactly as before.

- **Flags you move, in each hero's own colour, with a rules panel** (Free Playmat slice
  1.5b, second half — still on today's grid).
  - **You never move a hero, only their flag.** Dragging a hero on the board now picks up
    their flag: drop it on another tile and the flag moves there, and the hero goes
    straight to the best job near it (they appear at it; walking comes later). The hero
    stays where they are while you carry the flag. Dragging a hero out of the Dock still
    sends them out, and dropping a flag (or a board hero) on the Dock still calls them home.
    Right-click a hero to call them home and left-click for their sheet, as before.
  - **Flags use the new flag art**, drawn at the same 128 px size as heroes. The flag stands
    at the bottom-left corner of its tile, with the cloth over the left of the Token so the
    charges number stays readable. Clicking an empty part of the flag picture reaches the
    Token underneath.
  - **Every hero has their own flag colour**, given the first time they plant a flag (a
    colour nobody else has, while there are colours left) and kept for good — reordering the
    Dock does not change it, and it is saved. Change it in the **Edit Hero** window, which
    now shows the eight flags to choose from.
  - **A small gear on the flag opens that hero's rules** in a narrow panel over the
    Notifications column, so the board stays in view. It appears while you hover the flag or
    its hero. Each skill (and Fight, for heroes who can fight) has an **Allowed** tick box
    and a priority from **1 (most wanted) to 5**; the job the hero is doing now is
    highlighted, and **Reset to defaults** puts everything back to allowed, priority 3. The
    panel also shows what the hero is doing and why their flag skipped nearby Tokens. Rules
    are the hero's, so the panel keeps working after they are called home ("In the Guild").
  - **An idle hero stands beside their flag** at full size, with a "…" on the pole; the
    flag keeps its colour.
  - **Several flags on one tile** spread out to the right, earlier flags in front; past
    three, a "+N" badge counts the rest.

- **Heroes work anything they can near their flag, by their own rules** (Free Playmat slice
  1.5b, first half — the engine; the rules panel, flag sprites and new dragging come next).
  - **A flag no longer has a skill.** A hero now works any Token near their flag that uses a
    skill they have, and fights any enemy near it if they can fight. The skill drawn on the
    pennant and the skill menu you got by clicking the pennant are gone; the pennant's
    hover note now starts with just the hero's name.
  - **Each hero has rules**: every skill (and Fight) can be switched on or off, and given a
    priority from 1 (most wanted) to 5. Everything starts switched on at priority 3. A hero
    takes the nearest job of their best priority that can actually run, and only drops to
    the next priority if none can. Rules belong to the hero, so they survive calling the
    hero home, a defeat and saving. Until the rules panel arrives they can only be changed
    from the browser console (`Game.Flags.setRule(heroId, 'logging', { priority: 1 })`).
  - **Fighting is on by default.** A hero who can fight will fight enemies near their flag
    when that is their best job.
  - **A hero finishes what they are doing first.** If better-priority work appears, they
    complete their current cycle (or win their current fight) and then switch, so nothing
    is lost. Switching a skill off sends the hero away from it straight away.
  - A Token skipped because the hero's rules switch it off says so on hover ("off in
    Aria's rules").
  - ⚠️ **Both reaches are now much shorter: 164 instead of 400 (flags) and 272 (Near).**
    A flag now reaches only the tile it stands on and the four tiles beside it — not the
    diagonals. Everything that works "next to" something shrinks the same way: buffs,
    tools and other Tokens a station needs beside it, Managers restocking, "when a
    neighbour…" triggers and "Cannot" counts all reach only the four side neighbours.
    **Big 2×2 Tokens reach nothing and nothing reaches them** until reach upgrades exist.
    Both reaches will be upgradeable later.
  - ⚠️ If you have ever moved a slider in the **Mat Tuner**, your computer remembers the
    old values: open the Mat Tuner and press **Reset** to get the new ones.
  - Old saves load normally; the skill each flag used to have is simply forgotten.

- **Flags you can see and handle** (Free Playmat slice 1.5, still on today's grid). Every
  choice here is provisional and cheap to change once you have seen it.
  - **A small gold pennant marks each hero's flag**, in the top-left corner of the tile it
    stands on, with the flag's skill drawn on it (crossed swords for a fighting flag).
    Several flags on one tile fan out side by side.
  - **Drag a hero** (from the dock, or off the board) onto any tile to plant their flag
    there. **Drag the pennant** to move just the flag. Drop either one on the hero dock to
    call the hero home. Right-clicking a hero still calls them home too. Heroes and flags
    can now be dropped on any Token, including ones nobody works.
  - **Click the pennant** to pick the skill the flag works: the hero's own skills with
    their levels, plus **Fight** if the hero has a fighting skill. Changing it counts as
    re-planting: the hero drops what they were doing and picks again.
  - **Hover the pennant** to see the flag's reach as a faint dashed gold circle, and a note
    saying what the hero is doing ("Working: Oak Forest", "Waiting for restock: Copper
    Vein" or "Nothing to do") plus up to five Tokens the flag passed over and why ("Iron
    Forge — needs materials"). The circle also shows while you drag the hero or flag, and
    while the hero's panel is open. Hovering a Token lists the flags that passed it over.
  - **An idle hero is quieter.** The bright yellow idle glow is gone. A hero with nothing
    to do is drawn small beside a grey pennant with a "…" mark. A hero stuck on a Token
    shows only that Token's red badge, as before.
  - **"Heroes may work this"** is a new checkbox in a board Token's panel (for Tokens a
    hero could work: resources, stations, enemies, Academies). Untick it and any hero
    working it leaves; the Token shows a dim ⊘ in its corner. A Token restocked by a
    Manager arrives allowed again.
  - **The dock tab says what each hero is doing:** "Working: Oak Forest", "Waiting",
    "Idle at flag" or "Idle in Guild".
  - The "deploy a hero" quest now counts every flag planted, including on empty ground.

- **Fighting, promotion and "don't work this" under flags** (Free Playmat slice 1.4c).
  - **Fighters find their own enemies.** A hero with a fighting flag now fights the
    nearest enemy within the flag's reach, then the next one when that one is cleared
    out, instead of only the enemy right under the flag. They stay with their enemy
    through the short rest after each kill. A cleared-out enemy camp that a Manager can
    restock from the Vault is waited for, just like a spent Forest.
  - **A hero with no fighting skill ignores enemies.** They no longer stand on an enemy
    doing nothing under a red mark; the enemy just isn't picked (the reason will show on
    hover once flags get their own display).
  - **Moving an enemy mid-fight keeps its wounds.** Drag it, or shove it aside with
    another Token, and the fight carries on where it was.
  - **Recalling a hero, or moving their flag off the enemy, ends the fight at once**, and
    the enemy is back to full health next time.
  - **One message when a hero is defeated**, saying who fell and what was lost (for
    example "Aria was defeated and carried home, injured. Lost: Iron Sword."), instead of
    separate "wounded" and "destroyed" pop-ups. Their flag still comes down.
  - **A "not yet" on a promotion stays a "not yet."** The Academy no longer asks again
    just because the hero briefly stopped working it. It asks again when you drop a
    hero onto it (the same hero or a different one). After accepting, the hero goes back
    to ordinary work instead of standing on the Academy, and doesn't wait around for a
    replacement Academy they have no use for.
  - **Any Token can be marked "heroes may not work this"** (no button yet; developers can
    use `Game.Flags.setDisallowed(tile, true)` in the console). A hero working it leaves
    at once and its progress resets. Everything else about the Token keeps working: its
    bonuses, its triggers, and Manager restocking. The mark is saved with the game, and is
    dropped if the Token goes into the Vault.

- **Heroes now hold flags and pick their own work** (Free Playmat slice 1.4b). Dropping a
  hero on the board plants their flag there. The flag works one skill and looks within a
  radius (400 by default, adjustable as "Flag radius" in the developer Mat Tuner), and the
  hero works the **nearest Token they can run**. Dropping a hero on a Token still works it
  when they can: it is the nearest thing to the flag. On a Token whose skill the hero
  doesn't have, the flag keeps the hero's own skill and they work something else nearby.
  What changed in play:
  - **One hero per Token, and nobody gets pushed any more.** A second hero dropped on a
    worked Token looks for other work instead of shoving the first hero aside.
  - **A hero sticks with their Token.** Once working, they stay until it stops being
    workable, you move their flag, or you recall them.
  - **Moving a Token carries its hero, and its progress is kept** — even if you move it
    out of the flag's reach. Anything that makes a hero leave a Token (moving on,
    re-planting, recall) resets that Token's progress, as before.
  - **Tokens with no skill are no longer worked.** The 17 bushes, fruit trees and other
    Tokens the content check lists won't be worked until their skill is chosen in the
    CMS. Enemies, Promotion Tokens and the Guild Hall are exempt; the Hall is worked only
    when a flag is planted on it.
  - **Skipped Tokens:** a hero passes over a Token they can't run and tries the next. If a
    Token is stuck for a reason you can fix (missing materials, too few charges, a missing
    Token beside it), it keeps its red mark, and you get **one** message when a hero goes
    elsewhere because of it. A hero already working a Token that runs short stays put
    until something else nearby can run. "Skill too low" shows no red mark.
  - **Waiting for restocks:** when a hero's Token runs dry and a Manager nearby will
    restock it from a copy in the Vault, the hero waits on the spot and carries on with the
    new Token. With no Manager or no copy, they move on.
  - **Saves convert automatically:** heroes in an existing save get a flag where they
    stood. Enemies get a fighting flag; a hero who was on bare ground gets their best
    work skill at the first tick.
  - **Fights are unchanged for now:** a fighting flag only fights the enemy it was dropped
    on, and recall and defeat take the flag down. Flags aren't drawn on the board yet (a
    later slice); one hero is shown per tile and the dock shows the rest.
  - Also fixed along the way: dragging a hero from the board onto the dock now recalls
    them (that drop was silently doing nothing).

- **"Applies" now has one way to aim at the enemy** (Effects Grammar V10b). The old
  "on an item, lands on the enemy" setting is gone; "aims at: the enemy" (from V10a) is
  the only way. Anything still saved the old way is converted automatically when the
  game or the CMS loads it, so a Sync can't bring it back. No shipped content used the
  old setting. The rules text is fixed too: an item rule that poisoned the enemy used
  to read as if it hit "heroes on adjacent Tokens"; it now says "to the enemy". The
  content check now warns about any leftover old setting, and about an "Applies" aimed
  at the enemy that also has a filter or reach (which the enemy aim ignores).

- **Rules can now aim at "the enemy"** (Effects Grammar V10a). On a combat moment ("On
  Neighbour's Fight", "On Engaged") a rule's *deals damage*, *heals*, *removes* and
  *applies* can target the creature the hero is fighting; on a monster's own rule, "the
  enemy" is that monster. *Restores* and *Transforms* can't aim there, and outside a fight
  the choice isn't offered. **Items' damage, heal and cleanse rules now actually work** —
  before this they were silently skipped — and like other item rules they use up the item
  only when they do something. The enemy is found by which hero is fighting, never by
  which square they're standing on. **A hero now fights one enemy at a time**: starting a
  new fight ends any other fight that hero was in.

- **Behind-the-scenes groundwork for flags: one place now answers "which hero is on
  this Token"** (Free Playmat slice 1.4a). Damage, statuses, rules, hero gear, filters,
  the board, the hero dock and drag-and-drop all used to look up hero positions on
  their own; they now all ask the board the same three questions (who works this Token,
  which Token does this hero work, where to draw this hero). *Nothing plays
  differently.* This is what lets the next slice swap standing-on-a-tile for flags in
  one place. The hero dock tab was also listening for two event names nothing ever
  sent; it now listens for the real "hero moved" event (it was already refreshing
  through the general state update, so this is a tidy-up, not a visible fix).

- **Crafting, tool wear, Managers, neighbour triggers and "Cannot" now reach the same
  way buffs do** (Free Playmat slice 1.3, FP-41). Every "beside" question in the game —
  whether a station has its tool, which stations a tool wears for, which Manager restocks
  a spent Token, which Tokens hear "On Neighbour's …", and how many Coasts a Coast counts
  — now uses the same **Near** distance as buffs. For ordinary 1×1 Tokens *nothing plays
  differently*. **Large (2×2) Tokens now reach the same way for crafting, Managers,
  triggers and Cannot as they already did for buffs**: the 8 tiles touching their sides,
  not the 4 touching only a corner. Two small changes come with it: where two Managers
  could restock the same spot, the **nearest** one does it (then the lower tile number),
  which only changes whose name is on the "Restocked from" message; and raising Near in
  the Mat Tuner now widens tool service, Manager reach, triggers and Cannot counts too.
  Tool wear is still one charge per station served per cycle, and Managers still restock
  in the exact spot.

- **Fix: board-wide buffs now update everywhere at once.** A rule that reaches "every
  Token on the board" used to refresh only the Tokens near where something changed, so
  far-away Tokens could keep a buff from a Token that had left (or miss one from a Token
  that had just arrived) until the game reloaded. Any change now refreshes the whole board
  while such a rule is present.

- **"Adjacent" is now measured as a distance** (Free Playmat slice 1.2, FP-41/FP-56). Buffs,
  item grants, statuses, damage and "per adjacent" counts now reach every Token whose
  centre is within **Near** (272 units — a tile step is 160) instead of looking up the 8
  surrounding tiles. For ordinary 1×1 Tokens *nothing plays differently*: 272 reproduces
  the same ring exactly. ⚠️ **Large (2×2) Tokens reach less**: measured from their middle
  they reach the 8 tiles touching their sides but no longer the 4 touching only their
  corners, and Tokens beside them measure to their middle too. Two large Tokens side by
  side no longer reach each other. Crafting, tool wear, Managers, neighbour triggers and
  "Cannot" rules still use the old 8 tiles until slice 1.3, so for a large Token those
  can briefly disagree with its buffs. Rule wording still says "adjacent" (slice 1.10).

- **Dev tool: Mat Tuner** (FP-66) — a new developer-only panel (the **TUNER** button beside
  the QA tester, dev builds only) for the free playmat's numbers. Its first setting is
  **Near radius**: drag it and buff reach changes live; the reset button restores 272.
  Like the Playmat Tuner it remembers your setting on this device only — it is never in a
  save — but unlike that panel, this one changes how the game plays while it's moved.

- **Terrain is switched off** (Free Playmat slice 1.1, FP-10). Placing a Token no longer
  paints the ground, bursting a Map no longer stamps its terrain on what comes out, and
  the painted landscape under the board is gone — every tile shows its plain faint
  outline on the table, as a new game always started. The **Playmat Tuner** dev panel,
  which only tuned terrain, is hidden with it. *Nothing is deleted*: the terrain code
  sleeps behind one switch (`TERRAIN_ENABLED` in `terrainRegistry.js`), and saves keep
  any terrain they already hold. The free playmat has no tiles to paint, so terrain
  had to go before free placement; it may come back in a form that suits a free mat.

- **Dev tool: Sprite Animation Studio** — a developer-only viewer for hero animation
  sheets (idle / walk / active rows): playback, frame-by-frame scrubbing, alignment
  guides and onion skinning. Open it from the QA tester panel or with **Shift+A**; like
  the rest of that panel it only appears in development builds.

- **Tokens with no skill are now flagged** (Free Playmat slice 1.0, FP-47). On the free
  playmat a Token a hero works must name a skill or it won't be workable, and 17 Tokens
  (the fruit bushes and trees, the grapevine, the wheat field, the watermelon patch and
  the adamantine ore vein) have none today. They're named in the game's content check at
  startup, on the CMS **Economy Audit** tab after a Recalculate, and at the top of the
  Token's editor. Enemies and Promotion Tokens don't need one. *Nothing plays differently
  yet* — pick each Token's skill under **Work Cycle → Skill**, then Recalculate and Sync.

- **Fixed: Token descriptions said every rule twice** — "Works as a Smithing station.
  Works as a Smithing station." It affected 24 Tokens, every one that uses a library
  effect. The CMS's Recalculate added a Token's library rules a second time before
  writing its description. ⚠️ *The saved descriptions in the game files are still
  doubled until you run **Recalculate** and then **Sync to Game** in the CMS* — the
  descriptions are written by the CMS, not by hand.

- ⭐ **Promotion is playable end to end.** When a hero finishes training on a Token with a
  Promotes rule, a window asks "Wren has finished training. Make it official?", showing
  the old job, the new one, and which skills are set aside and taken up. **Become
  Wizard** promotes and spends the Token's charge; **Not yet** spends nothing, leaves the
  hero where they are, and doesn't ask again until the hero is moved off and back on.
- **An unanswered offer survives saving and reloading.** Load a game where a hero was
  waiting to be asked and the window opens again. An offer you said "Not yet" to stays
  quiet.
- **The Change Job screen shows the same skill trade** as the promotion window, so the
  two always agree.

- ⭐ **Heroes train on Tokens with a Promotes rule.** Stand a qualified hero on Wizard
  Academy or Fighter's Academy and they train for a cycle (30 seconds unless the Token
  sets its own time). When it finishes, the game offers the job. Nothing about the hero
  changes until the offer is accepted.
- **The Token is the price.** Accepting spends the rule's charge cost — one charge
  unless you change it in the rule's cost line (0 makes an academy that never wears
  out). A Token that can't pay won't start training and shows the charges warning, and
  a hero who doesn't meet the skill requirement won't start either.
- **Promotion no longer costs gold or materials**, and the **Change Job screen now only
  plans**: it still shows every job and what each would cost the hero in skills, and
  tells you to promote on the board. It can no longer change a hero's job itself.
- ⚠️ *Not yet playable end to end:* the window that asks "become a Fighter?" arrives in
  the next phase. Until then a hero who finishes training waits on the Token.
- **Two re-training tests switched back on.** They had been skipped on a note claiming
  advanced promotion didn't work; it always did.

- ⭐ **Wizard Academy and Fighter's Academy now carry Promotes rules.** They were
  authored with an older "promotion" setting that the game never read. Each now has
  a library effect, *Wizard Training* and *Fighter Training*, reading "Promotes the
  hero to Wizard." and "…to Fighter." Nothing you authored was lost. *Still no
  training happens on the board — that is the next phase.*
- ⚠️ **Reload the CMS before your next Sync to Game.** A CMS page opened before this
  change still holds the old setting. Reloading converts it the same way; syncing
  without reloading would write the old setting back.

- ⭐ **New rule: "Promotes the hero to Knight."** A Token can now carry a rule naming
  the job it trains heroes into. Click the job to pick any job a hero can be
  promoted to. It's offered only on Tokens: an item's New rule menu leaves it out,
  and an item given one anyway says it does nothing there. A Token carrying it is
  now its own "promotion" type. *The rule doesn't train anyone yet — that arrives
  with the engine in a later phase.*

- ⭐ **Tokens and items edit their own rules in place.** On a Token or item, an effect
  only it uses now shows the same clickable sentence and cost line as the effects
  library, so you can change it without leaving the Token. An effect shared with
  other Tokens or items still shows as plain text with "shared" and an Edit button,
  so you can't change the others by accident. One help panel appears beside
  whichever rule you're editing.
- **Requirements read as sentences.** "Requires an adjacent Tier 1 net." is now
  edited by clicking "1" or "net", with "Satisfied by" still shown underneath. The
  old Capability and Min Tool Tier boxes are gone.
- **The duplicate "Rules Text" section is gone** from the Token and Item editors. It
  printed the same sentences a second time.
- **Fixed: a shared effect that applies another effect showed that effect's internal
  id** instead of its name on the Token and Item editors.

- ⭐ **A rule's cost now reads beside its sentence.** Under each rule, one quiet line
  says what the rule's rules text doesn't: "spends 1 charge each time it fires ·
  no cooldown · consumes 1 Coal every 30 seconds". Click any underlined part to
  change it in the panel. This replaces the separate "Charge cost" and "Costing"
  boxes. A cooldown moves into the sentence itself once it has one, so it's never
  shown in two places.
- **Fixed: retyping a cooldown used the wrong unit.** The sentence shows seconds, but
  typing a new number stored milliseconds, so "10" became a hundredth of a second
  and the rule read "every 0 seconds". It now takes seconds.
- **A charge cost reads the way you'd say it.** You type how many charges a rule
  spends (1, not −1), and a minus sign gives charges back.

- ⭐ **The old forms under each rule are gone.** Every rule in the effects editor is now
  just its sentence: what an item grants and how often, which skill a station works,
  a tool’s tier, a Manager’s Tokens, a limit, a chance — all edited by clicking the
  word in the sentence, or from the small row of extra choices underneath it. The one
  exception is a conversion, which keeps its two item lists as a table. Picking an
  item from a search can still create a new one when it doesn’t exist yet.
- **“Applies” now offers your library effects only.** The old statuses are no longer
  offered for new rules. A rule that still names a status keeps working, and clicking
  it lets you swap in an effect.
- **Scoping a bonus to a skill works from the sentence.** “…but only for Mining work”
  could previously only be set through the old form.

- ⭐ **The rules editor's help panel sits on the left and follows you.** One panel
  now serves every rule in an effect, stays in view as you scroll, and shows
  what can go in whichever word you're on. On a narrow screen it moves above the
  rules instead of overlapping them.
- ⭐ **Rules can be edited from the keyboard.** Tab jumps to the next underlined
  word and opens it; Shift+Tab goes back. Anything valid you typed is kept on the
  way; anything that isn't a real word is simply dropped. The Up and Down arrows
  move through the panel's list, and Enter takes the highlighted option.
- **Blanks open a search.** Clicking a "…" asks you to pick, and long lists — like
  every item in the game — show 30 at a time with a count, narrowing as you type.

- ⭐ **Rules are edited by retyping their words.** In the effects editor a rule
  is now one line — the exact sentence the game prints — and every word that
  stands for a decision can be clicked. Click the "2" in "deals 2 damage", type
  5, press Enter, and only that word changes. A word the game doesn't know
  changes nothing and offers the closest real words instead. A number keeps its
  direction when retyped, so "work 5% faster" stays faster unless you type a
  minus or plus sign. Decisions the sentence doesn't mention yet, like "ignores
  armour", sit in a small row underneath, and the two extra copies of the
  sentence the old editor showed are gone.

- ⭐ **A rule now opens with a short tag instead of a sentence.** "On Cycle:
  deals 2 damage to the hero" rather than "When this Token's own cycle
  completes, …". All twelve moments read this way — On Cycle, On Start, On
  Depleted, On Engaged, On Tick, and the neighbour equivalents — so a rule's
  opening stops eating half the line.

- **Rules text reads like English, not like the engine.** A Token that works
  faster now says so — "Makes adjacent Coast Tokens work 5% faster" rather than
  "Provides 5% less work time". Upkeep is its own line and says "consumes"
  rather than "costing", and no label shouts in capitals any more.
- ⚠️ **Three rules were describing themselves backwards.** A rule that *reduced*
  a Token's failure chance read as one that *caused* it, and removing a
  double-loot bonus read exactly like granting one — the minus sign was being
  thrown away before the sentence was written. A bonus-drop rule also refused to
  say which item it dropped, though it always dropped the right one.

- ⭐ **Monsters can carry effects too, not just suffer them.** A monster can be
  poisoned, or be given armour that lasts a while, using the same named effects
  everything else uses. Effects on a monster last as long as the fight — walk
  away and it is whole again. Damage from a rule now respects a monster's
  armour, and "ignores armour" works on that side too.
- ⭐ **"Leave a Stump behind when this depletes" can now be written.** A Token
  can react to spending its own last charge — the square is already free by
  then, so something else can take its place. Rules on that moment cost nothing,
  because the Token has already spent everything it had.
- **Rules text uses the game's words.** "The actor" is now **the hero**, "this
  entity" is **itself**, and "the entity that caused this" is **that Token**.
  Nothing about what the rules do changed — only what they call things.

- ⭐ **Every status is now authorable as an ordinary effect.** Poison, Burning,
  Bleed, Armor Shield, Well Fed, Cookout and Stun can all be written in the
  effects editor like anything else — three as damage on a clock, four as a
  bonus that lasts a while. The four that last needed something new: an effect
  you are carrying can now change your numbers, not just hurt you.
- **A damage bonus can be a percentage**, so "+10% damage for a while" is
  something you can write down rather than something only code could do.
- ⭐ **Tokens can leave things behind, and become other things.** A felled tree
  can leave a Stump, a watered Sapling can become an Oak. Where a spawned Token
  lands is something you pick — this tile, the nearest free one, or a random one
  — and the rules text says which, so it is never a hidden rule.
- **Rules can heal, repair and cleanse.** A spring that mends whoever works it, a
  Token that gives itself charges back, a shrine that lifts a curse — all
  authorable, all with the same targeting as everything else. A heal never
  overheals and a repair never pushes a Token past what it was built to hold.
- ⭐ **Effects can stay on a hero and keep acting.** A poison, a regeneration, a
  buff that lasts half a minute — all authored as ordinary named effects with a
  clock on them, rather than as a separate kind of thing. Applying the same one
  twice refreshes it rather than stacking, and a stronger version replaces a
  weaker one.
- ⭐ **One effect can set off another.** Give it no duration and it fires
  immediately, which is how a combo is built.
- **A rule can check what a hero is already under** — "every adjacent Token whose
  hero is not already poisoned".
- ⭐ **A rule's number can be worked out rather than typed.** Damage equal to 10%
  of the target's maximum health, or one point per adjacent Coast Token — so an
  effect can stay meaningful as heroes grow, or reward how you have arranged the
  board.
- ⭐ **Rules can be narrowed, and stacked.** A rule can now say *which* of the
  things in range it actually hits: tagged something, working as a station,
  running low on charges, or currently being worked — as many as you like, and
  any of them can be flipped to mean the opposite.
- **Rules can now react to a Token's live state**, not just to what it is. A
  buff that only helps Tokens somebody is actually working is authorable.
- ⭐ **Rules are written as sentences now, not clicked through dropdowns.** A rule
  is a row of words you type into: click any part, start typing, and only what
  fits there is offered. Beneath it sits the sentence the rule will actually
  read as. The nested picker boxes are gone.
- **A panel under the rule lists everything that can go where you are.** With its
  explanation, so the parts of the vocabulary you have not used yet are
  discoverable rather than hidden behind knowing what to type.
- **Changing a rule's verb rebuilds it properly**, instead of leaving the
  previous verb's settings stranded behind the new word.
- ⭐ **Rules can now hurt somebody — and Thorns exists.** A rule can deal damage
  to whoever just harvested or fought the thing carrying it. Author it once, name
  it Thorns, and put it on a monster *and* on a berry bush: the same entry works
  on both, because winning a fight and finishing a harvest have always been the
  same event underneath.
- **Thorns damage respects armour, and heavy armour can stop it outright.** Tick
  "ignores armour" for a rule that should pierce regardless.
- **A rule's price is set where you assign it.** The same effect can be free on
  one Token and cost a charge on another.
- **The editor stops offering targets a rule cannot reach.** Pick "when a
  neighbour runs out of charges" and "the actor" is simply not in the list —
  nobody acted, a Token ran dry. If a rule is already aiming somewhere
  impossible, it says so.
- **The rules text stopped shouting your proper nouns down.** It read "this
  token's own cycle" and "the bank"; Token and Bank keep their capitals now.
- **Rules can tell who did something to them.** Groundwork, invisible on its own:
  every firing moment now says which participants it has — the entity itself, the
  hero who caused it, the neighbour it happened to — so a rule will shortly be
  able to say "whoever just harvested me". Two moments were quietly missing that
  information and now carry it: a Token beginning a cycle, and a fight ending.
- **Gear can make a hero immune to a status.** Poison, Burning, Stun and the rest
  can be blocked outright by an item — the game has asked whether a hero is
  immune every time a status landed, since the day statuses were built, and
  nothing could ever say yes. Pick which status; it stops new stacks landing and
  never strips ones already carried.
- **A rule can apply to one skill only.** "+10% yield, but only for Mining work"
  — the machinery has been running on every cycle for months with no way to write
  it down.
- **The editor stops offering settings a rule cannot use.** A combat or immunity
  rule reaches a hero, never a tile, so it no longer shows a reach or a target to
  set.
- **A rule can now say how far it reaches — including "just me".** Every rule in
  the game reached the eight surrounding tiles and nothing else, and never the
  Token carrying it, so a Token could not improve its own work or put a status on
  the hero standing on it. A rule now picks one of four: adjacent Tokens (what
  every rule already meant), this Token only, this Token and its neighbours, or
  every Token on the board. The rules text says which, in words.
- ⚠️ **A board-wide rule is not capped.** It touches everything you own, and a
  second copy of that Token doubles it. The editor warns you; nothing stops you.
- **Nothing you have already authored changed.** A rule with no reach set still
  means "adjacent", so every Token on your playmat behaves exactly as it did.
- **A rule that fires now lands where its sentence says it lands.** A triggered
  "grants an item" rule was ignoring the target you gave it and dropping the
  item on the Token that fired instead — so a rule reading *"grant 1 Copper to
  any adjacent Forge"* put the copper on itself. It now reaches the Tokens it
  names, and a target that matches nothing correctly grants nothing. No shipped
  Token was affected: every authored grant is the untriggered kind, which has
  always aimed correctly.
- **A conversion can send its output to a neighbour.** A Sigil that turns Stone
  into Bricks can put them on the Kiln beside it. Unlike every other rule this
  one picks a **single** destination — the nearest match — because a conversion
  spends a fixed input, and producing onto all eight neighbours would multiply
  what you get without multiplying what you pay. Leave the target alone and the
  output lands where it always did.
- **The content check now catches a rule aimed at something it cannot aim at**,
  which is the shape of the bug above.
- **Every rule in the game now has a name.** A Token's rules used to live on the
  Token that used them, unnamed and unshareable. They now live in a **named
  effect library**, and Tokens point at entries in it — so the same rule can sit
  on two Tokens (and, later, on an item or an enemy) without being authored
  twice. Nothing about how the game plays has changed: every Token resolves to
  exactly the rules it had before.
- **The CMS has an Effects screen.** Name an effect, edit its rules once, and
  see which Tokens use it before you change it. A Token's Rules section now
  shows the effects it references, with a "shared x3" badge where an edit will
  reach further than the Token you are looking at.
- ⚠️ **Your CMS workspace migrates itself the first time you open it** after this
  change. Check that your Tokens' rules read right before syncing.
- **Gear and enemies can change combat numbers.** Armor, Resistance, Accuracy,
  Block and Damage are authorable at last — carried on an item they go to the
  hero holding it, and put on an enemy they go to the hero fighting it, so a
  creature can genuinely make its opponent softer. Nothing authored uses them
  yet, so no fight changed.
- **Enemies are a moment you can react to.** A rule can act as a fight begins —
  every fight, including each fresh enemy after a kill, not just the first. And
  a carried item can now put a status on the creature itself: a venom flask
  poisons what you are fighting.

- **Rules can react to a cycle *starting*, not just finishing.** A Token can act
  as a neighbour begins work, or as it begins its own — and a carried item can
  proc at the start of its hero's cycle, so a buff is already up while they
  work rather than arriving as they finish. A Token waiting on inputs has not
  started, and does not pretend it has.

- **Items can carry effects now.** Gear and consumables use the same named
  library Tokens use, reaching the hero holding them, the Token that hero is
  working, or the enemy they are fighting. A pickaxe can raise what a mine
  yields; a potion can put a status on its carrier.
- **A potion is spent from the Bank when it works.** An item's rule can cost
  units of that item — one potion per firing — and a rule costing nothing is
  never consumed, which is how weapons and armour are built. Run out and the
  slot greys: the item stays where you put it and starts working again when you
  restock.
- **Carrying two of the same effect stacks it, up to a limit.** A charm at II and
  a ring at III make one effect at V rather than two separate bonuses, and five
  is the ceiling however much you pile on.
- **The old gear stat system is gone.** It read damage, defense and a hidden
  effect id off items, mapped them through a hardcoded list, and wrote mostly
  into nothing — no item ever used it and the editor had no field for it.

- **Effects say their name when they fire.** When a named effect actually does
  something — a rule triggers, a bonus item drops, a status lands — its title
  flashes above the tile, rises out of its top edge and fades. Nothing to click
  and nothing to dismiss; if you miss one, the rule is still written on the
  Token. Effects that are simply always on stay quiet, because nothing happened.

- **One effect can now be strong or weak.** A Token points at a named effect and
  says how strong its version is — 1 to 5 — so the same *Shrimp Trawler* can sit
  on a Token at full strength and on a potion at triple, without a second entry
  in the library. The rules text says the scaled number, and the effect's title
  carries a numeral: *Shrimp Trawler III*.
- **Rules can cost their Token charges, and you say when.** A rule that fires
  spends when it fires, as before; a permanent one can now be made to cost a
  charge every cycle its Token completes. Setting the cost to **0** is how an
  always-on effect is authored, and everything you have already written stays at
  0 — no existing Token started wearing down.
- **The old `data/effects.json` is gone.** It held 56 placeholder effects from
  the retired card system, read by nothing since CMS-36 deleted the editor that
  wrote them. The filename now belongs to the real library.

- **The terrain blending actually draws now.** It was in the last release but
  painted nothing at all — the effect you could see was the coarser
  tile-level raggedness underneath it. Coastlines now break up at the pixel
  level as intended.
- **Bare earth wears through the grass in patches.** Irregular clumps of dirt
  scattered across meadows and forests, denser where the ground sees more use.
  Dirt is no longer a ground type of its own: farmland, hamlets and diggings are
  grass worn through heavily rather than solid earth, so a ploughed field has
  green surviving between its rows.
- **Trees grow on the grasslands.** Scattered rather than placed on a grid, and
  overlapping correctly — a tree lower on the board stands in front of one
  behind it.
- **Coasts finally have water.** The Coast and the Fishing Net lay down sea
  instead of more sand, so a shoreline has two sides to it. Every tool now
  leaves churned earth wherever it came from.
- **A playmat tuning panel** sits beside the QA tester: coastline shape, how far
  terrain bleeds between tiles, patch coverage and clump size, tree density and
  scatter, and the ground art switch. Developer tool — nothing it changes is
  saved with your game.

---

Older versions (0.7.2 and earlier) are in [`docs/archive/CHANGELOG_pre_0.8.md`](docs/archive/CHANGELOG_pre_0.8.md).
