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
 *   cycleElapsedMs: 0 }       // runtime; reset by any interruption (D-54)
 * ```
 *
 * **Position is the map key, not a field**, so a Token can never disagree with
 * itself about where it is.
 *
 * ⚠️ **`heroId` is NOT on the instance** — see "Where a hero stands" below. It
 * used to be, and Phase 7 moved it.
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
    if (!state.board) state.board = { tiles: {}, tokenBank: {}, tray: [], maps: [] };
    if (!state.board.tiles) state.board.tiles = {};
    if (!state.board.tokenBank) state.board.tokenBank = {};
    if (!Array.isArray(state.board.tray)) state.board.tray = [];
    if (!Array.isArray(state.board.maps)) state.board.maps = [];
    if (!state.board.heroTiles) state.board.heroTiles = {};
    if (!state.board.vacancies) state.board.vacancies = {};
    return state.board;
}

/** A fresh Token instance of `typeId`. `uses` of null means unlimited (D-176). */
export function createTokenInstance(typeId, uses = null) {
    return { typeId, usesRemaining: uses, cycleElapsedMs: 0 };
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
    if (instance) {
        b.tiles[index] = instance;
        // Anything arriving satisfies the tile's claim on a restock, whether it
        // came from a Manager or from the player's hand.
        delete b.vacancies[index];
    } else {
        delete b.tiles[index];
    }
}

/**
 * Remove and return the Token instance on a tile (or null).
 */
export function takeToken(index) {
    const instance = getToken(index);
    if (instance) setToken(index, null);
    return instance;
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
 * Where a hero stands — **their own state, not the Token's** (Phase 7).
 *
 * `board.heroTiles` maps `heroId -> tileIndex`, and is the single source of
 * truth. It replaces the `heroId` field that used to live on the Token
 * instance, which had one fatal property: **a hero could not outlive the Token
 * they stood on.** When a Forest ran dry the instance was deleted and the
 * person went with it, silently, back to the Dock.
 *
 * Three separate design rules need a hero to survive that moment:
 *
 *   * **D-57** — a hero may stand on an empty tile; they simply do nothing.
 *   * **D-60** — a hero whose Token stops producing *idles where they stand*,
 *     until the player returns.
 *   * **D-151** — a Manager restocks **under** a working hero, who carries on
 *     without being re-placed. This is the entire point of Managers, and it is
 *     unbuildable while a hero is a field on the thing that just vanished.
 *
 * **The Dock is still not a data structure** — a hero with no entry here IS in
 * the Dock. There is exactly one list, which is what stops a hero ending up in
 * both places or neither.
 *
 * ⚠️ Tile 0 is a valid index and is falsy. Every read here uses `?? null` and
 * every caller must test `== null`, never truthiness.
 */
export function tileOfHero(heroId) {
    if (!heroId) return null;
    return board()?.heroTiles?.[heroId] ?? null;
}

/** The hero id standing on a tile, or null. Includes heroes on EMPTY tiles. */
export function heroOnTile(index) {
    if (!isTileIndex(index)) return null;
    const map = board()?.heroTiles || {};
    for (const heroId of Object.keys(map)) {
        if (map[heroId] === index) return heroId;
    }
    return null;
}

/**
 * Put a hero on a tile, or take them off the board with `null`.
 * No rules applied — callers go through `Placement.js`.
 */
export function setHeroTile(heroId, index) {
    const b = board();
    if (!b || !heroId) return;
    if (index == null) delete b.heroTiles[heroId];
    else if (isTileIndex(index)) b.heroTiles[heroId] = index;
}

/** Every hero standing on the board as `[heroId, tileIndex]`. */
export function heroesOnBoard() {
    return Object.entries(board()?.heroTiles || {});
}

// ---------------------------------------------------------------------------
// Vacancies — what a tile used to hold (Phase 7, D-35)
// ---------------------------------------------------------------------------

/**
 * A tile that **ran dry**, remembering what depleted on it.
 *
 * This is what makes a Manager type-specific without making it invasive. A
 * Lumber Camp refills a tile where a *Forest* wore out; it never colonises a
 * tile that was simply always empty, so placing a Manager cannot carpet the
 * ground you were saving for something else (owner decision 2026-08-06).
 *
 * Set only by depletion. Cleared the moment anything is placed on the tile —
 * including by hand, which is the player overriding the Manager's claim.
 */
export function setVacancy(index, typeId) {
    const b = board();
    if (!b || !isTileIndex(index)) return;
    if (typeId) b.vacancies[index] = { typeId, unstocked: false };
    else delete b.vacancies[index];
}

/** What ran dry on a tile, or null. */
export function getVacancy(index) {
    if (!isTileIndex(index)) return null;
    return board()?.vacancies?.[index] || null;
}

/** Every vacant tile as `[index, vacancy]`. Sparse — usually empty. */
export function vacancies() {
    const map = board()?.vacancies || {};
    return Object.keys(map).map(Number).map(i => [i, map[i]]);
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
    const b = board();
    if (!b) return [];
    backfillTrayPositions(b.tray);
    return b.tray;
}

/**
 * Append to the Tray. Returns false when it is full.
 *
 * `position` is `{ x, y }` in Tray fractions and should be passed **only when
 * the player put it there themselves** — a drop lands where it was dropped
 * (D-227). Everything else (a Map bursting, a purchased Map, a Vault withdrawal,
 * a Token pulled off a tile) arrives on its own and is scattered into open
 * space.
 */
export function addToTray(instance, capacity = TRAY_CAPACITY, position = null) {
    const b = board();
    if (!b || !instance) return false;
    if (b.tray.length >= capacity) return false;

    const at = position || scatterIntoTray(b.tray);
    instance.x = clamp01(at.x);
    instance.y = clamp01(at.y);

    b.tray.push(instance);
    return true;
}

/** Remove and return the Tray entry at `slot`, or null. */
export function takeFromTray(slot) {
    const b = board();
    if (!b || slot < 0 || slot >= b.tray.length) return null;
    return b.tray.splice(slot, 1)[0] || null;
}

/** Move the Token at `slot` to a new Tray position. Fractions, clamped. */
export function setTrayPosition(slot, x, y) {
    const b = board();
    const entry = b?.tray?.[slot];
    if (!entry) return false;
    entry.x = clamp01(x);
    entry.y = clamp01(y);
    return true;
}

/** Tray capacity (D-168). Raised later by the Economy upgrade track (D-163). */
export const TRAY_CAPACITY = 18;

// ---------------------------------------------------------------------------
// Tray positions (D-223, D-226, D-227)
// ---------------------------------------------------------------------------

/**
 * ## The Tray is a free surface, not a grid (D-223)
 *
 * Tokens sit wherever they are put, may overlap freely, and stay there between
 * sessions. Three things about how that is stored are load-bearing:
 *
 * **1. Position lives on the INSTANCE, never on the slot index.**
 * `takeFromTray()` splices, so every index after the removed one shifts down.
 * Anything keyed to a slot number would make the whole Tray jump whenever one
 * Token was placed. Because each Token carries its own `x`/`y`, splicing cannot
 * disturb the arrangement — **which is also why no Token id is needed here.**
 *
 * **2. Positions are FRACTIONS of the placeable area, not pixels (D-226).**
 * `0` is flush against the left/top edge and `1` flush against the right/bottom,
 * so the renderer computes `fraction × (surface − sprite)`. The Tray body is
 * `flex-1` — its height changes with the window and collapses when a bottom
 * drawer opens — and absolute pixels would leave Tokens below the fold, on the
 * one surface D-156 makes the only home for an unopened Map. Fractions squash
 * and stretch instead: nothing ever leaves the surface, nothing needs scrolling,
 * and all 18 stay visible so the `n / 18` count keeps describing what you see.
 * *Accepted cost:* spacing is not preserved, only rough layout — a deliberate
 * gap can close up on a short window.
 *
 * **3. Scattering happens in that same fraction space**, so a narrow tall Tray
 * naturally spreads Tokens further apart vertically than horizontally. That is
 * the right bias for a 256px column and is why no aspect correction is applied.
 */

const clamp01 = (v) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.5);

/** How many candidate spots to consider before choosing the emptiest. */
const SCATTER_DARTS = 40;

/**
 * A position for a Token arriving on its own — random, but biased toward open
 * space (D-227).
 *
 * Throw `SCATTER_DARTS` random points and keep whichever lands furthest from
 * everything already down. Overlap therefore begins only once the Tray genuinely
 * runs out of room.
 *
 * *Why not uniform random:* it does not read as physical, it reads as broken —
 * Tokens bury each other while obvious free space sits unused beside them, and a
 * six-item Map burst (D-167) can drop three things on one spot. Real objects
 * tipped onto a real surface spread out, so seeking space is **more** physical
 * than uniform randomness, not less.
 */
export function scatterIntoTray(existing = []) {
    let best = { x: Math.random(), y: Math.random() };
    let bestGap = -1;

    for (let d = 0; d < SCATTER_DARTS; d++) {
        const x = Math.random();
        const y = Math.random();

        let nearest = Infinity;
        for (const e of existing) {
            if (e?.x == null || e?.y == null) continue;
            const gap = Math.hypot(e.x - x, e.y - y);
            if (gap < nearest) nearest = gap;
        }

        if (nearest > bestGap) { bestGap = nearest; best = { x, y }; }
    }

    return best;
}

/**
 * Give a position to any Tray Token that loaded without one.
 *
 * **This is what makes the change need no save-schema break.** `migrateState()`
 * refuses any save whose version is not an exact match, and every rework so far
 * has broken compatibility deliberately — but adding an optional field does not
 * require that. A Token saved before positions existed is simply scattered on
 * read, exactly as a fresh arrival would be. Schema stays 0.6.0.
 */
export function backfillTrayPositions(tray) {
    if (!Array.isArray(tray)) return;
    for (const entry of tray) {
        if (!entry || (entry.x != null && entry.y != null)) continue;
        const at = scatterIntoTray(tray);
        entry.x = at.x;
        entry.y = at.y;
    }
}

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
 * These are the storage primitives only. Consolidation (D-77), the slot cap and
 * selling are **rules**, and live in `TokenBank.js` — the same split that keeps
 * placement policy out of `setToken`.
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
 * Put a Token into the Bank, **raw** — no consolidation, no slot cap.
 *
 * Callers should use `TokenBank.deposit()`, which applies both. This stays
 * exported because consolidation needs a way to write copies back without
 * recursing through its own rules.
 *
 * Refused only when it would need a NEW slot and none is free — adding to a
 * type already held never needs one, exactly as the item Bank behaves. A
 * refusal never destroys the Token: every caller leaves it on the board as a
 * sprite instead (D-138).
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

/** Replace every copy of a type at once. Used by consolidation's repack. */
export function setTokenBankCopies(typeId, copies) {
    const b = board();
    if (!b || !typeId) return;
    if (copies?.length) b.tokenBank[typeId] = copies;
    else delete b.tokenBank[typeId];
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

// ---------------------------------------------------------------------------
// Board Maps (freely placed overtop the playmat)
// ---------------------------------------------------------------------------

/** All maps freely sitting on the playmat. */
export function getBoardMaps() {
    return board()?.maps || [];
}

/** Add a map token instance at (x, y) coordinates on the playmat. */
export function addBoardMap(typeId, x, y, usesRemaining = 1) {
    const b = board();
    if (!b || !typeId) return null;
    const instance = {
        id: 'map_' + Math.random().toString(36).slice(2, 9),
        typeId,
        x: Math.round(x),
        y: Math.round(y),
        usesRemaining: usesRemaining ?? 1
    };
    b.maps.push(instance);
    return instance;
}

/** Remove and return a board map by id (or null). */
export function removeBoardMap(id) {
    const b = board();
    if (!b) return null;
    const idx = b.maps.findIndex(m => m.id === id);
    if (idx === -1) return null;
    return b.maps.splice(idx, 1)[0] || null;
}

/** Update the (x, y) coordinates of a board map. */
export function setBoardMapPosition(id, x, y) {
    const b = board();
    const map = b?.maps?.find(m => m.id === id);
    if (!map) return false;
    map.x = Math.round(x);
    map.y = Math.round(y);
    return true;
}
