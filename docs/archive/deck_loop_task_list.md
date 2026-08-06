# Deck Loop — Task List

Working list for bringing the deck-loop build (flag `USE_DECK_LOOP` on) in line with the
end-state described in [`playmat_rework_concept_v1.md`](playmat_rework_concept_v1.md).
This is the backlog for the bugfix / UI-rework phase. Detailed sweep findings live in
[`ui_bugfix_tracker.md`](ui_bugfix_tracker.md).

## How to use this list
- Each task has an **ID** (e.g. `A3`) so we can reference it. Add your own items anywhere — new IDs can just be `NEW-1`, etc.
- Tags:
  - **[P1]** critical path / blocks other work · **[P2]** important · **[P3]** polish
  - **[decide]** = needs a design call from you before I build it (I'll ask, or you can note the answer inline)
  - **[auto]** = safe for me to do autonomously without checking first
  - **[bug]** = defect, not a design change
- I check items off (`- [x]`) as they land, with a one-line note.
- **Deferred systems** (status buffs, skill trees, chaos/invasion, etc.) are listed in §J so we don't accidentally scope them in — per the roadmap they wait for a later pass.

---

## A. Row layout & card display (concept §11.A/B/C) — *current focus*

> **Decisions locked 2026-07-09:** (1) Row = **anchored + horizontal scroll strip** for the upcoming cards. (2) **Three standard card size tiers** keyed to bg resolution — **128 / 256 / 512** (all integer scales of the 256 native sprite, so all stay crisp): 256 = default banner card; banner **auto-drops to 128 when the window is too small**; 128 = Card Drawer tiles; 512 = Pack reveal. (3) A **card-width slider in the QA panel** (default **200px**) to tune the banner card window live. (4) Activity log wanted but in a **roomier spot**, not the thin Info pillar. (5) Adventure mode first; stationed-view card styling comes later.

- [x] **A0** Active card renders at full fidelity; all row cells (Hero, Upcoming, Deck, Station) render as cards. *(done 2026-07-09)*
- [x] **A13** **Area Banner "mat" architecture** *(done 2026-07-09)* — row is now `[full-width mat layer (80/20 Wilds|Outpost art, sliding split)] + [floating z-10 UI layer]`. Control/Info are semi-transparent panels; cards float on the mat. Rows are **full-width** (removed `max-w-6xl` cap in `AreaBannerContainer`) so the mat stretches across the screen and the upcoming strip gets room. *Remaining:* Hero & Deck cards still use area art as their card bg — should switch to their **own** art (hero portrait treatment / deck-back) now that the mat provides the scene *(follow-up)*. Outpost-slice art falls back to a styled panel — **no per-area outpost/camp art is authored yet** (see new task NEW-ART).
- [x] **A11** **Three-tier card size system** — `GICard` now takes `size` (`sm`=128 / `md`=256 / `lg`=512) setting frame + bg resolution (integer scales → crisp). Threaded through `ActiveCardFace`; banner=`md`, pack reveal=`lg`. *(done 2026-07-09; drawer=`sm` lands with the drawer task E.)*
- [ ] **A12** [P1][auto] **Responsive banner card** — banner card drops from `md`(256) to `sm`(128) when the row/window is too narrow to fit the anchored cards.
- [x] **A7** **Card-width slider in the QA panel** — live width control (`src/ui/dev/cardSizeStore.js` + slider in `TestDashboard`), default **200px**, persisted. Verified resizing all banner cards live. *(done 2026-07-09)*
- [x] **A1** ~~Upcoming scroll strip~~ **Superseded → upcoming previews disabled** *(2026-07-09, owner feedback F2b)* — the scroll strip was built then removed; previews are off for now (no side-scroll), may return as a responsive extra-wide-only bonus.
- [x] **A2** **80/20 split-banner center reworked** *(done 2026-07-09)* — split is now flex `8/2`; with full-width rows the Wilds slice fits Active + scrolling Upcoming + Deck. Mode toggle verified wired (rejects correctly when no station slotted). *Outpost-side art polish pending (NEW-ART).*
- [ ] **NEW-ART** [P2] **No per-area Outpost/camp art** exists in the area registry — the stationed mat slice falls back to a styled panel. Author outpost art per area (or pick a shared one) so the "splits into Outpost art" reads properly.
- [x] **A14** **Hero & Deck cards use their own treatment** *(done 2026-07-09)* — dropped the duplicate area-art bg; both now use a dark semi-transparent frame (portrait-forward hero, deck-icon deck) so the mat shows through behind them. Dedicated hero-card / deck-back *art* can replace the dark frame later.
- [x] **A15** **Flag-off safety** *(done 2026-07-09)* — `GICard` keeps its original 280×440/512 sizing when no `size`/`width` is passed, so legacy (flag-off) callers are untouched; tiers are opt-in. *(Not re-verified flag-off in browser this session — worth a quick boot check.)*
- [ ] **A4** [P2][auto] **Control pillar** (§11.A.1, 0.5 card space) — restyle to the taller row; Start/Stop + Hide/Show buttons.
- [ ] **A5** [P2][auto] **Activity log** (§11.A.2) — build a per-area live text feed (e.g. "Chopped 3 Oak Wood", "Took 8 poison damage") in a **roomier location than the Info pillar** (expandable panel / not the thin bar). Also the intended home for events currently spammed as toasts (see G1). Info pillar keeps just name + status + HP/EN.
- [x] **A6** **Active card task progress bar → moved to the header** *(done 2026-07-09, owner feedback)* — the task-cycle bar was pulled off the card and now lives in the new banner header, aligned above the active card. Uses the old build's `ProgressBar` styling (`progress-track`/`progress-fill--glossy`+bloom) via an upgraded `RefProgressBar` (still ref-driven).

### Feedback round 2 (2026-07-09) — done
- [x] **F2a Drawing/shuffling stays a card space** — active-card slot is always a full card frame; drawing/shuffling/paused now render in the blank-deck-slot styling (icon + status) instead of a small badge, so nothing reflows.
- [x] **F2b Upcoming previews disabled** — removed entirely for now (no side-scroll). Center is just Active card + Deck card, all uniform size. May return as a responsive, no-scroll bonus for extra-wide views (owner may drop the feature).
- [x] **F2c Area Banner header** — full-width band on the mat: area name (left, `gi-card-title`) + the active-card progress bar aligned above the active card. Area name removed from the Info panel (kept status + HP/EN).
- [x] **F2d Card title styling** — new cards/slots use the existing `gi-card-title` header treatment (matches the real cards).
- [x] **F2e Deck Focus = regular-mode look** — clicking the deck opens `DeckFocusRow`: same mat + header, every deck slot shown as a full-size card (filled = card + remove button, empty = blank slot / drop target, hazard = hazard card). Replaces the old small-tile `DeckFocusView` for deck mode.

### Feedback round 3 (2026-07-09)
- [x] **F3a Info panel → card** — the Info panel is now a full card-sized element in the empty-slot styling, showing the area's live status (Working/Paused/Exhausted/In Combat…). **Vitals (HP/EN) removed from it — they live on the Hero card only** (owner decision).
- [x] **F3c Header progress bar = the real module** — the header now renders the actual `ProgressBar` component (same `size="md"`, glossy/bloom, skill color) instead of the plain bar, driven by `area:progress`. It animates during **draw/shuffle** intermissions too. Alignment above the active card verified (x≈441 both).
- [x] **F3e Shared FocusScaffold** — new `src/ui/components/banner/FocusScaffold.jsx` (mat + header band + card-slot row) is the single definition of "what a focus view looks like." **Deck Focus** now composes from it with a **Deck anchor card + divider + slot cards**. Change the scaffold → all focus views restyle at once.
- [x] **F3d Hero & Station focus → converted to scaffold** *(done 2026-07-09)* — `HeroFocusRow` (anchor Hero card + Stats card + Weapon/Armor/Food/Drink gear slots, click-to-unequip + drop-from-Bank) and `StationFocusRow` (anchor Station card + recipe cards, click-to-select) both compose from `FocusScaffold`. Verified live: "Drake — Hero" and "Smelting Furnace — Station" both render with anchor + card slots matching Deck focus, no errors. **All 3 focus views now share the scaffold — restyle it once, all update.** Old `BannerFocusViews.jsx` (EquipFocusView/RecipeFocusView/DeckFocusView + FocusShell/DeckSlotTile) is now **dead code** — flag for Phase 9 cleanup.
- [x] **F3b Buffer/consistency** *(done 2026-07-09)* — regular row now has `gap-4` + `px-3 py-3` (mat shows through between cards); removed the ad-hoc `px-2`/`border-l` on the hero/station wrappers so spacing is uniform. Enabled by the robust bar (below). A12 threshold bumped (BREATHING 64→130) to account for the gaps; verified no overlap at the sm tier.
- [x] **F3f Robust header-bar alignment** *(done 2026-07-09)* — the task progress bar no longer uses a computed offset. It's `position:absolute; bottom:100%; left:0; right:0` on the active-card wrapper, so it **tracks the active card's exact x/width** regardless of gaps or tier. Verified bar and card both at x=489, w=200. Header simplified to just the area name.
- [x] **F3g Combat card oversized** *(done 2026-07-09, owner-reported)* — combat active cards were rendering at 210×269 because `isHovered=true` triggered GICard's `scale:1.05`. Set `isHovered={false}` on the active card → all cards now uniform 200×256.
- [~] **F3h Header progress — full task info** *(code done 2026-07-10, VISUAL VERIFY PENDING)* — `HeaderTaskProgress` now renders the descriptor ("Swimming…") + task time ("3s > 3s", green/red by modifier) under the bar, matching `TaskStage` 1:1 (exported its `TASK_VERBS` map). Handles draw/shuffle ("Shuffling…"/"Drawing…", no time). Header enlarged h-9→h-14 to fit. **Build compiles clean but browser preview tooling went down on the session reset — not visually confirmed yet.**

### Feedback round 4 (2026-07-10)
- [x] **F4g Badge row ABOVE cards + fix card/slot alignment** *(done 2026-07-10)* — moved the `BadgeRow` from below the card to **above** it (flipped the flex-col order in `RowTemplateCard`/`RowHeroCard`/`RowDeckCard`/`ActiveCardCell`). **Fixed the alignment bug** the owner spotted — Info fields + empty slots were out of line because they lacked a badge strip (and `InfoPanel` was vertically *centering* its card, sitting ~20px low). Now every card layout is **bottom-aligned** (`items-end` on the regular card row, `AdventureCenter`, `StationCenter`, and the focus inner row; `ControlPanel` gets `self-stretch` to still span full height), so **every card frame shares the same baseline** with its badge strip floating in the reserved lane above — no need to add a strip to every card. Gave `RowEmptyCard`/`InfoPanel` an (empty) strip and `RowHazardCard` a real Hazard badge; the station Output/Production/Inputs and focus SlotCards align via `items-end` without strips. Verified live: **all card frames top=40 / bottom=296** in regular, Deck focus (7 frames), AND stationed (Output/Production/Inputs incl.); badges sit at y=5 above; regular === focus === **394px**; no console errors.
- [x] **F4f On-card badges — round row BELOW each card (placeholders + tooltips)** *(done 2026-07-10; superseded by F4g — now above)* — `card-modules/CardBadges.jsx`: derivers (`deriveCardBadgeIds` for task/station/combat/consumable — reworked from old `BadgeGutter` heuristics; `deriveHeroBadgeIds`, `deriveDeckBadgeIds`) + a round **placeholder** `CardBadge` (dark disc + coloured ring/icon per tone) + a horizontal **`BadgeRow`** rendered **directly beneath each card**, fixed height `BANNER_BADGE_ROW_H` (40px). **Taxonomy:** Type (one) = Gathering · Crafting · Combat · Station · Consumable · **Hero** · **Deck**; Info (stackable) = Encounter · Hazard · Specialized-slot · Missing-requirement · **Injured** (hero). Badges bumped **larger** (sm 22 / md 30 / lg 36 px) per owner. Wired at the banner cell level (not inside `ActiveCardFace` — that overlay was reverted): `RowTemplateCard`, `ActiveCardCell`, `RowHeroCard`, `RowDeckCard` each render card + `BadgeRow` in a `flex-col`. **Height model reworked to stay matched:** regular card row is now explicit `cardH + BADGE_ROW_H`, focus scroll container `cardH + BADGE_ROW_H + FOOTER_H`; centers switched to `items-start` so card frames top-align and badge rows hang below. Verified live: regular === focus === **394px**; Hero/active/Deck cards + deck-focus slot cards all show 30px round badges in a row beneath them, correct labels (Hero/Deck/Gathering/Combat), tutorial text in `title`, app healthy. **Deferred:** richer `GUTooltip` (native `title` for now), Boosted/Debuffed (need aggregator threaded to card), and badges on the Station Output/Production/Inputs config cards (skipped — they're panels, not deck cards). *Placeholder discs → sprites later; not screenshot-verified this session (pane capture down).*
- [x] **F4e Banner footer band + focus long-list scroll bar** *(done 2026-07-10)* — added a slim **~40px footer band** (`BANNER_FOOTER_H` in `BannerLayout`) to the bottom of every banner row, **always present** so the regular row and focus views stay the same height (now ~314→**354px**; verified regular === focus === 354 at both 1440px and 900px widths). Footer is **just extra space** — no cards/info/badges (badges are a separate on-card feature, deferred). In **focus views**, the card row is wrapped in a scroll container spanning `cardHeight + footer`, so its **visible horizontal scroll bar renders down in the footer band** — the scroll control for long lists (e.g. 40+ recipes in Recipe focus). Regular row gets an equal-height empty footer (mat art shows through). Scroll bar styled via `.banner-scroll` in `main.css` (kept **unlayered** so it beats the global `::-webkit-scrollbar` — a `@layer` version lost to the unlayered global rule). Verified live: footer 40px, heights match, deck focus overflows and the 10px bar scrolls the row (scrollLeft 0↔75), no console errors. *(Screenshots still blocked by the preview pane this session — verified via measured geometry.)*
- [x] **F4d Banner art = "curtain" reveal (static art, moving clip)** *(done 2026-07-10, revises F4b)* — owner wants a slice of **BOTH** arts, sliding between them, but the **art itself must stay fixed** (the flex-slice version rescaled each art via `cover` as its slice resized — wrong). `AreaMat` now stacks two **full-banner, fixed-size** art layers (Wilds + Outpost, both `cover`-sized to the whole banner so they never move/scale) and slides a **`clip-path` boundary** across them — 80% Wilds in Adventure, 20% in Stationed — like a curtain being pulled back (more of one art revealed, less of the other, neither shifting). Kept **sharp** (`pixelated`) + **full colour** (no dimming). Shared by `AreaBannerRow` + `FocusScaffold` (F4a). Verified live: both layers stay **1438px wide in both modes** (art fixed); only the clip animates — adventure wilds `inset(0 20% 0 0)` / station `inset(0 0 0 80%)`, stationed → `inset(0 80% 0 0)` / `inset(0 0 0 20%)`. No console errors. *(The clip transition looks stuck in the preview browser — same animation-throttling artifact as before; inline target values are correct, snaps to them when the transition is disabled, so it slides in a real browser.)*
- [x] **F4c Header Wilds/Outpost view toggle + free selection** *(done 2026-07-10)* — added a segmented **Wilds | Outpost** toggle to the **right side of the area header** (`ModeToggle` in `BannerHeader`); active view highlighted. Replaces the old undiscoverable center "slice" toggle — **removed the 80/20 center split + `SliceLabel`** so the active view fills the full center width (the 80/20 art split now lives only in the background mat, F4d). **Basic UX: the Outpost view is now freely selectable even with no station built or no hero assigned** (owner request) — relaxed `ModeManager.toggleMode` (dropped the no-hero early-return + the no-station guard); it just shows the "No Station" / empty cards. Confirmed safe: `StationManager` skips areas with no `activeStationCardId`, and craft XP is guarded by `assignedHeroId`. Transient blocks (mid-combat, injured) still surface as warning toasts. Verified live on a **fresh no-hero/no-station game**: both segments enabled; clicking **Outpost** → mode `stationed`, "No Station" card shown, split flips 20/80; **Wilds** → back to `adventure`, split 80/20. No console errors. *(The earlier "can't switch / art not showing" was the area being mid-combat + the hidden slice toggle.)*
- [x] **F4a Focus view = same banner, different overlay** *(done 2026-07-10)* — Focus views (Deck/Hero/Station) no longer change the banner's height or background art. `FocusScaffold` now reproduces the regular row's mat exactly — the same **80/20 Wilds|Outpost split art**, mode-aware (reads the area's current mode, so Deck focus keeps the 8/2 wilds split and Recipe focus keeps the 2/8 outpost split) — and matches the regular row's **header height (h-14)** + **card-row spacing (gap-4 / px-3 py-3)** + **card-tier height**. Verified live: normal row and every focus view all measure **314px** with identical mat splits, no console errors. *Also fixed a latent bug:* the `no-scrollbar` utility was referenced in 3 places (incl. `AreaBannerContainer`) but **never defined in CSS** — it was a no-op, so those overflow rows still showed a scrollbar. Defined it in `tailwind.css` (`scrollbar-width:none` + `::-webkit-scrollbar{display:none}`); the focus card row uses it so its horizontal scrollbar no longer reserves 8px of height (which was the sole cause of the height mismatch).

### Feedback round 2 — follow-ups surfaced
- [x] **A12** **Responsive drop to 128** *(done 2026-07-09)* — new `BannerLayout.jsx` (`BannerLayoutProvider` + `useCardTier()`): a ResizeObserver measures the row and the whole row drops from `md`(256, 200px) to `sm`(128, 100px) when it can't fit Control+5 cards (threshold ≈ 40 + 5×width + 64). All row cells + the header offset consume `useCardTier()`. Verified: md at 1500px (cards 200×256, header aligned), sm at 900px (cards 100×128, no overlap). Hero portrait scales 128→64 at sm.
- [ ] **F2f** [P2] Header progress-bar alignment uses a computed pixel offset (Control+Info+Hero widths); re-check it tracks the active card across slider widths / responsive tier changes.
- [x] **A8** **Collapsed row** — verified collapse/expand still works after the mat restructure (no crash). *(2026-07-09)*
- [ ] **A9** [P2][auto] **Focus-view dimming** (§11.D) — verify other rows still dim correctly when a card row is focused.
- [ ] **A10** [P3][later] **Station-mode center** (§11.B.2) — give the Stationed view the same card treatment. *Deferred: adventure mode first (owner decision).*

## B. Deck configuration & slot types (concept §3, Appendix A)

- [ ] **B1** [P2] **Boost slots** (§3C) — not in the data yet (only regular/specialized/locked exist). Add data shape + yield/haste modifier logic + Deck-Focus UI.
- [ ] **B2** [P2] **Specialized slots** — surface the tag-lock in Deck Focus (only-accepts filtering when picking a card). Data exists (2 authored); UI enforcement/feedback unclear.
- [ ] **B3** [P2][auto] **Deck Focus slot styling** — visually distinguish regular / specialized / boost / hazard slots and show their rules. (Appendix A.1)
- [ ] **B4** [P3][decide] **Dynamic specialized-slot injection from stations** (§3B: "Dock Station adds a Fishing Slot"). Needs a design call on scope.
- [ ] **B5** [P3][decide] **Slot requirement gates** (Appendix A.1: tool-required, input-upkeep, status gates). Partial overlap with deferred buff system — scope carefully.

## C. Loop mechanics (concept §2, §9)

- [ ] **C1** [P2][auto] Verify draw (1–2s) / shuffle (5–10s) / min-1s pacing matches the concept and reads clearly in the UI.
- [ ] **C2** [P3][auto] Audit authored task times vs. concept examples (Chop Wood 15s, Rest 30s, consumable 3s).
- [ ] **C3** [P2][auto] Energy: confirm flat draw cost + pause-on-empty + auto-resume behave/tune sensibly.

## D. Stations & Outpost (concept §6, §7, §11.B.2, §11.D)

- [x] **D1** **Station View center → migrated to Card-Slot style** *(2026-07-10)* — the three thin sub-panels are now three full 200×256 cards on the shared banner frame, uniform size + `gap-4` buffer like the Adventure center: **Output card** (recipe product sprite + name + "Crafted: N"; whole card is the click target → opens Recipe Focus; shows the craft ProgressBar in its footer while crafting), **Production card** (∞/Limit toggles + "Run count" input + "N/limit done" + "Xs / craft"), **Inputs card** (recipe ingredients with item icons + live bank counts, red when short). No-station state now shows a "No Station" empty card. Verified live via forced state (Smelting Furnace + Charcoal recipe, stationed mode): all three cards render at 200×256, no console errors, and the Output card opens the Recipe Focus (Charcoal/Copper/Iron/Gold). *Note: screenshot capture tooling was down this session — verified via accessibility tree + measured geometry, not a pixel screenshot.*
- [ ] **D2** [P2][auto] **Recipe Focus** (§11.D.3) — verify recipe selection reads well.
- [ ] **D3** [P2][auto] Confirm passive station buffs are always-on (both modes) and crafting only runs stationed.

## E. Bottom Folder Drawer (concept §12)

- [ ] **E1** [P2][auto] Verify the three-pane workspace (search/filter top · inspection left · grid center) matches §12.A across Heroes/Cards/Bank tabs.
- [ ] **E2** [P2][auto] **Auto-open + smart filtering** (§12.B) — clicking an empty slot opens the right tab pre-filtered. Verify for Hero, Station, and a Food/consumable slot.
- [ ] **E3** [P3][auto] Inspection panel shows high-res card art + lore + stats (§12.A.2).
- [ ] **E4** [P2][auto] Verify all drawer drag sources (hero→slot, card→deck, station→slot, item→hero/gear).

## F. Pack economy & collection (concept §8)

- [ ] **F1** [P1][bug] **Buy-pack-no-reveal** — pack purchase intermittently charges gold + increments the counter without showing the reveal overlay (seen when Deck Focus / drawer were open). Repro & fix.
- [ ] **F2** [P3][auto] **Pack reveal layout** — retune spacing (`h-[750px]`, `gap-48`) now that cards are 220×256.
- [ ] **F3** [P3][auto] Verify single-copy-per-deck rule + cap-at-4 pool removal still hold in UI.

## G. Notifications & QoL

- [ ] **G1** [P1][auto] **Resource-toast spam** — every harvest fires a `+N item (X/hr)` toast; throttle/aggregate them (e.g. batch per area per interval, or a running ticker).
- [ ] **G2** [P2][auto] **Toasts overlap the banner** — reposition the toast stack so it doesn't cover the top-right of the area rows.

## H. Known bugs (from sweep #1 — see tracker)

- [ ] **H1** [P2][bug] Empty **Hero-slot "ASSIGN"** gave no click feedback. Likely resolved now that the empty hero cell is a clickable card opening the drawer — **verify** and close.
- [ ] **H2** [P2][bug] **CardValidator warning flood** — many task cards `References unknown area` (e.g. `area_guild_hall`). Data mismatch; fix the `areaId` tags.
- [ ] **H3** [P3][bug] **Missing card art** — `?` placeholders for some cards (Blackberry Pie, Community Garden). Author/map sprites.
- [ ] **H4** [P3][auto] Boot logs print each init line 6× — silence the duplicate logging.
- [ ] **H5** [P3][bug] Pre-existing **NaN progress-bar width** console warnings — track down and fix.

## I. Data integrity (flagged during Phase 2 — likely CMS/data authoring)

- [ ] **I1** [P2] `quest_whispering_path` targets a nonexistent item (`item_mpqi3mjl`).
- [ ] **I2** [P2] 4 quests reference a deleted area (`area_mpftfwt8`).
- [ ] **I3** [P2] `task_rocky_outcrop` has a duplicated ID across two areas' task files.
- [ ] **I4** [P2] **Whispering Woods** has no unlock quests (unreachable) and no cards.
- [ ] **I5** [P3] **Sunken Bog** has 4 unlock quests but only needs 3 fragments.

## J. Explicitly DEFERRED (per roadmap Appendix A — *not* for this pass)

Listed so we don't accidentally scope them. Revisit deliberately later.
- Status effects / buff engine (§9 — Salt Shield, loop buffs, whetstone, etc.)
- Area skill trees (§5) and hazard **mitigation** (hazard slots themselves stay)
- Chaos / Threat / Invasion re-integration (Appendix C)
- Slot-injection cards — Tavern, Decoy Trap (Appendix B.1)
- Negative/injury card injection — Sprained Ankle, Rot, Fog/Chaos (Appendix C)
- Offline Progress **Simulator** (replaced this pass by the Time Bank)
- **Area Mastery** (set/quest mastery unlocks + bonuses) — shelved by owner
  decision 2026-07-17 (code review CR-036): the evaluators lost their callers
  with the Library; MasterySystem stays dormant until deliberately re-wired
  (playsets → set mastery, quest completion → quest mastery). Note: the
  Projects system is NOT here — it is retired outright (CR-038), replaced by
  the Guild Hall upgrade tree.

---

## K. UI Overhaul — Bubble Menu & Flexible Bottom Drawer (`ui_overhaul_spec.md`)

> **Supersedes §E above** (the drawer is being rebuilt per the spec). Owner decisions
> locked 2026-07-11: (1) **Top bar fully retired** flag-on — features not carried over
> (Influence display, save status, pause badge, ChaosTracker, **Time Bank widget**)
> come back later when needed; Influence may be cut as a mechanic; **gold lives on the
> Bank bubble + Bank drawer**. (2) Bottom folder-tab bar **removed** — bubbles are the
> only navigation. (3) Shared Inspection Panel = **always-visible fixed column** when
> the drawer is open. (4) Guild Hall Phase 4 = recruitment **plus a small real upgrades
> system** (3–5 upgrades, owner approves the list before build).

- [x] **K1 Phase 1 — Bubble Menu** *(done 2026-07-11)* — `nav/BubbleMenu.jsx`: 8 glass
  bubbles (Guild Hall + Area Manager = disabled placeholders; Packs = interim direct-buy
  reusing the old top-bar flow; Heroes/Cards/Bank toggle the drawer tabs; Binder +
  Settings = existing modals). Gold chip on the Bank bubble (live, compact-formatted).
  Top bar removed flag-on (kept flag-off, boot-verified both modes). Folder-tab bar
  removed; drawer now renders only when open, with a slim header (tab name + close).
  New Settings → Gameplay toggle **"Menu on Right Side"** (`ui.bubbleMenuRight`) —
  verified live: column swaps edges with border flipped. Full interaction pass clean
  (open/switch/toggle-close, binder, settings, pack buy → reveal → claim, gold chip
  100→50, cost 50→60 + disable-when-unaffordable); banner row still 394px; no new
  console errors. *(Screenshot tooling down again — verified via geometry + a11y tree.)*
- [x] **K-FIX Global dead padding/margin utilities** *(fixed 2026-07-11 — found during K1)* —
  the unlayered `* { margin:0; padding:0 }` reset in `main.css` beat **every** Tailwind
  `p-*`/`m-*` utility app-wide (unlayered CSS wins over `@layer utilities` regardless of
  specificity; 34/34 padded elements measured 0px). Wrapped the reset in `@layer base`.
  After: 32/34 non-zero (rest intentional), `mt-auto` etc. restored. Banner geometry
  unaffected (explicit pixel heights). **Watch for subtle spacing shifts on old screens** —
  utilities authored-but-dead are now live everywhere, incl. flag-off mode.
- [x] **K2 Phase 2 — Split-pane Bottom Drawer** *(done 2026-07-11)* — drawer state is now
  `panes[] / filters{} / maximized` (`useUIModals`); bubbles add/remove panes, 1–3 tile
  side-by-side at equal widths in canonical Heroes|Cards|Bank order. Each pane has a slim
  header (Maximize ⇄ Restore — expands to cover the whole play area via `absolute inset-0`;
  Close). New **shared `InspectionPanel`** (fixed 320px, far right, always visible while
  open — owner decision): drawer-wide `{type, id}` selection; the three inspection bodies
  stayed with their panes and are composed (`HeroInspection`/`CardInspection`/
  `ItemInspection` exports). Tabs re-cut to grid-only panes. Verified live end-to-end:
  2-pane 446+446, 3-pane 297×3 (+320 inspect); hero → card selection switching; maximize/
  restore; per-pane close re-splits; §12.B auto-open from an empty banner Hero Slot opens
  just the Heroes pane; recruit → deploy-from-panel → loot → item inspect → sell (+32g,
  gold chip live, panel falls back to empty when the last copy sells). No console errors.
  *Deferred to K3/E4: cross-pane drag (item→hero gear) — native drag can't be simulated
  by the pane tooling; verify by hand or next session.*
- [x] **K3 Phase 3 — Sub-grids** *(done 2026-07-11)* — **Bank:** tabs reuse the persisted
  inventory group system (`groupOrder`/`groupDefs`/`itemOverrides`); starts at ONE tab,
  `inventory.maxTabs` (new, default 1) gates creation (locked 🔒 "+" with unlock hint;
  `createGroup` enforces flag-on only) — the three capacity stats are now all real:
  `maxTabs` / `maxSlots` (display was a dead fallback before; now shows true stack count)
  / `maxStack(+Bonus)` (pre-existing). Compact reorderable lists: drag tile→tile reorders
  (`setGroupOrder` commits the visual order), tile→tab files it, tile→hero equips.
  Double-click renames a tab. Search matches ALL tabs (sorting paused). **Cards:** new
  `BinderTabManager` (`collection.binder`, identical model, `collection_updated`) + tiles
  are now REAL half-size card faces (`ActiveCardFace` sm/128, ~100px, mock instance like
  the banner's RowTemplateCard) with an ownership strip (pips + deployed). Same tab strip,
  reorder, drop-to-tab. **Heroes:** roster tile = portrait sprite + name/class + 4 mini
  gear slots (live icons + tooltips) + grip handle, NO vitals (owner decision); tile is a
  drop target — item→hero equips (`EquipmentManager.equipItem`). Shared `TabStrip.jsx`.
  Verified live end-to-end incl. synthetic native-drag: reorder commit, cross-tab move,
  tab create/rename via UI (with maxTabs bumped to 3 to simulate the upgrade), item→hero
  equip (blueberry → food slot, mini-slot icon updated), search-across-tabs. No errors
  from new code.
  - [ ] **K3-a** [P2][data] **No equippable weapons/armor exist** — nothing in
    `data/items.json` has `equipSlot` (equip only infers from type food/drink), so
    "drag a sword onto a hero" fails by DATA, not code (`item_copper_sword` refused).
    Author `equipSlot` on gear items in the CMS.
  - [x] **K3-b** ~~Recruitment stays in the Heroes pane~~ *(resolved by K4 — moved to
    the Guild Hall's Recruitment Center, removed from the Heroes pane.)*
  > **Owner decisions locked 2026-07-11 (pre-session Q&A):**
  > 1. **Bank tabs start at ONE**; more tabs are **unlocked via the Upgrade Tree**
  >    (ties into the Phase 4 Guild Hall upgrades system — K4). Not pre-seeded, not
  >    all 20 up front; tabs are renamable.
  > 2. **Organizing = compact reorderable list** per tab (no fixed slot grid / no
  >    gaps — items pack together, drag to reorder or move between tabs).
  > 3. **Capacity = three SEPARATE upgrade paths:** per-stack size cap, total slot
  >    count, and number of tabs — each individually upgradeable (Guild Hall tree).
  >    Design the data so each limit is its own stat.
  > 4. **Card Binder uses the same tab system as the Bank** (user tabs, manual
  >    placement, search across all tabs) — one consistent system.
  >
  > Note for K4: these decisions expand Guild Hall's upgrade list — bank tab count,
  > bank slot count, stack size (+ the 3–5 general upgrades still to be drafted for
  > owner approval).
- [x] **K4 Phase 4 — Full-screen drawers** *(done 2026-07-11)* — **Upgrade tree approved
  by owner:** Bank Tabs / Bank Slots / Stack Size / Roster Size, GOLD-only costs
  (placeholder curves in `config/guildUpgrades.js` — flagged for balancing).
  `GuildUpgradeManager` (ranks in `progress.guildUpgrades`; derived stats RECOMPUTED from
  ranks on purchase + `game_loaded`, so saves can't drift — verified: a stale hacked
  maxTabs=3 in the test save was corrected to rank-derived on load; bank_tabs also mirrors
  onto `collection.binder.maxTabs`). Registered in EngineBootstrap flag-on. **Screens**
  (`src/ui/components/fullscreen/`): shared `FullScreenDrawer` shell (covers play area,
  bubble column stays, one at a time, slide-up) + `GuildHallScreen` (upgrade rows w/ rank
  pips + costs + Recruitment Center moved in from the Heroes pane → K3-b closed),
  `PackShopScreen` (replaces the Phase 1 bubble direct-buy; price/buy → existing reveal,
  counters), `AreaManagerScreen` (strips `[Area]—[Hero]—[Active Card]` + status +
  Start/Stop via LoopRunner pause/resume; hover tooltip lists deck outputs; Global
  Economy panel = live net items/hr from `ItemRateTracker.getAllRates()` (new), 3s poll).
  Bubbles fully wired — no placeholders left. Verified live: purchases (gold 5100→4350,
  maxTabs 1→2 + binder mirror, roster 5→6 shown as 1/6), pack buy→reveal→claim from the
  shop, strips live (Viper/Cow Pasture/Drawing…), stop→"Stopped"→start, economy rates
  (+120/hr entries), one-view-at-a-time, clean fresh-boot console (a hooks warning during
  the session was an HMR artifact only).
  - [ ] **K4-a** [P3] Area Manager can't add/remove areas from the playmat yet — the
    banner's hide/collapse is per-session local state in `AreaBannerContainer`; lift it
    (or persist it) to wire the manager's playmat management (spec §COMP-AREA).
  - [ ] **K4-b** [P3][balance] Upgrade cost curves + starter gold economy are
    placeholders — tune once the loop economy settles (SCB work).
- [ ] **K5** [P3] Re-home the parked top-bar features when needed: save-status indicator,
  pause badge, Time Bank widget, ChaosTracker (Chaos is deferred anyway, §J).

---

*Add your items below (or inline in the sections above):*

- [ ] **NEW-1** …
