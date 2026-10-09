# NOW — start here

*Updated 2026-10-08. Update this page at the end of every session. Keep it
under one screen: what's next first, finished work gone (it lives in git, the
changelog and `docs/archive/`).*

## Next

1. **Owner CMS to-do for brief 20** (the engine is merged; the live-game
   done-when waits on this content):
   1. Open the CMS once, check the trees read **Forestry**, and **Sync to
      Game with `main` checked out** (the sync commits `data/` onto the current
      branch). Then T-114 removes the temporary Logging→Forestry bridge.
   2. Author the **Wizard Academy** build recipe and the **Ranger** and
      **Rogue Academy** Tokens (art exists: `token_school_ranger` / `_rogue`;
      register the sprites), each with a Promotes rule and a Wood or Stone
      Foundation build recipe (minimum tier per brief 10 U5). Promotion is
      free unless you price it.
   3. **Eight master-class Tokens**, one per master class (Paladin, Knight,
      Beastmaster, Hunter, Necromancer, Scholar, Merchant, Assassin), built on
      Foundations like the Academies.
   4. Still open from brief 10: Foundation **Tier** on each Foundation, Shop
      group labels, minimum Foundation tier on building recipes, higher anvils'
      "Acts as: anvil, tool tier N".
2. **Owner eye-check, batch A: brief 30 on `crunch/hero-ui`** (H1–H4
   built and gate-green; nothing merges until seen). Run the branch:
   `git switch crunch/hero-ui` then `npm run dev`, your save or S2.
   1. Bottom bar: eight-hero spacing, one thin edge, no heavy shadow. Heroes
      collect "Leveled up X to N! (+n)" bubbles that stay; click a bubble to
      clear that hero's, click the hero to clear and open the panel.
   2. Hero panel: full height on the notification side, same place from the
      bar and from the Bank. Skills read "Mining 25/99" with a thin bar;
      class skills on top, Starting skills in a drawer, set-aside greyed,
      level-99 Advanced/Master skills starred. Esc or a mat click closes it.
   3. Hover a hero in the bar: a small gold gear. It opens that hero's work
      rules in the same box (one line per skill, Copy rules to… with a
      skipped-skills line). Opening a hero replaces the rules and vice versa.
   4. The flag: no gear, no "…" chip; hover shows outline, name and reach
      ring; "No work in range." still appears.
   Parked choices (built as listed; say if you want another): newest 3
   bubbles + "+N more"; bubbles clickable; panel overlays the mat edge
   (no mat refit); never-held skills not listed; gold ★ for mastered;
   rules replace the hero panel; long skill names truncate at narrow widths
   (the rules list cuts every name at 1024 wide).
3. **Owner eye-check, batch B: brief 40 on `crunch/offline`** (O1–O4
   built and gate-green; the engine half could merge alone but the bar is
   player-visible). Run the branch, then in a dev slot play a minute, close,
   and either wait or set the save's `savedAt` back a few hours: a
   "Catching up on 3 h away" bar covers the mat and fills; then the "While
   you were away" panel (Into the Bank, Made waiting on the mat, Spent,
   Level-ups, Tokens used up); Esc or the button closes it; under 2 min
   away shows nothing. The Time Bank is gone. Director rulings to confirm:
   cycle leftover carried (≈ +0.5 % live production); background browser
   tab keeps time quietly; mat loot shown under "Made, waiting on the mat".
4. **After the eye-checks:** merge both (T-120 then feeds the bar's bubbles
   from a catch-up), then brief 50 (drag deep-dive).
5. **Brief 20 live-game check** once the Academies and master Tokens exist.
6. **T-111**: engine bench timings are load-sensitive; trust the work check.

**Director notes (2026-10-08):** brief 20's four slices ran as one engineer
(R1) then three parallel builders in worktrees (R2a, R2b, R3) on Opus; every
report was checked against the code and the running game before merging, and
all held. Another session commits the ideas inbox (`docs/active/ideas.md`)
straight onto `main`; expect its commits between yours.

## Where the project is

- **Version** 0.8.x on `main`. Crunch prep is done: GDD, tickets, measuring
  tools and baseline ([PERFORMANCE.md](../reference/PERFORMANCE.md)), design
  interviews, and the briefs.
- **Crunch order:** UI rework ✓ → class rework v2 ✓ (engine) → hero bar and panel (built, eye-check) →
  offline progress (built, eye-check) → drag deep-dive → deep optimization → Atlas → terrain →
  Performance Envelope ([briefs](briefs/README.md)).
- **Tests:** all green (4095 passed, 3 skipped). Anything red is new.

## Ground rules during the crunch

- **Measure, don't fix** anything drawn (brief 30 too): one line per phase in
  PERFORMANCE.md's "UI rework cost log"; optimization comes later (brief 60).
- **Don't add expensive effects** to the mat (background blur, layout-shifting
  animation, heavy transparency over animation) without logging their cost.
- **Don't invest in what the Atlas replaces**: the bin, and resource spawners
  in the Shop.

## Design docs in flight

- [ui_rework_list.md](ui_rework_list.md): locked UI decisions and the owner's list
  (brief 30 still uses its hero bar, panel and work-rules sections).
- [design_pass_notes.md](design_pass_notes.md): owner taste notes for later.
- [concept_skill_and_class_rework_v2.md](concept_skill_and_class_rework_v2.md):
  read its amendments first.
- [concept_offline_progress.md](concept_offline_progress.md).
- [concept_atlas.md](concept_atlas.md): read its owner decisions first. The
  unfinished Atlas code is parked on branch `atlas-wip`.
