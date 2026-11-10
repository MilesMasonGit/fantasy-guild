Status: briefed 2026-11-10 (approved 2026-11-09; [brief 560](briefs/560_foundation_reach.md))

# Floating Foundations, standardized reach, and in-range dot markers

*Owner interview, 2026-11-09. Gives unbuilt Foundation tokens the item-style
floating bob, unifies every reach mechanic in the game to one standard radius
so the player can judge placement before choosing what to build, and marks
every token inside the reach circle with a dot icon during drag.*

## 1. Floating Foundation tokens

- **Unbuilt Foundations float like floor items**: while an unbuilt Foundation
  token (`token_wood_foundation`, `token_stone_foundation`, `token_farmland`,
  `token_excavation`, `token_battlefield`) sits on the playmat, its sprite bobs
  up and down in whole art pixels (`lootBob.js` stepped bob, with its ground
  shadow staying stationary underneath), matching floating loot items. This
  visually signals that the Foundation is movable and not yet anchored.
- **Built structures sit firmly on the ground**: once the player builds a
  station or work camp on the Foundation, the resulting token stops floating and
  sits solidly in its spot on the playmat.

## 2. One standardized reach radius across the game

- **Why reach must be unified**: when placing or moving an unbuilt Foundation,
  the player needs to see its reach *before* building—at a moment when the game
  does not yet know whether the player will construct a Work Camp (which today
  uses `camp.reach`) or a Support/Neighbour station (which today uses
  `nearRadius`).
- **One standard radius**: unify all reach features in the game—**Foundations**,
  **Work Camps** (`camp.reach` in `Camps.js`), and **Support / Neighbour rules**
  (`nearRadius` in `MatRings.jsx` and `SupportLinkLayer.jsx`)—to a **single
  standardized reach radius**.
- **Shown during drag**: whenever the player drags a Foundation (whether buying
  it from the Shop or moving it across the playmat) or drags/hovers any token
  that uses reach, draw the standardized reach ring around the token's live drag
  position.

## 3. Dot icon over tokens within range

- **In-range dot marker**: while dragging (or previewing the reach of) a
  Foundation or reach-using token, display a clear **dot icon overtop of every
  token on the playmat that falls within the reach circle**.
- **Unambiguous boundary feedback**: every token inside the standardized reach
  radius gets the dot marker above it so the player never has to guess whether a
  borderline tree, ore vein or station is inside or outside the ring before
  releasing the drag.


## Rulings (owner, 2026-11-10)

- The standard reach is **about 240** mat units (camps were 280 to 360, neighbour rules 164).
- **Camp Reach upgrades are removed**: reach never changes (the two Hall stars go).
- **Dots on every Token inside the ring**, not heroes or floating loot.
