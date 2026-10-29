# Brief 270 — Classless heroes: every hero, every skill

*Written 2026-10-28 by the planning agent from the owner's interview of the
same day. Concept: [concept_classless_heroes.md](../concept_classless_heroes.md)
(read it whole; its "Defaults the planning agent set" are the owner-approved
defaults). Retires jobs, promotion and class-locked styles (GDD §4 "Jobs and
promotion", §4 "Equipment", §6 "The fight").*

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, `docs/reference/UI_STYLE.md`,
[concept_classless_heroes.md](../concept_classless_heroes.md),
[concept_combat.md](../concept_combat.md) (the numbers this amends), GDD §4,
§6, §7 (the Rules grammar perks are written in), §14.

Code to start from (verify): `src/config/registries/jobRegistry.js`,
`skillRegistry.js`, `weaponStyles.js`, `src/systems/board/BoardPromotion.js`,
`src/systems/hero/PromotionSystem.js`, `src/ui/modals/JobChangeModal.jsx`,
`src/systems/equipment/EquipmentValidator.js`, `src/utils/CombatFormulas.js`,
`src/config/FormulaRegistry.js`, the hero sheet's skill list
(`src/ui/components/dock/heroPanelSkills.js`), the CMS job and skill editors,
the boot audit.

⚠️ **Order**: start after brief 260 O1 has merged (both change the hero sheet,
the dock and how heroes are sent to work). Brief 260's Promotion Token order
is dropped here.

## Phases

| Phase | What | Tier |
|---|---|---|
| K1 | **Classless heroes.** Jobs, promotion, Promotion Tokens' rule, the Change Job planner, banked skills and Mastery retire. Every hero holds the 9 Starting, 4 combat and 7 kept specialist skills (Fletching, Faith, Summoning, Enchanting, Crime, Taming, Science) from level 1, all shown on the sheet. Leadership, Commerce, Trapping, Armory and Shadowcraft are removed from the registry (content naming them: listed by the boot audit and the CMS Economy Audit, not crashed on). **The weapon decides the style**: XP to that style; barehanded is a melee punch on the hero's melee level; one style per weapon (a multi-style list in old content reads its first style and is audited). **Level requirement** on weapons and armour in their style; the equip refusal names it ("Needs Melee 15"). **Max HP = 10 + the highest combat skill.** Old saves: levels kept, banked skills restored, job dropped, cut skills dropped. CMS: job editor removed, a weapon's style is one choice, gear gets a level requirement. | engineer |
| K2 | ⚠️ **Moved to [brief 280](280_combat_v2.md) V2** (gear resistances and trade-offs); skip here. **Armour families.** A family on armour (four, one per style; names from the owner, placeholders until then) with its own-style bonus and off-style penalty set per family in the CMS; the fight reads them; the item tooltip shows both. | builder |
| K3 | ⚠️ **Moved to [brief 280](280_combat_v2.md) V4** (Stealth's character; 'unseen at work' dropped); skip here. **Stealth.** The sneak strike: a stealth hero's first hit in each fight always crits, times a placeholder multiplier in `FormulaRegistry`; stealth's later hits use a placeholder damage factor below 1. Unseen at work: a hero holding a stealth weapon is not picked by a hostile camp's ambush (node ambushes unchanged). Catch-up identity holds (no new random draws on the swings that don't need them). | engineer |
| K4 | **Milestone perks.** Each skill gets a perk table in the CMS (levels 10, 25, 50, 75, 99 by default), each perk a Rules effect from the library; a hero gains it on reaching the level (and on load, from their levels). The level-up moment and the hero bar alert name the perk; the sheet's skill row lists perks earned and the next one. One example perk per Starting skill in a change pack for the owner to review. | engineer |
| K5 | **Clean-up.** GDD §2, §4, §6, §8 and the glossary; tutorial text mentioning promotion or Recruits; the dormant job and promotion code removed. | builder |

## Done when

- Gate green per phase. The engine bench **will change work** (K1: weapons and
  HP; K3: the sneak strike): explained per scenario, accepted by the director
  under `brief270-K1` / `-K3`; catch-up identity and fidelity hold.
- In the running game (K1): a brand-new hero equips the Copper Sword and
  fights a Goblin with melee XP; switches to a bow and earns ranged XP;
  refuses an Iron Sword with "Needs Melee 15"; an old save with a promoted
  hero loads with their levels. (K2–K3): a hero in metal armour with a staff
  shows the penalty in the tooltip; a dagger hero's first hit is a big crit;
  a dagger hero chops beside the Goblin Camp unbothered. (K4): a hero
  reaching Forestry 10 shows the perk on level-up and on the sheet.
- Eye-checks: K1; K2 with K3; K4.

## Owner CMS to-do

- After K1: one style for each multi-style weapon (the Dagger); level
  requirements on weapons and armour; retune the Goblin and the tutorial's
  goblin step (a new hero with a copper sword is stronger than a Recruit's
  punch).
- After K2: armour family names, bonuses and penalties.
- After K4: review the example perks pack; perks for the other skills.
