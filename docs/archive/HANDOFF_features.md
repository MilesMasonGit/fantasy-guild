# HANDOFF — the features director

*The terrain director keeps [HANDOFF.md](HANDOFF.md); this file is the
features director's, replaced whole each time it ends. Written 2026-10-21
evening, at the end of the session of 19–21 October. Read `CLAUDE.md`, this
file and `STATUS.md`, then verify with `git worktree list` and
`git log --oneline -5` before trusting anything here.*

## On `main` (d4021ec7 plus this handoff, pushed)

The crunch's remaining queue and the owner's "wrap up the outstanding list",
all merged after the owner's eye-checks ("ok for now, refine later"):

- **Brief 130, the recipe list** (inside the Token card) and **brief 150,
  notifications** (item stubs with net flow, pins, banners; collected loot
  flies to its stub; no log, T-193 later).
- **Brief 160, the Atlas** as the owner's book at 4× (256 px pages), popping
  up over the mat; Regions on area banners (CMS banner pick, default by
  biome); Cartography as a crafting table with a real-ground mini preview;
  the Guild Hall night sky (T3). The camera glide was built, then set aside
  for the Guild Hall upgrade screen (tag `atlas-camera-move`, T-194).
- **CMS change packs** (brief 200): agents propose content, the owner reviews
  per entry in the CMS. Used for the starting maps and the tools content.
- **Tools as hero gear** (T-126): one hand, tier gates (an ore needs the pick
  of the tier below), "Needs Pickaxe" bubble, Copper starter set; content
  synced by the owner.
- **Wrap-up rounds:** rule cleanups (no skill speed, no hero energy, kill loot
  rules), a hygiene sweep (−700 lines), UI consistency (one close rule, one
  header, one tooltip, z-index table, plain words), engine plumbing (one start
  path, one way into the engine, shipped builds without dev tools), docs and
  tooling (strings file `src/i18n/`, CREDITS.md, WINDOW_GAME.md, the
  keeping-it-fast rules), drag hitches (a page-wide restyle removed), the
  animation batch, and the banner-chime fix (it was drawing from the game's
  random stream).
- **Brief 90, the Performance Envelope:** measured and written as rules in
  GDD §14; T-071 (canvas mat) parked; issues filed as T-197 to T-210.
- **Bench:** the engine baseline was retaken 2026-10-21 13:00 on a quiet
  machine (f19a2e30); the earlier work changes were explained and accepted.

## Branches and worktrees

- No features branches or worktrees remain. `p23b` is the scratch worktree,
  detached (it served the owner's previews on port 5198 through
  `scratchpad/vite.ec.mjs`; the server is stopped).
- `ar` (`art/asset-reorg`) and `pp` (`planning`) belong to others; leave them.
- About 150 old local branches from earlier sessions (`chore/*`, `crunch/*`,
  `fix/*`) are still listed; most are merged. Not touched; worth a cleanup
  pass with the owner's leave.

## Owed

- ~~The draw baseline retake~~ **done 2026-10-22 01:00** (both baselines are now fresh).
- T-209: confirm the 1× smoothness dip with three windows.

## Owner to-dos

- Before release: the background music's source and licence; ZapSplat needs an
  in-game credit (`CREDITS.md`).
- Card art overrides and the missing activity scenes (from the 18 Oct handoff),
  the banner ribbon, the quest board Token art, a sickle sprite, the Atlas
  "…" icon if wanted.

## Next (for the next batch, planned with the planning agent)

1. **An optimisation pass from the Envelope:** T-197 (loot hover), T-198
   (bubbles), T-199 (24 h catch-up at 256 must meet 30 s; the owner keeps the
   256 cap), T-200 (wandering enemies), T-201 (drags at 4×).
2. **A refinement pass:** T-196 (afterimages) and the look questions recorded
   in `docs/archive/eyecheck/2026-10-*` files.
3. **Parked designs:** the quest board (brief 170, postponed by the owner),
   the notification log (T-193), the strings-file conversion (T-119), the
   camera glide for the Guild Hall upgrade screen (T-194).

## Lessons

- **The engine work check is `npm run bench -- --compare`.** A plain run's
  "same work" only compares repeats. This session reported "same work" from
  plain runs for a day; `--compare` then showed a real change from the
  notifications (a sound picked with the game's random numbers). Bisect with
  `--only=S1` and the old baseline copied in (memory "Bench Compare, Not
  Plain").
- **Visuals and sounds must never draw from `Math.random`** on the game's
  stream; use `fxRandom.js` or a counter.
- **An owner Sync made with a CMS that lacks a branch's code** writes raw
  values; merge the CMS code first, or expect a re-sync and a test bridge.
- **Keep-both merges:** `scratchpad/keepboth.py` resolved most CHANGELOG
  conflicts; screen files that two branches rewrote need a builder.
- **Combined preview branch:** merging every waiting branch into one
  `crunch/eyecheck-*` branch on `p23b` gave the owner one look and one merge.
- **Sign-in expiry or a usage limit stops agents mid-task**; they had
  committed as they went, and `SendMessage` resumed each one. Background
  timers die with the session: re-queue them.
