# Brief 720 — The animated ring: reach, flags and the task ring

*Written 2026-11-20 by the planning agent from the owner's list of small changes and the follow-up
interview the same day. Runs with [710 Mat polish](710_mat_polish.md), before the Systems Audit's fix
briefs.*

**What the player gets.** Rings that grow out from a Token and shrink back in instead of popping on and
off; the Tokens in reach light up with a pulse as the ring sweeps over them; a hero's flag shown in the
middle of their Token when you hover the hero; and a ring around every job in progress, with the
ground inside it dimmed so the hero and the Token pop.

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, `docs/reference/ARCHITECTURE.md` (drawing, the mat's layers,
the frame clocks and drawing pause). The look rule: every pixel the same size, whole art pixels only
(`docs/active/concept_art_direction.md`). Where things are today (read 2026-11-20 at `55a3dfc6`;
check the code, it wins):

- **Reach ring**: `MatRings` (`src/ui/components/board/MatRings.jsx:54-122`), one gold pixel ring drawn
  as SVG by `pixelRing.js:7-55` through `CampReachRing.jsx:36-80`; shown on hover of a Token that has
  a reach (`reachDisplay.js:22-31`) and while dragging a Token (at its landing spot); a camp's ring also
  while its hero is hovered or picked (`MatBoard.jsx:507-519, 683`). Reach dots (`reachDot.js:8-22`) on
  every Token inside, from the engine's `tokensWithin` (`reachDisplay.js:41-48`). It mounts and
  unmounts; no animation.
- **Flags**: `FlagLayer` / `FlagMark` (`FlagLayer.jsx`, `flagGeometry.js`): a Token order's flag peeks
  from behind the Token's top-left corner, always shown, fanned when several heroes share a Token; a
  spot order's flag fades 700 ms after arrival and returns while the hero is hovered.
- **Working**: a worked Token and its hero get a green sprite outline (`spriteOutline.js:20-36`); no
  ring, no ground dimming (the only ground shade is the whole-mat `HELD_SHADE`, `MatBoard.jsx:584-596`).
- **Animation helpers**: `frameClock.js` (`onStep`, `onDue`, `onFrame`), `fx/oneShot.js` `animateFx`,
  `fx/pixelSteps.js`; `setDrawingPaused` stops them on a hidden or minimised window.

## The rulings (owner, 2026-11-20)

- **One animated ring, reused.** The ring grows out from its centre to its radius and shrinks back to
  the centre when it goes, in whole art pixels, in about **0.25 s** (one constant, tuned at the look).
  It is a shared piece the game can use elsewhere to draw attention later (no other uses in this brief).
- **Reach dots pulse in.** As the growing ring crosses a Token in reach, that Token's dot appears with a
  one-shot pulse; as the ring shrinks back past it, the dot goes. While a Token is dragged the ring
  grows once at the start and then follows the landing spot; dots that come into reach pulse in.
- **Flags in the middle, on hover.** A hero's flag is shown only while that hero is hovered, on the mat
  or the hero bar: in the middle of the Token they're ordered to (or on their ordered spot), with a
  pulse while shown. Hovering a Token shows the flags of every hero ordered to it, side by side in its
  middle. All other flags are hidden.
- **The task ring.** **Every** Token a hero is working gets a ring framing the Token and its hero(es),
  with the ground inside the ring dimmed (lower brightness and saturation of the background) so the
  action pops. **Per job**: it grows when a hero starts work on the Token, stays while work goes on,
  and shrinks when the last hero stops (used up, re-ordered, knocked out, sent home). Its look (colour,
  how much the ground dims, radius, whether the green work outline stays) is **picked from a screenshot
  page first** (the owner's rule: looks are picked from screenshots, then only that design is built).

## Phases

| Phase | Ticket | What | Tier |
|---|---|---|---|
| R1 | T-593 | **The animated ring and the reach dots.** A shared ring piece with grow and shrink (stepped in whole art pixels, the 0.25 s constant, a callback or radius readout so dots can follow); the reach ring and the camp ring use it; dots pulse in as the ring crosses them and go as it shrinks past. A Token whose hover ends mid-grow shrinks from where it is. Nothing animates at rest: the ring is still once grown. | builder |
| R2 | T-594 | **Flags in the middle, on hover, with a pulse.** As the rulings. The flag's tooltip and the spot order's flag keep working; the flag still sorts so a Token's art does not hide it; the pulse stops when the hover ends and pauses when minimised. `Flags.js` (the engine's orders) is untouched. | builder |
| R3 | T-595 | **Task ring look pick.** A screenshot page (as earlier look picks): a busy mat with five or six heroes working, in three or four designs varying the ring colour (gold as reach, the hero's flag colour, the work green), the dimming strength, the radius (just round the Token and hero, or a fixed size), and the green outline kept or dropped; two Tokens side by side so overlapping rings show. The owner picks one. No game code. | builder |
| R4 | T-595 | **The task ring, as picked.** On every worked Token, per job, using R1's ring. Overlapping rings must not dim the ground twice. The ground dim is drawn once and changes only when a job starts or ends (no per-frame cost at rest); a stalled tab or a catch-up does not replay every ring. Measure: `bench:draw --compare` against `main` with six heroes working; report the idle cost. | engineer |

**Order and parallel work.** R1 first (R2 and R4 use its pulse and ring). R2 and R3 may run beside each
other after R1; R4 after the owner's pick in R3. Brief 710's P3 also touches the mat's marks: keep R2
and 710 P3 one after the other if they touch the same files.

## Done when

- Gate green; bench work check: same work (no engine change). Drag bench for R1 and R2 (the ring and
  flags move during drags). `bench:draw --compare` for the eye-check builds; R4's idle cost reported.
- Seen in the running game: the reach ring growing and shrinking on hover and during a drag, dots
  pulsing in; a hero hovered on the mat and on the hero bar showing their flag in the Token's middle; a
  Token with two ordered heroes hovered; task rings growing as heroes start work and shrinking as they
  stop, with neighbouring rings; nothing animating when minimised.
- Tickets closed into `docs/archive/tickets_done.md`.

**Eye-check: yes.** The R3 screenshot pick, then one look at R1 and R2 (with brief 710 if it is ready),
then one look at R4.

## Owner to-do

Pick the task ring's look from R3's screenshot page.
