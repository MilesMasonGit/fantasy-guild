# Code Review Round 3 — Session Summary (2026-09-27 → 2026-10-06)

Written by the director at the end of the session. Detail lives in
`docs/REVIEW_V3_RUN_LOG.md` (every step), `docs/review_v3/Z.md` (the plan, §11 = owner
rulings) and the session files `docs/review_v3/*.md`.

## The headline

The review is done and **the 165 FPS goal is reached on a realistic mat** (measured on
the owner's PC, dev build, headless Chrome). The engine targets are met with room to
spare. The game plays out **identically** to before every speed fix — a benchmark gate
proves it on every change.

| | Before | After | Target |
|---|---|---|---|
| Realistic mat (~100 Tokens) FPS | ~92–121 | **~163** (screen ceiling), 99 % of frames in budget | 165 |
| 300-Token mat FPS | ~65–85 | **~147** | — |
| Engine p99, realistic mat | 3.06 ms | **~0.76 ms** | ≤ 1.5 ✅ |
| Engine p99, 300 Tokens | 74 ms | **~1.9 ms** | ≤ 4 ✅ |
| "Waiting for room" board p99 | 29.6 ms | **3.6 ms** | — |
| Worst single push (S4) | 56 ms | ~15 ms | ≤ 8 ❌ |
| Mat redraws / dock redraws per second | ~41 / ~34 | ~8 → ~2 own / <1 | — |
| Memory over 8 game-hours | flat | flat | flat ✅ |
| Tests passing | 3,731 (+10 failing) | **4,041** (10 old failures marked expected) | — |
| Dangerous import cycles | 3 | **0** | 0 ✅ |

## What was done

**The review (planning + 13 sessions):** plan approved; round 2's 88 leftover tickets
re-checked; 10 territory reviews; 179 tickets filed, 0 critical; verdict: healthy codebase.

**Tools built:** `npm run bench` (7 headless scenarios, an identical-work gate that fails if
a change alters gameplay), an in-game Perf HUD (`?stress=realistic`, `window.__perf`),
the art put under Git LFS, model-tier agent definitions (`.claude/agents/`).

**Fixes merged (Waves 0–6):**
- *Players will notice:* a new game is saved complete immediately; a changed PC clock no
  longer disturbs the game; dock HP bars update; the upgrade panel's Close works; clicks
  inside the Bank-side hero sheet work; a refused equip bounces back with a reason; a
  crash shows a small "Something went wrong here" panel instead of a black screen; Bank
  hero reordering; Settings tidied (4 retired controls gone, 9 "coming soon"); the Shop
  slides aside while you place; the mat is locked while the Bank is open; Escape closes
  one layer at a time; mat Tokens left the Tab order; no stray hover rings mid-drag; a
  stuck station warns once; **the owner's hard pixel shadow and edge-only coloured
  outlines replace the soft shadow and glow**; charge/spawn rings glide; new ore vein art.
- *Under the hood:* cached Token list, spawner census, faster placement and pushes,
  buff-rebuild indexes, per-move neighbour cache, board-reach rebuild narrowing, faster
  autosave, steady clock, event registry + guards, per-Token update routing, walking out
  of React, ~310 new tests.

## Outstanding

**Owner to-dos**
1. **CMS**: set Wood Foundation → `token_foundation_wood`, Stone Foundation →
   `token_foundation_stone`, the Stone item → `item_stone`; **retire Copper Rubble** (this
   also clears the last failing test). Then Sync to Game.
2. **Certification**: run `docs/review_v3/C.md` (~25 min) on your PC.
3. **Re-save the bench baseline on a quiet machine** (`npm run bench -- --save-baseline`);
   the current reference timings were taken under load.

**Left uncommitted in the folder (not the review's — owners decide):**
- **Atlas feature work** from another session: `src/state/StateSchema.js` (adds a required
  `atlas` save section — check old saves still load) and `data/items/maps.json` (⚠ written
  outside the CMS — the CMS sync may wipe it).
- Two edited map PNGs (`map_frozenpeak`, `map_volcano`) — owner art.
- Scratch files: `bump.cjs`, `replace.cjs`, `md_list.txt`, `summary.txt`,
  `docs/KICKOFF_token_lifecycle.md`.

**Remaining plan waves** (`Z.md` §4; rulings in §11; post-Wave-6 rule: no Opus subagents
without the owner's OK):
- **Wave 6 leftovers:** `state_changed` retirement stages 2–3 (CR3-305), CR3-255.
- **Wave 7b (drag):** memoised Token grab (CR3-400), CR3-412 — after certification.
- **Wave 8:** CR3-307 (`Engine.startSlot`), 308, 512, 108.
- **Wave 9 cleanup:** the tile-name rename + rules text (CR3-500/501), vestiges, lint
  residue, the last 3 fixture ids (CR3-551).
- **Wave 10 UI consistency:** close-button look, one tooltip, toast colours + "×N", plain
  wording, text sizes, notification collapse (recommendations stand).
- **Wave 11:** latent rule wiring — do each when content uses it.
- **Remaining live filters:** ~65 alert-icon glows and label text shadows (apply the
  hard-pixel style?).
- **S4 worst push** (~15 vs 8 ms): a push-solver tail (CR3-152).
- **Docs:** a mat-era performance guide to replace the archived `PERFORMANCE.md` (draft in
  `R6.md` §8 + `R7.md` §4); the `@ts-check` trial (CR3-560); Stage 2/3 seams (R10).
- A canvas mat is very likely unnecessary now — confirm after certification.
