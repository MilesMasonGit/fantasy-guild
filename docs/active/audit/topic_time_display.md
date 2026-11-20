# Topic: how time is written
*Telling the player group (A42, A43). Read at tag audit-build (1c04f5f6),
interviewed with the owner 2026-11-19 in three rounds. From S0 part 5, "Time
left is written at least nine ways".*

## The rule (owner, 2026-11-19)

One spelling for every time in the game, compact:

| Case | Reads | Rule |
|---|---|---|
| Live countdown | `34s`, `4m 57s`, `1h 15m`, `1d 4h` | Whole seconds, **rounded up** (never `0s` while time is left). Seconds dropped from an hour up. Zero parts **kept** while ticking (`5m 0s` → `4m 59s`) so the width holds steady. |
| Fixed length (a grow time, a rest, the Hall lap, a cycle, a swing, a speed bonus) | `2.5s`, `10.8s`, `1m 5s`, `8m`, `1h` | Same spelling as a countdown, so "grows for 8m" matches the timer that then starts at `8m`. **One decimal under a minute** (trailing `.0` dropped: `4s`); whole seconds from a minute up. Zero parts **dropped** (`10m`, not `10m 0s`). |
| Counting up (how long a finished fight lasted, playtime) | `12s`, `2h 5m` | **Rounded down**, like a stopwatch. |
| Past 24 hours, any case | `1d 0h`, `3d 7h` | Days and hours. |
| In sentences (tooltips, the Token drawer, idle hovers) | `refills in 4m 57s`, `leaves in 1h 15m` | The same compact spelling; no separate word style. |
| A moment, not a timer (the save slot's "Last saved") | `Just now`, `5 minutes ago`, a date after a week | **Unchanged**: words. |

Clocks (`4:57`, `75:00`, `1:04:05`) leave the game entirely.

## What the game does today

Twelve writers in six styles:

| Style | Looks like | Writer | Shown in |
|---|---|---|---|
| Clock, rounded up, no hours | `4:57`, `60:00`, `75:00` | `formatClock` (`Formatters.js`), `clockText` (`workPlate.js`), `turnCountdownText` (`centreAlert.js`) | Token card timers (grow, ripen, demolition, event leaving, turn, rest, Hall production, spawner), the work plate, the turn ring, the healing flag and order, the away summary's "leaves in", recipe list grow times, Encyclopedia grow times, the Hall effects popover's lap |
| Clock, rounded to nearest | `0:03` for 2.5 s, `8:00` | `clockText` (`EncyclopediaPanel.jsx`), `lapClock` (`hallStarText.js`) | Encyclopedia recipe times, the Hall's lap in its effects |
| Clock, rounded down | `0:12` | `clockText` (`fightView.js`) | How long a fight lasted (fight log) |
| Clock with hours | `1:04:05` | `formatEta` (`heroPanelSkills.js`) | A hero's time to next level |
| Words with hours | `12 s`, `1 min 30 s`, `1 h` | `formatDuration` (`lifecycleLines.js`) | The Token drawer, the idle Token hover |
| Words, no hours | `60 min`, `75 min` | `spoken` (`tokenCard.js`) | Tooltips on the Token card's timers |
| Short seconds, no space | `2.5s`, `3s` | `cycleText` (`tokenCard.js`), `cycleSecondsText` (`ringRow.js`) | Cycle length on the card, the cycle ring |
| Short seconds, space, one decimal | `2.4 s` | `secondsText` (`fightView.js`), `fight.seconds` in `en.json` | Swing speed in fights, the hero's combat view, weapon tooltips |
| Short seconds in an effect | `−0.5 s work` | `supportTags.js` | The card's boosts block (its wording joins the effect-wording topic) |
| Compact totals | `2h 5m`, `< 1 min` | `formatPlaytime` (`Formatters.js`) | Playtime per Region, save slots |
| Relative | `5 minutes ago` | `formatTimeAgo` (`Formatters.js`) | Save slots (kept) |
| Compact, days | `45s`, `2m 5s`, `1h 1m`, `1d 1h` | `XpRateTracker.formatDuration` | **Only tests call it.** Nearly the owner's rule already; the fix can start from it. |

The same event's hour today reads `60:00` on the card, `60 min` in the
card's tooltip and `1 h` in the idle hover. All three become `1h` (fixed) or
`1h 0m` (ticking).

## What it became

- **T-488**: one time writer for the whole game, by the rule above; every
  writer in the table moves onto it (save slot "Last saved" excepted).
  Blocked on the Telling the player group.

## Still to interview in this group

The other S0 part 5 topics, one at a time: effect wording (one speed effect
in three wordings), the idle hover vs the card, chance rounding, silent
moments, wording drift.

## Evidence

- `formatClock`, `formatPlaytime`, `formatTimeAgo` → `src/utils/Formatters.js:110-142`
- Card timers on `formatClock` → `src/ui/components/board/tokenCard.js:331, 344, 384, 393, 402, 417, 456-457, 468, 494`
- Card tooltips' `spoken`, no hours → `src/ui/components/board/tokenCard.js:362-369`
- `cycleText` → `src/ui/components/board/tokenCard.js:618-622`
- `formatDuration` (words with hours) → `src/ui/components/drawer/lifecycleLines.js:24-32`; idle hover → `src/ui/components/board/idlePlate.js:38, 43`
- Work plate clock → `src/ui/components/board/workPlate.js:152-155`
- Turn ring clock → `src/ui/components/board/centreAlert.js:25-32`
- Cycle ring seconds → `src/ui/components/board/ringRow.js:26-30`
- Fight: `secondsText`, `clockText` rounds down → `src/ui/components/combat/fightView.js:105-114`; fight log length → `src/ui/components/combat/FightPanel.jsx:466`; `"seconds": "{n} s"` → `src/i18n/en.json:367`
- Encyclopedia rounds to nearest → `src/ui/components/encyclopedia/EncyclopediaPanel.jsx:10-13`; grow times → `EncyclopediaChartView.jsx:184-201, 345`
- Hall lap rounds to nearest → `src/systems/progression/hallStarText.js:70-73`; popover → `src/ui/components/board/GuildHallEffectsPopover.jsx:78`
- Hero level ETA with hours → `src/ui/components/dock/heroPanelSkills.js:54-60, 87`
- Healing flag and order → `src/ui/components/board/flagText.js:71`, `src/systems/board/Orders.js:69`
- Away summary → `src/ui/components/hud/catchUpSummary.js:122`
- Recipe list grow time → `src/ui/components/board/RecipeList.jsx:119-121`
- Boost wording in seconds → `src/ui/components/board/supportTags.js:34`
- Playtime → `src/ui/components/atlas/WorldDrawer.jsx:155`, `src/ui/modals/SlotSelectionModal.jsx:180, 204`
- Unused compact writer → `src/systems/hero/XpRateTracker.js:61-77`; tests only → `src/tests/XpRateTracker.test.js:34-39`
