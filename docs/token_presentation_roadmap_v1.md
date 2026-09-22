# Token Work Presentation — roadmap v1

**Written 2026-09-22. Approved by the owner 2026-09-22.**

The last item of the owner's original Token-UI feedback: *"A worked token's UI
is still the same from when we had the grid system... we have more space to
show what's happening, so some badges and the progress bar could be moved."*
The other two items (the Token no longer shifts, heroes work from either side)
shipped with Hero Movement (`docs/hero_movement_roadmap_v1.md`, merged
2026-09-22).

Since HM-2, a hero stands 16 mat units clear of the Token's own circle,
left or right, instead of stacked on top of it. The badges and progress bar
are still laid out to fit inside that circle — the small square a grid tile
used to be — even though the space around the Token is now empty. This is
what "still looks like the grid" means.

---

## 1. Already decided — not re-opened

Everything in `docs/hero_movement_roadmap_v1.md` §1 and §2, especially HM-2
(Token stays put, hero stands beside it on the side it arrived from) and D-266
(the pairing shift this replaced). Nothing here changes where a Token or a
hero stands — only what is drawn around them.

## 2. Owner decisions, 2026-09-22

| Id | Decision |
| :-- | :-- |
| **TP-1** | **Full redesign.** The Token and its badges are one presentation unit that can extend past the Token's own circle — not everything has to fit inside the Token's own diameter the way it did on the grid. |
| **TP-2** | **The progress bar drops into the gap below the Token.** Wider than today, and **always visible whenever a hero is working it** — not hover-gated. It stays tied to the Token (not the hero), since a Token keeps its cycle progress if its hero leaves mid-cycle (FP-68). |
| **TP-3** | **At-rest stays minimal.** Only the progress bar (while worked) and the alert icon (while blocked) show without hovering. Name, charges and the recipe gear stay hover-only, as today — keeps an 8-hero mat readable rather than every Token shouting its stats at once. |
| **TP-4** | **The bar's width matches the Token's own diameter** (128 u for a 1×1, 288 u for a 2×2) rather than one fixed width for every size. |
| **TP-5** | **Badge positions stay fixed regardless of which side the hero stands on.** No side-aware layout — predictable over clever. |

## 3. Director's picks (provisional — the owner can overturn any)

* **TPP-1 — The corner badges stay in their corners.** Name (top, hover),
  station gear (top-right, hover), alert icon (top-left, always when present)
  are unchanged — none of them collided with the old bottom-edge bar, so
  moving the bar doesn't require moving them.
* **TPP-2 — Charges (bottom-right) and add-hero/disallow (bottom-left) drop
  to sit level with the Token's own bottom edge**, since the progress bar no
  longer hugs that edge. This retires the "shift up above the bar" hack in
  `TokenChargeBadge` / `TokenChargeDeltaFloater` (`hasProgress ? bottom-5 :
  bottom-1.5`) — with the bar gone from the Token, there is nothing to shift
  above any more.
* **TPP-3 — An 8 u gap between the Token's edge and the bar.** Small and
  fixed for now; if it reads as cramped or floaty in game, it's one number to
  retune, not a new decision.
* **TPP-4 — The bar sits centered under the Token, not the hero.** With
  TP-5, badges don't move for hero side, and the bar shouldn't either.

## 4. Slices

Each slice: tests, run the game and exercise it, one commit, merge.

| Slice | What | Verified when |
| :-- | :-- | :-- |
| **TP-A — Progress bar moves below the Token** | `TokenProgressBar` becomes a sibling of the Token's overlay box, not a child clipped to it: positioned at `boxPx` width, offset `boxHalf*2 + TPP-3's gap` below centre. Shown whenever a hero is working (TP-2), not just on hover. Same fill/label/alert logic, new position and size only. | A worked 1×1 and a worked 2×2 both show a bar in the gap below them, matching their own width, visible without hovering, and it still fills, resets on cycle complete, and turns red/yellow on an alert exactly as before. |
| **TP-B — Corner badges reflow** | `TokenChargeBadge` and `TokenChargeDeltaFloater` drop to the Token's own bottom edge now that nothing is there (TPP-2); the `hasProgress` shift-up branch is deleted. Name, gear, add-hero/disallow, alert icon checked for any leftover spacing assumptions from the old cramped layout. | Eight worked Tokens of mixed sizes read cleanly at a glance — bars visible below each, corner badges appear cleanly on hover, nothing overlaps a neighbouring Token or a hero standing close by. |

**Out of scope here** (each is its own item on the owner's list): hero speech
bubbles replacing alert badges, green/yellow "can be worked" dots, enemies
that wander, flags placed onto Tokens, the hero dock redesign, tools becoming
equipment.

## 5. Implementation status

| Slice | Status | Notes |
| :-- | :-- | :-- |
| TP-A | ✅ **DONE** 2026-09-22 | `TokenProgressBar`'s container now sits `top-full` of its Token's badge box, offset by `TOKEN_BAR_GAP_U` (8 u, `boardConstants.js`), full width instead of `left-2 right-2`. No change to the fill/label/alert logic — only where and how big it draws. `TokenChargeBadge` / `TokenChargeDeltaFloater` lost the `hasProgress` shift-up (TPP-2); one test rewritten to check the fixed position. 179 test files, 11 pre-existing TerrainRegistry failures only (matches the handoff's known baseline). In game: hired a hero, force-staffed a Birch Forest by hand (its normal skill-gate made a quick manual check slower than publishing the board events directly), and drove both states — a plain `board:progress` tick showed the white bar in the gap under the Token at its width; a `board:alert_changed` (`inputs`) turned it yellow with "Need Items", also without hovering. |
| TP-B | ✅ **DONE** 2026-09-22 (audit only, folded into TP-A's commit) | The charge badge and its delta floater were the only ones with a "shift up above the bar" hack — fixed as part of TP-A. Name (top, hover), station gear (top-right, hover), add-hero/disallow (bottom-left, hover) and the alert icon (top-left, always-on) never referenced the bar's old position, so there was nothing left to reflow. Read all five badge components to confirm. |
