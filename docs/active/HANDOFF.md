# HANDOFF — what a fresh director resumes from

*Replaced whole each time a director session ends. Written 2026-10-31 late, at
the owner's word, closing the director session of 29–31 October. Read
`CLAUDE.md`, this file and `STATUS.md`, then verify with `git worktree list`
and `git log --oneline -5`.*

## On `main` (44f0f6d1+, pushed; suite 7,040 green on the last merge)

Briefs 260 (hero orders), 270 (classless, perks), 280 V1–V3 + V5's GDD
(combat; **V4 dropped by the owner**), 290 L1–L8 (ledger: plan, engines,
checks, rate calculator, timeline, gate; L8 fix pack synced), 300 E1–E2
(encyclopedia), 310 (Bank at scale), 320 H1–H2 (Guild Hall stars machinery,
the ledger prices stars; Hall payback 24 h), 330 W1–W3 + follow-ups (world:
generation, map screen, a place's mat, Stone, darkened arrival, tutorial
ending; modifiers inside the 6-hero cap, camps asleep while held). Tickets
T-248, T-254, T-265–T-269, T-271–T-278; engine fixes (rest timing, leftover
time); the walker glide on whole pixels (draw regression fix). Owner Sync
87d588e5 (first-fill, fix pack, perks). Bench baseline accepted under
`perks-sync-rest-carry` (bb0aeca9).

⚠️ **Not looked at by the owner** (merged on "merge what you have"): Guild Hall
H1 (the sky, QA → Guild Hall) and the walker glide. Records in
`docs/archive/eyecheck/`. Ask the owner to look when convenient.

⚠️ **Merged without a work check** (outside bench hours): combat V1–V3, the
world W2–W3, Hall H1–H2, the glide, the world follow-ups. Each branch passed
its own work check earlier (same work); the session's timer runs
`bench --compare` on `main` at 01:00 Sun (log in its scratchpad). **If that
timer died, run it first**: expect same work against `perks-sync-rest-carry`.

## Waiting for the owner

- **Packs** (in `docs/active/research/pending_packs/`, git-tracked copies with
  their generators): the **combat content pack** (re-stamp with
  `combat_v5/mkpack.mjs --from <workspace>` against the owner's current
  workspace; 36 records shared with the first fill, already synced) and the
  **Hall first star list** (`hall_h3/`, priced on data + the ledger packs,
  both now synced; re-check with `changePackTool check` and `gate`). Then
  copy to `cms/incoming/`. After the combat merge the owner's next Sync also
  renames Poison → Venom (three entries); id-diff every file after it.
- A small **fish pack**: give Tropical Fish, Salmon, Swordfish and Lobster a
  tool-free source (ContentRules rule 1 lists them as known failures).
- Content to delete after the world: 9 Base Maps, the map and modifier drop
  lines, the two Academies, their Training effects, the Fighter's Academy
  recipe; the Shrimp Market's skill.
- Older eye-checks still open: K4, S9, hero orders (`docs/active/eyecheck/`).

## Next (owner-approved, in order)

1. **300 E3, the encyclopedia's search-first flowchart rework** (owner
   interview 2026-10-31, in the brief and `concept_knowledge.md`).
2. **The bench's S2 gets its fights back** (heroes 1–2 ordered onto a Token
   inside each camp's watch; bench-only), then retake both baselines on a
   quiet machine (`npm run bench -- --save-baseline`, `bench:draw -- --save-baseline`).
3. 330 W4 (node building), W5 (ledger World plan, checks F), W6 (world pack);
   320 H3 pack review; 290 L9 (automatic balancing, preview first).
4. Tickets: T-270, T-249 (now combat is in), T-279, T-280, T-281, perf
   T-197–T-202; the crisp bench failing on `main`'s S2; a walker snap when
   passing another Token.

## Worktrees

Many are spent: `k4`, `c1`, `c2`, `h1`, `w1`, `w2`, `w3`, `w4f`, `l1`, `l5`,
`b1` (all merged or detached), `p23b` (scratch). Planning: `pp`, `pcm`, `pco`,
`psk`. Remove spent ones with the junction routine (PowerShell `cmd /c rmdir`
both junctions, check the real `node_modules`, `git worktree remove`); the
classifier may refuse, then ask the owner.

## Lessons

- A merge that resolves conflicts runs the pre-commit hook: when it carries
  `main`'s data commit, commit with `ALLOW_CONTENT_CODE_MIX=1`.
- Never start new work in a worktree a queued bench will run in.
- `git add` with a path that no longer exists fails the whole command: stage
  moved files separately, and check `git status` before switching branches.
- An agent's synced content (perks) changes bench work and exposed two real
  engine bugs: after every owner Sync, run the suite and the bench.
- Draw regressions can come from correct game changes (living goblins); bisect
  with alternating runs and compare absolute numbers, not each commit's own
  baseline.
- The owner calls the handoff; content specifics are the director's call.
