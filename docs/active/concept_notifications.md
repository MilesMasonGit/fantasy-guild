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

## What pops out

The log records everything. Toasts pop out for four kinds:

| Kind | Example | Notes |
|---|---|---|
| **Loot** | `[oak] +12` | Merged per item: a showing toast for the same item updates its count and restarts its timer. |
| **Level-ups** | `[Aela] 20 Mining!` | |
| **Discoveries** | `[wolf] New: Wolf` | New enemy, first item found, new recipe. |
| **Problems** | `[Aela] Knocked out` | Red edge. Slides back like the rest; the log and badge catch it. |

- **At most 3 toasts on screen**; extra ones go straight into the log and the
  badge.
- **Items spent** (recipes, upkeep) are logged as muted `-10 Oak Log` rows,
  never as toasts.

## A toast's look

- **One line: a 16 px sprite and a few words**, in a chamfer pixel frame with
  a **coloured left edge by kind** (T-028).
- **Hovering a toast expands it** with the details.
- **Hovering a toast or log row about a hero or a Token gives that hero or
  Token a gold alert outline** on the mat, so the player can find it.

## The log

- **Newest first.** **Tabs**: All / Loot / Heroes / Problems (UI_STYLE tabs);
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
- **Hidden**: nothing on screen but the button and its badge.

## Muting and Settings

- **Mute a kind from a toast**: a small menu on a toast ("Stop popping out
  Loot"), the same switch as in Settings.
- **Settings, Notifications tab**: one pop-out toggle per kind (Loot,
  Level-ups, Discoveries, Problems); the log always records. The six-corner
  **Notification Position** setting goes (it does nothing today).

## Notes for the director

- One build (T-168), builder tier: the button, toasts, log, pins, modes,
  settings. Save fields for pins and mode need a schema entry and a load test.
- Loot merging must stay cheap on a busy mat: merge in the store, not per
  render. The sidebar's comment already warns that each toast is a composited
  layer: no backdrop blur (UI_STYLE frames are solid anyway). Measure with
  `bench:draw --compare` on a loot-heavy save; cost-log line.
- The hover outline uses the same gold alert outline as T-153.
- Changes the look: owner eye-check.
