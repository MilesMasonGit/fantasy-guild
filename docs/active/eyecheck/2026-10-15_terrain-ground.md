# Eye-check: the ground on the mat (terrain TM1)

*Owner: play on the branch, fill in each Verdict line, hand the file back or
answer in chat. This is the first look at the terrain; the slider values you
like become the shipped defaults, so paste "Copy values" output into chat.
Fixes go on the branch, it merges, and this file moves to
`docs/archive/eyecheck/` with your verdicts. Every check is a click.*

**Branch:** `fix/terrain-tm1` (= `main` + the ground plan, placement by
terrain, and the drawn ground). The director switches your folder to it and
starts the server before telling you; the address is filled in then:

**Address:** http://localhost:____ (filled in at handover)

**Save slot:** your own slot is fine; the dev buttons settle and travel
inside your real save and clean up after themselves (Region numbers move on).

Open **QA** (bottom right), then the **Terrain (dev only)** section; close QA
after each click if it covers the mat. The look sliders are under the
**GROUND** button (bottom right).

## Checks

1. **Starter Camp.** Meadow grass with earth patches, flowers and bushes,
   rounded corners and a soft dark rim. Sliders to try: Ground wear
   (Coverage, Clump size), Colour (Brightness, Saturation). The engineer's
   note: the earth sheet is very dark, so at the shipped wear the patches read
   as near-black holes; Coverage 0.4 looked calmer. Your call.
   Verdict: ok / change: ___
2. **Forest.** Deeper green ground, earth patches, dark bushes, mushrooms.
   Verdict: ok / change: ___
3. **Mountain.** Grey stone, paler gravel patches, pebbles.
   Verdict: ok / change: ___
4. **Coast.** Sand, the sea along one edge, pale shallows, darker wet sand at
   the water, shells. Sliders: Shorelines (Beach width, Shallows width, Wet
   sand width, Band strength).
   Verdict: ok / change: ___
5. **Forest + Mountain.** Grass and rock in blobs meeting along a wiggly
   edge. Sliders: Terrain boundaries (Coast swing, Coast roughness).
   Verdict: ok / change: ___
6. **Forest + Coast** and **Mountain + Coast.** Each biome's ground, the
   beach between land and sea.
   Verdict: ok / change: ___
7. **Pixel size.** Look closely where a Token meets the ground: the ground's
   pixels are the same size as the Token's. Drag the window edge: the ground
   redraws about a quarter second later and still matches.
   Verdict: ok / change: ___
8. **Reroll it.** The same maps in a new layout.
   Verdict: ok / change: ___
9. **Scenery.** Sliders Density and Scatter.
   Verdict: ok / change: ___
10. **Copy values**, paste into chat. Then **Back to the Starter Camp**.
    Values: ___

## Known and not for this look

- Tokens that need water or shore exist in code but not in content yet; the
  sea is only reachable through the dev buttons until you author Base Maps.
- Windows display scaling other than 100 % is untested (roadmap risk 8).
