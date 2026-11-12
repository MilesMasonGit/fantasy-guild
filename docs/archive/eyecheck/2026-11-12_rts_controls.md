# Eye-check 2026-11-12: select and right-click, RTS-style controls (brief 610)

**Owner verdict, 2026-11-12: accepted, all checks.** Rebuilt after the first look (no line or ghost while selected, a click again deselects; checks revised on the Guild Eye-checks page). Merged to main 109ab4e4.

**What to open:** `_builds/2026-11-12-rts-controls/Fantasy Guild.exe` in your project folder (double-click; nothing to
install). Built from branch `feat/rts-controls`, not on `main` yet. It uses your normal desktop save files.

⚠️ Starter Tokens (trees, veins, bushes, the forest) are fixed, so they can't be selected or moved. For checks 6 to 8
use a Token you placed (one from the Shop), the Guild Hall, or an enemy.

Screenshots from the builders: `.claude/worktrees/rt/docs/active/eyecheck_shots/`.

1. **Select a hero.** Click a hero on the mat: a gold outline on them and on their hero bar card, and their job lights
   up. Click a hero on the hero bar: the same. Verdict: ok / change: ___
2. **Double-click inspects.** Double-click a Token: its card opens (it is selected too, if it can move). Double-click
   a hero on the mat or the bar: the Hero drawer opens. A single click no longer opens either. With a card or drawer
   open, a single click on something else closes it and selects the new one. Verdict: ok / change: ___
3. **Clearing.** The selection goes on a click on blank mat, Escape (after any open panel), the World Map, the Guild
   Hall screen and Demolish. Opening the Bank keeps it. Verdict: ok / change: ___
4. **Right-click orders.** With a hero selected, right-click a vein or tree, an enemy, bare ground and the Guild Hall:
   each gives exactly the order a drop there would (work, fight, wait with the flag, go home). Right-click a Token they
   can't work: the same red refusal as a drop ("Needs Pickaxe"). While a hero is selected, workable Tokens glow and the
   dashed gold line follows the pointer. Verdict: ok / change: ___
5. **Stopping.** Right-click the Token a hero is working (or the enemy they fight), or the selected hero themselves:
   they stop where they stand with the yellow "needs a job" mark, and the hint marks clear at once. With nothing
   selected, right-click a working hero or their Token: they stop too. Right-click no longer sends a hero home
   (right-click the Guild Hall instead, or drag). Verdict: ok / change: ___
6. **Moving a Token.** Select a Token you placed and right-click a free spot: it hops there in a short arc like flying
   loot and lands with a small bounce; a hero working it walks after it. Right-click a spot with no room: the drag's
   refusal, and it stays. Verdict: ok / change: ___
7. **Ghost and ring while a Token is selected.** The Token's ghost follows the pointer over the mat, with its reach
   ring and the cream dots on what it would reach. The builder flags that the full ghost may feel heavy just for having
   something selected: say if it should be lighter (fainter, or only the ring). Verdict: ok / change: ___
8. **Enemies.** Click an enemy: gold outline. Right-click a spot: it hops there. A selected enemy gives no hero orders.
   Verdict: ok / change: ___
9. **Drag still works.** With a hero or a Token selected, drag and drop heroes and Tokens as before; the selection
   stays. Verdict: ok / change: ___

**After the look:** your verdicts go here, fixes go on the branch, then it merges. No CMS steps.
