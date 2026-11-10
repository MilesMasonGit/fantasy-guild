Status: briefed 2026-11-10 (approved 2026-11-09; [brief 570](briefs/570_inspection_drawers.md))

# Inspection drawers: heroes at the bottom, world and items on the right

*Owner interview, 2026-11-09. Establishes one consistent spatial rule for every
inspection panel in the game, keeps the horizontal hero bar visible on every
screen, and reworks the Hero, Item, World Map and Guild Hall Upgrade inspection
drawers.*

## The core spatial rule

The game has two families of things the player inspects, and each gets its own
home on the screen so they never fight for the same edge:

- **Inspecting heroes comes from the bottom.** Heroes are the heart of the
  guild and the player's main point of attachment. The horizontal hero bar
  stays visible at the bottom of the screen at all times, across every screen,
  and clicking a hero pops out a **horizontal Hero Inspection Drawer** directly
  behind and above the hero bar. Because heroes sit at the bottom, the player
  can inspect a hero and swap gear while the Bank, World Map or Guild Hall is
  open alongside.
- **Inspecting the world, items and upgrades comes from the right.** The **Item
  Inspection Panel** (in the Bank), the **World Map Info Panel** (on the Atlas
  screen) and the **Upgrade Inspection Panel** (in the Guild Hall sky) all use
  the same **flush, full-height drawer on the right-hand side** of the screen
  (or the opposite edge if the player flips "Menu on Right Side" in Settings),
  styled like the previous vertical hero drawer (`NOTIFICATION_COLUMN` width,
  studded pixel frame with each screen's coloured pixel backdrop).

---

## 1. The Horizontal Hero Bar & Hero Inspection Drawer

### Always-visible horizontal hero bar
- **Retire the vertical hero bar**: the vertical column of hero portrait tabs
  (`BankHeroPanel` / `HeroDockTab`) goes away completely.
- **Always on screen**: the horizontal bottom hero bar (`BottomHeroDock`) is
  visible across **every screen**—the Playmat, the Bank, the Shop, the World
  Map and the Guild Hall upgrade sky.
- **Layering over side drawers**: when the Bank (or a right-side inspection
  drawer) is open and covers the side of the screen down to the bottom, the
  horizontal hero bar and its Hero Inspection Drawer sit **on top of** the
  side drawers (higher `z-index`) so the full roster is never cut off or hidden.
- **No break line**: remove the top border line (`border-t border-white/15`)
  above the horizontal hero bar.
- **Equip speech bubbles on the hero bar**: when the player drops an item onto
  a hero (or a hero's equipment slot) to equip it, the result is announced as a
  **speech bubble directly over that hero on the horizontal hero bar**, fading
  out automatically after about 3 seconds (replacing the old floating screen
  callout):
  - **Success** uses the **plain speech frame**: e.g. `"Equipped Shrimp x4.6k"`,
    `"Equipped Iron Woodaxe"`.
  - **Refusal** uses the **red `CANT` speech frame** and gives the exact reason
    and numbers: e.g. `"Can't equip Mythril Scimitar. Melee skill too low. (12/40)"`.

### Horizontal Hero Inspection Drawer
- **Where it opens**: slides up horizontally from the bottom edge, directly
  behind/above the horizontal hero bar, keeping all the existing Hero panel
  styling (`backdrop="hero"` studded pixel frame).
- **One bottom drawer at a time**: the Shop also rises from the bottom above
  the hero bar. Opening the Hero Inspection Drawer closes the Shop, and opening
  the Shop closes the Hero Inspection Drawer.
- **Left-to-right layout**:
  1. **Hero summary (left)**: the animated 2× hero figure, name, stylized HP
     bar, and the **Edit quill** and **Close X** buttons.
     - **Flag position fix**: the hero's job flag behind the portrait in the
       inspect panel is currently too close to the center; move it **farther to
       the left** behind the hero's shoulder.
  2. **Inventory / Equipment block (middle)**: the 3×3 equipment grid. This
     block **always stays visible** even when toggling the right-hand section
     between Skills and Combat Stats, so the player can swap gear in and out
     and watch their combat numbers update live.
  3. **Skills Grid / Combat Stats toggle (right)**: a toggle switches the
     right-hand section between two views:
     - **Skills Grid (default)**: all skills arranged in **columns of 4 skills
       each**, flowing into the next column with no section headers and no
       scrolling needed, ordered by category: **Combat** (Melee, Ranged, Magic,
       Stealth) → **Gathering** (Mining, Forestry, Fishing, Farming) →
       **Crafting** (Smithing, Crafting, Cooking, Alchemy, Construction, etc.) →
       **Special**.
     - **Detailed Combat Stats**: shows the hero's current combat style (from
       their equipped weapon, or barehanded Melee), damage ranges, attack
       speed, passive weapon/gear effects, resistances and style damage cuts.

### Skill Hover Tooltip vs. Skill Inspection Panel
- **Skill Hover Tooltip**: hovering a skill icon in the Hero Inspection Drawer
  shows only the most basic information in a **clean stat block**:
  - Skill name and level header
  - **Current XP**
  - **XP to next level**
  - **Current XP rate** (`XP/h`)
- **Skill Inspection Panel (on click)**: clicking a skill in the Hero
  Inspection Drawer pops out a **separate framed mini-panel directly above the
  Hero Inspection Drawer** (with its own Close X; clicking another skill
  switches it). It holds the complete breakdown for that skill:
  - Skill icon, name and level header, plus the **Encyclopedia book button**
  - Tutorial / purpose description explaining what the skill is used for and
    what it feeds
  - Full exact XP stat block (`XP`, `To next level`, `Total XP`, `XP/h`,
    `Next level` ETA)
  - All 5 milestone perks (`10/99`, `25/99`, `50/99`, `75/99`, `99/99`), with
    earned perks lit in gold and locked perks shown dimmed

---

## 2. The Item Inspection Panel (and Bank)

- **Replaces the old vertical hero drawer**: the bottom `BankItemWindow` inside
  the Bank is retired. Instead, the **Item Inspection Panel** is a flush,
  full-height drawer on the **right-hand side** of the screen (`backdrop="bank"`
  or item-styled studded pixel frame).
- **Always open with the Bank**: it opens automatically whenever the Bank opens
  and closes when the Bank closes. It does **not** need its own Close X button.
  - **Default item**: displays the last inspected item from earlier in the
    session, falling back to the first item in the active Bank tab (or a calm
    empty state if the Bank is completely empty).
- **Playmat stays put**: remove the playmat slide/shift (`.gi-bank-shift` /
  `bankShift`) when the Bank opens. The playmat stays in place underneath while
  the Bank and the right-side Item Inspection Panel cover it.
- **Top-to-bottom stat block layout**:
  1. **Header**: the **Item Name** large at the top, with the **Encyclopedia
     book button** in the top corner.
  2. **Large Sprite**: the item sprite displayed large (`128 px`, 4× whole-pixel
     scale) centered underneath the title.
  3. **Quantity**: the banked quantity directly underneath the sprite.
  4. **Explanatory Tags**: replaces the redundant top lines (`Food` /
     `Equippable: Food` / `Food · Seafood · Cooked`) with styled **tag pills**.
     Hovering or reading a tag explains what that tag/category does in the game
     (e.g. *Food: Heroes eat this in combat to restore HP*).
  5. **Rules & Stats Block**: a clear stat block underneath the tags showing
     what the item does and its rules (e.g. `Restores 5 HP`, weapon damage,
     damage type, combat skill, swing speed, hands, tool tier, resistances,
     style cuts, break chance, and description).
  6. **Actions & Footer**: space above the bottom for item actions (`Use`, and
     later `Sell` / `Discard`), and a small **`"Collected this run: N"`** line
     at the very bottom of the drawer.
- **Item Hover Tooltip (`ItemTip`) cleanup**: also drops the redundant `type`
  and `Equippable:` lines so item hover tooltips everywhere match the cleaner
  tag + stat structure.

---

## 3. The World Map Info Panel

- **Right-side full-height drawer**: replaces the floating right-hand box on
  the World Map screen with a flush, full-height drawer on the **right-hand
  side** (`backdrop="world"` studded pixel frame), matching the Item and
  Upgrade drawers.
- **Header & Edit Quill**: shows the region's name (with the guild flag if the
  guild is currently there) and terrain subtitle. On settled regions, the text
  `"Rename"` button is replaced by the **Edit quill icon button** (matching the
  Hero drawer).
- **Map Preview & Token Count (settled regions)**:
  - The Map Preview box sits near the top of the drawer for settled regions.
  - The **Token count** is overlaid in the **bottom-right corner of the Map
    Preview**, formatted simply as **`28/128`** with no label.
- **Three Ground Dials (Water, Grass, Stone %)**:
  - Shown on **both settled and unsettled regions**, replacing the old
    `"Ground: Meadow"` text line.
  - Displays **three dials** showing the percentage of **Water**, **Grass**, and
    **Stone** that the map tile contains, so the player can read the land split
    before and after settling.
- **Region Playtime Counter**:
  - On settled regions, displays a playtime counter showing **how long the
    player has actively spent on that specific map tile** (e.g. `1h 24m`).
- **Removed clutter**:
  - The old `Ground`, `Tokens` and `Heroes` text fact rows are removed.
  - The per-Token sprite breakdown list (`×count` of every Token on the board)
    is removed. **Yields** stand as the primary resource information, followed
    by **Price** (on unsettled cells) and the large **Settle** / **Travel**
    button at the bottom.

---

## 4. The Upgrade Inspection Panel (and Guild Hall Star Map)

### Right-side drawer & selection behavior
- **Right-side full-height drawer**: replaces the floating purple box in the
  Guild Hall sky with a flush, full-height drawer on the **right-hand side**
  (`backdrop="hall"` purple-framed studded pixel drawer).
- **Remove "Return to Playmat" button**: the separate purple `"Return to
  Playmat"` button above the panel is removed (the player returns via the nav
  bubble or Escape).
- **Click to select, no hover-switching**:
  - The drawer starts **closed** when opening the Guild Hall so the full star
    map is unobstructed.
  - Hovering over stars on the map **no longer switches** the inspection panel.
  - Clicking a star selects it and pops out the right-side Upgrade Inspection
    Drawer (and clicking its Close X or pressing Escape closes the drawer).

### Header, Roman numeral ranks & multi-rank buying
- **Icon & Title**:
  - The star's icon at the top is displayed **larger** and **always greyscale**.
  - The upgrade **Title** is displayed **larger and centered below the icon**.
  - Directly below the title sits the general description of what the upgrade
    does (e.g. `"Increases Mining XP Gained"`).
- **Scrollable Ranks List with Roman Numerals**:
  - Replaces the old `Rank / Now / Next` stat block with a scrollable list of
    all ranks (`ArrowScrollList`).
  - When opened (or after a purchase), the list **automatically jumps/scrolls
    to the most recently purchased rank and the next available rank**.
  - Each rank badge is written in **Roman numerals** (`I`, `II`, `III`, `IV`,
    `V`...) and **turns into the regular Arabic number** (`1`, `2`, `3`...)
    while hovered.
  - Each rank row gives a very simple, concise description of the number that
    is changing at that rank: e.g. **`"+12% XP"`**.
- **Selecting later ranks & Multi-Rank Purchase**:
  - By default, the next unpurchased rank (`rank + 1`) is selected. The player
    can click any **later unpurchased rank** in the list to select it as a
    target.
  - **Bottom Price display**: shows the price of that **specific selected
    rank**, using our **inventory number shortening** (`"Oak Wood 3.6k/30"`
    instead of `"Oak Wood 3665/30"`).
  - **Hovering the Upgrade button**: if a higher rank is selected (more than 1
    rank ahead), **hovering the Upgrade button updates the price display (or
    shows a popup) with the combined total cost** to purchase all ranks from
    `current + 1` up to the selected rank.
  - **Upgrade button label & action**: when multiple ranks are selected, the
    Upgrade button changes its text to show the **number of ranks being
    purchased** (e.g. `"Upgrade (+3 Ranks)"`), and clicking it purchases all
    those ranks at once.

### Star Map title overlap fix
- **No side-by-side title collisions**: on the star map itself, some star
  titles overlap when two stars sit directly side by side. A vertical stagger
  rule shifts stars that share nearly the same horizontal band so two stars are
  never directly side by side and their titles never overlap.


## Ruling (owner, 2026-11-10)

- A region's **playtime counts time away too**, added to the place the guild was on.
