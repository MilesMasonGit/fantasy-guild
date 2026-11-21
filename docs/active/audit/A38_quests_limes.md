# A38: Quests and Limes
*Read at tag audit-build (1c04f5f6), 2026-11-21.*

## In one paragraph

Limes, the tutorial guide, walks a new guild through 8 lessons (10 live
steps) ending in "settle a place"; steps tick off from what the player does,
pay nothing, and can only be switched off on the new-game screen. Bounties
appear beside the Hall, at most 2, one every 3 minutes: hunt 2 to 5 Goblins
or bring 2 to 25 of an item; every one pays 10 Oak Wood. A collection of 25
Oak Wood therefore pays back 10.

## What really happens underneath

- **Two lesson steps are dropped** (the scrap heap and the weapon: no
  content id).
- **The fight lesson** counts any victory, not the slime it names.
- **Lessons are fixed in code**, not the CMS; no skip in game.
- **Bounties**: hunts are Goblins only; the reward is the same everywhere
  (a placeholder); a collection counts what the Bank holds, not what was
  gathered; claiming takes the items.
- **The lap**: at the cap the clock holds and leftover time is dropped; a
  bounty with no room waits a full interval.
- **Counters**: a moved Token counts as placed, but nothing uses that; ten
  quest reports have no reader.

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

- Lessons → `src/systems/quests/lessonPlan.js:23, 34, 61-95`, `src/systems/quests/LimesLessons.js:35-53, 83-129`, `src/ui/components/limes/LimesBubble.jsx:46`
- Bounties → `src/systems/quests/questBounties.js:14-16, 41-78`, `src/systems/quests/QuestTokens.js:101-104, 262-287, 323-406`
- Counters → `src/systems/quests/QuestManager.js:97-224`, `src/systems/board/Placement.js:57-60, 176, 237`
