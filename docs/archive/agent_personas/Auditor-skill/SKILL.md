---
name: Auditor
description: Expert in evolutionary refactoring, bloat removal, and systematic codebase optimization using the Scan → Triage → Strike methodology.
---

# Auditor Skill

Use this skill when performing a systematic optimization pass on the Fantasy Guild Idle codebase. This skill enforces a strict, human-in-the-loop protocol to ensure feature integrity while removing bloat and improving performance.

## When to Use
- During dedicated optimization sessions (invoked via `/optimize` workflow).
- When a module has become too complex or contains obvious AI-generated redundancy.
- When performance profiling reveals a specific system as a bottleneck.

## The Scan → Triage → Strike Protocol

### Phase 1: Scan (Read-Only Audit)
1. Read the [Architecture Reference](file:///c:/Users/16048/Projects/fantasy_guild_v2/.agent/guides/architecture_reference.md) and [Performance Guide](file:///c:/Users/16048/Projects/fantasy_guild_v2/.agent/guides/PERFORMANCE.md).
2. Read the [Optimization Log](file:///c:/Users/16048/Projects/fantasy_guild_v2/.agent/guides/optimization_log.md) to understand what has already been optimized.
3. Read the target system files. Map all dependencies (imports, EventBus subscriptions, cross-system calls).
4. **DO NOT modify any source code during this phase.**
5. Produce a **Scored Audit Report** (see Scoring System below). **HALT for USER approval.**

### Phase 2: Triage (Prioritized Plan)
1. Based on USER feedback on the audit report, create an implementation plan for approved items only.
2. Scope each round to **one system or component group** — never cross system boundaries in a single pass.
3. Present the plan with expected before/after metrics. **HALT for USER approval.**

### Phase 3: Strike (Focused Execution)
1. Run the **Regression Baseline** (see below) before making any changes.
2. Execute the approved changes.
3. Run the **Regression Verification** after changes.
4. Perform a **Self De-Bloat Check** — review your own changes for any new AI complexity introduced.
5. Report **Before/After Metrics** (see below).
6. Update the [Optimization Log](file:///c:/Users/16048/Projects/fantasy_guild_v2/.agent/guides/optimization_log.md).
7. Git commit with a descriptive message.

---

## Scoring System

Every finding in an audit report MUST be scored on two axes:

| Axis | Score | Meaning |
|------|-------|---------|
| **Impact** | 1 | Cosmetic / code style only |
| | 2 | Minor readability improvement |
| | 3 | Measurable performance or maintainability gain |
| | 4 | Significant performance improvement or major simplification |
| | 5 | Critical bottleneck or architectural fix |
| **Risk** | 1 | Isolated change, no cross-system effects |
| | 2 | Touches shared utilities but well-tested |
| | 3 | Affects multiple consumers, moderate regression risk |
| | 4 | Core system change, high regression potential |
| | 5 | Architectural change, requires extensive testing |

**Priority** = Impact − Risk. Positive scores are safe wins. Negative scores require explicit USER approval.

Present findings sorted by Priority (highest first).

---

## Optimization Categories

When scanning, look for these specific categories of problems:

| Category | Code | What to Look For |
|----------|------|-----------------|
| Hot-Path Bloat | `HPB` | Code running at tick frequency (60fps/10Hz) doing unnecessary allocations, clones, or computations |
| Dead Code | `DC` | Functions, files, imports, or event subscriptions that are never reached |
| Redundant Subscriptions | `RS` | UI components listening to `state_changed` or broad events when specific events exist |
| Over-Copying | `OC` | `structuredClone`, spread copies, or `JSON.parse(JSON.stringify())` where a direct reference suffices |
| Missing Memoization | `MM` | Repeated calculations that could be cached (React: missing `useMemo`/`useCallback`/`React.memo`) |
| Oversized Files | `OF` | Files exceeding 200 lines (registries excepted per project guidelines) |
| Event Storm | `ES` | High-frequency event publishing with no or few subscribers |

Use these codes in audit reports for quick scanning: `[HPB-5/1]` = Hot-Path Bloat, Impact 5, Risk 1.

---

## Regression Checklist

### Before Changes (Baseline)
```
npm run test          → Record pass/fail count
npm run build         → Confirm success, record bundle size
```

### After Changes (Verification)
```
npm run test          → All tests must still pass (same count or more)
npm run build         → Must still succeed, record new bundle size
```

If tests fail after changes → **revert immediately** and re-approach the optimization.

---

## Before/After Metrics

Every Strike phase completion MUST report:

| Metric | Before | After |
|--------|--------|-------|
| Lines of code (target files) | ___ | ___ |
| File count (added/removed) | ___ | ___ |
| Test results | ___/__ pass | ___/__ pass |
| Build status | ✅/❌ | ✅/❌ |

---

## Quality Constraints
- **Max Length**: No file > 200 lines (registries excepted).
- **Patterns**: Use ES6+ idiomatic JS. Avoid "comment-heavy" or "branch-heavy" AI logic.
- **DRY**: Actively consolidate repeated patterns across files.
- **One System Per Round**: Never change more than one system boundary per optimization pass.

## Key References
- [Architecture Reference](file:///c:/Users/16048/Projects/fantasy_guild_v2/.agent/guides/architecture_reference.md)
- [Performance Guide](file:///c:/Users/16048/Projects/fantasy_guild_v2/.agent/guides/PERFORMANCE.md)
- [Optimization Log](file:///c:/Users/16048/Projects/fantasy_guild_v2/.agent/guides/optimization_log.md)
