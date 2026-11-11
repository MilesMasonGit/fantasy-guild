# Eye-check 2026-11-11: Limes on the Starter Camp, his bubble, the hover blurbs (brief 480 L3)

**What to open:** `_builds/2026-11-11-limes/Fantasy Guild.exe` in your project folder (double-click; nothing to
install). Built from branch `feat/limes-l3`, not on `main` yet. It uses your normal desktop save files; a **new game**
shows the most (Limes starts there with his lessons switch on). All words are placeholders: edit them freely, they
live in one file (`src/systems/quests/limesText.js`), or just write the new words here.

Screenshots of each, from the builder: `.claude/worktrees/l3/docs/active/research/limes_l3/`.

1. **New game screen.** A "Limes's lessons" switch sits in the footer, on by default (the lessons themselves come
   later; for now it only records your choice). Verdict: ok / change: ___
2. **Big Limes.** On the Starter Camp mat, bottom-left, about one Token wide, crisp, clear of the hero bar. Drag him
   anywhere on the mat; close and reopen the game: he is where you left him. Verdict: ok / change: ___
3. **Talk.** Click Limes: a green bubble with a lime gradient opens above him, words in dark ink, with Next and Close.
   Next steps through four lines; Close closes it. Verdict: ok / change: ___
4. **A Token under Limes.** Drag Limes onto a Token: clicks on the see-through parts around him reach the Token, and
   a hero dropped on him goes to the Token underneath. While anything is dragged, Limes lets it through.
   Verdict: ok / change: ___
5. **A step opening by itself** (what the lessons will use; nothing in the game triggers it yet, and its test buttons
   are in the dev version only, so judge it from the screenshots `02_step_opened_by_itself_hall_outlined_1366.jpg`
   and `03_step_collapsed_1366.jpg`). His bubble opens by itself and the Guild Hall Token gets a gold outline; Close
   folds it to a small green "…" bubble, and a click on the "…" (or Limes) opens it again. Verdict: ok / change: ___
6. **Hover blurbs.** A small green Limes in five places; hover each for a tip: the Bank's header, the Shop's header,
   the world map's top-left corner, the Guild Hall's top-left corner, the Hero drawer beside the quill. Placement
   to judge: the Hall one can sit near a star when the sky is panned; the world map one is on the map, not in its
   drawer (it squeezed the place name there). Verdict: ok / change: ___
7. **A screen's Limes carrying a step** (screenshot `08_hall_limes_carries_step_star_outlined_1366.jpg`): in the
   Guild Hall the small Limes glows with his bubble open and the Bunk Beds star is outlined in gold.
   Verdict: ok / change: ___
8. **Settings, Display tab: "Limes's Tips".** Off hides the small Limes on every screen (not the big one on the mat,
   and not one carrying a step). Verdict: ok / change: ___
9. **Elsewhere.** At any place other than the Starter Camp there is no Limes on the mat. Verdict: ok / change: ___

**Further blurb spots the builder suggests but did not add:** the Hall upgrade drawer, the Encyclopedia, the Token
card, the fight panel, the Shop's Foundation card. Say which you want: ___

**Owner, 2026-11-11:** ok to merge; the lessons and tutorials come later.

**After the look:** tell the director "ok" or your changes. On ok it merges to `main` after the engine check. No CMS
steps.
