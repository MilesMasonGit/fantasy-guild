# Eye-check 2026-11-12: effect badges on the Token card and in the Hero drawer (brief 600)

**Owner verdict, 2026-11-12: accepted, all checks.** Rebuilt with the QA panel so the Badge scene could be used. Merged to main 109ab4e4.

**What to open:** `_builds/2026-11-12-effect-badges/Fantasy Guild.exe` in your project folder (double-click; nothing to
install). Built from branch `feat/badge-card`, not on `main` yet. It uses your normal desktop save files.

**Set-up (once):** open the QA panel (the QA button, bottom right), section **Effect badges on the Token card**, click
**Badge scene** once. It places a QA Furnace with a smith working it, a Mine held at the Speed limit, a Goblin and a
Forge. Test Tokens go away on reload. Click Badge scene only once: a second click adds a second Forge and the numbers
double up.

The icons are placeholders (listed in your art list, section 3); judge the layout, numbers and hovers, not the
drawings.

1. **The badge grid.** Click the QA Furnace. Under the Level / XP / Time / Charges line: a stat block of chips, three
   to a row (Speed, XP, Preservation, Refresh, Lucky...), each an icon and a total, and last the smith's face.
   Verdict: ok / change: ___
2. **A badge's hover.** Hover the Speed chip: one line per source (Forge nearby +15 %, the Hall star +3 %, the smith's
   cap +5 %) and the total +23 %. Hover the smith's face: what the smith has that works here.
   Verdict: ok / change: ___
3. **Held at the limit.** Click the QA Mine: its Speed chip is gold, and the hover says how much of it counts
   (+80 % of +93 %). Verdict: ok / change: ___
4. **Item chips.** On the Furnace: a small Efficiency chip on the Copper Ore line under Requires (the count reads 9 a
   cycle, not 10), and a small Double Item chip on the Copper Ingot line under Makes. Hover each.
   Verdict: ok / change: ___
5. **Rare finds.** Under Drops: Rare finds 2.5 % in pale gold, with the Lucky chip on its heading. Click it: the finds
   open with their odds. Click again: they close. Verdict: ok / change: ___
6. **An enemy.** Click the QA Goblin: the chips sit under its combat line (Double Loot, XP), and Double Item on its
   Bones line. Verdict: ok / change: ___
7. **Boosted by is gone.** No card has the old "Boosted by" list any more. Click the QA Forge: its own "Boosts" list is
   still there. Verdict: ok / change: ___
8. **The Hero drawer.** Click the QA Badge Smith on the hero bar (this build has no RTS controls yet, so one click opens the drawer): in the drawer's slots, the arrows and the bread
   wear a small Preservation chip (31 % and 16 %); the quiver wears none. Hover the arrows' chip: the sources and the
   total. Verdict: ok / change: ___
9. **Live updates.** With the Furnace card open, drag another Forge from the Shop next to it: the Speed total rises
   within a second. Verdict: ok / change: ___

**After the look:** your verdicts go here, fixes go on the branch, then it merges. No CMS steps.
