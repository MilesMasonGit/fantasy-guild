# Brief 730 — Audit fixes: the Guild Hall, gear and how effects add up

*Written 2026-11-21 by the planning agent from the Systems Audit, group 1 Effects, first half
([A37 The Guild Hall and Stars](../audit/A37_guild_hall_stars.md),
[A29 Equipment and tools](../audit/A29_equipment_tools.md)). The group's other half, health and
levelling up ([A28](../audit/A28_health_food_defeat.md), [A27](../audit/A27_milestone_perks.md)), is
[brief 735](735_audit_health_levels.md): the two touch different files and may run side by side.
Runs after briefs 710 and 720. Owner answers 2026-11-21 folded in.*

**What the player gets.** A better pickaxe or axe now works faster, and a hero always uses the best
tool they carry. Two pieces of gear with the same effect add up in full. An item's tooltip says
which Tokens a tool works, how likely it is to break, and only food promises healing. Bunk Beds,
Bank Tabs and the Wishing Well become ordinary stars the owner places and prices in the CMS. Crit,
Dodge, type damage and resistance on a star would now really reach heroes. Equip refusals read the
same everywhere. Behind the scenes: the Hall's seed lines say one lap, the Hall follows one rule
for work-cycle effects, and a dead tool path and dead equipment code go.

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, `docs/reference/ARCHITECTURE.md` (effects, the board's
rules, the Hall and Passive Production, saves, the content boundary). The two cards' **Owner
feedback** and **Evidence** sections. Each ticket row in `docs/reference/TICKETS.md` (T-511 to
T-520) carries its file:line evidence and the owner's ruling; the rulings are locked. The tickets'
line numbers were read at `50cd9b2f`: check the code, it wins. Where a phase would need a design
call that this brief and the ticket leave open, **stop and report** rather than choose.

## Phases

| Phase | Tickets | What | Tier |
|---|---|---|---|
| D1 | T-511, T-514 | **The Hall: one lap, one rule.** T-511: the Hall pays every Passive Production line once a lap (owner, 2026-11-20). The CMS already hides a line's time and new lines carry none (`LifecycleBlocks.jsx:365-379`, `useEntityStore.js:452-454`), but editing a line keeps the stale `everyMs` (the line is spread on patch): the CMS now drops it on save; the boot audit warns when a Passive Production line carries one; the Hall's Effects and card say "once a lap". ⚠️ `everyMs` on a Token's **Turns** block (`tokenConstants.js:225-242, 477-486`) is live and stays. T-514: a Token that never runs a work cycle gets no work-cycle effect, by one rule, not by the Hall's id: replace the id checks in `BoardRunner.js` (about `:298-302, 328-333, 368, 778-782`) with that rule and make sure Failure, Preservation, Efficiency and Lucky (`:240, 264, 285, 362-364`) follow it too; remove the dropped `onOpenGuildHall` passed at `ReactRoot.jsx:314` (the sky opens from the nav only). | builder-lite |
| D2 | T-512 | **Guild-wide combat effects reach heroes; Sunder refused on stars.** Crit, Dodge, Type Damage and Type Resistance from a star or a Region rule reach heroes, summed in the same bucket as their gear's, the way `heroStyleAxis` does for Damage (`CombatFormulas.js:142-172, 273-300`); enemies never read the guild's. Sunder cannot sit on a star or a guild rule: the CMS Hall Stars page refuses it and the boot audit (`hallStarRule.js`) names it. The Hall's Effects list (`GuildHallEffectsPopover.jsx`) shows only effects that work. No star carries these today: tests with a fixture star. If brief T-532 (combat group, no damage-type groups) has landed, sum per type only; if not, follow today's group rule for heroes. | builder |
| D3 | T-513 | **Bunk Beds, Bank Tabs and the Wishing Well become authored stars** (save migration). Today they are built in (`guildUpgrades.js:133-177`) and the boot audit refuses an authored star with their ids (`hallStarRule.js:46`). Build: an authored star in `hallStars.json` may carry these three ids, and the code keeps only what each does (a hero per rank; a Bank tab per rank). The Wishing Well's Water becomes an ordinary authored Passive Production line on each rank (10 Water at rank 1, 20 at rank 2 and so on, retuned like any star; planning agent's call 2026-11-21): nothing of the Well's amount stays in code. Their constellations (The Hearth, The Vault, The Well) move to the CMS with them. Saved ranks carry over by id, the Well's old `guildmasters_banner` id included; a new game still holds Bunk Beds rank 1 (`EngineBootstrap.js:293`). The boot audit names a Bunk Beds or Bank Tabs star whose rank count does not match the roster or tab cap. ⚠️ So that `main` never loses the three between merge and the owner's Sync, the built-in definitions stay as a **fallback used only while the data lacks the star**, with a boot-audit warning; the ledger prices them like the other stars once authored (`ledger/engine.js:334-338, 623` special-case the Well today). Tests from fixtures, never `data/`. | engineer |
| D4 | T-513 | **Remove the fallback** after the owner has Synced the content agent's three-star pack on `main`: the built-in definitions, `placeholderPrices` and the built-in id list go; the boot audit's warning becomes an error. Grep `src/` and `cms/src/` for the three ids first. | builder-lite |
| D5 | T-516 | **The same effect from several sources adds in full, no cap** (owner, 2026-11-20: one rule, numbers kept small instead). Drop the cap of 5 across a loadout (`HeroEffects.js:84-91`) and among perks (`HeroPerks.js:38-53`); items, perks, buildings and stars all add in full. A single reference's own scale (1 to 5, `normaliseScale`, `effectLibrary.js:23-36`) is not a cap across sources and stays. The content audit names any effect that a hero's best possible stack of gear and perks pushes to the effect's own limit, where more stops helping: a chance at 100%, a speed-up at the speed-up floor, a cost cut at 100% (planning agent's call 2026-11-21), as `gearDefenceRule.js` does for resistances. | builder |
| D6 | T-515 | **Better tools work faster, and a hero uses the best one.** Each tool family (pickaxe, axe, and the rest in `toolKinds.js`) gets one library Speed effect with a scale per tier (copper 1, iron 2 …), written on each tool item in the CMS item editor like any other effect (no Tool families table; planning agent's call 2026-11-21); the content audit warns when two tools of one family and tier carry different scales. The first values come as the content agent's pack. Only the tool the hero is **using** for this work lends its Speed (carrying three pickaxes does not add three Speeds once D5 lands), and only to work that needs that tool kind. It shows on the Speed hover as the tool's and sits inside the usual speed-up floor. The hero uses the highest-tier fitting tool in their hands, not the first in grid order (`HeroTools.js:22-26, 73-83`); ties keep grid order. Fishing rods stay as they are until the Fishing overhaul (A8). After D5. | builder |
| D7 | T-517, T-525 | **The item tooltip and the heal amount.** T-517: a tool's tooltip names the Tokens it works (Pickaxe tier 2: works Iron and Copper veins; a long list ends "and N more") and its break chance (1% chance to break each use) where it has one; it sits beside the effect lines T-499 adds (group 8) whichever lands first. T-525: only food heals (owner, 2026-11-20): the CMS item editor offers a heal amount on food only and stops filling in 5 by default (`ItemEditor.jsx:22, 307, 518-529`); it stops writing `regen` and `restoreType`; the tooltip shows Restores N HP for food only (`ItemTip.jsx:99, 164-165`). | builder-lite |
| D8 | T-518, T-520 | **Retire the old tool Token path; equip refusals in one wording.** T-518: remove the Acts as check (`RecipeResolver.js:77-92, 133`) and every other reader of `acceptedTokens` (`reachDisplay.js:19-29`, `tokenCard.js`, `toolRule.js`, `statementText.js`, `ContentAudit.js`, the CMS `Statements.jsx`, `descriptionDictionary.js`, `statementSlots.js`, `useEntityStore.js`; check each, some may be about recipe pools, which stay); remove `getPrimaryWeaponSlot`, `getPrimaryWeapon` (`equipmentConstants.js:95-119`) and `canEquipToSlot` (`EquipmentValidator.js:13`) with their test mocks; the loadout bound uses `GRID_SLOT_COUNT`, not `< 9` (`EquipmentManager.js:201`). The 8 dead effects go by the content agent's pack, not here. T-520: every equip refusal comes from `en.json` (`EquipmentManager.js:169, 181, 186, 192, 215, 255, 281`), and the hero bar shows the engine's reason in T-500's form, `Needs [skill icon] Melee 15 (Ana: 12)`, instead of rewording it (`dockEquip.js:31-38`). | builder |
| D9 | T-519 | **An item's or a perk's effect has no reach.** The CMS effect editor hides the reach field on an effect used only by items or perks (the game ignores it there, `TileModifiers.js:1099-1104`); on an effect also used by a Token it stays, with a line saying items and perks ignore it. The content agent's pack clears today's `nearby` on item and perk effects. | builder-lite |

**Order and parallel work.** Two tracks, one code agent each:

- **Hall track**: D1, then D2, then D3 (D2 and D3 both touch `hallStarRule.js` and the CMS Hall
  Stars page), then D4 after the owner's Sync.
- **Gear track**: D5, then D6 (both touch the hero's effect sums), then D7, D8 and D9 in any order
  (D8 and D7 share no files; D9 is CMS only). D8 uses the T-500 form whether or not T-500 itself
  (group 8) has landed; whichever lands second keeps the one form.

Briefs 710 and 720 run first. Across briefs:

- **D7 and brief 790 W4** (T-499 and T-639: an item's tooltip lists its effects) both edit
  `ItemTip.jsx`: run them in sequence, never side by side; the second rebases on the first.
- **D2 after T-532** (brief 740 C2, no damage-type groups) where it can; if D2 runs first it follows
  today's group rule for heroes, as written above.
- **D5 before T-583** (brief 750 S1: Stealth raises crit chance only, no Crit Damage effect).
- **D8 uses T-500's form** (brief 790 W5) whichever of the two lands first.
- **D3's star code before the owner's three-star pack**: the boot audit refuses the built-in ids on
  an authored star until D3 lands (`hallStarRule.js:46`).

## Done when

- Gate green. Bench work check:
  - **Same work**: D1, D2, D4, D7, D8, D9 (no shipped content reaches what they change; the Hall never
    works, no star carries combat effects, no Token uses `acceptedTokens`).
  - **D3**: same work while the fallback is in use. After the owner Syncs the three-star pack, a
    **WORK CHANGED** is expected only if the bench buys one of the three (new prices).
  - **D5**: expected same work; a WORK CHANGED is accepted only when traced to a bench hero stacking
    one effect past the old cap of 5.
  - **D6**: **WORK CHANGED expected** where a bench hero carries two fitting tools (the best one is now
    used) and again once the tool Speed pack is Synced (tools faster). Name both in STATUS.
- No drag bench or draw compare needed (nothing here touches drawing or drag).
- Seen in the running game: the Hall sky with the three stars in their authored places and prices,
  bought once each (a hero slot, a Bank tab, Water next lap), and an old save keeping their ranks; a
  hero carrying a copper and an iron pickaxe using the iron one, the Speed hover naming it; a tool's
  tooltip with its Tokens and break chance; a drink's tooltip with no heal line; an equip refusal on
  the hero bar in the one form.
- Tickets closed into `docs/archive/tickets_done.md`. T-521 (GDD) is unblocked for the planning agent
  once D5 and D6 merge; T-522 (perk tables, content agent) once D5 and brief 735's V3 merge.

**Eye-check: yes**, one look after D6 and the owner's packs: the three stars on the sky, a better tool
working faster with the best one chosen, the item tooltip. D1, D2, D5, D8 and D9 get one line each in
STATUS.

## Owner to-do

- Review and Sync on `main` the content agent's change packs, each **after** its code phase merges:
  - after D1: strip the times from the Hall's three seed lines (T-511);
  - after D3: the three stars with their places, links and first prices (T-513); D4 follows the Sync;
  - after D6: the Speed effect per tool family and its scales (T-515), fishing rods left out;
  - after D7: clear the heal amount on the six drinks and the potion, and `regen` and `restoreType` on
    three items (T-525);
  - after D8: delete the 8 dead tool effects (T-518);
  - after D9: clear `nearby` on item and perk effects (T-519).
  The content agent may bundle packs that are ready together.

## Not in this brief

None of the group's director tickets for A37 and A29 is left out. A28 and A27 are in brief 735.

## Handled outside this brief

- **T-521** (planning agent): GDD §4 Equipment, Milestone perks and Health match the game, after D5,
  D6 and brief 735 land.
- **T-522** (content agent): perk tables for every skill that levels, small steps every 5 levels;
  needs D5 (no cap) and brief 735's V3 (rows every 5).
- **T-526** (content agent): the Shrimp Trawler Potion buffs Raw Shrimp, a work rule and a recipe as a
  change pack; may ride with the T-525 pack.
