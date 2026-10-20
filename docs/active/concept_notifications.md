Status: briefed 2026-10-14, revised 2026-10-19 (owner interviews; brief 150)

# Notifications: item stubs and banners

*From the owner's refinement pass ([refinement_pass_todo.md](refinement_pass_todo.md)
§2, "Notification System Overhaul"). First interview 2026-10-13; **revised by
the owner 2026-10-19** (four rounds): toasts are for items only, a banner for
what must not be missed, and **no log for now** (a later ticket, T-193).
Replaces the edge sidebar (`PopOutSidebars.jsx`, `ToastContainer.jsx`) and
the 2026-10-08 sidebar notes in [design_pass_notes.md](design_pass_notes.md).
The look follows [UI_STYLE.md](../reference/UI_STYLE.md). Build ticket:
**T-168**.*

## Three places, by weight

- **Item stubs** (the toasts), top right: items gained and spent, nothing
  else.
- **Banners**, top centre: things the player must not miss.
- **On the mat, not a notification**: level-ups show on the hero (the
  level-up moment) and in the hero's speech; a refused action ("Can't place
  that there", "Could not equip that") is a callout over the thing involved,
  in the mat's existing callout style (`callouts.js`), never a toast.
- **The edge sidebar goes**, and the mat gets its full width. There is **no
  log button**.

## Where every event goes (owner audit, 2026-10-19)

| Event | Goes to |
|---|---|
| Items gained, items spent | Item stub (one per item, net flow) |
| First time an item is found | Item stub in a gold frame, led by "New!" |
| Skill or combat level-up | The hero: the level-up moment and speech |
| New recipe unlocked | Banner (gold) |
| New hero, promotion, guild upgrade | Banner (gold) |
| Hero knocked out, bank full and items lost | Banner (red) |
| Damaged save restored, a load failed | Banner (red) once the game is up; on the slot screen a plain message there |
| Refused drop, can't equip, can't resize | Callout on the mat |
| New enemy seen, a quest appearing or ready to hand in | No notification (owner: no clutter); quest boards (brief 170) mark their own board |
| A Token's problem (stuck, no input) | Its problem mark only |
| A Token used up, a hero gone idle | Hero speech, as today |
| Hero recovers, combat won, status effects, Shop purchases | Nothing |
| New game started, slot deleted | A plain message on the slot screen |

**A new recipe unlocked** fires the first time anyone in the guild can run
it, for any recipe in the skill (even a station the player doesn't own yet).
One level-up that unlocks several gives one banner ("Aela unlocked 3 recipes:
Cider, Apple Pie, ..."). No event exists for it today: derive it from the
level-up.

## Item stubs (owner, 2026-10-19; revised after the first eye-check)

- **At rest**: the **amount, then the item sprite** (`+12 [oak]`), in a small
  **chamfer pixel frame**, the sprite at **2× (64 px, the size of floating
  loot on the mat)**. Stubs sit **flush against the screen's right edge**
  (no gap, no frame edge on that side), stacked down from under the top bar.
  A new stub **slides out of the side**; a fading one slides back in.
- **One stub per item, always**, showing the **net flow** whatever its
  sources: a station eating Oak while woodcutters bring it in shows one Oak
  stub. Its job is to show the overall flow, so a resource draining fast is
  plain to see. **Green `+` when the net is a gain, red `-` when a loss.**
  The amount counts the net **since the stub appeared** (or was reset).
- **Hover: the same box grows left over the mat into one line**, never a
  second box: **amount, sprite, name, rate** (`+12 [oak] Oak Log +80/hr`);
  the amount and sprite slide left as it opens. No gained/spent text. The
  rate is the net per hour (today's 5-minute rolling rate, `ItemRateTracker`
  with spending recorded). Nothing else in the column moves.
- **Left-click pins or unpins.** Pinned stubs sit at the top of the column
  under a **"Pinned" group header**; no pin icon anywhere. A pinned stub is a
  live tracker and never fades. **Pins are saved with the game.**
- **Right-click clears**: on an unpinned stub it removes it (the next flow
  of that item starts a fresh stub at +0); on a pinned stub it resets the
  count to +0 and it stays pinned.
- **Lifetime**: a stub stays while its item keeps flowing and **fades about
  5 minutes after the item last changed**.
- **The column**: shows as many stubs as fit on screen and **scrolls** for the
  rest (brief 100's arrow-bar list); pinned stubs stay in view at the top
  while the rest scroll. A **Clear all** button sits at the top of the column
  and removes every unpinned stub.
- **First find**: the frame turns shiny gold (the button shine) and gold
  **"New!" leads the stub** (`New! +1 [copper]`).
- **Settings, Notifications tab**: one switch for item stubs. The six-corner
  **Notification Position** setting goes (it does nothing today).

## Banners

- **Shape**: a wide scroll or ribbon (~480 px), **dropping down at the top
  centre from below the top bar** over the mat: a big sprite on the left (the
  recipe's output, the hero's face, the upgrade's icon), a large title ("New
  Recipe!") and one line of detail ("Aela unlocked Cider, Apple Pie"). A
  studded pixel frame with a **gold edge for milestones, red for problems**;
  the owner draws the ribbon art later, the style kit's frame until then.
- **Motion**: slides down from behind the top bar with one small overshoot;
  a milestone gets one pass of the shine across it, a problem doesn't; a
  sound cue each (a chime, a warning tone) from the existing audio. It slides
  back up behind the bar when dismissed.
- **Every banner stays until clicked**, and **a click only dismisses it**.
- **Several at once**: up to **three** stack under the top bar, newest on
  top; past three a **"+N"** tab shows how many more wait. Problems go ahead
  of waiting milestones, and same-kind banners waiting merge into one ("Aela
  and Bram knocked out").
- **Hovering a banner about a hero or a Token** gives it the attention
  outline on the mat (gold; red for a problem).

## Later: the log (T-193, low priority)

The owner is not attached to a log; build it only if it proves needed. If it
comes: it opens as a modal; rows are **plain text like the stubs, no sprite**
(`+120 Oak Log`); a "new" **dot, no count**, wherever its button goes.

## Notes for the director

- One build (T-168), builder tier: stubs, banners, the routing, settings.
  Pins need a schema entry and a load test.
- Merging per item must stay cheap on a busy mat: merge in the store, not per
  render. Each toast is a composited layer: no backdrop blur (UI_STYLE frames
  are solid anyway). Measure with `bench:draw --compare` on a loot-heavy
  save; cost-log line.
- Banner events need hooks the game lacks today: recipe unlock (derived from
  the level-up), bank full and items lost (`INVENTORY_OVERFLOW`).
- Changes the look: owner eye-check.
