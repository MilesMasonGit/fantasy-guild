# Brief 780 — Audit fixes: heroes, the guild and skills

*Written 2026-11-21 by the planning agent from the Systems Audit, groups 6 (Heroes and the guild:
A26 Roster and XP, A30 Orders, A36 Items and the Bank, A38 Quests and Limes, A39 The world map and
settling) and 7 (the skills once called specialist: A19 to A25). Cards: [A26](../audit/A26_roster_xp.md),
[A30](../audit/A30_orders.md), [A36](../audit/A36_items_bank.md), [A38](../audit/A38_quests_limes.md),
[A39](../audit/A39_world_map_settling.md), [A19 to A25](../audit/A19_A25_specialist_skills.md); draft
concept [concept_skill_identities.md](../concept_skill_identities.md). Runs after briefs 730 (Effects),
740/750 (Combat) and 760 (The living mat). Owner answers 2026-11-21 folded in.*

**What the player gets.** Bounties gone until they come back better, Limes's lessons kept; a Discard
button for an item nobody wants; an item's effects on its tooltip before it is worn; hero level on
the hero sheet and a Lessons switch in Settings; XP that pays a small award by chance instead of
rounding it up; one plain list of skills on the hero sheet, with Tailor as a 21st skill.

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, `docs/reference/ARCHITECTURE.md` (saves, the tick, the
content boundary), the cards above ("What really happens underneath", "Owner feedback"). Where
things are (read 2026-11-21 at `50cd9b2f`; check the code, it wins):

- **Bounties**: `src/systems/quests/questBounties.js` (its `Math.random` draws are part of the bench's
  identical-work gate), `QuestTokens.js:101-104, 262-287, 323-406`, the quest reports nothing reads
  `QuestManager.js:97-224`; Limes `LimesLessons.js`, `lessonPlan.js` (targets `:15-37`; the scrap
  heap and the weapon null, `:18, 33`; the foe step counts any win). Others naming bounties:
  `matTuning.js`, `StateSchema.js`, `Atlas.js`, `ContentAudit.js`, `EngineBootstrap.js`,
  `engineEvents.js`, `followRenames.js`, `QuestTooltip.jsx`, `LeaveMatControl.jsx`; the bench's
  `bench/scenarios/realistic.mjs:13` spawns them.
- **Items**: `ItemDrawer.jsx:90` (actions; "later Sell and Discard"), `ItemTip.jsx:78-104` (no effects
  listed).
- **Small calls**: `Settling.js:181` (the cap), `HeroGenerator.js:75-85` (hero level, shown nowhere),
  `NewGameScreen.jsx:70` (the only Lessons switch).
- **Leftovers**: `SkillSystem.js:89-90` (any award raised to 1), `InventoryManager.js:67-74, 178-202`
  (stack limits), `guildUpgrades.js` and `GuildUpgradeManager.js:208-211` (slot numbers),
  `woundedUntil`, `getEffectiveLevel`, the portrait picker.
- **Skills**: `skillRegistry.js:10-21, 127-163, 188-198` (three layers, `heroSheetSkillIds` puts the
  seven last), `heroPanelSkills.js:6, 18-31` (their own row colour), `HeroInspectionSheet.jsx`.

## Phases

| Phase | Tickets | What | Tier |
|---|---|---|---|
| J1 | T-637 | **Bounties cut for now; Limes stays** (owner 2026-11-21: "Probably cutting quests and bounties until I can figure out a better way to implement them"). The bounty Tokens stop appearing and their code goes (`questBounties.js`, the bounty parts of `QuestTokens.js`, the tooltip, the lap clock); Limes's lessons keep every counter they read; the quest reports nothing reads go (`token_placed`, `item_produced`, `token_inspected` and the rest; check each for a reader first, Limes's and the ledger's included). An older save with bounty Tokens on the mat loads without them, quietly: nothing paid, a half-done bounty's progress lost (planning agent's call 2026-11-21). The bench's realistic scenario stops spawning them. ⚠️ Expect WORK CHANGED (the bounty draws leave the random sequence): the builder says which fields move. | builder |
| J2 | T-638 | **Discard.** A **Discard** button in the item drawer throws the whole stack away after a confirm, nothing back (owner 2026-11-21); **Discard throws away the Bank's stack only** (planning agent's call 2026-11-21): worn gear stays worn, and a carried consumable whose stack is gone shows as empty until the Bank holds more, as when it runs out; the confirm says so. No Sell (owner 2026-11-20: no selling); the drawer's "later Sell" comment goes. (The item's effects on its tooltip, T-639, is the same change as T-499 and is built by brief 790 W4.) | builder-lite |
| J3 | T-640 | **Three small calls** (owner 2026-11-21, as recommended). Settling: a new place's own Tokens stand outside the 128 cap, which counts again from what the player adds (a place starting over the cap refuses additions until under it, never removes). The hero sheet's header shows hero level (the average of skills, `HeroGenerator.js:75-85`). Settings gets a Lessons on/off switch (planning agent's call 2026-11-21): off hides Limes's lessons; on brings them back at the first step not yet done. | builder-lite |
| J4 | T-641 | **Heroes and Bank leftovers.** An XP award under 1 pays 1 by chance (a 0.4 award pays 1 four times in ten), drawn in a fixed place so a catch-up pays what live play does; ⚠️ expect WORK CHANGED (`heroXp`). Dead stack limits go. One starting slot number, 64 a tab (the GDD's and the game's). `woundedUntil` and the no-op `getEffectiveLevel` go. The Hall recruit's portrait joins the picker. Limes: the scrap heap and the first weapon get their targets now that the content holds them (`token_scrap_heap` and `item_rusty_sword` are in `data/` at `50cd9b2f`: check they are what the lessons mean, else leave null and say so); the fight step counts a win over the slime it names. Bunk Beds and Bank Tabs prices are **not** done here: T-513 (brief 730) makes them authored stars. | builder |
| J5 | T-643 | **Just skills.** The registry's specialist layer goes: one list of skills, every one held from level 1, skills with no content still shown (ruling D7). The hero sheet stops listing the seven last on their own colour: **one list by kind, all one colour** (owner 2026-11-21): combat, gathering, making (Fletching, Enchanting and Tailor among the making skills), then Faith, Summoning, Crime, Taming and Science last until their identities place them. Registry comments, CMS skill pickers' layer hints and anything reading `SKILL_LAYERS.SPECIALIST` or `SPECIALIST_SKILL_IDS` follow. ⚠️ T-569 (brief 750, waiting on its concept doc) rewrites the combat styles' texts in the same file (`skillRegistry.js:100-126`): one after the other. | builder-lite |
| J6 | T-304 | **Tailor, a 21st skill** (owner 2026-11-21: add it now, landing with its plan T-578). The skill in the registry (one edit there, by its own rule) and every place that counts skills (the ritual's final challenges, the hero sheet, the ledger, the CMS pickers); a placeholder icon and an art-list line for the owner. Its building (the Tailor's Shop) and content are the content agent's (T-578, brief 630 C1). Older saves give every hero Tailor at level 1. | builder |

**Order and parallel work.** J1 alone first or beside J2/J3 (different files). J2 and J3 are small and
may run together. J4 touches XP and the Bank; it may run beside J2 only if J2's Discard does not edit
`InventoryManager.js`'s stack code (else after). J5 before J6 (both edit `skillRegistry.js` and the hero
sheet). Two code agents at a time.

**Depends on.** T-513 (brief 730) for the Hall prices J4 leaves alone. T-495 and brief 730's effect
wording for J2's lines (J2 can start with the existing writer). T-569 (brief 740/750) before or after
J5, not beside it. T-578 (Tailor content, combat group) lands with J6; J6 may merge first, the skill
then shows at level 1 with no content (ruling D7). T-304 is J6's alone: brief 750 lists it only as
T-578's prerequisite. T-639 (an item's effects on its tooltip) is built by brief 790 W4 and closes
there; J2 does not touch `ItemTip.jsx`.

## Done when

- Gate green; bench work check per phase: **J1 and J4: expect WORK CHANGED** (bounty draws; XP by
  chance), each explained field by field; **J2, J3, J5: same work**; **J6:** same work unless a
  scenario's fingerprint counts skills (say which).
- Seen in the running game: no bounty beside the Hall after several minutes, and an older save with
  one loads cleanly; Limes's lessons still tick; Discard on a stack with its confirm; a dagger's crit
  and a drink's buff on their tooltips in the Bank; hero level in the sheet's header; Lessons
  switched off and on in Settings; a new place settled over the cap; the hero sheet's one list, with
  Tailor.
- Tickets closed into `docs/archive/tickets_done.md`.

**Eye-check: yes**, one look for the batch: Discard and the item's effects (J2), hero level and the
Lessons switch (J3), the one list of skills with Tailor (J5, J6). J1 and J4: one line in STATUS each.

## Handled outside this brief

- **Planning agent**: T-642 (GDD on heroes and the guild, after J1 to J4), T-645 (GDD §4 Skills, after
  J5, J6 and the identities), T-643's docs part.
- **Not in this brief**: T-644 (Faith, Summoning, Crime, Taming and Science get identities): it waits
  on `concept_skill_identities.md`, still a draft; the planning agent finishes it with the owner,
  skill by skill, then briefs it. Its new skill lines go with T-569's words.

## Owner to-do

1. After J6: draw the Tailor skill icon when you like (a placeholder stands in).
2. After J1 to J6: the eye-check.
