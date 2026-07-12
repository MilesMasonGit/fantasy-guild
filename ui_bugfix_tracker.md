# Deck-Loop UI / Bugfix Tracker

Living issue log for the post-rework bugfix & UI-fidelity phase on `deck-loop-rework`
(feature flag `USE_DECK_LOOP` flipped **on** locally — **not committed**; `main` still ships the old game).

**Two tracks:**
- **Track A — Functional / UX bugs** (broken or confusing behavior)
- **Track B — UI fidelity** ("adopt from the old version" / visual polish)

Status values: `open` · `investigating` · `fixed` · `wontfix` · `needs-owner-input`

---

## Sweep #1 — automated pass (2026-07-09, Claude)

Driven headless through the main flow on a fresh Slot-1 new game: boot → recruit → assign hero → run loop → Deck Focus → Cards tab → Bank tab → Buy Pack → claim. **No console *errors* at any step.** Core systems all functional. Findings below.

### What works (verified)
- Boots to slot-select cleanly; New Game builds the banner layout (Guild Hall active + Whispering Woods / Misty Mountains / Sunken Bog as locked strips with map-fragment progress).
- **Recruitment:** Find Candidates → 3 candidates with traits + skills → Hire (Influence deducted 10→0, next-hire cost scales 10→12, others dismissed).
- **Loop:** hero assigned → sequential card advance, resources deposit to bank, HP/EN bars live, combat card sits in deck (Cow Pasture → Bones drops).
- **Deck Focus:** inline row morph, all 6 slots with card-type labels, per-slot remove, add-slot, DROP-TO-REMOVE zone.
- **Cards tab:** ALL/TASK/COMBAT/STATION/CONSUMABLE filters, search, sort, DEPLOYED badge, card art.
- **Bank tab:** FOOD/MATERIAL filters, harvested items with correct icons + counts.
- **Pack shop:** reveal overlay with full card art, pick-one claim, gold deducted correctly, cost curve scales (50→60→70).

### Issues

| # | Track | Sev | Status | Summary |
|---|-------|-----|--------|---------|
| 1 | A | High (UX) | open | **Resource-toast spam.** Every harvest fires a `+N <item> (X/hr)` toast; they stack 6-high top-right and overlap the Guild Hall banner (covering the Station slot / top-right controls). Will be overwhelming with multiple areas running. Needs throttling/aggregation or relocation. |
| 2 | A | Med (UX) | open | **ASSIGN button does nothing on click.** The empty Hero Slot's prominent "ASSIGN" button gives no visible response — assignment is drag-only (drawer auto-opens to Heroes expecting a drag). Players will click it and think it's broken. Make it open a picker/confirm, or relabel to a hint. |
| 3 | A | Med | needs-repro | **Buy Pack sometimes charges without showing the reveal.** First purchase (done while Deck Focus + drawer were open) deducted 50g and bumped the pack counter 0→1 but **no reveal overlay appeared**; a retry on a cleaner screen worked. Possible interaction bug when buying with Deck Focus/drawer open → player pays, gets no card. Needs a deliberate repro. |
| 4 | A | Low (data) | open | **CardValidator warning flood.** Many task cards warn `References unknown area: "area_guild_hall"` / `"area_sunken_bog"` (wheat_field, berry_bush_patch, wishing_well, community_garden, shrimp_river, coal_vein, rocky_outcrop, …). Data mismatch between card `areaId` and the area registry. Console noise; overlaps Phase-2 data issues already flagged. |
| 5 | B | Low (art) | open | **Missing card art.** Some templates render a "?" placeholder in the Cards tab (Blackberry Pie [consumable], Community Garden). Sprites unauthored/unmapped. |
| 6 | B | — | in-progress | **Full card art in the running row — DONE (first pass).** Row now renders the real `ActiveCardFace` instead of the placard. Owner decisions (2026-07-09): BG art must display at **native 256px** (sprites are 256×256; `GICard` was upscaling to 512); the frame is a **window narrower than the sprite** so the sides crop (intended); content **overlays** the art as before; applies to **all cards everywhere** (global `GICard` change). First-cut frame = **220×256** → rows dropped 440px→~256px. Verified crisp in both the area row and the pack reveal, no errors. Follow-ups below. |
| 7 | A | Low (noise) | open | **Boot logs print each init line 6×.** Verified this is **not** duplicate engine init (only 7 tick handlers, 1 React root) — cosmetic log noise (likely StrictMode + module echo). Worth silencing to keep the console readable during this phase. |

### Ruled out (not bugs)
- **Low FPS counter (single digits).** The on-screen counter reads ~2–8 FPS, but the main thread is *idle* (`setTimeout(0)` lag = 0ms) and there's no runaway loop or duplicate engine. This is the **headless preview browser throttling rAF**, not a game slowdown. ⇒ **Owner: please confirm smoothness in your own browser** — I can't measure it reliably here.

### Not yet exercised this sweep (for a later pass)
- Adventure ↔ Stationed mode toggle (split-banner) + Station crafting queue (no station card owned by default; needs a pack pull or console grant).
- Equip Focus / Recipe Focus.
- Hero/card/item drag-and-drop from the drawer (native HTML5 drag — needs DragEvent simulation).
- Time Bank widget (offline accrual + fast-forward).
- Save / load roundtrip; collapse/expand rows; locked-area unlock progression.

### Card-rendering progress
- ✅ **Footer actions suppressed** — added `showActions` prop to `ActiveCardFace`; the active card and all row cards render with `showActions={false}`, so the pack/binder buttons (Loot, Put Away, Abandon, tabs) no longer appear on loop cards.
- ✅ **All row cells now render as native-256 cards** (2026-07-09): Hero, each Upcoming slot, Deck, and Station use the same card frame as the active card. New components in `AreaBannerRow.jsx`: `RowTemplateCard` (upcoming + built station, via `ActiveCardFace`+`CardFactory` mock), `RowHeroCard` (area art + 128px portrait + HP/EN), `RowDeckCard` (area art + slot count), `RowEmptyCard` (Assign / No Station / empty slot), `RowHazardCard`. `ActiveCardFace` also gained a station-sprite bg fallback. Old `UpcomingTile` removed. Verified: hero portrait, deck, station, active all render as cards, row = 256px tall, no console errors.

### Card-rendering follow-ups (now the critical path — spacing)
- **⚠️ Upcoming track has no room.** The 80/20 split-banner center (~490px) only fits the active card + deck card; the upcoming preview cards get clipped to nothing. The center layout / split-banner needs rework to hold a scrollable row of 220px cards. **This is the main spacing task now.**
- **Row total width ~1150px+** (Control + Info + 4–5 cards) overflows narrower screens — decide how the row handles width (horizontal scroll for upcoming, responsive card count, etc.).
- **Info + Control pillars** are still the old thin bars — decide whether they stay as pillars or also get restyled to the taller row.
- **Pack reveal layout** was built around 280×440 (container `h-[750px]`, `gap-48`); cards are now 220×256, so its spacing/scale can be tightened (works, just loose).
- **Frame window width (220px) is a first cut** — dial the exact side-crop with the owner.

### Test-state note
Left a **Slot-1 new game running** with Wraith deployed to Guild Hall and the loop active, for you to browse. I temporarily set `currency.gold = 1000` via console to test the pack shop (now ~940). This is a throwaway test save — start your own New Game if you want a clean slate.
