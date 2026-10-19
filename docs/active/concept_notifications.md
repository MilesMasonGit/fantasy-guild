Status: briefed 2026-10-14 (approved 2026-10-14; brief 150)

# Notifications: the log button, pop-out toasts and pins

*From the owner's refinement pass ([refinement_pass_todo.md](refinement_pass_todo.md)
§2, "Notification System Overhaul"). Owner interview, 2026-10-13, three rounds;
**done** (owner closed it). Replaces the edge sidebar (`PopOutSidebars.jsx`,
`ToastContainer.jsx`) and the 2026-10-08 sidebar notes in
[design_pass_notes.md](design_pass_notes.md). The look follows
[UI_STYLE.md](../reference/UI_STYLE.md). Build ticket: **T-168**.*

## The pieces

- **A log button at the top right** of the screen: a notepad or scroll sprite
  (the owner draws it; placeholder until then) with an **unread count** pill.
- **Pop-out toasts** slide **out of the button**, stack downwards just under
  it, hang **~2 s** (longer while hovered), then **slide back into the
  button**, which bumps its unread count.
- **The log**: a drop-down panel from the button.
- **The edge sidebar goes**, and the mat gets its full width.

## Three places, by weight (owner, 2026-10-19)

- **Toasts are for items only**: items gained and items spent. They keep
  today's loot toast behaviour (gains and losses merged per item, the per-hour
  rate from `ItemRateTracker`), restyled and moved to slide out of the log
  button. **The first time an item is ever found** its toast gets a shiny gold
  border and a "New!" beside it.
- **The banner** (major notifications): larger and fancier, at the **top
  centre, dropping down over the mat from below the top bar**. For things the
  player must not miss: a **new recipe unlocked**, a **new hero**, a
  **promotion**, a **guild upgrade**, and problems: a **hero knocked out**,
  **the bank full and items lost**, **a damaged save restored**. About 4 s
  (longer while hovered), one at a time (more queue), and **clicking it
  opens what it is about** (the recipe list, the hero's panel, the Guild
  Hall). Problems use the same banner with a red edge; milestones a gold one.
- **On the mat, not a notification**: level-ups show on the hero (the
  level-up moment) and in the hero's speech; a refused action ("Can't place
  that there", "Could not equip that") is a speech bubble or callout over the
  thing involved.

**A new recipe unlocked** fires the first time anyone in the guild can run
it, for any recipe in the skill (even a station the player doesn't own yet).
One level-up that unlocks several gives one banner ("Aela unlocked 3 recipes:
Cider, ..."). No event exists for it today: derive it from the level-up.

## Where every event goes (owner audit, 2026-10-19)

| Event | Goes to |
|---|---|
| Items gained, items spent | Toast (one per item, net flow), log |
| First time an item is found | Toast with the gold border and "New!", log |
| Skill or combat level-up | The hero (moment and speech), log row (Heroes tab) |
| New recipe unlocked | Banner, log |
| New hero, promotion, guild upgrade | Banner, log |
| Hero knocked out, bank full and items lost | Banner (red edge), log (Problems tab) |
| Damaged save restored, a load failed | Banner (red edge) once the game is up; on the slot screen a plain message there |
| Refused drop, can't equip, can't resize | Speech bubble or callout on the mat; not logged |
| New enemy seen, a quest appearing or ready to hand in | No notification (owner: no clutter); quest boards (brief 170) mark their own board |
| A Token's problem (stuck, no input) | Its problem mark only |
| A Token used up, a hero gone idle | Hero speech, as today |
| Hero recovers, combat won, status effects, Shop purchases | Nothing |
| New game started, slot deleted | A plain message on the slot screen |

- **At most 3 toasts on screen**; extra ones go straight into the log and the
  badge.

## A toast's look (owner interview, 2026-10-19)

- **The stub, at rest**: the **amount, then the item sprite** (`+12 [oak]`),
  in a small **chamfer pixel frame**. Stubs stack in a narrow column under the
  log button, one width, numbers right-aligned against their sprites.
- **One stub per item, always**, showing the **net flow** whatever its
  sources: a station eating Oak while woodcutters bring it in shows one Oak
  stub. Its job is to show the overall flow, so a resource draining fast is
  plain to see. **Green `+` when the net is a gain, red `-` when a loss.**
- **Hover expands it out to the left over the mat**; nothing else moves, so
  the mouse can run down the column reading each in turn. The panel, in the
  same frame, shows: the **item name**; **`+120 gained  -40 spent`** over the
  recent window; the **net rate `+80 / hr`** (today's 5-minute rolling rate,
  `ItemRateTracker`, extended to record spending). Hovering holds the stub
  out.
- **Clicking does nothing** except the **pin icon** in the panel's corner,
  which pins it as a live tracker. A stray click while working the mat is
  harmless.
- **First find**: the frame turns shiny gold (the button shine) and gold
  **"New!" leads the stub** (`New! +1 [copper]`); it stays out ~4 s.

## The log

- **What it holds**: loot rows, level-ups and every banner. **Newest
  first.** **Tabs**: All / Loot / Heroes / Problems (UI_STYLE tabs);
  arrow-bar scrolling.
- **Loot merges per item per minute** (`+120 Oak Log` for a busy minute);
  events are their own rows. About the last 200 rows are kept. **No times**
  on rows.
- **While the log is open**, nothing pops out: new rows slide in at the top
  with a brief highlight.
- The log is **session only**, apart from the pins.
- **Clear log**: empties it; pinned rows stay.

## Pins

- **Pin any toast or log row** (a pin icon on hover). A pinned item **stays on
  screen under the button** and **sorts to the top of the log** until
  unpinned.
- **A pinned loot row is a live tracker**: it keeps counting (`+340 Oak
  Log`), and **clicking its count resets it** to +0, for measuring a setup's
  output.
- **Pins and the display mode are saved with the game.**

## Display modes

A small three-way control **in the log's header** (owner, 2026-10-14):

- **All**: pinned items stay out, new toasts pop out.
- **Pinned only**: pinned items stay out, no new pop-outs; the log still
  records.
- **Hidden**: nothing on screen but the button and its badge. Banners still
  drop: they are the ones not to miss.

## Muting and Settings

- **Settings, Notifications tab**: one switch for item pop-outs (the display
  mode in the log's header does the rest); the log always records, and
  banners always show. No mute menu on a toast: only its pin is clickable.
- **Hovering a log row or banner about a hero or a Token** gives it the gold
  attention outline on the mat (problems: red). The six-corner
  **Notification Position** setting goes (it does nothing today).

## Notes for the director

- One build (T-168), builder tier: the button, toasts, log, pins, modes,
  settings. Save fields for pins and mode need a schema entry and a load test.
- Loot merging must stay cheap on a busy mat: merge in the store, not per
  render. The sidebar's comment already warns that each toast is a composited
  layer: no backdrop blur (UI_STYLE frames are solid anyway). Measure with
  `bench:draw --compare` on a loot-heavy save; cost-log line.
- Banner events need hooks the game lacks today: recipe unlock (derived from
  the level-up), bank full and items lost (`INVENTORY_OVERFLOW`).
- Changes the look: owner eye-check.
