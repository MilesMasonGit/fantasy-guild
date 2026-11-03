# HANDOFF — what a fresh director resumes from

*Replaced whole each time a director session ends. Written 2026-11-02 late, at
the owner's word ("stop for today"), closing the director session of 1–2
November. Read `CLAUDE.md`, this file and `STATUS.md`, then verify with
`git worktree list` and `git log --oneline -5`.*

## On `main` (pushed; suite 7,383 green, engine work same on the last merge)

Merged this session: the encyclopedia as a searchable flowchart book (300 E3,
five owner looks) and its world places (T-290); world W4–W6 (building nodes by
terrain; the ledger's World plan and checks F; world tables as a CMS record,
guaranteed camps per ring, the Starter Camp's Stone patch); the ledger reading
the world tables (T-285) with perk bands and Hall pricing (T-281, T-279, T-280);
the balancing preview (L9, Apply locked) and XP pins that survive Sync (T-291);
wandering enemies cheaper (T-200); even start after a kill (T-249), carried-rule
wording (T-270, T-245), the weapon stat block (T-246); built-node slowdown removed
(T-283); pack tool and bench care (T-288, T-205 in part, T-206).

Owner Syncs, all id-diffed clean: world pack + Hall stars + Venom (7e716add);
combat + fish (3e0d5904); refill (7531bf9a); balancing 1 and 2 (d63f9a4d,
ba62dbd9); seed maps + balancing 3 (8d714721).

**Pacing now (Typical):** Starter Camp 34 min (budget 30), Plane 1 1 h 2 min
(budget 55), Plane 2 23 h 29 min (budget 1 day), walls 0. The preview proposes
nothing further; it lists 34 things numbers can't fix.

## Owner rulings this session (in `owner_feedback.md`; planning triages them)

Built nodes run at the wild speed. Every Live enemy and source is guaranteed in
its tier's inner ring in every world. World sources rest and refill. Hall prices
wait for a Guild Hall balance pass. The player no longer modifies playmats, **no
hidden world extras**, seed items are named "<Token> Map". All 16 XP pins kept.
⚠️ `concept_world_map.md` and brief 330 still say "built nodes weaker" and describe
hidden extras: planning should update them.

## Waiting

- **Performance round 2** (T-197 loot bob, T-198 hit loop and chips on the clock,
  T-202 shine fill): `perf/loot-bubbles` in `w2`, f29e6825, branched from 27c3a2a3,
  **not merged**. The session's 01:00 timer (Tue 3 Nov, `scratchpad/night2.sh`)
  runs the draw baseline retake on `p23b` at `main`, then the branch's work check,
  an A/B (floor8, floor40, notify300, cap128, heroes16, S2 at `--cpu=3.2
  --slowdown-target=4`) and `bench:crisp`. Results in `STATUS.md` once read; **if
  the timer died, run that first.** Merge `main` into the branch, gate, then the
  owner's short look (T-197 asks for one: piles bob, hit shake and chips, first-find
  shine); correct the CHANGELOG's probe numbers and GDD §14 after the bench. Owner
  question that can wait: keep the pile look (recommended) or trade it for speed.
- **Draw baseline:** failed three times on 2 Nov (Chrome delivered 5–7× for 4×
  asked); the engine baseline was retaken (ac8d9829). If it fails again, read
  `--cpu=3.2 --slowdown-target=4`, but compare must then use the same.

## Next (owner chooses; propose as one question)

1. **340 Hero bar and sheet detail**, **350 Tokens and the Token card detail**
   (expect WORK CHANGED), **360 Combat look** (mock-ups first): queued by planning.
   My recommendation was 340 + 350 side by side plus 360's mock-ups.
2. The owner's earlier eye-checks still open: K4, S9, hero orders, and
   `eyecheck/2026-11-02_world-pack.md` (done: archive it, verdicts ok, packs synced).
3. Tickets: T-286 (`relax` deopts, S4 worst-arrival noise), T-287 (enemy next steps),
   T-289 (pack-review tests fail under load even at 20 s: find what Finish waits on),
   T-292 (machinery retired maps left behind), T-205's rest.
4. Art list: 9 seed maps share `t_map_spooky`, 9 use stand-in map sprites; the
   Combat mark; the chart's marks.

## Worktrees

Spent, safe to remove with the junction routine: `b1`, `c1`, `c2`, `h1`, `k4`, `l1`,
`l5`, `e3`, `n4`, `w1`, `w3`, `w4f`. Live: `w2` (perf), `p23b` (bench, detached).
Planning: `pp`, `pcm`, `pco`, `psk`; `agent-a0babff7c0bc21948` is a planning agent's.
Merged branches can go; `look/2026-11-01`, `look/2026-11-02`, `merge/t200`,
`spike/encyclopedia-display` hold nothing needed.

## Lessons

- Restart the owner's dev server after every branch switch: a long-running one served
  a stale stylesheet and the chart's lines vanished.
- `git`'s bash `date` prints local time labelled UTC; ask PowerShell's `Get-Date`.
- A `TaskStop` on a shell leaves its child server running: kill it by port.
- Don't merge CMS code or re-stamp a pack while the owner reviews: they may accept the
  version in the inbox before your update lands (balancing 1 did).
- Packs: gate against `data/` (T-288 now does when the autosave is older). Sync runs
  Recalculate: what it derives can't be set by a pack without a pin.
- A subagent's "expected WORK CHANGED" can be wrong both ways: bench boards use their
  own Tokens (content changes don't reach them) and the even start didn't move them.
- The CMS's Sync has a confirm: an owner "synced" with no CMS sync commit means it
  wasn't confirmed; the browser pane answers no to `window.confirm`, so never Sync there.
- The owner lifted the two-helper limit for that batch only.
