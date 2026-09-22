# Enemy Wandering & Initiation — roadmap v1

**Written 2026-09-22. Approved by the owner 2026-09-22.**

The next item off the owner's post-playmat list: enemies are static Tokens
today — a hero must walk up and claim one to start a fight, and the enemy
never moves or acts on its own. The ask: enemies **wander within a bounded
travel area** (an "invisible flag" keeping them in a region) and can
**initiate combat** themselves.

## 1. Already decided — not re-opened

* **D-14 is being overturned, deliberately.** The board loop's own comment
  says enemies are "inert until targeted — never initiating, never aggroing."
  That is the rule this whole feature changes. (Only in the initiation slice,
  EW-B — slice EW-A below does not touch it.)
* **D-90** — enemies run on the combat engine, not a work cycle. Unchanged.
* **FPP-4** — moving an enemy mid-fight keeps its HP. Unchanged; still true
  once enemies can also move themselves.
* Hero Movement's HM-2/HM-3/HM-4 (a worker stands beside what it works, no
  pathfinding, "nearest" measured from the mover) are the closest precedent
  and this feature follows the same assumptions where they apply.

## 2. Owner decisions, 2026-09-22

| Id | Decision |
| :-- | :-- |
| **EW-1** | **Two slices, built and verified separately.** EW-A ships enemies visibly wandering, contained to a travel area — combat still only starts the old way (a hero's flag reaches the enemy). EW-B, a later session, adds the enemy actually closing in and starting a fight. |
| **EW-2** | **Initiation (EW-B) is detection + chase.** Each enemy gets a detection radius, smaller than its travel area. Any hero inside it — idle, pottering, walking, even mid-job — gets beelined at and attacked. |
| **EW-3** | **An engaging enemy always forces the fight (EW-B)**, even against a hero already mid-cycle on another Token. No "only threatens free heroes" exception. |
| **EW-4** | **Travel area is one global radius**, tunable in the Mat Tuner, the same pattern as flag radius — not authored per enemy type. |

## 3. Director's picks (provisional — the owner can overturn any)

* **EWP-1 — The travel area is centred on wherever the enemy Token actually
  sits** (`BoardState.tokens()`'s own `x`/`y` — its spawn point, or wherever
  it was last dropped). No separate "anchor" is authored or saved; it's just
  the Token's real placement, same as any other Token.
* **EWP-2 — Wandering mirrors a hero's idle "potter"**: pause a random few
  seconds, walk to a random point within the travel radius, repeat. Same
  rhythm the owner already knows from idle heroes, not a new pattern to
  learn. Its own Mat Tuner **"Enemy wander speed"** slider, independent of
  hero walk speed.
* **EWP-3 — No obstacle avoidance.** An enemy walks a straight line to its
  next wander point and is drawn above the Tokens it crosses while moving —
  mirrors HM-3's "no pathfinding" for heroes. Clamped to the mat edge.
* **EWP-4 — Wandering freezes the instant a hero claims the enemy** (starts
  approaching to fight it, not just once they arrive) and resumes the
  instant the claim is released. A fought — or about to be fought — enemy
  holds still, the same way a worked Token doesn't drift out from under its
  hero.
* **EWP-5 — Dragging an enemy Token** (already possible — Tokens are
  draggable generically) **just relocates it**, exactly like any other
  Token; wandering resumes fresh from the new spot. No special-case code:
  since the travel area is always centred on the Token's real position
  (EWP-1), a drop simply recentres it.
* **EWP-6 — Technical.** The enemy's live wandered position lives in its own
  runtime state (`EnemyMotion`'s body map in `BoardState`, mirroring
  `HeroMotion`'s hero bodies) — **never** written into the Token's own
  `x`/`y`. A wander step publishes a lightweight, no-payload
  `BOARD_EVENTS.ENEMIES_WALKED` (mirroring `HEROES_WALKED`) instead of
  `TILE_CHANGED`, so it never triggers `TileModifiers`' neighbourhood
  rebuild — the same rebuild-storm trap Hero Movement already solved once.
* **EWP-7 — An enemy's front-to-back layering (z-order) is not recomputed
  every wander step**, only on a real board change (spawn, drag-drop,
  despawn) — same as it is today. A wandering enemy could in principle drift
  slightly out of its "nearer draws in front" depth ordering between real
  board changes; acceptable for a first pass, revisit only if it reads
  badly in game.

## 4. Slices

Each slice: tests, run the game and exercise it, one commit, merge.

| Slice | What | Verified when |
| :-- | :-- | :-- |
| **EW-A — Enemies wander** | New `EnemyMotion.js` (mirrors `HeroMotion.js`'s idle-potter shape): per-enemy runtime body, `tick(delta)` called from `BoardRunner` beside `HeroMotion.tick`, travel radius + wander speed as new Mat Tuner rows. Freezes while claimed (EWP-4), snaps to a fresh spot on drag (EWP-5). `MatBoard` overlays the wandered position onto that enemy's rendered `x`/`y`; no change to `MatToken` itself. | An enemy strolls within a visibly bounded area around where it was placed, never leaving it; claiming it to fight (today's mechanism) freezes it in place and combat proceeds exactly as before; dragging it elsewhere re-centres its wander on the new spot. |
| **EW-B — Enemies initiate combat** | Not started. Detection radius (EW-2), chase-and-engage, always interrupts (EW-3). Needs its own design pass on exactly how an enemy "claims" a hero (the reverse of today's hero-claims-Token flow) without fighting `Flags.js`'s hero-specific assumptions. | A wandering enemy notices a hero inside its detection radius, walks to them, and combat starts without the player doing anything — including interrupting a hero already working another Token. |

## 5. Implementation status

| Slice | Status | Notes |
| :-- | :-- | :-- |
| EW-A | ✅ **DONE** 2026-09-22 | New `EnemyMotion.js`, called from `BoardRunner.tick` beside `HeroMotion.tick`; new `BoardState.enemyBodyOf`/`setEnemyBody`/`enemyBodies` (mirrors hero bodies); new `BOARD_EVENTS.ENEMIES_WALKED`; two new Mat Tuner rows. `MatBoard` overlays the wandered position onto each enemy Token's rendered `x`/`y` via a narrowly-subscribed selector, the same shape as `heroesRaw`. ⚠️ Found while writing tests: the first version cleared the stroll target on arrival, which — combined with destination falling back to the bare anchor when untargeted — made every enemy walk straight back to centre after each stroll; fixed by keeping the target as "where it's currently resting," exactly like `HeroMotion`'s `body.potter`. ⚠️ Also found in the first browser pass: `useGameState`'s clone/equality path assumes plain objects and breaks on a `Map` (`Map.prototype.get` "incompatible receiver") — the selector returns a plain array and the `Map` is built afterward with `useMemo`, same as `zById`. 9 new tests (`EnemyMotion.test.js`); full suite back to the known 11 pre-existing failures. In game: an enemy strolled within its travel radius, never snapping back to centre between strolls; froze exactly at its Token's position the instant a claim landed on it and stayed frozen; resumed wandering the moment the claim was released; the two new Mat Tuner sliders are live. |
| EW-B | Not started | |
