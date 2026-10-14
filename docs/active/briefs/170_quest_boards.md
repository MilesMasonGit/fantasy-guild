# Brief 170 — Quest boards

**Source of truth:** [`concept_quests_tutorial.md`](../concept_quests_tutorial.md)
"Quest boards (interim, until NPCs)" (approved 2026-10-14). Ticket **T-176**.

**Needs:** brief 120 (the problem mark and hover). Atlas A8's tutorial chain
(merged) must keep working: its itemless quests ride the boards.

**Branch:** `crunch/quest-boards`. **Tier:** builder; the director upgrades it
to engineer if the read-through shows the quest lifecycle refactor is large.
**Eye-check:** yes.

## Q1 — Boards in the engine

- **Change:** three boards near the Hall in a new game and in the Starter Camp
  layout: movable, undemolishable, counted toward the cap; claiming pays out
  beside the board and leaves it blank until the next posting; the bounty cap
  becomes the board count. Replaces the spawn-and-remove quest Tokens
  (`QuestTokens.js`). Fresh saves, no conversion.
- **Done when:** tests cover posting, claiming, the wait and the cap; the A8
  tutorial chain still completes in its tests.

## Q2 — Boards on screen

- **Change:** item posters; hunt posters at exactly half size from the
  enemy's first idle frame; the count in one place; the yellow ! / green check
  badge; the poster stays on while dragged; hover says when the next notice
  comes.
- **Done when:** an item quest, a hunt and a tutorial step seen in the
  running game.

## Owner to-do

- After Q1: place the three boards in the Starter Camp layout in the CMS and
  re-accept the camp, then Sync on `main`.
