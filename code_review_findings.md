# Code Review — Findings Tracker

Persistent tracker for the full-codebase review. See
[`code_review_guide.md`](code_review_guide.md) for objectives, scoring, and
the session plan. **Every review session writes into this file**; fix sessions
later update ticket statuses here.

---

## Session Status *(update at the end of every session)*

| # | Session | Status | Notes |
|---|---|---|---|
| — | Prerequisite: commit in-flight DnD rework | ⬜ Not done | ~20 uncommitted files as of 2026-07-16 |
| — | Prerequisite: Phase 9 Legacy Cleanup (roadmap) | ⬜ Not done | Runs via the roadmap process, not as a review session |
| — | Prerequisite: baseline test run recorded | ⬜ Not done | Record passing count here |
| 1 | State core & serialization | ⬜ Not started | |
| 2 | Loop engine | ⬜ Not started | |
| 3 | Combat, heroes & status effects | ⬜ Not started | |
| 4 | Cards, collection, economy & quests | ⬜ Not started | |
| 5 | UI ↔ engine boundary | ⬜ Not started | |
| 6 | UI components | ⬜ Not started | |
| 7 | Runtime verification (hands-on) | ⬜ Not started | Requires 1–6 |
| 8 | Build, Tauri readiness & synthesis | ⬜ Not started | Goes last |

**Next ticket ID:** CR-004

---

## Ticket Format

```
### CR-NNN · P0–P3 · S/M/L · Session N · Status: Open
- **Where**: src/path/File.js:123
- **What**: One-sentence statement of the defect or debt.
- **Why it matters**: Plain-language impact on the game or player.
- **Suggested fix**: Concrete direction (not a full diff — those are written
  by the fix session against current code).
- **Related**: CR-XXX, roadmap §, or concept doc reference (if any).
- **Confidence**: Only if suspected-but-unproven; say what would confirm it.
```

Statuses: `Open` → `Fixed (date, commit)` / `Won't fix (reason)` /
`Superseded by CR-XXX`. Fix sessions update this line; never delete tickets.

Out-of-territory observations: file a stub ticket (Where + What only) tagged
with the session that owns that territory, so it's waiting for them.

---

## System Map *(each session fills in its territory)*

Goal: a holistic picture of how systems connect, built up across sessions.
For each system note: **state it owns** (paths in GameState), **events
published**, **events subscribed**, **who calls it / what it calls**. Flag
contract mismatches (publisher payload ≠ subscriber expectation) as tickets.

### Session 1 — State core
*(not yet reviewed)*

### Session 2 — Loop engine
*(not yet reviewed)*

### Session 3 — Combat, heroes & status effects
*(not yet reviewed)*

### Session 4 — Cards, collection, economy & quests
*(not yet reviewed)*

### Session 5 — UI ↔ engine boundary
*(not yet reviewed)*

### Session 6 — UI components
*(not yet reviewed)*

---

## Findings

### Pre-filed during planning (2026-07-16)

### CR-001 · P2 · L · Session 6 · Status: Open
- **Where**: src/ui/components/banner/AreaBannerRow.jsx (~1,665 lines)
- **What**: Largest file in the codebase; likely mixes several
  responsibilities (row layout, split-banner center, station controls, focus
  morphing).
- **Why it matters**: Hard to change safely; every banner feature touches it.
- **Suggested fix**: Session 6 assesses whether it splits along natural seams
  (per the judgment-based standard — split only if responsibilities are
  genuinely mixed).

### CR-002 · P1 · M · Session 3 · Status: Open
- **Where**: src/systems/cards/logic/CombatProcessor.js
- **What**: Combat's internal pacing may not scale correctly under large time
  deltas (Time Bank acceleration) — fights don't speed up proportionally.
- **Why it matters**: Spending banked time is less valuable while a hero is
  in combat; players would notice the discrepancy.
- **Related**: Roadmap Phase 8 notes (known caveat, flagged 2026-07-08).
- **Confidence**: Reported but not isolated — Session 3 should trace the
  pacing math; Session 7 can verify under a 10x scale.

### CR-003 · P2 · S · Session 8 · Status: Open
- **Where**: package.json (dnd-kit deps) vs src/ui/dnd/ + src/ui/components/drawer/
- **What**: Two drag systems coexisted during the DnD migration (dnd-kit and
  nativeDrag); once the migration's Step 4 cleanup lands, confirm the loser
  is fully removed from both code and dependencies.
- **Why it matters**: Dead dependencies bloat the bundle headed for Tauri.

### Session 1 findings
*(none yet)*

### Session 2 findings
*(none yet)*

### Session 3 findings
*(none yet)*

### Session 4 findings
*(none yet)*

### Session 5 findings
*(none yet)*

### Session 6 findings
*(none yet)*

### Session 7 findings
*(none yet)*

### Session 8 findings
*(none yet)*
