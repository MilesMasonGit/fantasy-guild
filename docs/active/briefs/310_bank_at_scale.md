# Brief 310 — The Bank at scale: 64 per tab, search by tag and type, Sort

*Written 2026-10-29 by the planning agent from the owner's interview of the
same day. Concept: [concept_knowledge.md](../concept_knowledge.md), "The Bank
at scale".*

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, `docs/reference/UI_STYLE.md`, the
concept section, GDD §5 (the Bank), §8 (Hall upgrades: Bank Slots, Bank
Tabs).

Code to start from (verify): `src/ui/components/drawer/BankTab.jsx` (tabs,
search, select mode, drag), `src/systems/inventory/InventoryManager.js`
(slots, `maxTabs`), `src/config/guildUpgrades.js` and
`src/systems/progression/GuildUpgradeManager.js` (Bank Slots, Bank Tabs),
`src/state/StateSchema.js`, `src/systems/core/SaveMigration.js`.

⚠️ **Tier for sorting**: the owner's plan tier (`plan.tier`, brief 290) is
stripped from game data. Use the item's own `tier` where it has one (gear,
24 items today); items without one sort after those of their type, by name.
If brief 290 later syncs a game-side tier, Sort picks it up. Stop and report
if this ordering reads badly in the game.

## Phases

| Phase | What | Tier |
|---|---|---|
| B1 | **64 kinds per tab.** A tab holds 64 kinds; a Bank Tabs rank adds a tab and its 64 slots (16 tabs = 1,024); a new kind with no free slot in any tab stays on the mat as loot (as today). **Bank Slots retires** from the Hall's upgrade web; a save's bought Bank Slots ranks are dropped silently and its items keep their tabs (none lost: if a tab would hold more than 64 after loading, the extra spill into tabs with room, or the save keeps them until moved; stop and report if neither is clean). | builder |
| B2 | **Search and Sort.** The search matches name, **tag** and **type** (and the hands label, e.g. "Hand"). A **small Sort button beside Select**; clicking it offers **this tab** or **the entire Bank**; sort is type, then tier, then name; the entire Bank sorts each tab in place. Manual order holds until Sort is pressed. | builder-lite |

## Done when

- Gate green (`TESTING.md`); no engine work change.
- In the running game: with 2 Bank Tabs ranks there are 3 tabs of 64 slots;
  Bank Slots is gone from the upgrade web; typing "Weapon" shows every weapon
  across tabs, "Hand" shows hand items, "Copper Dagger" the dagger; Sort →
  this tab orders the tab by type, tier, name; Sort → entire Bank does it to
  every tab without moving items between tabs; an old save with Bank Slots
  ranks loads with every item.
- One eye-check after B2.

## Owner to-do

- In the CMS, give items useful **tags** where search should find them by
  group (e.g. Weapon, Ore, Fish); untagged items are still found by name and
  type.
