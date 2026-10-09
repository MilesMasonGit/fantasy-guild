/**
 * Writes each mat Token's place in the stack (`matStackOrder`'s z) straight onto its two boxes,
 * the art and the badges, instead of handing it down as a prop.
 * ⚠️ Ranks are dense: one Token moving, or the hover moving onto or off a Token, re-ranks every
 * Token in between. As a prop that redrew each of them, dozens of Tokens at every pickup and
 * drop on a busy mat. Here it is one style write per box whose z actually changed.
 * The boxes never render a `zIndex` themselves, so React never writes over what is set here.
 * The badges sit two above the art (`matLayers.js`: art, the hero working it, then badges).
 */
export function createStackWriter() {
    /** Token id → its boxes. */
    const boxes = new Map();
    let zById = null;

    const write = (id, b) => {
        const z = zById?.get(id);
        if (z == null) return;
        const art = String(z);
        const badges = String(z + 2);
        if (b.art && b.art.style.zIndex !== art) b.art.style.zIndex = art;
        if (b.badges && b.badges.style.zIndex !== badges) b.badges.style.zIndex = badges;
    };

    return {
        /**
         * A Token's box ref: `part` is `'art'` or `'badges'`, `el` the element, or null when it
         * goes. A box that arrives takes the latest z at once.
         */
        attach(id, part, el) {
            let b = boxes.get(id);
            if (!b) {
                if (!el) return;
                b = { art: null, badges: null };
                boxes.set(id, b);
            }
            b[part] = el;
            if (!b.art && !b.badges) boxes.delete(id);
            else if (el) write(id, b);
        },
        /** The mat's new order: every box whose z changed is written. */
        apply(next) {
            zById = next;
            for (const [id, b] of boxes) write(id, b);
        }
    };
}
