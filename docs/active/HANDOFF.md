# HANDOFF — what a fresh director resumes from

*Replaced whole each time a director session ends. Written 2026-10-30 evening by
the director session of 29–30 October (kept current as insurance; the owner
says when the session hands off). Read `CLAUDE.md`, this file and `STATUS.md`,
then verify with `git worktree list` and `git log --oneline -5`.*

## On `main` (pushed; `main` work check same 13:00 Fri)

- Briefs **260** (hero orders), **270** (classless heroes, all phases; perks),
  **310** (Bank at scale + T-268/T-269), **290 L1–L7** (ledger: plan, engines,
  Ledger tab, checks and item page, reach fixes T-271/T-272, rate calculator
  S0+L5 with calibration, timeline and hubs, ghost dots and the pack gate).
- Bench baseline accepted under `brief270-K1` (7920232e).

## Waiting for the owner's looks (branches not on `main`)

- **Encyclopedia** (brief 300 E1+E2): `feat/encyclopedia` in `k4`; work same;
  [file](eyecheck/2026-10-30_encyclopedia.md).
- **Combat v2 parts 1–3** (brief 280 V1–V3): `feat/combat-v3` in `c1` holds
  V1 (`feat/combat-v1`) and V2 (`feat/combat-v2`, `c2`); each benched same work;
  [file](eyecheck/2026-10-30_combat-v1-v3.md) (12 checks, 13 questions).
  `feat/combat-v5` (`c2`) adds V5's docs (GDD §4/§6/§7, glossary) on top: merge
  it with V1–V3. **V4 dropped by the owner.**
- Handover: detach the agent worktree, switch the owner's folder, start `dev`,
  wait for `window.Game`, then tell the owner; switch back to `main` right after
  (lesson: the owner Synced onto an eye-check branch once).

## Packs (owner's CMS inbox, `main`'s `cms/incoming/`; copies in the scratchpad)

Accept in order: **ledger first-fill** (red gate banner expected, T-274; finish
anyway), **ledger fix pack** (30 entries shared with first-fill), **example
perks**. After the owner's Sync: id-diff every data file; the fix pack and
first-fill should change only plan blocks plus the fix pack's 42 entries.
**Combat content pack** (V5): only after combat merges; re-stamp with the
scratchpad's `v5/mkpack.mjs --from <owner workspace>` (36 records shared with
first-fill), then copy to `cms/incoming/`. ⚠️ The scratchpad is this session's;
a new session must regenerate from the brief if it is gone.

After the combat merge the owner Syncs once: Poison → Venom changes exactly
three entries (V2's migration).

## Next

1. Owner looks; fixes on the branches; merge combat (with V5 docs) and the
   encyclopedia, each after `main` merged in and the gate.
2. Small-tickets pass (owner rule: after the briefs): T-265, T-266, T-267,
   T-270, T-273 (engine; accept a work change), T-274, and the rest.
3. 290 L9 automatic balancing (preview first).

## Bench

- **Sat 01:00 timer** (this session): quiet `bench:draw --compare` on `main`.
  30 Oct afternoon `main` drew ~2× slower than the 29 Oct baseline under load;
  if still 2× when quiet, A/B against a4a124be.
- The S1 p99 timing flag (0.10 → 0.13 ms) shows on every run: stale baseline.

## Worktrees

`k4` encyclopedia; `c1` combat V3; `c2` combat V5; `l1` (spike, merged; free),
`l5` (L7, merged; free), `b1` (free), `p23b` scratch; planning: `pp`, `pcm`,
`pco`, `psk`. Remove free ones with the junction routine (PowerShell
`cmd /c rmdir` both junctions, check the real `node_modules`, `git worktree remove`).

## Lessons

- Planning rewrites briefs mid-build: re-read from `main` when a report lands.
- Two timers fired at once after an app crash (the old one survived): check
  running bench processes before starting a timer.
- Daytime draw numbers can be ~2× off; a back-to-back `main` control decides.
- Packs that share records must be accepted in a fixed order; stamp the later
  one against the earlier one applied.
