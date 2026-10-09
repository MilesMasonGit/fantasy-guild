# Brief 70 — The Atlas

Runs after deep optimization (owner, 2026-10-06).

**Source of truth:** [`concept_atlas.md`](../concept_atlas.md), **starting
with "Owner decisions, 2026-10-07"**, which override the rest: respawning
resource fixtures (refill or regrow, time per Token); spawners only for
enemies and lures; the Shop sells buildings and tools only; demolition is a
Construction job with no refund, replacing the bin; everything counts toward
the Token cap; a hand-made Starter Camp; the Guild Hall on every Region;
per-Token ambush rules; Maps as special items from enemy drops and quest
rewards; Regions frozen while away; terrain paints biomes (brief 80).

**Also read [`concept_progression.md`](../concept_progression.md)** (owner
interview D2, 2026-10-09). It adds to the Atlas; where it differs from
`concept_atlas.md`, it wins:
- **The Starter Camp holds one endgame site per skill (all 25)**, each that
  skill's final challenge, shown as a ruin from the first minute, plus the
  ritual's great construction. Size the Starter Camp for this against the
  Token cap (exempt sites, a bigger Starter Camp, or small sites). It lasts
  about 30–60 minutes before the first map.
- **Moves every few days** (20+ Regions in a first run); **going back to
  specialised Regions is intended play**. Travel stays free and instant; the
  whole guild moves together.
- **One-time treasures** in a fresh Region: ruins and caches, a rare node.
- **Some modifiers change how a base is built** (little room, free charge,
  harder enemies), not only contents.
- **Movable Tokens show a faint marker at rest and lift on hover**; fixed
  Tokens do neither.
- **Map supply is steady** from farmable enemies plus quests; **upcycling
  stays**. **Tools last forever** (T-126); the Shop's tools are bought once.
- **No tier labels**: tiers are implicit in the chains (Fir → Iron Pickaxe →
  Gold), never "Tier 2" in the game.

**Uncommitted Atlas work** sits in the owner's folder (`src/state/StateSchema.js`
adds an `atlas` save section; `data/items/maps.json` was written outside the
CMS): T-005. Resolve it with the owner before A1.

**Branch:** `crunch/atlas`. **Tier:** engineer for the roadmap and the engine;
builder for UI from the roadmap. **Eye-check:** per roadmap milestone.

## A0 — Roadmap (engineer, read-only first)

Write `docs/active/atlas_roadmap.md`: the slices, in an order where each
leaves a playable game. Expected big pieces (the roadmap decides):
1. **Region model and save**: Regions, the active Region, travel, frozen
   Regions, abandon/archive, naming.
2. **Resource fixtures**: depletion → respawn (refill or regrow), per-Token
   respawn time in the CMS; charges mean "until depleted"; the Spawner System
   narrowed to enemies and lures.
3. **Demolition** replaces the bin: mark a Token, a Construction hero removes
   it, no refund.
4. **Generation**: Base Maps + Modifiers → a node budget → a layout within the
   Token cap, around the Guild Hall; reroll; settle.
5. **Cartography UI**: inventory, slots (2, up to 8 via upgrades), node
   summary, preview.
6. **Starter Camp** and the tutorial ending in the first Maps.
7. **Maps as items**: drops and quest rewards; retire the old Map Tokens
   (T-002) and the unused map data.
8. **Ambush rules** per Token (the effect grammar's `spawns`).
Plus **one batch of owner questions** for what the concept leaves open
(e.g. the Starter Camp's contents, how many Base Maps and Modifiers ship
first, Cartography slot upgrades' prices, reroll cooldown).

Stop after A0 for the owner's answers; then build slice by slice.
