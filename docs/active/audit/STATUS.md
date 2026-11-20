# Systems Audit — status

*The living view of the audit. The plan and the owner's rulings:
[concept_systems_audit.md](../concept_systems_audit.md). Sessions start with
`/auditor`.*

## Start gate

**Open (tag `audit-build`, 1c04f5f6, 2026-11-19).** Build: `_builds/2026-11-19-audit-build/Fantasy Guild.exe` (desktop test build of main, QA panel included).

## Sessions

In the order the owner approved on 2026-11-19 (S0's proposal). **Next: A34** (Combat group). The Effects group is ready to brief (2026-11-20). **Every audit ticket says who takes it** (owner, 2026-11-20): *For: director* (code), *For: content agent* (CMS content, change packs), *For: planning agent* (concept docs, the GDD), or a mix naming each part. Group 8, Telling the player, was interviewed early by topic (owner, 2026-11-19/20) and is ready to brief.
"From S0" lists what the sweep saw in that system, for its session to start
from (details in [S0_sweep.md](S0_sweep.md)).

| Session | System | Group | State | Tickets | Concept docs | Notes | From S0 |
|---|---|---|---|---|---|---|---|
| S0 | Cross-system sweep | — | done 2026-11-19 | 0 | 0 | overlap map, 8 groups, order; A3 merged into A1 | |
| A37 | The Guild Hall and Stars | Effects | done 2026-11-20 | 4 (T-511 to T-514) | 0 | fine as is: nav-only sky, loot payout, stars everywhere, whole-effect ranks, locked stars unworded | Hall exempt by name from some effects, not others; the drop lap ignores its lines' times; Stars reach hero Damage, Accuracy, Swing Time but not Crit, Dodge, Resistance (D2 note); a rank replaces the one below |
| A29 | Equipment and tools | Effects | done 2026-11-20 | 7 (T-515 to T-521) | 0 | fine as is: defeat gear loss stays, chosen cell replaces | two trinkets cap at 5, a perk adds past it; tool Tokens (`acceptedTokens`) and `Requires` unused or unread; heal amounts on drinks and `regen`/`restoreType` unread |
| A27 | Milestone perks | Effects | done 2026-11-20 | 3 (T-522 to T-524) | 1 (concept_milestone_perks.md) | 1 design pass note (flashy level-up); fine as is: no choices, nothing stored, no banner | all 9 perks written with "nearby", which does nothing on a hero |
| A28 | Health, food and defeat | Effects | done 2026-11-20 | 7 (T-525 to T-531; T-253 and T-521 widened) | 0 | enemy health back to full parked on A31; fine as is: drinks never heal (ruled 2026-10-24) | **from A29 (owner 2026-11-20): decide what drinks do: six drinks and a potion carry a heal amount the game ignores (Water 1 to Limeade 30, Shrimp Trawler Potion 5, its tooltip says restores 5); `regen`, `restoreType` unread on 3 items; the defeat losses (10% a gear piece, 25% of carried food and drink) stay but are never shown beforehand**; only Food heals; three HP rounding rules; regen can't be sped up; Wound Time counts only from the next wound; a hero's recovery is silent |
| A31 | The hit | Combat | done 2026-11-20 | 7 (T-532 to T-538; T-253 and T-494 widened) | 0 | Dodge, Crit from the guild already T-512; | resistance sums differ hero vs enemy (the Crab); Poison type vs Venom status; `ignoresArmor` unread |
| A33 | Status effects and boss moves | Combat | done 2026-11-20 | 5 (T-539 to T-543) | 0 | Passive and Active; fine as is: statuses end with the fight; | **from A31 (owner 2026-11-20): Venom deals Poison damage (T-534); decide the same for other damaging statuses (Burn as Fire?); the Toxic Frog lands Venom on every hit, even its Crush tongue**; three ways an enemy lands an effect (kind, rule, move); kind presets and effects move the same numbers; six "how long" clocks |
| A32 | Enemies and encounters | Combat | done 2026-11-20 | 6 (T-544 to T-549) | 0 | fine as is: enemies stand still, never start a fight, one hero each; kinds discovered by fighting | **from A33 (owner 2026-11-20): enemy effects are Passive or Active (T-539); kinds become CMS effects (T-540); the boss flag is cut (T-542)**; a camp at its cap waits a whole interval after a kill |
| A34 | Winning, losing and loot | Combat | | | | | ~~enemy health on return~~ settled in A32 (T-546: keeps damage, heals 5% a second); a kill skips Fail, Preservation, Refresh, neighbour Applies; enemies' written XP ignored |
| A35 | The combat screen | Combat | | | | | fight clock rounds down, other clocks round up |
| A15 | Melee | Combat | | | | | |
| A16 | Ranged | Combat | | | | | **owner ruling 2026-11-20 (silent moments topic): no bow without arrows, work stops with a speech bubble; settle the details here**; arrows run out silently and come from the Bank only; the code leaves an empty quiver to the owner |
| A17 | Magic | Combat | | | | | |
| A18 | Stealth | Combat | | | | | |
| A2 | Spawners and transforms | The living mat | | | | | **owner ruling 2026-11-20 (hover vs card topic): no Tokens turning at random into others; changing into another Token only for a used-up Token that respawns (tree to Stump and back); no content uses turning, retire the mechanic here**; **owner ruling 2026-11-20 (wording drift topic): cut Saplings; trees turn into Stumps and respawn as full trees; settle how oak, fir and the Apple Orchard make new trees here**; five ways to find a spot, four answers to no room; rule spawns announce nothing |
| A4 | Events | The living mat | | | | | removed at once when marked; leaves with no reason given; a buff held in the hand stays; unworked reported as time up; Fish Shoal fished by another model |
| A1 | Placing, reach and removal (A3 merged in) | The living mat | | | | | arrival enemies skip the cap check but count; four removal gestures; a hero lets go when a Foundation is built |
| A40 | Regions | The living mat | | | | | another Region's mat stops while hero clocks and bounties run |
| A41 | Time away and saving | The living mat | | | | | **owner ruling 2026-11-20 (news told twice topic): time away is for a closed game or a sleeping PC; a minimised game keeps playing live; every time away opens the summary (T-506); settle how here**; a kill may count twice in the away summary (reasoned) |
| A8 | Fishing | Gathering | | | | | **from A29: a rod's tier never gates or speeds fishing; T-515 leaves fishing tiers to this overhaul**; **owner direction 2026-11-20 (item sources topic): fishing needs an overhaul: a specific bait per fish or fish by area, tiers of fish each with its own bait, the player choosing the catch by place and gear; the owner may take it to the planning agent ([topic_item_sources.md](topic_item_sources.md))**; **owner ruling 2026-11-20 (silent moments topic): no fishing without bait, work stops with a speech bubble; settle the details here**; two fishing models (catch pool vs Shoal and Shrimp Coast); bait runs out silently, Bank only |
| A7 | Forestry | Gathering | | | | | **owner ruling 2026-11-20 (wording drift topic): cut Saplings; trees turn into Stumps and respawn as full trees; settle how oak, fir and the Apple Orchard make new trees here**; Forests split: oak and fir plant Saplings, birch, maple, mahogany rest; only oak and fir Stumps need their Forest |
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
| A42 | Notifications | Telling the player | done 2026-11-20 (6 tickets, 0 concept docs, by topic) | T-496, T-497, T-501, T-503, T-506, T-507 | | | interviewed 2026-11-20: silent moments ([topic_silent_moments.md](topic_silent_moments.md), T-496 to T-499), wording drift ([topic_wording_drift.md](topic_wording_drift.md), T-500 to T-503), hover vs card ([topic_hover_vs_card.md](topic_hover_vs_card.md), T-504, T-505), news told twice ([topic_banners_twice.md](topic_banners_twice.md), T-506, T-507) |
| A43 | Cards, badges and bars | Telling the player | done 2026-11-20 (17 tickets, 0 concept docs, by topic) | T-488 to T-495, T-498 to T-500, T-502, T-504, T-505, T-508 to T-510 | | | interviewed 2026-11-19: time display ([topic_time_display.md](topic_time_display.md), T-488), chances ([topic_chances.md](topic_chances.md), T-489 to T-491), effect wording ([topic_effect_wording.md](topic_effect_wording.md), T-492 to T-495); 2026-11-20 hover vs card ([topic_hover_vs_card.md](topic_hover_vs_card.md), T-504, T-505), item sources ([topic_item_sources.md](topic_item_sources.md), T-508 to T-510) |

## Groups

Approved by the owner 2026-11-19, in this order. A group is **ready to
brief** once all its systems are done; the planning agent then briefs its
tickets together.

| # | Group | Systems | State |
|---|---|---|---|
| 1 | Effects | A37, A29, A27, A28 | **ready to brief** (2026-11-20) |
| 2 | Combat | A31, A33, A32, A34, A35, A15, A16, A17, A18 | auditing |
| 3 | The living mat | A2, A4, A1 (with A3), A40, A41 | waiting |
| 4 | Gathering | A8, A7, A6, A9 | waiting |
| 5 | Making | A10, A11, A12, A13, A14 (rules only), A5 | waiting |
| 6 | Heroes and the guild | A26, A30, A36, A38, A39 | waiting |
| 7 | Specialist skills | A19 to A25 | waiting |
| 8 | Telling the player | A42, A43 | **ready to brief** (owner 2026-11-20): T-488 to T-510, 23 tickets, from eight topic files (`topic_*.md`); interviewed by topic out of the approved order at the owner's choice |
