# Eye-check: Token placement (brief 180 G7)

**Where:** no branch switch; your folder stays on `main`. The placement branch
(built on the water work) runs from its own folder at **http://localhost:5195**.
Load or start any slot there.

Every check: **QA** (bottom right) → **Terrain (dev only)** → the new
**Placement** row (or the biome rows above it), press a button, close the QA
panel to see the mat. **Reroll it** rolls the same view with a new seed; try
three or four of each.

1. **Natural clumps** (Meadow + copper + camp + chest): groves of uneven sizes,
   stretched, tight in the middle and looser at the rim, a few lone stragglers
   between groves. One kind per grove.
   Verdict: ok / change: ___
2. **Rare kinds out at the edge**: a kind the map gives only one or two of (the
   maples in the meadow view) stands out towards the mat's edge.
   Verdict: ok / change: ___
3. **Berries by the water** (Lake island + camp + chest): berry bushes gather
   near the lake, river or pond.
   Verdict: ok / change: ___
4. **The camp** in the outer band, tucked into a grove that wraps the side
   facing the Hall (every Placement view).
   Verdict: ok / change: ___
5. **The chest**: on a lake's island when the island is big enough (Lake
   island view; reroll until it has a decent island), otherwise in a hidden
   spot among groves, away from the Hall.
   Verdict: ok / change: ___
6. **Mixed Regions** (biome row: Forest + Mountain): kinds still where they
   belong. I noticed berry bushes pulled to a small pond can crowd in among the
   ore; say if that bothers you.
   Verdict: ok / change: ___

## Questions (answer with the verdicts)

- **A: How the game knows a kind** (ore, bush, tree). A (recommended): from
  words in the Token's name for now, with a ticket for a CMS field later
  ("Grows near: water / rock / grass / none"). B: add the CMS field now (you
  fill it in per Token). C: names only, for good.
- **B: Islands for the chest.** A (recommended): lake and river islands (the
  split river's teardrop island counts). B: lakes only.
- **C: Ore leaning to rock** in another biome's ground keeps its own ground, so
  a little patch of its biome forms around it. A (recommended): keep. B: no
  leaning; only bushes go by water.
