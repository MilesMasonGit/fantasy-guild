# HANDOFF: what a fresh director resumes from

*Replaced whole each time. Written Thu 26 Nov 2026, 23:40, during the owner's mechanics week. Read `CLAUDE.md`, this file and `STATUS.md`, then verify with `git worktree list` and `git log --oneline -5`.*

## The week's plan (owner, 25 Nov)

Build the briefs queue empty this week; next week is content and balancing. Look and play changes merge on the gate plus the work check, with **one eye-check build at the week's end** covering everything. The engine work check (`npm run bench -- --compare`) runs anytime; timing benches only in the windows. No mid-week builds. Memory: `project_mechanics_week.md`.

## On `main` (073587d3, pushed, all green: 10,844 tests)

Since the last handoff (25 Nov):
- **The owner's Syncs today:** coins, the new Starter Camp with free opening buys (b760568b), one Token size (0f80648d). Each id-diffed: they match their packs.
- **Game:**
  - 890 S1-S3: Tokens 128 u apart, reach 240, one size, old saves refused (0.8.2), the new Starter Camp.
  - 910 W1: one drink at a time. Drinks, work potions and elixirs share the Drink slot; a second one is refused, and dropping it on the first swaps them; the Loadout Slots star never adds a drink.
  - T-728: the QA panel gives coins.
- **CMS and ledger (no game change):**
  - Number packs: the time pin and the output pin (T-729); Bait timed as a prepare step.
  - Stage gate and way out, every way out a floor (B1 follow-up, T-730).
  - Coins: two coin curves (B3), coin prices on selling only (T-731).
  - Checks: the three checks (B4) and their follow-up (T-733: Typical drinks only what pays back 4x; `hall-price-unreachable`; chain XP per gathering hour, warns at 2x).
  - Hall prices and colours on the payback curve (T-734 part A).
  - `ledger --with-planned` (B5b).
  - `pack boosts` (B6, with the owner's tools, gear and perks rulings).
  - Node timing: `REST_RULE` 15 s of work, back in 60 s; dense timed; one dose (B7).
- **Bench:** the boards were rebuilt for the spacing (T-725); work fingerprints accepted under T-725. The work check reads the same on main after every merge since.

## Branches held on purpose

- **`feat/xp-table-main`** (worktree `xpt`, 4a4ed4c9) = main plus **880 L4**: the rules XP table (9,428,820 to 99), 25-cycle drinks and work potions, the hero sheet's short XP, `recalc`/`sync --rulebook`. All green.
  - It merges only together with the owner's Sync of the balancer's number pack and boosts pack. Then the work check (WORK CHANGED expected; accept under T-337).
  - The old `feat/xp-table` is superseded: merging main into it trips the data/code hook.
- **`feat/hall-payback-curve`** c44c6feaf = T-734 part B (Typical buys Hall ranks on the curve). Held: balancer, after the boosts pack and the coin reset, with Typical judging by the guild-wide sum.

## Running or queued

- **01:05 tonight:** `scratchpad/quiet-retake.sh`, a background task in worktree `b16`. It makes branch `bench/quiet-retake-1127` from main, then runs `bench --compare`, `bench --save-baseline` and `bench:draw --save-baseline`. When it finishes:
  - commit `bench/baseline.json` and the draw baseline on that branch;
  - check that the work is the same;
  - merge to main and push.
- **Next:** T-726 (a stepping enemy is unpushable, and fight stepping crowds Tokens). Engine; start it after the baseline. Then T-735 (catch-up Bank fidelity on the rebuilt S2).
- **Calibration** (`bench:calibrate -- --hours=24`) is stale since 890 and needs a long quiet window. The `forest-potions` setup now carries one potion.

## The balancer's sequence (owner-ruled)

1. Number pack plus boosts pack, both run on `feat/xp-table-main`.
2. The owner's yes on both, then the Sync, then merge L4.
3. One coin reset: prices, enemy coin drops at half selling, thefts.
4. Ring 1 settle levels to 10 (the owner's yes).

Content's lists are on T-732 and in the boosts writer's needs-effect list.

## Eye-check at the week's end (one tab, Guild Eye-checks)

Collect from STATUS and this week:
- the new Starter Camp; one Token size and the 128 u spacing;
- one drink at a time (the refuse and swap wording);
- the level-up flash;
- coins, Shop and Hall prices; QA give coins;
- fishing, Forests, Crime, Faith, Science, combat styles and tricks;
- the director's calls listed in STATUS.

The QA scenes are deleted after acceptance. Build: `npm run tauri:build`, exe to `_builds/`.

## Lessons this session

- **Never put `git merge --ff-only` behind a pipe:** a refused fast-forward was hidden twice and a ticket commit went to main alone. Run it bare, or check `$?`.
- **Other sessions push docs to main between my gates** (the balancer, planning, content). Merge the gated join with `--no-ff` when a fast-forward is refused, after checking that the new commits are docs only.
- **After an owner Sync, build the branch from main and merge the feature into it**, not main into the feature (the data/code hook).
- **Give every builder its own scratch subfolder:** two builders both used `scratchpad\sb` and overwrote each other's sandbox, which produced a false "Bare moves" finding.
- **A Sync can land while a gate runs:** check `git log main -- data/` before trusting a green gate, then id-diff the Sync.
- **The weekly usage limit cut a builder; SendMessage resumed it.**
