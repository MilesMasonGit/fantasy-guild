Status: draft

# Playmat declutter: fewer marks, more board

*Owner interview opened 2026-11-23 (planning agent). The owner names what feels
cluttered or overstimulating on the playmat, item by item; each item's ruling is
recorded here as it is made. The topic is open until the owner calls it fully
explored.*

> "I'm trying to strike a balance between all the information that I need to
> show to the player at a glance, and the board needing space to clearly show
> what's happening." (owner)

Builds on [concept_info_layers.md](concept_info_layers.md) (what the mat, hover
and the card each show) and [concept_token_bars.md](concept_token_bars.md) (the
one plate). Those rules stand unless an item below amends them.

## 1. Job rings (the task ring round each job in progress)

Today (`taskRing.js`, `TaskRings.jsx`): a green ring (amber when stuck) round
the Token and the heroes working it; the ground and resting Tokens inside it
are dimmed (`TASK_DIM_LIGHT` 0.6) and drained toward grey (`TASK_DIM_GREY` 0.8).

1. **Centred between the art** (owner): the area's centre is the midpoint of
   the hero sprite's visual centre and the Token sprite's visual centre (with
   several heroes, the middle of all of them and the Token). Today it is the
   middle of hit boxes (`artRadiusOf` and `HERO_HIT_PX` by `HERO_BOX_PX`),
   which does not match where the art sits, so it reads off-centre.
2. **No ring line** (owner): the drawn ring goes, working or stuck. The
   dimmed area alone marks a job. A stuck job is told by its '!' and the
   problem in its work plate, as today; no amber tint, no line.
3. **The look of the dimmed area is picked from a screenshot page** (owner):
   four looks side by side on the same busy scene: **parchment / sepia**
   (the owner's idea: warm, faded, old paper), **a lighter grey**, **a
   soft-edged fade** (no hard circle edge), and **today's look** as the
   before. The owner picks one; only that one is built. No QA switch.

## 2. Reach rings and their dots

Today (`MatRings.jsx`, `reachDisplay.js`): hovering a Token that uses reach
shows the ring after the shared 150 ms hover rest (`HOVER_REST_MS`, the same
as the name label), so a slow sweep across the board pops ring after ring.
Every Token inside the ring gets a dot (`reachDotsAt`, all of `tokensWithin`).

1. **The ring waits 0.4 s** (owner): the pointer rests 0.4 s on the Token
   before the ring and dots appear. The name label keeps its 150 ms. A
   Token being dragged shows its landing ring at once, as today.
2. **Dots only on Tokens it affects** (owner): a Logging Camp dots trees,
   not ore veins; a Token with neighbour rules dots only the Tokens those
   rules touch; a Foundation dots what its future building would touch.
   Unaffected Tokens inside the ring get nothing. The test of "affects" must
   come from the engine's own rules, not a second list in the UI (the ⚠️ on
   `reachDotsAt` still holds for the distance).

## 3. The problem mark ('!')

Today (`ProblemMark.jsx`, `alertBob.js`, `problemMark.js`): the yellow
(waiting) or red (can't) '!' bobs above the art's top edge; on hover the idle
plate under the Token (`idlePlate.js`) shows the same problem again. A full
Token cap (`ALERT.SPAWN_MAT_FULL`) puts a red '!' on every spawner at once.

1. **In the centre of the Token** (owner): over the art's middle, not above
   it, so it is plain which Token it belongs to. A worked Token's problem
   still shows in its work plate as today (amended in point 3 only for the
   idle plate).
2. **Still** (owner): no bob. A choice waiting on you (a station's recipe, a
   Foundation's building) keeps its slow pulse, and the gear still takes the
   mark's spot on hover, now in the centre.
3. **Said once** (owner): when a Token shows its '!', the idle plate under it
   leaves the problem out (the plate shows only its timers, or nothing). The
   reason is on the Token card (section 11: no tooltips on the mat). Every
   problem, not only the cap.
4. **Token cap full: yellow, and gone once hovered** (owner): a full cap is
   waiting for room, not broken, so a spawner shows the yellow '!'. Once the
   player hovers that spawner, its cap '!' goes away (seen); it comes back
   only if the cap frees and fills again. The top bar's count still turns red.
   Red stays for real can't-do problems.

Director's call when building: the centre row is shared with the gear and the
demolition badge; a marked Token shows its demolition badge over the '!'. The
enemy HP bar no longer needs to hide the '!' once it is off the top edge; check
it at the look.

## 4. Controls: drag and drop only, right-click inspects

**Amends** [concept_rts_controls.md](concept_rts_controls.md) (brief 610,
built 2026-11-12): select and right-click orders are **removed**; drag and
drop is the one way to give orders (owner, 2026-11-23).

1. **Left button: drag only.** A plain click on the mat does nothing. No
   selecting, no gold selection outline, on the mat or the hero bar.
2. **Right-click inspects**: a Token opens its card, a hero their Hero
   drawer. **Double-click is retired.** A right-click is never an order.
3. **The hero bar**: a plain click on a hero's card opens their Hero drawer.
4. **Stopping a hero** is by drag, as before: drop them on bare ground (they
   wait there) or on the Guild Hall (home). Right-click-to-stop goes with
   the rest; no new button.
5. Clean-up for the director: the select and right-click code, its tests and
   any tutorial or tooltip text that teaches it go too (grep for "right-click"
   and "select" in hints and the tutorial).

## 5. The Token card

1. **Scroll arrows only when there is something to scroll** (owner): an arrow
   shows only while there is more in its direction; none at all on a list
   that fits. In the shared `ArrowScrollList`, so every list that uses it
   (the card, the recipe list, drawers) follows.
2. **A tail points at the Token** (owner): a small triangle on the card's
   edge, aimed at the inspected Token, like a speech bubble's tail; it
   follows the Token if the Token moves and flips with the card's side.
3. **The inspected Token comes forward** (owner): while its card is open it
   is drawn above heroes and other Tokens, with the gold outline (freed by
   point 4.1). The rest of the board is not dimmed.

## 6. Token spacing

**A little more air between Tokens** (owner): the Mat Tuner's `overlapPct`
goes from **40 % to 30 %** (two small Tokens' centres about 61 → 71 units
apart). One number; it can be nudged again at the look. Existing boards are
not re-laid; the new gap applies to placements from then on (director: check
how a load treats Tokens already closer than the new gap, and say so).

## 7. Heroes walk anywhere

**A dropped hero always goes where they were dropped** (owner): heroes walk
over Tokens, so a hero dropped on ground needs no clear space; no nudge, no
fly-back for lack of room. Dropping a hero **on** a Token is still an order to
work or fight it, as today. The spot must still be on the mat.

## 8. The top bar

1. **Token count and Upkeep are switched off for now** (owner: not used
   enough). Hidden, not deleted; the code stays for a later return.
2. **No frame**: the studded frame round the bar goes.
3. **The region title and its banner background move to the right.**
4. **The left side is the logo's**: until the owner draws the logo, the words
   **Tabletop Guild** in the title font (the rename itself is
   [brief 820](briefs/820_tabletop_guild.md)).
5. **Demolish leaves the top bar** for the Controls section (section 9). The
   map mode's banner while Demolish is on keeps its place in the bar's middle
   (director's call if it no longer fits).

## 9. The Controls section

A new strip **under the playmat, left of the hero bar**, the same height:
**a framed row of square icon buttons, each with a tooltip** (owner).

1. **Demolish**, moved from the top bar, works as today.
2. **Find: category hover buttons**: **Heroes, Tokens, Enemies, Items**.
   Hovering one lights every match on the board; moving off ends it. **Items
   means loot on the floor** (owner).
3. **Find: a search box**: a typed word lights **names** (heroes, Tokens,
   enemies) **and Tokens that make the item named** (Copper lights the
   Copper Vein and a Smelter making Copper Bars) (owner). Lit while the box
   has text; Escape or emptying it ends it.
4. **How matches show**: a **white outline** on each match and **everything
   else faded a little**, only while a button is hovered or the box has text
   (owner). No jump-to or ping.
5. Icons: placeholders from the style kit until the owner draws them (add to
   `owner_art_list.md`).

## 10. The big banners

**Amends** [concept_notifications.md](concept_notifications.md) "Banners"
(placement, stacking, hiding). The banners' look, sound, merging and the
hover outline on the mat stand.

1. **A show/hide icon at the top right, above the item notices** (owner).
2. **The banners pop out of that icon**, at today's size (~480 px), over
   the item notices and the playmat (owner). Top centre is no longer used.
3. **Shown**: **every waiting banner** is listed, stacked down from the icon
   (scrolling if long); no three-limit, no "+N" tab. **Each leaves when
   clicked**, as today; a click on the icon hides them all at once (owner).
4. **Hidden**: a new banner pops out for **about 5 seconds**, then tucks back
   into the icon; clicking the icon shows everything waiting (owner).
   Director's default, not ruled: the icon shows how many are waiting, red if
   a problem is among them.
5. Whether shown or hidden is remembered between sessions (director's default).

## 11. No hover tooltips on the playmat

**Nothing on the mat shows a hover tooltip** (owner): the enemy card tip
(`EnemyCardTip`), the '!' reason, the work plate's cell tips, the flag cloth's
tip, the Passive Production tooltip and any `title` text on a Token go. The
reasons and details live on the Token card and the Hero drawer (right-click).
Not tooltips, so they stay: the name label on hover, the hovered work plate's
full line (without its tips), and the recipe bubble (section 12). Panels and
bars off the mat (hero bar, Controls, top bar, drawers) keep theirs.

## 12. Recipes: one place to choose, one way to see

1. **The gear sits in the Token's centre**, always (owner: today it moves
   between the centre row and the '!' spot). It shows on hover on a Token
   that takes a recipe; with none chosen it pulses, as today.
2. **Choosing a recipe happens in the Token card** (owner): the separate
   recipe picker goes. Clicking the gear does what a right-click does.
   - **No recipe chosen**: the card opens straight on its recipe list.
   - **A recipe chosen**: the card opens on its usual face, the current
     recipe shown, with a **Change** button to the recipe list.
   The same for a Foundation's building choice (director: check it fits the
   card the same way, and say if not).
3. **Hovering a Token with a recipe chosen shows that recipe's output sprite
   in a speech bubble over it** (owner), in the hero speech bubble's style.
   Hover only, never at rest.

## 13. The playmat reaches further left

The mat extends left toward the Nav Bubbles, leaving **the same gap as on its
right side** (owner), so it sits evenly in its space and gets more board.

## Open

The owner's list continues; more items follow.
