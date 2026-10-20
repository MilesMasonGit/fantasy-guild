# Brief 170 — The quest board

**Source of truth:** [`concept_quests_tutorial.md`](../concept_quests_tutorial.md)
"The quest board" (owner interview 2026-10-20, which replaces the three-board
design). Ticket **T-176**.

**Needs:** brief 120 (the Token card), brief 130 (the card growing to a list:
reuse its pattern), brief 150 (floating loot flies to item stubs). Atlas A8's
tutorial chain must keep working: its steps move onto the board.

**Branch:** `crunch/quest-board`. **Tier:** builder for Q2; Q1 by an engineer
if the read-through shows the quest lifecycle refactor (Tokens → one board,
the tutorial chain, counting from the Bank) is large. **Eye-check:** yes.

**Keep it light**: the owner may still change what bounties are for; build
the smallest clean version, no balance system.

## Q1 — The board in the engine

- **Change:** one quest-board fixture at the bottom-left cell of every
  Region's mat (not movable, not demolishable, outside the Token cap); the
  terrain placement must leave that cell free (the terrain director owns
  `src/systems/atlas/**`: ask the director for a minimal reserve call, as
  brief 110 M1 did). Quests become a guild-wide list instead of loose Tokens
  (`QuestTokens.js` retired): up to 3 bounties, the interval as today;
  collect and hunt generated from what the guild can reach (items its
  chains make, enemies met), amounts scaled to progress; collect counts
  have/need from the Bank and Claim takes the items; hunts count kills after
  arrival in any Region; materials-only rewards burst from the board as
  floating loot; the tutorial step is the pinned top row and can't be
  dismissed; Dismiss on bounties as today. Fresh saves, no conversion.
  ⚠️ The bounty generator's random draws are part of the bench's work check:
  expect WORK CHANGED and say exactly why.
- **Done when:** tests cover supply and the interval, generation from
  reachable content, Bank counting and Claim taking items, hunt counting,
  the burst, the tutorial row, and the A8 tutorial chain completing.

## Q2 — The board on screen

- **Change:** the board Token (placeholder art until the owner draws it);
  clicking opens its card on the quest list (rows: the ask with have/need,
  hunt rows with the enemy's first idle frame, reward, Claim, Dismiss; the
  tutorial row pinned first in the cartographer's voice); at rest the gold
  attention outline and a count of ready quests.
- **Done when:** a collect quest becoming ready from Bank stock and claimed
  (the reward bursts as loot), a hunt, and the first tutorial steps, seen in
  the running game on two Regions.

## Owner to-do

- Eye-check; draw the quest board Token (placeholder until then).
