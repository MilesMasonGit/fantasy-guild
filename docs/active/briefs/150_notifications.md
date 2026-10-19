# Brief 150 — Notifications

**Source of truth:** [`concept_notifications.md`](../concept_notifications.md)
(approved 2026-10-14). Ticket **T-168**, with T-028 and T-037.

**Needs:** brief 100; brief 140's level-up (the level-up toast). The hover
highlight uses T-153's gold alert outline (wave 2).

**Branch:** `crunch/notifications`. **Tier:** builder. **Eye-check:** yes.

## N1 — The store and the log

- **Change:** the log in the store: loot rows (gains and spends, merged per
  item per minute in the store, never per render, keeping today's per-hour
  rate; `ItemRateTracker` also records spending so the net and the spent
  total exist), level-up rows, banner rows; ~200 rows; pins with live loot trackers;
  the display mode; pins and mode saved (schema entry and a load test). Route
  every event as the concept's audit table says (owner, 2026-10-19),
  including the new hooks: recipe unlocked (first guild-wide, grouped per
  level-up), first item found, bank full. Refusals move to callouts.
- **Done when:** unit tests cover merging, the cap, pins, save/load and the
  routing table.

## N2 — On screen

- **Change:** the log button with its badge at the top right; loot toasts
  slide out and back (max 3) as the concept's "A toast's
  look" draws them: amount then sprite, one stub per item showing the net
  flow (green gain, red loss), hover expands left over the mat with name,
  gained/spent and net per hour, only the pin clickable, first find in a gold
  frame led by "New!"; the **banner** at the top centre below the top bar (~4 s, one
  at a time, clickable, gold edge for milestones, red for problems); the
  drop-down log with tabs and Clear log; the three display modes (switch in
  the log's header; banners show in all three); the Settings Notifications
  tab (one item pop-out switch, the position setting removed); hovering a
  row or banner outlines its hero or Token. The edge sidebar goes.
- **Measure:** `bench:draw --compare` on a loot-heavy save; cost-log line. No
  backdrop blur on toasts.
- **Done when:** a busy minute of loot, a first find, a recipe-unlocking
  level-up (banner, click opens the list) and a knock-out (red banner) seen in
  the running game; a pin survives save and reload.

N2 is the bigger half; the director may split the banner into its own phase
(N3) if N2's report runs long.

## Owner to-do

- Eye-check; draw the log button sprite (placeholder until then, on the art
  list).
