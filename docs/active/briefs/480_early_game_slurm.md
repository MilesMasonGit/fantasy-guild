# Brief 480 — The very early game, and Slurm the guide

*Written 2026-11-04 by the planning agent from the owner's interview of the same day.
Concept: [concept_tutorial_npc.md](../concept_tutorial_npc.md): read it whole; the owner's wish is what counts.*

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, `docs/reference/UI_STYLE.md`, GDD §1, §5, §7 and §8,
[concept_tone_and_world.md](../concept_tone_and_world.md), [concept_progression_ledger.md](../concept_progression_ledger.md),
brief 200 (change packs), `docs/active/research/gating_player_journey_2026-10-28.md` (Act 1).

Code to start from (verify): `src/systems/quests/tutorialQuests.js`, `tutorialText.js`, `QuestManager.js`,
`src/systems/atlas/StarterCamp.js`, `EngineBootstrap.js`, `src/systems/board/BoardRunner.js`, `Flags.js`,
`src/systems/effects/toolNames.js`, `src/systems/inventory/`, `src/systems/progression/ledger/`, `cms/src/`, the QA panel in `src/ui/dev/`.

## Needs

- **Brief 450 S4** (the new game screen and first hero): L3 adds its lessons switch there.
- **Brief 410** (the new Shop and Foundations): lesson 6 teaches them.
- L1 needs nothing and may run early.

*Note (owner, 2026-11-04): the Workbench may become a Workshop, one building per skill ([content_construction.md](../content_construction.md)). Use whatever Crafting's building is called when this runs.*

## Phases

| Phase | What | Tier |
|---|---|---|
| L1 | **Tools that break.** Nothing breaks in the game today, so this is new. A tool item may have a chance to break per cycle, authored in the CMS. When it breaks, one is gone: the hero stops, with the yellow idle alert (brief 340's wording if it has landed), and a short callout; the Bank's spare isn't auto-equipped unless orders already do so, and say which. ⚠️ Any random draw must play the same in live play and a catch-up, by the engine's existing rule. ⚠️ A catch-up: a hero whose tool breaks while away just stops, and the summary says so if it's simple (brief 440's news column). Fishing's and combat's use of tools and weapons counts as a cycle or a swing: say which you chose for the Rusty Sword. Tooltip and encyclopedia say the chance. No content uses it yet, so **engine work stays same**. | engineer |
| L2 | **The opening's content**, as a **CMS change pack** for the owner to review (brief 200; never `data/`). **Scrap Heap** Token near the Hall: worked bare-handed, gives the Rusty Woodaxe, Rusty Pickaxe and Rusty Sword at a good chance, rests and refills. **Those three items**: as copper, with a 1 % break chance. **A small slime** near the Hall, safe with the Rusty Sword and berries as food. **Redberry Bushes** needing no tool; check them. **An empty Bank** in the Starter Camp. **Smithing**: the copper ingot first at level 1, then a recipe per level (dagger 2, woodaxe 3, the pickaxe soon after; the rest of copper simply and say so), with XP set so each level comes after a short stretch rather than today's 83 ingots. **Ring 1's prices** that lead through copper and Goblin drops. Stand-in sprites where the owner has no art. **A QA button** gives the old full kit (code, not content). ⚠️ **The ledger reads it all**: report the Starter Camp's budget against its 30 minutes before and after; reach still finds everything; a heap on rest must not read as a dead end. ⚠️ Nothing may strand a player: a new game with every tool broken still gets back. **Expect WORK CHANGED**; explain it. | builder |
| L3 | **Slurm** (no lessons yet). A look first: Slurm at two or three whole-number scales over the mat's bottom right, with the bubble and minimised state, on a busy mat; the owner picks. Then built: **popping out** when it has something to say and back when done; **the bubble stays until the step is done**; **minimise** shrinks Slurm into the corner and the bubble to a small "...", and a click brings it back; hard pixel throughout (brief 460). ⚠️ It sits over the mat, so everything outside its own art must take clicks and drags as usual, and a Token under it stays reachable: say how. It keeps clear of the hero bar, the pop-up Shop (410) and the item stubs. **Hard gold outline** on whatever a step names: a Token, a nav bubble, a Bank item or a Hall star, using the existing attention outline. Its cost is nil when no lesson is on. **The switch** on the new game screen (brief 450 S4): lessons on or off, on by default. | builder |
| L4 | **The lessons** (the concept's list, in that order). Every word in one file, as `tutorialText.js` does, in the voice in the concept, for the owner to edit; the steps' first words proposed by the builder. **Guides, never locks**: nothing is disabled, and a step done early just counts and moves on. **No rewards.** The old 12 quest steps and their Token go, with T-258's step. After lesson 8, Slurm shows the world map and names the one big goal, **settling a place**, until it's done. **Slurm stays afterwards**: a small way to speak at a big moment, with the first settle as its first use; list the moments you'd suggest, and add no others. ⚠️ **Lessons must survive** a save, a catch-up, a reload and travel. Progress counts from the engine's own events. **Old saves** keep working: a save in the middle of the old tutorial doesn't get stuck; say what it sees. Lessons off gives the same start with no bubbles or outlines. Propose whether the words go in the CMS (T-014), and don't build that here. | engineer |

L1, then L2 (after the owner's Sync, L3 and L4 can show the real opening). L3, then L4. Not beside another WORK CHANGED.

## Done when

- Gate green (`TESTING.md`). L1 and L3: engine work **same**. L2 and L4: changes explained and accepted by the director.
- In the running game, named as verified: **a whole new game, with no dev tools**: name, hero, each of the eight lessons, about 10 minutes
  by the clock, the world map's goal, then settling. The same with lessons off. Doing steps out of order; minimising; closing the game mid-lesson
  and returning; a tool breaking while working and while away; every tool broken and still recoverable; the heap resting; the slime
  fight won with berries; the QA kit button; an old save, mid-tutorial and past it. At 1366 and 1920, with Slurm's corner on a busy mat and a
  panel open.
- Tests for breaking (live and catch-up the same), lesson order and saving.
- `bench:draw --compare` once per eye-check batch.
- GDD §1, §5, §7 and §8, `concept_quests_tutorial.md` and `owner_art_list.md` updated.
- **Eye-checks**: the Slurm scale pick; one full play after L4, where the owner edits Slurm's words, judges whether it's about 10 minutes, and
  whether the whole camp visible beside a large Slurm is too much.

## Not in this brief

The rest of copper's order and the rule past copper (the metal and gear session). The quest board (T-176). Slurm's later lines beyond the
first settle. A hint system.

## Owner to-do

Review the opening's pack in the CMS, then Sync on `main`. Pick Slurm's scale. Edit its words at the look. Draw the scrap heap, three rusty
tools, and a small slime if the slime folder has none that fits, when ready; stand-ins until then.
