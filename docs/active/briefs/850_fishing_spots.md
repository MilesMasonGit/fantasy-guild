# Brief 850 — Fishing: spots that come and go, Bait and lures

*Written 2026-11-24 by the planning agent from the owner's Fishing review the same day
([content_fishing.md](../content_fishing.md), "Amended 2026-11-24", points 1 to 26, approved 2026-11-24).
**Replaces brief 770 G2** (which stays on hold and is closed by this brief). The plan holds every
ruling; this brief says the order, the files and the bar.*

**What the player gets.** Fish live on the water, not in a fixed Token: fishing spots drift in on the
sea, rivers and lakes and leave again. A rod, harpoon or Trap fits its own fish at any tier (a better
one is faster and spends less Bait). Every catch spends Bait, made from fish you can already catch.
A lure picks which fish bites; without one, you get a slow random catch. A Fishing Hut keeps its
heroes moving from spot to spot, and a Dock building brings more spots.

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, `docs/reference/ARCHITECTURE.md` (the tick, the content
boundary), the Fishing plan's 24 Nov sections whole, [terrain_roadmap.md](../terrain_roadmap.md)
for water cells, [content_events.md](../content_events.md) for the Fish Shoal. Code read 2026-11-24
(the code wins): `src/systems/board/Fishing.js`, `EventTokens.js`, `SpawnerSystem.js`, `Respawn.js`,
`Camps.js`, `src/config/toolKinds.js`, the CMS's Catch pools block. Brief 770 G1 (out of bait, "Needs
X") is built and stays. Every phase may **stop and report rather than guess**.

## Phases

| Phase | Ticket | What (plan points) | Tier | Needs |
|---|---|---|---|---|
| F1 | T-684 | **Fishing spots** (16, 17, 20, 21). Water cells are ground; **Fishing Spot** Tokens appear on them on their own (a base rate and a most-at-once per mat, the content's numbers), and leave by a **chance per catch** (no counter) or after a while unworked. A spot's catch comes from the water kind it sits on plus the Region's biome. **Outside the Token cap.** **Rare spot kinds** (Oyster Bed, Coral Reef on warm sea, Shipwreck, Shark-Infested Waters) appear rarely on the right water and biome with a **fixed catch**; the Fish Shoal becomes the richest kind (T-604; its second model goes). Today's Coast, River and Lake Tokens retire (say what a load does with them; old saves aren't protected). The CMS authors spot kinds, rates and catches. | engineer | — |
| F2 | T-685 | **The catch rules** (1–7, 13, 22–23, 25). A fish asks a **tool kind** (Rod, Harpoon, Trap), never a tier; add the Harpoon kind, no Lobster Pot. **Bait**: one item, an amount per fish spent each catch, less with a better tool tier (authored per tool); Raw Shrimp at the Trap free; out of it "Needs Bait". **Lures**: an item carried in a stack, naming a few fish; picks the fish the spot holds; a chance to break each catch; a lure for a fish the spot lacks fishes the lureless roll, not spent, "No Salmon here" once; above level "Needs Fishing N". **No lure** (and every harpoon): roll among the fish the tool kind and level allow, at the **longest cycle** of those. **One Trap catch per water.** Bait recipes are **Fishing** recipes, one per fish at its catch level, rarer fish giving more (content, no code beyond letting Fishing hold recipes, if it can't). The world tables keep **one fish per lure per map** (check, or a CMS audit warning). | builder | F1 |
| F3 | T-686 | **Fishing Hut and the spot building** (18, 19). A hero ordered onto a spot by hand stops when it goes; a **Fishing Hut**'s hero moves to the next spot in reach that fits their tool and level (its camp logic, `Camps.js`). A new building **raises the spot rate in its reach** (a rule the CMS can give any building; the content agent names it). Both sit on today's Foundations until the gathering foundations concept (the Dock) is approved. | builder | F2 |
| F4 | T-687 | **What the player sees** (11, 14). A spot's Token card lists every fish it can give: sprite, tool kind, Fishing level (greyed while out of reach) and the lure that picks it. Hovering a spot shows its possible fish in the speech bubble (brief 830 §12.3's bubble). The water's inland look and spot art: placeholders until the owner draws them. | builder | F2 (830 D3 for the bubble, else a plain one) |

**Order and parallel work.** F1 → F2 → F3; F4 after F2, beside F3. All four touch fishing files;
one code subagent at a time on them. **After F2**: the content agent's Fishing pack (T-622: the fish
list, lures, Bait recipes, tools' Bait savings, spot kinds and rates), and the world tables'
fish-by-biome balance across the hex map (point 10, with T-294).

## Done when

- Gate green each phase. **Work check: WORK CHANGED expected** (spots replace fixed waters); say what
  moved and why, and retake the baseline with the owner's yes. No bench scenario fishes today: add
  one fishing scenario in F1 so the change is measured.
- Seen in the running game: spots appear and leave on sea and river; a hero with a lure catches its
  fish, without one the slow random catch; out of Bait "Needs Bait"; a harpoon at a Shark spot; a
  Trap on Raw Shrimp with no Bait; a Fishing Hut's hero walks to the next spot; the spot building
  raises spot numbers nearby; the card and the hover bubble.
- `CHANGELOG.md` entries; T-684 to T-687 closed, and 770 G2 marked replaced.

**Eye-check: yes**, after F3 + F4 (how fishing plays and reads).

## Owner to-do

No CMS work in the code phases. After F2, review and Sync the content agent's Fishing pack. Art when
you like: the Fishing Spot Token (and the rare spot kinds), lures, Bait, the new fish.
