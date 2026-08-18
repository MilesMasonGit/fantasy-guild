# Code Review **Round 2** — Findings Tracker

Persistent tracker for the second full-codebase review. See
[`code_review_v2_guide.md`](code_review_v2_guide.md) for scope, objectives,
scoring, and the session plan. **Every review session writes into this file**;
fix waves later update ticket statuses here.

Round 1's tracker (`code_review_findings.md`, 53 tickets, to be archived) is
history. Only the leftovers carried forward by Prerequisite 4 appear here.

---

## Session Status *(update at the end of every session)*

| # | Session | Status | Notes |
|---|---|---|---|
| — | Prereq 1: preliminary cleanup phase committed + merged, tree clean | ⬜ Not started | Own brief: [`cleanup_phase_brief.md`](cleanup_phase_brief.md). Runs on a `cleanup` branch off `main`. Planning-time baseline was `f8dcae0` on `main` (clean). Record the merge commit here. |
| — | Prereq 2: baseline test run recorded | ⬜ Not started | ⚠ **Suite was RED at planning time: 86 failed / 912 passed, 17 of 62 files (`f8dcae0`, 2026-08-18).** Cleanup phase objective 1 clears it. Green is a blocker for Session 1. Also read the cleanup's Retired Tests Ledger — stale tests were deleted, not rewritten. |
| — | Prereq 3: fresh reachability list generated | ⬜ Not started | `node tools/reachability.mjs` → paste output into *Shared Inputs* below. Cleanup phase generates this; re-run after its deletions so the review sees the post-cleanup floor. |
| — | Prereq 4: round-1 leftovers re-triaged | ⬜ Not started | 17 tickets: CR-010/012/014/015/016/019/023/024/025/031/032/034/042/043/046/047/050. Each → superseded, or re-filed as CR2. |
| — | Prereq 5: round-1 docs archived | ⬜ Not started | Move `code_review_guide.md` + `code_review_findings.md` to `archive/` **after** Prereq 4 reads them. Handled by the cleanup phase's doc-archiving step (its objective 5). |
| 1 | State core & serialization | ⬜ Not started | |
| 2 | Board engine (the 7×7 playmat) | ⬜ Not started | |
| 3 | Combat, heroes, skills & promotion | ⬜ Not started | |
| 4 | Cards, economy, inventory, quests & progression | ⬜ Not started | |
| 5 | Content pipeline & the CMS boundary | ⬜ Not started | |
| 6 | UI ↔ engine boundary | ⬜ Not started | |
| 7 | UI components | ⬜ Not started | |
| 8 | Runtime verification (hands-on) | ⬜ Not started | |
| 9 | Build, Tauri readiness & synthesis | ⬜ Not started | |

**Next ticket ID:** CR2-001

Status values: `⬜ Not started` → `🔄 In progress` → `✅ Done (date)`.

---

## Shared Inputs *(filled by the prerequisites, used by every session)*

### Baseline

- Branch / commit: *(Prereq 1)*
- Test baseline: *(Prereq 2)*
- Build baseline: *(Session 9 measures; round 1 ended at 1,036KB JS / single chunk)*

### Reachability — files nothing imports *(Prereq 3)*

*Paste `node tools/reachability.mjs` output here. Caveat from the tool's own
header: the import regex also matches commented-out imports, so this list is a
floor, not a ceiling. Ignore `src/tests/` lines — vitest finds those itself.*

```
(pending)
```

### Round-1 leftovers — triage results *(Prereq 4)*

| Round-1 ticket | Verdict | Carried as |
|---|---|---|
| CR-010 (P2) | | |
| CR-012 (P3) | | |
| CR-014 (P3) | | |
| CR-015 (P3) | | |
| CR-016 (P3) | | |
| CR-019 (P2) | | |
| CR-023 (P3) | | |
| CR-024 (P3) | | |
| CR-025 (P3) | | |
| CR-031 (P3) | | |
| CR-032 (P3) | | |
| CR-034 (P3) | | |
| CR-042 (P2) | | |
| CR-043 (P3) | | |
| CR-046 (P3) | | |
| CR-047 (P3) | | |
| CR-050 (P2) | | *(orphaned portal DOM; root cause open, portal-heavy UI rebuilt since)* |

Verdicts: `Superseded (code deleted by rework)` / `Still live → CR2-NNN` /
`Fixed incidentally (verify + note where)`.

---

## Ticket Format

```
### CR2-NNN · P0–P3 · S/M/L · Session N · Status: Open
- **Where**: src/path/File.js:123
- **What**: One-sentence statement of the defect or debt.
- **Why it matters**: Plain-language impact on the game or player.
- **Suggested fix**: Concrete direction (not a full diff — those are written
  by the fix session against current code).
- **Related**: CR2-XXX, a round-1 ticket, roadmap §, or concept doc reference.
- **Confidence**: Only if suspected-but-unproven; say what would confirm it.
```

Statuses: `Open` → `Fixed (date, commit)` / `Won't fix (reason)` /
`Superseded by CR2-XXX`. Fix sessions update this line; never delete tickets.

Out-of-territory observations: file a stub ticket (Where + What only) tagged
with the session that owns that territory, so it's waiting for them.

**Owner-decision tickets:** if a finding needs the owner to choose, say so in
the ticket and present the options as labelled multiple choice with a
recommendation — don't leave it as an open question.

---

## System Map *(each session fills in its territory)*

Goal: a holistic picture of how systems connect, built up across sessions.
For each system note: **state it owns** (paths in GameState), **events
published**, **events subscribed**, **who calls it / what it calls**. Flag
contract mismatches (publisher payload ≠ subscriber expectation) as tickets.

Round 1 built a map of a codebase that no longer exists — start fresh.

### Session 1 — State core
*(pending)*

### Session 2 — Board engine
*(pending)*

### Session 3 — Combat, heroes, skills & promotion
*(pending)*

### Session 4 — Cards, economy, inventory, quests & progression
*(pending)*

### Session 5 — Content pipeline & CMS boundary
*(pending)*

### Session 6 — UI ↔ engine boundary
*(pending)*

### Session 7 — UI components
*(pending)*

---

## Findings

*(Tickets are appended below, grouped by session, as sessions run.)*
