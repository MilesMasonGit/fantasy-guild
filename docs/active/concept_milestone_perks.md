Status: draft

# Milestone perks: what each level gives

*From the Systems Audit, A27 Milestone perks
([card](audit/A27_milestone_perks.md)), owner interview 2026-11-20. For the
planning agent to finish with the owner (signature perks, skill by skill),
then the content agent to author. Tickets already filed: T-522 (perk tables,
content agent), T-523 (CMS defaults), T-524 (the level-up moment), T-516 (one
effect from several sources adds in full) and T-519 (no reach on carried
effects).*

## What the owner decided

- **Small early, signature late.** The major milestones stay at **10, 25, 50,
  75 and 99**. Early ones give small bonuses like today's; later ones give a
  **signature perk** that changes how the skill plays (examples only: a
  Forester fells a whole grove at once, a Miner finds gems).
- **Smaller milestones every 5 levels** between the majors (5, 15, 20, 30,
  35…). They sit in the same perk table and are **not marked minor**: they
  are **small, repeatable improvements**, the same effect again (Steady Pick
  at 5, 15, 20…), each adding to the last. This needs T-516 (the same effect
  adds in full, no cap of 5).
- **Every skill that can be levelled gets a table**, the combat skills too
  (Melee, Ranged, Magic, Stealth), with the same rules: their perks reach the
  hero's fights (Crit, Dodge, a style's damage type, Swing Speed).
- **Levelling up is an event.** Every milestone, small or major, is shown the
  same way: the level-up float names the perk in gold and the hero bar gives
  it its own alert. The moment also lists the **recipes (and Tokens and gear)
  the level unlocks**, and, once there are more animations, **something
  flashy** (owner: "I want levelling up to be more of an event").
- **No choices, nothing stored**: every hero at the level holds the perk, as
  today. No banner; perks belong to one hero.

## Still open (for the planning agent and the owner)

1. **The signature perk for each skill at 50, 75 and 99**: what it does, skill
   by skill. Some will need new mechanics (new keywords or engine rules); each
   of those becomes its own ticket.
2. **Strength of the small steps**: how much a 5-level step gives (Speed +2%?
   XP +3%?), and how the steps add up against the balance rules
   (`docs/reference/BALANCE_RULES.md`) and the 80% speed-up floor.
3. **Which effects the repeatable steps use per skill**: one effect repeated
   all the way, or two alternating (Speed at 5, 15; Yield at 20, 30)?
4. **Specialist skills** (Fletching, Faith, Summoning, Enchanting, Crime,
   Taming, Science) wait on their own identity sessions in the audit.
5. **The flashy level-up**: what it looks like, under the animation rules
   (`research/animation_menu.md`); recorded in `design_pass_notes.md`.

## Today (for reference)

Nine perks, one per work skill, all at level 10: Steady Pick (Mining, 5%
faster), Clean Felling (Forestry, Double Loot 5%), Patient Line (Fishing, +10%
XP), Even Heat (Smithing, +10% XP), Nimble Fingers (Crafting, 5% faster),
Second Helping (Cooking, Double Loot 5%), Green Thumb (Farming, +10% Yield),
Steady Hand (Alchemy, +10% XP), Quick Builder (Construction, 5% faster).
