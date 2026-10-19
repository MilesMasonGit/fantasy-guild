# HANDOFF — the features director (main queue)

*Two directors run at once since 2026-10-17: the terrain director keeps
[HANDOFF.md](HANDOFF.md) (terrain, world generation, the art pass, now the
playmat style); this file is the features director's, replaced whole each
time it ends. Written 2026-10-18 evening by the first features director. Read
`CLAUDE.md`, this file and `STATUS.md` (the "Features director" sections).*

## On `main` (b68cd020, pushed)

The whole first features run, merged after the owner's eye-check ("Eye check
is good", 2026-10-18) and the gate on the merged result (5302 tests, cycles,
build, the engine work check):

- **Brief 100, the style kit:** QA → Style Sheet; the shared `ArrowScrollList`,
  `Tooltip`, `PixelFrame` (studs, chamfer), `PixelGlyph`; `.ui-text-*` sizes;
  `--color-ui-*` colours. New pieces go in the page's *new, unapproved* group.
- **T-167, everyone fights:** a Recruit fights as level 1, no combat XP until
  promotion; hostile enemies watch the hero's **flag**, the same on every side
  (owner 2026-10-18). The engine work check changed on S2, S3, S5, S6, S8,
  S8L, S8F and was accepted under T-167 in `bench/baseline.json`.
- **Brief 140, the hero bar:** Work Permissions (square 32 px cells, centred on
  the visible mat, one Combat column with priorities, purpose tooltips), the
  level-up moment, the shine.
- **Brief 110, map tools:** camp Tokens are fixtures (two lines in the terrain
  director's `atlas/StarterCamp.js`), Demolish mode beside Disallow, the top
  bar restyle.
- **Brief 120, the mat, hover and the card:** a work bar and one problem mark
  at rest, hover in two steps (one mat timer), the Token card with art by
  activity and a CMS **Card art** field.

Closed: T-159, T-160, T-161, T-164, T-156, T-177, T-149, T-178, T-165, T-166,
T-170, T-167. Open with what's left noted: T-030 (tooltips), T-038 (text
sizes). New: T-191 (the shine, more solid, a refinement), T-192 (a flaky
loot-landing test).

## Branches and worktrees

None of this director's remain: `k1`, `t167`, `hb`, `mt`, `il`, `ec`, `mg`
removed and their branches deleted. `ar`, `bl`, `p23b`, `pl`, `pp`, `sp`, `wg`
belong to the terrain director or the planning agent; leave them. **`sp`
(`crunch/style-p1`, the playmat style agent) was cut before this merge** and
will meet heavy changes in `MatToken.jsx`, `MatBoard.jsx`, `TokenBubbles.jsx`,
`MatTopBar.jsx`, `tailwind.css`: it should merge `main` in early.

## Owed

- **Benches in a quiet window, on `main`** (STATUS queue): the engine timing
  re-run (daytime load read S3/S4/S7 slower on `main` too, so not ours), one
  `bench:draw --compare` and `bench:crisp` for the cost log. Brief 120 C1 must
  draw cheaper than before; if it draws dearer, a ticket and tell the owner.
- **The eye-check's 16 questions** stand at the recommendations (owner: detail
  fixes wait for a refinement pass); they are listed in the archived file
  [`archive/eyecheck/2026-10-17_style-kit.md`](../archive/eyecheck/2026-10-17_style-kit.md).

## Owner to-dos (on `main`, in the CMS)

1. A weak, safe Starter Camp enemy a level 1 fighter beats (weaker than the
   Cow: level 1, 32 HP, hits 8–10), placed in the camp, Sync.
2. Card art overrides where the activity picture is wrong (Tokens → Identity →
   Card art); draw the missing activity scenes (forestry, farming, crafting,
   commerce, construction, a fight), `backgrounds/skills/b_<skill>.png`.

## Next phases (queue in `briefs/README.md`)

1. **Brief 170, quest boards** (needs 120: done).
2. **Brief 130, the recipe list** (needs 120: done).
3. **Brief 150, notifications** or **160, the Atlas tome** (UI side only;
   `src/systems/atlas/` is the terrain director's).
4. Fillers: T-186, T-187, T-189, T-192.

## Working with the terrain director

They own `src/systems/atlas/**`, `src/systems/board/Terrain*.js`,
`groundScreen.js`, `terrainRegistry.js`, `playmatTuning.js`,
`src/ui/dev/terrainDev.js`, `docs/active/research/ground_gen/`. Two code agents
on the PC in total; check their last commit time before running two of yours.
See memory "Two Directors".

## Lessons

- **A non-reproducible owner bug: ask how they did it first** (multiple
  choice). The Goblin "doesn't start" was a near drop on the wrong side; an
  engineer spent an hour before the answer came, then found a real one-sided
  rule.
- **Stack branches and serve one frozen preview** (a detached worktree on a
  fixed port): the owner's saves carry over, builders keep working.
- **A fresh worktree's first dev start redraws ~700 sprite outlines (5 s)**:
  start it yourself and reload before the owner looks.
- **Removing junctions in bash:** build the path in a variable
  (`B='C:\...\worktrees\'; P="${B}${w}"; cmd //c "rmdir ${P}\node_modules"`);
  `\${w}` inside the quoted path does not expand.
- **The work check is load-proof; timing is not:** a control run of `main`
  showed the same timing "regressions", so merging on the owner's word with the
  work check alone was safe; the timing re-run waits for a quiet window.
- An "I can't click it" from an agent with a hidden pane was wrong once; an
  `elementFromPoint` sweep settles it.
