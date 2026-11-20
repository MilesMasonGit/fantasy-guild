# Topic: how effects are worded
*Telling the player group (A42, A43). Read at tag audit-build (1c04f5f6),
interviewed with the owner 2026-11-19 in two rounds. From S0 part 5, "One
effect, three wordings, opposite signs, on one card". The effect names
themselves were settled earlier ([UI_STYLE.md](../../reference/UI_STYLE.md#effect-names-owner-2026-11-11), T-403);
this topic settles how they are written around a number.*

## The rule (owner, 2026-11-19)

| Case | Reads | Rule |
|---|---|---|
| A short tag (a Token's badge, a building's Boosts list) | `Speed +25%`, `Growth +10%`, `Efficiency +20%`, `Double Loot 10%`, `Abundance +1`, `Bird Nest 5%`, `Lucky ×1.2` | **The effect's name, then its number, good always plus.** A building's Boosts list reads exactly like the badge it causes. A chance is plain (no sign), a multiplier `×` (Lucky, T-491). |
| A rule line (perks, Hall stars, gear, a building's rules, the CMS preview) | `Speed +5% on Mining Tokens`, `Growth +10% on every Forest`, `Lucky ×1.2 on Veins` | **Name and number first, then where or when.** The same words as the badge it produces, so a player can match a perk to a badge. |
| What an effect means | hover `Speed`: "a cycle takes 25% less time" | **Every effect name explains itself on hover**, wherever it appears (badge, Boosts list, rule line, Encyclopedia), in clear plain words (owner: "we'll need clear descriptions for the hover tooltips that explain what these keywords mean"). |
| An effect working against the player | `Speed −10%` (red), `Failure 5%` (red) | **Same name, minus, red.** A bad chance keeps its own name and reads plainly. The colour carries good or bad, as the badges already do. |
| Other time effects | `Recovery +10%`, `Lap Speed +10%`, `Swing Speed +10%` | **Renamed to a speed word**, like Speed and Growth, so good stays plus. Today Wound Time (3 uses in content), Lap Time (3), Swing Time (1). |
| What Speed means | `Speed +25%`: 10 s → 7.5 s | **Unchanged**: it cuts a cycle's time by that share; stacked Speed still meets its floor. Words only. |

## What the game does today

| Place | Writer | Speed reads | Others read |
|---|---|---|---|
| Badge on the Token card (what the Token gets) | `effectBadgeText.js` from `EffectBreakdown.js` | `Speed +25%` | `Growth +10%`, `Efficiency +20%`, `Double Loot 8%`, `Abundance +2`: good is plus (the breakdown flips time and cost) |
| Boosts block on a building's card (what it gives) | `supportTags.js` | `−25 % work` | `−10 % grow`, `−20 % input`, `+1 harvest`, `×2 loot 10 %`, `+Bird Nest 5 %`, `−5 % fail`, `−1 s work` (flat): the raw number, so a time cut is minus, and no effect names |
| Rule sentences (perks, Hall stars, gear, building rules, the CMS) | `statementText.js` with each effect's `reads` in `modifierPalette.js` | `work 25% faster` | `grow and refill 10% faster`, `use 20% less of every input`, `a 10% chance of double loot`, `award 10% more XP`, `recover from a wound 10% faster`, `10% shorter` (lap): no effect names |

## What it became

- **T-492**: a building's Boosts list writes each effect as its badge does (name, good-is-plus).
- **T-493**: rule lines lead with the effect's name and number, then where or when; builds on T-403 (the names) and T-491 (Lucky ×1.2).
- **T-494**: Wound Time, Lap Time and Swing Time renamed Recovery, Lap Speed and Swing Speed (good-is-plus), the style guide's names table updated; effects against the player read minus in red, bad chances plain in red.
- **T-495**: every effect name explains itself on hover, one plain description per effect, written once and used everywhere.

All blocked on the Telling the player group.

## Evidence

- Badge numbers, sign flipped for time and cost → `src/systems/board/EffectBreakdown.js:159-172, 417-433`; written → `src/ui/components/board/effectBadgeText.js:26-42`
- Boosts tags, raw sign, no names → `src/ui/components/board/supportTags.js:14-50`; drawn → `src/ui/components/board/TokenCard.jsx:393-419`
- Sentences: `magnitude`, `effectSegments` → `src/systems/effects/statementText.js:156-268`; each effect's `reads` → `src/config/registries/modifierPalette.js:172-174, 185, 203, 242, 261, 294, 364, 377-380, 392-395, 489-494`
- Sentence readers → `src/systems/progression/hallStarText.js:3`, `src/ui/components/dock/heroPerks.js:7`, `src/ui/components/dock/heroCombatStats.js:4`, `src/systems/board/Restrictions.js:9`, `cms/src/utils/constants.js:51`
- Effect uses in content (by type and bucket, at the tag): Work Time 30, Grow Time 39, Wound Time 3, Lap Time 3, Swing Time 1, all percentages; no flat Work Time
- Names table → `docs/reference/UI_STYLE.md`, "Effect names (owner, 2026-11-11)"
