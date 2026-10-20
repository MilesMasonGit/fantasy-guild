import { useLayoutEffect, useRef } from 'react';

/**
 * Stubs glide to a new place instead of jumping (one above leaves, a pin or unpin, the column
 * starting or stopping scrolling): FLIP on the CSS `translate` property, so it never fights the
 * `transform` the stubs slide in and out of the edge with.
 *
 * Per column render (at most once per store emit): one batch of reads, then writes only for the
 * stubs that moved, one forced style flush, and the browser runs the transition. Nothing is
 * touched at rest. With reduced motion the stubs just move.
 */

export const GLIDE_MS = 280;

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The translate a gliding stub is at right now, in px down (0 when it is not gliding). */
export function glideShift(el) {
    if (!el.dataset.stubGliding) return 0;
    const t = getComputedStyle(el).translate;
    if (!t || t === 'none') return 0;
    const parts = t.split(' ');
    return parseFloat(parts[1] ?? '0') || 0;
}

function endGlide(e) {
    if (e.propertyName !== 'translate') return;
    const el = e.currentTarget;
    el.removeEventListener('transitionend', endGlide);
    delete el.dataset.stubGliding;
    el.style.translate = '';
}

/** Run after every render of the column whose box is `boxRef`. */
export function useStubGlide(boxRef) {
    const last = useRef({ tops: new Map(), scrolled: new Set(), scrollTop: null });
    useLayoutEffect(() => {
        const box = boxRef.current;
        if (!box) return;
        const scroller = box.querySelector('[data-stubs-scroll]');
        const scrollTop = scroller ? scroller.scrollTop : null;
        const scrollMoved = scroller && last.current.scrollTop !== null ? scrollTop - last.current.scrollTop : 0;
        const boxTop = box.getBoundingClientRect().top;
        const tops = new Map();
        const scrolled = new Set();
        const moves = [];
        for (const el of box.querySelectorAll('[data-item-stub]')) {
            const id = el.dataset.itemStub;
            const shift = glideShift(el);
            const top = el.getBoundingClientRect().top - boxTop - shift;
            const inScroller = !!scroller && scroller.contains(el);
            tops.set(id, top);
            if (inScroller) scrolled.add(id);
            const before = last.current.tops.get(id);
            // A stub just made (or made again after a clear) slides in from the edge instead.
            if (before === undefined || el.dataset.stubArriving) continue;
            // A list scrolled by hand is not a move.
            const expected = inScroller && last.current.scrolled.has(id) ? before - scrollMoved : before;
            const dy = expected - top + shift;
            if (Math.abs(expected - top) > 0.5 && Math.abs(dy) > 0.5) moves.push([el, dy]);
        }
        last.current = { tops, scrolled, scrollTop };
        if (!moves.length || reducedMotion()) return;
        for (const [el, dy] of moves) {
            el.dataset.stubSnap = 'true';
            el.style.translate = `0 ${dy}px`;
        }
        box.getBoundingClientRect();
        for (const [el] of moves) {
            delete el.dataset.stubSnap;
            el.dataset.stubGliding = 'true';
            el.style.translate = '0 0';
            el.addEventListener('transitionend', endGlide);
        }
    });
}

/**
 * Where a stub is on screen, for anything that flies to it (collected loot): its box, and whether
 * it can be seen (false when the list has it scrolled out of view). Null when the item has no
 * stub drawn (no stub yet, item stubs switched off, or the drawing is off).
 * @returns {{ rect: DOMRect, inView: boolean } | null}
 */
export function stubScreenSpot(itemId) {
    if (typeof document === 'undefined' || !itemId) return null;
    const column = document.querySelector('[data-item-stubs]');
    const el = column && [...column.querySelectorAll('[data-item-stub]')].find(e => e.dataset.itemStub === itemId);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const scroller = el.closest('[data-stubs-scroll]');
    let inView = true;
    if (scroller) {
        const view = scroller.getBoundingClientRect();
        inView = rect.top >= view.top - 1 && rect.bottom <= view.bottom + 1;
    }
    return { rect, inView };
}
