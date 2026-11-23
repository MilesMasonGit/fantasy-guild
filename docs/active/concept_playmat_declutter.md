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
   '!' keeps its tooltip with the reason. Every problem, not only the cap.
4. **Token cap full: yellow, and gone once hovered** (owner): a full cap is
   waiting for room, not broken, so a spawner shows the yellow '!'. Once the
   player hovers that spawner, its cap '!' goes away (seen); it comes back
   only if the cap frees and fills again. The top bar's count still turns red.
   Red stays for real can't-do problems.

Director's call when building: the centre row is shared with the gear and the
demolition badge; a marked Token shows its demolition badge over the '!'. The
enemy HP bar no longer needs to hide the '!' once it is off the top edge; check
it at the look.

## Open

The owner's list continues; more items follow.
