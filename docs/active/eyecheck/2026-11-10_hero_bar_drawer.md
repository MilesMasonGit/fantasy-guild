# Eye-check 2026-11-10: the hero bar everywhere and the Hero drawer (brief 570 D1, D2)

**What to open:** `_builds/2026-11-10-hero-drawer/Fantasy Guild.exe` in your project folder (double-click; nothing
to install). Built from branch `feat/hero-drawer` (hero bar and Hero drawer together), not on `main` yet. It uses
your normal desktop save files.

**How to look:** at your usual maximised window, and once with a smaller window. Do 1 to 3 once with the menu on
each side (Settings, Menu on Right Side).

1. **The bar on every screen.** The hero bar shows on the mat, with the Bank open, with the Shop open, on the
   world map and on the Guild Hall, with no line along its top. With the Shop open, the Shop stands on the bar;
   at a small window about 300 px of mat stays visible: say if that is too little. Verdict: ok / change: ___
2. **Equipping from the Bank.** Drag an item from the Bank onto a hero on the bar: a bubble over the hero says
   "Equipped …". Drag something the hero cannot use: a red bubble says why. The Bank's old side tabs are gone.
   Verdict: ok / change: ___
3. **The Hero drawer.** Click a hero on the bar. A drawer rises from behind the bar: the hero at double size with
   name and health (flag behind the shoulder), the gear grid, and the Skills grid. Switch to Combat: style, hit,
   damage, swing, crit, resistances, cuts and gear effects. Hover a skill (tooltip), click it (its panel above the
   drawer with perks, earned ones gold). Equip something by dragging it onto the drawer's gear grid. Opening the
   Shop closes the drawer, and the other way round. Verdict: ok / change: ___
4. **Words to edit.** The skill lines in the skill panel are drafts: tell the director any you want changed (or
   edit them later in `src/i18n/en.json`, section `skillPurpose`). Verdict: ok / change: ___

**After the look:** tell the director "ok" or your changes. On ok the two merge to `main`; no CMS steps.
