// Fantasy Guild — where collected loot flies, and how big it is on the way (Q5: FB-16, FB-17)

import { boardScaleAt } from '../components/base/TokenSprite.jsx';

/**
 * Items come from 32px art and are drawn at half the board's Token scale on the
 * floor (64 mat units at the natural 2x). `SpriteLayerView` sizes the floor
 * sprite with {@link lootSpriteMatPx}; the flight uses {@link lootSpriteScreenPx}.
 */
export const FLOOR_ITEM_PX = 64;

/** A loot sprite's size in MAT UNITS at a mat fit (what `SpriteLayerView` draws). */
export const lootSpriteMatPx = (fit = 1) => FLOOR_ITEM_PX * (boardScaleAt(fit) / 2);

/**
 * A loot sprite's size in SCREEN PIXELS at a mat fit: the mat-unit size through
 * the mat's transform. Always a whole multiple of 32 (FP-99), so a flying item
 * is exactly as big as the one that lay on the floor (FB-17).
 */
export const lootSpriteScreenPx = (fit = 1) => {
    const f = Number.isFinite(fit) && fit > 0 ? fit : 1;
    return Math.round(lootSpriteMatPx(f) * f);
};

/** The Guild Hall's art on the mat (`MatToken` marks it). */
export const HALL_SELECTOR = '[data-token-art][data-guild-hall="true"]';
/** The old landing spot: the Item Bank bubble (D-232). */
export const BANK_TARGET_ID = 'bank-bubble-target';

const inViewport = (r, w, h) => r.right >= 0 && r.bottom >= 0 && r.left <= w && r.top <= h;

/**
 * ⭐ **Where a collected item flies to** (FB-16): the Guild Hall Token on the
 * mat, read live from the DOM so a dragged Hall or a resized mat is followed.
 *
 * Falls back to the Bank bubble when the Hall cannot be the target: not on the
 * mat (no element), hidden (in the player's hand mid-drag), zero-sized, or off
 * the screen. Returns `null` when neither exists — the item is still banked,
 * nothing just draws.
 *
 * @param {Document} doc
 * @param {{ width: number, height: number }} viewport
 * @returns {{ target: 'hall'|'bank', rect: DOMRect|object }|null}
 */
export function lootFlightTarget(doc = globalThis.document, viewport = null) {
    if (!doc) return null;
    const w = viewport?.width ?? globalThis.window?.innerWidth ?? Infinity;
    const h = viewport?.height ?? globalThis.window?.innerHeight ?? Infinity;

    const hall = doc.querySelector(HALL_SELECTOR);
    if (hall) {
        const r = hall.getBoundingClientRect();
        const hidden = hall.style?.visibility === 'hidden';
        if (!hidden && r.width > 0 && r.height > 0 && inViewport(r, w, h)) {
            return { target: 'hall', rect: r };
        }
    }
    const bank = doc.getElementById(BANK_TARGET_ID);
    if (bank) return { target: 'bank', rect: bank.getBoundingClientRect() };
    return null;
}
