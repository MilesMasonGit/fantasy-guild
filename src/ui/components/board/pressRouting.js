import { pointerToMat } from './matPoint.js';
import { updateAlphaPointerEvents } from '../../utils/alphaHitTest.js';
import { flagClothOver, onFlagCloth } from './flagCloth.js';

/** Everything a press on a Token is made of, routed alike so a click lands where its press did. */
export const PRESS_EVENTS = Object.freeze(['pointerdown', 'click', 'dblclick', 'contextmenu']);

/** Events this file sent itself, which are already where they belong. */
const routed = new WeakSet();

const heroOf = (el) => el?.closest?.('[data-alpha-test]') ?? null;

/**
 * Where a press on the mat really lands, before the Token step below: a hero figure takes a press
 * only on a pixel drawn at that moment. Which hero boxes let the pointer through is set on each
 * pointer move (`alphaHitTest`), but a figure animates under a still pointer, so the press can
 * land on a box whose pixel there has since gone see-through (nothing would start), or pass
 * through one that has since turned solid. The pass-through is brought up to date for this
 * press, and the browser asked again what is on top.
 * @returns {Element} the element the press belongs to
 */
function throughHeroes(e, matEl) {
    const target = e.target;
    if (e.type !== 'pointerdown' || typeof document === 'undefined' || typeof document.elementFromPoint !== 'function') return target;
    if (!updateAlphaPointerEvents(e.clientX, e.clientY)) return target;
    const top = document.elementFromPoint(e.clientX, e.clientY);
    if (!top || top === target || !matEl.contains(top)) return target;
    if (top.contains?.(target) || target?.contains?.(top)) return target;
    return heroOf(target) || heroOf(top) ? top : target;
}

/**
 * A press on the mat belongs to what is drawn under the pointer at that moment.
 * - **A hero** only on a drawn pixel of its figure ({@link throughHeroes}): through a see-through
 * pixel the press reaches the flag or Token beneath, so a hero never hides its own flag.
 * - **A flag** over a Token's circle only on its cloth, where the flag is drawn in front of that
 * Token (`flagCloth.js`).
 * - **A Token** where two circles overlap: the Token the game says is under the pointer
 * (`tokenAtPoint`: of the circles holding the point, the nearest centre), whichever is drawn on
 * top there. Each Token takes the pointer only inside its own circle (`MatToken`'s
 * `data-token-hit`). Usually the hover has already raised the right Token to the front
 * (`MatBoard`); this covers a press with no pointer move before it, such as just after a drop or
 * when a Token slid under a still pointer.
 *
 * Called in the capture phase on the mat: a press that belongs elsewhere is stopped before it
 * reaches the element it landed on, and a copy is sent to the right one, where its own drag,
 * click and right-click listeners take it.
 * @param {Event} e
 * @param {HTMLElement} matEl the mat (`data-mat-board`), whose box maps the pointer to mat units
 * @param {(point: {x: number, y: number}) => {id: string}|null} tokenAtPoint
 * @returns {Element|null} the element the press was sent on to, or null when it stood
 */
export function routePress(e, matEl, tokenAtPoint) {
    if (routed.has(e) || !matEl) return null;
    const landed = throughHeroes(e, matEl);
    // The flags' give-way over Tokens is set on pointer moves; a press with none before it (just
    // after a drop, or a tap) asks afresh, both ways.
    const token = tokenOwning(landed, e, matEl, tokenAtPoint) ?? tokenUnderFlag(landed, e, matEl, tokenAtPoint);
    const cloth = token ? flagClothOver(matEl, e.clientX, e.clientY, token.getAttribute('data-token-hit')) : null;
    const to = cloth ?? token ?? landed;
    if (!to || to === e.target) return null;

    e.stopPropagation();
    const copy = new e.constructor(e.type, e);
    routed.add(copy);
    if (!to.dispatchEvent(copy)) e.preventDefault();
    return to;
}

/** The hit circle of the Token a press on `landed` belongs to, or null when it is not on a Token. */
function tokenOwning(landed, e, matEl, tokenAtPoint) {
    const hit = landed?.closest?.('[data-token-hit]');
    if (!hit) return null;
    const id = tokenIdAt(e, matEl, tokenAtPoint);
    if (!id || id === hit.getAttribute('data-token-hit')) return hit;
    return hitCircleOf(matEl, id) ?? hit;
}

/** The hit circle of the Token under a press that landed on a flag off its cloth, or null. */
function tokenUnderFlag(landed, e, matEl, tokenAtPoint) {
    const flag = landed?.closest?.('[data-flag]');
    if (!flag || onFlagCloth(flag, e.clientX, e.clientY)) return null;
    const id = tokenIdAt(e, matEl, tokenAtPoint);
    return id ? hitCircleOf(matEl, id) : null;
}

/** The id of the Token the game says is under the press, or null. */
function tokenIdAt(e, matEl, tokenAtPoint) {
    const point = pointerToMat({ x: e.clientX, y: e.clientY }, matEl.getBoundingClientRect());
    return point ? (tokenAtPoint(point)?.id ?? null) : null;
}

const hitCircleOf = (matEl, id) => [...matEl.querySelectorAll('[data-token-hit]')].find(el => el.getAttribute('data-token-hit') === id) ?? null;

/** Route every press on `matEl` (see {@link routePress}). Returns the undo. */
export function installPressRouting(matEl, tokenAtPoint) {
    const onPress = (e) => { routePress(e, matEl, tokenAtPoint); };
    for (const type of PRESS_EVENTS) matEl.addEventListener(type, onPress, true);
    return () => {
        for (const type of PRESS_EVENTS) matEl.removeEventListener(type, onPress, true);
    };
}
