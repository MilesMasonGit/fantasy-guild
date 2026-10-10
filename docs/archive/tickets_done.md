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
