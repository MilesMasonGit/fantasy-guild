# NOW — start here

*Updated 2026-10-13. One screen: what is next and where the project stands.
The state a fresh director resumes from is [HANDOFF.md](HANDOFF.md); the
wave's living table and the morning/evening summaries are
[STATUS.md](STATUS.md); finished work lives in git, the changelog and
`docs/archive/`.*

## Next

1. **Wave 1, finishing (director, from 2026-10-13):** verify and merge the
   brief 60 leftovers (P2-3, P2-5, P2-6), the Atlas eye-check batch
   ([eyecheck/2026-10-13_atlas-m1-m2.md](eyecheck/2026-10-13_atlas-m1-m2.md):
   A6, A10, A3b, A11, with the owner's preview-branch notes folded in), then
   P2-7, P2-8, P2-9 two at a time, then Atlas A8 and A12. Order ruled by the
   owner 2026-10-13.
2. **Regroup** after wave 1 and before brief 80: read the planning docs
   (already on `main`), apply the lessons in HANDOFF.md, plan wave 2 (brief
   80 terrain with the owner's new spritesheets and the terrain-grid ruling
   f39323f8, then brief 90 Envelope), start a fresh director.
3. **Owner CMS to-do** (the engine waits on this content; do it with `main`
   checked out, then Sync to Game):
   - Brief 20: check the trees read **Forestry** and Sync (then T-114 removes
     the Logging→Forestry bridge); the Wizard Academy recipe, the Ranger and
     Rogue Academy Tokens, the eight master-class Tokens; brief 10's
     Foundation Tier, Shop group labels, minimum Foundation tier on recipes,
     higher anvils' "Acts as".
   - Atlas: from A5 the 3 Base Maps and 4 Modifiers, maps on enemy Drops,
     delete the Volcanic Island Map Token, commit the two edited map pictures
     from `atlas-wip`; from A2 Respawns (10–15 s) on veins and outcrops, Oak
     Tree regrows from Oak Sapling, the Shrimp Coast too; from A7 the 25
     endgame-site Tokens (Landmark checkbox), lay out the camp with the QA
     panel's Starter Camp tools, accept it on the CMS Starter Camp tab.
   - A11: apply the CMS description-composer patch
     (`a11_cms_description_composer.patch`) and Sync **on `crunch/atlas-a11`**
     so the round-trip tests go green; then it merges.
4. **Brief 20 live-game check** once the Academies and master Tokens exist.
5. Parked: **T-111** engine bench timings are load-sensitive; trust the work
   check. `data/maps.json` is read by nothing: delete it in a data-only commit.

## Where the project is

- **Version** 0.8.x on `main`.
- **Crunch order:** UI rework ✓ → class rework v2 ✓ (engine) → hero bar and
  panel ✓ → offline progress ✓ → drag ✓ → deep optimization (P2-1, 2, 4 merged:
  cap128 at 4× from 35 % to ~68 % of frames in budget) → Atlas (A1, A2, A3a,
  A4, A5, A7, A9 merged; A6, A10, A3b, A11 at eye-check) → terrain →
  Performance Envelope ([briefs](briefs/README.md)).
- **Tests:** all green (4651 at `crunch/preview`; two file-scan tests time out
  only under bench load). Anything red is new.
- **Process (owner, 2026-10-13):** four tiers in `.claude/agents/`, two code
  agents at once, benches only in the owner's downtime, STATUS.md and
  HANDOFF.md, eye-check files; the rules are in `CLAUDE.md`.

## Ground rules during the crunch

- **Measure, don't fix** anything drawn outside brief 60: one line per phase
  in PERFORMANCE.md's cost log.
- **Don't add expensive effects** to the mat without logging their cost.
- **Don't invest in what the Atlas replaces**: resource spawners in the Shop.

## Design docs in flight

- [ui_rework_list.md](ui_rework_list.md): locked UI decisions.
- [design_pass_notes.md](design_pass_notes.md): owner taste notes for later.
- [concept_skill_and_class_rework_v2.md](concept_skill_and_class_rework_v2.md):
  read its amendments first.
- [concept_offline_progress.md](concept_offline_progress.md).
- [concept_atlas.md](concept_atlas.md) and [atlas_roadmap.md](atlas_roadmap.md)
  (owner answers at the top of §D). Unfinished old Atlas code is parked on
  branch `atlas-wip`.
- **Post-crunch plan** ([ideas.md](ideas.md)) and the nine design interviews
  of 2026-10-09 (`concept_tone_and_world`, `concept_progression`,
  `concept_combat`, `concept_skill_loops`, `concept_knowledge`,
  `concept_guild_hall`, `concept_living_game`, `concept_quests_tutorial`,
  `concept_release`). Not for the crunch, except that brief 70 reads
  `concept_progression.md`, `concept_skill_loops.md` and
  `concept_quests_tutorial.md` first.
