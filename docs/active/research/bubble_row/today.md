# What the mat shows today when a hero works a Token

*T-239 (brief 210, F2), 2026-10-24. Read from the code on `main` at `ca43fca7` and checked in the
running game at 1920 × 1080 (captures in this folder, `capture_bubble_row.mjs`). The intake's
description ("rings, gears, problem marks and work bars scattered") predates the mat-layer rework
of 2026-10-18: at rest, most of that is gone already.*

## The short version

At rest, a hero working a Token shows **one thin work bar** at the Token's foot and, when stuck,
**one "!" mark** in its middle. Everything else (charges, timers, the recipe gear, names) appears
only once the pointer rests on the Token, scattered over its corners. The Token's and the hero's
**green outlines** say they are paired; nothing on the mat says *what* is being made.

Measured in the page (the capture script counts them): a worked Token's overlay holds **2
elements at rest** (the box and its work bar), **4 when stuck** (plus the problem mark), and
11–15 once the pointer rests on it. A hero figure is 7 elements, 11 in a fight (its HP bar).

## Where things stand (1920 × 1080, the mat at a fit of 0.9, art at 2×)

- A working hero stands **96 mat units (86 screen px) from the Token's centre**
  (`HeroMotion.standingSpot`: art radius 64 + `STAND_GAP` 32). The two 128 px art boxes overlap
  by about 40 px and the bodies touch: **there is no gap between them at mid-height.** Anything
  "between" them has to sit below their feet or above their heads.
- **Above** is busy: a pinned flag's cloth flies directly over its Token (its pole stands at the
  top of the art circle, `pinnedFlagPoint`); HP bars over both fighters; the hero's speech and
  level-up floats over the head; callouts over the Token, stacked on the hero's speech column.
- **Below** holds only the name, on hover (owner 2026-10-23), and floor loot: each cycle's output
  lands 0.4–0.85 of a Token from its centre in a random direction (`SpriteLayer.scatterFrom`;
  auto-collect is off by default), so piles lie right round the Token and its hero.
- **Stacking** (`matLayers.js`): a Token's badges sit two above its art, inside the Tokens' range;
  floor loot, effects, flags off the mat's order, callouts and hero speech all sit above that
  whole range. A row drawn in the Token's own badge box would be covered by loot lying on it.

## Every piece, who draws it, and how often it redraws

### On the worked Token (`MatToken` → its badge box → `TokenBubbles`, the `bubbles` switch)

| Piece | Where | When it shows | What redraws it |
|---|---|---|---|
| **Work bar** (`workBar.js`, `.gi-work-bar`) | along the art's foot, 40 × 2 art px | the whole time a hero works it, not in a fight | the shared step clock, 10 steps a second, every bar in the same frame, and only when its fill moves an art pixel: up to 10 writes a second on a 3 s cycle, 5 on an 8 s one, about 2 on a 19 s one. Held grey while blocked |
| **Problem mark** (`ProblemMark.jsx`, `problemMark.js`) | the middle | whenever there is a problem: yellow "!" waiting (inputs, a Token beside it, charges, a choice), red "!" can't (no room, the cap, level, skill, tool) | only when the problem changes. Its hover reads the exact words when the pointer arrives ("Needs Iron Ore"). Drawn with a `drop-shadow` filter for its hard shadow |
| Disallow and demolition marks | the middle | the whole time they apply | on change |
| **Charge floater** "-1", "+50" (`TokenChargeDeltaFloater`) | over the charges ring's corner | every time the charges change | a 3 s rise-and-fade animation per number (on the compositor for a worked Token), with a `drop-shadow` filter and a three-layer blurred text shadow; 2–3 elements while in flight. On a 3 s cycle one is always in the air |
| Enemy HP bar (`HealthBar.jsx`) | above the box | in a fight, or while the enemy is hovered | each hit (a 0.3 s width transition); three blurred text shadows on the number |
| *Hover only* (after the pointer rests 150 ms, `useHoverRest`): charges ring (bottom-right), quest ring (bottom-centre), spawner ring and recipe gear (a row in the middle), timer ring (top-left: growth, turn, refill) | the box's corners and middle | while rested on | the count rings glide by CSS when their number changes; the timer ring re-reads its clock 4 times a second while shown. About 6 elements a ring |
| Name | below the box | while rested on | memoised |

### On the Token's art (`MatToken` art box)

| Piece | When | What redraws it |
|---|---|---|
| **Outline** (`spriteOutline.js`): green worked, red in alert, white hovered | always while it applies | a generated picture under the art, swapped on a change of state; no filter |
| **Hit loop and strike chips** (`TokenHitArt.jsx`, `fx/strikeChips.js`, the `tokenFx` switch) | while worked and unblocked | the art bounces on each of the hero's strike frames (a Web Animations loop) and chips fly off each strike; a finished cycle blinks the outline white for one frame |

### On the hero (`MatHero`)

| Piece | When | What redraws it |
|---|---|---|
| Sprite frames (`AnimatedHeroSprite`) | always | 8 frames a second on the shared sprite clock |
| Outline green | working and not stuck (a stuck hero stands unlit) | on change |
| HP bar | hurt, fighting and 3 s after, or rested on | on each HP change |
| Name | rested on | memoised |

### Mat-wide layers

| Layer | What it says about work | How often |
|---|---|---|
| Hero speech (`HeroBubbleLayer.jsx`) | moments only: "No work in range." on going idle, "Oak Tree Depleted", a refused pin. Arriving at work is silent. Level-up floats (icon and number, about 30 s) | twice a second while anything is up; per walking step while a walker speaks |
| Callouts (`CalloutLayer.jsx`) | "! Spawned Oak Tree", an effect firing, "Needs Pickaxe" over a Token a hero passed over (at most every 8 s), refusals | per callout, 2.2 s each |
| Flags (`FlagLayer.jsx`) | a pinned flag stands on its Token, cloth above it | on change |
| Floor loot (`SpriteLayerView.jsx`) | the cycle's output lands beside the Token | per drop; piles hover-animate (their cost, T-197) |
| Item stubs (right edge) | the Bank's flows | at most 4 times a second |
| Token card (click) | live time and XP rings shared from the mat's bar (`cycleShare.js`) | on the step clock while open |

## What it costs (measured earlier, not by this phase)

- The `bubbles` draw switch is the largest single per-hero cost on the reference board:
  **3.4 ms of 12 ms** median frame work at ~4× with 16 heroes on the 128 board ("Where a hero's
  cost goes", PERFORMANCE.md, 2026-10-21, after the work bar landed). In fights the same switch
  is 5.2 of 15.7 ms with 7 fights. The switch hides the work bars, the problem marks, the
  floaters, the HP bars and `TokenBubbles`' own re-renders together; nobody has split it.
- Reasoned, not measured: with a single static work bar per Token at rest, the likely bulk of
  that cost is what moves or is filtered: the charge floaters (an animated, filtered element per
  charge spent), the HP bars (blurred text shadows, width transitions) and the work bars' writes.

## The moments captured for comparison

Four heroes, pinned, in a New Game, the game loop stopped so each moment holds (see the script):

| Moment | Token | Today (at rest / pointer resting) |
|---|---|---|
| Working normally | Furnace making Copper Ingots | `today_working_1x/2x.png`, `today_working_hover_2x.png` |
| Waiting on an input | Furnace set to Iron Ingot, no Iron Ore | `today_waiting_*`, and `today_waiting_tip_2x.png` (the "!" tooltip) |
| A timed job with charges | Fir Forest, 248 charges, 19 s cycle | `today_charges_*` |
| A fight | Goblin | `today_combat_*` |
| The whole screen | | `today_1x.png` |

`_1x` is the screen's own pixels at 1920 × 1080; `_2x` is the same, doubled without smoothing,
for a phone.
