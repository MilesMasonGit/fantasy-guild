/** The attribute a hovered banner puts on the hero or Token it is about (a CSS rule draws it). */
export const BANNER_OUTLINE_ATTR = 'data-banner-outline';

/** Where a subject is drawn: a hero on the mat and in the dock, a Token's art on the mat. */
export function subjectSelectors({ type, id }) {
    const v = String(id).replace(/["\\]/g, '\\$&');
    if (type === 'hero') return [`[data-board-hero="${v}"]`, `[data-dock-hero-id="${v}"] [data-hero-tab-face]`];
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
