import * as ItemStubs from '../../../systems/notifications/itemStubs.js';
import { glideShift } from './stubGlide.js';
import { GAP_PX, HEADER_PX, PITCH_PX, SPRITE_INSET_PX, STUB_PX } from './stubGeometry.js';

/**
 * Where collected loot lands: on its own item's stub (owner, third look), instead of the Guild
 * Hall. The Bank has the loot already; the stub's count holds it back until the flight lands
 * (`itemStubs.holdForFlight`), so the count ticks up as each item arrives.
 *
 * A stub out of view (scrolled away, or a new one below a full column) gets a copy popped out over
 * the bottom stubs: it takes the landings, lingers {@link COPY_LINGER_MS}, then slides back. The
 * copies are a small store of their own that the column draws.
 *
 * Cost: one query per collection to see whether the column is drawn (no layout), and one batch of
 * box reads per burst of flights ({@link placeFlights}), made after the column has drawn any new
 * stub, so the boxes are already laid out. Nothing here runs per frame.
 */

/** How long a copy stays out after its last landing, so the count can be read. */
export const COPY_LINGER_MS = 900;

/** How long a copy takes to slide back: the stubs' own slide. */
const COPY_LEAVE_MS = ItemStubs.LEAVE_MS;

const COLUMN_SELECTOR = '[data-item-stubs]';

// --- The copies: itemId -> { itemId, key, slot, top (px from the column's top), leaving } ------

const copies = new Map();
/** Per copy: flights still on their way to it, and its timer. Kept apart so the drawn record only changes when its look does. */
const inbound = new Map();
const timers = new Map();
let copyKey = 0;
let copyVersion = 0;
const copyListeners = new Set();

function emitCopies() {
    copyVersion++;
    for (const fn of [...copyListeners]) fn();
}

/** For `useSyncExternalStore`. */
export function subscribeCopies(fn) {
    copyListeners.add(fn);
    return () => copyListeners.delete(fn);
}

export function getCopiesVersion() {
    return copyVersion;
}

/** The copies out now, bottom one first. */
export function getCopies() {
    return [...copies.values()].sort((a, b) => a.slot - b.slot);
}

/** Forget every copy (tests, and a column that goes away). */
export function resetCopies() {
    for (const t of timers.values()) clearTimeout(t);
    timers.clear();
    inbound.clear();
    if (copies.size) {
        copies.clear();
        emitCopies();
    }
}

function setTimer(itemId, fn, ms) {
    clearTimeout(timers.get(itemId));
    timers.set(itemId, setTimeout(fn, ms));
}

function expectLanding(itemId) {
    inbound.set(itemId, (inbound.get(itemId) || 0) + 1);
    clearTimeout(timers.get(itemId));
    timers.delete(itemId);
    const c = copies.get(itemId);
    if (c?.leaving) {
        copies.set(itemId, { ...c, leaving: false });
        emitCopies();
    }
}

function copyLanded(itemId) {
    const left = Math.max(0, (inbound.get(itemId) || 0) - 1);
    inbound.set(itemId, left);
    if (left || !copies.has(itemId)) return;
    setTimer(itemId, () => {
        const c = copies.get(itemId);
        if (!c) return;
        copies.set(itemId, { ...c, leaving: true });
        emitCopies();
        setTimer(itemId, () => {
            copies.delete(itemId);
            inbound.delete(itemId);
            timers.delete(itemId);
            emitCopies();
        }, COPY_LEAVE_MS);
    }, COPY_LINGER_MS);
}

/**
 * The copy for `itemId`, out over the bottom stubs: its own if it is still out, else a new one in
 * the lowest free place (the bottom first, then upwards). Null when no place is free.
 * @param {number} viewTop
 * @param {number} viewBottom the bottom of the visible list, in screen px
 * @param {number} columnTop
 */
function claimCopy(itemId, viewTop, viewBottom, columnTop) {
    const own = copies.get(itemId);
    if (own) return own;
    const taken = new Set([...copies.values()].map(c => c.slot));
    for (let slot = 0; ; slot++) {
        const top = viewBottom - STUB_PX - slot * PITCH_PX;
        if (top < viewTop - 1) return null;
        if (taken.has(slot)) continue;
        const c = { itemId, key: ++copyKey, slot, top: top - columnTop, leaving: false };
        copies.set(itemId, c);
        emitCopies();
        return c;
    }
}

// --- The flights -------------------------------------------------------------------------------

/**
 * Whether collected `itemId` flies to its stub: the column is drawn and the item has a stub (its
 * Bank change has just made or moved it). Otherwise it flies to the Guild Hall as before.
 */
export function fliesToStub(itemId, doc = globalThis.document) {
    if (!itemId || !doc) return false;
    const s = ItemStubs.getStub(itemId);
    return !!s && !s.leaving && !!doc.querySelector(COLUMN_SELECTOR);
}

/**
 * Book one flight of `qty` to its stub: the count holds it back from now until {@link landFlight}.
 * @returns {{ itemId: string, hold: object, spot: {x: number, y: number}|null, copy: boolean, done: boolean } | null}
 */
export function bookFlight(itemId, qty) {
    const hold = ItemStubs.holdForFlight(itemId, qty);
    return hold ? { itemId, hold, spot: null, copy: false, done: false } : null;
}

/**
 * Where a stub's sprite rests, in screen px: its box less any slide out of the edge (a stub rests
 * flush with the column's right side) and any glide to a new place. Null when the list has it out
 * of view.
 */
function restingSpot(el, columnRight, view) {
    const r = el.getBoundingClientRect();
    const sprite = el.querySelector('[data-stub-sprite]');
    const s = sprite ? sprite.getBoundingClientRect() : null;
    const slide = r.right - columnRight;
    const glide = glideShift(el);
    if (view && (r.top - glide < view.top - 1 || r.bottom - glide > view.bottom + 1)) return null;
    const x = s ? s.left + s.width / 2 : r.right - SPRITE_INSET_PX;
    const y = s ? s.top + s.height / 2 : r.top + r.height / 2;
    return { x: x - slide, y: y - glide };
}

/**
 * Place a burst of booked flights, reading each stub once. Run after the column has drawn (the
 * stub a collection made is drawn at once, before this runs). Each booking gets `spot`, the screen
 * point it lands on, and `copy` when that is a copy over the bottom stubs; `spot` stays null when
 * it has nowhere to land on the stubs (no column, or no room for another copy), and the flight
 * goes to the Guild Hall instead.
 */
export function placeFlights(bookings, doc = globalThis.document) {
    const column = doc?.querySelector(COLUMN_SELECTOR);
    if (!column || !bookings.length) return;
    const col = column.getBoundingClientRect();
    const scroller = column.querySelector('[data-stubs-scroll]');
    const view = scroller ? scroller.getBoundingClientRect() : null;
    const els = new Map();
    for (const el of column.querySelectorAll('[data-item-stub]')) els.set(el.dataset.itemStub, el);
    const spots = new Map();

    const spotFor = (itemId) => {
        const el = els.get(itemId);
        const inScroller = !!(el && scroller && scroller.contains(el));
        if (el && !el.dataset.stubLeaving) {
            const rest = restingSpot(el, col.right, inScroller ? view : null);
            if (rest) return { ...rest, copy: false };
        }
        if (!el && !scroller) {
            // Not drawn yet and the column has room: it will join the bottom, below the last stub.
            let bottom = col.top + HEADER_PX - GAP_PX;
            for (const other of els.values()) bottom = Math.max(bottom, other.getBoundingClientRect().bottom - glideShift(other));
            const top = bottom + GAP_PX;
            return { x: col.right - SPRITE_INSET_PX, y: top + STUB_PX / 2, copy: false };
        }
        const viewTop = view ? view.top : col.top + HEADER_PX;
        const viewBottom = view ? view.bottom : col.bottom;
        const c = claimCopy(itemId, viewTop, viewBottom, col.top);
        return c ? { x: col.right - SPRITE_INSET_PX, y: col.top + c.top + STUB_PX / 2, copy: true } : null;
    };

    for (const b of bookings) {
        if (!b || b.done) continue;
        if (!spots.has(b.itemId)) spots.set(b.itemId, spotFor(b.itemId));
        const spot = spots.get(b.itemId);
        if (!spot) continue;
        b.spot = { x: spot.x, y: spot.y };
        b.copy = spot.copy;
        if (spot.copy) expectLanding(b.itemId);
    }
}

/**
 * The flight landed, or will never land (dropped, sent elsewhere): the stub's count takes it now,
 * and a copy waits for one flight fewer. Safe to call twice.
 */
export function landFlight(booking) {
    if (!booking || booking.done) return;
    booking.done = true;
    ItemStubs.landFlight(booking.hold);
    if (booking.copy) copyLanded(booking.itemId);
}
