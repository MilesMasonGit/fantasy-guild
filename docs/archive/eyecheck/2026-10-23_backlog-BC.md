# Eye-check: backlog batches B and C (2026-10-23)

Looked at by phone screenshots (owner away from the PC 23–25 October; the
owner's ok by phone merges). Captures under `docs/active/research/`
(`quiet_tokens/`, `drag_loot/`, `pickup_flight/`, `item_tiles/`,
`hero_bar/`).

## Batch B (main b0528da0)

1. **Names under Tokens** and under heroes. Verdict: ok; heroes below too.
2. **Hover tips can cover a name below.** Verdict: leave it.
3. **Done quests unmarked until hovered** (glow and tutorial beacons gone).
   Verdict: ok until the tutorial redesign.
4. **Drag tint on forbidden cells only.** Verdict: ok as it is.
5. **Loot**: speckles, rare flash, flight sparkles off. Verdict: ok; the
   ground shadow stays; **both pile effects off too** (dissolve, pulse).
6. **Pickups fly from where they stand** (bug fix, numbers only).

## Batch C (main 957cb9ba)

7. **Item tiles**: inspect pane out, header search, full tooltip, tints by
   kind, slot-kind marks. Verdict: ok (tint rule in UI_STYLE).
8. **One item, one hero.** Verdict: ok as ruled; no "N in use" count.
9. **Hero bar**, round 1 built on the horizontal bar. Verdict: **wrong bar**:
   the owner meant the vertical hero tabs beside the open Bank. Round 2:
   horizontal bar restored; the Bank's tabs show portrait + name. Verdict: ok.
10. **Equip shine, Work Permissions button and drawer, Combat first.**
    Verdict: ok.

## When you're back at the PC (hands-on, nothing blocking)

- Equip and unequip a tool: the Bank count drops and returns; with a full
  Bank the unequip is refused with a message. The QA panel's Gear section has
  "Fill the Bank" and an old-save test (use a test slot, not slot 3).
- Hover an item stub marked "New!": the mark goes.
- Open Work Permissions from the button under the mat; check the drawer.
- Drag an enemy and a hero on the mat: the ghost starts under the pointer.

## Batch D (main e6abf4e2), looked at 2026-10-23/24

11. **Calmer Hall sky**: no toasts or stubs over it; drift: smooth glide
    (picked over pixel steps); stars grey/blue/gold. Verdict: ok; outlines
    on hover only, never at rest.
12. **Hall Effects popover, pixel Inspect panel.** Verdict: ok. The Hall star
    no longer closes the screen (Return, Esc and the orb do).
13. **The camera glide.** Verdict: ok; keep the 0.2 s start on the way back
    (the mat is off while you're in the Hall); other views from the Hall land
    on the mat at once.

When back at the PC: open the Guild Hall (glide up), hover and click the
central star (popover), Return to Playmat (glide down), open the Bank from the
sky (lands at once).
