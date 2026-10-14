# Brief 150 — Notifications

**Source of truth:** [`concept_notifications.md`](../concept_notifications.md)
(approved 2026-10-14). Ticket **T-168**, with T-028 and T-037.

**Needs:** brief 100; brief 140's level-up (the level-up toast). The hover
highlight uses T-153's gold alert outline (wave 2).

**Branch:** `crunch/notifications`. **Tier:** builder. **Eye-check:** yes.

## N1 — The store and the log

- **Change:** the log in the store: kinds, loot merged per item per minute in
  the store (never per render), ~200 rows, pins with live loot trackers, the
  display mode; pins and mode saved (schema entry and a load test).
- **Done when:** unit tests cover merging, the cap, pins and save/load.

## N2 — On screen

- **Change:** the log button with its badge at the top right; toasts slide out
  and back (max 3, mute from a toast); the drop-down log with tabs and Clear
  log; the three display modes; the Settings Notifications tab (per-kind
  toggles, the position setting removed); hovering a row outlines its hero or
  Token. The edge sidebar goes.
- **Measure:** `bench:draw --compare` on a loot-heavy save; cost-log line. No
  backdrop blur on toasts.
- **Done when:** a busy minute of loot, a level-up and a knock-out seen in the
  running game; a pin survives save and reload.

## Owner to-do

- Eye-check; draw the log button sprite (placeholder until then, on the art
  list).
