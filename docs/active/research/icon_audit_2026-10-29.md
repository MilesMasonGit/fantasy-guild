# Icon audit: every icon the player can see (2026-10-29, read-only, branch feat/hero-orders-o2)

Families: **(1)** pixel sprite PNG · **(2)** pixel glyph drawn in code · **(3)** `lucide-react` · **(4)** emoji / text symbol · **(5)** other inline SVG drawn in code.

## The analysis (for the owner)

**First, the rule on paper.** `docs/reference/UI_STYLE.md` says, under "Sprites and icons" (line 149):
"**Pixel sprites only.** No vector icon sets. ... Vector icons go as each screen is touched."
So using Lucide icons again means **changing that rule**, not just adding icons. Its other icon rules: icons drawn "crisp at whole-pixel scales" (line 56); "Icon button: the bare sprite, white outline on hover" (line 183); panel headers have "the red pixel close X" (line 173).

**What's on screen today.** About 40 Lucide icons are still there, mostly away from the mat: the five navigation bubbles, the Settings tabs, the save-slot screen, the job and promotion windows, a few small controls in the Bank and hero sheet, and the dev tools. The mat itself is nearly all pixel art. Emoji are the real stragglers. They show up wherever a sprite is missing, and some of that is on the mat.

**Places where the families clash in one spot:**
1. **Save-slot screen** (the first screen a player sees): Lucide Play/Plus/Trash/Warning buttons sit beside emoji stats 🦸 ⏱️ 💾 on the same card.
2. **"Unknown item" has three looks**: a ❓ emoji (`ItemIcon`), a Lucide HelpCircle (`EntityRibbon`), and a pixel "?" glyph (`slot_unknown`, loadout slots).
3. **Locks**: the Bank's locked tabs use a Lucide Lock, but a locked Guild Hall upgrade uses the pixel `u_lock.png`.
4. **Top-bar Disallow/Demolish buttons** show text symbols ⊘ and ✕. When you switch the mode on, the mouse cursor turns into a **pixel** crossed circle or X drawn in code (`mapModeCursor.js`). Same meaning, two different looks.
5. **Skill icons fall back to emoji, on the mat as well.** Farming 🌾, Alchemy 🧪 and Construction 🧱 have no sprite mapped, so you get the emoji. That covers the work plate, level-up floats, Token cards, the hero sheet, and the **Demolish badge on a marked Token** (Construction). `s_farming.png` is already in `public/assets/skills/`, it just isn't wired up. This is a ticket, not an icon-family question.
6. **Hero sheet**: pixel skill icons and the pixel close X, next to a Lucide Feather (edit; the code calls it a placeholder) and a Lucide chevron.
7. **Job icons are emoji** (⚔️ 🏹 🔮 …) in the Job Change and Promotion windows, next to Lucide arrows and checks.
8. **Hearts**: a wounded hero shows a text ✚ in the dock, healing on the mat floats "+N ♥" as text, and combat has its own **pixel** heart glyph.
9. **Panel headers**: the Bank's title icon is a Lucide Landmark, the fight panel's is a pixel glyph, and the Shop has none.

**Rule of thumb I'd recommend:**
> **Pixel art for anything that is part of the game. Lucide only for the app's own controls. No emoji anywhere a player can see.**
> "Part of the game" means anything on the mat or in the world, and any icon that stands for a game thing: an item, skill, job, hero, enemy, Token, coin, status or lock. These are always pixel (a sprite or a code-drawn glyph) and stay on the mat.
> "The app's own controls" means the menus and buttons around the game: navigation bubbles, Settings, the save-slot screen, dev/QA tools, and small utility buttons inside panels (clear search, select mode, expand/collapse, edit). These may use Lucide, if it's one colour, a single stroke weight, and 16 or 24 px so it stays crisp.
> Where a panel already shows pixel art for the same idea (a lock, the close X, an unknown "?"), the pixel version wins.

**Candidate swaps (my recommended order):**
1. **Save-slot emoji to Lucide** (🦸 ⏱️ 💾 → `Users`, `Clock`, `Save`). The screen becomes one family and it's a tiny change. Trade-off: this is the first impression, so a pixel set later would look nicer. Lucide is the cheap step until then.
2. **Bank locked tab: Lucide Lock to the pixel `u_lock.png`.** It matches the Guild Hall and the art already exists. Trade-off: the pixel lock is 16 art px, so at 2× (32 px) it needs a slightly larger tab, or 1× (16 px), which reads small.
3. **Top-bar ⊘ / ✕ to the pixel glyphs already drawn for the cursor** (or Lucide `Ban` / `X` if you treat the top bar as chrome). I recommend pixel: the top bar sits on the mat, and the button would then match the cursor exactly. Trade-off: Lucide would be quicker but would break the "on the mat stays pixel" rule.
4. **One "unknown item" look**: use the pixel `slot_unknown` "?" glyph in both `ItemIcon` and `EntityRibbon`. Trade-off: it's a code placeholder, so you'd want to draw it eventually (add to `owner_art_list.md`). The other option, Lucide HelpCircle everywhere, is quicker but puts a vector icon on item tiles.
5. **Dev/QA menu emoji to Lucide** (🔤 🎨 🧰 🎉 ⬆️ ⚔️ 🏹 🎞️ ✨ 🧹 🩸 in the QA panel). Players never see these (dev builds only), the panel already uses Lucide Bug and Plus, and it's zero risk. Trade-off: purely tidiness. Skip it if time is short.

Not recommended for Lucide: job icons, skill fallbacks, hearts and statuses. These are game things, so they want sprites (art-list items), not vectors. And I'd keep the nav bubbles on Lucide only if the new rule names them as chrome. If it does, note that the **Shop bubble uses Lucide's "Map" icon** while the Atlas uses "Compass". A `Store` or `ShoppingBag` icon would read as Shop at a glance.

---

## Inventory

Sizes are on-screen CSS pixels at 1:1 mat fit (mat items scale with the mat fit `u`). All paths are relative to `src/`.

### Top bar (over the mat)

| What it shows | Family | Size | Where drawn |
|---|---|---|---|
| Token count (tree) | 1 `/assets/ui/u_tree.png` | 32 | `ui/components/board/MatTopBar.jsx:19,24-25`; used `MatCapBadge.jsx:261` |
| Upkeep (coin) | 1 `/assets/ui/u_coin_small.png` | 32 | `MatTopBar.jsx:20`; used `MatUpkeepBadge.jsx:113` |
| Disallow mode toggle | 4 text `⊘` | text size | `ui/components/board/MatModeControls.jsx:34,53` |
| Demolish mode toggle | 4 text `✕` | text size | `MatModeControls.jsx:35,53` |
| Disallow / Demolish **cursor** over Tokens | 2 code pixel (own GLYPHS) → SVG cursor | 9 art px × 2 | `ui/components/board/mapModeCursor.js:11-30,63` |

### Navigation bubbles (left/right column)

| What it shows | Family | Size | Where drawn |
|---|---|---|---|
| Orb backgrounds (purple, yellow, green, blue, red) | 1 `/assets/ui/u_orb_<colour>.png` | 64 (128 on md) | `ui/components/nav/BubbleMenu.jsx:41,58` |
| Bar behind the bubbles | 1 `/assets/ui/u_bar.png` | tiled | `BubbleMenu.jsx:109` |
| Guild Hall | 3 `Castle` | 24 (48 md) | `BubbleMenu.jsx:63,115` |
| Item Bank | 3 `Landmark` | 24 (48 md) | `BubbleMenu.jsx:120` |
| Shop | 3 `Map` (as MapIcon) | 24 (48 md) | `BubbleMenu.jsx:126` |
| Atlas | 3 `Compass` | 24 (48 md) | `BubbleMenu.jsx:127` |
| Settings | 3 `Settings` (cog) | 24 (48 md) | `BubbleMenu.jsx:130` |

### Mat: Tokens, plates, badges, floats

| What it shows | Family | Size | Where drawn |
|---|---|---|---|
| Token art itself | 1 `assets/tokens/**` (sprite-manifest) | Token size | `ui/components/base/TokenSprite.jsx`, `MatToken.jsx` |
| Problem mark "!" (waiting / can't) | 1 `/assets/ui/u_alert_yellow.png`, `u_alert_red.png` | 16 art × 2 = 32 | `ui/components/board/problemMark.js:45-46`; `ProblemMark.jsx:20` |
| Station recipe gear | 1 `/assets/ui/u_gear.png` | 24 (2× when big) | `ui/components/board/TokenBadges.jsx:162,238` |
| Disallowed Token | 1 `/assets/ui/u_disallow_red.png` | 24 | `TokenBadges.jsx:263-264` |
| Marked for demolition | skill icon (Construction): **4 emoji 🧱 fallback** (no sprite mapped) in a dark disc | 16 | `TokenBadges.jsx:283` → `base/SkillIcon.jsx:76,97` |
| Flag pennant | 1 `/assets/ui/u_flag_pennant.png` (+ `u_flag_<colour>.png`) | sprite size | `ui/components/board/FlagMark.jsx:5,15` |
| Work plate: skill | 1 `assets/skills/s_*.png` (emoji gap: farming/alchemy/construction get no image) | 16 × u | `ui/components/board/WorkPlateLayer.jsx:70` |
| Work plate: item made / input | 1 item sprite | 16 × u | `WorkPlateLayer.jsx:75,99,116` |
| Work plate: problem | 1 `u_alert_*.png` | 16 × u | `WorkPlateLayer.jsx:83` |
| Work plate: charges bolt | 2 `GLYPHS.charges` via `glyphUri` | 8 art → 16 × u | `WorkPlateLayer.jsx:88`; `workPlate.js:239-247` |
| Work plate / idle plate: clock, spawn, regrow, grow, turn | 2 `GLYPHS.*` via `glyphUri` | 16 × u | `WorkPlateLayer.jsx:108`; `idlePlate.js:23,50` |
| Level-up float (skill icon + level) | 1 skill sprite, **4 emoji fallback** (`def.icon` or ✨) | 16 art × unit | `ui/components/board/LevelUpFloat.jsx:49,57` |
| Fight marker over a fighting pair | 2 `COMBAT_GLYPHS.fight` (gold) | 16 | `ui/components/board/FightLayer.jsx:115` |
| Hit / crit / status floats | 2 combat glyphs, outlined red | 10 art × scale | `ui/components/board/fx/fightFloats.js:70` |
| Heal speech text "+N ♥" | 4 text `♥` | text | `ui/components/board/fx/matFx.js:282` |
| Camp reach ring, near rings | 5 SVG pixel ring | ring | `CampReachRing.jsx:28`, `MatRings.jsx:104` |
| Speech-bubble tail / bubble corner | 5 SVG (frame, not an icon) | 7 px art | `SpeechFrame.jsx:32`, `fx/matFx.js:258` |
| Drag: "can't drop here" | 1 `/assets/ui/u_disallow_red.png` | 32 | `ui/dnd/DragGhost.jsx:66` |
| Drag: multi-item count | 4 text `×N` | text | `DragGhost.jsx:145` |

### Token card / inspection (hover card and side panel)

| What it shows | Family | Size | Where drawn |
|---|---|---|---|
| Work skill | 1 skill sprite / 4 emoji fallback | 16 | `ui/components/board/TokenCard.jsx:76,259` |
| Cycle clock | 2 `GLYPHS.clock` | 16 | `TokenCard.jsx:101` |
| Charges bolt (+ `∞` text when unlimited) | 2 `GLYPHS.charges` + 4 `∞` | 16 | `TokenCard.jsx:105-106` |
| Lifecycle lines (regrow, spawn, grow, turn, reach) | 2 `GLYPHS[line.icon]` | 16 | `TokenCard.jsx:183` |
| Recipe rows: grow, clock, arrow | 2 glyphs + 4 text `→` | 16 / text | `ui/components/board/RecipeList.jsx:98,124,132` |
| Inspection rings (charges, time, XP) with `∞` | 5 SVG ring (`RingBadge`) + 4 `∞` | 28 vb | `ui/components/drawer/InspectBubbles.jsx:27,73-74`; `board/RingBadge.jsx:91` |
| Inspection: Token art | 1 Token sprite | 128 | `ui/components/drawer/TokenInspection.jsx:109` |
| Inspection: skill | 1 skill sprite / 4 emoji fallback | 32 | `TokenInspection.jsx:156` |

### Hero dock (bottom roster) and hero sheet

| What it shows | Family | Size | Where drawn |
|---|---|---|---|
| Hero portrait / animated sprite | 1 `assets/heroes/*.png` | dock size | `ui/components/dock/DockHeroFigure.jsx:273`; `HeroDockTab.jsx:258` |
| Wounded mark | 4 text `✚` (red) | text | `DockHeroFigure.jsx:297` |
| Needs a job | 1 `u_alert_yellow.png` | 16 | `DockHeroFigure.jsx:303-309` |
| Level-up pager up/down | 5 SVG `PixelTriangle` (pixel-drawn) | small | `DockHeroFigure.jsx:438,449`; `base/ArrowScrollList.jsx:31` |
| Equipped item | 1 item sprite (`ItemIcon`) | 64 | `ui/components/dock/DockEquipmentGrid.jsx:166` |
| Empty slot | 4 text `+` | text-sm | `DockEquipmentGrid.jsx:169` |
| Slot kind mark (hand, hat, chest, trinket, food, drink, consumable, ?) | 2 `SLOT_GLYPHS` | 16 | `DockEquipmentGrid.jsx:174`; `base/PixelGlyph.jsx:83-160` |
| Hero sheet: edit hero | 3 `Feather` (code: "placeholder quill") | 16 | `ui/components/drawer/HeroInspectionSheet.jsx:86` |
| Hero sheet: close | 1 `/assets/ui/u_cancel_red.png` (`CloseX`) | 32 | `HeroInspectionSheet.jsx:88`; `base/CloseX.jsx:22` |
| Hero sheet: "Locked" expand | 3 `ChevronRight` | 12 | `HeroInspectionSheet.jsx:139` |
| Hero sheet: portrait | 1 hero sprite | sheet size | `HeroInspectionSheet.jsx:208` |
| Hero sheet: skill rows | 1 skill sprite / 4 emoji fallback | 32 | `HeroInspectionSheet.jsx:256` |

### Bank and item tiles

| What it shows | Family | Size | Where drawn |
|---|---|---|---|
| Panel header icon | 3 `Landmark` | 18 | `ui/components/drawer/BankDrawer.jsx:20,61` |
| Panel close | 1 `u_cancel_red.png` | 32 | `base/CloseX.jsx:22` (via `PanelHeader`) |
| Item tile art | 1 item sprite (`ItemIcon`) | 64 | `ui/components/drawer/BankTab.jsx:342` |
| Item has no sprite | 5 inline SVG (hand copy of Lucide "image") | 50 % of tile | `ui/components/base/ItemIcon.jsx:75-79` |
| Undiscovered item | 4 emoji `❓` | 60 % of tile | `ItemIcon.jsx:31` |
| Select-mode button | 3 `BoxSelect` | 11 | `BankTab.jsx:198` |
| Selected tick | 3 `Check` | 11 | `BankTab.jsx:339` |
| Empty bank | 3 `Landmark` | 32 | `BankTab.jsx:261` |
| Locked bank tab | 3 `Lock` | 12 | `BankTab.jsx:374` |
| Bank tab icon | 1 first item's sprite | 32 | `BankTab.jsx:420` |
| Clear search | 3 `X` | 12 | `BankTab.jsx:447` |
| Item ribbons (recipes, drops): unknown / XP | 3 `HelpCircle` / 3 `Sparkles` | 18 / 20 | `ui/components/base/EntityRibbon.jsx:193,195` |
| Ribbon counts | 4 text `×N` | text | `EntityRibbon.jsx:46,90-97` |
| Item tooltip lines | 1 item / Token sprite | 16 | `ui/components/drawer/ItemTip.jsx:76` |

### Shop

| What it shows | Family | Size | Where drawn |
|---|---|---|---|
| Header | none (title only) + pixel close X | 32 | `ui/components/drawer/ShopDrawer.jsx:168` |
| Token for sale | 1 Token sprite | `SHOP_ART_PX` | `ShopDrawer.jsx:300` |
| Prices | 1 item sprites (pills/ribbons) | 16-32 | via `EntityRibbon` / `ItemIcon` |

### Guild Hall

| What it shows | Family | Size | Where drawn |
|---|---|---|---|
| Hall and upgrade stars | 1 `/assets/playmat/screens/ui_star_{grey,blue,gold}.png` | scaled whole | `ui/components/board/GuildHallBoard.jsx:26-29,282,335` |
| Link lines between stars | 5 SVG lines | - | `GuildHallBoard.jsx:204` |
| Upgrade art | 1 `assets/tokens/...` / `u_quest_board.png` | 128 | `ui/components/drawer/GuildUpgradeInspection.jsx:103`; `config/guildUpgrades.js:35` |
| Locked upgrade | 1 `/assets/ui/u_lock.png` | 64 | `GuildUpgradeInspection.jsx:110-111` |
| Upgrade button arrow | 1 `/assets/ui/u_upgrade.png` | 32 | `GuildUpgradeInspection.jsx:165-166` |
| Costs / requirements | 1 item sprite | 16 | `GuildUpgradeInspection.jsx:184,208` |

### Atlas

| What it shows | Family | Size | Where drawn |
|---|---|---|---|
| Close | 1 `u_cancel_red.png` | 32 | `ui/components/atlas/AtlasScreen.jsx:19,68` |
| Tome page art | 1 `assets/playmat/...` | page | `AtlasTome.jsx:29`; `tomeArt.js` |
| Map slot outline | 5 SVG pixel outline | 64 | `MapPieces.jsx:20` |
| Region contents (Tokens, camps) | 1 Token sprites + 4 `×N` | catalogue | `RegionList.jsx:224-225,238-239` |
| Map counts | 4 `×N` | text | `CartographyTable.jsx:128`; `PlanContents.jsx:45` |

### Tooltips, cards, notifications, catch-up

| What it shows | Family | Size | Where drawn |
|---|---|---|---|
| Quest reward items | 1 item sprite | 16 | `ui/components/board/QuestTooltip.jsx:89`; poster `QuestPoster.jsx:42` |
| Banner sprite (item or other) | 1 item sprite / sprite `src` | `SPRITE_PX` | `ui/components/notifications/BannerStack.jsx:30,33` |
| Loot stubs | 1 item sprite | `SPRITE_PX` | `ItemStubColumn.jsx:81` |
| Loot fly-to-bank particles | 1 sprite; **4 emoji fallback** (`🧙` for heroes, item `icon`) if image not loaded | 32 | `base/ParticleOverlay.jsx:333,676` |
| Catch-up: enemies beaten / items used / drops | 1 Token & item sprites | 32 | `ui/components/hud/CatchUpOverlay.jsx:222,244,253` |
| Catch-up: knocked-out hero | 2 `COMBAT_GLYPHS.down` | 16 | `CatchUpOverlay.jsx:232` |
| Catch-up: skill gains | 1 skill sprite / 4 emoji fallback | 32 | `CatchUpOverlay.jsx:312` |
| Catch-up counts / spent / arrows | 4 `×`, `−`, `→` | text | `CatchUpOverlay.jsx:184,234,300,314,325` |

### Combat (fight panel)

| What it shows | Family | Size | Where drawn |
|---|---|---|---|
| Panel header | 2 `COMBAT_GLYPHS.fight` (gold) | 16 | `ui/components/combat/FightPanel.jsx:336` |
| Battlefield, fighters | 1 `assets/backgrounds/...`, hero/enemy sprites | strip | `FightPanel.jsx:81,92,99` |
| Fighting style | 1 skill sprite (melee/ranged/magic) | 16 | `FightPanel.jsx:126`; `EnemyCard.jsx:18` |
| VS / HP glyphs (heart, shield, hit …) | 2 `COMBAT_GLYPHS` | 16 | `FightPanel.jsx:139` |
| Elixirs | 1 item sprite | 32 | `FightPanel.jsx:150` |
| Status stacks | 2 combat glyph (red) + `×N` | 16 | `FightPanel.jsx:166,168` |
| Enemy buffs | 2 `star` (gold) | 16 | `FightPanel.jsx:233` |
| Fight log lines | 2 glyph per line | 16 | `FightPanel.jsx:257` |
| Show/hide log | 5 `PixelTriangle` | small | `FightPanel.jsx:320` |

### Modals (player-facing)

| What it shows | Family | Size | Where drawn |
|---|---|---|---|
| Modal close | 1 `u_cancel_red.png` | 32 | `ui/components/base/GIModal.jsx:75` |
| Save slots: New / Load / Delete / warning | 3 `Plus`, `Play`, `Trash2`, `AlertTriangle` | 14-16 | `ui/modals/SlotSelectionModal.jsx:88,160,167,136` |
| Save slots: heroes / playtime / last saved | 4 emoji `🦸` `⏱️` `💾` | text | `SlotSelectionModal.jsx:121,124,127` |
| Settings tabs | 3 `Eye`, `Bell`, `MonitorPlay`, `Volume2`, `Wrench` (dev only) | 16 | `ui/modals/SettingsModal.jsx:33-37,56` |
| Settings: typography / save buttons | 3 `Type`, `Sliders`, `Save` | 14-16 | `SettingsModal.jsx:72,84,162` |
| Hero edit: change job / save | 3 `Repeat`, `Check` | 11 | `ui/modals/HeroEditModal.jsx:82,156` |
| Job change: job icons | 4 emoji (`jobRegistry.js` `icon`: 🧑 ⚔️ 🏹 🔮 🗝️ ✝️ 🛡️ 🐺 🪤 💀 ⚗️ 💰 ☠️) | text | `ui/modals/JobChangeModal.jsx:162`; `config/registries/jobRegistry.js:81-167` |
| Job change: lock / arrow / requirement | 3 `Lock`, `ArrowRight`, `GraduationCap` | 7-11 | `JobChangeModal.jsx:127,164,168` |
| Promotion: from-job → to-job | 4 emoji job icons + 3 `ArrowRight` | 24-36 / 16 | `ui/modals/PromotionCeremonyModal.jsx:94,99,101` |
| Promotion: Not yet / Promote | 3 `X`, `Sparkles` / `Check` | 12 | `PromotionCeremonyModal.jsx:158,167` |
| Promotion trade +/− | 4 text `+` `−` | text | `ui/components/hero/PromotionTrade.jsx:85` |

### Skill icons: which are sprites, which fall back to emoji

`SkillIcon` and `skillArt` (`base/SkillIcon.jsx:33-48,76`) use `AssetManager.SKILL_MAP` (`utils/AssetManager.js:43-54`). **Sprite:** mining, forestry, fishing, smithing, crafting, cooking, melee, ranged, magic, crime. **Emoji fallback** (`config/registries/skillRegistry.js:93-197`): farming 🌾, alchemy 🧪, construction 🧱, stealth, leadership, fletching, enchanting, faith, trapping, summoning, taming, commerce, science, armory, shadowcraft. Only the first three are live today. Unmapped art already in `public/assets/skills/`: `s_farming`, `s_flask`, `s_industry`, `s_nature`, `s_culinary`, `s_nautical`, `s_occult`, `s_social`.

Not drawn (data only, found during the search): `equipmentCategories.js` emoji (the dock uses `SLOT_GLYPHS` instead) and `HeroGenerator.js` `HERO_ICONS` emoji (heroes draw portrait sprites).

### Dev / QA only (not in a shipped build)

- QA panel button and title: 3 `Bug`; add rows 3 `Plus` (`ui/components/TestDashboard.jsx:310,319,428`). Menu labels are emoji 🔤 🎨 🧰 🎉 ⬆️ ⚔️ 🏹 🎞️ ✨ 🧹 🩸 (`TestDashboard.jsx:205-288`).
- Mat tuner: 3 `RotateCcw` (`ui/dev/MatTunerDevSection.jsx:33`). Typography modal: 3 `RotateCcw`, `Check` (`ui/modals/TypographyScaleModal.jsx:123,130`).
- Spawn items: 3 `Search` (`ui/components/dev/DevSpawnItemModal.jsx:61`).
- Animation studio: 3 `ChevronLeft/Right`, `Play`, `Pause`, `Grid`, `Move`, `Sparkles`, `RotateCcw`, plus emoji 🎞️ (`ui/components/dev/AnimationStudioModal.jsx:195,395-536`).
- Style sheet page: shows every `PixelGlyph`, `UiSprite` and the `u_*` UI sprites (`ui/dev/StyleSheetPage.jsx:142-149,426,439,506`).
- Perf HUD: text ⚠ and ✓ (`ui/dev/perf/perfHud.js:99`, `perfHarness.js:492`).
