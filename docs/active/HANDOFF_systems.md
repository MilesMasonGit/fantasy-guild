# HANDOFF — Systems director

*Written 2026-10-24 when the usage limit was reached. Verify each worktree with
`git -C .claude/worktrees/<name> status --short` and `git log --oneline main..<branch>`.*

## On `main` (pushed)

Brief 220 combat: C1 numbers, C2 gear and enemies, C3 supplies and the "used"
bubble (owner ok by phone), C4 Poison, Burn and boss moves. The bench baseline
holds the C1 work change (brief220-C1); the timing baseline predates C1's
longer fights, so **retake it on a quiet machine** (`--save-baseline`, engine
and draw).

## In flight

- **C5 encounters**, `systems/combat-encounters` (`se`): owner said "ok, merge
  it" (2026-10-24) **with one addition**: an enemy camp's clock runs only below
  its cap (a beaten boss or guardian returns one full interval later; forests
  and mines unchanged; WORK CHANGED expected). The builder was told to merge
  `main` in, build that, and commit WIP when the limit hit. Then: gate, bench
  `--accept-work-change`, merge. Shots in its `docs/active/eyecheck/shots/2026-10-24_c5_*`.
- **C0 content pack**: `cms/incoming/2026-10-24-combat-c0-first-content.json`
  (28 entries, format-checked; duels in the builder's notes: Goblin level 5,
  Chief level 20 Brute). **Not yet accepted.** Guard checked: newest autosave
  2026-10-20 21:11 is older than the last Sync (2026-10-21 09:12), so no
  unsynced owner work. To do: CMS in the pane, Changes to review, accept, Sync
  on `main`, id-diff every data file, push, STATUS line. Tell the owner to use
  "Restore from Game" if their browser workspace predates it (the T-188 warning).
- **Brief 230 skill loops**: S0 gap map done (scratchpad `s0_gap_map.md`;
  copy its plan into STATUS before the scratchpad goes). Next: S1a (engineer:
  80 % floor, Grow Time effect, can't-drag mark, stations never wear out),
  then the batches S0 proposed.
- C6 combat screen: not started (mock-ups first, the owner picks by phone).

## Owner rulings this session (record in the docs they govern)

- Combat: Goblin Chief stays tough; level-1 coin toss kept; unarmed promoted
  heroes punch with style and XP; Block removed; enemy kinds stay harder than
  their level; two elixirs stack as two bubbles; Recruits need food to beat a
  goblin (keep the level-5 Goblin); C5 as above.
- Skill loops: a station out of input waits unless other work in reach runs;
  a map's wheat patch is a ready-planted Field; **no loud pop** for rare
  catches (drop like any item); drinks only buff, no healing; supports never
  wear out. Director's calls: S0 Q2, Q3, Q4, Q7, Q8, Q10, Q12, Q13 as option A.

## Worktrees

`sc`, `sg`, `su`, `st` are merged and can be removed (junctions first, see the
director skill). `se` holds C5.

## Lessons

- The browser pane is hidden: take screenshots for the owner with headless
  Chrome via `bench/browser/cdp.mjs` (scratchpad `cap_bubble.mjs`).
- File-scan tests time out under parallel load: re-run them alone.
- `AtlasTravel.test.js` and `BoardCombat.test.js` "a fresh Recruit beats a
  weak enemy" each flaked once: look for unseeded `Math.random` or wall-clock
  time in enemy movement or tests.
