# STATUS — the directors' living table

*The director keeps this file; nobody else edits it. One row per phase; a
five-line summary at each batch's edges (proposed, looked at); anything older
than two days is trimmed. States: queued · building · ready (tests, cycles,
build green) · bench-queued · eye-check · merged.*

## Director, classless heroes and the ledger (briefs 270 and 290; owner chose 2026-10-29 evening: K1 beside L1; then perks beside the Bank at scale, brief 310)

| Phase | Tier | Branch (worktree) | State | Planned | Done |
|---|---|---|---|---|---|
| 270 K5: classless clean-up (GDD, glossary, tutorial wording, dormant promotion code) | builder | `feat/classless-k5` | **merged** 7dd76c98 on the gate (6628 tests, cycles 0, builds; engine: the retired ON_PROMOTE moment only, never spent). **Brief 270 complete.** Owner CMS: delete the two Academies, their Training effects and the Fighter's Academy recipe; the Shrimp Market's skill | Fri | Fri |
| 290 L4: first-fill pack | builder writes, owner accepts | `cms/incoming/2026-10-30-ledger-first-fill.json` (copy in the scratchpad) | **in the owner's inbox**: 367 entries tiered (110 inferred, noted), 15 Planned stubs. Owner 2026-10-30: apples and bee products Starter Camp (director edited 8 entries), copper gear, Alchemy and Lavender stay planned for the fix pack (L8), the rest as recommended (T-272 map rule; one "later" tier; 9 endgame sites; owner Parks the legacy entries). First Sync should change only `cms/plan/plan.json` | Fri | |
| T-268 + T-269: Bank sort by tool tier, search from the start of a word | builder-lite | `fix/bank-sort-search` | **merged** 15438bd5 on the gate (6630 tests, cycles 0, build) | Fri | Fri |
| 300 E1+E2: the encyclopedia and collection log | builder | `feat/encyclopedia` (`k4`) | **eye-check** ([file](eyecheck/2026-10-30_encyclopedia.md)), owner looks later. Engine **same work**. Draw compare read ~2× slower everywhere, but a back-to-back control showed `main` equally slow (4× S2 93.5 vs 81.8 fps, bank 78.7 vs 86.9): machine load, not the branch | Fri | |
| 290 S0: rate calculator spike | engineer | `spike/ledger-s0` | **merged** 122f03a8: work check **same** (13:40). Calculator within 1 % of the engine; `rates.js`, `bench/calibrate.mjs`; T-273 filed | Fri | Fri |
| 280 V1: damage types (nine types, one per weapon, arrows as ammo, enemy resistances and weaknesses on the card) | engineer | `feat/combat-v1` (`c1`) | **eye-check** ([file](eyecheck/2026-10-30_combat-v1-v3.md)). Director gate with `main`: 6723 tests, cycles 0, builds; engine work **same** (14:4x). Flat armour, Pierce and the floor of 1 retired; shipped armour inert until re-authored (owner question e) | Fri | |
| 280 V2: gear and defence (resistances from gear, cuts to named styles, shields in the off-hand, Venom, Sunder) | engineer | `feat/combat-v2` (`c2`, holds V1) | **eye-check** with V1 ([file](eyecheck/2026-10-30_combat-v1-v3.md)). Director gate with `main`: 6779 tests, cycles 0, builds; engine work **same** (15:56). Poison → Venom by an id migration: the owner's first Sync after the merge changes exactly three entries | Fri | |
| 290 L6: timeline and hubs views; default pace curve set to the owner's pick | builder | `cms/ledger-l6` | **merged** on the gate (6698 tests, cycles 0, builds; CMS only). Every skill walls from level 1 at Typical (Construction 1→15 3.7×, blocked by Build Copper Smithy); hubs Oak Wood 29, Stone 15, Copper and Iron Ingot 14. CMS look with the other ledger pages. Builder's calls taken as built: crowded = 5+ within a check-in, empty = 10 curve levels, a "No skill level" lane, the level axis later | Fri | Fri |
| 290 L7: before-and-after (ghost dots, moved entries) and the pack gate | builder | `cms/ledger-l7` | **merged** 5e81c484 on the gate (6715 tests, cycles 0, builds; CMS only). Perks pack PASS; the first-fill pack was BLOCKED for an undeclared Starter Camp move (7 h → 1 h): director added the declaration, now PASS. Builder's calls taken as built: a blocked pack shows a banner, the owner can still finish; tier-only packs declare; "since last Sync" reads `data/` | Fri | Fri |
| 280 V3: enemy moves (random move per swing, its own type or effect; named on screen) | engineer | `feat/combat-v3` (`c1`, holds V1 and V2) | **eye-check** with V1 and V2 ([file](eyecheck/2026-10-30_combat-v1-v3.md)). Director gate with `main`: 6839 tests, cycles 0, builds; engine work **same** (16:45) | Fri | |
| 280 V4: style characters | — | — | **dropped by the owner** 2026-10-30 (owner_feedback; planning updates the brief) | — | — |
| 280 V5: combat content pack and GDD | builder | `feat/combat-v5` (`c2`, on V3; docs only) + pack in the scratchpad (`v5/data_stamped/`, `v5/after_first_fill/`, generator `v5/mkpack.mjs`) | **ready**: 47 entries, gate PASS; GDD §4/§6/§7 and glossary rewritten. Goblin Chief level 12 hit 3; Wind Elemental Physical 25; daggers Stealth; bows Electric, damage kept until arrows have a recipe; arrows Draft (no Fletching yet); no Dodge on gear (director took every recommendation, owner rule: content specifics are the director's call). ⚠️ Shares 36 records with the first-fill pack: after the owner accepts first-fill and Syncs, and combat V1–V3 merge, re-stamp with `mkpack.mjs --from` the owner's workspace and copy into `cms/incoming/` | Fri | |
| Small tickets, engine: T-266 (each enemy camp counts its own), T-273 (double cycle start after a refill), T-265 (decided: not rounded, comments), T-248 (strolls clamped by the art), T-277 (idle heroes inside the edge) | engineer | `fix/engine-tickets` (`l1`) | **bench-queued** after the 01:00 draw check (0e12bc23, director gate with `main`: 6738 tests, cycles 0, build). Predicted WORK CHANGED on S2, S3, S5, S6, S8/S8L/S8F; same on S1, S4, S7; S8 = S8L. If it matches, accept under T-266-T-273-T-265-T-248 and merge; no eye-check (bug fixes back to ruled behaviour; owner calls taken as built: lopsided old camps keep their extras). Calibration now agrees on Beer (0.0 %). Filed T-277 | Fri | |
| T-276: river layout crash for some seeds | engineer | `fix/river-seed-crash` | **merged** on the gate (6722 tests, cycles 0, build). Cause: all 12 trial lines through the Hall's clearing left no pick (about 1 river layout in 400; a reroll could stick); more draws only then. 47,925 layouts and 180,000 water records byte-identical; no bench reaches it. T-278 filed | Fri | Fri |
| T-275 + T-278: retire the unreachable drawer inspection; repeatable Atlas test seeds | builder-lite | `fix/small-cleanups` | **merged** on the gate (6702 tests, cycles 0, build). `LeaveMatControl` moved to its own file (the encyclopedia branch imports it from TokenCard: expect a small merge) | Fri | Fri |
| 320 H1: Guild Hall upgrades machinery (constellations per skill: XP, yield, speed; Token upgrades; Well lines; Infirmary, loadout slots; Compass retired) | engineer | `feat/hall-h1` (`h1`) | **eye-check** ([file](eyecheck/2026-10-30_hall-h1.md)) and **bench-queued** after the engine tickets (+ calibration; same work predicted). Director gate with `main`: 6746 tests, cycles 0, builds. "More consumable room" not built (owner question a). Merge notes: small conflicts with `feat/combat-v3` (ContentAudit, statements, palette, entity store; regenerate the render golden) | Fri | |
| 320 H2: the ledger knows the Hall (stars as factors, payback per rank, the Hall's share, rank tiers and proposed prices) | engineer | `feat/hall-h2` (`b1`, on H1) | **ready** dfeaeea5 (director gate: 6775 tests, cycles 0, CMS build; CMS only). Hall payback 24 h (owner), prices never fall rank to rank (director); a rank that saves less than the one below stays red as a signal (director, the builder's A). Merges after H1; owner looks with H3's pack | Fri | |
| 320 H3: the first star list | builder | pack `b1/cms/incoming/2026-10-30-hall-first-stars.json` (copy in the scratchpad `h3pack/`, scripts in `h3/`) | **ready**: 9 constellations, 44 stars, 86 ranks; gate PASS on `data/` and on `data/` + the two ledger packs; walls cleared except Forestry 1–11 (2.2×). Priced on `data/` + the ledger packs: accept those first, and H1+H2 must merge before the CMS on `main` knows the kinds. Director: XP floor kept (one XP rank), T-279 and T-280 filed. ⚠️ `feat/hall-h2` CHANGELOG has H2's entry twice: fix at merge | Fri | |
| 330 W1: the world's generation (seeded hex world, rings, wedges, origins, kits, guarantees) | engineer | `feat/world-w1` (`w1`) | **bench-queued** after Hall H1 (director gate with `main`: 6761 tests, cycles 0, builds; no bench scenario reaches it). Nothing on screen (W2); merges on the gate if same work. 3 ms per world; the world is ~100 KB of a new save (92 %). Builder's calls taken as built: specialty apart from wedge, the "missing for 4" rule, ring-2 prices from one neighbour, a 7th specialty starts in ring 2. ⚠️ The agent emptied a test save on its own port (5281), not the owner's | Fri | |
| 330 W2: the world map screen (hex map, frontier hover with have/need, settle and travel; map items, map drops, bounty maps, upcycling, the Cartography table retire) | engineer | `feat/world-w2` (`w2`, on W1) | **eye-check** ([file](eyecheck/2026-10-30_world-w2.md)) and **bench-queued** after W1 (director gate with `main`: 6742 tests, cycles 0, builds; same work predicted). Merge H1 first (trial merge: 4 small conflicts). Stand-in Region from the cell until W3. Builder's calls taken as built: abandon allowed, best hero's level, wild rings two ahead; the two Buried mods and the goblin step's map line wait for W6/W3 | Fri | |
| 330 W3: writing a cell's mat (kit, specialty, hidden extras, wild extremes), Stone terrain, the darkened arrival, the tutorial ending | engineer | `feat/world-w3` (`w3`, on W2) | **building**; joins the world look | Fri | |
| Small tickets, UI and tooling: T-267, T-254, T-274, T-204, T-210, T-208, T-255 | builder | `fix/ui-tickets` | **merged** on the gate (6720 tests, cycles 0, builds; no engine files). First-fill pack now passes the gate. Filed T-275 (retire the unreachable drawer inspection), T-276 (river layout crash for some seeds) | Fri | Fri |
| 290 L8: content fix pack | builder writes, owner accepts | `cms/incoming/2026-10-30-ledger-fix-pack.json` (copy in the scratchpad) | **in the owner's inbox**: 42 entries; Construction wall cleared (1–8 in ~31 min); camp build XP ×3 (owner: keep); Alchemy and Lavender to plane 2. Accept **after** the first-fill pack (30 shared entries carry its plan; reject first-fill's copies of them if L8 goes first). Owner 2026-10-30: copper gear to the camp in the plan; small leaks taken as recommended (director re-tiered 24 first-fill entries to Starter Camp). ⚠️ The first-fill pack now shows a red gate banner (the camp gets faster but one entry loses its time, which the gate reads as undeclared); finishing it anyway is fine | Fri | |
| 290 L5: the rate calculator in full (profiles, path time, checks D, calibration) | engineer | `cms/ledger-l5` | **merged** 8f1db55e on the gate (6687 tests, cycles 0, builds; no game code imports it). Calibration within 1 % (+3 new setups); Construction 15 wall 4× at Typical; owner sets the pace curve (questions in STATUS) | Fri | Fri |
| T-271 + T-272: ledger first reach skips one-off finds; maps may arrive a stage early | builder | `cms/ledger-reach-fixes` | **merged** on the gate (6637 tests, cycles 0, builds). With the first fill: 32 leaks left, none maps (copper gear 16, Alchemy 7, Workbench 4, Brewery 2, Herb Garden 2, Salmon 1: all for L8). Side effect: Meadow, Flower Meadow and Cherry Grove maps now read luck-only (bounties only, 0.4–1.6 %) | Fri | Fri |
| 270 K1: classless heroes (no jobs or promotion, every skill from level 1, the weapon decides the style, gear level requirements, HP 10 + best combat skill, old saves keep levels) | engineer | `feat/classless-k1` | **merged** 7920232e with O3 (owner okayed, [record](../archive/eyecheck/2026-10-30_classless-ledger.md)). Gate on the merged result: 6581 tests, cycles 0, builds. Bench: only heroHash on every hero scenario, S8 = S8L, accepted under brief270-K1. Owner CMS to-do in the record | Thu | Fri |
| 270 K4: milestone perks | engineer | `feat/classless-k4` | **merged** 468bf6ec (owner okayed, [record](../archive/eyecheck/2026-10-30_perks-bank.md), all A; T-270 wording pass). Gate on the merged result 6630 tests, cycles 0, builds; bench same work (01:12). Example pack copied to `cms/incoming/` | Thu | Fri |
| 310 B1+B2: Bank at scale | builder | `feat/bank-b1` | **merged** 38f87ac9 (owner okayed, all A; T-268 tool-tier sort and T-269 word-start search to build). Gate on the merged result 6647 tests, cycles 0, builds; bench same work, drag 50/50. Work check of `main` queued 13:00 | Thu | Fri |
| 290 L3: checks A–C and the item page in the Ledger tab | builder | `cms/ledger-l3` | **merged** on the gate (director: 6775 tests, cycles 0, builds; CMS only, the one game-side file `ledger/checks.js` is imported by no game code). 313 findings today, 107 Block/Warn; Iron Ore "only from the Volcano Map" reproduced; leaks wait for L4's tiers. CMS look in the morning (shots `docs/active/research/ledger_l3/`) | Thu | Thu |
| 290 L1a: the plan in the CMS (status, `plan.tier`, note; Planned stubs kept out of `data/` in `cms/plan/plan.json`; Plan section in four editors) plus most of the rewritten brief's L2 (reach, tree and hubs engines) | engineer | `cms/ledger-l1` | **merged** 0c5c9202 on the gate (director: 6733 tests, cycles 0, build, CMS build; read the Sync-path diff; no game file uses the new modules, so no bench). Brief 290 was rewritten while it built (S0 spike first, the Ledger tab in L1) | Thu | Thu |
| 290 L1b: the Ledger tab and settings (stages and budgets, tolerance, target player, pace curve) | builder | `cms/ledger-l1b` | **merged** 34985051 on the gate (director: 6749 tests, cycles 0, build, CMS build; read the Sync-path diff). CMS look with K1's batch; First reach reads Starter Camp everywhere until L4 sets map tiers; pace-curve points are placeholders for the owner | Thu | Thu |

## Director, Hero orders (brief 260; owner 2026-10-28: merge Token bars, move on to the next brief)

| Phase | Tier | Branch (worktree) | State | Planned | Done |
|---|---|---|---|---|---|
| O1: orders (drag a hero onto a job; flags and Work Permissions retire; roster dock; old saves migrate) | engineer | `feat/hero-orders-o1` (`tb1`) | **merged** 88918eea (was bench-queued 13:00 Thu, 2c7fa845, `main` merged in; builder gate 6607 tests, cycles, build). Owner looked at 17 shots by phone; owner 2026-10-29: merge without playing. Owner calls: non-work drop refuses, built Foundation ends the order, right-click sends home, spot orders never ambushed (22af5033); ambushes otherwise left for a later decision. WORK CHANGED expected (accept under brief260-O1 if it matches the engineer's per-scenario prediction) | Wed | |
| O2: camps; Scouting Flags retires; camps content pack | engineer | `feat/hero-orders-o2` | **merged** 88918eea with O1 and the flag follow-ups; owner synced the pack e7517dc3 | Thu | Thu |
| O3: clean-up (tutorial, dead code, GDD) | builder | `feat/hero-orders-o3` | **merged** 7920232e (inside K1): bench **same work** on every scenario (01:05 Fri); S4 timing flags checked with interleaved runs against `main`: level (noise) | Thu | Fri |

## Director, Token bars (brief 250; owner chose 2026-10-28: all three phases, then the card-wording fixes) — **merged 90f7a7dd, owner okayed**

Integration branch `feat/token-bars` (one eye-check for the brief). P1 ∥ P2, then P3 on top of P1.

| Phase | Tier | Branch (worktree) | State | Planned | Done |
|---|---|---|---|---|---|
| P1: enemies show no charges; a choice waiting on you swaps its '!' for a 2× gear on hover (T-261, T-262) | builder | `feat/token-bars-p1` (`tb1`) | **ready**, merged into `feat/token-bars` 49e96c3d (gate on the merged P1+P2: 6646 tests, cycles 0, build; director read the diff). Notes: the gear keeps its own tooltip; the drawer inspection still shows an enemy's charges (ticket candidate) | Wed | Wed |
| P2: every hero's flag is the owner's pennant at 2× (T-150) | builder | `feat/token-bars-p2` (`tb2`) | **ready**, on `feat/token-bars` 89b6b15c (builder: 6636 tests, cycles 0, build; director read the diff, checked the pole foot (4, 31) on the art, shots look right). Drag bench queued | Wed | Wed |
| P3: one plate for every Token: no output icon, idle Tokens get it on hover, the round rings retire (T-263) | builder | `feat/token-bars-p3` (`tb1`) | **merged** 90f7a7dd (owner by phone: "seems fine", questions a–c option A, d–e as built); ([file](../archive/eyecheck/2026-10-28_token-bars.md)): on `feat/token-bars` 721f753e with `main` merged in, gate 6660 tests, cycles 0, build; director read the mat wiring. Owner's folder switched to the branch, dev server up on 5173. Engine work check and `bench:draw --compare` queued for 01:00 (window closed; P3 touches no engine code) | Wed | |
| Card wording fixes from the S9 list (#4, #5, #9, #10, #11, #12) | builder | `fix/card-wording` (`tb2`) | **merged** fd5ea1c4 (gate on the merged result: 6640 tests, cycles 0, build, engine **same work**; director read the engine diff: the work-time sum moved into `TileModifiers.workTimeOf`, unchanged). Empty Field "No crop chosen"; cards show the time with speed-ups; card rows wrap; crop picker shows grow time and harvests, "1 Wheat Seed per sowing"; no Drives line when nothing uses a Token; no "+0" stubs. Ticket candidates for planning: the drawer inspection still shows an enemy's charges and says "Nothing yet" under Drives | Wed | Wed |

## Systems director, combat (brief 220; owner's go 2026-10-24) — **done, all phases merged 2026-10-25**

Owner 2026-10-22: **each director may run two code agents at once**; still one
heavy run (suite, build, bench) at a time across both. Owner away from the PC
until about 2026-10-25: looks by phone screenshots, design questions any time.
Owner by phone 2026-10-24: enemy kinds stay harder than their level (the author balances); two elixirs show two stacked bubbles.
Order from the brief: C1 alone; then C2 and C3 (or C5) in parallel; C4 after
C2; C0 (the test content pack, accepted by the director) after C2; C6 last.

| Phase | Tier | Branch (worktree) | State | Planned | Done |
|---|---|---|---|---|---|
| C1: the numbers (HP 10 + level, weapon damage, misses 5–40 %, crits, flat armour, Pierce, weapon speeds, Recruits punch 1; proposed level table) | engineer | `systems/combat-numbers` (`sc`) | **merged** 68901a22 (director's gate on the merged result: 5887 tests, cycles, build; work change accepted under brief220-C1 on every hero scenario, S4 same, catch-up identity and fidelity hold; `main` control run same work, no regression; C1 p50 within ~5 %, p99 up 5–23 % from longer, overlapping fights). Owner by phone: Goblin Chief stays tough (craft gear to beat it), level-1 coin toss kept, unarmed promoted heroes punch with style and XP, Block removed | Sat | Sat |
| C2: gear and enemies (weapon styles, family abilities, enemy armour/Dodge/speed from the level table, enemy kinds) | engineer | `systems/combat-gear` (`sg`) | **merged** b050cdb3 (gate on main merged in: 5956 tests, cycles, build; same work everywhere, catch-up identity and fidelity hold). Director's calls: Recruits refused weapons (tools still fine), a re-trained hero's old-style weapon stays in hand unused, no Venomous in C0 until C4; T-246 weapon line in the tooltip | Sat | Sat |
| C3: supplies (food as today, drinks stop healing, elixirs for 10 fights, the "used" bubble) | builder | `systems/combat-supplies` (`su`) | **merged** 55affd53 after three phone looks (chamfer frame sized to its contents, item-type tint, stacking, no elixir callouts; [record](../archive/eyecheck/2026-10-24_combat-c3.md)). Gate on the merged result: 5975 tests, cycles, build; same work. T-245 | Sat | Sat |
| C5: encounters | engineer | `systems/combat-encounters` (`se`) | **merged** 6b2c168e after two phone looks ([record](../archive/eyecheck/2026-10-24_combat-c5.md)): bosses and guardians from camps of one, an enemy camp's clock idle while full (a beaten one returns a full interval later), no node blocking, ~2 % ambushes, a Summoning Circle station, one-on-one waiting, "Beaten". Gate on the merged result: only the 7 known content-pinned reds plus the two load flakes (green alone); cycles; build; work change accepted under brief220-C5 (goblin-camp scenarios; S1, S4, S7 same) | Sat | Sat |
| C4: Poison, Burn and boss moves in the Rules system; old status engine retired | engineer | `systems/combat-statuses` (`st`) | **merged** f415b5d3 (gate on the merged result: 6019 tests, cycles, build; bench harness now expects 7 tick handlers, the status tick retired; same work everywhere). Director's calls: Poison and Burn ship as content in C0; Burn 3 ticks; the extra On Hit moment kept; the empty `hero.statuses` goes at the next accepted work change. T-247 | Sat | Sat |
| C0: first combat content pack, accepted by the director (guarded) | builder + director | pack `2026-10-24-combat-c0-first-content` | **synced** 0bdfa84f: copper sword, dagger, cleaver, greatsword, bow, wand; leather hat and chest (no recipe: no leather in plane 1); Valor and Ironskin elixirs (no recipe: no Alchemy station); Poison and Burn; Goblin level 5, Goblin Chief level 20 Brute (owner: Recruits need food to beat a goblin). Guard: no autosave newer than the last Sync. ⚠️ This browser's CMS workspace was **empty** at first (no stored workspace): Restore from Game first, then accept; id-diff after Sync showed only the pack's 28 ids. Owner: their own browser's workspace predates this; use Restore from Game before editing | Sat | Sat |
| C6: the combat screen | engineer | `systems/combat-screen` (`sx`) | **merged** 89bfd454 after four phone rounds ([record](../archive/eyecheck/2026-10-25_combat-c6.md)): bars "number · %", fight chip, side floats, the fight plate, the panel (battlefield strip, hero left, versus card, log closed: this fight and last fight), the enemy card, the away summary's Fights block; callouts and bubbles above the number; elixirs 10 to 1. 6493 tests, cycles, build, same work; `bench:draw --compare --only=S2` no regression. **Brief 220 complete.** Open for the owner: loot lying over a fighter's number | Sat | Sun |

## Backlog director, after brief 210: follow-ups (owner 2026-10-24: frames round two after the bubble row) — **all done, merged 7f6a1166**

| Phase | Tier | Branch (worktree) | State | Planned | Done |
|---|---|---|---|---|---|
| T-242: pixel frames round two: second audit of tiles, slots, buttons, toggles, rows; Bank tiles without soft borders | builder | `backlog/pixel-frames-2` (`gf`) | **merged** 8c7096b5 (owner ok by phone; kit pieces into UI_STYLE fba5e2f2). Merged gate on top of combat C4: 6039 tests, cycles, build, same work | Sat | Sat |
| Work plate picks the wrong Token (regression from T-239): bench token kind 100/100 on dbfc370b, 97–98/100 with the plate ('picked up the wrong thing' on presses beside overlapping Tokens) | engineer | `backlog/plate-pick` | **merged** af7a9103 (bug fix, no eye-check): the plate stood over the Token in the row below and took its presses; now a plate lets hover and presses through over any Token's circle (as flags do). Drag bench: token kind 100 % twice, full run 50/50 on all five kinds; same work, no timing regression | Sat | Sat |
| T-240: the drag bench's Shop and Bank kinds run again (harness only) | builder | `backlog/drag-bench-kinds` | **merged** 23c85a21 on the gate (bench only): Shop and Bank kinds 50/50 both passes. Token → mat showed 3 'wrong thing' misses (47/49, 49/50) where earlier runs were 50/50: bisecting (before the work plate vs `main`) | Sat | Sat |
| T-241: loot particles under the open drawers | builder | `backlog/particles-under-drawer` | **merged** 7d9c6f9f (fix, one capture): the particle canvas was outside the screen overlay; now the mat's flights sit under the drawers and pause while the Bank is open, the dock-lift flight on its own top canvas. Merged gate on `main` after the Systems director's test fixes: 6074 pass, the one failure a slow scan that passes alone (T-251); dock drags 60/60 | Sat | Sat |
| T-247: a station's gear tip above the work plate | builder | `backlog/gear-tip-over-plate` | **merged** 60e6671e (fix, one capture): the gear tip moved onto the shared tooltip; merged gate: only the 7 known failures from `main`, build ok, same work | Sat | Sat |
| T-244: nav orbs and the gear button without hover glow or scale | builder-lite | `backlog/no-hover-glow` | **merged** afd4ec28 (owner ok by phone): white pixel outline on hover. Merged gate 6083 pass, 0 fail. ⚠️ A fast-forward raced the Systems director's commit in the main folder and left my files staged; restored them to HEAD by name and re-merged cleanly | Sat | Sat |
| T-252: a selected orb gets a steady gold outline (owner) | builder-lite | `backlog/orb-selected` | **merged** 7f6a1166: gate 6083 pass, 0 fail (main gained only docs since) | Sat | Sat |
| T-251: slow scanning tests no longer time out under load | builder | `backlog/slow-scan-tests` | **merged** d35e661e (tests only): one cached read of src per test file, 30 s limit, EngineEventNames' alias search cached; under build load 0 timeouts. Merged gate on `main` ed622163: 6331 pass, 0 fail, build. CMSStudio's render test timeout: T-255 | Sun | Sun |
| T-243: callouts and speech in the pixel family | builder | `backlog/speech-pixel` | **merged** 48796bb2 (owner ok by phone; rule in UI_STYLE cbe81171): one SpeechFrame, tones bronze/gold/red. Merged gate on `main` after the test fixes: **6081 pass, 0 fail**, cycles, build, same work | Sat | Sat |

## Systems director, basic content (brief 240; owner 2026-10-25: start the engine gaps)

| Phase | Tier | Branch (worktree) | State | Planned | Done |
|---|---|---|---|---|---|
| K0: engine gaps (packs carry the Starter Camp; the tutorial gives the ticked maps after a copper tool and a goblin; first-kill drops; the Bog; Hall prices by plane) | builder | `content/engine-gaps` (`ke`) | **merged** 63c8d4c0 (6537 tests, cycles, build; same work; draw no regression). Owner by phone: Bog ok (bright ponds for now), Hall prices ok (tune later), tutorial lines ok ([record](../archive/eyecheck/2026-10-25_content-k0.md)) | Sun | Sun |
| K1: pack 1, the Starter Camp and plane 1 | builder writes, owner accepts | `cms/incoming/applied/2026-10-26-basic-content-k1.json` | **synced by the owner** 72ce473d (2026-10-26); id-diff: only the pack's entries changed. 24 content-pinned tests red, being fixed (K1c) | Mon | Mon |
| K1c: tests after the K1 and K2 Syncs | builder | `fix/content-tests-k1` (`ck`) | **merged** bcd8957c (6598 tests; tests only): the Bee's stealth was a stale test (stealth enemies work end to end; the allowed styles now come from the matchup table); the Copper Chest band fixed by pack 2's 10 s | Mon | Mon |
| K2: pack 2, plane 2 | builder writes, owner accepts | `cms/incoming/applied/2026-10-26-basic-content-k2.json` | **synced by the owner** cb493683 | Mon | Mon |
| Tannery station kind | builder-lite | `systems/tannery-kind` (`tk`) | **merged** 98a53056 (6600 tests + T-256, a load timeout green alone; build) | Mon | Mon |
| K3c: 5 tests after the K3/balance Sync, T-256 closed; the golden for the follow-up's Fire Chief move | builder-lite + director | `fix/content-tests-k3`, `fix/golden-fire-chief` | **merged** 7de0da05 (6601 tests green) | Tue | Tue |
| K-fu: follow-up pack: bosses drop modifiers (plane 1: 3/2/1 %, plane 2: 5/3/2 %); the Fire Elemental Chief burns every 3rd hit | builder writes, owner accepts | `cms/incoming/applied/2026-10-26-bosses-followup.json` | **synced by the owner** 6b63c8e9; id-diff clean. The writer found its earlier duels never ticked poison/burn: Greater Slime (16 meals), Queen Bee (prepared win 23/50), Toxic Frog (39/50) are hard. **Owner 2026-10-27: keep them hard** | Tue | Tue |
| K3: pack 3, modifiers and caches | builder writes, owner accepts | `cms/incoming/applied/2026-10-26-basic-content-k3.json` | **synced by the owner** 58d02d01 with the balance pack; id-diff clean (Fir Grove deleted as accepted). 5 tests red, being fixed | Mon | Mon |
| K-bal + K1b: the balance pack | builder writes, owner accepts | `cms/incoming/applied/2026-10-26-balance-k1b.json` | **synced by the owner** 58d02d01 | Mon | Mon |
| K4a: reachability test: from a new game, every plane-1 and plane-2 material, tool, building and the first plane-2 map can be had | builder | `content/k4-reachability` (`k4r`) | **merged** 17ffd5f8 (tests only; 6607 tests, cycles 0; checked the plane rule against `items.json`: 7 zero-weight maps = plane 2). Everything reachable; 12 named exclusions: 10 later-plane metals, Lemon and Lime (owner question below) | Tue | Tue |
| K4b: the play-through: a new game through the Starter Camp, a plane-1 Region, a boss's first kill and the first plane-2 Region, with 1920×1080 shots for the owner | engineer | `content/k4-playthrough` (`k4p`) | **eye-check** (merged b264eae4: docs and 27 shots; [file](eyecheck/2026-10-27_basic-content-k4.md)). All four stages work; the tutorial stalled at the Old Site step (shortcut used); Wolf Alpha first kill → Yellowstone. Director checked the stall, the stuck hero, the copper-tool text and the Fighter gate in the code | Tue | Tue |
| T-257: a hero pulled out of a fight stays marked as fighting (no healing, no eating) | builder | `fix/hero-stuck-fighting` (`t257`) | **merged** 51600e25 (6616 tests, cycles 0, build; bench same work; its timing ran beside another build, so a quiet `main` control after T-257 + T-259: same work, only S2 p99 1.23 against the pre-C1 baseline) | Tue | Tue |
| T-259: tutorial without the Old Site step (owner: remove; T-258 puts it back with the ruins); copper-tool text fixed | builder | `fix/tutorial-no-old-site` (`t259`) | **merged** 9d8d20c5 (6611 tests, cycles, build; old saves on that step move on with no engine change, three tests pin it). New text: make a Copper Pickaxe or Woodaxe at a Copper Smithy. Engine work check rides on the post-T-257 bench of `main` | Tue | Tue |
| T-260: Recruits may hold copper weapons (owner 2026-10-27); owner chose a weapon Tier box in the CMS (no field said copper) | builder | `feat/recruit-copper-weapons` (`t260`) | **merged** 79c6b01c, plays as before until tiers are set (untiered weapons refused): 6631 tests, cycles 0, build, same work (p99 tails 1.20–1.37 vs the old baseline, noted for the retake). Recruits swing a Tier-1 weapon's damage and speed, any style, no style or XP; promotion recalculates gear abilities. Owner synced the tiers 52520231 (copper 1, iron 2; id-diff: only `tier` fields added); the owner checks it in K4 check 5c | Tue | |
| C6c: fight bars and numbers drawn above floor loot (owner 2026-10-25) | builder | `systems/fight-bars-over-loot` (`lb`) | **merged** a938c66c (6512 tests + 1 luck-dependent EnemyKinds, green 16/16 alone; cycles; build; same work; drag bench flags 200/200 on a re-run) | Sun | Sun |

## Systems director, skill loops (brief 230; owner 2026-10-24: next, beside the rest of combat)

| Phase | Tier | Branch (worktree) | State | Planned | Done |
|---|---|---|---|---|---|
| S0: gap map (read-only) | engineer | — | **done**: [research/skill_loops_gap_map.md](research/skill_loops_gap_map.md). Order: S1a; S1b ∥ S6a; S2a ∥ S5; S3 ∥ S6b; S4 ∥ S2b; S7 ∥ S8; S9. Owner: a station out of input waits unless other work runs; a map's wheat patch is a ready-planted Field; no loud pop for rare catches; drinks only buff; supports never wear out. Director: S0 Q2, Q3 (80 % as a code constant), Q4, Q7, Q8, Q10, Q12, Q13 option A | Sat | Sat |
| S1a: 80 % speed-up floor, Grow Time axis (cached per Token), "stays where it stands" mark, stations and supports never wear out, help is free (owner) | engineer | `systems/skills-s1a` (`sl`) | **merged** da9d81cb (gate on the merged result: 6154 tests, cycles, build; work change accepted under brief230-S1a: the bench's buff and station fixtures never wear; S1, S7 same). T-253 tuning page, T-254 leftovers | Sat | Sat |
| S1b: gathering heroes wait silently ("Waiting for Copper Vein"), a station out of input says "Needs Coal", hero waits unless other work runs | builder | `systems/skills-s1b` (`sw`) | **merged** 04c24105 (gate on the merged result: 6189 tests, cycles, build; same work). Shots sent to the owner as a heads-up (the brief's look is S9). Director: S1b Q1–Q4 option A | Sat | Sat |
| S2a: Forestry: Tree → Stump → Sapling → Tree, a same-species Forest in reach, a seedling per Sapling, Forests plant within reach, wild Forests and Stumps clearable | engineer | `systems/skills-s2a` (`sf2`) | **merged** 9a97a8e3 (gate with Fishing merged in: 6288 tests, cycles, build; same work; catch-up level on a living day, +2 s/day per 56 stopped Stumps). Director: Q1–Q4 as built, Q5 S8 ticks staysPut on Stumps | Sat | Sun |
| S3: Mining: veins rest and refill all at once, a shared empty-rock sprite, Mines (25 % double ore each, stacking), Minecarts (work time, floor) | builder | `systems/skills-s3` (`sm`) | **merged** 22838e10 (6352 tests + one known luck-dependent AdjacencyEffects test, green 9/9 alone (T-250); cycles; build; same work). Included an unbriefed engine fix, read and accepted: a Token that refills mid-tick works only the part after the refill (catch-up identity) | Sun | Sun |
| S5: Fishing: water never runs out, catch pools per water × tool × bait, bait spent per catch, Dock speeds, no loud pop for rare catches | engineer | `systems/skills-s5` (`sp`) | **merged** 13d41e6a (gate on the merged result: 6223 tests, cycles, build; same work). Owner 2026-10-24: **the cage is called Trap and is a starter tool**; probably no net item. Director: Q3 option A | Sat | Sat |
| S5b: the cage tool kind becomes the Trap and a starter tool (old saves get a newly added starter once, if they own none of that kind); CMS pricing of pool-only fish | builder | `systems/skills-s5b` (`s5b`) | **merged** edfe1077 (6364 tests, cycles, build; same work) | Sun | Sun |
| S4: Farming: Fields grow themselves, crop picked as a Farming recipe and sticky, a load of harvests, the last replants for a seed, Herb Gardens, Well, Composter (a new Crop Load axis), Beehive, Windmill; a wild wheat patch starts ripe | engineer | `systems/skills-s4` (`sfa`) | **merged** 608994cd (6441 tests, cycles, build; same work; catch-up +2.4 s/day per 40 Fields). S3's resting sprite became one state-sprite hook. Director: Q1 A (wild patch starts ripe), Q3 A | Sun | Sun |
| S4b: the CMS sim prices a crop's seed once per sowing (divided by its load) | builder | `systems/skills-seedprice` (`ssp`) | **merged** 84a63f3b (CMS only; 6449 tests, build) | Sun | Sun |
| S8: the skill loops content pack | builder writes, owner accepts | `cms/incoming/applied/2026-10-25-skill-loops-content.json` | **synced by the owner** 47d19bec (2026-10-26). Director's id-diff: only the pack's entries changed, plus Recalculate's prices on Shrimp, Flour, Dough, Oak Seedling, Beeswax Comb; nothing removed. 68 content-pinned tests red, being fixed | Sun | Mon |
| S8c: tests after the Sync | builder | `fix/content-tests-skill-loops` (`ct`) | **merged** 0496b717 (6564 tests, build): 68 reds fixed; real gaps fixed: NewGameOpening reachability now counts catch pools; the chain audits expand effect refs; the recipe drift alarm solves against the shipped world (stricter, byte-identical) | Mon | Mon |
| S8b: a positive XP bonus always adds at least 1 XP | builder-lite | `systems/xp-floor` (`sxp`) | **merged** (6456 tests, cycles, build; same work). `SkillSystem.applyXpBonus`, with a float-noise guard; a tile bonus and a hero bonus each get the floor; combat XP shares it | Sun | Sun |
| S9: the play-through on the real content | builder captures, director writes | — | **eye-check ready**: [file](eyecheck/2026-10-26_skill-loops-s9.md), 45 shots, 14 rough edges for the owner to rank | Mon | |
| S7: seeing support effects (highlights with effect tags while placing, "Boosted by" / "Boosts" on the card, quiet pops) | builder | `systems/skills-s7` (`s7`) | **merged** f0be3db8 (6507 tests, cycles, build, same work; `bench:draw --compare --only=S2` no regression; drag bench 50/50 every kind, both passes). Director: Q1–Q3 option A. Look in S9 | Sun | Sun |
| S2b: Orchards: fruit trees picked, Bare rests, refill needs an Orchard in reach | builder | `systems/skills-s2b` (`sor`) | **merged** bc8d4d83 (6386 tests, cycles, build; same work). Built only the gap: `respawn.needsNearby` on a refill, the Bare tree's mark and words, waiting only on a tree that is coming back; fixes for CMS renames of growth lists and a lingering mark | Sun | Sun |
| S6b: work potions (spent when their own skill's cycle starts, for the cycle) and drinks as work buffs for 10 cycles; consumables act only through their moment | engineer | `systems/skills-s6b` (`sb6`) | **merged** cc7e800c (gate with Forestry merged in: 6319 tests + 12 file-scan timeouts under another session's load, all green alone; cycles; build; same work). A new carried "On Work Start" moment (the old one reads wrongly on items); a carried rule no longer also fires at cycle end. Director: Q2 option A (the bubble every cycle). Owner 2026-10-25: **Water, the juices and every drink get a small work buff** (S8 content) | Sun | Sun |
| S6a: per-station recipe pools (Furnace, Smithy, Kitchen, Brewery, Workbench, Alchemy Table, Summoning Circle as kinds), drinks stop healing | builder | `systems/skills-s6a` (`sr`) | **merged** 51be448f (6176 tests, cycles, build; same work). Opt-in: S8 must tag every station and recipe (list in the builder's report: Furnace and Smithy recipes, anvil retired but kept as a type, Campfire a Kitchen with no fuel, Brewery, Alchemy Table) | Sat | Sat |

## Backlog director, batch F: look-wide passes (brief 210; owner said go 2026-10-24: both, mock-ups first) — **done, merged eb969849; brief 210 complete**

| Phase | Tier | Branch (worktree) | State | Planned | Done |
|---|---|---|---|---|---|
| F1: pixel frames on every window, audit first (T-136) | builder | `backlog/pixel-frames` | **merged** 4fee0e7c (on top of the Systems director's combat C1): audit committed; tooltips, modal shell, Token Summary, catch-up chamfer; Bank, Shop, hero panel studs (warm near-black). Owner ok by phone; asked for **a second audit** (soft borders on Bank item tiles etc.): T-242 (F1b, after the bubble row), plus T-243 callouts, T-244 nav orbs. Merged gate: 5891 tests, cycles, build, same work | Sat | Sat |
| F2: one bubble row between a hero and the Token it works (T-239): 2–3 mock-ups on the style sheet page first, owner picks; measure before and after | engineer | `backlog/bubble-row` | **merged** eb969849: the quiet plate (C), floaters off; draws cheaper than `main` (cap128 16 heroes 3.2×: 68.5 → 75.7 fps). Gate 6000 tests, cycles, build, same work. Owner ok by phone; charges with no hero at work now change silently (owner: fine). Gear tip under the plate: T-247 | Sat | Sat |

## Backlog director, batch E: drawers, the Atlas and dev tools (brief 210; owner said keep going 2026-10-24) — **done, merged 56136a65**

| Phase | Tier | Branch (worktree) | State | Planned | Done |
|---|---|---|---|---|---|
| E1: drawers to the screen's left edge; opening the Bank moves the rest smoothly (T-235, T-236); drag bench if drag measuring is touched | builder | `backlog/drawers` | **merged** 7b7244ef: drawers to the left edge, Bank opening slides the rest (0 mat redraws, no refit). Gate 5864 tests, cycles, build, same work; drag bench 300/300 on the kinds it runs (Shop and Bank kinds skipped, T-240; hand-checked by the builder). Particles over the open drawer: T-241 | Sat | Sat |
| E2: the Atlas's Regions as a two-page spread (T-237) | builder | `backlog/atlas-spread` | **merged** 3398be7d: Regions as a two-page spread (ground preview once per selection, facts, landmarks, actions moved from the rows; the active flag now visible). Gate 5854 tests, cycles, build, same work | Sat | Sat |
| E3: retire the Playmat Tuner and the terrain dev section, mat dials in the QA panel (T-238); no eye-check | builder-lite | `backlog/dev-tidy` | **merged** 56136a65 on the gate (owner-only tools): 5858 tests, cycles, build, same work. Stale research capture scripts that clicked the Terrain section: `top_bar/capture_top_bar.mjs`, `ground_gen/capture_biomes.mjs`, `place_today.mjs` | Sat | Sat |

## Backlog director, batch D: the Guild Hall upgrade screen (brief 210; owner said go 2026-10-23) — **done, merged e6abf4e2**

| Phase | Tier | Branch (worktree) | State | Planned | Done |
|---|---|---|---|---|---|
| D1: calmer sky: no toasts or stubs over the screen, smooth drift, stars grey/blue/gold (T-231 to T-233) | builder | `backlog/hall-sky` | **merged** 02cb806b: no toasts or stubs over the screen, linear glide (owner; draws level), grey/blue/gold stars (blue = affordable now), outlines on hover only (owner; the pinned star's always-on outline went too). Merged result: 5825 tests, cycles, build | Fri | Fri |
| D2: Hall Effects popover from the central star, Inspect panel in pixel style, the camera glide back (T-234, T-194); after D1 | builder (panels), engineer (glide) | `backlog/hall-panels` + `backlog/hall-glide` | **merged** e6abf4e2: Effects popover on the Hall star, Inspect in the pixel kit, the glide up and down (owner: keep the 0.2 s start back; other views land at once). Glide merged into panels by the panels builder (ReactRoot conflicts). Gate 5850 tests, cycles, build, same work, no timing regression; draw A/B in PERFORMANCE | Fri | Sat |

## Backlog director, batch C: Bank, items and the hero bar (brief 210; owner said go 2026-10-23) — **done, merged 957cb9ba**

Owner rulings 2026-10-23: a full Bank **refuses** an unequip (or dismissal) with a message, nothing lost or over the limit; old saves' shared copies go to heroes in roster order, slots the Bank can't cover emptied, one notice.

| Phase | Tier | Branch (worktree) | State | Planned | Done |
|---|---|---|---|---|---|
| C1: item tiles that say what they are: Bank inspect pane out, search in the header, full tooltip, category tints, slot icons (T-223 to T-225) | builder | `backlog/item-tiles` | **merged** 515d7154 (main 4440f8cc): inspect pane out, header search, full tooltip, tints by `type` (owner ok; UI_STYLE rule added), slot marks as placeholders (art list) | Fri | Fri |
| C3: one item, one hero: equipping moves the copy out of the Bank (T-230); tests first; WORK CHANGED possible | engineer | `backlog/one-item-one-hero` | **merged** d66c1ee8: copies move out of the Bank on equip; refusals; hand-over between heroes; old saves settled at load before the catch-up; QA panel Gear section (Fill the Bank; old-save test, use a test slot). Combined gate with C1 on a quiet machine: 5808 tests, cycles, build, **same work, no timing regression**. No dismissal exists yet: whoever builds it must return held copies or refuse on a full Bank | Fri | Fri |
| C2: hero bar portrait + name, shine on equip, Work Permissions button and drawer (T-226 to T-228); after C1 | builder | `backlog/hero-bar` | **merged** 957cb9ba after a redo: round 1 changed the wrong bar (horizontal); the owner meant the Bank's vertical hero tabs. Round 2: horizontal bar byte-identical to before, Bank tabs show portrait + name, Work Permissions rows share the portraits, shine and Work Permissions kept. Gate 5820 tests, cycles, build, same work, no timing regression; merged result 5822 tests, build. Record: `docs/archive/eyecheck/2026-10-23_backlog-BC.md` | Fri | Fri |
| C4: "New!" on an item stub clears on hover or pin (T-229); no eye-check | builder-lite | `backlog/new-badge` | **merged** eb6c459b on the gate (no eye-check): `ItemStubs.clearNew` on hover, `pin` clears it too; 5810 tests, cycles, build, same work | Fri | Fri |

## Backlog director, batch B: clean-ups on the mat (brief 210; owner said go 2026-10-23) — **done, merged b0528da0**

| Phase | Tier | Branch (worktree) | State | Planned | Done |
|---|---|---|---|---|---|
| B1: quieter Tokens: name badge below the Token, no ring under movable Tokens, no quest-ready glow, no tutorial beacons (T-218 to T-220) | builder | `backlog/quiet-tokens` | **merged** 6c28d269 (main af6b21c7): names below Tokens and heroes (owner's pick), no movable ring, no quest glow, tutorial overlay removed; tips over names left, done quests unmarked until the tutorial redesign (owner) | Fri | Fri |
| B2: drag and loot without the wash: only forbidden cells tinted while dragging; loot lands without afterimages, twinkles or bursts (turned off, kept) (T-217, T-221) | builder | `backlog/drag-loot` | **merged** af6b21c7: forbidden cells only (soft red, owner ok), five loot effects off in `lootEffects.js` (owner added the pile dissolve and pulse; shadow kept). Combined gate with B1 on a quiet machine: 5762 tests, cycles, build, **same work, no timing regression** (the earlier timing flags were agents running alongside) | Fri | Fri |
| B3: an enemy or flag picked up flies in from the screen's corner (T-222); after B1 (shares `MatToken.jsx`); drag bench | builder | `backlog/pickup-flight` | **merged** b0528da0. Cause: dnd-kit's default source measure takes the element's own transform off, and enemies and mat heroes are placed by a transform from the mat's corner; fixed in `DndKit.jsx` (`measureDragSource`), red-first test. Measured: enemy 1323 px → 0, mat hero ~1300 px → 0–1, others 0. Gate 5764 tests, cycles, build, same work. Drag bench: 49/50 flags once (a walking hero under the press), `main` control 50/50, re-run 400/400 flag and hero: a race, not the fix. Shop and Bank kinds skipped on both: T-240. No eye-check (bug gone) | Fri | Fri |

## Backlog director, batch A: the mat and its top bar (brief 210; owner chose and said go 2026-10-22 evening) — **done, merged cd9d2f2c**

Owner away from the PC 2026-10-23 to 2026-10-25, rulings 2026-10-22: **looks
by phone screenshots, the owner's ok merges** (hands-on feel listed for their
return); **benches may run any time while they are away** (still one at a
time, never beside a build); design questions answered any time.

| Phase | Tier | Branch (worktree) | State | Planned | Done |
|---|---|---|---|---|---|
| A1: mat a little wider and shorter (T-211) | engineer | `backlog/mat-size` | **merged** 484ba572 (main cd9d2f2c). Owner picked (b) 12 × 6.5 = 1920 × 1040 from phone captures; bench boards pin their own 11 × 0.64 mat; load and travel pull Tokens inside before the catch-up; a stored dev-tuner 11 retired (director's catch). Gate 5770 tests, cycles, build; work check **same work** (first-run timings S4–S6 ×1.2–1.3 straight after a suite, re-runs ×1.04–1.17, `main` control ×1.09: noise) | Thu | Fri |
| A3: more room between Tokens, flag reach 164 → 240, a crisp gold pixel reach ring (T-215, T-216); WORK CHANGED expected | builder | `backlog/flag-reach` (`bf`) | **merged** 70e04760 (main 1a61d85e). Gate: 5758 tests, cycles, build; **owner ok by phone** (one-pixel ring as it is, hitbox 90 % right, enemies at 240 fine for now). Work check: WORK CHANGED on every scenario; a control run with 164 and 80 put back was same work, so accepted under T-215+T-216 in `bench/baseline.json`. Timings read S4 refusedWorst ×1.5, S6 p99 ×1.24 beside a running agent: different work, noise | Thu | Fri |
| A2: top bar on the Region's banner, larger, as wide as the mat (T-212 to T-214) | builder | `backlog/top-bar` | **merged** cd9d2f2c. Bar 76 px as wide as the mat; Region name at display size (`ui-text-bar-name`, UI_STYLE line); banner at 2× across the left column; a mode's warning takes the centre (owner: keep). Owner ok by phone after one round. Eye-check record: `docs/archive/eyecheck/2026-10-23_backlog-A.md` | Fri | Fri |
| Tidy-up (owner 2026-10-22: yes): remove the finished `ar` worktree; delete local branches fully merged into `main` (`git branch -d` only) | director | — | done: `ar` removed (junctions unlinked first, real packages intact); 134 merged branches deleted with `-d`; kept the two unmerged ones, `atlas-wip` and `crunch/style-p2` (the dropped shadows, a record) | Thu | Thu |

## Features director, the Envelope (brief 90) (owner 2026-10-21: cleared for 13:00; any issue found becomes a ticket for the next pass)

| Phase | Tier | Branch (worktree) | State | Planned | Done |
|---|---|---|---|---|---|
| Timing baselines retaken on a quiet machine (engine and draw) | director | `main` | engine: done 13:00, committed f19a2e30. Draw: run refused to save (Chrome delivered ~5× for the 4× scenes, the bench's guard); retry queued 01:00 Thu (timer running) | Wed | Wed |
| E1: measure the limits at perf build, 4× slowdown, smooth (Tokens on a Region, heroes, enemies, loot piles, fights, notifications per minute, 24 h catch-up) | engineer | `crunch/envelope` | merged a131619c (envelope scenes, `--slowdown-target`, PERFORMANCE "Performance Envelope (2026-10-21)"; no game behaviour) | Wed | Wed |
| E2: the limits as design rules in GDD §14; T-071 decided against them; issues as tickets | director | `main` | done d4021ec7: GDD §14 from the owner's rulings (the 128 board is the reference for now; keep 256, fix the catch-up; fix the loot hover; park T-071); T-197 to T-210 filed | Wed | Wed |

## Features director, wrap-up round 1

**Rounds 1 and 2 merged to `main` 2026-10-21 (fa214742), owner eye-check "ok for now, refine later" (T-196 afterimages). Owner Recalculate + Sync done 11512fbc: 25 descriptions only, checked; round-trip tests pass on real data.** (owner 2026-10-20: wrap up the outstanding list faster, more agents; two rounds of four, then the Envelope; rule changes accepted under the old rulings)

| Phase | Tier | Branch (worktree) | State | Planned | Done |
|---|---|---|---|---|---|
| Fix main: Recalculate covers map items; quest tests and the rules golden for authored maps | builder | `fix/maps-recalc-tests` (`fm`) | merged (tests only: maps are unpriced by the A5 design, so Recalculate correctly skips them; Rule 6, the runner, quest tests and the rules golden made map-aware; a 1-in-4 bounty-map flake pinned). Owner: no CMS steps | Tue | Tue |
| (Owner Recalculate + Sync 5a6970cf, Tue evening: values only, 17 lines in items.json, no ids changed; the 7 round-trip/drift tests pass again.) Game-rule cleanups: T-125 skill speed, T-098 hero energy, T-017 kill loot rules, T-018 crafted charges, T-022 rate trackers on load, T-023 combat XP multiplier (WORK CHANGED accepted under the rulings) | builder | `crunch/rules-cleanup` (`rr`) | merged d96e5912 (T-023, T-022, T-125, T-098, T-017; T-018 closed obsolete by the owner; gate: 5556 tests, the 7 CMS round-trip/drift tests red until the owner's Recalculate + Sync, as agreed; cycles; build). WORK CHANGED expected (T-125 everywhere a staffed Token runs, T-017 wherever board kills happen), accepted under the rulings at the next bench | Tue | Tue |
| Hygiene sweep: ~26 dead-code and stale-comment tickets (T-045…T-064, T-093, T-094, T-103, T-108, T-139, T-140, T-163, T-068, T-116), no behaviour change | builder | `crunch/hygiene` (`hy`) | merged 0bad0a46 (26 commits, −700 lines; 16 tickets closed by the agent, T-053/054/056/094/103 narrowed, T-059/063/108/140/116 left with reasons; gate: 5546 + the 7 expected red; cycles; build). Work check expected same: in tonight's 01:00 run | Tue | Tue |
| UI consistency: T-029, T-030, T-031, T-032, T-036, T-038, T-039, T-040, T-041, T-042, T-121, T-122, T-134, T-135, T-191, T-043 | builder | `crunch/ui-consistency` (`ui`) | eye-check (16 tickets on `crunch/ui-consistency`, main merged in; T-043 not reproducible, close; agent's gate: only the then-expected reds). Combined with the sky on `crunch/eyecheck-r1` (p23b, 5198): the Guild Hall screen conflict resolved by taking the sky's version and re-applying the UI rules (no pixel font, shared text steps); director's gate there: full suite green but one test, fixed (5617 + fix), cycles, build. [file](../archive/eyecheck/2026-10-20_wrapup-r1.md) | Tue | Tue |
| Atlas rework (T5 + T6), owner: "good place for now" | — | `crunch/atlas-rework` (`at`) | merged 98bd5d8a (gate on the merged result: 5570 tests, cycles, build) | Tue | Tue |
| Hall sky (brief 160 T3; T-171, T-128) | builder | `crunch/hall-sky` (`hs`) | eye-check on `crunch/eyecheck-r1` with the UI batch | Tue | Tue |
| Docs and tooling: T-119 strings file, T-069, T-070, T-124, T-118, T-111 | builder | `crunch/docs-infra` (`dx`) | merged 9a103fbb (gate: 5565 tests, cycles, build; T-069, T-070, T-124, T-118, T-111 closed; T-119 narrowed to converting old screens) | Tue | Tue |
| Tools as hero gear (T-126) + a content change pack | engineer | `crunch/tools-gear` (`tg`) | eye-check on `crunch/eyecheck-r1` (6 commits + the QA size fix; gate after merging main: 5618 green; pack 46 entries OK; expected work check: same). Owner answers: an ore needs the pick of the tier below, no Rusty tools (Copper starters), keep the old-save grant and the 8 s bubble; the agent is updating the pack | Tue | |
| Engine plumbing: T-015, T-016, T-019, T-020, T-021, T-035, T-065, T-097 | engineer | `crunch/engine-plumbing` (`ep`) | merged 48fd719c (8 tickets; merged main cleanly; gate: 5599 green, cycles, build). Work check: WORK CHANGED expected from T-065 (bank/sprite hashes) and T-035 (S3 positions), accepted under the tickets; the rest same. T-195 for two terrain-file leftovers. Owner defaults kept (shipped builds ignore stored tuner values; Disallow says "No hero works this") | Tue | Wed |
| Drag hitches and flag misses: T-033 (P1), T-132, T-187, T-186, T-143 | engineer | `crunch/drag-hitches` (`dh`) | eye-check on `crunch/eyecheck-r1` (T-033 cause: a `[data-item-stubs] *` drag rule restyled ~2,200 elements per pickup/drop, now ~300; T-186 sheet after the drop; T-143; T-132 a hero's health bar counts as the hero; T-187 bench names each miss; director: `--compare` same work, no timing regression; gate 5613 green; on the preview branch 5719 green) | Tue | Wed |
| Animation batch (T-137, T-154, T-155) | engineer | `crunch/animation` (`an`, built on `crunch/eyecheck-r1`) | eye-check (14 commits; tinted copies as generated pictures, measured cheaper than CSS masks; no `Math.random` in visuals; gate 5756 green; director's `--compare`: same work; one S4 'worst' timing flag, engine-only bench, main control run clean: noise). The preview branch fast-forwarded to it | Wed | |

**Round 2 (next):** the animation batch and motion (T-137, T-154, T-155); the Hall's sky and tilt (brief 160 T3, T4; T-171, T-128, T-194); engine plumbing (T-015, T-016, T-019, T-020, T-021, T-035, T-065, T-097); drag hitches and flag misses (T-033, T-132, T-187, T-186, T-143); tools as hero gear (T-126, designed today) and the strings file (T-119); docs (T-069, T-070, T-124, T-118, T-111). Then brief 90, the Envelope.

## Features director, batch 6: the Atlas tome, first half

**Merged to `main` 2026-10-20 (5f3c3e0d) on the owner's word ("4x looks best, go with that and merge"); work check owed at 13:00 with batch 5's.** (owner 2026-10-20; quest board postponed by the owner)

*T1 then T2 on one branch, one eye-check after T2. The flaky-test fix runs
alongside. Banners without a CMS pick default by the Region's main biome
(owner, 2026-10-20).*

| Phase | Tier | Branch (worktree) | State | Planned | Done |
|---|---|---|---|---|---|
| Brief 160 T1: the Atlas as a tome (~90 % of the window), bookmark tabs and page turn, Cartography over both pages, drag maps to slots (T-172) | builder | `crunch/atlas-tome` (`at`) | ready (d1a0ed96; director's gate: 5511 tests, cycles, build; no `src/systems` touched; QA → Atlas → Grant test maps for the eye-check). Look questions: Regions or Cartography first; dark panels over the pages; Reroll/Cancel as framed text buttons | Tue | Tue |
| Brief 160 T2: Region rows on area banners, Travel and the … menu, CMS banner field, top bar slice, arrival card, preview backdrop (T-173) | builder | `crunch/atlas-tome` (`at`) | ready (a775cbf6; director's gate: 5533 tests, cycles, build; no `src/systems` or `data/`; CMS banner picker on Base Maps and the Starter Camp page). Look questions: two columns of rows, the four stand-in biome banners, the crop, the … icon | Tue | Tue |
| Brief 160 T1b (owner 2026-10-20): the owner's book sprite at 4×, mirrored for the left page, the UI inside the pages | builder | `crunch/atlas-tome` (`at`) | ready (6ff6b483; director's gate: 5535 tests, cycles, build; fixed 4×, fits 1280×720 with ~50 px of table each side; about 60 % of the mat column at 1600×900: look question) | Tue | Tue |
| Brief 160 T4a (owner 2026-10-20): the mat and the book on one wood table; opening the Atlas is a camera move from the mat up to the book | engineer | `crunch/atlas-tome` (`at`) | set aside by the owner after the first look (the Atlas becomes a pop-up; the glide kept at tag `atlas-camera-move` for the Guild Hall upgrade screen, T-194) | Tue | Tue |
| Atlas pop-up (owner, first look 2026-10-20): slides up from the bottom over the undimmed mat, no table; the 256 px left and right pages; a QA switch for 2×/3×/4× so the owner picks the scale by eye | builder | `crunch/atlas-tome` (`at`) | merged 5f3c3e0d (e6e5c4e3 fixes 4×; director's gate on the merged result: 5536 tests, cycles, build) | Tue | Tue |
| Brief 160 T5 (eye-check with T6, same file): book tabs down the left side, slim Region rows with the hero flag (owner interview 2026-10-20) | builder | `crunch/atlas-rework` | eye-check (a8856ba3; tabs down the left, tucked or on the visible edge; rows 84 px with the base hero flag; director's gate: 5539 tests, cycles, build). Preview on 5198 moved to it. Look questions: the grey base flag on pale banners, the … menu on the last row, tab width | Tue | Tue |
| Brief 160 T6: Cartography as a crafting table (map sprite grid, 4 outline slots, the preview as a tiny real map, contents as sprites) | engineer | `crunch/atlas-rework` | eye-check (99e94efc, bf86777f, fbbd1253: map tile grid, outline slots, the preview runs the mat's own ground passes (byte-identical in a test), contents as 32 px sprites, no Cancel; ~100–150 ms per slot change or reroll, debounced, 0 at rest; director's gate: 5550 tests, cycles, build). Served on 5198 at fbbd1253, [file](../archive/eyecheck/2026-10-20_atlas-rework.md) | | Tue |
| Brief 200 P1–P2: CMS change packs (autosave, inbox, review per entry, undo) (T-133) | builder | `crunch/change-packs` (`cp`) | merged 1b6c55af (gate on the merged result: 5554 tests + EngineEventNames timing out under load, 8/8 alone; cycles; build) | Tue | Tue |
| Brief 200 P3: the starting map items as a change pack (sprites from `tokens/map/`) | builder-lite | — | in the owner's CMS inbox (`cms/incoming/2026-10-20-starting-maps.json`, 11 maps, format check ok, game-code check ok); owner to review and Sync on `main` | | Tue |
| Flaky loot-landing test (T-192) | builder-lite | `fix/t192-flaky-loot-test` (`fx`) | merged (2aa314e8, test-only: -0 vs +0 compared with toBeCloseTo; 15 lone runs green, suite 5500) | Tue | Tue |

## Features director, batch 5: the recipe list and notifications

**All of this batch merged to `main` 2026-10-20 (9fa5572e), owner eye-check ok ("The tick is enough, no flash needed. Go ahead and merge."). Work check owed at 13:00 on `main`.** (owner 2026-10-19 chose this; build starts when the owner's token budget resets)

*Building since Mon 2026-10-19 morning (owner: go ahead; resume after the 5 AM budget reset if cut off). Suite on `main` before start: 5400 passed. Was planned only. R and N touch different files and may run as
two code agents at once if the terrain director is idle; otherwise one after
the other, recipe list first. One eye-check for both. At build start: run the
suite on `main` (not run at planning), read each brief, and tell each agent
which files the other holds. Notifications' hover highlight uses the gold
attention outline (ruled today).*

| Phase | Tier | Branch (worktree) | State | Planned | Done |
|---|---|---|---|---|---|
| **Combined eye-check branch** `crunch/batch5` (both merged, keep-both conflicts in CHANGELOG and the style sheet page) | director | `crunch/batch5` (`p23b`) | eye-check at http://localhost:5198/ ([file](../archive/eyecheck/2026-10-19_recipes-notifications.md)); director's gate on a3674433: 5446 tests, cycles, build. Notifications' own gate: 5434 | Mon | Mon |
| Brief 130 R1: the recipe list logic (T-169, absorbs T-142) | builder | `crunch/recipe-list` (`rl`) | ready (3cd47398; `RecipeList.js`, pure, 28 tests; director's gate on ed9949c0: 5413 tests, cycles, build) | Mon | Mon |
| Brief 130 R2: the list on screen, inside the Token card | builder | `crunch/recipe-list` (`rl`) | eye-check (ed9949c0; card flips in place and grows, gear opens the card on its list, old modal and bands deleted, Board.jsx edit as its own commit 319358dd by the director's leave; builder used it in the game on a furnace and a Wood Foundation). Look questions: the Back button, the `???` silhouettes on dark art; calls kept: can-run measured on the whole roster, merged dividers, byproducts at 32 px muted, cover-scaled art only in list view | Mon | Mon |
| Brief 150 N1: the store and routing for item stubs and banners (T-168, T-028, T-037; owner revised 2026-10-19, no log) | builder | `crunch/notifications` (`nt`) | ready (3ea827a6; `src/systems/notifications/`, routing table, pins in `ui.pinnedStubs`) | Mon | Mon |
| Brief 150 N2: item stubs on screen (net flow per item, hover panel, pins, Clear all; replaces the edge sidebar) | builder | `crunch/notifications` (`nt`) | eye-check (2f98f7f8, 4be5dd07; edge sidebar, Toast and ToastContainer deleted) | Mon | Mon |
| Brief 150 N3: banners on screen (top centre, gold milestones, red problems, stay until clicked, three then +N) | builder | `crunch/notifications` (`nt`) | eye-check (2f98f7f8; QA → Notifications triggers every case) | Mon | Mon |
| Item stubs, owner's eye-check rounds 1–3 (one line on hover, 1× sprites, content width, pinned always open; then calm order, no header, smooth slide and glide) | builder | `crunch/notifications` (`nt`) | eye-check (round 3 c0cb927b: calm order, no header, slide and glide; merged into `crunch/batch5` ba7de155) | Mon | Tue |
| Brief 150 N4 (owner, third look): collected loot flies to its stub instead of the Guild Hall; a copy pops out over the bottom stubs when the stub is out of view | engineer | `crunch/notifications` (`nt`) | eye-check (4114e6b6, 4fed7e5c: the count is held back until landing, Bank credited exactly as before, no engine file touched; director's gate on ba7de155: 5501 tests, cycles, build) | Mon | Tue |

## Features director, batch 1: the style kit (ruled 2026-10-17)

**All of this batch merged to `main` 2026-10-18 (b68cd020), owner eye-check ok.**

*The second director (owner, 2026-10-17) works the main queue; the terrain
director keeps the rows below. One code agent at a time here while terrain
runs one, so the PC holds two.*

| Phase | Tier | Branch (worktree) | State | Planned | Done |
|---|---|---|---|---|---|
| Brief 100 K1: the style sheet page, every standard UI piece live (T-159) | builder | `crunch/style-kit` (`k1`) | merged b68cd020 (ca5bf7ff; director's gate: 5106 tests, cycles, build) | Sat | |
| Brief 100 K2: one shared arrow-bar scroll list (T-160) | builder | `crunch/style-kit` (`k1`) | merged b68cd020 (14474430; director's gate: 5113 tests, cycles, build). Arrows now dim instead of hiding on the inspect column, pop-up and rank list (UI_STYLE); four look questions for the eye-check | Sat | Sat |
| Brief 100 K3: three text sizes and the shared tooltip (T-161, T-038, T-030) | builder (tooltip spans several files) | `crunch/style-kit` (`k1`) | merged b68cd020 (7060a37f; director's gate on the whole kit: 5126 tests, cycles, build). Sizes 18/16/14, display 32 proposed; tooltip on the Bank, Shop and hero panel | Sat | Sat |
| Recruits get a weak basic attack so the tutorial's fight can be won (T-167); owner authors a safe enemy in the Starter Camp afterwards | builder | `fix/t167-recruit-attack` | eye-check (6790962d, with the QA Hire button making roster room; director's gate: 5109 tests, cycles, build; director saw a fresh Recruit beat a Goblin in ~10 s on 5197: Bones on the mat, skills unchanged, the hostile Goblin hit first). Bench-queued (work check; builder expects same) | Sat | |

## Features director, batch 4: the mat, hover and the Token card (owner 2026-10-18 chose brief 120 next)

**All of this batch merged to `main` 2026-10-18 (b68cd020), owner eye-check ok.**

*Built on `crunch/map-tools`; merges after it. Two eye-checks: after C2 (mat
and hover) and after C3 (card). C1 needs a `bench:draw --compare` before and
after (director, quiet window); the engineer reports DOM counts meanwhile.*

| Phase | Tier | Branch (worktree) | State | Planned | Done |
|---|---|---|---|---|---|
| Brief 120 C1: the mat layer (progress bar, one problem mark, rings off at rest, health bars when it matters, block speech retired) | engineer | `crunch/info-layers` (`il`) | ready (6c7059d2; director's gate: 5245 tests, cycles, build). Elements per worked Token 10–14 → 3.4–4.9, mat total −8 %; bench:draw --compare and bench:crisp queued (watch: S2 heroes at 56/144 HP now show 8 health bars at rest). Five look questions for the C2 eye-check, at the recommendations meanwhile | Sun | Sun |
| Brief 120 C2: hover (outline at once, name and charges after ~150 ms, HP for heroes and enemies) | builder | `crunch/info-layers` (`il`) | eye-check (be0cf72e; one mat timer; director's gate: 5253 tests, cycles, build). The owner's preview on 5198 now serves a frozen copy (`ec`, detached at be0cf72e) so C3 can build in `il` | Sun | Sun |
| Brief 120 C3: the Token card | builder | `crunch/info-layers` (`il`) | eye-check (dd93f7a8; director's gate: 5272 tests, cycles, build; no `data/` or art touched). Preview `ec` moved to dd93f7a8 | Sun | Sun |

## Features director, batch 3: map tools (owner 2026-10-17: keep going with the larger implementations; fine refinements later)

**All of this batch merged to `main` 2026-10-18 (b68cd020), owner eye-check ok.**

*Owner's look so far (2026-10-17, late): the style sheet looks good; the shine
needs work (T-191, later); the Goblin fight doesn't start for the owner (being
diagnosed). The eye-check's eight questions stand at the recommendations
until the owner says otherwise in the refinement pass. Built on
`crunch/hero-bar`; merges after it.*

| Phase | Tier | Branch (worktree) | State | Planned | Done |
|---|---|---|---|---|---|
| Recruit's Goblin fight doesn't start in the owner's play (T-167 follow-up) | engineer | `fix/t167-recruit-attack` (`t167`) | diagnosed: no bug; the owner dropped near the Goblin and a hostile measured to the hero's idle spot (up-right of the flag), so a near drop fought on one side only (tests d6a50adc). Owner 2026-10-18 chose: hostiles measure from the flag, the same on every side. Ready (fd3de552, `Hostiles.js` line 119; director's gate: 5120 tests + one flaky loot test, T-192, passes alone, cycles, build). Work check will change on S2, S3, S5, S6, S8 (goblin camps): accept under this ruling | Sat | Sun |
| Brief 110 M1: Starter Camp Tokens become fixtures (T-165); one call in `atlas/StarterCamp.js`, logic in board code (terrain director's folder) | engineer | `crunch/map-tools` (`mt`) | ready (8d9c7e25; two lines in `StarterCamp.js`, logic in `FixedTokens`/`BoardState`/`Demolition`/`Placement`; also fixed the dev layout tool, which never lifted Tokens already on the mat; director's gate: 5188 tests, cycles, build). Two small owner questions left at the recommendations (a camp Foundation built on keeps the mark; the refusal wording) | Sat | Sun |
| Brief 110 M2: Demolish mode beside Disallow mode (T-166) | builder | `crunch/map-tools` (`mt`) | ready (109f1709; director's gate: 5200 tests, cycles, build). Three look questions for the eye-check (Allow all only in the banner; the reason only on click; outline grey, edge colour) | Sun | Sun |
| Brief 110 M3: top bar restyle (T-170) | builder | `crunch/map-tools` (`mt`) | eye-check (52beccc3, then `crunch/hero-bar` merged in; director's gate on the result: 5224 tests, cycles, build; frame pictures in LFS). Served on 5198 from `mt` for the one combined eye-check | Sun | Sun |

## Features director, batch 2: the hero bar (owner 2026-10-17: proceed while the kit's eye-check waits a few hours)

**All of this batch merged to `main` 2026-10-18 (b68cd020), owner eye-check ok.**

*Built on `crunch/style-kit` plus `fix/t167-recruit-attack` (merged into the
branch), so it uses the kit and everyone fights; it merges after both.*

| Phase | Tier | Branch (worktree) | State | Planned | Done |
|---|---|---|---|---|---|
| Brief 140 H1: Work Permissions drawer and launcher, one Combat column, purpose tooltips (T-164, T-156) | builder | `crunch/hero-bar` (`hb`) | ready (fe9d17c5; director's gate: 5150 tests, cycles, build; Fight priority proved by a test; drawer seen in screenshots). Eye-check with the bar | Sat | Sat |
| Brief 140 H2: the level-up moment (T-177, T-149) | builder | `crunch/hero-bar` (`hb`) | ready (32a39376; director's gate: 5160 tests, cycles, build; floats seen in screenshots). Draw compare queued for the cost log | Sat | Sat |
| Work Permissions cells square (owner 2026-10-17, from the screenshots: square cells so every skill fits even with the hero panel open; replaces the spread-evenly columns and settles the overlap) | builder-lite | `crunch/hero-bar` | ready (2053ca25; 32 px squares, drawer 856 px wide at 1600×900, Combat ends ~270 px clear of the open hero panel; director's gate: 5160 tests, cycles, build) | Sat | Sat |
| Brief 140 H3: the shine on main-action buttons (T-178) | builder-lite | `crunch/hero-bar` (`hb`) | ready (8251a1a7; Upgrade and Settle; no Craft button exists yet; director's gate: 5163 tests, cycles, build) | Sat | Sat |
| Work Permissions drawer centred (owner 2026-10-17: square cells look good; the drawer stays centred horizontally). Director's reading: centred on the visible mat, so with the hero panel open it centres in the space left of the panel and never sits under it | builder-lite | `crunch/hero-bar` | ready (04dba554; measured centred within 1 px at 1600×900 and 1280×800, panel open and closed; director's gate: 5165 tests, cycles, build) | Sat | Sat |

## Art pass, batch 1 (proposed and ruled 2026-10-15 evening)

| Phase | Tier | Branch (worktree) | State | Planned | Done |
|---|---|---|---|---|---|
| Bench baselines retaken on a quiet machine (T-181), engine and draw | director | `main` | engine: done Thu 22:11 (owner asleep, PC quiet), committed. Draw: refused twice (Chrome ran one 4× scene at ~5×, the bench's own guard), saved on the third run Fri 01:00–01:41 and committed | Thu night | Fri |
| The owed 4× drag pair for the placing grid: before (`1f8239b3`) and after (`main`), cap128 | director | `p23b` then `main` | done: Token drags level (median pickup 67/67 ms, carry 36/36, drop 73/73 plain); the grid costs nothing measurable. Both runs had 1–2 flag drags grab a neighbour's flag on the full board, before and after alike (T-187) | Thu night | Thu |
| The owner's art sessions on the bench and the brightness script, here with the director at the owner's pace (owner 2026-10-15); the bake when a preset wins (tag `art-before-vibrancy`, dated zip, art-only commit on `main`) | owner + director | `main` | first pass done 2026-10-16: **Drag 1.15 / 1.25 wins**; the bake waits for the asset reorganisation (owner) | owner's pace | |
| Dev panel's Scatter Loot button names real items (T-184) | builder-lite | `fix/t184-dev-items` → `main` | merged Thu night (gate on the merged result: 4964 tests, cycles, build, work check same) | Thu | Thu |
| Floor loot lands on its spot and draws crisp (T-183) | builder | `fix/t183-loot-offset` → `main` | merged Thu night (same gate; in the game the landed loot measured 40 mat units up-left before, 0 after; the stack slide fixed alongside so piles don't jump; a small look fix, no eye-check) | Thu | Thu |
| Asset names and folders: the ruleset ([ASSET_NAMING.md](../reference/ASSET_NAMING.md), approved 2026-10-16), the rename list (builder, done), then the apply (engineer), then the bake | builder → engineer | `art/asset-rename` (`rn`) | list approved by the owner 2026-10-16 (three rounds of answers on the review page); step 2 built and verified by the director (4995 tests, cycles, build, list and legacy-name checks; the branch build in the game: slot screen, Starter Camp, Bank, Guild Hall with 0 failed pictures; CMS button changes sprite fields only). merged Fri 11:40 (work check same; timing 1.2–1.28× under daytime load, `main`'s control run read the same). done: the owner's first Sync came from a stale CMS workspace (it dropped 16 Tokens, 14 items, 9 recipes; reverted unpushed-then-pushed as a revert); after Restore from Game the second Sync changed sprite names only (86 Tokens, 71 items, 25 recipes). 162 local git-ignored leftovers (archive, maybe, waste) moved to `_art_leftovers/` for the owner to drag out | Fri | Fri |
| The bake: Drag 1.15 / 1.25 into 623 sprites | director + owner | `main` | merged Fri: tag `art-before-vibrancy` (pushed), owner's zip on the Desktop, owner approved in the game ([archived eye-check](../archive/eyecheck/2026-10-16_art-bake.md)) | Fri | Fri |
| A4: dragged Tokens lose the old drag brightening (the art carries it now) | builder-lite | `fix/a4-drag-filter` → `main` | merged Fri 13:10 (gate on the merged three: 5009 tests, cycles, build; work check same; timing noisy under daytime load, no engine code changed) | Fri | Fri |
| T-180: a Studio button brightens the material palettes the same way, pressed by the owner | builder | `art/palette-brighten` → `main` | merged Fri 13:10 (same gate). Owner pressed it and Synced: 1868 of 1961 colours in 100 of 101 palettes, marker written, content counts unchanged | Fri | Fri |
| Hover brightening gentler, 1.06 / 1.08 (owner ruling) | builder-lite | `fix/hover-gentler` → `main` | merged Fri 13:10 (same gate) | Fri | Fri |
| ART_STYLE.md: a short record of what is settled (owner 2026-10-16: the owner directs the art; no style interview) | director | `main` | draft, for the owner's approval | Fri | |
| The CMS warns before a Sync removes content (T-188) | builder | `fix/t188-sync-guard` → `main` | merged Sat 01:03 (work check same; timing noisy, no engine code changed) | Fri | |
| The white hover outline on Tokens is gone (owner report; reproduced: no outline picture is requested) | engineer | `fix/hover-outline` → `main` | merged Sat 01:03. Cause: the dev server answered freshly redrawn outline pictures with the game page (Vite serves `public/` files only after its watcher reports them; the rename made it redraw nearly all at start). Fix: the dev server reads the generated folder from disk. Game code was fine; production builds were never affected | Fri | |
| Re-bake at Gentle 1.08 / 1.12 (owner found Drag too bright in play) | director | `main` | merged Fri 22:45: back to the original from the tag, then baked at Gentle; all 623 match the bench column the owner picked | Fri | Fri |
| Palettes back to original, button at Gentle | builder-lite | `fix/palette-gentle` → `main` | merged Sat 01:03; owner: press the Studio button on `main`, then Sync | Fri | Sat |
| Terrain design advice (owner's goal for the terrain pass) | director | [notes page](https://claude.ai/artifact/PLTLkP5bqjLqtTc8YYJSpg) | sections 1–9; owner ruled the path 2026-10-16: computed edges plus the owner's hand-drawn edge pieces, Sea of Stars as the target (brief 180) | Fri | |
| Brief 180 G1: ground structure in code (tint pattern, organic earth with rim and fringe, grouped props) | engineer | `crunch/ground-g1` → `main` | merged Sat (owner: a clear improvement, more to do; gate on the merged result 5053 tests, build) | Fri | Sat |
| Ground design rounds 1–9 with the owner (generated ground; [rounds page](https://claude.ai/artifact/LefBh8qULf3JCdqUBb9jFY)) | director | `docs/active/research/ground_gen/` | done: final prototype approved with softer camouflage; spec `final_spec.json` | Sat | Sat |
| Brief 180 G3: generated ground in the game (meadow and forest) | engineer | `crunch/ground-g3` → `main` | merged Sat 13:40 (owner: looks good; work check same; draw +0.05–0.1 ms at 1×, within noise) | Sat | Sat |
| Brief 180 G4: Mountain, Coast, per-look dapple, ground strength slider, and four new biomes (flower meadow, cherry grove, Yellowstone, volcano) | engineer | `crunch/ground-g4` → `main` | merged Sat 13:50 (owner asked to merge; gate green but T-190's flaky timeout; work check same; draw level with main) | Sat | |
| World generation design rounds W1–W7 with the owner ([world page](https://claude.ai/artifact/XFe5Kj6P1RC9KiMREUTTmc)) | director + owner | `docs/active/research/ground_gen/` | done Sat: water by biome, lakes up to a fifth, rivers (uneven split, braided), blend variety, beaches at the sea, layouts core-and-rim and patchwork; brief 180 G5–G7 | Sat | Sat |
| Brief 180 G5: water in every Region (lakes, ponds, tarns, rivers, smooth shores, sulphur lakes as water, Starter Camp pond) | engineer | `crunch/ground-g5` → `main` | merged Sun `103f9edc` (owner eye-check ok, [archived file](../archive/eyecheck/2026-10-17_g5-water.md); work check same; p99 timings 1.2–1.37x against the old baseline, and the control run of `main` read the same, so noise). Note for the features director: `crunch/map-tools` will conflict in `StarterCamp.js` (the camp pond) | Sat | Sun |
| Brief 180 G7: placement (natural clumps, kinds where they belong, rarer further out, camps and treasures with a reason) | engineer | `crunch/ground-g7` → `main` | merged Sun 627d01c8 with G6 (owner eye-check ok; gate on the merged result with the features stack: 5334 tests, cycles, build; work check same, timings inflated by agents testing alongside; draw A/B level earlier). Leaning answer: keep (A) | Sun | Sun |
| Brief 180 G6: blend styles at biome borders, beaches at the sea | engineer | `crunch/ground-g6` → `main` | merged with G7 (above) | Sun | Sun |
| Follow-ups from the G6/G7 looks: each cell's biome stored (same-ground pairs get their own look and blends); a river along a biome border as real water carved after placing | engineer | — | queued after P1 | | |
| Visual style study (owner: 3x too cluttered; why the mat and Tokens clash) | director | [V1-V2](https://claude.ai/artifact/MvC3ttno7ods7rcNgHKj2q), [V3-V4](https://claude.ai/artifact/GhryA48D1FJoHir3uhkSLn) | owner verdicts Sun: **Clean ground** (weaker colour, softer speckle, grass towards olive, woods towards blue-green) with **the game's hard shadow under resting Tokens** and a further one for lifted things; colour balancing and light washes rejected (looked like bloom; keep it sharp); **ground drawn at 2x pixel size** under 1x Tokens is appealing. V5 (Mon page https://claude.ai/artifact/9iuBYG1XU8nCLTtKPzGCvN): darker rim at the mat edge and quieter ground decorations kept; worn clearing, footpaths and base scatter rejected. V6 edge scenery dropped in that form (owner thinks of scenery on the map itself, later). V7 animation (https://claude.ai/artifact/VxDLR5aNDBarKjiWfdamuF): water shimmer, leaves, petals, embers, butterflies kept; the bird flock out. V8 verdict: too much movement; slow, lazy, subtle. V9 final feedback: clouds at a finer pixel, one shade level, a fixed silhouette per trip; birds one light colour per biome. Done: written as brief 190. Next with the owner: more experiments (worn ground and paths, mat edge, quieter ground decorations, motion), then a build brief | Sun | |
| Brief 190 P1: the ground's look (Clean palettes, ground at 2x pixel size, quieter decorations, darker rim) | engineer | `crunch/style-p1` → `main` | merged Mon 00c41b9c with P3 (owner eye-check ok, [archived](../archive/eyecheck/2026-10-18_p1-ground.md)) | Sun | Mon |
| Brief 190 P2: hard shadows under resting Tokens, a further one when lifted | builder | `crunch/style-p2` (`sh`) | **dropped by the owner after the look** (back to no shadow at rest, the basic hard shadow while dragging); not merged ([archived](../archive/eyecheck/2026-10-18_p2-shadows.md)) | Sun | |
| Brief 190 P3: ambient life (water shimmer, leaves/petals/embers, birds, an occasional gust, cloud shadows) | engineer | `crunch/style-p3` → `main` | merged Mon 00c41b9c (owner: looks good after the lag fix; questions as built; gate 5399 tests, cycles, build; work check same; draw A/B level with main; [archived](../archive/eyecheck/2026-10-18_p3-ambient.md)) | Sun | Mon |
| **Two directors (owner, 2026-10-17):** this session keeps the terrain and world generation; a second director takes other features. Terrain owns `src/systems/atlas/`, `src/systems/board/Terrain*.js`, `groundScreen.js`, `terrainRegistry.js`, `playmatTuning.js`, `src/ui/dev/terrainDev.js` and `docs/active/research/ground_gen/`. Shared on this PC: two code subagents at once in total, one heavy run (suite, build, bench) at a time, the owner's folder stays on `main` | — | — | standing | | |
| Later: Recruits get a weak basic attack (T-167); equip-by-drop opens the sheet a frame later (T-186, ruled 2026-10-15) | — | — | next batches | | |

## Wave 2 (Wed 14 – Sat 17 October), order ruled by the owner 2026-10-14

| Phase | Tier | Branch (worktree) | State | Planned | Done |
|---|---|---|---|---|---|
| P2-7 sparse stack order (also the z clamp at 256) | engineer | `crunch/p2-7` → `main` | merged (engine bench same work; boxes rewritten per move 122 → 2 on cap128; on a 256 board every Token keeps its own z, so flags no longer cover lower Tokens: a look fix you will notice, no eye-check) | Wed | Wed |
| P2-9 drags | engineer | `crunch/p2-9` → `main` | merged (engine bench same work; drag bench level with `main` at 1× and 4× once run order was swapped; pickup renders −20 to −38 %; drags feel the same by design) | Wed | Wed |
| T-145 Tokens twitch every 20–30 s (P1) | engineer | `fix/t145-twitch` → `main` | merged: the guard per animation plus hidden name labels; Tokens pixel-identical while every animation plays; frame work level with `main` at 1× and 4× cap128, 4× in-budget share 66 → 76 %; cost 1× fps 164 → 150 on a 165 Hz screen (director's call, not visible). Possible later spike: heroes and rings off the shared repaint to win those frames back | Wed | Wed |
| Drawing pauses while the app is minimised (P2-10, T-117) | builder | `crunch/p2-10` → `main` | merged (work check same; brief 60's P2 slices are all done). Owner check: minimise the real desktop app once and see the frame counter stop (the Rust side compiles but has not run there) | Wed | Wed |
| Drawers close each other (T-152) | builder-lite | `fix/t152-drawers` → `main` | merged (one hook, one new test; ruled in words, no eye-check) | Wed | Wed |
| Hover outline + Guild Hall movable again (T-147, T-148, with the outline-clipping fix T-146) | builder | `fix/hover-and-hall` → `main` | merged (owner eye-check all fine; [archived file](../archive/eyecheck/2026-10-14_hover-hall-gear.md)) | Wed | Wed |
| Overlapping speech bubbles (T-158) | builder | `fix/t158-bubbles` → `main` | merged Thu 01:10 (night work check same work): a Token's pop-up callout now sits directly above its working hero's speech in one column instead of covering it | Wed | Thu |
| Gear alert stops pulsing (T-153) | builder-lite | `fix/t153-gear-alert` → `main` (via the hover branch) | merged (owner eye-check all fine) | Wed | Wed |
| Safety net for CMS renames (T-182) | builder-lite | `fix/t182-id-guard` → `main` | merged (250 ids checked; T-184 filed for three dead ids on a dev-panel button) | Wed | Wed |
| Terrain plan (brief 80 T0) | engineer | `crunch/terrain` → `main` | done: [terrain_roadmap.md](terrain_roadmap.md), the owner answered all five questions the same evening (no clearing, the ground is static); slices T1 ground plan and T3 placement can start in parallel, T2 the drawn ground after T1, T4 the CMS field and grid after T2 and T3 | Wed | Wed |
| Terrain T1: the ground plan, pure code | engineer | `crunch/terrain-t1` → `main` | merged (work check same; Forest + Coast plans in ~10 ms) | Thu | Thu |
| Terrain T3: terrain in placement (Tokens that need water or shore land only there; everything else anywhere dry; meadow Regions unchanged) | engineer | `crunch/terrain-t3` → `main` | merged (work check same) | Thu | Thu |
| Terrain T2: the ground drawn on the mat | engineer | `fix/terrain-tm1` → `main` | merged (owner eye-check all fine; benches: layers 26 with and without the ground, draw cost 0.00 ms saved with it off, crisp green; [archived file](../archive/eyecheck/2026-10-15_terrain-ground.md)) | Thu | Thu |
| Terrain T4: the CMS "Stands on" field and the grid while placing | builder | `fix/terrain-tm1` → `main` | merged (owner eye-check all fine; a 4× drag pair still owed) | Thu | Thu |
| The dev server must survive a full sprite redraw (T-185) | engineer | `fix/t185-spritefx-server` → `main` | merged. Cause: the main folder's dev server watched every agent worktree (211k handles, 2 GB) and ran the redraw in its own process; now the worktrees are ignored (6k handles, 165 MB) and the redraw runs in a child process (5 s) | Thu | Thu |
| Art bench page (brief 85 A1) | builder | `crunch/art-a1` → `main` | merged: `npm run art:bench` | Thu | Thu |
| Brightness script with presets and outline protection (brief 85 A2) | builder | `crunch/art-a2` → `main` | merged: `npm run art:brighten` (previews only; the bake refuses without the tag, a dated zip outside the project and a clean assets tree) | Thu | Thu |
| Studio split and palette import (brief 85 A3, T-179) | builder | `crunch/art-a3` → `main` | merged: `npm run studio` on port 5175; the CMS top bar lost the Recolor and Animation tabs; drop palettes into `cms/palettes-inbox/` and Import | Thu | Thu |
| The owner's art weekend (brief 85): tools first, then support | director + one agent | `main` | Fri–Sun; overrides the Saturday stop this weekend only | Fri–Sun | |
| Handoff; T-181 baseline retake queued for Sat 01:00 | director / runner | `main` | queued; moves to Sunday night if the art weekend runs | Sat–Sun | |
| Planning agent briefs this week's concept docs into the queue table | owner + planning | `planning` (`pp`) | in progress alongside (owner's choice) | Wed–Sat | |


## Notes between directors

- **T-250 merged (Systems director, 2026-10-25):** every test now starts from a seed hashed from its own name (`src/tests/setup/seededRandom.js`); `FG_TEST_SEED=<x>` hunts for luck-dependent tests (TESTING.md). A test that passed by luck may now fail every time: that is the point; fix its setup, not the assertion.
- **For the Backlog director (from the Systems director, 2026-10-24):** the 7 content-pinned reds after the combat Sync are **fixed on `main`** (4ec24ad0, tests only), with the two flakes: AtlasTravel (a goblin strolling over the mat edge; the test now snapshots after `fitToMat`, as a load does) and BoardCombat's Recruit fight (now seeded). Tickets T-248 (enemy strolls clamp by centre), T-249 (next enemy swings first after a kill, owner question), T-250 (seed Math.random for every test).
- **For the Systems director (from the Backlog director, 2026-10-24):** `AtlasTravel.test.js` "there and back equals save and load" failed once under full-suite load in the T-242 builder's run (one goblin's y 61 vs 64) and passed alone twice. A determinism test should not depend on load; the plate-pick builder then saw it fail 1 of 3 runs alone (goblin y 16 vs 64 after travel), so it is real nondeterminism, not just load. Not caused by UI changes.
- **Also for the Systems director:** on `main` 16e5c4a1 (after the CMS sync 0bdfa84f) seven tests fail on `main` alone: `CMSEnemyHostile`, `CMSGearAndKinds` (2), `CMSStatusEffects`, `CombatChain` (2), `RenderGolden`. The Backlog director's merges add none; they look like the synced content against old expectations.

## Questions for the owner

- ~~Background music provenance~~ **Answered 2026-10-22:** the tracks are AI-generated placeholders, likely removed in the later music and sound pass; audio is not a concern now.
- **For combat planning (not a question):** hostile enemies notice a flag within `Flags.flagRadius()` of their spawner, so the hero reach going 164 → 240 (A3) widened what enemies notice too. Owner 2026-10-23: fine for now; combat planning decides what enemies should notice.

- ~~K4 play-through~~ **Answered 2026-10-27 (owner):** the tutorial's Old Site step is **removed** (T-259; T-258 puts it back once the ruins exist); **Recruits may hold copper weapons** (T-260; reverses the C2 call); **pace**: the owner plays the K4 eye-check first, tuning goes to planning after.
- ~~Lemons and limes; Lavender in plane 1~~ **Answered 2026-10-27 (owner: A on both):** lemonade and limeade wait for a later plane's Lemon and Lime Trees (they stay in the test's exclusion list); Lavender Seed from a Bird Nest stays as a lucky early find in plane 1.

- **Pennant flag (P2), parked for the eye-check:** (a) the carried pennant is centred on the cursor, so on drop it jumps ~23 px right, 31 px up (the old flag jumped more); hold its pole foot on the cursor instead? (b) the Edit Hero colour swatches now change nothing visible: keep until the flag rework, or hide? (c) the idle hero now stands over the right half of the smaller pennant: move the idle spot (engine movement; bench work check would change)?

- **Ticket candidate (not urgent):** `npm run cms:restore` (`scripts/backport-game-to-cms.mjs`) reads `workspace.maps`, which no longer exists, and ignores the plan file.

- **Ledger L5 answered (owner 2026-10-30):** the analyst's pace curve (1: 3 min, 10: 8 min, 20: 30 min, 40: 3 h, 60: 1 day, 99: 3 days), set as the default in L6; the other four as built (no check-in waits, 2 h payback, camps work 3, keep the Beer finding).

*Design questions the director cannot answer, as multiple choice, recommendation
first; asked with the next batch proposal and recorded where they belong.*

None open. (Ruled 2026-10-19: Token outlines red for problems, gold for attention, in UI_STYLE; Fight stays on for Recruits, everyone fights. Ruled 2026-10-15: equip-by-drop opens the sheet a frame later,
T-186; the badges' soft shadows are settled inside T-013.)

## Bench queue (one at a time, weekdays 13:00–17:00 and 01:00–07:00, or when the owner says the PC is quiet)

**Sat 01:00 (director):** `bench:draw -- --compare` on `main`, machine quiet. 30 Oct afternoon, `main` and the encyclopedia both drew ~2× slower than the 29 Oct 01:30 baseline (1× workP50 1.0 → 2.0 ms; 4× S2 136 → 94 fps) with agents running. If it is still 2× on a quiet machine, A/B `main` against a4a124be to find the commit.

**Fri 01:05 (director, timers in this session):** (1) O3 `bench --compare` in `tb1` (expect same work; then merge); (2) K1 `bench --compare` in `k1` (expect heroHash only; accept under brief270-K1, then merge); (3) Bank `bench --compare` and `bench:drag --kinds=equip` in `b1` (expect same work); (4) perks `bench --compare` in `k4` (expect same work). Logs in the session scratchpad.

**Thu 01:00 (director, 2026-10-28):** (1) `feat/token-bars` engine `--compare` and `bench:draw -- --compare` (cost-log line) against the current baselines; (2) then the baseline retake on `main`, machine quiet: `npm run bench -- --save-baseline`, `npm run bench:draw -- --save-baseline`; commit with the date. Then the Token bars draw compare when P3 is ready.

**Wed 15:46 (window), `feat/token-bars` 49e96c3d (P1+P2):** engine `--compare` **same work** (p99 tails 1.1–1.46 against the 21 Oct baseline with the owner's dev server running, the known stale-baseline pattern); `bench:drag --kinds=flag,token`: flag and Token 50/50 both passes.

**Backlog director, owed (any time while the owner is away, with no agent running):** (1) ~~`bench:drag` on B3~~ done (see B3 row); (2) ~~one `bench:draw -- --compare` on `main` after batch B~~ **done** b0528da0: no regression, loot 4× 48 → 59 fps (PERFORMANCE cost log) (batches A and B: top bar, names, loot effects off, drag tint). ⚠️ The draw bench's boards pin the old 11 × 0.64 mat, so it does not measure the bigger on-screen mat; a deliberate run on the shipped size is a separate ticket if wanted.

**Wed 01:05, director's correction:** the 13:00 Tue and 01:00 Wed runs were plain `npm run bench`, whose "same work" column only compares a scenario's repeats with each other. The real work check is `--compare` against `bench/baseline.json` (last accepted b68cd020, 18 Oct). Run at 3f67add6: **WORK CHANGED on every scenario but S4**. Bisect (S1): first bad commit **3ea827a6, notifications N1** (claimed no engine change). **Resolved 02:00:** the cause was the new banner chime picking its coin sound from the game's shared random stream (`AudioSystem._getSfxPath`), shifting every seeded outcome after a banner and breaking catch-up identity once a banner shows mid-hour; fixed 2fa608a6 (chimes take their recordings in turn). Hygiene proven same work; plumbing changed only bankHash (T-065). Accepted on main 1f0a6e05 (T-125/T-017/T-065/chime); S1 compare same afterwards. **Owed:** a timing baseline retake on a quiet machine (`--save-baseline`, engine and draw). Lesson: always `--compare` (memory).

00. **Atlas rework, merged to `main` 98bd5d8a**: engine work check (expect same: UI only) and `bench:draw --compare` with the `atlas` scene, next window. Done earlier: **Batch 6, merged to `main` 5f3c3e0d**: engine work check (expect same: no engine code); `bench:draw -- --compare --only=S2` (rest state unchanged) and the new open/close scene `bench:draw -- --only=S2,atlas --ab=<main served on a port>` for the cost log.

0. ~~**Batch 5, merged to `main` 9fa5572e on the owner's word**: engine work check on `main`~~ **Done Tue 13:00 on `main` 059c2fea (batches 5 and 6): same work on every scenario.** Still owed: (expect same: no engine rules changed, but the routing hears inventory events); one `bench:draw --compare` on S2 Realistic with auto-collect on (loot flying to stubs: the engineer measured ~+1.8 column redraws a second, ~2 ms each in the dev build; production not measured) for the cost log (stubs replace the sidebar). Bench follow-ups from the builder: the `notify` scene fires `NotificationSystem.info`, which now draws nothing (repoint at item flow); `bench/drag.mjs` rests the pointer on the old sidebar strip spot, now the top bar.

1. **Features stack, merged 2026-10-18 (b68cd020) on the owner's word**: the engine work check ran on the merge (S2, S3, S5, S6, S8, S8L, S8F WORK CHANGED from the hostile flag watch, accepted under T-167; a control run of `main` bcf1324d was the same work; S1, S4, S7 same). Still owed in a quiet window on `main`: the engine timing re-run (daytime load read S3/S4/S7 slower on `main` too), and one `bench:draw --compare` plus `bench:crisp` for the cost log (brief 120 C1 must draw cheaper than before the stack; brief 110's top bar frame and mode outlines; the level-up floats). If C1 draws dearer, a ticket and a report to the owner.

8. ~~Terrain director: bench baseline retake~~ **Done:** engine 2026-10-21 13:00 (f19a2e30), draw 2026-10-22 01:00 (db3959c4).

## Summaries

**Fri 2026-10-30, night: Guild Hall upgrades and the world map start.** Planning published briefs 320 and 330 (owner approved; old saves abandoned for both; 320 before 330). Now: Hall H1 (`h1`); world W1 (`w1`) next. Bench tonight: draw check 01:00, then the engine tickets (incl. T-277). Waiting for the owner: the encyclopedia and combat looks, three packs.

**Fri 2026-10-30, evening: the small-tickets pass.** Where we are: every queued brief is built; the encyclopedia and combat 1–3 wait for the owner's looks (combat V5 docs and pack ready behind them); three packs in the CMS inbox (first-fill, fix pack, perks). Now: engine tickets (`l1`) and UI/tooling tickets (`b1`). Owner dropped combat V4. Bench: quiet draw check at 01:00.

**Fri 2026-10-30, mid-afternoon: combat part 2 beside the ledger views.** Where we are: `main` 2d2ed237 has the full rate calculator. Waiting for the owner's looks: the encyclopedia (`feat/encyclopedia`) and combat part 1 (`feat/combat-v1`), both same work. Now: combat V2 on V1 (`c2`) and ledger L6 (`l5`). Owner chose the analyst's pace curve. Bench: quiet draw check of `main` at 01:00.

**Fri 2026-10-30, afternoon: combat v2 beside the full calculator.** Where we are: `main` 6c813f10, work check same (13:00). Waiting: the encyclopedia look (owner later; bench running), the S0 spike's work check, then its merge. Now: combat V1 (`c1`) and ledger L5 (`l5`). Owner ruled the parked ledger calls are not issues: XP floor, forest reach and luck-only Meadow maps stay as they are. Owner: the encyclopedia look; two packs in the CMS inbox.

**Fri 2026-10-30, late morning: brief 270 done; encyclopedia beside the ledger fixes.** Where we are: `main` ec53a140 has briefs 260, 270 (all), 290 L1–L3, 310 with T-268/T-269. The ledger first-fill pack and the example perks pack wait in the owner's CMS inbox. Now: encyclopedia E1+E2 (`k4`), ledger T-271/T-272 (`l1`). Next: ledger S0 spike (rate calculator), combat v2. Bench: work check of `main` at 13:00.

**Fri 2026-10-30, morning: perks and the Bank at scale merged; classless clean-up beside the ledger fill.** Where we are: `main` e18f7a74 has briefs 260, 270 K1+K4, 290 L1–L3, 310; tickets T-268 to T-271 from the looks. Now: K5 (`k4`) and the L4 first-fill pack (`l1`); T-268/T-269 next. Owner: accept the example perks pack in the CMS on `main`; the classless CMS to-do. Bench: work check of `main` at 13:00.

**Fri 2026-10-30, 01:30: overnight benches done; classless heroes and the orders clean-up on `main`.** Where we are: `main` 7920232e has K1 + O3 (bench accepted under brief270-K1) and ledger L1–L3. Waiting for the owner's look: perks (`k4`) and the Bank at scale (`b1`), both benched (same work; drag 50/50). Owner: the look, the classless CMS to-do (archived record), the ledger look; questions in STATUS and the eye-check file. ⚠️ Two O3 timers fired at once (one survived the app crash); the work check still ran clean. Next: K5 classless clean-up, ledger S0/L4, encyclopedia.

**Thu 2026-10-29, late: classless and the Ledger tab okayed; perks beside the Bank.** Where we are: `main` has the ledger L1 (plan block, engines, Ledger tab and settings) and the owner's tags Sync; K1 okayed (all questions A), merges after its bench (queued after O3's 01:05 check). Now: perks (`k4`, engineer, on K1) and the Bank at scale B1+B2 (`b1`, builder). Owner: the CMS to-do in the eye-check file after K1 merges. Blockers: none.

**Thu 2026-10-29, night: fresh director read in; classless heroes beside the ledger.** Where we are: `main` 8bc6d1ad, suite green (6675). Now: brief 270 K1 (`k1`) and brief 290 L1 (`l1`), engineers, side by side. O3 work check on the 01:05 timer (`tb1`), then merge as okayed. Owner: K4/S9 verdicts when convenient; the K1 look when it is ready. Blockers: none.

**Thu 2026-10-29, evening: director session closed (context full).** Where we are: `main` has briefs 250 and 260 O1–O2 with the owner's flag and drag follow-ups, T-264, the stumps and camps Syncs; O3 waits for its 01:05 work check, then merges (owner okayed). Next: brief 270 classless heroes (owner's go); small tickets accumulate until the briefs are done (owner rule). Owner: K4/S9 verdicts when convenient. Handoff: [HANDOFF.md](HANDOFF.md).

**Thu 2026-10-29, afternoon: Hero orders parts 1 and 2 merged, camps pack in the inbox.** Where we are: `main` 645900d2 (pushed) has orders, camps, the Lucide job flag in hero colours (pink for the old dark green), flags fanned on a shared camp and on the hero bar, the marching order line, the drag snap with its reason bubble, Token names over the art, one gear size, and T-264 (frozen goblins). Bench: work change accepted under brief260-O1-O2 (identity same, fidelity ok; interleaved timing level, the 13:00 reading was load) and T-264. Owner: review and Sync the camps pack on `main` (CMS on 5174 from this session), then the director id-diffs. Next: brief 260 O3 (tutorial, dead flag code, GDD) on the owner's go; tickets T-265 to T-267.

**Thu 2026-10-29, morning: stumps synced, baselines fresh, O2 building.** Where we are: `main` d0caf863 has the owner's stump Sync (only the two stumps changed; one content-pinned test updated) and the bench baselines retaken at 01:30 on a quiet machine. Token bars night bench: same work; draw 4× all better, 1× p99 tails +2.7–3 ms in every scene (S2, bank, notify, inspect alike, against the 22 Oct baseline): read as machine state, not the plate. Now: O2 camps (engineer, `tb2`); O1 gate + benches at 13:00, then merge. Owner: K4 and S9 eye-checks still open; the CMS runs on 5174 from this session.

**Wed 2026-10-28, evening: Token bars merged; Hero orders O1 started.** Where we are: `main` 90f7a7dd, pushed, has Token bars and the card wording. Now: O1 (engineer, `tb1`). Next: O1's look, then O2 camps. Owner: Oak and Fir Stump Art size Small in the CMS on `main`; K4 and S9 eye-checks still open. Bench: 01:05 timer runs the Token bars work check and draw compare, then the baseline retake.

**Wed 2026-10-28, evening: Token bars ready for the owner's look; card wording merged.** Where we are: `main` 93e440eb has the six card-wording fixes; `feat/token-bars` (P1 gear and enemy charges, P2 pennant, P3 one plate) passes the gate and waits for the eye-check, the owner's folder is on it. Next: the owner's verdicts and answers (a–e in the file), fixes on the branch, merge; 01:00 benches. Owner: the eye-check, then the stump Art size in the CMS on `main`. Blockers: none.

**Wed 2026-10-28, afternoon: fresh director read in; Token bars batch proposed and chosen.** Where we are: `main` 764ca115; the owner's weapon-tier Sync checked. Now: P1 (enemy charges, the gear on hover) and P2 (the pennant flag) build side by side; P3 (one plate) follows P1; then the card-wording fixes from the S9 list. Owner: K4 and S9 eye-checks still open. Bench: baseline retake queued for 01:00 Thu.

**Tue 2026-10-27, midday: K4 started (fresh Systems director).** Where we are: `main` 96b0b480, clean; no Systems worktrees. Now: the reachability test (`k4r`, builder) and the headless play-through with shots (`k4p`, engineer) run side by side. Next: the director checks both, runs the gate, writes the K4 eye-check. Owner: the S9 skill-loops verdicts are still open. Blockers: none. Bench baseline retake owed for a quiet window.

**Tue 2026-10-27: Systems director session closed (owner: a fresh director runs K4).** Where we are: combat (brief 220) complete; skill loops (230) complete except the owner's S9 eye-check; basic content (240) complete except K4: every pack reviewed and synced by the owner, tests green (6601). Next: a fresh director runs K4, the full-game play-through with screenshots. Owner: S9 verdicts and a ranking of its 14 rough edges when convenient. Owed: the bench timing baseline retake on a quiet machine. Handoff: [HANDOFF_systems.md](HANDOFF_systems.md).

**Sat 2026-10-24, night: Backlog director session closed.** Where we are:
brief 210 and every follow-up the owner approved are on `main` (last d35e661e)
(pixel frames rounds one and two, the speech frame, the work plate and its
pick-up fix, the drag bench's Shop and Bank kinds, loot under the drawers,
the gear tip, orbs without glow). Next: T-251 done too (2026-10-25); T-255 (one render test's timeout) is the
only Backlog ticket left; the rest of the ticket list belongs to the planning
agents and the Systems director. Owner: the hands-on lists in the eye-check
records. Handoff: [HANDOFF_backlog.md](HANDOFF_backlog.md).

**Sat 2026-10-24, evening: brief 210 complete.** Where we are: all six
batches of the owner's backlog intake are on `main` eb969849, every phase
okayed by phone. Next: T-242, pixel frames round two (the owner's second
audit), then the small tickets T-240, T-241, T-243, T-244, T-247. Owner: the
hands-on lists in the eye-check records when back at the PC. Blockers: none.

**Sat 2026-10-24: batch D merged, batch E started.** Where we are: batches
A to D of brief 210 are on `main` e6abf4e2, all okayed by phone (the Hall's
calmer sky, Effects popover, pixel Inspect panel and the camera glide last).
Next: E1 drawers and E2 the Atlas spread in parallel, then E3 dev tools; then
F (pixel frames everywhere, the bubble row). Owner: phone looks. Blockers: none.

**Fri 2026-10-23, evening: batch B merged, batch C started.** Where we
are: quieter Tokens, drag and loot clean-up and the corner-flight fix are on
`main` b0528da0, okayed by phone; draw cost compare running. Next: C1 item
tiles and C3 one item, one hero in parallel, then C2 and C4. Owner: nothing
until the screenshots. Blockers: none.

**Fri 2026-10-23: batch A looked at and merged, batch B proposed and started.**
Where we are: the wider, shorter mat (12 × 6.5), the top bar on the Region
banner, flag reach 240 with a gold ring and roomier Tokens are on `main`
cd9d2f2c, all okayed by phone. Next: batch B (quieter Tokens, drag and loot
clean-up, then the corner-flight bug). Owner: hands-on list for their return
in the A eye-check record. Blockers: none.

**Thu 2026-10-22, evening: Backlog director read in, batch A proposed.**
Where we are: `main` 31d5c780 passes the suite (5751), every worktree is
clean, both bench baselines are fresh. Next: on the owner's go, A1 and A3
in parallel, then A2. Owner: away from the PC for three days; looks by
screenshot. Blockers: none.

**Wed 2026-10-21, evening: features session closed.** Where we are: the
crunch queue is finished. Recipe list, notifications, the Atlas, change packs,
tools as hero gear, the wrap-up rounds and the Performance Envelope (GDD §14)
are on `main` (d4021ec7). Next: the owner plans the next batch with the
planning agent (the optimisation pass T-197 to T-201, the refinement pass,
the parked designs). Owed: the draw baseline retake in a quiet window.
Handoff: [HANDOFF_features.md](HANDOFF_features.md).

**Tue 2026-10-20, 11:30: batch 6 at the eye-check.** Where we are: the
Atlas tome is built (the owner's book at 4×, Cartography with drag to slot,
Region rows on banners, the CMS banner pick, the camera glide from the mat to
the book), gated (5551 tests, cycles, build) and served on 5198 with a
[13-check file](../archive/eyecheck/2026-10-20_atlas-tome.md). Next: the owner's look;
benches from 13:00 (batch 5's work check on `main`, then this branch). Owner:
the eye-check. Blockers: none.

**Tue 2026-10-20, morning: batch 6 proposed and ruled.** Where we are:
batch 5 (recipe list, notifications) merged to `main` 9fa5572e on the
owner's word; the quest board was interviewed, written (brief 170) and
postponed by the owner. Next: the Atlas tome T1 then T2, the flaky test
alongside; batch 5's work check and draw compare at 13:00. Owner: nothing
until the eye-check. Blockers: none.

**Tue 2026-10-20, 07:30: batch 5, fourth look.** Where we are: the owner
okayed the recipe list and banners; the item stubs went through three looks
(one line, 1×, content width, pinned open, calm order, smooth motion) and
collected loot now flies to its stub. All on `crunch/batch5` (gate: 5501
tests, cycles, build), served on 5198. Next: the owner's checks 23–28; the
work check and draw compare at 13:00; merge. Blockers: none.

**Mon 2026-10-19, 11:50: batch 5 at the eye-check.** Where we are: the
recipe list and notifications (item stubs, banners) are built, verified and
combined on `crunch/batch5`, served on http://localhost:5198/ with a
[16-check file](../archive/eyecheck/2026-10-19_recipes-notifications.md). Next: the
owner's look, fixes, the work check and a draw compare from 13:00, merge.
Owner: the eye-check. Blockers: none.

**Mon 2026-10-19, late morning: batch 5 building.** Where we are: the
owner interviewed on both briefs (recipe list sizing and faces; notifications
as item stubs plus banners, no log, T-193 later) and said go; two builders run
in `rl` (recipe list) and `nt` (notifications). Next: verify each, one
eye-check for both. Owner: nothing until the eye-check. Blockers: the weekly
token budget (resume after 5 AM if cut off).

**Mon 2026-10-19: features batch 5 proposed and ruled (planning only).**
Where we are: the queue is clear, no features branches open, `planning` and
`art/asset-reorg` have nothing ahead of `main`. Next: the recipe list (brief
130) and notifications (brief 150), one eye-check; quest boards (170) and the
Atlas tome (160) wait. Owner: the weak Starter Camp enemy and card art in the
CMS when free. Blockers: the weekly token budget.

**Mon 2026-10-19, morning: terrain session closed.** Where we are: generated
ground, water in every Region, placement, blended borders and the playmat
style (Clean ground at 2x, quieter decorations, rim, ambient life) are on
`main` (00c41b9c); the shadows phase was dropped by the owner. Next: each
cell's biome stored, a river along biome borders as real water, on-map
scenery; the baseline retake at 01:00. Owner: CMS maps for the new biomes,
the art bench when wanted. Blockers: none. Handoff: [HANDOFF.md](HANDOFF.md).

**Sun 2026-10-18, evening: features stack merged.** The owner's eye-check
was good; the stack (briefs 100, 140, 110, 120 and the Recruits' fight with
hostiles watching the flag) merged to `main` as b68cd020 after the gate on the
merged result (5302 tests, cycles, build) and the engine work check (the
expected change accepted under T-167). Twelve tickets closed; T-030 and T-038
stay open with what's left. Worktrees `k1`, `t167`, `hb`, `mt`, `il`, `ec`,
`mg` removed. Owed: timing and draw benches in a quiet window (queue above).
**Note for the playmat agent (`sp`, crunch/style-p1):** `main` now changes
`MatToken.jsx`, `MatBoard.jsx`, `TokenBubbles.jsx`, `MatTopBar.jsx` and
`tailwind.css` heavily; merge `main` in before going further. Owner: the CMS
steps (a safe Starter Camp enemy, card art).

**Sun 2026-10-18, afternoon: features director's closing summary.** Where we
are: four batches built and gated, none merged, stacked kit → Recruits (with
hostiles watching the flag) → hero bar → map tools → mat, hover and card;
the owner's one eye-check (29 checks, 16 questions) on http://localhost:5198/
from the frozen `ec`. Next: the bench queue in a quiet window (one run on the
top branch plus a work check per merge; WORK CHANGED expected from the hostile
rule), then merge in order. Owner: the eye-check when free; the CMS steps
after the merge. Blockers: none. Handoff: [HANDOFF_features.md](HANDOFF_features.md).

**Sat 2026-10-17, evening: batches 1 and 2 at one eye-check.** Where we
are: the style kit, Recruits who fight and the hero bar (Work Permissions with
square centred cells, the level-up moment, the shine) are built and gated;
the hero bar branch holds all three, served on http://localhost:5198/ from
`hb` ([eye-check file](eyecheck/2026-10-17_style-kit.md), 17 checks, 8
questions). Next: the owner's look, fixes on the branches, the bench queue in
a quiet window, then merge kit → Recruits → hero bar. Owner: the eye-check
when free. Blockers: none.

**Sat 2026-10-17, 19:20: features batch 1 at the eye-check.** Where we are:
the style kit (page, shared arrow lists, text sizes, shared tooltip) and the
Recruits' attack are built and gated; [eye-check file](eyecheck/2026-10-17_style-kit.md),
served from the worktrees on 5196 and 5197 so the owner's folder stays on
`main`. Next: the owner's verdicts and seven questions; then the work check
(T-167) and a draw compare (kit) in a quiet window, merge. Owner: the
eye-check. Blockers: none.

**Sat 2026-10-17, evening: features batch 1 proposed and ruled.** Where we
are: `main` clean; five finished tickets closed in the archive. The batch: the
style kit (brief 100: page, shared list, text sizes and tooltip; one eye-check
at the end) and the Recruits' weak attack (T-167). Next: brief 140 (hero bar)
or 110 (map tools) on the kit. Owner: after T-167 lands, author a weak, safe
enemy in the Starter Camp. Blockers: none.

**Thu 2026-10-15, closing (wave 2 director).** The whole of wave 2 and the
terrain (brief 80 T0–T4) are on `main`, the owner's eye-checks all fine; the
three art tools for brief 85 are on `main` for the owner's art pass.

**Thu 2026-10-15, evening: art pass batch 1 proposed and ruled.** Where we
are: `main` green (4960 tests), worktrees clean. The batch: baselines and the
owed drag pair tonight at 01:00 on a timer; the owner's art sessions with the
director on call; two small fillers building (dev-panel items, floor loot
offset). Owner: leave the PC on and quiet tonight; work the art bench when you
like. Blockers: none.

**Fri 2026-10-16, night.** Where we are: the floor-loot fix and the dev panel's real items are on `main` (gate on the merged result green, same work); the engine baseline is fresh; the placing grid's drag pair shows no cost. The draw baseline is fresh too (third run, 01:00). Next: the owner's first brightness pass on the bench, which is ready. Owner: open the bench and pick or adjust a preset. Blockers: none.

**Sat 2026-10-17, 01:45: director's closing summary.** Where we are: the art pass's first half is on `main`: assets renamed and filed, the Gentle bake (after Drag proved too bright), drag and hover adjusted, the Sync guard, the outline fix; brief 180 G1 (ground structure) passed its gate, work check and draw compare and waits for the owner's look on `crunch/ground-g1`. Next: the owner's verdicts, then the palette button and a Sync on `main`, then G2. Owner: see HANDOFF's to-dos. Blockers: none. Cost log: G1 S2 4× 107 → 100 fps, work p50 10.7 → 11.8 ms (within tolerance).
