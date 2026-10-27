# HANDOFF — Systems director

*Replaced whole each time. Written 2026-10-27. Verify with `git worktree list`
and `git log --oneline -5`; STATUS.md holds the phase tables.*

## On `main` (pushed, 62c052a7; suite green, 6601 tests)

- **Brief 220 combat: complete** (C1–C6, C0, C6c fight bars above loot).
- **Brief 230 skill loops: complete except the owner's eye-check.** Every
  engine phase merged; the content pack synced by the owner (47d19bec); tests
  fixed. **S9 eye-check waiting**: `docs/active/eyecheck/2026-10-26_skill-loops-s9.md`
  (9 checks, 45 shots, 14 rough edges for the owner to rank).
- **Brief 240 basic content: complete except K4.** K0 engine gaps merged; the
  owner synced pack 1 (72ce473d), pack 2 (cb493683), the balance pack and pack 3
  (58d02d01), and the boss follow-up (6b63c8e9); a `tannery` station kind added.
  Owner rulings this round: plane-1 bosses +1 hit (on top of kind); blends
  busier than ~6 enemies accepted; berry bushes and cherry/peach trees refill;
  iron armour 1 per piece, plane-2 bosses +1 more; a Tannery kind; density on a
  full map just reshuffles it; **the Greater Slime, Queen Bee and Toxic Frog stay
  hard** (poison really ticks; their earlier duel numbers had left it out).
- Bench: work fingerprints accepted under brief220-C1, -C5, brief230-S1a; the
  timing baseline predates C1: retake `--save-baseline` (engine and draw) quiet.

## Waiting on the owner

- Verdicts on the S9 eye-check and a ranking of its 14 rough edges (top ones:
  loot buries what's worked; a Mine's veins spawn in a heap; a hero's flag hides
  a Token's yellow mark; cards show the base work time under a speed-up).
- A Yellowstone banner (the Bog and Yellowstone share the swamp picture).
- Optional: T-253 CMS tuning page, T-254 leftovers, T-249 even first swing,
  T-248 enemy strolls over the mat edge.

## Next (brief 240 K4)

The play-through check of the whole content (Starter Camp → plane 1 → plane 2),
screenshots for the owner, then a session close. CMS still served on 5147 from
this session (background process); stop it when closing.

## Worktrees

None of the Systems director's left. Planning worktrees (`pp`, `pcm`, `psk`,
`pco`) and `p23b` belong to other sessions.

## Lessons

- **Packs are built in scratch and copied into `cms/incoming/` once**, after
  every check: the owner accepts packs as soon as they appear (memory:
  feedback-packs-staged-in-scratch).
- After every owner Sync: id-diff each data file against the applied pack(s),
  then run the full suite and fix content-pinned tests in one pass.
- **Never chain a merge after a test run with `;`**: on 2026-10-27 a red suite
  merged anyway (fixed within minutes). Read the result, then merge.
- Duel harnesses must tick statuses (the game loop's status tick), or poison and
  burn bosses look easy.
- The CMS in a fresh browser starts with an empty workspace: Restore from Game.
- Two directors share ticket numbers: re-read "Next free number" and grep for
  the number before filing.
