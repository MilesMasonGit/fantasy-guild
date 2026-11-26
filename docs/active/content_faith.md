Status: approved 2026-11-25 (pack `2026-11-26-faith-offerings` staged 2026-11-26: the Beeswax Candle Live at Crafting 19, Lavender Incense off the Altar; the other offerings and four shrines Planned)

# Faith: shrines and offerings

*Owner interview 2026-11-25 (planning agent, standing in for the content agent). The mechanic is
[concept_skill_identities.md](concept_skill_identities.md) "Faith" and brief 810 K3: a shrine's
blessing holds only while a Faith hero keeps it supplied with offerings. The content agent turns
this into the CMS pack (T-663). Amounts, how long an offering keeps a shrine lit, and chances are
the ledger's.*

## Rulings (owner 2026-11-25)

1. **One shrine per main tier**: Faith 1, 20, 40, 60, 80.
2. **Blessings are effects no building gives**: each shrine does something of its own, not a
   stronger Speed or Yield. ⚠️ This amends the 21 Nov wording ("stronger than a support
   building's"): shrines are different in kind, not just stronger.
3. **Offerings are made primarily by Crafting** (owner 2026-11-25), at its Workshop; there is no Altar, and Faith's work is tending shrines. They are a mix: specialised items (candles, incense, garlands) and ordinary
   goods ("A Nature shrine might need Wood and Ash", owner).
4. **Blessings add up**: a Token in reach of two shrines gets both, and two of the same kind stack.

## The shrines

| Faith | Shrine | Blessing on everything in its reach, while lit | Offerings |
|---|---|---|---|
| 1 | **Nature Shrine** | Veins, trees and Fields **can't run out** | Oak Logs, Charcoal (or Lavender Incense, which keeps it lit longer) |
| 20 | **Shrine of Fortune** | **A sure rare find**: every so many finished cycles (about every tenth, the ledger's), a Token gives its rarest drop for certain (owner 2026-11-25, replacing the next-tier gift, which the game can't read: most items carry no tier) | Beeswax Candles, Honey |
| 40 | **Shrine of the Valiant** | A hero fighting here is **never Defeated**: at 0 HP they flee and keep all their supplies and gear; they still go home wounded and heal, and the log and banner say Fled (owner 2026-11-25) | Tallow Candles, Bones |
| 60 | **Shrine of Wisdom** | Heroes **share XP**: when a hero working or fighting in reach earns XP, every other hero working or fighting in that reach gets a share in the same skill; shares are never re-shared; idle heroes get none (owner 2026-11-25) | Sage Incense, Parchment |
| 80 | **Shrine of Echoes** | A finished cycle sometimes **repeats at once, for free** | Rose Garlands, Light Mote |

## The offerings' recipes (Crafting)

| Level | Offering | Made from | Used by |
|---|---|---|---|
| 5 | Lavender Incense | Lavender (Alchemy's herb, Farming's Herb Garden) | Nature Shrine (lasts longer) |
| 15 | Beeswax Candle | Beeswax Comb (Bees) | Shrine of Fortune |
| 35 | Tallow Candle | Raw Beef (Cows), String (Tailor) | Shrine of the Valiant |
| 55 | Sage Incense | Sage | Shrine of Wisdom |
| 75 | Rose Garland | Roses, String | Shrine of Echoes |

*Placed 2026-11-26 (content agent), at free Crafting levels below each shrine: Beeswax Candle 19, Sage Incense 37, Tallow Candle 39, Rose Garland 79; Lavender Incense stays at 7.* *Planning agent's calls:* the levels are Crafting levels for now, kept just below the Faith level of the shrine that first asks for each offering (the content agent fits them into Crafting's open levels);
Lavender Incense, which the owner approved, has no shrine of its own, so it is the Nature Shrine's
richer offering (no item without a job). Interlocks: Faith takes from Combat (wax, tallow, bones),
Farming and Alchemy (herbs, roses), Tailor (String), Crafting (Charcoal, Parchment) and Enchanting
(Light Mote).

## New effects for the code (T-705)

Five blessings are rules the game doesn't have yet: **can't run out**, **a sure rare find**,
**never Defeated (flee and keep all)**, **shared XP** and **a free repeat**. They are built with brief
810 K3 as CMS effects a shrine can carry.

## Open

- Levels between the shrines stay open for later shrines.
