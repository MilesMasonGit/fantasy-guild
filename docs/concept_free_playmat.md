# Concept Document: The Free Playmat

**Status:** DRAFT concept, 2026-09-13. No code written. Decisions below were made
by the owner in a design session and are marked **locked** unless flagged
otherwise. This is the vision; a roadmap doc will follow if the owner decides
to go ahead.

---

## 1. The idea in one paragraph

Drop the grid. The playmat becomes one continuous surface where Tokens are
placed anywhere, as round pieces that can slightly overlap. The Token Tray goes
away and its space becomes more playmat. "Adjacent" becomes **"nearby"** — a
circle, in one of three named sizes. Heroes stop being placed on individual
Tokens: each hero **lives on the mat** and is given a **flag** — a banner with a
radius and a skill — and works matching Tokens inside that circle on their own,
walking between them. Over time the mat becomes a living place where things
grow, get harvested and change.

## 2. Why do this

* **The game becomes about setting up an operation, not placing workers.**
  "Put a hero among the trees, set them to Logging, let them clear it" is a
  stronger idle-game fantasy than dragging a hero onto each Token, and it
  continues the direction Managers started ("the board runs as long as you
  left it supplies for").
* **It removes machinery.** The Tray, the Bank→Tray→Board shuffle, the 2×2
  cascade push, and the terrain lattice all go.
* **Per-Token variety without a geometry language.** Three range sizes give
  rules distinct reach while staying learnable.
* **A living mat gives the game its own identity**, which a spreadsheet-like
  grid never could.

---

## 3. Stages

One concept, built in stages. **Each stage is playable, tagged, and a valid
place to stop** if the feel isn't right. (FP-1)

| Stage | What it delivers | Playable result |
|---|---|---|
| **0 — Feel trial** *(recommended, not locked)* | A throwaway sandbox page: round Tokens on a scaling mat, one flag, one hero walking between trees. Touches no real game code. | An afternoon's play to judge whether free placement feels better than the grid, before committing. |
| **1 — Free playmat** | Free placement, scaling, Tray removed, "nearby" ranges replacing adjacency everywhere, bursts landing on the mat, **simple flags** (hero works what's in their flag; no walking yet), disallow marker, fresh save schema. | The whole game runs on the free mat. |
| **2 — Autonomous heroes** | Walking (costs work time), claiming, nearest-first job choice, following a moved Token, idle marker. Painting tools if ready. | Heroes behave like a crew. |
| **3 — Living mat** | Growth, planting, harvesting chains using the existing Spawns / Transforms actions; the Vault decision. | The mat evolves on its own. |
| **After** | Tutorial rewrite (separate pass). Quests-as-a-Token is a **separate concept**, not part of this one. | |

⚠️ **Stage 1 is large** — it is where every adjacency reader converts. See §7.

---

## 4. Locked decisions

### 4.1 The mat

| ID | Decision |
|---|---|
| FP-2 | **No grid.** Tokens are placed freely anywhere on the mat. |
| FP-3 | **The Token Tray is retired.** Its space becomes ordinary, fully live mat — not a holding zone. Anything landing there joins nearby rules immediately. |
| FP-4 | **Fixed shape, scales as a whole.** The mat keeps one aspect ratio and grows/shrinks with the window, with margins on odd screens. Positions are stored in mat units, so resizing never moves or pushes anything and "nearby" means the same on every monitor. |
| FP-5 | **Smooth mat, crisp art.** Positions scale smoothly; Token sprites round to the nearest whole-number art scale so 64px pixel art stays sharp. |
| FP-6 | **Round hitboxes, slight overlap.** A player's drop that is too close **nudges the dropped Token** to the nearest legal spot. Tokens already on the mat never move because of a player's drop. |
| FP-7 | **Large (2×2) Tokens become bigger circles.** The cascade-push logic is retired. |
| FP-8 | **The Guild Hall is movable like any Token.** Its aura moves with it. |
| FP-9 | **Mat size ≈ today's board + Tray** — roughly 60–80 Tokens loosely spaced. Exact size to be tuned. |
| FP-10 | **Terrain is switched off**, code kept dormant for possible revival. |
| FP-11 | **Fresh start required.** Old saves are not converted. |
| FP-12 | **Inspection panels and the hero sheet stay where they are.** Covering part of the mat while open is fine. |

### 4.2 Ranges ("nearby")

| ID | Decision |
|---|---|
| FP-13 | **"Adjacent" becomes "Nearby"**, a circular range. |
| FP-14 | **Three named sizes: Close / Near / Far.** Every existing "adjacent" rule becomes **Near**, tuned to roughly match today's 8-tile ring. "This Token only" and "Every Token on the board" reach are unchanged. |
| FP-15 ⚠️ *proposed* | **Packing guard.** The Near radius and the overlap limit are tuned **together** so the tightest possible packing fits about 8 Tokens in Near. See risk R-1. *Recommended; owner to confirm.* |

### 4.3 Bursts, spawns and pushing

| ID | Decision |
|---|---|
| FP-16 | **Tokens from Map bursts, crafting and spawns land directly on the mat.** The floating loot layer carries **items only**. |
| FP-17 | **Only bursts and spawns push.** They may shove nearby Tokens aside. Pushed Tokens **stay on the mat** and are **never pushed into a spot that breaks a "Cannot" rule**; if there's no legal spot nearby, the new Token lands in the nearest free space instead. |
| FP-18 | **Bought Maps land on the mat beside the Guild Hall** as a piece you click to burst. The 50-Map cap stays. |
| FP-19 | **Managers restock in the exact spot** of the spent Token, so a hero working it carries on. Manager reach becomes a range. |

### 4.4 Heroes and flags

| ID | Decision |
|---|---|
| FP-20 | **Heroes live on the mat.** Each hero has **one flag**: a visible banner with a radius. One hero per flag. |
| FP-21 | **Placing a hero:** drag them from the dock onto the mat — that plants their flag. The skill is chosen **on the flag**. Drag the flag to relocate the crew; drag the hero back to the dock to recall them. |
| FP-22 | **A flag has one skill.** The hero works non-disallowed Tokens in the radius that use that skill. |
| FP-23 | **Every flag has the same radius**, widened by a new Guild Hall upgrade track. |
| FP-24 | **Nearest first** when several Tokens qualify. |
| FP-25 | **Overlapping flags: first to claim.** One hero per Token; the other hero takes their next-nearest. |
| FP-26 | **Walking costs work time**, but marginally — seconds of walking against jobs lasting up to an hour. |
| FP-27 | **Dropping a flag on a Token targets it.** The hero works that Token and the flag's skill switches to what it needs. This is the player's "do this one" order; no separate direct-order system. |
| FP-28 | **Targeting something the hero can't do:** the flag still plants and the skill switches; the existing red skill-too-low alert explains it. Dropping on a disallowed Token does **not** override disallow. |
| FP-29 | **Idle heroes** walk back and wait at their flag, which shows a quiet "nothing to do" marker — not the red alert, which stays for real problems (D-149). |
| FP-30 | **Moving a Token mid-job keeps its progress.** If it's still inside the hero's flag they follow it; if not, they move on and the progress waits on the Token. |
| FP-31 | **Stage 1 ships simple flags** (no walking; the hero appears at the Token they're working). Stage 2 adds walking and job choice on top — nothing is built to be thrown away. |

### 4.5 Combat and promotion

| ID | Decision |
|---|---|
| FP-32 | **Combat flags fight on their own.** Heroes have one combat skill, so a combat flag just says "fight" — every non-disallowed enemy in the radius. |
| FP-33 | **No auto-retreat.** Heroes fight to the end, as today; **disallow is the player's tool** for enemies a crew can't beat. Death still costs equipment (D-74). |
| FP-34 | **Promotion is always a deliberate order.** Heroes never pick a Promotion Token on their own; the player targets it by dropping the hero's flag on it (FP-27), and the train-then-ask ceremony plays as today. |

### 4.6 Player controls

| ID | Decision |
|---|---|
| FP-35 | **Any Token can be marked "disallowed."** It stops **hero work only** — its rules, buffs, triggers and Manager service keep running. |
| FP-36 | **Group editing comes later, as painting tools**: a panel where the player picks e.g. "paint disallow" and clicks Tokens. Stage 1 only needs a per-Token toggle. |
| FP-37 | **The Vault is unchanged through stages 1–2**; whether it stays, shrinks or goes is decided at stage 3. |
| FP-38 | **The hero tabs move to the bottom of the screen** (owner intent; details open). |
| FP-39 | **The tutorial is rewritten in a separate pass after all stages.** It is knowingly broken in between. |

---

## 5. Working assumptions

Not discussed in depth; written in as sensible defaults. Overrule freely.

* **A-1** Heroes walk in straight lines and pass over Tokens. **No pathfinding**
  around obstacles — that would be a large hidden cost.
* **A-2** Enemies are Tokens and do not move.
* **A-3** Walking state is not saved. On reload heroes start at their flag, the
  same as job timers resetting on reload today (D-54).
* **A-4** Range rings show while dragging or inspecting, not permanently.
* **A-5** Distance is measured **centre to centre**. A large Token naturally
  reaches a little further past its own edge.
* **A-6** Walking counts as working: no HP/energy regeneration while walking.
* **A-7** Item loot flies a set distance in mat units, so it looks the same at
  every window size.
* **A-8** The flag's skill picker offers the hero's own skills.
* **A-9** A moved Guild Hall carries its aura, and new Maps appear beside it
  wherever it is.

---

## 6. Earlier decisions this reverses

The owner may overturn their own decisions; these are listed so each reversal is
deliberate, and so old comments in the code aren't mistaken for current rules.

| Earlier decision | What it said | Now |
|---|---|---|
| D-1 | The board is a fixed size forever | Fixed *shape*, scaling size (FP-4) |
| D-81 | One neighbourhood everywhere — no ranges, no radii | Three range sizes (FP-14) |
| D-61 | Corners have 3 neighbours, edges 5, centre 8 | No tiles; ranges are circles |
| ER-2 | Reach has "no shapes, no radius, no direction" | Radius added; still no shapes or direction |
| CR2-050 | `BOARD_PX` is a compile-time constant; do not make it dynamic | Positions move to mat units (FP-4) |
| D-107, D-223, D-228, D-168 | The Tray is the staging area, a free surface with count capacity, sized by upgrade | Tray retired (FP-3) |
| D-134 | Displaced Tokens go to the Tray | No displacement by the player (FP-6) |
| D-156 | Bought Maps live only in the Tray | Beside the Guild Hall (FP-18) |
| D-40, D-142, D-148 | Bursts and crafted Tokens arrive as floating sprites | Tokens land on the mat; sprites are items only (FP-16) |
| G-3 | Retreat is unassigning the hero | Disallow or move the flag (FP-33) |
| PR-7 | A hero who declines promotion stays on the tile | Stays at the Token under their flag |
| D-240 | Inspection renders over the Tray | Same place, now over mat space (FP-12) |

**Kept in spirit:** D-138 (nothing is ever lost to a full Vault — overflow now
sits on the mat), D-151 (restock under a working hero, FP-19), D-113/D-157 (one
tool serves every nearby station and wears faster for it), D-149 (idle is not
an alert, FP-29), D-130 (combat is dangerous).

---

## 7. What gets touched

Counts are from a read-only survey of the code on 2026-09-13.

### 7.1 Rebuilt at the core (stage 1)

| Component | Today | After |
|---|---|---|
| Board storage — `BoardState`, `boardGeometry` | 36 numbered slots; `heroTiles` maps hero → tile | Positions in mat units; heroes and flags |
| Placement — `Placement`, `placeTokenFromDrag`, dnd | Snap to tile, 2×2 cascade push | Drop anywhere, nudge; cascade deleted |
| Adjacency & reach — `adjacency`, `reachRegistry`, `TileModifiers` | Precomputed 8-neighbour lists | Distance queries against Close/Near/Far |
| Hero work — `BoardRunner` ("has a hero") | Hero standing on the tile | Hero assigned via flag |
| Board UI — `Board`, `BoardTile`, `Tray`, `TrayMiniBoard`, `ConnectionLines`, `TileProgressBar`, `TileEventAlert`, `useBoardScale` | Tiles, Tray, neighbour lines | One scaling mat, range rings, flags |
| Layout — `RightmostHeroDock` | Sized to the board, beside the Tray | Hero tabs at the bottom (FP-38) |

### 7.2 Same idea, new geometry (stage 1)

* **Crafting stations** — `RecipeResolver`, `StationRecipe`: "tool beside the
  Forge" becomes "tool near the Forge".
* **Charges** — context Tokens wear per nearby station served.
* **Managers** — range reach; restock in place.
* **"Cannot" rules** — `Restrictions`: only one kind exists
  (`adjacency_limit`), used by one library effect. Becomes a nearby count, and
  must also be checked on pushes (FP-17).
* **Triggers** — `TriggerSystem`: "when a neighbour finishes a cycle".
* **Combat** — `BoardCombat`: fights keyed per tile; autonomous engagement.
* **Promotion** — `BoardPromotion`: ceremony keyed to a tile.
* **Spawns / Transforms** — `EffectActions`: free-tile search by Chebyshev tile
  distance becomes a free-spot search with pushing.
* **Statuses, damage, roles, filters, magnitudes** — "per adjacent Coast" counts.
* **Guild Hall aura** — must follow a movable Hall.
* **Map bursts & overflow** — `Cartographer`, `SpriteLayer`: Tokens to the mat.
* **Vault transfers** — `VaultTransfer`: every Tray route removed.

### 7.3 Wording and authoring

* Rules text "adjacent" → "nearby" across 27 Token mentions and 2 library
  entries. ⚠️ The RenderGolden test pins every description; it must be
  regenerated and its diff read.
* CMS reach picker gains Close/Near/Far; description dictionary, content audit
  and connectivity auditor updated.

### 7.4 Around the edges

* **Tutorial** — 6 of 16 steps reference the Tray, tiles, or hero-on-Token (FP-39).
* **Quests** counting placement events.
* **Guild upgrades** — new flag-radius track. The Guild Hall upgrade board itself
  is a separate 7×7 and is unaffected.
* **Terrain** — 7 files switched off.
* **Save schema** — bumped, fresh start (FP-11).
* **Tests** — about 90 test files reference tiles; roughly 15 are rewritten
  outright (placement, cascade, Tray positions, adjacency, managers, hero
  displacement, charges).

### 7.5 Checked and unaffected

Economic simulator (does not model adjacency), combat maths, items and the item
Bank, hero skills and levels, the Guild Hall upgrade board, CMS sync mechanics.

---

## 8. Risks

* **R-1 Buff stacking.** Duplicate buffs stack uncapped (D-23), accepted because
  a Token could never have more than 8 neighbours. With free placement and
  overlap, a player could pack 12+ Tokens into Near and multiply every buff.
  FP-15 is the guard; it must be locked before stage 1 is tuned.
* **R-2 Unattended deaths.** No retreat (FP-33) plus autonomous combat (FP-32)
  plus Managers restocking enemies in place (FP-19) means a crew left alone
  near a Goblin Camp fights forever until someone dies. Disallow is the answer
  by design, but the player must understand that before it costs them gear.
* **R-3 Scope.** The largest rework of the board engine so far. Stage 1 alone
  converts every adjacency reader and replaces the placement model.
* **R-4 Unproven feel.** Nothing yet shows that free placement plays better than
  the grid. Stage 0 exists to answer that cheaply.
* **R-5 Simulator drift.** The simulator's code is unaffected, but its
  assumption that a hero's time is all spent working drifts slightly (walking,
  idling at a cleared flag). Marginal per FP-26; worth a note in its dials.
* **R-6 Crisp-art overlap.** With FP-5, sprite sizes step while spacing scales
  smoothly, so the same overlap can look slightly different at different
  window sizes.
* **R-7 Broken tutorial for three stages** (FP-39) while fresh saves are
  required (FP-11) — testing a new game means playing without guidance.

---

## 9. Still open

* The Vault: keep, shrink or remove (stage 3, FP-37).
* How growth, planting and harvesting chains are authored (stage 3). The
  Spawns and Transforms actions already exist.
* Painting tools: which paints exist beyond "disallow", and when (FP-36).
* Exact mat size and the Close/Near/Far radii — best settled with the stage 0
  trial.
* Hero tabs at the bottom: layout details, and which stage (FP-38).
* Whether FP-15's packing guard is locked as written.
* Loot pickup with walking heroes; flag skill-picker UI; what happens to a
  flag's target if the Guild Hall is moved mid-burst.

## 10. Related future work (not this concept)

* **Quests as a special Token** instead of a side panel — its own concept.
* **Terrain revival** in a form that suits a free mat.
