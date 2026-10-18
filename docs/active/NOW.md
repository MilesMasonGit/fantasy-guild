# NOW — start here

*Updated 2026-10-17. One screen: what is next and where the project stands.
The state a fresh director resumes from is [HANDOFF.md](HANDOFF.md); the
wave's living table and the morning/evening summaries are
[STATUS.md](STATUS.md); finished work lives in git, the changelog and
`docs/archive/`.*

## Next

0. **Features director** ([HANDOFF_features.md](HANDOFF_features.md)): briefs
   100, 140, 110 and 120 and the Recruits' fight are built on a stack of
   branches, waiting for the bench and the owner's eye-check on
   http://localhost:5198/; next 170 quest boards, 130 recipe list.

1. **The art pass continues** ([HANDOFF.md](HANDOFF.md)): the owner's look at
   the ground structure (brief 180 G1, on `crunch/ground-g1`), then the Studio
   palette button and a Sync on `main`, then G2 (the owner's edge pieces).
   Terrain advice: https://claude.ai/artifact/PLTLkP5bqjLqtTc8YYJSpg
2. **Owner CMS to-do** (none urgent; `main` checked out, then Sync): the
   seedling sprite registration, re-accept the Starter Camp (Oak Seedling),
   map trade ratios, "Stands on" on real Tokens once a Dock or Sailboat
   exists, Base Maps. Minimise the desktop app once to see the frame counter
   stop.
3. Filler tickets T-167, T-186, T-187, T-189; then wave 3 from the briefs
   queue (100 style kit → 170 quest boards → 180 ground → 90 Envelope).

## Where the project is

- **Version** 0.8.x on `main`.
- **Crunch order:** UI rework ✓ → class rework v2 ✓ (engine) → hero bar and
  panel ✓ → offline progress ✓ → drag ✓ → deep optimization ✓ (cap128 at 4×
  from 35 % to ~76 % of frames in budget) → Atlas ✓ → terrain ✓ (T0–T4) → art pass (brief 85: names ✓, Gentle bake ✓, ground
  structure in progress) → wave 3 (briefs 100–170) →
  Performance Envelope ([briefs](briefs/README.md)).
- **Tests:** all green (~5010 on `main`; the file-scan tests time out only under load
  and pass alone). Anything red is new.
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
