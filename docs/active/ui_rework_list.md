# UI rework list — owner, 2026-10-06

**Status:** the owner's outstanding UI list, the input for the crunch's UI
rework (the old `ui_overhaul_spec.md` / `ui_bugfix_tracker.md` stay archived).
Its locked sections are the source of truth for briefs 10 and 30 (written
2026-10-07); the owner's own list follows them.

**Gameplay rulings inside this list** (they override earlier tickets and the GDD):
- **Token cap 80** for testing, and **spawners and spawned Tokens are under
  the same cap** (today only placed Tokens count). Upgradeable in the Guild
  Hall later. → T-102
- **Binned Tokens count toward spawner caps and Token counts** (today a full
  bin lets a spawner exceed its cap: a bug). → T-101
- **"Trickle" becomes "Passive Production"**: all of it on one 5-minute timer;
  the **Wishing Well** joins it (about 10 Water every 5 min). → T-099
  - Built 2026-10-08: the Wishing Well pays **10 × rank** Water per 5 min (owner);
    every Passive Production line pays each 5-minute lap, so the Hall's Apple
    Seed now comes every 5 min, not 10 (director, from "one timer"); the Guild
    Hall and quest Tokens don't count toward the Token cap, so a full mat never
    blocks a quest (director).
- The **"Hero went elsewhere"** notification should not be a notification.

Checked 2026-10-06: the inspection panel's "Origin (dev)" line shows only in a
dev build or with Debug Mode on; T-097 hides Debug Mode in shipped builds.

## Bubble design — locked (owner interview, 2026-10-07)

"Bubbles" are the small round badges on a Token (the ring badges in code:
`RingBadge`, `TokenBadgeRow`, `TurnRing`, `StationGearBadge`, `DisallowBadge`).

**Positions, inside the Token's box:**

```
 +---------------------+
 | (timer)             |   top-left: time until the Token changes (growth or turn)
 |                     |
 |   (gear)(3/5)(X)    |   middle row: gear, spawner count, disallow, side by side
 |                     |
 | (cycle) (quest) (12)|   bottom-left work cycle · bottom-centre quest · bottom-right charges
 +---------------------+
```

| Bubble | Where | When visible |
|---|---|---|
| Work cycle | bottom-left | the whole time a hero is working it |
| Charges | bottom-right | ~2 s when it changes, and on hover |
| Quest progress | bottom-centre | ~2 s when it changes, and on hover |
| Lifespan / turn timer (Coast) | top-left | on hover, and in its last ~10 s |
| **Growth timer (new)**: sapling, sprout, young tree | top-left | on hover, and in its last ~10 s |
| Spawner count | middle row | ~2 s when it changes, and on hover |
| Station / Foundation gear | middle row | always while a choice is needed; on hover otherwise |
| Disallow mark | middle row | always while disallowed |
| Stuck-spawner warning (yellow: needs an item, red: no room) | middle row | always while the spawner is stuck (owner, 2026-10-07) |

- **Middle row**: when a Token has several centre bubbles they line up side by
  side, centred.
- **Combat**: **health bars above the hero and the enemy** (bars, not rings),
  shown **during a fight, or when the enemy is hovered**. Replaces today's
  enemy-HP ring.
- **Small Tokens** (half-size saplings and sprouts): same corners for now, and
  bubbles may overhang the small box. (The owner may later show none on small
  Tokens.)
- **Glide**: every count bubble animates when its number jumps (2/5 → 3/5),
  not only charges and spawners.
- **Tooltips**: hovering a bubble shows what it means and does; **pressing a
  bubble still grabs the Token**. The director drafts the wording; the owner
  reviews it in the build.
- **Callouts, one style**: spawns ("! Spawned Oak Tree"), depletion ("Oak Tree
  Depleted", said by the hero), and effect callouts (e.g. a bonus drop) use the
  same quick speech-bubble-style popup that fades. The "-1" / "+50" charge
  number stays as a small number rising from the charges bubble.
  **Refused drops** (and dragging the Guild Hall off the mat) show their reason
  in the same popup (owner, 2026-10-07).
- **Level-up line**: "Leveled up Mining to 25!" for one level; "(+4)" is added
  only when two or more levels merge into one bubble (owner, 2026-10-07).
- **Token size on the mat** (owner, 2026-10-08): art stays on whole-pixel
  steps and rounds to the nearest step, so at 1920×1080 Tokens and heroes draw at
  2× (bigger than their 128-unit design). Keep that; make grabbing follow each
  Token's own circle so overlapping art doesn't steal presses.
- **Heroes stand a little further** from what they work or fight, so the two
  health bars don't collide (owner, 2026-10-08; T-112).
- **Health bars** show the HP number on the bar; the hero's bar stays ~3 s after
  a fight (owner, 2026-10-08).
- **Name label**: on hover, **above** the Token's box, never over a bubble.
- Bubbles are drawn **inside** the Token's box, so nothing is cut off at the
  mat's edges and hovering them never leaves the Token.

## Shop groups and Foundation tiers — locked (owner interview, 2026-10-07)

**Groups.** The CMS can mark any set of shop Tokens as one **group** (a general
rule, so future families need no code). The Shop shows a group as **one row
with a dropdown**; picking an entry shows that entry's sprite and price.
**Everything is selectable from the start: price is the only gate** (the
existing "no unlocks" rule).

**Foundation tiers.** A building recipe names a Foundation kind and a
**minimum tier** ("Wood Foundation, tier 2 or higher"). A higher Foundation
builds everything a lower one can. This is the same rule tools already use
(Copper Nails needs an anvil of tier 1 or higher).

| Group | Tiers | Notes |
|---|---|---|
| Wood Foundation | **Oak** (1) · **Maple** (2) · **Ebony** (3) | Logging levels 1 / 45 / 90. Fir, Birch, Cedar and Mahogany go to other constructions (e.g. Mahogany → Fine Furniture). ⚠️ Only one generic wood Foundation art exists. |
| Stone Foundation | **Stone** (1) · **Marble** (2) · **Basalt** (3) | Marble and Basalt items, sources and Tokens don't exist yet. Art exists: items, bricks, Foundations and veins. Granite and Sandstone are for other constructions. |
| Anvil | Copper · Iron · Mythril · Adamantite · Darkmetal | Copper Anvil exists today; art exists for all five. Follows the metal ladder. |
| Any other family | — | e.g. Oak / Fir / … Forests, if the owner groups them in the CMS. |

Work split: code builds the group mechanic and the Foundation "minimum tier"
(engine, CMS fields, Shop dropdown); the owner authors the content in the CMS
(new Foundation tiers, Marble and Basalt items and sources, anvil tiers,
building recipes' minimum tiers).

## Hero work rules and the flag — locked (owner interview, 2026-10-07)

The work rules (per held skill: Allowed on/off and priority 1–5, plus one
Fight row for heroes who can fight; `FlagRulesPanel.jsx` today) move **off
the flag**.

- **Opened from the hero bar**: hovering a hero in the bar shows a **gear** on
  that hero; clicking it opens the rules.
- **A side panel**: it slides out over the mat from the same side as the
  notification sidebar *(director default)* and stays open until closed (Esc
  or its X). It names the hero and shows their flag colour.
- **Copy rules to…**: in the panel, a list of the other heroes with
  checkboxes and **Copy**. Skills a target hero doesn't hold are skipped.
- **The flag**: no gear and no "…" idle chip (removed entirely; the hero's
  "No work in range." speech bubble remains). On hover it highlights, shows its
  hero's name and its reach ring, as today. It is otherwise just something to
  drag.

## Hero bar and hero panel — locked (owner interview, 2026-10-07)

- **A general overhaul**: the owner dislikes the current look (thick borders,
  dead space, clunky information), not the positions. Apply
  [`docs/reference/UI_STYLE.md`](../reference/UI_STYLE.md) throughout.
- **The bar stays horizontal at the bottom**, spaced for 8 heroes, compact and
  clean. Each hero shows: **figure or portrait + name, HP bar, and level-up
  speech bubbles** (persistent until cleared). Hovering a hero shows its
  **work-rules gear** (see "Hero work rules").
- **The hero panel is a full-height side panel**, in the same place whether or
  not the Bank is open (like today's Bank-side hero panel). The mat stays fully
  visible.
- Layout mockups (slim portraits / compact cards / vertical column) were shown
  and set aside: the issue is presentation, not layout.

## Token Summary — locked (owner interview, 2026-10-07)

- **Opens by clicking the Token counter** ("Tokens 62 / 80") in the top bar
  above the mat (today it opens on hover). It drops down over the mat; Esc or
  clicking elsewhere closes it.
- **One row per Token type**, no individual Tokens: "Oak Tree ×5", with small
  status counts (working / idle / blocked / disallowed).
- **Hovering a row highlights every Token of that type** on the mat. Clicking a
  row does nothing more.
- **Order**: Tokens **missing items** (waiting for inputs or upkeep they can't
  pay) pinned at the top; the rest grouped by skill section (Logging, Mining…)
  like the Shop, spawners next to what they spawn.
- **Spawned Tokens** get rows like placed ones, since they now count toward the
  cap (T-102).
- **The bin**: a plain "In the bin ×N" line at the bottom *(director default)*.
  ⚠️ The owner expects to cut the bin once the Atlas exists, maybe for a
  "demolish" action; don't invest in bin UI.
- **Bubbles everywhere** (on Tokens and in the top bar) get a clean tooltip
  explaining what they mean.

The list below is the owner's own wording.

---

**Drag consistency:**
Sometimes a drag fails to start when grabbing a hero or their flag.
Clicking and dragging a token must feel as good as possible. It needs to be 100% successful and smooth every time, as this is the main interaction method for the player. We should consider doing a deep dive review into drag and drop consistency once we've updated our UI. Right now, I think other UI elements are blocking and causing the issue.

**Hero flag:**
I see a "…" badge in the top left that does nothing. The gear to change hero work behavior should not be on the flag token, it will likely live on the horizontal hero bar.

**Quests:**
Should show the target sprite overtop of the Quest sprite. The sprite for quests is a billboard with a large blank poster on the front. It is intended to show the item that the quest needs (eg Oak Wood) on top of it, centered.

**Bubble UI:**
The new Bubble UI looks good, but I think it needs to be within the bounds of the sprite box. Currently it lives underneath the token, and when there are a lot of tokens it's hard to tell which it belongs to.
We need hover tooltips to show when hovering over the bubbles, to explain what they mean and do. Currently cannot hover some bubbles as they live outside of the token's bounds and disappear when the cursor moves towards them.
Bubbles should not be always visible. They should pop in either when the token is hovered over, or when they change.
Sometimes the bubbles look like they're getting cut off at the edges.
Bubbles that jump in number (such as spawners going from 2/5 to 3/5) should still show movement in their ring.
We should have a discussion about bubble locations and visibility for each kind of bubble. My preliminary thoughts below:

**Bubble positioning:**
Spawn cap bubbles should be dead center on the Token.
Charge count bubbles should be bottom right.
Lifespan timers should be top left (such as for coast/fishing tokens)
Work cycle should be bottom left.
Quest progress should be bottom center.
The Gear icon should also be dead center.
I'm open to feedback on this, or if I've missed a kind of bubble or behaviour that should be considered.

**Spawner behaviour:**
Tokens in the bin should still count towards caps and token counts. Currently I can keep items in the bin to exceed a spawner's cap.

**Token movement:**
I want tokens to have movement when they spawn in, popping out of the spawner and sliding a little bit.

**New Shadow:**
The old shadows are still used when dragging an item in the bank.

**Item particle fly:**
Items seem to have the same flight duration no matter how long they have to travel. This makes it look lethargic and slow when the destination is close to them.

**Notification/Bin bar:**
I want to expand the playmat size, and have the notifications and bin be sidebars that pop out on hover. They should expand out overtop of the playmat.
I see a "Hero went elsewhere" notification – not sure what triggers this, but it shouldn't be a notification.

**Level Up Notifications:**
I want the hero speech bubble to pop for level ups both on the playmat and on the horizontal Hero Bar. The notification should work the same way it currently works in the notification bar.
The hero will say "Leveled up Mining to 25! (+4)"
That hero bar bubble should persist until cleared, this way after returning from a long afk session the player can see all the levels gained just by scanning the bottom bar.

**Shop UI:**
We need to use the arrow bars at the top and bottom instead of a scroll bar.
The sprite icon of what's being purchased should be 128px size and on the right side. I want to give the feeling of taking an item out of the shop and placing it on the map.
The sprite should be the central focus, and I want the rest of the information to not exceed the vertical height of that sprite. Each container needs to be consistently sized. We can display the item costs in a 2x2 grid.
Some types of purchasable tokens will be groups. For example, Wood foundation should have a dropdown menu allowing the player to choose Oak, Willow, Ebony foundations. Those higher-level foundations will have greater costs and be required for higher level constructions. Anvils should have a dropdown to select different anvil types.

**Hero bar:**
Horizontal hero bar can be spaced out more, as we are going to have a max of 8 heroes.
The inspection panel for heroes can be placed the same as it is in the item bank, even when the bank is closed.

**Alerts:**
Let's not have the alert icons on the token itself, the floating exclamation points where it shows tokens that have been exhausted or new tokens that have spawned.
Instead, I want to try communicating this information through more natural visuals. Let's include an "Oak Tree Depleted" speech bubble for the hero that exhausts it.
For spawners, they should have a "! Spawned Oak Tree" speech bubble-style popup that appears and fades quickly.

**General UI Reworks:**
The Guild Hall Trickle Income, Token Summary, and Upkeep tooltips all need to be greatly simplified and reworked.

**Trickle Income:**
All guild hall Trickle Income should be on the same 5 min timer.
We should call this "Passive Production", not "Trickle".
Our guild hall upgrades should be integrated with this. The wishing well upgrade is meant to produce X amount of Water passively, probably 10 every 5 minutes.

**Token Summary:**
Should always be displayed as a list, probably can put in additional information, such as a bubble row showing specific progress.
It should be click to open, and the player can hover to highlight that token.
I think spawners and spawned tokens should be subject to the same cap. Let's increase the base cap to 80 for testing purposes. The player will be able to upgrade this in the guild hall later on.

**Upkeep:**
Should not display trickle income/passive production. This is meant to be a summary of what wants to consume resources, how much and how often.

**Disallow:**
Disallowed tokens should have the disallow icon in the center of the token.
The "Heroes may work this" switch in the inspection should be a disallow function instead.

**Token Inspection UI:**
Skill icon sprites are fuzzy and not sharp in this view.
The speech bubble arrow doesn't look good, the overall shape should look more like the speech bubbles do.
I assume the "Origin (dev) Spawned" will not be visible in the production builds.
Charges, time, and XP should be displayed as bubbles. They should update if the inspected token is being worked.
