# Eye-check: the hero bar and sheet, Tokens and the Token card (5 Nov)

**Closed 2026-11-05.** The owner picked from screenshots ([looks_2026-11-05](looks_2026-11-05/index.html)) instead of the QA switches: smooth HP bar (A), dark name plate under Bank column names (A), card B with the art behind everything and arrows only when there is more to scroll, 30 % spacing, hover lift off. Defaults kept where unanswered: yellow alert for parked heroes or heroes at the Hall; a worked Token still rises above resting ones; the crowded Forest is T-308 (a). Then the spacing cost: kept 30 %, spawners follow the bus rule. Merged at 495986ce. The line verdicts below are superseded.

**Where:** the owner's folder is already on `crunch/hero-detail`, and the game runs at the address the director gave. If you need to get back to it yourself:

```bash
git switch crunch/hero-detail
```

**Save slot:** start a **new game** in any empty slot. Old saves may sit closer than the new spacing, which needs no fixing.

**The QA panel:** the QA button at the edge of the screen. The looks below live there, and they exist only while you choose.

Write in each `Verdict` line: `ok`, or `change:` and what you'd like.

## The hero bar

Open the QA panel, **Orders**, and click **Hero bar alerts scene**. It hires six test heroes, one per case. They go away when you reload.

1. **Sending a hero out.** Drag a hero from the bar onto a Token. Only the flag is in your hand, with the same snapping and order line as on the mat.
   Verdict:
2. **Reordering.** Drag one hero onto another on the bar. A gold line shows which side they land, and there's no order line.
   Verdict:
3. **Spacing and names.** Heroes are a little further apart and names one size larger. Say if you'd like either changed.
   Verdict:
4. **Pick an HP look.** QA panel, **Hero HP bar look**: A plain plate, B ticks every tenth, C heart and bronze edge. It changes on the bar and the sheet.
   Pick A, B or C:
5. **Alerts with nothing hovered.** No Axe, No Wood and No Job show yellow. Hurt shows red. Worker and Waiter show nothing.
   Verdict:
6. **A parked hero.** A hero at the Hall with no order, or one you've deliberately parked on a spot, also shows yellow. Does that feel right?
   Verdict:
7. **Status on hover.** Hover each hero: a speech bubble names the exact task, such as `Working: QA Old Oak`. Click **Level up a hero**, then hover that hero: the status bubble sits on top of the level-up bubbles and covers neither.
   Verdict:
8. **The flag** stands on the hero's other shoulder.
   Verdict:

## The hero sheet and the Bank's column

Click a hero on the bar to open their sheet.

9. **Skills** sit two side by side, as icon, level and XP bar. Hover one for its name, purpose and perks. Click one for the exact numbers across both columns.
   Verdict:
10. **Skill icons.** No emoji anywhere. Seven skills without art share a plain pixel stone until you draw them. Say if the stone is fine as a stand-in.
    Verdict:
11. **Close and edit** are beside the sheet, in the same spot with the Bank open or shut. The sheet is a little narrower with the Bank shut, because of this.
    Verdict:
12. **The flag on the sheet** stands behind the hero.
    Verdict:
13. **Pick a name look for the Bank's column.** Open the Bank. Portraits are larger. QA panel, **Bank hero column names**: A stepped plate, B bronze ribbon, C outlined with no box.
    Pick A, B or C:
14. **A small window.** If you can, shrink the window below about 1540 px wide. Loadout items draw at half size (32 px, because 64 no longer fits), and levels read `25` instead of `25/99`. The hover still gives the full number.
    Verdict:

## Moving items

15. **Between slots.** On a hero's sheet, drag an item to another slot: it moves, or swaps with what's there.
    Verdict:
16. **Between heroes.** Drag an item from the sheet onto another hero on the bar or in the Bank's column: it lands in their first empty slot, and the sheet switches to that hero. Food and potions move too. A full loadout refuses and says why.
    Verdict:
17. **A tool in use.** Hand away the tool a hero is working with: they stop, keep their flag and show yellow.
    Verdict:

## Tokens on the mat

Start a new game or reload, so the test heroes are gone. Open **Mat dials**, **Crowding** in the QA panel.

18. **Heroes on top.** Heroes always draw over Tokens, whether they stand above or below them on the mat.
    Verdict:
19. **The one jump left.** A Token with a hero working it still rises above resting Tokens. Keep it, or should it go too?
    Verdict:
20. **Hover.** Pointing at a Token no longer lifts it; only its name and gear come up. **Hover lifts a Token** turns the lift back on, so you can compare.
    Verdict:
21. **Pick the spacing.** Tokens sit 81 units apart, up from 70 (**Overlap allowed**: 30 %, was 40 %). ⚠️ The slider only affects Tokens you place after moving it, not those already down or newly generated places.
    Pick a number:

## The Token card

22. **Pick a layout.** QA panel, **Token card look**: A art strip on top, B art behind everything, C art column at the side. Picking one closes any open card. Then click a tree, a vein, a station with recipes and an enemy.
    Pick A, B or C:
23. **The card reads well.** The name is a header, with a stat block, then sections for Requires, Makes, Events and Boosted by. Empty sections are left out. Say if it still feels cluttered: item ribbons are the next thing to shrink.
    Verdict:
24. **The name's size.** It stays at title size, because the style rules allow only three text sizes. The band makes it a header. Bigger?
    Verdict:
25. **Arrows.** A card that fits shows none. On a long list, an arrow at the end of the list dims rather than vanishing. Is that right, or should it vanish?
    Verdict:
26. **Fishing.** QA panel, **Fishing**: set up the scene and click a water Token. With a hero on it, it says what that hero catches with their gear. Everything else sits in closed lists by tool.
    Verdict:

## One decision: a very crowded Forest

With Tokens further apart, a Forest now plants its saplings with the room the grown tree needs. That fixed trees drifting out of reach in every normal test. But with 7 or more other Tokens packed around a Forest there's often no such spot, so it plants anyway. The tree then shifts out of reach and the Forest replants, about 12 to 20 seedlings in 10 minutes instead of 5, leaving stray trees and stumps that never regrow. Today's game has a milder form of this.

27. Choose one:
    - **(a) Leave it for now, with a ticket (recommended).** It takes heavy crowding around one Forest, and I have no measure of how often that happens in play.
    - **(b) The Forest waits until there's room.** That ends the runaway, but a crowded Forest plants fewer trees.
    - **(c) A smaller spacing.** Less crowded overall, but the cause stays, and I'd need to measure it.

    Choice:

## CMS

Nothing to do in the CMS.
