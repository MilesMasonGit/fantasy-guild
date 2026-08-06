// Fantasy Guild — Board state accessors (7×7 Playmat rework, Phase 2)

import { GameState } from '../../state/GameState.js';
import { TILE_COUNT, isTileIndex, isPlaceable } from '../../ui/components/board/boardConstants.js';

/**
 * BoardState — read/write primitives over `state.board`.
 *
 * This layer knows the SHAPE of board state and nothing about the rules.
 * Displacement, forfeited cycles and what may go where all live in
 * `Placement.js`; keeping them apart is what stops "put a Token here" quietly
 * growing a policy.
 *
 * ## The Token instance shape (D-79)
 * A Token is **a definition plus board state**: the registry holds the type, and
 * a light instance holds only what is true of this copy, on this tile, right now.
 *
 * ```js
 * { typeId: 'token_forest',   // → the definition; NEVER copied onto the instance
 *   usesRemaining: 4200,      // null means unlimited use (D-176)
 *   heroId: null,             // who is working it (D-57, D-111)
 *   cycleElapsedMs: 0 }       // runtime; reset by any interruption (D-54)
 * ```
 *
 * **Position is the map key, not a field**, so a Token can never disagree with
 * itself about where it is.
 *
 * The definition is deliberately never copied onto the instance. Retuning a
 * Token in the registry has to take effect immediately, everywhere — with
 * D-161's hand-authored numbers and ~60 Tokens to balance, stale copies
 * stranded on live tiles would make tuning untrustworthy.
 *
 * ## `usesRemaining: null` means unlimited, and is not `0`
 * Charges are a per-Token property, independent of rarity (D-176) — a Common
 * may be unlimited and a Mythic may be charged. `null` and `0` are opposites
 * here: one never depletes, the other is spent. Anything comparing charges must
 * check `== null` first.
 *
 * ⚠️ Tile 0 is a valid index and is falsy. Use `isTileIndex()` / `== null`.
 */

/** The live board slice, created if a save predates it. */
function board() {
    const state = GameState.state;
    if (!state) return null;
    if (!state.board) state.board = { tiles: {}, tokenBank: {}, tray: [] };
    if (!state.board.tiles) state.board.tiles = {};
    if (!state.board.tokenBank) state.board.tokenBank = {};
    if (!Array.isArray(state.board.tray)) state.board.tray = [];
    return state.board;
}

/** A fresh Token instance of `typeId`. `uses` of null means unlimited (D-176). */
export function createTokenInstance(typeId, uses = null) {
    return { typeId, usesRemaining: uses, heroId: null, cycleElapsedMs: 0 };
}

// ---------------------------------------------------------------------------
// Tiles
// ---------------------------------------------------------------------------

/** The Token instance on a tile, or null. */
export function getToken(index) {
    if (!isTileIndex(index)) return null;
    return board()?.tiles?.[index] || null;
}

/** Whether a tile currently holds a Token. */
export function hasToken(index) {
    return getToken(index) !== null;
}

/**
 * Write a Token instance to a tile, or clear it with `null`.
 * No rules applied — callers go through `Placement.js`.
 */
export function setToken(index, instance) {
    const b = board();
    if (!b || !isTileIndex(index)) return;
    if (instance) b.tiles[index] = instance;
    else delete b.tiles[index];
}

/**
 * Every occupied tile as `[index, instance]`, index ascending.
 *
 * Tiles are a **sparse map**, not a 49-length array: an empty board should cost
 * nothing, and a board with four Tokens on it should iterate four times rather
 * than forty-nine. That matters for the tick loop, which walks this every frame.
 */
export function occupiedTiles() {
    const tiles = board()?.tiles || {};
    return Object.keys(tiles)
        .map(Number)
        .sort((a, b) => a - b)
        .map(index => [index, tiles[index]]);
}

/** Tiles with no Token on them. Excludes the Guild Hall, which can never hold one. */
export function emptyTiles() {
    const out = [];
    for (let i = 0; i < TILE_COUNT; i++) {
        if (isPlaceable(i) && !hasToken(i)) out.push(i);
    }
    return out;
}

// ---------------------------------------------------------------------------
// Heroes on the board
// ---------------------------------------------------------------------------

/**
 * Which tile a hero is on, or `null` when they are in the Dock.
 *
 * **The Dock is not a data structure** — a hero who is not on any tile IS in
 * the Dock. There is deliberately no second list to keep in sync, because two
 * lists is how a hero ends up in both places or neither.
 */
export function tileOfHero(heroId) {
    if (!heroId) return null;
    for (const [index, instance] of occupiedTiles()) {
        if (instance.heroId === heroId) return index;
    }
    return null;
}

/** The hero id working a tile, or null. */
export function heroOnTile(index) {
    return getToken(index)?.heroId || null;
}

// ---------------------------------------------------------------------------
// The Tray (D-86, D-107, D-168)
// ---------------------------------------------------------------------------

/**
 * The Tray — a permanent staging area, and **load-bearing rather than
 * decorative**.
 *
 * Opening a Bank covers the board, so Tokens cannot be dragged Bank→tile
 * directly. The flow is **Bank → Tray → Board**. Remove the Tray and placement
 * stops working entirely.
 *
 * It is also where purchased Maps land (D-156) and where displaced Tokens go,
 * which is why it is roomy from the start — ~15–20 slots, so a full Map burst
 * always fits (D-168).
 */
export function getTray() {
    return board()?.tray || [];
}

/** Append to the Tray. Returns false when it is full. */
export function addToTray(instance, capacity = TRAY_CAPACITY) {
    const b = board();
    if (!b || !instance) return false;
    if (b.tray.length >= capacity) return false;
    b.tray.push(instance);
    return true;
}

/** Remove and return the Tray entry at `slot`, or null. */
export function takeFromTray(slot) {
    const b = board();
    if (!b || slot < 0 || slot >= b.tray.length) return null;
    return b.tray.splice(slot, 1)[0] || null;
}

/** Tray capacity (D-168). Raised later by the Economy upgrade track (D-163). */
export const TRAY_CAPACITY = 18;

// ---------------------------------------------------------------------------
// The Token Bank (D-137)
// ---------------------------------------------------------------------------

/**
 * **Stacks are never capped; slots are** (D-137). The Token Bank caps the number
 * of *distinct types* held, never how many copies of one type.
 *
 * Capping copies would punish a productive board, which is the opposite of what
 * the economy is for. Capping variety creates pressure to specialise without
 * ever making success feel like a problem.
 *
 * Consolidation of partial charges (D-77) lands in Phase 7 with the Bank UI;
 * this is the storage primitive underneath it.
 */
export function getTokenBank() {
    return board()?.tokenBank || {};
}

/** How many distinct Token types the Bank holds — the thing that is capped. */
export function tokenBankSlotsUsed() {
    return Object.keys(getTokenBank()).length;
}

/** Every copy of one Token type held in the Bank. */
export function tokenBankCopies(typeId) {
    return getTokenBank()[typeId] || [];
}

/**
 * Put a Token into the Bank.
 *
 * Refused only when it would need a NEW slot and none is free — adding to a
 * type already held never needs one, exactly as the item Bank behaves.
 *
 * ⚠️ Returning `false` here currently loses the Token. That is temporary:
 * D-138 says **nothing is ever lost to a full Bank** — the overflow becomes a
 * board sprite instead. Phase 3 builds that layer and rewires this refusal.
 */
export function addToTokenBank(instance, slotCap = Infinity) {
    const b = board();
    if (!b || !instance?.typeId) return false;
    const bank = b.tokenBank;
    if (!bank[instance.typeId]) {
        if (Object.keys(bank).length >= slotCap) return false;
        bank[instance.typeId] = [];
    }
    bank[instance.typeId].push({ usesRemaining: instance.usesRemaining ?? null });
    return true;
}

/**
 * Take one copy of a type out of the Bank.
 *
 * **Placement always draws a full Token first** (D-77); partials are used last.
 * Doing it here rather than at each call site means a player can never be handed
 * a nearly-spent Token while a fresh one sits in storage.
 */
export function takeFromTokenBank(typeId) {
    const bank = board()?.tokenBank;
    const copies = bank?.[typeId];
    if (!copies?.length) return null;

    // Unlimited (null) counts as the fullest possible.
    let best = 0;
    for (let i = 1; i < copies.length; i++) {
        const a = copies[best].usesRemaining;
        const b2 = copies[i].usesRemaining;
        if (a === null) break;
        if (b2 === null || b2 > a) best = i;
    }

    const [copy] = copies.splice(best, 1);
    if (!copies.length) delete bank[typeId];
    return createTokenInstance(typeId, copy.usesRemaining ?? null);
}
