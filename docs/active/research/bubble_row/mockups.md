# Bubble row mock-ups: who is working what

*T-239 (brief 210, F2), 2026-10-24. Three static mock-ups on the style sheet page (QA panel →
Style Sheet → "Bubble row", under New, unapproved), drawn with the real sprites and the pixel
kit at the mat's 1920 × 1080 size; nothing in the game uses them. Today's look of the same
moments: [today.md](today.md). Hover any part of a mock-up on the style sheet page for its
tooltip.*

## The pictures

| File | What |
|---|---|
| `compare_<moment>_1x.png` / `_2x.png` | **Start here**: one moment, today beside A, B and C (and C opened, for the charges moment). Moments: `working`, `waiting`, `charges`, `combat` |
| `mockup_<A|B|C>_1x.png` / `_2x.png` | each mock-up's four moments together, as on the style sheet page |
| `mockup_<A|B|C>_tip_2x.png` | the pointer resting on the waiting moment's problem: its tooltip |
| `today_*` | today on the mat ([today.md](today.md)) |

`_1x` is the screen's own pixels; `_2x` is doubled without smoothing, for a phone. The mock-ups'
ground is a flat green; the real mat is textured and a little lighter.

## The three

All three show the same things: **what the Token is making**, **how far the cycle is** (the work
bar, moved into the row), **its charges**, and **any problem**, with the hero's **skill** and the
**time to the next one** as well where there is room. A problem shows the missing input itself
as a have/need pill (`0/6`, red when short, as UI_STYLE writes costs) in a gold-edged frame,
rather than a bare "!". A fight shows **both fighting styles and the hero's elixirs**; the HP
bars stay above the fighters, as the combat plan has them.

- **A. Chips at the feet.** Square pixel chips on the seam between the Token and its hero, just
  below their feet: the Token's side carries what it makes (cycle along the chip's foot) and its
  charges or what it waits for; the hero's side carries the skill. Always shown.
- **B. A tag over the Token, tailed to the hero.** One framed tag above the Token (skill, output
  with the cycle along its foot, charges or what it waits for) with a one-pixel tail stepping
  down to the hero's head. Always shown. It lands on the pinned flag's cloth, and in a fight it
  has to climb over the enemy's HP bar.
- **C. A quiet plate at the feet, opening on hover.** One framed plate on the seam below their
  feet. At rest it shows only the output with the cycle along its foot, plus the charges or
  exactly what it waits for. Resting the pointer on the hero, the Token or the plate opens the
  full line: skill, output, charges, time to the next one, each with its tooltip, the name moving
  below it.

## What each would cost to draw, against today

Reasoned, not measured (no bench in this phase). Elements are what a build would draw per
working hero at rest (a frame is two elements, the picture and its hard-shadow picture; one per
icon, number and fill bar). The counts the capture script prints are the mock-ups as drawn for
the style sheet (placeholder glyphs drawn as one SVG cell per pixel, extra wrappers), not a build:
A 16–40, B 34–55, C 9–30 (62 opened) per moment.

| | Elements per working hero at rest | What redraws, and when | Collides with |
|---|---|---|---|
| **Today** | 1 (the work bar); 3 when stuck (the "!" mark); a 2–3-element floater for 3 s on every charge spent | the bar on the shared 10-a-second step clock, only when it moves an art pixel; the floater animates (with a `drop-shadow` filter and blurred text shadows); the "!" on a change | nothing at rest |
| **A** | 8 working, ~12 with charges or a problem, ~10 in a fight | the fill exactly as today's bar; the charges number once per charge spent; the problem chip on a change. Nothing else moves | floor loot lying at the feet (drawn above Token badges) |
| **B** | 8–10, plus the tail | as A, plus re-placing the tag whenever speech, a level-up, a callout or a fight's HP bar arrives above the head | the pinned flag's cloth (always), HP bars, speech, level-ups, callouts; the tail goes against the combat plan's "no tether line" |
| **C** | 5–7 at rest; 9–11 while the pointer rests (mounted only then, as today's hover rings) | as A at rest; the timer number once a second only while open | floor loot at the feet, as A |

In Tokens' worth (GDD §14: on the 128 board at ~4× a Token costs about 0.04 ms, about ten
static elements): with eight heroes working, **A adds roughly 8–10 Tokens' worth (~0.3–0.4 ms),
B about the same plus its collision work, C about 4–5 (~0.15–0.2 ms)**. Static elements cost
little once drawn; what costs is what moves or is filtered. So the row can **pay for itself** by
taking away what today moves: the "-1" floater (the row's charges number simply ticks down
instead), the problem mark's `drop-shadow` filter, and the blurred text shadows. That trade is
the build phase's to prove with `bench:draw --compare` (heroes16 and cap128) and its own draw
switch.

## Recommendation: C

1. **Quiet.** One small plate per working hero, saying the one thing worth a glance: what is
   being made, how much is left, or exactly what is missing. The rest waits for the pointer, as
   the owner asked of bubbles before ("they should pop in when the Token is hovered or when they
   change", ui_rework_list.md) and as batch B made the Tokens quieter.
2. **Where there is room.** The hero stands touching the Token (86 px apart at 1920 × 1080), so
   "between" means above their heads or below their feet. Above is the pinned flag, speech,
   level-ups, HP bars and callouts; below is free but for the hover name. In a fight the same
   plate carries both styles and the elixirs below, the HP bars above: no tether, as the combat
   plan rules.
3. **Cheapest** of the three always-on footprints, and one frame per panel as UI_STYLE asks
   (A is a row of boxes side by side).

## Notes for the build (whichever is picked)

- **Its own layer, above floor loot.** In the Token's badge box a row is covered by loot lying at
  the Token's feet (loot sits above every Token's badges, `matLayers.js`). One mat-wide layer
  (like the callouts), each row placed from its Token's point and the hero's standing side,
  moving only when a hero arrives or leaves or a Token is pushed.
- **Only while the hero is at work** (not while walking up), and only for that work: a Token
  nobody works keeps its own "!" and its hover rings. The red "can't" problems of level, skill
  and tool come from a flag passing the Token over (or refusing the pin), with no hero standing
  there, so they stay on the Token's mark; the row's problems are mostly the waiting kind, plus
  "no room".
- **The fill is today's work bar** (`workBar.js` on the shared step clock), moved into the row.
- **No filters, no blurred shadows**: the frame's own hard-shadow picture, text with one hard
  one-art-pixel shadow. Nothing in the row animates at rest.
- **Out of the art boxes**: the hero's art repaints 8 times a second and the Token's on every
  strike; a row overlapping either is repainted with it. A and C sit just below both.
- **Hover**: resting on the hero, the Token or the plate opens it; each part has a tooltip
  (`Bubble.jsx`'s pattern); pressing the plate grabs the Token, as every bubble does.
- **Sizes**: icons are 32 screen px on today's 2× mat (items at 1×, skill icons and marks at 2×).
  On a 1× mat (1366 × 768) the same plate is twice as big next to the Tokens; decide then
  whether to keep it or draw skill icons at 1×.
- **Dark icons**: the Smithing anvil is near-black and nearly vanishes on the dark plate (visible
  in every mock-up). A lighter plate fill or a redrawn icon; the owner's call.
- **Combat** (brief 220, C6): the fight variant (styles and elixirs) is shown here so the place is
  kept; its build follows the combat batch.

## Built (2026-10-24): mock-up C, the work plate

The owner picked C by phone, with three rulings: the plate's charges number replaces the floating
"-1"/"+50" (the floaters are switched off, `CHARGE_FLOATERS` in `TokenBadges.jsx`); a Token
nobody works keeps its own "!" and hover rings; the dark Smithing icon stays.

Where it lives: `workPlate.js` (what it shows, its tooltips, where it stands),
`WorkPlateLayer.jsx` (the layer, `MAT_Z.WORK_PLATE`, over the floor loot; one plate per hero at
work, not in a fight), the work bar's model still fed by `TokenBubbles` and drawn as the plate's
fill (`workBar.js`: `shareWorkBar` / `watchWorkBar`), the `workPlate` draw switch, and the
style sheet page's "Work plate" entry (`WorkPlateDemo.jsx`), which replaced the three mock-ups.

Differences from the mock-up: the cycle's fill runs under what is being made, not the whole
plate's foot (it keeps whole art pixels: 16 steps); the fight's place is kept but empty (no plate
in a fight until the combat work builds its link).

| File | What |
|---|---|
| `before_after_<moment>_1x.png` / `_2x.png` | **Start here**: today, built, and built with the pointer resting on the Token |
| `after_<moment>_1x.png` / `_2x.png`, `after_<moment>_hover_2x.png` | the same patches as `today_*` |
| `after_charges_open_hero_2x.png` | the pointer resting on the hero: the full line, the names below it |
| `after_waiting_tip_2x.png` | the pointer on what the Token waits for: "Needs 6 Iron Ore, you have 0" |
| `after_1x.png` | the whole screen |
| `sheet_work_plate_1x.png` / `_2x.png` | the style sheet page's entry |

Measured in the running game (the capture script prints them; 1920 × 1080, a New Game):

| Moment | Plate at rest (elements, with its slot) | The Token's own badge box | Opened line |
|---|---|---|---|
| Working (Furnace, Copper Ingot) | 7: output, fill | 1 (was 2: the work bar left it) | skill, output, timer `0:04` |
| Waiting (no Iron Ore) | 10: output, `0/6` in red, gold frame, fill held | 1 (was 4: the bar and the "!" left it) | skill, output, `0/6` |
| Charges (Fir Forest) | 10: output, `248`, fill | 1 (was 2) | skill, output, `248`, timer `0:07` |
| Fight (Goblin) | none: the place is kept | 5 (HP bar, as before) | none |

No `-1` floats anywhere on the mat (0 floaters counted). The captures' scenes are built with the
game loop stopped and then run on for 2.5 s, so each plate's fill stands where its cycle is; the
mock-up phase's `today_*` captures were taken before that run, so today's bars there read empty.
