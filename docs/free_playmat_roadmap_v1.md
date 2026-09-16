# The Free Playmat — roadmap v1

*The authoritative plan for dropping the grid. Written 2026-09-13. Vision:
[`concept_free_playmat.md`](concept_free_playmat.md), corrected the same day
against the code. Status table in §7, open questions in §8.*

**Status: APPROVED 2026-09-13. Stage 0 DONE (tag `feel-trial-0`); slices 1.0–1.5 and Effects Grammar V10 DONE and merged (2026-09-14). Owner played the flags 2026-09-14 and ruled FP-71…FP-84 (§1.8); slice 1.5b (i and ii) DONE and merged. **Slice 1.6 (free placement) next — to be planned with the owner.**

**Do not re-litigate §1.** FP-1…FP-39 are the concept's locked decisions; FP-40…FP-70
are the owner's rulings of 2026-09-13 on the questions a code audit raised and on
this plan. Where the two differ, §1 here wins.

---

## 1. Locked decisions

### 1.1 Carried from the concept

FP-1…FP-14 and FP-16…FP-39 stand as written in the concept, with the amendments
below. ~~**FP-15**~~ is ⛔ **REJECTED** (FP-40).

### 1.2 Owner answers, 2026-09-13

| # | Decision | Why / cost |
|---|---|---|
| **FP-40** | ⭐ **No packing guard.** Buffs stack however many Tokens a player fits into Near. | Owner's pick over a "nearest 8 count" cap, a geometric cap and diminishing returns. A geometric cap can't work: Near sized like today's ring fits ~12 Tokens packed tight, ~18 with overlap. Stacking rests on D-119 ("effects are small"). ⚠️ Content must stay small. |
| **FP-41** | **Distance is centre to centre; large Tokens reach less.** A large Token that needs more reach is authored with a larger reach. | Owner, over edge-to-edge measurement. Today's 5 large Tokens lose most of their neighbours until someone gives them Far. |
| **FP-42** | ⭐ **Defeat furls the flag.** The defeated hero goes home wounded, as today, their flag is taken down, and a notification says who fell and what was lost. | Owner (answer to risk FPR-2). An equal-level hero dies in ~22s; without this a standing flag would feed the hero back in ~11 times an hour. Caps losses at one death per order. |
| **FP-43** | **Manual recall works mid-fight.** Dragging a hero to the dock ends the fight and the enemy resets to full HP, as today (G-4). FP-33's "no retreat" means heroes never flee *on their own*. | Owner. Keeps D-130's "retreat is always available". |
| **FP-44** | **A new game starts with the Guild Hall on the mat.** | Owner. Today it starts in the Tray (`EngineBootstrap.js` `OPENING_TRAY`). |
| **FP-45** | **The Vault drags straight onto the mat.** The drawer slides out of the way during the drag. Depositing stays drag-to-chest or right-click. | Owner, over "arrive beside the Hall" and a staging strip. Replaces the Tray's only real job (Bank → Tray → Board). |
| **FP-46** | ⭐ **A full mat refuses.** A Map that can't fit its burst stays unopened; a craft whose output can't land waits finished until there is room; a spawn is skipped (as today); a bought Map or a Vault withdrawal with no room doesn't happen; a player's drop with no legal spot flies back. | Owner, over "pile up" and "overflow to the Vault". Nothing is lost; the player is told. |
| **FP-47** | ⭐ **Every hero-worked Token names a skill. A Token with no skill is not workable.** | Owner, over "matches any flag" and a "General" flag. ⚠️ 17 Tokens (7 bushes/vines, 8 fruit trees, the wheat field, the watermelon patch, the adamantine ore vein) have a blank skill today and stop being workable until the owner authors one in the CMS. Enemies (combat flag) and Promotion Tokens (FP-34) are exempt. |
| **FP-48** | **Autonomous flags skip Tokens they can't run** (level too low, missing inputs, no recipe, no charges) and the flag shows why each was skipped. | Owner, over "claim and alert". A stuck crew never blocks another hero. |
| **FP-49** | ⭐ **Targeting is not its own system.** Dropping a flag on a Token just plants the flag there; nearest-first then picks that Token because it is closest. The flag's skill switching to the Token's (FP-27) is the only extra. | Owner: *"this does not need unique logic. The flag being placed close to the token would work the same way."* See §8 Q-A for the two edges this leaves. |
| **FP-50** | **Dropping a Token onto a matching copy restocks it,** as today. | Owner, over Managers-only restocking. |
| **FP-51** | **Walking regenerates like everything else.** Overturns assumption A-6. | Owner. HP and energy already regen while idle, working and fighting. |
| **FP-52** | **Stage 0 is a standalone page on the game's dev server,** with zero game code, kept on its own branch, tagged `feel-trial-0`, never merged. | Owner, over a CMS page or skipping it. |
| **FP-53** | **Stage 1 ships Near only.** Close and Far arrive when the first Token needs them, each with its working code (ER-1). | Owner. No content uses them today. |
| **FP-54** | **Hero tabs move to the bottom in Stage 1** (FP-38). | Owner. The Tray's removal rebuilds the layout anyway. |
| **FP-55** | **The Time Bank is out of scope.** It is not made to work with flags or walking; if it breaks, it is left broken and noted. | Owner: on the back burner, possibly to be removed. |

### 1.3 How this roadmap builds it (director's proposals — approved by the owner 2026-09-13)

| # | Decision | Why |
|---|---|---|
| **FP-56** | ⭐ **Convert on the grid first, then remove the grid.** Every "adjacent" reader is rewritten as a distance query while Tokens still sit on tile centres, with Near sized so it reproduces today's 8-tile ring exactly. Flags also land on the grid. Only then does placement go free. | Keeps `main` playable and green after every slice, instead of one enormous branch. The only behaviour change before free placement is FP-41 (large Tokens). |
| **FP-57** | **Stage 1's simple flags pick nearest to the flag's centre.** No walking: the hero appears at the Token they work, and when it stops being workable they appear at the next. Stage 2 switches "nearest" to nearest to the hero and adds the walk. | The concept puts "nearest-first" in Stage 2, but a simple flag still has to choose. This is the least that works and nothing is thrown away (FP-31). |
| **FP-58** | **Hero positions stay out of the save** (A-3, corrected): on reload heroes start at their flag; Token progress is kept; a fight in progress is dropped — all as today. | Matches what the code already does. |
| **FP-59** | **One fresh-save bump, at the free-placement slice.** Slices after it may change the save shape without migration until Stage 1 is tagged. | FP-11; nothing between is released. |

### 1.4 Follow-up rulings, 2026-09-13

| # | Decision | Why / cost |
|---|---|---|
| **FP-60** | **A flag dropped on a Token its hero can't run gets no special treatment.** The hero works something else in range; the Token shows why it was skipped on hover. No red alert. Amends FP-28. | Owner (Q-A.1). Follows from FP-49. |
| **FP-61** | **Promotion Tokens are the one exception to nearest-first:** a hero trains there only when their flag is planted on the Token. | Owner (Q-A.2). FP-34 forbids heroes choosing promotion on their own. |
| **FP-62** | **The Vault is unlocked from the start** until the tutorial pass (FP-39). The `loot_token_placed` gate is removed in slice 1.9. | Owner (Q-B). FP-16 makes the gate's event impossible, which would lock the Vault forever on a fresh save. |

### 1.5 Stage 0 results, 2026-09-13

| # | Decision | Why / cost |
|---|---|---|
| **FP-63** | ⭐ **Tokens crowd.** The collision hitbox is separate from the art and invisible: **80% of the art radius** (small Token: 51 u), with **40% overlap** allowed, so two small Tokens can sit **61 u** apart centre to centre (0.38 tile steps). Large Tokens use the same percentages of their own radius. Amends FP-6's "slight overlap". | Owner, from the feel trial: at 100% hitbox and even 40% overlap *"I still can't get the tokens as close as I want."* ⚠️ Magnifies FPR-1: at maximum packing a 272 u Near circle can hold ~70 Tokens, not ~8. Accepted under FP-40. |
| **FP-64** | **Hitboxes are never drawn.** A Token at rest is just its art; its Near ring shows only while hovered or dragged, and a flag's radius ring only while its hero or flag is hovered or dragged (A-4). | Owner, from the feel trial. |
| **FP-65** | **Starting values:** Near 272 u (≈1.7 steps, reproduces today's ring), flag radius 400 u (2.5 steps), mat 11 steps wide at a 0.64 aspect (1760 × 1126 u). | Owner kept the trial's defaults. Tuned for real at slice 1.11. |
| **FP-66** | ⭐ **A new developer-only "Mat Tuner" panel** (separate from the terrain Playmat Tuner), shown only in dev builds like the QA tester. **Each slice adds the settings it introduces**; values the owner likes are written into the game's defaults at slice 1.11. | Owner, over extending the Playmat Tuner and a single panel slice. |

### 1.6 Slice 1.4 rulings, 2026-09-13

| # | Decision | Why / cost |
|---|---|---|
| **FP-67** | **Order: 1.4a → Effects Grammar V10 → 1.4b → 1.4c.** 1.4a is invisible plumbing; V10 is written to find a hero's opponent **by hero, not by tile**, so flags never break it. | Owner, over "V10 before all of 1.4" and "skip V10". |
| **FP-68** | ⭐ **A hero leaving a Token mid-cycle resets that Token's progress** — moving on by themselves, their flag being moved, or a recall. D-131 is kept. **A moved Token keeps its progress and carries its hero with it; the hero stays on that Token even if it now sits outside their flag's radius**, until the Token stops being workable, the flag is moved or the hero is recalled. ⚠️ **Amends FP-30** (which had the hero move on outside the radius and progress wait on the Token). | Owner, 2026-09-13: *"A moved token keeps its progress. It brings the Hero with it, and it stays on the token even if outside of the flag radius."* |
| **FP-69** | **Stuck Tokens:** today's red badge stays for problems the player can fix (missing inputs, charges, no recipe), plus **one notification when a hero leaves a Token for that reason**. Skill too low shows on hover only (FP-60). | Owner, over "hover only" and "a badge for every reason". |
| **FP-70** | ⭐ **A hero whose Token runs dry waits on the empty spot for its Manager** (FP-19, D-151) — but only while a Manager in reach owes that spot **and can supply it** (a copy is in the Vault). Otherwise the hero moves on. | Owner, over "move on and return later". The supply guard is the director's, so a hero can never wait forever. |

### 1.7 ⚠️ PROVISIONAL — director's picks while the owner was away (2026-09-13 night)

The owner authorized continuing through slice 1.5, choosing the recommended option for any
question the rulings above don't settle, and marking it here for review. **Each of these can be
overturned; none is locked.**

| # | Pick | Alternatives not taken |
|---|---|---|
| **FPP-1** | A claimed Token that hits a **fixable** problem (missing inputs, charges, no recipe) keeps its hero, progress and red badge **until another Token in the flag's radius is runnable**; then the hero leaves with the FP-69 notification. | Leave at once (brief shortages wipe progress); stay forever (the "claim and alert" FP-48 rejected). |
| **FPP-2** | The red badge stays on any Token a flag skipped for a fixable reason, even with no hero on it. | Badge only on claimed Tokens (breaks FP-69). |
| **FPP-3** | A flag dropped on a Token switches to that Token's skill **only if the hero holds that skill**; otherwise the flag keeps its skill and the reason shows on hover. | Always switch (hero idles on a skill they don't have). |
| **FPP-4** | Moving an enemy mid-fight keeps its HP (the fight moves with it). | Reset the enemy. |
| **FPP-5** | The FP-69 notification fires once per hero, Token and reason, until that hero completes a cycle there or re-plants. | Every leave; once per session. |
| **FPP-6** | Until slice 1.5, one hero is drawn per tile (working over waiting over idle); the dock shows the rest. | Stacked badges now. |
| **FPP-7** | An old save's hero on a bare tile gets a flag with no skill, filled at the first tick with their best held non-combat skill. | Pick during save conversion. |
| **FPP-8** | A disallowed Token shows a dim ⊘ on the board at all times (slice 1.5). | Only visible on hover/inspection. |
| **FPP-9** | FP-70's wait needs the spot not marked unstocked, a Manager within reach, and a copy in the Vault. | Looser (any Manager anywhere) or stricter (also a free Manager this tick). |
| **FPP-10** | **The Guild Hall is exempt from FP-47.** Its Wishing Well cycle (written by `GuildUpgradeManager`) has no skill; the Hall is worked only when a flag stands on it, like a Promotion Token, with no skill check. | Author a skill for the Wishing Well; strict FP-47 (silently stops the water). |
| **FPP-11** | The FP-69 notice also fires when a hero's choice **passes over a nearer Token stuck for a fixable reason** to work something else — not only when leaving a Token it held. Still once per hero, Token and reason (FPP-5). | Notify only on leaving a held Token (a stalled Forge nobody ever claimed would go unmentioned). |
| **FPP-12** | A hero who accepts a promotion that spends the Academy's **last charge** goes back to work at once; they don't wait for a replacement Academy they can no longer use (PR-8 skip). | Literal FP-70 wait: idle until the restock, then walk away from it. |
| **FPP-13** | **Disallow is a mark on the Token itself.** A Token a Manager restocks arrives allowed, even if the one it replaced was disallowed. To revisit when slice 1.5 adds the toggle. | Carry the mark on the empty spot so the restock arrives disallowed. |
| **FPP-14** | The separate "X has been wounded!" message is gone everywhere (including the older combat path); a defeat now says it once, with what was lost (FP-42). | Keep both messages. |
| **FPP-15** | **Slice 1.5 flag controls, on the grid.** A small gold **pennant** (flag icon with the skill's icon) marks each flag at the top-left corner of its tile; several flags on one tile fan out. **Idle:** the pennant turns grey with a "…" chip, and the idle hero is drawn small beside it with no glow (replaces D-172's bright idle mark). **Drag the hero** to plant their flag where dropped; **drag the pennant** to move only the flag; drop either on the dock to recall. **Click the pennant** for a skill picker listing the hero's own skills (plus "Fight" if they hold a combat skill). A dashed gold **reach ring** shows while the flag or hero is hovered, dragged or inspected. **Hover** the pennant for the hero's status and up to 5 skip reasons; hover a Token for its own skip reasons. **Disallow:** a "Heroes may work this" checkbox in the Token panel, plus a dim ⊘ on disallowed Tokens (FPP-8). The dock tab shows "Working: X / Waiting / Idle at flag / Idle in Guild". | Any other layout — all of this is cosmetic and cheap to change once the owner has seen it. |
| **FPP-16** | A flag first planted on **bare ground** takes the hero's best held work skill; for a fresh recruit (every skill level 1) ties break alphabetically, so it becomes a **Cooking** flag. Kept until skills are authored. Also: the skill picker lists work skills one by one plus a single **Fight** row (a flag fights with whatever the hero fights with), and dropping a board hero on a hero tab now recalls them instead of silently reordering the dock. | Ask for a skill on first plant; tie-break by something other than name. |

### 1.8 Owner rulings after playing flags, 2026-09-14

The owner played slices 1.4–1.5 (*"It seems to be working"*) and clarified the flag model.
These supersede the decisions named in each row.

| # | Decision | Why / cost |
|---|---|---|
| **FP-71** | ⭐ **A hero works anything they can in range** — every skill they hold, plus combat — shaped by **per-skill rules: allow, disallow, and priority**. ⛔ Replaces FP-22 (one skill per flag), FP-27's skill switch, FPP-3, FPP-7, FPP-16 and FPP-15's skill picker. FP-47, FP-48, FP-60 and FP-61 still apply; promotion stays a deliberate order (FP-34). | Owner: *"I want the hero to work anything it can in range, with a rules setting to disallow/allow or prioritize certain skills."* |
| **FP-72** | **Priority first, then nearest.** The hero takes the nearest runnable Token of their highest-priority allowed skill; only if none can run do they drop to the next priority. | Owner, over "nearest first, priority breaks ties" and "priority as a distance bonus". |
| **FP-73** | **The rules are per hero, opened from a gear badge on the flag**, which slides out a **side drawer panel like the Bank or Vault**. | Owner. |
| **FP-74** | **Combat is one of the rules, allowed by default.** ⚠️ Raises FPR-2 (unattended deaths); FP-42 (defeat furls the flag, one message) is the mitigation. | Owner, over "off by default" and "combat separate". |
| **FP-75** | ⭐ **Both reaches start small: flag radius ~164 u and Near radius ~164 u** (the four side neighbours on today's grid, not the diagonals). Mat Tuner defaults change from 400 and 272. **Both will be upgradeable later.** ⚠️ Every Near reader shrinks with it — buffs, tools serving a station, Manager reach, neighbour triggers, "Cannot" counts — and a **2×2 Token reaches nothing and is reached by nothing** (its nearest centre-to-centre neighbour is ≥ 253 u) until upgrades or a Far reach exist. Amends FP-65 and FP-56's "Near reproduces today's ring". | Owner, 2026-09-14: *"both around 164… These ranges will be upgradeable later on."* |
| **FP-76** | ⭐ **The player never moves a hero.** Clicking and dragging a hero **moves their flag**; the hero goes to their next appropriate target (walking is Stage 2; until then they appear at it). Replaces FPP-15's "drag the hero to plant where dropped". | Owner: *"The player does not control the Hero. They move the flag, and the hero walks to the next appropriate target."* |
| **FP-77** | **Flags use the owner's sprites** (`public/assets/ui/flag/`: a base flag and eight colours), replacing the icon pennant; **hero and flag sprites display at 128 px**. | Owner: *"I have flag sprites that can be used instead of an icon… These sprites should still be displayed at 128px size."* |
| **FP-78** | **Built as slice 1.5b, before 1.6.** Hero walking itself stays in Stage 2. | Owner, over folding it into Stage 2. |
| **FP-79** | **Priority is a number 1–5 per skill.** **1 is highest** (owner confirmed 2026-09-14); every skill starts at **3**. Within the same number the hero takes the nearest job (FP-72). | Owner, over High/Normal/Low and a ranked list. |
| **FP-80** | **A higher-priority job appearing mid-job: the hero finishes the current cycle, then switches** (in combat, after the win). No progress is lost. | Owner, over "stay until the job stops" and "switch at once". |
| **FP-81** | **The rules drawer is a narrow panel that covers the Notifications column.** | Owner, over the full Bank-width drawer. |
| **FP-82** | **Each hero has a lasting flag colour, given automatically and changeable in the Edit Hero modal.** Full hero recolouring is a later polish feature. | Owner, over "automatic only" and "plain flag means idle". |

**Director's technical picks for 1.5b (provisional, owner may overturn):**
* **FPP-17** — Rules live **on the hero** (`hero.flagRules`), so they survive a recall, a defeat and a save; a missing entry means allowed at priority 3; skills gained later start at the default, a banked-and-restored skill keeps its rule.
* **FPP-18** — A skill switched off in a hero's rules is skipped with its own hover reason ("off in X's rules"), distinct from a Token being disallowed (FP-35).
* **FPP-19** — Old saves' single `flag.skill` is **dropped**, not turned into a priority (FPP-16 had made most flags Cooking by accident).
* **FPP-20** — On today's grid the 128 px flag's pole stands at the tile's **bottom-left corner**; rules open **only from the flag's gear badge** (FP-73), not also from the hero sheet.
**Owner clarification, 2026-09-14 (after 1.5b-ii):** *"We won't have 'Tiles' in the new system. Tokens and flags sit freely around the playmat. When a hero is idle, they walk back to stand next to their flag. Flags can be very close together, slightly overlapping, but that isn't an issue."*

| # | Decision | Why / cost |
|---|---|---|
| **FP-83** | ⭐ **Flags sit freely on the playmat, like Tokens** — at the point they are dropped, in mat units. Flags may be very close together or slightly overlap; **they never push, nudge or hide each other or Tokens**. The grid-era fan-out, "+N" chip, hidden 4th-plus flags and the tile-corner pole position (FPP-20) are **stopgaps for today's grid only**, removed when free placement lands (slices 1.6–1.7; `flagGeometry.flagOrigin` is the one place that changes). | Owner. Restates FP-2/FP-20 for flags; corrects a grid-bound question. |
| **FP-84** | **An idle hero stands next to their own flag** (walks back to it in Stage 2, A-1; until walking exists they appear beside it). | Owner. Restates FP-29. |

### 1.9 Slice 1.6 rulings, 2026-09-14

| # | Decision | Why / cost |
|---|---|---|
| **FP-85** | **Old saves simply stop loading — no message, no export.** The save version is bumped (FP-11, FP-59); nothing else is built for old slots. | Owner: *"I delete old saves and start new ones every time anyways."* |
| **FP-86** | **For one slice the bigger mat (11 steps wide) is drawn in today's board space**, so Tokens look smaller and slightly soft until slice 1.7 grows the mat and sharpens the art. | Owner, over starting at today's width or pulling 1.7 into 1.6. |
| **FP-87** | **Restock-on-copy leftovers stay on the mat**, nudged right beside the copy. Nothing is lost. | Owner, over "flies back" and "goes to the Vault". |
| **FP-88** | ⭐ **A drop that would break a "Cannot" rule is nudged to the nearest spot that obeys it**; it flies back only if no such spot is within nudge reach. | Owner, over "flies back with the reason". |
| **FP-89** | **Anything that picks one Token among several picks the nearest, then the earliest placed** — Managers, flags, and now "Converts" rules too (they used to take the lowest tile number, which a free mat doesn't have). | Owner, 2026-09-15, over "earliest placed only" for Converts. |
| **FP-90** | **Arrival order replaces tile order** where order matters: a Manager restocks empty spots in the order they ran dry, and stations claim scarce ingredients in the order they were placed. | Owner, 2026-09-15, over "nearest the Guild Hall first". |
| **FP-91** | **Spawns choose their spot by real distance.** "Nearest free" is straight-line nearest (a spot beside beats a diagonal one); "random free" keeps the roomiest of 40 random free spots. Slice 1.8 builds on this. | Owner, 2026-09-15, over restoring the old 8-around / uniform-random behaviour until 1.8. No shipped content uses spawns yet. |
| **FP-92** | **For slice 1.6c, today's landing area is centred on the bigger mat** (1760 × 1126 u); the Guild Hall starts in the middle, where it stays from 1.6d. A labelled stopgap origin, deleted in 1.6d. | Owner, 2026-09-15, over the top-left corner. |
| **FP-93** | **Until 1.6d, the mat shows a faint outline of where Tokens can land, and a drop well outside it flies back** with a short note. The mat itself is a subtle darker surface. | Owner, 2026-09-15, over "no outline, snap to the edge" and "no drawn edge". Temporary — 1.6d lets Tokens land anywhere. |
| **FP-94** | **A dropped flag stands exactly where it was let go**, from slice 1.6c (FP-83 applied now, not in 1.6d). A flag dropped on a Token stands over it. | Owner, 2026-09-15, over snapping flags to the nearest spot for one more slice. |
| **FP-96** | **The playmat is a plain darker surface with a soft rounded border** once the practice outline goes — placeholder until the owner gives it art. | Owner, 2026-09-15, over no edge at all and a textured surface. |
| **FP-97** | ⭐ **The Tray's mini board stays until slice 1.9, rebuilt as a small scaled picture of the mat** — free placement at a smaller scale, so you can still place while a drawer covers the board, and no square grid survives slice 1.6d. | Owner kept the mini board over the drawer sliding aside (FP-45, still planned for 1.9) and closing it. The mini-mat rebuild is the director's, since tiles cannot survive this slice. |
| **FP-98** | **Shrinking the mat in the Mat Tuner pulls stranded Tokens inside** and nudges them apart, the same way a drop does. | Owner, 2026-09-15, over refusing to shrink and leaving Tokens outside. |
| **FP-95** | **Saves made between slices 1.6a and 1.6c-1 are left as they are** — no save-version bump and no conversion. Their Token points predate the centred play area (FP-92), so they may load with Tokens off the play area. | Owner, 2026-09-15, over bumping the version or converting them. The owner starts fresh saves (FP-85). |

**Director's technical picks for 1.6 (provisional):** Tokens stay fully inside the mat edge; nudge reach 160 u (Mat Tuner row); ties go to the earlier-placed Token; a transformed Token loses its hero for one tick; spawns skip when no spot is found; the Guild Hall moves freely but can't leave the mat; Maps don't collide until 1.8; the upgrade board keeps its own geometry.

**Slice 1.6 is split into four sub-slices**, each keeping `main` playable:
* **1.6a — Storage by Token, save bump.** `board.tokens[id]` with x/y; spot-based vacancies; `GAME_VERSION` 0.8.0; new game has the Hall at the mat centre (FP-44). A labelled **stopgap shim** answers today's tile questions from positions so every reader keeps working; it is deleted in 1.6d.
* **1.6b — Tile-free readers** ⚠️ riskiest: reach, rules, Managers, Cannot, fights, promotion, flags, effects, spawns, events and UI hooks all keyed by Token id and point.
* **1.6c — The mat renderer**, with a labelled stopgap that still snaps drops to tidy spots so it plays like today.
* **1.6d — Free placement.** Drop anywhere with nudge / fly-back (FP-6, FP-46, FP-63, FP-87, FP-88), restock-on-copy (FP-50), Mat Tuner hitbox / overlap / mat size / nudge reach, and every grid remnant (shim, cascade, `TrayMiniBoard`, `BoardTile`, `adjacency.js`, the playmat half of `boardGeometry`) deleted.

* **FPP-21** *(owner, 2026-09-14: keep for now, revisit after 1.5b-ii)* — The flag's hover lists every skipped Token, including ones whose skill the hero lacks ("doesn't have the skill"), capped at 5 lines plus "more". To be judged again beside the rules drawer.
* **Slicing:** **1.5b-i** engine, rules model, migration and both radii at 164; **1.5b-ii** dragging the hero moves the flag, flag sprites and colours (with the Edit Hero picker), the gear badge and the rules drawer.

### What this changes in other plans

* **Effects Grammar v2:** V10 (`opponent` role) should land **before** Stage 1. G-15 / V9's
  spawn placement is re-planned in slice 1.8.
* **Effects Robustness:** its placement / arrival triggers (`TILE_CHANGED`,
  `HERO_MOVED`) are **paused** until Stage 2 is done.
* **Dynamic terrain:** P5+ shelved (FP-10).
* **Code review round 2:** don't fix Tray tickets (CR2-157, CR2-134, the
  `TrayMiniBoard` finding); the Tray is being deleted.
* **CMS rework v2:** its open question on what an extended reach applies to is
  closed by FP-14 / FP-53.

---

## 2. The shape

```
TODAY                                   AFTER STAGE 1
board.tiles[0..35]  ── Token            board.tokens[id] ── Token { x, y } in mat units
board.tray          ── Token {x,y}      (gone — FP-3)
board.heroTiles     ── hero → tile      board.flags[heroId] ── { x, y, skill }
neighboursOf(tile)  ── 8-tile list      nearby(token, 'near') ── distance query
board.sprites/maps  ── pixels           board.sprites/maps ── mat units
```

**Near on the grid.** A tile step is 160px (128px art + 32px gap). The diagonal
neighbour is 226px away and the next ring 320px, so any Near radius between them
reproduces today's ring for 1×1 Tokens. Slice 1.2 picks one (e.g. 272px ≈ 1.7
steps). Stage 0 tunes the real value and mat size.

**What "the hero on this Token" means under flags.** Several systems ask "who is
standing here" (damage aimed at the worker, statuses, rule roles, hero gear feeding
the Token, filters). Under flags the answer is **the hero whose flag has claimed
this Token** — one lookup replaces `heroOnTile`, so those readers change once.

---

## 3. Stage 0 — Feel trial

### S0 — The sandbox *(one sitting; answers "is free placement better?")*

* A standalone page served by the game's dev server (e.g. `feel-trial.html`), its
  own small script, **no imports from `src/`**. Uses the real Token art files from
  `public/assets`. (Checked: `vite.config.js` uses the default root, so the dev
  server serves any extra root-level page, and the build still packages only
  `index.html` — the trial never ships in the game.)
* A scaling mat (grows and shrinks with the window) with round Tokens of two sizes,
  draggable, nudged when dropped too close.
* Sliders: **Near radius**, **overlap allowed**, **mat size**. Hovering a Token draws
  its Near ring and counts what's inside.
* One hero, one flag: plant it, drag it, watch the hero walk tree to tree
  nearest-first and "chop" on a timer. Drop the flag on a tree to see targeting.
* A "today's grid" toggle that snaps Tokens to 6×6 for side-by-side comparison.

**Verified when** the owner has played it and given a go / no-go, plus starting
numbers for Near radius, overlap and mat size. Tagged `feel-trial-0`; branch
deleted after tagging.

**If it's a no-go, the plan stops here** (FP-1). Nothing in the game was touched.

#### What S0 decided that the plan did not say

* ⭐ **Owner verdict: GO** (2026-09-13). Numbers recorded as FP-63…FP-65; the tuning
  panel as FP-66.
* ⚠️ **Crowding needed its own hitbox.** Tying collision to the art circle made
  crowding impossible even at high overlap, so the hitbox is a separate, invisible
  radius (FP-63).
* ⚠️ **Crisp art has a floor.** Rounding sprites to whole-number scales (FP-5) never
  goes below 1×, so on small windows 64px art spills past its circle. Check at slice
  1.7 (FPR-6).
* ⚠️ **FP-49 edge seen in play:** with nearest-*to-the-hero* (Stage 2), dropping a flag
  on a Token does not guarantee that Token is next if the hero is mid-job. Stage 1's
  nearest-to-the-flag (FP-57) doesn't have this; revisit when slicing Stage 2.
* The trial lives only in the tag `feel-trial-0` (`87e7ea9`): `feel-trial.html` +
  `feel-trial/`. To replay it, check out the tag and open `/feel-trial.html` on the
  dev server.

---

## 4. Stage 1 — Free playmat

Each slice is one sitting on its own short-lived branch off `main`, tested (`npm test`
compared against `main`'s baseline), exercised in the real game, and merged only
after the owner has seen it verified.

### 1.0 — Blank skills become visible *(prerequisite, on the grid)*

* Content audit and the CMS flag every hero-worked Token with no skill (FP-47).
* The owner authors skills for the 17 blank Tokens in the CMS and syncs. (The Cow
  and Thorn Elemental also have a blank skill but are enemies, so they are exempt.)

**Verified when** the audit shows zero blank-skill worked Tokens. (No runtime change
yet, so nothing becomes unworkable before the owner has authored.)

### 1.1 — Terrain off *(on the grid)*

* One switch turns terrain off (FP-10): no painting on placement, no canvas, no
  Map stamp. Files stay; terrain tests skip with a pointer to FP-10.

**Verified when** the game runs and looks right with no terrain, and the 5
`TerrainRegistry` baseline failures are accounted for.

### 1.2 — `nearby()` and the passive readers *(on the grid)*

* Every Token gets a mat position derived from its tile. A `nearby(token, reach)`
  query measures centre to centre (FP-41).
* `adjacent` stays the stored reach id and now means **Near** (no content
  migration). `self_and_adjacent` likewise.
* Convert: `TileModifiers` (Provides, Grants, Applies, filters), `filterTargetTiles`
  and its callers (statuses, `DealDamage`, `EffectActions` counts), `ConnectionLines`.
* **Mat Tuner panel created** (FP-66), dev builds only, with its first setting:
  **Near radius** (default 272 u, FP-65).

**Verified when** every existing test still passes except the ones pinning large-Token
neighbours, which are rewritten to FP-41 and read by the director.

### 1.3 — Crafting, charges, Managers, triggers, Cannot *(on the grid)*

* Convert `RecipeResolver` (tool beside a station → near it), `Charges` wear per
  station served, `Managers` reach and tie-break (nearest, then id), `TriggerSystem`
  neighbour triggers, `Restrictions` (a nearby count).
* Rebuild radius on change is at least Near, and board reach always rebuilds all.

**Verified when** tests pass and a Forge + tool + Manager setup runs in the game
exactly as before.

### 1.4 — Flags on the grid, engine *(on the grid)*

> **Split into three sub-slices (FP-67), with Effects Grammar V10 between 1.4a and 1.4b:**
> * **1.4a — The worker seam.** No behaviour change. `BoardState` gains `workerOf(anchor)`,
>   `workTileOf(heroId)` and `displayTileOf(heroId)`, still backed by `heroTiles`; every
>   reader (engine, UI, dock, filters, damage, statuses, roles, gear) goes through them. A
>   guard test fails if any other file reads `heroTiles` directly. `HeroDockTab`'s dead
>   event names fixed.
> * **V10 — `the opponent` role** (Effects Grammar v2 roadmap), resolving a hero's
>   opponent by hero rather than by tile.
> * **1.4b — Flags replace `heroTiles`; work flags choose jobs.** `board.flags`
>   (converted from `heroTiles` on load; no save bump, FP-59), runtime claims keyed by
>   Token instance, one shared "can this run?" check for choosing and running, sticky
>   nearest-first claims, skip reasons, FP-47/48/68/69/70, hero displacement deleted,
>   Mat Tuner **flag radius**. Bridge until 1.5: dropping a hero on a tile plants the flag
>   there with that Token's skill.
> * **1.4c — Combat, promotion, disallow.** Combat flags roam the radius; FP-42 defeat
>   notification; FP-43 recall resets the enemy; promotion offers never wiped by a
>   one-tick gap (PR-7); disallow per Token.
>
> The original bullets below remain the scope of 1.4 as a whole.

* `board.flags` replaces `board.heroTiles`. A flag has a position, one skill, and the
  global radius (FP-23).
* Simple flags (FP-57): nearest to the flag, one hero per Token (FP-25), skip what
  can't run and record why (FP-48), skill-less Tokens not workable (FP-47), Promotion
  Tokens only when the flag is on them (FP-34, FP-49).
* Combat flags fight enemies in range (FP-32). Defeat furls the flag and notifies
  (FP-42). Recall mid-fight works (FP-43). Disallow per Token (FP-35).
* "Who works this Token" becomes the claiming hero (§2) for damage, statuses, roles,
  gear and filters.
* Mat Tuner gains **flag radius** (default 400 u, FP-65).

**Verified when** tests cover each rule above, with a test that fails if the rule is
removed.

### 1.5 — Flags on the grid, UI

* Drag a hero from the dock onto the board: plants their flag at that point. Skill
  picker on the flag (A-8). Drag the flag to move it. Drag the hero to the dock to recall.
* The radius ring shows while dragging or inspecting (A-4). Hover the flag for skip
  reasons. A quiet idle marker (FP-29). A disallow toggle on the Token panel.
* Quests: `hero_deployed` fires on planting a flag.

**Verified when** the owner can run a small operation on today's grid with flags —
the first playable preview of the new hero model.

### 1.6 — Free placement *(the grid goes; fresh save)*

* `board.tokens` with mat positions becomes the truth; tiles, cascade push, swap and
  hero displacement are deleted (FP-6, FP-7). Save schema bumped; old saves refused
  with a clear message (FP-11, FP-59).
* Drop anywhere; a too-close drop nudges the dropped Token; no legal spot flies back
  (FP-46). Collision uses the invisible hitbox, not the art (FP-63, FP-64).
* Mat Tuner gains **hitbox size** (80%), **overlap** (40%) and **mat size**
  (11 steps) (FP-63, FP-65). "Cannot" is checked on the drop. Dropping on a matching copy restocks (FP-50).
* The Hall is an ordinary movable Token (FP-8) and a new game starts with it on the
  mat (FP-44).
* ⚠️ Largest slice; may split into engine and tests (1.6a) and tile-free readers (1.6b).

**Verified when** a fresh game starts with the Hall on the mat, and Tokens place,
nudge, refuse and restock by drag.

### 1.7 — The mat UI

* One scaling mat that grows and shrinks (FP-4), Token art at whole-number scales
  (FP-5), a single drop target converting the pointer to mat units, range rings,
  flags drawn on the mat.

**Verified when** it looks right and stays crisp at three window sizes, with
screenshots.

### 1.8 — Arrivals land on the mat

* Map bursts, crafted Tokens and spawns land on the mat and may push, never into a
  "Cannot" break (FP-16, FP-17); the full-mat refusals of FP-46.
* Spawns and transforms now check "Cannot" too (they don't today).
* The loot layer carries items only, in mat units (A-7). Bought and reward Maps land
  beside the Hall (FP-18). Managers restock in the exact spot (FP-19).

**Verified when** bursting a Map into a crowded corner pushes correctly, and a full
mat refuses with a message.

### 1.9 — The Tray goes; hero tabs at the bottom

* Delete `Tray`, `TrayMiniBoard` and every Tray route. Vault ↔ mat by direct drag
  (FP-45). Inspection panels stay put (FP-12). Hero tabs at the bottom (FP-54).
* Quests re-pointed: `context_token_placed`, `quick_recall` (`return_to_tray`), and
  the `loot_token_placed` Vault gate (see §8 Q-B).
* New Guild Hall upgrade track widening the flag radius (FP-23).

**Verified when** a whole session is playable from a fresh game with no Tray.

### 1.10 — Wording

* "adjacent" → "nearby" in the reach, trigger, restriction and filter labels, the
  description dictionary, ContentAudit and the CMS reach picker. RenderGolden
  regenerated and its diff read.

**Verified when** Token descriptions in the game and CMS say "nearby" and the golden
diff contains only that wording change.

### 1.11 — Tune and tag

* Play a fresh game through; write the Mat Tuner values the owner settles on into
  the game's defaults (FP-66); add a note to the simulator dials about walking and
  idle time (FPR-5).
* Bump the five version files, CHANGELOG, tag **v0.8.0**.

**Verified when** the owner has played Stage 1 and says it's a place worth stopping.

---

## 5. Stage 2 — Autonomous heroes *(outline; sliced after Stage 1)*

* **2.1 Walking** — straight lines over Tokens (A-1), costs a little work time
  (FP-26), regen continues (FP-51); hero position runtime-only (FP-58). ⚠️ Must not
  publish `HERO_MOVED` every frame (it rebuilds modifiers).
* **2.2 Crew behaviour** — nearest to the hero, following a moved Token and keeping
  progress (FP-30), idle walk-back to the flag.
* **2.3 Painting tools** — if ready (FP-36).
* Tag v0.9.0.

## 6. Stage 3 — Living mat *(outline)*

Growth, planting and harvesting chains on the existing Spawns / Transforms, and the
Vault decision (FP-37). Planned once Stage 2 is played.

---

## 7. Implementation status

| Slice | State | Notes |
|---|---|---|
| Roadmap + concept corrections | ✅ **DONE** 2026-09-13 | Owner approved the plan and FP-56…FP-62 |
| S0 Feel trial | ✅ **DONE** 2026-09-13 | Owner verdict GO; tag `feel-trial-0`; FP-63…FP-66 |
| 1.0 Blank skills visible | ✅ **DONE** 2026-09-13 | Boot audit, CMS Economy Audit tab and Token editor flag blank skills (one shared rule, `workSkillRule.js`); 13 new tests. ⏸ Authoring the 17 skills is **owner-deferred to the content polish pass** — ⚠️ from slice 1.4 those Tokens are unworkable until authored (accepted) |
| 1.1 Terrain off | ✅ **DONE** 2026-09-13 | One switch, `TERRAIN_ENABLED = false` in `terrainRegistry.js`, guards painting, backfill, Map stamp, Vault stamp, canvas and Playmat Tuner; save schema untouched; `TerrainPainting` forces it on, new `TerrainOff` pins it off; the 5 `TerrainRegistry` failures are unchanged content-coverage gaps |
| 1.2 `nearby()` + passive readers | ✅ **DONE** 2026-09-13 | `nearby.js` (centre-to-centre, Near 272 u) now drives `TileModifiers` (Provides/Grants/Applies, `filterTargetTiles` → statuses, damage, counts) and `ConnectionLines`; rebuilds follow the radius; 2×2 reach 12 → 8 per FP-41; dev-only Mat Tuner (`matTuning.js` + `MatTuner.jsx`) with Near radius |
| 1.3 Crafting, charges, Managers, triggers, Cannot | ✅ **DONE** 2026-09-13 | `RecipeResolver`, `Charges`, `Managers` (nearest-then-anchor tie-break), `TriggerSystem` neighbour triggers and `Restrictions` (Near count on hypothetical layouts via `centreOf`) all measure with `nearby.js`; `Placement` publishes one dirty event with a radius-aware rebuild set; board-reach rules rebuild every tile; 36 new tests (`ActiveReaders`); `adjacency.js` has no production callers |
| 1.4a Worker seam | ✅ **DONE** 2026-09-13 | `BoardState.workerOf` / `workTileOf` / `displayTileOf`, still backed by `heroTiles`; ~30 readers converted; `WorkerSeam.test.js` guard; no behaviour change. ⚠️ `workerOf` still returns a hero on a bare tile and `recallHeroById` resolves via the tile — both for 1.4b |
| V10 `the enemy` role | ✅ **DONE** 2026-09-13 | Effects Grammar V10a + V10b (G-40…G-43); enemy found by hero, flag-proof; old `target: 'enemy'` flag retired |
| 1.4b Flags replace `heroTiles`, work flags | ✅ **DONE** 2026-09-14 | `board.flags` + runtime claims by instance id (`BoardState`), `Flags.js` (two-phase assign, sticky claims, FP-68 carry, FP-70 waits, FP-69 notices), `WorkCheck.js` shared with the runner, hero displacement deleted, bridge `placeHero` plants a flag, `heroTiles` converted on load (no version bump), Mat Tuner `flagRadius`. 32 new tests, 34 neuterings caught; every rewritten test listed in the build report. Provisional picks FPP-1…FPP-11 (§1.7). Fixed in passing: the dock's recall-by-drop called an undefined `engine.Placement`. |
| 1.4c Combat, promotion, disallow | ✅ **DONE** 2026-09-14 | Combat flags roam the radius (FP-32); `BoardCombat.moveFight`/`detachFight`/`attachFight` keep a moved enemy's HP (FPP-4); `endFightOfHero` ends a fight the moment a hero lets go (FP-43); one defeat message listing losses (FP-42); a heroless tick no longer clears a promotion offer, a re-plant or different hero does (PR-7); `Flags.setDisallowed` (FP-35, console only until 1.5). 25 new tests, 26 neuterings caught. Provisional FPP-12…FPP-14. |
| 1.5 Flags UI | ✅ **DONE** 2026-09-14 | Pennants (`FlagLayer.jsx`, `FlagMark.jsx`), grey idle pennant + small unlit hero (D-172 glow removed), hero vs pennant drags (`DRAG_KIND.FLAG`), dock/tab drop recalls (`dockRecall.js`), skill picker (`Flags.setSkill` re-plants), dashed reach ring on hover/drag/inspect, skip-reason hover text (`flagText.js`), "Heroes may work this" checkbox + ⊘, dock status line; `hero_deployed` on every plant. 43 new tests, 16 neuterings caught. ⚠️ UI is provisional (FPP-15, FPP-16) — **owner to review in the game**. ⏸ **Owner's overnight stop point: 1.6 not started.** |
| 1.5b-i Flag rules engine, both reaches 164 | ✅ **DONE** 2026-09-14 | `FlagRules.js` (`hero.flagRules`, priority 1–5, default 3, Fight rule); `Flags.evaluate` ranks priority → distance → anchor across work and enemies; `setRule`/`resetRules`; FP-80 switch at cycle end; `rule_off` skip; skill picker/`setSkill`/`bridgeSkill` removed; old `flag.skill` dropped; `flagRadius` and `nearRadius` defaults 164. 17 neuterings caught. ⚠️ Devices that touched the Mat Tuner keep old values until Reset. |
| 1.5b-ii Drag moves the flag, sprites, colours, gear, rules drawer | ✅ **DONE** 2026-09-14 | FP-76 board hero drag = flag drag; FP-77 owner's flag sprites at 128 px (`flagGeometry.flagOrigin`, pole 8 px outside the tile's bottom-left, opaque-pixel hit-test); FP-82 `hero.flagColour` (`FlagColours.js`, auto at first plant, 8 swatches in Edit Hero); gear badge → `FlagRulesPanel` over the Notifications column (dedicated panel, not the Bank shell); idle hero at 128 px + "…"; fan-out 20 px + "+N" (flags past the 3rd not drawn). 32 new tests, 24 neuterings caught. ⚠️ Owner flagged that idle heroes / flag layering on a shared tile rests on a misunderstanding — **clarification pending before 1.6**. |
| 1.6a Storage by Token, save bump | ✅ **DONE** 2026-09-15 | `board.tokens[id]` with x/y/placedAt (`addToken`/`removeToken`/`setTokenPoint`/`getTokenById`/`tokens()`); spot vacancies (`setVacancyAt`); `GAME_VERSION` 0.8.0, old saves just fail to load (FP-85); `OPENING_MAT` puts the Hall on the board; old-save conversions and terrain paint hooks removed; **stopgap `gridShim.js`** (pinned tiles, guard test counts importers) until 1.6d; test helper `tests/fixtures/mat.js`. 13 new tests. Tutorial 1 reworded (Hall starts on the board). |
| 1.6b-1 Tile-free readers (reach, rules, Managers, recipes, triggers, flags, seam) | ✅ **DONE** 2026-09-15 | `nearby(id)` + cached `neighbourIds`, `matGeometry.js`, per-instance `TileModifiers` with `rebuildAround(points)` (both old and new points), `Restrictions` by point, Managers by spot, `TriggerSystem` by id, `Flags`/`WorkCheck` by id, worker seam `workerOf(id)`/`workTokenOf`/`displayPointOf`, `BoardRunner` by id in arrival order; ties go to the earlier-placed Token (FP-89, FP-90). 20 new tests incl. the stale-buff test. Labelled stopgap tile adapters remain for part 2. |
| 1.6b-2 Tile-free readers (combat, promotion, effects, spawns, events, loot, quests) | ✅ **DONE** 2026-09-15 | Fights keyed by enemy instance id (`moveFight`/`detachFight`/`attachFight` deleted), promotion offers by id, statement roles by id (`tokenFor`), Converts nearest then earliest (FP-89), spawns by distance (FP-91; free tile-centre candidates are a stopgap until 1.6d), `centreOfBoard` = Guild Hall point, quest and board events carry `instanceId` / `x, y` (payload guard, empty allowlist); UI reads them through the **stopgap `payloadTile.js`** until 1.6c. The game check caught a dock crash the tests missed (fixed); an ESLint undefined-variable pass over all 75 changed files found no other leftovers, and lint warnings match `main` exactly. |
| 1.6c-1 Mat frame + one drop function | ✅ **DONE** 2026-09-15 | Mat 1760 × 1126 u (`matGeometry`), centred old area (stopgap `OLD_AREA_ORIGIN`, FP-92), Hall at (960, 643); every drop through `dropOnMat(payload, point)` (`placeTokenFromDrag` deleted; stopgap `oldSpotStopgap.js` snaps Tokens to the nearest old spot, occupied or not); flags at the raw drop point (`Placement.plantFlagAt`, FP-94); far-outside drops fly back (FP-93); particles scaled to the board; `displayTileOf`/`tileOfToken` deleted. The game check caught a Tray-drop bug the unit tests missed (fixed, with a regression test). 0.8.0 saves left as they are (FP-95). |
| 1.6c-2 Mat renderer | ✅ **DONE** 2026-09-15 | `MatBoard`/`MatToken`/`MatHero` draw Tokens, heroes and flags at their mat points by instance id; token-event router replaces per-Token subscriptions; flags at their point with no fan-out or "+N"; FP-93 faint outline; hover picks the nearest centre; inspection follows a moved Token; `BoardTile`, `payloadTile`, `spotForDrop` and the fan-out constants deleted. Merged on the owner's instruction with tests (exactly the 11 baseline failures, 2946 passing) and an ESLint `no-undef` pass green; ⚠️ the helper's in-game checklist was still running at merge time — its findings land as follow-up commits. |
| 1.6d-1 Free placement lands | **IN PROGRESS** 2026-09-15 | Branch `free-playmat/1.6d-free-placement`; `MatPlacement` (nudge, fly-back, FP-87, FP-88), point placement API, Mat Tuner hitbox/overlap/mat size/nudge reach, cascade and push deleted, mini board rebuilt as a mini mat (FP-97) |
| 1.6d-2 The grid is deleted | **NOT STARTED** | `gridShim`, tile API, `adjacency.js`, `OLD_AREA_ORIGIN`, playmat half of `boardGeometry`; guards must find zero tile references |
| 1.6d-3 Mat size live | **NOT STARTED** | `matW()`/`matH()`, FP-98 shrink pulls Tokens in |
| 1.7 Mat UI | **NOT STARTED** | |
| 1.8 Arrivals on the mat | **NOT STARTED** | |
| 1.9 Tray retired, tabs at bottom | **NOT STARTED** | |
| 1.10 Wording | **NOT STARTED** | RenderGolden regenerated |
| 1.11 Tune + tag v0.8.0 | **NOT STARTED** | |
| Stage 2 | **NOT STARTED** | Sliced after v0.8.0 |
| Stage 3 | **NOT STARTED** | Planned after Stage 2 |

**Test baseline on `main`, 2026-09-13:** 11 failing tests in 6 files — ContentRules
(redberry band), EconSimRunner (anchor flag), EconSimTime (config-less rows),
ItemSellValue (1g sells), OneRuleOnePlace ×2 (Map materials), TerrainRegistry ×5.

---

## 8. Open questions

* ~~Q-A. Two edges of FP-49~~ → FP-60, FP-61.
* ~~Q-B. The Vault's tutorial gate~~ → FP-62.
* ~~Packing guard~~ → FP-40. ~~Close/Far in Stage 1~~ → FP-53. ~~Hero tabs stage~~ → FP-54.
* Still open from the concept: the Vault's fate (Stage 3), growth authoring (Stage 3),
  painting tools beyond disallow, loot pickup with walking heroes (Stage 2).
