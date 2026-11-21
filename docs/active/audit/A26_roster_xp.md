# A26: Roster and XP
*Read at tag audit-build (1c04f5f6), 2026-11-21.*

## In one paragraph

There is no hiring screen: the first hero comes from the new-game screen, and
each rank of the Hall's Bunk Beds star recruits one more on the spot, up to 8
(rank n costs 10 x n Oak Wood, a placeholder in code). Every hero holds every
skill (20) from level 1, on the RuneScape curve to 99 (about 13 million XP).
XP bonuses add up per skill, kills included. Heroes can't be dismissed and
never die: at 0 health they are wounded and limp home.

## What really happens underneath

- **Recruits aren't identical**: a Hall recruit arrives with the Hall's "XP
  for Everyone" gift, against the GDD's "every new hero is identical".
- **Recruits wear a generic portrait** that isn't in the picker (the player
  can change it).
- **The XP bonus is a true percentage**, but any award is raised to at
  least 1, so a 0.4 award pays 1.
- **Hero level** (the average of skills) is worked out but shown nowhere.
- **The roster cap, Bunk Beds price, the skills and the curve** are code,
  not CMS.
- **No dismissing, no permadeath** (a vestigial "wounded until" field).
- **Skill levels give no speed** (your ruling); a no-op helper remains.

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

- Bunk Beds, cap 8, price → `src/config/guildUpgrades.js:15-27, 72-89, 147-160`, `src/systems/progression/GuildUpgradeManager.js:170-175`
- First hero → `src/systems/core/EngineBootstrap.js:291-298`; new hero → `src/systems/hero/HeroGenerator.js:26-35, 48-49, 75-85`; recruit gift → `src/systems/hero/logic/HeroLifecycle.js:12-16, 40-52`
- Curve → `src/utils/XPCurve.js:9, 17-25`; bonus → `src/systems/hero/xpBonus.js:22-35`, `src/systems/hero/SkillSystem.js:57-63, 89-90`
- Wounded → `src/systems/board/BoardCombat.js:555-604`, `src/systems/board/Orders.js:40-44`
