# Eye-check 2026-11-10: the reach ring, cream dots and floating Foundations (brief 560 R2)

**What to open:** `_builds/2026-11-10-reach-dots/Fantasy Guild.exe` in your project folder (double-click; nothing to
install). Built from branch `feat/reach-dots`, not on `main` yet. It uses your normal desktop save files. One
standard reach (every camp works out to 240) is already on `main` and in this build.

**How to look:** at your usual maximised window, and once with a smaller window.

1. **Buying a Foundation.** Drag a Foundation from the Shop onto the mat. While you carry it, the gold pixel ring
   follows it, and every Token inside the ring wears a small cream dot in its centre. Tokens just outside get none.
   The carried Foundation floats. Verdict: ok / change: ___
2. **Moving and hovering.** Move a placed Foundation, then a Logging Camp: ring and dots follow. Hover one without
   dragging: the same ring and dots. After you drop a camp, it works exactly the trees that were dotted.
   Verdict: ok / change: ___
3. **Support stations.** Carry or hover a support (a Minecart, a Well): ring and dots. Dots go on every Token in the
   ring, as ruled, including ones the support does not boost. Verdict: ok / change: ___
4. **Floating.** An unbuilt Foundation bobs gently like loot on the floor, its shadow staying on the ground; once
   built, the Token rests. Verdict: ok / change: ___
5. **Questions** (answer with a letter):
   - **One ring look.** A support or tool hovered used to show a dashed amber circle; now every reach ring is the
     same gold pixel ring. A) keep one look (recommended), B) bring the dashed amber back for supports.
   - **Hovering a hero whose job is a camp** lights that camp's ring without dots. A) leave it so (recommended:
     dots only while the camp itself is hovered or carried), B) show the dots there too.
   Verdict: ok / change: ___

**After the look:** tell the director "ok" or your changes. On ok it merges to `main`.

**CMS steps (separate, any time, on `main`):** delete the four Camp Reach stars (Forestry, Mining, Fishing,
Farming Camp Reach) in the CMS, then Sync to Game.

## Owner's verdict, 2026-11-10

All ok ("This is good, and we're able to merge"); questions answered by taking the recommendations: one ring look
(A), no dots on a hero-lit camp ring (A). Follow-up asked for: rings end at the mat's edge (brief 580 S3). Camp
Reach stars deleted and Synced. Merged to `main` 6fae5813.
