# Crunch Prep Plan

**Status:** 🟡 Active — written 2026-10-05
**Purpose:** Get the project ready for a focused "crunch month" of deep work
(UI rework → deep optimization) so that the extra Claude quota for that month
goes on real changes, not on re-reading stale docs and getting oriented.

This is the single "what's next" reference until the crunch month starts.

---

## 1. The big picture (agreed 2026-10-05)

Overall order of work for the project:

```
PREP (this doc — Pro plan + Gemini)
  1. Doc triage
  2. GDD rewrite
  3. Performance baseline + measurement tools
  4. Crunch backlog (ready-to-run session briefs)
  5. Go / no-go on the Max upgrade

CRUNCH MONTH (Claude, Max plan)
  6. UI rework         — "measure, don't fix": log the cost of every UI change;
                        fresh UI plans from the owner (old specs stay archived)
  6b. Skill & class rework v2 (24 skills, 4 basic + 8 master classes, 4 Academies)
  6c. Real offline progress (replaces the Time Bank)
  7. Deep optimization — root-cause hunt, working from the cost log
  8. Atlas             — separate screen; gets its own light optimization pass
                        (moved into the crunch, owner 2026-10-06)
  9. Terrain rework    — painted ground returns for Atlas Regions; a major
                        rework, only once the Atlas works (owner 2026-10-06)
 10. Performance Envelope — write the real limits down as design rules

AFTER (back on Pro)
 11. Content tiers     — Tier 1 complete, then Tier 2…; deep pass per milestone
```

### Why this order

- **UI before optimization.** Optimizing first and then reworking the UI means
  optimizing twice. Build the UI you want, then compromise from there.
- **Measurement before UI.** Measurement tools never go stale, and without a
  baseline you can't tell whether a UI change made things worse.
- **Performance before content.** The limits (how many Tokens, heroes, enemies
  can be on screen and stay smooth) shape how content is designed. They need
  to be known before bulk content is written.
- **Cleanup before the crunch.** Stale docs cost tokens every session and have
  misled planning sessions on this project several times. A clean doc set and
  a current GDD make every Claude session cheaper and safer.

### Optimization rhythm (for everything after prep)

- **Light pass** after every rework: check the new code's hot paths, remove
  leftovers, confirm the benchmarks didn't get slower.
- **Deep pass** only at milestones, when systems are stable *and* the game is
  under realistic load.

---

## 2. Who does what

| Gemini (cheaper, long context) | Claude (deep work) |
|---|---|
| Doc triage (sorting ~100 docs) | Performance root-cause hunt + deep optimization |
| Drafting the GDD | The UI rework |
| Drafting crunch session briefs | Atlas design and build |
| Expanding measurement tools (well-defined, mechanical) | Core architecture changes |
| | **Reviewing anything that becomes a source of truth** |

Two safeguards:
- **Triage:** Gemini *proposes*, the owner approves, Claude checks only the
  items Gemini marks as uncertain.
- **GDD:** one Claude review pass before it's marked authoritative, because
  every later session will trust it.

---

## 3. Implementation Status

| # | Step | Owner | Status |
|---|---|---|---|
| P1 | Doc triage | Gemini → owner approves | ✅ Done; finished by Claude 2026-10-06 (docs/active, docs/reference, one archive, TICKETS.md) |
| P2 | GDD rewrite | Gemini drafts → Claude reviews | 🟡 Drafted; Claude review 2026-10-06 |
| P3 | Performance baseline + tools | Claude (director) | ✅ Done 2026-10-07: tools merged, baseline in [PERFORMANCE.md](../reference/PERFORMANCE.md) |
| P4 | Crunch backlog | Claude (director) + owner interviews | ✅ Done 2026-10-07: [briefs/README.md](briefs/README.md) |
| P5 | Max go / no-go | Owner | ⬜ Not started |

Kickoff prompt for P1 + P2 (archived): `docs/archive/KICKOFF_doc_triage_gdd.md`

---

## 4. The steps

### P1 — Doc triage

**Goal:** Every doc in the repo is clearly current, reference, or history. A
fresh agent session can't be briefed off a dead design by accident.

Categories:
- **Current** — describes the game as it is, or an active plan. Stays in place.
- **Reference** — still accurate and useful, but not a plan (schemas, pipelines).
  Stays, possibly moved somewhere tidier.
- **Historical** — finished or superseded work. Moves to `archive/`.
- **Dead** — describes systems that no longer exist. Moves to `archive/`.
- **Uncertain** — Gemini can't tell. Flagged for owner / Claude.

Rules:
- **Propose first, move second.** Output is a triage report the owner approves
  before anything moves.
- **Never delete.** Archive only, and record each move in
  [`docs/archive/README.md`](docs/archive/README.md) (it already has this format).
- **No source code changes.**

Scope: the repo root `.md` files, `docs/`, `agent_briefs/`, and `.agent/`
(guides, workflows, skills).

Known suspects already spotted (verify, don't assume):
- [`.agent/workflows/optimize.md`](.agent/workflows/optimize.md) points to an
  Auditor skill and an `architecture_reference.md` that have both been retired.
- Several `.agent/guides/` files and `.agent/workflows/` (e.g. `add-card`,
  `add-quest`, `add-area`, food & drink, crafting cards) may describe card-era
  systems.
- [`CHANGELOG.md`](CHANGELOG.md) is ~347 KB. Don't archive it — but propose
  whether older released sections should be split into an archive file.

### P2 — GDD rewrite

**Goal:** One lean, current Game Design Document that every later session can
trust. There is **no current GDD** — the old one was archived 2026-08-26
because it described the retired card era.

Requirements:
- Written **from scratch**, describing the game **as it is built today**,
  checked against the code and the current concept/roadmap docs.
- Clearly separate **Built** from **Planned** (e.g. the Atlas).
- **Don't invent.** Where sources disagree or are unclear, list it as an open
  question for the owner rather than guessing.
- **Lean.** Summarize and link to the detailed docs instead of copying them.
  Aim for something an agent can read in one sitting (roughly under 40 KB).
- Include an empty **Performance Envelope** section — filled in during the
  crunch (step 8).
- Include a short **glossary** of current terms (the project has renamed
  things several times — e.g. "Token" has meant different things in
  different eras).

Atlas source: the Atlas spec currently lives outside the repo at
`C:\Users\16048\.gemini\antigravity-ide\brain\b6f8d4d8-8826-42e5-9759-22c42e559a95\atlas_system_specification.md`.
Copy it into the repo (e.g. `atlas_concept.md`) as part of this step.

### P3 — Performance baseline + measurement tools

**Goal:** Record how the game performs **today**, and fill the gaps in the
tooling, so the UI rework can be measured as it happens.

What exists:
- [`bench/`](bench/README.md) — headless engine benchmark (logic only, no drawing).
- The in-game **Perf HUD** (drawing / frame times).

What to add (scope to be confirmed):
- **Repeatable drawing benchmark** — a scripted in-browser scene, the
  drawing-side twin of `bench/`.
- **Debug on/off switches** — turn off one system at a time (notifications,
  loot sprites, tray, hero animations…) to measure what each one costs.
- **Standard test conditions:** production build **and** dev build, with
  Chrome DevTools CPU slowdown at **4×** to stand in for a slow laptop.
  Target: *production build, 4× slowdown, smooth.*

Then record the baseline numbers in a doc.

### P4 — Crunch backlog

**Goal:** A list of small, ready-to-run session briefs for the crunch month,
so each Claude session starts working immediately.

Each brief: what to do, which files/docs to read (and *only* those), what
"done" looks like, how to verify it. One coherent slice per session.

Two tracks:
- **UI rework** — from the owner's fresh UI plans (ruled 2026-10-06; the old
  `ui_overhaul_spec.md` / `ui_bugfix_tracker.md` stay archived).
- **Skill & class rework v2** and **real offline progress** — added as crunch
  tracks 2026-10-06.
- **Optimization targets** — from the P3 baseline. First suspect: the
  notifications column (see §5).

### P5 — Max go / no-go

Upgrade only when P1–P4 are done. Then one focused month working through the
backlog, and drop back to Pro afterwards (check plan terms first).

---

## 5. Open decisions (owner)

0. **Ruled 2026-10-06**: UI rework starts from fresh owner plans (the archived
   `ui_overhaul_spec.md` / `ui_bugfix_tracker.md` are not inputs); history
   comments get one dedicated slimming pass before the crunch
   ([brief](brief_comment_slimming.md)); skill & class rework v2 and real
   offline progress are crunch tracks.
1. **Toast leak (now ticket T-060) — fix now or in the crunch?** Dismissed notifications
   stay on the page invisibly (see
   [`ToastContainer.jsx`](src/ui/components/base/ToastContainer.jsx)), which
   likely makes lag build up over a session. It's a bug, not a design choice,
   so a small fix before the UI rework wouldn't be wasted. Other notification
   suspects (background blur on each toast, layout-measuring animations, the
   column sitting next to the playmat) belong in the UI rework / optimization.
2. **Slimming history comments in code.** Many source files carry long ticket
   and decision histories in comments, and every file read costs those tokens.
   Option: move the history to the changelog / decision logs and keep short
   "why" comments in code. This changes how the project records its history,
   so it needs an explicit decision.
3. **`notifications.position` setting** does nothing in column mode — remove
   or repurpose (already flagged in `ToastContainer.jsx`).

---

## 6. Ground rules during the crunch

- **Measure, don't fix** during the UI rework. Keep a running cost log; hand
  it to the optimization pass.
- **Avoid adding new expensive effects** to the playmat while the root-cause
  hunt is pending (background blur, layout-shifting animations, heavy
  transparency over animation) — or log their cost when you do.
- Usual project rules from [`CLAUDE.md`](CLAUDE.md): small slices, verify
  before calling it done, commit per slice.
