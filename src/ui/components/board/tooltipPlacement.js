// Fantasy Guild — where a floating mat tooltip sits on screen (shared by the flag and Hall tooltips)

/**
 * Fixed-position place for a floating panel under an anchor element, kept on
 * screen: below it when there is room, above it otherwise, and never past the
 * window's left or right edge.
 *
 * @param {Element|null} anchor
 * @param {number} width   the panel's width in px
 * @param {number} [height] a guess at the panel's height in px, to decide above or below
 * @returns {{ left: number, top: number }}
 */
export function placeUnder(anchor, width, height = 180) {
    const rect = anchor?.getBoundingClientRect?.();
    if (!rect || typeof window === 'undefined') return { left: 0, top: 0 };
    const margin = 8;
    const left = Math.max(margin, Math.min(window.innerWidth - width - margin, rect.left));
    const below = rect.bottom + margin;
    const top = below + height > window.innerHeight ? Math.max(margin, rect.top - height - margin) : below;
    return { left, top };
}
