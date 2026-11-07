# Review round 4: findings and how they become tickets

*The working folder of the 2026 code review
([concept_code_review_2026.md](../concept_code_review_2026.md)). The reviewer
(`/reviewer`) writes here and nowhere else; the planning agent reads here to
file tickets; the director reads the briefs that come out of it.*

## What is in this folder

| File | Written by | What |
|---|---|---|
| `STATUS.md` | reviewer | the session table (R0 to R12: state, date, commit, one-line summary), counts of findings by state, open questions for the owner |
| `R<n>_<area>.md` | reviewer | one findings file per area, in the format below, with a session summary at the top |
| `baseline/` | director (numbers) and reviewer (tool reports) | the before: bench, draw, soak, bundle, suite time; the saved output of knip, depcruise, cycles, jscpd and lint, each with date and commit |
| `doc_audit.md` | the doc audit (phase 0) | every doc with a verdict and the stale claims found |
| `triage_<date>.md` | planning agent | each owner triage batch: the questions asked, the answers, which tickets were filed |

## A finding

```
### CR4-NNN  Short title in plain words
- **Tag**: bug | perf | memory | cleanup | docs | test | owner-decision
- **Priority / Effort / Risk**: P1 | P2 | P3  /  S | M | L  /  low | medium | high
- **Confidence**: measured (number, scenario, commit, machine) | verified (second reader confirmed the code) | reasoned
- **Where**: path:line (every path checked to exist at the commit named in the session summary)
- **What**: what the code does and why it matters to the player or to the next agent, two to five sentences
- **Evidence**: the lines, the command output, or the bench number
- **Fix sketch**: the smallest change that would do, and what must not change (saved layouts, bench work fingerprint, a locked design)
- **Hypothesis to test** (perf and memory only): what the bench or soak should show if this is real
- **Verified by**: who checked it and how, or the word unverified
- **State**: open | ticket T-NNN | moot (why) | owner-no (date)
```

Rules that keep the format honest:

- Numbers are given with the `CR4-` prefix in the order found, across all
  areas; `STATUS.md` keeps the next free number.
- A finding without a `path:line` is a note, not a finding; it goes under
  "Notes" at the end of the file.
- `owner-decision` is set whenever the fix would remove or downgrade
  something a player can see or do, even slightly. It is never resolved by
  the reviewer or the planning agent.
- `reasoned` findings about speed or memory stay P2 or P3 until measured.
- A finding stays `unverified` until the second check; the verifier's note
  says what was read and what command was run, not "looks right".

## From finding to ticket to fix

1. **Reviewer** writes findings for an area, verifies each, then updates
   `STATUS.md` and commits on the `review` branch (and fast-forwards `main`,
   as the planning agent does).
2. **Planning agent**, at its next session, reads `STATUS.md` for areas marked
   `ready for triage`, then:
   - groups the verified findings into a triage batch of at most about
     fifteen, `owner-decision` items first, each written for the owner in plain
     words (what the player sees today, what would change, options with the
     recommendation first);
   - asks the owner the batch as multiple choice and records the answers in
     `triage_<date>.md`;
   - files one ticket per accepted finding in `TICKETS.md` (next free `T-`
     number; Origin `CR4-NNN`; one line), sets the finding's state to
     `ticket T-NNN`, and marks the rest `owner-no` or `moot` with the reason;
   - writes fix briefs into `docs/active/briefs/` grouped so a director can run
     them: cleanup briefs first (dead code, duplicates, cycles: low risk,
     mechanical, builder-lite or runner), then perf briefs (each slice with its
     A/B measure, engineer), then refactor briefs (engineer, one at a time),
     and adds their rows to the order table in `briefs/README.md`.
3. **Director** runs the briefs through the usual loop: worktree per phase,
   merge gate, the bench work check on every merge, a per-slice A/B for perf
   slices in a downtime window, eye-check only if the look or play changes.
   When a ticket closes it goes to `docs/archive/tickets_done.md` as always.
4. **Reviewer, at the end**, re-reads each closed CR4 ticket against the code
   (round 3's lesson: a cited line inside dead code was once marked fixed), and
   the director re-records the baselines for the before/after table.

## What the owner sees

Plain-language triage batches, one at a time, each naming the feature by what
it does for the player. Nothing is removed or downgraded without an answer
recorded in a triage file. Eye-check files appear as usual for anything that
changes how the game looks or plays.
