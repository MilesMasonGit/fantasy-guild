# Concept: Playmat UI

How the board is presented and operated. This document owns **layout, the tile, feedback, and interaction**.

It does not own game rules. Where a rule has a visual consequence — moving a Token forfeits its cycle, a starved Token stops working — the rule lives in [`playmat_grid_concept.md`](playmat_grid_concept.md) and this document describes only how the player sees and triggers it.

Reasoning for every decision ID (D-nn) is in [`playmat_decisions.md`](playmat_decisions.md).

> **Status:** the structural rules are settled. Exact proportions, pixel scale and the Hero Dock's ergonomics are open — see §7.

---

## 1. The Problem This Solves

The previous spatial playmat was abandoned for three reasons: **visual clutter, drag-and-drop friction, and layout micromanagement.** Those objections were not obsolete, and this board carries *more* per-tile information than the one that failed.

Every decision here answers one of them:

| Objection | Answer |
| :--- | :--- |
| Visual clutter | §3 caps the tile at three things. §4 keeps connection lines off until hover. |
| Drag-and-drop friction | §2's Tray makes the Bank→board flow possible at all. §5 keeps common actions to one drag. |
| Layout micromanagement | Moving a Token or hero forfeits its cycle, so fiddling costs throughput. |

---

## 2. Screen Layout

The board dominates the screen. Two things are permanently visible beside it:

```
┌────────────────────────────────────┐
│  ● ● ●  nav bubbles                │
│                          ┌───────┐ │
│      7 × 7  BOARD        │ TRAY  │ │
│      (48 usable tiles)   │ ~25%  │ │
│                          └───────┘ │
├────────────────────────────────────┤
│  HERO DOCK — the roster            │
└────────────────────────────────────┘
```

* **The Tray** takes roughly a quarter of the screen and is permanent (D-107).
* **The Hero Dock** runs along the bottom and holds unplaced heroes. It is also where jobs, skills and equipment are managed (D-76).
* **The Token Bank, item Bank and Cartographer menu overlay the board** when opened.

**The Tray is load-bearing, not decorative.** Because an open Bank covers the board, Tokens cannot be dragged from Bank to tile directly. The flow is **Bank → Tray → Board**: pull Tokens into the Tray, close the Bank, place from the Tray onto the visible board. Remove the Tray and placement stops working.

### Scale
**Token sprites are 32px art displayed at 4× — 128px per tile** (D-171). That gives a **896px board**, comfortably the dominant element beside a ~25% Tray.

Integer scaling is required, not preferred: the art is pixel art, and fractional scaling would blur it.

**A "small mode" viewport handles smaller windows**, rendering shrunk sprites so the whole board still fits. Full fidelity is the 4× view; small mode is the accommodation.

*Exact proportions of the surrounding panels are still open (§7).*

---

## 3. The Tile

A tile shows **exactly three things, always** (D-85):

| Always visible | On hover / selection |
| :--- | :--- |
| Token art, and the hero on it **drawn as their job** (D-75) | What the alert mark refers to |
| A **progress ring** for the current cycle | Uses remaining |
| **One alert mark** if anything is wrong | Connection lines and the active recipe |

### One Mark, Not Several
Several distinct conditions can stop a Token — no inputs, a context conflict, a depleted neighbour. They all collapse into **a single "look at me" mark**, with the cause revealed on hover.

This is the difference between a board that is diagnosable and one that is a wall of competing icons. It also repairs a deliberate silence elsewhere in the design: supply shortfall degrades throughput without any animation change, so without the mark a struggling board would look identical to a healthy one.

### An Alert Means "Staffed But Stuck"
**An unstaffed Token is not an error** (D-149). With around 8 heroes on 48 tiles, the overwhelming majority of the board is unstaffed at any moment — flagging all of it would make the alert mark meaningless.

The rule: **an alert appears only when a Token has a hero on it and still cannot work.**

| State | Shows |
| :--- | :--- |
| No hero | Quietly dimmed. No alert. |
| Hero present, inputs missing | **Red alert mark**; hover says what's missing and by how much (D-114). |
| Hero present, context conflict | **Red alert mark**; hover explains the conflict. |
| Hero present, below skill requirement | **Red alert mark**; hover names the requirement. |
| In combat | Progress ring tracks the current fight — one kill is one cycle (D-129). |
| Depleted | The Token is gone. The tile is empty; any hero on it stands idle. |

This keeps alerts rare enough to mean something. A board with three red marks has three real problems; a board with none is healthy even if half its tiles are dark.

### Two Alert Colours, Two Meanings
An idle hero — standing on an emptied tile with nothing to do — is a **wasted person**, not a broken Token. It is a different problem with a different fix, and on an unattended board it is the most actionable thing there is.

It gets its own mark and its own colour (D-172):

| Mark | Means | Fix |
| :--- | :--- | :--- |
| 🔴 **Red** on a Token | Staffed but stuck — no inputs, conflict, or hero unqualified | Fix the supply or the layout |
| 🟡 **Bright yellow** on a hero | This person has nothing to do | Move them, or restock their tile |

**Two colours, two vocabularies, no overlap.** The yellow mark lives on the *hero*, not the tile, so it costs nothing against the tile's information budget — and it should be designed to stand out hard, because spotting idle people is the main thing a returning player needs to do.

**There is no aggregate supply dashboard.** Diagnosis is tile by tile. On 48 tiles the marks cluster visibly around a shortage, which is expected to be enough; if it is not, a deficit summary is the natural addition.

---

## 4. Feedback

### Connection Lines
**Shown on hover or selection only** (D-84). The board is clean by default; hovering a Token lights up *its* relationships — what feeds it, what modifies it, what it modifies — with the active recipe drawn on the line.

With adjacency doing three jobs across 48 Tokens, permanent lines would produce exactly the unreadable mess that killed the previous playmat. The cost is that the whole machine cannot be seen at once; a hold-to-reveal overlay is the natural addition if that frustrates.

### Inspection — Before Placement, Not After
**A Token's full detail is available wherever it sits** — Bank, Tray or board (D-145). Selecting one shows what it produces, what it consumes, its skill requirement, and what it pairs with.

This matters because hero-time is the scarce resource: a player must never have to spend a tile and a hero to discover what something does. Planning happens before placement.

```
CHARCOAL KILN
  Consumes ....... 2 Wood
  Produces ....... 1 Charcoal / 20s
  Requires ....... Industry 15
  Pairs with ..... Forge, Tool Rack
  Uses left ...... 340 / 500
```

The existing inspection panel already does this job and carries over.

### Tooltips
Hover or right-click gives a Token's full function, its inputs, and its synergies (D-22).

Tooltips carry more weight than usual here: whether a Token consumes inputs is a **per-Token property with no derivable rule** (D-97), so the player cannot reason about cost from a Token's category and must be told.

---

## 5. Interaction

### Tokens Are Weighty Physical Objects
**The grid is real but invisible** (D-143). No drawn gridlines. Tokens sit on an implied lattice and read as solid objects resting on a surface, not as cells in a spreadsheet.

Every interaction should have physical consequence:

* **Displacement shoves.** Dropping a Token onto an occupied tile **pushes the old one out** rather than silently swapping it. If a hero was working that tile they are **knocked off** and land back in the Dock.
* **Maps burst.** Opening a Map is an explosion of contents, not a menu resolution (§6b).
* **Loot has mass.** Items pop out on an arc and settle with a bounce.
* **Placement lands.** A Token set down should feel like it has weight.

This is the design's answer to a board that could easily read as a spreadsheet. The rules are ordinary grid rules; the *presentation* is a table of physical pieces. Subtle physics throughout is a stated goal rather than a polish afterthought — it is what makes a fixed 7×7 lattice feel like a playmat.

### Drag Is the Primary Verb
Every board action is a drag, with one exception: **Maps are opened by double-click** (§6b).

| Action | Behaviour |
| :--- | :--- |
| Bank → Tray → tile | Place a Token. Tokens cannot go Bank → tile directly (§2). |
| Token onto an occupied tile | The incoming Token **shoves out** the old one, which returns to the Tray. A hero working that tile is **knocked off** to the Dock (D-134, D-143). |
| Hero onto an occupied tile | The occupying hero is **knocked to the Dock** and sits idle until re-placed (D-147). |
| Double-click a Map | It **bursts open**, scattering Tokens and items across the board (D-142). |
| Token off the board | Returns to the Tray or Bank; **the current cycle is lost** (D-54). |
| Dock → tile | Station a hero. |
| Tile → tile (hero) | **Moves directly**, no trip through the Dock; the current cycle is lost (D-131, D-134). |
| Tile → Dock (hero) | Unstation. The hero becomes idle and begins regenerating HP. |

**Reassigning heroes is the game's most frequent action** and costs one drag, deliberately.

### Hover Does Three Things
Hovering a tile simultaneously shows a tooltip, lights connection lines, **and collects any loot sprites under the cursor** (D-88).

This is accepted rather than solved. Collection confers no mechanical advantage — manual and automatic pickup produce identical outcomes — so inspecting the board while banking loot costs the player nothing.

> **If it tests badly**, the minimal fix is moving collection to **click and click-drag**, leaving hover for inspection. That preserves the entire loot system and changes only the verb.

---

## 6b. Opening a Map

**Maps replace booster packs, and opening one must feel like it** (D-142). The player double-clicks a Map and it **bursts** — Tokens and items fly out across the board and settle as sprites, to be collected or placed.

This is the game's headline reward moment. It should be loud, fast and physical. Nothing about it should resemble a queue, a progress bar, or a results dialog: the payoff is watching things scatter and seeing what landed.

**A Map is a single burst and can be opened from either the Tray or a board tile** (D-155). Opened on the board, contents scatter around where it sat; opened in the Tray, they fly onto the grid. Either way the Map is consumed.

**Purchased Maps land directly in the Tray** and cannot be stored anywhere else (D-156) — so the Tray's capacity is what limits holding several unopened Maps at once.

Three implementation notes:
* A Map's burst drops **both Tokens and items**, so the sprite layer must carry both.
* A rare drop should be visually distinct as it lands — the moment a Mythic appears is the single biggest beat the game has.
* Bursts are **random with no guaranteed contents** (D-154), so the presentation carries the payoff. A burst that yields nothing the player wanted still has to feel good to watch.

## 6. Loot Presentation

Items produced by any source drop as **floating sprites above the grid** (D-40). They occupy no tile and are not banked until collected.

* Items pop out with a small physics arc and land 1–2 tiles from their source.
* Same-type sprites **merge into counted stacks** after a moment, to stop the board filling with individual icons.
* **Collection:** hover, click-drag sweep, or a Collect All button.

### Sprites Route by Kind
**Items go to the Bank; Tokens go to the Tray** (D-158). Items are for storing, Tokens are for placing, so each lands where it will next be used.

**A Token sprite can be grabbed and placed directly:**

| Gesture | Result |
| :--- | :--- |
| Click and drag a Token sprite | Place it **straight onto a tile** — no trip through Bank or Tray |
| Hover and move away without clicking | It routes itself to the **Tray** |

This makes opening a Map flow directly into building: burst, grab the two things you want and put them down, let the rest tidy itself away. The most common motion after a burst costs one drag.

⚠️ **Needs a rule:** the Tray is capacity-limited, and a burst can yield many Tokens. Overflow should fall through to the Token Bank, and then remain on the board as sprites if that is full too (D-138).
* A **Max Item Stacks** setting caps visible stacks; above the cap the game auto-collects the least interesting first. Setting it to zero effectively disables the visual mechanic (D-41).

### Sprites Are Also Overflow Storage
Loot sprites are not purely cosmetic. **When the Bank has no free slot for an incoming item or Token, it stays on the board as a sprite** until the player makes room (D-138). Nothing is ever destroyed or refused.

This means a full Bank **announces itself visibly** — as litter accumulating across the grid — rather than through an error dialog, which is consistent with how every other problem on this board surfaces. It also protects one-copy-ever Mythic drops from being lost to a storage cap.

> **Note for implementation:** auto-collect cannot collect into a full Bank. A player running at zero visible stacks will still see sprites pile up once they hit their slot cap, and that is the intended signal rather than a bug.

---

## 7. Open

| # | Question | Notes |
| :--- | :--- | :--- |
| 1 | **Hero Dock ergonomics at 15–20 heroes.** | 🔶 **Deferred to the hero session** — the Dock's shape depends on what heroes turn out to need managing. See [`playmat_hero_concept.md`](playmat_hero_concept.md). |
| 2 | **Panel proportions.** | Board scale is settled (D-171 — 4×, 896px). The Tray's exact share and the Dock's height still need settling against it. |
| 3 | **Tray capacity.** | Settled at ~15–20 (D-168); whether it grows via Guild Upgrades is a tuning call. |
| ~~4~~ | ~~Touch and small screens.~~ **CLOSED by D-174** — desktop only. Small windows are handled by small mode (D-171). |
| ~~5~~ | ~~Signalling an idle hero.~~ **CLOSED by D-172** — a bright yellow mark on the hero, distinct from the red Token alert. |
| 6 | **Worst-case tile mock-up.** | Not a question but a task: mock a full board — 48 Tokens, heroes, progress rings, alert marks and loot sprites together — before building. This is the direct test of whether §1's clutter answer holds. |

---

## 8. Art Requirements

* **Every Token type has its own sprite.** Art scales with the number of Token types.
* **Hero sprites scale with the number of jobs, not the number of heroes** (D-75) — a significant saving at a 15–20 roster.
* **Every item type has a sprite** for loot drops (§6).
* The Guild Hall is a fixed, permanent centre tile and needs its own treatment, including visual states for its upgrades.
