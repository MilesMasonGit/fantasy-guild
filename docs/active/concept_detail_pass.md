Status: draft (approved 2026-11-02 and briefed: section 3, hero bar and sheet, brief 340; section 1, Tokens and the card, brief 350; section 8, combat, brief 360; the terrain round, brief 370; section 7, world map, brief 380; section 6, Guild Hall, brief 390; section 4, Bank, brief 400; section 5, Shop, brief 410; section 2, top bar, brief 420; section 10, notifications, brief 430; section 12, away summary, brief 440; section 11, settings and the start screen, brief 450; section 13, hard pixel, brief 460; section 9, encyclopedia, brief 470)

# The detail pass: UI and UX, section by section

*Opened 2026-11-02 (owner). A long list of specific improvements to how the
game looks and plays, gathered one screen at a time.*

## How it runs (owner, 2026-11-02)

1. **Section zero first**: rules that apply on every screen, so they aren't
   decided again per section.
2. **One section per sitting.** The planning agent brings a one-page sheet:
   what is on that screen today (checked in the current game) and the old notes
   already filed for it. The owner plays and talks; the ideas are the owner's.
3. **Each item is written as the owner's wish**, in the owner's words. No guessed
   file paths or causes: the builder checks the code (brief 210's intake needed
   a warning about exactly this).
4. **Each item gets two tags**: **must** or **nice**; **tweak** (a ticket's
   size) or **design** (needs its own short interview or concept).
5. **A finished section goes to the director** as one brief with a row in the
   queue, built in a small batch with an eye-check. The owner's next ideas can
   then build on what they just saw.

**Scope**: the player's game. CMS annoyances become tickets, not sections.

## Section zero: rules across every screen

- **The icon rule: decided 2026-11-02**, in `UI_STYLE.md` ("The icon rule").
  Swaps it calls for (T-293 to brief):
  - Top bar Demolish button: the cursor's pixel art (brief 420; Disallow retires).
  - Start screen: all Lucide for now (the emoji stats go); a pixel set may come
    near release.
  - Skill icons: T-297. Farming uses `s_farming.png`; Alchemy and Construction
    are on the owner art list, using `s_flask` and `s_industry` until then if
    they suit; specialist skills share a plain pixel placeholder.
  - The rest of the audit is checked section by section (unknown item, locks,
    hearts, gear slot icons).
- *(more to gather from the owner)*

## Sections

| # | Section | State | Old notes to bring |
|---|---|---|---|
| 0 | Rules across every screen | icon rule done; more as they come up | above; `UI_STYLE.md` |
| 1 | The mat and Tokens | **approved 2026-11-02, split**: [brief 350](briefs/350_tokens_card_detail.md); [brief 370](briefs/370_terrain_detail.md) for terrain; T-295; combat items in [brief 360](briefs/360_combat_detail.md) | `design_pass_notes.md`; T-013, T-162 |
| 2 | Top bar | **approved and briefed 2026-11-03** ([brief 420](briefs/420_top_bar_detail.md)) | `ui_rework_list.md` |
| 3 | Hero bar and hero sheet | **approved and briefed 2026-11-02** ([brief 340](briefs/340_hero_bar_detail.md)) | owner 2026-11-05: no held-back list remains; brief 340 covers it |
| 4 | Bank | **approved and briefed 2026-11-03** ([brief 400](briefs/400_bank_detail.md)) | |
| 5 | Shop | **approved and briefed 2026-11-03** ([brief 410](briefs/410_shop_detail.md)) | |
| 6 | Guild Hall | **approved and briefed 2026-11-03** ([brief 390](briefs/390_guild_hall_detail.md)); the upgrade review open | |
| 7 | World map | **approved and briefed 2026-11-03** ([brief 380](briefs/380_world_map_detail.md)) | |
| 8 | Combat | **approved and briefed 2026-11-02** ([brief 360](briefs/360_combat_detail.md)) | carried in the mat list's items 5, 13, 14 |
| 9 | Encyclopedia | **approved and briefed 2026-11-04** ([brief 470](briefs/470_encyclopedia_detail.md)) | |
| 10 | Notifications | **approved and briefed 2026-11-03** ([brief 430](briefs/430_notifications_detail.md)) | |
| 11 | Settings and the start screen | **approved and briefed 2026-11-04** ([brief 450](briefs/450_settings_start_detail.md)) | |
| 12 | While-you-were-away summary | **approved and briefed 2026-11-03** ([brief 440](briefs/440_away_summary_detail.md)) | |
| 13 | Tutorial and highlights | **walked 2026-11-04**: the tutorial moved to [its own concept and brief 480](concept_tutorial_npc.md); T-013 [brief 460](briefs/460_hard_pixel_finish.md) | |

The sheet for each section is checked against the running game before the
sitting: this table's notes are pointers, not facts about today's screen.

## The list

*(Items go under their section as the sittings happen.)*

### 1. The mat and Tokens

**The sheet (2026-11-02). From the docs and the code, not seen in the running
game: a second game server risks disturbing the eye-check under way, so where
this disagrees with the screen, the screen wins.**

- **Ground**: one surface with no grid, drawn per place; Stone is a code-drawn
  stand-in until the owner's pieces.
- **A Token at rest**: its art, its name over the art's bottom edge, a "!" when it
  waits or can't work; a station's gear; no round rings.
- **Working**: one plate on the seam under hero and Token (skill, output or input,
  charges); resting the pointer opens the full line. An idle Token gets the same
  plate on hover. Enemies show name and HP only.
- **Clicking**: the Token card, with its recipes.
- **Moving**: a Token lands where dropped, nudges up to 160 u, or flies back; a
  player's drop pushes nothing; up to 40 % overlap; 128 Tokens at most. Trees, veins
  and placed nodes stay where they stand.
- **Fights**: a thin HP bar with number and percentage over a fighter, a fight plate.
- **Loot**: collected by hovering.
- **Speech and effects**: hero bubbles, level-up numbers, hit floats, ambient life.

**Already filed, no need to repeat**: the top bar has its own section. Skill icon
emoji: T-297. Questions still waiting on the owner: **T-012** (should a Token growing
or transforming push its neighbours?), **T-013** (the last soft glows and shadows on
badges: hard-pixel too?), **T-011** (hit animations, transform glow and loot flight
never seen by an agent). The glow and tutorial rings: section 13.

**The list** (owner, 2026-11-02; the tags are the planning agent's draft)

| # | The owner's wish | Tags |
|---|---|---|
| 1 | **Terrain upgrades**: "improving the terrain styling", "making the rivers look more organic, improving water appearance". | must, design |
| 2 | **Tokens a little more spaced out from each other.** | must, tweak |
| 3 | **Tokens may not jump to the top level when hovered** ("I think we may not want"): try it and look. | must, tweak |
| 4 | **Heroes are always on top.** | must, tweak |
| 5 | **Fights move to open space** when several crowd one area: heroes and enemies step to a clear spot. The minimized fight display that can be expanded is the fallback idea, not built now. | must, design |
| 6 | **Token card: less cluttered and more stylish**, the name more of a header, the basic information a stat block. | must, design |
| 7 | **Token card: scroll arrows only when there is more to scroll to.** | must, tweak |
| 8 | **Token card: events like regrowing get their own section.** | must, tweak |
| 9 | **Token card: a requirements section**, for things like tools and consumption. | must, tweak |
| 10 | **Token card: the background art is displayed larger.** | must, tweak |
| 11 | **Token card: long output lists (fishing) show the output it will produce**, with the others in a collapsed section. | must, tweak |
| 12 | **Loot flight gets an arc back**: "we lost the arc effect at some point, possibly for performance"; explore ways to bring something like it back without compromising performance. | nice, design |
| 13 | **Damage numbers appear over the hero or enemy.** | must, tweak |
| 14 | **An effect proc appears above the health bars**, like speech bubbles. | must, tweak |

**Combat look** (owner, 2026-11-02): "We will need to do more iterative designs to
make sure that combat looks good and is clear throughout the fight." Taken up in
section 8; items 5, 13 and 14 feed it.

**Where they went** (owner, 2026-11-02): items 2, 3, 4 and 6 to 11, brief 350. Item
12, T-295. Items 5, 13, 14, section 8. Item 1, brief 370.

**Terrain round (item 1): picked 2026-11-03**, on a live comparison
([research/terrain_round](research/terrain_round/)); [brief 370](briefs/370_terrain_detail.md).
Rivers: the A and C looks, with wider sections or tighter winding and different positions
by map generation. Water: A, depth bands. Ground: A, ragged borders, and B, settled dirt.

**Looked at, no change** (owner, 2026-11-02): the work plate; moving and dropping
Tokens. **T-012 decided**: growth and transforms keep pushing spawned neighbours.

### 8. Combat

**The sheet (2026-11-02). From the GDD and the code, not seen in the running game;
where this disagrees with the screen, the screen wins.**

- **Over each fighter**: a thin health bar with number and percentage above it
  ("17 · 57%"); beside the enemy's bar a crossed-swords chip that opens the panel.
- **Under their feet**: the fight plate: both styles, a divider, the hero's elixirs with
  fights left.
- **Floating numbers**: at each fighter's outer side, gone in half a second: white on
  the enemy, red on the hero, Miss, a big Crit!, Weak! or Resisted with the hit's types,
  enemy moves by name, green heals, Venom and Burn ticks. Up to three lanes.
- **The fight panel**: one at a time, over the mat: both fighters on a strip, the versus
  card, elixirs and statuses, enemy moves, a log closed until asked for.
- **Enemy card**: on resting the pointer: level, style, health, hit, swing, resistances,
  moves.
- **Art**: the combat icons are code-drawn stand-ins; only the Cow has an animation sheet,
  so other enemies stand still in the strip.

**Carried in**: the mat list's items 5 (fights move to open space), 13 (damage numbers
over the fighter) and 14 (procs above the health bars, like speech), and the owner's
wish for iterative designs "to make sure that combat looks good and is clear throughout
the fight". **Already filed**: T-249 (who swings first after a kill, on an eye-check
branch), T-198 (bubbles cost the most per fight).

**The list** (owner, 2026-11-02; the tags are the planning agent's draft). "There's a
lot of visual information happening at once." What just happened is the hardest to tell.

| # | The owner's wish | Tags |
|---|---|---|
| 1 | **The fight plate goes**: "not needed"; "the skill icons and bar are too much info"; "leave the combat matchup for the detail screen". Its elixir counts move to the window. | must, tweak |
| 2 | **The detail view button stands where the plate was.** | must, tweak |
| 3 | **Fighters on the mat use the same stylized HP bar with numbers on it** as the hero bar, smaller, heroes and enemies alike. | must, design |
| 4 | **Crowded fights step to open space**: only when a fight would overlap another or a hero, a short way to a clear spot; a lone fight stays where it starts; no clear spot, it stays. (mat item 5) | must, design |
| 5 | **Floats: fewer and clearer, over the fighter**: damage number, Crit!, Miss, heals. Type icons and Weak! or Resisted move to the window and its log. (mat item 13) | must, tweak |
| 6 | **A named enemy move or effect proc appears above the health bar**, in a speech-style bubble. (mat item 14) | must, tweak |
| 7 | **The fight panel becomes a window**, "more like a window in an operating system": drag it, minimize it, and open several at once. | must, design |
| 8 | **A minimized window is a small tab**: hero against enemy with both healths, in a strip above the hero bar. | must, design |
| 9 | **The window displays the battle larger.** | must, tweak |
| 10 | **The header reads "Kira vs Goblin"**; no "Beat goblin in 0:11" text. | must, tweak |
| 11 | **Combat stats are a stat block** (matching the Token card, brief 350). | must, tweak |
| 12 | **Enemy attacks get a better style**, labelled appropriately. | must, design |
| 13 | **Active effects shown, probably in two columns.** | must, tweak |

**How it is designed** (owner, 2026-11-02): picture mock-ups of the window and the mat
first to choose a direction, then a test fight in the running game, from a QA panel
button, for the owner to judge the motion. More rounds as needed: "iterative designs to
make sure that combat looks good and is clear throughout the fight".

**Amends** the owner's combat screen picks of 2026-10-24/25 (GDD "The combat screen"):
the outer-side floats, the fight plate, the one-at-a-time panel, "17 · 57%" above the bar.

### 7. World map

**The sheet (2026-11-03). From the code and the 30 October and 1 November captures
(`research/world_w2`, `world_w3`), not today's game; where this disagrees with the
screen, the screen wins.**

- **The left page**: flat hexes in a colour per kit (code-drawn until the owner's hex
  art), each with up to two item sprites and "+N" for the rest, a flag on the current
  place. Tabs: World and Regions.
- **Hover**: name, ring and kit, what it yields, the price with have and need, "can be
  settled".
- **The right page**: the chosen place: name, what it is, yields, and its settle button.
- **The tome**: the owner's book frame, opened from the blue bubble; the close X at its
  corner.
- **Settling**: the requirements are paid at once and the mat arrives darkened with a
  small fight; clearing it brightens the mat. Travel between settled places is free.

**Already filed**: hex art on the art list; T-294 (the ladder's rungs on the world
tables). Rulings kept: every cell's contents visible from the start; no landmarks.

**The list** (owner, 2026-11-03; the tags are the planning agent's draft)

| # | The owner's wish | Tags |
|---|---|---|
| 1 | **A bigger map you can move around, like the encyclopedia.** | must, tweak |
| 2 | **More detail and refinement on the hexes**, "perhaps showing a terrain sample"; "anything we can do to make the hexes look better". | must, design |
| 3 | **Cell states**: settled and settle-able in full colour, a cell you can settle right now also standing out (a gold outline or small pulse); next to you but too expensive or behind a ring upgrade: darkened; not next to anything you hold: black and white; any cell turns to colour when hovered. Contents stay visible. | must, tweak |
| 4 | **No hexes shown outside the third ring unless they are accessible.** | must, tweak |
| 5 | **The ring shown between the hexes**: a decorated border line along the edges where rings meet, no numbers. | must, tweak |
| 6 | **A Guild Hall star per ring from ring 2**: ring 1 open from the start; a star allows settling ring 2, another ring 3, then one per wild ring. | must, design |
| 7 | **The hover title is the area's name** ("Elderfield") with the terrain types underneath ("Mountain Rivers"). Ring information is not shown to the player. | must, tweak |
| 8 | **The price uses our item style**, and inventory values our 9.9k shorthand. | must, tweak |
| 9 | **Drops and yields show on the inspection panel**, not the hover tip. | must, tweak |
| 10 | **The right page is thinner.** | must, tweak |
| 11 | **The settle button is larger and more prominent.** | must, tweak |
| 12 | **No "The guild is here" text; the flag is larger and more prominent.** | must, tweak |
| 13 | **More ceremony on settling: a title reveal**: the place's name and terrain large across the mat, with a fanfare. | must, tweak |
| 14 | **More ceremony: a hero leads the way**: heroes walk in from the mat's edge. | must, design |
| 15 | **The tome's tabs go.** Travel is on the panel; what else the Regions page held moves there. | must, tweak |
| 16 | **A different style for the world map** (owner, 2026-11-04, from the encyclopedia walk): "I want the view to pan downwards to look at a generated world map with the hex map and inspection panels sitting overtop of it." Replaces the book frame. | must, design |

**Amends**: `concept_world_map.md` (a settled cell's only gate was its price; the wild
rings came into view as you neared them), and the ledger's budgets must count the stars.

**Settling's order** (owner, 2026-11-05): the gold banner, the title, heroes walk in and stand
idle around the Hall; no fight starts by itself. The enemies stand spread out, still until attacked.

### 6. Guild Hall

**The sheet (2026-11-03). From the GDD, the code and the 30 October captures
(`research/hall_h1`), not today's game; where this disagrees with the screen, the
screen wins.**

- **The sky**: a full-screen night sky of constellations, a constellation per skill plus the
  Hearth and the Well; grey, blue and gold stars by state; links between them; dragged when it
  doesn't fit; a camera move from the mat.
- **A star's details**: the panel: picture, name, what it does, price, Upgrade button.
- **Hall effects**: a popover listing what the guild holds.
- **On the mat**: the Hall stands in the middle; quest Tokens beside it.

**Already filed**: star prices wait for a Hall balance pass; ring stars arrive with brief
380; star pictures on the art list.

**The list** (owner, 2026-11-03; the tags are the planning agent's draft). "Overall it
looks cluttered."

| # | The owner's wish | Tags |
|---|---|---|
| 1 | **No rank numbers on the sky by default** (they show on hover). | must, tweak |
| 2 | **Outlines of item sprites over the stars**, so they look distinct from each other ("I wonder if"). | must, design |
| 3 | **Stars more spaced out.** | must, tweak |
| 4 | **Titles always underneath the star.** | must, tweak |
| 5 | **The sky runs full-screen under everything**: behind the nav bubbles and the panel, with no hard stop at the edges. | must, tweak |
| 6 | **More ceremony on upgrading**: the star bursts; links light up to what it opened; a bigger moment for finishing a constellation. | must, design |
| 7 | **The star panel has its own purple borders** ("maybe"). | nice, design |
| 8 | **The panel's words**: a clear sentence at the top saying what the star does, then brief numbers: now, next, and a line for the max rank. | must, tweak |
| 9 | **The panel's layout, price and Upgrade button** want work: the header and stat block style of the Token card, the price in our item style. | must, tweak |
| 10 | **Hall effects: drops run on one lap, 10 minutes by default, reduced to 5 by Guild Hall upgrades.** (Today: 5 minutes.) | must, design |
| 11 | **Hall effects: no time on each item entry**; the lap's time is listed as a boost. | must, tweak |
| 12 | **"Modifiers" are called "boosts"** there. | must, tweak |
| 13 | **More possible upgrades**: a review of what else could be upgraded. An agent reports (every number that could be a star, what similar games let you upgrade, what each does to pacing), then an interview; the result joins the content roadmap as a star pack. Report: [research/upgrade_review_2026-11-03.md](research/upgrade_review_2026-11-03.md); interview open. | must, design |

**Looked at, no change** (owner, 2026-11-03): the camera move, dragging, how the sky opens.

### 9. Encyclopedia

**The sheet (2026-11-04). From [concept_knowledge.md](concept_knowledge.md), the code and
`research/encyclopedia_display` (a prototype before the build), not today's game; where this disagrees with the screen,
the screen wins.** After five looks the owner okayed it on 1 November: "this will work for now".

- **The frame**: the Atlas's book, open on two pages. A green nav bubble opens it. The mat and top bar stay behind it.
- **Opening page**: search across items, Tokens, enemies and recipes; recently viewed; recently collected new items.
- **The chart**: the entry in the middle, where it comes from on the left and what it goes into on the right. Black boxes with
  gold edges on the parchment, sprite and name, with the need in red when short. Skill marks and levels on the lines. A click grows the
  chart and makes that box the focus; drag to look around; Back to Start and Contents at the top.
- **Knowledge**: everything is shown from the start (owner, ruled); ticks mark what this run has.
- **Opened from**: its bubble, a Token card's book button, and clicking an item stub while the book is open.
- **Not there**: totals (how much of the game this run has found). A link from the Bank: its tile click was removed, to
  return with the future item inspection panel, which brief 400 B3 now builds without naming the link.

**Already filed or coming**: a separate encyclopedia book and a Combat mark (`owner_art_list.md`).

**The list** (owner, 2026-11-04; the tags are the planning agent's draft)

| # | The owner's wish | Tags |
|---|---|---|
| 1 | **Requirements and products read differently on the chart.** "The Iron Woodaxe chains into the trees, which is accurate but it's different than an Oak Tree producing Oak Wood. We should examine a better way to display these relationships." | must, design |
| 2 | **Counts and small progress bars in the bottom left corner of the book**: how much of each kind this run has found. | must, tweak |
| 3 | **A recipe's ingredients link to their pages.** | must, tweak |
| 4 | **The Bank's inspection window links to the page**, as promised when its tile click was removed (planning agent, from the concept; add to brief 400 B3). | must, tweak |

**Looked at, no change**: the rest of the chart. **The book stays**: with the world map leaving the tome, the encyclopedia keeps the book (owner's new world map style, section 7, item 16).

### 13. Tutorial and highlights

**The sheet (2026-11-04). From the code and `research/quiet_tokens` (a capture before the 30 October text), not
today's game; where this disagrees with the screen, the screen wins.**

- **How a step shows**: one small quest Token beside the Hall, "0/1", with a tooltip on hover: title, the
  cartographer's line, the plain instruction, progress, reward. Nothing else on screen says what to do next. Claim by
  clicking the finished Token; its reward lands as loot.
- **The 12 steps**: recruit a hero (Bunk Beds; changing, brief 450); equip a Woodaxe; send your hero to a tree; gather
  3 times; collect 10 loot; buy a Foundation; build a station; craft something; build a camp; make a copper tool; beat a
  Goblin; settle your first place. The last three are marked drafts for the owner to rewrite.
- **Highlights**: none guide the player today; the gold outline is used for banners and quest attention.
- **Not taught**: Hall stars beyond the first; Work Permissions; Demolish; the Token Summary; food beyond one line.

**Already filed or coming**: the owner's note of 2026-10-08, replace glows and assist rings with a hard gold outline;
T-013, the last glows and text shadows; the quest board, where the current step would be the top row (T-176, postponed);
moving the tutorial into the CMS (T-014); the Old Site step (T-258).

**The list** (owner, 2026-11-04; the tags are the planning agent's draft)

| # | The owner's wish | Tags |
|---|---|---|
| 1 | **A completely different tutorial**: an NPC with special speech bubbles who hand-holds the player through the essentials; the first step probably shows how to assign a hero to a task. Moved to [concept_tutorial_npc.md](concept_tutorial_npc.md), draft. | design |
| 2 | **A hard gold outline on the thing to use next.** With item 1. | design |
| 3 | **The very early game planned separately**, with the tutorial. Listed in [ideas.md](ideas.md). | design |
| 4 | **All the last soft glows, text shadows and drop shadows go to hard pixel** (T-013, decided). | must, design |

### 11. Settings and the start screen

**The sheet (2026-11-03). From the code and `research/pixel_frames/round2/sheet_2_settings.png`, not
today's game; where this disagrees with the screen, the screen wins.**

- **Settings**: a window with tabs down the side. **Accessibility**: Typography Scale, Font, All Caps. **Notifications**:
  one switch, Item Stubs. **Gameplay**: Auto-Save Interval (1 minute, labelled Dev; 10 minutes; 1 hour; Off), Save Game
  Now, Background Tile, Menu on Right Side, Flying Items. **Audio**: Master, Music, SFX; master starts at 0, so a new
  game is silent. **Dev Tools**: only in dev builds. Reset Defaults and Done at the bottom.
- **"Coming soon", five, not the nine older notes say**: Theme Mode, Zoom to Cursor, Animations, Master Tooltips, Item
  Tooltips.
- **The start screen**: a plain window, "Choose a Save", over a dark screen, with no logo. Three slots; a filled one
  shows heroes, playtime and last saved as emoji, then Load and a delete with a confirm.
- **Not there**: gameplay hotkeys; a way to back up a save (the code can export and import one, with no button).

**Already filed or coming**: the emoji stats become Lucide (T-293); away time on each slot (brief 440); the red gradient
(brief 400 B1).

**The list** (owner, 2026-11-03 and 11-04; the tags are the planning agent's draft)

| # | The owner's wish | Tags |
|---|---|---|
| 1 | **The five "coming soon" controls go.** | must, tweak |
| 2 | **A title screen**: the game name in the display font over a banner picture, the slots beneath in the pixel kit. The owner's logo and painting replace it later. | must, design |
| 3 | **Three tabs**: Display, Game, Audio (Dev Tools only in dev builds); "1 Minute (Dev)" leaves shipped builds. | must, tweak |
| 4 | **Back up a save**: "should just open the folder where the save file is, let the player copy or modify it". | must, design |
| 5 | **A new game names the Guild**; one name, the Guild's, shown on the slot and renameable. | must, design |
| 6 | **A new game shows the world hex map with a reroll.** *(Owner 2026-11-05: rings 1 to 3 only, not fully shown.)* | must, design |
| 7 | **A new game makes the first hero**: name, appearance, flag colour, and recolour the sprite once that system exists. | must, design |

**Not taken** (owner, 2026-11-03): sound on by default and panel hotkeys.

**Checked** (planning agent, from the code):

- **Item 4: saves are not files today.** They live in the app's browser storage (`localStorage`, `SaveManager.js`), so
  there is no folder to open. Saves must become real files in the desktop build, read at load, so a copied or edited one
  works; today's saves move across once. The app also needs the right to write files and open a folder (`src-tauri`).
- **Item 6: the pieces exist.** `World.previewWorld(seed)` makes a world without keeping it, and generation is seeded.
  Today the seed comes from when the game was created, so a chosen seed must be kept in the save.
- **Item 7: the recolour system is not built**, so it joins this screen later (T-302). The rest reuses the hero edit
  window. The tutorial's first step (buy Bunk Beds, the first hero free) must change.

### 12. While-you-were-away summary

**The sheet (2026-11-03). From the code and a capture of 25 October
(`docs/archive/eyecheck/shots/2026-10-25_c6b_catchup.png`), not today's game; where this disagrees with
the screen, the screen wins.**

- **When**: after a gap of 2 minutes or more, up to 24 hours played; a loading bar first, then the panel.
- **The panel**: 28 rem wide, centred over the dimmed game, up to 85 % of the height, then a scroll bar.
- **In order**: how long you were away; Items produced (waiting on the mat); Items banked; Items spent, each
  a full-width row per item; the fights (won and lost, beaten, knocked out, used, drops); Level-ups; Tokens
  used up.
- **Buttons**: Return to the Guild (or Esc), and Load as I left it, with a confirmation, which throws away
  the time away.
- **XP**: only level-ups show (owner, earlier: "items and XP gained").

**Noticed**: the same item can show up to three times (produced, then under drops; spent, then under used). Rows
get tall: the capture is nearly full at 20 minutes with few kinds, and level-ups come last. A scroll bar goes
against the arrow button rule.

**Coming**: new recipes, first finds and items lost to a full Bank (brief 430).

**The list** (owner, 2026-11-03; the tags are the planning agent's draft)

| # | The owner's wish | Tags |
|---|---|---|
| 1 | **Two columns**: item changes on the left, in the rows as they are today; a second column for the news on the right. | must, tweak |
| 2 | **One item list, net amount**: each item once, green + or red −, with gained and spent on hover. | must, tweak |
| 3 | **"Fights are news, just shows the killcount for an enemy"**: the enemy and how many. Won and lost, used and drops go. | must, tweak |
| 4 | **The heading centred**: "While you were away" and "You were away 32 min". | must, tweak |
| 5 | **A second confirm box on both** Return to the Guild and Load as I left it. | must, tweak |
| 6 | **Save slots show how much away time has built up.** | must, tweak |

**Planning agent's calls**: the news column holds knock-outs and items lost first, then new recipes, first
finds (brief 430), level-ups, Tokens used up and the kill counts. Items waiting on the mat keep a small mark in
the list. Esc asks the same confirm as Return. Scrolling uses our arrow buttons. A slot past 24 hours reads "24 h (max)". XP per skill is not added: the
owner was offered it and didn't take it.

**Checked** (planning agent, from the code, not in a running game): the owner asked whether time away works
with the game closed. It does: the save's time is stored, and loading plays from it (`SaveManager.loadedSavedAt`,
`EngineBootstrap`, `CatchUp.run`), up to 24 hours; anything beyond is dropped and reported.

### 10. Notifications

**The sheet (2026-11-03). From [concept_notifications.md](concept_notifications.md), the code and a
capture from `research/encyclopedia_300`, not today's game; where this disagrees with the screen, the
screen wins.**

- **Item stubs**, flush to the right edge under the top bar: amount and sprite, one per item, the net
  flow, green or red. Hover grows the box left with the name and rate per hour. Left-click pins, right-click
  clears, Clear all above the column. A stub fades about 5 minutes after its item last changed. A first
  find is gold with "New!" until hovered. Collected loot flies to its stub.
- **Banners**, top centre under the bar, about 480 px: a sprite, a large title, a line of detail, on
  black with a gold edge (milestones) or red (problems). **Each stays until clicked**, up to three
  stacked, then "+N". Hover outlines the hero or Token it names.
- **Milestones today**: new recipe, new hero, promotion, Guild Hall upgrade. **Problems today**: a hero
  knocked out, a full Bank losing items, a damaged save or a failed load.
- **Deliberately no notification**: new enemy seen, quests, a Token used up, hero recovered, combat won,
  Shop purchases. Level-ups show on the hero; refusals are callouts on the mat.
- **No log** (T-193, only if it proves needed).

**Already filed or coming**: the ribbon art for banners (owner, later); the speech frame (T-243, merged).

**The list** (owner, 2026-11-03; the tags are the planning agent's draft)

| # | The owner's wish | Tags |
|---|---|---|
| 1 | **Milestones and warnings no longer go missing after time away**, shown both ways: listed in the away summary, and as banners after it closes. | must, bug |
| 2 | **A gold banner when a place is settled.** | must, tweak |

**Checked for item 1** (planning agent, from the code): the owner suspected this and is right. Every
notification route is a `UI_LISTENER` and a catch-up keeps the bus quiet (`CatchUp.js`, `routing.js`), so
new recipes, a full Bank losing items and first finds are lost; the summary lists none of them. A knocked-out
hero is lost as a banner but listed under wounded. New heroes and Hall upgrades are bought by the player, so
they cannot happen while away.

**Looked at, no change** (owner, 2026-11-03): banners stay until clicked; item stubs; banners stay black
until the owner's ribbon art.

### 2. Top bar

**The sheet (2026-11-03). From the code and the captures in `research/top_bar` (23 October), not
today's game; where this disagrees with the screen, the screen wins.**

- **The bar**: a strip above the mat, as wide as it, 76 px tall, in the studded frame on black. Only on
  the mat, never on the Guild Hall screen.
- **Left, the place**: its name in the display size over its banner picture, fading into the black.
- **Middle, Tokens**: a placeholder tree icon and "Tokens 2/128", red at the cap. **A click** opens the
  Token Summary (one row per type, missing items on top, hover lights them on the mat).
- **Middle, Upkeep**: a placeholder gold coin icon and "Upkeep 3/min", the items per minute of every
  kind added together. **A hover** opens the Upkeep Summary (per item: rate, stock, a rough
  runs-out, who uses it, who waits unpaid).
- **Right, modes**: Disallow and Demolish buttons with text marks (⊘, ✕) and their names.
- **While a mode is on**: its sentence replaces the middle in full. Demolish, in red: "Click Tokens to
  mark them. A Construction hero takes them down. Nothing is refunded." Beside it, Cancel All Marks
  (Disallow has its own clear button).

**Noticed**: gold left the game, so the coin suggests something that no longer exists. "3/min" adds
different items into one number. Tokens opens on a click and Upkeep on a hover.

**Already filed or coming**: the buttons take their cursor's pixel art (T-293); new Token and upkeep
icons (`owner_art_list.md`); every panel's gradient (brief 400 B1, which doesn't name this bar).

**The list** (owner, 2026-11-03; the tags are the planning agent's draft)

| # | The owner's wish | Tags |
|---|---|---|
| 1 | **The background image larger**, so it goes further across the bar. | must, tweak |
| 2 | **Tokens and Upkeep both open on hover.** Replaces the click on Tokens (`ui_rework_list.md`, Token Summary). | must, tweak |
| 3 | **Demolish gets a pixel X icon.** | must, tweak |
| 4 | **Disallow goes**: "We don't need disallow anymore." | must, design |

**Looked at, no change** (owner, 2026-11-03): the gold coin stays as the Upkeep icon, so it needs no new
art; the Upkeep number; the Demolish message.

**Planning agent's calls**: Demolish keeps its word beside the icon. Disallow is removed as a whole
mechanic, not just its button.

### 5. Shop

**The sheet (2026-11-03). From the code and `data/tokens.json`, with a capture from 24 October
(`research/drawers/after_1920_shop.png`), not today's game; where this disagrees with the screen,
the screen wins.**

- **The drawer**: from the left edge, a third of the screen wide; a title, "Tokens x / y" and a
  close X; arrow bars instead of a scroll bar. The hint line reads "Drag a Token onto the mat to
  buy it".
- **Rows**: a fixed height, the name and price on the left and the Token at 128 px on the right; the
  whole row is the handle (owner, earlier: "taking an item out of the shop and placing it on the
  map"). The price is a 2 x 2 grid of item ribbons, have / need, short in red.
- **Sections**: a heading per skill, or General.
- **On sale today, five**: Wood Foundation and Stone Foundation (Construction), Farmland (Farming),
  Coast (Fishing), Goblin Camp (Melee). Everything is listed from the start; price is the only gate.
  The GDD still says ten (stale).
- **Can't be bought**: dimmed, can't be picked up, and a red "Need 10× Stone, 5× Oak Wood" beside the
  name, which repeats what the ribbons below already show.
- **The drag**: the drawer slides to a lip while over the mat and back when over the drawer. Payment
  happens on the drop. A drop on the drawer is a cancel.
- **What a Token does**: nowhere. There's no inspect panel; the tooltip only says "Drag X onto the mat
  to buy it", so a new player buys a Foundation without being told it becomes a station.
- **A purchase**: no moment of its own (`concept_notifications.md`: Shop purchases notify nothing).
- **Groups**: one row with a dropdown (Foundation tiers, anvils) is built, and no Token uses it yet.

**Already filed or coming**: the panel's green gradient (brief 400 B1); the Token card's header and stat
block (brief 350 T2); the audit for a respawning Token on sale (T-141); an unreachable refund path
(T-082).

**The list** (owner, 2026-11-03; the tags are the planning agent's draft)

| # | The owner's wish | Tags |
|---|---|---|
| 1 | **A Shop that pops up from the bottom, over the hero bar**, in place of the drawer from the left. | must, design |
| 2 | **Foundations only**: Coast and Goblin Camp leave the Shop. | must, design |
| 3 | **Skill icons on each Foundation**, to hint at what it is good for, with the item costs underneath them. They replace the skill headings. | must, tweak |
| 4 | **Foundation types reworked**: each type is used for a different kind of construction (table below). Wood is the main support structure, first on the list. | must, design |
| 5 | **An Excavation Foundation** for mineshafts and quarries. | must, design |
| 6 | **A Battlefield Foundation** for enemy spawners ("maybe"). | must, design |
| 7 | **When you can't afford one**: only the red short amounts, and the Token sprite dimmed. | must, tweak |

**Foundations** (the owner's rule, with today's buildings placed by the planning agent):

| Foundation | Skill icons | Builds |
|---|---|---|
| Wood (first) | Crafting, Cooking, Alchemy, Fishing, Forestry | Workbench, Cooking Pot, Brewery, Alchemy Table, Tannery, Fir Workbench, Windmill, Composter, Beehive, Dock, Fishing Hut, Logging Camp, Farmstead, Minecart, **Mining Camp (moves from Stone)** |
| Stone | Smithing, Faith | Furnace, Iron Furnace, Copper Smithy, Iron Smithy, Well, Fighter's Academy (retired) |
| Farmland | Farming, Forestry | Field, Herb Garden, Grapevine, Apple Orchard, and the planted forests |
| Excavation (new) | Mining | Copper Mine, Coal Mine, Quarry (from Wood) |
| Battlefield (new) | Melee, Ranged, Magic | The 22 enemy spawners built from a banner: Goblin Camp, Wolf Den, Slime Pit and the rest (from Wood) |

**Looked at, no change** (owner, 2026-11-03): buying has no moment of its own; the Token landing is the
feedback.

**Planning agent's calls**: a full Token cap keeps its message, since no price shows it. Hovering a
skill icon names the skill, and hovering a card lists what the Foundation builds. The dropdown for
tiers stays on a card for when tiers arrive (`ui_rework_list.md`).

### 4. Bank

**The sheet (2026-11-03). From the GDD, the code and the captures in `research/bank_310`, not
today's game; where this disagrees with the screen, the screen wins.**

- **The drawer**: a panel with a title and close X; while open, the mat is locked and the heroes
  stand as a vertical column beside it (brief 340 changes that column).
- **Tabs**: each holds 64 kinds; a tab's icon is its first item; more tabs through Bank Tabs.
- **Tiles**: an item sprite and count; drag to reorder, or onto a hero to equip.
- **Search**: by name, tag and type, across tabs. **Select** mode for several items. **Sort**: this
  tab or the entire Bank, by type, tier, name.
- **Item tooltip**: name, type, effects, sources.

**Already filed**: icon rule items (the locked tab's Lucide lock becomes the pixel one; the unknown
item look; the header icon), the item tooltip showing a weapon's damage (T-246, merged or on its way).

**The list** (owner, 2026-11-03; the tags are the planning agent's draft)

| # | The owner's wish | Tags |
|---|---|---|
| 1 | **A pixelated gradient background**, not plain black. | must, design |
| 2 | **On every drawer and panel, with different colours for each**, so they look distinct. | must, tweak |
| 3 | **Item tooltip**: name as a header, count underneath, then types and tags. | must, tweak |
| 4 | **An inspection window at the bottom of the Bank**, with the item sprite larger "so it can be examined closely". | must, tweak |
| 5 | **It shows stats like lifetime collected.** | must, tweak |
| 6 | **Discard there**, with amounts 1, 50 %, All, All −1, or a slider. *(Moved later, T-306; owner 2026-11-05: always confirm, and hoping to sell instead.)* | must, tweak |
| 7 | **Use there, for items that can be used** (bird nests): opens instantly, with no hero; authored in the CMS. | must, design |
| 8 | **Use has the same amounts** as Discard. | must, tweak |

**Looked at, no change** (owner, 2026-11-03): tabs, tiles, Search, Select and Sort.

### 3. Hero bar and hero sheet

**The sheet (2026-11-02). Read from the code, not yet seen in the running game:
the game would not load during the check, so where this disagrees with the
screen, the screen wins.**

**The hero bar, one hero**
- A standing figure with their flag; drag it onto the mat to give an order.
- Name (gold when selected, red with a text cross when wounded).
- A status word: Idle, Busy or Hurt; or Needs a job, with a yellow mark.
- An HP bar, the exact number on hover.
- Level-up alerts in speech bubbles, three at a time with arrows to page, kept
  until clicked; a perk reached gets its own bubble.
- Hover lights the hero and their job; click opens the sheet.

**The hero sheet**
- Top: the figure at twice mat size with its flag (drag it to send them out),
  name, HP bar, an edit quill (a placeholder) and the red close X.
- Loadout: nine slots in a 3 by 3 grid; any item in any slot; drag to equip,
  right-click to unequip.
- Skills: one row per skill: icon, name, level out of 99, a thin XP bar. Hover
  gives what the skill is for, XP and perks; a click opens exact XP, XP per hour,
  time to next level and what each perk does.
- Edit window: name, portrait, flag colour.

**Already filed, no need to repeat**
- Skill icons in emoji: T-297.
- The wounded text cross: a heart is pixel under the icon rule. The gear slot
  marks are pixel today; the icon rule moves them to Lucide.
- Bubbles cost the most drawing time per hero: T-198.
- Locked 2026-10-07: the bar stays horizontal at the bottom, spaced for 8 heroes;
  the sheet is a full-height side panel in the same place with the Bank open or
  closed.
- Never seen by an agent: HP bar thickness, colour, and its height over the sprite.

**The list** (owner, 2026-11-02; the tags are the planning agent's draft, for the
owner to correct)

| # | The owner's wish | Tags |
|---|---|---|
| 1 | **HP shows as numbers on a stylized bar**, on the hero bar and the sheet: "a more stylized bar, with the numbers overtop of it. It should match our pixel style." | must, design (a look to pick) |
| 2 | **The status moves to hover, as a speech bubble, and names the task**: "being specific about the task they are on", not just Busy. Replaces the status word under the name. | must, tweak |
| 3 | **Alert marks beside the hero, where the flag is now**: yellow for idle, red for wounded. They show without hovering. The red one replaces the text cross. | must, tweak |
| 4 | **The flag moves to the other side of the hero**, and on the sheet goes behind the hero. | must, tweak |
| 5 | **The Bank's vertical hero column**: "The vertical bar needs work": larger portraits. | must, tweak |
| 6 | **The same column: the name shown "in a more stylized way"**. | nice, design (a look to pick) |
| 7 | **The sheet's skills fit two side by side**: each box shows icon, level and XP bar. The name moves to the hover tip, with what the skill is for and its perks. | must, tweak |
| 8 | **The sheet scrolls with our arrow buttons at top and bottom**, not a scroll bar. | must, tweak |
| 9 | **Close and edit move to the side space beside the sheet**, where the hero column stands, in the same spot whether the Bank is open or closed. | must, tweak |
| 10 | **Loadout: drag an item from one slot to another** on the same hero. | must, tweak |
| 11 | **Loadout: drag an item from one hero to another.** | must, tweak |
| 12 | **Dragging a hero from the bar starts the same flag drag as moving a hero on the mat**: only the flag is carried, not the large hero picture. | must, tweak |
| 13 | **The bottom bar's heroes "slightly more spaced out".** | must, tweak |
| 14 | **The bottom bar's hero names "a little bit larger".** | must, tweak |

**Planning agent's defaults** (simplest choice, owner may change):
- Item 11: drop onto the other hero in the column or the bar; it lands in their
  first empty slot; a full loadout refuses with a reason and the item stays.
- Item 7: clicking a skill still opens its exact numbers, across both columns.
- Item 12: the Bank's hero column and the sheet's large figure send a hero out the
  same way; dragging one hero onto another on the bar still reorders them.
- Items 1 and 6: the builder shows two or three looks on the running game for the
  owner to pick (owner directs the art).

**Looked at, no change** (owner, 2026-11-02): level-up bubbles; the edit window. It will need the hero recolouring system in time
([concept_living_game.md](concept_living_game.md)), not part of this section.
