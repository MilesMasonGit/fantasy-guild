# Quest System v2 — Concept & Spec

**Status:** Owner-approved design, 2026-07-14 (this doc is the source of truth for the quest rework).
**Replaces:** the authored `unlockQuestIds` + map-fragment unlock flow (fragments are retired).
**Related cleanup tasks:** "Quest Completion & Unlocking Areas" + "Quest Respawning Mechanics & Refresh Timers" (rework_cleanup_todo.md Group 4).

## 1. Overview

Locked areas are unlocked by completing quests. Each locked area runs a **quest
board** of slots holding two kinds of quests:

- **Main Story Quests (MSQs)** — developer-authored, per-area. Cannot be
  abandoned, immune to refresh, ALL must be completed to unlock the area.
  Early-game MSQs are tutorial actions ("Drag a Hero to an Area"); late-game
  MSQs are skill gates ("Defeat the Skull Dragon Boss 100 times").
- **Procedural quests** — generated gather/defeat objectives drawn from the
  possible outputs and enemies of ALL unlocked areas' card pools (whether or
  not the player owns the specific cards). Completing one +1s the area's
  unlock counter and frees its slot.

**Unlock condition (both required):**
1. All of the area's MSQs completed, AND
2. Procedural completions ≥ the area's threshold (progress bar, e.g. 10/30).

## 2. Quest slots

- Each locked area has `3 + questSlotRank` slots (new Guild Hall upgrade
  `quest_slots`, max rank 9 → **12 slots**; shared across all areas).
- **MSQs claim slots first**, in authored order. All MSQs are always visible
  and tracked; procedural quests fill only the remaining capacity. (Content
  rule of thumb: ≤ 3 MSQs per area so early boards aren't starved.)
- A completed + turned-in quest frees its slot. Freed slots stay empty until
  the next refresh (natural or paid).

## 3. Refresh clock (global)

- One global timer fills every empty procedural slot across all locked areas.
- `QUEST_REFRESH_MS = 5 * 60 * 1000` for now (**future: ~4 hours** — single
  constant in the quest config).
- Stored as a `refreshAt` timestamp so offline time counts naturally.
- **Refresh Now**: pay gold to trigger the fill immediately. Cost scales per
  use (`INSTANT_REFRESH_BASE × INSTANT_REFRESH_GROWTH^uses`) and resets to
  base on every natural refresh. Paying does NOT reset or delay the natural
  timer.
- **Abandon All**: clears every procedural quest from every board (MSQs
  untouched, unlock counters untouched). Slots wait for the timer / paid
  refresh — abandoning is not a free reroll.

## 4. Procedural generation

Pool: for every UNLOCKED area, walk its card registry entries and collect
- item outputs → **gather** candidates,
- enemyIds → **defeat** candidates.

Card ownership is irrelevant — "possible from the area" is the rule.

Per generated quest:
- `required` quantity scaled off item `baseValue` / enemy level, clamped to a
  tunable band (all knobs in one quest config block).
- Reward: gold = `value × required × REWARD_MARGIN`, plus a small chance
  (`BONUS_ITEM_CHANCE`) of a bonus item rolled from the same unlocked-area
  pool the quest came from.
- Duplicate objectives on one board are avoided when the pool allows.

## 5. Quest archetypes

| Type | Objective | Tracking | Turn-in |
|---|---|---|---|
| `gather` | Collect N of item | live bank count (existing QuestTracker pattern) | manual; **consumes the items** |
| `defeat` | Kill N of enemy | combat victory events | manual; free |
| `action` (MSQ only) | Do a game action N times | EventBus subscription (e.g. `hero_assigned_to_area`) | manual; free |

MSQs may be any archetype; procedural quests are gather/defeat only. MSQ
rewards are authored per quest (gold/items, optional).

## 6. Unlock thresholds (per-area, authored)

Scaling by depth; placeholder balance values (⚠ tune freely):

| Area | Threshold |
|---|---|
| Whispering Woods | 20 |
| Misty Mountains | 30 |
| Sunken Bog | 40 |

Authored in the area content next to the MSQ list. Abandoning never reduces
the counter.

## 7. UI

- **Quest control bar** — ONE global row between the unlocked rows and the
  locked rows, styled like a locked-area strip: refresh countdown, `Abandon
  All` (with confirm), `Refresh Now (Ng)` with the scaling cost shown.
- **Locked area rows** — replace the fragment badge with the unlock progress
  bar (`12/30 quests`); the quest list becomes the slot board: MSQs pinned
  first with distinct (gold) trim + "Story" tag, procedural quests after,
  empty slots shown as awaiting-refresh placeholders. Turn-in buttons appear
  on completed quests (existing pattern).
- **Guild Hall** — new `quest_slots` upgrade row (3 → 12).

## 8. Data model (sketch)

```js
state.questBoard = {
  refreshAt: 0,             // next natural refresh (epoch ms)
  instantRefreshUses: 0,    // resets on natural refresh
  areas: {
    [lockedAreaId]: {
      completed: 0,         // procedural completions (the unlock bar)
      msqDone: [questId],   // turned-in MSQs
      msqProgress: {},      // questId -> current
      slots: [              // procedural slots only (MSQ capacity derived)
        { id, type: 'gather'|'defeat', targetId, required, progress, gold, bonusItemId? } | null
      ]
    }
  }
}
```

Old `unlockQuestProgress` / fragment state is ignored on load (dev saves mid-
rework; save compat already broken by the rework).

## 9. Implementation phases

1. **Engine** — `QuestBoardSystem` (new): state init/migration, refresh clock,
   procedural generation from unlocked-area pools, turn-in (consume/reward/
   counter), abandon-all, instant refresh cost, unlock check + area unlock
   handoff. Retire fragment awards in QuestTracker.
2. **Config/content** — quest config block (all tunables), `quest_slots`
   Guild Hall upgrade, per-area thresholds + MSQ lists (tutorial MSQs for the
   first lock, defeat-gates later), `action` quest event map.
3. **UI** — quest control bar row, locked-row board rework, Guild Hall row.
4. **Smoke test** — new game: MSQs visible + tutorial action tracks; timer
   fills remaining slots; gather turn-in consumes items and pays gold; defeat
   quest ticks on kills; abandon-all leaves MSQs; paid refresh cost escalates
   and resets; bar fills; area unlocks when bar full + MSQs done.
