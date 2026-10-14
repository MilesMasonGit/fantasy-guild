Status: draft (interview done 2026-10-13; owner holds approval, 2026-10-14)

# Collectors: the Guild Hall and warehouses

*From the owner's refinement pass ([refinement_pass_todo.md](refinement_pass_todo.md)
§2, "Item Collection Automation"). Owner interview, 2026-10-13; **done**
(owner closed it). A new gameplay system. Build ticket: **T-175**. The GDD's
loot lines (§ core loop step 4, "auto-collect is optional") change when it is
built.*

## The idea

Loot lands on the mat and the player hovers it to collect it (as today).
**Automatic collection is earned**: the Guild Hall collects around itself,
and warehouses built near the work collect their kind of item. Collecting
becomes part of laying out the board, not a settings toggle.

## Hover and the old setting

- **Hovering loot always collects it**: the hands-on early game stays.
- **The global "auto-collect loot" setting goes** (`gameplay.autoCollectLoot`,
  off by default today): automation comes from buildings.

## The Guild Hall collector

- **From the start, the Hall collects every item within a small radius** around
  it, so placing work near the Hall pays off early.
- **A ranked Hall star widens the radius** (in the Vault or Compass
  constellation, [concept_guild_hall.md](concept_guild_hall.md)).

## Warehouses

- **Built by Construction on a Foundation**, like stations; no refund when
  demolished, like any building.
- **Each warehouse collects items with one tag**, named in the CMS: a Fishery
  takes items tagged *Fish*, a Lumber Yard *Wood*. **Items carry tags** set
  in the CMS (Oak Log is tagged *Wood*). Today most items have no tags, so
  tagging them is owner content work.
- **Better warehouses are separate buildings on higher Foundation tiers** with
  a **bigger radius** (a Wooden Fishery, a Stone Fishery…), the "better
  versions worth building" of D2.
- **No upkeep**: the building's price is the whole cost.

## How collecting works

- **Periodic sweeps, about once a minute**: each collector (the Hall and every
  warehouse) gathers the matching loot in its radius. The interval is a CMS
  value per building, default 60 s. All collectors share one clock so a tick
  pays for one batch, not one per building.
- **The items fly into the building**, a pop of activity, then into the Bank
  (the existing loot flight to the Hall, generalised).
- **Overlap**: loot in reach of several collectors goes to the nearest.
- **No Bank slot for a new kind of item**: it stays on the mat as loot (as
  today), and the collector shows the **yellow problem mark** with "The Bank
  has no slot for X" on hover.
- Stations still take inputs from the Bank first, then from mat loot (today's
  rule); collecting doesn't change that.

## Showing reach

- **A faint ring while the collector is hovered, dragged or being placed**,
  like a hero's flag radius, and its radius on the Token card. Never
  always on.

## Notes for the director

- **T-175, engineer**: a design-to-code job.
  - A **Collects** lifecycle block in the CMS (tag, radius, interval), beside
    Respawns and the others.
  - The Hall's built-in collector and its radius star (`guildUpgrades.js`).
  - The shared sweep clock, nearest-collector rule, the flight, and the
    Bank-full problem mark.
  - Remove the auto-collect setting and its code (`SpriteLayer.js`
    auto-collect timer, `SettingsManager` defaults, the Settings toggle).
  - Offline catch-up: check what `CatchUp.js` does with loot today and keep
    that behaviour.
  - Cost-log line: a loot-heavy save with several warehouses, `bench:draw
    --compare`. The engine bench will show WORK CHANGED (loot moves to the
    Bank differently): accept it under this ticket.
- **Owner CMS to-do once T-175 lands**: tag items (Wood, Ore, Fish, Crop…),
  author the warehouse Tokens with their Collects block and Foundation
  tiers, then Sync.
- Changes how the game plays: owner eye-check.
