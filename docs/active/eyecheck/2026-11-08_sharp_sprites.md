# Eye-check 2026-11-08: sharp sprites (brief 550)

**What to open:** `_builds/2026-11-08-sharp/Fantasy Guild.exe` in your project folder (double-click; nothing to
install). It is the desktop app built from branch `fix/sprite-sharpness`, which is not on `main` yet. It uses your
normal desktop save files: load any slot you are happy to play.

**How to look:** do every check twice, once with the window small (about half the screen) and once maximised.
Lean in close or use Windows' Magnifier (Windows key and +) to see the pixels.

1. **Hovering a hero.** Move the mouse over a hero on the mat, then away, a few times. Every Token around it
   (trees, rocks, buildings) stays sharp the whole time; the hero's spot flag still fades in and out as before.
   Verdict: ok / change: ___
2. **A hero turning.** Send a hero somewhere behind them so they turn around. They face the new way at once,
   with no squeeze, and stay sharp. Verdict: ok / change: ___
3. **A walking hero.** Watch a hero walk across the mat, and a hero with a speech bubble walking. The hero and
   the bubble stay sharp while moving; the walk looks as smooth as before. Verdict: ok / change: ___
4. **A working hero.** Watch a hero chopping or mining for a few cycles. Hero and Token stay sharp.
   Verdict: ok / change: ___
5. **A floating item.** Find an item lying on the mat (loot). It bobs up and down in small steps, keeps one shape
   all the way, and its shadow stays still on the ground under it. Verdict: ok / change: ___
6. **Reduced motion.** Windows Settings, Accessibility, Visual effects, turn Animation effects off, then restart
   the app. A floating item is held a little above its shadow, still and sharp. Turn Animation effects back on
   after. Verdict: ok / change: ___

**After the look:** tell the director "ok" or your changes. On ok the branch merges to `main`; no CMS steps.
