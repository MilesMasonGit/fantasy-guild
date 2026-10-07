# Brief 20 — Skill and class rework v2

**Source of truth:**
[`concept_skill_and_class_rework_v2.md`](../concept_skill_and_class_rework_v2.md),
**starting with its "Amendments — owner, 2026-10-07" section**, which overrides
the rest: 9 Starting skills (construction stays universal; Explore dropped;
Logging → Forestry; Alchemy Starting), Leadership as the Fighter's Advanced
skill (a placeholder), 4 Academies on Wood or Stone Foundations, promotion
free, no save migration. 25 skills in all.

**Today's code** (GDD §4): 29 skills (`skillRegistry.js`), Recruit → 6 base →
12 advanced jobs (`jobRegistry.js`), promotion by a Token rule
(`PromotionSystem.js`, `BoardPromotion.js`), banked skills on re-training.

**Branch:** `crunch/class-rework`. No eye-check for engine phases; the hero
panel's presentation is brief 30. Engine bench WORK CHANGED is expected
(skills and XP change): accept per phase with a named reason.

## R0 — Roadmap (engineer, read-only first)

Map the concept + amendments onto the code and content and write
`docs/active/class_rework_v2_roadmap.md`:
- every place a skill id, job id or skill layer is read (engine, UI, CMS,
  tests, `data/` content via the CMS), and what each becomes;
- what happens to content using skills that disappear (Explore; the old
  Shared/Signature skills not in v2) — content is half-authored on purpose,
  so the answer is usually "the owner re-points or retires it in the CMS";
- the slices below, refined, each with tests and done-when.
- **One batch of owner questions** for anything the concept leaves open.
  Known candidates: the **combat triangle** with four styles (today melee >
  ranged > magic > melee; where does stealth sit?); the **Mastery rule**
  (level 99 in an Advanced or Master skill unlocks it across classes):
  confirm its details; what the Rogue/Merchant/Assassin-style skills do
  mechanically in this version, or whether they ship as placeholders.

Stop after R0 for the owner's answers.

## R1 — Skills (builder, from the roadmap)

The 25-skill registry with its four layers; `logging` → `forestry` (id and
name); `explore` removed; `alchemy` and `construction` Starting; `stealth`
added as a Combat skill; `leadership` as the Fighter's Advanced. Every hero
holds the 9 Starting skills. Skill icons for new skills: placeholders flagged
for the owner.

## R2 — Jobs and promotion (builder or engineer, per the roadmap)

Recruit → **4 basic classes** (Fighter: melee + leadership; Ranger: ranged +
fletching; Wizard: magic + enchanting; Rogue: stealth + crime) → **8 master
classes** (concept §5.3, with Leadership replacing construction). Class skills
bank on re-training; the **Mastery rule** per R0's answers. Promotion stays a
Token rule and free.

## R3 — Content and tutorial (builder + owner)

- Tutorial: remove "Explore a Map" (`tutorialQuests.js`); re-check the chain
  still completes in a fresh game.
- The CMS's skill and job lists follow the registry (no hard-coded ids).
- **Owner CMS to-do**: re-point Logging content to Forestry (follows the id
  change on sync), retire the Oak Forest Map from the Shop, author the 4
  Academies (Wood or Stone Foundation build recipes, using the tiers from brief
  10 U5) and re-point or retire content on dropped skills.

**Done when (brief):** a fresh game plays the tutorial to the end; a Recruit
promotes to each basic class through its Academy, and on to a master class; a
hero holds 9 skills as a Recruit, 11 in a basic class (+ combat + advanced) and
13 in a master class (+ a second advanced + a master skill); tests pass and the
engine bench's work changes are accepted with reasons.
