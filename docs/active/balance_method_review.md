Status: approved 2026-11-25 (owner's rulings below; in BALANCE_RULES sections 1, 2, 7 and 8; tickets T-715, T-716, T-717)

# How we balance: a review of the method

*The owner's two concerns, 2026-11-25: (1) "our input data on what is a normal gameplay scenario may be
flawed": trees in reach of a camp, buildings, potions; (2) "we may not be fully factoring in the rewards
of working a cycle": the item can be sold, turned into a boost, or made into something else for more XP.
Two read-only agents read the CMS's simulator and ledger; the balancer checked their main claims in the
code and audited its own Dials page. Rulings go in [BALANCE_RULES.md](../reference/BALANCE_RULES.md).*

## The short answer

Both concerns are right, and there is a third one underneath them.

- **The "normal guild" is a handful of fixed numbers nobody chose**, and the biggest one, how many
  nodes a gatherer has in reach, moves a gatherer's speed by up to 20 times.
- **Nothing weighs one use of an item against another.** The ledger lets the same ore feed the smith,
  a building's price and a sale all at once, as if the guild had unlimited heroes.
- **Three tools hold three different rulebooks**, and they disagree on XP.

## 1. What "a normal guild" is today

| Assumption | The ledger (the engine's timing) | The Dials page (the rules) | How wrong it can be |
|---|---|---|---|
| **Nodes in reach** | 1 with no camp; with a camp, 3 veins or Fields, or one Forest's trees (Oak: 5) | Not counted: a hero never waits | **The largest lever.** An Oak Tree is 5 chops of 3 s, then a 5-minute stump. One tree keeps a hero busy 5 % of the time; a camp with one Forest 24 %; two Forests in reach 48 %; four or more, 100 %. That is a 20-times range, and the ledger's best case is a quarter of what a dense camp does |
| **Walking between nodes** | None | None | Small |
| **Buildings** | One of each kind, always in reach. A camp only adds nodes: its own boost (a Sawmill's double loot, a Mine Head's faster regrowth) is dropped | A budget table: 1.4x at copper to 3x at darkmetal for the optimized player, half of each boost for typical | The page assumes boosts that mostly aren't built: in the live game a typical gatherer is as fast as a maxed one from mid-game on. The ledger undercounts stacked buildings and camp variants |
| **Drinks and potions** | Typical takes any drink that gains anything, at no price beyond its ingredients; a hidden extra hero brews it | Inside the budget table; no cost | The 4x batch payback rule is checked nowhere |
| **Heroes** | No count. Every skill has its own hero, and every ingredient its own full-time gatherer | One hero per skill; one gatherer per ingredient for "guild time" | A real guild shares a few heroes among all of this, so it is slower than either tool says |
| **A typical player** | Buys what pays back within 2 hours (Hall stars within 24) | Holds half of every boost | Two different definitions |
| **Proof against the real game** | A calibration stamp from 18 Nov over nine one-hero set-ups; the rate code has changed since | None: XP is worked back from the curve, so the page is on the curve by construction | The page cannot test a scenario; only the ledger or play can |

**The rules already say what a node should be**, and the live Tokens don't follow it: the rest rule
(section 2) wants one hero on one copy busy at least 75 % of the time, which would shrink the
nodes-in-reach lever from 20 times to 1.3 times. Live Oak Trees give 5 %, live Copper Veins 20 %.

## 2. What a cycle's rewards are counted as today

A cycle pays XP and an item. The item can feed another hero's recipe (more XP, in another skill), become
a boost, pay a price, or be sold.

- **XP and worth are worked out apart.** The CMS's simulator gives each Token and recipe a purpose
  (XP-rich, item-rich or gold-rich) and trades one against the other: XP-rich work pays full XP and a
  tenth of the worth; gold-rich pays full worth and 30 % of the XP. The balance rules say the opposite:
  all work at one level pays the same XP an hour. The owner has ruled on neither as a pair.
- **An item's worth is not "the time in it"**, as the balancer told the owner in the coin interview. It
  is the work in it priced at its level's gold an hour, a curve that rises 260 times from level 1 to 99
  (1,200 to 314,000), plus at least 15 % a making step. So an hour of selling level-40 goods earns
  about 17 times an hour of selling level-1 goods. A Mythril Ingot is worth 384 against a Copper
  Ingot's 6 for that reason.
- **Worth leaves things out that take time**: a node's rest and regrowth, station charges, tools, rare
  and bonus drops. The ledger's hours include them; the two are compared only loosely (4 times off,
  for information).
- **No use competes with another.** The ledger asks "how fast can the guild get ore" once and gives
  that whole flow to every asker. Nothing is ever spent. Selling is done by a separate hero who does
  not level. So opportunity cost does not exist in the tools.
- **A chain's total XP is never added up.** Ore to ingot to dagger pays Mining, then Smithing twice;
  nothing checks what one ore is worth in XP down its chain, so deep chains can overpay unnoticed.
- **Items against XP has one hidden exchange rate**: when the ledger picks boosts, an hour of a work's
  XP counts the same as an hour of its goods. Fixed, and written nowhere the owner would see it.
- **Not enforced anywhere**: the 4x batch payback for consumables; Hall payback counted over all the
  work a star boosts (the ledger checks one work against a flat 24 hours).

## 3. Three rulebooks

| | Sets | XP an hour, level 1 to 99 | Whole skill |
|---|---|---|---|
| **The simulator** (the CMS's Recalculate) | Every item's worth, and XP unless pinned | 700 to 837,000 (7.5 % a level) | Expects 55 hours of play |
| **The ledger** | Nothing; it times what is there | Reads what is stored | The pace curve setting: 15.3 days (old 6.5 % points) |
| **The balance rules** (the Dials page) | Proposed XP, times, counts | 1,660 to 49,000 (doubling every 20 levels) | 12.6 days at 6.25 % |

Today the simulator writes the live numbers, the ledger says they are off the owner's curve (Cooking
to 99 in 3.8 days), and the balance rules describe a third set that is not in the game. A number pack
would pin XP by hand over the simulator's, and its worths would still come from the simulator's gold
curve, which no ruling of the owner's set.

## 4. What the balancer proposes

1. **A reference guild, written down and owned by the owner** (a new section of the balance rules):
   for bare, typical and optimized at each tier, how many heroes, how many nodes in reach, which
   buildings and how many, which drink. Both tools read it; no hidden constants.
2. **Bound the nodes-in-reach lever with the rest rule**: number packs bring live nodes to the rule
   (one hero on one copy busy at least 75 %), so layout can speed a gatherer up by a third, not by 20
   times. More copies then mean more heroes can work, not that one hero is suddenly 4 times faster.
3. **The ledger times a spread, not a point** (director): each skill at a sparse and a dense layout,
   with a warning where they differ by more than the tolerance; camp variants' own boosts and several
   buildings in reach counted.
4. **One rulebook**: the balance rules are the source; the simulator's XP and gold curves are set from
   them (or its XP pass retired), and the worth curve becomes a rule the owner has seen.
5. **A guild's time is spent once**: a reference roster with a stated split of its output (feeding
   crafters, boosts, prices, sold), and the ledger made to allocate a gatherer's output rather than
   hand it to everyone. Coin costs are then sized against the share that is really spare.
6. **Checks for what the rules promise**: a chain's total XP per raw unit, the 4x batch payback, Hall
   payback over all boosted work.

## Open decisions (owner)

Asked in the session of 2026-11-25; rulings recorded below as they come.

## Rulings (owner, 2026-11-25)

- **One total reward, tilted by purpose.** Every hour of work at a level is worth the same in total; a
  Token or recipe leans toward XP or toward goods. A cycle that hands over valuable goods teaches less.
  This replaces "all work at a level pays the same XP an hour" (BALANCE_RULES section 1); how far the
  tilt goes is still to set.
- **The balance rules are the one rulebook.** They set the XP curve and the worth curve; the
  simulator's curves are set from them and the ledger checks the result (a director ticket).
- **A lone hero at one node: bursts and waits**, busy about half the time. **A node is back in about 30
  seconds** ("A five minute rest for a stump is far too long, it should be much shorter than that").
  **More nodes in reach make one hero much faster**: with half the time spent waiting at one node, two
  nodes in reach keep a hero fully busy, so a camp doubles a gatherer. This replaces the rest rule's
  "busy at least 75 %".
- **A normal late guild runs a few chains at a time**: the 8 heroes (the game's limit) staff two or
  three supply chains and move between chains over days; a skill climbs only while its chain is
  staffed. Neither tool models this yet: both give every skill its own hero and free gatherers.
- **About 2 gatherers per maker at every tier**, as the rules already said.
- **The tilt is moderate**: training 1.5x the XP and half the goods, balanced both in full, earning
  half the XP and 1.5x the goods.
- **A typical player buys what pays back soon** (the ledger's definition); the Dials page's
  half-of-every-boost is a planning estimate.
- **The per-skill pace governs** (6 to 6.5 % a level). The owner's "3 to 6 months" for all 8 heroes at
  99 in all 20 skills would need a step of about 4 to 4.5 %; asked which governs, the owner kept 6 to
  6.5 %, so maxing everything is a goal of one to two years for a typical player.

## Settled after the review (owner, 2026-11-26)

- **The worth curve follows the XP rule**: worth an hour doubles every 20 levels.
- **A well-run guild is comfortable**: coins hold it up only on big buys or when it is wasteful.
- **Purpose leanings on the plan's entries** are the content session's to tag; untagged is balanced.

## The challenge round (owner interview, 2026-11-26)

*The owner asked the balancer to challenge the method: name scenarios that could break it, ask whether
each is realistic, and check whether the tools capture the realistic ones.*

| Scenario | The owner | Do the tools capture it? | What must change |
|---|---|---|---|
| **Several of the same building boost one node** | Realistic and intended. "These boosts should be designed to affect the resource node, not the camp... The game is a spatial puzzle of tradeoffs. A building takes up space, naturally limiting the number of tokens in range." | **No.** The ledger places one of each building, always in reach, and knows no layout; the page uses a fixed budget table. Today's spacing lets 30 Tokens stand in reach of one node, so a stack could run several times past "optimized" | Spacing and reach first (T-718: the owner's target is at most 12 in a radius). Then the boost budget is restated as *places in reach × a small number each*, typical and optimized differ by places filled, and the ledger times a site by its places (T-716) |
| **Heroes stall or the player is away** | A typical hero works nearly all of every day | Yes: both tools time round-the-clock work | Nothing. Stalls from short supply are the ledger's to show |
| **Who levels a skill** | Two or three heroes share each job | **Partly.** The tools time one hero's climb, which stands. Nothing says the guild climbs each skill two or three times, on low-tier work again | The reference guild says so; total-game sums use 2 to 3 climbs a skill, not 1 or 8 |
| **Early chains are understaffed** | Heroes arrive steadily, about one a tier | **No.** Both tools give every maker its gatherers from minute one. With one hero, Smithing 1 to 19 is 7.0 hours of chain work, not the page's 1.7; with two heroes at iron, 20 to 29 is 4.8 hours, not 2.1 | The page's arrivals and the ledger's stage budgets are counted with the heroes a guild has at that tier (T-716) |
| **Levels bought, not worked** (XP for Everyone) | A catch-up for new heroes: a recruit starts at about half the guild's level | **No**: the ledger does not rate it. It is small by this ruling: starting at 30 when the guild is at 60 saves 3.8 hours of work a skill, 5 % of the XP | A rule for the star's ranks (below); no change to pace |
| **Extra hands** (Summoned workers) | "Capped and balanced by charges. It costs resources to summon and the creature will only get a set number of cycles per summon... A hero might be temporarily wounded but they're never gone" | Not built yet; the ledger would list it as unmodelled | Priced like a consumable when designed: a summon's cycles must pay back its cost. Outside the roster of 8 |
| **Heroes do needed work, not the best work** | About half and half | **No**: both tools assume the best-paying work always | The curve now describes the half-and-half hero (below) |

**Rulings from the round:**

- **The pace curve describes the half-and-half hero**: one who splits time between training and
  supplying the guild, with a good set of boosts. With the moderate tilt that averages to the plain
  rate, so the figures stand; a hero who only trains is up to 1.5x faster than the curve, one who
  only supplies 2x slower.
- **XP for Everyone brings a recruit to about half the guild's level** in every skill.
- **Stacking is the game**: boosts act on nodes, buildings compete with nodes for the places in reach.
- **Spacing and reach come before boost numbers** (T-718).

**The balancer's own verdict on the method, after the round.** The per-skill pace for one hero is
sound and the owner has now said whose pace it is. Three things it rests on are not: the boost budget
(no layout, one of each), the early game (no hero count), and typical-versus-optimized (two
definitions, neither tied to places filled). None can be fixed in the rules alone: each needs the
ledger to time a real work site and a real roster, and the first needs the spacing decision.

## The follow-up interview (owner, 2026-11-26)

- **Spacing: wider, same reach** (the owner's leaning; T-718 settles it): Tokens edges touching,
  reach 240 u, 12 neighbours a node, about 8 places for buildings.
- **A site must choose**: about 4 places max one kind of boost; a perfect site cannot max all four.
- **A typical player fills most places**; players differ by which boosts they pick.
- **A station's own upgrade is a boost**, inside the tier's budget.
- **Drinks and work potions: 25 cycles, 5 a craft, twice as strong**, the extra strength taken from
  the buildings' share (speed: buildings 20 %, perks 15 %, drink 20 %, Hall 5 % at darkmetal).
- **The Starter Camp ends at level 10** (35 minutes on the curve); a skilled player leaves in about 20.
- **Spacing ruled** (planning agent's interview, brief 890): reach 240 u, Tokens 128 u apart, 12
  places round a node, about 8 for buildings.
- **The boost budget restated by places**: the same building all game and more of them (a Faster Work
  building is 5 %, one at copper to four at darkmetal); a typical player holds three quarters of each
  boost, ending about 1.4x behind optimized; XP buildings are four places at 2.5 %.

## The boosts interview (owner, 2026-11-26)

*After the combined trial of the first number pack showed the live game's boosts at about twice the
budget. These replace three of the rulings above.*

- **The first number pack waits for the boosts pack**; they land together, then one coin reset.
- **Only what can be held at once counts**: one consumable active in all (a drink or a potion), a site
  leans one or two ways, perks and Hall stars always on.
- **Guild Hall stars are small steps**: a star's ranks add up to about 10 % of its kind. This replaces
  the Hall carrying most of the yield.
- **Nodes: about 15 seconds of work, back in about a minute; 4 or 5 nodes keep a hero busy.** This
  replaces 30 seconds and two nodes. A gathering site then has about 5 places for buildings.
- **Bigger yield buildings**: a Double Output building is +50 %, four of them +200 %; raw counts keep
  doubling every 40 levels.
- **A station's upgrade step is worth one Faster Work building** (5 %) and takes one of the four.
- **The budget's totals are unchanged** (a speed-leaning hero: 60 % off work time and +20 % XP at
  darkmetal, 1.4x to 3x over a hero with no boosts), so the first pack's XP stands.

