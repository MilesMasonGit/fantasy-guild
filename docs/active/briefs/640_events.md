# Brief 640 — Events: rich nodes and buff Tokens that land on the mat

*Written 2026-11-12 by the planning agent from the owner's interview of the same day. Source:
[concept_events.md](../concept_events.md) (the rules, approved). Code facts are from a read-only look at eafe561a;
verify them.*

**What the owner wants.** About once an hour of play, a special Token lands on the mat: either a **rich node** (a
big but limited pool of charges and a high yield, gone when worked out: a Copper Ore Comet, 100 charges, 6 copper a
cycle) or a **buff Token** (one effect on the Tokens in its reach for a set time: Rainfall, +20 % Double Loot on
Farming for 20 minutes). Events are treats: nothing bad happens, nothing is lost by being away.

## The owner's rulings (2026-11-12)

- **About once an hour** of play, **one event at a time**; the hour counts from when the last one ended.
- **Weighted random** per event (a weight in the CMS) among the events that **fit the place**: each event lists the
  regions or ground it can land on (a shoal only on water). **Not tied to tier**: a Mythril Comet may land in the
  first hour.
- **Ending**: a rich node ends when its **charges** run out; a buff Token when its **time** runs out. A rich node
  **no hero can work** (level or tool) **leaves after about an hour**.
- **Moving**: **buff Tokens move** (drag, right-click once brief 610 lands); **rich nodes stay** where they land.
- **Reach**: buff Tokens use the standard reach. **One rule everywhere**: event nodes take every effect a normal
  Token does (Speed, Double Loot, Lucky, Giant Harvest, their rare table); event buffs **add to** buildings' and Stars'
  boosts inside the same limits and show as one more source on the badges (brief 600).
- **Time left shows like a refreshing node's** (the timer on the hover plate; charges as today). No new look.
- **Arrival**: a short arrival on the mat and a **notification** that points to the Token.
- **Offline**: events land and heroes work them; buffs tick down; the return report names them.
- **Demolish** removes an event Token at once.
- Later, not here: event-only materials, the events constellation of Stars, visitors (trainers), an events log.

## Read first

`CLAUDE.md`, `docs/reference/ARCHITECTURE.md`, `docs/reference/TESTING.md`, the concept doc, BALANCE_RULES
(section 5, the boost budget and limits).

Code to start from (verify):
- **A guild-level clock**: `QuestTokens.tick` (`src/systems/quests/QuestTokens.js`, a saved `clockMs`, a tick
  handler) is the closest pattern for a spawner that isn't itself a Token. Spawning: `EffectActions.spawn` (modes
  `nearest_free`, `random_free`), `MatPlacement.findSpot` / `findSpotAnywhere`, the ground masks in
  `GroundRules.js` (`standsOn`: water, shore, grass, rock, sand, stone). New Tokens get `origin: 'spawned'`.
- **Charges**: `Charges.applyDelta` already removes a Token at 0 charges (`destroyToken`, "Token Exhausted") unless
  its type has a `respawn` block. ⚠️ `wearRule.js` makes any **support** (a Token with a standing `Provides` reaching
  past itself) unlimited: a buff Token has no charges, so its end must be a clock, not charges.
- **Clocks**: `TimedChanges.HANDLERS` rows on `instance.clocks`. No Token expires after a time today, and a row's
  `fire` has no "remove" result: add one properly rather than removing and returning "held". ⚠️ `TimedChanges.tick`
  skips Tokens marked for demolition.
- **Buffs in reach**: `TileModifiers` already indexes every Token type with `provides`, not only buildings; a
  `category` (skill) narrows the effect. A buff Token is a Token type with one `provides` statement plus an expiry.
- **Moving**: `FixedTokens.isFixed` (`staysPut: true` keeps a type in place); a plain spawned Token is movable.
- **Demolish**: `Demolition.refusalOf`.
- **Offline**: `CatchUp.run` plays the away time through the real tick handlers, active Region only;
  `catchUpNews.js` feeds the return report.
- **Notifications**: banners take Token `subjects` (hover outlines them) but no route uses one, and there is no
  camera (the mat fits the window). The `TOKEN_SPAWNED` callout already shows on the mat.
- ⚠️ Live play draws `Math.random`; the bench and tests seed it. Every spawn moves the random stream
  (`newTokenId`).

## Phases

| Phase | What | Tier |
|---|---|---|
| E1 | **The event engine.** An **events table authored in the CMS**: each event names its Token type, its kind (rich node or buff), a weight, where it can land (ground words and/or region biomes), and for a buff its duration. A guild clock (saved, counted by the tick's delta, so it runs offline) lands one event about once an hour of play on the **active Region's** mat, drawing by weight among those that fit; if none fits or there's no free spot, it tries again a few minutes later. One at a time: the clock waits while an event is on the mat. **Expiry**: a new clock row that removes a buff Token when its time is up, and a rich node no current hero can work after about an hour (state the "can work" test you used). Rich nodes are their own Token types (big `uses`, no `respawn`, `staysPut`); buff Tokens are movable Token types with one `provides` rule in the standard reach. Event Tokens can be demolished. The return report lists events that landed and ended while away. **The bench**: events off in the bench's play unless an option turns them on; say how. Say what the CMS needs (the table, a Token "event" marker) and add it to the CMS. | engineer |
| E2 | **Arrival and the notification.** A short arrival on the mat by kind, built from existing pieces (a streak and a landing burst for nodes, a drift-in and fade for buffs). A **notification** when an event lands: a banner naming it with the Token as its subject (hover outlines it); clicking it outlines the Token with a short pulse and, from the World Map or the Guild Hall, returns to the mat. The hover plate shows a buff Token's time left like a refreshing node's timer; the Token card shows "Leaves in m:ss" or the charges left. The badges (brief 600, if merged) list an event buff as a source by the event's name. | builder |
| C1 | **The first events pack** (content agent, with the owner): about 6 to 8 events: comets for a few ores, a windfall (logs), a fish shoal (water), a wild patch to forage, and 3 or 4 weather buffs (Rainfall: Double Loot on Farming, and others by the effect names). Each sized against BALANCE_RULES section 5 ("clearly better, never a jackpot"), with weights and where they land; tiers spread across the whole game. Today's pictures stand in; each new event Token goes on the owner's art list. A list to the owner first, then a pack staged in the scratchpad and checked by script; the owner accepts and Syncs on `main`. | content agent |

Order: E1, then E2 and C1 side by side (C1 needs E1's table in the CMS).

## Done when

- Gate green (`TESTING.md`). **Engine work same** with events off in the bench; record the switch.
- **Tests**: the clock lands an event after an hour and not before; one at a time; only an event that fits the ground
  is drawn (a shoal never lands without water); a rich node removed at 0 charges; a buff Token removed when its time
  is up and its boost gone from the Tokens in reach; an unworkable node leaving after its time; a workable one
  staying; events landing and ending during catch-up; demolish removing one; a buff adding to a building's boost of the
  same kind inside the limit.
- **In the running game, named as verified**, with QA events (the QA panel's "place a Token" may place one): a comet
  landing with its arrival and banner, worked out by a camp and gone; Rainfall moved beside Fields and their Double
  Loot rising on the card for its time, then gone; a Mythril Comet with no miner leaving; the banner pointing to the
  Token; an hour away and the return report naming what landed.
- GDD (a new "Events" section), the living-game doc's Events section pointing to the concept doc; changelog entries.

**Eye-check: yes**, one after E2 and C1 (the arrivals, the banner, the first events on the mat).

## Not in this brief

- Event-only materials and their recipes (a later pack); the events constellation of Stars (a later star pack, after
  events are played).
- Visitors: trainers, the merchant, requests. Instant effects, optional fights, shrines, event chains.
- An events log in the encyclopedia or collection log.

## Owner to-do

- Review the content agent's event list (C1), accept the pack and Sync on `main`.
- The eye-check. New event Tokens on your art list, at your pace.
