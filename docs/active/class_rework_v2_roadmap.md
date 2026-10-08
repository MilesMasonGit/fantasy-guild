# Class rework v2 — roadmap (brief 20, R0)

*Written 2026-10-08 by the R0 engineer, read-only pass over `main` at
`e1f9204d`. Source of truth: the concept's amendments
([concept](concept_skill_and_class_rework_v2.md)), then the brief
([20](briefs/20_class_rework_v2.md)). Owner answers to §D gate R2.*

## 0. What the brief and concept got wrong against the code

1. **The tutorial has no "Explore a Map" step any more.** Commit `f3691b8a`
   (on `main`) dropped it; the chain ends at Harvest Wheat. R3's tutorial item
   is done; only a fresh-game re-check remains.
2. **The Oak Forest Map is already gone from `data/`.** The CMS sync
   `e3f32fa8` (2026-10-07) deleted it with five other Tokens and emptied
   `data/maps.json`. The Shop sells **10** Tokens, not 11. GDD §3 (Maps and
   Explore), §5 (Shop list) and §12 are stale. Only the Map Token
   *Volcanic Island* is left, pointing at a map that no longer exists (Atlas
   territory; not this brief).
3. **"CMS content follows the Logging → Forestry id change on its next sync"
   is false without code.** The CMS works from its own workspace in browser
   storage, not from `data/`. If only the registry changes, the CMS shows
   "logging (not a skill)" in every skill picker and the next Sync to Game
   writes `logging` straight back. A two-sided content migration is needed
   (§C, R1). The repo already has this pattern (`effectMigration.js`: the
   game's loaders and the CMS store both run it).
4. **"No save migration: saves from another version are refused" only holds
   if the save schema version changes.** The check is
   `savedVersion !== GAME_VERSION` (`SaveMigration.js`), and `GAME_VERSION` is
   `'0.8.0'` in `src/state/StateSchema.js`. It is separate from the app's 0.8.x
   number and nothing bumps it automatically. Without a bump, today's saves
   load into the new game with stale heroes. Those heroes hold Logging and
   Explore, which nothing uses, and lack Forestry and Alchemy, so they cannot
   fell trees. Promoted heroes would sit on jobs that no longer exist (Cleric,
   Druid…). See question D1.
5. **Promotion is not free today.** Both shipped Academies author
   `chargeDelta: 0` with no moment, and `chargeDeltaOf`
   (`chargeMomentRegistry.js`) reads that as **−1** for a Promotes rule. Each
   promotion spends one of the Academy's 10 uses, and the 10th removes the
   Token. This is deliberate and pinned by `BoardPromotion.test.js` ("still
   costs ONE charge in the migrated shape"). GDD §4's "the Academies' unused
   `uses` count" is wrong. See D4.
6. **One Token promotes to one job.** `promotedJobOf` takes the first
   Promotes rule. The done-when "on to a master class" needs master-class
   promotion Tokens that nobody has specified. See D5.
7. **Under v2, basic classes get no skill gate by default.** The gate is "the
   job's listed skills that its parent also lists"
   (`getPromotionGateSkills`). A v2 basic class lists only its combat and
   advanced skill, which the Recruit doesn't list, so the gate is empty and
   any Recruit qualifies. Master classes gate on the parent's combat and
   advanced skill at 25, which is sensible. See D3.
8. Minor: the concept's header says v1 had "27 skills … 12 Signature"; the
   code has 29 (9 / 3 / 6 / 11). `ui_rework_list.md`'s Foundation-tier table
   says "Logging levels 1 / 45 / 90". That becomes Forestry.
9. **Not this brief, but found:** `docs/reference/TESTING.md` (Worktrees
   section, committed in `0621e6df`, lines 107–108) has a broken `mklink` line:
   `<wt>\node_modules` was written with `\n` turned into a newline, so it
   reads `<wt>` / `ode_modules`.

## The target (amendments applied)

| Layer (id) | Count | Skills | Who holds it |
|---|---|---|---|
| Starting (`starting`) | 9 | mining, **forestry**, fishing, smithing, crafting, cooking, farming, **alchemy**, construction | every hero, always |
| Combat (`combat`) | 4 | melee, ranged, magic, **stealth** | one per promoted hero |
| Advanced (`advanced`) | 4 | **leadership**, **fletching**, enchanting, crime | 1 at basic, 2 at master |
| Master (`master`) | 8 | faith, **trapping**, summoning, **taming**, commerce, science, armory, **shadowcraft** | one master class each |

Bold = new id or moved into this layer. **Dropped:** `logging` (renamed),
`explore`, `nature`, `occult`, `inscription`, `beastmaster` (as a skill;
it returns as a *job* id), `survival`, `brewing`, `astrology`,
`engineering`.

| Job | Tier | Lists (held = 9 Starting + these) |
|---|---|---|
| Recruit | 0 | the 9 Starting (cannot fight) |
| Fighter / Ranger / Wizard / Rogue | basic | melee+leadership / ranged+fletching / magic+enchanting / stealth+crime |
| Paladin, Knight (Fighter) | master | +enchanting+faith / +fletching+armory |
| Beastmaster, Hunter (Ranger) | master | +enchanting+taming / +crime+trapping |
| Necromancer, Scholar (Wizard) | master | +crime+summoning / +leadership+science |
| Merchant, Assassin (Rogue) | master | +leadership+commerce / +fletching+shadowcraft |

Dropped jobs: cleric, alchemist, warlord, zealot, druid, scout, conjurer,
astromancer, scientist, engineer. New: beastmaster, hunter, necromancer,
scholar. Each advanced skill is held by exactly 4 master classes (checked).

## A. Inventory: every place a skill id, job id or skill layer is read

**Good news first:** most of the engine already derives from the two
registries (`getSkill`, `isCombatSkill`, `COMBAT_SKILL_IDS`, `getJobSheet`,
`JOBS`). Job ids appear nowhere outside `jobRegistry.js`, tests and `data/`.
The hard-coded spots are listed below.

### Engine (`src/`)

| File | Today | Under v2 |
|---|---|---|
| `config/registries/skillRegistry.js` | 29 skills; `SKILL_LAYERS` FOUNDATION/COMBAT/SHARED/SIGNATURE; `FOUNDATION_/COMBAT_/SHARED_/SIGNATURE_SKILL_IDS`; `SKILL_CATEGORIES` names Foundation/Combat/Specialist/Signature; `HERO_SKILL_SLOTS = 6`; `RECRUIT_SKILL_SLOTS` | 25 skills, layers STARTING/COMBAT/ADVANCED/MASTER (ids `starting`/`combat`/`advanced`/`master`), exports renamed to match, category names Starting/Combat/Advanced/Master. `HERO_SKILL_SLOTS` goes (v2 lists are 2 or 4 wide). `forestry` keeps `sprite: 'assets/skills/skill_logging.png'` (no asset rename). New skills get emoji placeholders. |
| `config/registries/jobRegistry.js` | 19 jobs; `JOB_TIERS` RECRUIT/BASE/ADVANCED; lists 6 wide with foundation picks; `PROMOTION_COSTS` 10 / 25 | 13 jobs (table above); tiers RECRUIT/BASIC/MASTER; lists 2 / 4 wide (+ Starting picks only if D3 = B). Mastery helper (D2). Costs stay placeholders. |
| `systems/hero/PromotionSystem.js` | gate = carried-forward listed skills; banks what the new sheet drops; restores from bank | Unchanged logic, plus Mastery: never bank an Advanced/Master skill at level ≥ 99 (D2). `previewPromotion` must not list a mastered skill as "losing". |
| `systems/board/BoardPromotion.js` | reads the Promotes rule's job; price from `chargeDeltaOf` | Unchanged unless D4 = A (price default 0 lives in `chargeMomentRegistry.js`) or D5 = B (choice of job). |
| `config/registries/chargeMomentRegistry.js` `chargeDeltaOf` | Promotes with no authored moment costs 1 | D4 = A: costs 0 unless priced. |
| `systems/hero/HeroGenerator.js` | new hero = `getJobSheet('recruit')` | No edit: derives the 9 Starting. |
| `systems/hero/logic/HeroRehydration.js` | `restoreBankedFoundation` over `FOUNDATION_SKILL_IDS` | Rename import to the Starting list. Behaviour same. |
| `utils/CombatFormulas.js` | `getHeroCombatStyle`: a weapon's `skillRequired` counts only if `'melee'\|'ranged'\|'magic'` (hard-coded); one combat skill per hero from `COMBAT_SKILL_IDS` | Derive with `isCombatSkill`, so stealth weapons work. One-combat-skill rule stays: Mastery must exclude combat (D2). |
| `config/FormulaRegistry.js` `RPS_RULES` | melee > ranged > magic > melee; unknown style = neutral | Per D6: A = untouched (stealth neutral); B = a four-way cycle. |
| `config/registries/enemyProfile.js` `ENEMY_STYLES` | `['melee','ranged','magic']`, fills the CMS Style dropdown | Per D6: unchanged (A), or + `stealth` (B). |
| `systems/effects/ModifierAggregator.js` `_isParentOf` | `combat` covers `COMBAT_SKILL_IDS` | No edit: stealth joins automatically. |
| `systems/effects/constants.js` `TARGET_CATEGORIES` | lists LOGGING, EXPLORE, NATURE, OCCULT… (only `ALL`/`COMBAT` read in `src/`; tests read FISHING/MINING) | Rename LOGGING → FORESTRY, drop EXPLORE; the rest is T-093 territory. |
| `systems/board/FlagRules.js`, `Flags.js` | rule rows per held non-combat skill; Fight row if the hero can fight | No edit (derived). |
| `systems/board/WorkCheck.js`, `hero/SkillSystem.js` | possession then level | No edit. **This is where a dropped skill bites:** nobody holds it, so its Tokens show UNSKILLED (§B). |
| `systems/board/BoardRunner.js` | passes `config.skill` as the modifier category and XP target | No edit. |
| `systems/board/Shop.js` `sectionName` | heading = skill name, else the raw id | No edit. A `logging` section would show "logging". |
| `systems/quests/QuestManager.js` | reports `{ typeId, skill }` on cycles | No edit; the tutorial matches by `typeId`. |
| `systems/quests/tutorialQuests.js` | no Explore step; "Log an Oak Tree… let your Hero log 3 times" | Nothing required (verb still reads fine). Optional wording change is a director call. |
| `systems/effects/statementSlots.js` | skill options from `getAllSkills`; job options from `JOBS` (every job with a parent) | No edit: the CMS's skill and job pickers already follow the registries. |
| `systems/effects/statementText.js` | renders a skill/job name, or the raw id if unknown | No edit. |
| `systems/effects/statements.js` | `promotedJobOf`: first Promotes rule wins | D5 = B only. |
| `systems/core/ContentAudit.js` | checks a station's skill against **recipe pools** only; no check of `config.skill`, `recipe.skill`, `shop.section`, modifier `category`, or a Promotes `jobId` | Add "names a skill/job that does not exist" findings (R1), shared with the CMS audit like `workSkillRule.js`. |
| `systems/core/lifecycleAudit.js` | `foundation.skill` must be a real skill (reported) | No edit. |
| `systems/core/SaveMigration.js` / `state/StateSchema.js` `GAME_VERSION` | `'0.8.0'`, refuses any other | D1: bump the schema string. |
| `config/registries/recipePoolRegistry.js` | pools by `recipe.skill`; unknown skill = empty pool | Run the skill-id migration on load (R1). |
| `config/registries/tokenRegistry.js`, `effectRegistry.js` | loaders run `migrateAppliesTargets` | Also run the skill-id migration in the **JSON loaders** (not in `registerTokenTypes`: see R1). |
| `config/registries/mapRegistry.js` | comment calls Maps "Explore producers"; `data/maps.json` is `{}` | Not this brief (Atlas). |
| `config/DatabaseManager.js` | Vite globs only; no validation at all | No edit. |
| `config/registries/sprite-manifest.js` | `token_school_fighter`, `token_school_wizard` registered | Ranger/Rogue school art exists in `public/assets/tokens/promote/` but isn't registered. The owner registers them from the CMS (it writes this file; a code commit). |

### UI (`src/ui/`)

| File | Today | Under v2 |
|---|---|---|
| `components/board/hitAnimations.js` | `SKILL_HIT` keys `logging`…`explore`; `COMBAT_SKILLS = {combat, melee, ranged, magic}` | `forestry: 'shake'`, drop `explore` ('rustle' freed); alchemy plays nothing (director call; log in design_pass_notes). Combat set derived via `isCombatSkill` (stealth knocks back). |
| `components/base/SkillIcon.jsx` | `KNOWN_SKILL_SPRITES` hard-codes `logging`, `nature`, `occult`… | Drop the list or add `forestry`; the registry's `sprite` already wins. |
| `utils/AssetManager.js` `SKILL_MAP` | `logging: 'skill_logging'`, nature, occult, crime… | `forestry: 'skill_logging'`; drop retired ids. |
| `components/hero/HeroSkillSheet.jsx` | groups by `SKILL_LAYERS` + `SKILL_CATEGORIES` names | No edit (derived). The presentation is brief 30's. |
| `components/drawer/HeroInspectionSheet.jsx`, `dock/HeroDockTab.jsx`, `drawer/TokenInspection.jsx`, `board/heroBubbles.js`, `board/StationRecipeModal.jsx` | names via `getSkill` / `getJob` | No edit. |
| `modals/JobChangeModal.jsx` | tier labels "Base classes" / "Advanced jobs" via `JOB_TIERS.BASE/ADVANCED` | "Basic classes" / "Master classes". Its explainer text is still true. |
| `modals/PromotionCeremonyModal.jsx`, `hero/PromotionTrade.jsx` | job names, trade lists | No edit (D5 = B would redesign the ceremony). |
| `components/TestDashboard.jsx` | "Grant Melee/Ranged" dev buttons | Optional: + Magic / Stealth. |
| `components/base/TutorialAideOverlay.jsx` | `case 'tut_log'` | No edit (quest id unchanged). |
| `styles/main.css`, `tailwind.css` | `--color-explore`, `--color-nature`, `--color-occult`… | Unused anywhere; leave (cleanup ticket). |

### CMS (`cms/src/`)

| File | Today | Under v2 |
|---|---|---|
| `utils/constants.js` `SKILL_LAYER_LABELS` | **hard-codes** `foundation`/`combat`/`shared`/`signature` | ⚠️ `skillsByLayer()` only shows listed layers. Rename the layers without this and **every Starting/Advanced/Master skill vanishes from the CMS skill pickers** (Token Work Cycle, Foundation block, Recipe editor). Derive the labels from the game's `SKILL_CATEGORIES` (R1). |
| `utils/constants.js` `SKILLS` | from the game registry | No edit. |
| `stores/useEntityStore.js` | load paths `merge` / `migrate` / import each run the content migrations; recipes kept as `recipePools` **keyed by skill id**; Foundation block default `skill: 'construction'` | Add the skill-id migration on all three paths, including moving a `logging` recipe pool to `forestry`. The default stays valid. |
| `components/editors/LifecycleBlocks.jsx`, `RecipeEditor.jsx`, `TokenEditor.jsx`, `progression/*`, `engine/connectivityAuditor.js`, `engine/progressionRows.js` | read `SKILLS` / `skillsByLayer` | No edit. An unknown id shows as "x (not a skill)". |
| `components/editors/TokenEditor.jsx` | enemy style default `'melee'`; dropdown from `ENEMY_STYLES` | No edit. |
| `components/shared/GenerateModal.jsx`, `engine/contentGenerator.js` | legacy AI generator (mounted in `AppShell`): default skill `'nature'`, a hard-coded prompt list of retired skills | Default to the first registry skill; build the prompt list from `SKILLS` (R3). |
| `engine/recipeSync.js` | flattens skill-keyed pools; stamps a missing `skill` with the pool key | No edit (the migration moves the key). |

### Tests (`src/tests/`): what each group needs

- **`'logging'` as a fixture or hero skill: 59 files, ~180 lines**
  (`fixtures/testTokens.js` ×5, `FlagRules` ×27, `FlagSpritesRules` ×17,
  `HitAnimations` ×9, the EconSim group, the Mat* group…). A mechanical rename
  to `'forestry'`.
- **Data pins:** `LoggingChain.test.js` reads raw `data/tokens.json`
  (`config.skill === 'logging'`, `section: 'logging'`). Rewrite it to assert
  the **migrated** value, so it passes before and after the owner's sync. Also
  `QuestTutorialChain.test.js` (real data; it passes only if the game-side
  migration exists) and `ContentRules.test.js` "points every Works as
  statement at a skill the game knows".
- **The registry shape:** `SkillClassBaseline.test.js` (15 layer refs; the
  "explore is the new foundation Explore skill" test is deleted with the skill;
  "the deleted ids are gone" gets the v1 list), `HeroSystem.test.js` (8),
  `JobTree.test.js` (33 + 22: a rewrite to v2's rules), `ContentRules.test.js`
  (3), `FlagRules.test.js:400` (the Recruit's rule rows list `explore`).
- **The job tree:** `Promotion.test.js` (62 job refs; uses cleric, warlord,
  and leadership→faith banking), `RosterAndMarkets.test.js` ("Recruits hold
  the same six skills"; "a Merchant is the only job that brings Commerce": still
  true in v2; it lists v1 jobs), `PromotesRule.test.js` (alchemist, scout),
  `fixtures/renderCorpus.js` (alchemist), `FlagRules.test.js` (cleric),
  `BoardPromotion.test.js`, `PromotionCeremony.test.js`,
  `PromotionFieldMigration.test.js`, `FreeReadersById`, `Flags`,
  `FlagsCombatPromotionDisallow` (fighter/knight: these survive).
- **Combat:** `HitAnimations.test.js` ("every combat style is knocked back"
  lists three), and per D6 the RPS tests.
- **Untouched:** `EquipmentRequirements.test.js` uses `nature` as an opaque
  requirement id, with no registry lookup.

### Bench (`bench/`)

| File | Today | Under v2 |
|---|---|---|
| `fixtures.mjs` | fixture Token `skill: 'logging'`; `HERO_SKILLS = { logging: 30, mining: 30, alchemy: 30, smithing: 30, melee: 25 }`; heroes = `generateHero()` (Recruit) + those levels | Rename both `logging`s to `forestry` **together** (R1). |
| `scenarios/s7-waiting-room.mjs` | Foundation fixture with `skill: 'construction'`; builder hero `{ construction: 50 }` | No edit. |
| `lib/fingerprint.mjs` | `heroHash` includes the whole `hero.skills` map | This is why R1 shows WORK CHANGED (below). |

### Content (`data/`, scanned in full)

| Reference | Where | Under v2 |
|---|---|---|
| `config.skill: "logging"` | 11 Tokens: oak, fir, birch, maple, cedar, mahogany, ebony trees + fir, birch, maple, mahogany forests | → `forestry` via the migration, then the owner's sync |
| `shop.section: "logging"` | `token_oak_forest` | → `forestry` |
| `config.skill: "commerce"` | `token_shrimp_market` | Survives (Master; Merchant) |
| `foundation.skill` | `construction` ×2, `farming` ×1 | Survive |
| Promotes `jobId` | `effect_fighter_training`, `effect_wizard_training` | Survive |
| `enemy.style: "melee"` | 4 enemies | Survive |
| Recipes `skill` | smithing 10, cooking 7, construction 4, crafting 2, farming 2 | Survive |
| `explore`, any other dropped skill, any dropped job | **none** | nothing to retire |

Promotion Tokens today: Fighter's Academy (built on a Stone Foundation by
`recipe_muily2pe`, 10 Stone + 10 Oak Wood) and Wizard Academy (no way to get
it). Both carry `uses: 10`.

## B. Dropped-skill fallout

**In shipped content the fallout is small:** only `logging` (11 Tokens and
the Oak Forest's Shop section) is affected. No content names `explore`, any
other dropped skill, or any dropped job.

**At load, unknown ids are silent. Nothing throws.** `DatabaseManager` only
globs files, the registries return `null` for unknown ids, and every caller
survives that. Field by field, for content the owner hasn't re-pointed:

| Field naming a dropped skill/job | Boot | In play | CMS |
|---|---|---|---|
| Token `config.skill` | **silent** (ContentAudit doesn't check it) | No hero holds it, so `WorkCheck` returns UNSKILLED: the Token shows the unskilled mark and flags skip it. The inspection shows the raw id. | picker shows "x (not a skill)" |
| Station `Works as` skill | warns only if no recipe has that skill | Its pool is that skill's recipes; nobody can work it | as above; `ContentRules.test` fails |
| `recipe.skill` | silent | Unreachable unless a station names the same id | recipe pool under the old key |
| `foundation.skill` | **warns** (lifecycle audit: "not a real skill") | Nobody can build on it | Economy Audit names it |
| `shop.section` | silent | The Shop heading shows the raw id | — |
| Modifier `category` (rule scoped to a skill) | silent | Matches nothing; the rule is inert | sentence shows the raw id |
| Promotes `jobId` | silent | `jobFor` → null: the Token stops being a promotion Token | sentence shows the raw id |
| Item `requirements[].skill` | silent | Equip refused: "Requires x level n" | — |
| A saved hero's skills / job | — | Only if the save loads (D1). Dead skills sit on the sheet; a deleted job shows its raw id. | — |

**Plan:** R1 adds ContentAudit findings for the silent rows (one shared rule
module like `workSkillRule.js`, so the boot console and the CMS Economy Audit
name the same things). The owner then sees exactly what to re-point.
**Logging → Forestry** is handled by code (the migration), not by the owner
retyping 12 fields.

## C. Slices

Order: **R1 alone → (R2a ∥ R2b ∥ R3-code) → owner CMS work → R3 check.**
R1 touches ~70 files, so it must run alone. After it, R2a (jobs), R2b
(combat style) and R3-code (CMS generator, docs) touch disjoint files, so they
can run in parallel worktrees per TESTING. Timing verdicts from parallel bench
runs are noisy; the work check is not.

The bench's `--accept-work-change` needs a ticket: open one for R1 (e.g.
T-112, "class rework v2 skill registry").

### R1 — Skills and the two tables (builder, Sonnet; large)

**Why the job table moves here, not in R2:** v1 jobs list skills R1 deletes
(Ranger → nature, Scout → survival, Zealot → occult…). Keeping the v1 tree
alive through R1 means throwaway edits and a tree that isn't valid. The v2
job lists are fixed by the concept and need no owner answer, so R1 installs
the 13-job table. R2a does the promotion *behaviour*, which is where the
open questions are. R1 is one slice whose commits stay in this order:
registries → migration → sweep. It is green only at its end, because the
registry rename and the content migration are coupled: the tutorial's
"Log an Oak Tree" is uncompletable with either half alone. The director may
split it into two builder runs on the same branch, but they must merge
together.

**Files:** `skillRegistry.js`, `jobRegistry.js` (the 13 jobs and their lists,
`JOB_TIERS` RECRUIT/BASIC/MASTER, Recruit = Starting; the gate code
untouched), `HeroRehydration.js`, `CombatFormulas.js`
(`getHeroCombatStyle`), `hitAnimations.js`, `SkillIcon.jsx`,
`AssetManager.js`, `effects/constants.js`, a new `migrateSkillIds` beside
`effectMigration.js`, `tokenRegistry.js` / `recipePoolRegistry.js` /
`effectRegistry.js` JSON loaders, `ContentAudit.js` + a shared
`unknownRefRule.js`, `state/StateSchema.js` (`GAME_VERSION`, if D1 = A),
`cms/src/utils/constants.js` (derived layer labels),
`cms/src/stores/useEntityStore.js` (migration on all three load paths),
`JobChangeModal.jsx` (tier labels "Basic classes" / "Master classes"),
`bench/fixtures.mjs`, the ~60 `logging` test files, and the job-tree tests
(`JobTree`, `Promotion`, `RosterAndMarkets`, `PromotesRule`, `FlagRules`,
`fixtures/renderCorpus.js`) re-pointed at v2 jobs, GDD §4, CHANGELOG.

**Content migration spec** (`migrateSkillIds`, renames `{ logging: 'forestry' }`):
rewrite `config.skill`, `foundation.skill`, `shop.section`, every
statement's `payload.skill` and `payload.category`, `recipe.skill`, item
`skillRequired` and `requirements[].skill`, and in the CMS the `recipePools`
key. Idempotent; return the same object when nothing changes; leave unknown
ids alone (the audit names them). Run it in the JSON loaders, **not** in
`registerTokenTypes`. Otherwise test and bench fixtures would migrate
silently while their heroes still hold `logging`, and the bench would change
work for a bad reason. Remove it in a follow-up ticket once the owner's sync
has written `forestry` into `data/`.

**Tests first:**
- `SkillRegistryV2.test.js`: "has 25 skills: 9 starting, 4 combat, 4
  advanced, 8 master"; "the starting layer is exactly mining, forestry,
  fishing, smithing, crafting, cooking, farming, alchemy, construction";
  "combat is melee, ranged, magic, stealth"; "advanced is leadership,
  fletching, enchanting, crime"; "master is faith, trapping, summoning, taming,
  commerce, science, armory, shadowcraft"; "logging, explore and the dropped
  v1 skills are gone"; "forestry keeps the Logging sprite".
- `HeroSystem.test.js`: "a new Recruit holds the nine Starting skills at
  level 1, alchemy and construction included, and no combat skill".
- `JobTree.test.js` rewritten: "the tree is the Recruit, 4 basic and 8 master
  classes"; "each basic class lists its combat and advanced skill (Fighter
  melee + leadership, Ranger ranged + fletching, Wizard magic + enchanting,
  Rogue stealth + crime)"; "every combat skill belongs to exactly one basic
  class"; "a master class keeps its parent's two skills and adds one other
  advanced skill and one master skill"; "every master skill belongs to exactly
  one master class"; "every advanced skill is held by exactly four master
  classes"; "a hero holds 9, 11 and 13 skills by tier"; "every basic class
  branches into two master classes".
- `Promotion.test.js` re-pointed: "Recruit → Fighter → Paladin holds 13
  skills at their levels"; "re-training Paladin → Wizard banks melee,
  leadership and faith and keeps every Starting skill"; "a banked skill
  returns intact".
- `SkillIdMigration.test.js`: "rewrites logging to forestry in every field
  that names a skill"; "is idempotent and returns the same object when nothing
  changes"; "leaves unknown ids alone"; "the game loads data's Oak Tree as a
  forestry Token"; "the CMS store migrates on merge, migrate and import"
  (no-op storage per TESTING); "a Sync after migration writes forestry"
  (pattern: `WorkSkillAudit.test.js:147`).
- `ContentAudit.test.js`: "names a Token whose work skill does not exist";
  "… a recipe whose skill …"; "… a Promotes rule whose job …"; "… a rule
  scoped to an unknown skill"; "… a Shop section that is neither a skill nor
  general".
- CMS: "every registry skill appears in a skill-picker group" (guards the
  `SKILL_LAYER_LABELS` trap).
- `HitAnimations.test.js`: "forestry shakes"; "every combat style, stealth
  included, is knocked back".
- `CombatFormulas` / `SkillClassBaseline`: "an unarmed stealth hero fights
  stealth".
- If D1 = A: "a save written under the previous schema is refused".
- Rewrite `LoggingChain.test.js` → `ForestryChain.test.js` asserting the
  migrated values.

**Done when:** the suite is green, with no `it.fails` added for this. A fresh
game in the dev server: a Recruit's sheet shows 9 skills; the tutorial's
"Log an Oak Tree" completes on the real (still `logging`) data. The Change
Job planner lists 4 basic and 8 master classes. The CMS on a
throwaway route shows Forestry in the pickers and no "(not a skill)". Boot
console: no new ContentAudit findings on shipped data.

**Bench:** WORK CHANGED expected in **`heroHash` only**: the bench heroes'
skill maps lose `explore` and `logging` becomes `forestry`. `heroXp`,
`tokensHash`, `bankHash`, `spriteHash`, `binHash` and `randomDraws` should
be identical (`xpForLevel(1) = 0`; the bench already sets alchemy to 30). If
anything beyond `heroHash` moves, stop and diagnose.

### R2a — Promotion behaviour: gate, Mastery, free (builder, Sonnet; engineer if D5 = B)

**Files:** `jobRegistry.js` (D3 = B or C only: the gate),
`PromotionSystem.js` (Mastery in `promote` + `previewPromotion`),
`chargeMomentRegistry.js` (D4 = A), `BoardPromotion.test.js`,
`Promotion.test.js`, `PromotionCeremony.test.js`, GDD §4 Jobs, CHANGELOG.
With D5 = B also `statements.js` `promotedJobOf`, `BoardPromotion.js` and the
ceremony modal (an engineer job, plus the owner's eye-check).

**Tests first:**
- Mastery (D2 = A): "an advanced or master skill at 99 is never banked on
  re-training"; "a combat skill at 99 is banked as usual"; "a skill at 98 is
  banked as usual"; "the preview does not list a mastered skill as lost".
- Gate (D3): A: "a Recruit qualifies for any basic class with no skill gate";
  "a master class gates on its parent's combat and advanced skill at 25".
- Free promotion (D4 = A): "a Promotes rule with no authored price costs
  nothing". This deliberately rewrites the pinned "still costs ONE charge"
  test.

**Done when:** green suite. In the dev server with test fixtures (or the
console): a Recruit promotes on the Fighter's Academy to Fighter (11
skills), then on a fixture master Token to Paladin (13), then re-trains to
Wizard with the bank showing. The Academy keeps its uses (D4 = A). The Change
Job planner lists 4 + 8.

**Bench:** expected **same** (bench heroes are Recruits given skills
directly; no job is involved). Any WORK CHANGED means stop.

### R2b — Stealth in combat (builder; only if D6 ≠ A)

**Files:** `FormulaRegistry.js` (`RPS_RULES`), `enemyProfile.js`
(`ENEMY_STYLES`), RPS tests. **Tests first:** "the matchup table is the
owner's four-way cycle"; "every combat skill has one favoured and one
unfavoured matchup" (B); "the CMS Style dropdown offers stealth" (B).
**Done when:** green. **Bench:** same (every bench enemy and hero is melee).
With D6 = A there is no R2b: stealth is already neutral because an unknown
style scores 0.

### R3 — Content and tutorial (builder for code; owner for content)

- **Code (builder, can run beside R2):** `GenerateModal.jsx` /
  `contentGenerator.js` stop defaulting to `nature` and build the prompt's
  skill list from `SKILLS`. GDD §3/§5/§12 corrections (Oak Forest Map gone;
  Shop is 10). `ui_rework_list.md` Logging → Forestry. Tests: "the
  generator's default skill is a registry skill". Bench: same.
- **Tutorial:** already free of Explore. Re-check the full chain in a fresh
  game after R1 (dev server, loop driven per TESTING).
- **Owner CMS to-do** (checklist for the owner):
  1. Open the CMS once after R1 merges, check that the trees read Forestry,
     and **Sync to Game on `main`** (the sync commits `data/` onto whatever
     branch is checked out).
  2. Author the **Wizard Academy** build recipe, and **Ranger and Rogue
     Academy** Tokens (art exists: `token_school_ranger`/`_rogue`; register the
     sprites in the CMS), each with a Promotes rule and a Wood or Stone
     Foundation build recipe (minimum tier per brief 10 U5).
  3. Master-class promotion Tokens per D5.
  4. If D4 = B: set each Academy's Promotes price to 0.
- **Follow-up ticket:** remove `migrateSkillIds` once `data/` says `forestry`.

**Done when (brief):** a fresh game plays the tutorial to the end, and a
Recruit promotes to each basic class through its Academy and on to a master
class. The live-game half of this waits on owner content (items 2 and 3);
the engine half is proven by R2a's fixtures.

## D. Owner questions (one batch; each changes code)

**D1. Old saves.** The save check only refuses a save if the *save schema*
string changes (`'0.8.0'`, separate from the app's 0.8.x version).
- **A (recommended):** Bump the save schema in R1. Every older save, including
  your test save in slot 3, is refused with the existing "previous version,
  start a new game" message. This is what amendment 7 assumed.
- B: Don't bump. Old saves load with broken heroes (they hold Logging and
  Explore, lack Forestry and Alchemy, so can't fell trees; promoted heroes
  sit on deleted jobs).
- C: Write a converter for old heroes (contradicts amendment 7; costs a slice).

**D2. The Mastery rule.** Reaching 99 in an Advanced or Master skill
"unlocks it across classes". The CMS's pacing target expects about 55 hours
of focused work to take a skill to 99 (a design target, not a measurement).
- **A (recommended):** At level 99 an Advanced or Master skill is never banked
  again. It stays on the hero through every re-training, on top of the new
  class's skills, so a hero can hold more than 13. Combat skills are excluded
  (the combat engine runs on exactly one combat skill). Small: a few lines in
  promotion plus tests.
- B: Same, but Combat skills too. That needs a "which style do I fight with"
  rule and a UI to pick it, which is much bigger.
- C: Defer Mastery until the specialist-skill rework; ship banking only.

**D3. What a Recruit needs to qualify for a basic class.** Under v2 the
current rule produces no skill gate (master classes still gate on the parent's
combat and advanced skill at 25).
- **A (recommended):** No skill gate. Building the Academy (its materials and
  its Construction level) is the gate, matching "price is the only gate". Zero
  code: it falls out of the existing rule. Trade-off: a fresh Recruit can
  promote as soon as the Academy stands.
- B: Each basic class names two Starting skills that must reach 10 (as today:
  "promotion pays off work already done"). You'd pick the pairs, e.g. Fighter
  Mining + Smithing, Ranger Forestry + Crafting, Wizard Alchemy + Cooking,
  Rogue Fishing + Crafting.
- C: Any one Starting skill at 10 (small new code).

**D4. Making promotion free.** Today each promotion spends one of the
Academy's 10 uses; the 10th promotion removes the Academy.
- **A (recommended):** Change the engine so a Promotes rule costs nothing
  unless its author sets a price. Both Academies, and every new one, become
  free and never wear out. You can still price one later in the CMS.
- B: Keep the engine; you set each Academy's price to 0 in the CMS, one by one.
- C: Keep the one-use cost (not free).

**D5. How a hero reaches a master class.** One Token promotes to one job
today, and no master-class Token exists.
- **A (recommended):** Eight separate Tokens, one per master class, built on
  Foundations like the Academies (your CMS content; no engine work). Until they
  exist, the engine is proven with test Tokens.
- B: Each basic Academy offers both of its master classes, and the promotion
  ceremony asks which. Engine and ceremony work; the new ceremony waits for
  your eye-check.
- C: Defer master-class Tokens; this brief proves only basic classes in the
  live game.

**D6. Where Stealth sits in the combat triangle** (today Melee beats Ranged,
Ranged beats Magic, Magic beats Melee: +10 % damage, +7 to hit). No ranged or
magic enemy ships yet, so the triangle never triggers today whatever you pick.
- **A (recommended):** Stealth sits outside the triangle: even against all
  three, the triangle unchanged, enemies stay melee/ranged/magic. Stealth's
  own identity (crits, dodging) comes with the specialist-skill rework. No code.
- B: A four-way cycle: Melee > Ranged > Magic > Stealth > Melee. Opposites
  (Melee–Magic, Ranged–Stealth) are even, so today's Magic > Melee becomes
  even. Enemies can be authored as Stealth.
- C: Stealth breaks the symmetry on purpose, e.g. beats Magic, loses to
  Melee (some style then wins twice).

**D7. What the specialist skills do in this brief.**
- **A (recommended):** Placeholders. The 4 Advanced and 8 Master skills
  (Crime, Commerce, Shadowcraft, Trapping…) ship as names, descriptions and
  placeholder icons. They work like any skill (Tokens and recipes that name
  them; XP; levels) with no new mechanics. Stealth fights through the shared
  combat engine like the other three styles. Their mechanics come with your
  specialist-skill rework.
- B: Also build Stealth's combat identity now (critical hits are stubbed at
  0 and dodging doesn't exist): an engineer slice plus balance.
- C: Also build one Master skill's board mechanic now (e.g. Taming's
  autonomous workers): a brief of its own.

## D. Owner rulings — 2026-10-08

| Q | Ruling |
|---|---|
| D1 | **B**: no schema bump, no converter. Saves are test saves; the owner always starts a new game to test. |
| D2 | **A**: at 99 an Advanced or Master skill is never banked again; combat skills excluded. |
| D3 | **B** with the suggested pairs at level 10: Fighter Mining + Smithing; Ranger Forestry + Crafting; Wizard Alchemy + Cooking; Rogue Fishing + Crafting. |
| D4 | **A**: a Promotes rule costs nothing unless its author sets a price. |
| D5 | **A**: eight master-class Tokens, owner content; engine proven with test Tokens. |
| D6 | **B**: four-way cycle Melee > Ranged > Magic > Stealth > Melee; opposite pairs even. R2b runs. |
| D7 | **A**: specialist skills are placeholders. |

Bench accept ticket for R1: **T-113**. Follow-up to remove `migrateSkillIds`: **T-114**.

## Notes for the director

- **Brief 30 boundary:** R1/R2 change labels only (layer names, tier names).
  The collapsible Starting drawer and class-skills-on-top layout (concept §2)
  are brief 30's; the hero-bar overhaul notes in `design_pass_notes.md` are
  untouched.
- **Alchemy hit animation:** with Explore gone, 'rustle' is free, but alchemy
  has no content yet; R1 leaves alchemy with no animation. Log it in
  `design_pass_notes.md` for the owner's next pass.
- **Job icons and new skill icons** are emoji placeholders; Forestry reuses
  the Logging sprite. List them for the owner.
- `PROMOTION_COSTS` (10 / 25) stay placeholders.
