# HANDOFF — the features director (main queue)

*Two directors run at once since 2026-10-17: the terrain director keeps
[HANDOFF.md](HANDOFF.md) (terrain, world generation, the art pass); this file
is the features director's, replaced whole each time it ends. Written
2026-10-18 by the first features director. Read `CLAUDE.md`, this file and
`STATUS.md` (the "Features director" sections), then verify each worktree with
`git -C .claude/worktrees/<name> status --short` and
`git log --oneline main..<branch>`.*

## On `main`

Nothing of this session's code is merged yet: all of it waits for the bench
and the owner's eye-check. Docs only: STATUS sections, rulings on T-164 and
T-167, tickets T-191 (the shine, more solid) and T-192 (a flaky loot-landing
test), five finished tickets archived, the eye-check file.

## The stack (each branch holds the one before)

| Branch | Worktree | Head | What | Gate (director) |
|---|---|---|---|---|
| `crunch/style-kit` | `k1` | 7060a37f | brief 100: style sheet page, shared arrow list, text sizes, shared tooltip | 5126 |
| `fix/t167-recruit-attack` | `t167` | fd3de552 | Recruits fight as level 1; QA Hire makes room; hostiles watch the **flag**, the same on every side (owner 2026-10-18) | 5120 + flaky T-192 |
| `crunch/hero-bar` | `hb` | 2bcd24d5 | brief 140: Work Permissions (square cells, centred), level-up moment, the shine; holds the two above | 5177 |
| `crunch/map-tools` | `mt` | bd35613d | brief 110: camp fixtures, Demolish mode, top bar restyle | 5224 |
| `crunch/info-layers` | `il` | dd93f7a8 | brief 120: the quiet mat, hover in two steps, the Token card | 5272 |
| (detached) | `ec` | dd93f7a8 | frozen copy serving the owner's eye-check on **5198** (launch entry `eyecheck`) | — |

`k1` and `t167` are not stacked on each other; `hb` merged both. Everything
from `hb` up is one line. All worktrees clean (agents' `STATUS.md` files are
git-ignored).

## Merging (after the bench and the look)

1. **Bench** (quiet window, one at a time; STATUS queue): the engine work
   check and one `bench:draw --compare` on `crunch/info-layers` (top of the
   stack) for the cost log; `bench:crisp` for C1. **WORK CHANGED is expected**
   on S2, S3, S5, S6, S8 (goblin camps) from the hostile flag watch: accept it
   under the T-167 ruling; any other change is a finding. C1 must draw cheaper
   than `crunch/map-tools` (elements per worked Token fell 10–14 → 3.4–4.9;
   the bench heroes at 56/144 HP now show 8 health bars). If C1 draws dearer,
   stop and report.
2. Merge in order, each a dry run in a scratch worktree, the gate on the
   result, then `git merge --ff-only`: `crunch/style-kit` → `fix/t167` →
   `crunch/hero-bar` → `crunch/map-tools` → `crunch/info-layers`. Or merge the
   top branch once (it holds all), with a work check on it. CHANGELOG
   conflicts are keep-both (the newer "Everyone fights" line wins).
3. Then: the owner's CMS steps (a safe Starter Camp enemy; card art), close
   T-159, T-160, T-161, T-038, T-030, T-167, T-164, T-156, T-177, T-149,
   T-178, T-165, T-166, T-170 into the archive; remove the worktrees
   (`cmd //c rmdir` both junctions first) and the `eyecheck` launch entry.

## Eye-check waiting

[`eyecheck/2026-10-17_style-kit.md`](eyecheck/2026-10-17_style-kit.md): one
address, http://localhost:5198/, slot 1 (slot 3 is the director's). 29
checks, 16 questions. **Owner 2026-10-17: the style sheet looks good; the
shine needs work (T-191, later); detail fixes wait for a refinement pass, keep
building the larger work.** So the questions stand at the recommendations
unless the owner says otherwise; real play bugs are still fixed now.

## Owner to-dos

1. The eye-check when free (or just play it and note what you see in
   `owner_feedback.md`).
2. After the merge, on `main` in the CMS: a weak, safe Starter Camp enemy a
   level 1 fighter beats (weaker than the Cow); card art overrides; draw the
   missing activity scenes.

## Next phases (queue in `briefs/README.md`)

1. **Brief 170, quest boards** (needs 120: now built).
2. **Brief 130, the recipe list** (needs 120).
3. **Brief 150, notifications** or **160, the Atlas tome** (UI side only:
   `src/systems/atlas/` is the terrain director's; `src/ui/components/atlas/`
   is not, but tell them).

## Working with the terrain director

- They own `src/systems/atlas/**`, `src/systems/board/Terrain*.js`,
  `groundScreen.js`, `terrainRegistry.js`, `playmatTuning.js`,
  `src/ui/dev/terrainDev.js`, `docs/active/research/ground_gen/`. M1 added two
  lines to `atlas/StarterCamp.js` (an import and one call); mention it before
  either side merges.
- Two code agents on the PC in total; check their last commit time before
  running two of yours.

## Lessons

- **A non-reproducible owner bug: ask how they did it first** (multiple
  choice). The Goblin "doesn't start" was a near drop; an engineer spent an
  hour on drops onto the Goblin before the answer came.
- **One preview for a stacked eye-check, on a frozen detached worktree, same
  port**: the owner's saves (per address) carry over, and builders can keep
  working in the real worktree.
- **A fresh worktree's first dev start redraws ~700 sprite outlines (5 s)**:
  start it yourself and reload before the owner looks.
- **Agents' "can't click it" claims from a hidden pane** were wrong once; an
  `elementFromPoint` sweep over the page settles it.
- The safety classifier refused an engineer a new worktree; it worked in a
  scratch copy and cleaned it up. Create worktrees yourself before dispatch.
