# Brief: Make Tokens Feel Like Physical Objects

**This is R-1 of [`playmat_refinement_briefs.md`](playmat_refinement_briefs.md).**
Read that entry, then this document.

---

## 1. What you are being asked to do

**Interview first. Do not write code yet.**

The owner has a clear feeling about what is wrong and has not yet articulated the
design intent behind it. Your first job is to extract that intent through
**several rounds of structured interview**, and only then to build.

The sequence is:

1. **Interview the owner across multiple rounds** (§7) until their intent is
   fully specified.
2. **Write it down** as a short intent spec, and get explicit approval.
3. **Then implement**, in the small slices the owner prefers, committing at the
   end of each.

**Do not collapse these.** Do not offer an implementation in round one, and do
not begin editing components because an answer seemed obvious. The owner has
asked for interviews *specifically* because the intent is not yet pinned down —
guessing it correctly would still be guessing.

---

## 2. How to work with the owner

* **They don't code.** Explain everything in plain language — file layout,
  architecture, git. Say what a thing does and why, not just its name.
* **Ask, don't assume — as multiple choice.** Give labelled options with the
  trade-offs spelled out and your recommendation first. Never open-ended, never a
  guess. This is the single most important instruction in this document, because
  the whole task is asking questions.
* **Challenge them.** Point out contradictions with what's already decided and
  gaps they haven't noticed. They have said repeatedly that this is the most
  valuable thing an agent does for them. Do not simply agree.
* **Verify before saying something is true.** The design documents contain claims
  about the codebase that were written from memory and are not all accurate.
  Several are wrong in ways that matter to *this* task — see §4.
* **Work in small slices**, one coherent chunk per session, committed at the end.
* **Suggest commits; don't commit without asking.**

---

## 3. Read these first, in this order

| Document | What it is | Why it matters here |
| :--- | :--- | :--- |
| [`playmat_refinement_briefs.md`](playmat_refinement_briefs.md) | The improvement register this brief comes from | R-1 is your entry. R-2 and R-6 touch the same components — read them so you don't fight work that is coming. |
| [`playmat_decisions.md`](playmat_decisions.md) | The reasoning behind every D-nn, running to D-214 | **D-143, D-171, D-85, D-158** are the ones that bind you. Read what each was chosen *against* before proposing anything that touches it. |
| [`playmat_ui_concept.md`](playmat_ui_concept.md) | Layout, the tile, feedback, interaction | §5 is "Tokens are weighty physical objects" — the owner's existing words for what they are now asking for. Start here for vocabulary. |
| [`playmat_grid_concept.md`](playmat_grid_concept.md) | The board, Tokens, adjacency, economy | Background. §13 is risks; risk 7 is the clutter risk that shapes everything visual. |
| [`playmat_roadmap_v1.md`](playmat_roadmap_v1.md) | The authoritative plan; its status table logs every phase's verification | This work belongs to **Phase 10 — Polish, Clutter & the First Balance Pass**. Update the status table as you go. |

### ⚠️ Documentation trap

**`docs/archive/` is misleadingly named.** `playmat_rework_concept_v1.md` and
`playmat_rework_roadmap_v1/v2/v3.md` document the **Area Deck Loop** — the system
this rework *replaced*. They are not about the 7×7 playmat despite the filenames.
Do not read them as current design.

---

## 4. The verified problem

This section was checked against the code, not the docs. **You may rely on it**,
but re-verify anything you are about to change — the branch moves.

### 4.1 One Token, six components, five art sizes

| Surface | Frame around the art | Art size | Source |
| :--- | :--- | ---: | :--- |
| Board tile | none (transient drag ring only) | **96px** | [BoardTile.jsx:177](src/ui/components/board/BoardTile.jsx:177) |
| Tray slot | permanent — `rounded border bg-gi-surface/70` | **40px** | [Tray.jsx:144](src/ui/components/board/Tray.jsx:144), [:158](src/ui/components/board/Tray.jsx:158) |
| Drag ghost, over the board | `rounded-md bg-black/45 ring-2 ring-white/50` + shadow, in a `TILE_PX` box | **96px** | [DragGhost.jsx:68](src/ui/dnd/DragGhost.jsx:68), [:77](src/ui/dnd/DragGhost.jsx:77) |
| Drag ghost, over a drawer | none, in a 48px box | **40px** | [DragGhost.jsx:62](src/ui/dnd/DragGhost.jsx:62) |
| Loot sprite on the floor | `ring-2 ring-gi-primary/70 bg-black/50`, 44px box | **36px** | [SpriteLayerView.jsx:104](src/ui/components/board/SpriteLayerView.jsx:104), [:116](src/ui/components/board/SpriteLayerView.jsx:116) |
| Token Vault row | list row, no frame | **32px** | [TokenVaultTab.jsx:129](src/ui/components/drawer/TokenVaultTab.jsx:129) |

The lived sequence for one Token is: 36px ringed on the floor → 40px bare while
dragged over the Tray → 96px framed over the board → 96px bare once placed →
40px framed in the Tray. **The frame appears and vanishes three times in a single
pick-up-and-place.**

### 4.2 ⚠️ Two of those sizes are currently blurry, and this is the strongest fact you have

**Token source art is 32×32 pixels** — verified by reading the PNG headers in
`public/assets/skills/`. (Token art currently resolves to placeholder *skill*
icons via `tokenSpritePath()`,
[tokenRegistry.js:642](src/config/registries/tokenRegistry.js:642); real Token art
is outstanding, but the 32px grid is the pipeline's.)

Against a 32px source:

| Rendered at | Scale | Verdict |
| ---: | :--- | :--- |
| 128px (tile) | 4× | ✅ crisp |
| 96px (board, bold ghost) | 3× | ✅ crisp |
| 32px (Vault) | 1× | ✅ crisp |
| **40px (Tray, compact ghost)** | **1.25×** | ❌ **fractional — blurred** |
| **36px (floor sprite)** | **1.125×** | ❌ **fractional — blurred** |

[`boardConstants.js:23`](src/ui/components/board/boardConstants.js:23) states the
rule: *"Integer scaling is required, not preferred: the art is pixel art and
fractional scaling blurs it."*

**So this is not only an inconsistency — two surfaces are rendering incorrectly
today.** It also usefully constrains the answer space: any size the owner
chooses must come from **{32, 64, 96, 128}**. Bring this to the interview as a
constraint, not an option.

### 4.3 Every size is a hardcoded literal

`boardConstants.js:29` says *"Nothing may hardcode 128"*, so a future small mode
is a config change rather than a layout rewrite. Every `96`, `40`, `36` and `32`
above is a bare literal with no relationship to `ART_PX` or `TILE_SCALE`. Whatever
the owner decides, **the sizes must end up derived from one place** — otherwise a
seventh surface will drift again, exactly as the sixth did.

### 4.4 A ⚠️ note in the code that was never acted on

[`DragGhost.jsx:24`](src/ui/dnd/DragGhost.jsx:24) says the ghost frame is *"still
sized to the retired banner tiers"* and that Phase 2 should point it at
`TILE_PX`. The bold **box** was updated; the **image inside it** was not. Some of
what you are fixing is unfinished Phase 2 work, not new design.

---

## 5. What is already decided — do not re-litigate

**D-143 is on the owner's side, and you should say so early.** It already asks
that Tokens *"read as solid objects resting on a surface, not cells in a
spreadsheet."* The board tile honours this; nothing else does. **This task
completes D-143 rather than changing it.** If you frame the work as a design
change you will hedge unnecessarily and waste the owner's time.

**D-171 fixes the board's geometry**: 32px art at 4×, 128px tiles, 896px board,
integer scaling required. The board tile's scale is not in question.

**D-85 budgets a tile at exactly three things** — Token art, the hero on it, one
alert mark. Name labels and charge counters were both built and then deliberately
deleted: together they were 85 of the 128 elements competing for the eye on a
full board. **Do not reintroduce a label to help identification**, however
tempting it is while the art is placeholder.

**Risk 7 — visual clutter killed the previous spatial playmat.** Anything you add
multiplies by 48.

---

## 6. The four tensions you must surface — and must not resolve alone

The owner's stated goal ("look like objects, consistent throughout the lifespan")
collides with four things that are in the code **on purpose**. Each has a
justification recorded in a comment or a decision. Your interview must put each
one to the owner explicitly, with what it would cost to override.

1. **The Tray's frame is a slot affordance, not decoration.** It marks a rack of
   slots with a capacity count (`n / 20`). Remove every border and a part-full
   Tray may read as loose clutter rather than storage. *Likely resolution: the
   frame moves from the Token to the slot behind it — but that is the owner's
   call, not yours.*

2. **The ghost's changing size IS a designed feature.** "Bloom on cross-over" is
   an owner decision from 2026-07-15: the ghost visibly changes as it crosses
   from drawer to board, so you can see what you are carrying is the size of the
   hole it is going into. **Constant size and bloom are mutually exclusive.** One
   must give, and the owner must choose which.

3. **The loot sprite's ring carries information, not style.** A ringed sprite is
   a *Token* (drag it to a tile); an unringed one is an *item* (click to
   collect) — two genuinely different gestures, per D-158. Flatten them and the
   distinction disappears. A **replacement cue is required**, not merely a
   deletion.

4. **"Consistent size" may not mean "identical pixels".** A Token on a 128px
   board tile and a Token in a 20-slot rack cannot both be 96px without one of
   the two surfaces breaking. The owner may mean *the same object, rendered at
   each surface's scale, with identical framing and proportion* — which is
   achievable everywhere. **Establish which they mean in round one**; almost
   everything else depends on the answer.

---

## 7. How to run the interviews

**Several rounds, each narrowing.** A suggested shape — adapt it, but keep the
narrowing:

* **Round 1 — the principle.** What does "feels like an object" mean to them?
  Weight, shadow, consistent silhouette, the way it moves, all of these? Settle
  tension 4 above: identical pixels, or same object at each surface's scale?
  Nothing about specific components yet.
* **Round 2 — the lifespan.** Walk the actual journey with them (floor → drag →
  tile → lift → Tray → Vault) and establish what should be constant at each step
  and what may legitimately change. Settle the ghost/bloom tension.
* **Round 3 — the frames.** Slot affordance, sprite ring, ghost frame: which
  survive, which move, what replaces the ones that go.
* **Round 4 — the numbers.** Which of {32, 64, 96, 128} at each surface, and how
  they derive from a single constant.

**Rules for every round:**

* **Multiple choice with a recommendation first.** Never an open question.
* **Show, don't only describe.** The owner is deciding something visual. Where a
  choice is hard to picture, build a throwaway comparison they can look at rather
  than asking them to imagine it. Verify it renders (§9) before showing it.
* **One topic per round.** Do not bundle four decisions into one message.
* **Feed answers back.** Open each round by restating what you understood from
  the last one, so a misread is caught early rather than built on.
* **Stop when it's settled, not when you have enough to start.** If a round
  produces a surprise, add a round.

---

## 8. Deliverables

1. **An intent spec** — a short document capturing what the owner decided and
   why, in the style of `playmat_decisions.md` (numbered, each recording what it
   was chosen *against*). New D-numbers continue from D-214. **Get explicit
   approval on this before writing code.**
2. **The implementation**, in small slices. Expect a shared `<TokenSprite>`
   component so a seventh surface cannot drift — but let the interviews confirm
   that shape rather than assuming it.
3. **Updates to** `playmat_refinement_briefs.md` (R-1's status),
   `playmat_roadmap_v1.md` (Phase 10's status table), and `CHANGELOG.md` under
   `## [Unreleased]`.

**Out of scope — flag if you spot it, don't fold it in:**

* **R-2's loot presentation and particle wiring.** You share
  `SpriteLayerView.jsx` with it. Change the sprite's *size and framing*; leave
  its animation and collection behaviour alone.
* **R-6's hero rendering.** You share `BoardTile.jsx`. Do not touch `HeroBadge`.
* **Sourcing real Token art.** Placeholder skill icons stay; you are fixing how
  art is presented, not what it is.

---

## 9. Verification — read this before you try to check your work

The owner's standard, from `CLAUDE.md`: run `npm test`, and for anything visible
on screen, run the game and **actually exercise it**, reporting *what you
observed* rather than that code was written. For this task that means dragging a
Token through its whole lifespan, not just loading the page.

⚠️ **The verification traps in this project are cumulative and cost real time.**
Four are known:

* **Screenshots time out.** Probe the running game through `window.Game` /
  `window.GameState` instead; a dynamic `import()` does not work.
* **`requestAnimationFrame` never fires in a non-compositing browser tab**, and
  the nav bubbles defer opening by one frame — so **every bubble looks dead**
  under automated checks until you shim rAF inline. This will bite you: the
  drag layer and the particle canvas both run on rAF.
* See the roadmap's **"Standing Checks"** section for the full list before you
  start, not after something looks broken.

⚠️ **Engine tests pin content values.** `TokenCycle.test.js` and
`AdjacencyEffects.test.js` assert specific yields and item ids from the shipped
token registry. You are unlikely to trip them with a rendering change, but if
tests fail in a way that looks unrelated to your edit, this is why.

---

## 10. Rules of engagement

* **Flag and ask; never decide.** Anything not already in `playmat_decisions.md`
  goes back to the owner as multiple choice. Anything that *contradicts* it is
  flagged **as a contradiction** — do not quietly work around a locked decision.
* **Don't re-litigate the decisions log.** If you think something in it is wrong,
  say so plainly and say why, then let the owner rule.
* **Stay in scope** (§8).
* **Version numbers live in five files** and are bumped together:
  `package.json`, `package-lock.json`, `src-tauri/tauri.conf.json`,
  `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`. Current version is **0.5.0**;
  save schema is **0.6.0**.
* **Branch:** work descends from `playmat-7x7-build`. Do not implement on `main`.
