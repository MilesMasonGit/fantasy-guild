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
2. **Eye-check summary for the owner's return** (everything below is on
   `main`; look in your save, then tell the director what to change):
   - **Brief 40, third pass of the away summary** (not yet seen): Item Bars
     with the hover zoom and `5.9k` → `5,900` on hover; headings Items
     produced / Items banked / Items spent / Level-ups / Tokens used up /
     Heroes wounded / Fights won; "Return to the Guild" above "Load as I
     left it"; a Confirm / Cancel question before the undo.
   - **Brief 30** merged as seen (2026-10-08); your held-back tweaks go to
     the design pass.
   - **T-120 merged** (director ruling): the hero bar shows the level-ups a
     catch-up produced, background-tab catch-ups included.
   - **Brief 70 A0, the Atlas roadmap** ([atlas_roadmap.md](atlas_roadmap.md))
     is on `main` with **12 owner questions in its §D** (Starter Camp sites
     and the cap, who lays out the Starter Camp, first Base Maps and
     Modifiers, where Maps are authored, old saves, what moves and demolishes,
     vein refill, returning to a Region, Cartography numbers, upcycling,
     tools-as-gear timing, the parked `atlas-wip` work). **Answered by the
     owner 2026-10-09** (table at the top of §D; D-1, D-4, D-6 and D-9 differ
     from the recommendations). The Atlas builds after brief 60 per the crunch
     order.
   - **Brief 50 merged** (owner felt the drag 2026-10-09 and kept the flag
     cloth rule, T-130 closed). Still parked: **T-129** should a carried
     Token pause work and fights so it cannot vanish in your hand?
   - Entries are added here as overnight phases land.
3. **Overnight run (owner asleep, 2026-10-08):** the director continues the
   crunch order (50 drag → 60 optimization → 70 Atlas → 80 terrain → 90
   Envelope). Anything look-changing stays on its branch until seen, except
   what the owner already ruled on in words.
4. **After the crunch (owner, 2026-10-08):** a review of how this director /
   subagent workflow is working, and whether to fold in the planning docs the
   owner has been writing with another agent for the next pass. Discuss once
   the current work is wrapped up.
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
- **Crunch order:** UI rework ✓ → class rework v2 ✓ (engine) → hero bar and panel ✓ →
  offline progress ✓ → drag deep-dive → deep optimization → Atlas → terrain →
  Performance Envelope ([briefs](briefs/README.md)).
- **Tests:** all green (4211 passed, 3 skipped). Anything red is new.

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
- **Post-crunch plan** ([ideas.md](ideas.md)): the owner's ideas in stages, and
  nine design interviews done 2026-10-09 (`concept_tone_and_world`,
  `concept_progression`, `concept_combat`, `concept_skill_loops`,
  `concept_knowledge`, `concept_guild_hall`, `concept_living_game`,
  `concept_quests_tutorial`, `concept_release`). Not for the crunch, except:
  brief 70 must read `concept_progression.md`, `concept_skill_loops.md` and
  `concept_quests_tutorial.md` first (its top lists what they change), and Stage A's small items.
