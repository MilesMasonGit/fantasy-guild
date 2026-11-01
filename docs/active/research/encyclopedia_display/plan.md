# Encyclopedia chart: what each entry shows (display plan)

**Chosen (owner, 2026-11-01; recorded in the look file on `look/2026-11-01`), built on
`feat/encyclopedia-e3`:** 1A fold growing stages; 1b-A only the right stations ("Foundation" for
buildings); 2A skill icon and number on the line; 3A dark ink, 16 px bold, no outline; the
magnifier dropped (resting on a box shows its card); a box shows **just the need number** (×6,
red when short; what you have is in the card); the one-off starts leave the chart, the Shop stays;
and, beyond this plan, **a box's far-side "+N" opens that side in place** (the box moves out, the
line to its neighbour runs through). The pictures below are the spike's prototype, before the
build; `capture_encyclopedia_display.mjs` redraws them from `spike/encyclopedia-display` only.

Status: draft 2026-11-01, for the owner's choice. Spike branch `spike/encyclopedia-display`.
Every picture is a real chart drawn by the game (a New Game, one hero at 15 in every skill and
Construction 6, a few items in the Bank). The list of pictures is at the end. **02** (Iron Ingot)
and **21** (the whole screen) show all the recommendations together; **01** and **20** are today.

The test for every piece: does it help a player who wants a thing **get it**? They need to know
what to get, where to do it, what the hero must be able to do, how many, and how likely.

## 1. Which entries earn a box

A player acts on items they hold, Tokens a hero works (a vein, a tree, ripe wheat, a chest),
enemies and the camps they come from, stations and Foundations, and maps. A **sapling, a sprout
or a stump** only waits: nobody works it, it turns into something else after a while.

- **A (recommended): fold what only waits.** A sapling becomes a small grow mark and its time on
  the line ("grows 2:30"): Oak Tree ← Oak Forest + 1 Oak Seedling. A chopped tree's stump shows as
  its cost with a regrow mark ("5:00"); hover says it must stand beside an Oak Forest. Everything
  else keeps its box. Pictures **03** (tree chain), **15** (the regrow hover), **07** (wheat).
- **B: show every stage (as built).** Honest, but one more column per stage, and the player
  clicks through an Oak Sapling box that has nothing to do. Picture **04**.
- **C: leanest.** As A, and the station boxes also fold into the skill mark on the line (hover
  names the stations). Shorter charts, but the ingot's chart no longer leads to "how do I build a
  Furnace": the player must search for it. Picture **10**.

**1b. A station box should open to the stations that make this thing.** Found while testing:
today "Smithing Station" opens to all four smithing stations, but Iron Ingot is only made at the
Furnace and the Iron Furnace; the Iron Furnace is only built on a Stone Foundation, an Oak Forest
only on Farmland. A player who builds a Copper Smithy for ingots is misled.
- **A (recommended):** one station makes it → that station's own box (Iron Furnace ← **Stone
  Foundation**, **08**); several → "Smithing Station" opening to just those (**17**). The building
  station type reads **"Foundation"**, not "Construction Station".
- **B:** every station of the skill, as built (**09**: the Foundation opens to Farmland and Wood
  Foundation, which cannot build it).

## 2. Where the skill requirement goes

A requirement belongs to a **step**, not to a thing. Iron Ingot has three ways in: Smithing 15,
beating a level-25 Fire Elemental Chief, opening an Iron Chest; today only the first shows, above
the ingot.

- **A (recommended, the owner's idea): the skill icon and the number on the line** into the box
  (**02**). Each way carries its own; red when no hero has it; hover gives the name and the
  stations ("Smithing 15, made at Furnace, Iron Furnace", **16**). Fights show a sword and the
  enemy's level. Cost: columns are 76 px wider (room for the mark), rows 20 px shorter.
- **B: in the box's corner** (**11**). No extra width, but a box shows only its usual way's
  requirement, and long names squeeze to three lines.
- **C: above the box, icon and number only** (**12**). Today's place, smaller and clearer; still
  says nothing about the other ways.

## 3. The words on the page

Today's "+5", "or" and "Smithing 15" are dark ink with the game's black outline at the small size:
the outline fills the letters in (**19** shows it at 2x).

- **A (recommended): ink without the outline, at the body size** (16 px at the default Text size,
  bold; the Text size setting scales it, not tried at other sizes in the prototype). Dark brown on the parchment (about 9 to 1 contrast,
  worked out from the colours); "no hero has it" in a deeper red so it reads on paper (same
  meaning, red). Pictures **18** (true size), **19** (2x). A new piece for the style sheet: "words
  on the book's page: ink, no outline".
- **B: white words on small dark tags** (**13**). The game's usual text, but about 40 more little
  boxes on the Iron Ingot chart alone.
- **C: today's small size, outline removed.** Smallest change; the counts stay small.

## 4. Everything else on a box

| Piece | Recommendation | Why |
|---|---|---|
| Amount (×6) and have/need (2/6) | **One number, have/need**, red when short | ×6 repeats the need; the need counts for one of what you searched (Iron Ore 0/24 for one Iron Pickaxe), the number a player gathers to |
| The lone "0" on a use (right side) | **Drop** | How many pickaxes you hold is not the question there |
| "Token", "Enemy", "Station" under the name | **Drop** | The picture says it |
| Drop % and "first kill" | **Keep on the box** (your ruling) | Picks the best source |
| The magnifier | **Drop; resting on the box shows the same card** (**14**) | One less mark in every corner; the mat already works by resting the pointer |
| "Opening Bank", "Starter Camp", "Tutorial" | **Drop from the chart**, a line in the box's card instead | One-off starts: nothing to do again. "Shop" stays (it has a price) |
| The tick, "+N" counts, "or" | **Keep** (legible per 3) | |

Picture **02** has every row of this table applied. Option: keep the magnifier as built.

## Recommended, side by side with the prototype

| Recommendation | Built in the prototype (picture) |
|---|---|
| 1 A: fold saplings, sprouts, stumps | yes (03, 07, 15) |
| 1b A: exact stations, "Foundation" | yes (08, 17) |
| 2 A: icon and number on the line | yes (02, 16) |
| 3 A: ink, body size, no outline | yes (18, 19) |
| 4: one have/need, no kind word, no magnifier, card on rest, no one-off starts | yes (02, 14); the card's "you started with some" line is not built |

**Art for the owner's list:** a Combat mark (the sword is the Melee icon standing in), and the
grow and regrow marks (code-drawn stand-ins the recipe list already uses).

**Pictures** (this folder; `capture_encyclopedia_display.mjs` redraws them from the spike branch):
01 today, Iron Ingot · 02 recommended, Iron Ingot · 03 recommended, tree chain (Oak Wood) · 04 option
1B every stage · 05 recommended, rare drop (Volcano Map) · 06 recommended, rare drop (Bird Nest and
its use) · 07 recommended, crop (Wheat) · 08 recommended, a building (Iron Furnace) · 09 option 1b-B ·
10 option 1C · 11 option 2B · 12 option 2C · 13 option 3B · 14 hover card on a box · 15 hover on a
regrow mark · 16 hover on a requirement · 17 a station box opened · 18 and 19 text before and after ·
20 and 21 the whole screen, today and recommended.
