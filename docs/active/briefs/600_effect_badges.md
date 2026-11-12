# Brief 600 — Effect badges on the Token card

*Written 2026-11-11 by the planning agent from the owner's interview of the same day. Source:
[concept_effect_badges.md](../concept_effect_badges.md) (the design, approved). Code pointers below are a first
look; verify them.*

**What the owner wants.** The Token card shows, right under its stats line, a row of badges: one per named effect
boosting this Token (Speed, Yield, Double Loot, Preservation…), each an icon and its total. Hovering one lists every
source (a Hall star, a building nearby, the working hero's gear) and the total. Item effects sit on their item's line;
rare drop tables get a clickable Rare finds group; a hero's carried items wear their own badge in the Hero drawer.

## Read first

`CLAUDE.md`, `docs/reference/ARCHITECTURE.md`, `docs/reference/TESTING.md`, the concept doc, UI_STYLE's "Effect
names" table (the list and its order) and "Item references".

Code to start from (verify):
- **The card**: `src/ui/components/board/TokenCard.jsx` (`StatsSection`, `SupportSection`, `MakesSection`,
  `DropsSection`, `RequiresSection`) and its data, `tokenCard.js` (`CARD_BLOCK`, the SUPPORT block from
  `SupportLinks.boostedBy`, `boosts`, `floorHits`).
- **The sums**: `TileModifiers.resolveAxis` (tile, guild and hero buckets), `ModifierAggregator`, `GuildModifiers.js`,
  `LiveEffects.js`; the rule text in `statementText.js`. Today nothing returns a **per-source breakdown**; check.
- **The Hero drawer's slots**: `src/ui/components/drawer/HeroInspectionSheet.jsx` and `dock/DockEquipmentGrid.jsx`
  (after brief 570).

## Needs

- **Brief 590** (Preservation, Refresh, Lucky, rare tables) for those badges and the Rare finds group. B1 to B3 may
  start before it lands and add those three when it does; say which way you went.
- **Brief 570** (the Hero Inspection Drawer) for B4.

## Phases

| Phase | What | Tier |
|---|---|---|
| B1 | **The look pick.** A screenshot comparison page of **two or three looks** (a letter each): the badge row on a gathering card, a station card and an enemy card; one badge's hover; an item-line badge; a gold "held at the limit" badge; the Rare finds group closed and open; the Hero Effects badge. Mock-ups or the real game. The owner picks; only that look is built. | builder |
| B2 | **The breakdown.** A read-only function: for a Token instance (and its working hero, if any), each **named effect** with its **sources** (kind, name such as "Hall star Deep Soil III", "Forge nearby", "Mira's gloves", amount) and **total**, and whether a limit holds it (the amount that counts). It must use the **same sums the engine uses** (no second copy of the maths), so the badge always equals what happens. Item effects (Double Item per output, Efficiency per input) come out per item. ⚠️ No random draws, no state changes: engine work stays **same**. Tests: each source kind, a limit, a hero's gear counted only while they work it, an enemy. | engineer |
| B3 | **The card.** (a) The badge row under the stats line (enemies: under the combat line): icon + total, in **the UI_STYLE list's fixed order**, the Hero Effects badge last with the hero's portrait; nothing at zero or for an effect that can't apply; no row when nothing boosts the Token. (b) The hover: one line per source with its amount, then the total; the gold number and the limit note when held. (c) **"Boosted by" leaves the card**; a building's own "Boosts" list and the floor note's meaning stay (the floor now shows as the gold badge). (d) **Item badges** at the right end of the line: Double Item on Makes and Drops lines, Efficiency on a Needs line; smaller, same hover. (e) **Rare finds**: its own group under Drops with its chance in the twinkle colour and the Lucky badge on its heading; **clicking it opens a nested list** of the table's entries with their odds; clicking again closes it. (f) The Hero Effects badge's hover lists what the working hero carries that works there (ammo kept, Food heals more, a drink's effect). (g) **Placeholder icons** from the existing set; list each badge's icon in the owner's art list (where art requests are kept) so the owner's drawings can swap in. Updates live while the card is open (a hero arrives, a building is placed). | builder |
| B4 | **Carried items in the Hero drawer.** Ammo, Food, drinks and bait in the hero's slots wear a small Preservation badge with its total when it's above zero; the hover gives the sources (from B2). | builder-lite |

Order: B1 (owner picks) and B2 side by side, then B3, then B4.

## Done when

- Gate green (`TESTING.md`). Engine work **same**.
- **Tests:** B2's breakdown per source kind, limits, heroes and enemies; the badge total equal to the engine's resolved
  value for the same Token; no badge at zero.
- **In the running game, named as verified**, with brief 590's QA star and building where needed:
  - a Token boosted by a Hall star and a building: two lines in the hover, the right total;
  - a hero with Speed gear working it: the total grows, the hover names the gear, the Hero Effects badge appears;
  - a Token held at the Speed limit: gold number and the limit note;
  - an enemy card with a Double Loot badge;
  - a Double Item badge on a Makes line, an Efficiency badge on a Needs line;
  - a QA rare table: the Rare finds group opening and closing;
  - "Boosted by" gone, a building's "Boosts" still there;
  - arrows in a hero's slot with a Preservation badge.
- Changelog entry; UI_STYLE gains the badge rules (one paragraph, under "Effect names").

**Eye-check: yes**, one look after B3 and B4 (the row on several cards, hovers, Rare finds, the Hero drawer badge).

## Not in this brief

- Badges on the mat, in the Encyclopedia or the Bank item panel (owner: card only).
- The final icon art (the owner's; placeholders until then).
- Renaming today's effect labels (T-403); this brief's badges use the UI_STYLE names from the start.

## Owner to-do

- **B1**: pick a look from the screenshot page.
- Later, at your pace: draw the badge icons on the art list.
- No CMS steps.
