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
