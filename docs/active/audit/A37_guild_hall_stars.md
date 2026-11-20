# A37: The Guild Hall and Stars
*Read at tag audit-build (1c04f5f6), 2026-11-20.*

## In one paragraph

The Guild Hall is the guild's permanent Token in the middle of the mat. Its
upgrades live in a separate night-sky screen: stars joined in
constellations, each with ranks bought with items. A star's rank gives rules
to the whole guild (a skill works faster, a vein refills sooner, one more food
slot) in every Region, and some stars add items the Hall drops beside itself
every lap of its Passive Production clock (10 minutes). Three upgrades are
built into the code rather than authored: Bunk Beds (heroes), Bank Tabs and
the Wishing Well (Water each lap). Today 37 authored stars in 10
constellations exist, all about gathering and work; the combat, XP and
Double Loot stars the engine supports are not authored yet.

## What the player sees and does

- **Opening the sky**: the nav's Guild Hall button. Clicking the Hall Token on
  the mat does **not** open it (the hook for that is wired up in one place and
  dropped in the next).
- **The sky**: a star is gold at its top rank, blue when it can be bought and
  the Bank can pay, grey otherwise; a star with a rank is drawn twice the size;
  a line lights once both its ends are lit. A star opens when it is linked to
  the Hall or to a bought star.
- **Buying**: a click on a star opens the purple Upgrade drawer: what the star
  does, every rank (Roman numerals) with what it gives, the price. Clicking a
  later rank chooses it and the button becomes "Upgrade (+3 Ranks)", all or
  nothing; hovering the button shows the total. Greyed with what the Bank is
  short of when it cannot pay. A locked star never says why in words.
- **Feedback**: a chime and a burst on the star, light running down its lines,
  a bigger burst when a constellation is finished; only while the sky is open.
- **Passive Production**: every lap (10:00, shorter with Lap Speed stars, never
  under 2:00) the Hall drops its items as loot beside itself, for heroes to
  carry in: Oak Seedling, Wheat Seed and Apple Seed always; Water from the
  Wishing Well; and each Well star's line (Oak Wood, Copper, Stone, Coal,
  Shrimp, Iron, Fir).

## What really happens underneath

- The guild's ranks are one list (star → rank); everything they give is worked
  out again from it on load and after each purchase.
- **A rank replaces the one below**: each rank lists the star's whole effect
  (rank 3 says "Yield +21%", not "+7% more"); a rank removed in the CMS reads
  as the top one.
- A star's rule goes down one of two pipes: a rule for everyone into the
  guild's shared pool, a rule aimed at certain Tokens into those Tokens' own
  pools. Either way it is **added in the same buckets** as a building's, gear's
  or perk's same effect (S0's Effects group).
- Rules hold **everywhere**, with no check that the Hall stands there.
- Combat: a star's **Damage, Accuracy and Swing Speed** reach heroes; a star's
  **Crit, Dodge, type damage, Sunder or resistance would reach no one**, yet
  would still be listed in the Hall's Effects as held. No star carries one
  today; the boot audit names it if one does.
- The Hall's three seed lines say "every 5 min" (oak, wheat) and "every 10 min"
  (apple) in the data, but the game pays every line **once a lap**, so the oak
  and wheat come at half their written rate. The CMS already words it as one
  lap, so the times are stale fields.
- The Hall is spared some work-cycle effects by its id (Speed, Double Loot,
  Giant Harvest, Yield, Double Item, Bonus Drop) but not others (Failure,
  Preservation, Efficiency, Lucky). It never runs a work cycle, so no player
  meets this today.

## What the owner controls in the CMS

Every authored star (`hallStars.json`, through change packs): its
constellation, links, place in the sky, outline, ranks, each rank's price
(one item; today 32 Lavender up to 230,000 Watermelon, priced by the ledger),
each rank's rules (Provides only: Grow Time 32, Work Time 20, Yield 18, Wound
Time 3, Lap Time 3, Loadout Slots 2 across all ranks) and Passive Production
lines; the five ring stars that open the world map's rings. Not in the CMS:
Bunk Beds, Bank Tabs and the Wishing Well (code, placeholder price of 10 × rank
Oak Wood), the 10-minute lap, the Hall's own seed lines' pay (the CMS shows the
lines, but their times are ignored).

## What it touches, and where it overlaps another system

- **Effects** (S0): a star is one of the sources summed with buildings, gear and
  perks; it shares their stacking rules and their wording (T-492 to T-495 apply
  to stars too).
- **Making, gathering**: its rules are mostly skill Speed, Yield and Growth.
- **Heroes**: Bunk Beds recruits; Loadout Slots; Recovery (Wound Time).
- **The world map**: ring stars open settling.
- **Passive Production** pays as loot on the mat, like a cycle's output, not
  into the Bank.

## Where it differs from the GDD

- GDD §8 names XP and Double Loot skill stars, combat constellations, XP for
  Everyone and Brews stars: the engine supports them, none are authored
  (unfinished content, not a defect).
- GDD says nothing of clicking the Hall Token; the click does nothing.
- GDD's combat stars list Damage, Attack Speed and Accuracy, and says the boot
  audit names any other combat rule; it does not say such a rule is shown as
  held while doing nothing.

## Try this (in the tagged build, with the QA panel)

1. **Set-up**: a new game (lessons off is fine). QA panel: give yourself a
   stack of Oak Wood, Lavender, Copper Ore, Redberry and Trout.
2. **Click the Guild Hall Token on the mat.** You should see: nothing opens
   the sky. Then open it from the nav's Guild Hall button.
3. **Look at the sky.** Which stars are blue (buyable), grey (locked or
   unaffordable), gold (maxed)? Try a grey one: does it tell you why?
4. **Buy Bank Tabs one rank, then click rank IV and buy "+3 Ranks"** at once.
   You should see the hover total, one chime, the ranks lit.
5. **Open a skill constellation's first star** (Forestry or Mining). Read its
   ranks: each lists the whole effect (rank II is not "+7% more").
6. **Buy it, then go to that skill's Token** and hover its Speed or Yield
   badge: the star should be one of the listed sources.
7. **Open the Hall's Effects** (the Hall star in the sky): the lap ("every
   10:00") and what it pays.
8. **Watch the Hall for one lap** (10 minutes): seeds (and Water, once the
   Wishing Well is bought) drop beside the Hall as loot for a hero to carry.

## Owner feedback (2026-11-20)

Interviewed in three rounds without playing first.

- **Opening the sky**: the nav only. Clicking the Hall Token stays a no-op;
  the dropped hook is removed.
- **The Hall's seed lines**: one lap for all lines; the stale per-line times go.
- **Combat effects on stars**: "We need to either give it a real effect or
  cut it. If it doesn't work with our combat system, then it should be cut."
  Crit, Dodge, type damage and resistance are real combat stats, so from the
  guild they reach heroes; Sunder (it strips one's own resistances) is cut
  from stars and guild rules.
- **Passive Production**: stays loot beside the Hall for heroes to carry.
- **Locked stars**: leave as is (grey means locked; follow the lines).
- **Bunk Beds, Bank Tabs, the Wishing Well**: move into the CMS as ordinary
  authored stars.
- **The Hall's exemptions by id**: one rule, a non-working Token gets no
  work-cycle effect.
- **Reach**: stars work in every Region, and every Region has its own Hall
  (already true: each Region's layout puts the Hall at its centre,
  `Layout.js:75-76`).
- **Rank lines**: whole effect per rank, as now.

## What it became

- **T-511**: the Hall pays every line once a lap; the per-line time is retired.
- **T-512**: every guild-wide combat effect reaches heroes; Sunder refused on stars.
- **T-513**: Bunk Beds, Bank Tabs and the Wishing Well become authored stars.
- **T-514**: the Hall is a non-working Token by one rule; the dead click hook goes.
- Fine as is: nav-only sky, loot payout, stars everywhere, whole-effect rank
  lines, locked stars unworded.

All four tickets blocked on the Effects group.

## Evidence

- Sky opens from the nav → `src/ui/components/nav/BubbleMenu.jsx:115`, `src/ui/ReactRoot.jsx:141, 153-156, 256`
- Hall Token click dropped: passed → `src/ui/ReactRoot.jsx:314`; not a prop → `src/ui/components/board/Board.jsx:40`
- Star colours and sizes → `src/ui/components/board/GuildHallBoard.jsx:99-105, 451-452`; chimes only while open → `:207-221`
- Drawer, multi-rank, short-of line, lock not worded → `src/ui/components/board/GuildUpgradeInspection.jsx:107-134, 163-190, 247-266`
- Ranks stored and re-read; multi-rank all or nothing → `src/systems/progression/GuildUpgradeManager.js:22-28, 134-179, 202-222`; items only → `:49-56`
- A rank replaces the one below; removed ranks read as top → `src/systems/progression/hallModifiers.js:55-59, 78`
- Two pipes, same buckets → `hallModifiers.js:91-101`, `src/systems/progression/HallRules.js:38-56`, `src/systems/board/TileModifiers.js:849-870`
- Rules everywhere, no Hall check → `HallRules.js:11-14, 38-56`
- Combat: Damage, Accuracy, Swing via the guild → `src/systems/combat/CombatFormulas.js:138-161`; Dodge, Crit hero only → `:164-172`; others → `:273-312`; still listed → `src/ui/components/board/GuildHallEffectsPopover.jsx:50`; boot audit → `hallStarRule.js:84`
- Lap, cap, loot beside the Hall → `src/systems/board/PassiveProduction.js:45-47, 65-82, 116-136`, `src/config/tokenConstants.js:473`, `src/systems/board/workTime.js:24-28, 59-62`
- Seed lines' times ignored → `PassiveProduction.js:72-75`; data → `data/tokens.json:634-648`
- Hall spared by id → `src/systems/board/BoardRunner.js:298-302, 328-333, 368, 778-782`; not spared → `:240, 264, 285, 362-364`; `config: null` → `data/tokens.json:631`
- Built-in upgrades, placeholder price → `src/config/guildUpgrades.js:76-105, 133-174`; Bunk Beds recruits → `GuildUpgradeManager.js:170-175`
- Star data counts → `data/hallStars.json` (37 stars, 75 ranks, 10 constellations)
