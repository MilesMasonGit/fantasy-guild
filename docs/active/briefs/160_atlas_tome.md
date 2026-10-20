# Brief 160 — The Atlas tome, area banners and the Hall's sky

**Sources of truth:** [`concept_atlas_tome.md`](../concept_atlas_tome.md) and
[`concept_guild_hall.md`](../concept_guild_hall.md) "Transitions" and "The
look of the sky" (approved 2026-10-14).

**Needs:** brief 100; brief 110's top bar (the banner slice sits behind its
Region name).

**Branch:** `crunch/atlas-tome`. **Eye-check:** yes, two batches: after T2
(the Atlas) and after T4 (sky and camera).

## T1 — The tome and Cartography (T-172, builder)

- ⚠️ A6's tests pin today's behaviour: slots forgotten on close, nothing
  leaves the Bank until Settle. Change only the presentation.
- **Change:** the tome backdrop at ~90 % of the window with standard UI over
  it; bookmark tabs and a stepped page-turn; Cartography over both pages with
  the big layout preview; drag maps into, between and out of slots (brief 50's
  drag system), click still slots.

## T2 — Region rows and banners (T-173, builder)

- **Change:** one row per Region on its banner; Travel main, the "…" menu for
  Rename, Archive, Abandon; a CMS banner field on Base Map items and the
  Starter Camp page (CMS code); without a pick, a default banner by the
  Region's main biome (owner, 2026-10-20; read the biome, don't edit the
  terrain director's files); the banner slice on the top bar, the arrival
  card on travel, the banner behind the layout preview.

## T1b — The owner's book (owner, 2026-10-20)

- **Change:** the code-drawn book becomes `playmat/atlas_book_gold.png` at
  4×, mirrored for the left page; the Cartography and Regions UI fitted
  inside the pages; ribbons on the book's top edge.

## T4a — The camera move to the Atlas (owner, 2026-10-20; engineer)

- **Change:** the playmat and the book rest on one wood table; opening the
  Atlas glides the camera up from the mat to the book, closing glides back;
  quick, skippable, reduced motion respected. `bench:draw --compare`
  cost-log line. (The Hall sky's tilt, T3/T4, stays for later.)

## T3 — The Hall's sky (T-171, builder)

- **Change:** as "The look of the sky" says, including the two drifting
  backdrop layers (owner's art is in `playmat/screens/`) and the owner's star
  sprites when drawn. Check T-128 while there.
- **Measure:** the drift on the Hall screen with the Perf HUD; it must not
  run while the screen is closed.

## T4 — Camera moves (T-174, engineer)

- **Change:** tilt up into the sky and down onto the map table, under a
  second, skippable, with a reduce-motion setting. It touches how the screens
  mount. `bench:draw --compare` cost-log line.

## Owner to-do

- After T2 Syncs: pick each Base Map's banner and the Starter Camp's in the
  CMS, then Sync on `main`.
- Art: the open-tome spread, the table edge and props, bookmark ribbons, the
  night sky (placeholders until drawn).
