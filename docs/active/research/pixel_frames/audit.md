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
