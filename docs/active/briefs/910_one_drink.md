# Brief 910 — One drink at a time

*Written 2026-11-26 by the planning agent from the owner's ruling the same day (via the balancer,
then the planning agent's three questions). Closes T-738. The ledger's side is brief 900 B7 part (3).*

**What the player gets.** A hero carries one boost drink at a time: drinks, work potions and elixirs
are all drinks and share the one Drink slot. Poisons, Bait, arrows and Motes give no buff and stay
as they are, as many as the loadout holds.

## Rulings (owner 2026-11-26)

1. "One drink, one other type of boost item (such as scrolls). Drinks, potions, elixirs, these are
   all the same. Consumables like poisons, bait, arrows, motes all don't provide buffs so they're
   different."
2. **One drink always**: the Loadout Slots Hall star never adds a Drink slot (the balancer's budget
   counts one); it may still add slots for other kinds.
3. **The second boost slot waits for scrolls**: nothing built for it now (scrolls are on the ideas
   list, undesigned).
4. **Old loadouts are not handled**: a save holding several potions is refused anyway by brief 890
   S1 (start fresh), so **this lands after 890 S1**.

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, `docs/reference/ARCHITECTURE.md`, BALANCE_RULES section 5.
Code read 2026-11-26 (the code wins): `src/config/registries/equipmentCategories.js` (Drink is
sustenance with cap 1; Consumable is uncapped and holds potions, elixirs, poisons, bait, arrows,
Motes), `src/systems/equipment/loadoutCaps.js` (the Loadout Slots effect raises a category's cap),
`src/systems/core/consumableRule.js` (doses), the equip check in `EquipmentManager`. **Stop and
report rather than guess.**

## The phase

| Phase | Ticket | What | Tier | Needs |
|---|---|---|---|---|
| W1 | T-738 | Work potions and elixirs count as **Drinks**: one Drink slot, cap 1, holds any one of them; a second is refused with the usual "full" message. The Drink cap ignores Loadout Slots. Poisons, Bait, arrows and Motes keep the uncapped Consumable class. First report **how the game should tell a boost item from a plain one** (recommended: by its CMS category, with potions and elixirs moved to Drink in a content change pack from the content agent; or by whether it carries a buff effect) and whether a drink drunk on need (sustenance) and a potion's dose of cycles can share one slot cleanly; the director decides. Tooltips, the hero sheet and the CMS item editor say Drink. | builder | 890 S1 |

## Done when

- The gate passes; the work check moves only if a bench scenario carries several potions (say which).
- In the running game: a hero with a drink can't take a potion, and the refusal reads plainly; a
  potion alone works and its dose counts down; Bait, arrows and Motes stack as before; the Loadout
  Slots star adds no Drink slot.
- **Eye-check: no** (a refusal message and a label; one line in STATUS).

## Owner CMS to-do

Review and Sync the content agent's pack that moves potions and elixirs to Drink, if the director
picks the category route.
