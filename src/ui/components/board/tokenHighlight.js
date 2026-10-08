/** The attribute the Token Summary puts on the art of every Token of the hovered type. */
export const HIGHLIGHT_ATTR = 'data-summary-highlight';

/**
 * Highlight every Token of one type on the mat, and un-highlight whatever was lit before. Null
 * clears. One attribute on the Token's art div (a CSS rule draws it), set only while a Summary row
 * is hovered, so a closed summary costs nothing per frame.
 * @param {string|null} typeId
 */
export function highlightType(typeId) {
    if (typeof document === 'undefined') return;
    for (const el of document.querySelectorAll(`[${HIGHLIGHT_ATTR}]`)) el.removeAttribute(HIGHLIGHT_ATTR);
    if (!typeId) return;
    for (const el of document.querySelectorAll('[data-token-art="true"][data-token-type]')) {
        if (el.getAttribute('data-token-type') === typeId) el.setAttribute(HIGHLIGHT_ATTR, 'true');
    }
}
