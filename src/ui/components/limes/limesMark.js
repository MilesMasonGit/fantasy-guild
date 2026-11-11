/**
 * The hard gold outline on whatever a Limes step names: the attention outline the Token Summary
 * already draws (`components.css`), put on by one attribute. Kept on while a step names a target
 * and re-put as the screen redraws (a drawer opening, a Token placed); nothing runs when no step
 * names one.
 */

export const LIMES_MARK_ATTR = 'data-limes-mark';
/** The mark's value on a step's target; a screen's small Limes carrying a step wears `'glow'`. */
const TARGET = 'target';

/** What a step may name, and how each is found on the page. */
export const LIMES_TARGET = Object.freeze({
    /** One Token on the mat, by instance id. */
    TOKEN: 'token',
    /** Every Token of a type on the mat. */
    TOKEN_TYPE: 'tokenType',
    /** A nav bubble: 'guild', 'bank', 'shop', 'atlas', 'encyclopedia'. */
    NAV: 'nav',
    /** An item's tile in the Bank. */
    BANK_ITEM: 'bankItem',
    /** A star in the Guild Hall, by upgrade id. */
    HALL_STAR: 'hallStar'
});

const cssString = (s) => String(s).replace(/["\\]/g, '\\$&');

/** The CSS selector for a step's target, or null for none or an unknown kind. */
export function limesTargetSelector(target) {
    if (!target || target.id == null) return null;
    const id = cssString(target.id);
    switch (target.kind) {
        case LIMES_TARGET.TOKEN: return `[data-token-art="true"][data-token-id="${id}"]`;
        case LIMES_TARGET.TOKEN_TYPE: return `[data-token-art="true"][data-token-type="${id}"]`;
        case LIMES_TARGET.NAV: return `[id="${id}-bubble-target"] > button`;
        case LIMES_TARGET.BANK_ITEM: return `[data-bank-item="${id}"]`;
        case LIMES_TARGET.HALL_STAR: return `[data-hall-node="${id}"]`;
        default: return null;
    }
}

/** Puts the mark on every element `selector` finds, and takes it off every other. */
export function applyLimesMark(selector, root = typeof document === 'undefined' ? null : document) {
    if (!root) return;
    const want = new Set(selector ? root.querySelectorAll(selector) : []);
    for (const el of root.querySelectorAll(`[${LIMES_MARK_ATTR}="${TARGET}"]`)) {
        if (!want.has(el)) el.removeAttribute(LIMES_MARK_ATTR);
    }
    for (const el of want) if (el.getAttribute(LIMES_MARK_ATTR) !== TARGET) el.setAttribute(LIMES_MARK_ATTR, TARGET);
}

/**
 * Keeps the mark on `target` until the returned stop is called: once now, then after any change
 * to the page's elements (one pass per frame at most).
 */
export function watchLimesMark(target) {
    if (typeof document === 'undefined') return () => {};
    const selector = limesTargetSelector(target);
    applyLimesMark(selector);
    if (!selector || typeof MutationObserver === 'undefined') return () => applyLimesMark(null);
    let frame = 0;
    let stopped = false;
    const observer = new MutationObserver(() => {
        if (frame) return;
        frame = requestAnimationFrame(() => { frame = 0; if (!stopped) applyLimesMark(selector); });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    // ⚠️ A pass already queued for the next frame must not put the mark back after the stop.
    return () => {
        stopped = true;
        if (frame) cancelAnimationFrame(frame);
        observer.disconnect();
        applyLimesMark(null);
    };
}
