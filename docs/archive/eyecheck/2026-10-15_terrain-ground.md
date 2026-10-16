# Eye-check: the ground on the mat, and placing by terrain (terrain TM1 + TM2)

**Owner verdict (2026-10-15, in chat):** all fine. Merged the same afternoon;
no fix round. The look's tuning (slider defaults) is open for a later pass.

*Owner: play on the branch, fill in each Verdict line, hand the file back or
answer in chat. This is the first look at the terrain; the slider values you
like become the shipped defaults, so paste "Copy values" output into chat.
Fixes go on the branch, it merges, and this file moves to
`docs/archive/eyecheck/` with your verdicts. Every check is a click.*

**Branch:** `fix/terrain-tm1` (= `main` + the ground plan, placement by
terrain, the drawn ground, the CMS "Stands on" field and the grid while
placing). The director switches your folder to it and
starts the server before telling you; the address is filled in then:

**Address:** http://localhost:5173 (the director started it from your folder on 2026-10-15 at the handover and saw the slot screen load; if it is ever down, `npm run dev` in your terminal brings it back on this branch)

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

## Placing by terrain (TM2)

11. **Starter Camp:** QA → Terrain → **Place the ground test Tokens**. A red
    note lists Test Boat, Test Dock and Test Mineshaft, each with its
    "Needs …" reason, and nothing is placed.
    Verdict: ok / change: ___
12. **Pick up any ordinary Token** (or the Hall) on the Starter Camp. No grid.
    Verdict: ok / change: ___
13. **Mountain + Coast**, then **Place the ground test Tokens**. The three
    appear near the Hall.
    Verdict: ok / change: ___
14. **Pick up the Test Boat.** The sea is lit, the land dark. Drop it far
    inland on a dark cell: it flies back saying "Needs water."
    Verdict: ok / change: ___
15. **Pick up the Test Dock.** Only the strip of dry land touching the water
    is lit. Drop it on a dark cell far from the water: it flies back saying
    "Needs the shore."
    Verdict: ok / change: ___
16. **Pick up the Test Mineshaft.** The rock is lit; water and sand dark.
    Drop it in the sea: it is nudged onto the nearest rock, or flies back if
    none is within reach.
    Verdict: ok / change: ___
17. **Pick up an ordinary Token here.** Every dry cell lit, the sea dark
    (this Region has water, so the grid shows).
    Verdict: ok / change: ___
18. **Look and feel:** are the lit and dark cells readable, strong enough,
    not too strong? Your words feed the fix round.
    Verdict: ok / change: ___

## Your CMS step, later

In the Token editor's Lifecycle section, "Stands on" chips sit under
Landmark (Water, Shore, Grass, Rock, Sand). Once a Dock or Sailboat exists,
tick Shore or Water on it and Sync to Game. Candidates today: Coast and Shrimp
Coast (Shore?), Copper and Coal Mine (Rock?).

## Known and not for this look

- Tokens that need water or shore exist in code but not in content yet; the
  sea is only reachable through the dev buttons until you author Base Maps.
- Windows display scaling other than 100 % is untested (roadmap risk 8).
