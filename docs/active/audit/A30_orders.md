# A30: Orders
*Read at tag audit-build (1c04f5f6), 2026-11-21.*

## In one paragraph

Heroes work only where the player sends them: drop a hero (or right-click
with one selected) on a Token and they work it; on a camp, they work that
camp's Tokens in reach, nearest first; on the Hall they go home; on bare
ground they idle there. There is no auto-assign. A hero lets go when the
Token can't be theirs (level, tool, skill, out of reach), stays and says why
on a fixable stall ("Needs Coal"), waits beside a resting or growing Token,
and walks in straight lines.

## What really happens underneath

- **Camp choice**: the nearest Token of the camp's skill to the hero, then
  the earliest placed; no priority. A camp's written reach is ignored (240).
- **Refusals**: a Token held by an arrival, a spawner, or one the hero can't
  work (level, tool, skill) refuses the order; a busy Token doesn't (they
  wait).
- **Leaving** resets the Token's progress; heroes never leave mid-cycle
  except by a new order.
- **A full Bank never stops work** (output waits on the floor).
- **Fixed in code**: walk speed 120 u/s (about 16 s across, the GDD says 15),
  idle wander, retry each second, the standard reach.
- Being changed elsewhere: a builder staying on its building (T-608), the
  same stop-and-say rule for missing inputs (T-573, T-623, T-629).

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

- Orders → `src/systems/board/Orders.js:101-123`; refusals → `src/systems/board/Flags.js:627-665, 726-731`; claiming → `:372-417, 437, 583-605`; leaving → `:459-569`; waiting → `:885-906`
- Camps → `src/systems/board/Camps.js:20-21, 96-121`; right-click → `src/ui/components/board/rightClickOrders.js:22-42`
- Walking → `src/systems/board/walking.js:12-38`, `src/config/matTuning.js:59-73`
