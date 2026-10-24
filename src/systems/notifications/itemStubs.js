/**
 * The item stubs: one small stub per item at the top right of the mat, showing that item's net
 * flow (gained minus spent), whatever its sources. A station eating Oak while woodcutters bring it
 * in is one Oak stub.
 *
 * The merging happens here, once per Bank change, never per render: the column reads finished
 * stubs. Each change replaces the stub object, so a memoised row redraws only when its own item
 * moved, and listeners hear at most one change per {@link EMIT_MS}.
 *
 * A stub fades {@link FADE_MS} after its item last changed. A pinned stub never fades: it is a live
 * tracker, and it is saved with the game ({@link serializePins} / {@link loadPins}). Every stub
 * counts since it appeared or was last reset.
 *
 * A stub cleared by hand (right-click, Clear all) is marked `leaving` for {@link LEAVE_MS} so the
 * column can slide it out, then goes.
 *
 * Collected loot is in the Bank before its flight reaches the stub: the stub holds that much back
 * from what it shows until the flight lands ({@link holdForFlight}, {@link landFlight}), so the
 * count ticks up as each item arrives. The Bank's own count and timing never wait for a flight.
 *
 * Pure apart from the clock and the timer, which tests replace ({@link setClock}, {@link flush}).
 */

/** How long a stub stays after its item last changed. */
export const FADE_MS = 5 * 60 * 1000;

/** How long a stub takes to fade out once its time is up. */
export const FADE_OUT_MS = 1000;

/** How long a cleared stub is drawn sliding out before it goes. */
export const LEAVE_MS = 320;

/** How long after it appears a stub still slides in when drawn (it is first drawn up to {@link EMIT_MS} late). */
export const ARRIVE_MS = 600;

/** The longest a change waits before listeners hear of it. */
export const EMIT_MS = 250;

let clock = () => Date.now();

/** itemId -> stub. Their order on screen is `slot` and `pinSlot` ({@link getStubs}). */
const stubs = new Map();
/** Items found for the first time whose stub has not been made yet. */
const pendingNew = new Set();
/** Items whose stub was made since listeners last heard: not drawn yet. */
const unseen = new Set();
/** Tells one stub from the next for the same item, so a flight booked on a cleared or reset stub lands on nothing. */
let nextUid = 0;

let version = 0;
let emitTimer = null;
const listeners = new Set();

/** Replace the clock (tests). Null restores the wall clock. */
export function setClock(fn) {
    clock = fn || (() => Date.now());
}

function emitNow() {
    if (emitTimer) { clearTimeout(emitTimer); emitTimer = null; }
    unseen.clear();
    version++;
    for (const fn of [...listeners]) fn();
}

function changed() {
    if (emitTimer) return;
    emitTimer = setTimeout(emitNow, EMIT_MS);
}

/** Tell listeners now about anything still waiting. */
export function flush() {
    if (emitTimer) emitNow();
}

/** For `useSyncExternalStore`. */
export function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

export function getVersion() {
    return version;
}

/**
 * Where stubs sit, kept calm: a new stub joins the bottom (`slot` counts up), an unpinned one goes
 * to the top of the unpinned stubs (counts down), a new pin goes to the bottom of the pins.
 * Nothing else reorders.
 */
let lastSlot = 0;
let firstSlot = 0;
let lastPinSlot = 0;

function freshStub(itemId, now) {
    unseen.add(itemId);
    return {
        itemId,
        uid: ++nextUid,
        slot: ++lastSlot,
        pinSlot: 0,
        added: 0,
        removed: 0,
        /** Collected and banked, still flying here: not shown until it lands. */
        held: 0,
        firstAt: now,
        lastChangedAt: now,
        isNew: false,
        pinned: false,
        pinnedAt: null,
        fading: false,
        leaving: false
    };
}

/**
 * Merge one Bank change into its item's stub, making the stub if there is none.
 * @param {string} itemId
 * @param {{added?: number, removed?: number}} flow
 */
export function recordFlow(itemId, { added = 0, removed = 0 } = {}) {
    if (!itemId) return;
    const add = Number(added) > 0 ? Number(added) : 0;
    const rem = Number(removed) > 0 ? Number(removed) : 0;
    if (!add && !rem) return;
    const now = clock();
    const kept = stubs.get(itemId);
    // A stub on its way out was cleared: the next flow starts a fresh one at +0.
    const old = kept && !kept.leaving ? kept : freshStub(itemId, now);
    const next = {
        ...old,
        added: old.added + add,
        removed: old.removed + rem,
        lastChangedAt: now,
        fading: false,
        isNew: old.isNew || pendingNew.has(itemId)
    };
    pendingNew.delete(itemId);
    stubs.set(itemId, next);
    changed();
}

/** The item was found for the first time: its stub shows "New!" in a gold frame. */
export function markNew(itemId) {
    if (!itemId) return;
    const old = stubs.get(itemId);
    if (old) {
        if (!old.isNew) {
            stubs.set(itemId, { ...old, isNew: true });
            changed();
        }
        return;
    }
    pendingNew.add(itemId);
}

/** The player has seen the stub (hovered or pinned it): its "New!" and gold frame go, and stay gone. */
export function clearNew(itemId) {
    const s = stubs.get(itemId);
    if (!s || !s.isNew) return;
    stubs.set(itemId, { ...s, isNew: false });
    emitNow();
}

/** The stub's net flow: gained minus spent. */
export const netOf = (stub) => (stub ? stub.added - stub.removed : 0);

/** What the stub shows: its net flow less the loot still flying to it. */
export const shownNetOf = (stub) => (stub ? stub.added - stub.removed - stub.held : 0);

/**
 * Collected loot of `itemId` is flying to its stub: hold `qty` back from the count until it lands.
 * Call it straight after the Bank change that counted it, before listeners hear (they hear on a
 * timer), so the count never shows it early. A stub made by that very change is drawn at once, so
 * it slides out at +0 as the flight starts and the loot has somewhere to land.
 * @returns {{ itemId: string, uid: number, qty: number } | null} what {@link landFlight} takes;
 *   null when the item has no stub
 */
export function holdForFlight(itemId, qty) {
    const s = stubs.get(itemId);
    const q = Number(qty) > 0 ? Number(qty) : 0;
    if (!s || s.leaving || !q) return null;
    stubs.set(itemId, { ...s, held: s.held + q });
    if (unseen.has(itemId)) emitNow();
    return { itemId, uid: s.uid, qty: q };
}

/**
 * A held flight landed (or will never land): its amount shows now, and listeners hear at once so
 * the count ticks as the item arrives. A flight held on a stub since cleared or reset adds nothing.
 */
export function landFlight(hold) {
    if (!hold) return;
    const s = stubs.get(hold.itemId);
    if (!s || s.uid !== hold.uid || !s.held) return;
    stubs.set(hold.itemId, { ...s, held: Math.max(0, s.held - hold.qty) });
    emitNow();
}

/**
 * The stubs as the column draws them: pinned ones first, in the order they were pinned, then the
 * rest, the newest arrival at the bottom and the most recently unpinned at the top.
 */
export function getStubs() {
    const all = [...stubs.values()];
    const pinned = all.filter(s => s.pinned).sort((a, b) => a.pinSlot - b.pinSlot);
    const rest = all.filter(s => !s.pinned).sort((a, b) => a.slot - b.slot);
    return [...pinned, ...rest];
}

export function getStub(itemId) {
    return stubs.get(itemId) || null;
}

/** Whether the stub appeared just now, so the column slides it in from the side. */
export const isFresh = (stub) => !!stub && clock() - stub.firstAt < ARRIVE_MS;

/**
 * Fade stubs whose item has been still for {@link FADE_MS}, and drop them {@link FADE_OUT_MS}
 * later. Pinned stubs never fade.
 * @returns {boolean} whether anything changed
 */
export function prune() {
    const now = clock();
    let any = false;
    for (const [itemId, s] of stubs) {
        if (s.pinned || s.leaving) continue;
        const idle = now - s.lastChangedAt;
        if (idle >= FADE_MS + FADE_OUT_MS) {
            stubs.delete(itemId);
            any = true;
        } else if (idle >= FADE_MS && !s.fading) {
            stubs.set(itemId, { ...s, fading: true });
            any = true;
        }
    }
    if (any) changed();
    return any;
}

/** Whether any stub could still fade, so the fade timer has work. */
export function hasUnpinned() {
    for (const s of stubs.values()) if (!s.pinned && !s.leaving) return true;
    return false;
}

function startLeaving(itemId, s) {
    const out = { ...s, leaving: true };
    stubs.set(itemId, out);
    setTimeout(() => { if (stubs.get(itemId) === out) { stubs.delete(itemId); emitNow(); } }, LEAVE_MS);
}

/** Clear one unpinned stub (right-click): it slides out and goes. A pinned stub is reset instead. */
export function remove(itemId) {
    const s = stubs.get(itemId);
    if (!s || s.leaving) return;
    if (s.pinned) { resetPin(itemId); return; }
    startLeaving(itemId, s);
    emitNow();
}

/** Clear all: every unpinned stub goes. */
export function clearUnpinned() {
    let any = false;
    for (const [itemId, s] of stubs) {
        if (!s.pinned && !s.leaving) { startLeaving(itemId, s); any = true; }
    }
    if (any) emitNow();
}

/** Pin a stub: it keeps its count and never fades. */
export function pin(itemId) {
    const s = stubs.get(itemId);
    if (!s || s.pinned || s.leaving) return;
    const now = clock();
    stubs.set(itemId, { ...s, pinned: true, pinnedAt: now, pinSlot: ++lastPinSlot, fading: false, lastChangedAt: now, isNew: false });
    emitNow();
}

/** Unpin: an ordinary stub again, fading {@link FADE_MS} from now unless its item moves. */
export function unpin(itemId) {
    const s = stubs.get(itemId);
    if (!s || !s.pinned) return;
    stubs.set(itemId, { ...s, pinned: false, pinnedAt: null, slot: --firstSlot, lastChangedAt: clock() });
    emitNow();
}

/** A pinned stub back to +0. Loot already flying to it was counted before the reset, so it is let go. */
export function resetPin(itemId) {
    const s = stubs.get(itemId);
    if (!s || !s.pinned) return;
    stubs.set(itemId, { ...s, added: 0, removed: 0, held: 0, uid: ++nextUid });
    emitNow();
}

/** Whether any stub is pinned. */
export function hasPins() {
    for (const s of stubs.values()) if (s.pinned) return true;
    return false;
}

/** The pins as the save keeps them: `[{ itemId, added, removed }]`, in pin order. */
export function serializePins() {
    return getStubs().filter(s => s.pinned).map(s => ({ itemId: s.itemId, added: s.added, removed: s.removed }));
}

/**
 * Put a save's pins back. Malformed entries are skipped: a pin is a convenience, never a reason
 * for a load to fail.
 */
export function loadPins(list) {
    if (!Array.isArray(list)) return;
    const now = clock();
    for (const p of list) {
        if (!p || typeof p.itemId !== 'string' || !p.itemId) continue;
        const added = Number.isFinite(p.added) && p.added > 0 ? p.added : 0;
        const removed = Number.isFinite(p.removed) && p.removed > 0 ? p.removed : 0;
        stubs.set(p.itemId, {
            ...freshStub(p.itemId, now),
            added,
            removed,
            pinned: true,
            pinnedAt: now,
            pinSlot: ++lastPinSlot
        });
    }
    emitNow();
}

/** Forget every stub, pinned or not (a new game or a load). */
export function reset() {
    stubs.clear();
    pendingNew.clear();
    unseen.clear();
    emitNow();
}
