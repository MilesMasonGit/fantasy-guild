Status: draft

# Classless heroes: every hero, every skill

*Owner interview, 2026-10-28. Amends the class rework
([concept_skill_and_class_rework_v2.md](concept_skill_and_class_rework_v2.md),
built, brief 20) and the combat concept
([concept_combat.md](concept_combat.md), built, brief 220): jobs, promotion
and class-locked styles retire. Owner's reason: siloing combat styles and
skills into classes is too restrictive, and players bump into work or gear
they are not allowed to use. **If the skill is high enough, the hero can do
it.** Pairs with [concept_hero_orders.md](concept_hero_orders.md): one hero,
one job makes heroes specialise by what they are sent to do.*

## Every hero holds every skill

- **No jobs, no promotion.** The Recruit → basic class → master class tree,
  Promotion Tokens, the Academies, the Change Job planner, banked skills and
  the Mastery rule retire. A new hero is simply a hero (no "Recruit" title).
- Every hero holds the **9 Starting skills, the 4 combat skills** (melee,
  ranged, magic, stealth) and the **7 kept specialist skills**, all from level
  1. The gate on anything is the skill level, a tool, or an item: never a
  class.
- **Specialist skills** (owner):
  - **Kept**: Fletching, Faith, Summoning, Enchanting, Crime, Taming, Science.
    Still placeholders until the specialist-skill rework gives each its
    mechanics. **Shown at level 1 now** (owner), so players see what is coming.
  - **Cut**: Leadership, Commerce, Trapping, Armory, Shadowcraft. (Stealth
    stays as a combat style, below.) Content naming a cut skill is listed by
    the boot audit and the CMS Economy Audit.

## Combat style: the weapon decides

- **Equip a weapon, get its style** (owner): sword melee, bow ranged, staff
  magic, dagger stealth. Kills give XP to that style's skill. Barehanded is a
  melee punch.
- **One style per weapon**: weapons listing two styles today (the Dagger:
  melee and stealth) are given one (CMS).
- **Weapons and armour have a level requirement** in their style
  ("Iron Sword: Melee 15"). It replaces "a hero equips only weapons of their
  own style" and "Recruits hold no weapon".
- **Max HP = 10 + the hero's highest combat skill** (owner). A hero who switches
  from sword to bow keeps their health.
- The **four-way cycle stays**: melee > ranged > magic > stealth > melee, with
  even opposite pairs. It now matters which hero, with which weapon, you send
  at which enemy.

## Stealth plays its own way (owner)

Stealth stays the fourth style, which sets the game apart from RuneScape's
triangle, and earns its place by a different rhythm:

- **The sneak strike**: a stealth hero's first hit in a fight always crits and
  hits harder still (a placeholder multiplier, set in the combat numbers);
  after that, stealth hits are weaker than the other styles'. Burst, not
  sustain: the right pick for quick kills.
- **Unseen at work**: a hero carrying a stealth weapon is not ambushed by
  hostile enemies while working near their camp. (Node ambushes, the 2 %
  rolls on a finished cycle, still happen.)

## Armour families (owner)

- Each armour family belongs to a style: **metal → melee, leather → ranged,
  cloth → magic, dark cloth → stealth** (names are placeholders for the
  owner).
- A piece **helps its own style** (damage, accuracy or a family ability) and
  **hurts the others** (e.g. metal: −Accuracy for magic). The bonus and
  penalty are set per family in the CMS, so the player learns four families,
  not each item.
- The armour's level requirement is in its family's style skill.

## Milestone perks (owner)

- **Fixed perks at set levels in every skill**: by default **10, 25, 50, 75
  and 99**. Every hero who reaches the level gains the perk; no choices.
- A perk is an **ordinary Rules effect** authored in the CMS on the skill
  ("Forestry 25: 5 % chance of a bonus log"), so the existing grammar carries
  it.
- **The level-up moment announces it** (the floating icon and number,
  brief 140), with the perk's line on the hero bar alert and the hero sheet's
  skill row.
- Perks replace promotion as the milestone; identity otherwise grows from
  each hero's levels, name and colours (personality stays flavour only,
  [concept_living_game.md](concept_living_game.md)).

## Defaults the planning agent set (owner may change)

- **Old saves**: a promoted hero keeps every level they hold, banked skills
  come back, and their job is dropped. Levels in cut skills are dropped.
- **Combat content is retuned** (owner CMS): goblins were set for Recruits who
  punch for 1 (owner, 2026-10-24); a new hero with a copper sword is
  stronger, so the Goblin's level and the first-kill tutorial step are
  checked again.
- **Tools** are unchanged: any hero, with the skill level.
- Brief 260's "Promotion Token" order becomes moot once this lands.

## Rollout

One brief in phases:

1. **Classless heroes**: jobs and promotion retired, all skills on every hero,
   the weapon decides the style, one style per weapon, level requirements on
   gear, HP from the best combat skill, cut skills removed, old saves
   converted, the hero sheet's skill list and the CMS job editor updated.
   Eye-check.
2. **Armour families**: family on armour, bonuses and off-style penalties,
   shown in the item tooltip.
3. **Stealth**: the sneak strike and unseen at work. Combat numbers
   rechecked. (2 and 3 may share one eye-check.)
4. **Milestone perks**: the per-skill perk table in the CMS, applied and
   announced on level-up, shown on the hero sheet. Eye-check.
5. **Clean-up**: GDD, tutorial, the old job and promotion code removed.

## Owner's to-do (CMS)

- One style for each multi-style weapon; level requirements on weapons and
  armour.
- Armour family names and their bonuses and penalties.
- Perks for each skill (an agent-written change pack can draft them for
  review).
- Retune the Goblin and the tutorial's goblin step.
