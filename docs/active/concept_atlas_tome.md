Status: briefed 2026-10-14 (approved 2026-10-14; brief 160)

# The Atlas as a tome, and area banners

*From the owner's refinement pass ([refinement_pass_todo.md](refinement_pass_todo.md)
§2, "Cartography Atlas & Regions Viewport Overhaul" and "256px Background &
Card Art Integration: Area Banners"). Owner interview, 2026-10-13; **done**
(owner closed it). Restyles the screens Atlas A6 built (`src/ui/components/atlas/`);
the camera move is [concept_guild_hall.md](concept_guild_hall.md)'s
"Transitions". The look follows [UI_STYLE.md](../reference/UI_STYLE.md).
Build tickets: **T-172** (the tome and Cartography), **T-173** (Region rows and
banners), **T-174** (camera moves).*

## The view

- **Owner, 2026-10-20, after the first look (supersedes the camera move
  below)**: the Atlas **pops up from the bottom over the playmat** (slides
  up, the mat behind not dimmed, no table under the book; slides back down
  on close). The book is the owner's **256 px pages `atlas_book_left.png`
  and `atlas_book_right.png`** (the right page's drawn ribbon is decoration;
  the section ribbons stay on the top edge). **Scale to be chosen by eye**:
  2×, 3× or 4× (4× matches the wood and terrain pixel size but overflows the
  screen). The camera glide is kept for the Guild Hall upgrade screen
  (T-194, tag `atlas-camera-move`).

- **Owner, 2026-10-20 (supersedes the lines below where they differ)**: the
  book is the owner's sprite `playmat/atlas_book_gold.png` (128 px, the
  right page; **mirrored for the left page**), drawn at **4×**. The Atlas
  and Cartography UI sit **inside the pages**. **The playmat and the book
  both rest on the wood table**; opening the Atlas is **a camera move, the
  player looking away from the playmat up to the book** on the same table;
  closing looks back down. Built as T4 (engineer) after the book art.

- **The camera tilts down from the mat onto the cartographer's map table**
  (D6), where **a giant tome lies open**; the table's edge and props (a
  candle, a compass) peek around it. Quick (under a second), skippable, with a
  reduce-motion setting; the same move tilts up into the Hall's sky. Built
  with this work (T-174), not later.
- **The book is a backdrop for the game's regular UI**, not a UI of its own:
  panels, item bars, buttons and frames are the standard ones (UI_STYLE),
  laid over the open pages.
- **It fills nearly the whole screen** (~90 % of the window). No more overlay
  floating over the mat.
- **Two sections, switched by bookmark tabs** on the book's edge (ribbon
  bookmarks; a themed variant of UI_STYLE's tabs for this screen only), with a
  quick stepped page-turn: **Cartography** and **Regions**.

## Cartography

- **Spans both pages.** Left page: the maps the guild holds and the slots.
  Right page: **a big layout preview** (the largest element on the screen),
  the node summary under it, Reroll / Cancel / Settle at the bottom right.
- **The previewed Region's base-map banner sits behind the layout preview.**
- **Drag maps into slots**: drag a map onto a slot or between slots; drag it
  off a slot to empty it; **a click still slots it into the next free slot**.
  Uses the game's existing drag system (brief 50).

## Regions

- **A list, one Region per row**, scrollable with the arrow bars.
- **Each row's backdrop is its area banner**, full-art like the Token card
  ([concept_info_layers.md](concept_info_layers.md)): text sits in slightly
  opaque boxes over the art.
- **A row shows**: the flavour name (renamable) and the practical name
  ("Oak Forest · Copper"); the main resource nodes as small sprite pills; day
  settled, Token count and the heroes there now.
- **Order**: the Starter Camp first, then by settle date. The current Region
  reads "Here". Archived Regions sit behind a toggle.
- **Actions**: **Travel** is the main (gold) button; a small "…" icon opens
  Rename / Archive / Abandon. Abandon asks first and is refused for the
  Starter Camp and the Region you're in (as today).

## Area banners

The owner's 256 px environment pieces (`public/assets/backgrounds/area/`,
19 today: beach, desert, lush forest, snowy mountains, swamp, village…).

- **Which banner**: **each Base Map item names its banner in the CMS**; the
  Starter Camp names its own. Modifiers don't change it.
- **Without a CMS pick** (owner, 2026-10-20): the game picks a banner by the
  Region's **main biome** (forest → lush forest, coast → beach, mountain →
  snowy mountains…, one default per biome); a CMS pick overrides it.
- **Where it shows**:
  - the Region row's backdrop (above);
  - **behind the Region name on the top bar**, as a thin slice (T-170);
  - **on travel**: the destination's banner shows full width for a moment
    with its name, an arrival card;
  - **behind the Cartography layout preview** (above).

## Notes for the director

- **T-172** (builder): the tome screen, near full screen, bookmark tabs and
  page-turn, Cartography laid out over both pages, drag to slot. ⚠️ A6's
  tests pin today's screen; keep its behaviour (slots forgotten on close,
  nothing leaves the Bank until Settle) and change only the presentation.
- **T-173** (builder): the Region rows, the CMS banner field on Base Map items
  and the Starter Camp page (CMS code; the owner sets the pictures and
  Syncs), the top bar slice, the arrival card, the preview backdrop.
- **T-174** (engineer: it touches how the screens mount): the camera tilt
  both ways, Hall up and Atlas down, skippable, with a reduce-motion setting.
- **Art (owner)**: the open-tome spread, the table edge with its props, the
  bookmark ribbons; placeholders until drawn (on the art list). Every piece
  changes the look: owner eye-check.
