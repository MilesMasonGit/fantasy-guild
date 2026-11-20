# Systems Audit — status

*The living view of the audit. The plan and the owner's rulings:
[concept_systems_audit.md](../concept_systems_audit.md). Sessions start with
`/auditor`.*

## Start gate

**Open (tag `audit-build`, 1c04f5f6, 2026-11-19).** Build: `_builds/2026-11-19-audit-build/Fantasy Guild.exe` (desktop test build of main, QA panel included).

## Sessions

In the order the owner approved on 2026-11-19 (S0's proposal). **Next: A37.**
"From S0" lists what the sweep saw in that system, for its session to start
from (details in [S0_sweep.md](S0_sweep.md)).

| Session | System | Group | State | Tickets | Concept docs | Notes | From S0 |
|---|---|---|---|---|---|---|---|
| S0 | Cross-system sweep | — | done 2026-11-19 | 0 | 0 | overlap map, 8 groups, order; A3 merged into A1 | |
| A37 | The Guild Hall and Stars | Effects | next | | | | Hall exempt by name from some effects, not others; the drop lap ignores its lines' times; Stars reach hero Damage, Accuracy, Swing Time but not Crit, Dodge, Resistance (D2 note); a rank replaces the one below |
| A29 | Equipment and tools | Effects | | | | | two trinkets cap at 5, a perk adds past it; tool Tokens (`acceptedTokens`) and `Requires` unused or unread; heal amounts on drinks and `regen`/`restoreType` unread |
| A27 | Milestone perks | Effects | | | | | all 9 perks written with "nearby", which does nothing on a hero |
| A28 | Health, food and defeat | Effects | | | | | only Food heals; three HP rounding rules; regen can't be sped up; Wound Time counts only from the next wound; a hero's recovery is silent |
| A31 | The hit | Combat | | | | | resistance sums differ hero vs enemy (the Crab); Poison type vs Venom status; `ignoresArmor` unread |
| A33 | Status effects and boss moves | Combat | | | | | three ways an enemy lands an effect (kind, rule, move); kind presets and effects move the same numbers; six "how long" clocks |
| A32 | Enemies and encounters | Combat | | | | | a camp at its cap waits a whole interval after a kill |
| A34 | Winning, losing and loot | Combat | | | | | a kill skips Fail, Preservation, Refresh, neighbour Applies; enemies' written XP ignored |
| A35 | The combat screen | Combat | | | | | fight clock rounds down, other clocks round up |
| A15 | Melee | Combat | | | | | |
| A16 | Ranged | Combat | | | | | arrows run out silently and come from the Bank only; the code leaves an empty quiver to the owner |
| A17 | Magic | Combat | | | | | |
| A18 | Stealth | Combat | | | | | |
| A2 | Spawners and transforms | The living mat | | | | | five ways to find a spot, four answers to no room; rule spawns announce nothing |
| A4 | Events | The living mat | | | | | removed at once when marked; leaves with no reason given; a buff held in the hand stays; unworked reported as time up; Fish Shoal fished by another model |
| A1 | Placing, reach and removal (A3 merged in) | The living mat | | | | | arrival enemies skip the cap check but count; four removal gestures; a hero lets go when a Foundation is built |
| A40 | Regions | The living mat | | | | | another Region's mat stops while hero clocks and bounties run |
| A41 | Time away and saving | The living mat | | | | | a kill may count twice in the away summary (reasoned) |
| A8 | Fishing | Gathering | | | | | two fishing models (catch pool vs Shoal and Shrimp Coast); bait runs out silently, Bank only |
| A7 | Forestry | Gathering | | | | | Forests split: oak and fir plant Saplings, birch, maple, mahogany rest; only oak and fir Stumps need their Forest |
| A6 | Mining | Gathering | | | | | a vein starting to rest is silent |
| A9 | Farming | Gathering | | | | | seed checked raw at sowing, paid at harvest; no seed sends the hero away with no badge; `wheat_sprout` beside the Field crop |
| A10 | Smithing | Making | | | | | five stations carry both a cycle time and a Faster Station self-boost; inputs from Bank or floor; no room holds the ring at 100 % silently |
| A11 | Crafting | Making | | | | | |
| A12 | Cooking | Making | | | | | |
| A13 | Construction | Making | | | | | demolition is its own cycle (no speed-ups, XP or tool) |
| A14 | Alchemy | Making | | | | | rules only (owner, 2026-11-19): no content yet |
| A5 | The Shop | Making | | | | | |
| A26 | Roster and XP | Heroes and the guild | | | | | |
| A30 | Orders | Heroes and the guild | | | | | |
| A36 | Items and the Bank | Heroes and the guild | | | | | an item's effect shows only once worn |
| A38 | Quests and Limes | Heroes and the guild | | | | | a moved Token counts as placed for quests (latent); bounty waits a lap when blocked |
| A39 | The world map and settling | Heroes and the guild | | | | | arrival enemies with no room are lost, log only; settling can push the mat past the cap |
| A19 | Fletching | Specialist skills | | | | | |
| A20 | Faith | Specialist skills | | | | | |
| A21 | Summoning | Specialist skills | | | | | |
| A22 | Enchanting | Specialist skills | | | | | |
| A23 | Crime | Specialist skills | | | | | |
| A24 | Taming | Specialist skills | | | | | |
| A25 | Science | Specialist skills | | | | | |
| A42 | Notifications | Telling the player | | | | | banners built twice (live and after time away); silent moments (recovery, resting, event leaving, transforms) |
| A43 | Cards, badges and bars | Telling the player | | T-488 | | | time display interviewed 2026-11-19, see [topic_time_display.md](topic_time_display.md) (T-488); still to interview: one effect in three wordings; idle hover vs card; chance rounding; a lifecycle writer only tests call; card vs Encyclopedia sources |

## Groups

Approved by the owner 2026-11-19, in this order. A group is **ready to
brief** once all its systems are done; the planning agent then briefs its
tickets together.

| # | Group | Systems | State |
|---|---|---|---|
| 1 | Effects | A37, A29, A27, A28 | auditing |
| 2 | Combat | A31, A33, A32, A34, A35, A15, A16, A17, A18 | waiting |
| 3 | The living mat | A2, A4, A1 (with A3), A40, A41 | waiting |
| 4 | Gathering | A8, A7, A6, A9 | waiting |
| 5 | Making | A10, A11, A12, A13, A14 (rules only), A5 | waiting |
| 6 | Heroes and the guild | A26, A30, A36, A38, A39 | waiting |
| 7 | Specialist skills | A19 to A25 | waiting |
| 8 | Telling the player | A42, A43 | interviewing by topic (time display done) |
