# Code Review Round 3 — Autonomous Run Log

The director's running record while the owner is away (from 2026-09-28).
Rules of the run: `code_review_v3_master_plan.md` §10. Newest entries at the
bottom of the log. **Owner: start with "Questions waiting for you".**

---

## Questions waiting for you

*(Parked items, each as multiple choice with a recommendation first. Nothing
here blocked the rest of the run.)*

1. **Four art folders were left out of Git LFS**: `public/assets/archive/`,
   `maybe/`, `heroes/animations/waste/` and `enemies/animal/anim/waste/` —
   54 files, under 1 MB, none referenced by code. Should they be versioned?
   - **(A) Recommended: leave them out** — they read as scratch or discarded art.
   - (B) Track them too (one `waste` zip needs Windows long paths switched on first).
   - (C) Delete them.

2. **From R8 (UI/UX consistency)**: 11 questions, full options in
   `docs/review_v3/R8.md` §6. Recommendations in brief:
   - **Q1 Settings (13 inert controls)**: delete the 4 naming retired things;
     "coming soon" for the 4 you already ruled on; disable the other 5 until wired.
   - **Q2 Closing rule**: Escape closes the top-most layer; click-outside only
     for light popups; drawers never close on a stray click.
   - **Q3 Close button**: the red pixel-art cancel icon everywhere.
   - **Q4 Tooltips**: one shared gold-bordered tooltip; plain browser tips only
     on icon buttons.
   - **Q5 Notifications**: a coloured edge per type, and "×3" for merged repeats.
   - **Q6 Sci-fi words** ("Protocol Settings", "SYSTEM BOOT", "neural sync"):
     replace with plain words.
   - **Q7 Text sizes in code**: rewrite them to what actually renders (no
     visible change).
   - **Q8 Two ways to hide notifications**: keep only "Collapse".
   - **Q9 Dev Tools tab in Settings**: keep it visible (the only way to turn
     Debug Mode on in a shipped build).
   - **Q10 LayoutSandbox**: leave untouched.
   - **Q11 Reordering heroes in the Bank panel**: wire it like the bottom dock.

3. **From R9 (vestiges, docs, build)**: 5 questions, full options in
   `docs/review_v3/R9.md` §10. Recommendations in brief:
   - **Q1 Rules text still says "tile"**: say "where this one stands" and "on
     the nearest / a random free spot"; the Nearby hint becomes "Tokens within
     reach of this one".
   - **Q2 Tile-name rename**: rename code names and event strings together in
     one slice.
   - **Q3 ~45 history docs**: move to `archive/docs/` with an index.
   - **Q4 `.agent/` folder**: keep the art workflows, fix two guides, archive
     the rest (including `add-item.md`, which would make an agent write content
     the CMS then wipes).
   - **Q5 Scrap art in builds**: keep `archive`/`maybe`/`waste` art out of the
     build and the preload list (ties to question 1).

4. **From P2 (the benchmark)**: 3 questions, `docs/review_v3/P2.md` last section.
   - **Loot in the "realistic" scenario**: the bench assumes the player collects
     loot (auto-collect on), although the shipped default is off.
     **(A) Recommended: keep it on**, since a late-game player collects. (B) Use
     the shipped default. (C) Run both.
   - **The engine target** (1.5 ms at p99; today it's 3.2 ms).
     **(A) Recommended: keep 1.5 ms as the fix waves' goal.** (B) Relax it to
     3 ms. (C) Decide after the first fix wave.
   - **The computer's name in `bench/baseline.json`.**
     **(A) Recommended: keep it**, so a baseline says which machine it belongs to.
     (B) Drop it.

5. **From P3 (the in-game Perf HUD)**: 2 questions, `docs/review_v3/P3.md`.
   - **Should the HUD also work in a shipped build with Debug Mode on?**
     **(A) Recommended: no, dev builds only**; `npm run tauri:dev` already runs
     the real desktop app with it. (B) Yes, behind Debug Mode, so the exact
     player build can be measured, but the harness code ships to players (off).
   - **Certify frame rate on the dev build, or add a profiling build?** React's
     dev mode is slower than what players get, so dev numbers are pessimistic.
     **(A) Recommended: certify on the dev build and treat a near miss as
     "re-check".** (B) Add a small `build:perf` (a production build with
     profiling, never shipped) as its own ticket.

6. **From R1 (engine loop, clock, events)**: 4 questions, `docs/review_v3/R1.md` §8.
   - **Game time while playing**: **(A) Recommended: use a clock the PC can't
     move** (a monotonic timer) for time while the game is open, and the wall
     clock only for time away. Today, setting the PC clock back sends
     "negative time" through every system (CR3-101, confirmed by the director).
   - **A stalled station's warning**: **(A) Recommended: announce it once**, not
     10 times a second.
   - **Buff rebuilds**: **(A) Recommended: merge them to one per tick**; decide
     together with R2's findings.
   - **Unused clock pieces**: **(A) Recommended: remove them**, but keep the
     debug surface (`window.Game`) that testing depends on.

7. **From R3 (work, flags, rules)**: 3 questions, `docs/review_v3/R3.md` §7.
   - **Crafted Tokens with no charge count** (the Copper Woodaxe never wears
     out): **(A) Recommended: keep "no count = unlimited"**, but have the
     content check flag crafted/Shop Tokens that have none.
   - **Rule upkeep**: **(A) Recommended: let it also take matching loot from
     the mat, Bank first** (already open item 4 in the token-lifecycle feedback).
   - **Item rule moments**: **(A) Recommended: offer items only the two moments
     that actually fire** ("starting work", "engaging").

8. **From R4 (combat, heroes, effects, loot)**: 4 questions, `docs/review_v3/R4.md` §7.
   - **Kill loot and yield/double-loot/bonus rules**: **(A) Recommended: yes**,
     the same rules as station output.
   - **Timed effects' clock**: **(A) Recommended: game time**, like wounds and
     quest timers.
   - **Defeat clears timed effects too**: **(A) Recommended: yes**, and
     `Removes` should reach statuses too.
   - **The Wishing Well rewrites the Guild Hall on load** (wiping rules
     authored on the Hall): **(A) Recommended: keep its water separate.**

---

## Log

| When (PDT) | What | Result |
|---|---|---|
| 2026-09-28 | Owner interview: director mode rules recorded (plan §10) | merged `a3228f7` |
| 2026-09-28 | Palette edits committed as-is (owner) | merged `10bca6a` |
| 2026-09-28 | **CR3-027: art under Git LFS** — 1,048 files; fresh worktree verified byte-identical; tests 10 known failures, unchanged | merged `5adc056` |
| 2026-09-28 | Wave 1 launched: P2 (bench build), R8, R9. All three stopped by a usage limit mid-run, then resumed with their context intact | — |
| 2026-09-28 | **R8 done** (UI/UX): 18 tickets, 1 P1 (CR3-450, a hero sheet that probably closes on the first click inside it). Director spot-checked CR3-451 and CR3-452: both hold | wave-1 commit |
| 2026-09-28 | **R9 done** (vestiges/docs/build): 16 tickets, no P1. Found the plan's §2.D stale and the real reason `nameRegistry` looks dead (a comment apostrophe fools the tool). Director spot-checked it: it holds | wave-1 commit |
| 2026-09-28 | **P2 done: `npm run bench` built.** Director re-took the baseline on a quiet machine; a compare re-run stays within 5 %. **S2 realistic p99 3.2 ms vs 1.5 target; S3 torture 68 ms (a cliff); push storm 60 ms vs 8.** Main causes: the Token list copied and sorted 47×/tick (CR3-001) and capped spawners retrying every tick (CR3-047). Memory is flat | merged `42181be` |
| 2026-09-28 | Wave 2 launched: P3 + R1–R4. All five stopped by a usage limit mid-run; resumed intact (two spike worktrees survived correctly) | — |
| 2026-09-28 | **P3 done: in-game Perf HUD** (`?stress=realistic`, `window.__perf.report()`, Copy report button). Director checked: game-source changes are dev-gated; the production `Profiler` is a pass-through. First reading (dev build, preview pane): **MatBoard re-renders ~40×/s at S2 vs a target of 1** | merged `f9af6ba` |
| 2026-09-28 | Wave 3 launched: R5 (UI↔engine), R6 (mat drawing), R7 (drag & input), each in its own browser tab | — |
| 2026-09-28 | Another usage-limit stop hit six agents; all resumed. Director confirmed `node_modules` intact after the spike cleanups | — |
| 2026-09-28 | **R1 done** (engine loop): 11 tickets, **2 P1 both confirmed by the director in code**: CR3-100, a new game's first save is written before the Guild Hall exists (a crash in the first 10 min leaves a dead slot); CR3-101, a PC clock change sends negative time through every system. Also measured: spawners are 53 % of the realistic tick; event batching is not worth bringing back; autosave is 0.7 ms | pending wave-2 commit |
| 2026-09-29 | Weekly limit hit; resumed after reset. R3 and R4 had finished writing just before | — |
| 2026-09-29 | **R4 done** (combat/effects/loot): 17 tickets, 1 P1: CR3-250, each kill triggers two whole-neighbourhood rebuilds (one for a hero who didn't move), 123–222 ms per kill on the torture board. Director confirmed it in code. R4 also caught a **director error**: P1 closed CR2-082 wrongly (the XP table is still unused, now CR3-258); corrected | pending commit |
| 2026-09-29 | **R3 done** (work/flags/rules): 7 tickets, 1 P1 (CR3-200: every enemy step empties the "who is near whom" cache). **Spikes for CR3-047 + CR3-004: S2 p99 4.6 → 2.2 ms, S3 p99 87 → 12 ms, identical game results**; adding CR3-200's fix would reach S2 p99 1.34 ms (under target). No error boundary anywhere yet (CR3-203) | pending commit |
