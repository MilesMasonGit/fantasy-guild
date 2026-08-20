# Code Review **Round 2** — Findings Tracker

Persistent tracker for the second full-codebase review. See
[`code_review_v2_guide.md`](code_review_v2_guide.md) for scope, objectives,
scoring, and the session plan. **Every review session writes into this file**;
fix waves later update ticket statuses here.

Round 1's tracker (`archive/docs/code_review_findings.md`, 53 tickets) is
history. Only the leftovers carried forward by Prerequisite 4 appear here.

---

## Session Status *(update at the end of every session)*

| # | Session | Status | Notes |
|---|---|---|---|
| — | Prereq 1: preliminary cleanup phase committed + merged, tree clean | ✅ Done (2026-08-18) | Merged to `main` as `edb2e2d`. Brief: [`cleanup_phase_brief.md`](cleanup_phase_brief.md). Filed CR2-001…009. |
| — | Prereq 2: baseline test run recorded | ✅ Done (2026-08-18) | **59 files / 875 passed / 21 skipped / 0 failed.** Was 86 failed / 912 passed over 17 of 62 files at `f8dcae0`. ⚠ Read the Retired Tests Ledger before Session 1 — 41 tests were deleted, not rewritten, so coverage of the cartographer, hero equipment, map burst and board loot is **gone**. Restore hints are recorded (many failed on renamed ids, not absent content). |
| — | Prereq 3: fresh reachability list generated | ✅ Done (2026-08-18) | Re-run post-deletion; see *Shared Inputs* below. |
| — | Prereq 4: round-1 leftovers re-triaged | ✅ Done (2026-08-18) | All 17 checked against current code: **6 superseded** (CR-019/023/024/025/043/046), **1 fixed incidentally** (CR-032), **10 re-filed** as CR2-022…031. Results table in *Shared Inputs*. |
| — | Prereq 5: round-1 docs archived | ✅ Done (2026-08-18) | `code_review_guide.md` + `code_review_findings.md` moved to `archive/docs/` and listed in its README, after Prereq 4 finished reading them. |
| 1 | State core & serialization | ✅ Done (2026-08-18) | Branch `review-session-1`. All 17 files read in full; lint/cycles/duplication/reachability re-run over the territory (**lint is clean here — 0 of the 32 remaining problems fall in `src/state/` or `src/systems/core/`**). Save/load roundtrip **exercised in the running game**, not inferred. Filed **CR2-040…051**. Headline: hero equipment slots are silently re-packed on every load (CR2-040); the tick clock has no upper bound (CR2-041); the four Tokens a new game hands the player name ids the content set no longer defines (CR2-044). Baseline re-verified untouched: 840 passed / 21 skipped / 0 failed, 58 files. Owner's three save slots were backed up before testing and restored byte-for-byte afterwards. |
| 2 | Board engine (the 7×7 playmat) | ✅ Done (2026-08-18) | Branch `review-session-2`. All 16 files in `src/systems/board/` plus `src/config/loopConstants.js` read in full (4,732 lines); lint/duplication/cycles/reachability re-run over the territory (**lint is clean here — 0 of the 32 problems fall in `src/systems/board/`**). Filed **CR2-052…069**. **CR2-007 ruled on with measurements** — see the ruling appended to that ticket. Headline: opening one Map counts as **two** toward quests and placing one Token counts as **two** (both reproduced in the running game); the Tray's capacity rule is enforced two different ways so placement can be refused onto an apparently empty Tray; a sprite sweep published **320 events in a single tick**. Baseline re-verified untouched: 840 passed / 21 skipped / 0 failed, 58 files. Owner's saves were backed up before testing — an autosave did corrupt slot 1 mid-session, and it was restored byte-for-byte from the rolling backup and verified field-by-field. |
| 3 | Combat, heroes, skills & promotion | ✅ Done (2026-08-18) | Branch `review-session-3`. All 28 files read in full (4,592 lines); lint/duplication/cycles/reachability re-run over the territory (**lint is clean here — 0 of the 32 problems fall in this territory; duplication finds 0 clones here**). Filed **CR2-070…083**. Headline: a hero poisoned to 0 HP off an enemy tile is **never wounded** and works on at zero HP (reproduced in the running game — the code that handled it was `LoopRunner`, deleted by the playmat rework); **retiring a hero standing on the board leaves a saved tile entry pointing at a hero who no longer exists** (reproduced); **levelling a skill makes a hero faster at nothing** — the SPEED modifier is read by no one, and its category case could never match anyway (reproduced); XP bonuses name an effect type that does not exist. **CR2-029 ruled on** — see CR2-074: nine unread types not seven, plus three read-but-never-written, and **no live item is affected** because no authored item carries any gear effect. **CR2-011 confirmed far wider** — 3 of the 4 enemies can never drop anything and the 4th is empty 23% of the time, measured over 2,000 rolls each. Position on the 16-module lazy-import cluster in the System Map: agree with Session 1, leave it, with one cheap local fix identified. Baseline re-verified untouched: 840 passed / 21 skipped / 0 failed, 58 files. All seven save keys were captured before probing; an autosave fired on a page reload and overwrote slot 1, which was restored byte-for-byte from the rolling backup and verified field-by-field (heroes, inventory, time bank, playtime, quest counts all match). |
| 4 | Gameplay services & shared utilities | ✅ Done (2026-08-19) | Branch `review-session-4`. All 23 files read in full (~3,050 lines); lint/duplication/reachability re-run over the territory (**2 of the 32 lint problems fall here** — `InventoryGroupManager.js:41` and `QuestManager.js:281`, both folded into tickets). Filed **CR2-084…107**. Headline: **every "hunt" bounty in the game is impossible to complete** — the bounty pool names enemies that do not exist (reproduced in the running game); **the recruit cost is frozen at 10 forever** because `totalRecruits` is never incremented, and it is the gate on retiring a hero (reproduced); **two more quest counters double-count** beyond Session 2's two, making it all four (reproduced); enemy kill counts are never recorded; creating a Bank tab is impossible (reproduced); two whole engine modules (`InventoryGroupManager`, `ProgressionSystem`) are registered on the engine object and called by nothing. **CR2-012 confirmed** (delete `RegistryUtils`) and **CR2-015 confirmed moot**, superseded by CR2-084. **The `deltaMs` question answered** in CR2-095: the only clock-sensitive thing `QuestManager.tick` does is the 5-minute abandon cooldown, which therefore runs on real time and cannot be fast-forwarded — and `ItemRateTracker` has the same fault with a player-visible symptom. `config/questConfig.js` was already deleted; the guide's row is stale. Baseline re-verified untouched: 840 passed / 21 skipped / 0 failed, 58 files. All nine save keys captured before probing; `GameLoop.stop()` called before restoring so no autosave could fire, then all nine restored and verified string-for-string — nine of nine exact matches. |
| 5 | Content pipeline & the CMS boundary | ✅ Done (2026-08-19) | Branch `review-session-5`. All 10 `data/` content files, 3 schemas, 3 templates, `DatabaseManager.js`, **all 20 files in `src/config/registries/`** (the guide says 23 — stale), `scripts/regenerate_game_package.js`, the sync route and its CMS caller read in full. Lint/reachability re-run over the territory (**lint is clean here — 0 of the 32 problems fall in `data/`, `src/config/registries/`, `DatabaseManager.js` or `scripts/`**). Filed **CR2-108…125**. **Headline (CR2-108) — the central question answered:** nothing catches a dangling content id because there are four layers that could and none does — no registry validates at load, every accessor returns `null` and every caller is written to survive it, the one `itemExists()` helper is called by nobody, and the validation suite has 18 of 32 cases skipped **plus two un-skipped cases that pass vacuously** (the `OPENING_TRAY` rule short-circuits on `?.` when the Token does not exist, which is why CR2-044 was green). A concrete three-part content-integrity check is specified, with an owner decision on strictness. Other headlines: **no Token in the game awards any skill XP** (verified at runtime — six Foundation skills can never level); **combat cannot happen** — no authored Token is `tokenType: 'enemy'`; **the CMS never writes recipe pools to the game**, so `data/tokenRecipes.json` is `{}`; a shipped Token description reads **"NaN% Speed"** and no UI displays Token descriptions at all; **`scripts/regenerate_game_package.js` would destroy the current content set** and is the surviving form of the sync hazard; the Cartographer sells exactly one Map, "Test Map", for 1 gold. **CR2-002 ruled MOOT** — the sprite exists; the test that found it builds the wrong path. Verdicts given on schema drift (delete `data/schemas/` + `data/templates/`), `data/archive/cards/` (recommend delete) and `nameRegistry.js` (**keep — live via the barrel**). Baseline re-verified untouched: 840 passed / 21 skipped / 0 failed, 58 files. All seven save keys captured before probing; **this session mutated nothing** — every probe was a read — and all seven were re-read afterwards unchanged. |
| 6 | UI ↔ engine boundary, shell & shared UI | ✅ Done (2026-08-19) | Branch `review-session-6`. All 35 territory files read in full (~5,550 lines), plus the two sweeps across all 64 files of `src/ui/`. Lint/duplication/cycles/reachability re-run over the territory (**19 of the 32 lint problems fall here** — all claimed off CR2-036 into CR2-152). Filed **CR2-126…152**. **Headline: the linter has been running with six rules instead of the recommended set** (`js.configs.recommended` is spread and then overwritten), and turning it on finds **three genuine runtime crashes nothing was reporting** — `EventBus` is never imported into `TokenVaultTab` (reproduced in the running game: every Vault deposit and quick-add throws), `TokenBank` is never imported into `Board.jsx` (dragging a Token from the Vault straight onto a tile does nothing), and `<GhostCardFrame>` in `DragGhost` is undefined (dragging an Item over the board throws inside the drag overlay). Also: **`ui:notify` has no subscriber**, so promotion, retirement and Bank-sale messages are all silent (confirmed at runtime); **11 Settings controls change a value nothing reads** and 3 dev buttons publish to nobody (confirmed at runtime); **five of the seven events `useUIModals` listens for have no publisher**, which leaves a modal, a card module and a hook (270 lines) reachable only through a dead event. **Sweep 1 (subscription leaks): clean — all 22 subscribe sites and all 10 timers/listeners are paired.** **Sweep 2 (rules in components): one genuine violation** — the Vault deposit rule still lives in three React components; CR2-033 moved the event but not the rule, and the matching *withdraw* publishes were left in the UI, latently double-counting a quest (CR2-146). **CR2-037 corrected** (the duplicate `useEngine` has zero importers, not two — it is a dead export, and deleting it breaks nothing). **CR2-038 confirmed and widened** (`CARD_TIERS` is unused in the game too). **CR2-035 re-confirmed** with an ownership correction (all three parts are Session 6's files, not Session 7's) and new evidence that ToastContainer's collapse button was *removed*, not never built. Baseline re-verified untouched: 840 passed / 21 skipped / 0 failed, 58 files. **Save slots: `localStorage` was completely empty at session start — no saves, no settings, nothing to back up.** A fresh game was started in slot 1 to have something to exercise; nothing pre-existing was read, written or lost. Guide drift reported, not worked around (two dev-surface paths and a file count). |
| 7 | Game-surface components | ✅ Done (2026-08-19) | Branch `review-session-7`. All 28 territory files read in full (**5,874 lines**) — `board/` (10), `dock/` (7), `drawer/` (10), `hero/HeroSkillSheet.jsx`. Lint/duplication/cycles re-run over the territory, **and lint re-run a second time with `js.configs.recommended` actually applied** via a throwaway config (deleted afterwards). Filed **CR2-153…176**. **Lint headline — a clean result:** with the full rule set on, this territory has **no undefined reference beyond CR2-126 and CR2-127**; 17 problems, 11 errors, every error one of those two. **But the counterweight matters more:** the four worst findings below are *invisible to lint even fully configured*, because `no-unused-vars` sees a dropped binding and cannot see a dropped **prop** or a dropped **object field** — CR2-036's list is a floor, and a low one (CR2-171). **Headline findings, all confirmed at runtime:** **a hero cannot be dragged out of the Hero Dock** — `HeroDockTab` spreads `drag.dragHandleProps` where the hook returns `handleProps`, so no listeners attach; since the dock is one of only two `HERO` drag sources and the other is a hero already on the board, **the core loop cannot be started on a fresh save** (CR2-153). **The pinned hero card can never open** — `onToggle` is handed to `HeroDockTab` as `onClick`, a prop it does not accept — which leaves `DockSkillsGrid`, the Gear/Skills toggle, the card's equip drop target, the dock SFX and 10 of `dockConstants`' 12 exports unreachable, with `HeroDock.test.js`'s 22 green tests covering a module nothing calls (CR2-154). **Two of the five tile alerts render nothing of their own**: `access` and `unskilled` (and `unstocked`) fall through `renderAlert`, so a hero who is under-levelled or holds the wrong skill entirely is told **"Need Items"** — wrong information, not missing information (CR2-155). **`ALERT_HINT` confirmed unfinished, not retired** — all six strings absent from the live DOM, D-114 unimplemented while looking implemented (CR2-156). **Both hero docks' recall drop is a silent no-op** — `engine.Placement` does not exist (it is `BoardPlacement`) and `engine.HeroAssignmentManager` is a retired system (CR2-157). **A single click bursts a Map**, contradicting D-142 and the comment two lines above it — the **eighth** confident comment found asserting the opposite of its own code (CR2-158). Also: `Board` renders a dead second `TokenInspectPopup`; `TrayMiniBoard` is a partial second copy of the board's drop handler that lies about 2×2 occupancy; the drawer's per-pane filter has no publisher; the Cartographer and the Bank both fetch the player's gold and show neither; `HeroInspectionSheet` invents a "locked skills / requires promotion" model D-250 does not contain and hides banked skills entirely. **CR2-134 widened** (five copies of the Vault deposit rule, not three). **CR2-050 argued *narrower*** — `BOARD_PX` is a compile-time constant, so board pixel coordinates are stable across a resize; the Tray is the only variable-size surface and it already uses fractions. **CR2-031 and CR2-021 not reached — left to Session 8**, along with two rAF-gated visuals this harness cannot show (`requestAnimationFrame` never fires here). ⚠️ **Guide drift reported and it ran the other way**: the kickoff brief claimed the guide's file counts were stale; checked against the tree, **the guide is correct and the brief was wrong**. Baseline re-verified untouched: 840 passed / 21 skipped / 0 failed, 58 files; build clean. **Save slots: the owner's save was never loaded** — `GameLoop.stop()` first, all runtime work in the empty slot 2, then the probe slot deleted and `last_slot` restored; all three original keys verified identical by length and checksum. |
| 8 | Runtime verification (hands-on) | ✅ Done (2026-08-19) | Branch `review-session-8`. Hands-on in the running game against a **fresh save in the empty slot 3**, with a **full 49-tile board and 12 heroes working**. Filed **CR2-177…182**; **15 earlier tickets re-tested in place** (confirmed / refuted / narrowed). **Harness breakthrough — record this:** `requestAnimationFrame` is dead in this pane, but **polyfilling it with `setTimeout` unblocks framer-motion**, which is what three sessions had been blocked by; and **dnd-kit drags are fully automatable** provided each pointer move near the target is sent in its **own** `javascript_tool` call (collision resolution lags one React commit). Between them, drawers open and drags land. **Headlines: CR2-153 confirmed by an actual drag — a fresh save cannot put a hero to work**, and CR2-044 is worse than filed: the four opening Tokens are **invisible blank squares that `Placement` refuses with "Not a valid Token"**, so a new game's whole tray is inert. **CR2-127 refuted as player-facing** (the drawer covers the board by design, D-107 — the crashing branch is unreachable dead code). **CR2-050 refuted** (`BOARD_PX` is a fixed 944, sprites cannot land off-board) — but chasing it found **CR2-179, the biggest new finding: the playmat is hard-coded 944×944 with no scaling, so at 1366×768 the top row is off-screen and at 1600–1728 wide the Tray sits on top of the right-hand column and steals its drops.** **CR2-155 narrowed and corrected**: an `unskilled` tile shows not "Need Items" but a **normal working countdown** — no warning at all. **CR2-016 confirmed by code path with the volume actually raised** (four SFX, `play()` at volume 0.2, no rejection) — still not literally by ear. **CR2-021 confirmed hard**: one bulk XP grant produced **1,388 `play()` calls, ~2 in 3 aborted**. **CR2-157 confirmed**: hero dropped on the dock recall zone — drop registers, nothing happens. **CR2-040 confirmed** through the real load path (gaps in the equipment grid destroyed). **Measurements: tick = 0.159 ms of a 5 ms budget** with 12 heroes on 49 tiles; **memory flat** (net +0.25 MB over the second 20,000 ticks, subscriptions 619 → 619); **preload gates 89 of 496 assets, none of them playmat or tokens**. **Answer on CR2-007: do not wire `EventBatch`** — `useGameState` already coalesces per subscriber via `queueMicrotask`, and a measured 160-event burst produced **exactly the same single DOM mutation** as one event. **CR2-031 still not testable** — AnimatePresence exits never complete here; owner's eyes needed. Baseline re-verified: 840 passed / 21 skipped / 0 failed, 58 files; build clean (855.48 KB JS). **Save slots: all 5 keys captured and hashed first, `GameLoop.stop()` before restoring, work done only in the empty slot; all 5 restored and verified exact by length and checksum, with every key this session created removed.** |
| 9 | Build, Tauri readiness & synthesis | ✅ Done (2026-08-19) | Branch `review-session-9`. Build/test/lint/cycles/duplication all re-run and re-verified: **840 passed / 21 skipped / 0 failed, 58 files**; build clean at **855.48 KB JS** + 282.73 KB CSS, single chunk; **0 dangerous import cycles** (228 files, 1,049 edges); **12 clones, 0.45%**. Filed **CR2-183…188**. **Five-file version check: all five agree at `0.6.0`** — CLAUDE.md's rule has been followed, and the only wrong version anywhere is the hard-coded `v0.9.0` in the Settings sidebar (CR2-145). **CR2-129 confirmed by measurement**: 6 rules active instead of ~40; fixing it takes the report 32 → 46 problems and adds four `no-useless-assignment` hits and two test-globals config gaps (CR2-184) — **no fourth crash is hiding**. **CR2-008 answered with the cross-check it asked for (CR2-185)**: of 11 MB, a single **4.0 MB BGM mp3 is 36% of the payload**, 37 of 51 SFX clips are unreferenced (including a 314 KB vendor demo reel), ~1.4 MB of `backgrounds/` belongs to retired systems (invasions, cards, quests, stations), and two live faults were found — two of the three BGM tracks name files that do not exist, and `AssetPreloader`'s boot gate still waits on the retired area banners while **not** gating the playmat or Tokens. **Tauri: mostly in good order, three gaps (CR2-187)** — no `@tauri-apps/api`/dialog/fs anywhere, so decision 17's "wait for Tauri" for save export is waiting on unscheduled work; `csp: null`; an installer description advertising retired invasions. **And CR2-179's open question answered (CR2-183): the shell opens at 1600 × 1000 with a 1024 × 700 minimum — squarely inside the band Session 8 proved is broken.** Persistence verdict: `SaveManager` is more robust than the review's warnings imply (rolling backup, automatic retry from it, quota handling) — the gap is off-machine backup, not correctness. Then the three synthesis jobs: **the coverage-restoration plan**, **CR2-006 and CR2-009 re-raised as standing tickets with owner options**, and **the final prioritised backlog**. ⚠ `data/palettes/custom_palettes.json` was still modified by another session sharing this checkout and was **left alone, not committed**. |

**Next ticket ID:** CR2-189

**➡ The review is COMPLETE. The deliverable is the
[final backlog](#-the-final-backlog) at the end of this file** — read that
first; everything before it is the evidence behind it. The
[coverage-restoration plan](#-the-coverage-restoration-plan) sits just above it
and runs before the fix waves.

Status values: `⬜ Not started` → `🔄 In progress` → `✅ Done (date)`.

---

## Shared Inputs *(filled by the prerequisites, used by every session)*

### Baseline

- Branch / commit: `main` @ `edb2e2d` (cleanup merge), tree clean
- Test baseline: **875 passed / 21 skipped / 0 failed**, 59 files
- Build baseline: **912.23 KB JS** (279.76 KB gzip), **282.59 KB CSS** (44.25 KB
  gzip), single chunk, no warnings. Round 1 ended at 1,036 KB JS.
  ⚠ `public/assets` is **11 MB** — more than 10× the JS bundle and the real size
  lever for a Steam build (CR2-008).
- Source size: **260 files** in `src/`, down from 305.

### Reachability — files nothing imports *(Prereq 3)*

*Paste `node tools/reachability.mjs` output here. Caveat from the tool's own
header: the import regex also matches commented-out imports, so this list is a
floor, not a ceiling. Ignore `src/tests/` lines — vitest finds those itself.*

Re-run after the cleanup's deletions. Three non-test entries remain, all
accounted for — **treat this list as fully triaged, not as work**:

```
   165 src/config/registries/modifierPalette.js   <- LIVE, but only via cms/src (see below)
    86 src/config/registries/tokenConstants.js    <- LIVE via cms/src; also ContentRules.test.js
    83 src/systems/core/EventBatch.js             <- KEPT DELIBERATELY, see CR2-007
```

*(`StatProcessor.js` was on this list and was genuinely dead — deleted
2026-08-18 after checking both `src/` and `cms/`.)*

### ⚠ Three ways this tool lies — read before deleting anything it lists

1. **It walks from `src/main.jsx` only**, so files used solely by **tests**
   report as unreachable. Deleting on its word broke the suite once during the
   cleanup (`RecruitSystem`).
2. **It does not know the CMS exists.** `cms/src` imports seven modules directly
   out of the game's `src/` — see CR2-010. Two entries above are live *only*
   because of that. Nothing in the game reaches them, and no game test covers
   them, so deleting them looks safe right up until the CMS breaks. The CMS has
   no tests of its own (CR2-006), so nothing would catch it.
3. **Searching for a filename is not the same as finding an import.** An earlier
   pass here matched any quoted string containing the stem, including doc
   comments, and wrongly cleared all three files above as "live via
   triggerRegistry" — `triggerRegistry` imports none of them. Match on an actual
   `from '…'` specifier, then confirm the exported symbols are referenced.

The reliable check is: grep `src/`, grep `cms/src/`, grep `src/tests/`, and
check the exported symbols — not the filename — before removing anything.

### Round-1 leftovers — triage results *(Prereq 4)*

| Round-1 ticket | Verdict | Carried as |
|---|---|---|
| CR-010 (P2) | Mostly fixed incidentally; residue still live | CR2-022 |
| CR-012 (P3) | Still live | CR2-023 |
| CR-014 (P3) | Still live | CR2-024 |
| CR-015 (P3) | Still live | CR2-025 |
| CR-016 (P3) | Still live | CR2-026 |
| CR-019 (P2) | Superseded (code deleted by rework) | — *(every file it named is gone; the one survivor, GICard's hover audio, is already CR2-020)* |
| CR-023 (P3) | Superseded (code deleted by rework) | — *(LoopRunner + StationManager deleted)* |
| CR-024 (P3) | Superseded (code deleted by rework) | — *(areaStates and their `_`-prefixed fields are gone)* |
| CR-025 (P3) | Superseded (code deleted by rework) | — *(all five files it cited are deleted)* |
| CR-031 (P3) | Still live | CR2-027 |
| CR-032 (P3) | Fixed incidentally | — *(now `logger.debug` at `SkillSystem.js:182`, with a comment recording why)* |
| CR-034 (P3) | Half still live, half superseded | CR2-028 |
| CR-042 (P2) | Still live | CR2-029 |
| CR-043 (P3) | Superseded (code deleted by rework) | — *(every registry it named, and both DropTableModals, are deleted)* |
| CR-046 (P3) | Superseded (code deleted by rework) | — *(AreaBannerRow deleted)* |
| CR-047 (P3) | One part still live, three superseded | CR2-030 |
| CR-050 (P2) | Still live, re-characterised and downgraded to P3 | CR2-031 |

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

### Session 1 — State core & serialization

**Territory:** `src/state/` (2 files) + `src/systems/core/` (15 files), 2,898 lines.

#### State ownership

`GameState` is the single mutable store; every system writes into it directly.
The top-level sections declared by `StateSchema.INITIAL_STATE` are `meta`,
`heroes`, `recruitment`, `cards`, `inventory`, `currency`, `progress`, `time`,
`collection`, `ui`, `board`, `quests`.

Sections **this session's own code** writes:

| Path | Written by |
|---|---|
| `meta.lastSavedAt` | `GameState.serialize()` |
| `meta.totalPlaytime` | `EngineBootstrap` `time_tracking` tick handler |
| `time.gameTimeMs`, `time.lastTickAt`, `time._rev` | `GameState.updateTime()`, called from the same handler |
| `time.timeBankMs` | `TimeBankManager._setBank()` |
| `collection.discoveredEnemies` | `DiscoveryManager.discoverEnemy()` |
| `quests` (created if absent) | `GameState._rehydrateAll()` |
| `board.tray` (opening four) | `EngineBootstrap.createDefaultGameData()` |
| `currency.gold` (=120 on new game) | `EngineBootstrap.createDefaultGameData()` |

⚠️ **The declared schema and the real save have drifted** — see CR2-042. Live
save fields absent from `INITIAL_STATE`: `board.sprites`, `board.tokenBankSlots`,
`board.tokenTabsUnlocked`, `inventory.maxTabs`, `inventory.maxSlots`,
`progress.guildUpgrades`, `progress.mapDiscoveries`, `quests.completedTutorials`,
`hero.woundedRemainingMs`.

**Not in `GameState`:** player settings live in `localStorage` under
`fantasy_guild_settings`, owned solely by `SettingsManager`. Saves live under
`fantasy_guild_slot_{0,1,2}` with a one-generation rolling backup at
`…_backup`, plus `fantasy_guild_last_slot` and the one-shot marker
`fantasy_guild_dev_mute_applied`.

#### Events published by this territory

| Event | Publisher | Live subscribers |
|---|---|---|
| `game_loaded` `{slot, savedAt}` | `SaveManager.loadSlot` | 4 — `TimeBankManager` (offline accrual), `BoardRunner` (`TileModifiers.rebuildAll`), `BoardCombat` (`clearAll`), `GuildUpgradeManager` (`recompute`) |
| `settings_updated` | `SettingsManager.save` | `SaveManager`, `AudioSystem`, `main.jsx`, UI |
| `notification_added` / `_dismissed` / `_updated` | `NotificationSystem` | `NotificationSubscriptions` heartbeat, `ToastContainer` |
| `state_changed`, `heroes_updated`, `inventory_updated` | `EngineBootstrap.onSlotSelected`, `DiscoveryManager` | UI hooks |
| `enemy_discovered` | `DiscoveryManager` | 1 |
| `time_bank_updated` | `TimeBankManager._publish` | 1 (`TimeBankWidget`) |
| **`cards_updated`** | `EngineBootstrap.onSlotSelected:304` | **0** — retired with cards (CR2-046) |
| **`game_started`** | `SaveManager.newGame` | **0** (CR2-046) |
| **`game_saved`** `{slot, timestamp, autoSaveInterval}` | `SaveManager.save` | **0** — payload implies a save indicator that does not exist (CR2-046) |
| **`game_loop_started` / `game_loop_stopped`** | `GameLoop` | **0** (CR2-046) |

#### Events subscribed by this territory

`audio:play`, `hero_leveled`, `combat_victory`, `combat_defeat`,
`combat_hero_attack`, `combat_enemy_attack`, `settings_updated`,
`hero_recruited`, `hero_retired`, `inventory_updated`, `currency_changed`,
`game_loaded`, `notification_added`, `notification_dismissed`.

**Subscribed but never published** (contract mismatches):
`card_spawned` (`DiscoveryManager:30`, CR2-046), `skill_leveled` and
`invasion_started` (`AudioSystem:42-43`, already CR2-022).

#### Who calls into this territory

- `main.jsx` → `SettingsManager.init` → `SaveManager.init` →
  `EngineBootstrap.getEngine` → `EngineBootstrap.init` → React mount →
  subscribes `react:slot_selected` → `EngineBootstrap.onSlotSelected`.
- `EngineBootstrap.init()` registers **8 tick handlers**, all at the default
  priority — order is decided by source order (CR2-026).
- `EngineBootstrap.getEngine()` is the object the whole UI reads through
  (`useEngine`), so it is the de-facto public API of the engine.

#### Boot ordering — verified correct

Every `game_loaded` subscriber is registered by `EngineBootstrap.init()`, which
`main.jsx` runs **before** the save-slot screen can call `loadSlot`. Confirmed in
the running game: offline time accrued (`Banked 15161s offline`) and tile
modifiers rebuilt on load. No race.

#### Layer check

`src/systems/core/` and `src/state/` are **clean of React** — no JSX, no hooks,
no component imports. `AssetPreloader` and `SettingsManager` touch `document` /
`window`, which is browser API rather than React and is appropriate for their
jobs. One violation found *adjacent* to the territory and filed as a stub for
Session 2: `BoardState.js` (engine) imports `src/ui/components/board/boardConstants.js`
— CR2-051.

#### Rehydration — what actually happens on load

`GameState._rehydrateAll()` does only three things: re-creates each hero's
`ModifierAggregator` and re-derives their skill/equipment modifiers, and creates
`state.quests` if absent. **Everything else is a genuine flyweight and needs no
rehydration** — board tiles, tray and Vault entries store only
`{typeId, usesRemaining, cycleElapsedMs}` and resolve their definition through
`getTokenType()` at every read. Verified by roundtrip.

The two lazy imports at `GameState.js:44-45` (`HeroManager`, `EquipmentManager`)
are the data layer reaching up into the engine layer, and are the sole reason
`npm run cycles` reports a 16-module group. **Judgement: leave them.** The
dependency direction is genuinely inverted, but nothing is broken, the lazy
import correctly breaks the load-order cycle, and per objective 6 a structural
proposal owes evidence of an actual problem — there isn't one here. If the fix
waves want it tidied, the cheap version is to move `_rehydrateAll` into
`EngineBootstrap` (which already imports both) and have `initFromSave` take a
rehydrate callback; that is a refactor of convenience, not a bug fix.

### Session 2 — Board engine

**Territory:** `src/systems/board/` (16 files) + `src/config/loopConstants.js`,
4,732 lines. All read in full.

#### State ownership

Everything under `state.board`, plus two fields filed elsewhere:

| Path | Owned by | Notes |
|---|---|---|
| `board.tiles` `{index: instance}` | `BoardState` | Sparse map. Instance is `{id, typeId, usesRemaining, cycleElapsedMs}` + runtime `alert`, `blockUpkeep`, `blockCooldowns`, `isLanding` |
| `board.heroTiles` `{heroId: index}` | `BoardState` | Single source of truth for hero position (Phase 7). No entry = in the Dock |
| `board.vacancies` `{index: {typeId, unstocked}}` | `BoardState` / `Managers` | Set only on depletion, cleared by any placement |
| `board.tray` `[instance]` | `BoardState` | Positions are 0–1 fractions on the instance |
| `board.tokenBank` `{typeId: [{usesRemaining}]}` | `BoardState` (shape) / `TokenBank` (rules) | |
| `board.tokenBankSlots` | `TokenBank.slotCap` reads; written by `GuildUpgradeManager` | |
| `board.tokenGroups` | `TokenGroups` | **Undeclared in `StateSchema`** — CR2-069 |
| `board.maps` `[{id, typeId, x, y}]` | `BoardState` | Absolute pixels, unlike tray fractions |
| `board.sprites` | `SpriteLayer` | Absolute pixels — CR2-050 (Session 1) |
| `cartographer.purchasedMaps` | `Cartographer` | **Top-level, undeclared** — CR2-069 |
| `progress.mapDiscoveries`, `progress.guildHallMapOpens` | `Cartographer` | Second is undeclared — CR2-069 |
| `collection.cardUseCounts` | `BoardRunner:280` | Retired-era name, still written per cycle |

**Runtime-only, never saved:** `TileModifiers.aggregators` (Map, rebuilt on
`game_loaded` and on `ADJACENCY_DIRTY`), `BoardCombat.fights` (Map, cleared on
`game_loaded`), `InputAllocator.starvation` (Map, never read in-game — CR2-067).

#### Events published by this territory

| Event | Publishers | Live subscribers |
|---|---|---|
| `board:tile_changed` | 18 | 9 — `QuestManager`, `Board`, `BoardTile` ×2, `TileProgressBar`, `Tray`, `TrayMiniBoard`, `QuestColumn`, `TokenInspection` |
| `board:hero_moved` | 15 | 2 — `QuestManager`, `Board` |
| `board:sprites_changed` | 9 | 1 — `SpriteLayerView` |
| `board:adjacency_dirty` | 8 | 1 — `BoardRunner` (self) |
| `board:token_depleted` | 5 | 2 — `triggerRegistry`, `Board`. ⚠️ payload drift, CR2-064 |
| `board:sprite_collected` | 4 | 3 — `QuestManager`, `ParticleOverlay`, `QuestColumn` |
| `board:cycle_complete` | 2 | 5 — `triggerRegistry`, `StatusEffectSystem`, `QuestManager`, `Board`, `TileProgressBar`, `QuestColumn` |
| `board:combat_resolved` | 2 | 1 — `triggerRegistry` only (no UI reacts to a win or a loss) |
| `board:progress` | 2 | 2 — `BoardTile`, `TileProgressBar` (both ref-based) |
| `board:alert_changed` | 2 | 2 — `Board`, `TileProgressBar`. ⚠️ see CR2-059, CR2-060 |
| `board:tile_pushed` | 1 | 1 — `BoardTile` |

Non-`board:` events also published from this territory: `state_changed`,
`token_placed`, `hero_deployed`, `heroes_updated`, `token_bank_updated`,
`vault_deposited`, `vault_withdrawn`, `map_purchased`, `map_opened`,
`map_burst`, `discovery_unmasked`.

#### Events subscribed by this territory

`game_loaded` (→ `TileModifiers.rebuildAll`, `BoardCombat.clearAll`),
`board:adjacency_dirty`, `inventory_overflow` (→ `SpriteLayer`, the D-138
guarantee), plus every `TRIGGER_EVENTS` entry via `TriggerSystem.init`
(`board:cycle_complete`, `board:token_depleted`, `board:combat_resolved`,
`inventory_updated`).

#### `boardEvents.js` — contract audit result

**The registry is in better shape than feared: all 11 declared events have both
a publisher and at least one consumer, and none is orphaned in either
direction.** Three problems, in descending order:

1. **`BOARD_EVENTS.TRAY_CHANGED` does not exist** but `Tray.jsx:60` subscribes
   to it — so the Tray subscribes to `undefined`. There is **no tray event at
   all** in the registry despite the Tray being mutated by ~10 engine paths.
   CR2-055.
2. **`board:token_depleted` carries `typeId: null` on two of its five
   publishers** (the adjacent-support wear path), contradicting its own
   documented payload and defeating any trigger that filters on type. CR2-064.
3. **Three payloads are richer than documented** — `board:progress` also carries
   `elapsedMs`/`cycleTimeMs` (production) or `combat`/`enemyHp`/`enemyMaxHp`
   (combat); `board:sprite_collected` also carries
   `destination`/`trayX`/`trayY`/`instanceId`; `board:tile_pushed` is accurate.
   Documentation drift only, no behaviour at risk — recorded here rather than
   ticketed.

Also stale: the file's header says "**the publishers land later** — the board
runner in Phase 4, combat in Phase 6". Both landed; the note now describes a
state that has not been true for months.

#### Layer check

**One violation, already filed as CR2-051 and confirmed:** `BoardState.js:4`,
`Placement.js:6`, `SpriteLayer.js:8` and `adjacency.js:3` all import geometry
from `src/ui/components/board/boardConstants.js`. That is **four** engine files
depending on the UI tree, not the one Session 1 saw. Otherwise the territory is
clean of React — no JSX, no hooks, no component imports.

#### Tick path — who runs what

`GameLoop` → `board_runner` handler → `BoardRunner.tick(delta)`:
1. `Managers.tick()` (unconditional, throttled 1-in-5)
2. `BoardState.occupiedTiles()` — **rebuilds and sorts an array every tick**
3. per tile: `BlockUpkeep.tickUpkeep` (CR2-061) → `TriggerSystem.tickCooldowns`
   → enemy branch to `BoardCombat.tickTile`, or the production guards
   (`heroRequirementAlert` → `RecipeResolver.effectiveIO` →
   `InputAllocator.checkInputs`) → `completeCycle`

`SpriteLayer.tick` is a **separate** handler, not called from here — the fact
that decided the CR2-007 ruling.

#### Notes on already-filed tickets in this territory

- **CR2-033 (Vault deposit rule)** — fix confirmed in place at
  `TokenBank.js:145`, published after both refusal checks. Correct. Not moot.
- **CR2-051 (engine imports UI)** — confirmed, and **wider than filed**: four
  files, not one. Updated in that ticket.
- **CR2-011 (silent loot failure)** — the board half is unchanged and Session 3
  still owns it, but note `SpriteLayer.addSprite` accepts any `itemId` without
  checking it resolves, so the board is the layer that turns a bad drop id into
  a silent no-op. Folded into CR2-063.
- **CR2-044 (opening tray ids don't exist)** — confirmed still live; all four
  ids present in every save slot. Not re-filed.
- **CR2-050 (sprite pixel coordinates)** — confirmed from `SpriteLayer.js:101`;
  `board.maps` has the **same** problem (`addBoardMap` rounds to pixels), which
  that ticket does not mention. Noted there.
- **CR2-036 (lint residue)** — **0 of the 32 remaining lint problems fall in
  `src/systems/board/`.** This territory is lint-clean; the two board-adjacent
  entries are `BoardTile.jsx` (Session 7) and `BoardCombat.test.js`.
- **CR2-042 (schema drift)** — three more undeclared fields found, CR2-069.

### Session 3 — Combat, heroes, skills & promotion

**Territory:** `systems/combat/` (6), `systems/effects/` (5), `systems/hero/` +
`logic/` (11), `systems/equipment/` (2), `config/FormulaRegistry.js`,
`utils/CombatFormulas.js`, `RetirementFormula.js`, `XPCurve.js` — 28 files,
4,592 lines. All read in full.

#### State ownership

| Path | Owned by | Notes |
|---|---|---|
| `state.heroes[]` (the whole array) | `HeroLifecycle` (push/splice), `HeroLookup` (read) | The only mutable roster |
| `hero.hp`, `hero.energy` | `HeroState.modifyHeroHp/Energy` | Every damage/heal route funnels here. `energy` is dormant (D-183) |
| `hero.status` | `HeroState.setHeroStatus` | `idle` / `working` / `combat` / `wounded`. **No single owner enforces the transitions** — CR2-070 |
| `hero.skills`, `hero.bankedSkills` | `SkillSystem.addXP`, `PromotionSystem.promote` | Promotion is the only thing that changes the *shape* |
| `hero.jobId` | `PromotionSystem.promote` | |
| `hero.statuses[]` | `StatusEffectSystem` | Persisted with the save |
| `hero.equipment[9]` | `EquipmentManager` | Re-packed on load — CR2-040 |
| `hero.aggregator` | `HeroRehydration`, `EquipmentManager` | **Runtime-only, rebuilt on load.** Serialized anyway as an empty husk — CR2-023 |
| `hero.level`, `hero.hp.max` | `HeroRehydration.updateHeroSkillModifiers` | Derived; recomputed on load and every level-up |
| `hero.woundedRemainingMs` | `WoundedSystem.processWoundedTick` | Set lazily, never by `woundHero` — CR2-083 |
| `hero.assignedCardId` | nothing (dead) | Still written on creation and saved — CR2-083 |
| `currency.influence` | `HeroLifecycle.retireHero` → `CurrencyManager` | |
| **`fights` Map** (`fight_${tile}`) | `BoardCombat` | **Runtime-only, never saved.** The combat processors mutate it in place |

**Not owned here but written by us:** `board.heroTiles` (via
`BoardCombat.resolveDefeat`) — and **not** cleared on retirement, CR2-071.

#### Events published by this territory

| Event | Publisher | Live subscribers |
|---|---|---|
| `heroes_updated` | ~14 sites across the territory | UI hooks. Published unconditionally by the status tick — CR2-028 |
| `hero_leveled` | `SkillSystem.addXP` | `AudioSystem`, `NotificationSubscriptions` |
| `hero_recruited` | `HeroLifecycle.createHero/addHero` | `QuestManager`, `NotificationSubscriptions` |
| `hero_retired` | `HeroLifecycle.retireHero` | 1 — `NotificationSubscriptions` only |
| `hero_promoted` | `PromotionSystem.promote` | **0** |
| `hero_equipment_changed` | `EquipmentManager` equip/unequip | UI |
| `hero_consumed` | `ConsumptionSystem` | **0** |
| `combat_victory` | `CombatResolutionProcessor.handleVictory` | `LootSystem`, `AudioSystem`, `DiscoveryManager`, `QuestManager` |
| `combat_hero_attack` / `combat_enemy_attack` | `CombatAttackProcessor` | `AudioSystem`. Payload key is still `cardId` — CR2-016 |
| `combat_hero_ate`, `combat_enemy_trait_trigger` | `CombatAttackProcessor` | **0** |
| `loot_generated` | `LootSystem` | UI |
| `status_applied` / `status_dot_tick` / `status_purged` / `status_blocked` | `StatusEffectSystem` | **0 for all four** |
| `hero_wounded` / `hero_recovered` | `WoundedSystem` | **0**, and `hero_wounded` is never published at all — CR2-083 |

#### Events subscribed by this territory

Exactly two: `combat_victory` (`LootSystem.init`) and
`BOARD_EVENTS.CYCLE_COMPLETE` (`StatusEffectSystem.init` →
`notifySlotResolved`). **This territory is almost entirely call-driven, not
event-driven** — which is why a deleted caller (`LoopRunner`) silently removed a
whole behaviour rather than leaving a dangling subscription somebody would
notice. That is the structural root of CR2-070.

#### Who calls into this territory

- `GameLoop` → 3 tick handlers registered by `EngineBootstrap`:
  `RegenSystem.tick`, `StatusEffectSystem.tick`, `WoundedSystem.tick`.
- `BoardRunner.tick` → `BoardCombat.tickTile` → `CombatProcessor.processCombat`
  → `CombatAttackProcessor` → `CombatResolutionProcessor.handleVictory`
  → `combat_victory` → `LootSystem` → `SpriteLayer.addSprite`.
  **That chain is the whole live combat loop.**
- `GameState._rehydrateAll` → `HeroManager.rehydrateHero` (the lazy import).
- UI: `JobChangeModal` → `PromotionSystem.previewPromotion`/`promote`;
  `HeroEditModal` → `RetirementFormula`; `HeroInspectionSheet`/`TestDashboard` →
  `XPCurve`. **No UI file imports `CombatFormulas`** — CR2-078.

#### Cross-system contract mismatches found

1. **`EFFECT_TYPES.XP_GAIN` does not exist** — `SkillSystem.js:101`. CR2-073.
2. **Modifier target categories are compared case-sensitively**, and hero skill
   modifiers are registered uppercase while every consumer would ask lowercase.
   CR2-072.
3. **`combat.stats` is a channel with a reader and no writer.** CR2-075.
4. **Nine gear modifier types written and never read; three read and never
   written.** CR2-074.
5. **`LootSystem.handleTaskReward` is the sole consumer of two live features and
   has no callers** — the Cookout yield buff and `EffectAxes`. CR2-076.
6. **The fight object's shape and `handleVictory`'s expectations disagree** —
   four branches read fields `createFight` never sets. CR2-077.

#### Layer check

**Clean.** No JSX, no hooks, no React imports, no `src/ui/` imports anywhere in
the 28 files. Nothing in the territory enforces a game rule from a component.
The only outward dependency is `HeroRehydration` → `state/GameState.js`, which
is the correct direction (engine reading data).

#### Position on the 16-module lazy-import cluster

**Agree with Session 1: leave `GameState`'s two lazy imports alone.** Verified
from the cluster end rather than inheriting the conclusion. `npm run cycles`
re-run: **0 dangerous cycles**, one 16-module group, and the *only* inverted edge
in it is `GameState.js` =(dynamic)=> `EquipmentManager`/`HeroManager`. Every
other edge among the 16 runs the correct way (engine → data). The group is not a
knot; it is simply "everything transitively reachable from those two lines", and
each member is independently readable and testable — 11 of the 16 have their own
test suite.

**But the cluster end does have one piece of evidence Session 1 could not see,
and objective 6 asks for exactly this.** `HeroRehydration.js:103-108` carries a
hand-rolled duplicate of `HeroLookup.getHero`:

```js
/** Internal: Lookup helper that doesn't cause circular dependency with HeroLookup.js */
function lookupHeroById(heroId) { return GameState.heroes.find(h => h.id === heroId) || null; }
```

`HeroLookup.getHero` imports `rehydrateHero` (as a failsafe), so
`HeroRehydration` cannot import back. The acyclic result the tool reports is
partly *bought* by that duplicate. That is a real, if small, cost: two lookup
functions, one of which skips the aggregator failsafe the other provides.

**Recommendation, in priority order:**
- **Do not** restructure `GameState._rehydrateAll`. Nothing is broken, the lazy
  import correctly breaks load order, and the refactor Session 1 sketched
  (move it into `EngineBootstrap`) is a convenience, not a fix.
- **Do** fix the cheap local one: move the aggregator failsafe out of
  `HeroLookup.getHero` (it fires on a condition that should not occur, and it
  puts a rehydration import on the hottest lookup in the game), which lets
  `HeroRehydration` import `HeroLookup` normally and deletes the duplicate.
  Effort **S**. Not filed as a ticket on its own — it belongs to whoever picks
  up CR2-040, which is in the same file.

### Session 4 — Gameplay services & shared utilities

**Territory:** `systems/economy/` (4), `systems/inventory/` (4),
`systems/quests/` (2), `systems/progression/` (3), `src/utils/` (7 minus the
three Session 3 owns), `config/guildUpgrades.js`, `config/constants.js` —
23 files, ~3,050 lines. All read in full.

#### State ownership

| Path | Owned by | Notes |
|---|---|---|
| `currency.gold` | `CurrencyManager` | Every spend/earn funnels through `spendCurrency`/`addCurrency` |
| `currency.influence` | `CurrencyManager` | **Earned only, never spent** — CR2-093 |
| `currency.totalRecruits` | **nobody** | Declared in schema, read by `RecruitCostCalculator`, written by nothing — CR2-086 |
| `progress.completedProjects` | **nobody** | Same; Projects retired — CR2-086 |
| `inventory.items` `{itemId: {quantity, dur}}` | `InventoryStore` (shape) / `InventoryManager` (rules) | `dur` is written and displayed but never decremented — CR2-096 |
| `inventory.groupOrder`, `groupDefs`, `itemOverrides` | `InventoryManager` (mutations) / `GuildUpgradeManager._ensureBankTabs` (padding) | **Two writers, and they conflict** — CR2-089 |
| `inventory.maxTabs`, `maxSlots` | `GuildUpgradeManager.recompute` | Defaults also set in `InventoryStore.init` |
| `quests.active`, `completedTutorials`, `tutorialStep` | `QuestManager` | Created by `QuestManager.ensureState` *and* `GameState._rehydrateAll` |
| `progress.rosterLimit` | `GuildUpgradeManager.recompute` | |
| `progress.guildUpgrades` `{upgradeId: rank}` | `GuildUpgradeManager` | The only persisted upgrade state; every stat is re-derived |
| `board.tokenBankSlots`, `board.tokenTabsUnlocked` | `GuildUpgradeManager.recompute` | Shape owned by Session 2 |
| `collection.discoveredItems`, `itemLifetimeCounts`, `provenance` | `RegistryManager.recordItemGain` | Last two reach a hook and stop — CR2-098 |
| `collection.enemyKillCounts` | **nobody** | Its only writer has no callers — CR2-087 |
| `collection.unlockedAreaSets` | `ProgressionSystem` (dead) | Read by nothing — CR2-091 |
| `ui.newDiscoveries` | `RegistryManager` | Never read, never cleared — CR2-098 |
| **`ItemRateTracker.history`** (module-level Map) | `ItemRateTracker` | Runtime-only, never saved. Wall-clock timestamps — CR2-095 |
| **`RegistryManager._history`** (module-level array) | `RegistryManager` | Runtime-only. Zero callers — CR2-098 |

#### Events published by this territory

| Event | Publisher | Live subscribers |
|---|---|---|
| `inventory_updated` | `InventoryManager` ×8, `GuildUpgradeManager.recompute` | Many — UI hooks, `QuestManager.syncInventoryQuests`, `NotificationSubscriptions`, `TriggerSystem` (CR2-057) |
| `state_changed` | ~12 sites across the territory | Every UI hook |
| `currency_changed` | `CurrencyManager` ×2 | `NotificationSubscriptions`, `BankTab`, `CartographerTab`, `BubbleMenu`, `GuildUpgradeInspection` |
| `inventory_overflow` | `InventoryManager` ×4 | `SpriteLayer` (the D-138 guarantee) |
| `quests_updated` | `QuestManager` ×6 | UI |
| `registry_updated` | `RegistryManager` ×2 | UI |
| `item_discovered` | `RegistryManager` | `useDiscovery` |
| `guild_upgrades_updated` | `GuildUpgradeManager.purchase` | `GuildHallBoard`, `GuildUpgradeInspection` |
| `token_bank_updated`, `heroes_updated`, `hero_recruited` | `GuildUpgradeManager.recompute` / `.purchase` | Session 2/3 territory |
| `map_tossed` | `QuestManager.claimQuest` | `ParticleOverlay` |
| **`influence_changed`** | `CurrencyManager` ×2 | **0** — CR2-092 |
| **`item_sold`** | `CommerceSystem` | **0** — CR2-092 |
| **`transaction_applied`** | `TransactionProcessor` | **0** — CR2-092 |
| **`inventory_slots_full` / `inventory_stack_full`** | `InventoryManager` | **0** — CR2-092 |
| **`inventory_durability_updated`** | `InventoryManager` | **0** — CR2-092 (publisher itself has no callers, CR2-096) |
| **`discovery_seen`** | `RegistryManager.markAsSeen` | **0** — and the publisher has no callers |
| **`collection_updated`** | `GuildUpgradeManager.recompute` | **0** |
| **`area_unlocked`** | `ProgressionSystem` | **0** — publisher has no callers either |
| **`map_reward_spawned`** | `QuestManager.claimQuest` | **0** — sits next to `map_tossed`, which is heard |

#### Events subscribed by this territory

All twenty of them belong to `QuestManager` (plus `GuildUpgradeManager`'s single
`game_loaded`). **Five listen for events nothing publishes** — `context_connected`,
`board_recall`, `return_to_tray`, `recipe_satisfied`, `hero_equipped` (CR2-088).
**Four pairs of them double-count**, because each pair reports one player action
twice: `map_burst`+`map_opened` (CR2-052), `token_placed`+`TILE_CHANGED` for both
`token_placed` and `context_token_placed` (CR2-053, CR2-085),
`hero_deployed`+`HERO_MOVED` (CR2-085).

**One subscription crosses the layer boundary the wrong way**: `ui_modal:opened`
is published only by the React hook `useUIModals`, and three tutorial quests
depend on it (CR2-094) — the CR2-033 shape, currently benign.

#### Who calls into this territory

- `EngineBootstrap` registers `quest_manager` as a tick handler and exposes
  `InventoryManager`, `InventoryGroupManager`, `ProgressionSystem`,
  `GuildUpgradeManager` and the rest on the engine object. **Two of those are
  entirely dead** (`InventoryGroupManager` CR2-090, `ProgressionSystem` CR2-091),
  and being on the engine object is what disguises that.
- `BoardRunner` → `CurrencyManager.addCurrency` (Market outputs);
  `TokenBank` → `addCurrency` (Token sales); `Cartographer` → `spendGold`;
  `PromotionSystem` → `spendGold`; `GuildUpgradeManager` → `spendGold`.
  **Gold has five spend/earn routes and they all funnel correctly through
  `CurrencyManager`** — this is the healthiest contract in the territory.
- `LootSystem` and `CombatResolutionProcessor` → `TransactionProcessor.apply`
  → `InventoryManager.addItem` → `RegistryManager.recordItemGain`. That chain is
  the hot path; `SpriteLayer.addSprite` is the *other* half of it and records the
  rate (see the asymmetry note below).
- `BankTab.jsx` → `CommerceSystem.sellItem` and `getItemPrice` (the only consumer
  of `CommerceSystem` in the game), and → `InventoryManager.moveItemToGroup` /
  `setGroupOrder` (the only two group methods with a caller).

#### Cross-system contract mismatches found

1. **Bounty enemy ids are from a different id space than combat's** — `goblin`
   vs `enemy_skeleton_warrior`. Hunt quests can never progress. CR2-084.
2. **Quest progress double-counts on all four dual-source counters.** CR2-085
   (with CR2-052/053).
3. **`totalRecruits` and `completedProjects` are read but never written**, so the
   recruit cost — and the retirement gate that depends on it — is frozen. CR2-086.
4. **Two implementations of enemy discovery**, and the live one does not count
   kills, so `enemyKillCounts` is read but never written. CR2-087.
5. **Two writers of `inventory.groupOrder` that disagree**, making `createGroup`
   unreachable. CR2-089.
6. **Item gains and losses are recorded in different places** —
   `ItemRateTracker.recordGain` is called from `SpriteLayer.addSprite` (board,
   production time) while `recordLoss` is called from an `inventory_updated`
   subscription in `NotificationSubscriptions`. The comment explains the choice,
   but the consequence is that items granted straight to the Bank by
   `TransactionProcessor` (task rewards) never count as a gain while their removal
   does, so a displayed rate can drift negative. Noted here rather than ticketed;
   the clock defect in the same file is CR2-095.
7. **Two implementations of the recruit-cost number** (`RecruitCostCalculator`
   and `FormulaRegistry.recruitCost`), neither of which the other knows about, and
   a third disagreeing figure inside `getRecruitCostBreakdown`. CR2-086.
8. **Board geometry is defined twice** — `guildUpgrades.js` vs
   `boardConstants.js`. CR2-104.

#### Layer check

**Clean in one direction, with one inbound exception.** No JSX, no hooks and no
`src/ui/` imports anywhere in the 23 files — the engine never reaches into React.
The exception runs the other way: `QuestManager` subscribes to `ui_modal:opened`,
an event only a React hook publishes, and three tutorial quests depend on it
(CR2-094). `AssetManager.js` is a borderline case — it lives in `src/utils/` and
is engine-agnostic, but `renderIcon` (dead, CR2-103) returns raw HTML strings,
which is presentation logic in a shared utility.

#### Performance notes (standing objective)

- `InventoryManager.addItem` publishes **two** events per call (`inventory_updated`
  + `state_changed`) and calls `RegistryManager.recordItemGain`, which publishes
  **two more**. That is the four-per-item that produced Session 2's measured
  320-event tick (CR2-056) — the root of that number is here, and the CR2-007
  ruling (batch at `GameLoop`) is the right fix rather than anything local.
- `QuestManager.syncInventoryQuests` runs on **every** `inventory_updated`, walking
  the active quest list — 40 times in the sweep Session 2 measured. Cheap (≤3
  quests) but it multiplies the same event.
- `logger.debug` on the hot path with the logger permanently at `debug` in dev —
  CR2-105.
- `resolveSpritePath` allocates two lookup objects per call, on a per-sprite
  render path — CR2-103.
- `InventoryFormatter`'s reference-stability cache is well built and genuinely
  earns its keep; nothing to change there beyond CR2-107's one-liner.

### Session 5 — Content pipeline & CMS boundary
*(pending)*

### Session 6 — UI ↔ engine boundary
*(pending)*

### Session 7 — UI components
*(pending)*

---

## Owner decisions — 2026-08-19

Recorded so no session or fix wave reopens them. Each names the tickets it settles.

**1. Content-integrity audit: WARN ONLY (CR2-108).** A boot-time pass logs every
reference that does not resolve. It changes nothing about how the game runs. This
is the systemic fix for CR2-011, CR2-044, CR2-063, CR2-084 and CR2-120 — five
separate systems failing the same silent way.

**2. Combat is PARKED (CR2-110).** No authored Token is typed `enemy` because
combat returns when the owner authors enemy Tokens. **This re-grades a family of
tickets**: CR2-011 (undroppable loot), the drop-table gaps, CR2-016 (combat
audio) and the combat-path findings in Session 3 are **"ready for content", not
"broken now"** — correct code the player cannot currently reach. Do not treat
them as urgent; do fix them before enemies are authored, since they are cheaper
now than as live bugs.

**3. The Time Bank stays OFF (CR2-141).** Parked deliberately. ⚠ Two tickets
reason as though fast-forward is reachable — CR2-095 (the abandon cooldown on the
wall clock) and CR2-036's `ItemRateTracker` item — and their premise is currently
false. Re-check them if the Bank returns.

**4. Sleeping-machine time: BANK IT (CR2-041).** Route the excess into the Time
Bank rather than discarding it, so the behaviour is correct for when the Bank
returns. Accepted consequence: no visible benefit until then.

**5. Skill speed: WIRE IT UP (CR2-072).** Skills should make a hero faster. Two
breaks to fix: no consumer exists, and the producer files it under an upper-cased
key (`MINING`) no reader could match. Note this only becomes *visible* once
Tokens award XP (CR2-109), since nothing currently levels.

**6. Retirement and recruit-purchasing are RETIRED MECHANICS (CR2-086).**
Owner: *"When the roster size is increased, a new recruit is automatically
added."* `GuildUpgradeManager` already does exactly that — verified. So:
- **Delete** `RecruitCostCalculator.js`, `RetirementFormula.js`, `retireHero` in
  `HeroManager`/`HeroLifecycle`, the retire control in `HeroEditModal`, and the
  covering tests.
- ⚠ **CR2-071 becomes MOOT** — "retiring a hero leaves a stale board occupancy
  record" cannot happen if retirement does not exist. Confirm, then close it.
- The three disagreeing recruit-cost functions go with it.

**7. Cut: Influence (CR2-093) and item durability (CR2-096).** Both are earned or
stored, saved, and do nothing. Remove the systems and their saved fields **only
where that does not change the save shape** — follow the precedent set for
`classId`/`traitId`, which stayed as inert fields precisely to keep saves loading.
Durability also removes the retired durability call combat makes on every attack.

**8. KEEP consumable slots (CR2-079)** — not cut. They currently only *cost* the
player (defeat destroys a quarter of the stock) and never fire, so this becomes a
**fix**, not a deletion: either make them fire or stop defeat charging for them.

**9. Restore three built-but-unreachable features:** the pinned hero card
(CR2-154 — one rename; the skills grid, equip drop zone and 22 tests are already
written), the loot-table screen (CR2-132 — nothing else shows a drop table), and
`ToastContainer`'s collapse (CR2-035). **Not restored: the Bank's pre-filtered
open (CR2-161)** — retire that machinery instead.

---

## Owner decision — audio is deferred (2026-08-19)

**Audio is not a concern for this review. It gets wired in later in development.**

This **de-prioritises a family**, not one ticket: CR2-016 (combat audio, already
fixed), CR2-021 (the SFX pool cutting off 17 of 20 rapid sounds), CR2-180 (max
volume is really 20%), the audio entries inside CR2-131 (Settings), and the
"confirm combat audio by ear" check Session 8 left for the owner. **Re-grade all
of them to P3 and do not schedule them into a fix wave** — they are correct
findings about a subsystem that is not being built yet.

⚠ Keep the findings; only the priority changes. When audio is picked up, CR2-021
is the one to read first — a single bulk level-up produced 1,388 sound requests,
most aborted, so the pool design needs revisiting before more sounds are added.

---

## Owner decisions — 2026-08-19 (second batch)

**10. Content-pipeline cleanup: DELETE ALL THREE.**
- **`scripts/regenerate_game_package.js`** — the dangerous one. It reads a
  hardcoded CMS backup and writes card-era shapes over `items.json` and
  `enemies.json`, recreating `data/quests.json` and three card directories. Its
  removal is what finally closes the "Sync to Game destroys unmodelled content"
  hazard; until then the hazard is only half closed (CR2-113).
- **`data/schemas/` and `data/templates/`** (6 files) — all describe the retired
  card system, referenced by nothing.
- **`data/archive/cards/`** — plus the two dead loaders pointing into it.

**11. Poison death costs equipment, like combat death (CR2-070).** One rule for
dying however it happens, so it cannot be dodged by dying to a damage-over-time
effect. Applies once the zero-health bug itself is fixed.

**12. Token sell value stays PROPORTIONAL; the comment is wrong (CR2-066).**
Change the prose, not the behaviour. This closes the exploit the comment itself
apologises for. Fifth comment found contradicting its own code.

**13. The quest double-counting is LOW PRIORITY — downgrade it (CR2-052,
CR2-053, CR2-085).** Owner, 2026-08-19: *"It's a tutorial meant to be completed
within the first minute of gameplay. It's not like there will be future quests
asking the player to drop X number of Tokens on the mat."*

All four affected counters — Map opened, Token placed, context Token placed,
Hero deployed — belong to **tutorial quests that ask for exactly one**, so the
counter hits its ceiling before the doubling can be seen. There is no plan for
generated quests that count these actions.

So the earlier framing ("a quest asking for 10 will finish at 5") describes a
quest that will not exist. **Re-grade these from P1/P2 to P3**: tidy them when
the surrounding code is touched, not as their own job. The Manager-restock
question this raised is moot for the same reason.

⚠ **This does NOT extend to CR2-084.** The *hunt* bounties are generated, not
tutorial, and they name creatures that do not exist — that one stands as filed.

**14. The four unbuilt Settings controls: KEEP, VISIBLE BUT DISABLED (CR2-131).**
Theme Mode, Zoom to Cursor, Animations and Notification Position get a
"coming soon" state rather than removal — honest about intent, and the roadmap
stays on screen. The other seven unwired controls are still to be **fixed**.

**15. The Codex/Library screen IS planned — keep collecting (CR2-098).**
Discovery data, kill counts and sightings keep accruing.
⚠ **But the kill counter is broken (CR2-087)** — the function that would record
kills has no callers — so the data being banked for that screen is currently
wrong. Fix CR2-087 before the screen is built, or it will launch with empty
counts for everything already killed.

**16. The hero sheet must show banked skills WITH their levels (CR2-165).**
Owner: *"The hero may have levels in a locked skill, those should be shown. Just
because they can't use it now doesn't mean they won't change jobs later and
regain that skill."* So "Locked" is acceptable as a state, but the retained
**level must be visible** — the current sheet shows no banked skills at all,
which is the half that is actually wrong. Aligns with D-250's "banked, not
destroyed".

**17. Save export/import: WAIT for the Tauri desktop wrap (CR2-045).** It gets
real file dialogs rather than a browser download.
⚠ **Accepted risk, recorded deliberately:** until then there is **no way to back
up a save**, and saves live in browser storage a cache clear destroys. Review
sessions twice had autosave overwrite a slot mid-probe; both recovered only from
the rolling backup. If the desktop wrap slips, revisit this.

---

## Findings

*(Tickets are appended below, grouped by session, as sessions run.)*

### Filed by the preliminary cleanup phase (2026-08-18)

These came out of the test triage, before Session 1. They are numbered in the
review's sequence so the fix waves can pick them up normally.

---

### CR2-001 · P2 · S · Cleanup phase · Status: Open
- **Where**: `data/tokens.json` → `token_copper_pickaxe` (and `token_forge_altar`)
- **What**: Authored Tokens carry an empty `theme` (`""`), which is not a value
  the game's vocabulary declares. `ContentRules` catches it as
  `token_copper_pickaxe has unknown theme ""`.
- **Why it matters**: Theme is the only thing that makes a Map's loot pool mean
  anything — the rule these Tokens break is the one stopping a Woodland Map from
  dropping desert content. A blank theme won't match any Map's pool filter, so
  the Token silently can't appear where it should.
- **Suggested fix**: Set a real theme in the CMS, not by hand in `data/` — a
  hand-edit is overwritten by the next Sync to Game. Worth checking whether the
  CMS lets a Token be saved with no theme at all; if so, that's the actual bug
  and this is its symptom.
- **Related**: CR2-005. Found by `ContentRules.test.js` "classifies every Token
  with vocabulary the game declares".

---

### CR2-002 · P2 · S · Cleanup phase · Status: Moot — **Session 5 verdict: false positive, close it.** `public/assets/tokens/Token_pickaxe_copper.png` **does exist** and resolves correctly; all ten authored Tokens resolve to files that exist. The ticket came from `ContentRules.test.js:351`, which builds Token art paths under `public/assets/skills/` — the wrong folder. Fix the test, not the content. See "Session 5 — verdicts on already-filed tickets".
- **Where**: `data/tokens.json` → `token_copper_pickaxe.sprite`
- **What**: Points at `Token_pickaxe_copper.png`, which does not exist on disk.
- **Why it matters**: A Token with no art renders as a fallback wherever it
  appears — tray, board, vault. Visible to the player, and the kind of thing
  that's invisible in review until someone happens to obtain that Token.
- **Suggested fix**: Either the art needs generating, or the reference is a
  naming mismatch — note the id/sprite naming inversion this project has
  elsewhere (`oak_wood` → sprite `wood_oak`), so check the manifest for the
  same file under a transposed name before commissioning art.
- **Related**: CR2-001. Found by `ContentRules.test.js` "⚠️ points every Token
  at art that actually exists".

---

### CR2-003 · P1 · M · Cleanup phase · Status: Open
- **Where**: `src/tests/CMSBalanceEngine.test.js` (3 cases, now `it.skip`) →
  `cms/src/engine/anchorCalculator.js`, `valuePropagator.js`, `balanceRunner.js`
- **What**: Three balance-solver assertions each come out at half their expected
  value — `expected 1 to be close to 2`. The anchor calculator should resolve
  Oakwood Grove as primary anchor and derive Oak Wood at 2.0g; it derives 1.0g.
  The value propagator and the end-to-end runner fail consistently with that.
- **Why it matters**: This is the machinery that computes every price and yield
  in the game. If it's genuinely off by a factor of two, all authored content is
  balanced against wrong numbers, and the symptom is a game that plays badly
  rather than anything that crashes — the slowest possible bug to find.
- **Suggested fix**: **Confirm the cause before assuming a maths bug.** The
  favoured hypothesis is content, not code: the anchor token these tests name
  ("Oakwood Grove") may be the re-authored `token_oak_forest`, in which case the
  solver is anchoring on something absent and this is a stale test. Settle that
  first; only then look at the arithmetic.
- **Confidence**: Cause unproven. Confirmed by checking whether the anchor id
  the test expects still exists in `data/tokens.json`.
- **Related**: Scope note — `cms/src` internals are out of the review's scope,
  so this ticket covers the *boundary* symptom. The solver's own correctness is
  the standing gap in CR2-006.

---

### CR2-004 · P2 · M · Cleanup phase · Status: Open
- **Where**: `src/tests/fixtures/testTokens.js`, `src/config/registries/itemRegistry.js`
- **What**: Fixture insulation is now partial, not complete.
  `registerItems` (added in `8935468`) covers the 10 item ids current content
  doesn't define, but `item_oak_wood`, `item_charcoal` and `item_copper_ore` are
  deliberately left pointing at real content so `Market` and `RosterAndMarkets`
  keep measuring real values.
- **Why it matters**: Those three ids are still a tripwire. Re-authoring or
  renaming any of them breaks engine suites that aren't about them — exactly the
  coupling Phase 10's fixture split exists to prevent, and exactly what just
  cost ~25 test failures.
- **Suggested fix**: Give every fixture its own `fixture_*` item and update the
  assertions that name real ids across the six affected suites. Mechanical but
  wide; wasn't smuggled into the cleanup.
- **Related**: `8935468`.

---

### CR2-005 · P3 · S · Cleanup phase · Status: Open
- **Where**: `src/tests/ContentRules.test.js` (18 cases, now `it.skip`)
- **What**: The content-validation rules are skipped while content is
  mid-re-authoring (live set: 5 items, 10 Tokens). They describe a *complete*
  content set and can't pass against a partial one.
- **Why it matters**: These are the acceptance criteria for "content is finished
  enough to ship". Left skipped indefinitely, the project loses its only
  mechanical check that authored content is well-formed — and skipped tests tend
  to stay skipped.
- **Suggested fix**: Un-skip in step with content authoring rather than in one
  go. Session 9 should check this ticket before signing off on test coverage.
- **Related**: CR2-001, CR2-002 (real defects this suite caught).

---

### CR2-007 · P1 · M · Cleanup phase · Status: Open
- **Where**: `src/systems/core/EventBatch.js`; hook surface in
  `src/systems/core/EventBus.js:19,27`
- **What**: **Event coalescing is no longer wired to anything.** `EventBatch`
  collects events raised during a tick and de-duplicates them before they reach
  the UI. Round 1 verified its two callers — `LoopRunner.tick` and
  `StationManager.tick` — paired begin/flush correctly. Both were deleted by the
  playmat rework, and `BoardRunner` never took up the mechanism. Nothing in
  `src/` now calls `EventBatch.queue`, `begin` or `flush`; `EventBus` still
  carries the batch-capture hook for a batch that is never opened.
- **Why it matters**: This is objective 3's "events are coalesced so the UI
  can't render-storm". Without it, every state change during a tick publishes
  straight through to React. With a 7×7 board of running tiles this is exactly
  the shape that produces render storms — many small publishes per tick, each
  potentially re-rendering subscribers. It may currently be masked by the board
  being sparsely populated during testing.
- **Suggested fix**: **Deliberately not deleted**, though it is technically dead
  code — it is a working, previously-verified solution, and deleting it would
  make whoever fixes the render storm rebuild it. Decide whether `BoardRunner`
  should open a batch per tick the way `LoopRunner` did. Session 2 (board
  engine) and Session 8 (runtime verification) both need this on their list;
  Session 8 should measure render counts per tick before and after wiring it.
- **Confidence**: The wiring gap is confirmed by grep. Whether it currently
  causes a *measurable* problem is not — that needs Session 8's render census.
- **Related**: Round 1 objective 3; CR2-003 is unrelated.

#### ✅ Session 2 ruling (2026-08-18) — measured, not argued

The question put to this session was: *should `BoardRunner` open a batch per tick
the way `LoopRunner` did?*

**Answer: no. `BoardRunner` is the wrong place, and wiring it there would
accomplish almost nothing.** The batch belongs one level up, around
`GameLoop`'s whole frame. Evidence, all measured in the running game by wrapping
`EventBus.publish` with a counter and driving the registered tick handlers
directly:

| What was measured | Events published |
|---|---|
| `BoardRunner.tick()`, 48 tiles occupied, steady state | **0–1 per tick** (`board:progress` only) |
| `BoardRunner.tick()`, one cycle completing | **2** (`board:sprites_changed`, `board:cycle_complete`) |
| `BoardRunner.tick()`, first tick after a load | 48 `board:alert_changed`, all of them no-ops — see CR2-059 |
| **`SpriteLayer.tick()`, stack-cap sweep collecting 40 sprites** | **320 in one tick** |

**`BoardRunner` is not the render-storm risk.** Its steady-state output is one
`board:progress` event per running tile every third tick, and `board:progress`
is explicitly ref-based ("*this bypasses React entirely*", `BoardRunner.js:408`)
and **must not be coalesced** — each carries a distinct `tile`, so a
name-keyed dedupe would collapse 48 tiles' progress into one and freeze 47 bars.
Nothing else on `BoardRunner`'s path is a batchable global broadcast; it does not
publish `state_changed` at all.

**The storm is in `SpriteLayer`, which is a *sibling* tick handler, not a
callee of `BoardRunner`** (`EngineBootstrap.js:178` registers `sprite_layer`
separately from `board_runner`). A batch opened inside `BoardRunner.tick` would
never see it. Of that 320-event tick:

- `state_changed` × **120** (three per collected sprite)
- `inventory_updated` × **40**
- `registry_updated` × 40, `board:sprites_changed` × 40,
  `board:sprite_collected` × 40, `notification_added`/`_updated` × 40

`state_changed` and `inventory_updated` are **both already on `BATCHABLE`**, and
they are the two doing the damage — they are the global "re-read everything"
broadcasts every UI hook subscribes to. Coalescing just those two collapses
**160 events into 2**.

**On the whitelist.** Session 1's note was that two of `BATCHABLE`'s four
entries (`cards_updated`, `heroes_updated`) are dead. That is true and they
should go, but the conclusion "the list needs rewriting rather than inheriting"
turns out to be **half right**: the two *surviving* entries are exactly the two
that matter, so the list is effectively already correct for the board era.
Worth *adding*: `registry_updated` and `board:sprites_changed` (both pure
recalculation broadcasts) would take the tick from 320 to ~122. Must **not** be
added: `board:sprite_collected` (drives one particle per item — dropping
duplicates drops real information, and CR2-036 already records `ParticleOverlay`
ignoring quantity), `notification_added`, and `board:progress`.

**Recommended shape:** open the batch in `GameLoop`'s tick, around the whole
handler list, and flush after the last handler — one call site, catches every
system including ones not yet written. Effort **S**, not M, given the mechanism
already exists and works.

**Still owed to Session 8:** this is an *engine-side event census*, not a render
census. How many React re-renders those 320 events actually cause is not settled
here, and 320 cheap publishes with few subscribers would be a much smaller
problem than 320 with many. Session 8 should count renders before and after.
The concrete defect behind the number is filed separately as **CR2-056**.

#### ✅ Session 8 ruling (2026-08-19) — the render census, measured

**Answer: do not wire `EventBatch`. The render side is already coalesced, one
layer above where the batch would sit, and better placed than the batch is.**

`useGameState.js:97-108` guards every subscription with a `updateQueued` flag and
a `queueMicrotask`. However many events arrive during one synchronous tick, each
hook instance evaluates its selector **once**, and the resulting `setState` bails
out through `fast-deep-equal` when nothing actually changed. It also dedupes
across *different* event names, which a name-keyed batch cannot do.

Measured in the running game, full 49-tile board, 12 heroes working, all panes
closed (49 `BoardTile`s mounted, 619 live subscriptions):

| Scenario | Publishes | DOM mutations after settle | Synchronous cost |
|---|---|---|---|
| One `state_changed` after changing gold | 1 | **1** | 0.10 ms |
| 120 `state_changed` + 40 `inventory_updated` in one tick (Session 2's storm shape), gold changed once | 160 | **1** | 1.3 ms |

**Same single DOM mutation either way.** A separate probe counting
`queueMicrotask` calls during the burst recorded **92**, against the 1,760 that
uncoalesced dispatch would imply — a ~19× reduction that is already happening.

So the storm's entire remaining cost is **~1.2 ms of redundant publish and
subscriber dispatch on the rare tick a sprite sweep lands**, against a steady
tick of **0.159 ms** and a 5 ms budget. That does not justify a mechanism.

**Recommendation: close CR2-007 as "won't fix — superseded by the hook-level
coalescing", and delete `EventBatch.js`** rather than keeping it warm for a
problem that has now been measured and is not there. Spend the effort on
**CR2-056** and on **CR2-168 item 5** (`TokenBank.sell` publishing once per copy)
instead, which are real per-action costs rather than per-tick ones.

**One caveat, recorded honestly:** `board:progress` carries **98 subscribers** on
a full board and fires ~2×/tick, so it accounts for roughly **205 of the 209
subscriber callbacks per tick**. It is deliberately ref-based and bypasses React
(`BoardRunner.js:408`), and it must never be batched — but it means the raw
"callbacks per tick" number looks alarming and is not.

---

### CR2-008 · P2 · M · Cleanup phase · Status: Open
- **Where**: `public/assets/` (11 MB), chiefly `audio/` 5.0 MB,
  `backgrounds/` 2.9 MB, `items/` 1.2 MB, `playmat/` 696 KB
- **What**: The shipped asset payload is **11 MB against a 912 KB JS bundle** —
  assets are more than ten times the code. Nobody has cross-checked them against
  what `sprite-manifest.js` and `AssetPreloader` actually reference since the
  playmat and CMS reworks changed what content exists.
- **Why it matters**: This is the real size lever for a Steam build; the code
  bundle is already small. Round 1 flagged one 3.8 MB BGM file and a set of
  retired-era backgrounds. The backgrounds in particular were authored for the
  old area-banner UI, which no longer exists — but the 7×7 playmat art *is*
  live now, so the round-1 verdict on `playmat/` is inverted and cannot be
  reused. Needs checking, not assuming.
- **Suggested fix**: Build the referenced-asset set from `sprite-manifest.js`,
  `AssetPreloader` and any literal `/assets/...` strings, diff it against the
  files on disk, and report the orphans by directory before deleting anything.
  Art is expensive to regenerate and cheap to keep, so this wants evidence
  rather than a sweep.
- **Deliberately not done in the cleanup**: it needs the manifest cross-check
  above, which is a session's work rather than a mechanical pass.
- **Related**: Session 9 (build & Tauri readiness) owns the bundle audit.

---

### CR2-009 · P3 · S · Cleanup phase · Status: Open
- **Where**: the repo root — 43 `.md` files after the cleanup archived 7
- **What**: The root still mixes live references with documents for finished
  work. The cleanup moved only those with an **explicit successor** (a v1 where
  a v2 exists, a brief where its roadmap exists). Everything else needs an
  owner ruling, because "is this still live?" is not answerable from the files.
- **Why it matters**: The review guide already warns that stale concept docs
  describing retired systems (the linear 12 areas, the hero bench, food/drink
  slots, packs as a shop) must not be treated as truth. The more of them sit
  beside the live roadmaps, the likelier a session reads the wrong one — and
  round 1 filed tickets against exactly that mistake.
- **Suggested fix**: Owner passes over the root list and marks each as live or
  finished. Likely-finished candidates, all pending confirmation: the playmat
  concept set (`playmat_grid_concept`, `playmat_hero_concept`,
  `playmat_skills_concept`, `playmat_ui_concept`, `playmat_gap_analysis`,
  `playmat_refinement_briefs`), the intent notes for shipped features
  (`bank_drawer_intent`, `token_object_intent`, `token_object_brief`,
  `tray_loose_objects_intent`), `status_effects_plan`, `ui_overhaul_spec`,
  and `Fantasy_Guild_Granular_Implementation_Plan`.
  **Do not archive on inference**: `playmat_balance_report_v1.md` holds the
  balance numbers and the solver plans may still be live work
  (`cms_solver_plan_v2`, `solver_levers_brief` — recent commits touch them).
- **Related**: `archive/docs/README.md`; Session 9 owns documentation health.

---

### CR2-010 · P2 · M · Cleanup phase · Status: Open
- **Where**: `cms/src/utils/constants.js`, `cms/src/**` → seven modules under
  the game's `src/`: `registries/modifierPalette.js`, `registries/itemRegistry.js`,
  `registries/skillRegistry.js`, `registries/tokenConstants.js`,
  `registries/triggerRegistry.js`, `registries/equipmentCategories.js`,
  `utils/AssetManager.js`
- **What**: The CMS reaches across the project boundary and imports game source
  directly, by relative path (`../../../src/config/registries/...`). The two
  codebases have separate `package.json` files and separate build pipelines, but
  are silently coupled at the module level.
- **Why it matters**: **Two of those modules have no game-side consumer at all** —
  `modifierPalette` (164 lines) and `tokenConstants` (85 lines) exist *solely*
  to serve the CMS. Nothing in the running game imports them and no game test
  covers them, so every dead-code tool reports them as removable. Delete one and
  the game keeps building, the game's tests stay green, and the CMS breaks — and
  since the CMS has no tests (CR2-006), nothing catches it. This nearly happened
  during the cleanup; the deletion was caught only because three CMS-adjacent
  suites happen to live in the game's test directory.
- **Suggested fix**: Owner decision on the shape. The options are to make the
  shared vocabulary an explicit shared module both sides import deliberately, to
  let the CMS own its own copy, or to leave the coupling and simply **document
  it loudly** at the top of each of the seven files so nobody deletes one. The
  last is cheapest and would have prevented this.
- **Related**: CR2-006 (no CMS tests). Note the round-2 scope decision puts
  `cms/src` internals out of review, but this is a boundary issue and in scope.

---

### CR2-011 · P1 · S · Card retirement · Status: Open
- **Where**: `data/enemies.json` → `enemy_thorn_elemental.drops[0].itemId` =
  `item_blackberry`, which is not in `data/items.json`; drop resolution in
  `systems/combat/LootSystem.js`
- **What**: **A kill can silently yield nothing.** The enemy's only drop entry
  names an item the content set does not contain, so the loot roll succeeds, the
  item lookup returns nothing, and no reward reaches the board. Found while
  verifying the card retirement in the running game: the first fight produced 12
  kills and zero loot.
- **Why it matters**: Player-facing, and silent. Combat *looks* like it worked —
  damage, XP and charges all behave — but the reward never arrives, and nothing
  logs a warning. The automated tests cannot catch it because the engine
  fixtures register the missing ids deliberately (CR2-004), so the suite is green
  precisely where reality is broken.
- **Suggested fix**: Two parts, and the second matters more. Author the missing
  item (or repoint the drop) **and** make an unresolvable drop id loud — a
  warning at minimum, since "content references something that doesn't exist"
  should never fail silently in a game whose content is authored elsewhere.
- **Related**: CR2-004 (fixture insulation is the reason tests miss this),
  CR2-002 (same class of dangling content reference).

---

### CR2-012 · P3 · S · Card retirement · Status: Open — **Session 4 confirmed orphaned; recommends DELETE. See "Session 4 — verdicts on the tickets it was asked to close".**
- **Where**: `src/utils/RegistryUtils.js`
- **What**: Newly dead — the card retirement removed its last caller. It is a
  generic rehydration helper, not card-specific code.
- **Why it matters**: Small, but it is exactly the "orphaned by the last rework"
  residue the review exists to find, and it will now show up on every
  reachability run until someone rules on it.
- **Suggested fix**: Delete, unless it is worth keeping as a utility for future
  rehydration work — the same judgement made for `EventBatch` in CR2-007.

---

### CR2-013 · P3 · S · Card retirement · Status: Open
- **Where**: `src/state/GameState.js` → `rebuildCardCache`, `getCardById`,
  `_cardById`
- **What**: A card lookup cache that nothing populates or reads any more. Dead
  but self-contained — it blocks nothing.
- **Why it matters**: Pure maintainability. It is state-shaped dead code sitting
  in the most load-bearing file in the project, which makes that file harder to
  reason about than it needs to be. Session 1 owns this territory.
- **Suggested fix**: Remove with the rest of the card-era state handling; verify
  no save path touches `_cardById` first.

---

### CR2-014 · P3 · S · Card retirement · Status: Open
- **Where**: `data/enemies.json` → every enemy carries `biomeId`
- **What**: An inert label. `biomeRegistry` was retired by owner decision
  (2026-08-18), so the field now points at a concept with no registry behind it.
- **Why it matters**: Dangling vocabulary in authored content invites someone to
  reimplement the concept later because the data implies it exists — which is
  how `theme` got as far as it did.
- **Suggested fix**: Strip the field from the CMS schema and the data, or keep
  it as documented flavour with a comment saying it drives nothing.
- **Related**: `concept_audit.md`; the decision-log note added in `0795bf7`.

---

### CR2-015 · P2 · M · Card retirement · Status: Moot as written — **Session 4 verdict: supersede with CR2-084.** `QuestBoardSystem` is deleted and the rebuilt procedural pool in `QuestManager` is not inert; the real defect is that half of what it generates cannot be completed (CR2-084). See "Session 4 — verdicts on the tickets it was asked to close".
- **Where**: `src/systems/progression/QuestBoardSystem.js` (procedural pool path)
- **What**: The **procedural** quest pool produces nothing, and did so before the
  card retirement — it drew from the card registry, which had already been
  emptied. Story quests, quest slots, progress tracking and turn-in are all
  unaffected and work.
- **Why it matters**: A whole quest source is silently inert. A player sees
  fewer quests than the system was built to offer, with no indication anything
  is missing.
- **Suggested fix**: **Design decision, not a repair.** Procedural quests need a
  new source now that cards are gone — presumably generated from Tokens, but
  what a Token-derived quest should ask for is the owner's call. The retirement
  left an explanatory note in the code rather than guessing.
- **Related**: Session 4 territory.

---

### CR2-016 [DEFERRED: audio] · P1 · M · Card retirement · Status: Fixed (2026-08-18, c48e2f8 — focus gate removed so combat SFX always play; dead `task_completed` subscription removed. ⚠ Verified by code path, NOT by ear — and `masterVolume` defaults to 0 as a dev mute, so the game stays silent until that slider is raised)
- **Where**: `src/systems/core/AudioSystem.js:41,52-54,126`; publishers in
  `systems/combat/CombatAttackProcessor.js`, `CombatResolutionProcessor.js`;
  `src/ui/components/base/GICard.jsx:59,93`
- **What**: **Combat sound effects almost certainly never play.**
  `playContextualSfx` early-returns unless `this.currentFocusId === cardId`. Those
  two values come from different id spaces that cannot meet:
  `currentFocusId` is only ever set from `audio:focus_changed`, published solely
  by `GICard` with its own DOM id — and **the board does not render `GICard` at
  all**. Meanwhile combat publishes `cardId: card.id` where `card` is the
  ephemeral fight object, so the value is `fight_10`.
  Separately, the `task_completed` subscription on line 54 listens for an event
  **nothing publishes**.
- **Why it matters**: Silent combat is player-facing and the kind of fault that
  reads as "the audio is broken" rather than as a bug with a cause. It is also
  invisible to tests, which do not assert sound.
- **Suggested fix**: Decide what "contextual" audio should key off now the board
  replaced cards — probably the tile, since that is what the player is looking
  at. The focus-gating idea may simply not survive the rework. Remove the
  `task_completed` subscription or reinstate its publisher.
- **Confidence**: Strongly evidenced by the id-space mismatch, **not confirmed at
  runtime** — fight with sound enabled and listen. That is the five-minute check
  that settles it.
- **Related**: CR2-017. Blocks the `cardId` → `anchorId` rename (see below).

#### ✅ Session 8 verification (2026-08-19) — with the volume actually raised

The dev mute was lifted for the test by writing
`fantasy_guild_settings` = `{"audio":{"masterVolume":100,"sfxVolume":100,…}}`
plus the `fantasy_guild_dev_mute_applied` marker (so the one-time migration would
not strip it again) and reloading. **Both keys were deleted afterwards.**
`HTMLAudioElement.prototype.play` was wrapped to record every call.

Publishing `combat_hero_attack`, `combat_enemy_attack`, `combat_victory` and
`hero_leveled` produced **four real `play()` calls**, on four real files
(`metalClick.ogg` ×2, `handleSmallLeather2.ogg`, `handleSmallLeather.ogg`), each
at **volume 0.2**, **none rejected**. The focus gate is gone and the path is
live. **The fix is sound (pun intended); it is still not confirmed by ear** —
this pane has no audio output, so a human still has to listen once.

**Two things the test turned up that were not in the ticket:**

1. **`skill_leveled` has no publisher at all** — `AudioSystem.js:42` subscribes
   to it and nothing in `src/` ever raises it. Filed as **CR2-178**.
2. **Full volume is not full volume.** With master and SFX both at 100 the
   element volume is **0.2**, because `GLOBAL_MIXER_GAIN` is 0.2. Filed as
   **CR2-180** — probably deliberate, but the owner should confirm, because it
   means the in-game slider tops out at a fifth of system volume.

---

### CR2-017 · P2 · S · Card retirement · Status: Fixed (2026-08-18, 52381a0 — owner chose to remove the pipeline; quests stay hardcoded in tutorialQuests.js. See CR2-019 for the CMS remnant)
- **Where**: `src/config/registries/questRegistry.js`, `data/quests.json`,
  `src/systems/quests/QuestManager.js:7`, `src/systems/quests/tutorialQuests.js`
- **What**: **The 15 CMS-authored quests in `data/quests.json` never reach the
  game.** `questRegistry` is their only reader, and after the card retirement it
  has no live importer — only a test. The running quest system takes its
  definitions from `TUTORIAL_QUESTS`, hardcoded in `tutorialQuests.js`.
- **Why it matters**: Content authored in the CMS is silently ignored. Same class
  of failure as CR2-011: the pipeline accepts the content and the game never
  shows it, with nothing reporting a problem. Authoring more quests would change
  nothing until this is wired.
- **Suggested fix**: Either wire `QuestManager` to the registry so authored
  quests load, or accept that quests are hardcoded and remove `data/quests.json`
  and `questRegistry` so the CMS stops offering an editor for content that goes
  nowhere. **Deliberately not deleted during the retirement** — removing it
  would cement the disconnect and delete the only bridge to that content.
- **Related**: CR2-011, CR2-015 (the procedural pool, also inert).

---

### CR2-018 · P3 · S · Card retirement · Status: Fixed (2026-08-18, c12eb69 — owner confirmed exploration retired; GradualInputSystem and systems/exploration/ deleted)
- **Where**: `src/systems/exploration/GradualInputSystem.js` (266 lines) — the
  only file in `systems/exploration/`
- **What**: Orphaned by the work-cycle deletion; no importer in `src/`,
  `cms/src/` or the tests.
- **Why it matters**: It is a whole system directory for a concept —
  "exploration" — that the concept audit never covered. Deleting it silently
  would remove a feature the owner may still want; keeping it leaves a dead
  system in the tree.
- **Suggested fix**: **Owner ruling needed**, as with the `concept_audit.md`
  entries: is exploration a real feature, an abandoned one, or another `theme`?
  Not deleted for that reason.
- **Related**: `concept_audit.md`; CR2-012 (`RegistryUtils`, same situation).

---

### CR2-019 · P2 · S · Card retirement · Status: Open
- **Where**: `cms/src/engine/contentGenerator.js` (~90 lines of quest handling)
- **What**: The CMS has **no quest editor any more** — no screen, no column, no
  quest data in its store. What survives is quest handling inside the AI content
  generator: the prompt still asks the model to invent quests, and the code that
  would save them calls `addQuest` / `updateQuest`, **functions that no longer
  exist in the CMS store**. If the model ever returns a quest, that path throws.
- **Why it matters**: A latent crash in the content tool, and it predates the
  quest-pipeline removal rather than being caused by it. Now that
  `data/quests.json` is gone (CR2-017), any quest the generator produced would
  have nowhere to go regardless.
- **Suggested fix**: Strip the quest branch from the generator and the quest
  instructions from its prompt. **Not a clean removal** — it is entangled with
  encounter handling on at least one line, and `cms/src` has no tests to catch a
  mistake, so this wants a dedicated CMS session rather than a drive-by edit.
- **Related**: CR2-017, CR2-006 (no CMS tests).

---

### CR2-020 · P3 · S · Card retirement · Status: Open
- **Where**: `src/systems/combat/LootSystem.js` → `handleTaskReward`;
  `src/ui/components/base/GICard.jsx:59,93`
- **What**: Two pieces of residue left by the card retirement and the audio fix.
  `handleTaskReward` has no callers at all. `GICard` still publishes
  `audio:focus_changed` on hover, and nothing subscribes to it any more now the
  focus gate is gone — it announces to an empty room.
- **Why it matters**: Harmless today, but both are the kind of thing that reads
  as intentional to the next person and gets preserved. Cheap to clear.
- **Suggested fix**: Delete both, checking `cms/src` and the tests first as ever.
- **Related**: CR2-012, CR2-016.

---

### CR2-021 [DEFERRED: audio] · P3 · S · Card retirement · Status: Open
- **Where**: `src/systems/core/AudioSystem.js` — the SFX clip pool
- **What**: Rapid repeated sounds log `play() interrupted by pause()` errors. The
  pool holds only three copies of each clip, so a fourth overlapping play
  interrupts one already running. **Pre-existing** — the victory sound does it
  too — and it was exaggerated during verification by cramming sixty ticks into
  an instant.
- **Why it matters**: Console noise rather than a player-facing fault at normal
  speed, but combat can plausibly fire several hits close together, and time-bank
  fast-forward compresses everything. Worth confirming at 10× before dismissing.
- **Suggested fix**: Grow the pool, or drop the play silently when every copy is
  busy instead of interrupting one mid-sound.
- **Confidence**: Observed in the console; real-world impact at normal speed
  unmeasured.

#### ✅ Session 8 verification (2026-08-19) — confirmed, and much larger than filed

Measured with the master volume raised and `HTMLAudioElement.play()` wrapped.

- **A 20-hit burst of `combat_hero_attack`: 17 of the 20 `play()` calls were
  rejected** with `AbortError: The play() request was interrupted by a call to
  pause()`. Only the first three — the pool size — survived. So it is not "some
  console noise": at four or more overlapping copies of one clip, **85% of the
  sound is cut off mid-play**, which reads as a machine-gun stutter.
- **A single realistic game action reproduces it at scale.** Granting XP to 12
  heroes across their six skills (one bulk grant, the sort of thing a time-bank
  catch-up produces) fired ~1,368 `hero_leveled` events and therefore
  **1,388 `play()` calls in one burst, the great majority aborted**. Every abort
  also runs `logger.error('AudioSystem', …)`, so the console fills too.
- **The 10× time-bank route was not available** — the Time Bank widget is off by
  owner ruling (CR2-141) — so the burst was produced by the bulk XP grant
  instead, which exercises the same code path harder.

**Upgrade from P3 to P2.** The trigger is not exotic: any moment several tiles
finish at once, or a hero gains several levels, hits it. `playSfx` should drop
the play when every copy in the pool is busy rather than `pause()`-ing one
mid-sound, which is a one-line change and removes both the audio artefact and the
error spam.

---

### CR2-032 · P2 · S · Quest cleanup · Status: Open
- **Where**: `cms/src/components/shared/GenerateModal.jsx`;
  `cms/src/stores/useGlobalStore.js`; `cms/src/components/shared/FileManagerModal.jsx`
- **What**: Three leftovers in the CMS, all **pre-existing** and confirmed present
  before the quest cleanup touched anything:
  1. **Opening the Generate dialog on an empty workspace crashes it.** Reproduced
     against unmodified code.
  2. The global AI prompt still contains a "QUESTS & ZONE UNLOCKS" section, so the
     model may still be asked for quests. Now harmless — they are ignored rather
     than crashing the import — but it wastes prompt budget asking for content
     nothing consumes.
  3. `FileManagerModal` saves `quests: state.quests` into workspace files; that
     field does not exist in the CMS store, so it always writes empty.
- **Why it matters**: (1) is a real crash in the tool you author content with.
  (2) and (3) are cosmetic but are the same "vocabulary outlived its feature"
  pattern that produced `theme`.
- **Suggested fix**: Fix the crash; drop the quest section from the global prompt
  and the dead `quests` field. **`cms/src` has no tests (CR2-006)**, so verify by
  loading the CMS and opening the dialog rather than by any automated check.
- **Related**: CR2-019 (the generator's quest code, removed), CR2-006.

---

### CR2-033 · P1 · S · Tooling baseline · Status: Fixed (2026-08-18, 00e3178 — `vault_deposited` now published by `TokenBank.deposit()` after both refusal checks; manual publish in TokenVaultTab removed. Verified in the running game: an engine deposit moved a live quest counter 0→1. +3 tests)
- **Where**: `src/systems/board/TokenBank.js` → `deposit()`;
  `src/ui/components/drawer/TokenVaultTab.jsx:81`;
  `src/systems/quests/QuestManager.js:211`
- **What**: **Depositing a Token into the Vault only counts for quests if done
  from one particular tab.** The engine's `TokenBank.deposit()` publishes
  `token_bank_updated` but never `vault_deposited`. Only `TokenVaultTab`
  publishes that, by hand, after calling deposit itself — and `QuestManager`
  subscribes to `vault_deposited` to advance quest progress. Every other deposit
  route (the Tray's four call sites, the Board) therefore advances nothing.
- **Why it matters**: Player-facing and maddening in the way only silent rule
  divergence is: a quest that says "deposit a Token" refuses to tick unless the
  player happens to use the right screen, with no feedback explaining why. There
  is nothing wrong with the deposit itself — the Token arrives — so the player
  has no way to work out the rule.
- **Suggested fix**: Publish `vault_deposited` from `TokenBank.deposit()`, where
  every route already funnels through, and delete the manual publish in
  `TokenVaultTab`. That is the general shape here: **a game rule is being
  enforced in React components rather than in the engine.**
- **Related**: Found by the duplication tooling (`npm run duplication`) as a
  three-way clone of the deposit sequence across `Tray.jsx`, `TokenVaultTab.jsx`
  and `BubbleMenu.jsx`; the divergence is what makes it a bug rather than
  untidiness. See `tooling_baseline.md`.

---

### CR2-034 · P1 · S · Tooling baseline · Status: Fixed (2026-08-18, 1ed49ad — hooks lifted above the conditional. Regression proved: reverting the fix makes the new GICard.test.js fail with the real "Rendered more hooks" error)
- **Where**: `src/ui/components/base/GICard.jsx` — two `useTransform` calls
  inside a conditional block
- **What**: React hooks called conditionally. React requires every hook to run in
  the same order on every render; a card whose image appears or disappears
  changes that order.
- **Why it matters**: This is the class of bug that crashes the UI outright
  ("rendered more hooks than during the previous render") rather than degrading.
  It needs the right sequence of states to trigger, which is why it has survived
  — not because it is harmless.
- **Suggested fix**: Lift both `useTransform` calls above the conditional and
  branch on their *result*. Small change, but it is a behaviour fix rather than a
  cleanup, so it wants deliberate verification in the browser.
- **Related**: Found by ESLint (`npm run lint`). One of the 37 remaining problems.

---

### CR2-035 · P3 · S · Tooling baseline · Status: Open
- **Where**: `src/ui/components/base/GISurface.jsx`;
  `src/ui/components/base/ToastContainer.jsx`;
  `src/tests/Risk13Allocation.test.js`
- **What**: Three small loose ends, deliberately left for the review to handle in
  territory order (owner decision, 2026-08-18):
  1. **`GISurface.jsx` is orphaned.** Removing its one unused import left it with
     no importer anywhere — verified across `src/`, `cms/src/` and the tests.
  2. **`ToastContainer` has a fully built notification-collapse feature with no
     way to trigger it** — no button, no shortcut. Either it lost its control in
     a rework or it was never finished. Worth establishing which before deleting,
     since a finished feature missing only its button is cheap to restore.
  3. A lint-suppression comment in `Risk13Allocation.test.js` that no longer
     suppresses anything.
- **Why it matters**: Individually trivial. Together they are the same pattern
  the review keeps meeting — code that survives its purpose and then reads as
  intentional to the next person. (2) is the one with any real content.
- **Suggested fix**: Session 7 (UI components) owns all three.
- **Related**: `tooling_baseline.md`.

---

### CR2-036 · P2 · M · Lint triage · Status: Open
- **Where**: 34 sites across `src/ui/` and `src/systems/`, from `npm run lint`
- **What**: The lint residue, and it is more interesting than "unused code". Three
  patterns, each pointing at a control wired up at one end only:
  - **Accepted then ignored (10)** — `BottomFolderDrawer` takes a card-size
    setting and never passes it on; `GuildUpgradeInspection` takes an `onClose`
    and offers no way to close; `ParticleOverlay` is told how many items were
    collected and ignores it, so collecting 40 looks like collecting 1; `Toast`
    is told `isLoss` **and works it out for itself**, so caller and component can
    disagree.
  - **Computed then dropped (7)** — `ItemIcon` resolves an item's emoji and never
    draws it, so authored icons fall back to a placeholder; **`BoardTile` holds
    `ALERT_HINT`, a full table of player-facing explanations for each red warning
    mark, that nothing reads** — D-114 says hovering a warning should explain it,
    and it doesn't; `BankTab` reads the player's gold and never shows it.
  - **React effect dependencies (7)** — mostly harmless, but `useGameState:126`
    has a dependency list that is not a plain list, so neither React's tooling
    nor a reader can tell what it actually depends on.
  - **One clock question** — `QuestManager.tick()` is handed the elapsed time and
    ignores it in favour of the wall clock, so quest timing runs on a different
    clock from the rest of the engine. That matters under time-bank fast-forward.
  - **Two in tests** — `BoardCombat.test.js` names an enemy it never asserts on;
    `Cartographer.test.js` has a `stockFor` helper that is never called, so a
    test may not be set up as its author intended.
- **Why it matters**: Individually small; collectively this is the review's
  central question in miniature — features half-wired, where the missing half is
  invisible because nothing errors. `ALERT_HINT` and `ItemIcon` are player-facing.
- **Suggested fix**: Distribute by territory across the review sessions rather
  than as one job. Re-run `npm run lint` to regenerate the list.
- **Related**: `tooling_baseline.md`; CR2-035.

---

### CR2-037 · P3 · S · Lint triage · Status: Open
- **Where**: `src/ui/context/EngineContext.jsx` (2 importers) and
  `src/ui/hooks/useEngine.js` (13 importers)
- **What**: **Two functionally identical `useEngine` implementations**, both live.
- **Why it matters**: Exactly the "two plausible answers to the same question"
  pattern that made the quest and card systems hard to read. Nothing is broken;
  a newcomer simply cannot tell which is canonical, and edits may land in the one
  fewer files use.
- **Suggested fix**: Consolidate on the 13-importer version. Session 6 territory.
- **Related**: CR2-035, CR2-038.

---

### CR2-038 · P3 · S · Lint triage · Status: Open
- **Where**: `src/ui/components/base/GICard.jsx`
- **What**: **`GICard` renders nowhere in the game.** Nothing imports it but its
  own tests; the `data-card-id` elements in the live DOM are quest cards from
  `QuestColumn.jsx`. It is a second orphan alongside `GISurface` (CR2-035).
- **Why it matters**: It carried a real crash (CR2-034) that could never fire,
  and the effort of fixing and testing it went into code no player reaches. Worth
  settling before more is spent on it.
- **Suggested fix**: Delete it with its test, or wire it up if it is meant to be
  the card component. **Owner decision** — same call as `GISurface`.
- **Related**: CR2-034, CR2-035.

---

### CR2-039 · P2 · S · Concept removals · Status: Open
- **Where**: `src/config/registries/tokenConstants.js`
- **What**: The file asserts `TOKEN_TYPES` is *"load-bearing at runtime:
  `BoardCombat.js` reads it… and `RecipeResolver.js` reads it too."* **Neither
  file imports it.** Nothing in the running game imports `tokenConstants.js` at
  all — its only consumers are the CMS and one test. The engine compares bare
  strings (`def.tokenType === 'enemy'`) instead of using the constants.
- **Why it matters**: This is the **third** false claim of the same species found
  in this codebase — after `theme` (which reached the decision log as D-139 and
  D-166 despite never being a feature) and rarity ("drop frequency and nothing
  more", corrected 2026-08-18). A doc comment that describes machinery which does
  not exist is worse than no comment: it stops the next reader checking.
  There is also a genuine question underneath: the engine's string comparisons
  are typo-vulnerable in a way importing the constants would prevent.
- **Suggested fix**: Correct the claim. Then decide the real question — should the
  engine import these constants so a mistyped `'enemey'` fails loudly, or are the
  constants CMS-authoring vocabulary that the engine should not depend on? Owner
  confirmed the nine types stay as descriptive labels, so this is about
  enforcement, not existence.
- **Also stale in the same file**: it warns against confusing rarity with
  `CARD_RARITIES` in `cardConstants.js`, **a file deleted with the card system**;
  and its `TOKEN_THEMES` block still describes theme as a live axis.
- **Related**: CR2-001 (`theme`), `concept_audit.md` §C. Session 5 territory.

---

### CR2-006 · P2 · L · Cleanup phase · Status: Open
- **Where**: `cms/src/` (whole app)
- **What**: The CMS has **no tests of its own**. Its only coverage anywhere is
  three suites on the game side, of which the balance-engine one is currently
  skipped (CR2-003).
- **Why it matters**: The 13-module solver engine computes the game's balance
  numbers. An arithmetic error there produces content that looks fine and plays
  badly. Recorded here so the deliberate scope decision (2026-08-18: `cms/src`
  internals out of scope for round 2) doesn't quietly become permanent.
- **Suggested fix**: Owner decision — a dedicated CMS pass after round 2, or
  accept the risk explicitly.
- **Related**: Scope section of `code_review_v2_guide.md`; CR2-003.

---

### Re-filed from round 1 by Prerequisite 4 (2026-08-18)

Each of these was checked against current code before being carried forward.
The round-1 ticket it came from is named in **Related**; that ticket's own
history stays in the archived `archive/docs/code_review_findings.md`.

---

### CR2-022 · P3 · S · Prereq 4 · Status: Open
- **Where**: `src/systems/core/AudioSystem.js:43-44`
- **What**: Two sound subscriptions listen for events nothing publishes any
  more: `skill_leveled` and `invasion_started`. (`hero_leveled` next to them is
  still published by `SkillSystem` and is fine.)
- **Why it matters**: Reads as working audio wiring that is actually inert, so
  the next person debugging "why is there no sound" starts in the wrong place.
- **Suggested fix**: Delete both subscriptions, or publish the events if the
  sounds are wanted.
- **Related**: Round-1 CR-010. Most of that ticket is already gone — its
  missing-clip publishers were deleted with the card era, the `task_completed`
  subscription went with CR2-016, the hover-audio half is CR2-020, and per-area
  BGM is a deferred owner decision, not a defect. This is the remainder.

---

### CR2-023 · P3 · S · Prereq 4 · Status: Open
- **Where**: `src/state/GameState.js:144` (`serialize`),
  `src/systems/hero/logic/HeroRehydration.js:19`
- **What**: Heroes are saved whole. Each one carries a live `aggregator` object
  plus derived fields that are recomputed on load anyway, and `serialize()` no
  longer strips anything — the strip pass that used to run there was removed
  with the card retirement.
- **Why it matters**: Harmless today (rehydration overwrites them) but it makes
  save files bigger and records runtime scratch as if it were saved truth.
- **Suggested fix**: A `HERO_PROPS_TO_STRIP` list applied in `serialize()`.
- **Related**: Round-1 CR-012.

---

### CR2-024 · P3 · S · Prereq 4 · Status: Open
- **Where**: `src/systems/core/TimeManager.js:21/77/148-153`,
  `src/systems/core/GameLoop.js:37`
- **What**: TimeManager keeps its own clock that restarts at zero every boot
  (`GameLoop.start()` calls `TimeManager.init()` with no saved value), and its
  `getGameTime()` and `serialize()` have no callers anywhere. The real clock is
  `state.time.gameTimeMs`, ticked by EngineBootstrap. Separately,
  `state.time.isPaused` is written into every save but never read back.
- **Why it matters**: A second clock that disagrees with the real one is a trap
  for whoever reaches for it next.
- **Suggested fix**: Delete the parallel counter and `serialize()`; decide
  whether pause should survive a reload (probably not — then drop the field).
- **Related**: Round-1 CR-014.

---

### CR2-025 · P3 · S · Prereq 4 · Status: Open
- **Where**: `src/systems/core/EngineBootstrap.js:261-263`
- **What**: Boot writes `GameState.exploration = { count: 0 }` onto the manager
  object rather than into game state, and nothing reads it. Exploration itself
  was retired earlier today.
- **Suggested fix**: Delete the block.
- **Related**: Round-1 CR-015.

---

### CR2-026 · P3 · S · Prereq 4 · Status: Open
- **Where**: `src/systems/core/EngineBootstrap.js:140-191`,
  `src/systems/core/GameLoop.js:90-95`
- **What**: All eight per-frame handlers register at the default priority, so
  the order they run in is decided by the order the registration calls happen to
  appear in, even though `onTick` takes a priority argument and the comments
  claim a specific order matters.
- **Why it matters**: Reordering two lines of boot code silently reorders the
  game loop.
- **Suggested fix**: Pass explicit priorities (10, 20, 30…) so the intent is
  written down in code.
- **Related**: Round-1 CR-016.

---

### CR2-027 · P3 · S · Prereq 4 · Status: Open
- **Where**: `src/systems/combat/CombatProcessor.js:74/92-99`
- **What**: `heroStatsForUi` is built up on every combat tick, for every hero in
  the fight, and never read by anything.
- **Why it matters**: Pure waste on the hottest path in the game.
- **Suggested fix**: Delete it — the UI already gets combat state from the
  combat events.
- **Related**: Round-1 CR-031. The file moved from `systems/cards/logic/` to
  `systems/combat/` in the rework; the dead code came with it.

---

### CR2-028 · P3 · S · Prereq 4 · Status: Open
- **Where**: `src/systems/effects/StatusEffectSystem.js:110`
- **What**: The five-second status tick publishes `heroes_updated` for every
  hero carrying a status, whether or not anything actually changed.
- **Why it matters**: Every one of those makes the UI re-render for nothing.
- **Suggested fix**: Publish only when the tick changed something.
- **Related**: Round-1 CR-034. That ticket's second half (statuses frozen on
  benched heroes) is gone: the bench was retired, and `getAllHeroes` now returns
  every hero.

---

### CR2-029 · P2 · S · Prereq 4 · Status: Open
- **Where**: `src/systems/equipment/EquipmentManager.js:188` (stat names upper-
  cased into modifier types), `:253/262/280/289/298`
- **What**: Seven modifier types are attached to heroes from their gear —
  `SLOW_ENEMY`, `SUNDER`, `EVASION`, `LIGHT`, `HASTE`, `HPBONUS`,
  `TICKSPEEDBONUS` — and nothing anywhere reads them. Re-checked today across
  the whole of `src/`: zero consumers.
- **Why it matters**: Items carrying those effects do nothing. The gear is
  weaker than its own description claims, and there is no guardrail stopping
  more content being authored against effect names that aren't wired up.
- **Suggested fix**: When the gear pass happens, wire or delete each type; in
  the meantime gather every live modifier-type string into one constants file so
  the dead ones are visible.
- **Related**: Round-1 CR-042.

---

### CR2-030 · P3 · S · Prereq 4 · Status: Open
- **Where**: `src/ui/hooks/useDiscovery.js:52-56`
- **What**: The `'card'` branch of `isDiscovered` reads
  `state.library.tasks`, which no longer exists, so it always answers "not
  discovered". Cards themselves were retired today, so the branch may simply be
  deletable.
- **Suggested fix**: Delete the branch, or point it at the collection if
  something still asks the question.
- **Related**: Round-1 CR-047. The other three parts of that ticket are gone —
  the drag-ghost no longer calls the card factory, TestDashboard no longer
  writes retired fields, and `AreaUnlockOverlay` was deleted.

---

### CR2-031 · P3 · S · Prereq 4 · Status: Open
- **Where**: `src/ui/components/base/ToastContainer.jsx:125-142`
- **What**: Some toasts leave their DOM element behind after they disappear,
  stranded at `opacity: 0`. **Re-tested today in a running game**: two bursts of
  ninety notifications left three stranded elements, and the count did not grow
  with the second burst — so it is bounded and much smaller than round 1's
  22–27.
- **Why it matters**: Barely. The elements are invisible and few. Recorded so
  the warning comment in the file has a live ticket behind it.
- **Suggested fix**: Either drop the toast exit animation (removal then becomes
  plain React and is guaranteed correct) or upgrade framer-motion. Owner's call
  — it is an aesthetic trade.
- **Related**: Round-1 CR-050, filed at P2. **Its stated root cause no longer
  applies**: that was orphaned portal content, and the rebuilt UI renders the
  toast column inline with no portal at all (`floating` defaults to false). What
  survives is the AnimatePresence exit behaviour, at much lower severity, so it
  is re-filed at P3.

#### ⛔ Session 8 — attempted and BLOCKED. This one needs the owner's eyes.

Sessions 6 and 7 ran out of budget here; Session 8 reached it and found the check
is **not performable in this harness at all**, for a reason worth writing down so
nobody spends a fourth sitting on it.

A real 1,368-notification burst was produced (bulk XP grant across 12 heroes) and
the toast column was inspected: **16 child elements, 15 of them at
`opacity: 0`.** That looks exactly like the reported symptom — and it is not.
`requestAnimationFrame` never fires in this pane, so framer-motion's *entrance*
animations never complete either; the opacity-0 children are toasts that never
faded **in**, not toasts stranded after fading **out**. The measurement cannot
distinguish the two, so any number taken here would be meaningless.

Polyfilling `requestAnimationFrame` with `setTimeout` (which is what unblocked
the drawers this session — see the System Map) does not rescue it: hidden-tab
timer throttling drags each "frame" out to ~1s, so the animations crawl rather
than run.

**Owner check, five minutes:** open the game, let a few heroes level up several
times in one go (or trigger any ~90-notification burst), wait for the column to
empty, then right-click → Inspect the notification column and count the child
elements left behind. Round 1 saw 22–27; Prereq 4 saw **3, and not growing**. If
it is still ~3 and bounded, this is worth closing as "won't fix".

**Status unchanged: Open, P3, unverified.**

---

## Filed by Session 1 — State core & serialization (2026-08-18)

**Verification note.** Everything in this batch marked *confirmed at runtime* was
reproduced in the running game via `window.Game` / `window.GameState` probes,
including a full save → page reload → load comparison. The owner's three save
slots were captured before testing and restored byte-for-byte afterwards; no
save data was lost.

---

### CR2-040 · P1 · S · Session 1 · Status: Open
- **Where**: `src/systems/hero/logic/HeroRehydration.js:47-53`, reached from
  `src/state/GameState.js:47` on every load
- **What**: **A hero's equipment is silently re-packed to the front of the grid
  every time the game loads.** The rehydration step does
  `existing.filter(Boolean)` and then re-writes the surviving items from index 0,
  so every empty slot between items is squeezed out.
- **Confirmed at runtime**: gear placed in slots 2, 4 and 8 came back in slots
  0, 1 and 2 after a save and page reload. Reproduced directly:
  `[null,null,A,null,B,null,null,null,C]` → `[A,B,C,null,null,null,null,null,null]`.
- **Why it matters**: The Hero Dock gives the player a nine-slot grid to arrange
  their gear in. Whatever arrangement they choose is destroyed on the next load,
  with no message and no way to prevent it — the items are all still there, just
  moved, which is the hardest kind of fault to report as a bug. Per the locked
  Hero Dock decisions (D-7/D-55) slot *position* carries no mechanical meaning,
  so nothing is lost but the player's own layout — which is why this is P1 and
  not P0. It is still a promise the UI makes and the save breaks.
- **Suggested fix**: The collapse is a **legacy migration applied
  unconditionally**. The comment above it says its purpose is to collapse an old
  named-slot *object* into an array — so run the collapse only on the object
  form, and for an array simply pad/truncate to `GRID_SLOT_COUNT` while keeping
  each item at its own index.
- **Why no test caught it**: `src/tests/SaveRoundtrip.test.js` covers
  `serialize` and `migrateState` but never calls `initFromSave` / `rehydrateHero`,
  which is the step that does the damage. A regression test wants a hero with
  gaps in their loadout put through `initFromSave`.
- **Related**: Objective 4. The Retired Tests Ledger has a hero-equipment row —
  worth restoring alongside the fix.

#### ✅ Session 8 re-confirmation (2026-08-19) — via the real player load path

A hero's grid was set to
`[null, null, item_water, null, item_oak_wood, null, null, null, item_copper_ore]`
and the game saved. **The save file on disk preserves the gaps exactly** — so
`serialize()` is innocent, as the ticket says. The page was then reloaded and the
save loaded **through the slot-selection screen's "Load Sync" button**, the way a
player does it. The grid came back as
`[item_water, item_oak_wood, item_copper_ore, null, null, null, null, null, null]`.

**One new detail worth having before the fix:** calling
`SaveManager.loadSlot(2)` directly from the console did **not** re-pack the grid.
Only the boot/slot-selection route does, because that is the route that reaches
`GameState._rehydrateAll` → `HeroRehydration`. Anyone writing the regression test
must drive the boot path (or call `initFromSave`/`rehydrateHero` directly, as the
ticket already recommends) — a test that only calls `loadSlot` will pass while
the bug is still there.

---

### CR2-041 [DECIDED: bank it] · P1 · M · Session 1 · Status: Open
- **Where**: `src/systems/core/TimeManager.js:49`, `src/systems/core/GameLoop.js:68-83`
- **What**: **There is no upper bound on a single tick's elapsed time.**
  `TimeManager.update()` returns `Date.now() - lastTickTime` unclamped, and
  `GameLoop` passes that straight to all eight tick handlers. If the machine
  sleeps, or the tab is suspended, or the browser throttles the timer, the next
  tick arrives carrying the entire gap.
- **Confirmed at runtime**: feeding the registered handlers one 8-hour delta
  added **8 hours to `meta.totalPlaytime` and 8 hours to `time.gameTimeMs` in a
  single tick**, while board production advanced by nothing.
- **Why it matters**: A player who shuts the laptop lid with the game open comes
  back to a save that claims eight more hours of playtime and eight more hours
  of game time, has produced nothing from them, and has banked nothing either —
  the Time Bank only accrues from `savedAt` when a save is *loaded*, so time
  spent asleep with the game open is neither played nor banked. **The player is
  strictly worse off than if they had closed the game**, which inverts the whole
  point of the Time Bank. It also makes `totalPlaytime` — shown on the save-slot
  screen — untrue.
- **Suggested fix**: Clamp the delta in `TimeManager.update()` to a few tick
  intervals (a second or two), and decide what the excess should mean.
  **Owner decision on that second half:**
  - **(A) Discard the excess.** Simplest; the clock stops while the machine
    sleeps and the player loses nothing they would have gained anyway.
  - **(B) Route the excess into the Time Bank**, so a lid-shut is treated the
    same as closing the game. Most consistent with the Time Bank's stated
    contract, and the player keeps the time. Needs the 24h cap applied.
  - **(C) Leave it.** Only defensible if the board is verified to handle an
    arbitrarily large delta correctly, which it currently is not.
  - **Recommendation: (B)**, with (A) as the safe fallback if routing turns out
    to be fiddly. Either is better than today.
- **Confidence**: The unbounded delta and the playtime inflation are confirmed.
  How the *board* behaves on a huge delta is **not** settled here — that is
  Session 2's engine and Session 8's measurement. Flagged for both.
- **Related**: CR2-024 (the parallel `TimeManager` clock), Session 8.

---

### CR2-044 · P1 · S · Session 1 · Status: Open
- **Where**: `src/systems/core/EngineBootstrap.js:47-52` (`OPENING_TRAY`),
  consumed at `:255-259`; `src/systems/board/Placement.js:168`
- **What**: **The four Tokens a brand-new game puts in the player's tray name
  ids that do not exist in the content set.** `OPENING_TRAY` is
  `['token_forest', 'token_trout_stream', 'token_stew_pot', 'token_sawmill']`.
  `data/tokens.json` currently defines ten Tokens and **none of those four is
  among them** (the live ids are `token_oak_forest`, `token_copper_ore_vein`,
  `token_map`, `token_forge`, `token_forge_altar`, `token_copper_ore_minecart`,
  `token_wizard_academy`, `token_charcoal_kiln`, `token_smelter`,
  `token_copper_pickaxe`). Grepped: the four appear nowhere in `data/`.
- **And nothing rejects them.** `Placement.placeToken` validates only
  `instance?.typeId` being truthy, not that the id resolves to a definition.
  **Confirmed at runtime**: a Token with the invented id `token_forest` places on
  a tile successfully, occupies it, and is even priced by the Vault (sell value
  5, while the *real* `token_oak_forest` prices at 0).
- **Why it matters**: Exactly the CR2-011 shape, one layer earlier — the game
  accepts a reference to content that doesn't exist and says nothing. A new
  player's opening board is built out of Tokens with no definition behind them,
  and the carefully-reasoned opening sequence documented at
  `EngineBootstrap.js:200-254` (fish → raw shrimp → Stew Pot → shrimp) cannot
  happen. This is also the single most-read comment block in the file describing
  a chain that no longer exists.
- **Suggested fix**: Two parts, and as with CR2-011 the second matters more.
  Repoint `OPENING_TRAY` at ids that exist (owner/Session 5 call — content is
  mid-re-authoring per CR2-005, so the right four may not be authored yet),
  **and make an unresolvable `typeId` loud** — `placeToken`, `addToTray` and
  `TokenBank.deposit` should all refuse or at minimum warn when
  `getTokenType(typeId)` returns nothing.
- **Why no test caught it**: `ContentRules.test.js` imports `OPENING_TRAY`
  specifically to assert it against the authored Tokens — and all 18 of its cases
  are currently skipped (CR2-005). The one check that exists for this is switched
  off.
- **Related**: CR2-011, CR2-005, CR2-003 (the solver's missing "Oakwood Grove"
  anchor is the same content-rename drift). Session 5 owns the content half.

#### ✅ Session 8 — confirmed, and it is worse than filed. Consider P0.

A genuinely new game was started (empty slot 3) and its opening tray examined.
All four ids are exactly as the ticket says. What the ticket does not say is what
the player sees and what happens when they try to use them:

- **They render as four blank squares.** The four tray cells exist and are
  draggable, but carry **no image at all** — the two real Tokens added alongside
  them for comparison both showed their sprite. There is no name, no icon,
  nothing to identify them.
- **They cannot be placed.** `BoardPlacement.placeToken` returns
  `{ success: false, reason: 'Not a valid Token' }` for every one of them. A real
  drag from the tray to a tile does nothing.
- So on a fresh save **the entire opening tray is inert**, and the tutorial quest
  "PLACE A TOKEN — drag and drop a Token from the tray to the playmat" is
  impossible to complete with what the game hands you.

Note this **contradicts Session 1's runtime note above**, which recorded that
`token_forest` "places on a tile successfully". It does not, today. The likely
explanation is that Session 1 constructed the instance by a different route;
either way the current behaviour is a refusal, and the refusal is silent — no
toast, no console warning, the drag simply ends.

**Together with CR2-153 this is why a fresh save cannot be played at all:** the
player cannot place a Token, and cannot place a hero. Both fixes are small; both
are load-bearing for a first-run experience.

**One mitigation found:** a ghost Token *can* be deposited into the Vault, where
it appears with its **raw id as its display name** (`"token_forest"`) and a sell
value of 5 — so an existing save is not permanently stuck with them, but the
Vault will show the player an internal id. Filed as **CR2-181**.

---

### CR2-042 · P2 · S · Session 1 · Status: Open
- **Where**: `src/state/StateSchema.js:35-174` (`INITIAL_STATE`),
  `src/systems/core/SaveMigration.js:40-45`
- **What**: **The declared schema no longer describes the saves the game
  writes.** At least nine fields are present in real save files and absent from
  `INITIAL_STATE`: `board.sprites`, `board.tokenBankSlots`,
  `board.tokenTabsUnlocked`, `inventory.maxTabs`, `inventory.maxSlots`,
  `progress.guildUpgrades`, `progress.mapDiscoveries`,
  `quests.completedTutorials`, `hero.woundedRemainingMs`. All were added without
  a schema-version bump, so they coexist inside version `0.7.0`.
- **And `migrateState` cannot cover them**: it backfills **top-level keys only**.
  **Confirmed at runtime** — a state whose `board` was deleted entirely came back
  fully populated, but a state whose `board` was `{tiles:{}}` came back still
  `{tiles:{}}`, with every other board field missing.
- **Why it matters**: Today nothing breaks, but only because several separate
  helpers each defensively re-create whatever they need at first use
  (`BoardState.board()`, `SpriteLayer.sprites()`, `InventoryStore`,
  `TimeBankManager.getBankedMs`, `QuestManager`'s `completedTutorials` guard).
  That is five places holding the schema together instead of one, and the next
  field added the same way will be the one nobody remembers to guard. The real
  cost is that `StateSchema.js` reads as the authority on save shape and isn't.
- **Suggested fix**: Bring `INITIAL_STATE` back in line with what is actually
  saved, and make `migrateState` merge one level deeper into each section
  (recursive backfill of missing keys, never overwriting present ones). Then the
  scattered defensive re-creation can be thinned out over time. This does **not**
  require a version bump — it is additive.
- **Related**: CR2-043, CR2-049.

---

### CR2-043 · P2 · S · Session 1 · Status: Open
- **Where**: `src/state/StateSchema.js:179-183` (`REQUIRED_KEYS`), `:235-265`
- **What**: Two problems in the save validator, both pointing the same way — it
  is validating the previous game.
  1. **`REQUIRED_KEYS` does not include `board` or `quests`.** Those are the two
     sections the current game is made of — the 7×7 playmat and the tutorial
     chain. It *does* require `cards`, which now holds a single unused counter.
  2. It still deeply validates **retired card structures**: `collection.playsets`
     must be an object of counts 0–4, and `collection.binders` likewise per area.
     Playsets, binders, areas and cards are all gone; the block is ~30 lines
     enforcing rules about content that cannot exist.
- **Why it matters**: Lower severity than it looks, because `migrateState` runs
  first and backfills a wholly-missing top-level section (verified at runtime),
  so a save with no `board` is repaired rather than rejected. What is actually
  lost is the *tripwire*: a save that is genuinely truncated mid-`board` passes
  validation, gets repaired to an empty board, and the player silently loses
  their playmat instead of being offered the rolling backup. The retired
  validation is dead weight that makes the file read as though cards still exist.
- **Suggested fix**: Add `board` and `quests` to `REQUIRED_KEYS`; delete the
  playsets/binders blocks; consider a shallow shape check on `board` (tiles is
  an object, tray is an array) so a truncated board triggers the backup-recovery
  path that already exists at `SaveManager.js:233`.
- **Related**: CR2-042. The backup-recovery path (CR-054) is good and works —
  this is about making sure it gets a chance to fire.

---

### CR2-045 [DECIDED: wait for Tauri] · P2 · S · Session 1 · Status: Open
- **Where**: `src/systems/core/SaveManager.js:169-201` — `exportSave()` and
  `importSave()`
- **What**: **The player has no way to back up or move a save.** Both functions
  are fully written, validated and commented ("*Until the Tauri wrap gives us
  real files, this is the only way a player can back a save up or move it between
  machines*"), and **neither has a single caller anywhere** — not in `src/`, not
  in `cms/src/`, not in the tests. There is no button, no menu entry, no
  keyboard shortcut.
- **Why it matters**: This is a half-wired feature where the missing half is the
  entire point of the feature. Saves live in `localStorage`, which the player can
  destroy by clearing site data and which does not travel between machines. The
  engine side of the safety net is built and unreachable. It also matters for the
  Steam/Tauri goal: the comment names this as the stopgap until real files exist,
  so shipping without it means shipping with no backup story at all.
- **Suggested fix**: Add Export / Import controls to the save-slot screen
  (Session 6 territory — this ticket is the engine half). Export can hand back the
  JSON string for the player to copy or download; import already validates and
  refuses a malformed or wrong-version file, and returns player-readable errors.
- **Confidence**: The wiring gap is certain (grep). Whether the owner *wants*
  this surfaced now or is content to wait for the Tauri file dialogs is an
  **owner decision** — (A) wire it up now as a stopgap, (B) leave it dormant and
  wire it when Tauri lands, (C) delete it. **Recommendation: (A)** — it is
  already written and tested-by-construction, and localStorage save loss is a
  real risk today.
- **Related**: round-1 CR-054, which built it. Session 9 (Tauri readiness).

---

### CR2-048 · P2 · S · Session 1 · Status: Open
- **Where**: `src/systems/core/AssetPreloader.js:20` — `CRITICAL_RE`
- **What**: **The boot gate waits for the wrong art.** The regex that decides
  which images must finish loading before the game is allowed to show itself is
  `/^assets\/(backgrounds|heroes|icon)\//`. `public/assets/backgrounds/` is
  **2.9 MB** and was authored for the retired area-banner UI. Meanwhile
  `assets/playmat/` (the mat the whole game is played on) and `assets/tokens/`
  (the tray the player touches first) are **not** gated and warm in the
  background.
- **Why it matters**: It is the preload gate doing the exact opposite of its
  stated job — "*the art visible on the first screens*". Boot is delayed by art
  nothing renders, and the art that is rendered first can still pop in. The
  file's own comment already records that "the retired playmat mats left the gate
  with CR-009" — that removal was correct when the playmat did not exist and is
  now backwards.
- **Confirmed at runtime**: console reports `Critical art ready in 206ms
  (89 gated, 394 warming)` — so 89 files are being waited on out of 483. On a
  fast local machine the gate clears in ~200ms and nobody would notice; on a cold
  cache or slower disk it is the difference between a clean first paint and a
  visible pop-in.
- **Suggested fix**: Change `CRITICAL_RE` to
  `/^assets\/(playmat|tokens|heroes|icon)\//` and drop `backgrounds`. Cheap, and
  worth doing alongside CR2-008 (the 11 MB asset audit), which should also
  establish whether `backgrounds/` is referenced by anything at all any more.
- **Related**: CR2-008 (asset payload audit, Session 9), Session 8 (measure
  first paint before/after).

#### ✅ Session 8 — coverage measured against the live manifest

Read `asset-manifest.json` in the running game and applied `CRITICAL_RE` to it:

| | Files |
|---|---|
| Manifest total | **496** |
| Gated by `CRITICAL_RE` | **89** — `backgrounds` 43, `heroes` 44, `icon` 2 |
| **Not** gated | `items` 255, `tokens` **77**, `playmat` **26**, `enemies` 18, `ui` 13, `archive` 9, `skills` 8 |

So the ticket is exactly right: **the two folders the player looks at first —
the mat and the tray Tokens — are 103 files that the boot gate does not wait
for**, while 2.9 MB of `backgrounds/` that it does wait for is referenced by
nothing except the lookup table `src/config/registries/sprite-manifest.js`, whose
background entries are all keyed to retired concepts (`invasion/`, `area/`,
`cards/`, `station/`). Nothing in the game reads them.

**Two extras for the Session 9 asset audit:**

- **A live Token's sprite lives in `public/assets/archive/`** —
  `token_copper_ore_vein` renders `assets/archive/token_ore_copper.png`. A folder
  called "archive" is exactly what an asset cleanup deletes. Worth repointing
  before CR2-008 runs.
- The manifest contains one stray top-level file,
  `assets/enemy_elemental_thorn.png`, sitting outside every folder.

Every image the running game actually rendered (16 distinct sources) **is** in
the manifest, so nothing is un-warmed — the problem is purely which subset the
boot gate blocks on.

---

### CR2-046 · P3 · S · Session 1 · Status: Open
- **Where**: five sites across `src/systems/core/`
- **What**: Wiring connected at one end only. Each is individually trivial;
  together they are this round's primary objective in miniature, all within one
  small territory.
  1. **`DiscoveryManager.js:30`** subscribes to **`card_spawned`**, which
     **nothing publishes** — grepped across `src/` and `cms/src/`. The enemy
     Bestiary still works via the two `combat_*_attack` subscriptions beside it,
     so this branch is simply unreachable. Cards are retired; delete it. Note
     also that the file's own doc comment claims it "listens for item gains" and
     "updates lifetime counts for Items" — **it does neither**; `RegistryManager`
     owns both. The comment is a fourth instance of the false-description pattern
     recorded in CR2-039.
  2. **`EngineBootstrap.js:304`** publishes **`cards_updated`** on every slot
     selection. **Zero subscribers.** Retired with the card system.
  3. **`SaveManager.js:139`** publishes **`game_saved`** with a
     `{slot, timestamp, autoSaveInterval}` payload. **Zero subscribers.** The
     payload's shape strongly implies a "last saved / next autosave" indicator
     that either was removed or was never built — worth an owner glance before
     deleting, since a saved-indicator is a reasonable thing to want.
  4. **`GameLoop.js:42,58`** publish **`game_loop_started`** and
     **`game_loop_stopped`**; **`SaveManager.js:284`** publishes
     **`game_started`**. All three have **zero subscribers**.
  5. **`EventBus.js:74-83,129-143`** carries a complete event-logging facility —
     a ring buffer, `setLogging()`, `getEventLog()` — and **nothing ever calls
     `setLogging`**, so `logEnabled` is permanently false and the log is
     permanently empty. `hasSubscribers()` likewise has no caller. Same for
     `NotificationSystem.getIcon()` and `dismissByAggregationKey()`.
- **Why it matters**: None of it is broken. All of it reads as intentional to the
  next person, which is the cost — three of these five look like live features on
  a first read of the file.
- **Suggested fix**: Delete 1, 2 and 4. Ask the owner about 3 (below). For 5,
  either expose the event log on the dev dashboard (`TestDashboard` is kept
  deliberately per owner ruling Q5, and an event log is exactly what it is for)
  or delete it — **recommendation: expose it**, it is 20 lines and would have
  shortened several of this review's investigations.
- **Owner question on `game_saved`**: (A) delete the publish, (B) build the
  save-status indicator its payload was written for, (C) leave it.
  **Recommendation: (A)** — it can be re-added in one line whenever the indicator
  is actually wanted.
- **Related**: CR2-022 (two more dead subscriptions in `AudioSystem`), CR2-039.

---

### CR2-047 · P3 · S · Session 1 · Status: Open
- **Where**: `src/systems/core/SettingsManager.js:18-19`;
  `src/systems/core/NotificationSystem.js:63`
- **What**: Two notification toggles — **`notifications.questEvents`** and
  **`notifications.influenceEvents`** — are declared in the defaults and read by
  nothing. `NotificationSystem` maps only two categories onto setting keys
  (`hero` → `heroEvents`, `item` → `inventoryEvents`); any other category falls
  through to a lookup that returns `undefined`, which is not `false`, so the
  notification always shows.
- **Why it matters**: Small, but it is a settings key that promises the player
  control they do not have. If either toggle is ever surfaced in the UI it will
  appear to do nothing.
- **Suggested fix**: Either give the two categories real mappings (and make sure
  something actually publishes with `category: 'quest'`), or drop the two keys.
- **Stub for Session 6**: `SettingsModal.jsx` currently exposes **only**
  `notifications.position` out of the twelve keys under `notifications.*` —
  `masterToggle`, `heroEvents`, `inventoryEvents`, `maxVisible` and all five
  duration settings have no control at all. Worth establishing whether that is a
  deliberate trim or a modal that lost its section.
- **Related**: CR2-036 (the accepted-then-ignored family).

---

### CR2-049 · P3 · S · Session 1 · Status: Open
- **Where**: `src/state/StateSchema.js:159-166`;
  `src/systems/board/BoardState.js:46-57`; `src/systems/board/SpriteLayer.js:58`
- **What**: **Three different inline definitions of the board's default shape,
  and no two agree.** `StateSchema` declares
  `{tiles, heroTiles, vacancies, tokenBank, tray, maps}`;
  `BoardState.board()` re-creates `{tiles, tokenBank, tray, maps}` then patches
  in `heroTiles` and `vacancies`; `SpriteLayer.sprites()` re-creates
  `{tiles, tokenBank, tray, sprites}` — dropping `maps`, `heroTiles` and
  `vacancies` entirely. **`sprites` and `tokenBankSlots` are in none of the
  three** despite both being saved (CR2-042).
- **Why it matters**: Whichever of the two helpers touches a boardless state
  first decides what the board contains. Today that never bites because both are
  called constantly and each patches its own needs, but it is three answers to
  one question sitting in three files.
- **Suggested fix**: Export one `createEmptyBoard()` from `StateSchema.js` and
  have both helpers call it. Small and safe.
- **Related**: CR2-042.

---

### CR2-050 · P3 · S · Session 1 · Status: Open
- **Where**: `state.board.sprites[*].x / .y`, written by `SpriteLayer`, saved
  verbatim by `GameState.serialize()`
- **What**: **Loot sprites persist absolute pixel coordinates.** A real save
  contains e.g. `{"x":759.57,"y":32,"fromX":744,"fromY":64}`. Tray Tokens in the
  same save use *normalised* 0–1 coordinates (`{"x":0.807,"y":0.983}`), so the
  two things that live on the same screen persist their position in two
  different coordinate systems.
- **Why it matters**: Loot dropped in a large window and reloaded in a small one
  restores at coordinates that may be off-screen, and the player cannot hover it
  to collect it. Bounded and cosmetic — sprites are also auto-collected by the
  stack cap — but it is real, and the tray already demonstrates the right answer.
- **Suggested fix**: Normalise sprite coordinates on save, or clamp them to the
  viewport on load.
- **Session 2 addition**: **`board.maps` has the same problem**, and this ticket
  did not name it. `BoardState.addBoardMap` stores `x`/`y` with `Math.round`, and
  `Placement.placeToken`'s Map branch computes them as
  `colOf(index) * TILE_PX` — absolute pixels again, persisted verbatim. So
  *two* of the three things that float above the grid persist in pixels while the
  Tray persists in fractions. Fix them together.
- **Confidence**: the coordinate mismatch is confirmed from a real save file; the
  off-screen consequence is reasoned, not observed. Confirmed by dropping loot,
  shrinking the window and reloading — a two-minute check for Session 8.
- **Related**: Session 2 owns `SpriteLayer`; filed here because it is a
  serialization-integrity issue.

#### ✅ Session 8 — the player-facing half is REFUTED. Session 7 was right.

Confirmed in a live save that the two coordinate systems really do coexist:
a sprite persists `{"x":213.43,"y":32,"fromX":336,"fromY":64}` while a tray Token
in the same save persists `{"x":0,"y":0.033}`.

**But the stated consequence cannot happen.** `boardConstants.js:27` computes
`BOARD_PX = TILE_PX * 7 + TILE_GAP_PX * 6` from module-level constants — a fixed
**944**, with the file's own comment recording that the board "is a fixed 7×7
forever (D-1)". Grep confirms no scaling anywhere: `Board.jsx:286` and `:293` set
`width`/`height` to `BOARD_PX` literally. `SpriteLayer.clamp` keeps every sprite
inside `[TILE_PX*0.25, BOARD_PX - TILE_PX*0.25]`, so a persisted sprite is always
inside the same 944px box it was dropped in, whatever the window is doing.

**Verified by doing it**: the window was shrunk to 900×700 and back, and every
sprite stayed at the same offset within the board.

**Downgrade to a P3 consistency nit** — two coordinate systems on one screen is
still worth tidying (and `board.maps` shares it, per Session 2's addition), but
"loot can restore off-screen and be uncollectable" is not a real failure mode.

**However — shrinking the window to check this found a much bigger problem, and
it is not this ticket's:** the board does not adapt to the window *at all*, so
below roughly 1920×1080 the playmat is clipped or covered by the Tray. Filed
separately as **CR2-179**, and it is the most severe thing this session found.

---

### CR2-051 · P2 · S · Session 2 *(stub filed by Session 1)* · Status: Open
- **Where**: `src/systems/board/BoardState.js:4`
- **What**: The engine imports from the UI —
  `import { TILE_COUNT, isTileIndex, isPlaceable, tileFootprint } from '../../ui/components/board/boardConstants.js'`.
  `BoardState` is the foundation of the board engine and `boardConstants.js`
  holds the geometry it depends on; the file simply lives on the wrong side of
  the line.
- **Why it matters**: Objective 3. `src/systems/` is meant to be React-agnostic
  and self-contained; this makes the whole board engine formally depend on
  `src/ui/`. Nothing breaks today because `boardConstants.js` is plain data, but
  it means the engine cannot be reasoned about, tested or moved without the UI
  tree.
- **Suggested fix**: Move the geometry constants to `src/config/` (or
  `src/systems/board/`) and have the UI import them from there — the dependency
  should run UI → engine, not both ways.
- **Related**: Session 2 territory; noted here because Session 1 hit it while
  tracing rehydration.
- **Session 2 confirmation — wider than filed**: it is **four** engine files
  importing from the UI, not one. `BoardState.js:4`, `Placement.js:6`
  (`isPlaceable`, `GUILD_HALL_TILE`, `TILE_PX`, `colOf`, `rowOf`,
  `tileFootprint`, `isFootprintInBounds`, `BOARD_SIZE`, `quadrantPushVectors`),
  `SpriteLayer.js:8` (`BOARD_PX`, `TILE_PX`, `TILE_STEP_PX`, `rowOf`, `colOf`)
  and `adjacency.js:3` (`BOARD_SIZE`, `TILE_COUNT`, `isTileIndex`,
  `tileFootprint`). `boardConstants.js` is pure data with no React in it, so the
  move is mechanical — but note `Placement.js:370` also hardcodes the tile size
  as a bare `136` twice instead of using the `TILE_PX` it already imports, which
  will silently disagree with the rest if the board is ever rescaled. Worth
  fixing in the same pass.

---

## Session 1 notes on already-filed tickets

Checked rather than re-discovered, as the brief required.

- **CR2-007 (`EventBatch` unwired)** — **still true, and one new fact for
  Session 2's ruling.** The whitelist `BATCHABLE` has four entries and **two of
  them are now dead events**: `cards_updated` has no subscribers at all (CR2-046)
  and `heroes_updated` is published from this territory only once, at boot. So if
  Session 2 does wire a batch into `BoardRunner`, the whitelist is effectively
  `inventory_updated` + `state_changed` and should be rewritten against what the
  board actually publishes rather than inherited from the deck loop.
- **CR2-013 (dead card cache in `GameState`)** — **confirmed live and running**:
  `rebuildCardCache()` is still called on every load and logs
  `[GameState] Cache rebuilt: 0 cards.` in the console, observed this session.
  Safe to delete; no save path touches `_cardById`.
- **CR2-023 (heroes saved whole)** — **confirmed against real save data.** Every
  saved hero carries a serialized `aggregator` object
  (`{entityId, modifiers:{}, cache:{}, disabledSources:{}}`) plus the derived
  `className`, `traitName`, `level` and `_rev`, all of which rehydration
  overwrites. Also still carrying the retired `assignedCardId: null`, and
  `classId` / `traitId` for retired concepts (deliberate, per
  `HeroRehydration.js`). Add `assignedCardId` to the strip list.
- **CR2-024 (parallel `TimeManager` clock)** — **confirmed.** `time.isPaused` is
  written into every save file and read by nothing; `TimeManager.serialize()` and
  `getGameTime()` still have zero callers. See CR2-041, which lands in the same
  file and should probably be fixed in the same sitting.
- **CR2-025 (`GameState.exploration = {count:0}`)** — still present at
  `EngineBootstrap.js:261-263`, still writing onto the manager object rather than
  into state, still read by nothing. Confirmed deletable.
- **CR2-026 (tick priorities)** — **confirmed and slightly worse than filed.**
  All **eight** handlers register at the default priority 100, and
  `GameLoop.onTick` sorts with `Array.prototype.sort`, so ties keep insertion
  order. Three of the registrations carry comments asserting that their position
  matters ("*After regen deliberately*", "*Registered last so…*", "*runs after
  the engines that consumed the accelerated tick*") — that intent is written in
  prose and enforced only by source order.
- **CR2-036 (lint residue)** — **the `NotificationSubscriptions.js` entry is
  moot.** `tooling_baseline.md` records it pulling `className` and `traitName` out
  of `hero_recruited` and using neither; the current code destructures only
  `{ name }`. Re-ran `npm run lint`: **0 of the 32 remaining problems fall in
  `src/state/` or `src/systems/core/`.** This territory is lint-clean.
- **CR2-016 / 020 / 021 / 022 (AudioSystem)** — not re-investigated beyond
  confirming the code matches the tickets. One addition for whoever picks them
  up: `AudioSystem.init()` still ends by calling
  `handleAreaSwitch('area_guild_hall')`, and `_getMusicPath` still maps three
  **retired** area ids. It is load-bearing — it is the only thing that ever
  starts the BGM — so it cannot simply be deleted, but "start the one BGM track"
  should not be spelled as an area switch now that areas do not exist.

---

## Filed by Session 2 — Board engine (2026-08-18)

**Verification note.** Tickets marked *confirmed at runtime* were reproduced in
the running game with `window.Game` probes. The owner's three save slots were
backed up first. ⚠️ **An autosave fired mid-test and overwrote slot 1 with probe
state**; it was restored from `fantasy_guild_slot_1_backup` and verified
field-by-field (savedAt, playtime, time bank, both heroes, gold, tray, tiles,
quest counts, inventory) against the pre-test capture. All seven save keys end
the session byte-identical to how they started. Two lessons for Session 8:
**the game autosaves while you probe**, and **the rolling backup works** — it is
the only reason nothing was lost.

---

### CR2-052 · P1 · S · Session 2 · Status: Open
- **Where**: `src/systems/board/Cartographer.js:301-306`;
  `src/systems/quests/QuestManager.js:157-158`
- **What**: **Opening one Map advances a Map quest by two.** `openMap` publishes
  **both** `map_opened` and `map_burst` back to back with identical payloads, and
  `QuestManager` subscribes to both, each calling
  `this.reportProgress('map_burst')` with the default amount of 1.
- **Confirmed at runtime**: a quest with `targetType: 'map_burst'` and
  `requiredCount: 100` went from 0 to **2** on a single `openMap` call.
- **Why it matters**: Any quest asking the player to open N Maps completes after
  N/2. The current tutorial quest asks for 1, so it is masked today — it caps at
  its required count — but it will surface the moment a quest asks for more than
  one, and the player has no way to tell the counter is lying. It is also two
  answers to the same question, which is the pattern this review exists to find.
- **Suggested fix**: Publish one event, not two. `map_opened` has three
  subscribers (`CartographerTab`, `QuestColumn`, `QuestManager`) and `map_burst`
  has two (`QuestManager`, `QuestColumn`), so both names are genuinely in use —
  the one-line fix is to drop **one** of the two subscriptions in `QuestManager`.
  Consolidating on a single event name is the tidier fix and wants a sweep of
  both subscriber lists.
- **Related**: CR2-053 (identical shape for Token placement). Session 4 owns
  `QuestManager`; the duplicate publish is this territory's.

---

### CR2-053 [DECIDED: any placement counts] · P1 · S · Session 2 · Status: Open
- **Where**: `src/systems/board/Placement.js:308-309` (and `:265-267` for 2×2);
  `src/systems/quests/QuestManager.js:159,169`
- **What**: **Placing one Token advances a placement quest by two.**
  `placeToken` publishes `BOARD_EVENTS.TILE_CHANGED` *and* `token_placed` for the
  same placement, and `QuestManager` subscribes to both, each calling
  `reportProgress('token_placed')`.
- **Confirmed at runtime**: a quest with `targetType: 'token_placed'` and
  `requiredCount: 100` went from 0 to **2** on a single 1×1 `placeToken` call.
- **And it should be worse for large Tokens**: the 2×2 path publishes
  `TILE_CHANGED` once **per footprint tile** (four times) plus `token_placed`
  once, so one 2×2 placement should count five. *Not runtime-confirmed* — no
  size-2 Token exists in the live content set to test with.
- **Why it matters**: Same as CR2-052 and masked the same way today. The deeper
  problem is that `TILE_CHANGED` is a **generic** "this tile changed" event — it
  also fires on displacement, cascade pushes, Manager restocks and moves — so
  treating it as "the player placed a Token" will keep producing miscounts as new
  board paths are added. `QuestManager`'s handler guards only on
  `data?.typeId != null`, which a Manager restock also satisfies: **a Manager
  restocking a tile while the player is away should advance a "place a Token"
  quest.** That consequence is reasoned from the code, not observed.
- **Suggested fix**: `token_placed` is the specific, intentional event and the
  one the quest should use — drop the `TILE_CHANGED` subscription in
  `QuestManager`. Then check `token_placed` is published on every route a player
  would call "placing a Token": it is *not* published by `Managers.restockTile`
  (correct) nor by `moveToken`. **Owner question**: should moving a Token already
  on the board count as placing one? **Recommendation: no.**
- **Related**: CR2-052.

---

### CR2-054 · P1 · S · Session 2 · Status: Open
- **Where**: `src/systems/board/Placement.js:201-204, 280-283`;
  `src/systems/board/Cartographer.js:155`; against
  `src/systems/board/BoardState.js:326-343`
- **What**: **The Tray's capacity rule is enforced two different ways.**
  `BoardState.addToTray` counts only **non-Map** Tokens against `TRAY_CAPACITY`
  (Maps are exempt, capped separately by `MAX_MAP_LIMIT` = 50). But
  `Placement.placeToken` and `Cartographer.canBuy` both pre-check using the
  **raw** `BoardState.getTray().length`, which includes Maps.
- **Confirmed at runtime**: with a Tray holding 48 Maps and **zero** ordinary
  Tokens, `addToTray` accepted another Token happily, while `placeToken` onto an
  occupied tile refused with *"No room in the Tray for the displaced Token(s)"*.
- **Why it matters**: Player-facing and unexplainable from the screen. The Tray
  header counts non-Map Tokens, so it can read **"TOKEN TRAY (0/48)"** while the
  board refuses to let you put a Token down because the Tray is "full". Maps
  accumulate in the Tray by design — D-156 makes it the only place they can live
  — so this is reachable in ordinary play, not a contrived state. It blocks
  buying a Map for the same reason.
- **Suggested fix**: Have both pre-checks call `BoardState.hasTraySpace()`, which
  already exists and applies the real rule, instead of comparing `length` against
  the capacity constant. The 2×2 path needs the count of displaced Tokens, so
  `hasTraySpace` wants an optional "how many" argument.
- **Also stale in the same area**: `BoardState`'s Tray documentation says
  "~15–20 slots", "the 18-token Tray capacity", and "all 18 stay visible so the
  `n / 18` count keeps describing what you see". `TRAY_CAPACITY` is **48**. The
  prose describes a Tray that no longer exists.

---

### CR2-055 · P2 · S · Session 2 · Status: Open
- **Where**: `src/systems/board/boardEvents.js`;
  `src/ui/components/board/Tray.jsx:60`
- **What**: **`BOARD_EVENTS.TRAY_CHANGED` does not exist**, so `Tray.jsx`
  subscribes to `undefined`. `EventBus.subscribe` happily registers a handler
  under the key `undefined`, nothing ever publishes it, and the subscription is
  silently inert. Grepped across `src/` and `cms/src/`: the constant is
  referenced exactly once and defined nowhere.
- **Why it matters**: Two things, and the second is bigger.
  1. The Tray is trying to refresh on tray changes and isn't. It gets away with
     it today because it *also* subscribes to `state_changed` and five other
     events, and most tray mutations happen to publish `state_changed` — so this
     is latent rather than visible. Any tray mutation that stops publishing
     `state_changed` will silently stop updating the Tray.
  2. **There is no tray event in the registry at all**, yet `addToTray`,
     `takeFromTray` and `setTrayPosition` are called from ~10 engine paths
     (placement, displacement, map burst, sprite collection, purchase). The
     board's contract registry has a hole exactly where its busiest surface is —
     which is presumably why a component invented a name for one.
- **Suggested fix**: Add a real `TRAY_CHANGED: 'board:tray_changed'` to
  `boardEvents.js` and publish it from `BoardState`'s three tray mutators — the
  same shape as the CR2-033 fix, which moved a rule down into the one function
  every route funnels through. The Tray can then stop relying on the
  `state_changed` firehose.
- **Confidence**: The missing constant is certain. That the Tray nonetheless
  updates correctly today is inferred from its other five subscriptions, not
  observed — worth a two-minute check in the game alongside the fix.

---

### CR2-056 · P1 · M · Session 2 · Status: Open
- **Where**: `src/systems/board/SpriteLayer.js:206-252` (`collectSprite`),
  `:333-357` (`tick`)
- **What**: **Collecting loot publishes about eight events per sprite, and a
  sweep collects dozens of sprites in a single tick.**
- **Measured in the running game**: one `SpriteLayer.tick()` that swept 40
  sprites over the stack cap published **320 events in that one tick** —
  `state_changed` ×120, `inventory_updated` ×40, `registry_updated` ×40,
  `board:sprites_changed` ×40, `board:sprite_collected` ×40,
  `notification_added`/`_updated` ×40.
- **Three separate faults behind that number:**
  1. **Three `state_changed` per collected sprite** — one from `collectSprite`
     itself, the rest from the inventory write beneath it.
  2. **`state_changed` is published even when collection FAILS.** It sits in a
     `finally` block, so it fires on the "Bank is full, the sprite stays put"
     path too. A full Bank with litter on the floor is D-138's *designed* steady
     state — so the game sits there publishing `state_changed` on every sweep,
     forever, having changed nothing.
  3. **No coalescing** — see the Session 2 ruling appended to CR2-007.
- **Why it matters**: This is the render-storm shape objective 5 asks about, and
  it lands during the game's most visually busy moment — a Map burst scattering
  loot, then the sweep tidying it away. It is also the cheapest thing on this
  list to improve: two of the three faults are one-line guards.
- **Suggested fix**: In order of value for effort — (a) move the `state_changed`
  publish out of the `finally` so it fires only when something was actually
  collected; (b) have `collectAll` and the two sweep loops in `tick` publish one
  `state_changed` and one `board:sprites_changed` at the end rather than per
  sprite; (c) wire `EventBatch` around `GameLoop`'s frame per the CR2-007 ruling,
  which then covers this and anything like it.
- **Confidence**: The event counts are measured. The *render* cost is not — that
  is Session 8's census. These publishes may be cheap if few components
  subscribe; the counts justify looking, not panicking.
- **Related**: CR2-007 (ruling), CR2-057 (which multiplies this), CR2-036
  (`ParticleOverlay` ignores quantity, same code path).

---

### CR2-057 · P2 · S · Session 2 · Status: Open
- **Where**: `src/systems/board/TriggerSystem.js:168-178, 191-193`;
  `src/config/registries/triggerRegistry.js` (`ITEM_THRESHOLD`)
- **What**: The globally-scoped `ITEM_THRESHOLD` trigger subscribes to
  `inventory_updated` and, **on every single one**, walks
  `BoardState.occupiedTiles()` and calls `triggeredBlocks(def, …)` per tile —
  which allocates two arrays each (`.map(...).filter(...)`).
- **Why it matters**: It multiplies whatever `inventory_updated` is doing. During
  the sweep measured in CR2-056, `inventory_updated` fired **40 times in one
  tick**; with a full 48-tile board that is 40 × (a full build-and-sort of the
  tile map, plus 96 array allocations) — roughly **4,000 throwaway arrays in a
  single tick**, to evaluate a trigger almost no Token carries. The registry's
  own comment calls this approach "cheap, and it needed no new engine event
  plumbing", which was true when written and is exactly the kind of claim worth
  re-checking once the caller changed.
- **Suggested fix**: Cheapest first — keep a module-level set of tiles that
  actually carry an `ITEM_THRESHOLD` block, maintained on `ADJACENCY_DIRTY` /
  `TILE_CHANGED`, and iterate that instead of the whole board. Usually empty, so
  the common case becomes free. Coalescing `inventory_updated` (CR2-007) cuts
  this 40× on its own, which is part of why that ruling matters here.
- **Also**: `handleGlobalItemThreshold` **ignores the trigger id it was
  registered for** and hardcodes `'ITEM_THRESHOLD'`. There is only one global
  trigger today so nothing is wrong; a second would silently run the wrong
  handler.
- **Related**: CR2-007, CR2-056, CR2-062.

---

### CR2-058 · P2 · S · Session 2 · Status: Open
- **Where**: `src/systems/board/BoardRunner.js:383` (the gate) against
  `:132-145` (the payment)
- **What**: **A Token's input-cost discount is applied when it pays, but not when
  the board decides whether it *can* pay.** The per-tick gate calls
  `InputAllocator.checkInputs(io.inputs)` with the **raw authored** quantities;
  `completeCycle` then rebuilds the same inputs through
  `TileModifiers.resolveAxis(..., INPUT_COST, ...)` before spending them.
- **Why it matters**: The two directions fail differently, and one is
  player-visible.
  - **A cost-*reducing* neighbour does nothing exactly when it matters most.** A
    Tool Rack that makes a Forge cost 1 Coal instead of 2 will not let the Forge
    run when only 1 Coal is banked — the gate still asks for 2, raises the
    "waiting for materials" mark, and stalls. The buff works only when the player
    already had enough without it, which is when they did not need it. This is
    the very failure `TileModifiers`' own header says G-5 was written to fix
    ("*a Context Token could never actually change a neighbour's output*").
  - **A cost-*increasing* neighbour** lets the gate pass and then fails the
    payment, taking `completeCycle`'s race path — recoverable, since progress is
    kept, but it means the "raced by another Token" branch is reachable with no
    race involved.
- **Suggested fix**: Resolve `INPUT_COST` once, before the gate, and pass the
  same resolved array to both `checkInputs` and `consumeInputs`. That also
  removes the duplicated `.map()` in `completeCycle`.
- **Confidence**: **Reasoned from the code, not reproduced.** Confirming it needs
  a Token authored with an `INPUT_COST` modifier placed beside a consumer, with
  the Bank held just below the undiscounted cost. Worth doing before fixing: it
  is possible no live content authors `INPUT_COST` yet, which would make this
  latent rather than active. Whether any authored Token uses it is a Session 5
  content question.

---

### CR2-059 · P3 · S · Session 2 · Status: Open
- **Where**: `src/systems/board/BoardRunner.js:112-116` (`setAlert`)
- **What**: The no-change guard is `if (instance.alert === reason) return;`. A
  freshly loaded or freshly placed Token has **no `alert` field at all**, so
  `instance.alert` is `undefined`, and `undefined === null` is false — the first
  `setAlert(instance, index, null)` therefore publishes an `ALERT_CHANGED`
  announcing a change from "no alert" to "no alert".
- **Confirmed at runtime**: with 48 tiles occupied, deleting the `alert` field
  (reproducing what deserialization leaves behind) made the very next
  `BoardRunner.tick` publish **48 `board:alert_changed` events**, every one a
  no-op. The following tick published none.
- **Why it matters**: Small and bounded — one burst per load, not per tick. But
  `alert` is not persisted, so it happens on **every save load and every page
  reload**, at the moment the UI is already doing its most work, and
  `ALERT_CHANGED` has two live subscribers. It is also two lines to fix.
- **Suggested fix**: Normalise before comparing —
  `const next = reason || null; if ((instance.alert ?? null) === next) return;`.
  Initialising `alert: null` in `createTokenInstance` is tidier but does not help
  Tokens loaded from existing saves.

---

### CR2-060 · P2 · S · Session 2 · Status: Open
- **Where**: `src/systems/board/Managers.js:117-121`;
  `src/systems/board/BoardRunner.js:66-79` (the `ALERT` enum)
- **What**: Two problems where the Manager sweep meets the alert system.
  1. **The "no replacement in the Vault" alert is republished on every sweep,
     with no change guard.** `restockTile` sets `vacancy.unstocked = true` and
     publishes `ALERT_CHANGED` unconditionally; the next sweep finds the same
     vacancy, fails to withdraw again, and publishes again. The sweep runs every
     5 ticks, so **each unstocked vacancy publishes ~2 events per second,
     indefinitely.** `BoardRunner.setAlert` guards against precisely this for
     every other alert; this route bypasses it.
  2. **`'unstocked'` is not a member of the exported `ALERT` enum**, though the
     enum's comment says it enumerates "*why a staffed Token cannot work*" and
     drives the tile's mark. The UI had to hardcode the bare string in two
     places — `BoardTile.jsx:111` (`ALERT_HINT`) and `Board.jsx:109`.
- **Why it matters**: (1) is a permanent event drip in exactly the state the
  Manager system is designed to reach — the player is away, the Vault has run
  dry, several tiles wait. That is D-133's expected AFK end state, so it is the
  *normal* long-session condition rather than an edge case. (2) is contract
  drift: the engine's list of alert reasons is not the real list, so anyone
  asking "what alerts exist?" gets the wrong answer from the enum that exists to
  answer it.
- **Suggested fix**: Guard with `if (vacancy.unstocked) return 'unstocked';`
  before republishing, so the event fires on the transition only. Add
  `UNSTOCKED: 'unstocked'` to the `ALERT` enum and have both UI sites import it.
- **Related**: CR2-059 (same class of unguarded alert publish), CR2-036
  (`ALERT_HINT` is the table nothing reads).

---

### CR2-061 · P2 · S · Session 2 · Status: Open
- **Where**: `src/systems/board/BlockUpkeep.js:32-34, 61-67`, called from
  `src/systems/board/BoardRunner.js:311` for every tile, every tick
- **What**: `tickUpkeep` runs **before every guard** in the tick loop (correctly
  — a Buff Token has no hero and no config), and its first act is
  `costedBlocks(def)`, which does `effectBlocksOf(def).filter(...)` — allocating
  an array — and only *then* returns early if nothing is costed. When a block
  does have upkeep it calls `effectBlocksOf(def)` a **second** time and uses
  `all.indexOf(block)` inside the loop.
- **Why it matters**: On a full board that is 48 array allocations per tick =
  **480 per second**, before a single Token with upkeep exists. It is not enough
  to break the 5ms budget on its own — the measured tick path is quiet — but it
  is exactly the "high-frequency allocation on the tick path" the performance bar
  names, and it is pure waste: the overwhelmingly common answer is "this Token
  has no upkeep".
- **Suggested fix**: Give the early-out a test that allocates nothing —
  `effectBlocksOf(def).some(b => b?.cost?.items?.length && b.cost.cadenceMs > 0)`
  — or better, cache the costed-block *indices* per `typeId` on first use, since
  they are a property of the definition and never change at runtime. That also
  removes the `indexOf` from the loop.
- **Related**: CR2-062 (same theme). Session 8 owns measurement.

---

### CR2-062 · P2 · S · Session 2 · Status: Open
- **Where**: `src/systems/board/BoardState.js:85-115` (`getOccupyingToken`),
  `:156-162` (`occupiedTiles`), `:165-171` (`emptyTiles`)
- **What**: **Asking "what is on this tile?" costs a full board scan whenever the
  answer is "nothing".** `getOccupyingToken` returns immediately if the tile holds
  a Token, but otherwise falls through to a loop over `occupiedTiles()` — which
  builds an array of keys, maps them to numbers, **sorts**, and maps again into
  pairs — purely to check whether some 2×2 Token's footprint covers it.
- **Where it multiplies**:
  - `hasToken()` is `getOccupyingToken() !== null`, and `emptyTiles()` calls it
    for all 49 tiles — **49 full board rebuilds and sorts** for one call.
  - `TileModifiers.applicableBlocks(index)` calls it once for the tile and once
    per neighbour (up to 9), and `rebuildAround` calls that for up to 9 tiles —
    so **one placement can trigger ~81 of these**, most on empty tiles.
  - `RecipeResolver` repeats the same neighbour walk in five separate functions.
- **Why it matters**: This is the board's most-called primitive and its slow path
  is the *common* path, because most of a 7×7 board is empty most of the time. It
  is not a measured problem today — the tick loop is quiet and placement is a
  one-off — but it is the shape that stops scaling the moment something calls it
  in a loop, and `emptyTiles()` already does.
- **Suggested fix**: Maintain a small `coveredBy` map (`tileIndex -> anchorIndex`)
  beside `board.tiles`, written by `setToken` when a size-2 Token is placed or
  removed. `getOccupyingToken` then becomes two direct lookups and never scans.
  Runtime-only and fully derivable, so it needs no save change — rebuild it
  wherever `TileModifiers.rebuildAll` runs.
- **Confidence**: The call pattern is certain (read from code). Whether it costs
  measurable time today is **not** established — flagged for Session 8 rather
  than asserted. Per objective 6 this is a targeted fix with a named cause, not a
  restructure.

---

### CR2-063 · P2 · S · Session 2 · Status: Open
- **Where**: `src/systems/board/Cartographer.js:275-276` (`openMap`);
  `src/systems/board/SpriteLayer.js:125-127` (`addSprite`)
- **What**: **Two more board entry points that accept content ids which do not
  resolve, and say nothing** — the same shape as CR2-011 and CR2-044.
  1. `openMap` resolves its Map through a four-step fallback chain ending in
     `getMap(mapId) || getMap('map_test_map')`. **An unrecognised Map silently
     bursts as the test map.** A content rename would not fail; it would hand the
     player the wrong loot table.
  2. `addSprite` checks only that `refId` is truthy and `quantity > 0`. It never
     asks whether the item or Token id exists, so a bad drop id becomes a sprite
     on the floor with no art and no definition — and this is the layer where
     CR2-011's missing `item_blackberry` would actually land.
- **Why it matters**: The review has now found this identical failure at four
  layers (enemy drops, opening tray, Map resolution, sprite creation).
  Individually each looks like defensive coding; together they mean **the board
  will accept any id at all and fail quietly**, which is why content renames have
  repeatedly gone unnoticed until someone played the game. `map_test_map` as a
  *production* fallback is the sharpest of the four, because it substitutes
  plausible-looking wrong content rather than nothing at all.
- **Suggested fix**: Make an unresolvable id loud at both sites — refuse and
  `logger.warn` rather than substitute. For `openMap`, drop the `map_test_map`
  fallback entirely and return the existing `refuse('That is not a Map')`. This
  is the "second part matters more" half of CR2-011's suggested fix, applied
  here.
- **Related**: CR2-011, CR2-044, CR2-002. Session 5 owns the content half.

---

### CR2-064 · P3 · S · Session 2 · Status: Open
- **Where**: `src/systems/board/BoardRunner.js:265`;
  `src/systems/board/BoardCombat.js:218`; contract in
  `src/systems/board/boardEvents.js:44-45`
- **What**: **`board:token_depleted` is published with `typeId: null` by two of
  its five publishers.** Its documented payload is `{ tile, typeId }`, and three
  publishers (`BoardRunner:253`, `BoardCombat:238`, `TriggerSystem:129`) pass the
  real type — but the two that fire when an *adjacent support* Token wears out
  pass `null`, even though `wearAdjacentSupport` hands the depleted instance to
  its callback and could name it.
- **Why it matters**: A subscriber cannot tell what depleted. `triggerRegistry`
  exposes this event as an authorable trigger ("*A neighbour runs out of
  charges*") and `TriggerSystem.sourceMatches` filters on `payload.typeId` — so
  **a Token authored to react to a specific neighbour running dry will never fire
  when that neighbour is a Context or Buff Token**, which is the most likely
  thing an author would target. Silent, and indistinguishable from "nobody has
  authored one yet".
- **Suggested fix**: Pass the depleted instance's `typeId` at both call sites.
  `wearAdjacentSupport` already provides it as the callback's second argument
  (`RecipeResolver.js:292`); both callers ignore it.
- **Related**: the `boardEvents.js` contract audit in the System Map above.

---

### CR2-065 · P3 · S · Session 2 · Status: Open
- **Where**: `src/config/loopConstants.js`
- **What**: **Nine of its twelve exports have zero consumers anywhere** — checked
  across `src/`, `cms/src/` and the tests. Only `CONSUME_THRESHOLD` (4 uses),
  `DEFEAT_PENALTY` (5) and `TIME_BANK` (9) are live. Dead: `DECK_SLOT_COUNT`,
  `PREP_CARD_TIME_MS`, `DRAW_TIME_MS`, `SHUFFLE_TIME_MS`, `CONSUMPTION_TIME_MS`,
  `ENERGY_DRAW_COST`, `DEFAULT_CRAFT_ENERGY`, `AREA_PACK`,
  `PROGRESS_EVENT_TICK_INTERVAL`.
- **And one is duplicated rather than merely dead**:
  `PROGRESS_EVENT_TICK_INTERVAL = 3` describes exactly what
  `BoardRunner.js:63`'s local `PROGRESS_EVERY = 3` does. The board reimplemented
  the constant instead of importing it, so there are two tunables for one dial
  and editing the documented one does nothing.
- **Why it matters**: The file's header promises "*Every gameplay number for the
  loop engine lives here so it can be tuned in one place*", and it is now largely
  a museum of the deck loop and the retired pack economy. `ENERGY_DRAW_COST` and
  `DEFAULT_CRAFT_ENERGY` are already documented as deliberately-kept records
  (D-183/D-184) and should stay; the rest are not.
- **Suggested fix**: Delete the deck-loop and pack constants (`DECK_SLOT_COUNT`,
  `PREP_CARD_TIME_MS`, `DRAW_TIME_MS`, `SHUFFLE_TIME_MS`, `CONSUMPTION_TIME_MS`,
  `AREA_PACK`) with their prose. For the progress interval, pick one —
  **recommendation: delete `PROGRESS_EVENT_TICK_INTERVAL` and keep
  `BoardRunner`'s local constant**, since it is the one that works and the board
  is its only consumer. Keep the two Energy constants and their note. Then
  re-header the file, which is no longer "loop" constants. Session 4 owns loose
  `src/config/` constants generally; this file was assigned to Session 2, hence
  filed here.

---

### CR2-066 [DECIDED: keep code, fix comment] · P3 · S · Session 2 · Status: Open
- **Where**: `src/systems/board/TokenBank.js:36-57` (`SELL_VALUE`) against
  `:180-186` (`copySellValue`)
- **What**: **A documented design decision contradicts the code beneath it.**
  `SELL_VALUE`'s comment states, as an "*owner decision 2026-08-06*", that sell
  value is "*Flat rather than scaled by charges remaining: a spent Forest and a
  fresh one fetch the same few coins*", and reasons at length about the accepted
  exploit that follows ("*it means running a Token to zero before selling loses
  nothing*"). `copySellValue`, twelve lines below, **does scale by charges**:
  `base * (usesRemaining / capacity)`, floored.
- **Why it matters**: This is the **fifth** instance of confident prose
  describing machinery that does not exist — after `theme` (which reached the
  decision log as D-139/D-166), rarity, `tokenConstants` (CR2-039) and
  `DiscoveryManager`'s header (CR2-046). It matters more than usual here because
  the comment reasons carefully about a *balance* consequence that is no longer
  real, so anyone tuning selling will design around an exploit that is already
  closed. No player is misinformed — `TokenInspection.jsx` correctly uses
  `totalSellValue` for the price and labels the flat number "(Xg full)" — only
  the next developer is.
- **Owner question**: which behaviour is intended?
  - **(A)** Proportional is right (what the code does). Correct the comment and
    strike the flat-value rationale. **Recommendation** — proportional is
    presumably what has been played, and it closes the exploit the comment
    apologises for.
  - **(B)** Flat was the decision and `copySellValue` is the drift. Then selling
    needs changing and the 2026-08-06 decision stands.
  - **(C)** Leave both and document the discrepancy. Not recommended.
- **Related**: CR2-039, CR2-046, `concept_audit.md`. Note the guide's warning
  that a decision date attached to an unaudited claim is *suggestive, not
  binding* — this comment is exactly that shape.

---

### CR2-067 · P3 · S · Session 2 · Status: Open
- **Where**: `src/systems/board/InputAllocator.js:47-48, 106-126`
- **What**: The **Risk-13 measurement instrument has no readout in the running
  game.** `noteStarved` is called on the hot path (twice per blocked tile per
  tick) and accumulates into a module-level `Map`; `getStarvationStats` and
  `resetStarvationStats` are called **only from tests** — nine suites reset it,
  two read it. Nothing in `src/` or on the dev dashboard surfaces it.
- **Why it matters**: The file's own documentation explains at length that this
  exists so "*the first balance pass has data instead of a hunch*", and that
  D-127's deep-chain starvation risk "*is measured rather than guessed*". It is
  measured into a variable nobody can see. When the balance pass happens, whoever
  runs it will have to write a probe — or, more likely, guess.
- **Suggested fix**: Expose it on `TestDashboard`, which the owner has confirmed
  is intentional dev tooling (guide Q5) and is exactly what this is for. Roughly
  the same call as CR2-046's recommendation to surface the `EventBus` event log,
  and worth doing in the same sitting.
- **Related**: CR2-046 (item 5), `src/tests/Risk13Allocation.test.js`.

---

### CR2-068 · P3 · S · Session 2 · Status: Open
- **Where**: `src/systems/board/Placement.js` — the return values of
  `placeToken`, `moveToken`, `returnTokenToTray`, `returnTokenToVault`,
  `placeHero` and `recallHero`
- **What**: Placement reports what it displaced — `displacedToken`,
  `displacedHeroId`, `heroLeftBehind`, `idledHeroId`, `workedTile` — and
  **nothing outside the tests reads any of them.** Grepped across `src/ui/` and
  `src/systems/`: seven references, all in `Placement.test.js` and
  `LargeTokenPlacement.test.js`.
- **Why it matters**: Mild, and it needs saying carefully — this is **not** a
  broken feature. The UI does learn about displacement, through the `HERO_MOVED`
  and `TILE_CHANGED` events the same functions publish, so nothing is missing on
  screen. What it is: a second, parallel channel for the same information, kept
  alive only by the tests that assert on it. That is the "two answers to one
  question" pattern, and it makes the return contract look load-bearing when it
  is not.
- **Suggested fix**: Low priority, and there is a real argument for keeping them:
  a caller wanting to say *"Luna was knocked off her tile"* at the point of
  action would want exactly these, and `displacedHeroId` is arguably a better
  source than a `HERO_MOVED` carrying `tile: null`. **Recommendation: leave them,
  and record here that they are test-only** so nobody wires the UI to them by
  accident or deletes them as dead. Revisit if displacement feedback gets built.
- **Related**: CR2-036 (the accepted-then-ignored family).

---

### CR2-069 · P2 · S · Session 2 · Status: Open
- **Where**: `src/state/StateSchema.js` (`INITIAL_STATE`) against
  `src/systems/board/TokenGroups.js:73`,
  `src/systems/board/Cartographer.js:188, 237`
- **What**: **Three more save fields that are written but never declared**,
  extending CR2-042's list of nine to twelve: `board.tokenGroups` (the Token
  Vault's tabs), `progress.guildHallMapOpens` (which indexes the scripted
  tutorial drop sequence), and **`cartographer.purchasedMaps` — an entire
  top-level section absent from the schema.**
- **Why it matters**: `cartographer` is the notable one because it is top-level,
  which is the one level `SaveMigration.migrateState` *does* backfill — so a save
  missing it is repaired, but `INITIAL_STATE` never declares it, and Session 1
  established that `REQUIRED_KEYS` is already validating the previous game.
  `progress.guildHallMapOpens` is the index into `GUILD_HALL_DROP_SEQUENCE`, so
  losing it silently restarts a new player's scripted opening drops. Each field
  is individually guarded by its own defensive re-creation on read — the exact
  pattern CR2-042 warns will eventually be forgotten.
- **Suggested fix**: Fold into CR2-042's fix — declare all twelve fields and make
  the migration merge one level deeper. Additive; no version bump needed.
- **Related**: CR2-042, CR2-043, CR2-049.

---

## Filed by Session 3 — Combat, heroes, skills & promotion (2026-08-18)

**Verification note.** Everything below marked *confirmed at runtime* was
reproduced in the running game via `window.Game` / `window.GameState` probes.
The owner's save slots were captured before testing and verified restored
byte-for-byte afterwards — see the Session Status row for the full account,
including an autosave that overwrote slot 1 mid-session and was recovered.

**Territory tooling result:** `npm run lint` reports **0 of its 32 problems** in
this territory. `npm run duplication` reports **0 clones** here. `npm run cycles`
reports the 16-module group; the Session 3 position on it is in the System Map.

---

### CR2-070 [DECIDED: costs equipment] · P1 · S · Session 3 · Status: Open
- **Where**: `src/systems/effects/StatusEffectSystem.js:104-115`;
  the only HP-zero check is `src/systems/board/BoardCombat.js:186`
- **What**: **A hero poisoned to 0 HP while working an ordinary tile is never
  wounded.** The status clock notices the death — `_fireStatusTick` returns
  `died: true` — and then does nothing but write a log line. The comment beside
  it says *"LoopRunner's per-area check routes 0 HP through Forced Retreat"*, and
  **`LoopRunner` was deleted by the playmat rework**. Nothing replaced it. The
  only surviving zero-HP check lives in `BoardCombat.tickTile`, which runs only
  for a hero standing on an **enemy** Token.
- **Confirmed at runtime**: a hero on tile 10 (a production tile) with 5 stacks
  of Poison was driven through four status ticks. Result: **HP 0, status still
  `working`, still standing on tile 10**. A subsequent `BoardRunner.tick()`
  changed nothing. The hero carries on working at zero HP indefinitely.
- **Why it matters**: The locked decision (2026-07-12) is that **DoT ticks are
  true damage and CAN kill**. Off an enemy tile they cannot — so a status effect
  that is supposed to be lethal is merely cosmetic, the Wounded state never
  triggers, the defeat penalty is never paid, and the player sees a hero sitting
  at 0 HP with no explanation. Nothing errors and no test covers it.
- **Suggested fix**: The zero-HP check belongs somewhere every hero passes
  through, not on the combat tile path. The cheapest correct place is the status
  tick itself — have it call the same route `BoardCombat.resolveDefeat` uses
  (wound + `clearAll` + `applyDefeatPenalties` + `setHeroTile(id, null)`), or
  publish a `hero_downed` event that one owner subscribes to. **Owner decision
  on one point:** should a status death cost equipment the way a combat death
  does (D-74)?
  - **(A) Yes — identical to combat defeat.** One rule, no way to dodge the
    penalty by dying to poison instead of to the enemy. **Recommended.**
  - **(B) Wounded but no gear loss.** Gentler, but creates a second death rule.
- **Related**: CR2-071 (both are "the hero-removal path lost its owner in the
  rework"). `status_effects_plan.md` §5 flow control is deferred, but this is not
  that — it is a deleted caller, not an unimplemented feature.

---

### CR2-071 [LIKELY MOOT: retirement retired] · P1 · S · Session 3 · Status: Open
- **Where**: `src/systems/hero/logic/HeroLifecycle.js:99-106` (`retireHero`)
- **What**: **Retiring a hero who is standing on the board leaves their tile
  entry behind, pointing at a hero who no longer exists** — and `board.heroTiles`
  is saved state. The code says so itself: there is a
  `TODO(Phase 2): BoardPlacement.recallHeroById(heroId) before removal`, followed
  by *"until then no hero can be on a tile, so there is nothing to clear."*
  **Phase 2 landed.** Heroes have stood on tiles since the playmat rework; the
  precondition the comment relies on has been false for months.
- **Confirmed at runtime**: a hero placed on tile 24 and then retired left
  `board.heroTiles = { hero_cTcCtMH0: 24 }` while `state.heroes` no longer
  contained that id.
- **Why it matters**: `StateSchema.js:155` calls `heroTiles` *"a hero's position,
  and it is the only copy."* A stale entry is saved, reloaded, and read by
  `Board.jsx:61` and `HeroDockTab.jsx:36`. The likely player-visible symptom is a
  tile that looks occupied by nobody, or a tile that refuses a hero because the
  engine believes someone is already there. Nothing errors — the entry is simply
  never cleaned up, and it accumulates one per retirement.
- **Suggested fix**: Call `BoardState.setHeroTile(heroId, null)` in `retireHero`
  before `removeFromRoster`, and delete the stale TODO. One line. Worth also
  adding a defensive sweep on load that drops `heroTiles` entries whose hero id
  is not on the roster, so existing saves self-heal.
- **Why no test caught it**: no suite exercises retirement against a populated
  board — `Promotion.test.js` and the hero suites work on a bare roster.
- **Related**: CR2-040 (also a hero-state-on-load defect), CR2-070.

---

### CR2-072 [DECIDED: wire it up] · P1 · S · Session 3 · Status: Open
- **Where**: `src/systems/hero/logic/HeroRehydration.js:88-100`;
  `src/config/FormulaRegistry.js:10-25`;
  matching logic in `src/systems/effects/ModifierAggregator.js:332-339`
- **What**: **Levelling a skill grants a speed bonus that nothing reads — and
  even if something did, it could never match.** Two independent breaks in one
  wire:
  1. `updateHeroSkillModifiers` registers an `EFFECT_TYPES.SPEED` modifier for
     every skill a hero holds, on every load and every level-up.
     **`SPEED` is read nowhere in `src/`** — grepped across the whole tree; the
     only other mentions are the constant's declaration and tests.
  2. The modifier is targeted at `skillId.toUpperCase()` — `'MINING'` — while
     every id in the game is lowercase (`TARGET_CATEGORIES.MINING === 'mining'`,
     and `BoardRunner` passes `config.skill`, which is lowercase).
     `_forEachMatching` compares categories **case-sensitively**; only the
     `_isParentOf` fallback lowercases, and it only knows the `combat` parent.
- **Confirmed at runtime**: a Mining-60 hero's aggregator holds
  `{type:'SPEED', target:'MINING', value:0.3}`. Querying it the way a consumer
  would returns nothing:

  | Query | Result |
  |---|---|
  | `query('SPEED','mining')` | **0** |
  | `query('SPEED','MINING')` | 0.3 |
  | `getPercentageBucket('SPEED','mining')` | **1.0** (no bonus) |
  | `getPercentageBucket('SPEED','MINING')` | 1.3 (+30%) |

- **Why it matters**: `FormulaRegistry`'s own comment says this value is *"Used
  in: HeroManager (aggregator registration), CombatFormulas (attack speed)"* —
  **`CombatFormulas` does not read it.** The player-facing consequence is that
  raising a gathering skill from 1 to 60 makes the hero **no faster at anything**;
  the only thing skill level still does is gate work and feed hero level. For an
  idle game whose core loop is levelling skills, that is a large hole, and it is
  completely silent.
- **Suggested fix**: Decide first whether skill speed is a live design (it may
  have been superseded by the tile-adjacency `WORK_TIME` axis, which *is* wired
  and *is* the playmat's speed lever). **Owner decision:**
  - **(A) Wire it.** Have `BoardRunner`'s cycle-time calculation fold the working
    hero's `SPEED` bucket in beside the tile's `WORK_TIME` axis. Restores "my
    miner got faster", which is the most legible progression feedback there is.
    **Recommended.**
  - **(B) Retire it.** Delete the registration and `skillSpeedBonus`, and accept
    that speed comes only from board layout. Cheaper, but skill levels then do
    very little.
  Either way **fix the case mismatch** (normalise category comparison in
  `_forEachMatching`), because it is a trap for any future consumer and it is
  invisible — the query simply returns 0.
- **Related**: CR2-073 (the same file's other broken modifier wire), CR2-074.

---

### CR2-073 · P1 · S · Session 3 · Status: Open
- **Where**: `src/systems/hero/SkillSystem.js:90-103` (`getXpMultiplier`)
- **What**: **XP bonuses do nothing, twice over.** `getXpMultiplier` reads
  `EFFECT_TYPES.XP_GAIN` — **there is no `XP_GAIN` in `constants.js`.** The
  constant is called `XP_BONUS`. So the expression evaluates to
  `getMultiplierBucket(undefined, …)`, which matches no modifier and returns 1.
  Separately, **`getXpMultiplier` has no callers anywhere** — `addXP` adds the
  raw amount with no multiplier applied.
- **Confirmed at runtime**: `getXpMultiplier(hero, 'mining')` returns exactly
  `1` for a hero carrying a live percentage modifier.
- **Why it matters**: Two things a player would expect to matter are inert. Any
  future content authored as "+10% Cooking XP" would silently do nothing, and the
  typo means it would keep doing nothing even after someone wired the function
  up — the classic two-layer failure this review exists to find. The
  `XP_BONUS` axis *is* live on the board side (`BoardRunner.js:232`), so the
  vocabulary exists and works; only the hero-side reader is broken.
- **Suggested fix**: Correct `XP_GAIN` → `XP_BONUS`, then either call
  `getXpMultiplier` from `addXP` or delete the function. Note that wiring it
  changes progression pace, so it wants the owner's eye rather than a silent fix.
- **Related**: CR2-072, CR2-074. Same species as CR2-039 (a name that does not
  resolve, failing silently).

---

### CR2-074 · P2 · M · Session 3 · Status: Open — **the CR2-029 verdict**
- **Where**: `src/systems/equipment/EquipmentManager.js:184-306` (producers);
  `src/utils/CombatFormulas.js` and `src/systems/effects/StatusEffectSystem.js:40`
  (the only consumers anywhere)
- **What**: CR2-029 said seven gear modifier types are attached to heroes and
  never read. **Confirmed, and it is wider than filed in both directions.** Full
  census of every modifier type, grepped across all of `src/`:

  | Written by gear | Read by | Verdict |
  |---|---|---|
  | `DEFENSE` | `computeEnemyDamage`, `getEnemyDamageRange` | wired |
  | `ACCURACY` | `calculateHitChance` | wired |
  | `RESIST_FLAT` | `computeEnemyDamage`, `getEnemyDamageRange` | wired |
  | `DAMAGE` | — | **never read** |
  | `SKILL_LEVEL` | — | **never read** |
  | `HPBONUS` | — | never read |
  | `TICKSPEEDBONUS` | — | never read |
  | `SLOW_ENEMY` | — | never read |
  | `SUNDER` | — | never read |
  | `EVASION` | — | never read |
  | `LIGHT` | — | never read |
  | `HASTE` | — | never read |

  **Nine unread, not seven.** The two CR2-029 misses are the important ones:
  **`DAMAGE`** (an item authored with `assignedEffect: 'flatDamage'` adds
  nothing — note `computeHeroDamage` reads `weapon.damage` off the item template
  directly, which *does* work, so the two damage routes disagree) and
  **`SKILL_LEVEL`**, whose intended consumer exists and is explicitly stubbed:
  `SkillSystem.getEffectiveLevel:115-118` returns the base level with a
  `TODO: Integrate with ModifierAggregator`.

  **And the reverse gap, which CR2-029 does not mention:** three types are
  **read but never written** — `BLOCK` (`CombatFormulas.js:145`), `ARMOR`
  (`:235`, `:267`) and `STATUS_IMMUNITY` (`StatusEffectSystem.js:40`). Every
  read of them resolves to 0 today.

- **Unwired or retired? — Unwired, and mostly *not yet* wired.** Evidence:
  `ARMOR`, `BLOCK` and `STATUS_IMMUNITY` are read by live code whose comments say
  the gear pass will supply them ("*gear block will slot into the same term*",
  "*no gear grants it yet*"). This is a consumer half built ahead of its
  producer, not a retired concept.
- **Important correction to CR2-029's impact statement.** It says *"items
  carrying those effects do nothing. The gear is weaker than its own description
  claims."* **No live item is affected.** `data/items.json` currently defines
  **six** items — `item_water`, `item_copper_ore`, `item_copper_ingot`,
  `item_oak_wood`, `item_charcoal`, and a malformed `item` with a blank name —
  and **not one carries `assignedEffect`, `assignedEffects`, `damage`, `defense`,
  `hpBonus`, `tickSpeedBonus` or `skillBonus`.** There is no equippable gear in
  the game at all beyond one drink. So this is **latent, not live**: a trap the
  gear pass will walk straight into, not a bug a player can hit today. That
  lowers the urgency and raises the value of fixing it *before* content is
  authored against these names.
  *(The malformed blank `item` entry is a content defect — Session 5.)*
- **Suggested fix**: Before any gear authoring, collect every live modifier-type
  string into one exported constants list (`EFFECT_TYPES` already exists and is
  the natural home — note `EquipmentManager` bypasses it entirely and uses bare
  uppercase strings, the same enforcement gap as CR2-039), and make
  `recalculateEquipmentModifiers` warn on a type with no registered consumer. The
  `default` branch already warns on an unknown *effect id*; the gap is that a
  **known** effect id mapping to an **unread** modifier type is silent.
- **Related**: CR2-029 (this supersedes its census), CR2-039, CR2-075, CR2-005.

---

### CR2-075 · P2 · S · Session 3 · Status: Open
- **Where**: `src/systems/combat/CombatProcessor.js:25,88-90`;
  `src/systems/combat/CombatAttackProcessor.js:58-59`;
  `src/systems/board/BoardCombat.js:101`
- **What**: **The fight object's `combat.stats` is created empty and never
  written to by anything.** It is the channel through which a hero's attack speed
  and flat damage bonus were meant to reach combat:
  `const attackSpeed = stats.attackSpeed || HERO_ATTACK_INTERVAL_MS` and
  `const damageBonus = stats.damageBonus || 0`. Grepped: the only two mentions of
  `combat.stats` in the whole codebase are the line that creates it empty and the
  line that reads it. `BoardCombat.createFight` also seeds `stats: {}` and never
  fills it.
- **Why it matters**: This is where `HASTE`, `TICKSPEEDBONUS` and `DAMAGE` from
  CR2-074 were supposed to land. Because the channel is empty, **every hero
  attacks at exactly 2500ms regardless of gear, skill or status**, and the flat
  damage bonus is always 0. The fallbacks make it look intentional and nothing
  errors. The card era populated this via `StatProcessor.calculateWorkcycleStats`
  — that module was deleted as dead on 2026-08-18, and nothing took over its job.
- **Suggested fix**: Either populate `stats` from the hero's aggregator at the
  top of `processCombat` (the natural home now `StatProcessor` is gone), or
  delete the indirection and read the aggregator directly at the two use sites.
  The second is simpler and removes a layer that has only ever been empty.
  Pairs with CR2-074's decision — do not fix one without the other.
- **Note**: fixed attack intervals *are* a locked decision for this pass (spec
  §5, weapon archetypes deferred). The finding is not "attack speed is fixed", it
  is that a live plumbing channel exists for it with no producer at either end.
- **Related**: CR2-074, CR2-027.

---

### CR2-076 · P2 · S · Session 3 · Status: Open
- **Where**: `src/systems/combat/LootSystem.js:82-116` (`handleTaskReward`);
  `src/systems/effects/EffectAxes.js` (whole file, 65 lines);
  `src/systems/effects/StatusEffectSystem.js:275-278` (`getYieldMultiplier`)
- **What**: **The Cookout yield buff does nothing, and the `EffectAxes` module is
  entirely dead.** All three are joined by one wire: `getYieldMultiplier` (which
  turns a hero's `yield_pct` statuses into an output multiplier) and
  `resolveYield` (the Token YIELD axis) have exactly **one** consumer between
  them — `LootSystem.handleTaskReward` — and **`handleTaskReward` has no callers
  at all.** CR2-020 records that it is uncalled; it does not record that three
  live features die with it.
- **Why it matters**: `statusRegistry.js:123` authors Cookout as *"+10% task
  output yield per stack"*. A player who eats one gets nothing, because the board
  awards production through `BoardRunner` → `SpriteLayer.addSprite` and that path
  never consults the hero's statuses. Separately, `EffectAxes.js` is a **second,
  dead implementation** of axis resolution: `BoardRunner` reimplemented all three
  axes against `TileModifiers.resolveAxis` (`:134`, `:192`, `:401`) and open-codes
  the same 1-second floor `EffectAxes.MIN_WORK_TIME_MS` exists to provide. Its own
  header documents consumers that no longer exist — `StatProcessor` and
  `WorkProcessor.consumeInputs`, both deleted.
- **Suggested fix**: Two separable jobs. (1) **Wire the hero yield buff into
  `BoardRunner`'s output calculation** so Cookout does what it says — small, and
  it makes an authored status real. (2) **Delete `EffectAxes.js`** once (1) is
  done, or, if the floors are worth keeping, move
  `MIN_WORK_TIME_MS`/`MIN_INPUT_COST` into `FormulaRegistry` and have
  `BoardRunner` import them instead of hardcoding `1000`.
- **Confidence**: The wiring gap is proven by grep and by the board's reward path.
  Not exercised in the running game (it needs a Cookout status plus a completing
  production cycle) — a five-minute check for Session 8.
- **Related**: CR2-020 (records the uncalled function, not its consequences),
  CR2-074.

---

### CR2-077 · P2 · S · Session 3 · Status: Open
- **Where**: `src/systems/combat/CombatResolutionProcessor.js:24-44, 81-111`
- **What**: **Roughly 45 of `handleVictory`'s 70 lines are card-era branches that
  can never run.** The fight object is built by `BoardCombat.createFight`
  (`BoardCombat.js:88-104`) and its shape is fixed and small. Every one of these
  reads a field that object never has:
  - `fight.hordeCount > 1` — never set. Horde handling, dead.
  - `fight.cardType === 'dungeon'` — never set. The whole dungeon branch
    (`enemyQueue`, `finalRewards`, `finalXpRewards`, the intermission respawn)
    is unreachable; `dungeonRegistry` was deleted.
  - `applyVictoryReward` + the `unifiedreward` trait lookup — `traits` is `[]` by
    construction, so this never fires. (`createFight`'s comment says the empty
    `traits` is deliberate, so this half is *known*; the horde and dungeon
    branches are not mentioned anywhere.)
  - `fight.originalTraits ? 'working' : 'idle'` — always `'idle'`.
  It is also the sole reason this module imports `InventoryManager` and
  `TransactionProcessor`.
- **Why it matters**: Objective 2 exactly — a retired system still wired in. It
  makes the one function that decides what a kill is worth read as though it
  handles four cases when it handles one, and it is on the hottest path in the
  game. Nothing is broken; the cost is that nobody can tell what victory actually
  does without tracing `createFight`.
- **Suggested fix**: Delete the horde, dungeon and unified-reward branches and
  the two now-unused imports. Keep a one-line note that a Token's rewards come
  from the enemy drop table. **Check first** whether hordes are a planned feature
  — if they are, this is 20 lines to re-add later and the deletion is still right
  now.
- **Related**: CR2-027 (`heroStatsForUi`, dead code in the same call path).

---

### CR2-078 · P2 · S · Session 3 · Status: Open
- **Where**: `src/utils/CombatFormulas.js:243-316`; `src/config/FormulaRegistry.js`
- **What**: **Eight exported combat-display helpers have no callers anywhere in
  `src/`** — `getHeroDamageRange`, `getEnemyDamageRange`, `getHeroBlockChance`
  (reached only from inside `calculateHitChance`), `calculateHitChance` itself
  (only from `rollHit`), `getCritChance`, `getHeroAttackSpeed`,
  `calculateRpsMultiplier`, `calculateDefenceReduction`. `FormulaRegistry` adds
  five more with zero consumers: `toolSpeedMultiplier`,
  `GLOBAL_COMBAT_XP_MULTIPLIER`, `MAX_SKILL_LEVEL`, `heroAttackSpeed`,
  `defenceReduction`.
- **Why it matters, and this is the real finding**: `getCritChance`'s comment
  claims *"The combat info panels read this so they pick up the real value
  automatically when it's implemented."* **There are no combat info panels.**
  Nothing in `src/ui/` imports `CombatFormulas` at all. This is the **sixth**
  documented case in this project of a confident comment describing machinery
  that does not exist — after `theme`, rarity, `tokenConstants` (CR2-039), the
  deposit rule (CR2-033) and the sell-value comment. The practical harm is the
  same each time: it tells the next reader the wiring is done, so they don't
  check. The deferred crit/armor/speed work is a **locked decision and not a
  finding**; the false claim about who reads the hooks is.
- **Suggested fix**: Correct the comment to say plainly that nothing reads these
  yet. Then decide per function: the four `@deprecated` shims
  (`calculateRpsMultiplier`, `calculateDefenceReduction`, `defenceReduction`,
  `heroAttackSpeed`) name a "legacy combat path" that no longer exists and should
  go; the range/crit helpers are genuine hooks for the deferred passes and are
  worth keeping **with an honest comment**.
- **Related**: CR2-039, CR2-033, `concept_audit.md`.

---

### CR2-079 [DECIDED: keep, fix] · P2 · S · Session 3 · Status: Open — **owner decision**
- **Where**: `src/systems/hero/ConsumptionSystem.js:145-184`
  (`consumeLoopConsumables`, `getConsumables`)
- **What**: **The Consumable category of the hero loadout grid never fires.**
  `consumeLoopConsumables` — the D-20 "Prep Phase", one of each equipped
  Consumable spent at the head of every loop — has **no callers**. Neither does
  `getConsumables`, `needsFood` or `needsDrink`. A hero can equip potions,
  scrolls and runes into their nine-slot grid and nothing ever spends or applies
  them. `DefeatPenalties` will still destroy a quarter of their banked stack on
  defeat (`DefeatPenalties.js:51-56`), so the category **costs** the player
  without ever paying out.
- **Why it matters**: The Drink slot being dormant is a **documented decision**
  (`loopConstants.js:59-77`, roadmap G-8, D-183/D-184 cut Energy) and is
  correctly excluded here — `tryDrink` is deliberately dormant, not a finding.
  Consumables are **not** covered by that note; Energy was never their currency.
  So this looks like collateral from the deck-loop deletion rather than a
  decision, and `equipmentConstants` still offers the category, so the UI still
  lets the player fill those slots.
- **Owner decision** — which is it?
  - **(A) Collateral damage; Consumables should fire on the board.** The board's
    natural equivalent of "head of the loop" is the start of a Token cycle, which
    `BoardRunner` already knows about. Small wiring job.
  - **(B) Retired with the deck loop.** Then remove the Consumable category from
    `equipmentConstants` so the grid stops accepting them, and stop
    `DefeatPenalties` charging for them. **Recommended if the Prep Phase concept
    died with the deck** — a slot that only ever loses you items is worse than no
    slot.
  - **(C) Dormant like Drink.** Legitimate, but then say so in the code the way
    `loopConstants.js` does for Drink, so the next reader stops re-finding it.
- **Related**: `loopConstants.js:59-77` (the Drink precedent), CR2-074.

---

### CR2-080 · P2 · S · Session 3 · Status: Open
- **Where**: `src/systems/equipment/EquipmentManager.js:309-326`
  (`reduceDurability`); callers at
  `src/systems/combat/CombatAttackProcessor.js:97, 151-162`
- **What**: **Durability is retired (D-118) and `reduceDurability` is a
  documented no-op — but combat still calls it on every single attack**, and the
  enemy-attack path wraps it in a loop that walks the hero's whole loadout and
  rolls `Math.random()` per gear piece to decide whether to "wear" it. All of it
  resolves to `return null`. The function's own comment says *"This no-op stays so
  combat's attack path keeps one call shape while the board combat port settles in
  Phase 6; **it is removed there**."* **Phase 6 landed.** It was not removed.
- **Why it matters**: Performance (the standing objective) on the hottest path in
  the game — a `getEquippedEntries(hero)` array build plus one `Math.random()`
  per equipped item, every enemy attack, every fight, forever. It also carries a
  12-line comment block explaining a mechanic that no longer exists, sitting in
  the middle of the equipment module.
- **Suggested fix**: Delete `reduceDurability` and both call sites, including the
  whole incidental-wear loop in `processEnemyAttack`. The D-118/risk-12 note about
  defeat-loss being the only way gear leaves a hero is worth keeping — move it to
  `DefeatPenalties.js`, which is where that rule actually lives.
- **Related**: CR2-077 (same "the rework's cleanup step never ran" shape).

---

### CR2-081 · P3 · S · Session 3 · Status: Open
- **Where**: throughout the territory — the notable ones:
  `CombatResolutionProcessor.js:50-52` ("the hero↔area binding is owned by
  `LoopRunner._forcedRetreat`"), `StatusEffectSystem.js:12` and `:112`
  ("routes through the normal Forced Retreat in `LoopRunner`", "LoopRunner's
  per-area check"), `GuildModifiers.js:53` ("`StatProcessor.calculateWorkcycleStats`
  shows the correct pattern"), `EffectAxes.js:12-14` (`StatProcessor`,
  `WorkProcessor.consumeInputs`), `HeroManager.js:41` ("heroes bind to AREAS now,
  via `systems/area/HeroAssignmentManager.js`"),
  `HeroGenerator.js:122` ("Six equipment slots: hand1, hand2, hat, chest,
  trinket1, trinket2"), `StatusEffectSystem.js:292-293` ("nothing publishes
  `CYCLE_COMPLETE` until the board runner lands in Phase 4")
- **What**: Nine comments across the territory point at modules that were
  **deleted** (`LoopRunner`, `StatProcessor`, `WorkProcessor`,
  `systems/area/HeroAssignmentManager`), or describe a state that stopped being
  true months ago (nine generic slots, not six named ones; `CYCLE_COMPLETE` has
  had publishers since Phase 4).
- **Why it matters**: Individually trivial, but two of them are load-bearing
  misinformation rather than clutter — the `LoopRunner` references are exactly
  what stops a reader noticing **CR2-070**, because they assert that something
  else handles the case. This is the pattern this review keeps meeting: the
  comment survives its subject and reads as current.
- **Suggested fix**: Correct or delete each. Cheap, and worth doing in the same
  wave as CR2-070 so the fix and the explanation land together.
- **Related**: CR2-070, CR2-078, CR2-039.

---

### CR2-082 · P3 · S · Session 3 · Status: Open
- **Where**: `src/utils/XPCurve.js:14-40, 80-98`
- **What**: **The pre-computed XP table is built at module load and then never
  used.** `XP_TABLE` is populated for all 100 levels, exposed via `getXpTable` and
  `XP_CURVE_TABLE` — **neither has a single caller**. Meanwhile `levelFromXp`,
  which *is* on a hot path, ignores the table and calls `xpForLevel` in a loop —
  and `xpForLevel` is itself a loop with a `Math.pow` per iteration. Worst case
  that is ~4,900 `Math.pow` calls for one `levelFromXp`.
- **Why it matters**: `levelFromXp` runs on **every** `addXP` — every completed
  work cycle of every staffed tile, plus every kill. `FormulaRegistry.js:257` even
  advertises *"the actual XP curve implementation lives in XPCurve.js with its
  pre-computed table"*, which is true of the file and false of the code path.
  A high-level hero on a busy board is the expensive case; a level-1 hero exits
  the loop immediately, which is why this has never been noticed.
- **Suggested fix**: Have `levelFromXp` and `xpForLevel` read `XP_TABLE`
  (a binary search, or just a scan over the array). Behaviour identical, and the
  table finally earns its keep. Delete `xpToNextLevel` and `XP_CURVE_TABLE` if
  they stay unused.
- **Confidence**: The wiring gap is certain. The *magnitude* of the cost is not
  measured — Session 8 owns the tick-path profile and should confirm whether this
  shows up at all before it is prioritised above the P1s.
- **Related**: Session 8; performance standing objective.

---

### CR2-083 · P3 · S · Session 3 · Status: Open
- **Where**: across the territory
- **What**: Dead-export census for Session 3, gathered while tracing both ends of
  every wire. None is individually interesting; together they are the residue
  three reworks left behind.
  - **Card-era state still written on every hero**:
    `HeroState.setAssignment` (writes `hero.assignedCardId`) has **no callers**,
    yet `HeroGenerator` still initialises `assignedCardId: null` on every hero and
    villager and it is saved with them. Heroes bind to **tiles** now
    (`board.heroTiles`).
  - **`WoundedSystem.woundHero` is never called** — every wound route
    (`handleHeroWounded`, `BoardCombat.resolveDefeat`) sets the status directly.
    So the `hero_wounded` event is **never published** (nothing subscribes, so
    nothing breaks), and the recovery timer is set lazily by `processWoundedTick`
    instead. Works, but by accident rather than by design.
  - **`GuildModifiers`** is imported only by `TileModifiers.js:240`, which reads
    an aggregator nothing ever writes to — self-documented as "currently unused",
    so this is expected, not a defect. Recorded so it is not re-found.
  - **No callers at all**: `SkillSystem.getTotalSkillLevels`, `getHeldSkillIds`,
    `getSkillProgress`; `PromotionSystem.getSkillSheet`, `getAvailablePromotions`;
    `HeroLookup.getIdleHeroes`, `getHeroLevel`; `HeroRoster.reorderHero`;
    `RegenSystem.getRegenConfig` and `reset`;
    `EquipmentValidator.canEquipToSlot`; `ModifierAggregator.getLogicOverrides`
    (and its `EFFECT_TYPES.LOGIC_OVERRIDE`);
    `EquipmentManager.syncEquipmentModifiers`.
  - **`EFFECT_TYPES` entries with no producer and no consumer**: `LOOT_MULT` and
    `FAIL_CHANCE` are live on the board side, but `HP_REGEN`, `THORNS_REFLECT`,
    `STAT_BONUS` and `LOGIC_OVERRIDE` are referenced nowhere outside the
    declaration and tests.
- **Suggested fix**: Handle as one sweep after the P1s, not piecemeal. Two need a
  decision rather than deletion: `assignedCardId` is **saved state**, so removing
  it is a save-shape change (coordinate with CR2-023, which already proposes a
  hero-strip list); and `getAvailablePromotions`/`getSkillSheet` are plausibly
  the UI surface the promotion feature still wants.
- **Related**: CR2-023, CR2-012, CR2-020.

---

## Session 3 notes on already-filed tickets

- **CR2-011 (silent loot failure) — CONFIRMED and MUCH WIDER than filed.** The
  ticket names one enemy and one missing item. Every enemy is affected. Checked
  `data/enemies.json` against `data/items.json`, then **reproduced at runtime**
  by running `LootSystem.generateDrops` 2,000 times per enemy:

  | Enemy | Drop entries | Missing from `items.json` | Kills yielding **nothing** |
  |---|---|---|---|
  | `enemy_copper_miner` | 4 | `hat_miners_helm`, `item_copper_sword` | **23.3%** |
  | `enemy_thorn_elemental` | 1 | `item_blackberry` | **100%** |
  | `enemy_skeleton_warrior` | 1 | `amulet_iron_chain` | **100%** |
  | `enemy_cow` | 2 | `item_beef`, `item_bones` | **100%** |

  **Three of the four enemies in the game can never drop anything at all**, and
  the fourth comes up empty about one kill in four. Not one warning is logged.
  This is a much stronger case for CR2-011's "the second part matters more".
- **The silent-swallow site, as requested.** It is
  `LootSystem._rollEntryDetails` at **`LootSystem.js:201-203`**:
  `const item = getItem(itemId); if (!item) return null;` — an unresolvable id
  returns `null`, `_processCluster` passes it up, `generateDrops` filters it out,
  and `handleCombatVictory` publishes `loot_generated` with an empty array. Four
  layers, no warning at any of them. Note also that because `_processCluster`
  picks **exactly one** entry per cluster by weight, a dead id does not merely
  fail — it **consumes the roll**, so a table with one bad entry loses that share
  of its drops rather than redistributing them. Session 2 found `SpriteLayer.addSprite`
  accepts any `itemId` without checking (CR2-063); this is the layer above it, and
  the two together mean a bad id can pass through the entire loot pipeline
  unremarked. One `logger.warn` at `LootSystem.js:203` would have caught all of it.
- **CR2-029** — confirmed, corrected and superseded by **CR2-074**. Its census of
  seven is really nine, it misses the reverse gap (three types read but never
  written), and its stated impact ("items carrying those effects do nothing") has
  **no live victims** because no authored item carries any of them.
- **CR2-027** (`heroStatsForUi`) — **confirmed still live**, `CombatProcessor.js:74,92-99`.
  Nothing reads it. Worth noting for the fix wave that it also reads
  `fight.isFleeing`, which **nothing ever sets** — so the array is dead *and*
  half its contents are constant. Fold into CR2-077's cleanup; same function.
- **CR2-028** (status tick publishes `heroes_updated` unconditionally) —
  **confirmed still live**, `StatusEffectSystem.js:110`, published per hero per
  5s tick whether or not the tick changed anything. Note it is *inside* the
  per-hero loop, so N heroes with statuses means N broadcasts every 5 seconds.
- **CR2-040** (equipment re-packed on load) — confirmed present at
  `HeroRehydration.js:45-51`; Session 1 owns it, nothing to add. One adjacent
  observation for the same fix: `rehydrateHero` also unconditionally deletes
  `lastEatenAt`/`lastDrunkAt` and bumps `_rev`, so a "no-op" load still mutates
  every hero.
- **CR2-016** (combat audio) — the publishers are in this territory and still send
  `cardId: fight.id`, i.e. `fight_10`. The fix removed the focus gate, so the id
  no longer gates anything, but the **payload key is still `cardId`** across all
  six combat events. Renaming it to `anchorId`/`tile` is the follow-up CR2-016
  anticipated; it is safe now that the gate is gone.
- **CR2-036** (lint residue) — **0 of the 32 remaining lint problems fall in this
  territory.** Nothing to claim.
- **`ConsumptionSystem.tryDrink` is NOT a finding** — it has no callers, but that
  is the documented D-183/D-184 Energy cut, recorded at `loopConstants.js:59-77`
  and roadmap G-8. Recorded here so no later session re-files it.

---

## Filed by Session 4 — Gameplay services & shared utilities (2026-08-19)

**Territory read in full:** `systems/economy/` (4), `systems/inventory/` (4),
`systems/quests/` (2), `systems/progression/` (3), `src/utils/` (7 — the
Session-3-owned `CombatFormulas`, `RetirementFormula` and `XPCurve` excluded),
`config/guildUpgrades.js`, `config/constants.js`. 23 files, ~3,050 lines.

**Tooling re-run over the territory.** `npm run lint`: **2 of the 32 remaining
problems fall here** (`InventoryGroupManager.js:41`, `QuestManager.js:281`) —
both are folded into tickets below rather than left on CR2-036. `npm run
duplication`: the only clone in this territory is `QuestManager.js` repeating a
passage of itself (the `token_placed` / `TILE_CHANGED` handler pair — which turns
out to be the double-count bug, CR2-085). `node tools/reachability.mjs`:
`config/questConfig.js` is **already deleted** (commit `dc23ca9`); the guide's
Session 4 row is stale on that point.

**Runtime verification.** Six findings below were reproduced in the running game
(marked *reproduced*), not merely read. Save-slot handling is recorded at the end
of this section.

---

### CR2-084 · P1 · S · Session 4 · Status: Open
- **Where**: `src/systems/quests/QuestManager.js:30-35` (`RANDOM_HUNTS`) against
  `data/enemies.json`; the filter at `:261-263`
- **What**: **Every "hunt" bounty in the game is impossible to complete.** The
  bounty pool names its enemies `goblin`, `wolf`, `bandit`, `skeleton`. The
  content set defines `enemy_copper_miner`, `enemy_thorn_elemental`,
  `enemy_skeleton_warrior` and `enemy_cow`. `combat_victory` carries the real id,
  and `reportProgress` skips any quest whose `enemyId` does not match it exactly,
  so the counter never moves no matter how many enemies the player kills.
- **Reproduced**: two identical hunt quests were installed, one with the pool's
  `skeleton` and one with `enemy_skeleton_warrior`, and one `combat_victory` was
  published. The real-id quest advanced 0→1; the pool-id quest stayed at 0.
  Sampling `createRandomQuest()` eight times produced three hunts
  ("Defeat 3 Skeletons", "Defeat 2 Bandits", …), so this is roughly **half of
  everything the player is offered after the tutorial**.
- **Why it matters**: Once the 13 tutorial quests are done, hunt bounties are one
  of only two quest types, and the reward is a Map — the game's progression
  currency. A player will take a hunt, kill the enemy repeatedly, watch a counter
  that never moves, and have to abandon it and sit out a five-minute cooldown.
  Nothing errors and nothing explains it.
- **Suggested fix**: Two parts. (a) Repoint the pool at ids that exist — note that
  `goblin`, `wolf` and `bandit` have no content equivalent at all, so three of the
  four entries need replacing, not just prefixing. (b) The deeper fix: build the
  pool from `enemyRegistry` at runtime instead of a hardcoded list, so a bounty
  can only ever name an enemy that exists. The same shape as CR2-011 and CR2-044 —
  a hardcoded id list drifting away from authored content.
- **Related**: CR2-011, CR2-044, CR2-085.

---

### CR2-085 · P1 · S · Session 4 · Status: Open
- **Where**: `src/systems/quests/QuestManager.js:159-180` and `:182-190`
- **What**: **Two more quest counters double-count, beyond the two Session 2
  filed.** Session 2 found that opening one Map counts as two (CR2-052) and
  placing one Token counts as two (CR2-053). Walking the rest of
  `setupListeners` finds the same fault twice more, from the same two
  subscription pairs:
  - **`context_token_placed`** — the `token_placed` handler and the
    `TILE_CHANGED` handler each run the identical "is this a context Token?"
    block, and `placeToken` publishes both events.
  - **`hero_deployed`** — `Placement.placeHero` publishes `HERO_MOVED` *and*
    `hero_deployed` when the target tile holds a Token (`Placement.js:471-475`),
    and `QuestManager` subscribes to both; the `HERO_MOVED` handler's guard
    ("is there a Token here?") is true in exactly the same case.
- **Reproduced**: with counters set to a high target so the cap could not mask
  it — one `placeToken` of a context Token advanced both `token_placed` and
  `context_token_placed` by **2**; one `placeHero` onto an occupied tile advanced
  `hero_deployed` by **2**.
- **Why it matters**: Masked today only because tutorials 4 and 11 ask for one, so
  the `Math.min(requiredCount, …)` cap hides it. Any future quest asking for more
  than one completes at half the stated number. Together with CR2-052/053 this is
  **all four** of QuestManager's dual-source counters, which makes it a
  structural fault rather than four accidents: the manager treats
  `token_placed`/`TILE_CHANGED` and `hero_deployed`/`HERO_MOVED` as independent
  signals when each pair reports the same action.
- **Suggested fix**: Fix all four together. Pick the semantic event
  (`token_placed`, `hero_deployed`) as the quest signal and drop the two
  board-lifecycle subscriptions (`TILE_CHANGED`, `HERO_MOVED`) entirely — they
  exist to redraw the UI, not to describe a player action. Then check the chosen
  events fire on every route (Session 2's CR2-053 already asks whether `moveToken`
  should count).
- **Related**: CR2-052, CR2-053 (do not fix separately), CR2-088.

---

### CR2-086 [DECIDED: retire the mechanic] · P1 · S · Session 4 · Status: Open — **owner decision**
- **Where**: `src/utils/RecruitCostCalculator.js:30-43`;
  `src/state/StateSchema.js:84`; `src/systems/hero/logic/HeroLifecycle.js:88-96`;
  `src/systems/progression/GuildUpgradeManager.js:83-91`
- **What**: **The recruit cost is permanently 10 and can never change.** The
  formula is `10 + project bonuses + 2 × totalRecruits`, but **neither input is
  ever written**: `currency.totalRecruits` is declared in the schema with the
  comment "*cost increases +2 per*" and is incremented by nothing anywhere in
  `src/`; `progress.completedProjects` is never written either (Projects were
  retired). So both terms are always 0.
- **Reproduced**: recruiting a hero through the only route the game offers (the
  Guild Hall `roster_size` upgrade) left `totalRecruits` at 0 and `influence` at
  10. Forcing `totalRecruits = 7` by hand made `calculateRecruitCost()` return 24,
  confirming the formula works and simply never receives an input. All three of
  the owner's save slots read `"totalRecruits": 0`, one of them after a
  56-minute session with two heroes.
- **Why it matters**: This number is not cosmetic — it is the **gate on retiring a
  hero**. `retireHero` refuses unless the Influence payout exceeds the recruit
  cost, so the gate is a flat "payout > 10" forever, and the intended design
  (retirement gets harder as the guild grows) does not exist. It also means the
  comment in `StateSchema` describes machinery that isn't there — the seventh
  documented case of confident prose describing a feature that was never wired.
- **Also in this file**: `getRecruitCostBreakdown()` has **zero callers**, and its
  `total` omits the `2 × totalRecruits` term, so it would report 10 where
  `calculateRecruitCost()` reports 24. If it is ever shown to a player it will
  disagree with the price charged. **And a second implementation of the same
  number exists**: `FormulaRegistry.recruitCost(totalRecruits)` returns
  `10 + totalRecruits * 2` and has no callers either.
- **Owner question**: what should recruiting cost?
  - **(A)** Restore the escalator: increment `totalRecruits` wherever a hero is
    added, delete the dead Projects term, delete `getRecruitCostBreakdown` and
    `FormulaRegistry.recruitCost`. **Recommendation** — smallest change that makes
    the retirement gate behave as written.
  - **(B)** Accept a flat cost: replace the whole file with a constant and simplify
    the retirement gate to read it. Honest, and deletes ~60 lines.
  - **(C)** Rethink it alongside CR2-093 (Influence is never spent), since recruit
    cost and Influence are two halves of one economy that currently has no loop.
- **Related**: CR2-093, CR2-106.

---

### CR2-087 [BLOCKS the Codex screen] · P1 · S · Session 4 · Status: Open
- **Where**: `src/systems/progression/RegistryManager.js:82-116`
  (`recordEnemyDefeat`) against `src/systems/core/DiscoveryManager.js:57-77`
  (`discoverEnemy`); read by `src/ui/hooks/useDiscovery.js:20`
- **What**: **Enemy kill counts are never recorded.** There are two
  implementations of "an enemy was met": `DiscoveryManager.discoverEnemy` (live,
  called from three combat subscriptions) and `RegistryManager.recordEnemyDefeat`
  (**zero callers anywhere**). The live one sets `discoveredEnemies` only; the
  dead one is the only thing that would increment `collection.enemyKillCounts`.
  So `enemyKillCounts` is written by nothing while `useDiscovery` reads it.
- **Confirmed from the owner's saves**: slot 0 has
  `discoveredEnemies: {enemy_copper_miner: true}` and `enemyKillCounts: {}` —
  combat happened, kills counted zero.
- **Why it matters**: The Bestiary/Codex has a "how many have you killed" number
  that will always read 0. It is also the two-live-answers pattern in its purest
  form: two functions that both publish `enemy_discovered` and both send the same
  "Unlock: X" notification, one of which nothing calls. Whoever adds Bestiary
  progression next will not be able to tell which is canonical.
- **Suggested fix**: Decide one owner for enemy discovery. **Recommendation**: keep
  `DiscoveryManager` (it is the one wired to combat) and move the kill-count
  increment into it, then delete `recordEnemyDefeat`. Note that `discoverEnemy` is
  called on *every attack*, not on defeat, so a kill counter cannot simply be
  added there — it needs a `combat_victory` subscription.
- **Related**: CR2-098 (the rest of `RegistryManager`'s unread output).

---

### CR2-088 · P1 · S · Session 4 · Status: Open
- **Where**: `src/systems/quests/QuestManager.js:181, 212, 213, 215, 216`
- **What**: **Five of `QuestManager`'s 20 subscriptions listen for events that
  nothing in the codebase publishes**: `context_connected`, `board_recall`,
  `return_to_tray`, `recipe_satisfied`, `hero_equipped`. Grepped across `src/`,
  `cms/src/` and the tests — the only `hero_equipped` publish anywhere is inside
  `QuestSystem.test.js`, which is why the suite is green.
- **Why it matters**: Two quest target types are therefore **unreachable**:
  `recipe_satisfied` and `quick_recall`. No current quest uses them, so nothing is
  broken for the player *today* — but they read as supported, and the next person
  authoring a quest will use one and it will silently never complete. Two of the
  five (`context_connected`, `hero_equipped`) are harmless duplicates: the same
  progress is delivered by a different subscription that does fire.
- **Suggested fix**: Delete the three genuinely dead subscriptions
  (`context_connected`, `recipe_satisfied`, `hero_equipped`) and decide on
  `board_recall`/`return_to_tray` — if "quickly recall a Token" is a wanted quest
  step, the engine's recall path must publish something; if not, delete both. Then
  add a comment listing the target types a quest may legally use, since that
  vocabulary currently exists only as the set of strings in this function.
- **Confidence**: The publisher gap is confirmed by grep. That
  `hero_equipment_changed` fully covers `hero_equipped` **is confirmed** —
  `EquipmentManager.js:98` publishes `action: 'equip'`, and tutorial 8 is
  therefore completable.
- **Related**: CR2-085.

---

### CR2-089 · P2 · S · Session 4 · Status: Open
- **Where**: `src/systems/inventory/InventoryManager.js:241-265` (`createGroup`)
  against `src/systems/progression/GuildUpgradeManager.js:132-143`
  (`_ensureBankTabs`)
- **What**: **Creating a custom Bank tab is impossible, by two independent
  causes.** `createGroup` refuses when `groupOrder.length >= maxTabs`. But
  `GuildUpgradeManager.recompute()` — which runs on **every** `game_loaded` and
  every upgrade purchase — calls `_ensureBankTabs`, which *pads* `groupOrder` with
  `bank-tab-N` entries until it equals `maxTabs`. So the limit is always already
  reached and `createGroup` can never succeed. Separately, **no UI calls
  `createGroup` at all** — nor `renameGroup`, `deleteGroup` or `reorderGroups`.
  `BankTab.jsx` uses only `moveItemToGroup` and `setGroupOrder`.
- **Reproduced**: `InventoryManager.createGroup('S4Test')` in the running game
  returned `null` and fired the "Bank tab limit reached — unlock more via Guild
  Hall upgrades" warning, on a save that had just been loaded. That save's stored
  `groupOrder` was `['default-loot']`; after load it was five entries.
- **Why it matters**: ~90 lines of group-management code — create, rename, delete,
  reorder — that no player can reach, plus a warning message the player can never
  act on because buying the upgrade also creates the tab. It also means the
  `bank_tabs` upgrade's real behaviour is "you get a tab called *Tab 6*", not
  "you may now name a tab", which is what `createGroup` was written for.
- **Suggested fix**: Owner decision on the feature, then delete or wire. If custom
  named tabs are wanted, `_ensureBankTabs` should pad to a *minimum* rather than
  to exactly `maxTabs`, or the two should be separate counters. If not, delete the
  four unreachable methods and simplify the upgrade to what it actually does.
- **Related**: CR2-090.

---

### CR2-090 · P2 · S · Session 4 · Status: Open
- **Where**: `src/systems/economy/InventoryGroupManager.js` (whole file, 102
  lines); registered at `src/systems/core/EngineBootstrap.js:17, 69, 279`
- **What**: **Nothing consumes this module.** `getGroupedInventory`,
  `getItemGroupId` and all five delegating facades have zero callers in `src/`,
  `cms/src/` or the tests. `EngineBootstrap` imports it, exposes it on the engine
  object the whole UI reads through, and calls `init()` — which is an explicit
  no-op. The UI does its grouping itself in `BankTab.jsx`, calling
  `InventoryManager` directly.
- **Why it matters**: Being on the engine object makes it look like live public
  API, so every reachability tool reports it as used and every reader assumes it
  is the way to group items. It is the "abstraction layer nobody adopted" shape,
  and it is one of the modules `npm run cycles` names in the 16-module lazy group,
  so it inflates that result too. `TokenGroups.js:17,31` cites it as the model its
  own design follows, which is how a dead module acquires authority.
- **Also (the lint hit)**: line 41 destructures `itemOverrides` and never uses it —
  `getItemGroupId` re-reads it from state instead. One of the 2 lint problems in
  this territory.
- **Suggested fix**: Delete the file and its `EngineBootstrap` registration, after
  confirming with Session 6/7 that no UI work in flight intends to adopt it.
  Update `TokenGroups.js`'s header so it stops pointing at a deleted file.
- **Related**: CR2-089.

---

### CR2-091 · P2 · S · Session 4 · Status: Open
- **Where**: `src/systems/progression/ProgressionSystem.js` (whole file);
  `src/systems/core/EngineBootstrap.js:18, 75`; `src/state/StateSchema.js:115, 125`
- **What**: **A whole named system with no callers, kept alive by a false
  comment.** `ProgressionSystem.unlockArea` is called by nothing; the
  `area_unlocked` event it publishes has no subscribers;
  `collection.unlockedAreaSets` is read by nothing. Its own comment says the
  method "*survives only because the dormant quest system still calls it*" — that
  system (`QuestBoardSystem`) was **deleted**. `StateSchema.js:125` repeats the
  claim: "*vestigial; read only by dormant quests*".
- **Why it matters**: Two documents now assert a caller that does not exist, and
  the file describes itself as "*The definitive authority for World Progression
  and Discovery*". This is the **sixth** documented instance in this codebase of
  confident prose describing machinery that is not there (after `theme`, rarity,
  `tokenConstants` CR2-039, `DiscoveryManager` CR2-046, `TokenBank`'s sell value
  CR2-066). Area sets were retired by owner ruling (guide Q3), so the concept
  behind it is settled — only the code is left.
- **Suggested fix**: Delete `ProgressionSystem.js` and its `EngineBootstrap`
  registration; strip `unlockedAreaSets` from `StateSchema` and correct the two
  comments. Note this is a *save-shape* change, so it belongs with CR2-042's
  schema pass rather than as a drive-by.
- **Related**: CR2-042, CR2-039, CR2-046, CR2-066; guide "Owner rulings" Q3.

---

### CR2-092 · P2 · S · Session 4 · Status: Open
- **Where**: ten publish sites across this territory
- **What**: **Ten events are published and subscribed to by nothing.** Verified by
  grepping `src/`, `cms/src/` and the tests for each name:

  | Event | Published by | Subscribers |
  |---|---|---|
  | `influence_changed` | `CurrencyManager` ×2 (labelled "backwards compatibility") | 0 |
  | `item_sold` | `CommerceSystem.sellItem` | 0 |
  | `transaction_applied` | `TransactionProcessor.apply` | 0 |
  | `inventory_slots_full` | `InventoryManager.addItem` | 0 |
  | `inventory_stack_full` | `InventoryManager.addItem` ×2 | 0 |
  | `inventory_durability_updated` | `InventoryManager.decrementDurability` | 0 |
  | `discovery_seen` | `RegistryManager.markAsSeen` | 0 |
  | `collection_updated` | `GuildUpgradeManager.recompute` | 0 |
  | `area_unlocked` | `ProgressionSystem.unlockArea` | 0 |
  | `map_reward_spawned` | `QuestManager.claimQuest` | 0 |

  (For contrast, the neighbouring `item_discovered`, `inventory_overflow`,
  `currency_changed`, `map_tossed` and `guild_upgrades_updated` all have live
  subscribers — this is not a territory-wide fault.)
- **Why it matters**: Individually harmless — an unheard publish costs almost
  nothing. Collectively they are a map of features that were designed and never
  finished, and two of them are *actively misleading*: `inventory_slots_full` and
  `inventory_stack_full` read as "the UI will tell the player their Bank is full",
  and it does not (the D-138 handoff to the board does the telling, via
  `inventory_overflow`, which *is* subscribed). `map_reward_spawned` sits beside
  `map_tossed`, which **is** consumed by `ParticleOverlay` — so claiming a quest
  publishes two events describing the same reward and only one is heard.
- **Suggested fix**: Delete the ones with no plausible consumer. Keep
  `influence_changed` only if CR2-093 resolves in favour of keeping Influence, and
  if so drop the duplicate anyway — `currency_changed` already carries `type`.
- **Related**: CR2-046 (Session 1's equivalent list for the core), CR2-093.

---

### CR2-093 [DECIDED: cut] · P2 · S · Session 4 · Status: Open — **owner decision**
- **Where**: `src/systems/economy/CurrencyManager.js:130-136`;
  `src/systems/hero/logic/HeroLifecycle.js:109`; `src/state/StateSchema.js:82`
- **What**: **Influence can be earned but never spent.** `spendInfluence` /
  `spendCurrency('influence', …)` has **zero callers** anywhere. The only source
  is retiring a hero; the only other mention is a dev button on `TestDashboard`
  that adds 100. The file's own header says Influence is "*used for: recruiting
  heroes… selecting Area Projects*" — recruiting is now a **gold** purchase
  through the Guild Hall `roster_size` upgrade, and Area Projects are retired.
- **Reproduced**: recruiting a hero left `influence` unchanged at 10. All three
  save slots sit at exactly the starting 10.
- **Why it matters**: A currency with no sink is a number that goes up and means
  nothing, and it occupies UI space. `BubbleMenu.jsx:45` already carries a note
  that "*influence may be cut entirely*", so the question is live rather than new.
- **Owner question**:
  - **(A)** Cut Influence. Delete the currency; the retirement payout becomes gold
    (or nothing) and `RetirementFormula` is repointed. Cleanest; touches the save
    shape. **Recommendation** if no near-term plan exists for it — a second
    currency earns its keep only when something charges it.
  - **(B)** Keep it and give it a sink — the natural one is making recruitment cost
    Influence again, which also resolves CR2-086.
  - **(C)** Leave as-is and document it as reserved for a future feature.
- **Related**: CR2-086, CR2-092.

---

### CR2-094 · P2 · S · Session 4 · Status: Open
- **Where**: `src/systems/quests/QuestManager.js:205-209` against
  `src/ui/hooks/useUIModals.js:87, 137`
- **What**: **Three tutorial quests only advance because a React hook publishes
  the event they listen for.** `ui_modal:opened` is published solely by
  `useUIModals`, and `QuestManager` maps its `modalId` to the `open_bank`,
  `open_vault` and `open_cartographer` targets (tutorials 7, 9 and 12). No engine
  code publishes it.
- **Why it matters**: This is precisely the shape of CR2-033 — a game rule whose
  only enforcement point is inside the React layer — and it carries the same
  failure mode: any other route to the Bank (a keyboard shortcut, a contextual
  "open your Bank" prompt, a future redesign of the drawer) advances no quest
  unless it happens to go through this one hook. It is currently *correct* — the
  three `modalId` strings were checked against the two publish sites — but correct
  by coincidence of string literals in two files that know nothing about each
  other.
- **Suggested fix**: Lower-risk than CR2-033 because nothing is presently broken.
  Two options: (a) treat `ui_modal:opened` as a legitimate UI→engine notification
  and document it in a contract file the way `boardEvents.js` documents board
  events, listing the valid `modalId` values; (b) have the engine own a panel
  manager. **Recommendation: (a)** — the drawer really is a UI concern, and the
  defect here is undocumented coupling, not misplaced logic.
- **Related**: CR2-033, CR2-088.

---

### CR2-095 · P2 · S · Session 4 · Status: Open — **the `deltaMs` verdict**
- **Where**: `src/systems/quests/QuestManager.js:281-296` (the lint hit);
  `src/systems/inventory/ItemRateTracker.js:23, 46, 74`
- **What**: **Two systems in this territory measure time with the wall clock while
  the engine can be running at up to 10× game speed.** `TimeBankManager` fast-
  forwards by setting `TimeManager.timeScale`, so the `delta` every tick handler
  receives is *game* time (`realElapsed × multiplier`) while `Date.now()` stays
  real. Anything using `Date.now()` is therefore on a different clock from the
  rest of the engine.
  - **`QuestManager.tick(deltaMs)` ignores `deltaMs`** and reads `Date.now()`.
    Having traced every use, the only clock-sensitive thing it does is the
    **5-minute abandon cooldown** (`ABANDON_COOLDOWN_MS`, `readyAt`). Everything
    else `tick` does is state-driven, so `deltaMs` genuinely has no other use.
    Effect: abandoning a bounty locks the slot for five *real* minutes. Burning
    time bank at 10× advances the world fifty minutes and the slot still is not
    back. From the player's side, fast-forward — the game's one lever for skipping
    a wait — does not skip this wait. (The reverse also holds and is benign: time
    spent with the game closed is banked, not passed, yet the wall clock moves, so
    coming back after a break always finds the slot refilled.)
  - **`ItemRateTracker`** timestamps every gain with `Date.now()` and divides by
    elapsed real time to produce an items-per-hour figure, **which is shown to the
    player** on the item toast (`NotificationSubscriptions.js:44`, refreshed on a
    10-second heartbeat). Under 10× fast-forward ten times as much production
    lands in the same real second, so the readout reads roughly **10× the true
    steady-state rate** and then decays back over the following five minutes.
- **Why it matters**: The quest one is an owner-visible design inconsistency; the
  rate one is a number on screen that is simply wrong at exactly the moment a
  player is most likely to be watching it (they have just spent their bank to see
  output). Neither errors, and no test covers either.
- **Owner question** on the cooldown: should the five minutes be **(A)** game time,
  so fast-forward skips it — **recommendation**, since every other timer in the
  game is game time and this is the only one that would surprise a player — or
  **(B)** real time, deliberately, so the bank cannot be used to reroll bounties?
  If (B), say so in a comment, because it currently reads as an oversight.
- **Suggested fix**: For (A): store `remainingMs` and subtract `deltaMs` in `tick`,
  rather than storing an absolute `readyAt`. For the rate tracker: stamp gains with
  `TimeManager.getGameTime()` instead of `Date.now()` — a two-line change that
  makes the window a game-time window throughout.
- **Related**: CR2-036 (this closes its "one clock question"), CR2-041 (Session 1's
  unbounded tick clock — same clock, other end of it).

---

### CR2-096 [DECIDED: cut] · P2 · S · Session 4 · Status: Open
- **Where**: `src/systems/inventory/InventoryManager.js:191-221`
  (`decrementDurability`), `:184-186` (`getDurability`);
  `src/systems/inventory/InventoryFormatter.js:38, 50-51`
- **What**: **Item durability is stored, displayed and never consumed.** Every
  inventory entry carries a `dur` field, `InventoryStore` normalises it on load,
  `InventoryFormatter` surfaces `durability` / `maxDurability` to the UI, and
  `decrementDurability` implements the whole breakage rule — item breaks, stack
  decrements, durability resets for the next copy in the stack. **Nothing calls
  it.** `getDurability` has no callers either.
- **Why it matters**: A tool the player equips will never wear out. If durability
  was meant to be a sink — and the "reset durability for the next item in the
  stack" logic says somebody thought about it carefully — it is not one. Either
  way, the field is saved on every entry and read by the display layer, so the
  game shows durability values that can never move.
- **Suggested fix**: **Owner ruling needed**, same shape as CR2-018 (exploration):
  is durability a real feature? If yes, the missing half is a caller — the natural
  one is the work cycle consuming an equipped tool, which is Session 2/3
  territory. If no, delete `decrementDurability`, `getDurability`, the `dur` field
  and the formatter's two derived keys. Do not delete on inference:
  `maxDurability` is authored on items in `data/items.json`, so this is content,
  not just code.
- **Related**: CR2-018, CR2-074 (gear effects written and never read — same
  family).

---

### CR2-097 · P2 · S · Session 4 · Status: Open
- **Where**: `src/systems/inventory/InventoryManager.js:148-179` (`canAccept`);
  `src/systems/inventory/ItemRateTracker.js:81-93` (`getAllRates`)
- **What**: Two read-only query methods, each with a documented consumer that no
  longer exists, and each with a defect that has never mattered because nothing
  calls them:
  1. **`canAccept`** — documented as "*used by the card work pre-flight (Phase 6)
     to fail a Card whose output the bank cannot store*". `CardPreflight` was
     deleted with the card system; zero callers remain. It also **ignores its
     `amount` argument**: the final line is
     `(maxStack - entry.quantity) >= Math.min(amount, 1)`, which is `>= 1` for any
     `amount >= 1`, so `canAccept(item, 500)` answers "yes" when there is room for
     one.
  2. **`getAllRates`** — documented as feeding "*the Area Manager's Global Economy
     panel (UI overhaul Phase 4)*". There is no Area Manager; zero callers.
- **Why it matters**: Both are the review's central pattern with the wire cut at
  the *reader* end, and both carry comments naming a consumer confidently enough
  that a reader would not think to check. `canAccept`'s `Math.min(amount, 1)` is
  the more interesting one: if anybody ever adopts it as a pre-flight check it
  will pass, and the overflow will silently take the D-138 path instead.
- **Suggested fix**: Delete both — or, if a bank-full pre-flight is wanted for the
  board's production cycle, fix `canAccept`'s arithmetic first and wire it, since
  `BoardRunner` completing a cycle into a full Bank is exactly the case it was
  written for. Recommend deleting `getAllRates` outright.
- **Related**: CR2-095 (same file), CR2-092.

---

### CR2-098 [DECIDED: keep collecting] · P2 · S · Session 4 · Status: Open
- **Where**: `src/systems/progression/RegistryManager.js:33-42` (provenance),
  `:51-61` (New! badges), `:118-127` (`markAsSeen`), `:129-183` (navigation
  history); `src/ui/hooks/useDiscovery.js`
- **What**: **`RegistryManager` collects data nothing reads, and half the file is
  a navigation stack with no callers.**
  - **Provenance** (`collection.provenance`, "which source dropped which item") is
    written on every item gain. Its only reader is `isLootDiscovered`, which has
    **zero callers**. The owner's save slot 1 contains real provenance data
    (`{qa: {item_copper_ore: true}}`) that nothing can display.
  - **"New!" badges** (`ui.newDiscoveries`) are written on every first discovery.
    Nothing reads the field, and `markAsSeen` — the only thing that clears a badge,
    documented as "*dismissed on hover in UI*" — has **zero callers**. So the set
    grows monotonically and is saved forever.
  - **`itemLifetimeCounts`** is written here and read by `useDiscovery`, whose only
    consumer (`LootModule`) uses just `isDiscovered` — so the counts reach a hook
    and stop. (Kill counts are the separate, worse case: CR2-087.)
  - **The navigation history** — `pushHistory`, `popHistory`, `peekHistory`,
    `canGoBack`, `canGoForward`, `goForward`, `clearHistory`, ~50 lines
    implementing browser-style back/forward "*requested by the user*" — has
    **zero callers**, none, anywhere.
- **Why it matters**: Roughly half of a 184-line engine-layer module is
  unreachable, and the reachable half writes three fields into the save that no
  screen shows. The save cost is real and grows with play. It is also a fair
  question whether the Library/Codex feature these were built for still exists.
- **Suggested fix**: Owner ruling on the Codex/Library first — provenance and
  badges are cheap to keep *if* that screen is coming, and expensive to rebuild if
  deleted. The navigation history is safe to delete regardless; it is UI state in
  an engine module. Recommend: delete the history stack now, hold provenance and
  badges pending the ruling, and record the decision in this ticket.
- **Related**: CR2-087, CR2-042.

---

### CR2-099 · P2 · S · Session 4 · Status: Open
- **Where**: `src/config/constants.js` (whole file, 82 lines)
- **What**: **15 of the file's 16 exports are dead, and four of them are
  contradicted by the live value elsewhere.** Only `TICK_INTERVAL_MS` has a
  consumer (`GameLoop`). Verified export by export across `src/`, `cms/src/` and
  the tests. The contradictions matter more than the deadness:
  - `MAX_SAVE_SLOTS = 5` — `SaveManager.js:14` defines its own `MAX_SLOTS = 3`,
    and the game has three slots.
  - `DEFAULT_MAX_STACK_SIZE = 999` — `itemRegistry.js:23` defines
    `DEFAULT_MAX_STACK = 1e12`, which is what `InventoryManager` actually uses.
  - `DEFAULT_MAX_INVENTORY_SLOTS = 20` — the real 20 is hardcoded in four places
    (`InventoryManager.js:53,168`, `InventoryStore.js:41`,
    `GuildUpgradeManager.js:110`).
  - `AUTO_SAVE_INTERVAL_MS = 30000` — autosave is driven by the
    `gameplay.autoSaveIntervalMinutes` setting instead.
  The remaining dead entries are retired-era: `MAX_ACTIVE_CARDS`,
  `DEFAULT_TASK_DURATION_MS`, `WORK_CYCLE_DURATION`,
  `QUEST_POINTS_TO_COMPLETE_AREA`, both `AFFINITY_*` (classes and traits retired),
  `DEFAULT_MAX_HP`, `DEFAULT_MAX_ENERGY`, `ENERGY_REGEN_PER_SECOND`,
  `PROGRESS_UI_UPDATE_INTERVAL`, and `SKILLS_FOR_LEVEL_CALCULATION = 11` — hero
  level is the average of the four combat skills under the locked 15-skill
  decision, so 11 is not even the right number.
- **Why it matters**: The header promises "*Centralized configuration… Values here
  can be tuned for balancing without searching the codebase.*" Tuning any of the
  fifteen changes nothing, and four of them state a number the game contradicts.
  That is worse than an empty file: it invites a balance pass to edit the wrong
  dial and conclude the game ignores its own config. Exactly the fault Session 2
  filed against `loopConstants.js` (CR2-065), in the file the guide assigned to
  this session.
- **Suggested fix**: Delete the fifteen; move `TICK_INTERVAL_MS` next to `GameLoop`
  or into `loopConstants.js`, and delete the file. If a genuine central tuning file
  is wanted, it should hold values the code *imports*, and the fix wave should say
  so in the header.
- **Related**: CR2-065 (the same fault in the same shape).

---

### CR2-100 · P2 · S · Session 4 · Status: Open — **the `CardManagerUtils` verdict**
- **Where**: `src/utils/CardManagerUtils.js` (22 lines)
- **What**: **Half of it outlived the card system and half did not.**
  - `bumpCardRev(card)` is **live** — six calls, all in `systems/combat/`
    (`CombatProcessor.js:49,63,70`, `CombatResolutionProcessor.js:104`), and every
    one of them passes the ephemeral **fight** object, not a card. It bumps `_rev`
    so ref-based UI reads see a change.
  - `cloneTraits(traits)` is **dead** — zero callers, and traits were retired by
    owner ruling (guide Q3).
- **Why it matters**: A file named for a deleted system, sitting in shared
  `utils/`, whose one live function is named for a deleted noun and is used by
  exactly one subsystem. Every reader who opens it has to work out that "card"
  here means "fight".
- **Suggested fix**: Delete `cloneTraits`; move `bumpCardRev` into
  `src/systems/combat/` (its only consumer directory) renamed `bumpFightRev`;
  delete the file. Effort **S**, mechanical, four import lines.
  ⚠ Do it in the same pass as CR2-016's `cardId` → `anchorId` rename — same
  vocabulary cleanup, same files.
- **Related**: CR2-016, CR2-012.

---

### CR2-101 · P3 · S · Session 4 · Status: Open
- **Where**: `src/utils/RNG.js` (103 lines); `Math.random()` call sites in
  `src/systems/quests/QuestManager.js:41, 304, 313, 316, 317, 332, 419, 420` and
  `src/systems/economy/TransactionProcessor.js:39, 107`
- **What**: **A randomness utility nobody adopted.** Of its seven exports only
  `randomInt` is imported, once, by `LootSystem`. `randomFloat`, `randomChoice`,
  `weightedChoice`, `shuffle`, `rollDice` and `rollChance` have zero callers —
  while the code that needs exactly those functions calls `Math.random()` inline.
  `TransactionProcessor.weightedPick` is a hand-rolled `weightedChoice`;
  `QuestManager.createRandomQuest` hand-rolls `randomChoice` three times and
  `randomInt` once.
- **Why it matters**: Low harm today — `Math.random()` works. It matters for two
  reasons. First, it is two answers to one question in the most testable part of
  the codebase: a seedable RNG would make loot, bounty generation and combat
  reproducible in tests, and the utility that would host it exists and is unused.
  Second, `weightedPick`'s hand-rolled version has a behaviour the shared one does
  not — `Math.max(100, totalWeight)` means a table whose chances sum below 100 can
  select nothing, which is deliberate but invisible.
- **Suggested fix**: Either route the existing call sites through `RNG.js` (and
  give it an injectable seed while you are there), or delete the six unused
  helpers and stop implying there is a shared RNG. **Recommendation: the former** —
  it is the precondition for ever testing loot and bounty distributions, which
  CR2-011 and CR2-084 both needed and neither had.
- **Related**: CR2-011, CR2-084.

---

### CR2-102 · P3 · S · Session 4 · Status: Open
- **Where**: `src/utils/Formatters.js`
- **What**: Six of eleven exports have no callers anywhere: `formatTime`,
  `formatNumber`, `formatPercent`, `titleCase`, `idToTitle`, `pluralize`. The five
  live ones (`formatCompact` ×29, `parseNotation` ×15, `formatTimeAgo`,
  `MAX_EXACT_INTEGER`, `isBeyondExactRange`) are well used and well documented.
- **Why it matters**: Genuinely minor — the mildest thing in the territory, and
  the file is otherwise the best-commented in it. Recorded so the cleanup wave has
  the list rather than re-deriving it. `formatTime` being unused is mildly
  surprising given the game shows several durations; whoever needs one next should
  use it rather than write a twelfth formatter.
- **Suggested fix**: Delete the six, or keep them and say in the header that this
  is a deliberate general-purpose kit. Either is defensible; pick one so the next
  reader is not left guessing.

---

### CR2-103 · P3 · S · Session 4 · Status: Open
- **Where**: `src/utils/AssetManager.js`
- **What**: Three things, in descending order of value:
  1. **`renderIcon` (52 lines) has no callers** — none in `src/`, `cms/src/` or the
     tests. It builds an icon by returning a raw HTML string with inline styles and
     an `onerror` attribute: pre-React machinery that `ItemIcon.jsx` replaced.
     (`LayoutSandbox`'s `renderIconStack` is an unrelated local function that
     merely reads similarly.)
  2. **`initializeAssets` is an explicit no-op** kept for "*legacy support for
     main.jsx*" — and `main.jsx:44-45` still dynamically imports the module solely
     to call it.
  3. **`resolveSpritePath` rebuilds two lookup tables on every call.**
     `AREA_ART_MAP` (4 entries) and `HERO_MAP` (19 entries) are declared *inside*
     the function, so every icon resolution allocates two objects. This is a hot
     path — called from `ItemIcon`, `BoardTile`, `SpriteLayerView`,
     `ParticleOverlay`, `HeroDockTab`, `DragGhost` and `tokenRegistry`, i.e. once
     per visible sprite per render. Hoisting them to module scope is a one-line
     change with no behaviour risk.
- **Also**: both tables are retired vocabulary — `AREA_ART_MAP` maps area ids
  (areas retired) and `HERO_MAP` maps class names (classes retired, replaced by
  jobs). They still function as sprite aliases, but they should be labelled as art
  aliases rather than reading as live concepts.
- **Why it matters**: (3) is the only one with a measurable cost and it is small;
  (1) and (2) are 60 lines of dead weight in a file the **CMS also imports**
  (CR2-010), so deletion needs the usual cross-check.
- **Suggested fix**: Hoist the two tables (do this one regardless); delete
  `renderIcon`; delete `initializeAssets` and the `main.jsx` import that exists
  only to call it. Check `cms/src` first — four CMS files import from here, though
  all four import only `resolveSpritePath`.
- **Related**: CR2-010, CR2-008.

---

### CR2-104 · P3 · S · Session 4 · Status: Open
- **Where**: `src/config/guildUpgrades.js:13-15, 120-131, 193-196` against
  `src/ui/components/board/boardConstants.js` and `src/systems/board/adjacency.js`
- **What**: **The board's geometry is defined twice.** `guildUpgrades.js` declares
  its own `BOARD_SIZE = 7`, `TOTAL_TILES` and `GUILD_HALL_TILE = 24`, plus its own
  `getCardinalNeighbors`. The engine uses the *other* copies — `Placement.js` and
  `adjacency.js` import `BOARD_SIZE` and `GUILD_HALL_TILE` from
  `ui/components/board/boardConstants.js` (which is CR2-051's layer violation). So
  there are two sources of truth for the same numbers, and two implementations of
  "cardinal neighbours of a tile".
- **Also**: `isUpgradeVisible(_def)` returns `true` unconditionally and has zero
  callers.
- **Why it matters**: Nothing is wrong today — both copies say 7 and 24. It is a
  trap rather than a bug: changing the board size would require finding both, and
  the upgrade tree's accessibility rule (which tile you may buy next) would
  silently keep using the old geometry. Worth fixing *with* CR2-051, since that
  ticket is already moving where board geometry lives.
- **Suggested fix**: When CR2-051 relocates `boardConstants` out of `src/ui/`, have
  `guildUpgrades.js` import from it and delete its three constants and
  `getCardinalNeighbors` (`adjacency.js` already has that function). Delete
  `isUpgradeVisible`.
- **Related**: CR2-051.

---

### CR2-105 · P3 · S · Session 4 · Status: Open
- **Where**: `src/utils/Logger.js:31, 111-130`; hot-path callers in
  `InventoryManager.js:106`, `CurrencyManager.js:62, 104`,
  `TransactionProcessor.js:41, 52, 63, 70`
- **What**: **The logger sits permanently at its most verbose level in
  development, and the controls to change that have no callers.** `minLevel` is
  initialised to `debug`, and `setLevel`, `filterModules`, `clearFilter` and
  `isDev` are called by nothing — no settings toggle, no dev dashboard control, no
  startup code. So every `logger.debug` on a hot path performs a real
  `console.log` in every dev session.
- **Why it matters**: A performance observation rather than a correctness one, and
  it lands on the tick path Session 2 measured. Every item added to the Bank logs a
  line; every gold change logs a line; every transaction entry logs one or two. The
  sprite sweep Session 2 measured at 320 events in a single tick also emits well
  over a hundred `console.log` calls in that tick, and `console.log` with devtools
  open is far from free. It only affects development (production short-circuits on
  `isDevelopment`) — but development is where frame-rate observations get made, so
  it can make the game look slower than it ships.
- **Suggested fix**: Default `minLevel` to `info` and expose `setLevel` on
  `TestDashboard` (owner-confirmed dev tooling, guide Q5), alongside the two other
  dashboard read-outs already recommended — the `EventBus` log (CR2-046) and the
  Risk-13 starvation stats (CR2-067). Three small additions, one sitting.
- **Confidence**: The wiring gap and the call counts are confirmed by reading. The
  *cost* is not measured — that is Session 8's, and it should be measured with the
  console open and closed, since the difference is most of the effect.
- **Related**: CR2-046, CR2-056, CR2-067.

---

### CR2-106 · P3 · S · Session 4 · Status: Open
- **Where**: `src/systems/progression/GuildUpgradeManager.js:82-91` against
  `src/systems/hero/logic/HeroLifecycle.js` (`createHero` / `addHero`)
- **What**: **A second hero-creation route that bypasses the first.** Buying
  `roster_size` generates a hero, rehydrates it and pushes it straight onto
  `GameState.heroes`, then publishes `hero_recruited` itself. It never goes through
  `HeroLifecycle.addHero`, so anything living there does not apply. Concretely
  today the payload is `{heroId, name}` where `HeroLifecycle` sends more, and
  `NotificationSubscriptions` reads `className`/`traitName` off `hero_recruited`
  (undefined on both paths — its own entry on CR2-036).
- **Why it matters**: This is currently the game's **only** recruitment route, so
  the "primary" path is the one with no live caller. Nothing is broken, but any
  rule added to `addHero` — a roster-cap check, a starting-equipment grant, the
  `totalRecruits` increment CR2-086 needs — would silently not apply to the way
  players actually recruit.
- **Suggested fix**: Have `purchase()` call `HeroLifecycle.addHero` and let that
  publish the event. Fix CR2-086 in the same change, since the increment belongs in
  whichever function ends up owning this.
- **Related**: CR2-086, CR2-036.

---

### CR2-107 · P3 · S · Session 4 · Status: Open
- **Where**: `src/systems/inventory/InventoryFormatter.js:11, 42-55, 58`
- **What**: Two small things in the display cache:
  1. **`_itemReferenceMap` is never pruned.** It keeps one object per item id the
     player has ever held; `invalidate()` clears only `_displayCache`. Bounded by
     the number of distinct items in the game, so this is a few dozen objects at
     worst — recorded for completeness, not as a leak.
  2. **The sort assumes every item template has a `name`** —
     `a.name.localeCompare(b.name)` throws on an item authored without one, which
     would break the entire Bank display rather than showing one bad row. The
     module already skips items with no template two lines above, so the defensive
     habit is there and just stops short.
- **Why it matters**: (2) is the one worth doing. Content comes from the CMS, and
  CR2-001/002 show authored content reaching the game with fields missing or wrong.
  A crash in the Bank list is a far worse symptom than a blank name.
- **Suggested fix**: `(a.name || a.id).localeCompare(b.name || b.id)`. One line.

---

### Session 4 — verdicts on the tickets it was asked to close

- **CR2-012 (`RegistryUtils` orphaned) — CONFIRMED; recommend deleting.**
  `rehydrateEntity` and `rehydrateList` have **zero references** in `src/`,
  `cms/src/` or the tests — grepped on the exported symbols, not the filename, per
  the tool-lies note. Two further points the ticket does not make, both arguing
  against keeping it "as a utility for future rehydration work": its `keysToCopy`
  list is **card vocabulary** (`cardType`, `traits`, `biomeId`, `baseTickTime`,
  `baseEnergyCost`, `xpAwarded`, `rarity`), so it is not the generic helper it
  describes itself as; and the flyweight model the game actually uses needs
  nothing like it — Session 1 established that board tiles, tray and Vault entries
  store `{typeId, usesRemaining, cycleElapsedMs}` and resolve their definition
  through `getTokenType()` at every read, with no property-copying step at all.
  **Verdict: delete.** Unlike `EventBatch` (CR2-007), this is not a working
  solution to a problem we still have.

- **CR2-015 (inert procedural quest pool) — CONFIRMED MOOT AS WRITTEN. Recommend
  `Superseded by CR2-084`.** `QuestBoardSystem.js` does not exist; the file the
  ticket names is gone. Procedural quests were rebuilt inside `QuestManager` as
  `createRandomQuest`, and they are **not** inert — they generate, they fill empty
  slots, and collection bounties work end to end. The ticket's premise ("a whole
  quest source is silently inert") is therefore false as written. But it should not
  simply be closed: **half of what the rebuilt pool generates is impossible to
  complete** (CR2-084), which is the same player-visible symptom arriving by a
  different route. Close CR2-015 pointing at CR2-084.

- **`config/questConfig.js` — already deleted** (commit `dc23ca9`), before this
  session. No ticket. The guide's Session 4 row and the reachability list in
  *Shared Inputs* are both stale on this point.

---

### Session 4 — save-slot handling

All **nine** localStorage keys (`fantasy_guild_slot_{0,1,2}`, their three
`_backup` twins, `fantasy_guild_last_slot`, `fantasy_guild_settings`,
`fantasy_guild_dev_mute_applied`) were read out in full and captured **before**
any probe — into the session transcript and into `sessionStorage` as a second
copy. Slot 2, the smallest and oldest, was the only slot loaded.

Probing mutated live state deliberately: quest lists were replaced, Tokens and a
hero were placed on the board, and a `roster_size` upgrade was purchased.
**Before restoring, `GameLoop.stop()` was called** so no autosave could fire
mid-restore — the failure that hit Sessions 2 and 3. All nine keys were then
written back and compared string-for-string against the capture: **nine of nine
EXACT MATCH**, byte lengths re-checked afterwards and unchanged. The page was
left with the loop stopped and was not reloaded.

---

## Filed by Session 5 — Content pipeline & the CMS boundary (2026-08-19)

**Territory read in full:** `data/` (10 JSON content files, 3 schemas, 3
templates), `src/config/DatabaseManager.js`, **all 20 files in
`src/config/registries/`** including the `index.js` barrel,
`scripts/regenerate_game_package.js`, the sync route
(`cms/vite-plugin-cms-api.js` → `/api/sync-game-data`) and its caller
(`cms/src/engine/fileUtils.js`), and the three CMS test suites.

**Guide drift found, on top of the two the kickoff already named.** The guide's
Session 5 row says "all 23 files in `src/config/registries/`" (**it is 20**) and
asks for an owner ruling on `areaSetRegistry` (**already deleted**). Two further
drifts found this session:

- The row says `data/quests.json` is deleted. It is — **but
  `scripts/regenerate_game_package.js` still writes it**, along with
  `data/cards/tasks/*.json`, `data/cards/combat/*.json` and
  `data/cards/area/areas.json`. See CR2-113.
- `DatabaseManager.js` still globs `/data/cards/area/**` and declares an empty
  `cardFiles` — both survivors of the card retirement. See CR2-115.

**Tooling re-run over the territory.** `npm run lint`: **0 of the 32 remaining
problems fall in `data/`, `src/config/registries/`, `src/config/DatabaseManager.js`
or `scripts/`.** `node tools/reachability.mjs`: only `modifierPalette.js` and
`tokenConstants.js`, both already CR2-010 — **but see CR2-119, the barrel hides
a third** (`recipeRegistry.js`). `npm run duplication` is not assigned to this
session and was not run.

**Baseline re-verified untouched:** 840 passed / 21 skipped / 0 failed, 58 files.

**Runtime verification.** Six findings below were confirmed in the running game
(marked *verified at runtime*). Save-slot handling is recorded at the end.

---

### CR2-108 [DECIDED: warn only] · P1 · M · Session 5 · Status: Open — **the central-question verdict**
- **Where**: system-wide. Anchor sites: `src/config/registries/itemRegistry.js:110`
  (`getItem`), `tokenRegistry.js:118` (`getTokenType`), `enemyRegistry.js:390`
  (`getEnemy`), `mapRegistry.js:56` (`getMap`); `src/tests/ContentRules.test.js`
- **What**: **Nothing anywhere checks that an authored content id resolves.**
  Five sessions have now found the same failure independently (CR2-002, CR2-011,
  CR2-044, CR2-063, CR2-084). This ticket is the shared cause and the proposed
  fix.

  There are four layers where this could be caught, and it is caught at none:

  **1. Load time — no registry validates anything.** Every registry is a pure
  loader: it merges JSON into an object and, at most, logs a count
  (`recipeRegistry.js:73`). No registry cross-checks another. Boot is silent
  even with ghost ids present — verified at runtime: loading a save whose tray
  holds five Tokens that no longer exist produced **zero warnings** in the
  console.

  **2. Use time — every accessor returns `null`, and every caller is written to
  survive it.** `getItem`, `getTokenType`, `getEnemy`, `getMap` all end
  `return X[id] || null`. Callers then `?.`-chain or `|| []` past the null. That
  is individually defensible defensive coding; collectively it means a missing
  definition is indistinguishable from a definition that does nothing.
  Session 3 traced one such swallow four layers deep in `LootSystem`.

  **3. The one existence-check helper is called by nobody.**
  `itemRegistry.js:132` exports `itemExists(itemId)`. Its only reference
  anywhere in `src/` or `cms/src/` is the barrel re-export at
  `registries/index.js:75`. The tool exists; nothing uses it.

  **4. The validation suite is switched off — and two of the rules that are
  still switched *on* pass vacuously.** `ContentRules.test.js` has 18 of its 32
  cases skipped (CR2-005), including "points every Manager at Tokens that
  exist", "points every enemy Token at an enemy that exists" and "points every
  Token at art that actually exists". Worse, the surviving cases are not the
  safety net they appear to be:
    - **`the opening Tray is workable` (line 433) is NOT skipped, runs, and
      passes — over four ids that do not exist.** Its body is
      `const skill = TOKENS[typeId]?.config?.skill; if (!skill) continue;`. When
      `TOKENS[typeId]` is `undefined` the optional chain yields `undefined` and
      the `continue` skips the assertion entirely. The one test that names
      `OPENING_TRAY` reports green on CR2-044.
    - **`points every Token at art that actually exists` (line 343) is broken,
      not merely skipped.** It builds `public/assets/skills/${sprite}.png` —
      the *skills* folder — for Token art that lives in `assets/tokens/`. If
      un-skipped as written it would fail for all ten Tokens. It is also the
      test that produced CR2-002, which is a **false positive** (see the
      corrections section).

  **The one rule that does work** is `%s points only at real content`
  (line 366), which asserts `getTokenType(entry.refId)` is truthy for every Map
  pool entry. It is the only place in the codebase where a dangling id fails
  anything, and it covers one of roughly a dozen reference kinds.

- **Why it matters**: The game is built so that missing content is *quiet*.
  A drop that never arrives, a bounty that never advances, a Token with no
  definition sitting in the tray — all of them look exactly like ordinary
  gameplay. Content is authored in a separate tool and is being re-authored
  right now, so ids move constantly; the project therefore has the highest
  possible rate of this defect and the lowest possible chance of noticing one.
  Every instance found so far was found by a person playing, never by a test.
- **Whose gap is it?** **Both, and the game side is the cheaper fix.** The CMS
  can and should refuse to author a dangling reference, but the CMS is not the
  only writer of content ids — `EngineBootstrap.OPENING_TRAY`,
  `guildHallMaps.js` and `QuestManager.RANDOM_HUNTS` are all hand-written in the
  game and all three currently name ids that do not exist. A CMS-side check
  would have caught none of those three.
- **Suggested fix — a content-integrity check, in three parts, cheapest first:**

  **(a) One boot-time audit, ~80 lines, one new file.** A
  `validateContent()` that walks every authored cross-reference and reports
  every unresolvable id in a single grouped `console.error`, run once from
  `EngineBootstrap.init()`. The reference kinds are already enumerable and small:

  | Source | Field | Must resolve to |
  |---|---|---|
  | Token | `config.inputs[].itemId`, `config.outputs[].itemId` | item |
  | Token | `effectBlocks[].modifiers[].itemId` | item |
  | Token | `effectBlocks[].targetToken.value` (mode `id`) | Token |
  | Token | `mapId`, `enemyId` | map / enemy |
  | Token | `recipePool` | a skill with a pool |
  | Token / item / enemy | `sprite` | `resolveSpritePath` → a file |
  | Map | `pool[].refId` | Token or item |
  | Enemy | `drops[].itemId` | item |
  | Hand-written | `OPENING_TRAY`, `GUILD_HALL_DROP_SEQUENCE`, `RANDOM_HUNTS` | Token / item / enemy |

  A prototype of exactly this walk was written for this session and found **8
  dangling references in `data/` alone** in under a second (listed in the
  System Map below), plus the four `OPENING_TRAY` ids and the four
  `RANDOM_HUNTS` enemy ids. It is not a research project; it is an afternoon.

  **(b) Make it a test, not just a log.** The same walk as one `it()` in
  `ContentRules.test.js` — **and this one must not be skipped**, because unlike
  the completeness rules it is true of a partial content set as well as a
  finished one. "Every id resolves" is not a statement about how much content
  exists. This is the single most valuable un-skipped case the suite could have.

  **(c) Make the runtime loud where it currently shrugs.** One
  `logger.warn` at each of the four swallow sites already identified —
  `LootSystem.js:203` (Session 3), `SpriteLayer.addSprite` (CR2-063),
  `Placement.placeToken` (CR2-044), `TokenBank.deposit` — costs nothing and
  turns every future instance into something a playtest reports.

  **Recommended order: (a) then (b) then (c).** (a) tells the owner today how
  much broken content exists; (b) stops it coming back; (c) catches the cases
  authored at runtime rather than at load.

- **Owner decision embedded, as multiple choice.** The audit will report
  roughly 20 dangling references on day one, and the content is deliberately
  half-authored. What should it do about that?
  - **A. Warn, never block** *(recommended)*. Log every dangling id at boot,
    keep the game running. Nothing changes about how the game behaves; the
    information simply stops being invisible. Costs nothing while content is
    mid-authoring, and is the version that would have caught all five prior
    findings.
  - **B. Warn now, fail the build later.** Same as A, plus a flag that turns the
    audit into a hard error once content is finished. More work, and the "later"
    tends not to arrive.
  - **C. Refuse to load broken content.** Strongest guarantee, wrong for a game
    whose content set is currently 6 items and 10 Tokens — it would refuse to
    boot today.
- **Related**: CR2-002 *(moot — see corrections)*, CR2-005, CR2-011, CR2-044,
  CR2-063, CR2-084, CR2-110, CR2-113.

---

### CR2-109 · P1 · S · Session 5 · Status: Open
- **Where**: `data/tokens.json` — every Token's `config.xp` is `0`, and every
  Token carries an unread top-level `"xp": 10`; consumed at
  `src/systems/board/BoardRunner.js:231-237`
- **What**: **No Token in the game awards any skill XP.** The engine reads
  `recipe.xp ?? config.xp` (`RecipeResolver.js:188`) and only calls
  `SkillSystem.addXP` when the result is `> 0`. All four Tokens that have a
  `config` at all declare `"xp": 0`; the other six have `config: null`. Every
  Token *also* carries a top-level `"xp": 10` — written by the CMS's XP solver —
  which **nothing in the game reads**. Grepped: no reference to a Token
  definition's top-level `xp` anywhere in `src/`.
- **Verified at runtime**: `RecipeResolver.effectiveIO(10, tile)` for a placed
  Oak Forest returns `{cycleTimeMs: 12000, xp: 0}`.
- **Why it matters**: Player-facing and total. The six Foundation skills
  (Mining, Logging, Fishing, Smithing, Crafting, Cooking) are what a hero works
  the board with, and **not one of them can gain a single point of XP from
  board work**. The only other `addXP` callers are combat (unreachable — see
  CR2-110) and commerce. Confirmed against the live saves: every hero in all
  three of the owner's slots sits at `{"xp": 0, "level": 1}` on all six
  Foundation skills despite hours of playtime, and the one hero with any
  progression at all got it from a dev tool (`melee` level 60).
- **Suggested fix**: Two parts. Author non-zero `config.xp` in the CMS. **And
  settle which field is canonical** — the CMS solves XP into `token.xp` while
  the game reads `token.config.xp`, so even authoring the solver's field would
  change nothing. Either the sync must write the solved value into
  `config.xp`, or the engine must read the top-level field. This is the same
  shape as CR2-121.
- **Related**: CR2-121 (`charges` has the identical split), CR2-108.

---

### CR2-110 [DECIDED: combat parked] · P1 · S · Session 5 · Status: Open — **owner decision**
- **Where**: `data/tokens.json` (all 10 Tokens); the gate at
  `src/systems/board/BoardCombat.js:71`
- **What**: **Combat cannot happen. No authored Token is an enemy Token.**
  `BoardCombat.isEnemyTile` requires `def.tokenType === 'enemy' && def.enemyId`.
  The ten authored Tokens are typed `context`, `resource` ×4, `map`,
  `station` ×2, `passive`, `manager` — **no `enemy`, and no Token carries an
  `enemyId` at all**. There is therefore no route by which an enemy reaches the
  board.
- **Why it matters**: A whole subsystem is stranded. `data/enemies.json`
  defines 4 enemies; `enemyRegistry.js` hardcodes a further 18 (CR2-117); the
  combat engine, wounding, loot, the Bestiary and combat XP are all live code
  with live tests — and none of it can be reached by playing. It also makes
  several other tickets currently unobservable rather than fixed: CR2-011's
  loot failure, CR2-084's hunt bounties and CR2-016's combat audio all require
  a fight that cannot start.
- **Confidence**: The gate and the content are both certain. What is *not*
  certain is whether this is a defect or simply where re-authoring has got to —
  which is why it is written as an owner question rather than a repair.
- **Owner decision**: Is an enemy Token expected in the current content slice?
  - **A. Yes — it is missing and should be authored** *(recommended if combat
    is meant to be playable now)*. One Token with `tokenType: 'enemy'` and
    `enemyId: 'enemy_copper_miner'` in the Test Map's pool would light the
    whole subsystem up and let four other tickets be verified.
  - **B. No — combat is deliberately parked until later content.** Then say so
    in the ticket, and treat CR2-011/084/016 as un-verifiable until it returns.
- **Related**: CR2-011, CR2-084, CR2-016, CR2-117, CR2-108.

---

### CR2-111 · P1 · S · Session 5 · Status: Open
- **Where**: `data/tokenRecipes.json` (contents: `{}`);
  `cms/src/engine/fileUtils.js:62-66` (`syncToGame`);
  `src/config/registries/recipePoolRegistry.js`
- **What**: **Recipe pools are authored and balanced in the CMS and never
  delivered to the game.** The CMS's `syncToGame` writes exactly three files —
  `items.json`, `tokens.json`, `maps.json`. `recipePools` is a first-class
  collection in the CMS: it is in the workspace snapshot (`fileUtils.js:11-16`),
  and `recalculateEconomy` flattens it into the solver input
  (`useEntityStore.js:673-677`) so pooled recipes are *priced*. **It is never
  written out.** `data/tokenRecipes.json` is the two characters `{}`, so
  `RECIPE_POOLS` loads empty and `getSkillRecipePool()` returns `[]` for every
  skill.
- **Why it matters**: This is the whole of CMS-39/70/76/77 — the multi-recipe
  station model, the reason `recipePoolRegistry.js` exists with 55 lines of
  design commentary, and the mechanism a Kitchen needs to make more than one
  dish. The file it targets even carries the warning *"Never hand-edit
  `data/tokenRecipes.json` once the CMS is live"* — but the CMS never writes it,
  so hand-editing is currently the only way anything could ever get in.
  No authored Token sets `recipePool`, so nothing is *visibly* broken today;
  the moment the owner authors a pooled station in the CMS it will produce
  nothing, with no error.
- **Suggested fix**: Add `'tokenRecipes.json': balanced.recipePools` (or the
  post-balance equivalent) to the `payload.files` object in `syncToGame`. One
  line. Then confirm the shape matches what `loadJsonRecipePools` expects
  (an object keyed by skill id, values arrays).
- **Related**: CR2-108, CR2-006 (no CMS tests, so nothing would have caught it).

---

### CR2-112 · P1 · S · Session 5 · Status: Open
- **Where**: `data/tokens.json` → `token_forge_altar.description`;
  composer at `cms/src/engine/descriptionDictionary.js:144-155`
- **What**: **Two defects that mask each other.**
  1. **A shipped Token description contains `NaN`.** Forge Altar's description
     currently reads, verbatim: *"Matching tokens gain +20% Speed. Matching
     tokens gain NaN% Speed."* The composer reads `mod.axis`, `mod.value` and
     `mod.isPercent`; the Token's modifiers are authored with `type`, `bucket`,
     `value` and — for `BONUS_DROP` — `itemId`/`chance`/`quantity` and **no
     `value` at all**. So `Math.round(undefined * 100)` yields `NaN`, and
     because `mod.axis` is never present, *every* modifier is described as
     "Speed" whatever it actually is. The `+20% Speed` clause is right by
     accident: that modifier is `WORK_TIME`.
  2. **Nothing in the game displays a Token's description.** Grepped all of
     `src/ui/`: `description` appears in four files —
     `BankTab.jsx` (item descriptions), `GuildUpgradeInspection.jsx`,
     `HeroSkillSheet.jsx`, `SettingsModal.jsx`. **No Token surface reads it** —
     not `TokenInspection.jsx`, not `TokenInspectPopup.jsx`, not `Tray.jsx`.
- **Why it matters**: (2) is why (1) went unnoticed, and (2) is the bigger
  finding. The Description Dictionary is a named CMS feature (CMS-66/81/87) with
  its own test suite (`CMSDescriptionDictionary.test.js`), it runs on every
  sync, it writes into every Token, and **its entire output is invisible**. That
  is objective 1's exact shape at the largest scale in this territory. Note also
  the item side of the same wire is inverted: item descriptions *are* displayed
  (`BankTab.jsx:523`) and all six authored items have `"description": ""`.
- **Suggested fix**: Fix the composer's field names against what is actually
  authored (`type`/`bucket`/`value`, plus a `BONUS_DROP` branch that reads
  `itemId`/`quantity`/`chance`) — the vocabulary it should match is
  `modifierPalette.js`, which is the shared module the CMS already imports.
  **Then decide whether Token descriptions should be shown**; if not, the
  feature and its test suite should be retired rather than left running.
- **Related**: CR2-010 (`modifierPalette` is one of the seven shared modules),
  CR2-006.

---

### CR2-113 [DECIDED: delete the script] · P1 · S · Session 5 · Status: Open — **the surviving "Sync destroys content" hazard**
- **Where**: `scripts/regenerate_game_package.js` (262 lines)
- **What**: **A script that, if run, would destroy the current content set and
  resurrect the card system.** It is card-era throughout and nothing has
  updated it:
  - Line 5 hardcodes an **absolute path to one machine**
    (`c:/Users/16048/Projects/fantasy_guild_v2`).
  - Line 6 hardcodes **one specific CMS autosave**,
    `cms/backups/autosave_1782023883947.json`. That file still exists, so the
    script will run rather than fail.
  - It writes `data/items.json` and `data/enemies.json` in **card-era shapes**
    (`baseValue`, `maxStack`) that do not match what the game now loads
    (`trueCost`, `sellPrice`, `value`, `autoSyncId`).
  - It **re-creates `data/quests.json`** — deleted by owner decision, CR2-017.
  - It **re-creates `data/cards/tasks/*.json`, `data/cards/combat/*.json` and
    `data/cards/area/areas.json`** — the card system, retired.
  - It **never writes `tokens.json`, `maps.json` or `tokenRecipes.json`** — the
    three files that actually matter now.
- **Why it matters**: This is the live remnant of the "Sync to Game destroys
  unmodelled content" warning the guide asked this session to close. The CMS's
  own sync route is now safe (see the verdict below); **this script is not**,
  and it is one `node scripts/regenerate_game_package.js` away from wiping the
  authored Token content out of `items.json` and `enemies.json` and putting the
  card directories back. Nothing warns; it prints "Successfully regenerated" for
  each file.
- **Suggested fix**: **Delete it.** It is superseded by `/api/sync-game-data`
  in every respect and has no path that produces correct output. If any part is
  worth keeping it is the enemy `combatStat → damage range` derivation, which is
  four lines and duplicated by `enemyRegistry.withDerivedCombatStats` anyway.
- **Related**: CR2-017, CR2-115, and the guide's "Known content hazard".

---

### CR2-114 · P2 · S · Session 5 · Status: Open
- **Where**: `data/maps.json`; `src/config/registries/mapRegistry.js:63-68`
  (`listMaps`); `src/config/registries/guildHallMaps.js:75-95`
- **What**: **The Cartographer sells exactly one Map, called "Test Map", for 1
  gold.** `listMaps()` filters to `theme !== 'guild_hall' && price > 0`. Of the
  two Maps in `data/maps.json`, `map_guild_hall_map` has `price: 0` so it is
  excluded, and the 14 `GUILD_HALL_MAPS` aliases all carry `theme:
  'guild_hall'` so they are excluded too. That leaves `map_test_map`.
- **Verified at runtime**: `Game.Cartographer.catalogue()` returns exactly
  `[{id: 'map_test_map', name: 'Test Map', price: 1, theme: '', pool: 7}]`.
- **And there is an id collision underneath it.** `data/maps.json` defines
  `map_guild_hall_map`; `guildHallMaps.js` defines `map_guild_hall` plus 13
  numbered aliases. `mapRegistry` merges the hardcoded set **over** the JSON
  (`Object.assign(maps, GUILD_HALL_MAPS)`), so the two never collide — they
  simply coexist as two different ids for the same concept, one of which
  (`map_guild_hall_map`, empty pool, price 0, theme `""`) is unreachable by any
  route: not purchasable, not a tutorial map, in nobody's pool.
- **Why it matters**: Maps are documented as "the game's progression system
  (D-99) and its primary gold sink (D-96), which are deliberately the same
  thing" (`mapRegistry.js:6-7`). Both of those are currently one item costing
  one gold. Combined with CR2-063 (`openMap` silently falls back to the test map
  on a bad id), the entire Map economy is the Test Map whichever way you reach
  it.
- **Suggested fix**: Content authoring, not code — except for the dead
  `map_guild_hall_map` entry, which should be deleted from `data/maps.json` in
  the CMS so the two id spaces stop overlapping.
- **Related**: CR2-063, CR2-108.

---

### CR2-115 · P2 · S · Session 5 · Status: Open
- **Where**: `src/config/DatabaseManager.js:14-16,57-59`; `data/recipes.json`,
  `data/effects.json`, `data/encounters.json`, `data/stations.json`,
  `data/subskills.json`
- **What**: **Five authored data files, ~1,900 lines, that nothing in the game
  reads.** Traced individually:

  | File | Lines | Status |
  |---|---|---|
  | `recipes.json` | 1,137 | **Loaded at boot** by `recipeRegistry.js` — which no live code imports (CR2-119). 23 recipes parsed every launch and read by nobody. |
  | `effects.json` | 525 | Card-era equipment effects (`damage`, `finesse`, `stun`, `sunder`). Not globbed by `DatabaseManager` at all; unrelated to `modifierPalette`/`EFFECT_TYPES`. Nothing loads it. |
  | `stations.json` | 122 | Globbed into `DatabaseManager.stationFiles` — **a field no consumer reads**. Card-era: its `subskillId`s point into `subskills.json`. |
  | `subskills.json` | 65 | Globbed into `DatabaseManager.subskillFiles` — **no consumer**. Its `parentSkill` values (`forge`, …) are not skill ids. |
  | `encounters.json` | 21 | Not globbed at all. Its one encounter names two enemies (`enemy_mpqi3mjs`, `enemy_mpqi3mjt`) that do not exist. |

  Two further dead globs in the same file: `cardFiles: {}` (deliberately empty
  since the playmat rework) and `areaFilesSingle`/`areaFilesGlob`, which point
  at `/data/cards/area/` — **a directory that no longer exists**, and whose
  consumer `areaSetRegistry` was deleted. Both resolve to `{}` and are read by
  nothing.
- **Why it matters**: It is impossible to tell, opening `data/`, which files are
  the game's content and which are archaeology. Two of them are still written by
  `regenerate_game_package.js` (CR2-113) and none of them is written by the live
  sync, so they are frozen at whatever the card era left behind. `recipes.json`
  additionally costs real boot time for nothing.
- **Suggested fix**: Owner ruling on each, but the evidence points one way:
  delete `effects.json`, `encounters.json`, `stations.json`, `subskills.json`
  and the four dead `DatabaseManager` globs. `recipes.json` goes with
  `recipeRegistry.js` (CR2-119). Anything worth keeping as reference belongs in
  `data/archive/` beside the cards.
- **Related**: CR2-113, CR2-116, CR2-118, CR2-119.

---

### CR2-116 · P2 · S · Session 5 · Status: Open
- **Where**: `src/config/registries/dropTableRegistry.js` (131 lines);
  called at `src/systems/combat/LootSystem.js:48,146`
- **What**: **A retired registry still wired into the live loot path, which can
  only ever return null.** `DROP_TABLES` holds ten card-era tables
  (`wolf_drops`, `boar_drops`, `rat_drops`, …) naming **23 item ids, not one of
  which exists** in `data/items.json` (`leather`, `raw_meat`, `wolf_fang`,
  `venom_sac`, `slime`, …). `LootSystem` calls `getDropTable(dropTableId)` — and
  **no enemy anywhere carries a `dropTableId`**. Grepped `data/`, `src/` and
  `cms/src/`: the field appears only in the registry's own JSDoc, in
  `enemyRegistry`'s schema comment ("Inline drops (preferred over dropTableId)"),
  and in three `CombatResolutionProcessor` publishes that forward
  `enemy.dropTableId`, always `undefined`.
- **Why it matters**: Objective 2 exactly. It is loaded at boot, it is a live
  call in combat resolution, and it is 23 more dangling ids in a codebase whose
  central problem is dangling ids — but it can never fire, so it will never
  cause a visible bug and will never be noticed.
- **Suggested fix**: Delete the registry, its barrel export, the two
  `LootSystem` call sites and the `dropTableId` key from the three combat
  publishes. Inline `drops[]` is the shipped model and the only one the content
  uses.
- **Related**: CR2-011, CR2-117, CR2-119.

---

### CR2-117 · P2 · S · Session 5 · Status: Open
- **Where**: `src/config/registries/enemyRegistry.js:36-318` (`STATIC_ENEMIES`)
- **What**: **18 hardcoded card-era enemies are merged into the live `ENEMIES`
  object alongside the 4 CMS-authored ones.**
  `Object.entries({ ...STATIC_ENEMIES, ...DYNAMIC_ENEMIES })` (line 372) means
  `getAllEnemies()`, `getAllEnemyIds()` and the Bestiary see 22 enemies, not 4.
  All 18 use the retired id scheme (`forest_t1_wolf`, `farmland_boss_scarecrow`),
  carry `biomeId`s for a registry that was deleted (CR2-014), and their drops
  name the same 23 non-existent items as CR2-116.
- **Why it matters**: Two concrete consequences beyond the clutter.
  `getRandomEnemyForBiome` and `getEnemiesByBiome` only ever return static
  enemies, because no authored enemy has a real `biomeId` — though both are
  currently called by nothing. And any future "pick a random enemy" or Bestiary
  completion count is silently 22 rather than 4.
- **Suggested fix**: Delete `STATIC_ENEMIES` and the three `biomeId` accessors
  with it. Check first whether the Bestiary UI shows a total.
- **Related**: CR2-014, CR2-116, CR2-110.

---

### CR2-118 · P2 · S · Session 5 · Status: Open — **the schema-drift verdict**
- **Where**: `data/schemas/` (3 files), `data/templates/` (3 files),
  `data/archive/cards/` (11 directories)
- **What**: **All six schema and template files describe the retired card
  system, and nothing anywhere references any of them.** Grepped `src/`, `cms/`,
  `scripts/` and every JSON in `data/` for `schemas/`, `templates/`,
  `explore-card`, `task-card` and `.template.json`: **zero references.** No
  validator runs, no `$ref` resolves to them, the CMS does not read them.
  The files themselves:
  - `explore-card.schema.json`, `task-card.schema.json`, and all three templates
    (`explore.template.json`, `task-basic.template.json`,
    `task-crafting.template.json`) are card schemas for a system that no longer
    exists.
  - `common.schema.json` is the only one describing anything still live, and it
    has drifted independently: its `skillEnum` lists ten skills
    (`nature, industry, crafting, culinary, combat, occult, melee, ranged,
    magic, defence`) against the 27 in `skillRegistry.js`, and four of its ten
    (`industry`, `culinary`, `combat`, `defence`) are not skill ids at all.
- **Verdict, as the session was asked for one**:
  - **`data/schemas/` and `data/templates/`: delete.** They describe a deleted
    system, they validate nothing, and leaving them beside live content is
    exactly the "vocabulary outlived its feature" pattern that produced `theme`.
  - **`data/archive/cards/`: delete — but not blind.** Nothing references it,
    `DatabaseManager.cardFiles` is empty and the `areaFiles*` globs that pointed
    into it resolve to nothing. **However**, `DatabaseManager.js:6-13` records a
    deliberate decision (G-18) to keep it "as reference for item ids, enemy ids
    and flavour" while Map 1's kit was authored. Map 1 is now authored. The
    honest position is that this is the owner's call and the reason to keep it
    has expired — **recommend delete, and if it is kept, delete the two dead
    globs anyway so nothing can load from it again.**
- **Why it matters**: Nine directories and six files of authoritative-looking
  specification that describe a system the project retired. The review has
  already documented six cases of a confident comment or schema misleading a
  later reader; this is the largest remaining pool of that material.
- **Related**: CR2-115, CR2-009 (documentation archive), `concept_audit.md`.

---

### CR2-119 · P2 · S · Session 5 · Status: Open
- **Where**: `src/config/registries/index.js` (112 lines)
- **What**: **The registries barrel has three importers using five symbols
  between them, and it is the sole reason two registries load at boot.**
  Every importer, found by grepping for `registries/index.js`:

  | Importer | Symbols used |
  |---|---|
  | `systems/hero/HeroGenerator.js:5-10` | `FOUNDATION_SKILL_IDS`, `STARTING_JOB_ID`, `getJobSkills`, `getRandomName` |
  | `systems/hero/SkillSystem.js:7` | `getSkill` |
  | `ui/components/card-modules/LootModule.jsx:4` | `getSkill` |

  The barrel re-exports roughly 60 symbols from six registries. Three of those
  registries — `itemRegistry`, `enemyRegistry`, `tokenRegistry` — are heavily
  imported directly elsewhere and lose nothing. Two are not:
  - **`recipeRegistry.js` has no importer anywhere except this barrel.** Checked
    `src/`, `src/tests/` and `cms/src/`, and checked the exported *symbols* as
    well as the filename: `RECIPES`, `getRecipe`, `getAllRecipes` and
    `getRecipesBySubskill` are referenced by nothing outside the registry file
    itself. The barrel is therefore why `data/recipes.json` (1,137 lines, 23
    recipes) is parsed on every launch, and why `[RecipeRegistry] Loaded 23
    recipe(s)` appears in the console of a game that has no recipes.
  - **`dropTableRegistry.js`** is imported directly by `LootSystem` too, so it
    is not a barrel orphan — but see CR2-116.
- **Why it matters**: Two things. It is a boot-time cost paid for nothing
  (performance is a standing objective, and registry loading is boot). And it is
  the mechanism the guide warns about — `node tools/reachability.mjs` reports
  `recipeRegistry.js` as **reachable**, because the barrel imports it, so it has
  survived every dead-code pass this project has run.
- **Suggested fix**: Point the three importers at the three registries they
  actually need (`skillRegistry`, `jobRegistry`, `nameRegistry` — the first two
  are already direct imports elsewhere in the codebase), then **delete the
  barrel**. Then `recipeRegistry.js` and `data/recipes.json` become genuinely
  unreachable and can go with CR2-115.
  ⚠️ **`nameRegistry.js` must NOT be deleted.** It reaches the game only through
  this barrel, which makes it look like an orphan, but `HeroGenerator` calls
  `getRandomName()` at two live sites (`:70`, `:152`) — every hero in the game
  is named by it. Removing the barrel means importing it directly, not removing
  it. This answers `concept_audit.md` §B4 for `nameRegistry`: **keep, it is
  live.**
- **Related**: `concept_audit.md` §B4, CR2-115, CR2-116, the guide's barrel
  caution.

---

### CR2-120 · P2 · S · Session 5 · Status: Open
- **Where**: `src/systems/core/SaveMigration.js`; observed in all three of the
  owner's live save slots
- **What**: **When a content id is renamed or removed, existing saves keep
  pointing at the old id forever, silently.** There is no content-id migration
  and no cleanup. Read out of the three live slots:

  | Slot | Ghost content ids held |
  |---|---|
  | 0 | tray: `token_forest`, `token_trout_stream`, `token_stew_pot`, `token_sawmill`; **token bank: `token_oakwood_grove` ×2** |
  | 1 | tray: the same four |
  | 2 | tray: the same four, plus `token_oakwood_grove` |

  **Verified at runtime**: loading slot 2 produced **no warning of any kind** —
  the console shows a clean boot. The ghosts are not inert either:
  `TokenBank.sellValue('token_forest')` returns **5**, while the *real*
  `token_oak_forest` returns 0 (CR2-044 recorded the same inversion). So a
  Token with no definition is worth more than a real one.
- **Why it matters**: Content is being re-authored continuously, so this is not
  a hypothetical. Each rename leaves permanent debris in every existing save:
  tray slots occupied by Tokens that cannot be placed usefully, bank entries
  that cannot be withdrawn into anything, and sell prices computed from a
  fallback rather than from the Token. A player's save quietly accumulates
  junk across every content update, and there is no route by which it is ever
  cleaned up.
- **Suggested fix**: Two options, and they are not exclusive.
  - **A. Report at load** *(recommended, and nearly free once CR2-108(a)
    exists)*: on `game_loaded`, run the same resolver over the save's content
    ids and log every unresolvable one. Tells the owner immediately when a
    rename has orphaned something.
  - **B. Prune at load**: drop unresolvable tray/bank/tile entries during
    rehydration. Riskier — it deletes player property on the strength of the
    registry being complete, which CR2-005 says it currently is not.
    Recommend A now, B once content stops moving.

  Either way `SELL_VALUE`'s fallback should return 0 for an unknown Token
  rather than a mid-tier price.
- **Related**: CR2-044, CR2-108, CR2-042 (schema drift in saves), Session 1's
  serialization territory.

---

### CR2-121 · P2 · S · Session 5 · Status: Open
- **Where**: `data/tokens.json` — `charges` and top-level `xp` on all 10 Tokens
- **What**: **Every Token carries two solver-authored fields the game does not
  read.** The CMS's `chargeSolver.js` computes `token.charges` and writes it
  (`balanceRunner.js:135-138`); the engine reads `def.uses`
  (`tokenRegistry.tokenStartingUses`) and **never `def.charges`** — grepped, no
  reference in `src/`. Every authored Token has both, and they disagree:
  `token_copper_pickaxe` is `uses: 1000, charges: 500`;
  `token_copper_ore_vein` is `uses: 100, charges: 500`. The same split affects
  `xp` (CR2-109).
- **Why it matters**: The balance solver is the machinery that is supposed to
  make the economy coherent, and half its output lands in fields nothing
  consumes. Retuning charges in the CMS changes nothing in the game, and the
  number the game *does* use is whatever was last hand-authored. Silent, and
  exactly the shape of CR2-003's "balanced against wrong numbers".
- **Suggested fix**: Pick one name and use it on both sides. `uses` is the
  engine's word and appears in D-176's "null means unlimited" contract, so the
  cheapest fix is for the sync to write the solved value into `uses`. Then
  remove `charges` from the authored shape so there is no second field to
  diverge.
- **Related**: CR2-109, CR2-003, CR2-010.

---

### CR2-122 · P3 · S · Session 5 · Status: Open
- **Where**: `data/items.json` → the entry keyed `"item"`
- **What**: A blank placeholder item — `"id": "item"`, `"name": ""`,
  `"description": ""`, `"sprite": ""` — sits in the shipped item registry
  alongside the five real items. It is one of only six items in the game.
- **Why it matters**: It resolves through `getItem()` like any other item, so
  every "does this exist?" check passes for it. It renders as a nameless entry
  with no art wherever items are listed (its sprite resolves to nothing —
  verified). Most likely a stray CMS row created by the "new item" button and
  never filled in or deleted.
- **Suggested fix**: Delete it in the CMS and re-sync. Worth also asking
  whether the CMS should refuse to sync an entity with an empty `name`.
- **Related**: CR2-001 (the same shape on Tokens — empty `theme`), CR2-108.

---

### CR2-123 · P3 · S · Session 5 · Status: Open
- **Where**: `data/tokens.json` → `token_smelter`, `token_wizard_academy`
- **What**: **Two Tokens do nothing at all.** Both are `tokenType: 'resource'`,
  both have `config: null`, neither has `recipes`, neither has `effectBlocks`,
  neither has `provides`. `productionRoutes()` returns `[]` for both, so placing
  one occupies a tile and produces nothing, forever. `token_wizard_academy` is
  also `size: 2`, so it occupies **two** tiles to do nothing, and it is both in
  the Test Map's pool and at step 7 of the Guild Hall's 13-step tutorial drop
  sequence (`guildHallMaps.js:35-38`).
- **Why it matters**: A player following the tutorial receives a Wizard Academy
  as a scripted reward, places it across two tiles, and nothing happens — with
  no alert, because `heroRequirementAlert` returns `null` when `config.skill`
  is absent (`BoardRunner.js:98`). It reads as a bug in the board, not as
  unfinished content.
- **Confidence**: Certain as code. Whether it is unfinished authoring or an
  intentionally inert Token is the owner's to say — but an inert Token in the
  tutorial drop sequence is worth flagging either way.
- **Related**: CR2-108, CR2-114.

---

### CR2-124 · P3 · S · Session 5 · Status: Open
- **Where**: `src/config/registries/sprite-manifest.js` (`pm_table_*` entries);
  `src/utils/AssetManager.js:98-100`; `src/tests/AssetManager.test.js:51,55`
- **What**: **The playmat table backgrounds resolve to a path where they do not
  live, and two components work around it by hardcoding the right one.**
  `resolveSpritePath` sends any `pm_table_*` id to
  `assets/playmat/tables/<id>.png`. That directory contains exactly two files
  (`pm_table_farmland_soil.png`, `pm_board_farmland_rocky_soil.png`). The four
  tables the Settings modal offers — `pm_table_wood_spruce` (**the default**),
  `pm_table_wood_planks_oak`, `pm_table_mountain`, `pm_table_forest` — are all
  in `public/assets/ui/`. The game looks correct because `ReactRoot.jsx:183`
  and `Tray.jsx:237` both build `/assets/ui/${id}.png` by hand and never call
  the resolver.
- **And a green test locks the wrong answer in.** `AssetManager.test.js:51`
  asserts `resolveSpritePath('pm_table_wood_spruce')` equals
  `'assets/playmat/tables/pm_table_wood_spruce.png'` — a file that does not
  exist. The test passes.
- **Why it matters**: Not player-facing today, which is why it is P3. It matters
  because the next component that resolves a table background properly will get
  a 404, and because it is a small clean instance of the review's recurring
  theme: a test asserting a mapping nobody checked against the disk.
- **Broader context for CR2-008**: run through the real resolver (not a naive
  manifest read), **59 of the manifest's 192 entries resolve to files that are
  not on disk** — mostly card-era backgrounds, equipment art and hero class
  portraits. The ten authored Tokens and five real items all resolve correctly.
  Session 9 should take that 59 as the starting list for the asset audit rather
  than re-deriving it. One more small one for the same list: `heroPortraits.js`
  offers 29 portraits and one of them, `hn_adventure2`, has no file.
- **Suggested fix**: Point the `pm_table_*` branch at `assets/ui/`, or move the
  four files into `assets/playmat/tables/`. Then fix the two assertions.
- **Related**: CR2-008, CR2-002 *(moot — see corrections)*, CR2-108.

---

### CR2-125 · P3 · S · Session 5 · Status: Open
- **Where**: `src/config/registries/tokenConstants.js:70-77` (`TOKEN_THEMES`);
  `src/config/registries/mapRegistry.js:65`; `guildHallMaps.js:78`
- **What**: **`theme` is answered NOT REAL by `concept_audit.md` §A, is empty on
  every piece of authored content, and is still the load-bearing filter that
  decides which Maps are purchasable.** `listMaps()` excludes any Map whose
  `theme` is the string `'guild_hall'`, which is the only thing keeping the 14
  tutorial Map aliases out of the shop. Meanwhile `TOKEN_THEMES` still declares
  a two-value vocabulary (`woodland`, `riverlands`) that no content uses, and
  `isTokenTheme` is exported for a CMS dropdown offering values nothing accepts.
- **Why it matters**: The concept audit says the concept is not real; the code
  says one specific value of it gates the shop. Both cannot be acted on. Anyone
  removing `theme` on the audit's authority will silently put 14 tutorial Maps
  into the Cartographer.
- **Suggested fix**: Replace the theme test in `listMaps()` with something
  honest about what it is actually asking — `guildHallMaps.js` could set an
  explicit `purchasable: false`, or `listMaps` could exclude ids present in
  `GUILD_HALL_MAPS`. Then `TOKEN_THEMES`/`isTokenTheme` can go with the rest of
  §A, and CR2-001's empty-theme Tokens stop being a defect at all.
- **Related**: CR2-001, CR2-039, CR2-114, `concept_audit.md` §A.

---

## Session 5 — verdicts on already-filed tickets

- **CR2-002 (Token sprite missing from disk) — ✗ MOOT. It is a false positive,
  and the test that produced it is broken.**
  `token_copper_pickaxe.sprite` is `Token_pickaxe_copper`; the manifest maps it
  to `assets/tokens/Token_pickaxe_copper.png`; **that file exists**
  (`public/assets/tokens/Token_pickaxe_copper.png`, exact case match). Verified
  by running every authored Token, item and enemy sprite through the real
  `resolveSpritePath` and `fs.existsSync`: **all ten Tokens resolve to files
  that exist.** Only two references in the whole content set fail, and neither
  is this one — the blank junk item (CR2-122) and `enemy_copper_miner`, which
  has no `sprite` field at all.
  **The reason the ticket exists is a bug in the test.**
  `ContentRules.test.js:351` builds the path as
  `public/assets/skills/${sprite}.png` — the **skills** folder — for Token art
  that lives in `assets/tokens/`. Un-skipped as written it would fail for all
  ten Tokens, not one. Close CR2-002; fix the test's path as part of CR2-108(b).
- **CR2-001 (empty `theme`) — confirmed live, but the suggested fix is wrong.**
  The ticket says to "set a real theme in the CMS". Per `concept_audit.md` §A
  themes are **NOT REAL**, so authoring one would re-establish a retired
  concept. The empty values are correct; what is wrong is that
  `tokenConstants.TOKEN_THEMES` still declares the vocabulary and `listMaps()`
  still depends on one value of it. Re-pointed at CR2-125. Note the ticket also
  understates the spread: `theme: ""` is on **both Maps** as well as the two
  Tokens it names.
- **CR2-039 (`tokenConstants` documents machinery that does not exist) —
  confirmed, with two additions.** The file's `TOKEN_THEMES` block is a third
  false claim, not just "stale": it presents theme as a live axis
  (`concept_audit.md` §A says otherwise) while the only real use of the field is
  the `'guild_hall'` shop filter it does not mention. And the CMS-facing claim
  that adding a value "makes it immediately available in the CMS's Token editor"
  is the one part that is true and load-bearing — `cms/src/utils/constants.js`
  imports it, which is CR2-010.
- **CR2-005 (18 skipped `ContentRules` cases) — confirmed, and worse than
  filed.** The ticket treats the skipped cases as the whole problem. Two of the
  **un-skipped** cases are also not doing their job: the `OPENING_TRAY` case
  passes vacuously over four non-existent ids, and the art case (skipped) is
  wrong anyway. Detail in CR2-108. When these are un-skipped they should be
  re-read, not just re-enabled.
- **CR2-004 (fixture insulation partial) — confirmed, and the exposure has
  grown.** The ticket names `item_oak_wood`, `item_charcoal` and
  `item_copper_ore` as the three real ids still used by fixtures. All three
  still exist in `data/items.json`, so nothing is broken today; but they are 3
  of only **6** items in the whole content set, so the tripwire is
  proportionally much larger than when it was filed.
- **CR2-010 (CMS imports seven game modules) — confirmed, all seven still live.**
  Re-verified each import path in `cms/src/utils/constants.js` and elsewhere.
  Reachability still reports exactly `modifierPalette.js` and
  `tokenConstants.js` as the two with no game-side consumer. Add to the ticket
  that CR2-112 is a *consequence* of this coupling being informal: the
  description composer in `cms/src` re-invents the modifier vocabulary
  (`axis`/`isPercent`) instead of using the `modifierPalette` it already
  imports.
- **CR2-014 (inert `biomeId` on enemies) — confirmed and wider.** It is on all
  four authored enemies *and* all 18 hardcoded ones (CR2-117), and three
  registry accessors still branch on it (`getEnemiesByBiome`,
  `getEnemiesByBiomeAndTier`, `getRandomEnemyForBiome` — all currently
  uncalled). Note `enemy_thorn_elemental.biomeId` is `"area_guild_hall"`, an
  *area* id, so the field is not even internally consistent.
- **CR2-044 (opening tray ids don't exist) — confirmed, and the reason no test
  caught it is now precise.** The ticket says the check "is switched off".
  It is not: `ContentRules.test.js:433` runs, and passes, because
  `TOKENS[typeId]?.config?.skill` yields `undefined` for a non-existent Token
  and the `if (!skill) continue` skips the assertion. Correcting that one line
  is worth more than un-skipping the other 18.
- **CR2-003 (balance solver off by 2×) — the favoured hypothesis is confirmed as
  far as this session can take it.** The ticket asks whether "Oakwood Grove" is
  the re-authored `token_oak_forest`. **There is no `token_oakwood_grove` in
  `data/tokens.json`** — but there *is* one in the owner's save slot 0 token
  bank and slot 2 tray (see CR2-120), i.e. it is a genuine former id that has
  been renamed. So the anchor the test expects does not exist and the solver is
  anchoring on something absent: a **stale test**, not a maths bug, exactly as
  hypothesised. `cms/src` internals remain out of scope, so it is not settled
  further here.
- **`nameRegistry.js` — NOT an orphan, keep it.** `concept_audit.md` §B4 is
  answered: it is reachable only through the barrel, but `HeroGenerator` calls
  `getRandomName()` at `:70` and `:152` and every hero in the game is named by
  it. See CR2-119 for the barrel question itself.
- **`heroPortraits`, `triggerRegistry`, `statusRegistry`, `equipmentCategories`,
  `guildHallMaps`, `sprite-manifest` — all single-consumer but all genuinely
  live.** Recorded here so no later session re-files them as orphans.

---

## System Map — Session 5: Content pipeline & the CMS boundary

### The pipeline, end to end

```
  CMS workspace (cms/src, Zustand: items, tokens, maps, recipePools)
        |  recalculateEconomy() -> solver (13 modules) + description composer
        v
  syncToGame()  -- POST /api/sync-game-data -->  data/items.json
   fileUtils.js:56                                data/tokens.json
                                                  data/maps.json
                                          X data/tokenRecipes.json  <- never written (CR2-111)
        v
  DatabaseManager.js   import.meta.glob, eager
        v
  registries (loaders, zero validation)  -->  engine + UI
```

### What `data/` holds, and who reads it

| File | Written by | Read by | Live? |
|---|---|---|---|
| `items.json` | CMS sync | `itemRegistry` | ✅ 6 items (1 blank, CR2-122) |
| `tokens.json` | CMS sync | `tokenRegistry` | ✅ 10 Tokens |
| `maps.json` | CMS sync | `mapRegistry` | ✅ 2, one inert (CR2-114) |
| `tokenRecipes.json` | **nothing** (CR2-111) | `recipePoolRegistry` | ⚠️ `{}` |
| `recipes.json` | `regenerate_game_package.js` (retired) | `recipeRegistry` — **which nothing imports** (CR2-119) | ❌ |
| `enemies.json` | `regenerate_game_package.js` (retired) | `enemyRegistry` | ⚠️ loaded, unreachable (CR2-110) |
| `encounters.json` | `regenerate_game_package.js` (retired) | **nothing** | ❌ |
| `effects.json` | `regenerate_game_package.js` (retired) | **nothing** | ❌ |
| `stations.json` | `regenerate_game_package.js` (retired) | `DatabaseManager.stationFiles` — **no consumer** | ❌ |
| `subskills.json` | `regenerate_game_package.js` (retired) | `DatabaseManager.subskillFiles` — **no consumer** | ❌ |
| `schemas/` (3), `templates/` (3) | — | **nothing** | ❌ (CR2-118) |
| `archive/cards/` (11 dirs) | — | **nothing** | ❌ (CR2-118) |
| `palettes/` | CMS `/api/custom-palettes` | CMS only | ✅ (CMS-side) |

### The 20 registries, by status

| Registry | Source | Live consumers (excluding the barrel) |
|---|---|---|
| `tokenRegistry` | `data/tokens.json` | 26 in `src/`, 18 tests — the busiest |
| `itemRegistry` | `data/items.json` | 27 in `src/`, 13 tests, 1 CMS |
| `mapRegistry` | `data/maps.json` + `guildHallMaps` | 4 |
| `recipePoolRegistry` | `data/tokenRecipes.json` (empty) | 1 (`RecipeResolver`) |
| `enemyRegistry` | `data/enemies.json` + 18 hardcoded | 8 |
| `skillRegistry` | hardcoded (27 skills) | 6 + CMS |
| `jobRegistry` | hardcoded | 5 |
| `equipmentConstants` | hardcoded | 9 |
| `equipmentCategories` | hardcoded | 1 (`equipmentConstants`) + CMS |
| `statusRegistry` | hardcoded | 2 |
| `triggerRegistry` | hardcoded | 1 (`TriggerSystem`) + CMS |
| `sprite-manifest` | hardcoded (192) | 1 (`AssetManager`) |
| `heroPortraits` | hardcoded (29) | 1 (`HeroEditModal`) |
| `guildHallMaps` | hardcoded | 1 (`mapRegistry`) |
| `nameRegistry` | hardcoded | **barrel only — but genuinely live** (CR2-119) |
| `recipeRegistry` | `data/recipes.json` | **barrel only, and nothing uses the symbols** (CR2-119) |
| `dropTableRegistry` | hardcoded (10 tables) | 1 call site that can only return null (CR2-116) |
| `modifierPalette` | hardcoded | **CMS only** (CR2-010) |
| `tokenConstants` | hardcoded | **CMS only + 1 test** (CR2-010, CR2-039) |
| `index.js` (barrel) | — | 3 importers, 5 symbols (CR2-119) |

### Content shape — what the ten Tokens actually are

| Token | Type | Produces | Notes |
|---|---|---|---|
| `token_oak_forest` | resource | Oak Wood, 12s | the only tool-free producer |
| `token_copper_ore_vein` | resource | Copper Ore, 12s | needs an adjacent `pickaxe` tag |
| `token_copper_pickaxe` | context | — | provides `pickaxe`; `tags: ["Pickaxe"]` is a separate, unread axis |
| `token_charcoal_kiln` | station | Oak Wood → Charcoal | `config.skill: ""` — no skill gate, no XP |
| `token_forge` | station | 4 Copper Ore → Copper Ingot | `config.skill: ""` |
| `token_forge_altar` | passive | — | `WORK_TIME +20%` + `BONUS_DROP`; description has NaN (CR2-112) |
| `token_copper_ore_minecart` | manager | — | restocks the Ore Vein |
| `token_map` | map | — | `mapId: map_test_map` |
| `token_smelter` | resource | **nothing** | CR2-123 |
| `token_wizard_academy` | resource | **nothing** | CR2-123, and `size: 2` |

No Token is `tokenType: 'enemy'`, `'buff'` or `'market'` (CR2-110). Every Token
declares `xp: 10` and `charges: 500` that nothing reads (CR2-109, CR2-121).

### Every dangling content reference in `data/`, as of this session

Produced by walking the cross-reference table in CR2-108 over the shipped files:

```
enemies.enemy_copper_miner.drops     -> missing item "hat_miners_helm"
enemies.enemy_copper_miner.drops     -> missing item "item_copper_sword"
enemies.enemy_thorn_elemental.drops  -> missing item "item_blackberry"
enemies.enemy_skeleton_warrior.drops -> missing item "amulet_iron_chain"
enemies.enemy_cow.drops              -> missing item "item_beef"
enemies.enemy_cow.drops              -> missing item "item_bones"
encounters.encounter_mpqi3mk5        -> missing enemy "enemy_mpqi3mjs"
encounters.encounter_mpqi3mk5        -> missing enemy "enemy_mpqi3mjt"
```

Plus, from hand-written game-side content: `OPENING_TRAY`'s four Token ids
(CR2-044), `RANDOM_HUNTS`'s four enemy ids (CR2-084), and — outside `data/` —
`dropTableRegistry`'s 23 item ids and `STATIC_ENEMIES`' drops (CR2-116/117).
**Nothing reports any of them.**

### Is the "Sync to Game destroys unmodelled content" hazard closed?

**Half closed, and the dangerous half is a different file than the warning
named.**

- **The CMS's own sync route is now safe in the way the warning meant.**
  `/api/sync-game-data` writes only the files it is handed
  (`cms/vite-plugin-cms-api.js`), and `syncToGame` hands it exactly three:
  `items.json`, `tokens.json`, `maps.json`. It has a path-traversal guard, it
  creates directories rather than clearing them, and — critically — **it no
  longer touches `enemies.json`, `recipes.json`, `quests.json` or the card
  directories**, which is what "destroys unmodelled content" originally
  described. The reverse route is gone too: `GET /api/load-game-data` was
  removed in Phase 0, so there is no game → CMS import to corrupt.
- **Within those three files the write is still wholesale**, which is by design
  (CMS-53) and is why every registry file carries the "never hand-edit"
  warning. Any field the CMS does not model on an item, Token or Map is
  destroyed on the next sync. That is a known, accepted property — but it is
  worth naming that `data/tokens.json` currently carries fields the CMS models
  and the *game* does not (`charges`, top-level `xp` — CR2-121), which is the
  mirror-image problem.
- **The unsafe path is `scripts/regenerate_game_package.js`** — CR2-113. It
  still writes `quests.json`, three card directories, and card-era shapes over
  `items.json` and `enemies.json`, from a single hardcoded CMS autosave on one
  developer's machine. Running it would destroy the current content set. **The
  hazard should not be marked closed until that script is deleted.**

### Session 5 — save-slot handling

All **seven** localStorage keys present in this browser profile
(`fantasy_guild_slot_{0,1,2}`, their three `_backup` twins, and
`fantasy_guild_last_slot`) were read out in full and captured into the session
transcript **before any probe**, and into `window.__SAVE_BACKUP` as a second
copy. Byte lengths at capture: 5014 / 4868 / 4364 for slots 0 / 1 / 2 and their
backups, 1 for `last_slot`. Note `fantasy_guild_settings` and
`fantasy_guild_dev_mute_applied` were **not present** in this profile, so seven
rather than Session 4's nine.

**This session mutated no game state.** Every runtime probe was a read —
`Cartographer.catalogue()`, `Cartographer.rollBurst()`,
`RecipeResolver.effectiveIO()`, `TokenBank.sellValue()` and direct reads of
`GameState`. No Token was placed, no hero moved, no upgrade purchased, no quest
installed, and the page was never reloaded.

**An autosave still fired**, because the loop was left running while the
territory was being read — slot 2 was the loaded slot. Comparing the autosaved
slot 2 against the capture, field by field, found **exactly three differences
and no game data among them**: `savedAt` and `meta.lastSavedAt` advanced by ten
minutes, and `progress.mapDiscoveries` went from absent to `{}` (created by
rehydration). Heroes, inventory, currency, board, tray, quests and time bank
were byte-identical.

`GameLoop.stop()` was then called **before** restoring, so no autosave could
fire mid-restore, and all seven keys were written back from the capture and
re-compared: **seven of seven EXACT MATCH**, with no extra
`fantasy_guild_*` keys left behind. The page was left with the loop stopped and
was not reloaded.

⚠️ **Pre-existing residue worth the owner knowing about**, found while reading
the slots: slot 2 contains three probe artefacts from earlier review sessions —
tray entries `probe_a`, `probe_b`, `probe_tok`, board tiles 10 and 11 holding
`probe_a`/`probe_b`, and a `p_hero` quest with `requiredCount: 99`. Slot 0's
token bank holds two `token_oakwood_grove`. None of this was created by Session
5. It is harmless, but slot 2 is now a test fixture rather than the owner's own
play state.

---

## Filed by Session 6 — UI ↔ engine boundary, shell & shared UI (2026-08-19)

**Territory covered:** all 4 hooks, both contexts, `ReactRoot.jsx`, all 3 `dnd/`
files, all 10 `components/base/`, all 6 `modals/`, `nav/BubbleMenu.jsx`,
`hud/TimeBankWidget.jsx`, `quests/QuestColumn.jsx`,
`card-modules/LootModule.jsx`, `utils/cn.js`, `dev/cardSizeStore.js` and the
four dev surfaces — 35 files, ~5,550 lines, all read in full. Plus the two
sweeps across **all** of `src/ui/` (64 files).

⚠️ **Guide drift, reported rather than worked around** (per the guide's closing
rule). The Session 6 row names `dev/DevSpawnItemModal.jsx` and
`sandbox/LayoutSandbox.jsx`; both live under `src/ui/components/` —
`components/dev/DevSpawnItemModal.jsx` and `components/sandbox/LayoutSandbox.jsx`.
`src/ui/dev/` contains only `cardSizeStore.js` and `src/ui/sandbox/` does not
exist. The row also says `components/base/` holds 9 files; it holds **10**
(`FPSCounter.jsx` is listed separately in the same row but lives in `base/`).
The kickoff brief's counts (base = 10, modals = 6, hooks = 4) were correct.

**Save-slot discipline:** the dev-server browser profile held **zero**
`localStorage` keys at the start of this session — no saves, no settings, nothing
to back up and nothing at risk. This session started a fresh game in slot 1 to
have something to exercise. Full account in the Session Status row.

**Territory tooling result:** `npm run lint` reports **19 of its 32 problems** in
this territory (all folded into tickets below, mostly CR2-152). `npm run
duplication` reports **4 of 12 clones** here or adjacent (the surviving
Vault-deposit family, CR2-146, plus the Toast/QuestColumn animation preset).
`npm run cycles` reports nothing in `src/ui/`.

**Baseline re-verified untouched:** 840 passed / 21 skipped / 0 failed, 58 files.

---

### CR2-126 · P1 · S · Session 6 · Status: Open
- **Where**: `src/ui/components/drawer/TokenVaultTab.jsx:80, 86, 146, 147, 148`
  — no `EventBus` import anywhere in the file (imports are lines 1–14)
- **What**: **`EventBus` is used five times in `TokenVaultTab.jsx` and is never
  imported.** Every one of those lines throws
  `ReferenceError: EventBus is not defined`.
- **Confirmed at runtime**: right-clicking a Token in the Vault ("quick add to
  Tray") in the running game withdrew the Token and added it to the Tray, then
  threw. The browser console shows
  `Uncaught ReferenceError: EventBus is not defined at onQuickAdd`. The three
  `publish` calls after it — `state_changed`, `vault_withdrawn`,
  `token_bank_updated` — and the `Added <name> to Tray` success notification
  **never ran**. An event-counting probe recorded exactly **one**
  `vault_withdrawn` (the one `TokenBank.withdraw()` publishes itself), and no
  toast appeared in the notification column.
- **Why it matters**: Two of the Vault's four routes are half-executing.
  1. **Quick-add** (right-click a Vault cell): works only because
     `TokenBank.withdraw()` happens to publish the events the UI needs; the
     confirmation message the player was meant to see is lost, and the handler
     dies mid-way every single time.
  2. **Deposit onto the Vault pane** (drag a Token from the Tray or a tile onto
     the open Vault): the deposit itself lands, then the handler throws before
     `state_changed`. On the tile route (`Placement.returnTokenToVault`,
     line 86) nothing else publishes `state_changed`, so any part of the UI that
     refreshes only on `state_changed` is left stale until the next tick.
  It is also, quietly, a *lucky* bug: the same five lines were the fix for
  CR2-033. Had `TokenBank.withdraw()` not already published `vault_withdrawn`,
  the withdraw quest would never have counted at all.
- **Suggested fix**: add
  `import { EventBus } from '../../../systems/core/EventBus.js';`. Then decide
  whether the three manual publishes should exist at all — see CR2-146.
- **Related**: CR2-129 (this is exactly what the disabled `no-undef` rule would
  have caught on day one), CR2-127, CR2-128, CR2-033, CR2-146.

#### ✅ Session 8 — independently reproduced

Right-clicking a Vault cell in the running game (quick-add): the Vault count for
that Token went **2 → 1**, the Tray went **5 → 6**, and the console threw
`Uncaught ReferenceError: EventBus is not defined`. Identical to Session 6's
account. The Token moves; everything after the first `EventBus.publish` — the
three publishes and the "Added … to Tray" toast — does not run. **Confirmed.**

---

### CR2-127 · P1 · S · Session 7 *(found by Session 6)* · Status: Open
- **Where**: `src/ui/components/board/Board.jsx:253, 256` — no `TokenBank`
  import anywhere in the file (imports are lines 1–20)
- **What**: **`TokenBank` is used twice in `Board.jsx` and is never imported.**
  Both lines throw `ReferenceError: TokenBank is not defined`.
- **Why it matters**: This is the drop handler's **"dragged straight from the
  Token Vault onto a board tile"** branch (`payload.from?.vaultTypeId != null`).
  It throws on the first line of the branch, so the Token is neither taken out
  of the Vault nor placed on the tile — **the drag simply does nothing**, with
  an error in a console the player never sees. Dragging the same Token to the
  Tray first and then to the tile works, so the failure looks like a
  temperamental drag rather than a bug.
- **Confidence**: proven by static analysis and by ESLint's `no-undef` under a
  corrected config (CR2-129); **not** reproduced by an actual drag, because
  drag-and-drop cannot be simulated reliably in this project (the guide's own
  Session 8 note). The owner should try the drag by hand to see the symptom.
- **Suggested fix**: add
  `import * as TokenBank from '../../../systems/board/TokenBank.js';`.
  `TrayMiniBoard.jsx` already handles the identical branch correctly and can be
  used as the reference.
- **Related**: CR2-129, CR2-126, CR2-128.

#### 🔻 Session 8 — REFUTED as player-facing. This is dead code, not a bug.

Drag-and-drop turned out to be automatable after all (see the System Map note),
so this was tested by actually dragging.

**The branch cannot be reached.** To see a Vault Token the drawer must be open,
and the drawer **covers the playmat by design**. `BottomFolderDrawer.jsx:81-92`
says so in its own words — it "spans inward, **covering the notifications column
and the playmat** and stopping before the Tray", and the comment goes on to
record *why*: "**the only route from storage to a tile is Bank → Tray → Board**".
`DndKit.jsx:56-63` enforces the same thing at collision time — "**Drawers beat
the board where they overlap**", drawer surfaces ranking above board surfaces.

Verified by dragging a Vault Token over board tile 2 with the drawer open: the
live region reported `moved over droppable area **vault-deposit**`, never a
`tile-N`, and the drop did nothing and threw nothing. Repeated over several
tiles; the board is never the target.

**The route that does work** is Vault → the mini-playmat inside the Tray
(`TrayMiniBoard`, which is deliberately left uncovered). Dragging a Vault Token
onto `miniboard-tile-1` placed it on board tile 1 correctly: Vault 3 → 2, tile
occupied, **no error** — because `TrayMiniBoard.jsx:58` imports `TokenBank`
properly.

**Reclassify: P3 · S · dead code.** `Board.jsx:252-256` is an unreachable branch
whose sibling in `TrayMiniBoard` is the live implementation. The honest fix is to
**delete the branch**, not to add the import — adding the import would keep a
second copy of a rule alive (the CR2-134/CR2-146 pattern). If the owner *wants*
Vault→board drops, that is a design change to the drawer's geometry, not a
missing import.

---

### CR2-128 · P1 · S · Session 6 · Status: Open
- **Where**: `src/ui/dnd/DragGhost.jsx:115-117`
- **What**: **`<GhostCardFrame>` is rendered but is never defined or imported.**
  A full-tree grep confirms the identifier exists nowhere else in the repo —
  three occurrences, all inside this one JSX block.
- **Why it matters**: This is the ghost drawn while **an Item is being dragged
  and the cursor is over the board** (`bold === true`). It throws a
  `ReferenceError` inside the drag overlay's render, which in React 19 takes the
  whole render down rather than just the ghost. Item drags to a drawer (the
  common case) take the `!bold` branch and are unaffected, which is why this has
  survived — the crash only fires when the player's cursor crosses the playmat
  mid-drag.
- **Confidence**: proven statically and by ESLint under a corrected config
  (CR2-129); **not** reproduced by an actual drag, for the reason in CR2-127.
- **Suggested fix**: `GhostCardFrame` was a banner-card frame that went with the
  card system. Given the comment two lines above — *"Items still bloom, and
  still use the retired banner tiers"* — the honest fix is to drop the bold
  branch entirely and always draw the compact 64px `ItemIcon`, which is what
  Tokens and Heroes already do (D-219/D-220). That also retires `boardTier()`
  and `bannerCardSize()`, which read a `data-card-tier` attribute nothing sets.
- **Related**: CR2-129, CR2-147 (`cardSizeStore`).

#### ⚠️ Session 8 — attempted, NOT reproduced, and probably for the same reason as CR2-127

The `bold` branch fires when an **Item** is dragged and `surfaceAtPoint` says the
cursor is over the **board**. Every Item drag source in the game lives inside a
drawer or the hero sheet, and `surfaceAtPoint` (`DndKit.jsx:69-74`) has the same
rule as the collision sorter: **"Drawers win over the board where they overlap."**
With the Bank drawer open the playmat is entirely underneath it, so the cursor is
never "over the board" while an Item is in hand.

**Not proven unreachable, though** — unlike CR2-127 there is one geometry where
it might fire: the hero inspection sheet sits in the right-hand column, outside
the drawer, and dragging an equipped Item from there across the playmat would put
the cursor over uncovered board. Session 8 could not set that up (only one of the
six authored Items, `item_water`, is equippable at all, and `equipItem` refuses
duplicates, so a hero cannot hold two draggable Items to experiment with).

**Recommendation: fix it anyway, as CR2-128 already proposes** — dropping the
bold branch removes an undefined identifier and retires `boardTier()` /
`bannerCardSize()` with it, which is worth doing whether or not the crash is
reachable. **Confidence on reachability: unresolved. Do not close it as dead
code the way CR2-127 can be.**

---

### CR2-129 · P1 · S · Session 9 *(found by Session 6)* · Status: Open
- **Where**: `eslint.config.js:31-83`
- **What**: **The linter is running with six rules, not the recommended set.**
  The config spreads `...js.configs.recommended` into the same object that then
  declares its own `rules: { … }` block. In ESLint flat config the later `rules`
  key **replaces** the spread one wholesale, so every rule
  `js.configs.recommended` provides is silently dropped.
- **Proven**: `npx eslint --print-config` on any source file reports
  **6 active rules**, and `no-undef`, `no-unreachable`, `no-dupe-keys`,
  `no-const-assign`, `no-cond-assign`, `no-fallthrough`, `no-self-assign`,
  `valid-typeof` and `use-isnan` are all `undefined`. A throwaway file
  containing a call to an undeclared function and unreachable code lints
  **clean**.
- **The comment in the file asserts the opposite.** Lines 51–53 read: *"js.configs.recommended
  already gives us: no-undef, no-unreachable, no-dupe-keys, no-dupe-args,
  no-const-assign, no-cond-assign, no-fallthrough, no-self-assign, valid-typeof,
  use-isnan, etc."* None of them are on. This is the **seventh** documented case
  in this codebase of a confident comment stating something untrue (after
  `theme`, `tokenConstants`/CR2-039, the Rarity comment, and the rest).
- **Why it matters**: `no-undef` is the single rule that catches "this code
  refers to something that does not exist", which is the most immediately fatal
  shape of the review's primary objective. Running the recommended set over the
  current tree finds **three genuine runtime crashes that the current lint
  misses** — CR2-126, CR2-127 and CR2-128 — plus `no-useless-assignment` hits in
  `Board.jsx`, `TokenInspectPopup.jsx` and `AssetManager.js`, and two test files
  using `process`/`require` without Node globals. Total: **17 problems, 16 of
  them errors**, none of them currently reported.
- **Why it matters twice**: every session of this review has used
  `npm run lint` as its mechanical detector, and `tooling_baseline.md` presents
  "32 problems" as the whole picture. It is not. The 32 are almost entirely
  `no-unused-vars`, because that is one of the six rules that survived.
- **Suggested fix**: move the recommended rules into the `rules` object
  explicitly — `rules: { ...js.configs.recommended.rules, …overrides }` — or
  split `js.configs.recommended` into its own config entry ahead of the custom
  one. Then fix the 16 errors (three of which are CR2-126/127/128) and re-record
  the baseline. Session 9 owns `eslint.config.js`; the three crash tickets are
  independent and should not wait for it.
- **Related**: CR2-036, CR2-126, CR2-127, CR2-128, `tooling_baseline.md` §1.

---

### CR2-130 · P1 · S · Session 6 · Status: Open
- **Where**: publishers — `src/ui/modals/JobChangeModal.jsx:68, 74`,
  `src/ui/modals/HeroEditModal.jsx:78`,
  `src/ui/components/drawer/BankTab.jsx:477`. Subscribers — none.
- **What**: **`ui:notify` has no subscriber anywhere in the codebase.** Four
  publish sites across three components fire messages into an empty room.
- **Confirmed at runtime**: `EventBus.subscribers.get('ui:notify')` is
  **undefined** in a live game (checked alongside 12 other event names; the
  five `ui:open_*` events each have exactly one).
- **Why it matters**: These are not decorative messages — they are the only
  feedback for three actions that can be refused:
  - **Changing a hero's job.** Success ("*Ginger is now a Knight*") and failure
    ("*that job is out of reach*", with the engine's own detail) are both lost.
    On failure the modal simply stays open with nothing happening.
  - **Retiring a hero.** A refused retirement says nothing at all; the
    confirm-state resets and the player is left guessing.
  - **Selling from the Bank.** `result.error` — the engine's explanation for why
    a sale was refused — is published and dropped.
  This is the same shape as CR2-033: a route that announces itself into a
  channel nobody listens on.
- **Suggested fix**: `NotificationSystem` is the live channel — `ToastContainer`
  mirrors its queue and it is what every other component uses
  (`NotificationSystem.warning(...)` appears throughout the Tray, Vault and
  BubbleMenu). Either route `ui:notify` into it in
  `NotificationSubscriptions.js`, or replace the four publish calls with direct
  `NotificationSystem.success/error` calls. The second is simpler and matches
  the majority pattern; the first keeps the modals free of a direct dependency.
  **Recommend the second.**
- **Related**: CR2-033, CR2-131.

---

### CR2-131 [DECIDED: disabled + coming soon] · P1 · M · Session 6 · Status: Open
- **Where**: `src/ui/modals/SettingsModal.jsx:100-213`;
  `src/systems/core/SettingsManager.js:29-63`
- **What**: **Eleven of the Settings screen's controls change a stored value
  that nothing in the game reads.** Verified by grepping each key across `src/`
  and `cms/src` and excluding `SettingsModal.jsx` and the defaults table itself:

  | Control | Key | Readers outside Settings |
  |---|---|---|
  | Theme Mode (Dark/Light) | `gameplay.themeMode` | **0** |
  | Zoom to Cursor | `ui.zoomToCursor` | **0** |
  | Animations | `gameplay.enableAnimations` | **0** |
  | System Messages | `showSystemMessages` | **0** — *and not even declared in the defaults* |
  | Level Up Messages | `showLevelUpMessages` | **0** — *not declared* |
  | Loot Messages | `showLootMessages` | **0** — *not declared* |
  | Master Tooltips | `ui.tooltipsEnabled` | **0** |
  | Card Badge Tooltips | `ui.tooltipsCardBadges` | **0** — cards are retired |
  | Boost Tile Tooltips | `ui.tooltipsBoostTiles` | **0** |
  | Item Tooltips | `ui.tooltipsItems` | **0** |
  | Instant Pack Reveal | `ui.instantPackReveal` | **0** — packs are retired (D-153) |

  A twelfth, **Notification Position**, *is* read (`ToastContainer.jsx:38`) but
  has no effect: its six corner options describe a floating overlay that the
  column layout replaced. The file says so itself at lines 22–27 and asks for a
  decision — this ticket is that decision being asked for.
- **Why it matters**: Roughly half the Settings screen is inert. Three of the
  three "Messages" toggles read `undefined`, so they render as **off** while the
  messages they claim to control keep arriving — a player who turns "Loot
  Messages" *on* to fix that gets nothing either. Two of the eleven
  (Card Badge Tooltips, Instant Pack Reveal) name systems that no longer exist.
  The four tooltip toggles are the most visible: the game shows tooltips
  everywhere and the master switch does nothing.
- **Suggested fix**: **Owner decision, three groups:**
  - **(A) Delete now** — Card Badge Tooltips and Instant Pack Reveal, whose
    systems are gone. Uncontroversial.
  - **(B) Wire up** — the four tooltip toggles and the three message filters are
    ordinary features whose consumers were lost in a rework; each is a small
    fix at the point of use. *Recommended.*
  - **(C) Owner's call** — Theme Mode, Zoom to Cursor, Animations, and
    Notification Position. These are real features that were never built (Theme
    Mode especially — the game is dark-only). Recommend removing the controls
    until the features exist, rather than leaving switches that lie.
- **Related**: CR2-132, CR2-133, `ui_bugfix_tracker.md`.

---

### CR2-132 [DECIDED: restore] · P2 · S · Session 6 · Status: Open
- **Where**: `src/ui/hooks/useUIModals.js:254-272`
- **What**: **Five of the seven events `useUIModals` subscribes to have no
  publisher anywhere in the codebase** — `ui:open_loot_table`,
  `ui:open_pack_overlay`, `ui:open_hero_customize`, `ui:card_tier_changed` and
  `ui:open_settings`. Only `dev:toggle-sandbox` (from `TestDashboard`) and
  `ui:open_drawer` (from `BankTab` and `TokenInspection`) are ever fired.
  Confirmed at runtime: each of the five has exactly one subscriber and zero
  publishers.
- **Why it matters**: Each dead subscription is the far end of a feature whose
  near end is missing, and two of them keep real code alive:
  - **`ui:open_loot_table` is the only way to open `LootTableModal`.** That
    modal is rendered unconditionally by `ReactRoot:361`, and it is the only
    importer of `LootModule.jsx` (207 lines), which is in turn the **only**
    consumer of the `useDiscovery` hook (64 lines). **A whole 270-line branch of
    the UI — a modal, a card module and a hook — is reachable only through an
    event nobody publishes.** Its own doc comment says it opens from *"the
    CompactLootModule in hover drawers"*, a component that no longer exists.
  - **`ui:card_tier_changed` is the only writer of `cardTier`**, so `cardTier`
    is permanently `'md'`. `ReactRoot` passes it to `BottomFolderDrawer`, which
    **ignores it** (CR2-036, Session 7). The card-size feature is therefore dead
    at both ends simultaneously.
  - **`ui:open_pack_overlay`** sets `packResults`, which feeds `isAnyModalOpen`
    — which disables the particle overlay. The pack overlay was deleted with the
    pack economy (the comment at `ReactRoot:368` says so). If anything ever
    published this event, particles would switch off permanently with no way to
    clear the state.
  - `ui:open_hero_customize` and `ui:open_settings` are harmless duplicates of
    routes that now go through `ui.dock.openEdit` and the nav bar.
- **Suggested fix**: Delete the three dead subscriptions with no future
  (`pack_overlay`, `open_hero_customize`, `open_settings`) and the `packResults`
  state with them. **`ui:open_loot_table` needs an owner decision** — the loot
  table is a genuinely useful screen and nothing else in the game shows a drop
  table, so this may be a feature that lost its button rather than one that was
  retired. Same shape as `ToastContainer`'s collapse (CR2-035).
- **Related**: CR2-035, CR2-036, CR2-038, CR2-151.

---

### CR2-133 · P2 · S · Session 6 · Status: Open
- **Where**: `src/ui/modals/SettingsModal.jsx:208-210`
- **What**: **All three dev buttons on the Settings → Dev Tools tab do nothing.**
  They publish `dev:give-all-resources`, `dev:spawn-hero` and
  `dev:open-spawn-entity`; none of the three has a subscriber anywhere.
- **Confirmed at runtime**: clicked "+1000 Resources" and "Spawn Hero" in a live
  game. Gold stayed at 120, influence at 10, roster at 1 hero. Subscriber counts
  for all three events: **0**.
- **Why it matters**: Small, but it is a dev tool that silently lies — someone
  debugging will click these, see nothing, and go looking for the wrong problem.
  The working equivalents all live in `TestDashboard` ("Add 1k Gold", "Hire
  Random Hero", "🧰 Spawn Items…"), so the capability exists twice and only one
  copy is wired.
- **Suggested fix**: Delete the three buttons and the Dev Tools grid, leaving
  the Debug Mode toggle (which does work). `TestDashboard` is the owner-approved
  dev surface (Q5) and already covers all three actions.
- **Related**: Q5 in the guide's Owner rulings (the four dev surfaces are KEEP —
  this ticket removes duplicated buttons in a *non*-dev-surface file, not the
  surfaces themselves).

---

### CR2-134 · P2 · S · Session 6 · Status: Open
- **Where**: `src/ui/components/board/Tray.jsx:414-430`;
  `src/ui/components/drawer/TokenVaultTab.jsx:65-90`;
  `src/ui/components/nav/BubbleMenu.jsx:106-131`
- **What**: **The answer to this session's mutation-from-UI sweep, in its
  stronger form: yes — the Vault deposit rule still lives in three React
  components.** CR2-033 fixed the *event* (the `vault_deposited` publish moved
  into `TokenBank.deposit()`); the *rule* was left copied three ways. All three
  copies still carry, in order: "a Map cannot be stored — open it", "the Vault
  can be full", "now take the Token out of the Tray". `npm run duplication`
  still reports the Tray/TokenVaultTab pair as clones; BubbleMenu's copy is just
  short enough to slip under the 60-token threshold.
- **And the copies have drifted again, differently this time.** They now differ
  on what they publish afterwards: `TokenVaultTab` publishes `state_changed`
  (or would, if `EventBus` were imported — CR2-126), `Tray`'s context-menu route
  publishes `state_changed`, `board:tile_changed` **and**
  `board:sprite_collected`, and `BubbleMenu` publishes nothing at all. The tile
  route (`Placement.returnTokenToVault`) is announced by two of the three and
  not the third.
- **Why it matters**: This is the exact failure CR2-033 documented, still
  present, one layer down. Nothing is visibly broken today — the map check is
  duplicated *belt-and-braces* over `TokenBank.deposit`'s own D-156 enforcement
  (`TokenVaultTab`'s comment says so honestly) — but the next component that
  wants to accept a Vault deposit will write a fourth copy, and the fourth one
  will drift too. The guide's objective 3 is explicit: **a rule in a component
  is the bug even when it currently behaves correctly.**
- **Suggested fix**: One engine function — `TokenBank.depositFrom(source)` —
  that takes the Token wherever it is, applies both refusals, moves it, and
  publishes. Every component then calls it and shows `result.reason`. That
  collapses three copies to three one-line calls and removes the last place
  `state_changed` can be forgotten.
- **Related**: CR2-033, CR2-126, CR2-146, `tooling_baseline.md` §3.

---

### CR2-135 · P2 · S · Session 6 · Status: Open
- **Where**: `src/ui/components/base/GIModal.jsx:11, 57, 65`;
  `src/ui/modals/SlotSelectionModal.jsx:155`
- **What**: Two related faults in the shared modal shell.
  1. **`SlotSelectionModal` passes `hideClose={true}` and `GIModal` has no such
     prop.** It is silently dropped.
  2. **`GIModal`'s "is this the default no-op?" test can never be true.** The
     default is `onClose = () => { }` (with a space), whose `.toString()` is
     `'() => { }'`; the test compares it against the string `'() => {}'`. So the
     X button renders for every modal, including ones that deliberately want no
     close. Line 57 has the same idea in an even stranger form —
     `onClose !== (() => { })?.toString()` compares a function to a string and
     is therefore always true.
- **Confirmed at runtime**: the **SYSTEM BOOT** slot-selection screen — the very
  first thing a player sees — renders a close ✕ in its header. Clicking it calls
  the no-op default and nothing happens. DOM captured from the live game.
- **Why it matters**: A dead button on the boot screen reads as a frozen game.
  It is also a trap for the next modal: the only way to hide the ✕ today is to
  not pass `title` either, which loses the header entirely.
- **Suggested fix**: Replace the string comparison with a real
  `hideClose` prop (defaulting false) and drop the `() => { }` default in favour
  of `onClose = null`, so "no close handler" is expressible.
- **Related**: CR2-152.

---

### CR2-136 · P2 · S · Session 6 · Status: Open — **verdict on CR2-037**
- **Where**: `src/ui/context/EngineContext.jsx:13-19`;
  `src/ui/hooks/useEngine.js`
- **What**: **CR2-037 is correct that there are two implementations, but wrong
  about the count of importers.** It says the `EngineContext` copy has 2
  importers. It has **zero**. `EngineContext.jsx` is imported twice — by
  `ReactRoot.jsx` (which takes `EngineProvider`) and by `hooks/useEngine.js`
  (which takes the bare `EngineContext` object). **Nothing anywhere imports
  `useEngine` from `EngineContext.jsx`**, verified across `src/`, `src/tests/`
  and `cms/src/`.
- **Verdict**: this is not "two live implementations competing"; it is one live
  hook (13 importers, `hooks/useEngine.js`) and one dead duplicate export.
  **Deleting the `useEngine` export from `EngineContext.jsx` breaks nothing** —
  no import to repoint, no test to update. Effort is genuinely a two-line
  deletion, lower than CR2-037 assumed.
- **Suggested fix**: delete lines 13–19 of `EngineContext.jsx`. Keep
  `EngineContext` and `EngineProvider` exactly as they are.
- **Related**: CR2-037 (update its Where/What when this lands).

---

### CR2-137 · P2 · S · Session 6 · Status: Open — **verdict on CR2-038**
- **Where**: `src/ui/components/base/GICard.jsx`
- **What**: **CR2-038 confirmed, still true, and slightly wider.** Nothing in
  `src/` or `cms/src/` imports `GICard`. Its only importers are
  `src/tests/GICard.test.js` (the regression test written for CR2-034) and
  `src/tests/HeroDock.test.js`, which imports the `CARD_TIERS` constant —
  **and `CARD_TIERS` has no consumer in the game either**, so the test asserts
  against a table only it reads. `node tools/reachability.mjs` still lists the
  file.
- **Plus**: the file still publishes `audio:focus_changed` on hover
  (lines 67, 101), and that event still has **0 subscribers at runtime**
  (CR2-020). Two dead things nested inside each other.
- **Why it matters**: unchanged from CR2-038 — real fix effort (CR2-034) went
  into code no player reaches. Worth settling before more does.
- **Suggested fix**: **Owner decision, unchanged from CR2-038.** Given that the
  card system is retired, `LootTableModal` is unreachable (CR2-132) and
  `GhostCardFrame` is missing (CR2-128), the honest reading is that `GICard` is
  the last of the card-era shell components and should go with its test and with
  `GISurface` (CR2-035). **Recommend delete.** If it is kept, it needs a
  consumer, or it will collect fixes forever.
- **Related**: CR2-034, CR2-035, CR2-038, CR2-020, CR2-128.

---

### CR2-138 · P2 · S · Session 6 · Status: Open
- **Where**: `src/ui/ReactRoot.jsx:287, 71, 175`
- **What**: Three things wired at one end only in the app shell itself.
  1. **`onSelectHero={(id) => {}}`** (line 287) — `RightmostHeroDock` is handed
     an empty function for single-click hero selection. `ReactRoot` tracks
     `inspectHeroId` and passes it back down as `selectedHeroId`, but the only
     thing that ever sets it is `onDoubleClickHero`. So the dock's selection
     state exists, is passed both ways, and one of its two triggers is a stub.
  2. **`NotificationColumn({ menuRight })`** (line 71) — the prop is declared,
     documented at length in the comment above it (the column is supposed to
     "mirror" when the menu flips), passed in at line 311, and **never read**.
     The mirroring is achieved by where the element is placed instead, so the
     prop is vestigial rather than broken — but the comment reads as though it
     does something.
  3. **`<DeckDndProvider engine={engine}>`** (line 175) — `DeckDndProvider`'s
     signature is `({ children })`. The `engine` prop is accepted and dropped.
- **Why it matters**: (1) is the player-facing one: clicking a hero tab in the
  dock has a handler that runs and does nothing, which is indistinguishable from
  an unresponsive UI. (2) and (3) are noise that makes the shell read as more
  wired-up than it is.
- **Suggested fix**: Decide what a single click on a dock tab should do —
  probably select-for-inspection, since that is what `selectedHeroId` is for —
  and either implement it or remove the prop pair. Delete the other two props.
- **Related**: CR2-036 (same "accepted then ignored" family), CR2-152.

---

### CR2-139 · P2 · S · Session 6 · Status: Open
- **Where**: `src/ui/hooks/useGameState.js:121-126`
- **What**: **The prop-sync effect's dependency list is rebuilt on every render,
  so the effect runs on every render of every consumer.** `options` is an object
  literal at almost every call site, so `options.deps || []` is a **new array
  identity each time**; React therefore never sees the deps as equal and re-runs
  the effect unconditionally. Each run calls the component's selector against
  the live `GameState` and deep-compares the result with `isEqual`.
- **Why it matters**: `useGameState` is the single busiest hook in the UI. This
  is not a render loop — line 123's equality guard stops it short of one — but
  it means **every consumer evaluates its selector twice per render instead of
  once**, and pays a `fast-deep-equal` walk each time. On the selectors that ask
  for whole subtrees (`QuestColumn` uses `{ deepClone: true }` over the active
  quest list and re-evaluates on twelve different events; `JobChangeModal`
  rebuilds a skill signature string) that is real work on a hot path. It is also
  the source of the lint warning `tooling_baseline.md` singled out — *"neither
  React's tooling nor a reader can tell what it actually depends on"* — and the
  reason is now concrete.
- **Suggested fix**: hoist the deps to a stable value. Either require callers to
  pass a memoised array, or spread it: `}, options.deps ? [...options.deps] : []);`
  — no, that has the same identity problem. The correct fix is to make the deps
  a real dependency list at the call site (`useMemo`) or to compare a
  serialised key. Simplest safe version: keep a `useRef` of the previous deps
  and bail early when they are shallow-equal. **Worth a measurement from
  Session 8 before and after.**
- **Related**: CR2-036 (the lint warning), CR2-140, CR-055 (round 1's render
  loop in the same family), Session 8's render census.

---

### CR2-140 · P2 · S · Session 6 · Status: Open
- **Where**: `src/ui/hooks/useDiscovery.js:24-40`
- **What**: `handleUpdate` builds a **brand-new object on every
  `state_changed`**, from four getters that return the same nested references
  every time. React compares by identity, so `setDiscovery` always registers a
  change and the consumer always re-renders — on every single engine tick — even
  though nothing about the discovery data has changed.
- **Why it matters**: costless today, because the hook's **only** consumer
  (`LootModule`) is unreachable (CR2-132). It becomes a per-tick re-render of a
  list component the moment the loot table is wired back up, so it should be
  fixed at the same time rather than discovered afterwards.
- **Also here**: CR2-030's `'card'` branch (line 55) is still present and still
  reads `state.library.tasks`, which does not exist. Confirmed still true.
- **Suggested fix**: subscribe to `item_discovered` / `enemy_discovered` only
  (the two events that actually mean something changed), drop `state_changed`,
  and bail when every field is reference-equal. Delete the `'card'` branch.
- **Related**: CR2-030, CR2-132, CR2-139.

---

### CR2-141 [DECIDED: stays off] · P2 · S · Session 6 · Status: Open — **owner decision**
- **Where**: `src/ui/ReactRoot.jsx:37-40, 260-264`;
  `src/ui/components/hud/TimeBankWidget.jsx`
- **What**: **The Time Bank cannot be spent, because the only control that
  spends it never renders.** `SHOW_TIME_BANK` is hard-coded `false`, and
  `TimeBankWidget` is the sole caller of `TimeBankManager.startSpending()` /
  `stopSpending()` in the entire codebase. Meanwhile `TimeBankManager` keeps
  accruing offline time (up to 24h) every session.
- **This is a recorded owner decision** — the comment says *"parked, not deleted
  (owner request 2026-08-02)"* — so this ticket is **not** proposing to
  re-litigate it. It is filed because the *consequence* is easy to lose track
  of, and because two other tickets already reason about behaviour under
  fast-forward as though it were reachable: CR2-095 (the quest abandon cooldown
  "cannot be fast-forwarded") and CR2-021 (the SFX pool at 10× time-bank speed).
  Neither can currently happen in normal play.
- **Owner decision needed, three options:**
  - **(A) Leave parked.** Cheapest; keeps the flag as the one-line restore it
    was designed to be. Session 8 should flip the flag by hand to test
    fast-forward. *Recommended, with (C) as the follow-up.*
  - **(B) Turn it back on** by flipping `SHOW_TIME_BANK` to `true`. The widget is
    complete and correct as written; nothing else is needed.
  - **(C) Give the Time Bank a home** in the nav or the Guild Hall rather than a
    floating HUD chip, and turn it on then. More work, but the comment already
    calls the HUD placement "provisional".
- **Related**: CR2-021, CR2-095, Session 8.

---

### CR2-142 · P2 · S · Session 6 · Status: Open
- **Where**: `src/ui/hooks/useUIModals.js:118-139`
- **What**: **`navToggle` defers every nav-bar open to `requestAnimationFrame`.**
  It closes all four view states synchronously, then opens the target one frame
  later. The comment explains why (a Headless UI "click outside closes me" race)
  and the workaround is sound in the common case — but `requestAnimationFrame`
  **does not fire while the window is hidden or minimised**, so the callback is
  deferred indefinitely and the player is left with everything closed and
  nothing opened.
- **Confirmed at runtime, by accident**: the review's browser pane reports
  `document.hidden === true`, and in that state clicking the Token Vault bubble
  reliably closed everything and opened nothing. Patching
  `requestAnimationFrame` to a `setTimeout` made every nav bubble work
  immediately. So the failure is real and reproducible, even if the trigger
  (a hidden window receiving a click) is unusual.
- **Why it matters**: low frequency, but the symptom — a nav button that
  visibly closes what was open and then opens nothing — is the worst kind of
  intermittent bug to diagnose. It will also matter more in the Tauri desktop
  shell, where window visibility is a first-class thing.
- **Suggested fix**: use `setTimeout(fn, 0)` instead of `requestAnimationFrame`,
  which fires regardless of visibility and satisfies the same "next tick"
  requirement the comment describes. One-word change.
- **Related**: the Headless UI race the comment documents; CR2-135 (same modal
  shell).

---

### CR2-143 · P3 · S · Session 6 · Status: Open
- **Where**: `src/ui/components/quests/QuestColumn.jsx:96-102`
- **What**: `handleClaim` and `handleAbandon` call
  `QuestManager.claimQuest(id)` / `abandonQuest(id)` and **throw away the
  `{ success, reason }` they return.** The engine composes real explanations —
  *"Map limit reached (50/50) — burst existing maps to acquire more"*,
  *"Need 4× Copper Ore"*, *"Quest requirements not met yet"* — and none of them
  reaches the player.
- **Why it matters**: the map-cap case is mirrored in the component (the Claim
  button disables itself and explains in a tooltip), so that one is covered. The
  **collection-quest case is not**: a quest whose items the player has since
  spent shows an enabled, pulsing "Claim" button that does nothing when clicked.
  Nothing errors and no message appears.
- **Note on layering**: the component's `isMapCapReached` mirror is **not** a
  layer violation — `QuestManager.claimQuest` enforces the same rule itself
  (`QuestManager.js:405`), so the component is only deciding how to *show* a
  rule the engine owns. That is the right shape; it is the dropped `reason` that
  is the bug.
- **Suggested fix**: `const r = QuestManager.claimQuest(id); if (!r.success)
  NotificationSystem.warning(r.reason);` in both handlers.
- **Related**: CR2-130 (the same "the engine explained and the UI discarded it"
  shape).

---

### CR2-144 · P3 · S · Session 6 · Status: Open
- **Where**: `src/ui/components/nav/BubbleMenu.jsx:59, 104`;
  `src/ui/hooks/useUIModals.js:22, 104, 114, 152-156, 277`
- **What**: Card-library and notification-pip residue in the nav.
  1. **`Bubble`'s `pip` prop — the spec's notification-pip slot — is never
     passed `true` by any caller**, so no bubble can ever show a notification
     dot. Same for `disabled`. Both are fully implemented and unreachable.
  2. **The Collection Binder ("library") is still a nav target in the state
     machine but has no bubble and no screen.** `useUIModals` keeps
     `isCardLibraryOpen`, a `cardLibrary` control group with open/close/isOpen,
     a `'library'` case in `isNavActive`, a `'library'` branch in `navToggle`,
     and counts it in `isAnyModalOpen`. `BubbleMenu:104` still asks
     `nav.isActive('library')` to decide whether to raise itself above a modal
     backdrop. **Nothing renders a card library** — `ReactRoot` has no such
     component — and the BubbleMenu's own comment says the binder bubble was
     deleted with its screen.
- **Why it matters**: (2) is dead state threaded through five places in the
  file that owns the nav's behaviour, and it makes `isAnyModalOpen` — which
  gates the particle overlay — depend on a flag nothing can set. (1) is a
  finished feature missing only its caller, exactly like `ToastContainer`'s
  collapse (CR2-035).
- **Suggested fix**: delete the library state and its five references. For the
  pip, either wire it (the Bank bubble showing a dot when new items land is the
  obvious use) or delete the prop — **owner's call, recommend wiring it**, since
  the spec asked for it and the component already draws it.
- **Related**: CR2-035, CR2-132.

---

### CR2-145 · P3 · S · Session 6 · Status: Open
- **Where**: `src/ui/modals/SettingsModal.jsx:61`
- **What**: The Settings sidebar prints a hard-coded **`v0.9.0`**. The real
  version is **0.6.0** (`package.json`, and the four other files CLAUDE.md
  requires to be bumped together).
- **Why it matters**: it is the only version number a player ever sees, and it
  is wrong by three minor versions. It is also a sixth place a version string
  lives, outside the five-file rule.
- **Suggested fix**: read it from `package.json` at build time
  (`import.meta.env.VITE_APP_VERSION`, or Vite's `define`), so it can never
  drift again. Session 9 owns the five-file version check and should fold this
  in as a sixth site that must not be manual.
- **Related**: CLAUDE.md "Version numbers live in five files"; Session 9.

---

### CR2-146 · P2 · S · Session 6 · Status: Open
- **Where**: `src/ui/components/board/TrayMiniBoard.jsx:64-68`;
  `src/ui/components/drawer/TokenVaultTab.jsx:146-148`;
  `src/systems/board/TokenBank.js:154-163`
- **What**: **Both UI withdraw routes re-publish `vault_withdrawn` and
  `token_bank_updated` on top of the ones `TokenBank.withdraw()` already
  publishes** — the exact double-announcement shape Sessions 2 and 4 found four
  times over, and the mirror image of CR2-033's fix (which moved the *deposit*
  publish into the engine and left the *withdraw* ones behind in the UI).
  `QuestManager.js:210` counts `vault_withdrawn` for a tutorial quest, so a
  withdrawal made through these two routes should move that counter by **two**.
- **Confirmed at runtime, with a twist**: an event probe over a live quick-add
  recorded exactly **one** `vault_withdrawn` — because `TokenVaultTab`'s copy
  **never executes**, having thrown on the missing `EventBus` import two lines
  earlier (CR2-126). **So this is a latent double-count that CR2-126 is
  currently masking.** Fixing the import alone would turn a quiet bug into a
  visible one. `TrayMiniBoard`'s copy (which does import `EventBus`) has no such
  cover and should double-count today.
- **Why it matters**: it is the fifth instance of the same defect, and it is the
  one that proves the pattern is systemic rather than incidental — the UI
  re-announces what the engine already announced, because nobody can tell from a
  call site which engine functions publish.
- **Suggested fix**: delete the four UI publishes. `TokenBank.withdraw()` is
  already the single announcer. **Do this in the same change as CR2-126**, or
  the import fix will introduce a live double-count. Then apply CR2-134's
  `depositFrom`/`withdrawTo` consolidation so the question stops arising.
- **Related**: CR2-126, CR2-033, CR2-134, and Sessions 2 and 4's double-count
  tickets.

---

### CR2-147 · P3 · S · Session 6 · Status: Open
- **Where**: `src/ui/components/sandbox/LayoutSandbox.jsx`;
  `src/ui/components/TestDashboard.jsx:224-237`;
  `src/ui/dev/cardSizeStore.js`
- **What**: **Two of the dev surfaces tune a card that no longer exists.**
  *This is not a deletion proposal* — the owner ruled the four dev surfaces are
  KEEP (guide Q5) — it is a correctness note, which is what that ruling asks for.
  - `LayoutSandbox` opens correctly and renders a "SIZING FORGE" tuner for
    **card dimensions, card art slots, side-car icon size and slot backgrounds**
    (confirmed by opening it in the running game). Cards were retired on
    2026-08-18. Nothing it tunes reaches the game.
  - `TestDashboard`'s "Banner card width" slider writes `dev.bannerCardWidth`
    through `cardSizeStore.js`. Its only reader is
    `DragGhost.bannerCardSize()` — inside the `bold` branch that crashes on the
    missing `GhostCardFrame` (CR2-128). If CR2-128 is fixed by dropping that
    branch, `cardSizeStore.js` loses its last consumer entirely.
- **Why it matters**: a dev tool that silently measures a retired thing costs
  the next person a session before they realise. Both surfaces still open, still
  render, and still look authoritative.
- **Suggested fix**: **Owner decision.** Recommend retargeting `LayoutSandbox`
  at the playmat tile / Token sprite sizing it would actually be useful for now,
  and deleting the banner-width slider and `cardSizeStore.js` together with
  CR2-128. Confirm before touching either — they are the owner's tools.
- **Related**: CR2-128, Q5 in the guide's Owner rulings.

---

### CR2-148 · P3 · S · Session 6 · Status: Open
- **Where**: `src/ui/components/base/ParticleOverlay.jsx:67-71`
- **What**: `ParticleOverlay` subscribes to **`items_consumed`, which nothing
  publishes** (0 subscribers on the other side — confirmed by grep across `src/`
  and at runtime). It is the "items fly *back* to the card being consumed"
  animation, and it belongs to the retired hero food/drink consumption model.
- **Why it matters**: trivial on its own. Listed because it is the fourth dead
  subscription in this territory and because the `Item Fly Particles` setting
  (`ui.itemParticles`) advertises "*Show items flying between cards and
  inventory*" — describing cards, which are gone, and a direction of travel that
  can no longer happen.
- **Suggested fix**: delete the subscription and `spawnFlyingItems`'s
  `'consume'` mode if nothing else uses it; reword the setting's description.
- **Related**: CR2-132, CR2-131, CR2-149.

---

### CR2-149 · P3 · S · Session 6 · Status: Open
- **Where**: `src/ui/components/base/ParticleOverlay.jsx:61-65`;
  `src/systems/combat/LootSystem.js:52, 76, 110`
- **What**: The `loot_generated` particle branch flies items **from a DOM
  element identified by `data.cardId`**, and `cardId` is now the ephemeral fight
  object's id (`fight_${tile}`), which no element in the UI carries. The
  subscription therefore either bails on `!data.cardId` or resolves no source
  rectangle. The file's own comment at lines 83–88 documents this — *"which is
  the whole reason the particle system has been silent on the board since the
  rework"* — and works around it with the `SPRITE_COLLECTED` subscription
  beside it.
- **Why it matters**: it is a live subscription that can never do anything, kept
  next to the one that replaced it. Low harm, but it makes the file read as
  though combat loot still animates.
- **Confidence**: high on the reading; **not** reproduced, because no authored
  Token is typed `enemy` so combat cannot start from content at all (CR2-110).
  Session 8 can settle it once combat is reachable.
- **Suggested fix**: delete the `loot_generated` subscription, or repoint it at
  the fight tile. Recommend deleting — `SPRITE_COLLECTED` covers board loot and
  fires when loot is *taken*, which the comment argues is the right moment.
- **Related**: CR2-110, CR2-011, CR2-148.

---

### CR2-150 · P3 · S · Session 6 · Status: Open
- **Where**: `src/ui/hooks/useUIModals.js:87, 137`;
  `src/systems/quests/QuestManager.js:205`
- **What**: **Not a bug — recorded so nobody files it as one.** `useUIModals`
  publishes `ui_modal:opened` from a React hook, and `QuestManager` subscribes to
  it to advance a tutorial quest. That is a UI event driving quest progress,
  which looks like the CR2-033 shape, and the next reader will flag it.
- **Assessment**: it is legitimate. "The player opened the Cartographer" is a
  genuinely UI-only fact — no engine call corresponds to it — so the UI is the
  only layer that can report it. There is no second route into the same
  behaviour for it to diverge from, which is the actual test.
- **One real fault inside it**: `navToggle` publishes `ui_modal:opened` for
  **every** nav target including `null` closes, from inside the
  `requestAnimationFrame` callback (line 137), while `openDrawerTab` publishes it
  synchronously (line 87). So the same tab opened two different ways announces
  itself at two different times, and a *close* announces itself as an *open*.
  If a tutorial quest ever keys on a target reached by both routes it will
  count unpredictably.
- **Suggested fix**: publish only when a view actually opens (guard on the
  target being non-null), and publish from one place.
- **Related**: CR2-033, CR2-142, Sessions 2/4 double-count tickets.

---

### CR2-151 · P2 · S · Session 6 · Status: Open — **note on CR2-035**
- **Where**: `src/ui/components/base/GISurface.jsx`;
  `src/ui/components/base/ToastContainer.jsx:34, 92-93`;
  `src/tests/Risk13Allocation.test.js:121`
- **What**: **All three parts of CR2-035 re-confirmed against current code**, one
  of them with a correction and one with new evidence.
  1. **`GISurface` is still orphaned** — zero importers across `src/`,
     `src/tests/` and `cms/src/`, re-verified by `from '…'` specifier grep. Note
     it *also* has an unused `blur` prop (lint), so even its own signature is
     half-wired. **Recommend delete**, with `GICard` (CR2-137).
  2. **The `ToastContainer` collapse feature is still unreachable** —
     `setCollapsed` is never called and `hiddenCount` is never rendered. **New
     evidence on which it is**: the file *does* build the button styling for it
     (`controlClass`, line 95) and uses that class for the "Clear All" button
     beside it. So the collapse control was **built and then removed**, not
     never finished — the styling for a second button in that row survives. That
     makes restoring it a matter of adding one button, and argues for restoring
     rather than deleting.
  3. The stale suppression in `Risk13Allocation.test.js:121` is still reported
     by `npm run lint` and is still the only warning in the test tree.
  - **Ownership correction**: CR2-035 assigns all three to Session 7. All three
    files are Session 6's territory (`components/base/` and a test). Session 7
    owns board/dock/drawer only. Handled here.
- **Related**: CR2-035, CR2-137, CR2-152.

---

### CR2-152 · P2 · S · Session 6 · Status: Open — **the lint residue in this territory**
- **Where**: 19 of `npm run lint`'s 32 problems, all in Session 6 files
- **What**: This session's share of CR2-036, claimed off that ticket rather than
  re-filed, with the *consequence* of each established rather than just the
  symptom. ⚠️ Read alongside **CR2-129** — these 19 are what a six-rule linter
  can see; the rules that are switched off found three crashes on top.

  | File:line | Symptom | What it actually means |
  |---|---|---|
  | `ItemIcon.jsx:64` | `emoji` computed, never drawn | **Player-facing.** The component resolves each item's authored `icon` emoji through four branches and then renders a generic grey picture-frame SVG whenever the sprite is missing. Every fallback icon in the game looks identical instead of looking like the item. |
  | `Toast.jsx:19` | `isLoss`, `count`, `meta` accepted, unused | **The dangerous one.** `NotificationSystem` computes `isLoss` and passes it; `Toast` ignores it and re-derives `isLosing` from its own `added`/`removed` deltas. Caller and component can therefore disagree about whether a notification is a gain or a loss, and the caller silently loses. `count` is passed and dropped, so an aggregated toast cannot show its multiplicity. |
  | `Toast.jsx:26` | `isGaining` computed, unused | Half of the gain/loss pair is computed and only the loss half is read, so a gain has no positive cue of its own — it is just "not a loss". |
  | `ToastContainer.jsx:34, 93` | `setCollapsed`, `hiddenCount` | The unreachable collapse feature — see CR2-151(2). |
  | `ParticleOverlay.jsx:167` | `quantity` accepted, ignored | **Player-facing.** `spawnCollected` is told how many of a thing was collected and draws one particle regardless, so picking up 40 ore looks exactly like picking up 1. *(CR2-036 attributes this to Session 7; the file is `base/`, so it is handled here.)* |
  | `ParticleOverlay.jsx:431` | `lastY` assigned, unused | Leftover from a trail effect; harmless. |
  | `GICard.jsx:26, 28` | `interactive`, `isStashing` | Two more props on a component nothing renders (CR2-137). |
  | `GISurface.jsx:10` | `blur` | See CR2-151(1). |
  | `LootModule.jsx:88` | `icon` computed, unused | Builds a `<Package>`/`<Sword>`/`<HelpCircle>` icon per row and then draws `<ItemIcon>` instead, so a combat-trigger row never gets its sword. Moot while the module is unreachable (CR2-132). |
  | `LootModule.jsx:164` | `isFirst`, `globalIndex` accepted, unused | Positional props from the card-registry era. |
  | `ReactRoot.jsx:71, 287` | `menuRight`, `id` | See CR2-138. |
  | `useGameState.js:117, 126 ×2` | three effect-dependency warnings | See CR2-139 — the "not an array literal" warning has a concrete cost. |
  | `useUIModals.js:275` | missing `openDrawerTab` dep | Benign: `openDrawerTab` is a `useCallback([])` and is stable. Suppress with a comment rather than adding it. |
- **Suggested fix**: `ItemIcon`, `Toast` and `ParticleOverlay` are three separate
  small fixes with visible results and should go first. The rest resolve as a
  side effect of CR2-137 / CR2-138 / CR2-139 / CR2-151.
- **Related**: CR2-036 (claim these off it), CR2-129, CR2-035.

---

## Session 6 — verdicts on already-filed tickets

| Ticket | Verdict |
|---|---|
| **CR2-030** | **Still true.** `useDiscovery.js:55` still reads `state.library.tasks`. Folded into CR2-140 with the fix. |
| **CR2-031** | **Not re-tested.** The toast-stranding is a framer-motion exit-animation artefact; re-measuring it needs a 90-notification burst, and this session's runtime budget went to the three crashes instead. Session 8 is better placed. No reason to think it has changed. |
| **CR2-034** | **Confirmed fixed**, and the regression test is present. See CR2-137 for the wider question of whether the component it protects should exist. |
| **CR2-035** | **All three parts re-confirmed**, with one ownership correction and new evidence on part 2 — see **CR2-151**. |
| **CR2-036** | **19 of the 32 claimed** — see **CR2-152**. Two of its attributions are wrong: `ParticleOverlay`'s `quantity` is tagged Session 7 but the file is `components/base/`, and the same applies to `ItemIcon` and `Toast`. Its bigger problem is CR2-129: the 32 are a fraction of what the linter was configured to find. |
| **CR2-037** | **Corrected.** Two implementations, yes — but the `EngineContext` copy has **zero** importers, not two. It is a dead export, not a competing implementation, and deleting it breaks nothing. See **CR2-136**. |
| **CR2-038** | **Confirmed, still true, and wider** — `CARD_TIERS` is unused in the game too, so the second test asserts against a table only it reads. See **CR2-137**, which recommends delete. |
| **CR2-020** | **Confirmed at runtime.** `audio:focus_changed` has **0 subscribers** in a live game, and `GICard` — which nothing renders — is its only publisher. Two dead things nested. |
| **CR2-033** | **Fix confirmed present and working**, but **incomplete in two ways**: the *rule* is still copied three ways (CR2-134), and the equivalent *withdraw* publishes were never moved out of the UI (CR2-146). |
| **CR2-007** | Nothing to add from this territory; Session 2's ruling stands. |

---

## System Map — Session 6: UI ↔ engine boundary, shell & shared UI

### The boundary, in one picture

```
  main.jsx  ──  builds the `engine` object (29 managers)
       │
       v
  ReactRoot({ engine })
       ├─ EngineProvider ──────────► EngineContext (the only React-visible handle
       │                              on the engine; useEngine() reads it)
       ├─ ViewportProvider ────────► 3 framer-motion MotionValues (zoom/pan).
       │                              Deliberately NOT React state — the playmat
       │                              pans without re-rendering.
       ├─ DeckDndProvider ─────────► dnd-kit context + DragOverlay/DragGhost
       └─ useUIModals(engine) ─────► every modal/pane/drawer flag in the app
                                      (returns one `ui` object, rebuilt each render)
```

**Reads go one way, writes go the other:**

| Direction | Mechanism | Where |
|---|---|---|
| engine → UI | `EventBus.subscribe` + `useGameState(selector, events)` | 22 subscribe sites in `src/ui/` |
| UI → engine | direct calls on the imported engine modules | `TokenBank`, `BoardState`, `Placement`, `QuestManager`, `HeroManager`, `PromotionSystem`, `TimeBankManager` |
| UI → UI | `EventBus.publish` of `ui:*` / `dev:*` events | 5 of the 7 have no publisher (CR2-132); 3 of the `dev:*` have no subscriber (CR2-133) |

### State this territory owns (none of it in GameState)

| Owner | State | Notes |
|---|---|---|
| `useUIModals` | settings/library/sandbox/pack flags, `drawerState`, `pinnedHeroIds`, `editHeroId`, `jobHeroId`, `bodyView`, `inspectSelection`, `cardTier`, `fullscreenView` | The whole UI's modal state. `library` and `pack` are dead (CR2-132, CR2-144); `cardTier` is frozen at `'md'` (CR2-132). |
| `ReactRoot` | `debugMode`, `menuRight`, `backgroundTile`, `selectedUpgradeTile`, `inspectHeroId` | First three mirror `SettingsManager`, resynced on `settings_updated`. |
| `ViewportContext` | `targetX/Y/Scale` MotionValues | Outside React's render cycle on purpose. |
| `cardSizeStore` | `dev.bannerCardWidth` in `localStorage` | `useSyncExternalStore`; one dev writer, one reader inside a crashing branch (CR2-147). |
| `ToastContainer` | `toasts`, `collapsed`, `position` | `toasts` is a mirror of `NotificationSystem.getQueue()`, deliberately (CR-050). |

### Events, by health

| Event | Publishers | Subscribers | Verdict |
|---|---|---|---|
| `state_changed` | everywhere | `useGameState` (per consumer), `useDiscovery`, `TimeBankWidget` | The workhorse. |
| `settings_updated` | `SettingsManager` | `ReactRoot`, `ToastContainer` | Healthy. |
| `notification_added/updated/dismissed` | `NotificationSystem` | `ToastContainer` | Healthy. |
| `ui:open_drawer` | `BankTab`, `TokenInspection` | `useUIModals` | Healthy. |
| `dev:toggle-sandbox` | `TestDashboard` | `useUIModals` | Healthy. |
| `ui_modal:opened` | `useUIModals` ×2 | `QuestManager` | Legitimate, but published inconsistently — CR2-150. |
| `react:slot_selected` | `ReactRoot` | `main.jsx`, `QuestManager`, `QuestColumn` | Healthy. |
| `particle_landed` | `ParticleOverlay` | `Tray` | Healthy (UI→UI). |
| `board:sprite_collected` | `Placement`, `SpriteLayer`, **`Tray`** | `ParticleOverlay`, `QuestManager`, `QuestColumn` | Publishing it from `Tray` is a UI component announcing an engine fact that quests count. No divergence today; watch it. |
| `vault_withdrawn` | `TokenBank` **+ `TrayMiniBoard` + `TokenVaultTab`** | `QuestManager`, `Tray`, `QuestColumn` | **Double-published — CR2-146.** |
| `ui:notify` | 3 components, 4 sites | **none** | **Dead — CR2-130.** |
| `ui:open_loot_table` / `_pack_overlay` / `_hero_customize` / `card_tier_changed` / `open_settings` | **none** | `useUIModals` | **Dead the other way — CR2-132.** |
| `dev:give-all-resources` / `dev:spawn-hero` / `dev:open-spawn-entity` | `SettingsModal` | **none** | **Dead — CR2-133.** |
| `items_consumed` | **none** | `ParticleOverlay` | **Dead — CR2-148.** |
| `audio:focus_changed` | `GICard` (never rendered) | **none** | **Dead at both ends — CR2-020 / CR2-137.** |

### Sweep 1 — the subscription-leak audit: **clean, all 22 sites**

Every `EventBus.subscribe` in `src/ui/` is paired with an unsubscribe on
unmount, and every timer and DOM listener is cleared. Round 1's verdict on 35
sites holds for the rebuilt UI's 22.

| File | Sites | Cleanup |
|---|---|---|
| `ParticleOverlay.jsx` | 4 + `window.resize` | ✅ all four unsub fns called, listener removed |
| `ToastContainer.jsx` | 4 | ✅ explicit `unsubscribe(name, fn)` ×4, stable fn identities |
| `BoardTile.jsx` | 4 | ✅ `unsubs.forEach(u => u())` / `unsub()`, plus `clearTimeout` |
| `TileProgressBar.jsx` | 4 | ✅ `unsubs.forEach`, plus `cancelAnimationFrame` |
| `Tray.jsx` | 1 | ✅ `unsub()` + two `clearTimeout`s |
| `TimeBankWidget.jsx` | 2 | ✅ both |
| `useDiscovery.js` | 3 | ✅ all three |
| `useGameState.js` | 1 per event | ✅ `cleanupFns.forEach` |
| `useUIModals.js` | 7 | ✅ `subs.forEach(unsub => unsub())` |
| `ReactRoot.jsx` | 1 | ✅ |

Non-EventBus resources: `TokenInspectPopup` (deferred `window.click`) ✅,
`VerticalHeroDock` (`document.pointerup`, capture phase) ✅,
`QuestColumn` (1s `setInterval`) ✅, `DndKit` (`window.pointermove`) ✅.

### Sweep 2 — does any component enforce a game rule?

| Component | The rule | Verdict |
|---|---|---|
| `Tray`, `TokenVaultTab`, `BubbleMenu` | "Maps cannot be stored" + "the Vault can be full" | ❌ **Yes — three copies, drifting. CR2-134.** The engine already enforces both (D-156, capacity); the components re-implement rather than report. |
| `TokenVaultTab` | "the Tray is full" (`tray.length >= BoardState.TRAY_CAPACITY`) | ⚠️ A second front on the capacity rule Session 2 already found enforced two ways. Folded into CR2-134. |
| `QuestColumn` | the 50-map cap | ✅ **Legitimate.** `QuestManager.claimQuest` enforces it too; the component only decides how to *show* it. The fault here is the discarded `reason` — CR2-143. |
| `HeroEditModal` | "retirement payout must beat the recruit cost" | ✅ **Legitimate.** `HeroLifecycle.retireHero:91` enforces it; the modal mirrors it into a disabled button and a tooltip. Correct shape. |
| `TrayMiniBoard`, `Board`, `Tray` | placement legality | ✅ All route through `Placement.*` and report `result.reason`. |
| `TestDashboard` | — | Writes `GameState` directly (gold, influence, `board.tiles`). Acceptable in a dev surface (owner ruling Q5); noted so it is not mistaken for a violation. |

**Verdict: one genuine violation (the Vault deposit rule, three copies), one
half-violation beside it (Tray capacity), and everything else correctly
layered.** The pattern CR2-033 named is not widespread in this territory — but
where it exists, it is in exactly the place CR2-033 already looked, which
suggests that ticket's fix was aimed at the symptom rather than the cause.

### Runtime notes

Exercised in a live game (fresh slot 1): the boot screen, all five nav bubbles
(Guild Hall, Item Bank, Token Vault, Cartographer, Settings), all five Settings
tabs, the QA dashboard, the Spawn Items modal, the Layout Sandbox, the Vault
pane's quick-add and the notification column. Everything renders. Two uncaught
errors were produced during ordinary use, both from the same missing import
(CR2-126). No render loop, no memory growth, and FPS held at 60 throughout.

---

## Filed by Session 7 — Game-surface components (2026-08-19)

**Territory covered:** all 28 files of `src/ui/components/board/` (10),
`dock/` (7), `drawer/` (10) and `hero/HeroSkillSheet.jsx` — **5,874 lines**,
all read in full.

⚠️ **Guide drift — reported, and it runs the other way this time.** The kickoff
brief for this session asserted that the guide's Session 7 row was wrong (board
"9 files not 10", dock "6 not 7"). **Checked against the tree: the guide is
correct and the brief was wrong.** `board/` holds 10 files (9 `.jsx` +
`boardConstants.js`) and `dock/` holds 7 (6 `.jsx` + `dockConstants.js`); the
guide's row names all of them. Nothing in the Session 7 row is stale. The total
is 5,874 lines against the row's "~6,000". No correction to the guide is needed.

**Territory tooling result:**
- `npm run lint` as configured reports **6 problems** here.
- **Re-run with `js.configs.recommended` actually applied** (throwaway config,
  deleted afterwards — see CR2-129): **17 problems, 11 errors**. The extra
  errors are the seven `no-undef` hits already filed as **CR2-126** and
  **CR2-127**. **No new undefined reference exists in this territory.**
- `npm run duplication` reports **4 of its 12 clones** here (Tray↔TokenVaultTab
  and Tray↔BubbleMenu — both CR2-134 — plus BankTab↔TokenInspection, which is
  the shared `DetailLine` component copied rather than imported).
- `npm run cycles`: nothing in `src/ui/`.

**Baseline re-verified untouched:** 840 passed / 21 skipped / 0 failed, 58
files; `npm run build` clean.

⚠️ **Verification caveat that limits three of these tickets.** In this harness
`requestAnimationFrame` **never fires** (`document.visibilityState` is
permanently `hidden`, and fronting the tab does not change it). Anything gated
on rAF therefore cannot be observed here: `TokenInspectPopup`'s reveal
(`setIsVisible`) and `TileProgressBar`'s fill animation both stay in their
initial state. Where that mattered it is said in the ticket. **Session 8 should
re-check those two by eye.** Everything else marked *confirmed at runtime* was
observed through DOM and `window.Game` / `window.GameState` probes, which are
unaffected.

---

### CR2-153 · P1 · S · Session 7 · Status: Open
- **Where**: `src/ui/components/dock/HeroDockTab.jsx:110` —
  `{...drag.dragHandleProps}`; `src/ui/dnd/DndKit.jsx:288` — the hook returns
  `handleProps`, not `dragHandleProps`
- **What**: **A hero cannot be dragged out of the Hero Dock, so a hero who is
  not already on the board can never be put on it.** `useEntityDrag` returns
  `{ setNodeRef, isDragging, handleProps }`. `HeroDockTab` spreads
  `drag.dragHandleProps`, which is `undefined`. JSX accepts `{...undefined}`
  silently, so dnd-kit's `listeners` and `attributes` are never attached and no
  drag can start.
- **Confirmed at runtime**: the hero tab in the live DOM carries only the
  *droppable* attributes (`data-dnd-droppable-id="rightmost-dock-drop-…"`,
  `data-dnd-surface`). A Tray Token beside it carries the full draggable set —
  `role="button"`, `tabindex="0"`, `aria-roledescription="draggable"`,
  `aria-describedby="DndDescribedBy-0"`. The hero tab has none of them.
- **Why it matters**: `Placement.placeHero` has exactly **one** caller in the
  whole UI — `Board.handlePlaceHero`, reached only by dropping a `HERO` drag on
  a tile. There are only two `HERO` drag sources: `BoardTile`'s `HeroBadge`
  (a hero *already standing on a tile*) and this one. So the only heroes who can
  be placed are heroes who are already placed. On a fresh save the core loop —
  put a hero on a Token and let them work — **cannot be started by the player at
  all.** The tab still shows `cursor-grab` and still dims via
  `drag.isDragging && 'opacity-30'`, so it advertises a gesture it cannot
  perform.
- **Suggested fix**: `{...drag.handleProps}`. One word. While there, the same
  call passes `surface: DND_SURFACE.DRAWER` where the hook's parameter is
  `sourceSurface`, so the drag ghost's surface is defaulting rather than being
  told.
- **Related**: CR2-157 (the recall half of the same dock is also dead),
  CR2-154. The Retired Tests Ledger has no dock-drag row; this is exactly the
  gap the coverage plan should close.

#### ✅ Session 8 — CONFIRMED by an actual drag. This is the review's most severe finding.

Session 7 proved it from the DOM attributes. Session 8 proved it from the
gesture, on a **brand-new game in an empty slot**, using the same synthetic
pointer sequence that successfully places Tray Tokens on tiles in the same
session (so the technique is not in doubt).

- Pressing and dragging the hero tab from the dock towards tile 1 produced
  **nothing**: dnd-kit's live region never announced a pickup — it still read the
  previous drag's message — and `board.heroTiles` stayed `{}`.
- The identical gesture on a Tray Token announces `Picked up draggable item
  tray-4` and lands the Token on the tile.
- The dock tab element carries exactly **three** attributes:
  `data-dnd-droppable-id`, `data-dnd-surface`, `class`. No `role`, no `tabindex`,
  no `aria-roledescription="draggable"`, no `aria-describedby`. It is a drop
  target only.
- Clicking and double-clicking the tab do not place the hero either (the click
  opens the hero inspection sheet).
- `Placement.placeHero(heroId, index)` called directly **succeeds**, so the
  engine is fine — the gesture is the only thing missing.

**On a fresh save, with the game's own tutorial quest telling the player to put a
hero to work, there is no gesture that does it.** Combined with CR2-044 (the four
opening Tokens are unplaceable), a new player cannot start the core loop at all.

**Recommend raising to P0 and fixing first.** It is a one-word change
(`drag.dragHandleProps` → `drag.handleProps`).

---

### CR2-154 [DECIDED: restore] · P1 · S · Session 7 · Status: Open
- **Where**: `src/ui/components/dock/HeroDockCard.jsx:72-80` passes
  `onClick` / `pinned` / `small` / `lift` to `HeroDockTab`;
  `src/ui/components/dock/HeroDockTab.jsx:20-26` accepts
  `heroId, isSelected, onSelect, onDoubleClick, onEdit` and **none of those
  four**
- **What**: **The pinned hero card can never be opened.** `VerticalHeroDock`
  builds `handleToggle` → passes it as `HeroDockCard`'s `onToggle` →
  `HeroDockCard` passes it to `HeroDockTab` as `onClick`, a prop that component
  does not take. It is silently dropped. `HeroDockTab`'s own click handler calls
  `onSelect`, which `HeroDockCard` never supplies, so clicking the card header
  does nothing at all.
- **Confirmed at runtime**: with the Item Bank pane open (the only place
  `VerticalHeroDock` renders), clicking a hero card header leaves `data-pinned`
  absent, no Gear/Skills toggle appears, and the dock's text stays
  `HERO ROSTER | IRIS`. `pinned` is therefore always `[]`.
- **Why it matters — this is the largest dead area found this session.**
  Everything behind the pin is unreachable:
  - **`DockSkillsGrid.jsx` renders nowhere in the game** (73 lines).
  - `DockEquipmentGrid` survives only because `HeroInspectionSheet` also uses
    it; its *dock* route is dead.
  - `DockBodyToggle` (the Gear/Skills switch and the Edit button beside it),
    `HeroDockCard`'s `bodyDrop` target — the fix for the 2026-08-02 "can't equip
    food" bug — and `DOCK_CARD_BODY_H` are all unreachable.
  - `DOCK_SFX.pin` / `.unpin` never play; the `audio:play` publish in
    `handleToggle` never runs.
  - `dockConstants.js` exports 12 values; **`DOCK_TAB_W_SMALL`, `DOCK_OVERLAP`,
    `DOCK_OVERLAP_SMALL`, `DOCK_Z`, `DOCK_PINNED_Z`, `DOCK_RESERVED_H`,
    `DOCK_MAX_PINNED`, `dockStripWidth`, `dockNeedsSmallMode` and
    `dockNeedsHScroll` have no importer outside `HeroDock.test.js`.** That
    file's 22 tests are green and test a module nothing calls.
  - `useUIModals`'s `pinned` / `isPinned` / `togglePin` / `unpinAll` /
    `bodyView` / `toggleBodyView` state is inert.
- **Suggested fix**: give `HeroDockTab` the props its caller already passes — it
  needs `onClick` (or rename the caller's prop to `onSelect`), plus `pinned`,
  `small` and `lift` if the two card states are still wanted. The honest
  alternative is to decide the pinned card is retired and delete it with its
  tests and constants. **Owner decision**, because "pull the card up out of your
  hand" is the hero dock concept's headline interaction:
  - **A — restore the pin.** One prop rename; the body, both grids, the toggle
    and the SFX all already exist and are tested. *Recommended.*
  - **B — retire the pinned card**, deleting `DockSkillsGrid`, `DockBodyToggle`,
    the unused half of `dockConstants` and `HeroDock.test.js`'s pin tests.
- **Related**: CR2-153, **CR2-164** (the unpin-on-click-away is broken too and
  would misfire the moment A is chosen — fix them together), CR2-165.

#### ⚠️ Session 8 — partially re-tested; the `VerticalHeroDock` half was not reached

Clicking the **rightmost** dock's hero tab does nothing toward pinning — it opens
the hero inspection sheet instead, and `data-pinned` never appears. That matches
the ticket.

The specific claim is about `VerticalHeroDock`, which only renders with the Item
Bank pane open. Session 8 got that pane open (see the rAF note in the System Map)
but ran its budget on CR2-153/157 instead, so **Session 6/7's runtime evidence
stands unchallenged rather than re-confirmed**. Nothing found this session
contradicts it. The owner's decision (option A, restore) is unaffected.

---

### CR2-155 · P1 · S · Session 7 · Status: Open
- **Where**: `src/ui/components/board/TileProgressBar.jsx:80-108` (`renderAlert`)
- **What**: **`renderAlert` handles three of the six alert values and silently
  falls through the other three, leaving the previous alert's text on screen.**
  It branches on `'inputs'`, on `'no_recipe' || 'conflict'`, and on falsy. The
  engine also produces **`'access'`** and **`'unskilled'`**
  (`BoardRunner.js:99-107`), and `Board.jsx:109` adds **`'unstocked'`**. None of
  the three has a branch, so `currentAlert` is set — which suppresses the normal
  cycle at line 111 — while nothing is drawn.
- **Confirmed at runtime**: driving `board:alert_changed` through all six values
  on a live tile and reading the bar's label each time:

  | alert | label shown | fill colour |
  |---|---|---|
  | `inputs` | "Need Items" | yellow |
  | **`access`** | **"Need Items"** (stale) | yellow |
  | **`unskilled`** | **"Need Items"** (stale) | yellow |
  | `conflict` | "Need Tokens" | red |
  | `no_recipe` | "Need Tokens" | red |
  | **`unstocked`** | **"Need Tokens"** (stale) | red |

- **Why it matters**: a hero whose **skill level is too low**, and a hero who
  **does not hold the skill at all**, are both told **"Need Items"**. That is not
  merely missing information, it is wrong information — it sends the player to
  hunt for materials when the answer is a different hero or a promotion.
  `unskilled` in particular is the one alert that levelling can never fix, which
  is precisely why `ALERT_HINT` spells it out (CR2-156) — and the player never
  sees that sentence.
- **Suggested fix**: give `renderAlert` a branch per alert value, driven off the
  engine's exported `ALERT` table rather than bare string literals, and take the
  label text from `ALERT_HINT` (CR2-156) so there is one vocabulary instead of
  two. Note the alert strings are duplicated as literals here while the engine
  exports `ALERT` — importing it would have made this gap visible.
- **Related**: CR2-156, CR2-036, `playmat_decisions.md` D-85, D-114.

#### ✅ Session 8 — CONFIRMED, and the symptom is worse than "stale". Correction below.

Reproduced live: a hero on tile 0 (an Oak Forest) had their `logging` and
`mining` skills removed, the loop was ticked, and the engine set
`tiles[0].alert = 'unskilled'` as expected.

**What the tile then displayed was `Oak Forest  12s`** — the ordinary working
label, with a work countdown, exactly as if the hero were doing the job.

So the ticket's table is slightly optimistic. `renderAlert`
(`TileProgressBar.jsx:80-108`) has branches for `'inputs'`, for
`'no_recipe' | 'conflict'`, and for `null` — and **falls off the end for
`access`, `unskilled` and `unstocked`, drawing nothing new at all**. Whether the
player sees a stale "Need Items" or a stale progress bar depends purely on what
the tile happened to be showing a moment earlier. On a tile that was working
fine until the hero changed, **the player is shown a countdown for work that will
never complete** — no warning, no colour change, no indication anything is wrong.

**That is worse than the wrong-information framing and arguably worse than
silence**, because the tile actively asserts that it is fine. Keep at P1; the fix
is unchanged.

---

### CR2-156 · P1 · S · Session 7 · Status: Open — **the `ALERT_HINT` verdict, claimed off CR2-036**
- **Where**: `src/ui/components/board/BoardTile.jsx:100-112`
- **What**: **`ALERT_HINT` — a six-entry table of player-facing explanations for
  each red warning mark — is defined and read by nothing.** Its own doc comment
  states the requirement it exists to satisfy: *"Hovering states exactly what is
  wrong (D-114) — there is no aggregate supply dashboard, so diagnosis happens
  tile by tile."*
- **Confirmed at runtime**: none of the six strings appears anywhere in the live
  DOM — not as a `title`, not as text. A tile carrying `alert: 'no_recipe'`
  offers exactly two pieces of text: the bar's "Need Tokens", and a `title` of
  `Copper Ore Vein — unlimited use`, which says nothing about the warning. The
  only place a reason is spoken at all is `HeroBadge`'s tooltip, and it is
  generic: *"has nothing to do — move them, or restock this tile"*.
- **Why it matters**: **D-114 is unimplemented and looks implemented.** The
  table reads as finished work, so the next person to look will assume the
  feature exists. And the missing half is the useful half: "Need Tokens" tells
  the player something is wrong; *"Nothing beside this station tells it what to
  make"* tells them what to do about it. With no supply dashboard by design,
  tile-by-tile diagnosis is the **only** route the game offers, and it is mute.
- **Unfinished or retired?** **Unfinished.** The table is complete, current and
  correct: its five engine keys match `BoardRunner`'s `ALERT` exactly, including
  `unstocked`, which was added later by the Manager restock work. Nothing about
  it is stale. It was written and never wired.
- **Suggested fix**: put the hint in the tile's `title` when `token.alert` is
  set, and use it as `TileProgressBar`'s hover text — one line in each. That
  also fixes CR2-155's stale labels, by giving all six values a string.
- **Related**: **CR2-036** (this is its `BoardTile` entry, claimed here),
  CR2-155, D-114, D-85.

---

### CR2-157 · P1 · S · Session 7 · Status: Open
- **Where**: `src/ui/components/dock/RightmostHeroDock.jsx:33-39`;
  `src/ui/components/dock/VerticalHeroDock.jsx:22-25`
- **What**: **Both hero docks are drop targets for recalling a hero, and
  neither can do it.** Two separate faults in four lines:
  1. `engine.Placement?.recallHero(...)` — **the engine has no `Placement`
     key.** It is registered as **`BoardPlacement`**. The `?.` turns the miss
     into a silent no-op.
  2. `engine.HeroAssignmentManager` — **a retired system.** `systems/area/` was
     deleted with the area model; the only two references left in the whole
     codebase are these. `RightmostHeroDock` guards it with `?.`;
     **`VerticalHeroDock` does not**, so its handler would throw a `TypeError`
     if it ever ran.
  Neither `areaId` branch can currently run, because **no drag payload in the
  codebase carries `areaId`** (the only survivors of that word are in
  `LootSystem` / `CombatResolutionProcessor`, unrelated).
- **Confirmed at runtime**: `window.Game.Placement` is `undefined`,
  `window.Game.BoardPlacement` is defined, `window.Game.HeroAssignmentManager`
  is `undefined`.
- **Why it matters**: dragging a working hero off a tile onto the dock to send
  them home does nothing — the dock even lights up green
  (`recall.valid && 'ring-2 ring-gi-success/70'`) before swallowing the drop.
  Recall does still work by *clicking* the hero on the tile
  (`HeroBadge.onClick → onPickUp`), which is why this has survived. It is moot
  in practice today because CR2-153 means no hero can be on the board at all;
  fixing CR2-153 makes this one visible.
- **Suggested fix**: `engine.BoardPlacement.recallHero(...)`, or better, import
  `Placement` directly the way `Board.jsx` does — the direct-import convention
  the rest of the territory uses cannot go stale silently. Then delete both
  `areaId` branches and the `HeroAssignmentManager` calls with them.
- **Related**: CR2-153; objective 2 (retired systems still wired in).

#### ✅ Session 8 — CONFIRMED by an actual drag, and it is not moot

The ticket says this is "moot in practice today because CR2-153 means no hero can
be on the board at all". That is not quite right: heroes **can** be put on the
board by the engine (and by dragging one tile-to-tile once they are there), so
the recall drop is reachable and broken right now.

With 12 heroes working a full board, a hero was dragged from tile 1 onto the
dock's recall strip. dnd-kit reported
`Draggable item tile-hero-1 was moved over droppable area **rightmost-dock-recall**`
and accepted the drop. **`board.heroTiles` was byte-identical before and after** —
the hero stayed on tile 1. No error, no console warning, no notification.

**The click route does work**: clicking the same hero badge on the tile recalled
them (12 heroes on the board → 11). So the dock drop is the broken half, exactly
as filed. **Confirmed, P1 stands.**

---

### CR2-158 · P1 · S · Session 7 · Status: Open
- **Where**: `src/ui/components/board/Tray.jsx:455-472`;
  `src/ui/components/board/Board.jsx:358-366`
- **What**: **A single click bursts a Map open, and the comment two lines above
  the code says it must not.** `TrayToken`'s comment reads, in full:

  > *"**Double-click and it bursts open** (D-142). Deliberately not a single
  > click: the Tray's primary verb is drag-to-place, and a one-click open would
  > spend a Map every time a drag started badly."*

  The `onClick` handler immediately below is
  `if (entry.isMap) { e.stopPropagation(); onBurst?.(); }`. The `title` on the
  same element still says *"double-click to tear it open"*, and `onDoubleClick`
  also bursts. `Board.jsx`'s `BoardMapToken` has the same shape — `onClick` and
  `onDoubleClick` both call `onBurst`.
- **Why it matters**: `playmat_decisions.md` **D-142** is explicit — *"Double-click
  and the Map **bursts**"* — and the stated reason is exactly the failure mode
  the code now has. A Map is a purchase (`Cartographer.buyMap` takes gold **and**
  materials) and is single-use by design; a drag that starts badly, or a
  mis-aimed click while planning, destroys one. The Tray's own header describes
  it as the surface where planning happens.
- **This is the eighth documented case in this codebase of a confident comment
  asserting the opposite of the code beside it** — after `theme`,
  `tokenConstants` (CR2-039), the Rarity comment, and the lint config (CR2-129).
- **Confidence**: proven by reading; **not** reproduced by an actual click,
  because the only Map the content set offers is "Test Map" (CR2-114) and none
  reached the Tray during the runtime pass. The code path is unambiguous.
- **Suggested fix**: drop the `entry.isMap` branch from `onClick` so a Map falls
  through to `onInspect` like every other Token, leaving `onDoubleClick` as the
  only burst. Same in `BoardMapToken`, and correct its `title` (*"Click to tear
  it open, or drag to move/store"*) to match.
- **Related**: D-142, D-145, CR2-114.

---

### CR2-159 · P2 · S · Session 7 · Status: Open
- **Where**: `src/ui/components/board/Board.jsx:20, 22, 326-332`;
  `src/ui/ReactRoot.jsx:333-337, 279`
- **What**: **`Board.jsx` renders a second `TokenInspectPopup` behind a
  condition nothing can satisfy, and the props on both ends are mismatched.**
  1. The gate is `inspectSelection?.source?.tile != null`. Every call site sets
     the selection as `ui.inspect.set('token', typeId, { rect })` — **nothing
     anywhere writes `source.tile`.** The block is unreachable.
  2. It passes `tileIndex={…}`; `TokenInspectPopup` accepts
     `{ typeId, anchorRect, onClose }`. `tileIndex` is dropped and `anchorRect`
     would be `undefined`, so even if the gate opened the popup would never
     position or reveal itself (`useLayoutEffect` returns on `!anchorRect`).
  3. Therefore `Board`'s `inspectSelection` prop and its `TokenInspectPopup`
     import exist only for dead code. `ReactRoot` renders the working copy at
     the modal layer with the correct `anchorRect`.
  Separately, `ReactRoot:279` passes **`isRightMenu={menuRight}`** to `Board`,
  which does not accept it.
- **Confirmed at runtime**: double-clicking a Token on a live tile produces
  **exactly one** `TokenInspectPopup` in the DOM, with correct content
  (`COPPER ORE VEIN … CHARGES 100 USES … CYCLE 12S`). Board's copy never
  appears. *(The popup measured `opacity: 0` — that is the rAF harness caveat
  above, not a game fault; the reveal is gated on `requestAnimationFrame`.
  Session 8 should confirm by eye.)*
- **Why it matters**: no player-visible symptom today, but it is the exact
  maintenance trap this review exists to find — a reader sees two live popup
  renders and cannot tell which is canonical, and the dead one's prop contract
  has already drifted from the component it renders.
- **Suggested fix**: delete lines 326-332, the `TokenInspectPopup` import and
  the `inspectSelection` prop from `Board`; drop `isRightMenu` from
  `ReactRoot`'s `<Board>`.
- **Related**: CR2-166, CR2-136 (the same "two implementations, one dead" shape
  Session 6 found for `useEngine`).

---

### CR2-160 · P2 · S · Session 7 · Status: Open
- **Where**: `src/ui/components/board/TrayMiniBoard.jsx:24-68` vs
  `src/ui/components/board/Board.jsx:164-263`
- **What**: **`TrayMiniBoard` is a second, partial implementation of the board's
  token-drop handler, and the two have drifted three ways.**
  1. **Routes.** `Board` handles six drop origins (`boardMapId`, `tile`,
     `spriteId`, `traySlot`, `vaultTypeId`, and a bare `typeId`).
     `TrayMiniBoard` handles four — it drops `boardMapId` and the bare-`typeId`
     case — while its `accepts` admits *any* `TOKEN` drag. Dragging a Map from
     the playmat onto the mini-board falls through every branch and silently
     does nothing.
  2. **2×2 Tokens.** `Board` computes a 2×2 anchor from the pointer
     (`closest2x2Anchor`) and previews the footprint. `TrayMiniBoard` treats
     every drop as 1×1, and its `isOccupied` map is built from
     `state.board.tiles` keys — which are **anchors only** — so the other three
     cells of a 2×2 Token render as empty and placeable. The mini-board tells
     the player a tile is free when it is not; `Placement` then refuses and the
     player gets a warning toast from a cell that looked available.
  3. **Events.** `TrayMiniBoard` re-publishes `vault_withdrawn` and
     `token_bank_updated` (CR2-146); `Board` does not.
  And the vault branch is the one place the two are *inverted*: `TrayMiniBoard`
  imports `TokenBank` correctly, while `Board` does not (**CR2-127**), so the
  same gesture works on the mini-board and fails on the real one.
- **Why it matters**: the mini-board exists so a Token can be placed while the
  Vault covers the playmat — it is a *substitute* for the board, and a
  substitute that accepts fewer drags and lies about occupancy is worse than
  none. Two surfaces answering the same question differently is objective 1's
  core shape.
- **Suggested fix**: extract `Board`'s `handlePlaceToken` into one exported
  helper both surfaces call, taking the target index and the payload. That
  collapses ~45 duplicated lines and fixes the missing routes and the double
  publish at once, leaving the mini-board only its own occupancy rendering —
  which should read footprints, not anchor keys.
- **Related**: CR2-127, CR2-146, CR2-134.

---

### CR2-161 [DECIDED: retire] · P2 · S · Session 7 · Status: Open
- **Where**: `src/ui/components/drawer/BankTab.jsx:36, 44-48, 121, 227-235`;
  publishers of `ui:open_drawer` — `BankTab.jsx:533`, `TokenInspection.jsx:208`;
  `src/ui/hooks/useUIModals.js:78-88, 267`
- **What**: **The drawer's per-pane auto-open filter has no publisher, so
  BankTab's whole type-filter feature is unreachable.**
  `useUIModals.openDrawerTab` takes `(tab, filter)` and stores it in
  `drawerState.filters`; `BottomFolderDrawer` hands it to each pane; `BankTab`
  turns it into `typeFilter`, filters `visible` on
  `e.template.type === typeFilter`, and renders a "clear the slot filter" chip.
  **Both `ui:open_drawer` publishes send `{ tab }` and nothing else**, and no
  other caller of `openDrawerTab` passes a second argument.
- **Confirmed at runtime**: `drawer.filters` is `{}` in a live game after
  opening every pane; the filter chip never appears.
- **Why it matters**: three files carry machinery for a feature (spec §12.B —
  "click an empty equipment slot, land in the Bank already filtered to items
  that fit it") whose trigger was never built. Small in isolation, and exactly
  the shape objective 1 is hunting.
- **Suggested fix**: **Owner decision.** **A** — build the trigger from the
  equipment-slot route §12.B describes (small, and the payoff is that flow).
  **B** — delete `filters` from `useUIModals`, the `filter` prop from
  `BottomFolderDrawer`, and `typeFilter` from `BankTab`. Recommend **A** if the
  slot→Bank flow is still wanted; otherwise **B**.
- **Related**: CR2-166.

---

### CR2-162 · P2 · S · Session 7 · Status: Open — **claimed off CR2-036**
- **Where**: `src/ui/components/drawer/BankTab.jsx:50` (`gold`), `:66`
  (`bank.maxTabs`), `:108, 378`
- **What**: **The Bank pane reads two numbers and shows neither.**
  1. `gold` — CR2-036's entry. Subscribed, kept fresh on `currency_changed`,
     never rendered. The header shows only `stocked.length / maxSlots`.
  2. **`bank.maxTabs`** — a *second* instance CR2-036 did not name, and the more
     consequential one. The tab strip renders one button per entry in
     `groupOrder` and pads to `BANK_TAB_CAP` (20) with padlocks. `maxTabs` — the
     number the Guild Hall upgrade is supposed to move — is projected into the
     component and never consulted.
- **Confirmed at runtime**: in a fresh game `inventory.maxTabs` is **5**,
  `inventory.groupOrder` has **1** entry, and the strip renders **1 tab and 19
  padlocks**. The player is told they have one tab when the save says five are
  unlocked.
- **Why it matters**: the gold miss is a nuisance — the player sells stacks from
  this pane (there is a bulk-sell modal that totals the proceeds) and cannot see
  their balance while doing it, although the Guild Upgrade sheet shows gold in
  its header. The `maxTabs` miss is the visible half of Session 4's finding that
  creating a Bank tab is impossible: the *engine* never adds a group, and the
  *UI* would ignore the allowance if it did. Both ends of that upgrade are
  disconnected.
- **Suggested fix**: add a gold chip to the pane header mirroring
  `GuildUpgradeInspection`'s. For tabs, decide which number is authoritative —
  recommend `groupOrder` stays the render source and something in
  `InventoryManager` grows it to `maxTabs`, so the UI stays a reporter.
- **Related**: **CR2-036** (gold entry claimed here), Session 4's Bank-tab
  ticket, CR2-163.

---

### CR2-163 · P2 · S · Session 7 · Status: Open
- **Where**: `src/ui/components/drawer/CartographerTab.jsx:19-26`
- **What**: **The Map shop fetches the player's gold and throws it away in the
  same statement.** The selector returns
  `{ maps, gold: state.currency?.gold || 0 }` and the destructure is
  `const { maps } = useGameState(…)`. `currency_changed` sits in the
  subscription list purely to keep a value nothing reads fresh.
- **Confirmed at runtime**: the open Cartographer pane reads
  `CARTOGRAPHER'S SHOP | TEST MAP | 0/7 DISCOVERED | BUY | COSTS | 1 GP` — a
  price, an affordability message, and no balance anywhere.
- **Why it matters**: this is the **second** gold-computed-then-dropped site in
  the drawer (CR2-162 is the first), and it is a shop.
  `map.affordability.reason` tells the player they cannot afford something
  without telling them what they have. **Neither instance is visible to the
  linter** — both are object properties, not bindings — which is worth
  recording: CR2-036's mechanical list is a floor.
- **Suggested fix**: render the gold beside the "Costs" block, or drop it from
  the selector and from the event list. Recommend rendering it; a shop that
  hides your balance is the odd one out among the three panes.
- **Related**: CR2-162, CR2-036, CR2-171.

---

### CR2-164 · P2 · S · Session 7 · Status: Open
- **Where**: `src/ui/components/dock/VerticalHeroDock.jsx:46-48, 35-42`;
  `src/ui/components/dock/RightmostHeroDock.jsx:44-46`
- **What**: **Both docks stamp a `data-dnd-surface` name and then overwrite it
  one line later.** Each `<aside>` writes
  `data-dnd-surface="vertical-dock"` / `="rightmost-dock"` and then spreads
  `{...recall.droppableProps}`, which sets `data-dnd-surface` to the hook's
  `surface` — `DND_SURFACE.DRAWER`. React applies the later value, so neither
  name reaches the DOM.
- **Confirmed at runtime**: both asides carry `data-dnd-surface="drawer"`. The
  strings `vertical-dock` and `rightmost-dock` appear nowhere in the live DOM.
- **Why it matters**: not cosmetic. `VerticalHeroDock`'s unpin-on-click-away
  effect tests `e.target.closest('[data-dnd-surface="vertical-dock"]')` to
  decide whether a pointerup landed **inside** the dock. That selector can never
  match, so every pointerup — including one on the dock's own cards — takes the
  "outside" branch and calls `unpinAll()`. **Today that is invisible because
  nothing can pin (CR2-154); the moment CR2-154 is fixed, a pinned card will
  close on the very next click, including the click that opened it.** The two
  bugs mask each other and must be fixed together.
- **Suggested fix**: use a distinct attribute for the dock's identity
  (`data-dock="vertical"`) rather than reusing the dnd surface name, or put it
  on an inner element the spread does not touch. Then retest the unpin behaviour
  with CR2-154 fixed.
- **Related**: CR2-154, CR2-153.

---

### CR2-165 [DECIDED: show banked levels] · P2 · S · Session 7 · Status: Open
- **Where**: `src/ui/components/drawer/HeroInspectionSheet.jsx:35-37, 158-186`
  vs `src/ui/components/hero/HeroSkillSheet.jsx` and
  `src/ui/components/dock/DockSkillsGrid.jsx:6-21`
- **What**: **Two live surfaces show a hero's skills, and they contradict each
  other on the game's own rules.**
  - `HeroInspectionSheet` — opened by double-clicking a hero in the rightmost
    dock, i.e. the primary hero surface a player reaches — computes
    `lockedSkills = every skill in the registry the hero does not hold` and
    renders them under **"Locked Skills (N)"**, each with the tooltip
    **"Requires promotion to unlock"**. It shows **no banked skills at all**.
  - `HeroSkillSheet` — inside the Hero Edit modal — groups held skills by layer
    and renders a **"Set aside"** block for `bankedSkills`, with the promise
    spelled out: *"Kept at the level they reached."*
  - `DockSkillsGrid`'s doc comment forbids exactly what the inspection sheet
    does: *"It must never read the registry for its cell list — a hero showing a
    skill they do not hold is exactly the confusion possession exists to
    remove."*
- **Why it matters**: **D-250** puts banked skills on the inspection surface and
  keeps them off the glance surface. The sheet that *is* the inspection surface
  does the opposite of both halves — it hides the banked skills, so a player has
  no way to see that promotion is reversible (the thing **D-71** exists to
  guarantee), and it invents a "locked / requires promotion" model that the
  design log does not contain. Every skill in the registry a hero happens not to
  hold is presented as an unlockable, which is wrong for their *banked* skills
  (already earned, returning on the right job) and wrong for skills no job of
  theirs will ever grant.
- **Suggested fix**: replace the sheet's skills section with `HeroSkillSheet`,
  which already implements D-250 correctly and is currently reachable only
  through a modal behind the Edit button; drop the "Locked Skills" block.
  **Confirm with the owner** that this is drift rather than a later decision —
  the two were built in different reworks.
- **Related**: D-250, D-71, `skill_class_rework_roadmap_v1.md` §7.

---

### CR2-166 · P2 · S · Session 7 · Status: Open — **claimed off CR2-036**
- **Where**: `src/ui/components/drawer/BottomFolderDrawer.jsx:48, 138-144`
- **What**: **The drawer hands every pane the same five props regardless of
  which props that pane takes, and accepts a sixth it never passes on.**

  | Prop | BankTab | TokenVaultTab | CartographerTab |
  |---|---|---|---|
  | `filter` | accepted, dead (CR2-161) | ignored | ignored |
  | `searchQuery` | used | used | ignored |
  | `onInspect` | used | used | used |
  | `selectedTemplateId` | ignored | used | ignored |
  | `selectedItemId` | used | ignored | ignored |

  Both selection props are set from the same `selId`, so each pane reads
  whichever name it happens to use — the shotgun exists only because the two
  panes were named differently. Separately, `BottomFolderDrawer` accepts
  **`cardTier = 'md'`** (CR2-036's entry) and never passes it to anything; it is
  a leftover of the retired banner-card sizing.
- **Why it matters**: low severity alone, but it is why nobody noticed CR2-161 —
  a prop that half the panes ignore looks the same as a prop that is never
  supplied. And `cardTier` is dead weight from a retired system.
- **Suggested fix**: settle on one `selectedId` prop name, drop `cardTier`, and
  pass `filter` / `searchQuery` only to the panes that read them.
- **Related**: **CR2-036** (`cardTier` entry claimed here), CR2-161, CR2-147.

---

### CR2-167 · P2 · S · Session 7 · Status: Open — **claimed off CR2-036**
- **Where**: `src/ui/components/drawer/GuildUpgradeInspection.jsx:12, 36-48`;
  `src/ui/components/board/GuildHallBoard.jsx:57-76`
- **What**: Three faults on the Guild Hall upgrade surface.
  1. **`onClose` is accepted and no control calls it** — CR2-036's entry,
     confirmed. `InspectionPanel` supplies `onClear`; the component's header
     holds a title and a gold chip and no ✕. The only way out is to click a
     different tile or close the whole drawer.
  2. **`upgradeId` is accepted and no caller passes it.** Both call sites
     (`InspectionPanel:60`, and `ReactRoot:162` / `:241` via the selection)
     supply `upgradeDef`, so the
     `upgradeId ? getUpgradeDef(upgradeId) : null` fallback is unreachable.
  3. **A locked upgrade tile is still clickable and still names itself.**
     `GuildHallBoard` renders inaccessible tiles as a bare padlock but keeps
     `cursor-pointer` and `onSelectTile` for any tile with a `def`, and its
     `title` reads `${def.name} — Level 0/N`. The tooltip reveals what the lock
     is hiding.
- **Why it matters**: (1) is a panel with no exit, which reads as stuck. (3) is
  a small information leak and, more to the point, an inconsistency — the art is
  greyed and the icon replaced specifically to withhold the identity, and then
  the tooltip gives it away.
- **Suggested fix**: add a ✕ to the header wired to `onClose`; delete the
  `upgradeId` prop and its branch; decide whether locked tiles should be
  inspectable at all — if yes (the sheet does show the unlock requirement, which
  is useful), drop the name from the tooltip; if no, gate the click on
  `accessible`.
- **Related**: **CR2-036** (`onClose` entry claimed here).

---

### CR2-168 · P2 · S · Session 7 · Status: Open — **render and allocation notes for Session 8**
- **Where**: five sites, below
- **What**: performance observations from reading this territory. **None is
  measured** — Session 8 owns measurement — but each is a specific place to
  point a profiler, and the first has a player-visible symptom.
  1. **`TileProgressBar.jsx:202`** — the effect that owns four EventBus
     subscriptions *and* the rAF loop lists **`isHovered` and `missingReqs`** in
     its dependency array. So **hovering a tile tears down and rebuilds four
     subscriptions and cancels the animation frame**, and `active` resets to
     `false` until the next `board:progress` event — up to ~300ms at
     `PROGRESS_EVERY = 3`. Expected symptom: the progress bar on a working tile
     hitches or blanks whenever the cursor crosses it. **Not verifiable in this
     harness (rAF is dead here) — this is the specific thing for Session 8 to
     watch by eye.** Across 49 tiles it is also the largest subscription churn
     in the UI.
  2. **`Board.jsx:58-136`** rebuilds a projection of all 49 tiles — a fresh
     object per tile plus a `tileFootprint` array each — on **every**
     `state_changed`, i.e. every tick; `useGameState` then runs
     `fast-deep-equal` over the whole thing to decide whether to re-render. That
     is the board's per-tick cost and the right place to start the render
     census.
  3. **`ConnectionLines.jsx`** re-runs `relationshipsFor` (an adjacency walk
     plus `RecipeResolver.servesFrom` per neighbour) **and** `resolveRecipe` on
     every `Board` render — so once per tick for as long as the cursor rests on
     a tile.
  4. **`TokenInspection.jsx:315-321`** (`DrivesBlock`) calls
     `productionRoutes(id)` for **every** Token type in the registry on every
     render — an O(types × routes) scan inside a panel that re-renders on
     `token_bank_updated` and `state_changed`. Cheap at ten Tokens; the kind of
     thing that stops being cheap quietly.
  5. **`TokenInspection.jsx:75-90`** (`handleSell`) calls `TokenBank.sell()`
     once **per copy** in a loop. Selling 100 Tokens fires 100 rounds of
     whatever `sell` publishes — the same shape as Session 2's
     320-events-in-one-tick sprite sweep.
- **Suggested fix**: (1) split the effect — subscriptions keyed on
  `[EventBus, tile]` only, with `isHovered` / `missingReqs` read from refs.
  (5) give `TokenBank` a `sell(typeId, quantity)` that publishes once.
- **Related**: CR2-007, Session 2's event-volume finding, objective 5's
  performance bar.

#### ✅ Session 8 — measured. Two of the five matter; three do not.

Full 49-tile board, 12 heroes working, 619 live subscriptions, all panes closed.
Whole-tick cost across all eight registered handlers, averaged over 300 ticks:

| Handler | ms/tick |
|---|---|
| `board_runner` | **0.134** |
| `regen_system` | 0.012 |
| `sprite_layer` | 0.003 |
| `wounded_system` | 0.002 |
| `time_tracking` | 0.002 |
| `time_bank` | 0.001 |
| `status_effects` | 0.001 |
| `quest_manager` | 0.001 |
| **Total** | **0.159 ms**, i.e. **3% of the 5 ms budget** |

Round 1's 0.09 ms was on a different engine and a sparse board; **0.159 ms with
the board full and every hero working is the number that replaces it, and it is
comfortable.** Item 2 (`Board.jsx`'s 49-tile projection plus `fast-deep-equal`)
is inside that figure and is not a problem at this size.

**Item 1 stands and is the one to fix.** The dependency array at
`TileProgressBar.jsx:202` still reads
`[EventBus, tile, effectiveAlert, isHovered, missingReqs, token?.heroId]`, so
hovering does tear down and rebuild four subscriptions and cancel the animation
frame, and `active` resets to `false`. **The visible hitch could not be observed
here** — `requestAnimationFrame` never fires in this pane, and the `setTimeout`
polyfill that unblocked the drawers runs at ~1 fps, which is far too coarse to
see a stutter. **This is an owner's-eyes check**: hover slowly across a row of
working tiles and watch whether their bars blink or jump back.

**Item 5 (`TokenBank.sell` per copy) is worth doing** on the same reasoning that
retires CR2-007: per-action storms are the real cost now that per-tick ones are
measured and small.

**Item 4** (`DrivesBlock` scanning every Token type) is currently trivial — the
content set has **ten** Tokens. Re-check it if content grows.

**An unlisted observation worth having:** opening any drawer pane **unmounts the
whole board**. `board:progress` goes from 98 subscribers to 0 and
`board:tile_changed` from 153 to 3, then back again on close. That is good for
performance while a pane is open, but it means every pane toggle churns ~400
subscriptions — and it is why a subscriber census must be taken with all panes
closed or the numbers are meaningless.

---

### CR2-169 · P2 · S · Session 7 · Status: Open — **file-level detail on CR2-134 and CR2-146**
- **Where**: `src/ui/components/board/Tray.jsx:174-186` **and** `:418-429`;
  `src/ui/components/drawer/TokenVaultTab.jsx:64-90, 125-149`;
  `src/ui/components/board/TrayMiniBoard.jsx:64-68`;
  `src/ui/components/drawer/TokenInspection.jsx:48-51`
- **What**: Session 6 owns the finding; this adds what its territory could not
  see, from inside the two files that are Session 7's.
  1. **There are five copies of the Vault deposit rule, not three.**
     `Tray.jsx` carries it **twice** — once in the chest drop target
     (`chestDrop.onDrop`) and once in `TrayToken.handleContextMenu` — and the two
     differ in what they publish. CR2-134 cites only `Tray.jsx:414-430`.
  2. **They also disagree about what a deposit *is*.** `Tray`'s chest accepts
     four origins (`traySlot`, `tile`, `boardMapId`, `spriteId`); the Vault
     pane's own drop target accepts **two** (`traySlot`, `tile`). So dragging a
     loose loot Token, or a Map sitting on the playmat, onto the *open Vault*
     does nothing, while dropping it on the Tray's chest works and explains
     itself. Same rule, same session, two different answers.
  3. **The Tray-capacity rule has a third home.** Session 6 found it in
     `TokenVaultTab`'s quick-add; it is also in `TokenInspection.jsx:48-51`
     (`trayFull`), which disables the "Add to Tray" button. That one is the
     *correct* shape — an engine rule mirrored into a disabled control — and is
     noted here so it is not lumped in with the violations.
  4. `Tray.jsx:174-186`'s deposit publishes **nothing** — not even
     `state_changed`; `TrayToken.handleContextMenu` publishes three events
     including `board:sprite_collected`, which `QuestManager` counts.
- **Suggested fix**: unchanged from CR2-134 — one engine
  `TokenBank.depositFrom(source)` / `withdrawTo(target)` pair. This ticket
  exists so the fix covers all five sites and both accept-lists.
- **Related**: CR2-134, CR2-146, CR2-033, CR2-160.

---

### CR2-170 · P2 · S · Session 7 · Status: Open
- **Where**: `src/ui/components/board/Board.jsx:151-162` and `:195-201`
- **What**: Two places where `Board` steps around its own conventions.
  1. **`handleBurstMap` swallows the refusal reason.** Every other engine call
     in the file goes through `announce()`, which surfaces `result.reason` as a
     warning toast. This one does not: on failure it silently puts the Map back
     and publishes `state_changed`. The player clicks a Map, nothing happens,
     and nothing says why.
  2. **The Map branch of `handlePlaceToken` lifts a Token off a tile with
     `BoardState.takeToken(payload.from.tile)` instead of a `Placement`
     function.** Every other tile-origin branch in the same handler routes
     through `Placement.moveToken` / `returnTokenToTray` / `placeToken`.
     `Placement` is where the board's bookkeeping lives (displacement, hero
     knock-off, vacancy and alert clearing); reaching past it to the raw state
     accessor is the one call in this file that could leave the board
     inconsistent.
- **Confidence**: (1) is certain from reading. (2) is a layering concern with an
  **unproven** consequence — confirming it means diffing what `Placement`'s
  removal path does against bare `BoardState.takeToken`, and `Placement.js` is
  Session 2's territory. Flagging the shape, not the consequence.
- **Suggested fix**: wrap the burst in `announce`; route the Map branch through
  the same `Placement` call the non-Map branch uses.
- **Related**: CR2-160.

---

### CR2-171 · P2 · S · Session 7 · Status: Open — **the lint residue in this territory**
- **Where**: 6 of `npm run lint`'s current problems, plus 11 more the
  recommended rules add
- **What**: this session's share of CR2-036, claimed rather than re-filed, plus
  the result of re-running with `js.configs.recommended` actually applied
  (CR2-129's fix, simulated with a throwaway config that was deleted afterwards).

  | File:line | Rule | Verdict |
  |---|---|---|
  | `BoardTile.jsx:105` | `no-unused-vars` — `ALERT_HINT` | **The archetype. Its own ticket: CR2-156.** |
  | `BankTab.jsx:50` | `no-unused-vars` — `gold` | **CR2-162** — and there is a second, worse one in the same file (`maxTabs`) that lint cannot see. |
  | `BottomFolderDrawer.jsx:48` | `no-unused-vars` — `cardTier` | **CR2-166.** |
  | `GuildUpgradeInspection.jsx:12` | `no-unused-vars` — `onClose` | **CR2-167.** |
  | `BoardTile.jsx:39, 194, 220` | `react-hooks/exhaustive-deps` — `EventBus` is an unnecessary dep | Benign. `EventBus` is a module singleton; listing it is harmless noise. Drop it or suppress. |
  | `Board.jsx:169, 170` | `no-useless-assignment` *(recommended set only)* | `let x = 0; let y = 0;` then both branches assign. Harmless; tidy. |
  | `TokenInspectPopup.jsx:28` | `no-useless-assignment` *(recommended set only)* | `let dir = 'top'` then reassigned in every branch. Harmless. |
  | `Board.jsx:253, 256` | **`no-undef` — `TokenBank`** *(recommended set only)* | **Already filed: CR2-127.** Not re-filed. |
  | `TokenVaultTab.jsx:80, 86, 146, 147, 148` | **`no-undef` — `EventBus`** *(recommended set only)* | **Already filed: CR2-126.** Not re-filed. |

- **The headline result, and it is a clean one: with the full recommended rule
  set switched on, this territory produces NO undefined reference beyond the two
  Session 6 already found.** 17 problems, 11 errors, and every error is either
  CR2-126 or CR2-127.
- **And the counterweight, which matters more than the clean result.** The four
  most consequential half-wired features found this session are **all invisible
  to the linter, including the fully-configured one** — CR2-153 (a spread of an
  `undefined` property), CR2-154 (props passed to a component that does not
  declare them), CR2-162's `maxTabs` and CR2-163's `gold` (object properties,
  not bindings). `no-unused-vars` sees a dropped **binding**; it cannot see a
  dropped **prop** or a dropped **field**, and those are where this territory's
  damage is. **CR2-036's list is a floor, and a low one.**
  `eslint-plugin-react` is **not** installed; its `prop-types` /
  `no-unknown-property` family would catch part of the prop-mismatch class, and
  is worth Session 9's consideration alongside CR2-129.
- **Related**: CR2-036, CR2-129, CR2-126, CR2-127, CR2-152.

---

### CR2-172 · P2 · S · Session 7 · Status: Open
- **Where**: `src/ui/components/board/Tray.jsx:256`
- **What**: **`TrayToken` is keyed `${entry.typeId}-${slot}`, not by the
  instance id it already has.** Tray entries carry a stable `entry.id`
  (`tok_…`), and the projection at line 52 already selects it.
- **Why it matters**: slots are array indices, so removing any Token but the
  last re-indexes everything after it. React then reuses a mounted component for
  a *different* Token instance, carrying over its local `hiddenUntilLand` and
  `landing` state and its effect's captured `entry.id`. The visible symptom is a
  newly-arrived Token that never fades in — its predecessor's `hiddenUntilLand`
  was already false, or its 800ms safety timer had already fired — or one that
  stays invisible for the full fallback. With overlapping free placement (D-223)
  and 48 slots this gets more likely, not less.
- **Confidence**: reasoned from the code, **not reproduced** — it needs a
  removal from the middle of a populated Tray, which the current content set
  (CR2-044) made awkward to stage.
- **Suggested fix**: `key={entry.id}`. `slot` stays as a prop for the drag
  payload and z-order.

---

### CR2-173 · P3 · S · Session 7 · Status: Open
- **Where**: `src/ui/components/drawer/TokenInspection.jsx:105`
- **What**: **`{def.theme && <span…>{def.theme}</span>}` — theme residue in a
  render path.** `concept_audit.md` §A rules themes **NOT REAL** and the
  registries were cleaned; this branch survived and can never be true.
- **Why it matters**: trivial in effect, but it is the last live reference to
  `theme` in a rendering path, and the concept audit exists precisely so these
  do not linger and quietly re-legitimise the idea.
- **Suggested fix**: delete the branch.
- **Related**: CR2-039, `concept_audit.md` §A.

---

### CR2-174 · P3 · S · Session 7 · Status: Open
- **Where**: four small dead things, grouped because each is a one-line fix
  1. `src/ui/components/dock/HeroDockCard.jsx:61` —
     `!vertical && "h-[DOCK_TAB_H]"`. **The constant's *name* is inside the
     Tailwind arbitrary value**, so the emitted class is `h-[DOCK_TAB_H]`, which
     matches no CSS rule. Harmless only because the `style` attribute on the
     same element sets the height correctly.
  2. `src/ui/components/board/TokenInspectPopup.jsx:79` — the outside-click
     handler exempts `e.target.closest('[data-tile-index]')`. **Nothing in the
     codebase sets `data-tile-index`** (grepped `src/`, `src/tests/`,
     `cms/src/`). The exemption can never apply, so clicking one tile always
     closes the popup rather than re-anchoring it to the new tile. `BoardTile`
     has `index` in scope and could stamp it.
  3. `src/ui/components/board/TrayMiniBoard.jsx:26-30` — `handleDrop` opens with
     `NotificationSystem.warning('Cannot place here')` for conditions its own
     `accepts` predicate already rejects. Unreachable defensive code that reads
     as a live path.
  4. `src/ui/components/drawer/SellControls.jsx:20` — `getTotalPrice` is an
     optional prop supplied by `TokenInspection` and not by `ItemInspection`,
     which relies on the `unitPrice` fallback. Correct today (items price
     linearly; Tokens do not, because a part-used copy sells for less), but it
     currently reads like an oversight and deserves a one-line comment saying
     why.
- **Suggested fix**: as described. (1) and (3) are deletions, (2) is one
  attribute on `BoardTile`, (4) is a comment.

---

### CR2-175 · P3 · S · Session 7 · Status: Open
- **Where**: `src/ui/components/drawer/CartographerTab.jsx:200-205`;
  `src/ui/components/drawer/MapInspection.jsx:105-108, 88-95`
- **What**: Two presentation gaps in the Map pool, both the same shape.
  1. **An *item* in a Map's drop pool renders as the first two letters of its
     name** — `{entry.name.slice(0, 2)}` in the shop's pool chips and again in
     the inspection sheet's drop rows — while a *Token* in the same list renders
     its sprite. `ItemIcon` exists, is used everywhere else in the drawer, and
     takes exactly the template `getItem(entry.refId)` would return. So half of
     every Map's contents is shown as an abbreviation.
  2. **An undiscovered pool entry hides its name and shows its exact drop
     percentage.** `MapInspection` renders `???` / "Undiscovered" beside a
     precise figure. Either the entry is a mystery or it is not; today it is
     half of each.
- **Why it matters**: (1) is the Map shop's main content — a burst is the game's
  headline reward beat (D-142) and the shop is where the player decides which
  Map to buy. (2) is small, and may be deliberate.
- **Suggested fix**: (1) use `<ItemIcon item={getItem(entry.refId)} size={32} />`
  in both places. (2) **Owner decision** — **A** hide the percentage too;
  **B** keep today's behaviour (percentage shown, name hidden) and say so in the
  tooltip; **C** show both. Recommend **B**, since the percentages are what make
  the shop comparable.

---

### CR2-176 · P3 · S · Session 6 *(stub filed by Session 7)* · Status: Open
- **Where**: `src/ui/ReactRoot.jsx:286` and `:282-292`
- **What**: two `ReactRoot` faults found while tracing this territory's props,
  filed for the session that owns the file.
  1. **`onSelectHero={(id) => {}}` — an empty function.** It reaches
     `HeroDockTab` as `onSelect` and is called by the tab's `onClick`, so
     single-clicking a hero tab in the rightmost dock is a deliberate no-op.
     Selection is driven entirely by `onDoubleClickHero`. Either the single
     click should do something, or the handler and the tab's `onClick` should
     both go.
  2. **`RightmostHeroDock` renders only when `!menuRight`.** With the nav bar on
     the right-hand side the hero dock is absent from the screen entirely,
     unless the Item Bank pane happens to be open (which swaps the Tray for
     `VerticalHeroDock`). Combined with CR2-153 that would leave a right-nav
     player with no hero surface at all. Needs the owner's intent — it may be
     that the right-nav layout is *meant* to use the vertical dock, in which
     case the condition is right and something else should render it.

---

## Session 7 — verdicts on already-filed tickets

| Ticket | Verdict |
|---|---|
| **CR2-036** | **4 of its sites claimed** — `ALERT_HINT` → **CR2-156**, `BankTab` gold → **CR2-162**, `BottomFolderDrawer` `cardTier` → **CR2-166**, `GuildUpgradeInspection` `onClose` → **CR2-167**. Full territory table in **CR2-171**. ⚠️ **Its framing needs a correction**: the ticket presents the lint list as the detector for "computed then dropped" and "accepted then ignored". In this territory the four worst instances of both shapes are **invisible to lint even fully configured** — see CR2-171's counterweight note. |
| **CR2-127** | **Confirmed, and worse than filed.** Re-verified by `no-undef` under a corrected config. Adds: `TrayMiniBoard` handles the identical vault→tile branch **correctly**, so the same gesture works on the mini-board and silently fails on the real board — see CR2-160. |
| **CR2-126** | **Confirmed present** (5 `no-undef` errors in `TokenVaultTab`). Nothing to add beyond CR2-169's point that the Vault pane's deposit accept-list is narrower than the Tray chest's. |
| **CR2-129** | **Confirmed and independently reproduced.** The stock config yields 6 problems over this territory; `js.configs.recommended` applied properly yields 17. **No new undefined references beyond CR2-126/127.** |
| **CR2-134** | **Confirmed and widened: five copies, not three** — `Tray.jsx` holds two of them, and the two accept-lists differ. See **CR2-169**. |
| **CR2-146** | **Confirmed still present** at `TrayMiniBoard.jsx:64-68`. `TokenVaultTab`'s copy is still masked by CR2-126, exactly as Session 6 described. |
| **CR2-050** | **A third instance found, and it argues the ticket should be narrowed.** `Board.jsx:174-180` computes a board Map's `x`/`y` as **absolute pixels**, clamped to `BOARD_PX - TILE_PX`, and `BoardMapToken` renders them as raw `left`/`top`. But `BOARD_PX` is a **compile-time constant (944)** — the playmat is a fixed-size element that does not respond to window size — so pixel coordinates *on the board* are stable across a resize and a reload. The same is true of `SpriteLayer`'s sprites, which are positioned inside that same fixed box. **The Tray is the only surface in this territory whose size varies, and the Tray already uses fractions.** So CR2-050's off-screen scenario may not be reachable at all. Recommend re-reading it with that in mind before funding any normalisation work — the fix may be smaller than it looks, or unnecessary. Session 8's two-minute resize check settles it. |
| **CR2-021** | **Not re-tested.** No overlapping SFX were produced in this session's runtime pass, and `DOCK_SFX` — the only audio this territory publishes — is unreachable (CR2-154). Leave to Session 8. |
| **CR2-031** | **Not reached.** The 90-notification burst was not run; this session's runtime budget went to the dock, the alerts and the save-safe setup. **Leave to Session 8**, as Session 6 recommended. No reason to think it has changed. |
| **CR2-044** | **Corroborated from the UI side.** A fresh game's Tray renders tooltips reading `token_trout_stream — unlimited` and `token_forest — unlimited` — the raw ids, because `tokenName()` falls back to the id when the type is absent. Also: `TokenInspection` returns `null` for them, so double-clicking an opening-Tray Token opens an **empty popup shell**. Session 1 owns it. |
| **CR2-112** | **Confirmed from the UI side, with the asymmetry named.** `ItemInspection` and `TokenInspection` sit in the same drawer column, and `ItemInspection` **does** render `template.description` in italics; `TokenInspection` has no description block at all. Both the pipeline half and the UI half are missing, in sibling components. |
| **CR2-111 / CR2-114** | **Blocked two checks.** No recipe resolves in the current content set, so `ConnectionLines`' recipe label — which renders **`recipe.id`, a raw internal id rather than a name**, and should be folded into whichever ticket fixes recipes — could not be seen on screen. And the single "Test Map" meant CR2-158's single-click burst could not be reproduced by hand. |
| **CR2-039** | **One more theme residue found, in a render path** — `TokenInspection.jsx:105`. Filed as **CR2-173**. |
| **The guide's Session 7 row** | **Correct as written.** The kickoff brief's claimed drift (board 9 not 10, dock 6 not 7) is itself wrong; the row names all 10 board files and all 7 dock files. |

---

## System Map — Session 7: Game-surface components

### The three surfaces, and what hangs off them

```
  ReactRoot
    ├── Board ──────────► 49 × BoardTile ──► TileProgressBar (rAF, direct DOM)
    │     │                    └──────────► TokenChargeBadge, TokenNameBadge, HeroBadge
    │     ├── ConnectionLines  (hover only, D-84)
    │     ├── SpriteLayerView ─► LootSprite
    │     └── BoardMapToken    (free-floating Maps)
    ├── GuildHallBoard         (replaces Board in the guild view)
    ├── Tray ───────────► TrayToken, TrayMiniBoard (during a drag, Vault open only)
    ├── RightmostHeroDock ─► HeroDockTab ×N, HeroInspectionSheet
    ├── VerticalHeroDock ──► HeroDockCard ─► HeroDockTab + DockEquipmentGrid
    │                                         + DockSkillsGrid   ⟵ UNREACHABLE (CR2-154)
    ├── BottomFolderDrawer ─► InspectionPanel + one of
    │        BankTab | TokenVaultTab | CartographerTab
    │        InspectionPanel ─► ItemInspection | TokenInspection
    │                        | MapInspection  | GuildUpgradeInspection
    └── TokenInspectPopup      (modal layer; Board renders a dead second copy — CR2-159)
```

`HeroSkillSheet` hangs off `HeroEditModal`, not off any of the three surfaces —
which is the root of CR2-165.

### State this territory owns

All of it is local component state; **none of it is in `GameState`.**

| Owner | State | Note |
|---|---|---|
| `Board` | `hoveredTile` | drives `ConnectionLines` only (D-84) |
| `BoardTile` | `landing`, `pushTransform`, `isPushing`, `tileHovered` | all animation |
| `TileProgressBar` | `eventAlert` + imperative DOM writes | deliberately outside React's render cycle (see the file header) |
| `TokenChargeBadge` | `localHover`, `hasProgress` | |
| `Tray` / `TrayToken` | `hiddenUntilLand`, `landing` | keyed wrongly — CR2-172 |
| `HeroDockTab` | `isHovered` | |
| `BankTab` | `activeTabId`, `typeFilter`, `searchTerm`, `selectMode`, `selectedIds`, `sellModalOpen` | `typeFilter` unreachable — CR2-161 |
| `TokenVaultTab` | `activeId` | |
| `TokenInspectPopup` | `coords`, `isVisible` | `isVisible` gated on rAF |
| `SellControls` | `sellQty` | |

### Events published by this territory

| Event | Publisher | Verdict |
|---|---|---|
| `state_changed` | `Board` ×6, `Tray` ×4, `TrayMiniBoard` ×4, `TokenVaultTab` ×2 | The UI announcing its own engine calls. Inconsistent — CR2-169(4). |
| `board:tile_changed` | `Tray` ×2 | Same. |
| `board:sprite_collected` | `Tray.TrayToken` | A component announcing an engine fact `QuestManager` counts — flagged by Session 6, still true. |
| `vault_withdrawn`, `token_bank_updated` | `TrayMiniBoard`, `TokenVaultTab` | **Double-published — CR2-146.** |
| `ui:open_drawer` | `BankTab` (`ItemInspection`), `TokenInspection` | Healthy — but neither ever sends a `filter`, CR2-161. |
| `ui:notify` | `BankTab` (`ItemInspection.handleSell`) | **No subscriber — CR2-130.** A failed item sale is silent. |
| `audio:play` | `VerticalHeroDock.handleToggle` | **Unreachable — CR2-154.** |

### Events subscribed by this territory

`board:progress`, `board:tile_changed`, `board:cycle_complete`,
`board:alert_changed`, `board:tile_pushed`, `board:hero_placed`,
`board:hero_recalled`, `board:token_depleted`, `board:sprites_changed`,
`board:tray_changed`, `particle_landed`, `heroes_updated`,
`hero_equipment_changed`, `hero:status_changed`, `hero_promoted`,
`inventory_updated`, `currency_changed`, `token_bank_updated`,
`vault_deposited`, `vault_withdrawn`, `map_purchased`, `map_opened`,
`guild_upgrades_updated`, `state_changed`.

All via `useGameState` or a paired `useEffect`. **Session 6's leak audit covered
every site in this territory and found them all clean — re-confirmed here.**

### Engine modules this territory calls

Direct imports: `BoardState`, `Placement`, `SpriteLayer`, `TokenBank`,
`TokenGroups`, `Cartographer`, `RecipeResolver`, `adjacency`, `BoardRunner`
(`ALERT` only), `NotificationSystem`, `CommerceSystem`, `InventoryManager`,
`GuildUpgradeManager`. Through `useEngine`: `EquipmentManager`,
`BoardPlacement`, `EventBus`.

**Two module-name mismatches through `useEngine`, both silent:**
`engine.Placement` (does not exist — it is `BoardPlacement`) and
`engine.HeroAssignmentManager` (retired). Both are in the dock — **CR2-157**.
The direct-import convention the board and drawer use has no such failure mode;
the dock is the only place that reaches through the engine object for these, and
it is the only place that is broken.

### Does any component enforce a game rule? (Session 6's sweep, this territory)

| Component | The rule | Verdict |
|---|---|---|
| `Tray` ×2, `TokenVaultTab` | "Maps cannot be stored" + "the Vault can be full" | ❌ **Five copies across the codebase — CR2-169.** |
| `TokenVaultTab` | "the Tray is full" | ❌ A re-implementation. |
| `TokenInspection` | "the Tray is full" | ✅ Mirrors the engine rule into a disabled button — the correct shape. |
| `TrayMiniBoard` | placement legality / occupancy | ⚠️ Partly — its `isOccupied` map is its own answer to a question `Placement` also answers, and it gets 2×2 wrong. **CR2-160.** |
| `TileProgressBar` | which alerts mean "need items" vs "need tokens" | ❌ **Yes.** It re-derives an alert from `getMissingRequirements` when the engine has not set one, and branches on bare string literals rather than the exported `ALERT` table — which is exactly why three values fall through. **CR2-155.** |
| `Board`, `BoardTile`, `Tray` (drop handlers) | placement, movement, return | ✅ All route through `Placement.*` and report `result.reason` — except the Map branch, CR2-170(2). |
| `BankTab` | how many bank tabs exist | ⚠️ `BANK_TAB_CAP = 20` is a component constant and the engine's `maxTabs` is ignored. **CR2-162.** |
| `HeroInspectionSheet` | "a skill you don't hold is locked behind promotion" | ❌ **A rule the design log does not contain, invented in a component. CR2-165.** |

**Verdict: this territory is where objective 3's sharper form actually bites.**
Three genuine violations, one of which (`TileProgressBar`) has already caused a
player-facing defect precisely *because* the rule was re-expressed as string
literals instead of imported — which is the mechanism CR2-033 predicted.

### Session 7 — save-slot handling

Captured before anything else: **three** `localStorage` keys —
`fantasy_guild_last_slot` (`"0"`), `fantasy_guild_slot_0` (4,046 bytes) and
`fantasy_guild_slot_0_backup` (4,046 bytes). Full contents were read out, and a
length + checksum snapshot taken.

**`GameLoop.stop()` was called before anything was touched**, so no autosave
could fire against the owner's slot. **The owner's save was never loaded.** A
new game was started in the empty **slot 2** (`fantasy_guild_slot_1`) for all
runtime work, so `fantasy_guild_slot_0` was never the active slot at any point.

Afterwards the loop was stopped again, `fantasy_guild_slot_1` was removed, and
`fantasy_guild_last_slot` was set back to `"0"` (starting the new game had moved
it to `"1"`). The final state was re-checked against the opening snapshot:
**all three keys match on both length and checksum, and no extra key remains.**
The throwaway ESLint config used for the recommended-rules run was deleted, and
`git status` is clean apart from this findings file.

---

## Filed by Session 8 — Runtime verification, hands-on (2026-08-19)

**How this batch was produced.** Everything below was seen in the running game,
not read out of the source. The game was driven through `window.Game` /
`window.GameState`, through real DOM clicks, and through synthetic pointer
sequences that drive dnd-kit's real sensor. Where a check could not be completed
the ticket says so plainly rather than guessing.

Setup used for the measurements: a **new game in the empty slot 3**, a **full
49-tile board**, **12 heroes placed and working**, all panes closed, 619 live
EventBus subscriptions.

---

### CR2-177 · P2 · S · Session 8 · Status: Open
- **Where**: `src/ui/components/board/Tray.jsx:60`; the constant it names is
  absent from `src/systems/board/boardEvents.js`
- **What**: **The Tray subscribes to an event called `undefined`.**
  `Tray.jsx:60` passes `BOARD_EVENTS.TRAY_CHANGED` in its `useGameState` event
  list. `BOARD_EVENTS` has no `TRAY_CHANGED` key, so the value is `undefined`,
  and `EventBus.subscribe(undefined, …)` happily creates a subscriber set keyed
  on the literal `undefined`.
- **Confirmed at runtime**: dumping `EventBus.subscribers` in the running game
  shows an entry whose key stringifies to `"undefined"` with **1 subscriber**,
  and the stored callback is textually a `useGameState` handler. A full-repo grep
  finds `TRAY_CHANGED` in exactly one place — the subscription. **Nothing
  publishes it and nothing else references it.**
- **Why it matters**: it is objective 1 in miniature — a wire connected at one
  end to nothing at all. The Tray does not visibly break, because the same
  subscription list also carries `state_changed`, `token_bank_updated`,
  `vault_deposited`, `vault_withdrawn` and `BOARD_EVENTS.TILE_CHANGED`, and one
  of those fires for anything the Tray cares about. So the cost today is a dead
  subscription and a misleading line of code that reads as if the Tray has a
  dedicated refresh channel. The risk is the next person who adds a Tray-only
  mutation, publishes `TRAY_CHANGED`, and cannot work out why the Tray does not
  update.
- **Suggested fix**: either add `TRAY_CHANGED: 'board:tray_changed'` to
  `boardEvents.js` **and publish it** from `BoardState.addToTray` /
  `takeFromTray` / `setTrayPosition`, or delete the entry from the list. The
  second is smaller and honest; the first is what the code was reaching for.
  **Also worth a guard**: `EventBus.subscribe` should warn on a non-string event
  name — this class of typo is invisible today.
- **Related**: CR2-036 (features wired at one end), CR2-129 (a correctly
  configured linter would **not** have caught this one — the constant reference
  is legal, it just resolves to `undefined`), objective 1.

---

### CR2-178 · P3 · S · Session 8 · Status: Open
- **Where**: `src/systems/core/AudioSystem.js:42` —
  `EventBus.subscribe('skill_leveled', () => this.playSfx('levelup'))`
- **What**: **`skill_leveled` has no publisher anywhere in `src/`.** Grepping for
  `publish('skill_leveled'` returns nothing. The only level-up event actually
  raised is `hero_leveled`, from `SkillSystem.js:166`, and AudioSystem already
  subscribes to that on the line above.
- **Why it matters**: harmless in effect — the level-up sound plays anyway
  through `hero_leveled` — but it is exactly the residue pattern objective 2 is
  looking for, and it is the **second** dead subscription found in this one file
  (CR2-016 removed `task_completed`). It also makes the file read as though two
  distinct level-up concepts exist.
- **Confirmed at runtime**: 1,368 real skill level-ups were generated and every
  one produced its sound via `hero_leveled`; the `skill_leveled` subscription
  never fired.
- **Suggested fix**: delete line 42. If a per-skill sound is wanted later,
  `hero_leveled`'s payload already carries `skillId` and `skillName`.
- **Related**: CR2-016, CR2-020/021/022 (the AudioSystem cluster), objective 2.

---

### CR2-179 · P1 · M · Session 8 · Status: Open — **owner decision needed**
- **Where**: `src/ui/components/board/boardConstants.js:22-27`;
  `src/ui/components/board/Board.jsx:286,293-294`;
  `src/ui/ReactRoot.jsx:204,301`; the Tray's width classes in
  `src/ui/components/board/Tray.jsx`
- **What**: **The playmat is a hard-coded 944 × 944 pixels with no scaling of any
  kind, so on any display smaller than about 1920 × 1080 part of the board is
  either off-screen or covered by the Tray — and the covered part stops accepting
  drops.** `BOARD_PX = TILE_PX * 7 + TILE_GAP_PX * 6` is computed from
  module-level constants at build time. `Board.jsx` sets the element's `width`
  and `height` to that number literally. Grep finds **no `transform: scale`, no
  zoom, no responsive breakpoint and no minimum-size warning anywhere in the
  render path.**
- **Confirmed at runtime**, by resizing the live window and measuring the tiles'
  own bounding boxes:

  | Viewport | Top-left tile | Right edge vs Tray | Result |
  |---|---|---|---|
  | 1920 × 1080 | y = 64 | board 1476, Tray 1500 | ✅ fits, 24 px to spare |
  | **1728 × 1080** *(16" laptop)* | y = 36 | board 1376, **Tray 1308** | ❌ **68 px of the right column sits under the Tray** |
  | **1600 × 1024** | y = 36 | board 1312, **Tray 1180** | ❌ right column under the Tray |
  | **1366 × 768** *(very common laptop)* | **y = −92** | — | ❌ **top row off the top of the screen**, bottom row clipped |
  | 900 × 700 | y = −130 | — | ❌ unusable |

- **And the covered tiles are not merely hidden — they are unreachable.**
  `document.elementFromPoint` at the centre of tile 48 at 1728 × 1080 returns the
  Tray's `tray-chest-deposit` drop zone, not the tile. `DndKit.jsx:56-63` ranks
  drawer surfaces above board surfaces deliberately ("Drawers beat the board
  where they overlap"), so a Token dropped on that tile is **deposited into the
  Tray chest instead**. The player gets a plausible-looking wrong outcome, not an
  error.
- **Why it matters**: the end goal is "a production build wrapped in a Tauri
  desktop shell for Steam". 1366 × 768 and 1600 × 900 are among the most common
  PC display resolutions there are, and 1728 × 1117 is the default logical
  resolution of a 16" MacBook Pro. On all of them a fresh install loses part of
  the board with no message. It is also silent: nothing warns, nothing scales,
  and the failure at the right-hand column looks like a mis-drop rather than a
  layout bug.
- **Suggested fix — owner decision, because all three are design choices:**
  - **A — scale the board to fit.** Wrap the 944 px board in a container that
    applies `transform: scale(min(1, availW/944, availH/944))` with a
    transform-origin at the top-left, and divide pointer coordinates by the same
    factor in `Board.jsx:174-175`. Keeps every layout decision intact and works
    at any size. *Recommended* — those two pointer-to-tile conversions are the
    only places that need to know about the scale.
  - **B — declare a minimum window size** and enforce it in the Tauri window
    config plus a "this window is too small" overlay in the web build. Cheapest,
    but it tells a 1366 × 768 laptop owner the game will not run.
  - **C — make the board itself responsive** (recompute `TILE_PX` from available
    space). Rejected as a recommendation: `TILE_PX = ART_PX × 2` exists because
    Token art is 64 px displayed at exactly 2× (D-216), and breaking that integer
    scale makes every sprite blurry.
- **Confidence**: high — measured at four viewport sizes against the tiles' real
  geometry, and the drop-stealing was confirmed by hit-testing, not inferred.
  The one thing not verified is behaviour inside the actual Tauri shell, which
  may set its own default window size; Session 9 owns `src-tauri/` and should
  check what that default is.
- **Related**: CR2-050 (found while refuting it), Session 9's Tauri readiness
  pass, `playmat_decisions.md` D-1 and D-216, D-107 (the Tray is deliberately
  never covered — this is the same collision rule biting from the other side).

---

### CR2-180 [DEFERRED: audio] · P3 · S · Session 8 · Status: Open — **owner question**
- **Where**: `src/systems/core/AudioSystem.js` — `GLOBAL_MIXER_GAIN`, applied in
  `playSfx()` (~line 88) and in `updateVolumes()`
- **What**: **With every in-game volume slider at 100, sound effects play at 0.2
  of the browser's volume**, because the final volume is
  `(master/100) × (sfx/100) × GLOBAL_MIXER_GAIN` and `GLOBAL_MIXER_GAIN` is 0.2.
- **Confirmed at runtime**: settings written as master 100 / sfx 100, four SFX
  fired, `HTMLAudioElement.volume` recorded as **0.2** on all four.
- **Why it matters**: probably intentional headroom, but it means the player's
  slider tops out at a fifth of what the hardware could do, and a player who
  finds the game too quiet has no remaining control. It also interacts with
  CR2-016: anyone testing "is combat audible now" at default settings hears
  nothing, and at maximum settings hears something quiet.
- **Owner decision**:
  - **A — leave it.** Deliberate mixing headroom, and the source clips may be
    hot. *Recommended if the clips were normalised loud.*
  - **B — raise `GLOBAL_MIXER_GAIN` to 1.0** and re-normalise the clips instead,
    so 100 on the slider means 100.
  - **C — leave the gain but relabel the slider**, since 100 already is the top
    of the game's range.
- **Related**: CR2-016, CR2-021.

---

### CR2-181 · P3 · S · Session 8 · Status: Open
- **Where**: `src/systems/board/TokenBank.js` — `contents()` / `consolidate()`;
  symptom visible in `src/ui/components/drawer/TokenVaultTab.jsx`
- **What**: **A Token whose id is not in the content set can be deposited into
  the Vault, where it is listed with its raw internal id as its display name.**
  Depositing the opening-tray ghost `token_forest` (CR2-044) produced a Vault
  entry of `{ typeId: 'token_forest', name: 'token_forest', rarity: 'common',
  count: 1, sellValue: 5 }`.
- **Confirmed at runtime** in a fresh save.
- **Why it matters**: it is the player-visible face of CR2-108 — the pipeline has
  no dangling-id check, so a broken reference surfaces as a Token called
  `token_forest` in the storage screen. There is good news buried in it: the four
  dud starting Tokens *are* disposable this way and sell for 5g each, so an
  existing save is not permanently carrying them. But "use the id as the name" is
  the wrong default — it makes a data fault look like a naming style.
- **Suggested fix**: when `getTokenType(typeId)` returns nothing, either refuse
  the deposit (CR2-044's second half already proposes refusing everywhere) or
  label it explicitly — `Unknown Token (token_forest)` — so it reads as a fault.
  Do not silently substitute the id.
- **Related**: CR2-044, CR2-108, CR2-011.

---

### CR2-182 · P2 · S · Session 8 · Status: Open — **note for the coverage plan (Session 9)**
- **Where**: the harness, not the game — `src/tests/` and this project's
  browser-verification practice
- **What**: **Three of this review's most severe findings were invisible to the
  test suite for the same structural reason: nothing exercises a drag.**
  CR2-153 (a hero cannot leave the dock), CR2-157 (the recall drop is a no-op)
  and CR2-127 (a dead vault-to-board branch) are all defects in *how a drop is
  wired*, and all three were settled only by driving dnd-kit's sensor.
  `HeroDock.test.js` has 22 green tests over a module the game never calls
  (CR2-154), which is the same gap from the other direction.
- **Why it matters**: the guide's premise is that a green suite has been
  compatible with a broken game. The drag layer is the single largest place where
  that is structurally true — dragging is the game's primary verb and it has no
  coverage at all.
- **Suggested fix**: the coverage-restoration plan should include a small drag
  harness. `vitest` now compiles JSX like the real build, and the synthetic
  pointer sequence recorded in this session's System Map notes is short enough to
  be a test helper: `pointerdown` on the source, one move past the 8 px
  activation threshold, stepped moves to the target, `pointerup`. Four assertions
  would have caught all three tickets — hero-dock → tile, tile-hero → recall,
  tray → tile, vault → miniboard.
- **Related**: CR2-153, CR2-157, CR2-127, CR2-154; the Retired Tests Ledger has
  no dock-drag row.

---

## System Map — Session 8: Runtime verification

**Territory:** the running game. No files owned. This section mostly records
*how to drive it*, because two of the three blockers earlier sessions hit turned
out to be solvable, and that is worth more to Session 9 than any single ticket
here.

### The harness — corrections to what earlier sessions recorded

| Claim carried into this session | What Session 8 found |
|---|---|
| "`requestAnimationFrame` does not run in this browser environment" | **True**, confirmed again — a plain `requestAnimationFrame(cb)` never fires. |
| "…therefore animation-driven behaviour cannot be observed" | **Too broad.** `setTimeout` *does* fire. Assigning `window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 0)` is enough to make **framer-motion mount its content**, which unblocks every drawer and every `AnimatePresence` pane. Sessions 6 and 7 could not open the Token Vault; with that one line it opens. |
| | ⚠️ It unblocks *mounting*, not *animating*. Hidden-tab timer throttling stretches each "frame" to ~1 s, so entrance and exit transitions crawl and freeze part-way. Anything whose **timing** matters (CR2-031's toast fade, CR2-168's progress-bar hitch) is still unmeasurable. A drawer left mid-slide can be finished by hand by overwriting its inline `style` to the end state. |
| "drag-and-drop is unreliable to simulate, so DnD findings need the owner's own eyes" | **False as stated.** dnd-kit drags are fully drivable. The missing trick is that **collision resolution lags one React commit**, so the pointer events cannot all go in one `javascript_tool` call. Send `pointerdown` + the 8 px activation move + the coarse approach in call 1, then **one move per call** as you close on the target, watching dnd-kit's `[aria-live]` region until it reads `moved over droppable area <target>`, then `pointerup` in the next call. Done that way it is completely reliable — this session placed Tokens on tiles, moved heroes between tiles, and dragged from the Vault into the Tray mini-board. |
| "screenshots time out" | Not retested; `read_page`, the `[aria-live]` region and `getBoundingClientRect` were enough throughout. |
| "`GameLoop` barely ticks in the preview pane" | True in effect, but the cause is not rAF — `GameLoop` uses `setInterval` (`GameLoop.js:39`). It runs, just slowly under hidden-tab throttling. **Drive it synchronously**: `for (const {handler} of window.Game.GameLoop.tickHandlers) handler(100, i)` is the real dispatch path. |

**Two probes worth reusing.** dnd-kit's `[aria-live]` region is the best oracle
for a drag — it announces pickup, every `over` change and the drop target, so you
never have to guess whether a gesture worked. And `document.elementFromPoint` at
a droppable's centre tells you which surface would actually win, which is how
CR2-179's stolen drops were proved.

**One thing not exposed that should be.** `window.Game` carries 29 systems but
**not** `SettingsManager`, `NotificationSystem`, `AudioSystem` or any registry,
which cost this session real time (the volume test had to go through
`localStorage` and a reload; the notification burst had to be manufactured out of
1,368 real level-ups). Adding those four to the dev-only global would make future
runtime sessions markedly cheaper.

### Measurements — the standing performance bar, re-verified

All with a full 49-tile board, 12 heroes working, all panes closed.

| Bar (guide, objective 5) | Result |
|---|---|
| Engine tick well inside 5 ms | ✅ **0.159 ms** for all eight handlers. `board_runner` is 0.134 of it; nothing else exceeds 0.012. |
| Flat memory over a long idle | ✅ 40,000 ticks driven synchronously. The heap sawtooths ~10 MB per 20,000 ticks and GC reclaims it: **net +0.25 MB across the second run**. Live subscriptions **619 → 619**. `EventBus.eventLog` stays 0, the sprite list stays bounded (8 → 10), the notification queue stays capped. **No leak.** |
| Hot-path visuals on direct DOM rather than React | ✅ Working as designed. `board:progress` carries 98 subscribers and fires ~2×/tick — **205 of the 209 subscriber callbacks per tick** — and every one writes DOM directly (`BoardRunner.js:408`). React sees almost none of it. |
| No render storm | ✅ See the Session 8 ruling appended to CR2-007. A 160-event burst and a single event both produce **one** DOM mutation. |
| Assets preloaded with no pop-in | ❌ **89 of 496 files gated, and the wrong 89** — see the Session 8 note on CR2-048. |
| No high-frequency allocations on the tick path | ✅ implied by the heap result; not separately profiled. |

**Save/load roundtrip.** A full snapshot (heroes, skills, equipment, all 49
tiles, tray, hero placements, Vault, inventory, currency, quests, sprites) was
taken, saved, the page reloaded, and the save loaded back through the
slot-selection screen. **Every field matched except tile work-progress**, which
differed only because the loop kept ticking between the snapshot and the save.
Loot sprites, hero placements and Vault contents all survived intact. The one
real loss is CR2-040's equipment re-pack.

**Load into changed content** needed no setup — the save already contained four
Tokens whose ids no longer exist. They load without error, persist across
reloads, render as blank squares, and are refused by `Placement`. So the answer
to "what happens to a save when content ids change under it" is: **nothing
happens, silently, forever.** That is CR2-108's thesis, observed.

### Events — the live picture at full load

Subscriber counts on a full board with panes closed. (This is the number that
matters: opening any pane unmounts the board and collapses them — `board:progress`
drops 98 → 0 — so a census taken with a drawer open is meaningless.)

| Event | Subscribers | Notes |
|---|---|---|
| `board:tile_changed` | 153 | ~3 per tile |
| `board:progress` | 98 | 2 per tile; ref-based, must never be batched |
| `board:cycle_complete` | 54 | |
| `board:alert_changed` | 50 | |
| `board:tile_pushed` | 49 | |
| `state_changed` | **11** | the global "re-read everything" broadcast |
| `inventory_updated` | 5–6 | |
| `undefined` | **1** | ← CR2-177 |

Publish volume in steady state is **2.25 events per tick**, of which
`board:progress` is 2.1. `state_changed` fired 7 times in 300 ticks.

### What Session 8 could not do, and why

1. **Hear anything.** There is no audio device. `play()` was verified to be
   called on real elements at non-zero volume with no rejection; a human still
   has to confirm CR2-016 by ear once.
2. **Time the toast fade (CR2-031)** or **see the progress-bar hitch
   (CR2-168 item 1)** — both need real animation frames. Written up as explicit
   owner checks in their own tickets.
3. **Open any `GIModal`**, including Settings. `GIModal` uses headless-ui's
   `Transition`, which the `setTimeout` rAF shim does not satisfy. The volume
   test worked around it by writing `fantasy_guild_settings` directly and
   reloading.
4. **Test combat.** Combat is parked by owner ruling (CR2-110) — no authored
   Token is `tokenType: 'enemy'` — and this session deliberately did **not** add
   one, since adding and reverting content mid-review is the kind of change the
   ground rules exist to prevent. Combat audio was therefore exercised by
   publishing the events the combat processors publish, which is the same path
   from `AudioSystem`'s side but does not prove the processors publish them.
5. **Reach the `VerticalHeroDock` pinned card (CR2-154)** — budget, not ability.

### Save-slot handling

Five `localStorage` keys existed at session start: `fantasy_guild_last_slot`
(`"0"`), `fantasy_guild_slot_0` and its `_backup` (4,046 bytes each), and
`fantasy_guild_slot_1` and its `_backup` (3,744 bytes each). All five were copied
to `__s8_bk_*` keys as a rolling backup **and** hashed before anything was
touched.

**The owner's saves were never loaded.** A new game was started in the empty
**slot 3** (`fantasy_guild_slot_2`) and every piece of runtime work happened
there. `GameLoop.stop()` was called before the restore, so no autosave could fire
mid-probe.

Restored afterwards: `fantasy_guild_last_slot` put back to `"0"` (starting the
new game had moved it to `"2"`), and `fantasy_guild_slot_2`,
`fantasy_guild_slot_2_backup`, `fantasy_guild_settings` and
`fantasy_guild_dev_mute_applied` — the last two created for the audio test —
**deleted**, since none of the four existed at session start. Every `__s8_bk_*`
key was then removed.

Final state: **exactly the five original keys, each matching its opening length
and checksum, and no extra key left behind.**

### Notes on the tree

`git status` shows one unrelated modification this session did not make —
`data/palettes/custom_palettes.json` gained three colours to its "Wood" ramp.
Nothing in `src/` or `cms/src/` references that file by name, so it was most
likely written by another chat sharing this checkout (the guide's standing
warning about concurrent sessions). **It has been left uncommitted and
untouched.** No game code, content or configuration was changed by this session;
all instrumentation lived in the browser page and was discarded with the tab.

---

## Filed by Session 9 — Build, Tauri readiness & synthesis (2026-08-19)

*Six new tickets, all from this session's own territory (build config, bundle,
assets, dependencies, versions, the desktop shell). The synthesis output — the
coverage plan and the final backlog — is in the two big sections that follow.*

### CR2-183 · P1 · S · Session 9 · Status: Open — **the Tauri half of CR2-179**
- **Where**: `src-tauri/tauri.conf.json` → `app.windows[0]`
  (`width: 1600, height: 1000, minWidth: 1024, minHeight: 700`), against
  `src/ui/components/board/boardConstants.js:22-27` (`BOARD_PX` = 944)
- **What**: **The desktop shell's default window is inside the exact size band
  CR2-179 proved is broken, and its minimum window is far below it.** Session 8
  measured the playmat at a fixed 944 × 944 with no scaling and found that at
  1600 × 1024 the right-hand column sits under the Tray and silently steals its
  drops, and that below ~1024 px of height the top row goes off-screen. The
  Tauri config opens the game at **1600 × 1000** — narrower and shorter than the
  1920 × 1080 that was the only size that fitted — and permits the player to
  shrink it to **1024 × 700**, at which point most of the board is unreachable.
  Session 8 explicitly left "what does the Tauri shell default to?" for this
  session; the answer is: the worst realistic case, out of the box.
- **Why it matters**: the first thing a Steam customer sees is this default
  window. On first launch, before touching anything, they get a board whose
  right-hand column swallows Tokens into the Tray chest instead of placing them.
  Nothing warns. This is not a new bug — it is CR2-179 — but it removes the
  "maybe most people run 1920 × 1080" hope, because *we* choose the window size.
- **Suggested fix**: whichever option the owner picks for CR2-179, this file
  needs to agree with it. If **A (scale to fit)**: leave the default but raise
  `minWidth`/`minHeight` to something the scaler is comfortable with and confirm
  the scaled board still hit-tests correctly. If **B (declare a minimum)**: set
  `width`/`height` to 1920 × 1080, `minWidth` 1600, `minHeight` 1080, and accept
  that laptops below that are unsupported. Do not ship the current numbers under
  either option.
- **Related**: CR2-179 (the parent, and the owner decision), `playmat_decisions.md`
  D-1/D-216.

---

### CR2-184 · P3 · S · Session 9 · Status: Open — **extra findings from CR2-129**
- **Where**: `eslint.config.js` (the misconfiguration itself is CR2-129);
  `src/ui/components/board/Board.jsx:169,170`,
  `src/ui/components/board/TokenInspectPopup.jsx:28`,
  `src/utils/AssetManager.js:42`; `src/tests/ContentRules.test.js:351`,
  `src/tests/SkillClassBaseline.test.js:227`
- **What**: **CR2-129 confirmed and quantified, plus what turning the rules on
  finds beyond the three crashes already known.** With the recommended rule set
  actually applied (measured this session with a throwaway config, since the
  review may not edit game code), the count goes from **32 problems / 6 active
  rules** to **46 problems / ~40 active rules**. The new material is:
  - **4 × `no-useless-assignment`** — values computed and then overwritten
    before anything reads them: `Board.jsx:169-170` (`x` and `y`, in the
    pointer-to-tile conversion), `TokenInspectPopup.jsx:28` (`dir`),
    `AssetManager.js:42` (`id`). These are new; no session has ticketed them.
    Each is small, but "computed then dropped" is this review's primary
    objective in miniature, and two of them sit in the pointer-coordinate maths
    CR2-179 will have to touch.
  - **2 × `no-undef` in tests** — `process` (`ContentRules.test.js:351`) and
    `require` (`SkillClassBaseline.test.js:227`) are Node globals, and the
    config's Node block covers `tools/`, `scripts/` and `*.config.js` but not
    `src/tests/`. Config gap, not a code bug: add `globals.node` to the test
    block when fixing CR2-129, or the fixed lint run starts with two false
    errors and gets ignored.
  - The 10 `no-undef` errors are exactly CR2-126 (5), CR2-127 (2), CR2-128 (1)
    and these two test-globals — **no fourth crash is hiding**.
- **Why it matters**: it bounds the job. Fixing the lint config does not open a
  hundred-item backlog; it adds four one-line cleanups and two config lines.
- **Related**: CR2-129 (fix this first), CR2-036, CR2-152, CR2-171, CR2-179.

---

### CR2-185 · P2 · M · Session 9 · Status: Open — **the CR2-008 asset audit, done**
- **Where**: `public/assets/` (11 MB, 568 files); `src/systems/core/AudioSystem.js`
  (`_getSfxPath`, `_getMusicPath`); `src/config/registries/sprite-manifest.js`;
  `src/systems/core/AssetPreloader.js:20`
- **What**: CR2-008 asked for the cross-check nobody had done. Here it is, by
  directory, against every literal asset filename appearing anywhere in `src/`,
  `data/`, `cms/src/` and `index.html`:

  | Directory | Size | Verdict |
  |---|---|---|
  | `audio/bgm/` | **3.9 MB** | **One file**, `The_Unlit_Gallery.mp3` (4,024,754 bytes) — **36% of the entire asset payload in a single track**. It does play (`AudioSystem.init` calls `handleAreaSwitch('area_guild_hall')`). |
  | `audio/sfx/` | 1.2 MB | 51 `.ogg` clips shipped; the clip table names **14**. The rest are the untouched Kenney pack, including a 314 KB `Preview.ogg` that is the pack's demo reel, not a game sound. |
  | `backgrounds/` | 2.9 MB | The largest orphan pool. `invasion/` (520 KB), `cards/` (296 KB), `quests/` (372 KB), `station/` (200 KB) and most of `area/` (1.2 MB) were authored for systems that are **retired and deleted** — invasions, cards, the authored quest pipeline, stations, the linear areas. |
  | `items/` | 1.2 MB | Against **6 authored items**. Most of it is art for content that has not been (re-)authored. |
  | `tokens/` | 516 KB | Live — 10 authored Tokens, all resolving (CR2-002 was a false alarm). |
  | `playmat/` | 696 KB | Live and load-bearing. Round 1's verdict on this folder is inverted; do not reuse it. |
  | `heroes/`, `ui/`, `icon/`, `enemies/`, `skills/` | 630 KB | Mostly live; two stray `.gif` animation experiments in `heroes/animations/`. |

  **2.79 MB across 407 files matches no filename literal anywhere in the repo.**
  That is a floor, not a total, because some art is reached by a path built at
  runtime; it is also not a delete list on its own.
- **Two live faults found while measuring:**
  1. **`_getMusicPath` maps three area ids to three tracks; two of the three
     files do not exist** (`forest_theme.mp3`, `mountain_theme.mp3`), and all
     three ids (`area_guild_hall`, `area_whispering_woods`,
     `area_misty_mountains`) are **area-set vocabulary the owner retired**. Only
     the hard-coded call in `init()` ever reaches this function.
  2. **`AssetPreloader`'s boot gate is still pointed at the retired art.**
     `CRITICAL_RE = /^assets\/(backgrounds|heroes|icon)\//` — it blocks boot on
     the *area banners* (mostly orphaned) and does not gate the playmat or the
     Tokens, which are what the first screen actually shows. This is CR2-048,
     re-confirmed from the asset side, and Session 8 measured its consequence:
     89 of 496 assets gated, none of them playmat or Token art.
- **Why it matters**: the code bundle is 855 KB and the art is 11 MB. Every
  megabyte here is download size and install size for a Steam build, and roughly
  **5 MB of it is for systems that no longer exist or sounds that are never
  played**. It is also the cheapest win in the whole review: no behaviour
  changes, no risk to gameplay.
- **Suggested fix**, in the order that gives most per minute:
  1. **Delete `Preview.ogg`** (314 KB, a vendor demo reel) — no judgement needed.
  2. **Re-encode or shorten the BGM track.** 4 MB for one looping mp3 is the
     single biggest line item; a 128 kbps mono-safe re-encode typically lands
     around 1–1.5 MB with no audible difference in a game mix. *Do not delete
     it* — it is the only music the game has.
  3. **Move, don't delete, the retired-system backgrounds** (`invasion/`,
     `cards/`, `quests/`, `station/`) into `raw_assets/` — out of the shipped
     build, still on disk. ~1.4 MB.
  4. **Leave `items/` alone** until content authoring settles; that art is
     waiting for items, not orphaned by a rework.
  5. **Fix `CRITICAL_RE`** to `^assets\/(playmat|tokens|heroes|ui)\//` (CR2-048).
  6. **Trim the 37 unreferenced SFX** only once audio is picked up — the clip
     table will change then anyway.
- **Confidence**: high on the sizes and on the two faults (both read directly
  from the files and the code); medium on the orphan list, which is a
  filename-literal match and will under-report art reached by a built path.
  **Nothing should be deleted from `items/` or `tokens/` on this evidence.**
- **Related**: CR2-008 (this closes its question), CR2-048, CR2-124, the audio
  deferral decision.

---

### CR2-186 · P3 · S · Session 9 · Status: Open
- **Where**: `package.json` → `dependencies`
- **What**: **Five `@fontsource/*` packages are listed as runtime dependencies
  and nothing imports them.** `src/styles/main.css` declares every `@font-face`
  against `/fonts/*.woff2` files that live in `public/fonts/`, with a comment
  explaining the fonts were deliberately self-hosted for the offline desktop
  build. The npm packages were the *source* of those files and are now inert:
  `@fontsource/dotgothic16`, `@fontsource/inter`, `@fontsource/micro-5`,
  `@fontsource/pixelify-sans`, `@fontsource/silkscreen`.
- **Why it matters**: nearly nothing — they are unimported, so they add zero to
  the 855 KB bundle. It is install-time weight and a misleading dependency list.
  The one real risk is the opposite of a bloat problem: if someone "tidies" the
  `public/fonts/` folder believing npm supplies the fonts, the game loses its
  typography.
- **Suggested fix**: move all five to `devDependencies` with a one-line comment
  saying they are the provenance of `public/fonts/*.woff2`, or drop them and
  record the provenance in `main.css` (where the licence note already is).
  Everything else in both `package.json` files checks out — `@dnd-kit/*`,
  `framer-motion`, `lucide-react`, `@headlessui/react`, `clsx`,
  `tailwind-merge`, `fast-deep-equal`, `nanoid`, `react`/`react-dom` all have
  live importers, and the dev tooling is all wired to a script.
- **Related**: CR2-008.

---

### CR2-187 · P2 · S · Session 9 · Status: Open — **desktop-shell readiness**
- **Where**: `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`,
  `src-tauri/src/lib.rs`, `package.json`
- **What**: three gaps between the current desktop shell and what the owner's
  decisions assume it will provide.
  1. **There is no Tauri JavaScript API in the project at all.** `package.json`
     has `@tauri-apps/cli` (the build tool) but **not `@tauri-apps/api`**, and
     `Cargo.toml` carries no `tauri-plugin-dialog` or `tauri-plugin-fs`.
     `capabilities/default.json` grants only `core:default`. **Owner decision 17
     defers save export/import to the Tauri wrap so it can use real file
     dialogs (CR2-045) — none of the machinery for that exists yet.** It is
     three dependencies and a permission entry, but it is not "already there
     waiting", and the decision reads as though it is.
  2. **`security.csp` is `null`** — no Content Security Policy. In a shipped
     desktop app that is the one hardening setting worth having, and it costs a
     single string. The game loads no remote resources (fonts are local by
     design), so a strict policy should apply cleanly.
  3. **The bundle description is for a game that no longer exists.**
     `Cargo.toml` describes *"an idle game where you manage a guild of heroes
     completing tasks, crafting, and defending against invasions"* — invasions
     are a retired concept, and this string is customer-facing metadata in the
     installer.
- **Why it matters**: item 1 is the important one. Until it is done there is
  **no way to back up a save at all**, which is the accepted risk recorded in
  decision 17 — and two review sessions had an autosave overwrite a slot
  mid-probe, recovering only because `SaveManager` keeps a rolling backup.
- **Suggested fix**: when the wrap is picked up, add `@tauri-apps/api` plus the
  `dialog` and `fs` plugins, grant the matching capabilities, and finish
  CR2-045's two stub functions against them. Set a CSP. Rewrite the description.
  **Everything else in `src-tauri/` is in good order** — see the System Map.
- **Related**: CR2-045, decision 17, CR2-183.

---

### CR2-188 · P3 · S · Session 9 · Status: Open
- **Where**: `npm run build` output; `src/state/GameState.js:44-45`,
  `src/main.jsx`, `src/ui/modals/SettingsModal.jsx`
- **What**: **Four `dynamic import will not move module into another chunk`
  warnings — every lazy import in the codebase is paying its cost and buying
  nothing.** `AssetManager`, `HeroManager`, `EquipmentManager` and `SaveManager`
  are each imported dynamically in one place and statically in 3–15 others, so
  Rollup folds them into the single chunk anyway. The build is one 855 KB file
  regardless.
- **Why it matters**: it is not a performance problem — for a desktop app
  loading from local disk, one chunk is the right answer and 855 KB is small.
  What it means is that **the two lazy imports in `GameState.js` are not buying
  code-splitting; they exist purely to break an import cycle**, which is what
  Sessions 1 and 3 concluded independently. The warnings are worth understanding
  once and then either accepting deliberately (with a comment) or removed with
  the cycle.
- **Suggested fix**: no action on the bundling. When CR2-086's deletion removes
  `RecruitCostCalculator` from the 16-module cycle, re-run `npm run cycles` and
  see whether the cluster can be broken properly; if not, add a one-line comment
  at `GameState.js:44` recording that the dynamic form is a cycle-break, not a
  split, so no future session "optimises" it.
- **Related**: CR2-051, CR2-086, Session 1 and Session 3's positions on the
  lazy-import cluster.

---

## Session 9 — verdicts on already-filed tickets

**CR2-129 — CONFIRMED, exactly as filed, and it is the cheapest high-value fix
in the review.** Measured directly: `eslint.config.js` spreads
`...js.configs.recommended` into the same object literal that later declares
`rules:`, and the later key wins. **Six rules are active** (`no-unused-vars`,
`react-hooks/rules-of-hooks`, `react-hooks/exhaustive-deps`, `no-console`,
`no-debugger`, `no-empty`) where roughly forty should be. Applying the
recommended set properly takes the report from 32 problems to 46 and surfaces
the three runtime crashes (CR2-126/127/128) plus four dead assignments
(CR2-184). **Fix: put `...js.configs.recommended.rules,` as the first line
inside the `rules` block and delete the object spread.** One line.

**CR2-008 — ANSWERED, see CR2-185.** The cross-check it asked for is done. Close
CR2-008 in favour of CR2-185, which carries the numbers and the delete list.

**CR2-145 — the version check it depends on: all five files AGREE at `0.6.0`.**
Verified this session: `package.json`, `package-lock.json` (both the top-level
field and `packages[""]`), `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`
and `src-tauri/Cargo.lock` (`[[package]] name = "app"`). CLAUDE.md's five-file
rule has been followed. **The only wrong version number in the project is the
hard-coded `v0.9.0` printed in the Settings sidebar** — so CR2-145 is a genuine
one-line fix with no version-bump work behind it.

**CR2-006 (the CMS has no tests) — RE-RAISED, unchanged, and it needs an owner
answer rather than a fix session.** It was filed to stop a scope decision
becoming permanent by silence, and the review is now over, which is exactly the
moment it would go quiet. Nothing has changed the risk: the 13-module solver
computes the game's balance numbers, an arithmetic error there produces content
that looks fine and plays badly, and the only coverage anywhere is three
game-side suites — one of which (`CMSBalanceEngine`, CR2-003) is **skipped
because three of its assertions come out at half the expected value and nobody
has established whether that is a solver bug or a renamed anchor Token.** That
unresolved half-value result is the single best argument for the ticket. **Owner
decision, as multiple choice:**
- **A — resolve CR2-003 first, then decide** *(recommended)*. One sitting. If
  the half-values turn out to be a renamed anchor, the solver is probably fine
  and A can end there. If they are real, that is the evidence for B.
- **B — a dedicated CMS review + test pass.** Effort L, a project not a sitting.
- **C — accept the risk explicitly and write it down.** Legitimate: the CMS
  never ships, and its mistakes are visible as bad content rather than crashes.
  If this is the answer, say so in the ticket so the next reviewer does not
  re-raise it a third time.

**CR2-009 (43 markdown files in the root) — RE-RAISED with a concrete list.**
This one is not a code problem; it is a *review* problem, and this review paid
for it. The guide records that it "drifted three times in the day between being
written and being used", that Sessions 4 and 5 were both briefed against
deleted files, and that `theme` — a concept nobody asked for — reached the code,
the content, the tests, the CMS **and the decision log with two decision
numbers** before anyone noticed. Stale documents are how that happens. The root
currently holds **44 `.md` files**; the archive candidates named in CR2-009 are
still all present. **This is a 30-minute job for the owner and nobody else can
do it** — the question "is this doc still live?" is not answerable from the
files. Recommendation: keep CR2-009 as filed, and do it *before* the fix waves
start, so the fix sessions are not briefed off retired documents the way the
review sessions were.

---

## System Map — Session 9: build, bundle, assets, desktop shell

### The build, verified this session

| Thing | Value | Verdict |
|---|---|---|
| `npm test` | **840 passed / 21 skipped / 0 failed, 58 files** | Baseline untouched |
| `npm run build` | **855.48 KB JS** (262.96 KB gzip) + **282.73 KB CSS** (44.27 KB gzip), single chunk | Clean; down from round 1's 1,036 KB and from the 912 KB recorded at `edb2e2d` |
| `npm run lint` | 32 problems, **6 rules active** | Broken config — CR2-129 |
| `npm run cycles` | 1 cycle group, 16 modules, **0 dangerous (static-only) cycles**, 228 files / 1,049 edges | Good |
| `npm run duplication` | **12 clones, 0.45% of lines** | Good |
| Five-file version check | **0.6.0 in all five** | Correct |

### What is actually in the bundle

Measured with a throwaway chunked build (deleted afterwards); the shipped build
is deliberately one file.

| Chunk | Size |
|---|---|
| App — `src/ui/` | 197 KB |
| App — `src/systems/` | 131 KB |
| App — `src/config/` (mostly content registries) | 73 KB |
| `react-dom` | 176 KB |
| `framer-motion` + `motion-dom` + `motion-utils` | 121 KB |
| `@headlessui/react` | 42 KB |
| `@dnd-kit/*` | 42 KB |
| `tailwind-merge` | 26 KB |
| `lucide-react` (tree-shaken from a 1,500-icon set) | 13 KB |
| everything else | < 20 KB combined |

**Reading**: roughly 400 KB of the app's own code against 455 KB of libraries,
and the libraries are all earning their place (motion drives the board and the
drag ghost, dnd-kit is the game's primary verb, headlessui is the modal shell).
There is no bloat story in the JavaScript. **The size lever is `public/assets`,
which is 13× the bundle** — see CR2-185.

### The desktop shell — what is in good shape

Worth recording, because most of `src-tauri/` is fine and a future session
should not re-audit it:

- Tauri **2.11.3** with `tauri-build` 2.6.3, edition 2021, Rust 1.77.2 —
  current, and matched to `@tauri-apps/cli` ^2.11.4.
- `lib.rs` is the stock template plus a debug-only logging plugin. Nothing
  home-grown to review.
- `beforeBuildCommand: "npm run build"` and `frontendDist: "../dist"` are wired
  correctly, so `npm run tauri:build` builds the web app first.
- Bundle targets `msi` + `nsis` (correct for a Windows/Steam build); the full
  Windows icon set is present, including `Square*Logo` and `icon.ico`.
- `identifier` `com.fantasyguild.game`, product name "Fantasy Guild",
  `mainBinaryName` matching.

The gaps are the three in CR2-187 and the window size in CR2-183.

### Persistence, for a desktop shell

`SaveManager` (343 lines) is **more robust than the review's warnings imply**,
and this is worth the owner knowing:

- Every save writes the **previous** value to a `_backup` key first, so there is
  always one generation of rollback.
- Load failures **automatically retry once from that backup** before giving up.
- `QuotaExceededError` is detected and handled distinctly from other failures.
- Every `localStorage` call is inside a `try`.

Three review sessions had an autosave clobber a slot mid-probe and **all three
recovered**, twice from this rolling backup. The design works.

**What it cannot do is survive the browser profile.** Saves live in
`localStorage`, and in a Tauri build that is WebView2's per-app data directory —
better than a browser cache, but still a single directory with no user-visible
file and no export. **Decision 17 accepted that risk until the Tauri wrap.** The
new information from this session is CR2-187: **the wrap has none of the file
machinery yet**, so "wait for Tauri" is currently waiting for work nobody has
scheduled. If the wrap slips past the first external playtest, the owner should
revisit — a plain "copy this JSON to your clipboard" export is an hour's work in
the browser and removes the whole class of risk.

---

## ⭐ The coverage-restoration plan

**Owner's decision, from the guide: coverage gets restored *after* the review and
*before* the fix waves.** This is that plan. Its shape follows one rule:
**restore the tests that will be standing under the code the fix waves are about
to change** — not all 41 deleted cases, and not in the order they were deleted.

**Start from a better position than the ledger suggests.** Every gutted suite
still exists as a file with its setup and its surviving cases: `Cartographer`
kept 3 of 16, `MapBurst` 6 of 15, `HeroSystem` 13 of 22, `BoardCombat` 20 of 21,
`Market` 6 of 7, `TokenChargeBadge` 9 of 10, `EquipmentRequirements` 4 of 6.
Restoring a case means **adding an `it()` back into a working file**, not
rebuilding a suite. And the ledger's own hint holds: several failed only because
a content id was **renamed** (`token_forest` → `token_oak_forest`, `item_coal` →
`item_charcoal`), so the repair is repointing a string.

### Step 1 — the one test that protects everything else (½ sitting)

**The content-integrity walk from CR2-108(b), as an un-skipped case in
`ContentRules.test.js`.** Do this before any other coverage work.

Every other test in the suite can be broken by a content rename; this one
*detects* content renames. It is also the only test in the plan that is true of
a *partial* content set — "every id resolves" says nothing about how much
content exists, which is why it must not join the 16 skipped completeness rules.
CR2-108's prototype found 8 dangling references in `data/` in under a second.

**It would have caught, on its own: CR2-011, CR2-044, CR2-063, CR2-084, CR2-120
and CR2-181** — six tickets, five separate systems, one failure mode.

### Step 2 — the drag harness (1 sitting) — the biggest hole in the suite

**CR2-182: dragging is the game's primary verb and it has no coverage at all.**
Three of the review's worst findings (CR2-153, CR2-157, CR2-127) were invisible
to 840 green tests for that single structural reason, and `HeroDock.test.js`
runs **22 green tests over a module the game never calls** (CR2-154) — the same
gap from the other side.

This is newly possible: `vitest.config.js` now compiles JSX the way the real
build does, so components can be rendered in tests for the first time. Session 8
recorded a synthetic pointer sequence that works (`pointerdown` on the source,
one move past the 8 px activation threshold, stepped moves to the target,
`pointerup` — each move in its own step, because collision resolution lags a
React commit).

**Four assertions, one helper:**
1. hero dock tab → tile places a hero *(catches CR2-153)*
2. tile hero → dock recalls a hero *(catches CR2-157)*
3. tray Token → tile places a Token *(the control case, and CR2-044's route)*
4. vault → tray mini-board *(catches CR2-127 and CR2-160's drift)*

Write it before Wave 1, because Wave 1 *is* the drag fixes.

### Step 3 — restore, targeted at the fix waves (1 sitting)

In priority order, each row justified by the wave it protects:

| Restore | Cases | Protects | Cost |
|---|---|---|---|
| `Cartographer.test.js` — Map buying, refusal-takes-nothing, Tray-not-Vault | 13 | The Cartographer is touched by CR2-052, CR2-063, CR2-114, CR2-163. Its refusal path is the one place a bug takes the player's gold and gives nothing. | Needs Map costs authored (CR2-114) — **or port onto `fixture_*` content** |
| `HeroSystem.test.js` — dock equipment grid | 9 | **CR2-040 destroys equipment-grid gaps on every load.** That fix has no net under it right now. | Needs 2 gear items — or fixtures |
| `MapBurst.test.js` — the burst band, single-use Maps | 9 | CR2-158 (single click bursts a Map) is an owner decision about this exact behaviour; changing it blind is how the band breaks. | Renamed ids + Map pools |
| `TokenGroups.test.js` — Vault tab cap | 1 | Decide 15 or 20 first (open question in the ledger), then assert against `TOKEN_TAB_CAP`, not a literal. | Trivial once decided |
| `Market.test.js` — the 3× guard rail | 1 | A real balance question, not a test bug: code gives 34 against a limit of 30. **Answer it deliberately** — this is the only economy guard rail the suite has. | Owner decision |
| `TokenChargeBadge.test.js` — lift on progress | 1 | Only if the lift-on-progress behaviour is still wanted; the badge was re-anchored during the dock move. | Rewrite against current anchoring |

**The lever that makes this permanent:** port the restored cases onto `fixture_*`
content the way `AdjacencyEffects` and `TriggeredTokens` were rescued in
`8935468`. Tests written against authored content break every time the CMS
re-authors; tests written against fixtures never do. **But note CR2-004** —
fixture insulation is currently *partial*, and the fixtures deliberately register
ids the real content lacks, which is precisely why the suite was green while
combat dropped no loot. So: **fixtures for mechanics, the CR2-108 walk for
content.** Neither substitutes for the other.

### Step 4 — the two suites to leave alone for now

- **`Promotion.test.js`'s 2 skipped cases** are acceptance criteria for a
  feature that is **not built** (promotion past tier one). Leave them skipped;
  they are the specification. Un-skip when it lands.
- **`ContentRules.test.js`'s 16 skipped completeness rules (CR2-005)** stay
  skipped until content authoring settles — *except* the CR2-108 walk in Step 1,
  which is a different kind of assertion. ⚠ Two of its *un-skipped* cases pass
  **vacuously** (the `OPENING_TRAY` rule short-circuits on `?.` when the Token
  does not exist — which is why CR2-044 was green). Fix those two while you are
  in the file; a vacuous pass is worse than a skip, because it looks like cover.

### Total

**Roughly 2½ sittings**, and it should be spent before Wave 1, not after.

---

## ⭐⭐ THE FINAL BACKLOG

**This is the document to come back to.** Everything above is evidence; this is
the plan.

### First, the honest headline

The owner asked this review to hunt for **spaghetti** — tangled dependencies,
copy-pasted code, files that cannot be understood alone. **The tooling looked
for exactly that and did not find it.** Across 228 files and 1,049 imports there
are **zero dangerous import cycles**; duplication is **0.45% of lines**; the
engine tick runs at **0.159 ms against a 5 ms budget** with 12 heroes on a full
49-tile board; memory is **flat over 40,000 ticks** (+0.25 MB, subscription count
identical at both ends). **The architecture is sound and the engine is fast.**

What eight sessions found instead is different, and in one respect worse:
**things wired up at one end only.** Nothing errors. Nothing fails a test. The
code reads as intentional. A table of player-facing warning explanations that
nothing displays. A hero dock that advertises a drag it cannot perform. Eleven
settings controls that store a value nobody reads. Five separate systems that
accept a reference to content that does not exist and say nothing. **Eight
documented cases of a confident comment describing machinery that is not there**
— one of which reached the decision log with two decision numbers attached.

**182 tickets: 5 already fixed, 2 moot, 175 open — 38 P1, 80 P2, 57 P3.**
The good news is the shape of that list: **158 of the 175 are effort S (under an
hour)**. This is not a rewrite. It is a very long list of small, mostly obvious
reconnections, and the plan below sequences them so the early ones make the
later ones cheaper.

---

### WAVE 0 — Turn the linter on *(30 minutes — do this before anything else)*

**CR2-129**, plus the two config lines and four one-liners in **CR2-184**.

Everything else in this backlog costs less after this. The linter has been
running with **6 rules instead of ~40** because of one misplaced spread in
`eslint.config.js`. Turning it on is what found three of the review's crashes
(CR2-126/127/128) — Session 6 found them by fixing the config, not by reading
code. Every fix wave after this gets a working "did I just break something"
check that currently does not exist.

*Leverage: this is the single highest ratio of value to minutes in the review.*

---

### WAVE 1 — A new player can actually play *(1 sitting)*

**Nothing in this backlog outranks this.** Session 8 started a genuinely fresh
save and established that **the game cannot be played from a new game**:

- **CR2-153** — a hero cannot be dragged out of the dock. `HeroDockTab` spreads
  `drag.dragHandleProps`; the hook returns `handleProps`. The drag listeners are
  never attached. Since the only other way to start a hero drag is *a hero
  already on the board*, the core loop cannot be started. **The fix is one
  word.** Recommend re-grading to **P0**.
- **CR2-044** — the four Tokens a new game puts in the tray name ids the content
  set does not contain. They render as **blank squares** and `Placement` refuses
  them with "Not a valid Token", silently. The game's own tutorial quest
  ("drag a Token to the playmat") is impossible with what it hands you.
  Recommend **P0**.
- **CR2-126** — `EventBus` is used five times in `TokenVaultTab.jsx` and never
  imported. Every Vault deposit and quick-add **throws**. Confirmed at runtime.
- **CR2-128** — `<GhostCardFrame>` is rendered in `DragGhost` and defined
  nowhere. Dragging an Item over the board throws inside the drag overlay.
- **CR2-179 + CR2-183** — the playmat is a hard-coded 944 × 944 with no scaling.
  At 1366 × 768 the top row is off-screen; at 1600–1728 wide the Tray sits over
  the right-hand column **and steals its drops**, so a Token dropped there goes
  into the Tray chest instead — a plausible wrong outcome, not an error. **And
  the Tauri shell opens the game at 1600 × 1000 by default, with a 1024 × 700
  minimum** — the broken band, out of the box. ⚠ **This one needs the owner's
  decision before it can be fixed** (scale-to-fit vs. declare a minimum size);
  the options are in CR2-179.

Then the four that make the first ten minutes coherent, all effort S:
**CR2-154** (the pinned hero card can never open — one rename, and it unlocks
the skills grid, the equip drop zone and 22 already-written tests),
**CR2-157** (both docks' recall drop is a silent no-op — it calls
`engine.Placement`, which does not exist, and a retired system),
**CR2-155** (three of six tile alerts fall through, so an under-levelled hero
gets a normal working countdown and no warning at all),
**CR2-130** (`ui:notify` has no subscriber — promotion, retirement and Bank-sale
messages are all silent).

*Leverage: after Wave 1, someone other than the owner can play the game and
report bugs. Until then, external playtesting is not possible.*

---

### WAVE 2 — Stop content failing silently *(1½ sittings)*

**One fix answers five separate tickets.** This is the systemic theme of the
whole review: five different systems accept a reference to content that does not
exist, and every one of them shrugs.

**CR2-108, all three parts, in order** *(owner already ruled: **warn only**,
never block)*:
- **(a)** a ~80-line boot-time walk that logs every unresolvable id once, in one
  grouped message. The reference kinds are enumerated in the ticket. A prototype
  found 8 dangling references in `data/` in under a second.
- **(b)** the same walk as an **un-skipped** test (Step 1 of the coverage plan).
- **(c)** a `logger.warn` at the four places that currently swallow —
  `LootSystem.js:203`, `SpriteLayer.addSprite`, `Placement.placeToken`,
  `TokenBank.deposit`.

**It closes or de-fangs**: CR2-011 (an enemy's only drop names an item that does
not exist — 12 kills, zero loot), CR2-063 (two more board entry points accepting
unresolvable ids), CR2-084 (**every hunt bounty in the game is impossible** —
the pool names creatures that do not exist; the owner ruled this one stands as
filed), CR2-120 (saves keep pointing at renamed content), CR2-181 (a broken
Token shows the player its raw internal id as its name), CR2-044's second half.
Also close **CR2-002** (verified false positive — fix the test, not the content).

*Leverage: this is the difference between "a content typo is a five-second
console message" and "a content typo is a two-session investigation". It has
already cost this project at least four investigations.*

**Then the content itself — but this is the owner's job, not a fix session's.**
These are not bugs; they are things nobody has authored yet, and no code change
helps: **CR2-109** (no Token awards skill XP, so six Foundation skills can never
level — this is what makes CR2-072's skill-speed fix invisible), **CR2-110**
(no Token is typed `enemy`, so combat cannot happen — **parked by decision**),
**CR2-111** (`data/tokenRecipes.json` is `{}` because the CMS never writes recipe
pools out), **CR2-112** (a shipped Token description reads "NaN% Speed"),
**CR2-114** (the Cartographer sells exactly one Map, "Test Map", for 1 gold),
**CR2-122**, **CR2-123** (two Tokens do nothing at all).

---

### WAVE 3 — Remove the retired systems still wired in *(2 sittings)*

Four reworks and a demolition day left residue that is still *connected*. The
owner has already decided most of this; it is now mechanical.

**Decided deletions** (owner decisions 6, 7, 10):
**CR2-086** retirement + recruit-purchasing (delete `RecruitCostCalculator`,
`RetirementFormula`, `retireHero`, the retire control, the covering tests — and
then **close CR2-071 as moot**, since a retired hero cannot leave a stale board
entry if retirement does not exist); **CR2-093** Influence; **CR2-096** item
durability; **CR2-113** `scripts/regenerate_game_package.js` — *the dangerous
one*: if it were ever run it would overwrite the current content set with
card-era shapes and resurrect `data/quests.json`. Deleting it is what finally
closes the "Sync to Game destroys unmodelled content" hazard; **CR2-118**
`data/schemas/` + `data/templates/` + `data/archive/cards/`.

**Dead modules and dead exports** — all effort S, all confirmed by two
independent checks: **CR2-090** (`InventoryGroupManager`, registered on the
engine, called by nothing), **CR2-091** (`ProgressionSystem`, a whole named
system kept alive by a false comment), **CR2-116** (a retired drop-table registry
still in the live loot path), **CR2-117** (18 hardcoded card-era enemies merged
into the live enemy set beside the 4 real ones), **CR2-077** (45 of 70 lines of
`handleVictory` are card-era branches that can never run), **CR2-099**
(15 of 16 exports in `config/constants.js` dead, four of them contradicted by
the live value elsewhere), **CR2-100**, **CR2-012**, **CR2-013**, **CR2-065**,
**CR2-078**, **CR2-082**, **CR2-088** (five `QuestManager` subscriptions listen
for events nothing publishes), **CR2-092** (ten events published to nobody),
**CR2-136**, **CR2-137**, **CR2-144**, **CR2-147**, **CR2-119**, **CR2-014**,
**CR2-019**, **CR2-032**, **CR2-083**, **CR2-102**, **CR2-103**.

**Retired vocabulary still in render paths**: **CR2-125**, **CR2-039**,
**CR2-173**, **CR2-001** (Tokens carrying an empty `theme`) — `theme` is the
concept the audit ruled **NOT REAL**, and it is still being printed on screen.

**Comments that describe machinery that is not there** — **eight documented
cases**, and they are the most expensive line in this backlog per byte, because
every one of them will mislead the next reader the way they misled this review:
**CR2-081**, **CR2-066** *(decided: fix the prose, keep the behaviour)*,
**CR2-158** *(a single click bursts a Map, contradicting D-142 and the comment
two lines above it — ⚠ needs the owner to say which is right)*, **CR2-039**,
plus the ones folded into the tickets above. **Rule worth adopting: when a fix
wave touches a file, the comment is part of the change.**

*Leverage: everything after this is being done in a smaller, more honest
codebase. Do the deletions before the reconnection work in Wave 4, or Wave 4
spends its time reconnecting things that should not exist.*

---

### WAVE 4 — Finish the half-wired features *(3 sittings — the biggest wave)*

This is the review's primary objective and the largest group. Roughly 45
tickets, nearly all effort S; the sitting count comes from volume, not
difficulty.

**Controls that do nothing when pressed**: **CR2-131** (11 Settings controls
change a stored value nothing reads — owner decided: fix seven, give the four
unbuilt ones a **visible but disabled "coming soon"** state), **CR2-133** (all
three Dev Tools buttons publish to nobody), **CR2-143**, **CR2-138**,
**CR2-167**, **CR2-170**.

**Built and unreachable — restore** *(owner decision 9)*: **CR2-154** (already
in Wave 1), **CR2-132** (the loot-table screen — nothing else in the game shows
a drop table; five of `useUIModals`' seven subscriptions have no publisher, and
270 lines hang off them), **CR2-035** (`ToastContainer`'s collapse, whose button
was *removed*, not never built). **Not restored: CR2-161** — retire the Bank's
pre-filtered open instead.

**Values computed and thrown away, or shown wrong**: **CR2-036** (the lint
residue catalogue — 34 sites, distributed into CR2-152, CR2-171, CR2-156,
CR2-162, CR2-166, CR2-167), **CR2-156** (`ALERT_HINT` — six player-facing
explanations of the red warning marks, defined and read by nothing; D-114 looks
implemented and is not), **CR2-162** and **CR2-163** (the Bank and the
Cartographer each fetch the player's gold and display neither), **CR2-165**
(the hero sheet hides banked skills entirely — owner: show them **with their
levels**), **CR2-159**, **CR2-164**, **CR2-166**, **CR2-172**, **CR2-175**,
**CR2-046**, **CR2-047**, **CR2-055**, **CR2-177** (the Tray subscribes to an
event named `undefined`), **CR2-097**.

**Rules living in React components** — the sharper version of the layer rule,
learned from CR2-033: **CR2-134/CR2-146/CR2-169** (the Vault deposit rule exists
in **five** copies across components; CR2-033 moved the event but not the rule,
and the matching *withdraw* publishes were left behind, latently double-counting
a quest), **CR2-160** (`TrayMiniBoard` is a partial second copy of the board's
drop handler that lies about 2×2 occupancy), **CR2-051** (the engine imports
from the UI), **CR2-094**, **CR2-104** (the board's geometry defined twice).

**Gameplay reconnections the owner has already ruled on**: **CR2-072** (skills
should make a hero faster — currently no consumer exists *and* the producer
files it under a key no reader could match), **CR2-073** (XP bonuses name an
effect type that does not exist), **CR2-070** (poison death must cost equipment
like combat death — after the zero-health bug itself is fixed), **CR2-079**
(consumable slots currently only *cost* the player and never fire — fix, do not
cut), **CR2-087** (**the kill counter has no callers**, so the data being banked
for the planned Codex screen is wrong — decision 15 says fix this *before* the
screen is built), **CR2-098** (keep collecting), **CR2-085**, **CR2-089**
(creating a Bank tab is impossible), **CR2-057**, **CR2-058**, **CR2-060**,
**CR2-069**, **CR2-075**, **CR2-076**, **CR2-080**, **CR2-135**, **CR2-151**.

---

### WAVE 5 — Saves, and the desktop build *(1½ sittings)*

**Save correctness** — do these before any external playtest, because they
damage data the player cannot get back: **CR2-040** (**a hero's equipment is
silently re-packed to the front of the grid on every load**, destroying
deliberate gaps — confirmed through the real load path), **CR2-042** and
**CR2-043** (the declared schema and its validator describe the *previous*
game), **CR2-023**, **CR2-049**, **CR2-041** *(decided: bank the excess time
rather than discard it)*, **CR2-120**.

**The desktop build**: **CR2-183** (window size — with CR2-179), **CR2-187**
(no Tauri file API installed, so **CR2-045's "wait for Tauri" is waiting on work
nobody has scheduled**; plus `csp: null` and an installer description that
advertises retired invasions), **CR2-185** (the asset audit — start with the
314 KB vendor demo reel, then re-encode the **4 MB** BGM track, then move ~1.4 MB
of retired-system backgrounds out of `public/`), **CR2-048** (the boot gate waits
on the retired area banners and does **not** wait on the playmat or the Tokens),
**CR2-186**, **CR2-124**, **CR2-145** (the Settings screen prints `v0.9.0`; the
real version is 0.6.0 and **all five version files agree** — this is a one-line
fix, not a version-bump job).

---

### WAVE 6 — Engine hygiene and the measured performance notes *(1½ sittings)*

Nothing here is urgent — the engine is 30× inside its budget — but these are the
places where load will land first if the board or the roster grows:
**CR2-056** (collecting loot publishes ~8 events per sprite; a sweep produced
**320 events in a single tick**), **CR2-062** (asking "what is on this tile?"
costs a full board scan), **CR2-061**, **CR2-139** (a hook's dependency list is
rebuilt every render, so the effect runs every render of every consumer),
**CR2-140**, **CR2-168** (Session 8 measured these five: **two matter, three do
not** — read its verdict before touching them), **CR2-028**, **CR2-027**,
**CR2-105**, **CR2-107**, **CR2-142**, **CR2-095**, **CR2-101**, **CR2-106**,
**CR2-188**, **CR2-004** (finish the fixture insulation), **CR2-010** (the CMS
imports seven modules straight out of the game's `src/` — a boundary nothing
enforces and no test covers).

---

### What I would NOT do

With 175 open tickets, the ones not worth doing are as useful as the ones that
are. **Do not schedule these:**

1. **The entire audio family — CR2-016, CR2-021, CR2-180, CR2-022, CR2-178, and
   the audio rows inside CR2-131.** Owner has deferred audio; these are correct
   findings about a subsystem that is not being built. They are already P3.
   ⚠ When audio *is* picked up, read **CR2-021 first**: one bulk level-up
   produced **1,388 sound requests, roughly two in three aborted**. The pool
   design needs revisiting before more sounds are added — not after.
2. **CR2-007 — do not wire `EventBatch`.** Session 8 measured it: `useGameState`
   already coalesces per subscriber via `queueMicrotask`, and a 160-event burst
   produced **exactly the same single DOM mutation** as one event. Close the
   ticket with the measurement attached. Delete `EventBatch` or comment why it
   is kept.
3. **CR2-050 — refuted.** `BOARD_PX` is a compile-time constant, so sprite
   coordinates cannot drift across a resize. Close it.
4. **CR2-127 — refuted as player-facing.** The crashing branch is unreachable
   dead code (the drawer covers the board by design, D-107). Delete the branch
   in Wave 3; do not treat it as a bug to fix.
5. **CR2-052, CR2-053, CR2-085 — the quest double-counting.** Owner: *"It's a
   tutorial meant to be completed within the first minute."* All four affected
   counters belong to quests that ask for exactly one, so the ceiling is hit
   before the doubling shows. Tidy them if the surrounding code is touched;
   never as their own job. ⚠ **This does not extend to CR2-084** — hunt bounties
   are generated, not tutorial, and that one stands.
6. **CR2-141 — the Time Bank stays off**, and with it the premise of CR2-095 and
   the `ItemRateTracker` item in CR2-036 is currently false. Re-check them if
   the Bank ever returns; do not fix them now.
7. **CR2-150** — explicitly not a bug; recorded so nobody files it as one.
8. **The four dev surfaces** (`TestDashboard`, `FPSCounter`, `DevSpawnItemModal`,
   `LayoutSandbox`) — owner ruling Q5: intentional tooling, they never render in
   a production build. **No session should propose deleting them.** CR2-147 is
   about their *residue*, not about them.
9. **Do not restructure anything.** Zero dangerous cycles and 0.45% duplication
   mean there is no structural problem to solve. If a future session proposes a
   refactor, it owes evidence that the current structure causes a problem —
   "it's big" is not evidence. The one cluster the tooling flags (16 modules held
   together by two lazy imports in `GameState`) was examined independently by
   Sessions 1, 3 and 9 and all three said **leave it**.
10. **Do not delete `nameRegistry.js`** (barrel-only but genuinely live — it
    names every hero), **`tokenType`** (four engine paths branch on it), or
    anything in **`public/assets/items/`** and **`tokens/`** on the strength of
    CR2-185's orphan list.

---

### How big is this, honestly

| Wave | What it buys | Sittings |
|---|---|---|
| 0 — lint config | A working safety check for every wave after | ¼ |
| Coverage restoration | A net under the fix waves, and a drag harness | 2½ |
| 1 — a new player can play | External playtesting becomes possible | 1 |
| 2 — content integrity | Content typos stop being investigations | 1½ |
| 3 — remove retired systems | A smaller, honest codebase | 2 |
| 4 — finish half-wired features | The game does what its UI says it does | 3 |
| 5 — saves and the desktop build | Ships without losing data or clipping the board | 1½ |
| 6 — engine hygiene | Headroom, not urgency | 1½ |
| **Total** | | **~13 sittings** |

**That is not a weekend.** At one sitting per session, this is several weeks of
evenings — and it does not include the content authoring in Wave 2, which is the
owner's own work in the CMS and is the thing that actually makes the game
playable past the first minute.

**But the shape is good.** 158 of the 175 open tickets are under an hour each.
There is no rewrite in here, no architectural surgery, and no performance
project. It is a long list of small reconnections in a codebase whose bones are
sound.

**If only three things get done, do these:** Wave 0 (30 minutes), CR2-153 and
CR2-044 (a fresh save becomes playable), and CR2-108(a) (broken content starts
announcing itself). That is well under one sitting, and it changes the game from
"cannot be started" to "can be played and will tell you when something is
wrong".

---

### Still needs the owner — nothing can proceed on these without a decision

1. **CR2-179 / CR2-183 — how the playmat handles small screens.** Scale to fit
   *(recommended)*, or declare a minimum window size and tell 1366 × 768 laptop
   owners the game will not run. Wave 1 is blocked on this.
2. **CR2-158 — does a single click burst a Map, or does D-142 stand?** The code
   and the comment two lines above it disagree.
3. **`Market.test.js` — is a Market now meant to pay above 3× its inputs?**
   Code gives 34 against a limit of 30. It is the only economy guard rail the
   suite has, and it is currently deleted rather than answered.
4. **The Token Vault tab cap — 15 or 20?** The code says 15, the deleted test
   said 20.
5. **CR2-006 — the CMS's missing tests.** Options A/B/C above; A recommended.
6. **CR2-009 — the 44 root markdown files.** 30 minutes, and only the owner can
   do it. Worth doing *before* the fix waves, so fix sessions are not briefed off
   retired documents the way three review sessions were.
7. **CR2-031** — toast elements stranded at `opacity: 0`. Two sessions tried and
   could not test it; `AnimatePresence` exits never complete in this harness.
   **This one needs your eyes in a real browser.**
8. **CR2-045 / decision 17** — "wait for Tauri" for save backup. CR2-187 shows
   the wrap has none of the file machinery yet. If the wrap slips past the first
   external playtest, an hour of clipboard-based export removes the whole risk.
