# Brief 150 — Notifications

**Source of truth:** [`concept_notifications.md`](../concept_notifications.md)
(approved 2026-10-14, revised by the owner 2026-10-19: item stubs and
banners, no log). Ticket **T-168**, with T-028 and T-037.

**Needs:** brief 100; brief 140's level-up moment (level-ups stay on the
hero). Hover outlines: gold for attention, red for problems (UI_STYLE).

**Branch:** `crunch/notifications`. **Tier:** builder. **Eye-check:** yes.

## N1 — The store and the routing

- **Change:** one store for item stubs (one per item, net flow merged in the
  store, never per render; `ItemRateTracker` also records spending so gained,
  spent and the net per hour exist; a stub fades ~5 min after its item last
  changed; pins as live trackers since pinning, with reset) and for banners
  (up to three shown, the rest counted, problems first, same-kind merge). Pins
  saved (schema entry and a load test). Route every event as the concept's
  audit table says (owner, 2026-10-19), including the new hooks: recipe
  unlocked (first guild-wide, grouped per level-up), first item found, bank
  full and items lost. Refusals move to the mat's callouts. No log (T-193).
- **Done when:** unit tests cover merging, the net, fading, pins, save/load,
  the banner queue and the routing table.

## N2 — Item stubs on screen

- **Change:** the column at the top right under the top bar as the concept's
  "Item stubs" draws it: amount then sprite in a chamfer frame, green gain,
  red loss; scrolls with the arrow bars, pinned stubs held at the top; Clear
  all on top; hover expands left over the mat (name, gained/spent, net per
  hour, pin, reset on a pinned stub), only those icons clickable; first find
  in a gold shine frame led by "New!". The Settings Notifications tab (one
  stub switch, the position setting removed). The edge sidebar goes.
- **Measure:** `bench:draw --compare` on a loot-heavy save; cost-log line. No
  backdrop blur.
- **Done when:** a busy minute of loot with a station spending (one stub per
  item, net colour right), a first find, scrolling past a pinned stub, Clear
  all, and a pin surviving save and reload, all seen in the running game.

## N3 — Banners on screen

- **Change:** the ribbon at the top centre below the top bar (sprite, title,
  one line; gold or red studded frame; placeholder frame until the owner's
  art); slides down with one overshoot, shine pass on milestones, a sound cue
  each; stays until clicked, a click dismisses; up to three stacked newest on
  top, then "+N"; hovering outlines its hero or Token.
- **Done when:** a recipe-unlocking level-up (one grouped banner), a knock-out
  (red, ahead of a waiting milestone) and four banners at once ("+1") seen in
  the running game.

## Owner to-do

- Eye-check; draw the banner ribbon (style kit frame until then, on the art
  list).
