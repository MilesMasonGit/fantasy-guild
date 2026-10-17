# Eye-check 2026-10-17: generated grass in the game (brief 180, G3)

**Branch:** `crunch/ground-g3`. Your folder is already on it (to do it yourself:
`git switch crunch/ground-g3`). The game is running at http://localhost:5173/
and the slot screen loads.

**Save slot:** one you don't mind changing (the Forest view settles a dev
Region; **Back to the Starter Camp** removes it).

**What changed:** the meadow and the forest no longer repeat a sheet. Their
grass and earth are drawn by the rules we settled in the design rounds, every
pixel at the Tokens' pixel size, and never the same twice. Sand, sea and rock
keep their old sheets until the next phase (G4), so they look dull beside the
new grass for now.

1. Load the slot. The Starter Camp: lawn with tall-grass and flower-like dry
   zones, texture in patches, softened clumps, earth with clods, a lighter
   middle, a sunken edge and grass reaching in. Compare with the prototype
   (https://claude.ai/artifact/LefBh8qULf3JCdqUBb9jFY, round 9).
   Verdict: ok / change: ___
2. Resize the window a little: the ground keeps its shapes; strokes stay one
   Token pixel wide.
   Verdict: ok / change: ___
3. QA (bottom right) → Terrain → **Forest**: ferns, moss and leaf litter in
   drifts, darker earth.
   Verdict: ok / change: ___
4. Terrain → **Forest + Coast**: the new grass meeting the old beach.
   Verdict: ok / change: ___
5. The **Ground** button (bottom right) → section "Generated grass": a switch
   (off shows the old sheets, for comparison) and sliders for stroke density,
   patches, zones, earth, clump softness and size, mounds, tall and dry
   amounts. Any value you prefer becomes the default.
   Verdict: ok / change: ___
6. Travel between Regions a few times: building the ground takes a moment on
   arrival (about a tenth of a second at most). Say if you notice a hitch.
   Verdict: ok / change: ___
7. Terrain → **Back to the Starter Camp** when done.

**Four questions** (recommendation first):

1. **Flowers, bushes and pebbles on the new grass** are drawn in their full
   colours (muted they looked grey on the vivid grass). **A: keep them full
   colour, and recolour the pale `p_bush` (recommended).** B: muted as before.
   C: half muted.
2. **The forest's stronger dappled shade** (the prototype had twice the
   meadow's) isn't carried yet: every look shares one shade pattern. **A: give
   each look its own strength in G4 (recommended).** B: raise it for all now.
   C: keep it subtle.
3. **Patch size when the window isn't full size:** **A: the shapes stay fixed
   to the mat, so they never jump while resizing (recommended).** B: scale
   them with the Token art (they jump on resize).
4. **Build time per travel** (45–110 ms): **A: accept it; a background-thread
   version only if you feel a hitch (recommended).** B: do that before
   merging. C: another speed pass first.
