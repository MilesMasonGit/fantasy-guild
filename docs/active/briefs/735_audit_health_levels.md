# Brief 735 — Audit fixes: health, healing and levelling up

*Written 2026-11-21 by the planning agent from the Systems Audit, group 1 Effects, second half
([A28 Health, food and defeat](../audit/A28_health_food_defeat.md),
[A27 Milestone perks](../audit/A27_milestone_perks.md)). The first half, the Guild Hall and gear
([A37](../audit/A37_guild_hall_stars.md), [A29](../audit/A29_equipment_tools.md)), is
[brief 730](730_audit_effects.md); the two touch different files and may run side by side. Runs
after briefs 710 and 720. Owner answers 2026-11-21 folded in.*

**What the player gets.** Healing between fights can be boosted by a new Regen effect from stars,
perks and gear, listed on the hero's health hover. An Infirmary rank bought mid-wound shortens the wound at once. Burning halves
every meal while it lasts, not only in a fight. Reaching a level is an event: the moment names the
perk and what the level unlocks (new recipes, Tokens, gear). Limes warns what losing a fight costs
before the first fight. Behind the scenes: defeats are no longer counted twice for time away, and
dead health code goes.

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, `docs/reference/ARCHITECTURE.md` (effects, the tick, saves,
time away). The two cards' **Owner feedback** and **Evidence** sections. Each ticket row in
`docs/reference/TICKETS.md` (T-523, T-524, T-527 to T-531) carries its file:line evidence and the
owner's ruling; the rulings are locked. Line numbers were read at `50cd9b2f`: check the code, it wins.
Where a phase needs a design call this brief leaves open, **stop and report**.

## Phases

| Phase | Tickets | What | Tier |
|---|---|---|---|
| V1 | T-527, T-531 | **A Regen effect; health leftovers.** T-527: Regen becomes an effect like Speed and Recovery (owner, 2026-11-20). Out-of-fight healing (a fixed 1 HP per 10 s, `FormulaRegistry.js:185-187`, `RegenSystem.js:36-43`) is raised by a percentage Regen (+50% Regen heals half again as much), fractions carried per hero so small boosts still count. It comes from stars (the guild aggregator, as Recovery's Wound Time is read, `WoundedSystem.js:23-25`) and the hero's gear and perks, summed in the usual buckets. **No building Regen yet** (owner 2026-11-21): a building's Regen is not read, and the CMS does not offer Regen on a building or Token; buildings may come later as their own design; use the existing `HP_REGEN` type (`effects/constants.js:50`, read by nothing today) if its shape fits. Named in the effect names table (code and `UI_STYLE.md`), explained on hover once T-495 (group 8) lands, and listed on the hero's health hover with its sources. No source carries it yet: tests with fixtures. T-531: defeats tallied once for time away (`CatchUp.js:298-300` beside `catchUpNews.js:61-70`); remove the villagers' flat-health path (`HeroRehydration.js:95, 100`; only tests set `isVillager`, delete those tests with it); remove regen's dead `working` check (`RegenSystem.js:54`: a working or walking hero is `idle`, so behaviour is unchanged); fix the stale comment at `effects/constants.js:47`. | builder |
| V2 | T-528, T-529 | **Recovery shortens running wounds; Burning on every meal.** T-528: a Recovery change (an Infirmary rank) applies to wounds already running at once, as growth speed-ups do mid-wait: the remaining time is rescaled by the share left, not restarted (`WoundedSystem.js:18-26, 58-61`). T-529: Food Healing (Burning's -50%) applies to every meal while the status lasts, in a fight or out (`ConsumptionSystem.js:55-62, 84-85`): a status does what it says wherever the hero is. | builder-lite |
| V3 | T-524, T-523 | **Levelling up is an event; perk tables every 5 levels.** T-524: every milestone is shown the same way (the level-up float and the hero bar alert, no banner, `levelUpFloats.js:66`, `heroBarBubbles.js:36-46`), and the moment also lists what the level unlocks: the perk reached, new recipes, Tokens the hero can now work, gear they can now wear (owner 2026-11-21): the float says the short version, "Forestry 25: Clean Felling, +2 recipes", and the hero bar alert, clicked, lists the perk and each recipe, Token and gear piece by name. A flashier animation is a later design pass, not this phase. T-523: a new perk table in the CMS starts with rows at 5, 10, 15 … 95 and 99 (`perkTable.js:21`, `DEFAULT_PERK_LEVELS`), none marked differently; the skill panel lists them all as now. Existing tables are not touched. | builder |
| V4 | T-530 | **Limes explains defeat losses before the first fight.** Once the planning agent has written the lines: Limes says, in lesson 8 before the safe first fight (`limesText.js:87-99`, `lessonPlan.js:64`), that a defeated hero loses a quarter of each food and drink stack they carry and each gear piece has a 1 in 10 chance to be lost. The numbers come from `DEFEAT_PENALTY` (`loopConstants.js:87-91`), not typed into the line, so a tuning change keeps the line true. The word is Defeated (T-559, combat group). | builder-lite |

**Order and parallel work.** V1 and V2 share no files and may run together (two code agents; check
brief 730's tracks are not using both slots). V3 any time. V4 after the planning agent's lines.
None of these phases depends on brief 730. Across briefs:

- **V1's hover explanation needs T-495** (brief 790 W4, effect hovers); V1 lists Regen on the health
  hover either way, and the explanation joins when W4 lands.
- **V1 names Regen beside 790 W3's renames** (Recovery, Lap Speed, Attack Speed) in the one effect
  names table: whichever lands second keeps both.
- **V4 uses the word Defeated** (T-559, brief 740); if T-559 has not landed, V4 still writes Defeated.

## Done when

- Gate green. Bench work check:
  - **Same work**: V1 (no Regen source exists yet; the double tally touches the away summary only),
    V3, V4.
  - **V2**: expected same work; a WORK CHANGED is accepted only when traced to a Burning hero eating
    after a fight or a Recovery change during a wound in the bench run.
- No drag bench or draw compare needed.
- Seen in the running game: a hero's health hover listing Regen from a fixture star (QA panel);
  a wound shortened at once when an Infirmary rank is bought mid-wound; a hero levelling to a perk
  level and to a level that unlocks a recipe, the float and hero bar alert listing both; Limes'
  lines before the first fight.
- Tickets closed into `docs/archive/tickets_done.md`. T-522 (perk tables, content agent) is unblocked
  once V3 and brief 730's D5 merge; T-521 (GDD) once both briefs land.

**Eye-check: yes**, one look after V3: the level-up moment with a perk and with new recipes, and the
health hover with Regen. V1's internals, V2 and V4 get one line each in STATUS.

## Owner to-do

- After V1 merges: the content agent's pack putting Regen on stars, perks or gear where wanted
  (T-527); review and Sync on `main`.
- Before V4: approve Limes' lines from the planning agent.

## Not in this brief

None of the group's director tickets for A28 and A27 is left out.

## Handled outside this brief

- **T-530, Limes' lines** (planning agent): written before V4.
- **T-522** (content agent): perk tables for every skill that levels; after V3 and 730 D5.
- **T-526** (content agent): the Shrimp Trawler Potion buffs Raw Shrimp; listed in brief 730.
- **T-521** (planning agent): the GDD; listed in brief 730.
