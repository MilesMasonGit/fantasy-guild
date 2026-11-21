# A36: Items and the Bank
*Read at tag audit-build (1c04f5f6), 2026-11-21.*

## In one paragraph

Every item kind takes one Bank slot; a tab holds 64 kinds, and the Hall's
Bank Tabs star adds tabs up to 16 (a placeholder price in code). Stacks have
no real limit. With the Bank full, new items wait on the mat as loot, said
once per item. Search covers all tabs; sort orders by type, tier and name.
Items leave the game through recipes, Hall upgrades, settling, upkeep,
eating, ammo, bait, bounties and defeat; nothing can be sold or thrown away.

## What really happens underneath

- **An item's effects show only once worn**: the tooltip and the drawer
  list no effects (17 items carry some: drinks, potions, the dagger, bow,
  cleaver, rod, Bodkin arrow); the GDD says the drawer shows everything it
  does (T-495 covers effect hovers).
- **Stack limits are dead**: no item sets one, every item stacks; the "stack
  full" refusal never happens.
- **No discard**: an unwanted item stays forever (a "later Sell and Discard"
  note).
- **Starting slot numbers disagree** (20 or 64), harmless.
- **Tabs, slots and prices** are code, not CMS.

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

- Tabs, slots → `src/config/guildUpgrades.js:29-32, 75-76, 135-146`, `src/systems/progression/GuildUpgradeManager.js:208-211`
- Stacks → `src/config/registries/itemRegistry.js:24`, `src/systems/inventory/InventoryManager.js:67-74, 164-202`
- Full Bank → `src/systems/board/SpriteLayer.js:54-58, 459-462, 581-588`
- Effects not in tips → `src/ui/components/drawer/ItemTip.jsx:78-104`
- Search, sort → `src/ui/components/drawer/bankSort.js:9-65`
