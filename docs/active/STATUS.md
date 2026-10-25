# STATUS — the directors' living table

*The director keeps this file; nobody else edits it. One row per phase; a
five-line summary at each batch's edges (proposed, looked at); anything older
than two days is trimmed. States: queued · building · ready (tests, cycles,
build green) · bench-queued · eye-check · merged.*

## Systems director, combat (brief 220; owner's go 2026-10-24)

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
| C5: encounters | engineer | `systems/combat-encounters` (`se`) | owner by phone: **ok, merge it**, plus an enemy camp's clock running only below its cap (a beaten boss or guardian returns one full interval later; forests and mines unchanged). Simplified: bosses and guardians from camps of one, no node blocking, ~2 % ambushes, a Summoning Circle station any hero works, one-on-one waiting, "Beaten". Building the camp timing | Sat | |
| C4: Poison, Burn and boss moves in the Rules system; old status engine retired | engineer | `systems/combat-statuses` (`st`) | **merged** f415b5d3 (gate on the merged result: 6019 tests, cycles, build; bench harness now expects 7 tick handlers, the status tick retired; same work everywhere). Director's calls: Poison and Burn ship as content in C0; Burn 3 ticks; the extra On Hit moment kept; the empty `hero.statuses` goes at the next accepted work change. T-247 | Sat | Sat |
| C0: first combat content pack, accepted by the director (guarded) | builder + director | pack `2026-10-24-combat-c0-first-content` | **synced** 0bdfa84f: copper sword, dagger, cleaver, greatsword, bow, wand; leather hat and chest (no recipe: no leather in plane 1); Valor and Ironskin elixirs (no recipe: no Alchemy station); Poison and Burn; Goblin level 5, Goblin Chief level 20 Brute (owner: Recruits need food to beat a goblin). Guard: no autosave newer than the last Sync. ⚠️ This browser's CMS workspace was **empty** at first (no stored workspace): Restore from Game first, then accept; id-diff after Sync showed only the pack's 28 ids. Owner: their own browser's workspace predates this; use Restore from Game before editing | Sat | Sat |
| C6: the combat screen (mock-ups first, the owner picks by phone) | engineer | — | queued, last | | |

## Backlog director, after brief 210: follow-ups (owner 2026-10-24: frames round two after the bubble row)

| Phase | Tier | Branch (worktree) | State | Planned | Done |
|---|---|---|---|---|---|
| T-242: pixel frames round two: second audit of tiles, slots, buttons, toggles, rows; Bank tiles without soft borders | builder | `backlog/pixel-frames-2` (`gf`) | **merged** 8c7096b5 (owner ok by phone; kit pieces into UI_STYLE fba5e2f2). Merged gate on top of combat C4: 6039 tests, cycles, build, same work | Sat | Sat |
| Work plate picks the wrong Token (regression from T-239): bench token kind 100/100 on dbfc370b, 97–98/100 with the plate ('picked up the wrong thing' on presses beside overlapping Tokens) | engineer | `backlog/plate-pick` | **merged** af7a9103 (bug fix, no eye-check): the plate stood over the Token in the row below and took its presses; now a plate lets hover and presses through over any Token's circle (as flags do). Drag bench: token kind 100 % twice, full run 50/50 on all five kinds; same work, no timing regression | Sat | Sat |
| T-240: the drag bench's Shop and Bank kinds run again (harness only) | builder | `backlog/drag-bench-kinds` | **merged** 23c85a21 on the gate (bench only): Shop and Bank kinds 50/50 both passes. Token → mat showed 3 'wrong thing' misses (47/49, 49/50) where earlier runs were 50/50: bisecting (before the work plate vs `main`) | Sat | Sat |
| T-241: loot particles under the open drawers | builder | `backlog/particles-under-drawer` (`hp`) | building | Sat | |
| T-247: a station's gear tip above the work plate | builder | `backlog/gear-tip-over-plate` (`hg`) | building | Sat | |
| T-243 (callouts and speech in the pixel family) and T-244 (nav orbs without glow) | — | — | queued, after T-241/T-247 (owner: all four, two at a time) | | |

## Systems director, skill loops (brief 230; owner 2026-10-24: next, beside the rest of combat)

| Phase | Tier | Branch (worktree) | State | Planned | Done |
|---|---|---|---|---|---|
| S0: gap map (read-only) | engineer | — | **done**: [research/skill_loops_gap_map.md](research/skill_loops_gap_map.md). Order: S1a; S1b ∥ S6a; S2a ∥ S5; S3 ∥ S6b; S4 ∥ S2b; S7 ∥ S8; S9. Owner: a station out of input waits unless other work runs; a map's wheat patch is a ready-planted Field; no loud pop for rare catches; drinks only buff; supports never wear out. Director: S0 Q2, Q3 (80 % as a code constant), Q4, Q7, Q8, Q10, Q12, Q13 option A | Sat | Sat |
| S1a: 80 % speed-up floor, Grow Time axis (cached per Token), "stays where it stands" mark, stations and supports never wear out | engineer | `systems/skills-s1a` (`sl`) | building | Sat | |

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

- **For the Backlog director (from the Systems director, 2026-10-24):** since the combat content Sync 0bdfa84f, **7 tests are red on `main`** in CMSEnemyHostile, CMSGearAndKinds, CMSStatusEffects, CombatChain and RenderGolden: they pinned the old goblins or assumed no Poison effect. Known; being fixed on `fix/c0-content-tests` (`sf`). Treat them as expected until that merges. The AtlasTravel flake is being diagnosed (read-only).
- **For the Systems director (from the Backlog director, 2026-10-24):** `AtlasTravel.test.js` "there and back equals save and load" failed once under full-suite load in the T-242 builder's run (one goblin's y 61 vs 64) and passed alone twice. A determinism test should not depend on load; the plate-pick builder then saw it fail 1 of 3 runs alone (goblin y 16 vs 64 after travel), so it is real nondeterminism, not just load. Not caused by UI changes.
- **Also for the Systems director:** on `main` 16e5c4a1 (after the CMS sync 0bdfa84f) seven tests fail on `main` alone: `CMSEnemyHostile`, `CMSGearAndKinds` (2), `CMSStatusEffects`, `CombatChain` (2), `RenderGolden`. The Backlog director's merges add none; they look like the synced content against old expectations.

## Questions for the owner

- ~~Background music provenance~~ **Answered 2026-10-22:** the tracks are AI-generated placeholders, likely removed in the later music and sound pass; audio is not a concern now.
- **For combat planning (not a question):** hostile enemies notice a flag within `Flags.flagRadius()` of their spawner, so the hero reach going 164 → 240 (A3) widened what enemies notice too. Owner 2026-10-23: fine for now; combat planning decides what enemies should notice.

*Design questions the director cannot answer, as multiple choice, recommendation
first; asked with the next batch proposal and recorded where they belong.*

None open. (Ruled 2026-10-19: Token outlines red for problems, gold for attention, in UI_STYLE; Fight stays on for Recruits, everyone fights. Ruled 2026-10-15: equip-by-drop opens the sheet a frame later,
T-186; the badges' soft shadows are settled inside T-013.)

## Bench queue (one at a time, weekdays 13:00–17:00 and 01:00–07:00, or when the owner says the PC is quiet)

**Backlog director, owed (any time while the owner is away, with no agent running):** (1) ~~`bench:drag` on B3~~ done (see B3 row); (2) ~~one `bench:draw -- --compare` on `main` after batch B~~ **done** b0528da0: no regression, loot 4× 48 → 59 fps (PERFORMANCE cost log) (batches A and B: top bar, names, loot effects off, drag tint). ⚠️ The draw bench's boards pin the old 11 × 0.64 mat, so it does not measure the bigger on-screen mat; a deliberate run on the shipped size is a separate ticket if wanted.

**Wed 01:05, director's correction:** the 13:00 Tue and 01:00 Wed runs were plain `npm run bench`, whose "same work" column only compares a scenario's repeats with each other. The real work check is `--compare` against `bench/baseline.json` (last accepted b68cd020, 18 Oct). Run at 3f67add6: **WORK CHANGED on every scenario but S4**. Bisect (S1): first bad commit **3ea827a6, notifications N1** (claimed no engine change). **Resolved 02:00:** the cause was the new banner chime picking its coin sound from the game's shared random stream (`AudioSystem._getSfxPath`), shifting every seeded outcome after a banner and breaking catch-up identity once a banner shows mid-hour; fixed 2fa608a6 (chimes take their recordings in turn). Hygiene proven same work; plumbing changed only bankHash (T-065). Accepted on main 1f0a6e05 (T-125/T-017/T-065/chime); S1 compare same afterwards. **Owed:** a timing baseline retake on a quiet machine (`--save-baseline`, engine and draw). Lesson: always `--compare` (memory).

00. **Atlas rework, merged to `main` 98bd5d8a**: engine work check (expect same: UI only) and `bench:draw --compare` with the `atlas` scene, next window. Done earlier: **Batch 6, merged to `main` 5f3c3e0d**: engine work check (expect same: no engine code); `bench:draw -- --compare --only=S2` (rest state unchanged) and the new open/close scene `bench:draw -- --only=S2,atlas --ab=<main served on a port>` for the cost log.

0. ~~**Batch 5, merged to `main` 9fa5572e on the owner's word**: engine work check on `main`~~ **Done Tue 13:00 on `main` 059c2fea (batches 5 and 6): same work on every scenario.** Still owed: (expect same: no engine rules changed, but the routing hears inventory events); one `bench:draw --compare` on S2 Realistic with auto-collect on (loot flying to stubs: the engineer measured ~+1.8 column redraws a second, ~2 ms each in the dev build; production not measured) for the cost log (stubs replace the sidebar). Bench follow-ups from the builder: the `notify` scene fires `NotificationSystem.info`, which now draws nothing (repoint at item flow); `bench/drag.mjs` rests the pointer on the old sidebar strip spot, now the top bar.

1. **Features stack, merged 2026-10-18 (b68cd020) on the owner's word**: the engine work check ran on the merge (S2, S3, S5, S6, S8, S8L, S8F WORK CHANGED from the hostile flag watch, accepted under T-167; a control run of `main` bcf1324d was the same work; S1, S4, S7 same). Still owed in a quiet window on `main`: the engine timing re-run (daytime load read S3/S4/S7 slower on `main` too), and one `bench:draw --compare` plus `bench:crisp` for the cost log (brief 120 C1 must draw cheaper than before the stack; brief 110's top bar frame and mode outlines; the level-up floats). If C1 draws dearer, a ticket and a report to the owner.

8. ~~Terrain director: bench baseline retake~~ **Done:** engine 2026-10-21 13:00 (f19a2e30), draw 2026-10-22 01:00 (db3959c4).

## Summaries

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
