# Brief 210 — the backlog intake (UI tweaks and small systems)

*Written 2026-10-22 by the planning agent from the owner's Backlog Intake
(kept whole at
[`research/backlog_intake_2026-10-22.md`](../research/backlog_intake_2026-10-22.md);
read an item's section there before building it). Owner rulings from the
intake interview are marked **(owner 2026-10-22)**. Built by the **Backlog
director**.*

⚠️ The intake was written by a recording agent from the owner's spoken
notes. **The owner's wish is the "Desired behaviour"; its file paths, line
numbers and root-cause notes are a recording agent's guesses.** Verify them in
the code before briefing a subagent (`CLAUDE.md`: a comment is a
hypothesis). Example numbers in the intake ("e.g. ~240u") are suggestions
unless a ruling below fixes them.

Not in this brief: combat (COMBAT-01, -02, -03), skill loops (SKILLS-01) and
content (CONTENT-01) go to their planning agents and, later, the Systems
director. UI-01 is the existing T-136; GUILD-05 is the existing T-194.

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, `docs/reference/UI_STYLE.md`
(pixel frames, how information reads), `docs/active/ui_rework_list.md`
(locked UI decisions), GDD §14 (the Performance Envelope: nothing may make
the reference board cost more).

## Batches

Six batches, in this order. Each is one eye-check unless marked. Inside a
batch, phases that touch different files may run in parallel (at most two
code subagents). Tiers are suggestions; the director picks.

### A. The mat and its top bar

| Phase | Ticket | Intake | What | Tier |
|---|---|---|---|---|
| A1 | T-211 | MAT-01 | **Mat a little wider and shorter** (`MAT_STEPS`, `MAT_ASPECT` in `src/config/matGeometry.js`). Show the owner two or three sizes on the bench page before baking (owner directs the look). ⚠️ The mat's size feeds world generation and placement (`layoutInputs.js`, terrain): expect WORK CHANGED; old saves may hold Tokens beyond a shorter edge, so test loading an existing save and **stop and report** if Tokens land off the mat. | engineer |
| A2 | T-212, T-213, T-214 | TOPBAR-01, -02, -03 | **Top bar**: the Region's banner art becomes the bar's background behind the name, crisp on the left and fading out to the right (no separate badge); text and icons noticeably larger, using the height A1 frees; the bar exactly as wide as the mat, Tokens/Upkeep in its centre, Disallow and Demolish at the mat's right edge. | builder |
| A3 | T-215, T-216 | TOKEN-01, FLAG-01 | **More room between Tokens and a wider flag reach**: raise the Token hitbox (`hitboxPct` / `overlapPct` in `matTuning.js`) a step; **flag radius 164 → 240** (owner 2026-10-22: reaches all eight neighbours, diagonals at 226). The reach ring becomes a crisp, high-contrast pixel ring (hard edges, gold/amber with a dark pixel shadow) instead of the faint dashed line. Update the tuner hints and the tests that pin 164. WORK CHANGED expected. | builder |

### B. Clean-ups on the mat

| Phase | Ticket | Intake | What | Tier |
|---|---|---|---|---|
| B1 | T-218, T-219, T-220 | TOKEN-02, TOKEN-03, QUEST-01 | **Quieter Tokens**: name badge **below** the Token, centred under its footprint (check whether heroes' names follow; propose and show); remove the ring under movable Tokens; remove the quest-ready gold glow and the tutorial's pulsing beacon rings (`TutorialAideOverlay`; tutorialisation is redesigned later). Check the tutorial still runs without its beacons. | builder |
| B2 | T-217, T-221 | DRAG-01, LOOT-01 | **Drag and loot without the wash**: while dragging, allowed cells stay unpainted, only forbidden cells get a soft warning tint; loot from tasks lands without afterimages, rare twinkles or particle bursts (turned off, not deleted: the owner may want a better effect later, T-196). Cost-log line: this should get cheaper. | builder |
| B3 | T-222 | DRAG-02 | **Bug: picking up an enemy or a flag flies its ghost in from the screen's top-left corner.** The pickup flight must start where the thing stands. Find the real cause first (the intake's guess: a zero-size measured rect for the moving enemy box and the flag shell). Drag bench (drag code changes). No eye-check needed if the fix is invisible except for the bug going away; one line in STATUS. | builder |

### C. Bank, items and the hero bar

| Phase | Ticket | Intake | What | Tier |
|---|---|---|---|---|
| C1 | T-223, T-224, T-225 | BANK-01, ITEM-01, HERO-02 | **Item tiles that say what they are**: the Bank's inspect pane goes; its search box moves into the Bank tab's header, between Select and the slot count; the hover tooltip carries everything (name, count, type, stats/effects, what a map writes, "Equippable: Hand" etc.) and loses "Drag to sort, or onto a hero to equip"; tiles get a subtle tint by item category and a slightly lighter background on hover, so dark outlines read; hero equipment slots show a small pixel icon of their kind (hand, food, drink, hat…) in the bottom-right corner. Missing icon art → placeholder + a line in `owner_art_list.md`. | builder |
| C2 | T-226, T-227, T-228 | HERO-01, DOCK-02, DOCK-01 | **Hero bar and Work Permissions**: equipping an item plays the pixel shine (`.ui-shine`) on the slot instead of the bounce and glow; hero bar shows **portrait + name only**, each portrait cropped from the hero's own class sprite sheet (head and shoulders of the idle frame), facing left; the Work Permissions button becomes a solid chamfered button under the mat (inside its edges), its drawer slides up from below the hero bar, **Combat is its first column**, and it uses the chamfer frame. | builder |
| C3 | T-230 | EQUIP-01 | **One item, one hero** (owner 2026-10-22: **equipping moves the copy out of the Bank into the hero's hands; unequipping puts it back**). Gear, weapons and tools only; food, drink and potions stay shared from the Bank. A hero can't equip what the Bank no longer holds ("All your Bronze Pickaxes are in use"). Check every path that counts Bank stock (crafting inputs, selling, map writing, offline catch-up, saves). ⚠️ Old saves where several heroes share one copy: on load, give copies to heroes in roster order and empty the slots the Bank can't cover, with one notice; **stop and report** if that is not clean, and ask what to do when a returned item meets a full Bank. Tests first. WORK CHANGED possible. | engineer |
| C4 | T-229 | NOTIF-01 | **"New!" on an item stub goes away once you hover it or pin it.** Small engine function plus the hover hook; tests. No eye-check; one line in STATUS. | builder-lite |

### D. The Guild Hall upgrade screen

| Phase | Ticket | Intake | What | Tier |
|---|---|---|---|---|
| D1 | T-231, T-232, T-233 | GUILD-01, -02, -03 | **A calmer sky**: no toasts or item stubs over the upgrade screen; the star drift glides smoothly (try linear motion; if it shimmers at pixel scale, show the owner both); stars stop blinking and use three looks: **grey** nothing bought, **blue** something can be bought, **gold** maxed (`ui_star_grey/blue/gold.png`). | builder |
| D2 | T-234, T-194 | GUILD-04, GUILD-05 | **Room for the web, and the glide back**: Guild Hall Effects leaves its left column and becomes a popover (hover or click the central Hall star); the right Inspect panel keeps its content in the pixel style (frames, headers, buttons); opening the screen plays the camera glide from the mat up to the sky (tag `atlas-camera-move`, skippable, reduced motion respected). | engineer (the glide), builder (panels) |

### E. Drawers, the Atlas and dev tools

| Phase | Ticket | Intake | What | Tier |
|---|---|---|---|---|
| E1 | T-235, T-236 | DRAWER-01, -02 | **Drawers as one panel**: Bank and Shop drawers reach the screen's left edge under the nav orbs (no mat showing through, no grey gutter); opening the Bank moves the rest smoothly (top bar up, stub column off right, mat glides aside) instead of snapping. Drag bench if the mat's movement touches drag measuring. | builder |
| E2 | T-237 | ATLAS-01 | **The Atlas's Regions as a two-page spread**: left page the Region list with nicer banners, click to select; right page a preview of the selected Region (its ground, key stats, landmarks, Travel / Rename / Archive). | builder |
| E3 | T-238 | DEV-01 | **Tidy the dev tools**: retire the floating Playmat Tuner and the terrain/ground dev section (the ground look is settled); keep the mat dials (hitbox, flag radius) reachable as one collapsed section of the QA panel. Run after A3. No eye-check (owner-only tools); one line in STATUS. | builder-lite |

### F. Look-wide passes (last)

| Phase | Ticket | Intake | What | Tier |
|---|---|---|---|---|
| F1 | T-136 | UI-01 | **Pixel frames on every window** (the existing ticket, now with the owner's audit request): every modal, drawer, popover, tooltip and inspect panel off rounded corners and blurred shadows; chamfer for floating, studs for docked. Runs last because batches A–E reframe several of these. | builder |
| F2 | T-239 | BUBBLE-01 | **Who is working what**: when a hero works a Token, one neat row of bubbles appears between them (task, recipe output, charges/timer, problem), each with a hover tooltip explaining it, replacing the scattered rings and icons. **Show two or three mock-ups on the style sheet page first**; the owner picks. ⚠️ Bubbles are already the biggest per-hero cost (T-198): measure before and after. Leave room for the combat UI (combat planning will want a hero-to-enemy link here). | engineer |

## Done means

Each phase: the merge gate (`TESTING.md`), exercised in the running game,
cost-log line for anything drawn (`bench:draw --compare` once per eye-check
batch), the drag bench for B3 and E1, the engine work check on every merge
(A1, A3, C3 expect WORK CHANGED: explain it before accepting). Tickets close
into `docs/archive/tickets_done.md`; changelog entries.

## Owner CMS to-do

None expected. If C1's category icons or D1's stars need art the owner hasn't
drawn, they go on `owner_art_list.md`.
