# Z — Synthesis and fix-wave plan (round 3)

*Session Z, 2026-09-29. Tree: branch `tool/bench-gate` at `2e2b572` (= `main` `21119e5` plus the
bench gate commit). Reading only: this file is the only thing written. No game code, test,
bench or git state changed. Inputs: `code_review_v3_master_plan.md` (§6, §7, §10),
`code_review_v3_findings.md`, `docs/REVIEW_V3_RUN_LOG.md`, and every session file in
`docs/review_v3/` (P2, P3, R1–R10).*

> ⚠ **How far to trust the numbers.** Every engine number is from `npm run bench` on the
> i7-8700 (Node 24.11), usually **while other reviewers were using the CPU**. Only
> back-to-back pairs inside one session are comparable, and each wave below quotes pairs,
> not absolute values. Every drawing number is from a **dev build** (React development
> mode) in headless Chrome or the preview pane (R5, R6). Nothing here has been measured on
> a real focused window or a production build. **Session C has not been run.** Where a
> wave's effect is projected from several separate spikes, it says "projected".

---

## 1. For the owner, in plain language

**What the review found.** Ten review sessions and two tool-building sessions filed
**179 tickets**. After merging duplicates and closing what the numbers disproved, **155
are live**: **18 P1, 65 P2, 72 P3, and no P0**. Ten of the live ones are **latent**: the
code is wrong, but no content you ship today can trigger it (no shipped whole-mat aura,
status, timed effect or item rule yet).

**The verdict: the codebase is healthy. It is slow in a few specific, fixable places.**
- The layers are clean. No engine file touches React. No screen decides whether a move is
  legal: every drop, buy and equip is checked by the engine. All 44 UI subscriptions are
  released. Memory stayed flat over 8 game-hours. Nothing needs a rewrite.
- The problems are **habits that were cheap on the 7×7 grid and expensive on a mat of
  100–300 Tokens**, plus **one drawing cost** that nobody expected. Every big one has a fix
  that has already been tried in a throwaway copy, and **the game did exactly the same
  things afterwards**.

**What stops 165 FPS today, in order of size:**
1. **The shadows under every sprite** (CR3-350). They are CSS filters, and the graphics
   card spends most of its time on them. The realistic board draws ~100–125 frames a
   second with them and 164 without. This is a look decision, so it is yours (Q5).
2. **Four drawing habits that do not change the look**: an always-running particle
   canvas, walkers moved by `left`/`top`, progress rings redrawn every frame, and hero
   animation frames drawn through React. Together (tried): **~99 → ~151 frames a second;
   frames that fit the 6 ms budget 38 % → 73 %** (dev build).
3. **The engine tick** on busy boards. The realistic board's slow tick is 3.2 ms against a
   1.5 ms target, and the 300-Token board has a cliff (68 ms slow ticks, 244 ms worst).
   The causes are known: the Token list rebuilt 47 times a tick, full spawners retrying
   every tick, buff bookkeeping that walks the whole mat for every Token, and a
   "who is near whom" memory that walking goblins wipe every step. The tried fixes bring
   the realistic board to about the target (~1.3–1.5 ms, projected) and the torture board
   from 68–87 ms to ~12 ms.
4. **The whole mat re-renders ~9 times a second** because goblins walk (CR3-008).

**Real bugs a player can hit** (small fixes, all with a test designed):
a brand-new game is not truly saved for 10 minutes (CR3-100); changing the PC clock
replays "cycle start" rules (CR3-101); the dock's HP bars go stale (CR3-300); the hero
sheet beside the Bank closes on the first click (CR3-450); a Token dropped over an open
drawer lands hidden under it (CR3-402); 13 Settings controls do nothing (CR3-033).

**The plan, in 11 bullets:**
- **Wave 0 (starts now, no questions needed):** merge the benchmark's new "the game must do
  exactly the same thing" gate; fix the tools; write the tests later waves stand on; and
  ship the invisible easy wins: the particle canvas sleeps when empty, a new game is saved
  once its table exists, the XP lookup uses its table, and five other small invisible
  fixes.
- **Wave 1 (autonomous, after Wave 0):** the engine speed fixes that are exact and proven
  identical: the cached Token list, the spawner census and the faster push/nudge search.
  Expected: realistic board slow tick ~3.2 → ~1.5 ms; push storm worst 56 → 13 ms.
- **Wave 2 (needs your OK):** the visible bug fixes above that involve no design choice.
- **Wave 3 (needs your OK):** the buff-rebuild and neighbour-memory fixes. They are also
  exact, but they are rated medium risk, which your easy-win rule excludes (Q1).
- **Waves 4–5 (need your eyes):** the look-preserving drawing set, then your shadow choice.
- **Wave 6:** re-render cascades and a declared list of engine events.
- **Wave 7:** drag and drop (the cheap parts can go early).
- **Wave 8:** the import cycles and "the engine starts only when React says so".
- **Wave 9:** dead code, old Tray/tile/card words, lint and the agent docs.
- **Wave 10:** UI consistency, per your rulings. **Wave 11:** the latent rule wiring,
  when content needs it.
- **Not now:** a canvas mat (decide after Session C measures a production build), the
  spatial index for pushes (not needed below ~250 Tokens), and type-checking (one trial
  sitting after the waves).

**The three answers that unblock the most** (full list in §8): Q1, may the autonomous run
take *exact, gated* engine fixes rated medium risk; Q2, may known test failures be marked
"expected"; and Q3, may bug fixes that only make the screen show what it was always meant
to show go ahead without a look.

---

## 2. Conventions used in this file

- **Severity** is the final one, after every session's verdict. **P1** means a measured
  miss of a §4.4 target or a bug a player can hit (plan §6.1).
- **Score** = Impact × Confidence ÷ Effort (S = 1, M = 2, L = 4). It is used only to order
  tickets inside a tier. `~` means Z estimated a missing impact or confidence.
- **R10** is the coverage label from `R10.md` §2:
  - **SAFE**: safe to fix now;
  - **TEST**: write the named test first; *red* means the test fails today and passes
    after the fix;
  - **EYES**: needs the owner's eyes;
  - **+Q**: an owner ruling is pending.
  A label marked `*` was not in R10's tables; Z assigned it.
- **Status**:
  - **open**;
  - **latent**: the code is wrong, but no shipped content triggers it (R10 §4.1 census);
  - **closed**, with the reason;
  - **merged → X**;
  - **in progress**;
  - **deferred**.
- **Merging rule.**
  - A true duplicate keeps the **lowest** number.
  - Where a pre-filed ticket was re-scoped into a broader, later ticket by the owning
    session, the broader ticket keeps its number (for example CR3-013 → CR3-306).
  - The one exception the director already recorded: CR3-012 → **CR3-350**.

---

## 3. Master ticket table

**Totals** (179 tickets):

| | P0 | P1 | P2 | P3 | Total |
|---|---|---|---|---|---|
| Live (open, latent, in progress, deferred) | 0 | **18** | **65** | **72** | **155** |
| Closed | 0 | 1 | 5 | 4 | **10** |
| Merged into another ticket | 0 | 1 | 4 | 9 | **14** |
| **All, by final severity** | 0 | 20 | 74 | 85 | **179** |

Of the 155 live: **10 latent** (028, 104, 108, 202, 204, 206, 251, 252, 253, 257), **2 in progress**
(156, 550), **3 deferred** (046, 152, 035). The aura halves of 004, 102 and 250 are also latent; their S2
halves are real.

### 3.1 Pre-filed and P1 (CR3-001…047)

| ID | Title | Sev | Cat | Eff | Risk | Status | R10 | Score | Wave |
|---|---|---|---|---|---|---|---|---|---|
| 001 | Token list copied, filtered and sorted every call (47×/tick at S2) | **P1** | HPB+GC | S | low–med → low once guard test lands | open | TEST | 5.0 | 1a |
| 002 | Free flags re-search on every Bank change | P2 | HPB | M | — | closed: not supported (0.01 ms/tick, P2; R3 agrees) | — | — | — |
| 003 | No spatial index; push solver all-pairs × passes | **P1** | HPB | S (exact part) | high → gated by position hashes | open (broad-phase → 152, deferred) | TEST | 5.0 | 1b |
| 004 | Buff rebuild quadratic (even without an aura) | **P1** | HPB | S–M | medium | open (aura half latent) | TEST | 3.3 | 3 |
| 005 | Stalled Tokens re-publish their alert every tick | P2 | GC | S | low | open | TEST +Q (R1-Q2) | 3.0 | 6 |
| 006 | Engine tick on `setInterval` | P3 | HPB | M | high | closed: owner ruling Q1 (A), no loop change; in-system splitting lives in 102 | — | — | — |
| 007 | Walkers animated by `left`/`top` | **P1** | PNT | S–M | medium | open (walkers only, R6) | TEST+EYES | 3.3 | 4 |
| 008 | Whole mat re-renders while anything walks | **P1** | RC | M | medium | open | EYES | 2.0 | 4 / 6 |
| 009 | `state_changed` runs a selector per Token (quadratic) | P2 | RC | M | — | merged → 304 (quadratic part not supported, R5) | — | — | — |
| 010 | Particle canvas redraws every frame when empty | **P1** | PNT | S | low | open | SAFE | 4.0 | **0** |
| 011 | Many per-component timers (re-scoped: one shared ring clock) | P2 | PNT | S | low | open | EYES | 3.0 | 4 |
| 012 | Drop-shadow filters on every sprite | P1 | PNT | — | — | merged → 350 | — | — | — |
| 013 | UI publishes an engine board event | P3 | LAY | S | — | merged → 306 | — | — | — |
| 014 | Loot timing uses the wall clock | P3 | CON | S | low | open (contract note; Time Bank out of scope; rule half → 252) | — | 0.6 | none |
| 015 | "Tray" in 20 (really 34) files | P3 | VES | M | — | merged → 502 / 503 | — | — | — |
| 016 | Tile-named engine API | P3 | VES | M | — | merged → 501 | — | — | — |
| 017 | `Placement.js` vs `MatPlacement.js` | P3 | DC? | S | — | closed: clean rules/geometry split (R2); helpers → 155 | — | — | — |
| 018 | Stale agent guides and workflows | P2 | DOC | M | — | merged → 513 / 514 | — | — | — |
| 019 | Round 2's open tickets never re-checked | P2 | DOC | M | — | closed: fixed (P1) | — | — | — |
| 020 | No performance tooling | P1 | TST | L | — | closed: fixed (Tier A `42181be`, Tier B `f9af6ba`); follow-ups 550, 311 | — | — | — |
| 021 | `PERFORMANCE.md` is card-era (absorbs 406's doc half) | P2 | DOC | S | low | open (draft: R6 §8 + R7 §4) | SAFE | ~3.0 | 9a |
| 022 | Every hero listens to every attack | P3 | RC | S | — | closed: not supported (listens only while fighting, R4) | — | — | — |
| 023 | Dangerous import cycles (groups 2 and 3 here; group 1 → 157) | P2 | LAY | S | low | open | SAFE | 3.0 | **0** |
| 024 | Two dead dock components | P3 | DC | S | low | open | SAFE* | ~2.0 | 9a |
| 025 | Lint residue + test-globals config gap | P3 | DC+WIRE | M | low | open: config half → W0; residue split into 110/265/312/359/407/467 + R9's own | SAFE* | ~1.0 | 0 (config) / 9a |
| 026 | Bundle grew a third, one chunk | P3 | PNT | M | — | closed: don't split (R9 §6); actions in 507/508/509 | — | — | — |
| 027 | Art not in version control | P2 | DOC | S | — | closed: fixed (`e928368`) | — | — | — |
| 028 | Input-cost discount applied when paying, not when checking | P2 | WIRE | S | medium | **latent** (0 shipped `INPUT_COST`) | TEST | 1.8 | 11 |
| 029 | Item-threshold triggers on every Bank change | P2 | HPB | S | — | closed: not supported (0.002 ms/tick) | — | — | — |
| 030 | Logger always at debug level | P2 | HPB | S | — | closed: not a hot path; prod prints nothing (R1) | — | — | — |
| 031 | Tick handlers all at default priority | P3 | CON | S | low | open (only `quest_manager` before `board_runner` changes results, R1) | TEST* | 2.0 | 1a |
| 032 | Small per-tick allocations in combat/statuses (absorbs 259) | P3 | GC | S | low | open (upkeep part closed by R3) | SAFE* | 1.0 | ride-along |
| 033 | 13 Settings controls change nothing | **P1** | UX | M | low | open | EYES +Q (R8-Q1) | 2.0 | 10 |
| 034 | Tutorial steps advance because React publishes | P3 | LAY | S | — | merged → 306 (a declared UI→engine notice) | — | — | — |
| 035 | Enemy kill counts never recorded | P3 | WIRE | S | low | deferred until a Codex screen is planned | — | 1.0 | none |
| 036 | Dead combat and loot code (absorbs 260) | P3 | DC | S | low | open | SAFE* | 2.0 | 9a |
| 037 | Second hero-creation route | P3 | CON | S | low | open | TEST* | ~2.0 | 9a |
| 038 | Retired fields in the schema (clock/boot part → 105) | P3 | VES | S | low | open (8 `collection` fields; keep `TOKEN_TYPES`) | TEST* | ~2.0 | 9a |
| 039 | Toasts may leave page elements behind | P3 | ML | S | low | open: awaiting the Session C soak | — | 0.6 | C |
| 040 | Engine object mostly unread, but agents rely on it | P3 | DC | S | low | open: resolve as documentation (30 entries) | SAFE* | ~1.0 | 9a |
| 041 | Harness proves some features only with fixtures | P2 | TST | M | — | merged → 551 | — | — | — |
| 042 | CMS imports game source across the boundary | P2 | LAY | M | — | merged → 510 / 511 | — | — | — |
| 043 | Small UI leftovers (absorbs 461's `ui:open_drawer` chain) | P3 | UX/DC | S | low | open | SAFE* | ~2.0 | 9a |
| 044 | Randomness unseeded (absorbs 563) | P3 | TST+EXT | M | medium | open: a Stage-2 prerequisite, not a fix-wave item | — | 1.0 | Stage 2 |
| 045 | A crafted Token can arrive with unlimited charges | P2 | CON | M | low | open, **reachable** (Copper Woodaxe) | +Q (R3-Q1) | 1.5 | 11 |
| 046 | Desktop-shell group (save export, `src-tauri`) | P2 | CON | M | — | deferred by owner decision 25 | — | — | none |
| 047 | Capped spawners retry every tick; `syncAlerts` rescans | **P1** | HPB | S | low | open | TEST (SAFE after gate) | 5.0 | 1a |

### 3.2 R1 — engine loop, clock, event bus (CR3-100…110)

| ID | Title | Sev | Cat | Eff | Risk | Status | R10 | Score | Wave |
|---|---|---|---|---|---|---|---|---|---|
| 100 | New game's first save has no Guild Hall for up to 10 min | **P1** | CON+WIRE | S | low | open | TEST (red) | 5.0 | **0** |
| 101 | Tick trusts the wall clock (backward step replays cycle starts) | **P1** | CON | S–M | medium | open | TEST +Q (R1-Q1) | 2.7 | 2 |
| 102 | Synchronous subscribers; several whole-mat rebuilds per tick | P2 | HPB | M | medium | open (aura half latent) | TEST +Q (R1-Q3) | 2.0 | 3 (conditional) |
| 103 | Every staffed Token re-plans charges every tick | P2 | HPB | M | medium | open; likely closes after 200 (§5 C-6) | TEST | 1.5 | 3 (re-measure) |
| 104 | Time Bank fast-forward doubles tick cost | P3 | HPB+CON | S | low | **latent** (spend UI off) | — | 2.0 | none |
| 105 | Dead clock surfaces and write-only fields | P3 | DC+VES | S | low | open | +Q (R1-Q4) | 1.2 | 9b |
| 106 | `boardEvents.js` incomplete; raw-string subscriptions | P3 | DOC+CON | S | low | open | SAFE* | 2.0 | **0** |
| 107 | Engine events sent to nobody (absorbs 262) | P3 | WIRE+DC | S | low | open | SAFE* | 0.6 | 9a (after 559) |
| 108 | Engine init not safe to run twice | P3 | ML+TST | S | low | **latent** (not reachable today) | — | 1.2 | 8 |
| 109 | Autosave deep-copies the whole state | P3 | HPB | S | low | open | TEST* (byte-identical) | 1.0 | **0** |
| 110 | Lint residue, R1 | P3 | DC | S | low | open (keep the side-effect import at `EngineBootstrap.js:10`) | SAFE* | 1.0 | 9a |

### 3.3 R2 — board state and spatial physics (CR3-150…158)

| ID | Title | Sev | Cat | Eff | Risk | Status | R10 | Score | Wave |
|---|---|---|---|---|---|---|---|---|---|
| 150 | Nudge search re-reads bounds and trig per candidate; shrink 333 ms | **P1** (P2 if R2-Q1 = A) | HPB | S | low | open | TEST (golden) | 4.0 | 1b |
| 151 | A push shoves overlapping Tokens anywhere on the mat | P2 | UX+CON | S | medium | open | +Q (R2-Q2) | 0.9 | 10 |
| 152 | Push solver still all-pairs; crosses 8 ms at ~300 Tokens | P2 | HPB | M | high/medium | deferred (don't build below ~250 Tokens) | — | 1.0 | none |
| 153 | Motion ticks allocate small objects per walker | P3 | GC | S | low | open (batch with any motion change) | SAFE* | 0.6 | ride-along |
| 154 | Stale comments in board-state files | P3 | DOC | S | low | open | SAFE* | ~1.0 | 9a |
| 155 | Four copies of "is this the Guild Hall?"; second `clampToMat` | P3 | DC | S | low | open | SAFE* | ~2.0 | 9a |
| 156 | S4 player drops can only be refused | P2 | TST | S | low | **in progress** (`tool/bench-gate` `2e2b572`) | SAFE | 3.0 | **0** |
| 157 | Cut cycle group 1 (`BoardCombat ↔ Flags`; two loops) | P2 | LAY | S | low–med | open (needs 557 first) | TEST | 3.0 | 8 |
| 158 | `workTokenOf` writes while it reads | P3 | CON | S | low | open | SAFE* | ~1.0 | 1a |

### 3.4 R3 — work, flags, rule evaluation (CR3-200…206)

| ID | Title | Sev | Cat | Eff | Risk | Status | R10 | Score | Wave |
|---|---|---|---|---|---|---|---|---|---|
| 200 | Every enemy step wipes the neighbour cache | **P1** | HPB | M | medium | open | TEST | 2.5 | 3 |
| 201 | Anything waiting for room re-runs the placement search every tick | P2 | HPB | M | medium | open (reasoned; no bench board exercises it) | TEST | 1.2 | 3 (after 200) |
| 202 | Item rules can be given moments that never fire | P2 | WIRE+UX | S | low | **latent** (0 items carry rules) | +Q (R3-Q3) | 1.8 | 11 |
| 203 | No error boundary: one render error blanks the game | P2 | UX | S | low | open | SAFE + EYES | 2.4 | 2 |
| 204 | Rule upkeep pays from the Bank only; reads disagree | P3 | WIRE | S | low | **latent** (0 paid statement upkeep) | +Q (R3-Q2) | 1.2 | 11 |
| 205 | Computed and never read; reset functions unused | P3 | DC+WIRE | S | low | open | SAFE* | 0.6 | 9a |
| 206 | Shop's unreachable refund path skips mat events | P3 | WIRE | S | low | **latent** (unreachable) | — | 0.3 | none |

### 3.5 R4 — combat, heroes, effects, loot (CR3-250…266)

| ID | Title | Sev | Cat | Eff | Risk | Status | R10 | Score | Wave |
|---|---|---|---|---|---|---|---|---|---|
| 250 | A kill rebuilds two neighbourhoods (one for a hero who didn't move) | **P1** | HPB | S | medium | open (S2 half real; S3+aura half latent) | TEST | 5.0 | 3 |
| 251 | Each cure reaches only one of the two effect systems | P2 | WIRE | S | low | **latent** | TEST +Q (R4-Q3) | 1.8 | 11 |
| 252 | Timed effects lose combat numbers on reload; wall clock | P2 | CON | S | low | **latent** | TEST (+Q R4-Q2 for the clock half) | 1.8 | 11 |
| 253 | Loadout re-expanded per axis read | P2 | GC | M | medium | **latent** (0 items carry effects) | TEST | 1.2 | 11 |
| 254 | Loot floor tidy-up quadratic when the Bank refuses | P2 | HPB | S | low | open (reachable with a full Bank) | TEST | 3.0 | 3 |
| 255 | A loot sweep publishes per sprite | P2 | RC | S | medium | open | TEST | 1.8 | 6 |
| 256 | Kill loot ignores yield/double-loot/bonus rules | P2 | WIRE | S | medium | open, reachable (BONUS_DROP/LOOT_MULT ship) | +Q (R4-Q1) | 3.0 | 11 |
| 257 | Loading rewrites the Guild Hall's definition | P2 | WIRE | S | medium | **latent** (no Hall rules authored) | +Q (R4-Q4) | 3.0 | 11 |
| 258 | Level-from-XP ignores its lookup table (CR2-082 closed wrongly) | P2 | HPB | S | low | open | TEST (golden) | 2.0 | **0** |
| 259 | Combat allocates ~2 KB per fight per tick | P3 | GC | S | — | merged → 032 | — | — | — |
| 260 | Dead combat, wound and loot code | P3 | DC | S | — | merged → 036 | — | — | — |
| 261 | `GLOBAL_COMBAT_XP_MULTIPLIER` wired to nothing | P3 | WIRE | S | low | open (value is 1.0, `FormulaRegistry.js:246`, so wiring is invisible) | SAFE* | 2.0 | 9a |
| 262 | Ten engine events published with no listener | P3 | WIRE | S | — | merged → 107 | — | — | — |
| 263 | Rate trackers never cleared on load | P3 | WIRE | S | low | open (the clear is eligible; "count at drop time" is a design call) | SAFE* | 1.0 | 9a |
| 264 | Quest ticking copies and sorts the whole mat | P3 | HPB | S | low | open (closes with 001) | SAFE* | 2.0 | 1a |
| 265 | Lint residue, R4 (incl. the `MERGE_GRACE_MS` half-wire) | P3 | DC | S | low | open (keep today's 1100 ms) | SAFE* | ~1.0 | 9a |
| 266 | Hero save/load coverage is thin | P2 | TST | S | low | open | (is the test) | 3.0 | **0** (passing parts) |

### 3.6 R5 — UI ↔ engine boundary (CR3-300…312)

| ID | Title | Sev | Cat | Eff | Risk | Status | R10 | Score | Wave |
|---|---|---|---|---|---|---|---|---|---|
| 300 | Dock HP bars (and the Bank hero panel) show stale data | **P1** | RC+UX | S | low | open (reproduced in game) | TEST (red) | 4.0 | 2 |
| 301 | Hero sprites animate through React (~42 + 43 commits/s) | **P1** (P2 if R5-Q1 = A) | RC+PNT | M | medium | open | EYES +Q (R5-Q1) | 2.5 | 4 |
| 302 | One click redraws every Token (34 ms) | P2 | RC | S | low | open | SAFE | 4.0 | **0** (callbacks) / 6 (`useUIModals` memo) |
| 303 | Every MatBoard render redraws heroes, flags, layers | P2 | RC | S | low | open | SAFE | 3.0 | 4 |
| 304 | Six events broadcast to every Token (absorbs 009) | P2 | RC+HPB | M | medium | open | TEST (M) | 1.5 | 6 |
| 305 | Retire `state_changed` in stages | P2 | CON+RC | M | medium | open | TEST | 0.9 | 6 |
| 306 | UI publishes engine events (absorbs 013, 034) | P2 | LAY+WIRE | S | low | open | TEST (+Q R5-Q2 for the rule) | 2.0 | 6 |
| 307 | Engine starts a game only when React says so | P2 | LAY+EXT | M | medium | open | TEST | 1.5 | 8 |
| 308 | Three small rules copied into components | P3 | LAY | S | low | open | SAFE* | 2.0 | 8 |
| 309 | "Bump" subscribers re-render on every event | P3 | RC | S | low | open | SAFE* | 1.0 | 6 |
| 310 | `useGameState` contract gaps | P3 | DOC+CON | S | low | open | SAFE* | 1.2 | 6 |
| 311 | Perf HUD "MatBoard" counts the whole subtree (absorbs 356) | P2 | TST | S | low | open | SAFE | 4.0 | **0** |
| 312 | Lint residue, R5 (don't add hook deps blindly) | P3 | DC | S | low/med | open | SAFE* | 1.0 | 9a |

### 3.7 R6 — the mat renderer (CR3-350…359)

| ID | Title | Sev | Cat | Eff | Risk | Status | R10 | Score | Wave |
|---|---|---|---|---|---|---|---|---|---|
| 350 | Drop-shadow filters cap the frame rate (absorbs 012) | **P1** | PNT | M | medium | open | EYES +Q (R6-Q1) | 2.5 | 5 |
| 351 | Cycle ring rewrites its SVG every frame | P2 | PNT | S | low | open | EYES* (ring smoothness) | 3.0 | 4 |
| 352 | Particle burst cap is dead (dropped in `f8dcae0`) | P2 | WIRE+PNT | S | low | open | +Q (R6-Q4) | 1.8 | 4 |
| 353 | Speech-bubble layer measures every bubble after every render | P2 | PNT | S | low | open | EYES* | 1.2 | 4 |
| 354 | Past ~225 Tokens the mat runs out of layers | P2 | UX | S | low | open (S3-size boards only) | TEST+EYES* | 4.0 | 4 |
| 355 | Element-based mat tops out ~200 Tokens; canvas question | P2 | PNT+EXT | L | high | open: decision deferred until Session C | +Q (R6-Q3) | 0.6 | after C |
| 356 | HUD "MatBoard" counts every commit | P3 | TST | S | — | merged → 311 | — | — | — |
| 357 | Charge floaters on framer-motion's JS loop | P3 | PNT | S | low | open | EYES* | 1.2 | 4 |
| 358 | Dev-only frame loops run in every dev measurement | P3 | TST | S | low | open | SAFE* | 1.0 | **0** |
| 359 | Lint residue, R6 | P3 | DC | S | low | open | SAFE* | ~1.0 | 9a |

### 3.8 R7 — drag and drop, input (CR3-400…413)

| ID | Title | Sev | Cat | Eff | Risk | Status | R10 | Score | Wave |
|---|---|---|---|---|---|---|---|---|---|
| 400 | Pickup/drop/target change re-renders every draggable | P2 | RC | M | medium | open (reasoned; Session C items 1–2) | EYES (measure) | 1.2 | 7b |
| 401 | Landing spot worked out twice a frame (slow near `Cannot`) | P2 | HPB | S | low | open | TEST (S) | 2.4 | 7a |
| 402 | Token/flag dropped over a drawer lands hidden under it | **P1** | WIRE | S | low | open (confirm in C) | TEST (red) +Q (R7-Q1) | 2.4 | 2 |
| 403 | Drag reads page layout on every pointer move | P2 | PNT | S | low | open | EYES (measure)* | 1.2 | 7a |
| 404 | Drag provider renders dnd-kit twice a frame | P3 | RC | S | low | open | SAFE* | 0.6 | 7a |
| 405 | Refused equip plays the "equipped" sound | P2 | WIRE | S | low | open | TEST (S) | 1.8 | 2 |
| 406 | `PERFORMANCE.md` drag section gone; dead CSS (doc half → 021) | P2 | DOC+DC | S | low | open (CSS half) | SAFE | 3.0 | 9a |
| 407 | Dead drag code (absorbs 502's DnD part, 504's ghost, 463's `areaId` branch) | P3 | DC+VES | S | low | open | SAFE* | 2.0 | 7a / 9a |
| 408 | Retired vocabulary in drag code (absorbs 504's `DeckDnd*`) | P3 | VES+DOC | S | low | open | SAFE* | 1.0 | 9a |
| 409 | Escape during a drag also closes the sheet/disallow mode | P3 | UX | S | low | open | +Q (R7-Q4 = R8-Q2) | 1.2 | 10 |
| 410 | Hover live under the ghost | P3 | UX+RC | S | low | open | +Q (R7-Q3) | 1.2 | 10 |
| 411 | Mat Tokens are keyboard stops announcing a drag that doesn't exist | P3 | UX | S | low | open | +Q (R7-Q2) | 1.0 | 10 |
| 412 | Drop point from a second cursor tracker; a flick lands short | P3 | CON | S | low | open (suspected; C item 13 first) | — | 0.6 | 7b |
| 413 | No test covers the drag chain | P2 | TST | S | low | open | (is the test) | 3.0 | **0** (passing parts) |

### 3.9 R8 — UI/UX consistency (CR3-450…467)

| ID | Title | Sev | Cat | Eff | Risk | Status | R10 | Score | Wave |
|---|---|---|---|---|---|---|---|---|---|
| 450 | Hero sheet beside the Bank closes on the first click | **P1** | UX+WIRE | S | low | open (reasoned; confirm in C) | TEST (red) | 2.4 | 2 |
| 451 | Upgrade panel's Close does nothing visible | P2 | WIRE | S | low | open | TEST (red; see 558) | 2.4 | 2 |
| 452 | Toast types look alike; "×N" never shown | P2 | WIRE+UX | S | low | open | EYES +Q (R8-Q5) | 2.4 | 10 |
| 453 | Typography window boxed inside Settings; Escape leaves preview | P2 | UX | S | low | open (suspected) | EYES | 1.2 | 10 |
| 454 | Every surface closes differently | P2 | UX | M | medium | open | TEST +Q (R8-Q2) | 1.2 | 10 |
| 455 | Five tooltip implementations | P2 | UX | M | low | open | EYES +Q (R8-Q4) | 0.9 | 10 |
| 456 | z-index: one table for the mat, ~20 literals elsewhere | P2 | UX+LAY | M | medium | open | EYES | 0.9 | 10 |
| 457 | Bank-panel hero reorder shows a drop line, does nothing | P2 | WIRE | S | low | open | TEST +Q (R8-Q11) | 1.8 | 2 |
| 458 | Tutorial beacons re-render every frame (measured by R6) | P2 | RC | S | low | open | SAFE (R6 groups it with the eye-check set) | 3.0 | 4 |
| 459 | Nav "rise above my own modal" can't work | P3 | DOC+DC | S | low | open | SAFE* | 0.6 | 9a |
| 460 | Code's text sizes/fonts aren't what renders | P3 | DOC+UX | M | low | open | +Q (R8-Q7) | 0.6 | 10 |
| 461 | Events subscribed with no publisher (`ui:open_drawer` → 043) | P3 | WIRE+DC | S | low | open | SAFE* | 1.2 | 9a |
| 462 | `useUIModals` controls nobody uses | P3 | DC | S | low | open | SAFE* | 1.2 | 9a |
| 463 | Props accepted and ignored (`areaId` branch → 407) | P3 | WIRE+DC | S | low | open (HeroDockTab half with 024) | SAFE* | 1.2 | 9a |
| 464 | Retired vocabulary on screen; stale comments | P3 | VES+DOC | S | low | open (on-screen strings need R8-Q6/R9-Q1) | +Q (partly) | 1.2 | 9a / 10 |
| 465 | Stylesheets loaded but unused / used but never loaded | P3 | DC | S | low | open (check global selectors in `modals.css` before deleting) | SAFE* | 1.2 | 9a |
| 466 | Equip-flash timer cleanup never runs | P3 | ML | S | low | open | SAFE* | 0.6 | 9a |
| 467 | Lint residue, R8 | P3 | DC | M | low | open | SAFE* | 0.5 | 9a |

### 3.10 R9 — vestiges, docs, layers, build (CR3-500…515)

| ID | Title | Sev | Cat | Eff | Risk | Status | R10 | Score | Wave |
|---|---|---|---|---|---|---|---|---|---|
| 500 | Players read "tile" in rules text; wrong reach hint | P3 | VES+UX | S | low | open | +Q (R9-Q1); RenderGolden diff | 2.0 | 9b |
| 501 | Rename tile-named engine vocabulary (absorbs 016) | P3 | VES | M | medium | open (needs 106's raw-string fix first) | +Q (R9-Q2) | 1.5 | 9b |
| 502 | Dead tile/Tray-era code (DnD part → 407) | P3 | DC | S | low | open | SAFE* | 2.0 | 9a |
| 503 | Tray names and Tray-as-current comments | P3 | VES+DOC | M | low | open | SAFE* | 1.0 | 9a |
| 504 | Card/deck-era names (parts → 407, 408) | P3 | VES | S | low | open | SAFE* | 1.0 | 9a |
| 505 | Reachability/cycle tools miss an import after an apostrophe | P2 | TST | S | low | open | SAFE | 3.0 | **0** |
| 506 | `.mjs`/`.cjs` linted with no rules | P3 | TST | S | low | open | SAFE* | 2.0 | **0** |
| 507 | Five `@fontsource/*` packages never imported | P3 | DC | S | low | open | SAFE* | 1.0 | **0** |
| 508 | Build ships and preloads unversioned art | P3 | CON | S | low | open | +Q (run-log Q1 / R9-Q5) | 2.0 | 9b |
| 509 | Build warnings: one pointless dynamic import | P3 | CON | S | low (high for the wrong fix) | open | SAFE* | 1.0 | **0** |
| 510 | Content-grammar modules must stay pure (guard) | P2 | LAY | S | low | open | SAFE | 1.8 | **0** |
| 511 | CMS imports `itemRegistry` for one constant | P3 | LAY | S | low | open (CMS side is the CMS lane) | SAFE* | 0.6 | 9a |
| 512 | Two ways into the engine | P3 | LAY | M | medium | open | +Q (R5-Q2) | 0.9 | 8 |
| 513 | Docs agents load first are wrong (absorbs 018) | P2 | DOC | M | low | open (`_shared_rules.md` part not blocked) | +Q (R9-Q3/Q4) | 1.5 | 9a / 9b |
| 514 | Archive sweep; two archive folders | P3 | DOC | S | low | open | +Q (R9-Q3) | 2.0 | 9b |
| 515 | Starting and quest content written in engine code | P3 | LAY | M | medium | open: a design call, owner not yet asked | +Q (new, Q-list #30) | 1.0 | none |

### 3.11 R10 — expansion readiness, coverage (CR3-550…566)

| ID | Title | Sev | Cat | Eff | Risk | Status | R10 | Score | Wave |
|---|---|---|---|---|---|---|---|---|---|
| 550 | No permanent "identical results" gate | P2 | TST | S–M | low | **in progress** (`2e2b572` on `tool/bench-gate`, not merged; baseline uncommitted) | SAFE | 3.3–5.0 | **0** |
| 551 | Risky fixes proven only on fixtures; fixtures borrow `item_` (absorbs 041) | P2 | TST | S | low | open (census in §9 of this file) | SAFE* | 3.0 | **0** |
| 552 | 19 test files can't run in a spike worktree | P2 | TST | S | low | open | +Q (R10-Q2) | 3.0 | process |
| 553 | "The same 10 failures" is checked by eye | P2 | TST | S | low | open | +Q (R10-Q1) | 4.0 | as soon as ruled |
| 554 | 29 skipped tests: stale count, tombstones, dead skips | P3 | TST | S | low | open (Map-burst rules need a ruling) | SAFE* (partly) | 2.0 | **0** (partly) |
| 555 | EventBus swallows subscriber errors in tests | P2 | TST | S | medium | open | +Q (R10-Q5) | 1.8 | before 6/8 |
| 556 | ~37 assertions read `left`/`top` | P2 | TST | S | low | open | SAFE* | 3.0 | **0** |
| 557 | Cycle cuts will break three suites' setups | P2 | TST | S | low | open | SAFE* | 3.0 | **0** |
| 558 | UI tests prove a callback, not the outcome | P3 | TST | S | low | open (rule; applies with 451) | — | 2.0 | 2 |
| 559 | 43 global engine events undeclared | P2 | CON | M | low | open | SAFE* | 1.5 | 6 |
| 560 | `@ts-check` trial on the contract layer | P3 | CON | M | low | open (after the waves) | +Q (R10-Q4) | 0.6 | after waves |
| 561 | Stage 2 seam: hero state in seven stores | P2 | EXT | M | medium | open (describe only; Stage-2 brief) | — | 1.5 | Stage 2 |
| 562 | Stage 2 seam: choosing is flag-centric | P2 | EXT | S | low | open (guard test now; rest describe) | SAFE* (guard) | 1.5 | **0** (guard) |
| 563 | Randomness has no injectable source | P3 | TST+EXT | M | — | merged → 044 | — | — | — |
| 564 | Stage 3 seam: terrain can't be added through the CMS | P2 | EXT | L | low | open (describe only) | — | 1.5 | Stage 3 |
| 565 | Stage 3 seam: Tokens teleport; mat size is dev tuning | P3 | EXT | S | low | open (describe only) | — | 2.0 | Stage 3 |
| 566 | Nothing guards the bench's/HUD's patch points | P3 | TST | S | low | open | SAFE* | 2.0 | **0** |

---

## 4. The fix waves

**The merge rule for every wave**, from plan §10 plus the gate:
- **Tests.** `npx vitest run` shows the same 10 known failures or fewer, and nothing new.
  - The 10 are ContentRules 1, EconSimRunner 1, EconSimTime 1, OneRuleOnePlace 1 and
    TerrainRegistry 6.
  - This check is by eye until CR3-553 is ruled.
  - Run it in the **main folder**: 19 CMS-importing files can't load in a worktree
    (CR3-552).
- **Bench.** `npm run bench -- --compare` exits **0**: no `REGRESSED` (exit 1) and no
  `WORK CHANGED` (exit 2).
- **Tools.** `npm run cycles` shows no new dangerous cycle.
- **Git.** Stage explicit paths only. The owner's uncommitted art under `public/assets/`
  must never be staged: no `git add -A` and no `git add .`.

### Wave 0 — the gate, the tools, the tests, and the invisible easy wins

**Eligible for the autonomous run: yes.** Every item is effort S and risk low. None is a
design choice. None changes how the game looks or plays. Each is proven by a test, the
bench or the build. None waits on an owner question. **This is the complete list that
qualifies under §10 right now.** Anything arguable was moved to a later wave.

**0.1 — Merge the bench gate** (CR3-550, CR3-156)
- It is already built on `tool/bench-gate` (`2e2b572`). What it adds:
  - a strong fingerprint: per-Token, Bank, hero, sprite and bin hashes, plus the count of
    seeded random draws;
  - S4 position hashes after arrivals, drops and the shrink;
  - `WORK CHANGED` (exit 2) and `--accept-work-change=<ticket>`;
  - S4 now reports landed, nudged and refused drops separately.
- Left to do: commit the re-taken `bench/baseline.json` on a quiet machine, then merge.
- ⚠ R10-Q3 ("should the bench fail on a work change?") is still formally open. The
  director went ahead because the change is tooling-only and reversible (run log, item
  13). Say so in the merge message.

**0.2 — Tools**
- **CR3-505.** Strip comments before the import regex in `tools/reachability.mjs` and
  `tools/cycles.mjs:61`, using `codeOf` from `FreeMatGuards.test.js:198-200`.
  - Proof: `nameRegistry.js` becomes reachable, and the cycle report is otherwise
    unchanged.
- **CR3-506 + CR3-025 (config half).** Replace the last two blocks of `eslint.config.js`
  with R9 §7's text.
  - Expect new lint findings in `tools/` and `scripts/`. Lint is not a merge gate, so
    record the new count in the run log.
- **CR3-566.** Add a guard test: `GameLoop.runHandlers` and `EventBus.publish` can be
  reassigned, `tickHandlers` is an array, and `subscribers` is a `Map`.
- **CR3-311 (absorbs 356).** Relabel the HUD figure "mat subtree commits", and add a
  dev-only counter for `MatBoard`'s own renders.
  - Files: `src/ui/dev/perf/PerfProfiler.jsx`, `Board.jsx:132` and `MatBoard.jsx`,
    dev-gated.
  - This does **not** depend on R5-Q1: the HUD reports both numbers.
- **CR3-358.** Hide `FPSCounter` while the Perf HUD is on (`ReactRoot.jsx:463-471`,
  dev-only).

**0.3 — Tests first** (no game code, except two exports for CR3-413)

Every test here passes on today's `main`. The red-first tests are *not* in this slice: they
land with their fixes, because a failing test would break the baseline.

| For | Test (from R10 §2) | Files |
|---|---|---|
| 157 | **CR3-557**: `Flags.init()`/teardown in `BoardCombat.test.js:94-104` and `StatusDeath.test.js:84-91`; `LoadoutMoments.init()` in `CombatEngaged.test.js:78-81` (confirm green before any cut) | 3 suites |
| 007 | **CR3-556**: a `drawnPoint(el)` helper; switch the ~37 mat-position assertions to it, green on `left`/`top` | `MatRenderer`, `FlagSpritesRules`, `MatFit`, `B5Flags`, `FlagUIRender`, `FreeReadersById`, `SmallTokens`, `TokenBadgeRow`, `BottomHeroDockB10` |
| 001 | (a) write-path guard (`board.tokens[` outside `BoardState.js`); (c) iterating `tokens()` while removing visits every original entry | `WorkerSeam`-style new test; `FreeReaders.test.js` |
| 003, 150 | Position golden: import `bench/fixtures.mjs` + `s4-push-storm.mjs`; hash `id,x,y` after the arrivals and after the shrink; literals generated **on current `main`** | new vitest |
| 047 | Two overlapping Forests at family cap − 1, both due in the same tick → exactly one spawn; re-registered spawner type → `familyOf` follows | `SpawnerSystem.test.js` |
| 004 | (a) upkeep aura with an empty Bank → a distant Token's yield returns to base; (b) a `when`-only Token is not a source | `ActiveReaders`/`FreeReaders` |
| 200 | (a) provider moved **into** Near is seen; (b) the station moves next to a provider; (d) provider exactly on the radius | `FreeReaders.test.js:205-229` |
| 250 | (a) killing-tick events pinned; (b) a Near `fixture_buff_yield` producer's yield is unchanged after the kill | `BoardCombat.test.js` "A kill" |
| 258 | Golden over levels 1–99: `levelFromXp(xpForLevel(L)) === L` and `levelFromXp(xpForLevel(L) − 1) === L − 1` | `XPCurve.test.js` |
| 251, 252 | **CR3-266**, the parts that pass today: round-trip `statuses`, `bankedSkills`, `woundedRemainingMs`, `flagColour`, paused promotion offer, gear on the aggregator. **Not** "effects on the aggregator after load": that one is red (CR3-252) | `SaveRoundtrip.test.js` |
| 400–403 | **CR3-413**, the parts that pass today: export `smallestWithin`/`surfaceAtPoint` (`DndKit.jsx:46-103`, `:111-129`); a drawer droppable beats the mat; the 240 px fallback; `pointerToMat` at 6 and 20 steps and fit 0.1. **Not** the "drop over a drawer is a miss" case, which is red (CR3-402) | new test; `MatFrameDrops.test.js` |
| — | **CR3-510**: purity guard for the CMS-loaded content-grammar modules | new guard |
| — | **CR3-562** (guard only): Flags stays the only writer of claims and the only caller of HeroMotion's lifecycle | new guard |
| — | **CR3-551**: rename the 7 `item_*` fixture ids to `fixture_*` | `testTokens.js:878-920` + suites |
| — | **CR3-554** (partly): correct the "18 cases" header (27); delete the two `TerrainOff.test.js:74-76` tombstones. Leave the Map-burst skips (owner) and the art check (after the art moves settle) | 2 files |

**0.4 — Invisible fixes**

| Ticket | Change | Proof |
|---|---|---|
| **CR3-010** | Particle loop sleeps when empty, wakes on `spawnCollected` (R6 §4.3 spike 2). Today it re-arms forever: `ParticleOverlay.jsx:116-122`. **Do not** restore the burst cap here (CR3-352 is R6-Q4). | New unit test with a mocked rAF: no frame is requested after an empty draw; a spawn requests one. Before/after HUD note (dev): frame-work p50 5.56 → 4.65 ms, frames ≤ 6.06 ms 59 → 70 % (R6 batch 1). |
| **CR3-100** | Call `SaveManager.save(false)` right after `createDefaultGameData()` in `onSlotSelected`. `SaveManager` is already imported by `EngineBootstrap.js:7`, so no new cycle. | R10's red-first slot read-back test lands with it: the Hall and the opening items are in the stored slot. |
| **CR3-258** | `levelFromXp` reads `XP_TABLE` (built at `XPCurve.js:81-83`) instead of the O(level²) loop at `:31-40`. Fix the false claim in `FormulaRegistry.js:252-257`. | The golden from 0.3; per-call time 215 µs → ~0 at level 99. |
| **CR3-109** | Autosave: a `stringify` replacer instead of `structuredClone` + strip (`GameState.js:153-172`). Fix the "Default 1 minute" comment (`SaveManager.js:15`). | New test: the saved bytes are identical to today's for S2- and S3-shaped states. Measured 0.71 → 0.25 ms at S2 (R1). |
| **CR3-302** (callback half) | `useCallback` the two inline handlers at `ReactRoot.jsx:377-378`. The `useUIModals` memo half goes to Wave 6. | Test: inspecting a hero does not re-render `MatToken`s (a render-count spy). Measured 108 renders / 33.8 ms per click (R5, dev). |
| **CR3-023** (groups 2 and 3) | Group 2: move `pickWeighted` into a leaf `weightedPick.js` (re-exported from `TimedChanges`). Group 3: move `createRandomQuest`, `questReward` and `copyReward` into `quests/questBounties.js`. | `npm run cycles` drops two groups. Bench identity unchanged (S2 has a quest Token). |
| **CR3-106** | Switch `HeroDockTab.jsx:97`'s raw `'board:tile_changed'` and `GuildHallEffectsPanel.jsx:20`'s `'token_placed'` to the constants; delete the dead `TILE_PUSHED`; fix the stale header and payload docs; add a guard test against raw `'board:'` strings. | The guard test, plus the existing dock tests. This is also the prerequisite for CR3-501. |
| **CR3-509** | Make `SettingsModal.jsx:22`'s `import('…/SaveManager.js')` static. Add comments saying `GameState.js:62-63` are load-bearing cycle breakers (**do not** make those static). | The build warnings drop from 3 to 2; `npm run cycles` is unchanged. |
| **CR3-507** | Move the five `@fontsource/*` packages to `devDependencies`. **Do not** touch `public/fonts/`. | The build output is byte-identical. |

**Expected effect of Wave 0:**
- Engine: none. The bench identity must stay unchanged across the whole wave.
- Drawing (dev): about +10 points of frames within budget at S2, from the particle sleep
  alone.
- Player-visible: none, except that a new game's first save is now complete.

**Risk: low.** The only engine-path change is CR3-023's code move, and the identity gate
catches any change in random-draw order.

### Wave 1 — engine exact wins

**Eligible for the autonomous run: yes, after Wave 0.** This is Z's ruling. The wave is
arguable in one place, and the reasoning is here:
- Every item is effort S, invisible, and **exact by construction**. It does the same
  arithmetic, or skips only work whose outcome is certain.
- Each was spiked with **identical fingerprints** (R2, R3) and an identical S4 position
  checksum (R2).
- The gate now checks that on every run.
- CR3-047 and CR3-150 were rated **low risk** by their owning sessions.
- CR3-001 was rated low–medium only because of a *future* direct write to
  `board.tokens`. Wave 0's guard test (a) closes that.
- CR3-003's "high" risk was precisely "push results must stay identical". The vitest
  golden and the bench's position hashes now check that mechanically.
- **Stop rule.** If the gate reports `WORK CHANGED`, or any test outside the known 10
  fails, park the slice and add it to the owner questions. Do not accept the work change.

**1a — The membership counter** (CR3-047, CR3-001, CR3-264, CR3-158, CR3-031)
- Files: `BoardState.js`, `SpawnerSystem.js`, `TimedChanges.js` (read only),
  `QuestTokens.js` (nothing to change once `tokens()` is cached), `EngineBootstrap.js`
  (priorities).
- **One counter, bumped on every `addToken` call and every `removeToken`, never on
  `setTokenPoint`.** This settles contradiction C-9.
  - `tokens()` returns a frozen cached list, rebuilt when the `tokens` object or its
    version changes. It is **replaced, never patched** (R2 §3.4).
  - The spawner census keys on the same counter, plus a registry version (R3 §3.1
    item 4).
  - Also add the JSDoc line: never return `tokens()` from a UI selector.
- The red-first test lands here: `tokens()` returns the same array (`toBe`) across a
  `setTokenPoint` and a new one after add or remove.
- **CR3-158:** delete the two writes in `workTokenOf` (`BoardState.js:564-565`).
- **CR3-031:** give the nine handlers explicit priorities that reproduce today's order,
  one line of reason each, and a test pinning `quest_manager` after `board_runner`.
- **Evidence** (back-to-back pairs):
  - CR3-047: `TimedChanges` 0.94 → 0.15 ms/tick; `tokens()` calls 47 → 13.5 per tick;
    S2 p50 1.34 → 0.70 ms (R3).
  - CR3-001: S2 p50 1.50 → 0.95, p99 4.5 → 2.3; S3 p50 6.4 → 3.3, p99 81 → 44 (R2).
  - Not measured together. **Projected** S2 p99 ≈ 1.8–2.2 ms after 1a (R3's A+B1 pair
    was 2.17, and B1 is Wave 3).

**1b — Placement** (CR3-150, CR3-003's exact items 1–2)
- File: `MatPlacement.js`.
- The changes (R2 §4.3):
  - hit radius computed once per body;
  - axis rejection before `hypot` in the pass loop and in the final check;
  - `contextFor` buckets neighbours into cells;
  - bounds read once per search;
  - the ring trig cached.
- **Evidence:** S4 worst arrival 56 → 13.2 ms, arrivals p50 27 → 4.9, refused drop 2.09
  → 1.20, shrink 333 → 73 ms. Micro push 40 → 7.2 ms at 300 Tokens. Also, **S2 max
  13.99 → 4.92 ms** with 1a (R2), which explains R3's "unexplained S2 max" (C-8).
- **Still misses:** the worst arrival (13 vs 8 ms) until Wave 3's rebuild fix (~8 ms,
  estimated); the shrink (73 vs 8 ms) unless R2-Q1 exempts developer actions.

**Verification:** the merge rule, plus the micro-bench (`npm run bench:micro`) before and
after, pasted into the run log.

### Wave 2 — visible bug fixes with no design choice

**Needs the owner first.** Each fix only makes the screen show what it was always meant
to show, but §10 excludes anything that changes what is seen (Q3 asks for a blanket yes).
Several also carry their own question.

| Ticket | Fix | Test first (red-first) | Owner Q |
|---|---|---|---|
| 300 | Flat projection selectors in `DockHeroFigure.jsx:75-80` and `HeroDockTab.jsx:70-75` (pattern: `HeroEditModal.jsx:33-43`) | B10 harness: HP mutated in place + `heroes_updated` → `data-dock-hp` updates | Q3 |
| 450 | Exempt the Bank-side sheet from `BottomHeroDock`'s outside-click, or disable those listeners while the Bank is open | `pointerDown` inside the sheet does not call `onSelect(null)` | Q3; confirm in C |
| 451 (+558) | Clear `selectedUpgradeId` on Close; extract the `ReactRoot.jsx:247-250` fallback into a pure selector | the selector returns `null` when the pane is cleared | Q3 |
| 405 | Three `onDrop`s return `false` and announce the engine's reason | mocked `{success:false}` → the drop returns `false`, no equip sound | Q3 (wording: R4) |
| 203 | Error boundary around `MatBoard` and at the root | a child that throws → the fallback shows and the error is logged | Q3 + a look at the panel |
| 402 | `Board.jsx` `onDrop` returns `false` when `surfaceAtPoint` says drawer | the CR3-413 drawer case | **R7-Q1** |
| 457 | Wire `onReorder` in `BankHeroPanel.jsx:45-55` | `onReorder` is called after a hero drop | **R8-Q11** |
| 101 | A monotonic in-session clock with a delta floor of 0; wall clock only for time away | `TickDeltaClamp.test.js` negative-step cases (the spy moves to `performance.now`) | **R1-Q1** |

**Risk: low for each.** Verify with the merge rule, then Session C items: R7 3–7, R8
"open the Bank, click a hero, click a skill row".

### Wave 3 — engine rebuild path, second pass

**Needs the owner first (Q1).** These fixes are exact and bench-gated too, but they are
rated **medium** risk (buff correctness, cache staleness) or effort M, and §10's easy-win
rule requires low and S.

**Order, with a re-measure after each step:**
1. **CR3-004**: the ambient-source index in `TileModifiers.js`, keyed on Wave 1's
   membership counter plus the registry version (R3 §3.2).
   - Evidence: S5 p99 14.8 → 2.2 ms; S3 p99 87 → 12.4, max 314 → 31; `rebuildAll` ~6×
     faster at every size.
   - Guarantees kept: "departure AND arrival"; board-reach; the no-stack guard.
2. **CR3-250**: the **engine-only** form. `TileModifiers`' `HERO_MOVED` handler
   (`:125-131`) skips when the hero's point is unchanged. Leave the publish in place for
   its six UI subscribers (C-11).
   - Evidence: S2 kill tick median 2.8–4.2 ms, `HERO_MOVED` 1.6 ms of it. That is the
     S2 max ≤ 4 ms miss.
3. **CR3-200**: per-move neighbour-cache invalidation. A move journal in `BoardState`,
   replayed by `nearby.neighbourIds` with `nearRadius + 1` slack (R2 §3.6).
   - The red-first test (c) lands here: an unrelated far move keeps the cached list.
   - Evidence: R3's Experiment C, **not exact**, sized the ceiling: S2 p99 1.75 → 1.34 ms.
     **Never ship Experiment C itself.**
4. **Re-measure, then decide:**
   - **CR3-103**: likely close (C-6).
   - **CR3-102**: only if the S3 max still misses; ask R1-Q3 then.
   - **CR3-201**: needs a new bench scenario first (a Forest ringed by placed Tokens and a
     Foundation with no room), keyed per region like 200.
   - **CR3-254**: loot index plus skip-when-Bank-unchanged, with R10's "room appears
     without `inventory_updated`" test.

**Files:** `TileModifiers.js`, `nearby.js`, `BoardState.js`, `BoardCombat.js` (none
changed if the engine-only form is used), `SpriteLayer.js`.

**Expected effect (projected, not measured together):** S2 p99 ≈ 1.3–1.5 ms (target 1.5),
max ≈ 5 ms; S3 p99 ≈ 12 ms (target 4, still missed; a cliff no longer); S4 worst arrival
≈ 8 ms.

**Verification:** the merge rule, plus the 71 modifier test files R3 ran, plus the
`Nearby`/`ActiveReaders` "through Placement" cases.

### Wave 4 — the look-preserving drawing set

**Needs the owner first.** The owner must look (R6-Q2 recommends this batch) and answer
R5-Q1, which sets CR3-301's severity and what the §4.4 React row counts.

**Prerequisite:** CR3-556 (Wave 0).

- **Tickets:**
  - CR3-007: walkers only (heroes, bubbles, enemy Tokens), chosen by kind, never mid-life
    (R6 §4.3 spike 1b);
  - CR3-011 + CR3-351: one shared ring clock (`board/frameClock.js`) plus skipping ring
    writes nobody can see;
  - CR3-301: hero frames written without React (spike 6);
  - CR3-458: the beacon sets its rect only when it changes;
  - CR3-303: `React.memo` on `MatHero`, `Flag`, `LootSprite`, `MatRings`,
    `MatPointAlerts`, with stable `order` maps;
  - CR3-353: bubble measurement keyed on the stack contents;
  - CR3-357: floaters as a CSS keyframe;
  - CR3-354: reserved z for the worked band and the hovered Token;
  - CR3-352: only if R6-Q4 = A.
- **Evidence (R6 batch 2, dev, S2):** the cheap set takes frames ≤ 6.06 ms **38 → 73 %**,
  frames a second **~99 → ~151**, main thread 5.56 → 3.94 ms, mat subtree commits
  **40 → 8/s**, HeroDock 33 → 0.3/s. At S3: fps 65 → 80, and 2 → 8 % within budget.
- **The eye-check list** (R6 §1): sprites stay crisp while walking; bubbles follow the
  walkers; the ring sweeps smoothly; strikes stay on the Token's beat; a limping hero is
  still slow; the first sparkle after a quiet spell appears at once.
- **Risk: medium.** It is visual, `MatToken` is the busiest component, and
  `AnimatedEnemySprite.test.js:70-121` pins React-state frame stepping and must be
  rewritten as a frame-sequence test first.
- ⚠ **Never** add `will-change` to sprites: 3× slower, measured.

### Wave 5 — sprite shadows and glows

**Needs the owner first (R6-Q1).**
- The recommended option (A) draws the contact shadow as one shared soft-ellipse image,
  and the working glow as a pre-blurred image whose `opacity` breathes.
- Files: `TokenSprite.jsx:165-166`, `:210`; `AnimatedEnemySprite.jsx:138`;
  `tailwind.css:745-756`; `TokenBadges.jsx` and `TokenEventAlert.jsx` glows.
- **Evidence:**
  - With every mat filter off: S2 **164 fps (vsync)**, GPU busy 95 → 53 %, frames within
    budget 59 → 89 %.
  - With only the contact shadows off: 108 → 153 fps.
  - S3 with filters off: 2 → 48 %.
- The owner compares side by side before it merges.
- After Waves 4–5, **Session C** measures a production build. Only then does R6-Q3 (a
  canvas mat) get decided.

### Wave 6 — render cascade and event contracts

**Needs the owner first.** Several items are effort M, and R5-Q2 sets the rule for CR3-306.

- **Order:**
  1. CR3-559: an `engineEvents.js` registry plus a guard test; this is the route for
     CR3-107's cleanup;
  2. CR3-306: engine commands announce their own changes, starting with
     `StationRecipe.setSelectedRecipe` publishing `TILE_CHANGED{instanceId}`;
  3. CR3-304: `useTokenState(id, …)` over `tokenEvents.js`, with **one test per
     `MatToken` field first**;
  4. CR3-305: retire `state_changed` in three stages;
  5. CR3-008: move the remaining walk updates out of React, after Wave 4's transform;
  6. then CR3-309, CR3-310, CR3-255, CR3-005 (after R1-Q2), and CR3-302's `useUIModals`
     memo half.
- **Prerequisite:** R10-Q5 / CR3-555. These fixes move work *into* subscribers, where a
  mistake is only a console line in a test run today.
- **Evidence (dev):**
  - 1.1–3.7 ms per broadcast event at S2, 4.5–6.1 ms at S3, ~2.1 a second;
  - `MatBoard` renders 8.8 per game-second from enemy steps (R5), or 3–4/s in real time
    (R6, C-2).
- **Risk: medium.** A route lost here is a silent stall: the CR-044 trap.

### Wave 7 — drag and drop

- **7a — eligible for the autonomous run after CR3-413's tests (Wave 0):**
  - CR3-401: compute the landing once per frame and share it (exact);
  - CR3-403: region and mat rects measured at drag start;
  - CR3-404: hoist `dropAnimation`/`autoScroll`, and a sibling pointer provider;
  - CR3-407: dead drag code, deletion only (three-grep evidence in R7/R9).
  - All S, low, invisible. **Excluded:** R7's "skip the recompute under 4 mat units",
    which changes the ring's behaviour.
- **7b — needs the owner first:**
  - CR3-400: a memoised `TokenGrab` child. M, medium; its benefit is unmeasured until
    Session C items 1–2;
  - CR3-412: after C item 13;
  - CR3-409, 410, 411: R7-Q2/Q3/Q4.
- **Evidence:** reasoned only. Worst case near a `Cannot` Token: "tens to hundreds of ms"
  per `findSpot`, twice a frame. Wave 1b's nudge speed-up shrinks it.

### Wave 8 — cycles, boot and boundaries

**Partly eligible.**
- **CR3-157** (both loops, R2's cuts: a `HERO_DEFEATED` event and `LoadoutMoments.init`)
  is eligible after CR3-557. It is S, invisible, order-preserving, and gated by the three
  prepared suites plus bench identity (S2 has fights).
  - ⚠ R2 rated it low–medium. If the gate or any suite disagrees, park it.
- **Needs the owner first:**
  - CR3-307: `Engine.startSlot`, reusing CR3-100's test as the headless boot test. M,
    medium;
  - CR3-308: (c) shows a refusal on screen;
  - CR3-512: R5-Q2;
  - CR3-108: only with a "back to title" feature.

### Wave 9 — cleanup: dead code, vestiges, lint, docs

**9a is eligible for the autonomous run.** Deletions with three-grep evidence, stale
comments, lint and unused imports: all S, low and invisible.
- **Code:** CR3-024 with 463's `HeroDockTab` half, 036, 037, 038 (schema), 043, 107
  (after 559), 110, 154, 155, 205, 261 (wire at 1.0), 263 (the clear only), 265
  (keep 1100 ms), 312, 359, 406 (CSS), 408, 459, 461, 462, 465, 466, 467, 502, 503, 504,
  511.
- **Docs:** CR3-021 (the rewrite from R6 §8 + R7 §4), CR3-040 (document `window.Game`),
  and CR3-513's `_shared_rules.md` refresh.
- **Rules:**
  - Delete tests only together with the code they test.
  - Update `Promotion.test.js:351,387` comments when CR3-024 goes.
  - Never make `GameState.js:62-63` static.
  - Check `modals.css` for element or global selectors before deleting it.

**9b needs the owner first:**
- CR3-500 (R9-Q1, with a RenderGolden diff);
- CR3-501 (R9-Q2; needs Wave 0's CR3-106);
- CR3-105 (R1-Q4);
- CR3-508 (run-log Q1 / R9-Q5);
- CR3-513/514 archive work (R9-Q3/Q4);
- CR3-464's on-screen strings (R8-Q6).

### Wave 10 — UI consistency

**Needs the owner first**, per R8's rulings:
- CR3-033 (R8-Q1, P1);
- 452 (Q5), 453, 454 (Q2 = R7-Q4), 455 (Q4), 456, 460 (Q7);
- R8-Q3 / Q8 / Q9 / Q10;
- CR3-151 (R2-Q2);
- CR3-409 / 410 / 411.

### Wave 11 — latent rule wiring

**Needs the owner first, and there is no rush: no shipped content triggers these.**
- CR3-028 (discount at the gate);
- 045 (R3-Q1; reachable today via the Woodaxe, so schedule it first here);
- 202 (R3-Q3), 204 (R3-Q2);
- 251 (R4-Q3), 252 (R4-Q2 for the clock; the reload half is a plain bug);
- 253 (loadout cache);
- 256 (R4-Q1; reachable);
- 257 (R4-Q4).

Do each when the content that uses it is authored, test first (R10 §2.2).

### Not in any wave

- **CR3-152**: a push broad-phase. Only if a board past ~250 Tokens is planned, or never,
  if R2-Q2 = A.
- **CR3-355**: a canvas mat. Decide after Session C.
- **CR3-560**: the `@ts-check` trial, after the waves.
- **CR3-561–565, 044**: Stage 2 and Stage 3 briefs.
- **CR3-014, 104, 206**: parked contract notes.
- **CR3-035**: needs a Codex screen.
- **CR3-046**: owner-deferred.
- **CR3-039**: Session C's soak decides.
- **CR3-515**: an owner design call.

---

## 5. Dependency order

```
W0.1 bench gate (550, 156) ──┬──► every perf fix (W1, W3, W4 engine-side, W7a, W8's 157)
W0.3 tests-first ────────────┤
   ├ 001(a)(c), 003/150 golden, 047 cases ──► W1
   ├ 004(a)(b), 200(a)(b)(d), 250(a)(b) ─────► W3
   ├ 556 drawnPoint helper ──────────────────► W4 (CR3-007)
   ├ 557 suite setups ───────────────────────► W8 (CR3-157)
   ├ 266 save round trip ────────────────────► W11 (251, 252)
   └ 413 drag-chain tests ───────────────────► W2 (402), W7 (400, 401, 403)
W0.4 106 raw-string fix ─────────────────────► W9b (501 rename)
W0.2 311 own-render counter ─────────────────► Session C; judging 008/301
W1a membership counter (001/047) ────────────► W3 (004 index key, 200 journal)
W3 004 ──► re-measure ──► 102 (maybe never) ; W3 200 ──► re-measure ──► 103 (likely close), 201
W3 200 per-move cache ───────────────────────► any Token physics (565), steering (Stage 2)
W4 cheap set + W5 shadows ──► Session C production-build run ──► R6-Q3 canvas decision
W1 + W3 (engine S3 cliff) ───────────────────► the S3 drawing verdict (2/3 of S3's long frames are the tick)
R10-Q5 / 555 error spy ──────────────────────► W6 and W8 (work moves into subscribers)
559 engine-event registry ───────────────────► 107 cleanup, 560 ts-check trial
307 Engine.startSlot ────────────────────────► Stage-2 headless runs and bench scenarios
R10-Q2 / 552 cms junction ───────────────────► any spike worktree that must run the full suite
R10-Q1 / 553 it.fails ───────────────────────► automatic merge gating (ideally before W1)
```

**Hard rules:**
- **The gate before any perf fix.** Wave 0.1 merges first; nothing in Waves 1, 3 or 7a
  merges without `--compare` exit 0.
- **Tests before risky fixes.** Every red-first test lands in the same commit as its fix.
  Every "passes today" test lands in Wave 0, so the fix commit shows only the fix.
- **CR3-556 before CR3-007.** Otherwise ~37 assertions turn red, and someone "fixes" the
  expectations.
- **CR3-557 before CR3-157.** Otherwise furling silently stops in three suites.
- **The membership counter once.** CR3-001, CR3-047 and later CR3-004 all key on it.
  Build it in Wave 1a and reuse it; never key a cache on `layoutVersion`, which walking
  enemies bump every tick.
- **Wave 5 after Wave 4.** Size the shadow cost on top of the cheap set; the cheap set
  changes what the GPU is busy with.

---

## 6. Cross-session contradictions, with rulings

| # | Contradiction | Sessions | Ruling |
|---|---|---|---|
| C-1 | The Perf HUD's "MatBoard" figure counts the whole subtree. Filed twice, at different severities. | R5 CR3-311 (P2) · R6 CR3-356 (P3) | **Merge → CR3-311, P2.** Session C reads this number, so a wrong number mis-certifies. Fixed in Wave 0. |
| C-2 | How often `MatBoard` itself renders at S2: 8.8 per game-second (R5, driven ticks, preview pane) vs 3–4 per second (R6, real time, headless Chrome). P3's "37–49/s" is the subtree. | P3 · R5 · R6 | Both are dev-build counts under different drivers and different randomness. **Both miss §4.4's ≤ 1/s**, and the fix is the same (walk out of React). CR3-311's own-render counter settles the real number in Session C. The certifiable claim is only "misses the target". |
| C-3 | CR3-007 was pre-filed as "probably the single cheapest large win" (layout every frame). R6 measured layout at only 0.23 ms per frame; the gain is on the GPU side. Transform on **every** Token was *worse* at S3. | plan §3.2 · R6 | **R6 stands: P1, walkers only**, chosen by Token kind, never mid-life. The biggest lever is the filters (CR3-350), not layout. |
| C-4 | CR3-012's cited lines (`MatToken.jsx:482`, `MatHero.jsx:136`, `SpriteLayerView.jsx:183`) are `transition-[filter]`, not shadows. | plan · R6 | CR3-012 is merged into CR3-350 with R6's corrected lines (`TokenSprite.jsx:165-166, :210`, `AnimatedEnemySprite.jsx:138`, `tailwind.css:745-756`). |
| C-5 | CR3-009 feared Tokens² per `state_changed` (spawner counts). R5 measured it as linear (3× the Tokens cost 1.65× the time) and firing 0.23 times per game-second. | plan · R5 | Quadratic part **not supported**; merged into CR3-304 (the per-Token broadcast of six events). |
| C-6 | CR3-103 (R1): cache the charge plan per Token, keyed on `layoutVersion` + a charges/Bank revision. R3: the cost inside `fixableReason` is `neighbourIds` missing its cache (CR3-200), and fixing that cut `fixableReason` 0.28 → 0.034 ms/tick. A `layoutVersion` key would also miss every tick, because enemies move. | R1 · R3 · R2 | **CR3-200 first, re-measure, and expect to close CR3-103.** Never key a cache on `layoutVersion`. |
| C-7 | CR3-102 (R1): dedupe rebuilds within a tick; it does not move p99. CR3-004 (R3): make each rebuild cheap, which moves p99 and max. R1-Q3 asks the owner about deferral. | R1 · R3 | **CR3-004 first.** CR3-102 only if the S3 max still misses afterwards. R1-Q3 therefore drops in priority (Q-list #17). |
| C-8 | R3: "S2 max stays ~13–18 ms in every run; not in this territory." R2: with spikes A+B, the S2 max went 13.99 → 4.92 ms. | R3 · R2 | **Resolved:** the S2 worst tick is a spawn push (R2's spike B, `MatPlacement`) plus list copies (spike A). Wave 1 covers it. |
| C-9 | When the membership counter bumps. R3: on `addToken` "when the id is new to the map". R2: on **every** `addToken` call, which covers a different object replacing the same id (`BoardState.js:209`). | R2 · R3 | **R2's rule.** A cached `tokens()` holding the replaced object would be stale; over-bumping is harmless (0.006 rebuilds per tick measured). One counter serves both fixes. |
| C-10 | How to break cycle group 1. R2: two small event cuts (`HERO_DEFEATED`, `LoadoutMoments.init`). R4: extract a `FightRegistry.js` leaf. | R2 · R4 | **R2's cuts** (S, order-preserving, suites prepared by CR3-557). R4's extraction is a later refactor if `BoardCombat` grows; it is not needed to reach zero dangerous cycles. |
| C-11 | CR3-250's fix. R4: stop publishing `HERO_MOVED` for a hero who didn't move, **or** skip in `TileModifiers`. R10: `HERO_MOVED` has six UI subscribers. | R4 · R10 · R1 | **Engine-only form:** `TileModifiers`' handler skips when the hero's point is unchanged. The UI keeps its signal. |
| C-12 | CR3-004 is P1, yet R10 says the aura half is latent (no shipped board-reach aura). | director · R10 | **Stays P1.** `rebuildAll` is quadratic **without** an aura, `applicableStatements` runs twice per completed cycle, and the S3 cliff is measured. Only the S5 aura figure is latent. The same applies to CR3-250: its S2 figure (4–5.5 ms kill ticks vs max ≤ 4) is real today; the 123–222 ms figure is latent. |
| C-13 | CR3-150 is P1 because the shrink (73 ms after the fix) misses 8 ms, but only the dev Mat Tuner can shrink the mat, and the player's refused drop is already under target (1.2 ms). | R2 | **P1 pending R2-Q1.** If A (exempt developer actions), it becomes P2. It stays in Wave 1b either way, because the same nudge search is R7's per-frame drag preview (CR3-401). |
| C-14 | CR3-010 is "invisible" (§10 names it), yet R6 lists "the first sparkle after a quiet spell still appears at once" as an eye-check item. | §10 · R6 | **Wave 0.** The wake-on-spawn unit test proves the one behaviour that could differ; the eye check stays on Session C's list. |
| C-15 | CR3-033: the findings doc says the owner decided "disable + coming soon" for all. R8: round-2 decision 14 covered **4 of 13**. | findings · R8 | **R8 stands.** Nine need R8-Q1. |
| C-16 | P1 closed CR2-082 as fixed ("XP_TABLE is read, `XPCurve.js:94`"). Line 94 is inside the uncalled `getXpTable`. | P1 · R4 | **Reopened as CR3-258** (the director already corrected the log). Fixed in Wave 0. |
| C-17 | Plan §2.D (and the memory note) say the Guild Hall upgrade board is a separate 7×7. It has been a web since B9. | plan · R9 | **R9 stands.** Nothing on the upgrade board needs protecting as a grid. The plan and memory should be corrected (Wave 9a docs). |
| C-18 | CR3-040 says `getEngine()` returns 34 entries; it returns 30. | P1 · R1 | 30. Resolve as documentation. |
| C-19 | P3 named `board:progress` (~37/s) as the likely MatBoard driver. | P3 · R5 | **Refuted:** it causes 0 `MatBoard` renders; the rings paint without React. |
| C-20 | R8: `cardSizeStore` sizes a production drag ghost. | R8 · R7 | **Refuted by R7:** only the never-rendered `GhostCardFrame` reads it. The chain is dead code (CR3-407). |
| C-21 | Plan §2.F: "~150 page elements". | plan · R6 | ~1,000 inside the mat at S2, ~2,500 at S3 (150 was the count of *things*). The element ceiling is ~200 Tokens on this PC (dev). |
| C-22 | CR3-011 pre-filed "many timers, a rAF per working Token, an interval per enemy per frame". R6 counted 7 intervals page-wide and ~12 rAF callbacks a frame, and the enemy sprite interval is inactive in S2/S3. | plan · R6 · R5 | **Changed.** The expensive "timer" is the hero sprite `setTimeout` → React state (CR3-301). CR3-011 is re-scoped to the shared ring clock. |

---

## 7. Duplicates merged across sessions

| Kept | Merged into it | Why |
|---|---|---|
| **CR3-311** | CR3-356 | the same HUD counter finding (C-1) |
| **CR3-107** | CR3-262 | the same "engine events sent to nobody" list; R4's 10 are a subset of R1's 16 |
| **CR3-032** | CR3-259 | both name `heroStatsForUi` and per-tick combat allocation; R4 said "fold into CR3-032" |
| **CR3-036** | CR3-260 | R4 widened 036's dead combat and loot code |
| **CR3-044** | CR3-563 | the same unseeded-randomness finding; R10 re-framed it as a Stage-2 prerequisite |
| **CR3-043** | CR3-461's `ui:open_drawer` bullet | the same dead slot-filter chain (R8 found it twice) |
| **CR3-407** | CR3-502's DnD/`MINIBOARD`/`'tile-'` part; CR3-504's `GhostCardFrame`; CR3-463's `areaId`/`HeroAssignmentManager` branch | the same dead drag code, filed by R7, R8 and R9 |
| **CR3-408** | CR3-504's `DeckDndProvider`/`DeckDndContext` names | the same rename |
| **CR3-106** | the raw-string subscription notes in CR3-016, CR3-501 and R5 §7 (`HeroDockTab.jsx:97`) | one fix, done in Wave 0 |
| **CR3-021** | CR3-406's doc half | one `PERFORMANCE.md` rewrite (R6 §8 + R7 §4); 406 keeps the dead-CSS half |
| **CR3-350** | CR3-012 | the director's recorded upgrade (C-4); the exception to "keep the lowest" |
| **CR3-304** | CR3-009 | re-scoped by R5 (C-5) |
| **CR3-306** | CR3-013, CR3-034 | both are instances of R5's "the UI publishes engine events" rule |
| **CR3-501** | CR3-016 | R9's execution brief |
| **CR3-502 / 503** | CR3-015 | R9 split the Tray finding |
| **CR3-513 / 514** | CR3-018 | R9 widened the stale-docs finding |
| **CR3-551** | CR3-041 | R10's verdict |
| **CR3-510 / 511** | CR3-042 | R9's actions for the CMS boundary |
| **CR3-157** | CR3-023 group 1 | R2 designed the cut; 023 keeps groups 2 and 3 |
| **CR3-105** | CR3-038's clock/boot part | R1 took it; 038 keeps the schema part |

**Not duplicates, but the same owner answer:**
- CR3-409 (R7) and CR3-454 (R8) both turn on "one Escape, one layer" (R7-Q4 = R8-Q2).
- CR3-508 (R9) and run-log question 1 are about the same four art folders.

---

## 8. Consolidated owner questions — priority order

De-duplicated across the run log and all 13 session files. **Ordered by how much work
each answer unblocks.** Every question has a recommendation (A). The sources are in
brackets.

1. **NEW (Z-Q1): may the autonomous run take *exact* engine speed fixes rated medium
   risk?** These are fixes that do the same arithmetic in a cheaper order, proven by named
   tests and the benchmark's "the game did exactly the same thing" gate.
   - **(A) Recommended: yes.** A `WORK CHANGED` result or any new test failure parks the
     fix.
   - (B) No, low risk only.
   - (C) Case by case.
   - *Unblocks:* Wave 3 (CR3-004, 200, 250, 254, 201, 103), CR3-157. This is the engine
     half of the 165 target.
2. **Mark the 10 known test failures as "expected" in their files.** [R10-Q1, CR3-553]
   - **(A) Recommended: yes.** Every merge's "baseline unchanged" check becomes automatic.
   - (B) Fix the content now.
   - (C) Leave them.
3. **NEW (Z-Q2): may bug fixes that only make the screen show what it was always meant to
   show go ahead without you looking first?** The candidates: stale HP bars, the hero sheet
   that closes, the dead Close button, the silent equip refusal, the crash safety net.
   - **(A) Recommended: yes, as one wave**, checked by tests and in Session C.
   - (B) Each one after you look.
   - (C) Wait.
   - *Unblocks:* Wave 2 (CR3-300, 450, 451, 405, 203).
4. **The look-preserving drawing set, and what "MatBoard ≤ 1 re-render a second"
   counts.** [R6-Q2 + R5-Q1]
   - **(A) Recommended:** the particle sleep now (it is in Wave 0); the other changes
     (walkers by transform, one ring clock, hero frames without React, the beacon, memo)
     as one wave you eye-check; and the target counts `MatBoard`'s own renders, with
     sprite frames under a separate "never through React" rule.
   - (B) All as easy wins now.
   - (C) Wait for Session C.
   - *Unblocks:* Wave 4. The answer also sets CR3-301's severity.
5. **Sprite shadows and glows, the frame-rate limit.** [R6-Q1, CR3-350]
   - **(A) Recommended: keep the look, draw them as images.**
   - (B) Filters only on still things.
   - (C) Drop them.
   - (D) Leave them (~100–125 fps on a busy mat).
6. **Game time while playing.** [R1-Q1, CR3-101, P1]
   - **(A) Recommended: a clock the PC can't move**, and the wall clock only for time away.
   - (B) Ignore negative jumps only.
   - (C) Leave it.
7. **Something let go over an open drawer.** [R7-Q1, CR3-402, P1]
   - **(A) Recommended: it flies back.**
   - (B) Keep today's behaviour.
   - (C) Drawers slide aside.
8. **The 13 inert Settings controls.** [R8-Q1, CR3-033, P1]
   - **(A) Recommended:** delete the 4 that name retired things; "coming soon" for the 4
     you ruled on; disable the other 5 until they are wired.
   - (B) Disable all 13.
   - (C) Remove all 13.
9. **The engine target.** [P2-Q2]
   - **(A) Recommended: keep 1.5 ms at p99 for the realistic board.** The fixes are
     projected to reach it.
   - (B) Relax it to 3 ms.
   - (C) Decide after Wave 1.
10. **Certify frames on the dev build, or add a profiling build?** [P3-Q2]
    - **(A) Recommended: the dev build, and a near miss means "re-check".**
    - (B) Add `build:perf`.
    - Asked now because R6's numbers suggest S2 will land near the line.
11. **Hidden engine errors in tests.** [R10-Q5, CR3-555]
    - **(A) Recommended: count them first, then make new ones fail.**
    - Needed before Waves 6 and 8.
12. **A stalled station's warning.** [R1-Q2, CR3-005]
    - **(A) Recommended: say it once**, and again only if it clears and comes back.
13. **Spike copies and the editor's packages.** [R10-Q2, CR3-552]
    - **(A) Recommended: link `cms/node_modules` too**, and remove both links before
      removing the copy.
14. **Does the ≤ 8 ms rule apply to shrinking the mat in the developer Mat Tuner?**
    [R2-Q1, CR3-150 severity]
    - **(A) Recommended: no, player actions only.**
15. **What a push moves.** [R2-Q2, CR3-151]
    - **(A) Recommended: only the newcomer and whatever it pushes into.**
    - This makes CR3-152 unnecessary.
16. **One Escape, one layer.** [R8-Q2 + R7-Q4, CR3-454/409]
    - **(A) Recommended: Escape closes the top-most thing only**, and during a drag it only
      cancels the drag. Click-outside closes light pop-ups only.
17. **Buff updates within a tick.** [R1-Q3, CR3-102]
    - **(A) Recommended: yes, merge them within the tick.**
    - Low priority now: ask again only if the S3 worst tick still misses after Wave 3 (C-7).
18. **Crafted, bought or spawned Tokens with no charge count.** [R3-Q1, CR3-045]
    - This is reachable today (the Copper Woodaxe never wears out).
    - **(A) Recommended: keep "no count = unlimited"**, and have the audit flag crafted and
      Shop Tokens with none.
19. **Kill loot and the yield / double-loot / bonus-drop rules.** [R4-Q1, CR3-256]
    - This is reachable today.
    - **(A) Recommended: the same rules as station output.**
20. **Rules text that still says "tile", and the tile-name rename.** [R9-Q1 + R9-Q2,
    CR3-500/501]
    - **(A) Recommended:** "where this one stands", "the nearest / a random free spot";
      rename the code names and the event strings in one slice.
21. **The ~45 history documents and the `.agent/` folder.** [R9-Q3 + R9-Q4, CR3-513/514]
    - **(A) Recommended:** archive them with an index; keep the art workflows; fix two
      guides; archive `add-item.md`.
22. **The four art folders left out of Git LFS, and whether builds ship them.** [run-log Q1
    + R9-Q5, CR3-508]
    - **(A) Recommended:** leave them out of git, and filter them out of the build and
      the preload list.
23. **The uncommitted art in the main folder.** [run-log Q12]
    - **(A) Recommended: you, or your art session, commit it.** The review never stages
      it.
24. **How UI components reach the engine.** [R5-Q2, CR3-306/512]
    - **(A) Recommended: keep direct calls, with one rule:** engine commands announce
      their own changes, and the UI never publishes engine events.
25. **UI consistency.** [R8-Q3, Q4, Q5, Q6, Q7, Q8, Q9, Q10, Q11; R7-Q2, R7-Q3]
    - **(A) Recommended for each** (as in R8 §6 and R7 §7): the pixel-art close icon; one
      gold tooltip; coloured toast edges plus "×3"; plain words instead of the sci-fi
      terms; rewrite text sizes to what renders; keep only "Collapse"; keep the Dev Tools
      tab; leave LayoutSandbox; wire the Bank reorder; take mat Tokens out of the Tab
      order; no hover rings mid-drag.
    - Q11 (the Bank reorder) also unblocks CR3-457 in Wave 2.
26. **Timed effects: whose clock, and are they cleared on defeat?** [R4-Q2 + R4-Q3,
    CR3-252/251]
    - **(A) Recommended: game time; yes, clear all of them**, and `Removes` reaches
      statuses too.
    - Latent.
27. **The Wishing Well rewrites the Guild Hall.** [R4-Q4, CR3-257]
    - **(A) Recommended: keep its water separate.**
    - Latent.
28. **Rule upkeep, and item rule moments.** [R3-Q2 + R3-Q3, CR3-204/202]
    - **(A) Recommended:** rule upkeep takes loot from the floor as well (Bank first);
      items offer only "On Start" and "On Engage".
    - Latent.
29. **The particle burst cap.** [R6-Q4, CR3-352]
    - **(A) Recommended: restore it** (at most 12, 60 ms apart).
30. **NEW: the opening table, the tutorial quests and the random quest pools are written
    in engine code.** [CR3-515; R9 flagged it but asked no question]
    - **(A) Recommended: leave them for now.** The audit already catches renamed ids.
      Move them into the editor only when you want to author the tutorial there.
    - (B) Move them now.
31. **NEW: the Map-burst "completeness" tests.** [CR3-554] These can never pass, because
    Map bursts are retired.
    - **(A) Recommended: delete them.**
    - (B) Rewrite them for spawners.
32. **Unused clock pieces.** [R1-Q4, CR3-105]
    - **(A) Recommended: remove them, and keep `window.Game`** and the replaceable loop
      methods.
33. **A canvas mat.** [R6-Q3, CR3-355]
    - **(A) Recommended: don't decide until Session C** has measured a production build
      after Waves 1–5.
34. **A type-checking trial.** [R10-Q4, CR3-560]
    - **(A) Recommended: one sitting, after the waves.**
35. **Small tooling calls.** [P2-Q1, P2-Q3, P3-Q1, R10-Q3]
    - **(A) Recommended for each:**
      - keep auto-collect on in the "realistic" bench;
      - keep the machine name in the baseline;
      - the Perf HUD stays dev-only;
      - the bench fails on a work change (already built; say if you disagree).

---

## 9. Content census: which fixes are latent (CR3-551, item 2)

From R10 §4.1 (the 94 Tokens, 64 items and 22 library effects in `data/`):

| Feature | Shipped instances | Tickets that are latent today because of it |
|---|---|---|
| Whole-mat (board-reach) aura | 0 | the aura halves of CR3-004, 102, 250; the S5 bench figure |
| `INPUT_COST` modifier | 0 | CR3-028 |
| Status / `Applies` / timed live effect | 0 | CR3-251, 252, 032 (status part) |
| Item carrying an effect or rule | 0 of 64 | CR3-202, 253 |
| Paid statement upkeep | 0 | CR3-204 |
| Authored Guild Hall rules | 0 | CR3-257 |
| `BONUS_DROP` / `LOOT_MULT` effects | 4 / 1 | CR3-256 is **reachable** |
| Crafted Token with no `uses` | 1 (`token_copper_woodaxe`) | CR3-045 is **reachable** |

So the engine figures that matter to a player **today** are the S2 ones (no aura): the
3.2 ms slow tick, and the 2.8–4.2 ms kill tick.

---

## 10. What this plan does not know

- **No real-window or production-build frame number exists yet.** Every FPS figure is a
  dev build (React development mode is slower). Session C is prepared (P3.md, R7 §6) but
  not run. The FPS targets could land better than projected.
- **The Wave 1 and Wave 3 engine projections combine separate spikes.** No run has had
  all of CR3-001, 047, 003/150, 004 and 200 at once. The figures "≈ 1.3–1.5 ms S2 p99" and
  "≈ 12 ms S3 p99" are projections.
- **Most bench numbers were taken on a shared, loaded machine.** The quiet-machine
  baseline is `bench/baseline.json` (S2 p99 3.18 ms, S3 p99 67.7 ms, S4 worst 59.6 ms,
  shrink 338 ms). The gate branch re-takes it.
- **Reasoned, not reproduced:** CR3-402, 450, 451, 400, 401, 403, 405, 409, 412 and 453.
  Session C confirms them.

---

## 11. Owner rulings — interview of 2026-09-30

The owner answered the top 16 of §8 directly and ruled that **the recommended
answer (A) stands for the other 19** (logged, and overrulable later). These
rulings supersede §8's open status. Numbers refer to §8.

| § 8 | Ruling | Effect on the waves |
|---|---|---|
| **1** Exact engine fixes rated medium risk | **Yes.** A `WORK CHANGED` result or any new test failure parks the fix. | **Wave 3 (CR3-004, 200, 250, 254, 201, 103) and CR3-157 are now autonomous-eligible.** |
| **2** The 10 known failures | **Mark them as expected** in their test files. | CR3-553 in Wave 0. |
| **3** Visible-bug batch | **Stale HP bars (CR3-300) and dead buttons (CR3-451) may be batched without a look.** ⚠ **Ask the owner about any bug that could be a design choice.** The hero sheet **is supposed to close on a click on the playmat**. | Wave 2 split: 300, 451, 203 (error boundary) proceed; 405 (silent refused equip: what message?) needs asking. |
| — CR3-450 clarified | **Closing on a click INSIDE the Bank-side hero sheet is a bug.** Clicking the playmat (or outside both) still closes it. | CR3-450 into the Wave 2 batch. |
| **4** Drawing set | **Particle sleep now; the rest (walkers by transform, one ring clock, hero frames without React, the beacon fix, memo) as one batch the owner eye-checks before it is kept.** MatBoard's target counts its own renders (§8 Q4 A). | Wave 4 prepared on a branch, **not merged until the owner has looked**. |
| **5** Shadows | **Owner's own design: a hard, solid-black silhouette copy of the sprite offset down-right (pixel-crisp), and sharp coloured pixel outlines instead of the glow** for hover/selected, working and alerts (the sprite art already has 1-px black outlines). **Measure first**: spike running (`docs/review_v3/SPIKE_shadows.md` when done); offset to be tested (1/2/3 art-px). | Wave 5 waits for the spike and the owner's pick. |
| **6** Game clock | **A clock the PC can't move** while playing; the wall clock only for time away. | CR3-101 (P1) unblocked. |
| **7** Drop over a drawer | **The Shop drawer slides aside when a dragged Shop item comes over the playmat, and reopens when dragged back over the drawer.** Item drags (onto heroes) need no slide. **While the Bank is open, the playmat cannot be interacted with at all**: the Bank covers it. | CR3-402 becomes: implement the Shop slide-back; **verify the Bank rule is enforced** (if a mat drag can start with the Bank open, fix that). |
| **8** Settings | **Delete the 4 retired, "coming soon" on the 4 already ruled, disable the 5 unwired** (until wired in a later wave). | CR3-033 unblocked. |
| **9** Engine target | **Keep 1.5 ms p99** on the realistic board. | — |
| **10** Certification build | **The dev build; a near miss means re-check.** | Session C as written. |
| **11** Hidden event errors in tests | **Count them first, then make new ones fail.** | CR3-555. |
| **12** Stuck station's warning | **Say it once**, and again only if it clears and comes back. | CR3-005. |
| **13** Spike copies | **Link `cms/node_modules` too**; remove both links before removing the copy. | CR3-552. |
| **14** The 8 ms rule and the dev Mat Tuner shrink | **Player actions only.** | CR3-150 severity drops. |
| **15** What a push moves | **Only what the newcomer crowds** (and what that pushes into). | CR3-151; CR3-152 unnecessary. ⚠ Changes future pushes → the bench gate will report WORK CHANGED for S4; accept it under CR3-151. |
| **16** Escape | **One press, one layer**; during a drag it only cancels the drag; click-outside closes light pop-ups only; drawers never close on a stray click. | CR3-454/409. |
| **17–35** | **Recommendation (A) stands** for each, as written in §8. **Except 23** (the uncommitted art): already done; the director committed it with the owner's permission (`24551cf`). **22**: the four scrap art folders stay out of git (A). | — |

### Also decided in the same conversation
- **The new art**: committed; the ore veins and Stone Outcrop use the new vein art (sprite ids repointed); 38 new sprites registered.
- **The owner's CMS to-do**: Wood Foundation → `token_foundation_wood`, Stone Foundation → `token_foundation_stone`, the Stone item → `item_stone`; **retire the Copper Rubble Token** ("we'll just have copper veins").

### Shadows and outlines — owner rulings after the spike (2026-09-30)

The spike (`docs/review_v3/SPIKE_shadows.md`, screenshots in `docs/review_v3/spike_shadows/`)
showed the owner's idea (hard silhouette shadow + ready-made outline images replacing the
glow) runs as fast as every mat effect off: S2 ~155-158 fps vs ~92 today (dev, headless).

- **Hard black silhouette shadow, 2 art-pixel offset down-right: approved.**
- **The shadow appears ONLY on a Token being dragged (lifted) and on floating loot.** A Token
  resting on the board has **no shadow at all** (today's always-on RESTING_SHADOW filter goes).
- **Outlines replace the glow**, colours kept: **green = working, white = hovered/selected,
  red = alert.**
- **Outline thickness: the owner wants 1 px and finds the spike's outline too thick.** The spike
  used 1 art-pixel (2 screen pixels at the 2x sprite scale). The real build produces both
  **1 screen-pixel** and **1 art-pixel** variants, switchable in the dev Mat Tuner, with
  side-by-side screenshots, for the owner to pick by eye.
- Everything ships in the drawing batch the owner eye-checks before it is kept (§11 Q4).

### Wave 2 rulings (owner, 2026-09-30)
- **CR3-405 refused equip**: the item flies back, no equip sound, and a short notification says why.
- **CR3-203 crash safety net**: only the broken area is replaced by a small plain panel ("Something went wrong here") with a Reload button; the rest of the game keeps working.
