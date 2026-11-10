# Eye-check 2026-11-10: the Item, World Map and Upgrade drawers (brief 570 D3, D4, D5)

**What to open:** `_builds/2026-11-10-drawers/Fantasy Guild.exe` in your project folder (double-click; nothing to
install). Built from branch `feat/drawers-570`: all five drawer pieces together (the hero bar and Hero drawer
from the first look are in it too, so this build can serve both looks). Not on `main` yet. It uses your normal
desktop save files. For materials to test the Hall, the QA panel's Guild Hall section has "Three ranks to buy at
once".

**How to look:** at your usual maximised window and once smaller; with the menu on each side for 1 and 2.

1. **The Item drawer.** Open the Bank: a drawer on the side away from the menu shows the clicked item (name, the
   book, its picture, count, tag pills, what it does, "Collected this run"). Hover a tag pill for its line. The mat
   no longer shifts when the Bank opens. Item tooltips no longer show the type or "Equippable" lines. There is no
   Use button yet (item Use was never built). Verdict: ok / change: ___
2. **The World Map drawer.** Open the world map and pick a place: the drawer shows its name (quill to rename), a
   small picture of its mat with `count/cap` in the corner, Water, Grass and Stone dials, and the time the guild has
   spent there (time away counts). Pick an unsettled cell: the dials show what settling will lay down.
   **Question:** on a rocky or sandy place, the middle dial counts all open land as "Grass". A) keep that,
   B) name it after the ground (Grass, Rock or Sand), C) count rocky ground as Stone. Verdict: ok / change: ___
3. **The Upgrade drawer.** Open the Guild Hall: no drawer at first, no Return button. Click a star: the drawer opens
   with a large grey icon, title, description and the rank list (Roman numerals turn into ordinary numbers on
   hover). Click a later rank: the button reads "Upgrade (+3 Ranks)", hovering it shows the total, and it buys
   them all at once (greyed with what is short when you can't afford it). Star titles never overlap (Archer's Lore
   now sits a little below Warrior's Lore). Verdict: ok / change: ___
4. **Words to edit.** The tag lines (in `src/i18n/en.json`, section `itemTags`) are drafts: tell the director any
   you want changed. Verdict: ok / change: ___

**After the look:** tell the director "ok" or your changes. On ok all five pieces merge to `main`; no CMS steps.

## Owner's verdicts, 2026-11-10

- 1 to 4: ok. World Map middle dial: A, keep "Grass" for all open land.
- Merged to `main` e042229c with the Hero drawer changes.
