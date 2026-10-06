# The Progression screen — plan v1

> **Status:** designed 2026-09-05 from an owner interview, not yet built.
> Every decision below is **locked** — it came from a direct answer, not an
> inference. Where the code and this document disagree, the code is right and
> this is stale; say so and fix it.

---

## 1. What it is, in one paragraph

A new top-level CMS tab, **Progression**, showing every Token and recipe that
has a work cycle in one dense list, grouped by skill and ordered by level. Its
job is bulk authoring of the three tags the simulator reads — **level**,
**Tempo** and **Purpose** — because the ladder is currently flat and changing it
one entity at a time is the slow path.

## 2. Why it is needed

The shipped corpus sits at **36 Tokens on level 1, one on 70, one on 90**, and
**37 producers carry no Tempo or Purpose at all**. Both of those are bulk
problems: the per-entity editors are the wrong shape for them, and the four
remaining red content tests all trace back to content that has never been
tagged.

## 3. Locked decisions

| # | Decision | Answer |
| :-- | :--- | :--- |
| P-1 | Where it lives | A **new top-level tab**, beside Editor / Recipes / Economy Audit |
| P-2 | Tab name | **Progression** |
| P-3 | Scope | **One combined list** — Tokens and recipes together, with a type column |
| P-4 | Which rows | **Only entries with a work config** — 39 Tokens + 6 recipes = 45 today |
| P-5 | Editable fields | **Level, Tempo, Purpose** |
| P-6 | Skill | **Read-only.** Shown and grouped by, but changed in the Token editor |
| P-7 | Default order | **Grouped by skill, then by level** within each group |
| P-8 | Extra columns | **Derived cycle time and XP**, read-only |
| P-9 | Save semantics | **Live**, like every other field in the CMS |
| P-10 | Bulk action | **Set a value on a ticked selection** (no shift-by-N) |
| P-11 | Staleness | **Per-row stale marking** plus a **Recalculate button on this screen** |
| P-12 | Filtering | **Name search + skill filter**, on top of the grouping |
| P-13 | Safety | **Undo the last bulk action**, one step |
| P-14 | Navigation | **The name links** to that entity's full editor |

## 4. The two field names

⚠️ The level is **not one field**. A Token states it as `config.skillRequired`;
a recipe states it as `levelRequirement` (finding B5, and `fieldAdapter` says
the two are not interchangeable). Tempo and Purpose are `sim.tempo` and
`sim.purpose` on both. The list adapts at the edge — one row shape, two writers
underneath — the same trick `fieldAdapter.js` already plays for the simulator.

Writes go through the store's existing actions: `updateToken(id, patch)` and
`updateRecipe(skillId, index, patch)`.

## 5. What the data says today

* **39 Tokens carry a work config**, of which 38 have real inputs or outputs.
  `token_ceramics_kiln` is the exception: a pooled station whose recipes come
  from the crafting pool, so it has a skill and a level but no I/O of its own.
  It is **included** — P-4 is "has a work config", not "has I/O".
* **16 of those 38 have no skill at all** — every berry bush and fruit tree,
  plus the wheat field and the grapevine. They group under **No skill** and,
  by P-6, can only be given one in the Token editor. ⚠️ That is 42% of the
  list stranded off every ladder, and it is the first thing this screen will
  make obvious.
* **All 6 recipes** carry a skill, so all six group cleanly.

## 6. Known risks

* **Live bulk edits on 45 rows move a lot at once.** P-13's single-step undo is
  the only net beyond Backups, and it covers the bulk action only — not
  individual cell edits, which are one keystroke to reverse anyway.
* **The derived columns are wrong the moment you type.** That is what P-11
  exists for; a stale number read as a current one is the failure mode.
* **Changing a level changes the Tempo band**, so a cycle time that was in band
  can fall out of it without the cycle time changing. Expected, not a bug —
  the bands widen with level by design.

## 7. Explicitly not in v1

* Shifting a selection by ±N (offered, declined — P-10).
* Editing Skill (P-6).
* A simulator status column. Offered alongside the derived numbers; the derived
  numbers were chosen instead (P-8). The Economy Audit tab still carries the
  verdicts.
* Rows for the 23 Tokens with no work config (P-4).
