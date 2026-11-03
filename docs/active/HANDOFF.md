# HANDOFF — what a fresh director resumes from

*Replaced whole each time a director session ends. Written 2026-11-03 17:00, at the
end of the clean-up the owner asked for before the new briefs. Read `CLAUDE.md`, this
file and `STATUS.md`, then verify with `git worktree list` and `git log --oneline -5`.*

## On `main` (pushed; suite 7,350 green, 4 skipped; engine work same on the last merge)

Merged 3 Nov: performance round 2, cheaper loot piles, hit shakes and stub shine (T-197,
T-198, T-202); the bench's false alarm on a pushing arrival (T-286); the review page's
lost click, which was the two flaky CMS tests (T-289); the retired map machinery out of
game and CMS (T-292, T-298); envelope scenes in drag, profile and crisp (T-205);
enemy camps count what they spawned instead of walking the mat, and loot flights read
their boxes on their first frame (T-287's safe parts).

**Nothing is waiting on the owner.** The eye-check folder is empty: K4, S9 and hero
orders closed by the owner without line verdicts and archived. No code branch is open.

**Pacing (Typical, last measured 2 Nov):** Starter Camp 34 min (budget 30), Plane 1
1 h 2 min (budget 55), Plane 2 23 h 29 min (budget 1 day), walls 0.

## What to know about T-287's numbers

Nothing measured says frames got better. Census: Token visits for the "is this camp
full" question on `enemies80` went from about 2,830 a tick to 0, proven by comparing
with a mat walk (1.26 million comparisons, no difference). Draw A/B on `enemies80` at
3.2×, A B B A: one clean pair, 48.6 fps after and 48.3 before; the other pair had Chrome
delivering 4.4–5× on the after side and 3.6–4.1× on the before side, so the headline
median (36.3 vs 39.6, -21 % work) is throttle drift, not a loss. Loot flight alone: 36.4
fps both ways, kept for the clean tick and 76 fewer lines. Don't quote a frame gain.

## Owner rulings this session

Eye-checks K4, S9, hero orders count as completed. Stray branches cleaned: `atlas-wip`,
`crunch/style-p2`, `spike/encyclopedia-display` deleted and kept as local `archive/`
tags (the owner dropped `style-p2` on 18 Oct). T-287's walk-end rebuild needs a ruling
before anyone builds it: it is parked on the ticket, not asked yet.

## Next (owner chooses; propose as one question, only when the owner says ready)

1. The owner is planning; **wait for the go.** Queue from the briefs table: 340 hero bar
   and sheet, 350 Tokens and card (expect WORK CHANGED), 360 combat look (mock-ups
   first), 370 rivers and ground, 380 world map, 390 Guild Hall, 400 Bank.
2. Tickets now open from this clean-up: T-287 (the three parts left), T-294 (planning
   sized, for the new briefs), T-299 (bigger forced layouts than the flight's), T-300
   (leftovers from the map retirement).
3. Owner, optional: delete the Token Volcanic Island in the CMS and Sync on `main`; its
   `mapId` is read by nothing. `renderGolden.json` has a row for it, so regenerate the
   golden afterwards. Art list: 9 seed maps share `t_map_spooky`, 9 use stand-ins.

## Bench

Engine baseline ac8d9829 (2 Nov), draw baseline b4aa17f2 (3 Nov), both older than today's
merges. **Retake queued for Wed 4 Nov 01:00** on `p23b` by a timer script
(`npm run bench -- --save-baseline`, then `npm run bench:draw -- --save-baseline`; logs
`baseline_*.log` in the session scratchpad). If this session is gone or no baseline commit
dated 4 Nov is on `main`, run them in the next quiet window and commit with the date. A
draw baseline can refuse on Chrome's throttle (three failures on 2 Nov): retry it, leave
the engine one. Never `--only=… --save-baseline`: it drops the other scenarios.

## Worktrees

`p23b` (scratch and bench, detached at `main`). Planning: `pp`, `pcm`, `pco`, `psk`.
Everything else is removed; no merged branch is left.

## Lessons

- **`TaskStop` on a shell leaves its children alive.** A gate script I stopped kept
  waiting and started a surprise suite 80 minutes later. Stop a script by its PID tree,
  and check `Win32_Process` for it after any `TaskStop`.
- A script's "wait until no vitest is running" can wait forever on a stuck run: name the
  PID, and put a limit on the wait.
- A merge that mixes `data/` and code trips the hook (rightly): merge the branch INTO a
  copy of `main` in `p23b`, then `git merge --ff-only <sha>` in the main folder, then push.
- Don't `cd` in a Bash call: it moved this session's working folder to `p23b`. Use `-C`
  or a script.
- A draw A/B's first window is often throttled harder than the rest: read the slowdown
  column of each pair before believing a median.
- Timing verdicts with a helper on the machine are noise (S4 and S5 read REGRESSED beside
  one busy core and were clean on the next quiet run). The work check decides.
- A subagent's long test can pin a core and outlive its shell: briefs should say to bound
  any long run.
- Restart the owner's dev server after every branch switch. `git`'s bash `date` prints
  local time labelled UTC; ask PowerShell's `Get-Date`.
- Don't merge CMS code or re-stamp a pack while the owner reviews. Sync runs Recalculate:
  what it derives can't be set by a pack without a pin. Sync has a confirm, and the
  browser pane answers no to `window.confirm`, so never Sync there.
