# Sprite sharpness, part 2: the twitch and the uneven outlines (2026-11-08)

*Work in progress (engineer diagnosis, started 19:00). Measured in Edge 157 headless, the same engine
and version as the WebView2 runtime the built app runs on (157.0.4341.42), on the perf build of
`fix/sprite-sharpness` 99b1b998, board S2, game loop stopped. Findings so far:*

- **Uneven outlines**: Chrome rounds each sprite's box to whole mat units *before* the mat is shrunk
  to the window, so at any fit but 1 a Token's art is drawn a screen pixel too narrow or too wide and
  one row or column of art pixels comes out a pixel thinner or thicker; the coloured outline is
  rounded on its own and slips against the art.
- **Fix candidate measured**: drawing the mat with CSS `zoom` instead of `transform: scale` (scratch
  build): every Token exact at 1920x1017, the outline exactly one art pixel round the art.
- **Twitch**: the "Nothing to work here" bubble pops on its own compositor layer, but changed no
  Token in the shots taken while it played; the mat itself is a composited layer today, and redrawing
  part of it re-places the thin and thick rows of some Tokens. Still being measured.
