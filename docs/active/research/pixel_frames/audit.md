# Pixel frames: audit of every window (T-136, brief 210 F1)

What every modal, drawer, popover, tooltip, inspect panel, toast and menu wore on 2026-10-24
(branch `backlog/pixel-frames`, from `main` at ea3e0555), and what this batch did to it. The rule
is UI_STYLE "Pixel frames": **chamfer** for small floating things, **studs** for big docked
panels, one colour, a hard 2-art-pixel shadow; no rounded corners, blurred shadows or
translucent hairline edges; rows never boxed.

Frame words below: **pixel** = `PixelFrame` / `ui-frame-*` already; **rounded** = `rounded-*`
corners; **blurred** = a soft `shadow-[…]`, `shadow-lg` or `gi-shadow-deep`; **hairline** = a
1 px translucent `border-white/10`-style edge.

## Reframed in this batch

| Window | File | Before | After |
|---|---|---|---|
| **The shared tooltip** (every hover tip: top-bar badges, hero tabs, Token bubbles, quests, flags, passive production, Bank item tips, Work Permissions, Shop rows, Atlas) | `src/ui/components/base/Tooltip.jsx` (`TipBox`) | rounded, blurred, gold/40 hairline, black/90 | chamfer, hard shadow |
| Token Summary (click the top bar's Token count) | `src/ui/components/board/MatCapBadge.jsx` (`TokenSummaryPanel`) | rounded, blurred, gold/40 hairline | chamfer |
| While you were away: loading bar and summary | `src/ui/components/hud/CatchUpOverlay.jsx` | rounded, blurred, gold/40 hairline | chamfer |
| **The modal shell**: Save slots, Settings, Edit hero, Job change, Promotion, Typography scale | `src/ui/components/base/GIModal.jsx` (+ the two callers that painted their own grey panel: `SettingsModal.jsx`, `SlotSelectionModal.jsx`) | rounded, blurred (`gi-shadow-deep`), grey border | chamfer |
| Bank drawer | `src/ui/components/drawer/BankDrawer.jsx` | blurred 40 px shadow, primary/30 hairline edge | studs |
| Shop drawer | `src/ui/components/drawer/ShopDrawer.jsx` | blurred 40 px shadow, primary/30 hairline edge | studs |
| Hero panel (click a hero in the bar, or from the Bank) | `src/ui/components/dock/BankHeroPanel.jsx` | blurred 30 px shadow, white/10 hairline edge (green while a drop recalls) | studs; the recall green is a 2 px outline around the frame, as the Work Permissions drawer does it |

Rows unboxed (UI_STYLE "rows are never boxed"):

| Rows | File | Before | After |
|---|---|---|---|
| Shop rows | `ShopDrawer.jsx` (`ShopRow`) | each row a rounded, bordered card; gold border on hover | no box; hover is the kit's 2 px white outline |
| Landmark block in the Token inspect card | `src/ui/components/drawer/LandmarkBlock.jsx` | rounded box with a gold hairline (a frame inside the card's frame) | the card's own plain see-through plate, like its other blocks |
| The Token inspect card's plates | `src/ui/components/board/TokenCard.jsx` (`Box`) | 2 px rounded corners | square |
| Skill requirement, enemy, lifecycle, buff and route rows | `src/ui/components/drawer/TokenInspection.jsx` | rounded bordered boxes | plain rows |
| Work bubbles strip in the full inspection | `src/ui/components/drawer/InspectBubbles.jsx` | rounded bordered box | plain row |

⚠️ `TokenInspection` and `InspectBubbles` are not reachable in the game today: the Guild Hall's
Inspect column only ever shows an upgrade (nothing sets a `token` selection), and the mat's
Token card imports only `LandmarkBlock` and `LeaveMatControl` from them. Their rows were unboxed
because the ticket names them; nobody will see the change until a screen shows them again.

## Already pixel before this batch (batches A to E)

Mat top bar (studs), Upkeep badge popover (chamfer), Token inspect popup (chamfer), Guild Hall
Inspect column and Effects popover, Guild Hall details, Work Permissions button and drawer
(chamfer), Atlas spread, Region list, Cartography table, Arrival card, notification banners
(chamfer, gold and red editions), item stubs (studs with no right side), Bank item tiles.

## Left alone, and why

| What | File | Why left |
|---|---|---|
| Work bubbles on Tokens, the station gear badge and its hover box | `TokenBubbles.jsx`, `TokenBadges.jsx` (`StationGearBadge`) | F2 (who is working what) replaces these; the brief keeps them for that agent |
| Hero speech bubbles on the mat and in the hero bar | `HeroBubbleLayer.jsx`, `DockHeroFigure.jsx` (bar bubbles) | Per-hero bubbles belong to the bubble work after F2; they are in-world speech with a tail, not windows |
| Mat callouts ("Needs Pickaxe", refusals) and the off-mat refusal callout | `CalloutLayer.jsx`, `ScreenCalloutLayer.jsx` | Speech-style popups with a tail that share the speech columns with the hero bubbles; reframe them with the bubble family so the two stay one style. Candidate ticket |
| Inside the modals: Settings' boxed setting rows, the save-slot cards, Typography's sample boxes, the Promotion box, rounded buttons and toggles | `SettingsModal.jsx`, `SlotSelectionModal.jsx`, `TypographyScaleModal.jsx`, `PromotionCeremonyModal.jsx`, `HeroEditModal.jsx`, `JobChangeModal.jsx` | The frame is the shell's and is done; the insides are a content pass (unbox rows, the two-kind button kit) across six windows, a batch of its own. Proposed as the follow-up below |
| Buttons and toggles everywhere (mode buttons in the top bar, Bank filter chips, catch-up buttons, Shop's select box, Token tags) | many | UI_STYLE's button kit (chamfer main action, bare icon button) is a separate pass, not a window frame |
| Kit pieces inside frames: item ribbons (`EntityRibbon`), pills, the quest tooltip's tutorial tag and reward pills | `EntityRibbon.jsx`, `QuestTooltip.jsx` | Approved kit pieces on the style sheet page; they are references, not rows |
| Hero tabs on the hero panel's edge | `HeroDockTab.jsx` | Tabs, not a window; their edge colour carries state (selected gold, item cue green) and a frame edition for each state does not exist yet |
| Nav orbs (Guild Hall, Bank, Shop, Atlas, Settings) | `BubbleMenu.jsx` | Sprite art, not a frame. Their hover glow and scale break UI_STYLE's hover rule: candidate ticket |
| Faint dividers inside panels (`border-t border-white/10`, the drawers' header line, Work Permissions' group lines) | many | UI_STYLE allows "a faint divider line" between sections |
| Crash fallback box | `ErrorBoundary.jsx` | Only shows when a panel crashes; it fills its parent, which would clip a frame's shadow |
| Dev panels: QA dashboard, Mat Tuner, Playmat Tuner, Animation Studio, Dev spawn item, FPS counter, dev sections, the style sheet page's bubble section | `TestDashboard.jsx`, `MatTuner.jsx`, `PlaymatTuner.jsx`, `dev/*` | Dev only; another agent is tidying them (brief). The owner's intake lists the tuners, but they are not player windows |
| The CMS | `cms/` | Not the game |
| Drag ghost's count badge, health and vital bars, the catch-up progress bar | `DragGhost.jsx`, `VitalBar.jsx`, `HealthBar.jsx`, `CatchUpOverlay.jsx` | Bars and badges, not windows |
| The mat itself | `MatBoard.jsx` | Its edge and shadow are drawn in the ground picture (`groundScreen.js`), not CSS |

## Proposed follow-up (one batch)

**F1b, modal insides and the button kit**: unbox Settings' rows and the save-slot cards, square
the remaining rounded buttons and toggles in the six modals and the catch-up, and give the main
actions the kit's chamfer button. Plus two small tickets: the mat callouts with the bubble family
(after F2), and the nav orbs' hover glow.

## Round two: every surface smaller than a window (T-242)

Branch `backlog/pixel-frames-2`, from `main` at 231e1fc8. The owner (2026-10-24): "still using the
soft borders on the items in the bank; do another audit to identify other places we can use our
new styling". Same words as above, plus **pixel line** for the new hard 2 px (1 art pixel) edge
in the frames' own colour (`--color-ui-frame`, #977316, the drawn pixels of `u_frame_chamfer.png`).

Before/after sheets with 2x close-ups: `round2/sheet_1_bank.png` (Bank tiles, hover, Select mode,
loadout), `round2/sheet_2_settings.png` (Settings, Typography), `round2/sheet_3_windows.png` (save
slots, Promotion, Edit hero, Change job), `round2/sheet_4_small.png` (catch-up buttons, the
Priorities switch, the top bar's buttons). Made with `round2/capture_round2.mjs` (every surface
opened by clicking, at 1920 x 1080) and `round2/sheet_round2.mjs`.

### The new kit pieces

| Piece | Where it lives | Look |
|---|---|---|
| Item tile (`ui-item-tile`, reworked) | `src/tailwind.css` | square, pixel line; hover: the tint a little lighter **and** the line white |
| Empty well (`ui-slot-empty`) | `src/tailwind.css` | square, dark well, the pixel line dimmed; hover white |
| Pixel edge (`ui-pixel-edge`) | `src/tailwind.css` (plus an unlayered copy for `<input>` and `<select>`, which the input reset in `styles/main.css` would otherwise round) | square, pixel line; hover or focus white |
| Slider (`ui-range`) | `src/tailwind.css` | a 6 px bar in the frame colour, a square white thumb with a hard black line |
| `KitButton` | `src/ui/components/base/KitButton.jsx` | the chamfer frame with its hard shadow (as the Hall's Upgrade button); gold words and the shine for the main action, muted words for a second choice, red for one that loses something; greys out when disabled |
| `PixelSwitch`, `PixelToggle` | same file | a square track with the pixel line and a square white knob; the fill is the caller's meaning colour (green in Settings, gold for Priorities) |

All of them are on the style sheet page (QA, Style Sheet) under "Buttons, switch, slider, boxes,
slots", marked unapproved. Nothing is drawn per frame: they are borders and static pictures.

### Reframed in round two

| Surface | File | Before | After |
|---|---|---|---|
| **Bank item tiles** | `drawer/BankTab.jsx` (`ItemTileBody`) | rounded 8 px, hairline, grey hover edge; Select mode a translucent ring | item tile: square, pixel line, white on hover; chosen in Select mode: white line |
| Bank tabs (the 16 squares) and the locked ones | `BankTab.jsx` | rounded, hairline; open tab white | wells; open tab a gold line (UI_STYLE: gold is the selected tab) |
| Bank Select button, search box | `BankTab.jsx` | rounded, hairline | pixel edge |
| Bank's slot counter (`18/64`) | `BankTab.jsx` | a rounded pill with a hairline (red-tinted when full) | plain number (red when full) |
| **Loadout slots**, filled | `dock/DockEquipmentGrid.jsx` | rounded, white/50 hairline, red edge on hover | item tile: square, pixel line, white on hover |
| Loadout slots, empty | same | rounded, dashed hairline, gold hover | wells |
| Loadout count badge | same | round pill, soft shadow | square, hard black line |
| Settings: the setting rows (switches, selects, sliders, the Typography row) | `modals/SettingsModal.jsx` | each a rounded box with a hairline (a soft shadow on Typography's) | unboxed rows |
| Settings: switches | same | round pill switch | `PixelToggle` (green) |
| Settings: selects, sliders | same | rounded, hairline | pixel edge; `ui-range` |
| Settings: tabs on the left | same | rounded, filled, 4 px white bar | no fill; a 1-art-pixel gold line beside the open tab |
| Settings: Adjust Scale, Save Game Now, Done | same | rounded, filled, soft shadow | `KitButton` (Adjust Scale plain, the other two main) |
| Save-slot cards | `modals/SlotSelectionModal.jsx` | rounded boxes, dashed when empty, a soft glow on Last Played, a red glow while asking to delete | unboxed rows with faint lines between; white outline on hover; a red outline while asking to delete |
| Save slots: New Game, Load, Confirm, Cancel, the bin | same | rounded, filled | `KitButton` (main, main, red, plain); the bin a bare icon button |
| Typography scale: the seven size boxes, their sample boxes, sliders | `modals/TypographyScaleModal.jsx` | rounded boxes inside rounded boxes, soft shadow, dashed sample frame | unboxed rows; `ui-range` |
| Typography scale: Reset Defaults, Save & Close | same | rounded, filled, soft shadow, shrinks when pressed | `KitButton` (plain, main) |
| Promotion: the trade box | `modals/PromotionCeremonyModal.jsx` | a rounded box with a hairline | faint dividers above and below |
| Promotion: Not yet, Become, Done | same | rounded, filled | `KitButton` (plain, main, main) |
| Edit hero: Change job, Cancel, Save | `modals/HeroEditModal.jsx` | rounded, filled | `KitButton` (plain, plain, main) |
| Edit hero: name box | same | rounded, hairline | pixel edge |
| Edit hero: portrait and flag swatches | same | rounded, hairline | wells; the chosen one a white line |
| Change job: the job cards, the hint box | `modals/JobChangeModal.jsx` | rounded, hairline; current job a gold hairline | wells (current a gold line, chosen white); the hint a plain line under a divider |
| While you were away: its buttons; the loading bar | `hud/CatchUpOverlay.jsx` | rounded, filled; a round-ended bar | `KitButton` (Return main, Load as I left it plain, Confirm red, Cancel plain); square bar |
| Work Permissions: the Priorities switch | `dock/WorkRulesDrawer.jsx` | round pill switch | `PixelSwitch`, small, gold |
| The playmat top bar's Disallow, Demolish, Allow all, Cancel all marks | `board/MatModeControls.jsx` | rounded, 1 px edge, gold hover | square, 2 px edge, white hover |
| Token Summary rows | `board/MatCapBadge.jsx` | rounded hover fill | the kit's white hover outline |
| Hero panel: the edit (quill) button, skill rows, XP bars, HP bar | `drawer/HeroInspectionSheet.jsx`, `base/VitalBar.jsx` | rounded hover fill; round-ended bars | bare icon button (white on hover); square rows and bars |
| Hero bar: the level-up page arrows, the XP bars, the drop highlight, the drop line's glow | `dock/DockHeroFigure.jsx` | rounded; a soft gold glow on the drop line; a translucent ring | square; no glow; a white outline |
| Hero tabs beside the Bank, their drop line's glow | `dock/HeroDockTab.jsx` | rounded on the open side; soft gold glow | square; no glow |
| Shop's variant select | `drawer/ShopDrawer.jsx` | rounded, hairline | pixel edge |
| The Token card's recipe list plate | `board/RecipeList.jsx` | 2 px rounded | square |
| Drag ghost's count badge | `dnd/DragGhost.jsx` | round pill | square, hard black line |
| A missing sprite's placeholder box | `base/ItemIcon.jsx` | rounded, hairline | plain dark square |
| Full Token inspection (not reachable today, see above) | `drawer/TokenInspection.jsx` | rounded portrait, tags, action buttons | square |

The guard is `src/tests/PixelFrameSmallPieces.test.js` (no rounded corners, soft shadows or
translucent rings in the reframed files; the tile and well rules in the CSS; the kit button and
switch; Settings rendered tab by tab).

### Left alone in round two, and why

| What | File | Why left |
|---|---|---|
| The work plate | `WorkPlateLayer.jsx` | Just built in the kit (T-239) |
| Hero speech bubbles, mat callouts, the off-mat refusal callout | `HeroBubbleLayer.jsx`, `DockHeroFigure.jsx` (bar bubbles), `CalloutLayer.jsx`, `ScreenCalloutLayer.jsx` | T-243 |
| Nav orbs (hover glow and scale, the round drop ring and its glow, the red dot) | `BubbleMenu.jsx` | T-244 |
| The station gear badge and its hover box | `TokenBadges.jsx` | T-247 moves it; it is in-mat markup |
| Health bars over heroes and enemies on the mat; the loot count badge on the mat | `HealthBar.jsx`, `SpriteLayerView.jsx` | The mat itself, and combat (the Systems director's agents are building it) |
| The drag ghost's red "can't" icon (soft red glow, bouncing) | `DragGhost.jsx` | A glow and a bob break UI_STYLE's hover rule, but it is a drag cue, not a surface; candidate ticket beside the orbs (T-244) |
| Item ribbons (`EntityRibbon`): rounded, hairline, a soft inner shadow, the sprite scaling 2x on hover | `EntityRibbon.jsx` | An approved kit piece used everywhere (recipes, drops, the Shop, the catch-up, Token cards); squaring it changes every list at once and its 2x hover zoom is a behaviour. Proposed as its own ticket |
| Quest tooltip's tutorial tag and reward pills | `QuestTooltip.jsx` | Approved kit pieces (round one) |
| Hero faces in the recipe list (round) | `RecipeList.jsx` | A portrait crop, not a box |
| Dev panels (QA dashboard, FPS counter, dev sections), the crash fallback box, the CMS | `TestDashboard.jsx`, `FPSCounter.jsx`, `dev/*`, `ErrorBoundary.jsx`, `cms/` | Not player surfaces (the style sheet page's item tile demo and its new kit section were updated: it is the kit's reference) |
| The mat, its terrain grid's rounded clip, the Atlas sprite hover | `MatBoard.jsx`, `TerrainGridOverlay.jsx`, `AtlasScreen.jsx` | The mat itself; the Atlas hover is already a hard white outline |
| Faint dividers (`border-t border-white/10` and the like) | many | UI_STYLE allows a faint divider |
| The Settings sidebar's vector icons, the save slots' emoji | `SettingsModal.jsx`, `SlotSelectionModal.jsx` | Content, not frames: vector icons go with T-162 |
| Settings tabs as the full tab kit (a row, sprite and word, the line under) | `SettingsModal.jsx` | The vertical tabs keep their layout, with a gold line beside the open one; a tab row is a layout change |
| The Shop's variant select in the captures | `ShopDrawer.jsx` | Reframed, but it shows only for a Token with variants, which a new game's Shop does not have, so it is not on the sheets |
