# Brief 840 — Loot flight: a trail and a landing

*Written 2026-11-23 by the planning agent from the owner's interview the same day
([concept_loot_flight_trail.md](../concept_loot_flight_trail.md), approved 2026-11-23). The concept
holds every ruling. Independent of the other briefs.*

**What the player gets.** Collected loot flies to its item notice as today, but now leaves a trail of
coloured shadows and a sparkle shower whose colour says how big the stack is (grey, blue, green, gold,
red), and the notice flashes and sparkles when it lands.

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, `docs/reference/ARCHITECTURE.md` (drawing), the concept
whole. The flight today: `src/ui/utils/lootFlight.js`, `src/ui/components/base/ParticleOverlay.jsx`,
`src/ui/components/notifications/stubLanding.js` and `ItemStubColumn.jsx`; the draw switch
`itemFlight` in `src/ui/dev/perf/drawSwitches.js` (read 2026-11-23; the code wins). The enemy hit's
afterimages (`TokenHitArt.jsx`) are a precedent for drawing shadows of a sprite.

## Phases

| Phase | Ticket | What | Tier |
|---|---|---|---|
| F1 | T-672 | **The comparison page** (concept §1–3): an animated page, one flight per tile played on a loop, a letter each: the shadows in the item's own colours, a rainbow run and a rarity colour's shades, each fading lighter and fading darker, with three and with five shadows; the sparkle shower in its five stack colours; the landing flash and sparkles. Real item sprites (pick a few varied ones). The owner picks; record the pick in the concept. Build nothing in the game yet. | builder |
| F2 | T-672 | **Build the pick** in the game's flight and landing: the shadows, the stack-coloured shower (stack steps start at 10, 100, 1,000, 10,000), the notice's white flash and sparkles (more for bigger stacks, in the stack's colour). The path and timing don't change. All of it behind the `itemFlight` draw switch. Measure a big collect sweep with `bench:draw --compare`; if it must be capped, cap the shadows or sparkles drawn at once, never the flight. | builder |

## Done when

- Gate green; bench work check **same work** (drawing only); one `bench:draw --compare` with the cost
  of a big sweep in the report.
- Seen in the running game: one item, a stack of each colour (QA panel: give items, drop a pile),
  a sweep of twenty piles at once; landings on a notice in view and on one popped out over the column.
- A `CHANGELOG.md` entry; the ticket closed into `docs/archive/tickets_done.md`.

**Eye-check: yes**, after F2 (how it plays). F1's pick comes first.

## Owner to-do

Pick from the comparison page. No CMS work.
