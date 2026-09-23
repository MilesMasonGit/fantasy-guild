# Enemy Animations — roadmap v1

**Written 2026-09-23. Approved by the owner 2026-09-23.**

Enemy Wandering (EW-A) is reverted — the owner wants to keep manual control
over where enemies sit, and had performance concerns about a mobile enemy.
This replaces that direction: enemies stay exactly where they're placed, and
instead get **sprite-sheet animation** — an idle cycle at rest, an attack
cycle while fighting, and a bit of idle life via occasional turning. The Cow
is the test case; the approach should work for any enemy that gets a sheet
in the same layout.

## 1. Already decided — not re-opened

* Enemy Tokens are placed and moved by the player only (`docs/HANDOFF_...`
  and this reversal both confirm it) — nothing here gives an enemy a
  position of its own again.
* `docs/hero_movement_roadmap_v1.md`'s HM-2 (a hero stands beside a Token on
  the side it approached from) is unchanged and is exactly what an animated
  enemy needs to know to face its attacker.

## 2. Owner decisions, 2026-09-23

| Id | Decision |
| :-- | :-- |
| **EA-1** | **The enemy's sheet layout is confirmed from the actual pixels**: `ani_cow.png` is 256×256, a 4×4 grid of 64px frames. Rows 0–1 (read left to right, then wrapping to row 1) are the **idle** cycle, 8 frames. Rows 2–3 are the **attack** cycle, 8 frames. ⚠️ The CMS's own `AnimationEditor.jsx` has this backwards (assumes rows 0–1 are the attack cycle) — a separate, smaller bug, not fixed here; the owner knows. |
| **EA-2** | **The sheet's native pose faces left** — the opposite of the hero convention (hero art faces right by default). Unflipped = facing left; a CSS `scaleX(-1)` flip faces right. |
| **EA-3** | **An enemy turns to face whichever hero is fighting it**, computed from that hero's own side (HM-2's `side`, already tracked for the working hero — nothing new to compute). |
| **EA-4** | **An idle, unfought enemy occasionally turns** the other way, unprompted — a bit of life. Random pause between turns, **12–24s**, a fixed constant for now, not a Mat Tuner row. |
| **EA-5** | **Animation is board-only.** The Tray, Vault, inspect panel and catalogue keep the plain static sprite, exactly like heroes only animate on the mat. |

## 3. Director's picks (provisional — the owner can overturn any)

* **EAP-1 — No enemy runtime state re-enters `BoardState`.** Facing and
  which cycle is playing are **pure presentation**, unlike a hero's facing
  (which `HeroMotion` computes because it is tied to real movement). They
  live entirely inside the new sprite component's own local timers — no
  engine tick, no new `BoardState` map, nothing that could reintroduce the
  performance and engine-coupling concerns that sank EW-A. This is the
  direct answer to "I have concerns about game performance."
* **EAP-2 — The attack cycle loops for the whole time a fight is active**,
  the same `board:progress` `{ combat: true }` payload `TokenProgressBar`
  already reads for the HP bar (`docs/HANDOFF_token_presentation.md`'s
  finding), and drops back to idle the instant the fight ends. The engine
  has no per-swing event to sync a single attack frame to, so this is the
  only practical trigger without deeper combat-engine changes (out of
  scope here).
* **EAP-3 — Reads that payload the same zero-re-render way
  `TokenProgressBar` does** (`subscribeToken`, a ref, direct style
  mutation) — not a React state update on every tick. A worked Token's
  combat state changing dozens of times a second across many enemies is
  exactly the "annoying" performance shape the owner is wary of; this is
  how the codebase already solved that problem once (CR2-168) and it
  applies unchanged here.
* **EAP-4 — A small explicit registry, not a naming guess.** Mirrors the
  hero convention (`ANIMATION_MAP` in `AssetManager.js`): a new lookup
  keyed by the Token's `sprite` id (`"e_cow"` → the sheet path). Only a
  Token whose sprite id is listed animates; every other enemy keeps its
  static art until it gets a sheet and an entry — the same graceful
  per-creature fallback HMP-5 already established for heroes.
* **EAP-5 — A new `AnimatedEnemySprite` component, not a change to
  `TokenSprite`/`PixelArt`.** `TokenSprite` is the one choke point for
  Token art across 7+ surfaces (D-222); EA-5 already says only the board
  animates, so only `MatToken.jsx` needs to choose between the animated and
  static renderer — exactly how `MatHero.jsx` already chooses between
  `AnimatedHeroSprite` and a plain `PixelArt`.
* **EAP-6 — A fresh enemy (or a page load) starts idle, facing left** (the
  sheet's native pose), with its own turn timer starting fresh — no saved
  facing, nothing to restore on load.

## 4. Slices

| Slice | What | Verified when |
| :-- | :-- | :-- |
| **EA-A — Cow animation on the mat** | `AnimatedEnemySprite.jsx` (4×4 grid, idle/attack row math, frame timer, facing flip). A small enemy animation registry in `AssetManager.js` with one entry (`e_cow`). `MatToken.jsx` renders it instead of `TokenSprite` for a Token whose sprite id is registered, passing `instanceId`, `typeId` and the already-known `heroId`. Facing driven by the working hero's side when fought, or a self-contained 12–24s turn timer when idle. | A placed, unfought Cow idles in place, occasionally turning; a hero engaging it from the left makes it face left, from the right makes it face right, and the attack cycle plays for the whole fight; releasing it returns it to idling (and eventually turning again); every other enemy Token (no registry entry) looks exactly as it does today. |

**Out of scope here**: any enemy besides the Cow (until it gets a sheet and
a registry entry), the CMS `AnimationEditor.jsx` row-order bug, animating
outside the board (EA-5), and anything from the reverted Enemy Wandering
work.

## 5. Implementation status

| Slice | Status | Notes |
| :-- | :-- | :-- |
| EA-A | ✅ **DONE** 2026-09-23, two post-ship fix attempts | New `AnimatedEnemySprite.jsx`, `ENEMY_ANIMATION_MAP`/`resolveEnemyAnimationPath` in `AssetManager.js` (one entry, `e_cow`), `RESTING_SHADOW` exported from `TokenSprite.jsx` so the animated art keeps the same D-215 contact shadow as every other Token. `MatToken.jsx` branches to it only for a Token with a registered sheet, passing the `heroId` it already computes reactively. ⚠️ **Simpler than planned**: EAP-2/EAP-3 called for reading `BOARD_EVENTS.PROGRESS`'s `combat` flag, imperatively, to pick the cycle — building it surfaced that `BoardCombat.endFight` publishes nothing, so that flag would never reliably fall back to idle. `heroId` truthy already means "this fight is live," so the cycle is just `heroId ? 'attack' : 'idle'`, no event subscription needed, even less engine coupling than planned, still fully answering EAP-1. 9 new tests; full suite at the known 11 pre-existing failures plus one unrelated content-data drift from a concurrent CMS sync (confirmed via `git stash`). ⚠️ Found and flagged separately (`task_2e3018be`, out of scope): a pre-existing "duplicate React key" console error at new-game boot.
**Post-ship fix #1, 2026-09-23** (did not resolve it — owner reported "nothing has changed" after testing): the owner reported the sprite vanishing while flipped (drag/drop still worked — visual only, always came back at the native facing). First theory: the facing wrapper was sized with `inset-0` while the outer box carried an explicit, deliberately fractional pixel width (`boardScaleAt`) — two independent roundings of the same number that could disagree under `scaleX(-1)`'s mirror math. Gave both boxes the same explicit `size` directly. Could not reproduce the failure in the browser-pane environment either before or after, and it turned out not to be the cause.
**Post-ship fix #2, 2026-09-23**: replaced the whole approach. The original structure was an absolutely-positioned `<img>`, translated to pick a frame, inside a clipped (`overflow: hidden`) box, inside a flipped (`scaleX(-1)`) box — three nested elements, two of them transformed or clipped independently. Rebuilt as a single element with a CSS `background-image`: `background-size` fixes the sheet's scale, `background-position` picks the frame, and the same element carries the flip — the standard technique for sprite-sheet frames, with no absolutely-positioned child and no `overflow: hidden` to get out of sync with a transform. (A second element still exists, but only to keep `MatToken`'s landing-bounce animation's own `transform` off the same element as the flip — a real, if narrow, conflict the first fix's structure would have hit too.) Again could not reproduce the original failure in this session's browser to confirm directly — needs the owner's confirmation in their own browser. If this **still** doesn't resolve it, the bug is almost certainly not in this component's CSS at all, and the next step is to get a screenshot or screen recording from the owner rather than keep guessing at structure. |
