# Brief 620 — Star upgrades: the new Star effects and the full Hall star plan

*Written 2026-11-12 by the planning agent from the owner's interview of the same day. Source:
[star_ideas_review.md](../star_ideas_review.md) ("Stars vs Buildings", the picks, and "Upgrades interview
2026-11-12"), [BALANCE_RULES.md](../../reference/BALANCE_RULES.md) section 5 (the boost budget, payback prices),
UI_STYLE's effect names. Code facts are a first look; verify them.*

**What the owner wants.** The Guild Hall's stars become the permanent, guild-wide upgrades the owner picked: small
steps, many ranks, opening tier by tier, in every skill's constellation, plus the Star-only effects that don't
exist yet. Buildings are the other half ([brief 630](630_building_upgrades.md)).

## The owner's rulings (2026-11-12)

- **Rank size**: about **1 % a rank is the baseline**; the size depends on the kind of boost. The content agent sizes
  each kind against the boost budget (BALANCE_RULES section 5), so Yield ranks may be bigger than a chance's.
- **Ranks open by material tier**: each star has **a few ranks per tier** (copper, iron, silver, mythril, gold,
  adamantine, darkmetal), priced in that tier's materials by the payback rule. Every tier brings new ranks.
- **Per skill, in each skill's constellation**, as today: only the effects that suit a skill appear (Preservation
  for crafting skills; Refresh, Lucky and Giant Harvest for gathering).
- **Five new Star-only effects are built here**, engine first (E1 to E4 below).
- **Giant Harvest**: any gathering cycle.
- **XP for everyone**: one star; each rank gives every hero XP in **every skill**; new recruits arrive with it.
- **Drinks**: two stars, **Long-lasting Brews** (work drinks, potions and fight elixirs last longer) and **Strong
  Drink** (their effects are stronger).
- **Combat**: **a constellation per style** (Melee, Ranged, Magic, Stealth) with Damage, Attack Speed and Accuracy
  stars for heroes fighting in that style.
- Already ruled (2026-11-11): the Lore stars (XP bonus) retire (T-400); XP comes from buildings only.

## Read first

`CLAUDE.md`, `docs/reference/ARCHITECTURE.md`, `docs/reference/TESTING.md`, `docs/reference/CONTENT_PHILOSOPHY.md`,
BALANCE_RULES section 5, the star review's picks, brief 590 (how Preservation, Refresh and Lucky were added: the
same steps apply).

Code to start from (verify):
- **Stars**: `data/hallStars.json` (authored in the CMS only): constellations, stars, `ranks[]` each with `tier`,
  `price`, `rules`. Today 37 stars: Speed (`WORK_TIME`), Yield and Growth per skill, at 6 %, 12.6 %, 20 % over 2 or
  3 ranks; the hearth (Infirmary `WOUND_TIME`, Larder and Trinket Case `LOADOUT_SLOTS`), wells, laps
  (`PASSIVE_LAP`) and the compass.
- **Adding an effect type**: an `EFFECT_TYPES` key (`src/systems/effects/constants.js`), a `modifierPalette.js` row
  (CMS), `statementText.js`, the render goldens. `FOOD_HEALING`, `DOUBLE_DROP`, `LOOT_MULT`, `SWING_TIME`, `DAMAGE`,
  `ACCURACY` already exist.
- **Doses**: `src/systems/core/consumableRule.js` (`DOSE_LENGTH`), `startWorkDoses`, `startFightElixirs` (T-338
  touches the same code).
- **The Hall sky**: `HallSky.jsx`, the Upgrade panel (brief 570); star positions are authored (`node`).

## Needs

- **Brief 590** (merged): Preservation, Refresh, Lucky.
- **T-400** (the owner deletes the Lore stars in the CMS) before C1's pack, so the pack doesn't fight them.
- **T-336** before any Lucky star or rare table content (the ledger would read every gem as luck only).
- E3 and **T-338** (dose lengths) touch the same code: one after the other; say which went first.

## Phases

| Phase | What | Tier |
|---|---|---|
| E1 | **Giant Harvest.** A new proc effect (CMS label **Giant Harvest**): a chance a **gathering** cycle's drops come in at **ten times**. All of the cycle's drops, rare table included (one rule for every drop, owner 2026-11-11); with Double Loot too, both apply. The category is a gathering skill. A **small celebration on the mat** over the Token (a burst and a "Giant!" float, using the existing float and fx pieces). ⚠️ No draw when no rule offers the chance; a failed cycle rolls nothing. | engineer |
| E2 | **XP for everyone.** A new effect for a Hall star (CMS label **XP for Everyone**): each rank bought gives **every current hero** a set amount of XP **in every skill**, once, at purchase; heroes **recruited later** arrive with the total of every rank bought. Nothing is given twice (on load, on rank re-reads). Level-ups it causes are announced once per hero, not once per skill. Say how a recruit's starting XP is stored. | engineer |
| E3 | **Long-lasting Brews and Strong Drink.** Two new effects: one makes **work drinks, potions and fight elixirs** last longer (more cycles, or longer in a fight); the other makes their effects stronger (a percentage on each modifier they give). Narrowed by item kind (the loadout kinds). The hero's tooltip and the drink's text show the boosted numbers. | engineer |
| E4 | **Combat stars.** Hall stars can give heroes **Damage, Attack Speed and Accuracy for one combat style** (the hero's style in that fight). Check whether a guild-reach rule reaches a hero's combat numbers today (530 X1 did this for XP); add it if not. Four constellations, **Melee, Ranged, Magic, Stealth**, exist for the CMS to fill (with a place on the sky). | builder |
| C1 | **The star plan** (content agent, with the owner). Every constellation's stars and ranks by the rulings above: Speed, Yield, Growth, Double Loot, Preservation, Refresh and Giant Harvest per skill where they suit; the hearth (Infirmary, Larder, Trinket Case, Food heals more with `FOOD_HEALING`, XP for Everyone, Long-lasting Brews, Strong Drink); the four combat constellations; wells, laps and the compass kept. **Today's stars retuned** to the new sizes and tiers. Ranks sized from the 1 % baseline by kind and checked against the boost budget; prices by payback in each tier's materials. **BALANCE_RULES section 5 updated**: the Hall's XP share moves to buildings (Lore stars retired), and the rank rule written in. A list to the owner first, then a CMS pack staged in the scratchpad and checked by script; the owner accepts and Syncs on `main`. Lucky stars wait for C2. | content agent |
| C2 | **Rare tables and Lucky stars** (content agent), after T-336: rare tables on gathering Tokens and enemies (finds a day, BALANCE_RULES section 4), then the Lucky stars per gathering skill. Same pack routine. | content agent |

Order: E1 to E4 (E1, E2 and E4 may run side by side; E3 after or before T-338, one at a time), then C1, then C2.
The director greps `src/` and `cms/src/` for any star id the pack renames or deletes before the owner Syncs.

## Done when

- Gate green (`TESTING.md`). **E1 to E4: engine work same** (no content uses them). **C1 and C2: WORK CHANGED is
  expected** (the stars change); the director records the new baseline.
- **Tests**: each new effect at 100 % and 0 %, from a Hall star; Giant Harvest's ten times with a rare drop and with
  Double Loot; no draw without a rule; XP for Everyone given once to current heroes and to a later recruit, never on
  load; a drink lasting longer and stronger; a combat star applying only in its style.
- **In the running game, named as verified**, with QA stars: a Giant Harvest and its celebration; a recruit hired
  after XP for Everyone with the XP; a drink's tooltip showing the longer and stronger numbers; a melee star changing
  a melee hero's damage and not an archer's; after C1, the Hall sky with the new constellations and ranks.
- GDD (the Guild Hall, effects) updated; changelog entries.

**Eye-check: yes**: one after E1 (the Giant Harvest celebration) and one after C1 (the Hall sky, the new stars and
their prices).

## Not in this brief

- Buildings and their variants ([brief 630](630_building_upgrades.md)).
- Effect badges (brief 600, already showing any of these as they arrive).
- Events (their own planning session).

## Owner to-do

- T-400: delete the Lore stars in the CMS and Sync on `main` (if not already done).
- C1 and C2: review the content agent's lists, accept the packs, Sync on `main`.
- Two eye-checks.
