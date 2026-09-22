# Concept Document: Hero Movement & Animations

**Status:** DRAFT concept. ⭐ The owner's decisions of 2026-09-21 and the build plan are in `docs/hero_movement_roadmap_v1.md`, which wins where the two differ (heroes stand *beside* a Token, not on its centre; they look for better work when a cycle ends).

## 1. Overview
The transition to a free playmat introduces autonomous hero movement. Heroes will no longer simply "stand" on the tokens they work. Instead, they will physically walk between tasks, their flag, and the guild hall, with proper animations indicating their current state (Idle, Walk, Attack/Work).

## 2. Sprite Specifications
* **Format:** 64x64 pixel frames.
* **Layout:** 3 Rows, 8 Frames per row.
  * **Row 1:** Attack (Work) cycle
  * **Row 2:** Walk cycle
  * **Row 3:** Idle cycle
* **Direction:** Sprites are drawn facing right. Logic will dynamically flip the sprite (e.g., via CSS transform or canvas flip) when the hero moves left.
* **Timing:** Standardized frame rate (e.g., 8 FPS) for all heroes initially.

## 3. Movement and Positioning
* **Speed:** Flat pixel-per-second movement speed across the mat for all heroes initially, rather than tying it to hero stats.
* **Precision:** Heroes walk directly to the center point of their target token to perform a task.

## 4. The Core Logic Loop

### Placement & Entering
* **Entering:** When a hero is placed from the dock onto the playmat, the player plants a **Flag** token.
* The hero visually spawns at the **Guild Hall token** and walks toward their newly placed Flag.

### Working & Idling
* **At the Flag:** If there are no valid tasks within the flag's radius, the hero returns to the Flag and plays the **Idle** animation.
* **Discovering Tasks:** Once a valid task appears (or is planted) in range, the hero transitions to the **Walk** animation and moves to the task's center.
* **Performing Tasks:** The hero plays the **Attack** animation (acting as a universal working/fighting animation) until the task/resource is depleted.
* **Chaining Tasks:** Upon depleting a task, the hero immediately scans for the next nearest valid task within the flag's radius and walks to it. If none exist, they walk back to the Flag and Idle.

### Leaving
* **Recall:** The player returns a hero to the dock by dragging their Flag back to the dock or onto the Guild Hall token.
* **Leaving Animation:** The Flag instantly disappears. The hero transitions to the **Walk** animation, walks to the **Guild Hall token**, and despawns upon arrival.
