# A39: The world map and settling
*Read at tag audit-build (1c04f5f6), 2026-11-21.*

## In one paragraph

The world is rings of hex cells round the Starter Camp: 3 rings, then 3
wild ones, about 126 places. A place next to a settled one can be settled
once its ring is open (rings 2 to 6 each opened by a Hall star) for a price
in items and a skill level (checked, not spent); prices are in the CMS. It
lands with arrival enemies (3 to 6) that hold the mat until beaten. Travel is
free. Your rulings already: camps only for bosses (T-547), a settled place is
forever (T-616), arrivals outside the cap (T-609).

## What really happens underneath

- **Arrival enemies with no room** are dropped with only a log line (T-598,
  T-609 settle it).
- **Settling ignores the cap**: a new place can start over 128 Tokens; the
  cap only blocks additions.
- **Keys** (ring 2: an iron vein and fir) only shape the map, not settling.
- **Fixed in code**: 3 strict rings, 6 wedges, at most 6 arrival enemies.
- **Travel is free and instant.**

## Owner feedback (2026-11-21)

Interviewed together with the Heroes and the guild group, without playing first.

- **Bounties**: "Probably cutting quests and bounties until I can figure out
  a better way to implement them." Bounties only; Limes stays.
- **Discard**: a Discard button.
- **Item effects**: shown on the item.
- **Small calls**: a new place outside the cap, hero level on the sheet, a
  Lessons switch in Settings, as recommended.
- **Roster and orders**: fine as is; leftovers only.

## What it became

- **T-637** (director): cut bounties for now; Limes stays.
- **T-638** (director): a Discard button.
- **T-639** (director): an item shows its effects before it's worn.
- **T-640** (director): three small calls (cap, hero level, Lessons switch).
- **T-641** (director): heroes and Bank leftovers.
- **T-642** (planning agent): GDD on heroes and the guild.
- Fine as is: no dismissing, no permadeath, no auto-assign, recruits with the Hall's XP gift.

All six tickets cover the whole group, blocked on it; the group is ready to brief.

## Evidence

- Settling → `src/systems/world/Settling.js:181, 216-241`, `src/systems/world/frontier.js:32-75`, `src/systems/world/ringStars.js:44-49`; prices, arrivals → `data/world.json` (`prices`, `arrival`, `wild`)
- Arrival no room → `src/systems/world/Arrival.js:208, 215`
- Rings → `src/config/worldTablesShape.js:66`
