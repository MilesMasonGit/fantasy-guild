# Playmat Refinement — Improvement Register

**Status: collecting.** This document is being assembled in a single session
with the owner. Each entry is a mechanic the owner has named as needing work.
Agent briefs are written **after** the list is closed, not as we go.

**Branch context:** `playmat-7x7-build`, phases 0–9 complete. This work sits
alongside or inside Phase 10 (Polish, Clutter & the First Balance Pass) of
[`playmat_roadmap_v1.md`](playmat_roadmap_v1.md).

**How to read an entry.** *What it is now* was verified against the code, not
taken from the owner's description or from the design docs — several of those
docs describe intentions that were never built, and where that is the case it is
said so explicitly. *Direction* is the owner's. *Open questions* must be answered
before a brief can be written.

---

## R-1 — Tokens must read as one physical object everywhere

**✅ DONE (2026-08-07, branch `token-object`, uncommitted).** Intent spec:
[`token_object_intent.md`](token_object_intent.md) — decisions **D-215…D-222**,
approved before any code was written. Four interview rounds settled it.

**What shipped:** one `<TokenSprite>` component behind all **eight** call sites;
Token art at exactly **two sizes — 128px in play, 64px in storage** (Cartographer
chips at 32px, a recorded exception); **no frame on any surface**; bloom retired
in favour of a shadow-and-offset lift; and the loot ring replaced by **items
hover, Tokens rest**.

**Two things the entry below got wrong**, both found by re-verifying:
- **Six components at five sizes was actually eight components at six sizes.**
  `CartographerTab.jsx` (22px) and `TokenInspection.jsx` (48px) were missed.
- **Token source art is 64×64, not 32×32** — the 32px figure was measured from
  the placeholder *skill* icons. This amended **D-171** and meant the board tile's
  96px was itself fractional (1.5×), so it would have rendered blurry the moment
  real art was wired in. See D-216.

**Verified:** `npm test` 613 passing across 42 files; exercised live — every
`/assets/` image in the running DOM measured 128 or 64 with no other Token size
present, Tray borders `0px`, zero rings left on the floor, and a Token dragged
Tray→tile carried at 128px with no frame, no scale and no rotation.

**Handed on, not solved:** full-bleed tile art makes the alert dot, progress ring
and hero chip sit on artwork — **R-7** and **R-6** own that. Real Token art is
still unwired (15 sprites in `public/assets/tokens/`).

---

**Owner's words:** *"I want them to look as much like objects as possible, and
look consistent throughout the lifespan. Currently they change sizes and have
bounding boxes."*

### What it is now

A Token is drawn by six different components, at **five different art sizes**,
with a frame that appears and disappears three times during a single
pick-up-and-place:

| Surface | Frame around the art | Art size | Source |
| :--- | :--- | ---: | :--- |
| Board tile | none (transient drag ring only) | **96px** | [BoardTile.jsx:177](src/ui/components/board/BoardTile.jsx:177) |
| Tray slot | permanent — `rounded border bg-gi-surface/70` | **40px** | [Tray.jsx:144](src/ui/components/board/Tray.jsx:144), [:158](src/ui/components/board/Tray.jsx:158) |
| Drag ghost, over the board | `rounded-md bg-black/45 ring-2 ring-white/50` + drop shadow, in a `TILE_PX` box | **96px** | [DragGhost.jsx:68](src/ui/dnd/DragGhost.jsx:68), [:77](src/ui/dnd/DragGhost.jsx:77) |
| Drag ghost, over a drawer | none, in a 48px box | **40px** | [DragGhost.jsx:62](src/ui/dnd/DragGhost.jsx:62) |
| Loot sprite on the floor | `ring-2 ring-gi-primary/70 bg-black/50`, 44px box | **36px** | [SpriteLayerView.jsx:104](src/ui/components/board/SpriteLayerView.jsx:104), [:116](src/ui/components/board/SpriteLayerView.jsx:116) |
| Token Vault row | list row, no frame | **32px** | [TokenVaultTab.jsx:129](src/ui/components/drawer/TokenVaultTab.jsx:129) |

So the lifespan of one Token currently reads: 36px ringed → (drag) 40px bare →
96px framed → (drop) 96px bare → (lift) 40px framed in the Tray. **The owner's
complaint is accurate and this table is the evidence for it.**

Two further findings the owner did not raise but that belong to the same fix:

- **The sizes are hardcoded, and that violates a stated rule.**
  [`boardConstants.js:29`](src/ui/components/board/boardConstants.js:29) says
  *"Nothing may hardcode 128"* so a future small mode is a config change. Every
  `96` and `40` above is a literal, unrelated to `TILE_PX` or `ART_PX`. Any
  rescale today is a hunt across six files.
- **`DragGhost.jsx` carries a ⚠️ note that was never acted on**
  ([:24–25](src/ui/dnd/DragGhost.jsx:24)): the frame is *"still sized to the
  retired banner tiers"* and Phase 2 was supposed to point it at `TILE_PX`. The
  bold box was, the image inside it was not.

### Direction

One Token, one appearance, one scale rule, across board, Tray, ghost, floor
sprite and Vault. No frame that comes and goes — the art itself is the object.

### Touches

`BoardTile.jsx`, `Tray.jsx`, `DragGhost.jsx`, `SpriteLayerView.jsx`,
`TokenVaultTab.jsx`, `boardConstants.js`. Probably wants a single shared
`<TokenSprite>` component so a seventh surface cannot drift again.

### Decisions this collides with — the agent must be told, and the owner must rule

1. **D-143 is on the owner's side.** It already asks that Tokens *"read as solid
   objects resting on a surface, not cells in a spreadsheet."* The board tile
   honours this; nothing else does. Framed this way the change is **completing
   D-143, not overturning it** — the brief should say so, or an agent will treat
   it as a design change and hedge.
2. **The Tray's frame is a slot affordance, not decoration.** It marks a
   grid-of-slots with a capacity count (`n / 20`). Removing every border may make
   a part-full Tray read as loose clutter rather than a rack. *The frame can move
   from the Token to the slot behind it* — that is the likely answer, but it is
   the owner's call.
3. **The ghost's frame is UI §5's "bloom on cross-over"** — a deliberate,
   owner-chosen 2026-07-15 behaviour where the ghost visibly changes as it
   crosses from drawer to board. **Constant size is in direct tension with
   bloom.** One of the two has to give.
4. **The loot sprite's ring is load-bearing information**, not styling: a ringed
   sprite is a *Token* (draggable to a tile), an unringed one is an *item*
   (click to collect). Flatten them and the two gestures stop being
   distinguishable. A replacement cue is needed, not just a deletion.

### Open questions for the owner

- **Q1.1** Does "one size" mean literally identical pixels everywhere, or the
  same *object* rendered at whatever the surface's scale is (tile-scale on the
  board, rack-scale in the Tray) with identical framing and proportion?
- **Q1.2** Bloom on pick-up: keep it (ghost grows crossing onto the board), or
  kill it for a constant-size carry?
- **Q1.3** If frames go, what tells a Token sprite apart from an item sprite on
  the floor?

---

## R-2 — How Drops look, and wiring the particle fly to the Bank

**Owner's words:** *"We need to update how Drops look on the playmat. Similar
issues, we need to wire in the particle fly to the bank."*

### What it is now

**The documented arc does not exist.** Both
[`SpriteLayer.js:20`](src/systems/board/SpriteLayer.js:20) and the CSS comment at
[`tailwind.css:405`](src/tailwind.css:405) state that items *"pop out on an arc
and settle 1–2 tiles from their source."* In the code:

- `scatterFrom()` ([SpriteLayer.js:75](src/systems/board/SpriteLayer.js:75))
  picks the **landing point** 1–2 tiles from the source tile. Correct.
- `gi-loot-drop` ([tailwind.css:416](src/tailwind.css:416)) then animates the
  sprite **in place** — scale 0.2→1 with a 26px vertical drop and a bounce.

There is **no travel from source to landing**. Loot materialises at its
destination. The arc is a doc claim, not a behaviour — worth knowing, because a
brief that says "improve the arc" would send an agent looking for code that isn't
there.

**The particle system exists, works, and the board never triggers it.**
[`ParticleOverlay.jsx`](src/ui/components/base/ParticleOverlay.jsx) is mounted
([ReactRoot.jsx:85](src/ui/ReactRoot.jsx:85)) and flies sprite-drawn particles
with trails, sparkles and a landing burst toward `#bank-bubble-target`, the Bank
nav bubble. It is silent on the board for two independent reasons:

1. Both subscriptions bail without a `cardId`
   ([:51](src/ui/components/base/ParticleOverlay.jsx:51),
   [:57](src/ui/components/base/ParticleOverlay.jsx:57)). Board combat loot
   publishes `loot_generated` with a **`tile`** and no `cardId`
   ([LootSystem.js:76](src/systems/combat/LootSystem.js:76)), so it is dropped.
2. `_getRect()` ([:182](src/ui/components/base/ParticleOverlay.jsx:182)) can only
   resolve `'bank-bubble-target'` or a `[data-card-id]` node. **A board tile is
   neither** — there is no way to express "from tile 31" as a source.

Nothing publishes an event at the moment that actually matters either:
`collectSprite()` ([SpriteLayer.js:164](src/systems/board/SpriteLayer.js:164)) is
where an item enters the Bank, and it emits only `SPRITES_CHANGED` and
`state_changed`.

So this is **wiring an existing, working system into a new surface**, not
building particles. That is a much smaller job than it sounds and the brief
should say so.

### Direction

Drops read as physical objects with mass (consistent with R-1), and collecting
one flies it to the Bank the way card-era loot did.

### Touches

`SpriteLayer.js` (emit a collection event carrying screen or tile coordinates),
`ParticleOverlay.jsx` (accept a board-tile / point source in `_getRect`, drop the
`cardId` gate), `SpriteLayerView.jsx` (sprite appearance), `tailwind.css`
(`gi-loot-drop`).

### Complications the agent must handle

- **Items and Tokens land in different places (D-158):** items → Bank, Tokens →
  Tray. A single "fly to the Bank" is wrong for half the cases. Either Tokens fly
  to the Tray instead, or Tokens don't fly.
- **Collection can legitimately fail** and the sprite must stay put — a full Bank
  is D-138's visible-litter signal. A particle that flies away while the item
  remains on the floor would be a lie. The particle must fire on *successful*
  collection only.
- **Auto-collect sweeps in bulk** ([SpriteLayer.js:276](src/systems/board/SpriteLayer.js:276)).
  A 40-sprite sweep firing 40 particles at once needs a cap or a stagger — the
  existing 80ms stagger is per-call, not global.
- **`prefers-reduced-motion` is already respected** by `gi-loot-drop`
  ([tailwind.css:430](src/tailwind.css:430)); particles have their own
  `ui.itemParticles` setting. Both must keep working.
- **D-167 / D-142 are the reason this matters:** a Map burst is the headline
  reward beat but yields only 3–6 things, so *presentation carries the
  spectacle*. This entry is the main lever on the owner's outstanding "does a
  burst feel like a reward or a chore?" judgement.

### Open questions for the owner

- **Q2.1** Should loot actually **travel** from its source tile to its landing
  spot (a real arc), or keep materialising in place with a better landing?
- **Q2.2** Do Tokens fly to the Tray on collect, or do only items fly?
- **Q2.3** Does the particle's Bank target stay the nav bubble, or should it aim
  at the Bank drawer when that drawer is open?

---

## R-3 — The item, Token and Map Bank drawers

**Owner's words:** *"We need to modify our item, token, and map bank drawers."*
**⚠️ Direction not yet given — this entry is a stub.**

### What it is now

All three are panes of
[`BottomFolderDrawer.jsx`](src/ui/components/drawer/BottomFolderDrawer.jsx),
opened from the BubbleMenu, sharing one `InspectionPanel` column on the far side.
Multiple panes can be open at once, splitting the width; any pane can be
maximised over the play area. They are presented in three quite different idioms:

| Pane | Component | Presentation |
| :--- | :--- | :--- |
| Bank (items) | `BankTab.jsx` (579 lines) | Icon **grid**, 64px icons, `auto-fill minmax(6rem)`. Carries the most machinery by far: up to 20 user tabs, drag-to-file between tabs, search, type filter, multi-select mode, bulk sell with a confirm modal, gold readout. |
| Token Vault | `TokenVaultTab.jsx` | **List of rows**, 32px art, one row per *type* with a copy count. Two buttons per row: → Tray, and Sell. |
| Cartographer | `CartographerTab.jsx` | The Map shop — the one shop deliberately not on the board (D-98). |

The three share a header strip and nothing else — no common tile, no common
scale, no common empty state.

### Open questions for the owner — all of them

- **Q3.1** What is wrong with them? Is it the same complaint as R-1 (inconsistent
  presentation between the three), or something functional?
- **Q3.2** Is the *bottom drawer* form itself in question — the fact that opening
  one covers the board — or only the contents of the panes?
- **Q3.3** Should the three converge on one visual idiom (grid or list), or is
  the difference deliberate? The list-vs-grid split has a stated reason: item
  stacks are counted, Token *types* are the capped thing (D-137), so a Vault grid
  would misrepresent what the player is managing.
- **Q3.4** Does the Cartographer belong in the same drawer as two storage panes
  at all? It is a shop, not storage.

---

## R-4 — Rearranging the playmat's column order

**Owner's words:** *"We need to rearrange our playmat UI, changing the order the
tray, playmat, and notification columns appear in."*

### What it is now

From [`ReactRoot.jsx:100–160`](src/ui/ReactRoot.jsx:100), left to right:

```
[ BubbleMenu ]  [ Board (flex-1, scrollable) ]  [ Tray (w-64, fixed) ]
                [ BottomFolderDrawer — below, full width when open ]
                [ HeroDock — floating strip on the play area's bottom edge ]
```

- **BubbleMenu** is already side-switchable: a `menuRight` flag flips it to the
  right edge, and `BottomFolderDrawer` reverses its own `flex-row` direction to
  match ([BottomFolderDrawer.jsx:78](src/ui/components/drawer/BottomFolderDrawer.jsx:78)).
  So a precedent for mirroring exists.
- **The Tray is hard-coded to the right** — it is simply the last child, with a
  `border-l` that assumes it.
- **⚠️ There is no notification column.** Notifications are `ToastContainer`, a
  `position: fixed` overlay at `z-[9999]` whose corner is a user **setting**
  (`notifications.position`, default `top_right`) — it floats over everything and
  occupies no layout space at all
  ([ToastContainer.jsx:84](src/ui/components/base/ToastContainer.jsx:84)).

That last point is the one to settle before anything is built: **either the owner
means the toast overlay and wants it turned into a real column that reserves
space, or they mean a different element** (the BubbleMenu is the only other
vertical strip). These are very different jobs.

### Direction

Not yet specified beyond "change the order."

### Touches

`ReactRoot.jsx` (the layout), `Tray.jsx` (border side), `ToastContainer.jsx` /
`SettingsManager` if notifications become a column, `BottomFolderDrawer.jsx` if
its mirroring must follow.

### Open questions for the owner

- **Q4.1** What order, exactly? Left-to-right, naming each of the three or four
  strips.
- **Q4.2** Does "notification column" mean the floating toasts, or the BubbleMenu?
- **Q4.3** If it is the toasts: should they become a permanent column that always
  reserves width even when empty, or stay floating and just move? A permanent
  column costs board width, which D-171 spends carefully — the 896px board is
  sized to dominate beside a ~25% Tray.
- **Q4.4** Is this a **fixed** new order, or a user setting like `menuRight`
  already is?

---

## R-5 — Rework the Hero Dock: less card-flavoured, more hero-flavoured

**Owner's words:** *"We need to rework the hero dock, making it less card
flavoured and more hero flavoured."*

### What it is now

The card metaphor is not a skin — it is the dock's **architecture**, present in
three independent layers:

- **Geometry.** Cards overlap by `DOCK_OVERLAP`, with the leftmost on top, *"so
  the strip reads like a hand fanned out to the right"*
  ([HeroDock.jsx:161](src/ui/components/dock/HeroDock.jsx:161)). Hovering lifts
  one clear of its neighbours; z-index is computed as
  `pinned > hovered > roster order`.
- **Motion.** Pinning mounts a body below a bottom-anchored column so the card
  grows upward — explicitly *"the 'pull the card up out of your hand' motion"*
  ([HeroDockCard.jsx:19](src/ui/components/dock/HeroDockCard.jsx:19)).
- **Naming.** `HeroDockCard`, `HeroDockTab`, `DOCK_CARD_BODY_H`, `cardTier`
  threading through `ReactRoot` → `BottomFolderDrawer`.

A pinned card's body is a Gear/Skills toggle over `DockEquipmentGrid` /
`DockSkillsGrid` — one at a time, because rendering both overflowed and clipped
the skill rows.

**⚠️ Found while verifying: the dock's recall drop target is dead.** It accepts
only payloads carrying `from.areaId`
([HeroDock.jsx:85](src/ui/components/dock/HeroDock.jsx:85)) and calls
`HeroAssignmentManager.unassignHero(areaId)` — both deck-loop concepts. The board
sends `from: { tile: index }`
([BoardTile.jsx:246](src/ui/components/board/BoardTile.jsx:246)), so `accepts()`
returns false and **dragging a deployed hero back to the dock silently does
nothing.** `areaId` appears nowhere else in `src/ui`. Recall currently works only
by *clicking* the hero on the tile. This is a live bug, not a refinement — it
should be fixed whether or not the dock is reworked.

### Direction

Heroes should read as people, not as playing cards.

### Touches

`HeroDock.jsx`, `HeroDockCard.jsx`, `HeroDockTab.jsx`, `dockConstants.js`,
`DockEquipmentGrid.jsx`, `DockSkillsGrid.jsx`. The `cardTier` prop chain into
`BottomFolderDrawer` sizing is entangled with this and will need untangling.

### Decisions this collides with

⚠️ **The fanned hand is a locked decision, not an accident.** The Hero Dock has
its own concept and roadmap with **12 locked decisions that override the concept
doc**, and the overlapping-hand behaviour, the float-over-the-play-area rule (D9)
and click-outside-to-unpin (D11) are among them. **The agent must read
`docs/archive/hero_dock_roadmap_v1.md`'s locked-decisions table before touching
this**, and the owner should expect to be explicitly overruling some of them.

### Open questions for the owner

- **Q5.1** What does "hero-flavoured" look like concretely — portraits in a
  roster row? Full-body sprites standing on a shelf? Something else?
- **Q5.2** Does the overlapping fan go, or only the card *chrome* (borders,
  tabs, header strip)?
- **Q5.3** Keep pin-to-expand as the way to reach gear and skills, or move that
  to a different surface entirely?

---

## R-6 — How heroes are displayed on the playmat

**Owner's words:** *"They're currently stacked on and invisible."*

### What it is now

**There is no hero art on the board at all.** A deployed hero is drawn as
`HeroBadge` ([BoardTile.jsx:242](src/ui/components/board/BoardTile.jsx:242)) — a
**text button carrying the hero's name**, 9px bold, `max-w-[80%] truncate`,
pinned to the tile's top-left corner on a solid `bg-gi-primary` chip.

It sits **on top of** the Token art, which is 96px filling most of the 128px
tile. So the owner's description is exactly right, and the reason is structural
rather than a styling slip: the hero and the Token are competing for one 128px
cell, and the hero was given a corner chip so the Token art could stay readable.

The badge is doing three jobs at once: identity (the name), the idle warning
(D-172's yellow glow lives on the badge, deliberately, *"because spotting idle
people is the main thing a returning player needs to do"*), and the drag handle
for tile-to-tile redeployment (D-134).

Related and already true: since Phase 7 a hero can stand on a **bare tile** with
no Token — a real, visible state that the board projects separately. That case
has the whole tile to itself and still shows only a name chip.

### Direction

Heroes should be visible and legible on the board.

### Touches

`BoardTile.jsx` (`HeroBadge`), `boardConstants.js` if the tile's internal layout
gains a hero region, and R-1's shared sprite component if heroes get one too.

### The real design problem, which the owner has to rule on

**A 128px tile cannot show a 96px Token and a legible hero sprite side by side.**
Something has to give, and each option breaks a stated rule:

| Option | Cost |
| :--- | :--- |
| Shrink the Token art to make room | Fights R-1's "one consistent size", and D-171's integer-scaling rule (96 → 64 is fine, 96 → 80 blurs) |
| Draw the hero over the Token, larger | Obscures the art that is the *only* means of identifying a Token — D-85 removed name labels precisely so the sprite could carry identity |
| Hero sprite in a corner, portrait-sized | Closest to today; may still read as small |
| Enlarge the tile | 7 × larger tiles from a 896px board — the board already fills the play area |

D-85 budgets a tile at exactly three things — Token art, hero, one alert mark —
so a bigger hero doesn't *add* clutter, it **reallocates** the budget away from
the Token. That is the trade, stated plainly.

### Open questions for the owner

- **Q6.1** Which of the four options above?
- **Q6.2** Does the hero's **name** stay on the tile, or move to hover/inspection
  now that a sprite would carry identity?
- **Q6.3** Should a hero on a *bare* tile be drawn differently (larger, since
  nothing competes) from one standing on a Token?

---

## R-7 — Essential board UI: what can take a Token, and what's missing

**Owner's words:** *"How does the player know what can have another token on it,
what's missing."*

### What it is now — two separate gaps

**Gap 1: legal placements are invisible until you're already dragging over one.**
The only cue is a ring on the tile the cursor is currently over — green valid,
red invalid ([BoardTile.jsx:150](src/ui/components/board/BoardTile.jsx:150)).
Because collision detection is `pointerWithin`, **at most one tile is ever
highlighted**. There is no at-a-glance map of where a Token could go, before or
during a drag. The only permanent rule visible anywhere is that the Guild Hall
refuses everything.

**Gap 2: "what's missing" is diagnosable only one tile at a time, by hover.** A
blocked tile shows a single 14px red dot in its top-right corner. Five distinct
causes collapse into that one dot — no inputs, hero unqualified, conflicting
contexts, no recipe, and D-133's `unstocked` — and the cause is revealed only in
the browser tooltip. The code states this as a deliberate choice:
*"there is no aggregate supply dashboard, so diagnosis happens tile by tile"*
([BoardTile.jsx:13](src/ui/components/board/BoardTile.jsx:13)).

Adjacency relationships have the same shape: `ConnectionLines` draws gold-solid
context links and blue-dashed buff links, **on hover only** (D-84).

### Direction

The player should be able to see where Tokens can go and what is blocking the
board, without interrogating tiles individually.

### Touches

`BoardTile.jsx`, `Board.jsx`, `ConnectionLines.jsx`, `DndKit.jsx` (a drag-active
signal the whole board can read), possibly a new overlay component.

### Decisions this collides with — the heaviest of any entry

This is the entry with the most decision pressure against it, and the agent must
be told all of it:

1. **Risk 7 — visual clutter killed the previous spatial playmat.** This is the
   single most-cited risk in the whole rework. Every mark added to a 48-tile
   board multiplies by 48.
2. **D-85 budgets a tile at exactly three things.** Name labels and charge
   counters were both built and then deleted — *"together they were 85 of the 128
   elements competing for the eye on a full board."*
3. **D-84 makes connection lines hover-only** for the same reason.
4. **D-114 explicitly rejects an aggregate supply dashboard.**

**The way through, and the agent should be pointed at it:** all four objections
are to *permanent, always-on* marks. **Transient, on-demand overlays cost
nothing when not invoked.** Two are already named in the codebase as the
sanctioned escape hatches:

- **A hold-to-reveal overlay** — `ConnectionLines.jsx:17` says outright: *"A
  hold-to-reveal overlay is the natural addition if that ever frustrates."*
- **A drag-active placement layer** — while a Token is in hand, every legal tile
  lights up; on release, the board is clean again. This adds zero resting
  clutter, and the player is already in a modal state.

Framed that way this is an **addition D-85 and D-84 anticipated**, not a
violation of them. A brief that omits this framing will get an agent that either
refuses the work or quietly breaks the clutter budget.

### Open questions for the owner

- **Q7.1** Placement affordance: light up every legal tile while dragging, or
  something shown before the drag starts too?
- **Q7.2** For "what's missing" — a board-wide overlay on a key-hold, a persistent
  side readout listing blocked tiles, or richer marks on the tile itself?
- **Q7.3** The alert cause is currently a **browser tooltip**, which is slow and
  unstyleable. Replace it with a real hover panel?

---

## R-8 — Inspection UI: when a Token's details appear, and what they look like

**Owner's words:** *"Inspection UI, when to show the details of a token and what
it looks like."*

### What it is now

`TokenInspection` renders inside `InspectionPanel`, a `w-80` column living at the
far edge of `BottomFolderDrawer`. It is opened by a **single click** on: a board
tile with a Token, a Tray slot, a Vault row's art, or a Cartographer entry.

Two problems, and the second is substantive:

**Where it appears is awkward.** `BottomFolderDrawer` renders whenever there is a
selection, even with no drawer pane open — in which case it takes its collapsed
form: `absolute bottom-0 w-80` at
`height: calc(100vh - 336px)`
([BottomFolderDrawer.jsx:74](src/ui/components/drawer/BottomFolderDrawer.jsx:74),
[:86](src/ui/components/drawer/BottomFolderDrawer.jsx:86)). So **clicking a Token
on the board throws a tall narrow column over the corner of the play area** —
inspection is structurally a *drawer* feature that the board borrows.

**⚠️ It shows the archetype, not the thing you clicked.** `TokenInspection` takes
a **`typeId`** and reads the registry definition
([TokenInspection.jsx:30](src/ui/components/drawer/TokenInspection.jsx:30)).
Every caller passes a type id, so inspecting a specific, placed, half-spent Token
shows `def.uses` — the *type's* starting charges — and cannot show:

- this instance's `usesRemaining` (hover tooltip only)
- which recipe it is *currently* resolving
- why it is alerting
- which neighbours are actually feeding it

Those are precisely the questions a player has about a Token **on the board**,
and they are the questions the panel cannot answer. The panel is well-suited to
its original job — planning *before* placement, which is what D-145 argues for —
and unsuited to inspecting live board state. **That is the gap: there is no
instance-level inspection anywhere in the game.**

This overlaps R-7 directly: "what's missing on this tile" is an instance
question, and the alert dot's tooltip is currently the only answer.

### Direction

Not yet specified beyond "when to show details, and what it looks like."

### Touches

`TokenInspection.jsx`, `InspectionPanel.jsx`, `BottomFolderDrawer.jsx`,
`BoardTile.jsx` (the click handler), `useUIModals.js` (`inspect` selection
shape — it would need to carry a tile index, not just a type id).

### Open questions for the owner

- **Q8.1** Should board inspection be **instance-level** (this Token, on this
  tile, right now) rather than type-level? *My recommendation: yes — it is the
  missing half, and it answers R-7's "what's missing" at the same time.*
- **Q8.2** Where does it appear from the board — the existing bottom column, a
  floating panel near the tile, or a fixed side panel?
- **Q8.3** Is single-click still the trigger? It currently competes with
  double-click-to-burst on Maps and with the 8px drag threshold.
- **Q8.4** Does the type-level sheet stay as-is for the Tray, Vault and
  Cartographer (planning contexts), with a separate board sheet — or should one
  component do both?

---

## Register

| # | Mechanic | Direction given? | Ready to brief? |
| :--- | :--- | :--- | :--- |
| R-1 | Token object consistency across all surfaces | Yes | **✅ Done** — D-215…D-222 |
| R-9 | The Tray as loose objects, not a grid | Yes | **Spec approved** — D-223…D-229, [`tray_loose_objects_intent.md`](tray_loose_objects_intent.md) |
| R-2 | Drop presentation + particle fly to the Bank | Yes | **✅ Done** — D-232…D-236 |
| R-3 | Item / Token / Map bank drawers | Yes | **✅ Done** — D-238…D-247, [`bank_drawer_intent.md`](bank_drawer_intent.md) |
| R-4 | Playmat column order | Yes | **✅ Done** — D-237, four columns |
| R-5 | Hero Dock — less card, more hero | Yes | After Q5.1–5.3 |
| R-6 | Heroes on the playmat | Yes | After Q6.1–6.3 |
| R-7 | Board UI — placement + blockage legibility | Yes | After Q7.1–7.3 |
| R-8 | Inspection UI — when and what | Partial | After Q8.1–8.4 |

### Bugs found while verifying — not refinements

| Bug | Where | Effect |
| :--- | :--- | :--- |
| Dock recall target keyed to the retired `areaId` | [HeroDock.jsx:85](src/ui/components/dock/HeroDock.jsx:85) | Dragging a deployed hero back to the dock does nothing |
| Particle overlay gated on `cardId`; board loot has none | [ParticleOverlay.jsx:51](src/ui/components/base/ParticleOverlay.jsx:51) | No loot particles on the board at all |
| Loot "arc" documented but not implemented | [SpriteLayer.js:20](src/systems/board/SpriteLayer.js:20) | Loot materialises in place; docs mislead |
| Token art sizes hardcoded across six files | R-1's table | Breaks `boardConstants.js`'s no-hardcoding rule |

*More entries to be added as the owner names them.*
