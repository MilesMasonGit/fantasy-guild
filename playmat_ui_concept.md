# Concept: Playmat UI

How the board is presented and operated. This document owns **layout, the tile, feedback, and interaction**.

It does not own game rules. Where a rule has a visual consequence — moving a Token forfeits its cycle, a starved Token stops working — the rule lives in [`playmat_grid_concept.md`](playmat_grid_concept.md) and this document describes only how the player sees and triggers it.

Reasoning for every decision ID (D-nn) is in [`playmat_grid_decisions.md`](playmat_grid_decisions.md).

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

*Exact proportions and arrangement are open (§7).*

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

### Specific States
* **Blocked by supply** — a **glowing red alert mark**; hover states exactly what is missing and by how much (D-114).
* **In combat** — the progress ring tracks the current fight, since one kill counts as one cycle (D-129).
* **Depleted** — the Token is gone; the tile is empty and its hero is idle.

**There is no aggregate supply dashboard.** Diagnosis is tile by tile. On 48 tiles the marks cluster visibly around a shortage, which is expected to be enough; if it is not, a deficit summary is the natural addition.

---

## 4. Feedback

### Connection Lines
**Shown on hover or selection only** (D-84). The board is clean by default; hovering a Token lights up *its* relationships — what feeds it, what modifies it, what it modifies — with the active recipe drawn on the line.

With adjacency doing three jobs across 48 Tokens, permanent lines would produce exactly the unreadable mess that killed the previous playmat. The cost is that the whole machine cannot be seen at once; a hold-to-reveal overlay is the natural addition if that frustrates.

### Tooltips
Hover or right-click gives a Token's full function, its inputs, and its synergies (D-22).

Tooltips carry more weight than usual here: whether a Token consumes inputs is a **per-Token property with no derivable rule** (D-97), so the player cannot reason about cost from a Token's category and must be told.

---

## 5. Interaction

**Drag is the primary verb.** Every board action is a drag.

| Action | Behaviour |
| :--- | :--- |
| Bank → Tray → tile | Place a Token. Tokens cannot go Bank → tile directly (§2). |
| Token onto an occupied tile | **Swaps** the two Tokens (D-134). No need to clear a tile first. |
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

## 6. Loot Presentation

Items produced by any source drop as **floating sprites above the grid** (D-40). They occupy no tile and are not banked until collected.

* Items pop out with a small physics arc and land 1–2 tiles from their source.
* Same-type sprites **merge into counted stacks** after a moment, to stop the board filling with individual icons.
* **Collection:** hover, click-drag sweep, or a Collect All button.
* A **Max Item Stacks** setting caps visible stacks; above the cap the game auto-collects the least interesting first. Setting it to zero effectively disables the visual mechanic (D-41).

### Sprites Are Also Overflow Storage
Loot sprites are not purely cosmetic. **When the Bank has no free slot for an incoming item or Token, it stays on the board as a sprite** until the player makes room (D-138). Nothing is ever destroyed or refused.

This means a full Bank **announces itself visibly** — as litter accumulating across the grid — rather than through an error dialog, which is consistent with how every other problem on this board surfaces. It also protects one-copy-ever Mythic drops from being lost to a storage cap.

> **Note for implementation:** auto-collect cannot collect into a full Bank. A player running at zero visible stacks will still see sprites pile up once they hit their slot cap, and that is the intended signal rather than a bug.

---

## 7. Open

| # | Question | Notes |
| :--- | :--- | :--- |
| 1 | **Hero Dock ergonomics at 15–20 heroes.** | Flagged as a concern when it held three heroes with six slots each. It now carries a full roster *and* is where jobs, skills and equipment are managed. This is the largest open UI question. |
| 2 | **Board scale and exact proportions.** | At 32px a 7×7 board is 224px across — far too small. The real display scale, and the Tray's exact share, need settling together. |
| 3 | **Tray capacity.** | Whether it is limited, and whether it grows via Guild Upgrades. |
| 4 | **Touch and small screens.** | Drag is the only verb and there is no fallback. Whether click-to-place is needed. |
| 5 | **Progress ring with no active cycle.** | What a Token shows when it is idle, waiting on inputs, or has no hero. |
| 6 | **Worst-case tile mock-up.** | Not a question but a task: mock a full board — 48 Tokens, heroes, progress rings, alert marks and loot sprites together — before building. This is the direct test of whether §1's clutter answer holds. |

---

## 8. Art Requirements

* **Every Token type has its own sprite.** Art scales with the number of Token types.
* **Hero sprites scale with the number of jobs, not the number of heroes** (D-75) — a significant saving at a 15–20 roster.
* **Every item type has a sprite** for loot drops (§6).
* The Guild Hall is a fixed, permanent centre tile and needs its own treatment, including visual states for its upgrades.
