# Topic: how chances are written
*Telling the player group (A42, A43). Read at tag audit-build (1c04f5f6),
interviewed with the owner 2026-11-19 in two rounds. From S0 part 5, "Chances
are rounded five ways, and the Encyclopedia ignores Lucky".*

## The rule (owner, 2026-11-19)

| Case | Reads | Rule |
|---|---|---|
| Any chance | `40%`, `12.5%`, `33.3%`, `0.17%`, `0.005%` | **One decimal**, trailing `.0` dropped; **under 1 %, two significant figures** so a rare find never reads `0%`. Covers drop and output rows, recipes, turning, catches, rare finds, badges, effect sentences, and crit, accuracy and dodge (today two decimals). |
| The % sign | `40%`, `+12.5%` | **No space** before it. |
| A certain output (100 %) | Recipe: `1× Charcoal`; drops: `Bones 100%` | Shown **only in odds lists** (drops, catches, rare finds), so every row there has a number; hidden in recipes and Makes rows. Today's behaviour, now the rule. |
| Bonuses in a shown chance | Card: `Rare finds 1.2%`; Encyclopedia: `1% base` | **Live places count bonuses** (a Token on the mat shows the chance it will really roll). **Reference places** (the Encyclopedia, the recipe list) show the authored chance **labelled "base"**: they have no one hero or Token to count bonuses from. |
| Where a live chance's extra comes from | hover: `1% base · Lucky ×1.2 (Ana's ring) · = 1.2%` | **On hover**: base, each bonus with its source, the result. The number on the card stays bare. |
| A bonus that multiplies a chance (Lucky's percentage) | `Lucky: rare find chance ×1.2` | Worded **as a multiplier**, never `+20%`, which reads as 20 points. A flat Lucky (it adds points, +1 turns 1 % into 2 %) keeps reading in points. |

## What the game does today

| Rounding | Looks like | Writer | Shown in |
|---|---|---|---|
| As typed in the CMS | `40%`, any decimals typed | row view models in `tokenCard.js`, `TokenCard.jsx`, `RecipeList.jsx`, `recipeText.js`, `idlePlate.js`, `statementText.js` (procs, drops, spawns) | Card Makes and drop rows, recipe list, recipe text `(40%)`, the idle Token hover, effect sentences |
| One decimal | `12.5%` | `percent` (`tokenCard.js`), `formatPercent` (`lifecycleLines.js`), `chanceText` (`EncyclopediaChartView.jsx`), `asPercent` (`statementText.js`), the catch share (`tokenCard.js`) | Turning on the card and drawer, the Encyclopedia, effect sizes, fishing catches |
| One decimal, under 1 % two figures | `0.17%`, `0.005%` | `rareChanceText` (`tokenCard.js`) | Rare finds on the card. **This becomes the rule.** |
| One decimal, under 0.1 one figure | `0.05%` | `figure` (`effectBadgeText.js`) | Effect badges |
| Two decimals | `12.34%` | `pct` (`HeroCombatView.jsx`) | Crit, accuracy, dodge in the hero's combat view |
| One decimal, with a space | `12.5 %` | `amount`, tags (`supportTags.js`) | The card's boosts block |

- **100 %**: the Makes rows drop it (`makesOf`), the drop rows keep it (`dropsOf`).
- **Lucky**: the card's rare finds read the chance with Lucky (`src.rareChance` → `RareTables.luckyChance`); the Encyclopedia reads the authored line chance, unlabelled.
- **Lucky's sentence** today: "a 20% higher chance on their rare drop table", which reads as points.

## What it became

- **T-489**: one way to write a chance, by the rule above (rounding, no space, 100 % only in odds lists).
- **T-490**: shown chances say whether bonuses are counted: "base" in the Encyclopedia and recipe list; the card's live chance explains itself on hover (base, each bonus and its source, the result).
- **T-491**: Lucky's percentage worded as a multiplier (`×1.2`), a flat Lucky in points.

All three blocked on the Telling the player group.

## Evidence

- Card rows as typed, 100 % dropped vs kept → `src/ui/components/board/tokenCard.js:213-232`; drawn → `src/ui/components/board/TokenCard.jsx:309, 323, 458, 483`
- `rareChanceText` → `tokenCard.js:234-239`; rare finds with Lucky → `tokenCard.js:242-253`, `TokenCard.jsx:436-448`
- Catch share, one decimal → `tokenCard.js:275`
- Turning `percent` → `tokenCard.js:371, 403, 418`; `formatPercent` → `src/ui/components/drawer/lifecycleLines.js:50-53`
- Idle hover, as typed → `src/ui/components/board/idlePlate.js:49`
- Recipe list and text, as typed → `src/ui/components/board/RecipeList.jsx:106-110`, `src/ui/components/board/recipeText.js:43`
- Encyclopedia one decimal, no Lucky → `src/ui/components/encyclopedia/EncyclopediaChartView.jsx:82-85`; source chances → `encyclopediaModel.js:140, 146`
- Effect sentences → `src/systems/effects/statementText.js:152-159, 192, 253, 748, 838, 878, 919`
- Badges → `src/ui/components/board/effectBadgeText.js:26-42`
- Combat view two decimals → `src/ui/components/dock/HeroCombatView.jsx:26, 78-84`
- Boosts block with a space → `src/ui/components/board/supportTags.js:11-19, 40-45`
- Lucky is a share of the table's chance or flat points; its sentence → `src/config/registries/modifierPalette.js:477-501`; `luckyChance` → `src/systems/board/RareTables.js:26`
