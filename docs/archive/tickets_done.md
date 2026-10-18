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
