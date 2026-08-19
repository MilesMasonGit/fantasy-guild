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
| 3 | Combat, heroes, skills & promotion | ⬜ Not started | |
| 4 | Cards, economy, inventory, quests & progression | ⬜ Not started | |
| 5 | Content pipeline & the CMS boundary | ⬜ Not started | |
| 6 | UI ↔ engine boundary | ⬜ Not started | |
| 7 | UI components | ⬜ Not started | |
| 8 | Runtime verification (hands-on) | ⬜ Not started | |
| 9 | Build, Tauri readiness & synthesis | ⬜ Not started | |

**Next ticket ID:** CR2-070

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

### CR2-002 · P2 · S · Cleanup phase · Status: Open
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

### CR2-012 · P3 · S · Card retirement · Status: Open
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

### CR2-015 · P2 · M · Card retirement · Status: Open
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

### CR2-016 · P1 · M · Card retirement · Status: Fixed (2026-08-18, c48e2f8 — focus gate removed so combat SFX always play; dead `task_completed` subscription removed. ⚠ Verified by code path, NOT by ear — and `masterVolume` defaults to 0 as a dev mute, so the game stays silent until that slider is raised)
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

### CR2-021 · P3 · S · Card retirement · Status: Open
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

---

### CR2-041 · P1 · M · Session 1 · Status: Open
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

### CR2-045 · P2 · S · Session 1 · Status: Open
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

### CR2-053 · P1 · S · Session 2 · Status: Open
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

### CR2-066 · P3 · S · Session 2 · Status: Open
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
