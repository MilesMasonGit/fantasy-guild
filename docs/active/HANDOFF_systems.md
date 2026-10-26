# HANDOFF — Systems director

*Replaced whole each time. Written 2026-10-25 (evening). Verify each worktree
with `git -C .claude/worktrees/<name> status --short` and
`git log --oneline main..<branch>`. STATUS.md holds the phase tables.*

## On `main` (pushed)

- **Brief 220 combat: complete.** C1 numbers, C2 gear and enemies, C3 supplies
  and the "used" bubble, C4 Poison/Burn/boss moves, C5 encounters (camps of one,
  enemy camps idle while full, ~2 % ambushes, Summoning Circle), C0 first combat
  content (synced 0bdfa84f), C6 the combat screen, C6c fight bars above loot.
  Records in `docs/archive/eyecheck/2026-10-2x_combat-*.md`.
- **Brief 230 skill loops: every engine phase merged** (S1a, S1b, S2a Forestry,
  S2b Orchards, S3 Mining, S4 Farming, S5/S5b Fishing and the Trap, S6a station
  pools, S6b work potions and drinks, S7 seeing support effects), plus the CMS
  seed pricing and the 1-XP floor for a positive XP bonus.
- **Brief 240 basic content: K0 engine gaps merged** (Starter Camp in packs,
  tutorial maps after a copper tool and a goblin, first-kill drops, the Bog,
  Hall prices by plane).
- Bench baseline: work fingerprints accepted under brief220-C1, -C5,
  brief230-S1a; the **timing baseline predates C1** (fights are longer): retake
  `--save-baseline` (engine and draw) on a quiet machine.

## Waiting on the owner

- **The skill-loops content pack** `cms/incoming/2026-10-25-skill-loops-content.json`
  (160 entries; Coffee out; Bird Nests open into seeds). Owner: CMS → Backups →
  Restore from Game, then Changes to review, then Recalculate and Sync on
  `main`. **Right after the Sync**: id-diff every data file; then one builder
  pass on ~70 content-pinned tests (list in the S8 builder's report: FarmingChain,
  ProcessingChain, ForestryChain, MiningChain, FishingChain, NeverWears,
  CMSStaysPutAndWear, CMSForestry, NewGameOpening (reachability doesn't read
  catch pools), CombatChain (audit doesn't expand effect refs), …).
- Then **S9**: a play-through of every loop with screenshots for the owner.
- Then **brief 240 K1–K3** content packs (after the skill-loops Sync, so ids and
  fingerprints follow it; ⚠️ the Starter Camp's opening Bank needs food (the
  tutorial's goblin step tells the player to feed a hero); K1 ticks "Given by the tutorial" on Forest, Mountain,
  Coast; Iron Anvil becomes an Iron Smithy; other tree species converted to the
  Oak shape; Lavender found wild).

## In flight

Nothing. T-250 (tests seeded per test, `src/tests/setup/seededRandom.js`)
merged 03bec256.

## Worktrees

All Systems worktrees removed 2026-10-25 (junctions first, real
`node_modules` checked intact). Branches kept locally.

## Lessons

- The CMS in the browser pane starts with an **empty workspace**: Restore from
  Game before accepting a pack, or a Sync would wipe content. After a content
  Sync, run the full suite at once (C0 left 7 red tests on `main`).
- File-scan tests and luck-dependent combat tests fail under load: re-run alone
  before believing; T-250 should end the second kind.
- Screenshots for the phone: headless Chrome via `bench/browser/cdp.mjs`; the
  pane is hidden.
- `git merge --ff-only` fails when `main` moved by a STATUS commit: merge `main`
  into the branch first; don't write "merged" in STATUS until the push is done.
- Two directors share ticket numbers: re-read "Next free number" right before
  filing.
