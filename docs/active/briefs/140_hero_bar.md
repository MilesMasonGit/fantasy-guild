# Brief 140 — The hero bar: Work Permissions, level-ups and the shine

**Sources of truth:** [`concept_work_permissions.md`](../concept_work_permissions.md)
and [`concept_level_up.md`](../concept_level_up.md) (both approved
2026-10-14).

**Needs:** brief 100; T-152 (drawers close each other) merged (wave 2).

**Branch:** `crunch/hero-bar`. **Eye-check:** yes, one batch at the end.

## H1 — Work Permissions (T-164 with T-156, builder)

- **First:** check the engine accepts a priority on the Fight rule. If it
  doesn't, **stop and report**; don't build the priority cell.
- **Change:** the name on screen; the launcher in its own slot at the hero
  bar's left end (the only way in; the hero panel's button and link go, T-156
  with the rest of T-156's tidy); the drawer full mat width above the hero
  bar, columns spread evenly, every skill column shown; one Combat column; a
  `purpose` field in `skillRegistry.js` with the concept doc's drafted lines
  as header tooltips.
- **Done when:** the drawer used in the running game in tick and priority
  modes, Combat included.

## H2 — The level-up moment (T-177 with T-149, builder)

- **Change:** the floating skill icon and rolling number above the hero
  (~30 s, side by side for several, also after time away); the on-mat LVL UP!
  line goes; the hero bar's alert reads `[level] [skill]!` with wheel
  scrolling (T-149). Update `speech_bubble_lines.md` line 13.
- **Done when:** a level-up seen in the running game, and two at once.
  `bench:draw --compare` cost-log line.

## H3 — The shine (T-178, builder-lite)

- One stepped diagonal glint on hovered main-action buttons; added to the
  style sheet page.

## Owner to-do

- Eye-check; afterwards adjust the purpose lines' wording if you like (tell
  the planning agent, it's a ticket).
