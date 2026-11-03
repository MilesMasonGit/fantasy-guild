# Brief 340 — Detail pass: the hero bar and hero sheet

*Written 2026-11-02 by the planning agent from the owner's walkthrough of the
same day. Concept: [concept_detail_pass.md](../concept_detail_pass.md), "3. Hero
bar and hero sheet": read its list first; the item numbers below are that
list's, and the owner's wish is what counts.*

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, `docs/reference/UI_STYLE.md` (the icon
rule, HP, speech, pixel frames), GDD §9 and §14 (nothing may break the
Performance Envelope), `docs/active/ui_rework_list.md` ("Hero bar and hero
panel", locked).

Code to start from (verify; nobody has seen this section in the running game
for this brief, the planning agent's check could not load it):
`src/ui/components/dock/` (`BottomHeroDock.jsx`, `DockHeroFigure.jsx`,
`HeroDockTab.jsx`, `BankHeroPanel.jsx`, `DockEquipmentGrid.jsx`,
`dockHeroView.js`), `src/ui/components/drawer/HeroInspectionSheet.jsx`,
`src/ui/dnd/DragGhost.jsx`, `src/ui/components/board/flagText.js`,
`src/ui/components/base/ArrowScrollList.jsx`, `src/utils/AssetManager.js`.

## Phases

Run in order: H1 to H3 share `DockHeroFigure.jsx` and the sheet. H4 may run
beside them if it stays out of those files.

| Phase | What | Tier |
|---|---|---|
| H1 | **The bottom bar and sending a hero out** (items 12, 13, 14). Dragging a hero from the bar starts the same flag drag as moving a hero on the mat: `FlagGhost`, not the 128 px `HeroGhost`, with the same snapping and order line. The Bank's hero column and the sheet's large figure do the same. Dragging one hero onto another on the bar still reorders them, so that drag must remain readable. Heroes slightly more spaced out; names a little larger (the owner tunes both at the look). Run the drag bench: this is drag code. | builder |
| H2 | **HP, status, alerts, flag** (items 1, 2, 3, 4). **HP**: numbers over a stylized pixel bar, on the bar and the sheet; show two or three looks in the running game for the owner to pick. Heroes only: enemies and mat fighters keep their bars. **Status**: the word under the name goes; on hover, a speech bubble in the game's pixel speech style names the exact task. `flagStatusLine` is the starting point; check it names the Token and improve it if it only says Busy. **Alerts**: where the flag stands today, a yellow alert for an idle hero (no job or waiting) and a red alert for a wounded one, without hovering (`u_alert_yellow`, `u_alert_red`); the red replaces the text cross. **Flag**: moves to the hero's other side. ⚠️ The hover bubble must not fight the level-up bubbles over the same hero (they stay as they are: the owner looked and is happy); say what you did. ⚠️ Bubbles are already the largest drawing cost per hero (T-198): the status bubble exists only while hovered. | builder |
| H3 | **The hero sheet and the Bank's column** (items 4, 5, 6, 7, 8, 9, and T-297). **First T-297**: with names moving to the tip, the icon alone identifies a skill, so no emoji may be left. **Skills** two side by side: icon, level, XP bar; the name joins the hover tip, with what the skill is for and its perks; a click still opens the exact numbers, across both columns. **Scrolling**: our arrow buttons at top and bottom (`ArrowScrollList`), no scroll bar. **Close and edit** move to the side space beside the sheet where the hero column stands, in the same spot with the Bank open or closed. **Flag** on the sheet: the other side, behind the hero. **The Bank's vertical column**: larger portraits, and the name "in a more stylized way"; show two or three looks for the owner to pick (nice to have: stop at the portraits if the name is costly and say so). | builder |
| H4 | **Moving items in the loadout** (items 10, 11). The owner wants to drag an item between slots on one hero and from one hero to another. ⚠️ **The code already looks like it allows this** (`EquipSlotCell` carries `fromHeroId` and `fromSlot`; the bar's figures accept items): **reproduce first in the running game and find out what stops it**. Dropping onto a slot moves or swaps the items; dropping onto another hero in the column or the bar lands in their first empty slot; a full loadout refuses with a reason and the item stays. If it already works, report that and how the owner might have missed it rather than building anything. | builder |

## Done when

- Gate green (`TESTING.md`); engine work **same** (this brief changes nothing in
  the engine; report it if a phase does).
- The list's 14 items each exercised in the running game, with what was verified
  named. Include: dragging from the bar, the column and the sheet shows only the
  flag; a reorder on the bar still works; a wounded and an idle hero show their
  alerts with nothing hovered; an item moves between slots and between heroes.
- `bench:draw --compare` once for the eye-check batch, for the cost log; the drag
  bench once for H1.
- GDD §9 and `UI_STYLE.md` updated where they describe what changed. Tickets
  closed: T-297.
- **One eye-check after H4**, with the looks to pick for HP and the column's names
  and the spacing and name size to tune. The owner sees all 14 items together.

## Not in this brief

T-293 (top bar buttons and start screen icons) is not part of this section and
may run any time. The gear slot icons moving to Lucide (icon rule) wait for the
Bank's section unless the builder is in that code anyway. The edit window and
the recolour system: looked at, no change.

## Owner to-do

No CMS work. Art when convenient: the skill icons on the
[art list](../owner_art_list.md), section 9.
