# Brief 480 — The very early game, and Limes the guide

*Written 2026-11-04 by the planning agent from the owner's interview of the same day.
Concept: [concept_tutorial_npc.md](../concept_tutorial_npc.md): read it whole; the owner's wish is what counts.
The guide is named Limes (owner, 2026-11-05, was Slurm); the sprite file stays `e_slurm.png`.
**Updated 2026-11-10** for the concept's 2026-11-09 section: Limes lives on the Starter Camp mat, not in a corner
portrait, with hover blurbs across the UI (L3 rewritten). L1 is merged.*

**Rulings (owner, 2026-11-10).** **A lesson step opens Limes's bubble by itself**, and it stays until the step is
done; it **collapses to a small speech bubble with "…"**, and a click opens it again. **Limes can be moved**: dragged
like a Token, though it is not one. **Limes stays at the Starter Camp** when the guild goes elsewhere. **Off the mat**
(the Guild Hall, the world map), a lesson speaks **through that screen's small hover-blurb Limes**.

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
- **Brief 570** (the inspection drawers): L3 puts hover-blurb Limes in the drawers it builds, so L3 comes after it.
- **Brief 560** (one standard reach): L2's ledger budget is read after it.
- L1 needs nothing and may run early.
- **The buildings** (owner, 2026-11-05): L2 and L4 wait until content planning has settled them (T-307), so the guide teaches the real buildings the first time. L3 is a framework with placeholder words and does not wait.

*Note (owner, 2026-11-04): the Workbench may become a Workshop, one building per skill ([content_construction.md](../content_construction.md)). Use whatever Crafting's building is called when this runs.*

## Phases

| Phase | What | Tier |
|---|---|---|
| L1 | **Tools that break.** Nothing breaks in the game today, so this is new. A tool item may have a chance to break per cycle, authored in the CMS. When it breaks, one is gone: the hero stops, with the yellow idle alert (brief 340's wording if it has landed), and a short callout; the Bank's spare isn't auto-equipped unless orders already do so, and say which. ⚠️ Any random draw must play the same in live play and a catch-up, by the engine's existing rule. ⚠️ A catch-up: a hero whose tool breaks while away just stops, and the summary says so if it's simple (brief 440's news column). **The check happens only when a cycle completes**, combat's included (owner, 2026-11-05: the swing is just art; nothing breaks or is used mid-cycle). Planning agent's default for a weapon that breaks in a fight: the hero finishes that fight bare-handed, then stops with the alert. Tooltip and encyclopedia say the chance. No content uses it yet, so **engine work stays same**. | engineer |
| L2 | **The opening's content**, as a **CMS change pack** for the owner to review (brief 200; never `data/`). **Scrap Heap** Token near the Hall: worked bare-handed, gives the Rusty Woodaxe, Rusty Pickaxe and Rusty Sword at a good chance, rests and refills. **Those three items**: as copper, with a 1 % break chance. **A small slime** near the Hall, safe with the Rusty Sword and berries as food. **Redberry Bushes** needing no tool (today's data asks for none), with **Thorns at a 10 % chance per cycle** instead of every time (owner, 2026-11-05; a new hero has 10 HP). ⚠️ Check the CMS can state a chance on that effect and that nothing else shares it; stop and report if not. **The lessons' prices**: Bunk Beds' first rank now buys a second hero and is no longer free; it, the Wood Foundation and the crafting building stay within the concept's couple of minutes. **Lesson 7's craft**: the simplest useful level 1 recipe made from wood (Charcoal today); say which. **An empty Bank** in the Starter Camp. **Smithing**: the copper ingot first at level 1, then a recipe per level (dagger 2, woodaxe 3, the pickaxe soon after; the rest of copper simply and say so), with XP set so each level comes after a short stretch rather than today's 83 ingots. **Ring 1's prices** that lead through copper and Goblin drops. Stand-in sprites where the owner has no art. **A QA button** gives the old full kit (code, not content). ⚠️ **The ledger reads it all**: the Starter Camp's budget becomes **about 40 minutes** (owner, 2026-11-05; was 30): set it, and report before and after; reach still finds everything; a heap on rest must not read as a dead end. ⚠️ Nothing may strand a player: a new game with every tool broken still gets back. ⚠️ **Seedlings are open** (owner, 2026-11-05: how seedlings, Forests and trees balance is still for discussion): an empty Bank plus the Forest's spending can leave stumps with no seedling. Bring the numbers to the owner; don't settle it alone. **Expect WORK CHANGED**; explain it. | builder |
| L3 | **Limes, the framework** (placeholder words; the lessons are L4). **On the Starter Camp mat**: Limes (`e_slurm.png`, a whole-number scale) starts in the bottom-left corner; the player can drag it anywhere on that mat. It is **not a Token**: nothing works it, it is not counted in the mat's cap, its spot is saved, and it shows only at the Starter Camp. **Click it to talk**: a speech bubble above it with a multi-step conversation (Next, Close). **The bubble can open by itself** (what L4's steps use) and stays until told to close; it **collapses to a small "…" bubble**, and a click opens it again. **Hover blurbs**: small Limes sprites at key points of the Bank, the Shop, the world map, the Guild Hall upgrades and the Hero drawer (brief 570); hovering one shows a blurb on that screen's basic mechanic; the builder drafts every blurb and conversation line in one file, as `tutorialText.js` does, for the owner to edit, and proposes any further spots without adding them. **A screen's small Limes can carry a step** (L4 uses it off the mat): it glows and its blurb opens. **Settings**: a switch hides the hover-blurb Limes; one carrying a live step still shows. The new game screen's lessons switch (on by default) is separate and also built here. **Hard gold outline** on whatever a step names (a Token, a nav bubble, a Bank item, a Hall star), using the existing attention outline. A look first: Limes at two whole-number scales on a busy Starter Camp, with the bubble open and collapsed; the owner picks. ⚠️ Limes takes clicks only on its own art and bubble: everything else on the mat still takes clicks and drags, and a Token under it stays reachable; say how. It keeps clear of the hero bar's bubbles and the fight tabs; the pop-up Shop may cover it. Its cost is nil when nothing is shown. | builder |
| L4 | **The lessons** (the concept's list, in that order). Every word in one file, as `tutorialText.js` does, in the voice in the concept, for the owner to edit; the steps' first words proposed by the builder. **Guides, never locks**: nothing is disabled, and a step done early just counts and moves on. **No rewards.** The old 12 quest steps and their Token go, with T-258's step. After lesson 8, Limes shows the world map and names the one big goal, **settling a place**, until it's done. **Limes stays afterwards**: a small way to speak at a big moment, with the first settle as its first use; list the moments you'd suggest, and add no others. ⚠️ **Lessons must survive** a save, a catch-up, a reload and travel. Progress counts from the engine's own events. Lessons off gives the same start with no bubbles or outlines. Propose whether the words go in the CMS (T-014), and don't build that here. | engineer |

L1 is merged. L3 after brief 570, any time. L2 after T-307's buildings and brief 560; L4 after L2's Sync and L3. Not beside another WORK CHANGED.

## Done when

- Gate green (`TESTING.md`). L3: engine work **same**. L2 and L4: changes explained and accepted by the director.
- In the running game, named as verified: **a whole new game, with no dev tools**: name, hero, each of the eight lessons, about 10 minutes
  by the clock, the world map's goal, then settling. The same with lessons off. Doing steps out of order; minimising; closing the game mid-lesson
  and returning; a tool breaking while working and while away; every tool broken and still recoverable; the heap resting; the slime
  fight won with berries; the QA kit button. At 1366 and 1920, with Limes on a busy
  Starter Camp and a panel open. For L3 alone: dragging Limes and reloading, talking to it, the bubble collapsed
  and reopened, each hover blurb, the Settings switch, a Token under Limes still worked, Limes absent on another place.
- Tests for breaking (live and catch-up the same), lesson order and saving.
- `bench:draw --compare` once per eye-check batch.
- GDD §1, §5, §7 and §8, `concept_quests_tutorial.md` and `owner_art_list.md` updated.
- **Eye-checks**: the Limes scale pick; one look after L3 (the framework, the blurbs; the owner edits their words); one full play after
  L4, where the owner edits Limes's lesson words and judges whether it's about 10 minutes.

## Not in this brief

The rest of copper's order and the rule past copper (the metal and gear session). The quest board (T-176). Limes's later lines beyond the
first settle. A hint system.

## Owner to-do

Pick Limes's scale. Edit the blurbs and conversation lines at L3's look. Review the opening's pack in the CMS, then
Sync on `main`. Edit the lesson words at the full play. Draw the scrap heap, three rusty
tools, and a small slime if the slime folder has none that fits, when ready; stand-ins until then.
