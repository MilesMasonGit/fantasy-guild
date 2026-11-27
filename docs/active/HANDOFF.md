# HANDOFF: what a fresh director resumes from

*Replaced whole each time. Written Fri 27 Nov 2026, 06:30, during the owner's mechanics week. Read `CLAUDE.md`, this file and `STATUS.md`, then verify with `git worktree list` and `git log --oneline -5`.*

## The week's plan (owner, 25 Nov)

Build the briefs queue empty this week; next week is content and balancing. Look and play changes merge on the gate plus the work check, with **one eye-check build at the week's end** covering everything. The engine work check (`npm run bench -- --compare`) runs anytime; timing benches only in the windows. Memory: `project_mechanics_week.md`.

## On `main` (e7851c2d, pushed)

Gate green **except 16 CMS round-trip guards, red on purpose** (CMSCatchPools, CMSEnemyHostile, CMSForestry, CMSGearAndKinds x2, CMSGearDefence, CMSLifecycleBlocks, CMSRareTable, CMSStandsOn, CMSStaysPutAndWear, CMSTokenArtSize, CMSTokenCardArt x3, CMSWorkConsumables, CMSXpPin). They compare a Recalculate and Sync against today's `data/`, synced with the rulebook off; they go green after the owner's next Sync. Treat any other red as real.

Since the last handoff (26 Nov 23:40), all merged on the gate and the work check:
- **The CMS always runs the balance rules** (`workspaceDials` forces `rulebook: true`) and **the rules XP table, 25-cycle drinks and work potions (880 L4)**. Hero XP work accepted under T-337.
- **Fights:** a stepping enemy keeps the 128 u spacing and is never pushed (T-726, C256 accepted); a step let go part-way finishes at its held spot (T-745, same work).
- **Using items from the Bank (400 B4):** an item's Use (CMS Use block, `use.drops`), drawer control beside Sell, a full Bank sends drops to the mat as loot; ledger, pace, checks, economy, encyclopedia read it. Same work (no shipped item has a Use yet).
- **QA:** Give the old starting kit (T-744).
- **Hall:** the built-in star stand-ins retired; a missing required star is an error in the boot audit and the CMS audit (T-740, T-746).
- **Ledger:** the batch-payback row reads Typical's own gate judgement (T-739) and shows the finished-setup number beside it (T-749); the ledger and rate calculator skip a pool that never bites (T-676).
- **Bench:** quiet baseline retake 01:05 (engine and draw); every scenario now builds without the shipped perks (T-735, T-750; work accepted). **The timing baselines are stale since T-750: retake in the next window.**
- **Clean-up:** T-677, T-114, T-103 (part), T-141, T-481, T-108.

## Branches and worktrees

All of tonight's worktrees are merged and removed. `b16` is the scratch join worktree (on `merge/cycle-counts`, merged; switch it before reuse). About 240 older worktrees remain for a cleanup pass (procedure in the director skill). `feat/hall-payback-curve` c44c6feaf (T-734 part B) is still held for the balancer.

## The balance sequence (owner-ruled; where it stands)

1. Number pack and boosts pack: accepted by the owner (no Sync yet).
2. **Owner: press Recalculate in the CMS (no Sync).** Then tell the balancer (session "Balancer - 261125"), who builds round 2 (`balance --levers=xp`; rehearsed: 66 entries).
3. Owner accepts round 2, then **Syncs**. Then: id-diff every data file, full suite all green (the 16 guards turn green), work check (accept WORK CHANGED under T-337), push.
4. **T-751** (engineer): Recalculate prices an item's Use (drops share the used item's worth, no labour term). After round 2, before the coin reset.
5. The coin reset; Ring 1 settle levels to 10.

**Content agent** ("Content: plan into the CMS as Planned entries") has the Bird Nest pack spec: Use = today's Search drops, **keep the Search recipe** until T-751 is on main; a follow-up pack retires it.

## Queue

- **13:00 window:** `npm run bench -- --save-baseline` and `npm run bench:draw -- --save-baseline` on main, quiet machine; commit with the date.
- **T-741** (the Hall star plan) after the boosts pack; **T-743** content (empty opening Bank, Bunk Beds).
- **T-734 part B** held for the balancer.
- **Calibration** (`bench:calibrate -- --hours=24`) needs a long quiet window.
- **The week-end eye-check build and tab:** collect from STATUS (Starter Camp, one Token size and 128 u spacing, one drink at a time, the level-up flash, coins and prices, QA give coins and the old kit, fight stepping, using a Bird Nest once its pack is synced, fishing, Forests, Crime, Faith, Science, combat). Build: `npm run tauri:build`, exe to `_builds/`.

## Questions for the owner (in TICKETS section 1)

- **T-747:** can a fight already under way be pushed by a spawn? (a, recommended) leave it and fix the GDD wording; (b) make it unpushable.
- **T-752:** the CMS Gemini Generate button (import removed, preview only): (a, recommended) remove it; (b) keep the preview; (c) rebuild it as a brief.
- **T-748** (balancer's, after the coin reset): Typical re-judges a drink as its setup grows.

## Lessons this session

- **Never put `git merge --ff-only` behind a pipe**; run it bare.
- **Other sessions push docs to main between gates**: merge `--no-ff` after checking the new commits are docs only.
- **After an owner Sync, build the branch from main and merge the feature into it** (the data/code hook).
- **Give every builder its own scratch subfolder.**
- **A Sync can land while a gate runs**: check `git log main -- data/` before trusting a green gate.
- **Hold a builder's full suite while a bench runs**: a flag file the builder waits on worked (`retake-done.flag`).
- **Timing verdicts while another agent runs a suite are noise** (every scenario about 2x slower, S4 included): the work check decides.
- **A builder's "no heroes" claim was wrong** (FS has heroes): read the fingerprint diffs before accepting.
