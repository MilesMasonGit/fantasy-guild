# Hero Speech Bubbles — roadmap v1

**Written 2026-09-23. Owner decisions taken 2026-09-23; slices and director's picks approved 2026-09-23.**

The owner's brief: *"I want to give the heroes 'speech bubbles' to help guide
the player and communicate key information, as well as give character to the
heroes. This will be an adaptation of our current alert badges. Instead of just
an icon that is hovered over, a speech bubble with the key information will
show up above the hero's head."* Examples: *"I need to equip a Pickaxe to work
this Copper Ore Vein Token"*, *"I need Oak Wood to work this Campfire Token."*

## 1. Already decided — not re-opened

Everything in `docs/hero_movement_roadmap_v1.md` and
`docs/token_presentation_roadmap_v1.md`. Nothing here changes where a Token or
hero stands.

## 2. What exists today (verified 2026-09-23)

* `TokenEventAlert.jsx` — `useEventAlert()` state machine + `EventAlertMark`
  icon at a Token's top-left, bubble on hover. Callers: `TokenEventAlert`
  (by instance id) and `MatPointAlerts` (bare mat point).
* The engine already publishes **specific** text for two cases
  (`BoardRunner.js` ~537–569: "Missing token: X", "Out of item: X", names from
  `RecipeResolver.getMissingRequirements`). Skill-too-low, wrong-skill and
  charges only have the generic `ALERT_HINT` sentence.
* Nothing is anchored to a hero yet. Hero position: `HeroMotion`; drawn by
  `MatHero.jsx`. Stacking: `matLayers.js` (`MAT_Z`, idle heroes at 851).

## 3. Owner decisions, 2026-09-23

| Id | Decision |
| :-- | :-- |
| **SB-1** | **Trigger: stuck + key moments.** A bubble shows when a hero is blocked, and also for key moments (arriving at a job, going idle, levelling up). Random flavour chatter is NOT included. |
| **SB-2** | **The bubble replaces the on-Token alert icon for hero-caused alerts.** The Token's red progress-bar badge stays. Point alerts (refused drop, ran-dry spot) keep today's icon — no hero is involved. |
| **SB-3** | **Stack up to 2–3 bubbles above the head.** Several messages can be visible at once per hero. |
| **SB-4** | **Nudge apart, stay on-screen.** Overlapping bubbles from different heroes shift sideways/up; bubbles are clamped to the visible mat. |
| **SB-5** | **Wording is plain, factual and concise** — no character voice. |
| **SB-6** | **A hero stuck for lack of item inputs speaks only after a delay** (avoids flicker on brief waits). Other blocks (tool, Token, skill, charges) speak at once. Delay length is provisional, set in SB-B. |

## 4. Director's picks (provisional — the owner can overturn any)

* **SBP-1 — Stack cap is 3, oldest drops off** when a fourth arrives; each
  bubble also expires on its own timer, so a stack empties itself.
* **SBP-2 — Blocked bubbles persist while the block lasts** (they are a live
  fact, not an event) and clear the moment the problem clears; moment bubbles
  (arrive/idle/level-up) are timed.
* **SBP-3 — Specific wording everywhere.** Blocked messages name the missing
  thing ("I need to equip a Pickaxe…") from `getMissingRequirements`; the
  generic `ALERT_HINT` is only the fallback.
* **SBP-4 — Bubbles are not clickable and never block dragging.** Unlike
  today's icon there is nothing to dismiss; they clear themselves.
* **SBP-5 — Bubble layer sits above idle heroes** (new `MAT_Z.HERO_BUBBLE`
  above 851), non-interactive.

## 5. Open questions (to ask when they matter)

* None open.

## 6. Slices

Each slice: tests, run the game and exercise it, one commit, merge.

| Slice | What | Verified when |
| :-- | :-- | :-- |
| **SB-A — Bubble layer + one hero, one message** | New layer in `MatBoard` above heroes; a bubble follows one hero's position (from `HeroMotion`) and shows a single fixed message. `MAT_Z.HERO_BUBBLE` added. | A hero walking across the mat carries a bubble that stays above their head and doesn't block dragging the hero or their flag. |
| **SB-B — Blocked messages, specific wording** | Engine publishes a hero-anchored "blocked" message with the specific missing thing (tool / item / Token / skill / charges). The on-Token icon stops drawing for hero-caused alerts (SB-2). | A hero at a Copper Ore Vein with no Pickaxe says so by name; it clears when a Pickaxe arrives; point alerts still show their icon. |
| **SB-C — Stack + key moments** | Up to 3 stacked bubbles per hero; arrive / idle / level-up lines; timers. | A hero who levels up while blocked shows both; a fourth message pushes the oldest off. |
| **SB-D — Crowding** | Nudge overlapping bubbles apart and clamp to the mat edge. | Eight heroes crowded on one Token: every bubble legible, none off-screen. |

## 7. Implementation status

| Slice | Status |
| :-- | :-- |
| SB-A | **Done 2026-09-23** — layer at `MAT_Z.HERO_BUBBLE` (860); `HeroBubbleLayer.jsx`; message source is a stub in `heroBubbles.js` for SB-B to replace. Checked in the game: tracks a walking hero's head exactly, pointer passes through. |
| SB-B | Not started |
| SB-C | Not started |
| SB-D | Not started |
