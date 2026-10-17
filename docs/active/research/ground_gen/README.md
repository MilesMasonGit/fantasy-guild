# Ground generator (design loop)

A prototype that draws ground by rules (palette ramp with hue shifting, clumps,
blade strokes lit from the top-left, earth with rim and tufts, tint pattern),
used to iterate the look with the owner before the rules move into the game
(brief 180, route chosen 2026-10-17). Rounds are rendered under the real Tokens:

    python docs/active/research/ground_gen/gen.py 1

reads `rounds.json` (one entry per round) and writes `round_<n>.png` next to the
script's copy in the director's scratchpad; adjust the output path if run from
here. The owner's verdicts per round are recorded in brief 180.
