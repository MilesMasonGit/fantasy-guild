# R-1 — Tokens as Physical Objects: Intent Spec

**Status: awaiting approval.** No code has been written. This document records what
the owner decided across four interview rounds on 2026-08-07 and what each choice
was made *against*, in the style of [`playmat_decisions.md`](playmat_decisions.md).
Numbering continues from D-214.

**Source brief:** [`token_object_brief.md`](token_object_brief.md) ·
**Register entry:** R-1 of [`playmat_refinement_briefs.md`](playmat_refinement_briefs.md) ·
**Phase:** 10 of [`playmat_roadmap_v1.md`](playmat_roadmap_v1.md) ·
**Branch:** descends from `playmat-7x7-build`.

---

## The one-sentence version

A Token is **one object**, drawn by **one component**, at **128px when it is in play
and 64px when it is in storage**, with **no frame on any surface** and the **same
contact shadow everywhere** — and the two things that used to distinguish surfaces,
the ghost's bloom and the loot sprite's ring, are replaced by *behaviour* rather
than by chrome.

---

## What was found while verifying — and it changes the premise

Two facts, both checked against the code rather than the design docs. The brief's
§4 was written from the placeholder art and is wrong on the first one.

**F-1 — Token source art is 64×64, not 32×32.**
[`.agent/skills/Artist/SKILL.md:39`](.agent/skills/Artist/SKILL.md:39) states the
pipeline: **32×32 = Items, 64×64 = Tokens**, "playmat tokens" named explicitly.
Fifteen finished 64×64 Token sprites already exist in `public/assets/tokens/`.
Nothing loads them — `tokenSpritePath()`
([tokenRegistry.js:642](src/config/registries/tokenRegistry.js:642)) hardcodes
`/assets/skills/`, and every `sprite:` value in the registry is a `skill_*`
placeholder. Corroborating evidence: the 24 authored floor tiles in
`public/assets/playmat/tiles/` are natively **128×128**, so the tile grid was always
128 and only the Token art was undersized.

**F-2 — Eight components render Token art, at six different sizes, and every one of
them is illegal against a 64px source.**

| Surface | Art size today | ÷ 64 | Source |
| :--- | ---: | :--- | :--- |
| Board tile | 96 | 1.5× ✗ | [BoardTile.jsx:177](src/ui/components/board/BoardTile.jsx:177) |
| Tray slot | 40 | 0.625× ✗ | [Tray.jsx:158](src/ui/components/board/Tray.jsx:158) |
| Drag ghost, bold | 96 | 1.5× ✗ | [DragGhost.jsx:77](src/ui/dnd/DragGhost.jsx:77) |
| Drag ghost, compact | 40 | 0.625× ✗ | [DragGhost.jsx:62](src/ui/dnd/DragGhost.jsx:62) |
| Floor sprite | 36 | 0.5625× ✗ | [SpriteLayerView.jsx:116](src/ui/components/board/SpriteLayerView.jsx:116) |
| Vault row | 32 | 0.5× (exact halving) | [TokenVaultTab.jsx:129](src/ui/components/drawer/TokenVaultTab.jsx:129) |
| Cartographer pool chip | 22 | 0.34× ✗ | [CartographerTab.jsx:157](src/ui/components/drawer/CartographerTab.jsx:157) |
| Inspection header | 48 | 0.75× ✗ | [TokenInspection.jsx:47](src/ui/components/drawer/TokenInspection.jsx:47) |

The brief listed six surfaces. There are eight. **The seventh and eighth had already
drifted before anyone counted**, which is the argument for a shared component stated
better than the brief could state it.

---

## The decisions

### D-215 — "Consistent" means the same object at each surface's own whole-number scale, not identical pixels.

Identical framing, identical proportion, identical contact shadow, everywhere. The
**size** follows the surface.

*Why:* literally identical pixels is arithmetically impossible without breaking a
surface. At 128px a 20-slot Tray drops to one column; at 64px the board tile
surrenders half the presence D-171 bought with an 896px board. The object can be
unmistakably the same thing without being the same number of pixels — a piece is
bigger on the table than it is in the box, and nobody mistakes it for a different
piece.

*Chosen against:* **identical pixels everywhere** (rejected: one end of the lifespan
always pays, and the owner saw both failure modes rendered at true size); and
**identical in play, smaller in storage only** (rejected: it draws the seam in the
wrong place — the Vault is not the odd one out, the board is).

---

### D-216 — Token source art is 64×64 and Item source art is 32×32. This amends D-171.

A general rule, not a per-asset judgement.

*Why:* it is what the art pipeline already specifies and what the finished art
already is (F-1). Sizing the UI against the placeholder icons would have committed
the game to downsampling art already paid for, permanently halving the resolution of
every Token on the board — the game's single most-looked-at surface.

*Amends D-171,* which reads *"Tokens render at 4× — 32px art at 128px per tile."*
Its premise is wrong for Tokens; **every one of its conclusions survives.** The tile
is still 128px, the board is still 896px, integer scaling is still required. The
arithmetic becomes **64px art at 2×**. D-171 is amended, not overturned.

*Consequence:* the legal Token sizes are **64, 128 and 192**. There is nothing in
between, and 96 — the board's size since Phase 1 — is not among them.

---

### D-217 — Two sizes: 128px in play, 64px in storage.

| Surface | Size | Scale |
| :--- | ---: | :--- |
| Board tile | **128** | 2× |
| Carried (drag ghost) | **128** | 2× |
| Loose on the floor | **64** | 1× |
| Tray slot | **64** | 1× |
| Vault row | **64** | 1× |
| Inspection header | **64** | 1× |

*Why:* one sentence describes the whole system — *128 when the player is handling it
or it is in play, 64 when it is stored or not yet picked up* — and both numbers are
clean multiples of 64. Making the floor and the rack the same size means a Token
grabbed off the ground and one pulled from the Tray are identical objects, which is
the point of the exercise.

*Chosen against:* **a wider Tray so it could show 128px** (rejected: ~75px taken from
a board width D-171 spent deliberately, and it collides head-on with R-4);
**Vault at 32px** (rejected: it adds a third size to a system being simplified, and
halving discards every other pixel).

**D-217a — Dense catalogue listings are a recorded exception at 32px.**
The Cartographer's pool chips only. A Map pool wraps up to 29 entries, and 64px chips
would make that listing roughly three times taller inside a drawer pane that **R-3
is going to rework anyway**. 32px is an exact halving of the source — crisp, but
lossy. This is an exception on the record, not a drift: it goes through the shared
component like everything else.

---

### D-218 — The board tile's art fills the tile edge to edge. No margin.

128px art in a 128px tile.

*Why:* it is the only legal size that keeps the board's presence, and it makes the
Token unambiguously *the thing on the tile* rather than a picture printed on a cell.

⚠️ *Three costs, accepted with the owner having seen them rendered on twelve real
tiles:* adjacent Tokens now touch with no ground between them; the 24 authored floor
tiles are almost entirely hidden wherever a Token sits; and the progress ring, the
red alert dot and the hero chip now sit **on artwork** rather than beside it.

*The third cost is handed on, not solved here.* D-172 says spotting idle heroes is
the main thing a returning player does, and D-85 caps the tile at three marks.
Legibility of those marks against busy art belongs to **R-6** (heroes on the playmat)
and **R-7** (blockage legibility). R-1 must not quietly grow the tile's mark budget.

*Chosen against:* **a 160px tile** so ground shows around each Token (rejected: a
1120px board overturns D-171's locked geometry and lands on top of R-4); and
**fixing overlay legibility inside R-1** (rejected: it is R-7's work and D-85's
budget is exactly what gets argued over when marks start growing).

---

### D-219 — No frame on any surface. The art is the object.

Every border, ring and panel background around Token art is removed: the Tray slot's
`rounded border bg-gi-surface/70`, the drag ghost's `bg-black/45 ring-2
ring-white/50`, and the loot sprite's `ring-2 ring-gi-primary/70 bg-black/50`.

*Why:* this is the owner's original complaint stated exactly. A frame that appears
and vanishes three times during one pick-up-and-place is the single clearest way the
current build says *these are cells, not objects* — the thing D-143 exists to
prevent.

⚠️ *Accepted cost on the Tray:* the slot frame was a **capacity affordance**, not
decoration. With it gone, a part-full rack leans entirely on the `n / 20` header and
the regular grid spacing to read as storage rather than as scattered clutter. **The
owner chose this over moving the frame to empty sockets, having seen a half-full rack
drawn all three ways.** If it reads as clutter in play, restoring a recessed socket
on *empty* slots only is the one-line fix and does not disturb anything else here.

*Chosen against:* **frames on every slot** (rejected: it is the inconsistency that
started the brief); **frames on empty slots only** (rejected by the owner, though it
was the recommendation, and it stays on the shelf as the named fallback).

---

### D-220 — Bloom is retired. The carry is 128px throughout, and lift is expressed as shadow and offset.

*This reverses the owner's own 2026-07-15 "bloom on cross-over" decision, deliberately
and with the alternatives seen side by side in motion.*

The carried Token does not change size at any point during a drag. Picking it up
raises it: the contact shadow **grows, softens and separates** from the art, and the
art itself offsets a few pixels upward. Setting it down reverses that.

*Why:* "the object does not resize while it moves" was one of the four things the
owner named as making something feel physical, and bloom is flatly incompatible with
it. Shadow-and-offset is what a real object does when lifted off a table, so it
delivers the *weight* the bloom was reaching for without touching the pixel grid.

⚠️ *A "slight" scale-up was asked for and cannot be given.* From a 64px source there
is no size between 128 and 192. A ~1.1× lift is off the pixel grid, producing the
uneven doubled-pixel render — on the one object the player is looking at most
closely. This was demonstrated, not asserted.

*Chosen against:* **192px while carried** (rejected: legal and crisp, but 50% larger
blankets the drop target and its neighbours); **fractional scaling during motion
only** (rejected: it writes an exception into the rule on day one, at the moment of
closest inspection); **keeping bloom** (rejected: it would have overturned the owner's
own Round 1 answer).

*Consequence:* the resize does not vanish, it **relocates to the ends**. The floor is
64px and the carry is 128px, so a Token grows at the instant it is grabbed off the
ground and shrinks at the instant it is released into the Tray. Two instant snaps
bracketing a perfectly steady carry. This is intended and was stated before it was
agreed.

*Also closes* the ⚠️ note at [`DragGhost.jsx:24`](src/ui/dnd/DragGhost.jsx:24) — the
ghost frame *"still sized to the retired banner tiers"*, which Phase 2 was meant to
point at `TILE_PX`. The box was updated; the image inside never was. Part of this
work is unfinished Phase 2, not new design.

---

### D-221 — On the floor, items hover and Tokens sit still. This replaces the sprite ring.

A loose **item** floats above the board with a separated shadow. A loose **Token**
rests on it, with the same contact shadow it will have once placed.

*Why this is better than a mark:* it is not a convention the player has to learn, it
is a statement about what each thing *is*. `playmat_ui_concept.md` §6 already
describes items as *"floating sprites above the grid"* that *"occupy no tile"* (D-40)
— an item hovers because it is not on the board and never will be; a Token rests
because resting on the board is the entire point of a Token. It also costs **zero
resting clutter**, which is the only kind of addition Risk 7 permits, and it delivers
the physicality-in-motion the owner named in Round 1.

*This is a required replacement, not a deletion.* D-158 gives the two sprite kinds
genuinely different gestures — drag a Token to a tile, click an item to collect —
and D-217 sets both to 64px, so **size can no longer separate them.** Removing the
ring without replacing it would have made the two gestures indistinguishable.

*Chosen against:* **keeping the ring** (rejected: it is a box around the art on one
surface only); **a glow on the ground beneath Tokens** (rejected, though it was the
recommendation — and note it would have needed a neutral colour anyway, because
D-172 reserves red for *stuck* and yellow for *idle*, and a gold pool would have
muddied both).

⚠️ *Watch:* a Map burst yields 3–6 things (D-167), so up to six hovering items at
once. If that reads as busy rather than alive, the hover amplitude is the dial.

---

### D-222 — One `<TokenSprite>` component, and every size derives from `ART_PX`.

All eight call sites route through a single component. No component states a pixel
size; each names a **surface**, and the component resolves it.

*Why:* [`boardConstants.js:29`](src/ui/components/board/boardConstants.js:29) already
requires that *"nothing may hardcode 128"* so a future small mode is a config change
rather than a layout rewrite. Every size in F-2's table is a bare literal unrelated
to `ART_PX` or `TILE_SCALE` — which is precisely how surfaces seven and eight drifted
without anyone noticing. Sizes become `ART_PX × scale`, with `ART_PX = 64`.

*Chosen against:* leaving the two surfaces the brief missed alone (rejected: they
would keep provably wrong sizes *and* stay outside the shared component — the exact
failure this work exists to stop).

---

## Explicitly out of scope

| Thing | Why, and who owns it |
| :--- | :--- |
| **Wiring up the real 64×64 Token art** | The brief puts sourcing art out of scope. The 15 sprites in `public/assets/tokens/` stay unwired and the `skill_*` placeholders stay. **This work is sized for the real art and verified with the placeholders.** Flagged as its own job. |
| **Alert-dot / progress-ring legibility over full-bleed art** | D-218's accepted cost. Belongs to **R-7**, and to **R-6** for the hero chip. |
| **Loot arcs, landing bounce, particle fly to the Bank** | **R-2**. R-1 changes the floor sprite's *size and resting behaviour* only — not its animation or its collection logic. |
| **`HeroBadge` and hero rendering** | **R-6**. Shared file (`BoardTile.jsx`), untouched code. |
| **The Cartographer pane's layout** | **R-3**, which has no direction yet. R-1 only routes its chips through the shared component at the D-217a size. |

---

## Implementation slices

One coherent chunk per session, verified and committed at the end of each.

| # | Slice | Touches |
| :--- | :--- | :--- |
| **1** | `ART_PX = 64`, surface scale table, and the `<TokenSprite>` component. Nothing consumes it yet. | `boardConstants.js`, new `TokenSprite.jsx` |
| **2** | Board tile and drag ghost — 128px, frames removed, lift becomes shadow + offset. | `BoardTile.jsx`, `DragGhost.jsx` |
| **3** | Tray, Vault, inspection header, Cartographer chips — 64px / 32px, frames removed. | `Tray.jsx`, `TokenVaultTab.jsx`, `TokenInspection.jsx`, `CartographerTab.jsx` |
| **4** | Floor sprites — 64px, ring removed, items hover and Tokens rest. | `SpriteLayerView.jsx`, `tailwind.css` |
| **5** | Docs: R-1 status, Phase 10 status table, `CHANGELOG.md`, and the D-171 amendment in `playmat_decisions.md`. | docs only |

**Verification standard** for every slice: `npm test`, then run the game and drag a
Token through its whole lifespan — floor → carry → tile → lift → Tray → Vault —
reporting what was observed. Known traps: screenshots time out (probe `window.Game` /
`window.GameState` instead), and `requestAnimationFrame` does not fire in a
non-compositing tab, which affects both the drag layer and the particle canvas.

---

## Open questions for the owner

None. Four rounds closed every one. **Approve this document and slice 1 begins.**
