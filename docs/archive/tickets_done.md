# Closed tickets

One line per closed ticket from [`docs/reference/TICKETS.md`](../reference/TICKETS.md):
`T-NNN — summary — commit — date`. Newest at the bottom.

Before the T- system (2026-10-06): code review round 3's closed tickets are
recorded in `docs/archive/review_v3/` (run log and session summary).

T-004 — Re-save the engine bench baseline on a quiet machine — chore/p3-baseline — 2026-10-07
T-003 — Owner ran the certification checklist; results in docs/reference/PERFORMANCE.md — docs/certification-results — 2026-10-07
T-034 — A quick flick lands short of the cursor: not reproduced by the owner (C3), it lands where released — docs/certification-results — 2026-10-07
T-044 — Old pinned-card dock deleted — hygiene W3 — 2026-10-07
T-054 — Unused stylesheets deleted (whole files and unused rules) — hygiene W3/W5 — 2026-10-07
T-067 — Tombstone skipped tests deleted — hygiene W2 — 2026-10-07
T-096 — data/stations.json deleted (owner OK) — 26a434c9 — 2026-10-07
T-005 — Atlas work in progress parked on branch atlas-wip (owner) — aecd7bda — 2026-10-07
T-006 — The two edited map images parked on branch atlas-wip (owner) — 6f104f61 — 2026-10-07
T-001 — Foundation art set, Copper Rubble deleted, Copper Ore valued from Copper Ore Vein (the Stone item still shows token_ore_loose art) — e3f32fa8 — 2026-10-07
T-002 — All Maps and Map Tokens deleted, Oak Forest included — e3f32fa8 — 2026-10-07
T-109 — Tests updated for the deleted Copper Rubble and Maps; suite fully green — fix/t109-content-tests — 2026-10-07
T-104 — A closed hero sheet unmounts after its fade, so its slots stop catching mat drops — 3d34d565 — 2026-10-07
T-101 — Binned Tokens count toward their spawner's family cap until discarded — b1cdf9b7 — 2026-10-07
T-112 — Heroes stand further from their target (STAND_GAP 16 → 32) so fight bars clear — a7556703 — 2026-10-08
T-102 — Token cap 80 as a game value, spawned Tokens count, spawners wait at a full mat — bf3668d4 — 2026-10-08
T-099 — Passive Production: one 5-minute timer, Wishing Well 10 × rank Water, trickle renamed for players — d15bd6c3 — 2026-10-08
T-107 — Alert marks blocking presses: the marks were removed in brief 10 U3 — 36ae8cbd — 2026-10-08
T-066 — CMS-importing tests run in a worktree once both node_modules are junction-linked; docs fixed, no code change — chore/max-plan-tiers — 2026-10-08
T-113 — Brief 20 R1 bench work change (heroHash only: logging to forestry, explore gone) accepted and merged — crunch/class-rework — 2026-10-08
T-044 — Remnants removed: the unused dock pin and body-view state in useUIModals with its test, HeroDockTab's ignored props and dead horizontal layout, the stale Promotion test comments (the two components themselves went in hygiene W3) — crunch/hero-ui — 2026-10-08
T-085 — Loot timing (absorb, auto-collect age) and the other wall-clock rules read the game clock, which follows a catch-up's steps — 234de597 — 2026-10-08
T-080 — Time Bank fast-forward cost: the Time Bank is removed, replaced by the offline catch-up (brief 40 O4) — crunch/offline — 2026-10-08
T-120 — The hero bar shows the level-ups a catch-up produced (load, sleeping PC or background tab); a sleeping PC's catch-up no longer wipes unread bubbles — fix/catch-up-bubbles — 2026-10-08
T-024 — map_burst / map_opened double count: the Map burst code no longer exists (only a comment names it); found stale by the Atlas roadmap — chore/atlas-roadmap-bookkeeping — 2026-10-09
T-025 — buyMap ignores sourceRect: buyMap no longer exists; found stale by the Atlas roadmap — chore/atlas-roadmap-bookkeeping — 2026-10-09
T-123 — The drag and draw benches' dev server keeps its Vite cache per checkout (node_modules/.vite-bench-<checkout>-<hash>), so worktrees no longer share one — crunch/drag — 2026-10-08
T-105 — A hero's see-through pixels no longer block a flag or Token behind: the press is routed at the press itself, and left-facing heroes are tested where drawn — crunch/drag — 2026-10-09
T-106 — Flags that grabbed a Token or would not grab: the bench measured Token bodies by their bigger art box and pressed bubbles or neighbours drawn over the flag (it now follows the game's press rules); a flag wholly over Token bodies could not be grabbed (its cloth now takes the press where drawn in front); the mat no longer scrolls 30 px under the top bar — crunch/drag — 2026-10-09
T-130 — A flag lying wholly over a Token is grabbed by its cloth; the owner felt the drag and kept the rule (2026-10-09) — crunch/drag — 2026-10-09
T-129 — A Token in your hand is paused (owner 2026-10-09): no work, fight or charge removal until it is dropped, then it resumes where it stopped — crunch/t129 — 2026-10-09
T-110 — The old Map code is retired: the Map catalogue (`mapRegistry.js`, `data/maps.json` loading), its audit and `mapId` type rung, the CMS Map editor's burst pools and the simulator's Map check; maps are items now (Atlas A5) — crunch/atlas-a5 — 2026-10-09
T-014 (the opening half) — A new game's Tokens and Bank are content: the Starter Camp, laid out in the game, saved from the QA panel and synced from the CMS's Starter Camp page into data/starterCamp.json; the quest half stays open — crunch/atlas-a7 — 2026-10-09
T-131 — The tutorial beacon no longer looks for or measures its target every frame: it looks ten times a second on the shared step clock and follows a moving target every frame only until it stands still (brief 60 P2-2) — crunch/p2-2 — 2026-10-10
T-009 — Shop price format ruled: ribbon rows where items are listed with room (the Shop), pills inside buttons such as the Hall's Upgrade, costs read have/need with the count red when short (UI_STYLE "Item references") — planning — 2026-10-13
T-095 — The Plant a Flag beacon's dead selectors replaced: it points at the hero bar (data-dock-hero), checked against today's page — crunch/atlas-a8 — 2026-10-13
T-144 — Every tutorial beacon re-pointed at today's page attributes; TutorialAide.test.js's fixture mirrors the live page and is checked against the components — crunch/atlas-a8 — 2026-10-13
T-115 — Log an Oak Tree left with the old tutorial chain; the promotion line names its gate skills (Requires Mining and Fishing at level N) — crunch/atlas-a8 — 2026-10-13
T-145 — Tokens twitched and went soft: any compositor-run animation on the mat (a -1 floater, a landing hop, a flash, a spawn, a walking enemy) split the Tokens drawn after it onto layers Chrome draws resampled; the hidden name labels' drop shadows did the same at rest. Each animation among the resting Tokens carries will-change: contents (the whole mat on the main thread cost a third more frame work) and a hidden label is invisible; guarded by MatPixelLayers.test.js and npm run bench:crisp — fix/t145-twitch — 2026-10-14
T-117 — The desktop app kept drawing while minimised (WebView2 is never told): the Tauri side forwards minimise and restore to the page, which with a hidden page's visibilitychange pauses the mat's frame clocks; the game's tick keeps running; guarded by DrawingPause.test.js — crunch/p2-10 — 2026-10-14
T-152 — Drawers close each other: the Bank, Shop and Work Rules drawers are one at a time (panels and modals unchanged) — fix/t152-drawers — 2026-10-14
T-182 — Guard test for content ids named in src/ (ContentIdsInCode.test.js): every item_/token_/map_ literal must exist in data/ or sit on a short reasoned allow-list — fix/t182-id-guard — 2026-10-14
T-158 — A Token's callouts stack on top of its working hero's speech bubbles in one column instead of covering them — fix/t158-bubbles — 2026-10-14
T-153 — The gear alert no longer pulses, scales or glows: a one-art-pixel gold outline (four masked copies of the gear, one art pixel off) whose colour steps between two golds; guarded by GearAlertOutline.test.js — fix/t153-gear-alert — 2026-10-14
T-146 — Animated sprite outlines get one art pixel of room past each frame (padded outline cells, outline drawn outside the frame crop) — a5ba92c4 — 2026-10-14
T-148 — The Guild Hall is movable again (drags, carries the marker; never pushed, never off the mat, never demolished) — dcefcf89 — 2026-10-14
T-147 — Hover is the 1-art-pixel white outline alone; the hover hop and A10's lift are gone — 095420e0 — 2026-10-14
T-179 — The Studio: `npm run studio` (port 5175) runs Recolor and Animation as two tabs on a server that refuses the game-data routes; the tabs left the CMS top bar; palette drop folder `cms/palettes-inbox/` with an Import button in the Recolor tab (brief 85 A3) — crunch/art-a3 — 2026-10-15
T-185 — The dev server redraws sprite shadows and outlines in a child process (killed on close or restart) and no longer watches the other sessions' worktrees under .claude/worktrees (main checkout: 211,296 → 6,276 watch handles, 2.0-2.4 GB → under 0.7 GB, full redraw 31.6 s → 5.7 s); the 0xC0000409 itself was not reproduced — 0cfcdf1e — 2026-10-15
T-180 — Vibrancy pass: art baked at Gentle 1.08 / 1.12 by the brightness script (tag art-before-vibrancy); the Studio button brightens the material palettes the same way, once — dfb17ac2 — 2026-10-16
T-183 — Floor loot lands on its spot and draws crisp; piles no longer jump into stacks — 6a961f28 — 2026-10-15
T-184 — The dev panel's Scatter Loot button throws real items — bf57730c — 2026-10-15
T-188 — Sync to Game lists the content it would remove or bring back and asks first, offering Restore from Game — 1873d62f — 2026-10-17
T-190 — The event-publisher scan test gets a 20 s timeout (slow only under load) — 2a6ee4d9 — 2026-10-17
T-159 — The style sheet page (QA → Style Sheet): every standard UI piece live, shared and new-unapproved groups; colour meanings as CSS variables — 3016df8b — 2026-10-18
T-160 — One shared arrow-bar scroll list (ArrowScrollList) for the Shop, Inspect column, Token pop-up and Guild upgrade ranks — 3016df8b — 2026-10-18
T-161 — Title/body/small/display text-size classes reading the Text size setting (panels move onto them as touched) — 3016df8b — 2026-10-18
T-164 — Work Permissions: launcher, square centred cells, one Combat column with priorities, purpose tooltips — 3016df8b — 2026-10-18
T-156 — Hero panel tidy: Requires <class> on locked skills, Work Rules link gone, close X at sprite size — 3016df8b — 2026-10-18
T-177 — The level-up moment: icon and rolling number above the hero, side by side, after time away — 3016df8b — 2026-10-18
T-149 — Hero bar alerts read [level] [skill]! with wheel paging and pixel arrows — 3016df8b — 2026-10-18
T-178 — The shine on Upgrade and Settle (refinement in T-191) — 3016df8b — 2026-10-18
T-165 — Starter Camp Tokens are fixtures: no drag, push or demolish; the dev layout tool lifts them — 3016df8b — 2026-10-18
T-166 — Demolish mode beside Disallow mode: banners, mode outlines and cursors, protected Tokens dim with the reason, shift-click a type, Cancel all marks — 3016df8b — 2026-10-18
T-170 — Top bar restyle: studded pixel frame, Region name, Tokens and Upkeep item bars, mode banner, toggles — 3016df8b — 2026-10-18
T-167 — Everyone fights: a Recruit fights as level 1, no combat XP until promotion; hostiles watch the flag, the same on every side (work change accepted) — 3016df8b — 2026-10-18
T-169 — The recipe list inside the Token card (brief 130) — 9fa5572e — 2026-10-20
T-142 — Recipe rows no longer truncated (absorbed by T-169) — 9fa5572e — 2026-10-20
T-168 — Notifications: item stubs and banners, no log (brief 150; log is T-193) — 9fa5572e — 2026-10-20
T-028 — Toast types and merged counts: superseded by item stubs and banners — 9fa5572e — 2026-10-20
T-037 — Two ways to hide notifications: one item-stub switch in Settings — 9fa5572e — 2026-10-20
T-192 — Flaky loot-landing test: zero offsets compared with toBeCloseTo (-0 vs +0) — 2aa314e8 — 2026-10-20
T-172 — The Atlas as a tome: the owner's 256 px pages at 4x, pop-up from the bottom, ribbons and page turn, Cartography over both pages with drag to slot — 5f3c3e0d — 2026-10-20
T-173 — Region rows on area banners, Travel and the … menu, CMS banner pick with a default by biome, top bar slice, arrival card, preview backdrop — 5f3c3e0d — 2026-10-20
T-174 — Camera move to the Atlas: built, then set aside by the owner for the Guild Hall upgrade screen (T-194, tag atlas-camera-move) — 5f3c3e0d — 2026-10-20
T-133 — CMS change packs: autosave, inbox, per-entry review with conflicts and undo; first pack the starting maps — 1b6c55af — 2026-10-20
T-125 — Skill work-speed bonus removed in game and simulator (owner Recalculate + Sync follows) — d96e5912 — 2026-10-20
T-098 — Hero energy removed; drinks heal like food below 25 % HP — d96e5912 — 2026-10-20
T-017 — Kill loot follows the yield, double-loot and bonus-drop rules (shared OutputRules) — d96e5912 — 2026-10-20
T-022 — Rate trackers cleared on load and new game — d96e5912 — 2026-10-20
T-023 — GLOBAL_COMBAT_XP_MULTIPLIER deleted (unused, 1.0) — d96e5912 — 2026-10-20
T-018 — Closed as obsolete (owner 2026-10-20: the R3-Q1 ruling predates the current game; tools become hero gear, T-126) — d96e5912 — 2026-10-20
T-139 — 56 sprite-manifest entries with no file and no reader removed; item_dough/flour/wheat kept — e5169a69 — 2026-10-20
T-045 — Dead combat and wound code: combat.stats, fight._rev, write-only attack-speed fields, unused WoundedSystem helpers, LootSystem.previewDrops (thorns branch kept as the hook for enemy traits) — f60df7ef, 47e6cfa9 — 2026-10-20
T-046 — Roster upgrade recruits through HeroLifecycle.createHero — 97d09796 — 2026-10-20
T-047 — Eight retired collection fields dropped from the save schema — 00bd274e — 2026-10-20
T-048 — Listeners with no publisher and the dead ui:open_drawer chain removed (Bank type filter, View in Item Bank) — 405ab3da — 2026-10-20
T-049 — Already done: triggersOf, hasUpkeep, resetNotices gone; SpawnerSystem.resetAlerts runs on BOARD_SWAPPED; starvation stats kept for tests — no commit — 2026-10-20
T-050 — Stale board-state comments corrected (whole-number centres, Cartographer, Displacement) — d160d6af — 2026-10-20
T-051 — Placement and HeroMotion use MatCap.isGuildHall and clampToMat — 32b87947 — 2026-10-20
T-052 — Dead drag CSS deleted; drag comments and dragConstants corrected (DeckDnd rename moved to T-056) — d4c783ab — 2026-10-20
T-055 — Equip-flash timer cleared when the grid unsubscribes, with a red-first test — f49d52d7 — 2026-10-20
T-061 — Inspection panel's unreachable Shop branches and ignored showSell props removed (cardSizeStore already gone) — ade2b55f — 2026-10-20
T-062 — statementText.js marker written as an escape, so git diffs the file — 1792b38e — 2026-10-20
T-064 — Dead clock surfaces removed per ruling A (TimeManager pause/game time, setTickInterval, forceTick, lastTickAt, time._rev, exploration); cardUseCounts left to T-108 — 12021521 — 2026-10-20
T-093 — Last stale survey comments fixed (QA level-up skill count, Card wording); the rest already read correctly — f00b2c03 — 2026-10-20
T-068 — Scrap folders (archive, maybe, waste) kept out of the build and the preload manifest — 29a4d8c7 — 2026-10-20
T-163 — useLiveDropTarget and the live drop-target registry removed — 1db1f197 — 2026-10-20
T-069 — Keeping it fast: 21 rules in PERFORMANCE.md, each checked against the code — 9a103fbb — 2026-10-20
T-070 — window.Game documented (WINDOW_GAME.md) with a guard test against the engine — 9a103fbb — 2026-10-20
T-124 — CREDITS.md: every third-party pack, licence and use (background music provenance is an open owner question) — 9a103fbb — 2026-10-20
T-118 — bench --cpu-prof keeps the engine thread profile — 9a103fbb — 2026-10-20
T-111 — bench/README: reading timing under load — 9a103fbb — 2026-10-20
T-065 — Fixture items renamed fixture_* (bench fingerprint change accepted) — 48fd719c — 2026-10-21
T-020 — Three UI-copied rules moved to the engine; refusals on screen (Disallow: "No hero works this") — 48fd719c — 2026-10-21
T-019 — EngineBootstrap.startSlot starts a game; CR3-100 test is the headless boot test — 48fd719c — 2026-10-21
T-015 — state_changed retired (one Atlas publish left, T-195) — 48fd719c — 2026-10-21
T-016 — A loot sweep sends one Bank update per item — 48fd719c — 2026-10-21
T-035 — A push moves only the newcomer's chain (work changed on S3, accepted) — 48fd719c — 2026-10-21
T-097 — Mat size and bounty numbers are game values; shipped builds have no Mat Tuner, Debug Mode or QA tools — 48fd719c — 2026-10-21
T-021 — One way into the engine: EngineProvider and useEngine deleted — 48fd719c — 2026-10-21
T-029 — One closing rule: Escape closes the top layer; click-outside closes light pop-ups only — fa214742 — 2026-10-21
T-030 — One shared tooltip (FloatingTip) — fa214742 — 2026-10-21
T-031 — One z-index table (--z-*) — fa214742 — 2026-10-21
T-032 — Typography window above Settings; Escape restores the preview — fa214742 — 2026-10-21
T-036 — One panel header with the red pixel X (CloseX, PanelHeader) — fa214742 — 2026-10-21
T-038 — Text sizes on the shared steps; dead font classes removed — fa214742 — 2026-10-21
T-039 — Plain words instead of sci-fi ones — fa214742 — 2026-10-21
T-040 — Rules text: "where this one stands", "a free spot" — fa214742 — 2026-10-21
T-041 — A new hero with no job reads Recruit — fa214742 — 2026-10-21
T-042 — Flying Items setting wording — fa214742 — 2026-10-21
T-121 — Slot playtime in the right unit — fa214742 — 2026-10-21
T-122 — Edit Hero has no duplicate skill sheet — fa214742 — 2026-10-21
T-134 — Bubble menu bar at whole-pixel scale — fa214742 — 2026-10-21
T-135 — Hit reactions move, never scale — fa214742 — 2026-10-21
T-191 — The shine covers the whole button — fa214742 — 2026-10-21
T-043 — Not reproducible (no duplicate key on a 4-hero, 35-Token load) — fa214742 — 2026-10-21
T-053 — Remaining nav-over-modal code removed — fa214742 — 2026-10-21
T-171 — The Guild Hall night sky: drifting layers, stars by state, constellations — fa214742 — 2026-10-21
T-128 — Hall web clipped, focus cannot scroll it — fa214742 — 2026-10-21
T-126 — Gathering tools are hero gear (hands, tier gates, Needs bubble, starter tools; content synced) — fa214742 — 2026-10-21
T-033 — Drag pauses: a page-wide restyle on every pickup and drop removed (~2,200 to ~300 elements); one mat commit on pickup — fa214742 — 2026-10-21
T-132 — A hero health bar counts as the hero for presses — fa214742 — 2026-10-21
T-187 — Drag bench presses flags at a clear point and names every miss — fa214742 — 2026-10-21
T-186 — Equipping by drop opens the hero sheet after the drop — fa214742 — 2026-10-21
T-143 — Drag bench skips fixed Tokens — fa214742 — 2026-10-21
T-137 — Code-only animation batch and tinted-copy effects — fa214742 — 2026-10-21
T-154 — A picked-up Token flies to the cursor — fa214742 — 2026-10-21
T-155 — World spawns hop out of their parent — fa214742 — 2026-10-21
T-215 — Bigger Token hitboxes: hitboxPct 80 → 90, overlap 40 (owner ok by phone) — 70e04760 — 2026-10-23
T-216 — Flag reach 164 → 240 with a crisp one-pixel gold ring over a hard shadow (owner ok by phone); enemies notice flags at the same reach, for combat planning — 70e04760 — 2026-10-23
