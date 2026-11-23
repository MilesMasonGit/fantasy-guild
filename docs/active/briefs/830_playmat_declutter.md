# Brief 830 — Playmat declutter: fewer marks, more board

*Written 2026-11-23 by the planning agent from the owner's interview the same day
([concept_playmat_declutter.md](../concept_playmat_declutter.md), approved 2026-11-23). The concept
is the source of truth for every ruling; this brief says the order, the files and the bar.*

**What the player gets.** A calmer board that still says what matters at a glance: jobs marked by a
soft area instead of a ring, problems shown once and on the Token they belong to, no tooltips on the
board, reach shown only when you stop on something and only on what it affects. Orders are drag and
drop only; right-click opens a Token's card (with its recipe choice inside) or a hero's drawer. A new
Controls strip under the board holds Demolish and a Find tool. The top bar loses its frame and makes
room for the logo; the big banners move into a show/hide corner at the top right.

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, `docs/reference/ARCHITECTURE.md` (drawing, the mat),
[concept_playmat_declutter.md](../concept_playmat_declutter.md) whole, and for each phase the
concept docs it amends (named below). File paths below were read on 2026-11-23 at `7e392c43`; the code
wins. Every phase may **stop and report rather than guess**.

## Phases

| Phase | Ticket | What (concept section) | Tier | Needs |
|---|---|---|---|---|
| D1 | T-665 | **Drag only; right-click inspects** (§4, §7). Remove select and right-click orders (brief 610, [concept_rts_controls.md](../concept_rts_controls.md), now retired): `rightClickOrders.js`, selection state and the gold selection outline in `MatBoard.jsx`, `MatToken.jsx`, `MatHero.jsx`, `OrderLighting.jsx`, the hero bar, `pressRouting.js`; their tests; tutorial or hint text teaching select or right-click. Right-click a Token opens its card, a hero their Hero drawer (mat and hero bar); double-click retired; a plain click on a hero bar card opens the drawer. **A dropped hero goes exactly where dropped** (no room test, no nudge, no fly-back), still on the mat; a drop on a Token stays an order. | builder | — |
| D2 | T-666 | **The Token card** (§5, §12.2). `ArrowScrollList.jsx` shows an arrow only while there is more that way (every list using it follows). A tail on the card's edge aimed at the Token (`TokenInspectPopup.jsx` already knows the side, `dir`), following a moving Token. The inspected Token drawn above heroes and Tokens with the gold outline while its card is open. **Recipe choice lives in the card**: no recipe chosen → it opens on the recipe list; one chosen → its usual face with the recipe and a **Change** button; the separate picker goes (check `recipeFlip.js`, `RecipeList.jsx`: part of this may exist). Foundations' building choice the same way, or report why not. | builder | D1 |
| D3 | T-667 | **Marks on the mat** (§3, §11, §12.1, §12.3). The '!' in the Token's centre, still (no bob; a waiting choice keeps its pulse) (`ProblemMark.jsx`, `alertBob.js`, `problemMark.js`); the idle plate leaves the problem out when the '!' shows (`idlePlate.js`); a full Token cap gives a **yellow** '!' that goes once that spawner is hovered and returns only after the cap frees and fills again. The gear always in the centre, on hover; a click does what right-click does (D2). **No hover tooltips on the mat**: `EnemyCardTip`, the '!' tip, work plate cell tips, the flag cloth tip, `PassiveProductionTooltip`, Token `title` text. A Token with a recipe chosen shows, on hover, the recipe's output sprite in a speech bubble over it (the hero speech bubble's style). Check where the demolition badge, gear and '!' meet in the centre, and the enemy HP bar beside the '!'. | builder | D2 |
| D4 | T-668 | **Job areas** (§1). Centre each job's area on the midpoint of the hero sprites' and the Token sprite's visual centres (`taskRingOf` in `taskRing.js` uses hit boxes today). Remove the ring line, working and stuck (`TaskRings.jsx`). **First a screenshot page** of the dimmed area's four looks on one busy scene: parchment / sepia, lighter grey, soft-edged fade, today's (as the before), a letter each; the owner picks; build only the pick. No QA switch. | builder | — |
| D5 | T-669 | **Reach rings** (§2). The ring and dots wait **0.4 s** of pointer rest (the name label keeps `HOVER_REST_MS` 150 ms; a dragged Token's landing ring stays at once) (`MatBoard.jsx` `hoveredCentre`, `MatRings.jsx`). **Dots only on Tokens the hovered one affects** (`reachDotsAt` in `reachDisplay.js` dots all of `tokensWithin` today): a camp's work targets, a neighbour rule's targets, a Foundation's future building's. ⚠️ "Affects" must come from the engine's own rule tests, not a second list in the UI; if the engine has no such test for a case, stop and report the cases. | engineer | — |
| D6 | T-670 | **Board layout and Controls** (§6, §8, §9, §13). Mat Tuner `overlapPct` default 40 → 30 (`matTuning.js`; say how a load treats Tokens already closer). Top bar (`MatTopBar.jsx`, `MatBoard.jsx`): no frame; the Token cap and Upkeep badges hidden (code kept); region title and its banner on the right; **Tabletop Guild** text on the left in the title font, its width reserved for the logo; the map mode banner keeps the middle. The mat reaches left toward the Nav Bubbles, the same gap as its right. **A Controls strip under the mat, left of the hero bar**, its height: a framed row of square icon buttons with tooltips: Demolish (moved, as today), and Find: **Heroes, Tokens, Enemies, Items** (Items = floor loot) light every match while hovered; a **search box** lights names (heroes, Tokens, enemies) and Tokens that make the item named, while it has text (Escape or empty ends it). Matches get a white outline, everything else fades a little. Placeholder icons from the style kit. | builder | D1 |
| D7 | T-671 | **The big banners** (§10; amends [concept_notifications.md](../concept_notifications.md)). A show/hide icon at the top right above the item notices (`BannerStack.jsx`); banners pop out of it at today's size over the item notices and the mat. Shown: every waiting banner listed (scrolls if long), no three-limit or "+N"; each leaves when clicked; the icon hides them all. Hidden: a new banner shows about 5 s, then tucks in. The icon shows how many wait, red if a problem is among them; shown or hidden is remembered (director's defaults). Look, sound, merging and the hover outline stand. | builder | — |

**Order and parallel work.** D1 → D2 → D3 in that order (right-click and the gold outline first, the
card next, then the marks that open it). D4, D5 and D7 touch other files and may run beside them, two
code subagents at most. D6 after D1 (Demolish and the selection code move). D4's screenshot page goes
to the owner before its build half.

## Done when

- Gate green each phase; bench work check **same work** (nothing here changes what the engine does,
  except D1's hero drop spot and D6's spacing: say if the work check moves, and why). Drag bench for D1
  and D6 (drag code changes).
- Each ruling in the concept's section seen in the running game (TESTING), including: right-click on a
  Token, a hero, a station with and without a recipe; a hero dropped onto a crowded spot; a full Token
  cap with three spawners; a slow sweep across the mat (no reach rings); a Logging Camp next to an ore
  vein (no dot on the vein); Find on a busy region; five banners shown and hidden.
- No hover tooltip left on the mat (grep `title=` and tooltip components under `board/`).
- `CHANGELOG.md` entries; tickets closed into `docs/archive/tickets_done.md`; brief 610's tests that
  only covered select and right-click deleted with its code.

**Eye-check: yes**, three looks: D1 + D2 + D3 (controls, card, marks); D4 + D5 (job areas, reach); D6 +
D7 (layout, Controls, banners). D4's look pick happens on its screenshot page first.

## Owner to-do

No CMS work. Art when you like (placeholders until then): the **logo** (`public/assets/ui/u_title_logo.png`
if it's the same art as the title screen's), and **icons for the Controls buttons**: Demolish, Heroes,
Tokens, Enemies, Items, search, and the banner show/hide icon (added to `owner_art_list.md`).
