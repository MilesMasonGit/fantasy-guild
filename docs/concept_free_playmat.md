# Concept Document: The Free Playmat

**Status:** DRAFT concept, 2026-09-13. No code written. Decisions below were made
by the owner in a design session and are marked **locked** unless flagged
otherwise. This is the vision; a roadmap doc will follow if the owner decides
to go ahead.

**Corrected 2026-09-13:** checked against the code the same day and corrected
(wrong citations, a wrong premise in A-3, missing touch points). The owner's
follow-up answers are recorded as FP-40…FP-55 in §1 of
[`docs/free_playmat_roadmap_v1.md`](free_playmat_roadmap_v1.md), which is
**authoritative wherever it differs from this document**.

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

> **Where the IDs come from.** This document's own decisions are `FP-`, its
> working assumptions `A-`, its risks `FPR-`. Other IDs refer to:
>
> * `D-` — [`playmat_decisions.md`](../playmat_decisions.md) at the repo root.
>   **Not** `docs/archive/area_deck_rework_concept_v3.md`, which reuses
>   D-1/D-23/D-40/D-54/D-61 for different things. (The terrain `D-T` IDs are
>   in `docs/dynamic_terrain_roadmap_v1.md`.)
> * `G-` — [`playmat_roadmap_v1.md`](../playmat_roadmap_v1.md), **not** the
>   Effects Grammar v2 G- IDs (those are always written "Effects Grammar G-").
> * `ER-` — the Effects Robustness roadmap.
> * `PR-` — [`docs/promotes_rule_roadmap.md`](promotes_rule_roadmap.md).

### 4.1 The mat

| ID | Decision |
|---|---|
| FP-2 | **No grid.** Tokens are placed freely anywhere on the mat. |
| FP-3 | **The Token Tray is retired.** Its space becomes ordinary, fully live mat — not a holding zone. Anything landing there joins nearby rules immediately. |
| FP-4 | **Fixed shape, scales as a whole.** The mat keeps one aspect ratio and grows/shrinks with the window, with margins on odd screens. Positions are stored in mat units, so resizing never moves or pushes anything and "nearby" means the same on every monitor. |
| FP-5 | **Smooth mat, crisp art.** Positions scale smoothly; Token sprites round to the nearest whole-number art scale so 64px pixel art stays sharp. |
| FP-6 | **Round hitboxes, slight overlap.** A player's drop that is too close **nudges the dropped Token** to the nearest legal spot. Tokens already on the mat never move because of a player's drop. |
| FP-7 | **Large (2×2) Tokens become bigger circles.** The cascade-push logic is retired. |
| FP-8 | **The Guild Hall is movable like any Token.** *(Corrected: the Hall has no positional aura in code today — see §7.2 — so there is nothing to move with it; new Maps appear beside it, FP-18.)* |
| FP-9 | **Mat size ≈ today's board + Tray** — roughly 60–80 Tokens loosely spaced. Exact size to be tuned. |
| FP-10 | **Terrain is switched off**, code kept dormant for possible revival. |
| FP-11 | **Fresh start required.** Old saves are not converted. |
| FP-12 | **Inspection panels and the hero sheet stay where they are.** Covering part of the mat while open is fine. |

### 4.2 Ranges ("nearby")

| ID | Decision |
|---|---|
| FP-13 | **"Adjacent" becomes "Nearby"**, a circular range. |
| FP-14 | **Three named sizes: Close / Near / Far.** Every existing "adjacent" rule becomes **Near**, tuned to roughly match today's 8-tile ring. "This Token only" and "Every Token on the board" reach are unchanged. |
| ~~FP-15~~ ❌ **Rejected by the owner 2026-09-13 — no packing guard (FP-40)** | ~~**Packing guard.** The Near radius and the overlap limit are tuned together so the tightest possible packing fits about 8 Tokens in Near.~~ *Why rejected:* if Near matches today's 8-tile ring, tight packing fits about 12 Tokens (≈18 with slight overlap). Capping the geometry at 8 would force Near so small that normally spaced Tokens see only 4–6 neighbours. See risk FPR-1. |

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
| FP-28 | **Targeting something the hero can't do:** the flag still plants and the skill switches; the existing red skill-too-low alert explains it. Dropping on a disallowed Token does **not** override disallow. *(Amended: targeting has no logic of its own (FP-49), so an unrunnable Token under the flag is skipped and shows its reason on hover, with no red alert — roadmap FP-60.)* |
| FP-29 | **Idle heroes** walk back and wait at their flag, which shows a quiet "nothing to do" marker — not the red alert, which stays for real problems. *(Corrected citation: this **reverses** D-172, the bright yellow idle mark on the hero, and changes D-266/D-267, which pair the hero sprite with its Token. D-149 is a different rule — "staffed but stuck" — and still holds.)* |
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
* **A-3** *(Corrected — the earlier premise that job timers reset on reload was
  wrong.)* Walking state is not saved: on reload heroes start at their flag.
  Job progress on Tokens is kept, as today (`cycleElapsedMs` is saved). An
  in-progress fight is dropped, as today (fights are runtime-only).
* **A-4** Range rings show while dragging or inspecting, not permanently.
* **A-5** Distance is measured **centre to centre**. With one shared radius, a
  large Token's own body uses up most of that radius, so it reaches *less* past
  its edge than a small one. **The owner accepts this (FP-41)**; a large Token
  that needs more reach is authored with a larger reach.
* ~~**A-6** Walking counts as working: no HP/energy regeneration while walking.~~
  ❌ **Overturned by the owner (FP-51):** walking regenerates HP/energy like
  working and fighting already do (regeneration runs while idle, working and
  in combat today).
* **A-7** Item loot flies a set distance in mat units, so it looks the same at
  every window size.
* **A-8** The flag's skill picker offers the hero's own skills.
* **A-9** New Maps appear beside the Guild Hall wherever it is. *(Corrected:
  the Hall has no positional aura today, so a moved Hall has nothing to carry.)*

---

## 6. Earlier decisions this reverses

The owner may overturn their own decisions; these are listed so each reversal is
deliberate, and so old comments in the code aren't mistaken for current rules.

*(Rows corrected against the actual decision text on 2026-09-13.)*

**The board, tiles and ranges**

| Earlier decision | What it said | Now |
|---|---|---|
| D-1 | The board is a fixed size forever | Fixed *shape*, scaling size (FP-4) |
| D-2 | One Token per tile | Slight overlap allowed (FP-6) |
| D-81 | "One rule everywhere: the 8 surrounding tiles" (the "no radii" wording is D-140's) | Three range sizes (FP-14) |
| D-61 | Corners have 3 neighbours, edges 5, centre 8 | No tiles; ranges are circles |
| ER-2 | "No radius, no rows, no columns, no direction" — because "a 6×6 board does not need distance falloff" | Radius added; still no rows, columns or direction |
| D-140 | Managers cover the 8 surrounding tiles "rather than inventing a new radius" | Manager reach becomes a range (FP-19) |
| D-121 | An aura reaches the 8 neighbours | Reaches Near |
| D-126 | Tool wear counts each adjacent Token served | Counts each Token served within Near |
| D-106 | A permanent Guild Hall on the centre tile (now tile 21) | The Hall is movable (FP-8) |
| D-T1–D-T14 (`docs/dynamic_terrain_roadmap_v1.md`) | Terrain drawn on a subtile lattice under the grid | Terrain dormant (FP-10) |
| CR2-050 | Ticket: loot sprites save absolute pixel positions. ("`BOARD_PX` is compile-time" was only the argument used to refute it; there is no "don't make it dynamic" rule, and CR2-179 already made the board scale via `useBoardScale`.) | FP-4's mat units resolve the ticket's concern |

**Placement and displacement**

| Earlier decision | What it said | Now |
|---|---|---|
| D-134 | "Dropping a Token on an occupied tile swaps them; heroes move tile-to-tile directly" | Reversed: no displacement by player drops (FP-6) |
| D-143, D-147 | Placement shoves neighbours; a displaced hero is knocked back to the Dock | No displacement by the player (FP-6) |
| D-54 | "Repositioning is free but forfeits the current cycle" | Reversed: moving a Token keeps its progress (FP-30) |
| Effects Grammar G-15 (`docs/effects_grammar_v2_roadmap.md`) | Spawns land on the bearer's tile, the nearest free tile, or a random free tile | Free-spot search with pushing (FP-17) |
| Effects Grammar G-11 | Displacement rejected because "what if it's occupied" had no answer | FP-17 supplies that answer |

**The Tray, Maps and bursts**

| Earlier decision | What it said | Now |
|---|---|---|
| D-107, D-223, D-228, D-168 | The Tray is the staging area, a free surface with count capacity, sized by upgrade. *(In code the Tray is **not** upgradable: `TRAY_CAPACITY` is a constant 48 in `BoardState.js`; D-168's "~15–20" is stale.)* | Tray retired (FP-3) |
| D-224–D-227, D-229 (`tray_loose_objects_intent.md`) | Loose objects in the Tray | Tray retired (FP-3, FP-45) |
| D-237, D-238 | Four-column layout includes the Tray; the Bank drawer stops before the Tray | Tray retired (FP-3, FP-45) |
| D-244–D-247 | Dragging to the Tray withdraws from the Vault / buys | Tray retired (FP-3, FP-45) |
| D-155, D-160 | Maps open from the Tray; a full Tray refuses a purchase | Tray retired (FP-3, FP-45) |
| D-156 | Bought Maps live only in the Tray. *(Maps can already sit loose on the playmat — `board.maps`, pixel x/y; only buying is Tray-only.)* | Beside the Guild Hall (FP-18) |
| D-158, D-232, D-234, D-142, D-148 | Bursts and crafted Tokens arrive as floating Token sprites, collected by hover into Vault → Tray | Tokens land on the mat (FP-16). *D-40 — the items-only loot piñata — is **kept**.* |
| D-240 | Inspection renders over the Tray | Same place, now over mat space (FP-12) |

**Heroes, combat and promotion**

| Earlier decision | What it said | Now |
|---|---|---|
| D-57 | "A hero works exactly one Token and stands on top of it" | Heroes hold flags (FP-20, FP-21) |
| D-59 | "Heroes never move themselves" | Heroes walk and choose jobs (FP-24, FP-26 — stage 2) |
| D-131 | "Moving a hero off a Token mid-cycle forfeits the cycle" | Progress waits on the Token (FP-30) |
| D-172 | The idle mark is bright yellow, on the hero, meant to stand out | Quiet marker at the flag (FP-29) |
| D-266, D-267 | Hero sprite paired with its Token | Hero stands at the Token under their flag |
| D-74 | Its stated reason: "all combat is opt-in" | Combat flags start fights on their own (FP-32), so that reason no longer holds. The penalty (defeat costs equipment) stays. |
| D-130 | "Risk is managed by attention, not information", including "Retreat is always available" | Manual recall mid-fight stays available (owner, FP-43). What changes is that combat flags **start** fights on their own (FP-32). |
| D-136 | "Retreating a wounded hero is the healing mechanic" | Still true for manual recall (FP-43); defeat furls the flag and sends the hero home (FP-42) |
| G-3 | Retreat is unassigning the hero | Disallow, move the flag, or recall (FP-33, FP-43) |
| G-4 | An enemy resets to full HP when its hero leaves | **Kept** — recalling mid-fight resets the enemy as today (owner, FP-43) |
| D-206 | Minions stand on Tokens in the hero layer | **Unresolved** — there is no flag model for Minions yet (design only, no code) |
| PR-3 | "Training is a hero standing on a tile for a cycle" | Training is the hero working the Token their flag targets (FP-34) |
| PR-7 | A hero who declines promotion stays on the tile; the re-ask comes from being "picked up and put back" | Stays at the Token under their flag; re-asking is flag-based (FP-34) |

**Kept in spirit:** D-138 (nothing is ever lost — a full mat refuses the burst
or craft rather than destroying anything, FP-46), D-151 (restock under a working hero, FP-19), D-113/D-157 (one
tool serves every nearby station and wears faster for it), D-149 (an alert
means "staffed but stuck"; an unstaffed Token is not an error), D-40 (item loot
piñata).

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
| Scaling — `useBoardScale`, `Board.jsx` | `useBoardScale` only ever **shrinks** (`Math.min(1, …)`); `Board.jsx` scales everything with one CSS transform | Growing the mat is new work, and crisp art (FP-5) needs a different scaling approach than one transform |
| Layout — `RightmostHeroDock`, `ReactRoot` | Sized to the board, beside the Tray; `ReactRoot` sizes the layout from `BOARD_PX` | Hero tabs at the bottom (FP-38) |
| Loose pieces — `SpriteLayer`, `board.maps`, `board.sprites` | Pixel positions, stored in the save | Mat units; part of the new save schema (FP-11) |
| Guild Hall placement — `GUILD_HALL_TILE`, placement exclusions, Hall drop guards in `DragGhost`, `BubbleMenu`, `TokenVaultTab` | The Hall assumes a fixed tile | A movable Hall (FP-8) |
| New game — `EngineBootstrap` `OPENING_TRAY` | A new game starts with the Hall in the Tray | Needs a new opening placement |

### 7.2 Same idea, new geometry (stage 1)

* **Crafting stations** — `RecipeResolver`, `StationRecipe`: "tool beside the
  Forge" becomes "tool near the Forge".
* **Charges** — context Tokens wear per nearby station served.
* **Managers** — range reach; restock in place.
* **"Cannot" rules** — `Restrictions`: only one kind exists
  (`adjacency_limit`), used by one library effect. Becomes a nearby count, and
  must also be checked on pushes (FP-17).
* **Reach kinds** — there are **4** today (`adjacent`, `self`,
  `self_and_adjacent`, `board`), plus a separate trigger *listen-scope* axis
  and a spawn *placement* axis. "Acts as", "Restocks" and recipe
  context/tool requirements have adjacency hard-wired with **no reach field**,
  so they need one added.
* **Triggers** — `TriggerSystem`: "when a neighbour finishes a cycle".
* **Combat** — `BoardCombat`, `CombatResolutionProcessor`: fights keyed per
  tile; autonomous engagement.
* **Promotion** — `BoardPromotion`, `useUIModals` (promotion offers keyed by
  tile): ceremony keyed to a tile.
* **Spawns / Transforms** — `EffectActions`: free-tile search by Chebyshev tile
  distance becomes a free-spot search with pushing. ⚠️ Spawns, transforms and
  Manager restocks do **not** check "Cannot" rules today; that check is new.
* **Statuses, damage, roles, filters, magnitudes** — "per adjacent Coast" counts.
* **Guild Hall** — *(corrected)* there is **no positional Guild Hall aura** in
  code: the Hall has no rules, `GuildModifiers` is guild-wide, and
  `GuildUpgradeManager` wipes the Hall's statements on every recompute. What
  actually assumes a fixed spot is `GUILD_HALL_TILE` and the placement
  exclusions (§7.1).
* **Map bursts & overflow** — `Cartographer`, `SpriteLayer`: Tokens to the mat.
* **Vault transfers** — `VaultTransfer`: every Tray route removed. Also the
  "Add to Tray" button in `TokenInspection`.
* **Hero UI and alerts** — `HeroDockTab` (reads `heroTiles`),
  `NotificationSubscriptions`.

### 7.3 Wording and authoring

* Rules text "adjacent" → "nearby". *(Corrected: the "27 Token mentions and 2
  library entries" are CMS-generated descriptions — the wording itself lives
  in code: `reachRegistry`, `restrictionPalette`, `triggerRegistry`'s 6
  neighbour triggers, `statements.js`, `filterRegistry`,
  `descriptionDictionary`, `ContentAudit`, and `statementSlots`, whose default
  scope is `'adjacent'`.)* ⚠️ The RenderGolden test pins every description —
  `renderGolden.json` contains "adjacent" about 729 times; it must be
  regenerated and its diff read.
* CMS reach picker gains Close/Near/Far; description dictionary, content audit
  and connectivity auditor updated.

### 7.4 Around the edges

* **Tutorial** — 6 of 16 steps reference the Tray, tiles, or hero-on-Token (FP-39).
* **Quests** — `QuestManager` counts placement events: `context_token_placed`,
  `return_to_tray` / quick recall, `hero_deployed`. ⚠️ Vault deposits are
  refused until tutorial_5 is complete, and tutorial_5 only counts
  `loot_token_placed` — a floating loot Token dragged onto the board. Once
  FP-16 removes Token sprites that event can never fire, so on a fresh save the
  Vault would stay locked (see the roadmap's open question Q-B).
* **Guild upgrades** — new flag-radius track. The Guild Hall upgrade board
  itself is a separate 7×7 and is only **partly** unaffected: its constants
  live in `boardGeometry.js` and it uses `useBoardScale`, and both are rebuilt.
* **Terrain** — *(corrected)* 11 runtime files switched off, wired into
  `BoardState.setToken`, the Cartographer's map stamp, the Vault copy,
  `StateSchema` and `Board.jsx`; plus 9 terrain test files.
* **Save schema** — bumped, fresh start (FP-11).
* **Dev tools** — `TestDashboard` hardcodes 49 tiles.
* **Tests** — *(corrected)* 158 test files in all; about 98 reference
  tile / adjacent / neighbour / tray. Expect **well over 15** rewritten outright
  (placement, cascade, Tray positions, adjacency, managers, hero displacement,
  charges, terrain, rules wording).

### 7.5 Checked and unaffected

Economic simulator code (it does not model adjacency — but note that it
therefore can't see tool wear or buff stacking under a wider Near either),
combat maths, items and the item Bank, hero skills and levels, CMS sync
mechanics. *(The Guild Hall upgrade board was listed here; it is only partly
unaffected — see §7.4.)*

---

## 8. Risks

* **FPR-1 Buff stacking — accepted.** Duplicate buffs stack uncapped
  (D-23/D-82). With free placement and overlap, a player could pack 12+ Tokens
  into Near (≈18 with overlap) and multiply every buff. **The owner accepts
  stacking** (FP-40; FP-15 rejected). *(Corrected reason: uncapped stacking
  was really accepted because of D-119 — "effects are small" — not because "a
  Token could never have more than 8 neighbours"; that was D-82's
  tiles-are-the-limit reason, which no longer holds.)*
* **FPR-2 Unattended deaths.** No retreat (FP-33) plus autonomous combat (FP-32)
  plus Managers restocking enemies in place (FP-19) means a crew left alone
  near a Goblin Camp fights forever until someone dies. For scale: an
  equal-level hero with no gear or food dies in about **22 seconds** in the
  first fight. Disallow is the answer by design, but the player must understand
  that before it costs them gear. *Mitigated by FP-42:* defeat furls the flag
  and sends the hero home, with a death notification.
* **FPR-3 Scope.** The largest rework of the board engine so far. Stage 1 alone
  converts every adjacency reader and replaces the placement model.
* **FPR-4 Unproven feel.** Nothing yet shows that free placement plays better than
  the grid. Stage 0 exists to answer that cheaply.
* **FPR-5 Simulator drift.** The simulator's code is unaffected, but its
  assumption that a hero's time is all spent working drifts slightly (walking,
  idling at a cleared flag). Marginal per FP-26; worth a note in its dials.
* **FPR-6 Crisp-art overlap.** With FP-5, sprite sizes step while spacing scales
  smoothly, so the same overlap can look slightly different at different
  window sizes.
* **FPR-7 Broken tutorial for three stages** (FP-39) while fresh saves are
  required (FP-11) — testing a new game means playing without guidance.
* **FPR-8 Unattended damage outside combat.** Harm doesn't only come from
  fights. Thorns (Redberry Bush) deals 1 damage per cycle to its worker;
  statuses and damage-over-time tick wherever the hero is. Each defeat takes
  25% of the Bank's stack of the hero's equipped food/drink and has a 10% break
  chance per gear piece. A crew left alone can bleed supplies this way. *(Time
  Bank is out of scope here — the owner is considering removing it.)*

---

## 9. Still open

* The Vault: keep, shrink or remove (stage 3, FP-37).
* How growth, planting and harvesting chains are authored (stage 3). The
  Spawns and Transforms actions already exist.
* Painting tools: which paints exist beyond "disallow", and when (FP-36).
* ~~Exact mat size and the Close/Near/Far radii~~ — *partly closed:* Stage 0
  tunes Near and the mat size; Close and Far are deferred (FP-53).
* ~~Hero tabs at the bottom: which stage~~ — *closed:* Stage 1 (FP-54). Layout
  details still open (FP-38).
* ~~Whether FP-15's packing guard is locked as written~~ — *closed:* rejected,
  no packing guard (FP-40).
* ~~What happens to a flag's target if the Guild Hall is moved mid-burst~~ —
  *closed:* no unique target logic (FP-49).
* Loot pickup with walking heroes; flag skill-picker UI.

## 10. Related future work (not this concept)

* **Quests as a special Token** instead of a side panel — its own concept.
* **Terrain revival** in a form that suits a free mat.
