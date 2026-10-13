# Work Permissions: the drawer and its place on the hero bar

*From the owner's refinement pass ([refinement_pass_todo.md](refinement_pass_todo.md)
§2, "Work Rules Menu & Hero Bar Integration"). Owner interview, 2026-10-13;
**done** (owner closed it). Builds on brief 30's rules grid
(`WorkRulesDrawer.jsx`, `workRules.js`); the look follows
[UI_STYLE.md](../reference/UI_STYLE.md). Build ticket: **T-164**.*

## The name

- **"Work Permissions"** everywhere a player reads it: the launcher's label,
  the drawer's title, tooltips, tutorial text. Code names stay as they are.

## The launcher

- **The left end of the hero bar, in its own framed slot** the height of a
  hero tab: the gear sprite and the label "Work Permissions", with a divider
  between it and the heroes. It replaces today's bare gear.
- It is **the only way in**: the hero panel's Work Rules button and its small
  link go (with T-156).

## The drawer

- **Slides up from the bottom, the full width of the playmat**, and sits
  directly above the hero bar, so the heroes stay visible.
- It is one of the three drawers that close each other (T-152).
- **Layout**: hero names on the left; the columns **share the remaining width
  evenly**, so cells are large and easy to click at any column count.
- **Every skill column is always shown**, Advanced and Master included; a cell
  for a skill the hero doesn't hold stays blank.

## One Combat column

- **One "Combat" column** replaces today's per-combat-skill tint columns and
  the Fight column: each hero has one combat skill, so the cell simply turns
  that hero's fighting on or off.
- The cell is a **plain tick or off**, like every other cell.
- **Priority mode includes Combat**: a hero can rank fighting against their
  work skills (Fishing 1, Combat 2). ⚠️ Check the engine accepts a priority on
  the Fight rule before building the cell; if it doesn't, stop and report.

## Column header tooltips: what a skill is for

The header tooltip says **what the skill does and what it feeds**, never how
to click. Lines live with each skill's definition (`skillRegistry.js`, a new
`purpose` field beside `description`). Drafted by the planning session; **the
owner adjusts them afterwards**.

| Column | Purpose line |
|---|---|
| Mining | Mines ore, stone and gems from veins, for Smithing, Crafting and Construction. |
| Forestry | Fells trees for logs, sap and bark, for Construction, Crafting and fuel. |
| Fishing | Catches fish and finds from the water, for Cooking and Crafting. |
| Farming | Plants and harvests crops, fruit, herbs and saplings, for Cooking, Alchemy and Forestry. |
| Smithing | Smelts ingots and forges tools, weapons and metal armour for heroes. |
| Crafting | Makes rope, cloth, glass, leather gear and the everyday parts other skills need. |
| Cooking | Cooks food and drinks that heal heroes in fights. |
| Alchemy | Brews potions heroes use in fights and at work. |
| Construction | Builds stations and buildings on Foundations, and takes down marked Tokens. |
| Combat | Fights enemies within the hero's reach for loot, Maps and combat XP. |

Advanced and Master skills are placeholders today: their tooltip shows their
existing `description` until they have mechanics and a purpose line.
