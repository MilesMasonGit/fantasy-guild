Status: briefed 2026-10-14 (approved 2026-10-14; brief 140)

# The level-up moment and the button shine

*From the owner's refinement pass ([refinement_pass_todo.md](refinement_pass_todo.md)
§4, "Hero Playmat Level-Up" and "Token & UI Shine Sweep"). Owner interview,
2026-10-13; **done** (owner closed it). Build tickets: **T-177** (level-up),
**T-178** (shine). Effects follow the animation rules in
[research/animation_menu.md](research/animation_menu.md): whole art pixels,
stepped timing, no blur.*

## On the mat: a floating skill icon and number

- When a hero levels a skill, **that skill's icon (2×) and the level number
  (display text size) float above the hero's head**, free of any frame, with
  the UI hard shadow so they read on any ground. They follow the hero.
- **The number transforms**: the **old** number appears, gets a **gold
  1-art-pixel outline that flashes** for a few stepped frames, then **rolls up
  like an odometer** to the new number.
- **It stays about 30 s**, then fades.
- **Several skills** levelling close together sit **side by side**, each
  fading on its own timer.
- **After time away**, each hero's levelled skills show the same way, rolling
  from the old number to the new one.
- **Nothing else**: no hop, no pixel burst, no sparkle (T-137's effect 12 and
  the owner's level-up sparkle art are dropped).

## On the hero bar: the lasting alert

- The **"LVL UP!" speech line leaves the mat**; it lives on the **horizontal
  hero bar as a lasting alert until the player clears it**, worded
  `[level] [skill]!` ("50 Stealth!", T-149). `speech_bubble_lines.md` line 13
  is updated when this is built.

## The shine sweep

- **Only on main-action buttons** (Upgrade, Settle, Craft: UI_STYLE
  "Buttons"): **one fast diagonal glint when the button is hovered**.
- A narrow band of lighter pixels steps across the button face in a few
  frames; it never covers the pixel art beneath. Not on Tokens.
