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

---

## Log

| When (PDT) | What | Result |
|---|---|---|
| 2026-09-28 | Owner interview: director mode rules recorded (plan §10) | merged `a3228f7` |
| 2026-09-28 | Palette edits committed as-is (owner) | merged `10bca6a` |
| 2026-09-28 | **CR3-027: art under Git LFS** — 1,048 files; fresh worktree verified byte-identical; tests 10 known failures, unchanged | merged (this entry's commit) |
