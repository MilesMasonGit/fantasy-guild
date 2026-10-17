# HANDOFF — what a fresh director resumes from

*Replaced whole each time a director session ends, never stacked. Written
2026-10-17 01:45 by the art-pass director (session of 15–17 October). Read
`CLAUDE.md`, this file and `STATUS.md`, then verify each worktree with
`git -C .claude/worktrees/<name> status --short` and
`git log --oneline main..<branch>` before trusting anything here.*

## On `main` (pushed, 22679a3e plus this handoff)

- **Bench baselines** retaken on a quiet machine 2026-10-15/16 (engine and
  draw, both committed).
- **Floor loot** lands on its spot and draws crisp (T-183); the dev panel's
  Scatter Loot names real items (T-184).
- **Every picture renamed and filed** under
  [`ASSET_NAMING.md`](../reference/ASSET_NAMING.md) (prefix t/i/hf-hm-hn/e/p/g/u/b/s,
  the thing's real name, material last, no group words). The owner applied
  the renames in the CMS and Synced; old names still resolve for old saves
  (`legacySpriteNames.js`; what can go is in the rename merge's notes).
  162 local, git-ignored leftovers went to `_art_leftovers/` in the owner's
  folder for the owner to drag out.
- **The art carries the Gentle brightness** (1.08 / 1.12, outlines at or below
  40 kept), baked from the original after a first Drag bake (1.15 / 1.25)
  proved too bright. Rollback tag `art-before-vibrancy` (pushed) and the
  owner's Desktop zip. [`ART_STYLE.md`](../reference/ART_STYLE.md) approved.
- Dragging adds no brightening (A4); hover brightening is gentle (1.06 / 1.08).
- **Studio button** brightens the Material Library once with the art's
  setting (now Gentle). The palettes are currently their **original** colours
  (the 1.15 brightening was reverted): the owner still has to press it.
- **CMS Sync warns before it removes content** (T-188): a stale browser
  workspace once wiped 16 Tokens; caught and reverted.
- **Hover/work/alert outlines and carried shadows** show again: the dev server
  was answering freshly redrawn outline pictures with the game page; it now
  reads the generated folder from disk (dev only; builds were never affected).
- Brief 180 written and queued (ground structure).

## Branches and worktrees

| Where | State |
|---|---|
| Owner's folder | **on `crunch/ground-g1`** for the eye-check; switch back to `main` after the look (`git switch main`) |
| `g1` (detached at 483fae3c) | brief 180 G1's worktree; the branch is `crunch/ground-g1` (+ the eye-check file commit 4fd7c8cc). Gate green (5035 tests, cycles, build); engine work check same; draw compare no regression (S2 4× 107 → 100 fps, work p50 10.7 → 11.8 ms, within tolerance). Merge after the owner's verdicts |
| `p23b` (detached) | director's scratch; also holds `public/_gen/art-bench` previews of the original art at four levels (git-ignored) |
| `pp` (`planning`), `ar` (`art/asset-reorg`) | not this director's; leave them |
| everything else | merged and removed |

## Eye-checks waiting

- [`eyecheck/2026-10-17_ground-structure.md`](eyecheck/2026-10-17_ground-structure.md)
  (on the branch only): the tint pattern, organic earth with fringe, grouped
  props, new Ground tuner sliders; two small questions at the end.

## Owner to-dos

1. Look at the ground (file above), give verdicts and slider values.
2. Then on `main`: start the Studio (`npm run studio`, restart if open) →
   Recolor tab → Material Library panel → "Brighten material palettes (art
   bake: 1.08 / 1.12)" → "Yes" → check "Already applied" → CMS **Sync to Game**
   on `main`. The director checks the Sync touched only
   `data/palettes/custom_palettes.json` (and that content counts stay 86
   Tokens, 71 items, 25 recipes) before pushing.
3. Drag `_art_leftovers/` out of the project folder (the sandbox won't let
   agents write outside it).
4. Terrain art from the notes page (below): earth sheet lifted to just under
   the grass; grass at about 100–120 brightness, vibrant, 4–5 colours; then
   the edge pieces (G2).

## Next phases

1. **Merge G1** after the look (apply the owner's slider values as defaults
   first if any; a builder-lite job).
2. **Brief 180 G2:** the code lays the owner's hand-drawn edge pieces along
   ground boundaries; makes the 64 × 64 template sheet (`p_edge_<a>_<b>.png`,
   4 × 4 of 16 px) and placeholder pieces. Then the owner draws
   `p_edge_grass_dirt.png`.
3. **When the owner's new ground sheets land:** remove the code dimming of the
   ground (`brightness 0.85, saturate 0.7`), look again.
4. Filler tickets: T-167 (Recruits' weak attack, needs an owner enemy), T-186
   (equip-by-drop a frame later), T-187 (flag drags grab a neighbour on a full
   board), T-189 (retire `materials_library.json`). Then wave 3 from the queue.

## The terrain advice (the owner's goal for the art pass)

The owner wants design advice to make the ground and props look as good as
possible, target Sea of Stars; the owner draws. Notes with measurements and
mock-ups: https://claude.ai/artifact/PLTLkP5bqjLqtTc8YYJSpg (sections 1–9).
Settled so far: ground in its own brightness band (~100–120) above the Tokens'
bodies; earth lifted; speckle and drawn cracks out; props quieter than Tokens
(no black outlines, nothing ore- or gem-like); vibrant colour, leaning
yellow-green to keep green Tokens and the green signal colours distinct;
structure at three sizes (brief 180). Full transition tiles were declined as
too much work; edge pieces on code shapes instead. The mock scripts are in this
session's scratchpad only; regenerate from the notes if needed.

## Lessons from this session

- **Check every CMS Sync's counts before pushing.** A stale browser workspace
  synced old content over new; `git show --stat` and a per-file id diff caught
  it. T-188 now guards it, but keep checking.
- **The sandbox blocks writes outside the project**: a move "out" landed loose
  at the project root. Ask the owner to move things out of the project.
- **Moves through Windows can fail on folders a server watches**; copy, verify
  the count, then delete the originals.
- **Generated pictures written while Vite starts aren't served** (fixed for
  sprite-fx); `performance.getEntriesByType('resource')` caps at 250 entries,
  so use the network list to check a picture loads.
- **Show art choices on the bench before baking**: the owner judged the first
  bake too bright only in play. The bench with columns from the original art
  made the second choice quick and exact (the bake matched it pixel for pixel).
- **The owner directs the art**: don't interview for art rules; record what's
  settled and give measured, illustrated advice when asked.
- `git fetch . <sha>:main` fails for a bare SHA; to move `main` while the
  owner's folder is on another branch use `git update-ref refs/heads/main NEW
  OLD` after `git merge-base --is-ancestor OLD NEW`.
- A shell `&` job does not survive the tool call; use `run_in_background`.
