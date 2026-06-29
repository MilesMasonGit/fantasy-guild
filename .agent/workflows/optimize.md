---
description: How to perform an iterative optimization pass on the codebase using the Scan → Triage → Strike methodology
---

# Optimize Workflow

This workflow performs a single round of the **Scan → Triage → Strike** optimization loop. Run it multiple times to iteratively improve the codebase.

## Prerequisites

Before starting, read these files:
1. [Auditor SKILL.md](file:///c:/Users/16048/Projects/fantasy_guild_v2/.agent/skills/Auditor/SKILL.md) — Full protocol, scoring system, categories
2. [Optimization Log](file:///c:/Users/16048/Projects/fantasy_guild_v2/.agent/guides/optimization_log.md) — What's already been done and what's queued
3. [Architecture Reference](file:///c:/Users/16048/Projects/fantasy_guild_v2/.agent/guides/architecture_reference.md) — System layout and conventions
4. [Performance Guide](file:///c:/Users/16048/Projects/fantasy_guild_v2/.agent/guides/PERFORMANCE.md) — Established performance patterns

---

## Step 1: Choose a Target

Check the **"Identified But Not Yet Executed"** section of the Optimization Log. If the USER hasn't specified a target:
- Pick the item with the highest **Priority** score (Impact − Risk).
- Present it to the USER and ask for confirmation before proceeding.

If the Optimization Log backlog is empty, proceed to Step 2 to scan for new issues.

---

## Step 2: Scan (Read-Only Audit)

**DO NOT modify any source code in this step.**

1. Read all files in the target system directory.
2. Map dependencies: What imports this system? What does it import? What events does it publish/subscribe to?
3. For each finding, assign:
   - A **Category Code** (`HPB`, `DC`, `RS`, `OC`, `MM`, `OF`, `ES`)
   - An **Impact** score (1-5)
   - A **Risk** score (1-5)
   - A computed **Priority** (Impact − Risk)
4. Produce a **Scored Audit Report** as an artifact, sorted by Priority (highest first).

**HALT** — Present the report to the USER and wait for approval on which items to fix.

---

## Step 3: Triage (Implementation Plan)

1. Create an implementation plan covering only the USER-approved items.
2. Scope to **one system** — if approved items span multiple systems, split into separate rounds.
3. For each change, describe:
   - What the current code does (plain English)
   - What the new code will do
   - Expected lines-of-code change
4. Present as an `implementation_plan.md` artifact with `request_feedback = true`.

**HALT** — Wait for USER approval before making any changes.

---

## Step 4: Regression Baseline

Before touching any code, capture the baseline:

```
npm run test          → Record: ___/___ tests pass
npm run build         → Record: success/fail
```

If tests already fail, **STOP** and report this to the USER. Do not proceed with optimization on a broken baseline.

---

## Step 5: Strike (Execute Changes)

1. Make the approved changes, one file at a time.
2. After all changes are complete, perform a **Self De-Bloat Check**:
   - Did I introduce any new unnecessary complexity?
   - Did I add verbose comments that just restate the code?
   - Did I create any new allocations in hot paths?
3. If you introduced new bloat, fix it before proceeding.

---

## Step 6: Regression Verification

Run the same checks from Step 4:

```
npm run test          → Must match or exceed baseline pass count
npm run build         → Must still succeed
```

**If tests fail** → Revert changes and re-approach. Do NOT proceed with broken tests.

---

## Step 7: Report & Log

### Report Before/After Metrics

Present a summary table:

| Metric | Before | After |
|--------|--------|-------|
| Lines of code (target files) | ___ | ___ |
| Files added/removed | ___ | ___ |
| Test results | ___/___ pass | ___/___ pass |
| Build status | ✅/❌ | ✅/❌ |

### Update the Optimization Log

Add a new round entry to [optimization_log.md](file:///c:/Users/16048/Projects/fantasy_guild_v2/.agent/guides/optimization_log.md):

```markdown
## Round N — YYYY-MM-DD — [Description]
- **Session**: [Conversation ID or link]
- **Target**: [System/files changed]
- **Category**: [Category code(s)]
- **Changes**: [Bullet list of what was done]
- **Metrics**:
  - Lines: X → Y
  - Tests: N/N pass
  - Build: ✅
- **Commit**: [hash]
```

Remove any completed items from the "Identified But Not Yet Executed" backlog.

### Git Commit

Commit with a descriptive message following this pattern:
```
perf: [System] — [Brief description] (Optimization Round N)
```

---

## Step 8: Next Round Decision

Ask the USER:
- **Continue?** → Loop back to Step 1 with the next priority item.
- **Stop?** → End the session. The backlog in the Optimization Log preserves context for future sessions.

---

## Common AI Mistakes to Avoid

| Mistake | Why It's Bad | Rule |
|---------|-------------|------|
| Changing multiple systems at once | Impossible to isolate regressions | One system per round |
| Skipping the baseline test run | Can't tell if YOU broke something or it was already broken | Always baseline first |
| Making code changes during the scan phase | Leads to unplanned, unscoped refactors | Read-only until plan is approved |
| Reporting "it's cleaner" without numbers | Not actionable, not verifiable | Always report before/after metrics |
| Replacing code with something equally complex | Violates "evolution over compression" | Self de-bloat check is mandatory |
| Forgetting to update the optimization log | Next session loses all context | Log update is part of completion |
