# Fantasy Guild Idle — Code Review Master Plan

This is the authoritative brief for the full-codebase review. It was planned on
2026-07-16 with the project owner; the session structure, scoring scheme, and
ground rules below are **owner-approved decisions** — follow them rather than
re-proposing your own methodology.

**Companion file:** [`code_review_findings.md`](code_review_findings.md) — the
persistent findings tracker every session writes into. It holds the Session
Status table (check it first to see which session is next) and all findings.

---

## Prerequisites — do NOT start Session 1 until these are done

1. **Commit the in-flight drag-and-drop rework.** As of 2026-07-16 the working
   tree has ~20 uncommitted files (dnd-kit migration; only its Step 4 cleanup
   remains). The review needs a clean, committed baseline.
2. **Execute Phase 9 (Legacy Cleanup Sweep) of `playmat_rework_roadmap_v3.md`.**
   Owner decision (2026-07-16): Phase 9 runs *first*, as roadmap work, so the
   review audits the smaller post-cleanup codebase instead of wading through
   dead playmat-era code. Phase 9 is **not** a review session — it follows the
   roadmap's own process.
3. Confirm the test suite passes (`npm test`) and note the passing count as the
   review baseline.

---

## Context

Fantasy Guild Idle is a Vite + React idle card game (~350 source files, ~52k
lines). A major rework replaced the 2D spatial "Playmat" with a linear 12-area
Deck Loop system (Phases 0–8 complete and verified; see the Implementation
Status table in `playmat_rework_roadmap_v3.md`).

Intended architecture — the review verifies this is actually true:

- **UI layer** (`src/ui/`, React): subscribes to engine events via `EventBus`,
  reads state via `useGameState()`. Must be read-only — never mutates game
  state directly.
- **Engine layer** (`src/systems/`, vanilla JS): all game logic; React-agnostic;
  mutates the singleton `GameState`.
- **Data layer** (`src/config/`, `src/state/`, `data/cards/`): card JSON
  registries, formula curves (`FormulaRegistry.js`), schemas.

**End goal:** a production build wrapped in a Tauri desktop shell for Steam.

---

## Review Objectives (owner-approved)

1. **Legacy residue check** — Phase 9 will have done the purge; each session
   verifies its territory is actually clean (no orphaned flags, dead imports,
   unreachable components, obsolete schema fields).
2. **Strict separation of concerns** — no React in `src/systems/`; no state
   mutation from `src/ui/`; EventBus contracts are coherent (publisher and
   subscriber payloads agree).
3. **Performance: smooth 60 FPS + stable memory** *(owner decision — replaces
   the earlier 160+ FPS idea)*. Concretely:
   - Engine tick stays well inside its 5ms budget with all 12 areas running.
   - No high-frequency allocations, deep clones, or GC spikes on the tick path.
   - Hot-path visuals (progress bars, vitals) use direct-DOM updates, not React
     re-renders; events are coalesced so the UI can't render-storm.
   - Flat memory over multi-hour idle sessions — no leaked EventBus
     subscriptions, un-cleared timers, or detached DOM.
   - Assets preload with no visible pop-in (an `AssetPreloader` exists —
     verify it covers everything).
4. **Serialization integrity** — the flyweight save model in `GameState.js`
   saves only minimal mutable state and rehydrates correctly from static
   templates; a save/load roundtrip loses nothing.
5. **Maintainability, by judgment not quota** *(owner decision — the old
   "200-line max" rule is retired)*. Flag files that are large **and** mix
   unrelated responsibilities, with a per-file split proposal and reason.
   Never propose splitting cohesive code just to hit a number. Pure
   data/registry files are exempt regardless of size.

---

## Ground Rules (inherit the project's working practices)

- **Findings only — review sessions never edit game code** *(owner decision)*.
  Every issue becomes a ticket in `code_review_findings.md`. Fix sessions
  happen after the review, picking tickets by priority. The only files a
  review session may write are the findings tracker and this guide.
- **Ask, don't assume.** If you can't tell whether behavior is a bug or a
  design decision, ask the owner — don't guess. Check the roadmap's Appendix
  A-1 first; many "odd" choices are locked decisions.
- **The owner does not code.** Session reports must explain findings in plain
  language: what's wrong, why it matters to the game/player, roughly how big
  the fix is. Save the technical detail for the ticket body.
- **One session per sitting.** End by updating the Session Status table and
  committing the findings doc. Don't roll into the next session's territory.
- **Evidence over vibes.** Cite `file:line` for every finding. For performance
  claims, measure (profiler, memory snapshots) — Session 7 exists for this.
- **Holistic lens.** Each session fills in the "System Map" section of the
  findings doc for its territory: what it owns in state, which events it
  publishes/subscribes, which systems call into it. Cross-system findings
  (mismatched contracts, duplicated responsibilities) are the most valuable
  output of this review.

---

## Related Trackers & Documentation Health

Three **living trackers** predate this review and are still in use. Before
filing a ticket, check whether the issue is already tracked in one of them —
cross-reference instead of duplicating (a one-line ticket pointing at the
existing entry is fine if the review adds severity/effort context):

- `rework_cleanup_todo.md` — post-rework polish & fine-tuning tasks (grouped, ~12 open).
- `deck_loop_task_list.md` — the deck-loop backlog (IDs like `A3`; §J lists
  deliberately deferred systems — do **not** file tickets asking where those are).
- `ui_bugfix_tracker.md` — bug/UI-fidelity sweep log for the flag-on build.

**Stale documentation warning:** the `.agent/` directory (guides, personas,
workflows) and several root concept docs describe the **pre-rework** game —
playmat, tavern, food/drink slots, and other retired systems. Do not treat
them as truth, and do not file tickets because code disagrees with them.
Current truth, in order: `CLAUDE.md` → `playmat_rework_roadmap_v3.md`
(+ Appendix A-1) → `playmat_rework_concept_v1.md` → the newer concept docs it
references. Session 8 should include a ticket proposing which stale docs to
archive or delete.

---

## Scoring (owner-approved — replaces the old Impact−Risk formula)

Each finding gets a **severity** and an **effort**, kept separate:

| Severity | Meaning |
|---|---|
| **P0** | Broken or dangerous now: data corruption, save loss, crash, leak that degrades long sessions |
| **P1** | Real bug or performance problem a player could hit |
| **P2** | Architecture/maintainability debt: layer violations, dead code, contract drift, oversized mixed-responsibility files |
| **P3** | Polish: naming, style, minor cleanup |

**Effort:** S (< 1 hour), M (a session), L (multi-session project).
Add a confidence note when a finding is suspected but unproven.

Fix ordering after the review: P0 first, then P1, then highest-value
P2s — within a tier, S-effort items first ("quick wins").

---

## Session Plan

Eight sessions. Each is scoped to fit one context window: read the listed
territory in full, apply all five objectives to it, write tickets + system-map
notes. Territory lists are starting points — follow the dependencies you find,
and note anything out-of-territory as a stub ticket for the owning session.

| # | Session | Territory (primary) |
|---|---|---|
| 1 | **State core & serialization** | `src/state/` (GameState, StateSchema), `src/systems/core/` (EventBus, EngineBootstrap, TimeManager, TimeBankManager, SaveManager/persistence, NotificationSubscriptions), save/load + rehydration paths. Objective 4 lives here. |
| 2 | **Loop engine** | `src/systems/loop/` (LoopRunner, StationManager, StationSlotManager, DeckSlotManager, ModeManager), `src/systems/area/` (AreaStateManager, AreaModifiers, HeroAssignmentManager), `src/config/loopConstants.js`. Tick-path allocation audit (objective 3) starts here. |
| 3 | **Combat, heroes & status effects** | `src/systems/cards/logic/` (CombatProcessor, WorkProcessor), status-effects engine, `src/systems/hero/`, `src/config/FormulaRegistry.js`. Includes the known caveat: combat pacing under large time-scale deltas (see roadmap Phase 8 notes). |
| 4 | **Cards, collection, economy & quests** | `src/systems/cards/` (CardManager, DeckSystem, LibraryManager, crafting, RecruitSystem), `src/systems/progression/` (CollectionManager, QuestTracker), `src/systems/inventory/`, `src/config/registries/`. |
| 5 | **UI ↔ engine boundary** | `src/ui/hooks/` (useGameState and friends), every EventBus subscription in the UI (subscribe/unsubscribe pairing — the leak audit), mutation-from-UI sweep, direct-DOM hot paths (RefProgressBar pattern). Objectives 2 and 3's UI half. |
| 6 | **UI components** | `src/ui/components/` (banner/, drawer/, hud/, base/), `src/ui/modals/`, `src/ui/dnd/`. Render-storm risk, oversized mixed-responsibility files (AreaBannerRow.jsx at ~1,665 lines is a known candidate), dead components. |
| 7 | **Runtime verification (hands-on)** | Not a reading session: run the dev server. Profile the tick path with all areas active, take heap snapshots across a long idle to prove flat memory, count React renders during heavy play, verify asset preload coverage, exercise save/load roundtrips. Confirms or refutes the perf/leak tickets from Sessions 1–6. |
| 8 | **Build, Tauri readiness & synthesis** | `vite.config.js`, bundle size and asset pipeline audit, dependency audit (unused deps, dnd-kit vs nativeDrag duplication), persistence robustness for a desktop shell (localStorage limits, write-failure handling), `src/tests/` coverage gaps. Then consolidate all findings into the final prioritized action backlog for the owner. |

Sessions 1–6 can run in any order if needed, but the listed order builds the
system map bottom-up (state → engine → UI). Session 7 requires 1–6's tickets;
Session 8 goes last.

---

## Session Kickoff Prompt

The owner starts each review session with this (or a paraphrase). If something
like it brought you here, follow it as written:

> I'm continuing the full code review of this project.
>
> 1. Read `CLAUDE.md` at the repo root for project ground rules.
> 2. Read `code_review_guide.md` — the review's objectives, scoring, and
>    session plan. These are settled; don't re-propose methodology.
> 3. Open `code_review_findings.md`, check the Session Status table, and tell
>    me which session is next and what territory it covers. If any
>    Prerequisite row in that table isn't marked done, stop and tell me —
>    don't start Session 1 over an unfinished baseline.
> 4. Confirm the working tree is clean and note the current branch and commit.
> 5. Skim the findings and system-map notes from prior sessions so you have
>    the holistic picture before diving into your territory.
>
> Then **stop and confirm the session scope with me** before starting. I don't
> code, so report findings in plain language. Remember: this is a review
> session — file tickets, don't change game code. When the session's territory
> is covered, update the Session Status table, give me a plain-language
> summary of what you found, and commit the findings doc.
