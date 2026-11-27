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
T-211 — Mat 12 by 6.5 steps (1920 x 1040), the owner's pick from four sizes; load and travel pull Tokens inside; bench boards pin their own mat — 484ba572 — 2026-10-23
T-212 — Top bar: the Region banner at 2x behind the name, fading right, no badge (owner ok by phone after one round) — cd9d2f2c — 2026-10-23
T-213 — Top bar: 76 px tall, Region name at display size, title-size text, 32 px icons — cd9d2f2c — 2026-10-23
T-214 — Top bar as wide as the mat; Tokens and Upkeep centred, a mode's warning takes the centre while on; Disallow and Demolish at the mat edge — cd9d2f2c — 2026-10-23
T-217 — While dragging, only cells a Token can't stand on are tinted (soft red); allowed cells clear; no canvas when nothing is forbidden (owner ok by phone) — af6b21c7 — 2026-10-23
T-218 — Names under Tokens and heroes, centred under the box (owner picked heroes below too) — 6c28d269 — 2026-10-23
T-219 — No ring under movable Tokens; the grab cursor alone tells movable from fixed — 6c28d269 — 2026-10-23
T-220 — No quest-ready glow; the tutorial beacon overlay removed (in git history for the redesign) — 6c28d269 — 2026-10-23
T-221 — Loot lands plainly: afterimages, rare twinkle, flight sparkles, pile dissolve and pile pulse switched off in lootEffects.js (owner: shadow kept) — af6b21c7 — 2026-10-23
T-222 — An enemy, or a hero picked up on the mat (its flag), no longer flies in from the mat corner: drag sources are measured with their own transform (DndKit measureDragSource); drag bench 400/400 on flag and hero — b0528da0 — 2026-10-23
T-223 — Bank inspect pane retired, search in the Bank header, the hover tooltip carries everything (owner ok by phone) — 515d7154 — 2026-10-23
T-224 — Item tiles tinted by the item's type, lighter on hover; rule in UI_STYLE (owner ok) — 515d7154 — 2026-10-23
T-225 — Slot-kind marks in each filled loadout slot (code placeholders; seven art lines on owner_art_list) — 515d7154 — 2026-10-23
T-230 — One item, one hero: equipping gear moves the copy out of the Bank, full-Bank and in-use refusals, hero-to-hero hand-over, old saves settled in roster order with one banner (owner rulings 2026-10-22/23; no 'in use' count, owner) — d66c1ee8 — 2026-10-23
T-229 — New! on an item stub clears on hover or pin and stays gone until a new first find — eb6c459b — 2026-10-23
T-226 — Equipping plays the pixel shine on the slot; bounce and glow removed — 957cb9ba — 2026-10-23
T-227 — The Bank's vertical hero tabs show portrait (cut from each class sheet, facing left) and name; the horizontal bar unchanged (owner: the vertical bar was meant) — 957cb9ba — 2026-10-23
T-228 — Work Permissions as a chamfered button under the mat, drawer rising from below, Combat first — 957cb9ba — 2026-10-23
T-231 — No toasts or item stubs over the Guild Hall upgrade screen; they wait on the mat — 02cb806b — 2026-10-23
T-232 — The Hall sky drifts in a smooth linear glide (owner's pick; draws level with steps) — 02cb806b — 2026-10-23
T-233 — Stars stop blinking: grey nothing affordable or locked, blue affordable now, gold maxed; outlines on hover only (owner) — 02cb806b — 2026-10-23
T-234 — Guild Hall Effects as a popover on the Hall star (hover shows, click pins, Esc or outside closes); the web about a third bigger; Inspect panel in the pixel kit — e6abf4e2 — 2026-10-24
T-194 — Opening the Guild Hall glides from the mat up to the sky and back (HallCamera, from tag atlas-camera-move); skippable, reduced motion swaps; mat unmounted at rest on the sky (owner: keep the 0.2 s start back; other views land at once) — e6abf4e2 — 2026-10-24
T-235 — Bank and Shop drawers reach the screen's left edge under the nav orbs; rows padded past the orbs — 7b7244ef — 2026-10-24
T-236 — Opening the Bank slides the top bar up, the stubs off right and the mat aside in 250 ms, reversed on close; no mat refit (spacer asides removed) — 7b7244ef — 2026-10-24
T-237 — The Atlas's Regions as a two-page spread: banners on the left, the selected Region's ground preview, facts, landmarks and actions on the right — 3398be7d — 2026-10-24
T-238 — The floating Ground tuner and the QA Terrain section retired (defaults kept); the Mat dials as one collapsed QA section; the TUNER button gone — 56136a65 — 2026-10-24
T-136 — Pixel frames on every window: tooltips (TipBox), the modal shell, Token Summary, catch-up screens chamfer; Bank, Shop and hero panel studs, warm near-black; boxed rows unboxed; audit in docs/active/research/pixel_frames/audit.md; round two is T-242 — 4fee0e7c — 2026-10-24
T-239 — Who is working what: a quiet work plate at the feet of a hero and the Token they work (output, cycle, charges or the missing input; full line with tooltips on hover); the worked Token's bar, '!' and charges ring and the charge floaters retired; idle Tokens unchanged (owner picked mock-up C) — eb969849 — 2026-10-24
T-240 — The drag bench's Shop and Bank kinds run again: the bench pressed Escape after opening a drawer, which closed the drawer (Escape closes the top layer); gear and shared stock, one item, one hero checked; 50/50 both passes — 23c85a21 — 2026-10-24
T-242 — Pixel frames round two (the owner's second audit): square item tiles and slots with a bronze line, KitButton in three tones, pixel switches and sliders, Settings, save slots, Typography, Promotion, Edit hero and Change job unboxed; kit pieces approved into UI_STYLE — 8c7096b5 — 2026-10-24
T-247 — A station's gear tooltip uses the shared pixel tooltip (TipBox), drawn above the work plate; same words — 60e6671e — 2026-10-24
T-241 — Loot flights draw under the open drawers (the mat's particle canvas now inside the screen overlay at --z-mat-flights) and pause while the Bank covers the mat; the dock-lift hero flight keeps its own canvas on top — 7d9c6f9f — 2026-10-24
T-243 — Hero speech, the hero bar's level-up alerts and every callout in one SpeechFrame (chamfer, stepped pixel tail; bronze news, gold attention, red can't); the callout pop no longer scales; rule in UI_STYLE — 48796bb2 — 2026-10-24
T-244 — The nav orbs and a station's gear button hover with a white pixel outline (four mask copies of the art), no glow or scale; the selected orb is T-252 — afd4ec28 — 2026-10-24
T-252 — A selected nav orb shows a steady gold pixel outline; no grow or glow (owner) — 7f6a1166 — 2026-10-24
T-251 — Scanning tests share one cached read of src (sourceScan.js listFiles/readSource) and a 30 s limit; EngineEventNames' alias search cached and anchored: under build load 0 timeouts (was 2–3), EngineEventNames 6.6 s → 3.6 s alone — d35e661e — 2026-10-25
T-250 — Every test runs with a seeded Math.random (mulberry32, rewound per test from a hash of its file and full name, src/tests/setup/seededRandom.js; FG_TEST_SEED shifts every seed to hunt luck); AdjacencyEffects aura serving two and ChargesEngine pays everything at once now count cycles, not items a +5 % yield can double — fix/t250-seed-tests — 2026-10-25
T-256 — CMSEnemyHostile level preview for every shipped enemy gets a 20 s timeout (it times out under full-suite load; ~3 s alone) — fix/content-tests-k3 — 2026-10-27
T-013 — The last soft glows and shadows go to hard pixel (brief 460 P2): mat words on the global 1 px outline (owner), hard black copies on the state badges and drag refusal mark, gold outline for the Token Summary, dead inline text shadows and unused soft CSS removed; HardPixelShadows.test.js guards src/ui and the style sheets — crunch/hard-pixel — 2026-11-06
T-322 — The draw bench's fights40 and fights80 never built: fights<N> stopped at the 8-hero roster (envelopeScenario returned null above 8, the page threw, the bench waited 180 s), not the spacing, the bus rule or the ambushes. fights<N> now sends N heroes (at least 8) at camps of four brutes, up to 80; sceneFor refuses more before Chrome starts; measured 8, 40 and 80 fights at once — crunch/bench-fights 9023bf7d — 2026-11-06
T-320 — StyleSheetPage close test split into two (X, Escape), one render each — fix/small-batch — 2026-11-06
T-328 — Encyclopedia chart pictures can no longer be dragged off by the browser, so a pan from a picture carries on — fix/small-batch — 2026-11-06
T-330 — Nav bubbles step down to 96 px on screens 900 px tall or less, so all six fit 1366 x 768 — fix/small-batch — 2026-11-06
T-257 — A hero pulled out of a fight stays marked as fighting for ever — 51600e25 — 2026-11-06
T-259 — The tutorial: remove the Old Site step; fix the copper-tool step's text — 9d8d20c5 — 2026-11-06
T-264 — Enemies spawned at a non-whole point stood frozen — 645900d2 — 2026-11-06
T-265 — Spawned Tokens get non-whole centres — d2911400 — 2026-11-06
T-266 — Each enemy camp counts its own enemies — 5ca7ba4f — 2026-11-06
T-267 — The drawer inspection still shows an enemy's charges and says 'Nothing yet' under Drives — f964ddab — 2026-11-06
T-268 — Bank Sort: a tool with no tier of its own sorts by its tool tier — 15438bd5 — 2026-11-06
T-269 — Bank search matches from the start of a word — 15438bd5 — 2026-11-06
T-270 — Carried rules read as the hero's and name their skill — — — 2026-11-02
T-271 — Ledger first reach skips one-off finds — c9f08bc2 — 2026-11-06
T-272 — Ledger leak check reads a map at its Region's tier and lets the map item arrive one stage early — c9f08bc2 — 2026-11-06
T-273 — A vein that refills at the end of a step announces its next cycle twice — 99c53837 — 2026-11-06
T-274 — The pack gate blocks a declared "faster" stage when one entry also loses its time — 9092d268 — 2026-11-06
T-275 — Retire the drawer Token inspection — 47aac08b — 2026-11-06
T-276 — A river layout can crash a Region preview for some seeds — dccc26e8 — 2026-11-06
T-277 — Idle heroes may hang over the mat edge — 4acddc87 — 2026-11-06
T-278 — Pin `createdAt` in `AtlasSettle.test.js`'s `newGame()` — 2c58dd1d — 2026-11-06
T-279 — Ledger: price a Hall rank in its skill's main input when the skill gathers nothing — — — 2026-11-02
T-280 — Ledger: the Hall payback check counts the cost of opening a star — — — 2026-11-02
T-281 — Ledger: milestone perks count only for work gated at or above the perk's level — — — 2026-11-02
T-282 — An effect that spawns a Token names it by its id — — — 2026-11-01
T-283 — Remove "Built copies slower by %" — — — 2026-11-02
T-284 — The Starter Camp gets a small Stone patch; its first mine recipe needs no map — — — 2026-11-01
T-285 — Ledger: the main reach still places Tokens by retired map items — — — 2026-11-02
T-286 — `MatPlacement.relax` deoptimises over and over — — — 2026-11-03
T-288 — `changePackTool` compares against a stale autosave — — — 2026-11-02
T-289 — `CMSChangePackReview` and `CMSChangePackStarterCamp` "finish, then undo" fail under a loaded full suite — — — 2026-11-03
T-290 — The encyclopedia still places things by the retired map items — — — 2026-11-02
T-291 — The balancing preview's XP proposals are undone by Sync — — — 2026-11-02
T-292 — Machinery no shipped content uses since the maps retired — — — 2026-11-03
T-297 — No emoji for skill icons — — — 2026-11-06
T-293 — Icon swaps from the icon rule — — — 2026-11-06
T-319 — Water shimmer from the last Region lingers after travel — — — 2026-11-06
T-313 — Bounty quests retry a failed landing every tick on a full mat — — — 2026-11-06
T-311 — Work change accepted 2026-11-05 — — — 2026-11-06
T-298 — Stale docs found by the upgrade review — — — 2026-11-03
T-245 — Carried rules read as Token rules in the Rules editor — — — 2026-11-02
T-246 — The item tooltip shows a weapon's styles, damage and speed — — — 2026-11-02
T-248 — Enemies stroll with their art over the mat edge — f7f82a45 — 2026-11-06
T-249 — After a kill, the next camp enemy swings first — — — 2026-11-02
T-254 — Leftovers of "help is free" — 7e2a76e4 — 2026-11-06
T-255 — CMSStudio's render test times out under load — 158bcba4 — 2026-11-06
T-197 — Loot piles' hover animation is almost all their cost — — — 2026-11-03
T-198 — Bubbles are the largest cost per hero and per fight — — — 2026-11-03
T-200 — Wandering enemies are expensive in the engine and on the mat — — — 2026-11-01
T-202 — The stub column keeps every row mounted — — — 2026-11-03
T-204 — GDD §3 says the Token Cap upgrade is not built yet — 4e49631b — 2026-11-06
T-205 — Chrome's CPU throttle drifts — — — 2026-11-03
T-206 — Stale bench Chrome profiles and orphan processes — — — 2026-11-02
T-208 — Flaky tests under full-suite load — 33e87e62 — 2026-11-06
T-210 — Remove the description bridge — 0862280d — 2026-11-06
T-339 — The CMS Sync refuses a stale tab (workspace revision) and, from the page, any branch but main (the command line warns); the confirm lists changed entries beside removed ones; files go to temp names and are renamed together — fix/cms-sync-guard — 2026-11-07
T-341 — Loot collected while the page is hidden books no flight (its count shows at once); a batch of flights reads the board box once — 4581ad49 — 2026-11-07
T-343 — One poll clock that pauses: the fifteen UI pollers but the held-arrow repeat share frameClock.onPoll, stopped with the drawing and run once on resume; the Upkeep badge and summary poll nothing and redraw only on a changed signature; TokenCard's ArtWindow measures once and on resize — perf/poll-clock — 2026-11-07
T-342 — Moving a Token onto a half-used copy it fits into no longer leaves a zero-charge ghost at its old spot — fix/zero-charge-ghost — 2026-11-07
T-340 — The last-harvest farming test pins its random rolls, so it passes under the second test seed; the full second-seed suite is green — fix/farming-seed-test — 2026-11-07
T-373 — The import cycle is cut (loading a save rebuilds heroes in systems/core/LoadedState.js; cycles 0), CombatFormulas moved to systems/combat, the ground painters and playmatTuning to ui/components/board/terrain; pure moves otherwise — cleanup/folder-moves — 2026-11-07
T-381 — The twelve CMS-only ledger files moved to cms/src/engine/ledger (engine.js and plan.js stay); tests stay in src/tests with new paths; depcruise rule game-not-from-cms — cleanup/folder-moves — 2026-11-07
T-078 — The hero loadout is kept per hero and checked against what it was built from on every read (slots, item definitions, Bank backing, perk and requirement levels, perk tables, library entries), not expanded per tick; 6 h catch-up profile: loadout 10 % to 2 % of busy time, wall 26.5 s to 23.2 s, same work on S2, S4, C240 — perf/loadout-memo — 2026-11-07
T-333 — A hidden page piles up nothing: every one-shot animation starts through animateFx, which makes none while drawing is paused (a test refuses .animate( elsewhere but the camera glides), and the mat says no callouts while paused; F3 had gated the effect watchers. Soak with 20 min hidden: nodes 269/min and listeners 88/min while hidden before, -0.07 and -0.02 after — fix/hidden-fx-2 — 2026-11-08
T-377 — Dead code removed from world, atlas and quests: abandonQuest, claimQuest's unused sourceRect, three QuestManager re-exports, the Regions reroll (Atlas.reroll; the new-game world reroll stays), Budget's ignored list, Layout's anywhereDry, RegionRules.installedSources, and unimported exports (styleOf, smoothPath, STONE_VERSION, BUILT_IN_OFFSET, World's SETTLE_TEXT and guildSkillLevel re-exports); World's lookups keeps its materials memo at module level — cleanup/world — 2026-11-08
T-374 — Board dead code: the starvation tally and its test reads gone; recallHeroById, loadLeft, minCentreGap, enemyBearerOfHero, isPurelyTriggered and the TimedChanges re-exports deleted; the second isLandmark, the Hall id literals, clampOnto, heroX and DealDamage's countMatches replaced by the shared helpers; Shop.buy and MatResize.teardown kept (tests lean on them) — cleanup/board — 2026-11-08
T-375 — Dead code out of the aggregator (cache, expiry, source switches, unused constants), the thorns branch and its event, combat_trigger, areaId, setAssignment, provenance and newDiscoveries (dropped from old saves by SaveMigration), unused exports; withArticle copies in the UI use the export — cleanup/hero-effects — 2026-11-08
T-376 — Dead code out of core, state and config: the defeat and invasion hooks and the orphan event list; twelve dead saved fields and the cards and recruitment sections (dropped from older saves by SaveMigration), cards out of the required keys, the classId sprite fallbacks; the migration branches for fields removed before 0.8.1, the sidebar quest list and its conversion, the bankedSkills fold and its QA button; the empty data/items glob. Hero woundedUntil and statuses stay (the bench fingerprint reads them), Region ingredients stays (the dev terrain tool reads it) — cleanup/core-state — 2026-11-08
T-140 — The economy simulator's Map dials (scrap ratio, productive return, rarity premium and weights), their pin helpers, the day-in-reach helper and the seven map refusal cards are gone, with their Settings fields; the Unlimited Token Lifetime dial stays (the Token check reads it), and the Token check still skips unlimited Tokens, its comment corrected — cleanup/core-state — 2026-11-08
T-086 — Stale: kill counts are recorded on every victory (collectionLog.noteEnemyBeaten, from CombatResolutionProcessor), found by review round 4 (CR4-040) — cleanup/core-state — 2026-11-08
T-378 — Dead code in src/ui deleted: RingBadge.jsx and its test (the why-CSS note now in ringRow.js), the charge-change floater and its CSS, dead keyframes and classes (gi-hover-pulse, gi-token-hover-pulse, shimmer, bit-drift, .bit), dead constants, the always-silent arrived listener; the slot screen listens for notifications only while open; useGameState's settle in a useCallback — cleanup/ui — 2026-11-08
T-309 — DRAG_KIND.HERO and its branches gone (tests carry flags, rosterFlagPayload), MatHero's heroCarried dropped, ViewportContext.jsx and its provider deleted, the unused bold props of three ghosts dropped — cleanup/ui — 2026-11-08
T-370 — useEntityDrag defaults keyboardAccessible to false: drag sources lose dnd-kit's Tab stop and space-bar screen-reader text; pointer drag unchanged; a guard test fails if game code opts in while no keyboard sensor is registered — cleanup/ui — 2026-11-08
T-335 — Closed moot by measurement: the visible idle heap levels off. A 60-minute soak of the readable perf build (cap128) grows 20.4 KB a minute over 55 minutes, 49 KB a minute in the first half and 5.8 KB a minute from 30 to 60 min (near 18.3 MB); nodes, listeners, bus subscribers and documents flat; the growth is compiled code (+1.18 MB, V8 warming up), closures and scopes retaining it with no more of them (−7 and −11 objects), and Blink's style caches; no game objects grow (brief 520 M5) — docs/measurements-1108 — 2026-11-08
T-347 — Closed moot by measurement: in the 24 h catch-up profile the combat progress publish and the enemy's stat block are 0.3 % each, the swung weapon (getHeroWeapon, getHeroWeaponSlot) 0.1 %, addXP and the regen tick 0.4 % and 0.5 % in all; live, the UI's listeners spend 0.10 ms a tick in all and heroes_updated is not among the eight largest (brief 520 M1, M4) — docs/measurements-1108 — 2026-11-08
T-380 — knip.review.json and npm run dead-code:strict (entries without tests, the CMS in scope); eslint skips .claude, _art_leftovers and docs; @dnd-kit/modifiers dropped, picomatch and @vitest/coverage-v8 listed; the hook-named test helper is withOuterUpgrade — cleanup/tools-lint — 2026-11-08
T-058 — Lint residue cleared in the game and tests: MERGE_GRACE_MS now drives the 1100 ms merge delay, the dead emoji block, variant prop and isDragActive deleted, unused names and React imports removed (8 errors remain in scripts/, outside the game) — cleanup/tools-lint — 2026-11-08
T-379 — Dead exports and stray defaults swept (127 `export default` lines and about forty unread names, one commit per folder) and the duplicated helpers written once: the countdown text, the largest-remainder split, the seeded generator, the corner hash and random direction of the painters, quest state defaults, putting a Token on the mat, the article, the recipe-unlock reading, the pan drag, the element-size hook. Left for a later slice: the camera and dock pairs (they touch the look), the three distance walks and the ground-sheet decode (hot drawing loops, need the draw bench), the two tuner stores (a shared store changes what is saved) — cleanup/sweep — 2026-11-08
T-369 — Playtime means the guild's whole time, accepted away time included: the schema field and the time handler say so, no behaviour change — cleanup/docs-pass — 2026-11-08
T-382 — One docs pass for round 4: stale comments rewritten or stripped of ticket ids across board, heroes, atlas, UI and startup, the architecture map's sizes and boot lines re-measured, the Sync's words no longer promise maps, the installer shrunk with a release profile, the page description fixed, the second-seed run and the new gate lines in TESTING.md — cleanup/docs-pass — 2026-11-08
T-371 — Kills get their combat style's XP bonuses: a kill's award resolves XP_BONUS for the hero's style through the enemy Token's, the guild's and the fighter's scopes, as work does; verified in the game (S2 melee kill 3 XP, 4 with Warrior's Lore; a Ranged star leaves melee kills at 4) — feat/combat-xp-bonus — 2026-11-08
T-372 — Four Guild Hall stars for kill XP (Warrior's, Archer's, Mage's and Rogue's Lore, The War Camp constellation, +15 % a rank), accepted and synced by the owner (c28af150) — content pack 2026-11-07-combat-xp-stars — 2026-11-08
T-344 — A minimised desktop app goes quiet: looping CSS animations paused and per-tick commits held under fg-window-minimised; measured in the release build 42.6 to 0.6 CPU ms/s minimised (visible unchanged at about 200), current on restore — perf/minimised-quiet — 2026-11-08
T-354 — Settling and the world map: measured moot (settle 4.5 to 5.9 ms median, worldView 0.9 to 1.1 ms), closed with the numbers — brief 520 M6 — 2026-11-09
T-393 — Sprites lose sharpness in the production build: hover and limp fades on the main thread, instant turns, whole-pixel loot bob with a still shadow, stepped glide for walking heroes (brief 550), then the mat fitted with CSS zoom so every sprite lands on whole pixels (uneven Tokens 11 to 75 by size, now 0); owner eye-checks ok in the built app — fix/sprite-sharpness, fix/mat-zoom — 2026-11-09
T-394 — A spawn pop and redraws nudged the Tokens around them: gone with the mat zoom (the mat is no longer one composited layer: 3 layers at rest instead of 8 to 10, spawn pop adds none); the owner's drag twitch ok in the built app — fix/mat-zoom — 2026-11-09
T-317 — Every HP bar is the mat's light red (HP_COLOUR, one HP_TONE) at any health: hero bar, Hero drawer, fight window and tabs, fighters on the mat, heroes and enemies alike (owner, 2026-11-10) — feat/drawers-570 — 2026-11-10
T-396 — Default font is Silkscreen (setting default, Settings label, body fallback in CSS); a player who has changed any setting keeps the SilkPixel stored with it — fix/font-and-keys — 2026-11-11
T-392 — QA panel Spawner kinds rows key by the enemy camp instance id, so two camps of one kind no longer give duplicate keys — fix/font-and-keys — 2026-11-11
T-399 — A Field's seed is checked at sowing and taken by the crop's first harvest (through the harvest cycle's inputs, so it waits like any work cycle when the seed is gone); a crop saved under the old rule owes none (seedOwed flag) — fix/seed-at-harvest — 2026-11-11
T-336 — Rare finds judged by finds a day: under 5 %, repeatable work is steady at 1 find a day or more for one hero (Ledger setting) and rare but steady below, never luck; luck only for a source that wears out; rare drop tables and enemy fights counted the same way; rare-find potions (x2, x3 from Plane 4) and Rare Finds buildings (x1.5) get their own boost targets, measured on the finds — fix/rare-find-labels — 2026-11-12
T-258 — Not restored: the cartographer's quest steps are gone with Limes's lessons (brief 480 L4); a place for the endgame ruins can go in the lessons' goal later if wanted — feat/limes-lessons — 2026-11-14
T-409 — A healing hero takes no work and is not knocked out again after travel (650 H1) — c1828871 — 2026-11-17
T-456 — A CMS delete no longer strands a save: settled place, prices, Bank slots, picks (660 R1) — 87d75099 — 2026-11-17
T-425 — A reload remembers the enemy's health; an elixir counted once per enemy (650 H3) — 13946bfb — 2026-11-17
T-455 — Saves follow a CMS rename via data/renames.json (660 R2) — 832f6d80 — 2026-11-17
T-439 — No loadout changes mid-fight: one guard in the equip functions, with the reason shown (650 H2) — 9486e74f — 2026-11-17
T-430 — A gear slot holding a deleted item shows in red and clears with a right-click (660 R3) — 9486e74f — 2026-11-17
T-429 — With two Foods, the second is eaten when the Bank runs out of the first (650 H5) — 9486e74f — 2026-11-17
T-438 — An XP bonus is a true percentage by chance; the at-least-1 floor goes (650 H5) — 9486e74f — 2026-11-17
T-433 — A hand-over onto a full loadout replaces like a Bank drop (650 H5) — 9486e74f — 2026-11-17
T-431 — On a newly settled place a hero goes to a free arrival enemy (650 H6) — 09437782 — 2026-11-18
T-432 — A knock-out banner for several heroes lists each hero's losses (650 H6) — 09437782 — 2026-11-18
T-435 — No two heroes share a name; the list doubles to 192 (650 H6) — 09437782 — 2026-11-18
T-414 — A hero needs the recipe's level to work it (670 M5) — 09437782 — 2026-11-18
T-422 — A ripe Field's card shows the load it ripened with (670 M8) — 09437782 — 2026-11-18
T-420 — A recipe change restarts the work cycle (670 M6) — 09437782 — 2026-11-18
T-423 — Return to a Region restarts half-done work cycles; clocks kept (670 M6) — 09437782 — 2026-11-18
T-418 — Release ends a hero's for-the-cycle effects; the event clock holds while an event stands (670 M6) — 09437782 — 2026-11-18
T-417 — A camp gone, its enemies wait for the next camp of their kind (670 M7) — 09437782 — 2026-11-18
T-419 — A new order walks at full speed; stop clamps to the mat (670 M7) — 09437782 — 2026-11-18
T-428 — Travel checks a bounty's remembered spot (670 M7) — 09437782 — 2026-11-18
T-308 — A crowded Forest waits instead of replanting without end (owner ruling, 670 M3) — 0e4e803c — 2026-11-18
T-410 — One depletion per kill; When Struck; Thorns no charge (670 M2, pack 73aa82ff) — 09437782 — 2026-11-18
T-411 — No Token merges; a copy lands beside (670 M1) — 0e4e803c — 2026-11-18
T-412 — One spot for a Token's whole cycle (670 M3) — 0e4e803c — 2026-11-18
T-413 — A Sapling on its Forest's reach edge counts as inside; transforms tested unrounded (670 M4) — 0e4e803c — 2026-11-18
T-424 — Settle and new game save once (680 S2) — 948b6873 — 2026-11-18
T-426 — A second absence: the summary says since (680 S1) — 948b6873 — 2026-11-18
T-437 — Rusty tools from the Scrap Heap (650 H7, Scrap Heap fixed ea3b0fa0) — 09437782 — 2026-11-18
T-443 — A live catch-up saves first, dated at the gap (680 S1) — 948b6873 — 2026-11-18
T-447 — startSlot one at a time (680 S1) — 948b6873 — 2026-11-18
T-448 — Load as I left it lets go only once written (680 S1) — 948b6873 — 2026-11-18
T-449 — One desktop window (680 S5) — 948b6873 — 2026-11-18
T-450 — A failed close save keeps the window open once (680 S5) — 948b6873 — 2026-11-18
T-458 — An unanswered away summary is offered again on the next start — 4acb2e05 — 2026-11-19
T-445 — Banners come back — 4acb2e05 — 2026-11-19
T-446 — Pinned item stubs count time away — 4acb2e05 — 2026-11-19
T-453 — An Encyclopedia tick stays once the guild has had a Token — 4acb2e05 — 2026-11-19
T-459 — A missing or empty save with a good backup shows "Empty" — 4acb2e05 — 2026-11-19
T-444 — Browser build, Auto-save Off: closing the tab saves nothing — 4acb2e05 — 2026-11-19
T-451 — "Save Game Now" gives no sign it saved — 4acb2e05 — 2026-11-19
T-452 — A new player's master volume is lost once on the next load — 4acb2e05 — 2026-11-19
T-454 — Browser "storage is full" says to export, and there is no export — 4acb2e05 — 2026-11-19
T-457 — A star held at a rank the CMS took away gives nothing — 4acb2e05 — 2026-11-19
T-427 — Latent: thirteen rule shapes the CMS can author that the mat engine gets wrong — f5e5c6f3 — 2026-11-19
T-441 — Latent: loot shapes that differ on a station and a kill — f5e5c6f3 — 2026-11-19
T-440 — Latent: a strength on an "Applies" effect does nothing — f5e5c6f3 — 2026-11-19
T-442 — Latent: shapes the hero, gear and fight code gets wrong — f5e5c6f3 — 2026-11-19
T-077 — Latent: a timed effect on a hero loses its fight numbers after a reload, and "Load as I left it" can end it early — f5e5c6f3 — 2026-11-19
T-460 — Latent: a lesson that gains its content, and a rule with a cooldown — f5e5c6f3 — 2026-11-19
T-480 — Latent: a Shop price of more than four items, and a second Lap Time rule — f5e5c6f3 — 2026-11-19
T-461 — A fighting hero's health on the hero bar and in the drawer stands still — e634d924 — 2026-11-19
T-462 — A Token's "!" wrong after a PC sleep or a catch-up — e634d924 — 2026-11-19
T-476 — No hero drag while a full-screen view is open — e634d924 — 2026-11-19
T-464 — Travel wipes the hero bar's level-up alerts — e634d924 — 2026-11-19
T-465 — The last lesson opens the world map under an open Bank, Shop, Settings or Hall — e634d924 — 2026-11-19
T-466 — Escape in a place's rename box closes the world map — e634d924 — 2026-11-19
T-467 — An event banner clicked with the Encyclopedia open shows nothing — e634d924 — 2026-11-19
T-470 — The first click in Edit Hero closes the Hero drawer behind it — e634d924 — 2026-11-19
T-468 — Hero readouts that say go or working when they are not — e634d924 — 2026-11-19
T-434 — Rate readouts read too high — e634d924 — 2026-11-19
T-436 — The Accuracy and Dodge tips do not say the 5 to 40 % bounds — e634d924 — 2026-11-19
T-474 — Text size: Reset then X keeps the reset and loses custom sizes — e634d924 — 2026-11-19
T-478 — One click buys one rank — e634d924 — 2026-11-19
T-479 — Latent: after a crash in a drawer, the Shop, the hero bar or the banners, the Reload button cannot be clicked — e634d924 — 2026-11-19
T-463 — Hidden drop targets take a drop — e634d924 — 2026-11-19
T-469 — A hero let go off the mat is sent to its edge — e634d924 — 2026-11-19
T-475 — Mat callouts — e634d924 — 2026-11-19
T-471 — Bank order and search — e634d924 — 2026-11-19
T-416 — A Token's open card follows it or closes — 4e293a72 — 2026-11-19
T-472 — Token card cells from no recipe — 4e293a72 — 2026-11-19
T-473 — A second station's gear at the same height does not move the card — 4e293a72 — 2026-11-19
T-477 — The recipe list shows the base time with the station's real time beside it — 4e293a72 — 2026-11-19
T-521 — GDD §4 Equipment, Milestone perks and Health match the game — docs written by the planning agent — 2026-11-21
T-538 — GDD §6 The fight matches the game — docs written by the planning agent — 2026-11-21
T-543 — GDD §6 Status effects and Boss moves match the game — docs written by the planning agent — 2026-11-21
T-549 — GDD §6 Enemies and Encounters match the game — docs written by the planning agent — 2026-11-21
T-555 — GDD on kills and rare tables matches the game — docs written by the planning agent — 2026-11-21
T-564 — GDD and UI_STYLE on the combat screen match the game — docs written by the planning agent — 2026-11-21
T-576 — GDD on Ranged matches the game — docs written by the planning agent — 2026-11-21
T-582 — GDD on Magic matches the game, and the Enchanting plan is amended — docs written by the planning agent — 2026-11-21
T-583 — A Crit Damage effect — closed by owner ruling: no Crit Damage effect, crit stays double — 2026-11-21
T-588 — GDD on Stealth matches the game, and two plans are amended — docs written by the planning agent — 2026-11-21
T-601 — GDD §3 Spawners and Transforms match the game — docs written by the planning agent — 2026-11-21
T-606 — GDD §3 Events matches the game — docs written by the planning agent — 2026-11-21
T-612 — GDD §3 The mat, Foundations and Demolition match the game — docs written by the planning agent — 2026-11-21
T-617 — GDD on Regions matches the game — docs written by the planning agent — 2026-11-21
T-621 — GDD §10 Time and saving matches the game — docs written by the planning agent — 2026-11-21
T-631 — GDD on gathering matches the game — docs written by the planning agent — 2026-11-21
T-636 — GDD §5 Making and the Shop match the game — docs written by the planning agent — 2026-11-21
T-642 — GDD on heroes and the guild matches the game — docs written by the planning agent — 2026-11-21
T-571 — GDD on the combat styles matches the game — docs written by the planning agent — 2026-11-21
T-403 — Use the effect names — 939f3d05 — 2026-11-23
T-488 — One way to write a time — 939f3d05 — 2026-11-23
T-489 — One way to write a chance — 939f3d05 — 2026-11-23
T-490 — A shown chance says whether bonuses count — 939f3d05 — 2026-11-23
T-491 — Lucky reads as a multiplier — 939f3d05 — 2026-11-23
T-492 — A building's Boosts list words effects as the badges do — 939f3d05 — 2026-11-23
T-493 — Rule lines lead with the effect's name — 939f3d05 — 2026-11-23
T-494 — Time effects renamed so good reads plus; effects against the player read minus in… — 939f3d05 — 2026-11-23
T-496 — Two kinds of message — 939f3d05 — 2026-11-23
T-497 — The silent moments speak — 939f3d05 — 2026-11-23
T-498 — Exhausted is the word for a resting Token — 939f3d05 — 2026-11-23
T-500 — One form for a level requirement — 939f3d05 — 2026-11-23
T-501 — Sentence case for every typed text — 939f3d05 — 2026-11-23
T-502 — Respawns is the one verb for coming back — 939f3d05 — 2026-11-23
T-504 — One writer for a Token's timer sentences — 939f3d05 — 2026-11-23
T-505 — The idle hover shows every timer and stuck reason the card shows — 939f3d05 — 2026-11-23
T-508 — The Encyclopedia lists every real source — 939f3d05 — 2026-11-23
T-509 — Amounts in the Encyclopedia — 939f3d05 — 2026-11-23
T-510 — The card shows a working hero's bonus drops — 939f3d05 — 2026-11-23
T-511 — The Guild Hall pays every line once a lap, and says so — 939f3d05 — 2026-11-23
T-512 — Every guild-wide combat effect reaches heroes, Sunder excepted — 939f3d05 — 2026-11-23
T-513 — Bunk Beds, Bank Tabs and the Wishing Well become authored stars — 939f3d05 — 2026-11-23
T-514 — The Guild Hall is a non-working Token by one rule — 939f3d05 — 2026-11-23
T-515 — Better tools work faster, and a hero uses the best one — 939f3d05 — 2026-11-23
T-516 — The same effect from several sources adds in full, no cap — 939f3d05 — 2026-11-23
T-517 — An item's tooltip says what a tool unlocks and its break chance — 939f3d05 — 2026-11-23
T-518 — Retire the neighbouring tool Token path and dead equipment code — 939f3d05 — 2026-11-23
T-519 — An item's effect has no reach — 939f3d05 — 2026-11-23
T-520 — Equip refusals in one wording, translatable — 939f3d05 — 2026-11-23
T-523 — A new perk table starts with a row every 5 levels — 939f3d05 — 2026-11-23
T-524 — Levelling up is an event — 939f3d05 — 2026-11-23
T-525 — Only food heals, and only food says so — 939f3d05 — 2026-11-23
T-527 — Healing out of fights can be boosted (a Regen effect) — 939f3d05 — 2026-11-23
T-528 — Recovery speed-ups shorten wounds already running — 939f3d05 — 2026-11-23
T-529 — Food Healing applies to every meal while the status lasts — 939f3d05 — 2026-11-23
T-531 — Health leftovers — 939f3d05 — 2026-11-23
T-533 — Resistance applies after boosts — 939f3d05 — 2026-11-23
T-534 — Venom deals Poison damage — 939f3d05 — 2026-11-23
T-535 — All damage rolls its fraction — 939f3d05 — 2026-11-23
T-536 — Attack Speed, Attacks every — 939f3d05 — 2026-11-23
T-537 — Combat leftovers — 939f3d05 — 2026-11-23
T-545 — Enemies come back by their camp only — 939f3d05 — 2026-11-23
T-546 — An enemy keeps its damage and heals 5% a second — 939f3d05 — 2026-11-23
T-547 — Bosses come from camps only — 939f3d05 — 2026-11-23
T-561 — Strike, Damage, Attacks every — 939f3d05 — 2026-11-23
T-589 — Token and hero names one step larger — 939f3d05 — 2026-11-23
T-590 — Limes at Token pixel size — 939f3d05 — 2026-11-23
T-591 — The idle hover shows a timer or a problem only — 939f3d05 — 2026-11-23
T-592 — The alert "!" sits above the Token or hero and bobs — 939f3d05 — 2026-11-23
T-593 — The ring grows and shrinks; reach dots pulse in — 939f3d05 — 2026-11-23
T-594 — A hero's flag in the Token's middle, only while the hero is hovered — 939f3d05 — 2026-11-23
T-595 — A task ring on every worked Token — 939f3d05 — 2026-11-23
T-596 — No Saplings: Forests plant full Trees, Stumps grow into Trees — 939f3d05 — 2026-11-23
T-598 — One rule for no room: wait, pay nothing, say so — 939f3d05 — 2026-11-23
T-599 — Spawner limits count in reach, camps their own — 939f3d05 — 2026-11-23
T-600 — Spawner and transform leftovers — 939f3d05 — 2026-11-23
T-602 — An event says goodbye — 939f3d05 — 2026-11-23
T-603 — Demolishing an event needs a hero — 939f3d05 — 2026-11-23
T-605 — Event leftovers — 939f3d05 — 2026-11-23
T-607 — Demolish from the Token's card too — 939f3d05 — 2026-11-23
T-608 — A builder stays to work the new building — 939f3d05 — 2026-11-23
T-609 — Arrival enemies stand outside the cap — 939f3d05 — 2026-11-23
T-610 — Demolishing gives a little Construction XP — 939f3d05 — 2026-11-23
T-611 — Placing and removal leftovers — 939f3d05 — 2026-11-23
T-613 — Each biome sets its terrain ranges, in the CMS — 939f3d05 — 2026-11-23
T-616 — Region leftovers — 939f3d05 — 2026-11-23
T-618 — Time away: under a minute resumes as left, from a minute the summary always… — 939f3d05 — 2026-11-23
T-619 — A kill counts once in the away summary — 939f3d05 — 2026-11-23
T-620 — Saving leftovers — 939f3d05 — 2026-11-23
T-637 — Cut bounties for now; Limes stays — 939f3d05 — 2026-11-23
T-638 — A Discard button — 939f3d05 — 2026-11-23
T-640 — Three small calls — 939f3d05 — 2026-11-23
T-641 — Heroes and Bank leftovers — 939f3d05 — 2026-11-23
T-643 — No more specialist skills, just skills — 939f3d05 — 2026-11-23
T-304 — Tailor, a 21st skill — 939f3d05 — 2026-11-23
T-012 — Transforms keep pushing neighbours (owner decided keep; nothing to build) — 5f8ea1b03 — 2026-11-02
T-334 — DropLap test follows the Swift Laps Sync; QA mirror star retired — d5a5fa9e — 2026-11-07
T-400 — Lore XP stars deleted in the CMS and Synced (50 to 37 Hall stars) — 9cb64c835 — 2026-11-11
T-401 — Restocks keyword removed from the engine and CMS — a0ef73801 — 2026-11-12
T-404 — A rule narrowed to a skill names it in rule text — 0eb5b66c2 — 2026-11-12
T-406 — Needs row shows a cycle's cost after Efficiency (600 B3) — 109ab4e4f — 2026-11-12
T-295 — Loot flight trail with sparkles, burst and number pop (840) — 8ef5e09ad — 2026-11-24
T-305 — Content roadmap in the CMS as Planned stubs — ba1ade604 — 2026-11-26
T-306 — Sell replaces Discard, always confirms (870 C1) — 3a7c9ac3e — 2026-11-25
T-307 — One building per skill (630 B1 and the 21 Nov packs) — 18b0ab433 — 2026-11-13
T-383 — Smooth curve as one rule, Maxed as the curve player, boost budget (880 L3) — e3404ceee — 2026-11-26
T-526 — Shrimp Trawler Potion retired in the alchemy pack — 91a81c89a — 2026-11-22
T-530 — Limes warns about Defeat before the first fight (735 V4) — 480f1a16e — 2026-11-24
T-532 — Only the nine damage types carry numbers (740 C2) — 2e0127ae5 — 2026-11-24
T-539 — Enemy effects are Passive or Active; Venomous retired (740 C4) — 3a7c9ac3e — 2026-11-25
T-540 — Enemy kinds are library effects; code presets removed (740 C5) — 4ae3f51c3 — 2026-11-26
T-542 — Status leftovers retired; STATUS_STACK_LIMIT named and shown — 3a7c9ac3e — 2026-11-25
T-548 — Enemy leftovers (hostile, budgetScale, traits, enemy XP) removed — 3a7c9ac3e — 2026-11-25
T-544 — An enemy's Token card shows everything; kinds once fought (740 C8) — e61a40a21 — 2026-11-24
T-550 — A kill is a combat cycle (740 C7) — 35be342b2 — 2026-11-23
T-551 — Giant Harvest is Farming only (740 C7) — 35be342b2 — 2026-11-23
T-552 — On Kill only (740 C7) — 35be342b2 — 2026-11-23
T-554 — Loot leftovers (740 C7) — 35be342b2 — 2026-11-23
T-556 — Health bars green, amber, red (740 C9) — e61a40a21 — 2026-11-24
T-557 — One hit look for window and mat (740 C9) — e61a40a21 — 2026-11-24
T-562 — Every open fight button lit (740 C9) — e61a40a21 — 2026-11-24
T-558 — Elixir logged at once (740 C10) — 877b0d310 — 2026-11-25
T-559 — Defeated both ways (740 C10) — 877b0d310 — 2026-11-25
T-560 — Defeats lead the away summary (740 C10) — 877b0d310 — 2026-11-25
T-563 — Combat screen leftovers (740 C10) — 877b0d310 — 2026-11-25
T-566 — All 20 weapons ask a style level by metal — 91a81c89a — 2026-11-22
T-567 — Enemy styles spread out — 91a81c89a — 2026-11-22
T-568 — Weapon tier table moved to an authoring rule (750 S4) — 3260be576 — 2026-11-25
T-569 — One text per combat style (750 S5) — 3260be576 — 2026-11-25
T-573 — One ammo rule for arrows, Motes and Kunai (750 S2) — 3260be576 — 2026-11-25
T-579 — One ammo rule, Motes (750 S2) — 3260be576 — 2026-11-25
T-586 — One ammo rule, Kunai (750 S2) — 3260be576 — 2026-11-25
T-575 — Ranged leftovers (750 S4) — 3260be576 — 2026-11-25
T-581 — Magic leftovers (750 S4) — 3260be576 — 2026-11-25
T-580 — Leather has no Magic cut — 91a81c89a — 2026-11-22
T-584 — Crit chance capped at 75 % (750 S1) — 3260be576 — 2026-11-25
T-587 — Poisons for Stealth weapons, for N attacks (code) — 3260be576 — 2026-11-25
T-597 — Every wood has a spawner Forest; Saplings gone — 91a81c89a — 2026-11-22
T-604 — The Fish Shoal is a fishing spot like other water (850) — d2fa38664 — 2026-11-25
T-623 — Out of bait, the hero leaves and says so (770 G1) — 6ddec2ae9 — 2026-11-23
T-629 — Out of seed, the hero leaves and says so (770 G1) — 6ddec2ae9 — 2026-11-23
T-626 — Every listed wood, stone and fruit has a recipe — 91a81c89a — 2026-11-22
T-628 — A resting vein is its own ore greyed with a countdown — d5cd28dde — 2026-11-22
T-632 — The six making-plan parts Synced — 91a81c89a — 2026-11-22
T-633 — Four stations retired — 939f3d05c — 2026-11-23
T-634 — Construction variants at 20, 40, 60; Town Square at 85 — 91a81c89a — 2026-11-22
T-639 — Item tooltip lists its effects (790 W4) — a59c430d1 — 2026-11-23
T-644 — Hero sheet lines for Faith, Crime, Summoning and Science (810 K2) — 8d88fadb1 — 2026-11-25
T-684 — Fishing spots come and go (850 F1) — d2fa38664 — 2026-11-25
T-685 — Catch rules (850 F2) — d2fa38664 — 2026-11-25
T-686 — Fishing Hut and spot rate (850 F3) — d2fa38664 — 2026-11-25
T-687 — Fishing spot card (850 F4) — d2fa38664 — 2026-11-25
T-688 — Gathering ends by chance (860 R1) — d2fa38664 — 2026-11-25
T-689 — Forests own their trees (860 R2) — d2fa38664 — 2026-11-25
T-690 — Gathering Foundations (860 R3) — d2fa38664 — 2026-11-25
T-698 — Green Thumb speeds a Forest's own regrowth — d2fa38664 — 2026-11-25
T-692 — Catch XP per fish — b9ae62849 — 2026-11-25
T-693 — Mid-tick arrivals worked only from arrival — 6aa3552dd — 2026-11-25
T-694 — The pack gate finishes again — 17640d6ad — 2026-11-24
T-696 — Small-tickets merge — 37c5fb282 — 2026-11-25
T-707 — Small-tickets merge — 37c5fb282 — 2026-11-25
T-708 — Small-tickets merge — 37c5fb282 — 2026-11-25
T-709 — Small-tickets merge — 37c5fb282 — 2026-11-25
T-711 — Small-tickets merge — 37c5fb282 — 2026-11-25
T-697 — Ledger report in about 15 s — ab180f724 — 2026-11-26
T-710 — The game-time effect clock is retired — 9e803ef5e — 2026-11-25
T-700 — Coins basics (870 C1) — 3a7c9ac3e — 2026-11-25
T-701 — Coins as a cost (870 C2) — 53ffa7c99 — 2026-11-25
T-702 — Ledger prices coins (870 C3) — 4e7ee3171 — 2026-11-25
T-703 — Coin pack Synced (amounts the balancer's) — 4ed8fec4f — 2026-11-26
T-704 — Quiet effect for the Hideout (810 K4) — deee4c895 — 2026-11-25
T-705 — Five Faith blessings — d2a88daf8 — 2026-11-25
T-706 — Enemy roster pack Synced — 8706ea54a — 2026-11-26
T-713 — Two coin curves (900 B3) — 8f36ca91a — 2026-11-26
T-260 — Weapon Tier field; Recruits hold tier-1 weapons (tiers by owner moot after brief 270) — 79c6b01c — 2026-10-27
T-008 — Moot: Scouting Flags retired (260 O2) — 5362944b0 — 2026-10-29
T-014 — Moot: tutorial quests gone, quests cut; Limes lessons teach now — 9f3f199d7 — 2026-11-25
T-175 — Dropped: collectors cut by the owner — - — 2026-11-25
T-176 — Moot: quests cut (brief 170) — 9f3f199d7 — 2026-11-25
T-261 — Enemies never show a charges count (250) — e5c7e0345 — 2026-10-28
T-262 — A waiting choice swaps its ! for the gear on hover (250) — 7677dae85 — 2026-10-28
T-263 — One plate for every Token, rings retired (250) — 2fc12732a — 2026-10-28
T-415 — Lifting a fought enemy ends the fight (650 H4) — f68ff0dec — 2026-11-17
T-421 — Out-of-fight eating on game time (650 H4) — e0534ce83 — 2026-11-17
T-495 — Effect names explain themselves on hover (790 W4) — 3e84900c8 — 2026-11-23
T-499 — An item's tooltip lists its effects (790 W4) — 3e84900c8 — 2026-11-23
T-503 — Expired against Demolished; one away line per kind (795 M3) — d973aba4e — 2026-11-23
T-506 — Away news told once (795 M3) — d973aba4e — 2026-11-23
T-507 — Bank-full and stack-full banners clear themselves (795 M3) — d973aba4e — 2026-11-23
T-646 — Motherlode perk (800) — bf09ea6ec — 2026-11-25
T-647 — Grove Feller perk (800) — bf09ea6ec — 2026-11-25
T-648 — Master Angler perk (800) — bf09ea6ec — 2026-11-25
T-649 — Evergreen perk (800) — bf09ea6ec — 2026-11-25
T-650 — Many Hands: a second recipe on its own clock (800) — a8f55039d — 2026-11-25
T-651 — Salvage and Master Builder (800) — bb96ee3b5 — 2026-11-25
T-652 — Second Wind (800) — e95fd4711 — 2026-11-25
T-653 — Unbreakable (800) — e95fd4711 — 2026-11-25
T-654 — Twin Shot, Double Cast, Shadowstep (800) — e95fd4711 — 2026-11-25
T-655 — Level-up flash (800) — 7736302eb — 2026-11-24
T-657 — Gear Swing Time counts in attack timing (750 S6) — 40860bcaa — 2026-11-25
T-658 — Taming leaves the skill list (810 K1) — 65ceffb39 — 2026-11-25
T-659 — Faith: offerings keep a shrine lit (810 K3) — d2a88daf8 — 2026-11-25
T-660 — Crime: the Hideout steals from a camp in reach (810 K4) — deee4c895 — 2026-11-25
T-661 — Summoning: one Summoned worker per Circle (810 K5) — 57dfec248 — 2026-11-25
T-662 — Science: a Laboratory studies a node (810 K6) — 3c04403b6 — 2026-11-25
T-664 — The game is called Tabletop Guild (820) — 995366c01 — 2026-11-24
T-665 — Drag only; right-click inspects (830 D1) — 39f8037f9 — 2026-11-23
T-666 — Token card with a tail (830 D2) — 0d276e3c8 — 2026-11-23
T-667 — Mat marks and work bar (830 D3) — a27fc7a25 — 2026-11-24
T-668 — Job areas centred, no ring line (830 D4) — c7b2176f9 — 2026-11-23
T-669 — Reach rings after a rest (830 D5) — b7cb8e8a2 — 2026-11-23
T-670 — Frameless top bar and Controls strip (830 D6) — ec3e105ce — 2026-11-24
T-671 — Banner corner with show and hide (830 D7) — 8425e20b1 — 2026-11-23
T-673 — Loot lands at the edge of its job area (830 D8) — 0ff599161 — 2026-11-24
T-672 — Loot flight trail (840) — fe0e2a736 — 2026-11-24
T-718 — Token spacing ruled and built as 890 S1 to S3 — 1d9aaff0f — 2026-11-26
T-721 — Tokens 128 u apart, no overlap (890 S1) — c67e94252 — 2026-11-26
T-722 — One Token size (890 S2) — a298a2daa — 2026-11-26
T-723 — New Starter Camp, one clump per gathering skill (890 S3) — 1444b3986 — 2026-11-26
T-716 — The reference guild (900 B1) — f0813393a — 2026-11-26
T-717 — Three ledger checks (900 B4) — 3b9064246 — 2026-11-26
T-724 — pack numbers writer and ledger --with-planned (900 B5) — e6dc66375 — 2026-11-26
T-712 — The FS bench uses fixture spot kinds only — 77c7e01b9 — 2026-11-25
T-719 — Engine speed pass (S7 -16 %, same work) — ac6ac79be — 2026-11-26
T-725 — Bench boards rebuilt for 128 u spacing — 4559c3f3c — 2026-11-26
T-728 — The QA panel gives Coins — 7b4ec45d1 — 2026-11-26
T-729 — Output pin; Bait timed as a prepare step — 12f2c41ba — 2026-11-26
T-730 — The balance preview follows a stage's way out — 257d98d45 — 2026-11-26
T-731 — Coin curve prices on a worker selling — 6609c46c3 — 2026-11-26
T-733 — Typical's 4x drink gate, chain-xp in gathering hours — 80c3e6a16 — 2026-11-26
T-736 — pack boosts writer (900 B6) — 38d4bd199 — 2026-11-26
T-737 — Nodes at 15 s and 60 s back (900 B7) — 1046c9dab — 2026-11-26
T-738 — One drink at a time (910 W1) — bcf54de90 — 2026-11-26
T-150 — Built then superseded by the owner's job-flag pick — 0b26987f1 — 2026-10-29
T-361 — Moot: superseded by T-710 (effect clock retired) — 9e803ef5e — 2026-11-25
T-614 — Dropped: events stay biome-free (owner 2026-11-27) — - — 2026-11-27
T-726 — a stepping enemy keeps the 128 u spacing and cannot be pushed while it steps — 716c0e852 — 2026-11-27
T-744 — QA panel button gives the old starting kit — 716c0e852 — 2026-11-27
T-740 — the built-in Hall star stand-ins retired; a missing required star is a content error — 240551b70 — 2026-11-27
T-739 — the batch-payback check reads Typical's own drink judgement — 81ca12fb0 — 2026-11-27
T-735 — the catch-up hour runs without the shipped perks; Bank gap was Clean Felling's 5 % Double Loot luck — ad9aba6bd — 2026-11-27
T-750 — every bench scenario builds without the shipped perks — 0f41aef72 — 2026-11-27
T-746 — the CMS audit names a missing required Hall star as Critical — 9158d3fa5 — 2026-11-27
T-749 — the batch-payback row shows the drink on Typical's finished setup — 03f863be6 — 2026-11-27
T-745 — a fight step let go part-way finishes at its held spot — f0f9e501a — 2026-11-27
T-676 — the ledger and the CMS rate calculator skip a catch pool that never bites — 455cb9291 — 2026-11-27
T-108 — cardUseCounts renamed cyclesByTokenType, old saves move at load — 455cb9291 — 2026-11-27
T-103 — StateSchema and dryRun comments slimmed (clipped test comments left) — 455cb9291 — 2026-11-27
T-114 — the logging to forestry migration removed — 455cb9291 — 2026-11-27
T-141 — a respawning Token also sold at the Shop warns — 455cb9291 — 2026-11-27
T-481 — FarmingHarvest pins its regrown harvest roll, green on seeds a to g — 455cb9291 — 2026-11-27
T-677 — the CMS generator's dead import removed — 455cb9291 — 2026-11-27
T-747 — owner (a): a fight under way may be pushed by a spawn; GDD wording fixed — 5aa1c61bd — 2026-11-27
T-752 — the CMS Generate button and the Gemini generator removed (owner a) — a605afe58 — 2026-11-27
T-116 — moot: the generator it named is removed — a605afe58 — 2026-11-27
T-753 — the xp lever caps a work under the later best and reports gaps — 042fbf03c — 2026-11-27
