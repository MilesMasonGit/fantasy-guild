# A4: Events
*Read at tag audit-build (1c04f5f6), 2026-11-20.*

## In one paragraph

Every 45 to 75 minutes of play a special Token lands on the mat, one at a
time, with a banner ("Special Event! Copper Comet!"). Twelve are authored,
all at the same weight: six **rich nodes** (Copper, Iron and Mythril Comets, a
Fallen Maple, a Fish Shoal, a Berry Thicket; 100 uses each, they stay put and
leave when worked out or after an hour) and six **buff Tokens** (Rainfall,
Warm Sun, Deep Vein, Morning Mist, Fair Winds, Starry Night; a boost to
nearby Tokens for 20 minutes, draggable). Events are treats: nothing bad
happens. But they leave without a word, can land when nobody can work them,
and the Fish Shoal fishes by a different model from every other water.

## What the player sees and does

- **An event lands** with a short arrival (a comet streaks down, a buff
  drifts in) and a banner; hovering the banner outlines the Token, clicking
  it pulses it (and goes back to the mat from the World Map or the Hall).
- **Rich nodes** are worked like any node:

  | Event | Needs | Gives a cycle |
  |---|---|---|
  | Copper Comet | Mining 1, a pickaxe | 6 copper ore, 3 s |
  | Iron Comet | Mining 15 | 6 iron ore, 19 s |
  | Mythril Comet | Mining 60, a tier 2 pickaxe | 6 mythril ore, 29 s |
  | Fallen Maple | Forestry 45, a woodaxe | 6 maple wood, 26 s |
  | Fish Shoal | Fishing 1, a rod | 4 trout (70%) and 4 salmon (30%), each rolled alone, 8 s |
  | Berry Thicket | Farming 1 | 6 redberries, sometimes blackberries and strawberries, 5 s |

- **Buff Tokens** boost what's nearby for 20 minutes: Rainfall (more farm
  loot), Warm Sun (crops grow faster), Deep Vein (veins refill faster),
  Morning Mist (faster woodcutting), Fair Winds (faster fishing), Starry Night
  (more XP for every skill). Their time shows on the hover plate and the
  Token card ("Leaves in").
- **When an event leaves**, its banner just goes. Nothing says why: worked
  out, its hour up, or removed.
- **Removing an event** (marking it for demolition) takes it away at once,
  with no Construction hero and nothing back.

## What really happens underneath

- **The clock** draws a wait of 45 to 75 minutes, pauses while an event stands
  on the active mat, and draws again when one lands. One clock for the whole
  game, not per Region. With no event that fits or no room, it tries again in
  5 minutes. Offline, events land, are worked and leave as in play.
- **Not tied to level**: any event can land at any time, so a Mythril Comet
  (Mining 60) or a Fallen Maple (Forestry 45) may arrive in the first hour,
  sit unworkable and leave after its hour, unannounced.
- **An unworked node is reported as "time ran out"**, never "left unworked"
  (that label exists but nothing uses it). Only the time-away summary ever
  says why an event left.
- **A buff held in the hand** stays past its time and leaves once put down.
- **The Fish Shoal** is a plain node: each catch rolled separately (8 fish or
  none), no bait. Every other water lands one catch a cycle, picked by rod and
  bait, and spends bait (your ruling: no fishing without bait).
- **Fixed in code**: the 45 to 75 minutes, the 5-minute retry, the rich node's
  hour, the landing tries. The CMS sets each event's weight, ground, places
  and a buff's minutes.
- **The QA panel** can land an event now; both buttons can stack several.

## What the owner controls in the CMS

The Events page: each event's Token, kind, weight, ground, places (biomes) and
a buff's minutes. The Tokens themselves on the Token editor. Not in the CMS:
the 45 to 75 minute wait, the 5-minute retry, the rich node's hour.

## What it touches, and where it overlaps another system

- **Spawners** (A2, done): one no-room rule (T-598).
- **Fishing** (A8): the Shoal's model; no fishing without bait.
- **Telling the player** (ready to brief): silent moments, the away summary
  (T-506), banners.
- **Effects** (ready to brief): buff boosts and their limits.
- **Placing and removal** (A1): demolition of an event.

## Where it differs from the GDD

- GDD: "no events authored yet"; twelve are.
- GDD: "an hour after the last one ended" beside 45 to 75 minutes; the code
  uses 45 to 75.
- GDD: the banner's line gives a buff's minutes; it is empty.
- GDD: the QA's by-weight button ignores biomes; it doesn't.

## Try this (in the tagged build, with the QA panel)

1. **Set-up**: a new game; a hero with a pickaxe, a rod and an axe.
2. **QA panel, Events: land a Copper Comet.** Watch the arrival and banner;
   work it.
3. **Land a Mythril Comet**: no one can work it. (It would leave after an
   hour, with no word.)
4. **Land Rainfall** near a field; drag it; hover it for its time.
5. **Land a Fish Shoal** and fish it; compare with a river (one fish a cycle).
6. **Mark an event for demolition**: it goes at once.
7. Ask yourself: should events tell you when they leave, and should they
   only bring what your guild can use?

## Owner feedback (2026-11-20)

Interviewed in two rounds without playing first.

- **Fit the guild**: any event, as now.
- **Leaving**: always say, with "a banner, with specific text for each
  event. 'The clouds waft away in the breeze'".
- **The Fish Shoal**: fish like other water, but rich.
- **Removing**: "Still needs a hero assigned to demolish it", like any Token.
- **The clock's numbers**: on the tuning page.

## What it became

- **T-602** (director; content agent writes the lines): an event says goodbye.
- **T-603** (director): demolishing an event needs a hero.
- **T-604** (director; content agent): the Fish Shoal fishes like other water.
- **T-605** (director): event leftovers.
- **T-606** (planning agent): GDD §3 Events.
- T-253 now lists the event clock.
- Fine as is: any event at any time; a held buff leaves once put down.

All five tickets blocked on the living mat group.

## Evidence

- Twelve events → `data/events.json`; their Tokens and buff effects → `data/tokens.json`, `data/effects.json`
- Clock: wait, pause, retry, one global clock → `src/systems/events/EventClock.js:50-56, 91-93, 313-321`; on in the game → `src/main.jsx:97`
- Landing: fitting events, 48 tries, no push → `EventClock.js:139-169, 210-223, 264-273`; outside the cap → `src/systems/board/MatCap.js:33`
- Rich node's hour, reported as time up → `src/systems/board/TimedChanges.js:349-358`, `src/systems/board/EventTokens.js:36, 42`; worked out, demolished → `EventClock.js:338-345`
- Banner withdrawn, nothing said → `src/systems/notifications/routing.js:169-175`; banner words → `src/systems/notifications/bannerKinds.js:133`, `src/i18n/en.json:791`
- Away summary reasons, unused "left unworked" → `src/systems/core/CatchUp.js:327-328`, `en.json:565-571`
- Held buff stays past its time → `TimedChanges.js:463-467`; time shown → `EventTokens.js:78-83`, `en.json:793-800`
- Removed at once, nothing back → `src/systems/board/Demolition.js:168-175, 200-221`
- Fish Shoal outputs vs water catch pools → `data/tokens.json` (`token_fish_shoal`, `token_river`), `src/systems/board/BoardRunner.js:346-348`, `src/systems/board/Fishing.js:14-24`
- QA buttons → `src/ui/dev/EventsDevSection.jsx`, `EventClock.js:281-294`
- GDD → `docs/reference/GDD.md:532-590`
