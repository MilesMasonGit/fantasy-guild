# Topic: the idle hover and the Token card
*Telling the player group (A42, A43). Read at tag audit-build (1c04f5f6),
interviewed with the owner 2026-11-20. From S0 part 5, "The hover on an idle
Token and the Token card describe the same timers in different words", and
"a second writer for the card's lifecycle lines that the game never calls".*

## The rule (owner, 2026-11-20)

- **One writer, the same sentence.** The idle hover and the Token card read
  each timer's sentence from one place, so they cannot drift. The hover's cell
  shows the number (`[↻] 4m 57s`); its tooltip is the card's sentence
  (`Exhausted · respawns in 4m 57s`). The words follow the group's other
  topics: compact times, Exhausted, Respawns, Expired.
- **The hover covers every timer and every stuck reason the card has**:
  demolition, Hall production, a spawner's state (full, no room, mat full,
  asleep, needs items), growth stopped for lack of items, as well as rest,
  growth, crops and events.
- **No Tokens turning at random into other Tokens** (owner: "too confusing
  for the player"). Changing into another Token stays only for a Token that
  is used up and respawns (a tree to a Stump and back). No content uses
  turning today; retiring the mechanic is for **A2 Spawners and
  transforms**, whose STATUS row carries it.

## What the game does today

| Timer | Idle hover (`idlePlate.js`) | Card tooltip (`tokenCard.js`) |
|---|---|---|
| Rest | `Resting. Refills in 4 min` | `Copper Vein: resting, refills in 4 min` |
| Grow | `Grows into Oak Tree in 4:57` (a clock inside a sentence) | `Grows into Oak Tree in 4 min 57 s, for 2 Seeds from the Bank` |
| Crop | `Wheat ripe in 4:57` | `Wheat growing: ripe in 4 min 57 s` |
| Turn | `Next roll to turn into something else in 0:30 (25% chance)` | `A 25% chance every 1 min to turn into Boar, and the same to turn back. Next roll in 30 s` |
| Event | `An event: leaves in 4 min` | `An event: it leaves in 4 min, worked or not` |
| Spawner | `Spawned: 3/5. It stops at the limit` | `next 4:57`, or full, no room, mat full, asleep, needs items |
| Card only | | demolition, Hall production, growth stopped for items, camp reach |

A third writer, `lifecycleLines` in `lifecycleLines.js`, is called only by
tests.

## What it became

- **T-504**: one writer for a Token's timer sentences, read by the card and the idle hover; the tests-only writer is either that one or retired.
- **T-505**: the idle hover shows every timer and stuck reason the card shows.
- A2 Spawners and transforms: the ruling on turning, in its STATUS row.

Both tickets blocked on the Telling the player group.

## Evidence

- Idle hover cells and tips → `src/ui/components/board/idlePlate.js:17-55, 70-80`
- Card timer lines → `src/ui/components/board/tokenCard.js:324-494`
- Tests-only writer → `src/ui/components/drawer/lifecycleLines.js:302` (no caller outside `src/tests`)
- No content uses `turns` → `data/` at the tag (no `"turns"` key)
