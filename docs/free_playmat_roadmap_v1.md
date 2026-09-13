# The Free Playmat — roadmap v1

*The authoritative plan for dropping the grid. Written 2026-09-13. Vision:
[`concept_free_playmat.md`](concept_free_playmat.md), corrected the same day
against the code. Status table in §7, open questions in §8.*

**Status: DRAFT — awaiting owner approval. No code written.**

**Do not re-litigate §1.** FP-1…FP-39 are the concept's locked decisions; FP-40…FP-55
are the owner's answers of 2026-09-13 to the questions a code audit raised. Where
the two differ, §1 here wins.

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

### 1.3 How this roadmap builds it (director's proposals — approve with the plan)

| # | Decision | Why |
|---|---|---|
| **FP-56** | ⭐ **Convert on the grid first, then remove the grid.** Every "adjacent" reader is rewritten as a distance query while Tokens still sit on tile centres, with Near sized so it reproduces today's 8-tile ring exactly. Flags also land on the grid. Only then does placement go free. | Keeps `main` playable and green after every slice, instead of one enormous branch. The only behaviour change before free placement is FP-41 (large Tokens). |
| **FP-57** | **Stage 1's simple flags pick nearest to the flag's centre.** No walking: the hero appears at the Token they work, and when it stops being workable they appear at the next. Stage 2 switches "nearest" to nearest to the hero and adds the walk. | The concept puts "nearest-first" in Stage 2, but a simple flag still has to choose. This is the least that works and nothing is thrown away (FP-31). |
| **FP-58** | **Hero positions stay out of the save** (A-3, corrected): on reload heroes start at their flag; Token progress is kept; a fight in progress is dropped — all as today. | Matches what the code already does. |
| **FP-59** | **One fresh-save bump, at the free-placement slice.** Slices after it may change the save shape without migration until Stage 1 is tagged. | FP-11; nothing between is released. |

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

* `board.flags` replaces `board.heroTiles`. A flag has a position, one skill, and the
  global radius (FP-23).
* Simple flags (FP-57): nearest to the flag, one hero per Token (FP-25), skip what
  can't run and record why (FP-48), skill-less Tokens not workable (FP-47), Promotion
  Tokens only when the flag is on them (FP-34, FP-49).
* Combat flags fight enemies in range (FP-32). Defeat furls the flag and notifies
  (FP-42). Recall mid-fight works (FP-43). Disallow per Token (FP-35).
* "Who works this Token" becomes the claiming hero (§2) for damage, statuses, roles,
  gear and filters.

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
  (FP-46). "Cannot" is checked on the drop. Dropping on a matching copy restocks (FP-50).
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

* Play a fresh game through; set mat size and Near radius; add a note to the
  simulator dials about walking and idle time (FPR-5).
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
| Roadmap + concept corrections | **IN REVIEW** | Branch `free-playmat-roadmap`; awaiting owner approval |
| S0 Feel trial | **NOT STARTED** | First after approval |
| 1.0 Blank skills visible | **NOT STARTED** | Owner authors 17 skills in the CMS |
| 1.1 Terrain off | **NOT STARTED** | |
| 1.2 `nearby()` + passive readers | **NOT STARTED** | Needs S0's go |
| 1.3 Crafting, charges, Managers, triggers, Cannot | **NOT STARTED** | |
| 1.4 Flags engine | **NOT STARTED** | After Effects Grammar V10 |
| 1.5 Flags UI | **NOT STARTED** | |
| 1.6 Free placement + fresh save | **NOT STARTED** | May split |
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

* **Q-A. Two edges of FP-49 (no unique targeting logic).**
  1. If the flag lands on a Token the hero can't run, FP-48 skips it and the hero
     works something else nearby; the Token under the flag shows its reason on hover
     rather than a red alert. *Recommend: accept — it is what "no unique logic"
     implies.*
  2. Promotion Tokens can't be picked by nearest-first (FP-34), so they need one
     rule: *worked only when the flag is planted on them*. *Recommend: accept this as
     the single exception.*
* **Q-B. The Vault's tutorial gate.** Vault deposits are locked until tutorial step 5
  sees a loot Token dragged onto the board, which FP-16 makes impossible. The
  recommended Q5 answer included "Vault unlocked from the start"; the owner's
  answer quoted only the Hall half. *Recommend: unlock the Vault from the start in
  slice 1.9 until the tutorial pass (FP-39).*
* ~~Packing guard~~ → FP-40. ~~Close/Far in Stage 1~~ → FP-53. ~~Hero tabs stage~~ → FP-54.
* Still open from the concept: the Vault's fate (Stage 3), growth authoring (Stage 3),
  painting tools beyond disallow, loot pickup with walking heroes (Stage 2).
