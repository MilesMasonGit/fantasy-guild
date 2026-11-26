// What a Token cost the guild, and the sums of the two building perks on it: Build Discount off a price, Salvage back from it
//
// ⚠️ THE CMS IMPORTS THIS FILE ACROSS THE PROJECT BOUNDARY (the effect stack audit,
// `src/systems/core/effectStackRule.js`). Pure, with no imports.

/**
 * What a Token cost is kept on it as `paid: { items: [{ itemId, quantity }], coins }`
 * (`BuildPrices.js` writes and reads it): its Shop price as bought, and for a building its
 * Foundation's and the build's materials as paid. Absent: the guild paid nothing for it, or it was
 * bought before the record was kept.
 */

/** ⭐ Game value: the most Build Discount takes off a price, in percent, however much a hero holds. */
export const MAX_BUILD_DISCOUNT = 50;

/** The most Salvage gives back, in percent: all of what was paid, never more. */
export const MAX_SALVAGE = 100;

/** A percent held to 0..`max`; anything not a number is 0. */
function heldTo(n, max) {
    const value = Number(n);
    return Number.isFinite(value) ? Math.min(max, Math.max(0, value)) : 0;
}

/** A Build Discount as it is applied: 0 to {@link MAX_BUILD_DISCOUNT}. */
export const buildDiscountOf = (n) => heldTo(n, MAX_BUILD_DISCOUNT);

/** A Salvage share as it is applied: 0 to {@link MAX_SALVAGE}. */
export const salvageShareOf = (n) => heldTo(n, MAX_SALVAGE);

// ⚠️ A tiny allowance before rounding: 3 × 70 / 100 is 2.0999…, which must round up to 3, not 2.
const EPSILON = 1e-9;

/** `quantity` with `discount` percent off, rounded up to whole: a price comes down by no more than the cut says. */
export function discounted(quantity, discount) {
    const q = Math.max(0, Number(quantity) || 0);
    const d = buildDiscountOf(discount);
    if (!(d > 0)) return q;
    return Math.ceil(q * (100 - d) / 100 - EPSILON);
}

/** The share of `quantity` Salvage at `share` percent gives back, rounded down to whole. */
export function salvaged(quantity, share) {
    const q = Math.max(0, Number(quantity) || 0);
    return Math.floor(q * salvageShareOf(share) / 100 + EPSILON);
}

/** A price's item lines with `discount` percent off each, rounded up. */
export function discountedLines(lines, discount) {
    return (lines || []).map(line => ({ ...line, quantity: discounted(line.quantity, discount) }));
}

/** A whole number of 0 or more, else 0. */
const whole = (n) => {
    const value = Math.floor(Number(n) || 0);
    return value > 0 ? value : 0;
};

/**
 * A `paid` record as the game reads it: `{ items, coins }`, each item line `{ itemId, quantity }`
 * with a whole quantity above 0, merged per item in the order first named; null when it holds
 * nothing (or is not a record).
 */
export function paidRecord(record) {
    if (!record || typeof record !== 'object') return null;
    const items = [];
    for (const line of Array.isArray(record.items) ? record.items : []) {
        const quantity = whole(line?.quantity);
        if (typeof line?.itemId !== 'string' || !line.itemId || quantity <= 0) continue;
        const same = items.find(l => l.itemId === line.itemId);
        if (same) same.quantity += quantity;
        else items.push({ itemId: line.itemId, quantity });
    }
    const coins = whole(record.coins);
    return items.length || coins ? { items, coins } : null;
}

/** Two `paid` records as one: their items merged per item, their coins added. Null when both hold nothing. */
export function addPaid(a, b) {
    return paidRecord({
        items: [...(paidRecord(a)?.items || []), ...(paidRecord(b)?.items || [])],
        coins: (paidRecord(a)?.coins || 0) + (paidRecord(b)?.coins || 0)
    });
}

/**
 * What Salvage at `share` percent gives back of a `paid` record: each line and the coins rounded
 * down, lines that come to nothing left out. Null when nothing comes back.
 */
export function salvagedPrice(record, share) {
    const paid = paidRecord(record);
    if (!paid || !(salvageShareOf(share) > 0)) return null;
    return paidRecord({
        items: paid.items.map(line => ({ itemId: line.itemId, quantity: salvaged(line.quantity, share) })),
        coins: salvaged(paid.coins, share)
    });
}
