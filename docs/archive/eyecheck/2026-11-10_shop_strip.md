# Eye-check 2026-11-10: Foundations back to the Shop, the Shop strip, rings at the mat's edge (brief 580)

**What to open:** `_builds/2026-11-10-shop-strip/Fantasy Guild.exe` in your project folder (double-click; nothing
to install). Built from branch `feat/shop-580` (all three parts, with `main`), not on `main` yet. It uses your normal
desktop save files.

**How to look:** at your usual maximised window and once smaller; with the menu on each side for 1 to 3.

1. **Buying with the strip.** Open the Shop and drag a Foundation card up onto the mat: the Shop drops to a thin
   strip on top of the hero bar (above the names and health bars). Move the card down onto the strip: the Shop rises
   again. Drop the Foundation on the mat: it is bought and the Shop rises as before. Verdict: ok / change: ___
2. **A refund.** Pick up a Foundation already on the mat (Shop open or closed): the strip appears. Drop it on the
   strip, or hover the strip so the Shop rises and drop it there: the Foundation is gone, its full price is back in
   the Bank, a coins sound plays and a bubble where it stood says what came back. With the Shop closed, the Shop
   closes again afterwards. Verdict: ok / change: ___
3. **While it is being built, and once built.** Send a hero to build on a Foundation, then refund it part-way: the
   full price comes back and the hero is free (the build had taken nothing yet). A built Token shows no strip and
   is never refunded; dropped over the open Shop it lands on the mat underneath, as before. Verdict: ok / change: ___
4. **Rings at the mat's edge.** Hover or carry a camp or Foundation near an edge and a corner: the ring and its dots
   stop at the mat's edge and follow its rounded corner. Verdict: ok / change: ___
5. **Words to edit.** The strip's line ("Drop here to hand it back for its price") is a draft: say if you want it
   changed. Verdict: ok / change: ___

**After the look:** tell the director "ok" or your changes. On ok it merges to `main` (after the night's engine and
drag checks); no CMS steps.

## Owner's first look, 2026-11-10

Functions fine; no separate strip: the drawer itself only lowers to the top of the hero bar. Built (16191b62): the
lowered Shop's top edge sits at the top of the bar's names and HP bars, the bar in front; hovering that edge raises
it; dropping a Foundation there refunds it. Strip wording removed (check 5 falls away).

**Second look:** `_builds/2026-11-10-shop-lowered/Fantasy Guild.exe`, checks 1 to 4 again with "the lowered Shop"
in place of "the strip". Verdict: change: good, a little lower, just showing the header (owner, 2026-11-10).

**Third look:** `_builds/2026-11-11-shop-header/Fantasy Guild.exe` (a618a703): lowered, only the Shop's header row shows
at the screen's bottom edge, the heroes standing over it; hover that row to raise the Shop, drop a Foundation on it to
refund. Verdict: ok / change: ___
