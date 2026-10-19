# HANDOFF — what a fresh director resumes from

> **Two directors (owner, 2026-10-17).** This file is the terrain director's
> (ground, world generation, placement, the mat's look). The features director
> (briefs 100–170) resumes from [HANDOFF_features.md](HANDOFF_features.md).

*Replaced whole each time a director session ends, never stacked. Written
2026-10-19 by the terrain director (session of 15–19 October). Read
`CLAUDE.md`, this file and `STATUS.md`, then verify each worktree with
`git -C .claude/worktrees/<name> status --short` and
`git log --oneline main..<branch>` before trusting anything here.*

## On `main` (pushed, 00c41b9c plus this handoff)

- **Generated ground** for every biome (brief 180 G3, G4): meadow, forest,
  mountain, coast, flower meadow, cherry grove, Yellowstone, volcano.
- **Water in every Region** (G5): lakes with bays and islands, rivers (across,
  from a lake, split, from a spring), ponds, tarns, sulphur lakes as real
  water, the Coast's smooth shore, a small water in each smaller biome's
  ground after placing, a pond at a new game's Starter Camp.
- **Placement** (G7): natural clumps (one kind per grove), kinds where they
  belong (ore on rock, berries by water, trees on grass; leaning keeps its
  own ground, owner A), a map's one-or-two kinds out towards the edge, the
  camp tucked into a grove at the edge, the chest on an island or hidden.
- **Blended biome borders** (G6): mixed band, islands, fingers, lawn between,
  fade; one per pair by seed; beaches at every sea.
- **Playmat style** (brief 190 P1 + P3, merged 00c41b9c): Clean ground colours,
  the ground drawn at 2× pixel size, quieter decorations, a darker rim; ambient
  life (water shimmer, leaves, petals, embers and lava pulse, small birds
  visiting idle Tokens, an occasional gust moving only grass pieces, small
  cloud shadows), each with a Ground tuner switch and sliders. The P3 lag
  (React's dev build listing the ground plan on every new picture, 3–6 s
  freezes on travel) is fixed; production builds level with `main`.
- Gate on the final merge: 5399 tests, cycles, build; engine work check same.

## Branches and worktrees

- `p23b`: the director's scratch worktree, detached at 00c41b9c, clean.
- `ar` (`art/asset-reorg`), `pp` (`planning`): not this session's; untouched.
- `crunch/style-p2` (local only, no worktree): the shadows phase the owner
  **dropped** after the look (no shadow at rest, the basic hard shadow while
  dragging, as the game was). Kept as a record; never merge.
- Removed this session: `wg`, `pl`, `bl`, `sp`, `an`, `sh` (all merged or
  dropped). Feature branches of merged work remain locally.

## Eye-checks waiting

None. All archived with verdicts in `docs/archive/eyecheck/` (G5, G6, G7,
P1, P2 dropped, P3).

## Owner to-dos

- Restart the art bench page with `npm run art:bench` when wanted (its
  process had run since 15 Oct at a full core and was stopped with the owner's
  approval on 18 Oct, along with an orphaned console).
- From earlier: author maps for the new biomes in the CMS on `main` and Sync
  (the director checks the Sync's counts); recolour `p_bush` and other props;
  drag `_art_leftovers/` out of the project.

## Next (in the owner's order of interest)

1. **Follow-ups from the G6/G7 looks** (queued in STATUS): store each cell's
   biome so same-ground pairs (meadow + forest) get their own look and blends;
   a river along a biome border as real water carved after placing (the owner
   wants rivers to allow water Tokens).
2. **On-map scenery** (the owner's idea, V6): non-workable scenery placed on
   the map itself; a design round first.
3. **Bench owed**: the draw A/B in a quiet window was done by the P3 engineer
   (level); a quiet-machine **baseline retake** (`npm run bench --
   --save-baseline`, `npm run bench:draw -- --save-baseline` on `main`) is due
   at the next 01:00 window: the baselines date from 16 Oct and every run since
   reads 10–20 % slow on unchanged code. Also tickets: a draw-bench scene with
   water, lava and particles (`?region=` in `perfHarness.js`, six lines); and
   `bench:crisp` failing on `main` itself (spawn, turn, quest cases).

## Lessons

- **React dev-build cost**: never pass a large typed-array structure (a ground
  plan) as a React prop; React 19's dev build lists every changed prop into the
  performance timeline. Hand it over through a small store
  (`useSyncExternalStore`). Guard: `GroundPictureDevCost.test.js`.
- The owner judges art by eye on real captures: mock-ups from the game's own
  canvas (`docs/active/research/ground_gen/capture_biomes.mjs`) beat
  re-generated prototypes.
- Never stage with `git add -A` (refused by the permission layer and against
  `CLAUDE.md`); stage by name.
- Engine work verdicts are deterministic and decide merges; timings under load
  are noise (control runs of `main` read the same).
- Leftover processes (art bench, orphaned consoles) can hold a core for days:
  check `wmic` before benching.
- Design pages: `ground` https://claude.ai/artifact/LefBh8qULf3JCdqUBb9jFY,
  `world` https://claude.ai/artifact/XFe5Kj6P1RC9KiMREUTTmc, `placement`
  https://claude.ai/artifact/4BLxWmqzGpvF4gdin4tKdQ, `mat scale`
  https://claude.ai/artifact/JEQkqL5BpZBS3d2VBWZ4se, `style` V1–V9 (linked in
  brief 190).
