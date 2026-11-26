# HANDOFF: what a fresh director resumes from

*Replaced whole each time. Written Wed 25 Nov 2026, evening, during the owner's mechanics week. Read `CLAUDE.md`, this file and `STATUS.md` (the dated summaries at the top, "For the content agent", "Questions for the owner"), then verify with `git worktree list` and `git log --oneline -5`.*

## The week's plan (owner, 25 Nov)

Build the briefs queue empty this week (all basic mechanics). Next week is content and balancing. Look and play changes merge on the gate plus the work check, with **one eye-check build at the week's end** covering everything. The engine work check (`npm run bench -- --compare`) runs anytime, but the director runs it: agents refuse outside the windows. No mid-week builds. Missing features go to the planning agent in groups. Memory: `project_mechanics_week.md`.

## On `main` (77c7e01b, pushed)

Everything from batches 12 to 16, plus this week:
- **Rename:** the game is Tabletop Guild (820). Desktop builds start with fresh saves and settings.
- **Combat (740, 750):**
  - C2 damage types without groups; C4 enemy moves named, Venomous retired, enemies not every-Nth; C5 step 1 enemy kinds as library effects (presets as fallback until the pack); C10 Defeated wording plus the fight window's result line.
  - 750 S1 to S6: crit cap 75, one ammo rule (`Ammo.js`), Stealth poisons, leftovers, style texts, gear attack speed.
- **Fishing (850) and gathering (860):**
  - Fishing: spots, catch rules, the Hut, the spot card, catch XP per fish.
  - Gathering: R1 chance ends, R2 Forests own their trees, R3 Excavation, Farmland and the Dock (no Nursery). Green Thumb speeds owned regrowth.
- **Skills (810):** K1 Taming gone, K2 sheet lines, K3 Faith shrines (Can't Run Out, Echo, Fortune, Valiant, Wisdom), K4 Crime Hideout (steal tables, Quiet, the thief goes for the guard and returns), K5 Summoned workers, K6 Science Laboratory and mastery.
- **Gold Coins (870):** C1 count, Sell, save; C2 coin costs (Shop, Foundations, settling, Hall stars), coin drops, coin thefts, Coin Find; C3 the CMS ledger prices coins.
- **Signature perks (800):** P1 and P2 (Motherlode is Can't Run Out, Evergreen, Grove Feller, Master Angler); P4 (Salvage, Master Builder); P5 (Second Wind, Unbreakable, Twin Shot and Double Cast, Shadowstep); the level-up flash on every level, longer.
- **CMS:** the pack gate hang fixed (`pace.js`); drifting spots are wild sources in the ledger.
- **The owner's Syncs:** combat, Hall/tools/drinks, tool speed tuning, XP pass, Forests, Fishing (9ed92a87).
- **The director's settings:** the Ledger pace curve was set to the smooth points.

**Bench:** baseline current. FS isolated from shipped spot kinds (T-712). Accepted this week: T-684, T-658.

**Known red: 4 content gaps**, left on purpose for the content agent:
- ContentRules Rule 1 (now tool materials only): later ores and woods with only tool-gated sources;
- NewGameOpening ×2 and ToolsAsGear: harpoon fish and harpoons in the early game.

## Building

**800 P3 Many Hands**, as two lanes per the owner's rulings (STATUS 16:30). Branch `feat/many-hands`, worktree `mh2`, cut from merge/round. When it reports:
- read the diff of `BoardRunner`;
- run the work check plus a timing look, since it is the hot path;
- then merge.

That empties the briefs queue.

## Next

1. **End-of-week eye-check:** one desktop test build of main (`npm run tauri:build` with `CARGO_TARGET_DIR` at `mh\src-tauri\target`, exe to `_builds/`, then `git checkout -- src-tauri`) and one tab on the Guild Eye-checks page.
   - Use the QA scenes: Faith/Blessings, Crime, coin, Science, Combat styles, Combat tricks.
   - Also the director's calls listed in STATUS: K5 1a to 5a, K6 1a to 6a, 750 Q2 to Q4, Fortune on work only, Motherlode keeping count-down Tokens, P4 old buildings and stars, coins hidden in map modes.
   - After the look, delete the temporary QA scenes and their tests.
2. **The content agent's queue:** STATUS "For the content agent". All engine-side draft packs are in `docs/active/research/pending_packs/engine_packs/`.
3. **Small tickets:** T-693, T-696, T-697, T-707 to T-711 (T-710 retires `durationMs`).
4. **Worktree cleanup:** about 100 dead worktrees. Do junctions first with `cmd //c rmdir`, then `git worktree remove`; never `rm -rf`.

## Lessons this session

- **Never `git stash` in a worktree:** two agents swapped each other's work through the shared stash list (now in TESTING.md).
- **Join, don't stack:** branches built in parallel join on a scratch branch in `b16`, one engineer per round, then the director benches and merges from main's side.
- **Merging main into a branch** after an owner Sync trips the data/code hook, and the override is refused. Merge the branch into main instead; that commit carries code only.
- **A Sync moves tests that read shipped data.** Run the full suite right after, and sort failures into "follows data", "code leftover" and "real content gap". Keep the gaps red.
- **The usage limit cuts agents mid-work.** Resume each with SendMessage; their work is saved.
