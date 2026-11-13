/** The attribute a hovered banner puts on the hero or Token it is about (a CSS rule draws it). */
export const BANNER_OUTLINE_ATTR = 'data-banner-outline';

/** Where a subject is drawn: a hero on the mat and in the dock, a Token's art on the mat. */
export function subjectSelectors({ type, id }) {
    const v = String(id).replace(/["\\]/g, '\\$&');
    if (type === 'hero') return [`[data-board-hero="${v}"]`, `[data-dock-hero="${v}"] [data-dock-art]`];
    if (type === 'token') return [`[data-token-art="true"][data-token-id="${v}"]`];
    return [];
}

/**
 * Outline every subject of a hovered banner, gold or red, and clear whatever was outlined before.
 * An empty list clears. Only while a banner is hovered, so nothing is paid otherwise.
 * @param {{type: 'hero'|'token', id: string}[]} subjects
 * @param {'gold'|'red'} colour
 */
export function outlineSubjects(subjects, colour = 'gold') {
    if (typeof document === 'undefined') return;
    for (const el of document.querySelectorAll(`[${BANNER_OUTLINE_ATTR}]`)) el.removeAttribute(BANNER_OUTLINE_ATTR);
    for (const s of subjects || []) {
        for (const sel of subjectSelectors(s)) {
            for (const el of document.querySelectorAll(sel)) el.setAttribute(BANNER_OUTLINE_ATTR, colour);
        }
    }
}

/** The attribute a clicked banner's pulse puts on its subjects (a CSS rule plays it). */
export const BANNER_PULSE_ATTR = 'data-banner-pulse';

/** How long the pulse plays: the outline swaps between two golds, three times each (tailwind.css). */
export const PULSE_MS = 1200;

let pulseTimers = [];

function clearPulse() {
    for (const id of pulseTimers) clearTimeout(id);
    pulseTimers = [];
    if (typeof document === 'undefined') return;
    for (const el of document.querySelectorAll(`[${BANNER_PULSE_ATTR}]`)) el.removeAttribute(BANNER_PULSE_ATTR);
}

/**
 * A short gold pulse on every subject of a clicked banner, `delayMs` from now (after the camera has
 * come back to the mat), taken off again after {@link PULSE_MS}. A new pulse ends the last one.
 * @param {{type: 'hero'|'token', id: string}[]} subjects
 * @param {{delayMs?: number}} [options]
 */
export function pulseSubjects(subjects, { delayMs = 0 } = {}) {
    clearPulse();
    if (typeof document === 'undefined' || !subjects?.length) return;
    const start = () => {
        for (const s of subjects) {
            for (const sel of subjectSelectors(s)) {
                for (const el of document.querySelectorAll(sel)) el.setAttribute(BANNER_PULSE_ATTR, 'gold');
            }
        }
        pulseTimers.push(setTimeout(clearPulse, PULSE_MS));
    };
    if (delayMs > 0) pulseTimers.push(setTimeout(start, delayMs));
    else start();
}
