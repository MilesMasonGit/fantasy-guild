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
   - **Atlas A11, no tier labels, on `crunch/atlas-a11` (eye-check, text).**
     The recipe picker now says "Needs a Marble Foundation or better" and
     "Beside a Mythril Pickaxe or better"; rules sentences name the tool
     instead of "Tier 3". **Owner step:** the Token inspection's "Acts as a
     Tier 2 pickaxe" is CMS-written text in `data/`; a patch for the CMS
     composer is parked in the director's scratchpad; once applied on the
     branch, you run Sync to Game **on that branch** so the round-trip tests
     go green, then it merges. Parked wording choices are in the A11 report
     (director has them).
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

**Status (2026-10-10):** merged to `main`: Atlas A1, A2, A3a (demolition
engine), A4, A5, A7 (Starter Camp as content; its sites count toward the cap),
A9, T-129, brief 50, brief 60 P1 (plan) and P2-1 (cycle ring: cap128 at 4×
from 35 % to 52 % of frames in budget). **Awaiting the owner's eye-check on
their branches:** A6 Atlas screens (`crunch/atlas-a6`, M1), A10 fixed vs
movable Tokens with the marker (`crunch/atlas-a10`, M2), A11 no tier labels
(`crunch/atlas-a11`, needs the owner's CMS sync on the branch). **Building:**
brief 60 P2-2 (beacon), P2-3 (sprite clock), P2-4 (shut notification
column). **Then:** P2-5 hit-loop layers (spike), P2-6 loot, P2-7 sparse
stack order, P2-8, P2-9; Atlas A3b (the bin goes), A8 (cartographer's
tutorial), A12 (upcycling); brief 80 terrain; brief 90 Envelope.
`data/maps.json` is read by nothing now: delete it in a data-only commit.
**Owner CMS to-do:** from A5, author the 3 Base Maps and 4 Modifiers in the
Maps tab, put maps on enemy Drops, delete the Volcanic Island Map Token,
commit the two edited map pictures from `atlas-wip`; from A2, Respawns
refill (10–15 s) on the veins and outcrops, Oak Tree regrows from Oak
Sapling, the Shrimp Coast too; from A7, author the 25 endgame-site Tokens
(Landmark checkbox in the Token editor's Lifecycle section), lay out the camp
with the QA panel's Starter Camp tools, "Save this mat as the Starter Camp",
accept it on the CMS Starter Camp tab, Sync.

**Handoff (2026-10-09, director session hit its usage limit; superseded above):**
- Merged to `main` today: brief 50 (drag), T-129 (carried Token pauses),
  brief 70 A9 (ambush rules). Suite green except `TerrainRegistry.test.js`,
  which reads the owner's half-moved terrain art on disk (owner's area).
- **Ready to verify and merge, unmerged:** Atlas **A1** on `crunch/atlas-a1`
  (worktree `.claude/worktrees/atlas-a1`): Regions, travel, save schema
  0.8.1, cap 128; the agent reports 4297 tests green and same work. Run the
  gate yourself, merge, push. Its parked questions: bump the app version to
  0.8.1 at the Atlas milestone (recommended) and loot banked on leaving
  counts for collect quests (built).
- **Still running when the session ended:** Atlas **A4** pure modules on
  `crunch/atlas-a4` (worktree `atlas-a4`; told to record node biomes and a
  cell terrain map per the terrain-grid ruling f39323f8) and brief **60 P1**
  on `crunch/optimize` (worktree `o6`; told to plan for caps 128 and 256).
  Their reports land in their worktrees' branches; read the branch log and
  verify as usual.
- Next after those: A2 (respawning fixtures) then A3a (demolition job) on
  the A1 line; brief 60 P2 fixes in ranked order; the Atlas UI slices need
  eye-checks. Leftover worktree folders `d`, `t129`, `atlas-a9` are pruned
  from git but busy on disk; delete when free.

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
