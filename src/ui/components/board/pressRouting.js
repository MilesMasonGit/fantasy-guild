import { pointerToMat } from './matPoint.js';

/** Everything a press on a Token is made of, routed alike so a click lands where its press did. */
export const PRESS_EVENTS = Object.freeze(['pointerdown', 'click', 'dblclick', 'contextmenu']);

/** Events this file sent itself, which are already where they belong. */
const routed = new WeakSet();

/**
 * A press on a Token belongs to the Token the game says is under the pointer
 * (`tokenAtPoint`: of the circles holding the point, the nearest centre), whichever Token is drawn
 * on top there. Each Token takes the pointer only inside its own circle (`MatToken`'s
 * `data-token-hit`), so this matters only where two circles overlap. Usually the hover has already
 * raised the right Token to the front (`MatBoard`); this covers a press with no pointer move
 * before it, such as just after a drop or when a Token slid under a still pointer.
 *
 * Called in the capture phase on the mat: a press that belongs to another Token is stopped
 * before it reaches the one it landed on, and a copy is sent to the right Token's hit circle,
 * where its own drag, click and right-click listeners take it.
 * @param {Event} e
 * @param {HTMLElement} matEl the mat (`data-mat-board`), whose box maps the pointer to mat units
 * @param {(point: {x: number, y: number}) => {id: string}|null} tokenAtPoint
 * @returns {Element|null} the hit circle the press was sent on to, or null when it stood
 */
export function routePress(e, matEl, tokenAtPoint) {
    if (routed.has(e) || !matEl) return null;
    const hit = e.target?.closest?.('[data-token-hit]');
    if (!hit) return null;
    const point = pointerToMat({ x: e.clientX, y: e.clientY }, matEl.getBoundingClientRect());
    const id = point ? (tokenAtPoint(point)?.id ?? null) : null;
    if (!id || id === hit.getAttribute('data-token-hit')) return null;
    const to = [...matEl.querySelectorAll('[data-token-hit]')].find(el => el.getAttribute('data-token-hit') === id);
    if (!to) return null;

    e.stopPropagation();
    const copy = new e.constructor(e.type, e);
    routed.add(copy);
    if (!to.dispatchEvent(copy)) e.preventDefault();
    return to;
}

/** Route every press on `matEl` (see {@link routePress}). Returns the undo. */
export function installPressRouting(matEl, tokenAtPoint) {
    const onPress = (e) => { routePress(e, matEl, tokenAtPoint); };
    for (const type of PRESS_EVENTS) matEl.addEventListener(type, onPress, true);
    return () => {
        for (const type of PRESS_EVENTS) matEl.removeEventListener(type, onPress, true);
    };
}
