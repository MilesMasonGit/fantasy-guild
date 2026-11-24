Status: briefed 2026-11-23 (approved 2026-11-23; [brief 840](briefs/840_loot_flight_trail.md))

# Loot flight: a trail and a landing

*Owner interview 2026-11-23 (planning agent). About the moment collected loot flies off the mat to
its item notice; the flight's path and speed stay as they are ("I like the flight movement
currently, but it needs a trail to make it more special", owner).*

Today: a collected item flies from the floor to its own item notice in the top-right column
(`src/ui/utils/lootFlight.js`, `src/ui/components/notifications/stubLanding.js`); the notice's count
ticks up as it lands.

## 1. Coloured shadows behind the flying item

Afterimages of the item's sprite trail behind it, each a different colour. **The look is picked on an
animated comparison page** (owner): the same flight played side by side, a letter each, for:

- **colours**: the item's own sprite colours; a fixed rainbow run; a rarity colour's shades;
- **fade**: each colour set fading lighter toward the tail, and fading darker;
- **length**: three shadows and five.

The owner picks one of each; only the pick is built. The flight's path and timing don't change.

**The pick** (owner, 2026-11-24, from the comparison page `research/loot_trail/`, tiles C and D):
"We will use the item's primary color, and fade it darker towards the end." So:

- **One colour**: the item's primary colour, its single most-used sprite colour, near-black outline
  colours left out. Each shadow is that colour mixed darker toward the tail.
- **The shadow count says the stack size** (owner: "increase the number of shadows on the trail.
  Starting with 1 and scaling up to 5"), on §2's stack steps, and two more past them (owner,
  the same day: 100,000 and more six, 1,000,000 and more seven):

  | Stack | Shadows |
  |---|---|
  | 1 – 9 | 1 |
  | 10 – 99 | 2 |
  | 100 – 999 | 3 |
  | 1,000 – 9,999 | 4 |
  | 10,000 – 99,999 | 5 |
  | 100,000 – 999,999 | 6 |
  | 1,000,000 and more | 7 |

- **Built first, alone**: this base trail, so the owner has a baseline to test on ("build the base
  trail first"). The sparkle shower (§2) and the landing (§3) are tried on top of it afterwards.

**The sparkles** (owner, 2026-11-24, after trying the base trail): "I want a shower of sparkles from
the item notification bar, with a longer and more dense one for larger pickups. We'll add a lighter
sparkle trail for the item flight." So, in place of §2's shower along the flight and §3's flash:

- **A raining burst out of the item notice** the item lands on (owner, after seeing the first
  shower: "looks like a spout, but I want it to look more like a raining burst. The particles can come
  out of anywhere on the notification, and can fall down overtop of other notifications. But I still
  want it to burst/spray to the left"): each sparkle starts at its own point anywhere on the notice,
  bursts out to the left at its own speed (some rising first) and falls like rain, over the notices
  below too. Its length and density follow the shadows' seven stack steps, from the shortest and
  sparsest (1 – 9) to the longest and densest (1,000,000 and more): `LANDING_SHOWER_MS` and
  `LANDING_SHOWER_PER_BEAT` in `lootSparkles.js` (densities raised a step for the burst to read as
  rain).
- **The amount pops out of the notice's side** (owner: "I want the item number gained to pop out of
  the side of the notification bar and flash when the item lands. This will be z-leveled above the
  sparkles."): the amount gained, written as the notice writes its count ("+12", "+2.5k"), in its
  font and outline, slides out of the notice's left side, white for a moment, then the gain green,
  and fades; drawn last, over every sparkle. `POP_MS` and `POP_TRAVEL_PX` in `lootPop.js`.
- **A lighter sprinkle during the flight**: a few fainter sparkles left behind the item, the same for
  every stack (`FLIGHT_SPARKLE_EVERY_MS`).
- **Colour**: the item's primary colour lightened toward white, so the sparkles answer the darkening
  shadows (the director's call, kept by the owner: "the light item-colored sparkles are preferred").
  §2's stack colours stay in the code as the one other choice (`SPARKLE_COLOUR_SOURCE`).
- No white flash on the notice (§3) for now.

## 2. A sparkle shower coloured by stack size

Pixel sparkles shed along the flight, **coloured by the size of the stack flying** (owner):

| Stack | Colour |
|---|---|
| 1 – 9 | common grey |
| 10 – 99 | blue |
| 100 – 999 | green |
| 1,000 – 9,999 | gold |
| 10,000 and more | red |

(The owner said "1-10, 10-100…": each step starts at the round number, the planning agent's reading.)
The shower shows on every flight, grey included. The comparison page shows the five colours on one
flight each.

## 3. The landing

**The item notice flashes white for a moment and a few pixel sparkles pop out of it** as the count
ticks up (owner). Bigger stacks get a few more sparkles; the sparkles take the stack's colour from §2
(planning agent's default, shown on the comparison page).

## Notes for the director

- A collect sweep can send many items at once: trails, shower and landings must stay cheap. Measure a
  big sweep (draw bench) and say the cost; if it must be capped, a cap on shadows or sparkles drawn at
  once is fine, the flight itself never.
- The game has no reduce-motion setting today; the trail sits behind the `itemFlight` draw switch.
- An eye-check: yes (how it plays). The comparison page comes first.
