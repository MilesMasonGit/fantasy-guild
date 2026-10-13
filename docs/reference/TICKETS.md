# Tickets — the one backlog

**This is the only place open work is tracked.** Bugs, performance, cleanup,
tests, owner to-dos and pending design questions all live here. Feature plans
live in their roadmap docs; when a plan leaves loose ends, they become tickets
here.

## Rules

- **Add**: next free `T-` number (see the counter), one row, one line. Put
  detail in the row or link a section of a live doc; never start a new list
  somewhere else.
- **Close**: delete the row here and append one line to
  [`docs/archive/tickets_done.md`](../archive/tickets_done.md):
  `T-NNN — summary — commit hash — date`.
- **Status**: `open` (anyone may take it) · `owner` (blocked on the owner —
  say on what) · `blocked` (say on what) · `ride-along` (do only while already
  editing that code).
- **Priority**: **P1** a player can hit it, or a measured miss of a target ·
  **P2** real cost or risk · **P3** tidy-up.
- **Origin**: the old ID, so the full write-up can be found in
  `docs/archive/` (CR3 = code review round 3, `docs/archive/review_v3/`;
  FB = token lifecycle feedback; FMR = free playmat review, 2026-09-21).
- **Before closing a batch**: the merge gate in
  [`docs/reference/TESTING.md`](TESTING.md) (tests, bench, cycles).

**Next free number: T-177**

---

## 1. Waiting on the owner

| ID | What | Origin |
|---|---|---|
| T-007 | **Coal Vein at 4 s**: accept, re-tag its purpose from gold to items (~3 s), or leave for the simulator rework? | FB §5.1 |
| T-008 | **Flag Radius upgrade art**: keep borrowing the plain hero flag, or use the red banner art? | FB §5.2 |
| T-010 | **Speech bubble audit**: add/remove list for `docs/reference/speech_bubble_lines.md`. | FB §5.5 |
| T-011 | **Watch by eye** (no agent has seen these on screen): Token hit animations + transform glow, loot flight to the Hall, Shop drawer, countdown badge. | FB §5.6 |
| T-012 | **Transforms now push neighbouring Tokens** (the playmat plan said only bursts and spawns push). Keep or change? | FMR |
| T-013 | **The last ~65 alert-icon glows and ~105 label text-shadows**: switch them to the hard-pixel style too? | CR3 summary |
| T-014 | **Quest content is written in engine code** (the tutorial chain, `tutorialQuests.js`), not the CMS. Move it to content? (Design call, never asked; Atlas A8 rewrites the chain.) The opening half is closed: the Starter Camp is content (Atlas A7). | CR3-515 |
| T-127 | **Markets are cut for now** (owner 2026-10-09, D2): the Shrimp Market Token runs but pays nothing. Retire or repurpose it in the CMS (it turns up from Shrimp Coast content). The GDD §16 question is closed. | concept_progression.md |

## 2. Open work

### Engine

| ID | Pri | Status | Summary | Origin |
|---|---|---|---|---|
| T-176 | P2 | open | **Quest boards** ([concept_quests_tutorial.md](../active/concept_quests_tutorial.md), "Quest boards"): three movable, non-demolishable boards near the Hall that count toward the cap and persist; claiming pays out and the board stands blank until the next posting (hover says when), then the next quest is pinned on it; hunt posters show the enemy's first idle frame at half size; the count in the same place for items and enemies; a yellow ! / green check badge on every board; the poster stays on while dragged. Fresh saves, no conversion. Replaces the spawn-and-remove quest Tokens (`QuestTokens.js`); the bounty cap becomes the board count. Builder (engineer if the quest lifecycle refactor is large). Eye-check. | concept_quests_tutorial.md |
| T-175 | P2 | open | **Collectors: the Guild Hall and warehouses** ([concept_collectors.md](../active/concept_collectors.md)): the Hall collects all loot in a small radius from the start, widened by a ranked Hall star; warehouses built on Foundations collect items with one tag (CMS Collects block: tag, radius, interval ~60 s), bigger radius on higher tiers, no upkeep; shared sweep clock, nearest collector wins, items fly in; Bank-full leaves loot and shows the yellow mark; reach ring on hover, drag, placing. Remove the auto-collect setting. Engineer. WORK CHANGED expected. Cost-log line. Eye-check. | concept_collectors.md |
| T-015 | P2 | open | Retire `state_changed`, stages 2–3 (stage 1 = `GAME_RESET`, merged). | CR3-305 |
| T-125 | P2 | open | **Remove the +0.5 % work speed per skill level** (owner 2026-10-09, D2: invisible, one more number to balance). `SKILL_SPEED_FACTOR` in `src/config/FormulaRegistry.js`; check the CMS simulator's tempo maths (GDD §11: slower by `1 + (level−1)/70`) and the GDD's Skills section. Changes play: eye-check; the bench will show WORK CHANGED, accept under this ticket. | concept_progression.md |
| T-126 | P2 | open | **Gathering tools become hero gear and last forever** (owner 2026-10-09, D2 + D4): pickaxes, woodaxes, fishing rods, sickles are carried in a hero's hands alongside weapons (hands: 2) and set what they can gather; tool Tokens on the mat go away; stations (anvils, furnaces) stay Tokens. Nothing wears out. Today tools are context Tokens and some recipes spend their charges (`Charges.js`, `requiresContext`); GDD says "Tools are not hero equipment". A design-to-code job for the post-crunch build, with the CMS content to match. Changes play: eye-check. | concept_skill_loops.md |
| T-016 | P2 | open | A loot sweep publishes one event per sprite; batch it. | CR3-255 |
| T-017 | P2 | open | Kill loot ignores yield / double-loot / bonus-drop rules — reachable, `BONUS_DROP` and `LOOT_MULT` ship. **Owner 2026-10-06: yes, apply them exactly as for work.** | CR3-256 |
| T-018 | P2 | open | A crafted Token can arrive with unlimited charges — reachable (Copper Woodaxe). Ruling (A) per R3-Q1. | CR3-045 |
| T-019 | P2 | open | The engine starts a game only when React says so → add `Engine.startSlot`; reuse CR3-100's test as the headless boot test. | CR3-307 |
| T-020 | P3 | open | Three small rules copied into UI components; move them to the engine, show refusals on screen. | CR3-308 |
| T-021 | P3 | open | Two ways into the engine; settle on one (R5-Q2 ruling A). | CR3-512 |
| T-022 | P3 | open | Rate trackers never cleared on load (clear only; "count at drop time" is a separate design call). | CR3-263 |
| T-023 | P3 | open | `GLOBAL_COMBAT_XP_MULTIPLIER` wired to nothing (value is 1.0, so wiring it is invisible). | CR3-261 |
| T-026 | P3 | ride-along | Small per-tick allocations in combat and statuses. | CR3-032 |
| T-027 | P3 | ride-along | Motion ticks allocate small objects per walker. | CR3-153 |
| T-097 | P2 | open | *(Token cap done in T-102: `MatCap.BASE_TOKEN_CAP`.)* Move the mat size and quest cap/interval out of the dev Mat Tuner into fixed game values (Hall upgrades may raise them later); hide Debug Mode and the QA tools in shipped builds. Owner 2026-10-06. | GDD §16.1 |
| T-098 | P2 | open | Remove hero energy (dormant). Drinks heal like food: keep the separate food and drink slots, both eaten below 25 % HP. Owner 2026-10-06. | GDD §16.7 |

### UI

| ID | Pri | Status | Summary | Origin |
|---|---|---|---|---|
| T-172 | P2 | open | **The Atlas as a tome** ([concept_atlas_tome.md](../active/concept_atlas_tome.md)): the open tome on the map table as a backdrop for the standard UI, ~90 % of the window; bookmark tabs with a stepped page-turn between Cartography and Regions; Cartography over both pages with a big layout preview; drag maps into, between and out of slots, click still slots. Keep A6's behaviour, change only the presentation. Placeholders until the owner's tome art. Builder. Eye-check. | concept_atlas_tome.md |
| T-173 | P2 | open | **Region rows and area banners** ([concept_atlas_tome.md](../active/concept_atlas_tome.md)): Regions as one row each with its area banner as a full-art backdrop (names, node pills, day, Tokens, heroes; Travel main, Rename/Archive/Abandon in a menu); a CMS banner field on Base Map items and the Starter Camp page (the owner sets pictures and Syncs); the banner behind the top bar's Region name, an arrival card on travel, behind the Cartography preview. After T-172. Builder. Eye-check. | concept_atlas_tome.md |
| T-174 | P2 | open | **Camera moves**: tilt up from the mat into the Hall's sky and down onto the Atlas's map table ([concept_guild_hall.md](../active/concept_guild_hall.md) "Transitions", [concept_atlas_tome.md](../active/concept_atlas_tome.md)): under a second, skippable, with a reduce-motion setting. Engineer. Cost-log line. Eye-check. | concept_guild_hall.md |
| T-171 | P3 | open | **The Hall sky's look** ([concept_guild_hall.md](../active/concept_guild_hall.md), "The look of the sky"): upgrade nodes become pixel stars by state (faint dot, twinkling, bright, gold), every star tagged `name rank/max`, faint-then-bright lines, faint constellation names, the Hall as a pole star, a night-sky backdrop (placeholder until the owner's art), Effects docked left and a hover-filled, click-pinned details panel right holding the icon and the Upgrade button. Check T-128 while there. Builder. Eye-check. | concept_guild_hall.md |
| T-170 | P2 | open | **Top bar restyle** ([concept_map_tools.md](../active/concept_map_tools.md), "The top bar around the modes"): studded pixel frame; left: Region name (click opens the Atlas), Tokens 45/128 (red at the cap) and Upkeep summed per minute (hover lists one item bar per item with its rate), all in the item bar style; centre: the mode banner; right: Disallow and Demolish. With or after T-166. Builder. Eye-check. | concept_map_tools.md |
| T-169 | P2 | open | **The recipe list** ([concept_recipe_list.md](../active/concept_recipe_list.md)): opens inside the Token card from Change recipe (Foundations too); one row per recipe sorted by level (level, inputs with have/need, hollow bars for tools and Foundation tiers, main output then muted byproducts with chance, XP and time); hero-face dividers at each hero's level replace the bands, markers and yellow banner; the next two locked recipes as ??? silhouettes; a search box over inputs and outputs; one click chooses. Absorbs T-142. Builder. Eye-check. | concept_recipe_list.md |
| T-168 | P2 | open | **Notifications: log button, pop-out toasts, pins** ([concept_notifications.md](../active/concept_notifications.md)): replaces the edge sidebar; top-right button with unread badge; one-line sprite toasts slide out of it and back (max 3, loot merged per item); the log (tabs, per-minute loot rows, Clear log); pins that stay on screen and top the log, loot pins as resettable trackers; All / Pinned only / Hidden modes; mute a kind from a toast; Settings per-kind toggles, the position setting removed; hover highlights the hero or Token. Pins and mode saved. With T-028, T-037. Builder. Cost-log line. Eye-check. | concept_notifications.md |
| T-165 | P2 | open | **Starter Camp Tokens become fixtures** ([concept_map_tools.md](../active/concept_map_tools.md)): every Token the camp layout places is marked `fixture` when the camp is laid down, so it can't be demolished, dragged or pushed (player-built and bought Tokens there stay movable). Existing saves need a load-time step marking the camp's Tokens (match the layout). Tests for a new game and an old save. Engineer. Eye-check. | concept_map_tools.md |
| T-166 | P2 | open | **Demolish mode beside Disallow mode** on the top bar ([concept_map_tools.md](../active/concept_map_tools.md)): one mode at a time; a plain banner per mode (Demolish in red, warns once on entering); mode-coloured hover outline and cursor; protected Tokens dim in Demolish mode and a click shows the reason; batch controls (Allow All, shift-click a type to disallow or allow all of it, Cancel all marks). Then the Token card drops its Disallow switch and Demolish buttons. After T-147 and T-165. Builder. Eye-check. | concept_map_tools.md |
| T-164 | P2 | open | **Work Permissions drawer and launcher** ([concept_work_permissions.md](../active/concept_work_permissions.md)): rename Work Rules to Work Permissions on screen; a labelled launcher in its own slot at the hero bar's left end; the drawer slides up full mat width above the hero bar, hero names left and columns spread evenly, every skill column always shown; one Combat column (tick/off, priority-mode capable: check the engine first) replaces the combat tint columns and Fight; header tooltips show a new `purpose` line from `skillRegistry.js` (drafts in the concept doc). With T-152 and T-156. Builder. Eye-check. | concept_work_permissions.md |
| T-159 | P2 | open | **The style sheet page**: a Dev Tools screen showing every standard UI piece live (UI_STYLE "The style sheet page": the three text sizes and display size, the five colours as shared CSS variables, hover and alert outlines, ribbon, pill, header with close X, both button kinds, tabs, arrow bars, pixel frames, bars, the tooltip), with a section for *new, unapproved* pieces. Built from the existing shared pieces where they exist; first of the UI style work, since later briefs copy from it. Builder. Eye-check: the owner reviews the whole kit there. | UI_STYLE.md (2026-10-13) |
| T-160 | P2 | open | **One shared arrow-bar scroll list** (UI_STYLE "Lists and scrolling") replacing the four hand copies in `ShopDrawer.jsx`, `InspectionPanel.jsx`, `TokenInspectPopup.jsx`, `GuildUpgradeInspection.jsx`: pixel triangle drawn in code, dims at the ends but keeps its space, a click scrolls ~two rows smoothly, holding repeats, the wheel works. Builder. Eye-check. | UI_STYLE.md (2026-10-13) |
| T-161 | P3 | open | **Three text sizes** (title, body, small) plus a display size for mat celebrations, as shared classes the Text size setting scales; move panels onto them as each is touched. With T-038. | UI_STYLE.md (2026-10-13) |
| T-162 | P3 | ride-along | **Pixel sprites replace vector icons** (lucide: chevrons, X, zap, sparkles, help circle and others) as each screen is touched; missing sprites get a placeholder and a line in `owner_art_list.md`. | UI_STYLE.md (2026-10-13) |
| T-145 | P1 | open | **Tokens on the mat twitch and lose pixel sharpness every ~20–30 s** (owner 2026-10-10). Find the trigger (a timer, GC, a periodic state cycle, a sub-pixel camera or transform rounding) and keep nearest-neighbour crispness. Check first whether brief 60's sprite clock (P2-3, `crunch/p2-3`) or loot-canvas work (P2-6) changes it. Engineer; measure, then fix. | refinement_pass_todo.md §1 |
| T-146 | P2 | open | **Outlines on animated sprites are clipped at the frame edge** (a hero's bow top, feet bottom): art reaches the cell border, so a 1-art-pixel outline has no room. Fix where it costs least: pad cells by 1 art pixel in the sprite pipeline (`scripts/process_art.cjs`, spriteFx) or let the renderer draw the outline outside the cell. Owner art must not need redrawing. Changes the look: eye-check. | refinement_pass_todo.md §1 |
| T-147 | P2 | open | **Hover = a 1-art-pixel white outline**, replacing the hover bob and A10's hover lift (owner 2026-10-13). Movable vs fixed stays told apart by A10's resting marker and the grab cursor. A follow-up to A10 (merged 2026-10-13). Needs T-146 for animated Tokens. Cost-log line. Eye-check. | refinement_pass_todo.md §3 |
| T-148 | P2 | open | **The Guild Hall is movable again** (owner 2026-10-13, overrides atlas D-6 for the Hall only): it drags like bought and built Tokens and carries the movable marker; it still can't leave the mat or be demolished. A follow-up to A10 (merged 2026-10-13). Eye-check. | refinement_pass_todo.md §3 |
| T-149 | P3 | open | **Hero bar level-up alerts**: the text becomes `[level] [skill]!` ("50 Stealth!"); the mouse wheel scrolls through queued alerts with a short slide between them; the chevrons stay. The splashy on-mat celebration is separate (refinement §4, waits for its design pass). Eye-check. | refinement_pass_todo.md §3 |
| T-150 | P3 | owner | **Smaller hero flag**: swap to the owner's 32 px flag (today's are 64 px in `public/assets/ui/flag/`; waiting on the 32 px art) and fade the flag to half opacity while its hero works. Colour-blind cues (T-151) are separate. Eye-check. | refinement_pass_todo.md §3, ideas.md |
| T-151 | P3 | owner | **Colour-blind-safe hero flags**: safe colours plus a second cue (pattern or initial). Needs an owner choice and maybe art. | ideas.md |
| T-152 | P3 | open | **Drawers close each other**: opening the Item Bank, Shop or Work Rules drawer closes the others; closing the open one returns to the plain mat. Panels and modals keep their own rules (T-029). | refinement_pass_todo.md §3 |
| T-153 | P2 | open | **The gear alert on stations and Foundations stops pulsing, scaling and glowing** (breaks the 1:1 pixel rule). It gets the gold 1-art-pixel alert outline whose colour steps between two golds; geometry never moves (owner 2026-10-13). Write the tests first. With T-013. Eye-check. | refinement_pass_todo.md §3 |
| T-154 | P3 | open | **Picking up a Token flies it to the cursor** over ~50–100 ms instead of jumping there. Must not bring back pickup hitches: `bench:drag` before and after (T-033). Eye-check. | refinement_pass_todo.md §3 |
| T-155 | P3 | open | **World spawns pop out of their parent** (a Forest's new Tree) with the same emergence the Guild Hall's spawns use, instead of appearing. Cost-log line. Eye-check. | refinement_pass_todo.md §3 |
| T-156 | P3 | open | **Hero inspect panel tidy**: a locked skill's tooltip names the class that unlocks it ("Requires Ranger"); the Work Rules button goes from the panel (it lives on the hero bar); the close X renders at its sprite's own size (with T-036). Eye-check. | refinement_pass_todo.md §3 |
| T-157 | P3 | open | **Quick Settings landing tab** in Settings: Master, Music and SFX volume, Animations, font and text size, Item Fly Particles, Auto-save interval (owner 2026-10-13). The same controls stay in their own tabs. Eye-check. | refinement_pass_todo.md §2 |
| T-137 | P2 | open | **Code-only animation batch** (owner picks 2026-10-09, `docs/active/research/animation_menu.md` "Owner picks"): effects 1, 2, 3, 4, 5, 6, 7, 10, 12, 13, 14 (every hit), 15, 17 now; 18 after the Atlas. **Plus the tinted-copy effects** (afterimage trail, colour flash, echo ring, pixel dissolve, ground-staying shadow; same doc, "Tinted copies"): build one first both as generated pictures and as a live CSS mask tint, measure both in the cost log, then use the cheaper method. Whole art pixels, stepped timing, no blur or fractional scaling; effect 1 also fixes T-135; effect 5 should make loot bursts cheaper (measure before/after). New hooks: `COMBAT_RESOLVED`, `HERO_LEVELED`; 7 needs the effect payload to name the source Token. Builder (engineer for 5). After brief 60; cost-log line per effect group; changes the look: owner eye-check. | research/animation_menu.md |
| T-138 | P3 | owner | **Sprite-strip player for owner-drawn effects**: play a horizontal strip once at a mat point on the strike frame / event (like `AnimatedHeroSprite.jsx:57-76`); a new `assets/fx/` folder added to the spriteFx generator's skip list (`spriteFx.js:77-80`). Waits for the owner's first effect art (owner_art_list.md). | research/animation_menu.md |
| T-136 | P2 | open | **Pixel frames on every panel** (owner 2026-10-09, UI_STYLE "Pixel frames"): one shared frame class with `border-image` nine-slice, **studs** for big docked panels, **chamfer** for small floating ones, one colour, hard 2-art-pixel shadow; the two 7×7 pictures are the ones in `docs/active/research/pixel_borders_demo.html` (extract the data URIs to PNGs in `public/assets/ui/`; new files, not the owner's uncommitted art). Replace rounded corners, translucent hairlines and blurred shadows; unbox the rows UI_STYLE forbids (`TokenInspection.jsx:132,147,221`, `ShopDrawer.jsx:299`, `HeroSkillSheet.jsx:93`); tooltips first (`Bubble.jsx`, `TopBarTip.jsx`, `QuestTooltip.jsx`, `MatCapBadge.jsx` share classes), then sidebars, Token inspect, drawers, modals, toasts. Builder. Run when no crunch brief is editing those components; cost-log line (`bench:draw --compare`); changes the look: owner eye-check. | research/pixel_borders.md |
| T-134 | P3 | open | The bubble menu's `ui_bar.png` (32×32) is stretched to the menu's width (`BubbleMenu.jsx:92-96`, `backgroundSize: '100% auto'`), about 2.5–4.7×, so its pixels come out uneven. Found by the pixel-borders research. Changes the look: eye-check. | research/pixel_borders.md |
| T-135 | P3 | open | Token hit reactions break the no-scale rule: the `squash` reaction scales by 0.82–1.1 (`hitAnimations.js:90-99`) while `tailwind.css:347-352` says never scale pixel art (non-whole scaling blurs it); and `lootArc.js`'s comment claims a densely sampled arc while the code is a short keyframe slide. Fix the code or the comment. Found by the animation research. | research/animation_menu.md |
| T-028 | P2 | open | Toast types look alike and "×N" never shows. Ruling: a coloured edge per type, "×3" for merged repeats. | CR3-452 |
| T-029 | P2 | open | Every surface closes differently. Ruling: Escape closes the top layer only; click-outside closes light pop-ups only; drawers never close on a stray click. | CR3-454 |
| T-030 | P2 | open | Five tooltip implementations. Ruling: one shared gold-bordered tooltip; plain browser tips only on icon buttons. Owner 2026-10-13: the shared tooltip follows the cursor, offset so it never covers what's under it, flipping at screen edges. | CR3-455 |
| T-031 | P2 | open | z-index: one table for the mat, ~20 literal values elsewhere; unify. | CR3-456 |
| T-032 | P2 | open | Typography window is boxed inside Settings; Escape leaves its preview applied. *Suspected.* | CR3-453 |
| T-033 | P1 | open | **Picking up and dropping still hitch now and then; on a very full mat, at most drops.** Owner 2026-10-07 (dev build, S2): ~90 ms pause at every pickup, ~60 ms at every drop. The drag deep-dive's D3 (2026-10-09) stopped a drag redrawing every draggable: `bench:drag` (perf build, S2, plain pass) now finds a frame over 16.7 ms in 0–9 of 50 pickups (was 47–50) and 0–11 of 50 drops (was 44–50), the median drag's longest frame 6–12 ms (was 18–30); with bubbles showing, pickups 0–10, drops 5–13. Left: Bank pickups (9–10 of 50) and drops, Shop drops (11–13 of 50), and S3 (~320 Tokens), where 41–49 of 50 drops and 11–50 of 50 pickups still have one, typically 18–24 ms, and carrying 6–20 of 50 drags (0.3–0.8 % of frames; the board alone 0.29 %). Causes and numbers: `docs/reference/PERFORMANCE.md`, D3 findings. | CR3-400 |
| T-035 | P2 | open | A push shoves overlapping Tokens anywhere on the mat. Ruling: move only what the newcomer crowds (and what that pushes into). ⚠ The bench will report WORK CHANGED for S4 — expected, accept it here. | CR3-151 |
| T-036 | P3 | open | One panel header everywhere (UI_STYLE "Panel headers", owner 2026-10-13): title left, the red pixel close X (`ui_cancel_red.png`, 16 px, at 2×) top right; ~12 files still use a vector X. | R8-Q3 |
| T-037 | P3 | open | Two ways to hide notifications; keep only "Collapse". | R8-Q8 |
| T-038 | P3 | open | Text sizes / fonts written in code aren't what renders; rewrite them to match (no visible change). | CR3-460 |
| T-039 | P3 | open | Sci-fi words on screen ("Protocol Settings", "SYSTEM BOOT", "neural sync") and other retired vocabulary → plain words. | CR3-464 |
| T-040 | P3 | open | Rules text says "tile". Ruling: "where this one stands", "on the nearest / a random free spot"; Nearby hint = "Tokens within reach of this one". Regenerate RenderGolden and read its diff. | CR3-500 |
| T-041 | P3 | open | A newly recruited hero's class reads "Adventurer", not "Recruit" (`HeroRehydration.js:50`). | FB §5 |
| T-042 | P3 | open | Settings toggle "Item Fly Particles" still says "between cards and inventory". | FB §5 |
| T-043 | P3 | open | Empty-string duplicate React key logged on save load. *Unverified since 2026-09-21.* | FMR |
| T-119 | P2 | open | **The game will be translated** (owner 2026-10-08). Pick how player-facing text is stored (a strings file per language and a lookup), then new UI keeps its text there; converting existing text waits for after the crunch. Until it exists, keep each new screen's text together, not scattered through logic. | ideas.md |
| T-124 | P2 | open | **Credits register** (owner 2026-10-08): a `CREDITS.md` listing every third-party asset pack in `public/assets/` (today Kenney RPG audio and three ZapSplat packs in `audio/sfx/`, plus `audio/bgm/`), its licence file and the exact attribution wording the licence asks for. Whoever adds an asset adds its line. An in-game Credits screen comes before release. | concept_tone_and_world.md |
| T-128 | P3 | open | The Guild Hall upgrade screen fits its web into a box that hides its overflow (`GuildHallBoard.jsx`, `overflow-hidden`), the pattern that let focus scroll the playmat 30 px under the top bar (fixed on the mat with `overflow-clip`, brief 50 D2). Check whether a node there can scroll it; if so, the same one-class fix. *Unverified.* | brief 50 D2 |
| T-132 | P2 | open | **A press on a flag where a hero's figure overlaps it sometimes misses.** `bench:drag` flag → mat, 0–4 of 50 drags a run since D2: either nothing is picked up (the flag's own hero under the pointer: 3 of 50 at `e25a0b2d`, 4 of 50 on S3 at `1bd6352c`) or the overlapping hero's flag is (1 of 50 on S2 and 2 of 50 on S3 at `7773c43c`). Not known yet whether the press lands on the hero's drawn pixels (the game is right; the bench chose a covered point, perhaps as the hero walked in) or its see-through ones (a game fault). Make the bench record the hero art's alpha at the press point, then decide. | brief 50 D3 |

### Cleanup — dead code, vestiges, lint *(safe, invisible; delete tests only with the code they test)*

| ID | Pri | Status | Summary | Origin |
|---|---|---|---|---|
| T-139 | P3 | open | `sprite-manifest.js` has ~61 entries pointing at files missing since before the 2026-10-09 art reorganisation (old `assets/sprites/implemented/...`, `pm_test_*`, `bg_table_*` and similar), and `AssetManager.js` still maps `pm_table_*` / `pm_board_*` ids to the gone `assets/playmat/tables` and `tiles` folders. Remove entries nothing in data/ or src uses (check with the AssetManager on-disk guard). Runner. | art/asset-reorg report |
| T-045 | P3 | open | Dead combat, wound and loot code. | CR3-036 |
| T-046 | P3 | open | A second hero-creation route. | CR3-037 |
| T-047 | P3 | open | 8 retired `collection` fields in the save schema (keep `TOKEN_TYPES`). | CR3-038 |
| T-048 | P3 | open | Small UI leftovers incl. the `ui:open_drawer` chain; events subscribed with no publisher. | CR3-043, 461 |
| T-049 | P3 | open | Computed-and-never-read values; unused reset functions. | CR3-205 |
| T-140 | P3 | open | **The Map check's dials and refusals are read by nothing** since Atlas A5 retired `mapPass.js`: in `cms/src/engine/sim/dials.js` `mapScrapRatio`, `mapProductiveReturn`, `rarityPremium`, `rarityWeights`/`RARITY_WEIGHTS`, `scrapRatioAt`, `productiveReturnAt`, `pinnedAt`; `dayInReach` in `xpPass.js` (and `hoursPerDay` if the Pace dials no longer need it); the seven `map-*` codes in `refusals.js`; their fields in the CMS Settings modal. Delete with their tests (`EconSimXP`'s `dayInReach` cases; `EconSimLevers`' Map-card test flips back to absent). Also `checkPass.js` skips unlimited Tokens because the Map check used to name them: nothing names them now. | Atlas A5 |
| T-141 | P3 | blocked | **Content audit: a respawning node still sold at the Shop** (roadmap A5 lists it): warn when a Token with A2's Respawns block also has a `shop` block. Blocked on A2 merging (its block shape). One rule in `lifecycleAudit.js`, so the boot check and the CMS Economy Audit share it. | Atlas A5 |
| T-050 | P3 | open | Stale comments in board-state files; `hitRadiusOf` doc claims whole-number centres. | CR3-154, FMR |
| T-051 | P3 | open | Four copies of "is this the Guild Hall?"; a second `clampToMat`. | CR3-155 |
| T-052 | P3 | open | Dead drag CSS; retired vocabulary in drag code. | CR3-406, 408 |
| T-053 | P3 | open | Nav "rise above my own modal" can't work; `useUIModals` controls nobody uses. | CR3-459, 462 |
| T-054 | P3 | open | Stylesheets loaded but unused / used but never loaded. Check `modals.css` for global selectors before deleting. | CR3-465 |
| T-055 | P3 | open | Equip-flash timer cleanup never runs. | CR3-466 |
| T-056 | P3 | open | Dead tile/Tray-era code (Tray-named constants renamed in hygiene W4); remaining: Tray-as-current comments; card/deck-era names; Tray dormant storage in `BoardState`/save. | CR3-502, 503, 504, FMR |
| T-057 | P3 | open | Rename tile-named engine vocabulary — code names and event strings together, one slice. | CR3-501 |
| T-058 | P3 | open | Lint residue (~74 old errors), per area: engine, combat (keep `MERGE_GRACE_MS` at 1100), UI↔engine (don't add hook deps blindly), renderer, UI. | CR3-110, 265, 312, 359, 467 |
| T-059 | P3 | open | The CMS imports `itemRegistry` for one constant. | CR3-511 |
| T-060 | P3 | blocked (soak) | Toasts may leave page elements behind. A 60-minute soak decides: certification Part G (`docs/archive/certification_checklist.md`), or automate it with the drawing bench's Chrome driver. | CR3-039 |
| T-061 | P3 | open | `cardSizeStore` is half dead (the drag ghost still reads it); unreachable Shop branches in `InspectionPanel.jsx`. | FB §5 |
| T-062 | P3 | open | `statementText.js` contains a literal NUL byte, so git treats it as binary (no diffs). | FMR (still true 2026-10-06) |
| T-063 | P3 | open | `resolveAnimationPath` hard-codes an id map and uses a relative `assets/` path. *Unverified since 2026-09-21.* | FMR |
| T-064 | P3 | open | Dead clock surfaces and write-only fields (R1-Q4 ruling A). | CR3-105 |
| T-093 | P3 | open | Stale comments found by the GDD survey (2026-10-06): skill/job headers say 27 skills and 6 held (29; 9/11/13 held); `RegenSystem` says only idle heroes regen (also working and fighting); `BoardCombat.tickToken` says enemies never aggro (hostiles do); `reachRegistry` says Near = 8 tiles on a 6×6 board (164 u, 4 sides); `MatCap.js` says nothing enforces the cap (Shop and recipes do); `Restrictions.js` mentions the Vault; `constants.js` says yield/work-time/input-cost axes are unread; `recipePoolRegistry` says 3 recipes; `tempoBands`/`dials` say nothing reads them; `BubbleMenu` says 5 bubbles; `ConsumptionSystem` describes the deck loop; `loopConstants` mentions 100×. | GDD survey |
| T-094 | P3 | open | Dead-code leftovers after hygiene W3 (2026-10-07): functions now used only by tests (`resolveYield`, `getYieldMultiplier`, the other two `EffectAxes` helpers); Villager remnants (`isVillager` branches in `EquipmentValidator`, `HeroRehydration`, `PromotionSystem`, `SkillSystem`); `HeroDockTab`'s unused `onClick` prop; inert `effectFilesGlob`/`recipePoolFilesGlob` in `DatabaseManager.js`. `Placement.removePlacedToken` is kept (benches and tests use it). | GDD survey, W3 |
| T-108 | P3 | open | `cardUseCounts` (counts completed cycles per Token type; `GameState.js`, `BoardRunner.js`) is a deck-era name; rename it after the parked `atlas-wip` branch is merged or dropped (its `StateSchema.js` edit declares the field). | hygiene W4 |
| T-095 | P3 | open | The tutorial beacon for "Plant a Flag" probably targets nothing: its selectors (`#rightmost-hero-dock`, `#hero-dock`) match no element in the bottom dock. *Unverified — check in the game.* | GDD survey |
| T-103 | P3 | open | Comment-slimming leftovers: `src/state/StateSchema.js` (held back, owner's Atlas edit uncommitted), 2 comments in `cms/src/components/editors/RulesLine.jsx`, `cms/src/engine/sim/dryRun.mjs` header, `filterTargetTiles` named in `reachRegistry.js:26,136` (now `filterTargets`), ~15 test comments clipped by the ID stripper (e.g. `AdjacencyEffects.test.js:82`), and trailing string text carrying IDs (`workSkillRule.js` WORK_SKILL_WHY, `lifecycleAudit.js`, `matTuning.js` hints). Also dead exports found: `PERSONALITY_TAGS`, the three tutorial selectors in T-095. | Slimming pass |

### Build, tests, docs

| ID | Pri | Status | Summary | Origin |
|---|---|---|---|---|
| T-133 | P2 | open | **CMS change packs for agent-authored content** (owner 2026-10-09): autosave the workspace to disk every few minutes (the server's last-5 rotation exists, nothing calls it); an inbox (`cms/incoming/`) of change packs reviewed per entry with before/after, edit-before-accept, conflict flags, per-pack undo, notes, placeholder-art flags. Design: `docs/active/concept_cms_agent_authoring.md`. Builder; CMS only, no game code. | concept_cms_agent_authoring.md |
| T-065 | P2 | open | 3 of 7 test fixtures still borrow real `item_` ids — their rename changes the bench fingerprint, so land it as its own accepted commit. | CR3-551 |
| T-067 | P3 | open | Skipped tests: the Map-burst rule skips still need a ruling or deletion. | CR3-554 |
| T-068 | P3 | open | Build ships and preloads scrap art (`archive`/`maybe`/`waste`); keep it out of the build and the preload list. | CR3-508 |
| T-069 | P2 | open | Write the mat-era guide to keeping it fast in `docs/reference/PERFORMANCE.md` (the baseline and how-to-measure parts exist since 2026-10-07; draft in `docs/archive/review_v3/R6.md` §8 + `R7.md` §4). | CR3-021 |
| T-070 | P3 | open | Document `window.Game` — agents rely on ~30 entries the game never reads. | CR3-040 |
| T-111 | P3 | open | Engine bench timings are load-sensitive: on unchanged `main` (`933d12db`, 2026-10-08) a run beside a busy agent read 1.2–2.3× slower on every line; the next run alone matched the baseline on every p50 (0.94–1.05×) with only two p99 tails over 20 %. Treat REGRESSED as noise until reproduced on a quiet machine; the work check is reliable. | T-109 merge gate |
| T-115 | P3 | open | Player-facing Logging wording after the Forestry rename: the tutorial step "Log an Oak Tree / Let your Hero log 3 times" (`tutorialQuests.js`), and the ceremony line "Requires the skills it carries forward at level N" (`PromotionTrade.jsx`), now wrong for basic classes, which gate on two Starting skills. Visible text: owner eye-check (fits brief 30). | brief 20 R2a/R3 |
| T-116 | P3 | open | The CMS content generator still writes the retired task/area effect vocabulary (`targetCategory` enum ALL/COMBAT/MELEE/MINING/INDUSTRY/NATURE/CRAFTING in `contentGenerator.js`); only its skill list follows the registry. Revisit if the generator is revived. | brief 20 R3 |
| T-117 | P2 | open | The desktop app keeps drawing at ~165 fps while minimised (measured 2026-10-08: WebView2 is never told); pause drawing on Tauri's minimise event. Battery and GPU waste. | brief 40 O1 |
| T-118 | P3 | open | `npm run bench -- --cpu-prof` writes the module-loader thread's idle profile on Node 24 (`bench/run.mjs` `runWorker` uses a fixed `--cpu-prof-name`); drop the name or add the thread id. Workaround: plain `node --cpu-prof` (bench/README.md). | brief 40 O1 |
| T-121 | P3 | open | Slot card playtime reads hours for seconds: `formatPlaytime(seconds)` in `SlotSelectionModal.jsx` is handed milliseconds (76 s shows as 21h 6m). | brief 40 O4 |
| T-122 | P3 | open | `HeroEditModal` still embeds `HeroSkillSheet` with its own skill list, duplicating the H2 hero panel; `VitalBar.jsx` may have no consumers left. | brief 30 H2 |
| T-158 | P2 | open | Speech bubbles from different sources (a hero's bubble and the Token's bubble while the hero works it) can cover each other; they should stack smoothly like the bubbles of one source. Owner 2026-10-09. | eye-check B |
| T-142 | P3 | open | The recipe picker's rows are `truncate`, so a recipe's requirement line ("Needs 10× Stone · Needs a Marble Foundation or better") is cut off with "…" at the modal's width and the player can't read it (`StationRecipeModal.jsx`; seen in brief 70 A11). Absorbed by T-169 (do it there). | brief 70 A11 |
| T-143 | P3 | open | `bench/browser/dragKit.mjs` picks drag targets skipping only the Hall and permanent types; on a board with planted Saplings (fixed since Atlas A10) it would count their refused drags as failures. Teach the picker `FixedTokens.isFixed`. | brief 70 A10 |
| T-144 | P2 | open | The tutorial's "Plant a Flag" step (`tut_flag`) has no beacon target: its selectors (`[data-hero-dock-tab]`, `#rightmost-hero-dock`, `#hero-dock`) match nothing since brief 30's hero bar (`[data-dock-hero]`); `TutorialAide.test.js` passes only because its fixture supplies the old attribute. Found by brief 60 P2-2. A8 rewrites the tutorial; fix there or before. | brief 60 P2-2 |
| T-163 | P3 | open | `DndKit.jsx`'s `useLiveDropTarget` (and the comment about a pop-out bin above it) has no caller since the discard bin went (Atlas A3b): delete it. Left in place because A10 also edits `DndKit.jsx`; do it after A10 merges. | brief 70 A3b |
| T-114 | P3 | open | Remove `migrateSkillIds` (the `logging` → `forestry` content migration in the game loaders and the CMS store) once the owner has synced `data/` with `forestry`. | brief 20 R0 |

## 3. Parked — don't work on these without a reason

*Latent = the code is wrong but no shipped content triggers it. Fix it, test
first, when content that uses it is authored.*

| ID | Why parked | Summary | Origin |
|---|---|---|---|
| T-071 | Envelope | Canvas mat. Certification (2026-10-07): the realistic board passes, ~320 Tokens reaches 83 % of frames in budget. Unnecessary at realistic sizes; decide with the Performance Envelope whether boards that large must be smooth. | CR3-355 |
| T-072 | after the crunch | `@ts-check` trial on the contract layer. | CR3-560 |
| T-073 | latent | Input-cost discount applied when paying, not when checking. | CR3-028 |
| T-074 | latent | Item rules can be given moments that never fire. | CR3-202 |
| T-075 | latent | Rule upkeep pays from the Bank only (spawner upkeep is fixed by TL-20). | CR3-204, FB §5.4 |
| T-076 | latent | Each cure reaches only one of the two effect systems. | CR3-251 |
| T-077 | latent | Timed effects lose combat numbers on reload; use game time, not the wall clock. | CR3-252 |
| T-078 | latent | Loadout re-expanded on every axis read. | CR3-253 |
| T-079 | latent | Loading rewrites the Guild Hall's definition. | CR3-257 |
| T-081 | latent | Engine init isn't safe to run twice — only matters with a "back to title" feature. | CR3-108 |
| T-082 | latent | Shop's unreachable refund path skips mat events. | CR3-206 |
| T-083 | re-check | Synchronous subscribers; several whole-mat rebuilds per tick. Probably closed by Wave 3b — re-measure before working on it. | CR3-102 |
| T-084 | not needed | Push solver all-pairs (S4 worst push ~15 ms vs 8). Only matters past ~250 Tokens; T-035 may make it moot. | CR3-152 |
| T-086 | needs a Codex screen | Enemy kill counts never recorded. | CR3-035 |
| T-087 | owner-deferred | Desktop-shell group (save export, `src-tauri`). | CR3-046 |
| T-088 | Stage 2 | Randomness is unseeded and has no injectable source. | CR3-044 |
| T-089 | Stage 2 | Hero state lives in seven stores. | CR3-561 |
| T-090 | Stage 3 | Terrain can't be added through the CMS. | CR3-564 |
| T-091 | Stage 3 | Tokens teleport; mat size is dev tuning. | CR3-565 |
| T-092 | design | The free-playmat plan's "Map stays unopened" overflow rule (FP-46) is unbuilt; overflow drops as loot. | FMR |
| T-100 | before release | Master volume defaults to 0 so the owner can work in silence; set an audible default before shipping. | GDD §16.10 |
| T-167 | P2 | open | **Recruits get a weak basic attack** ("everyone fights", `concept_combat.md`): a hero with no combat skill is refused by `BoardCombat.canFight`, so the cartographer's tutorial step 8 "Win a Fight" cannot be completed in a real new game. Engine change; expect the bench's work check to change. The owner authors a weak, safe enemy in the Starter Camp to go with it. Owner ruling 2026-10-13: keep the step, build this. | Atlas A8 |
