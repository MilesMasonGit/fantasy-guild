# Topic: where an item comes from (the card and the Encyclopedia)
*Telling the player group (A42, A43). Read at tag audit-build (1c04f5f6),
interviewed with the owner 2026-11-20. From S0 part 5, "The card and the
Encyclopedia work out where an item comes from with two different readers".*

## The rule (owner, 2026-11-20)

- **The Encyclopedia shows everything the game really does.** Every way the
  game pays out an item appears: Guild Hall star production (and the Well at
  the guild's rank), events as a source of their Tokens, bonus drops, every
  catch pool. If the card can show it, the Encyclopedia lists it, from the same
  rules the game runs. Live bonuses stay out of it and its chances say "base"
  (chances topic, T-490).
- **Amounts in the Encyclopedia, like the card**: `Copper Comet ×6`,
  `Fish Shoal ×4 · 70%`.
- **The card shows bonus drops** a working hero brings (from a potion or
  gear) under Makes, marked as a bonus: `Bird Nest 25% · bonus (Ana's
  Birdwatcher)`, with its badge.
- **Fishing needs an overhaul** (owner): "I want fish catching to require a
  specific bait for each fish, or have only certain fish available in certain
  areas. Perhaps we could have multiple tiers of fish, each with a unique bait
  type. That way the player can choose what they're going to catch by going to
  the correct area, and equipping the right items." The owner may take it to
  the planning agent; it is recorded on **A8 Fishing**'s STATUS row. How the
  Encyclopedia lists catch odds waits on that redesign.

## What the game does today

The Encyclopedia reads the progression ledger (the world model the CMS also
uses), built from the same content but not from events or the Hall sky, and
with no live state. The card reads the registries and engine helpers. Read
by a read-only subagent and checked against the code:

| What | Token card | Encyclopedia |
|---|---|---|
| Bait changes catch odds (River Salmon 30 % plain, 60 % with Worm Bait) | every pool by tool and bait | the first pool only; one row per Token and item is kept, the rest dropped |
| Guild Hall production (Woodpile pays Oak Wood; others Copper Ore, Stone, Coal) | lists the star lines and the Well's Water at the guild's rank | only the Hall's own trickle and the Well at rank 1; never the star lines |
| Event Tokens (Copper Comet, Fish Shoal) | shown, with what they give | what they give, but no way to get the event |
| A bonus drop from a hero's potion or gear (Birdwatcher: Bird Nest 25 %) | nowhere | listed |
| Amounts (Copper Comet ×6) | min–max | odds only |
| Live bonuses (Lucky, catch weight, Double Item) | counted | not counted (T-490 labels it base) |
| Latent: a spawn with no weight | the engine never picks it | the ledger counts it as weight 1 |
| Latent: the same item twice from one Token (outputs and rare table, two pools) | both rows | the second row dropped |

No difference found for enemy loot, Shop prices, build recipes; Field seeds
match in different units (per sowing on the card, per harvest in the book).

## What it became

- **T-508**: the Encyclopedia lists every real source: Hall star production and the Well at rank, events, no rows dropped, and a spawn's weight read as the engine reads it.
- **T-509**: amounts in the Encyclopedia, as on the card.
- **T-510**: the card shows a working hero's bonus drops under Makes, marked bonus.
- A8 Fishing: the owner's direction for a fishing overhaul.

All tickets blocked on the Telling the player group.

## Evidence

- The Encyclopedia's content, no events or Hall sky → `src/ui/components/encyclopedia/encyclopediaModel.js:30-38`
- One row per Token and item kept (`how|via` key) → `encyclopediaModel.js:136-149`
- Catch pools, one ledger rule each → `src/systems/progression/ledger/engine.js:428-437`; card pools → `src/ui/components/board/tokenCard.js:296-304`, `TokenCard.jsx:353, 368`
- Ledger trickle only → `engine.js:399-405`; card's Hall lines and Well at rank → `src/systems/board/PassiveProduction.js:72-81`, `tokenCard.js:464-470`
- Event Tokens on the card → `tokenCard.js:389-396`
- Bonus drops as ledger rules → `engine.js:530-555`; card Makes only the Token's outputs → `tokenCard.js:213-221`
- Amounts: card → `TokenCard.jsx:307-309, 425, 481`; Encyclopedia odds only → `src/ui/components/encyclopedia/EncyclopediaChartView.jsx:82-85, 244`
- Spawn weight: engine skips a missing weight → `src/utils/weightedPick.js:13-15`, `src/systems/board/SpawnerSystem.js:85`; ledger `weightOf` → `engine.js`
