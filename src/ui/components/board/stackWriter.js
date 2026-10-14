/**
 * Writes each mat Token's place in the stack (`createMatStack`'s z) straight onto its two boxes,
 * the art and the badges, instead of handing it down as a prop. As a prop, a Token's change of
 * place would redraw the Token; here it is one style write per box whose z actually changed, and
 * the stack keeps every other Token's z when one moves, so a move writes that Token's boxes only.
 * The boxes never render a `zIndex` themselves, so React never writes over what is set here.
 * The badges sit two above the art (`matLayers.js`: art, the hero working it, then badges).
 */
export function createStackWriter() {
    /** Token id → its boxes, each with the z last written to it. */
    const boxes = new Map();
    let zById = null;

    const put = (box, z) => {
        if (!box.el || box.z === z) return;
        box.z = z;
        box.el.style.zIndex = z;
    };
    const write = (id, b) => {
        const z = zById?.get(id);
        if (z == null) return;
        put(b.art, String(z));
        put(b.badges, String(z + 2));
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
                b = { art: { el: null, z: null }, badges: { el: null, z: null } };
                boxes.set(id, b);
            }
            b[part] = { el, z: el ? el.style.zIndex : null };
            if (!b.art.el && !b.badges.el) boxes.delete(id);
            else if (el) write(id, b);
        },
        /** The mat's new order: every box whose z changed is written. */
        apply(next) {
            zById = next;
            for (const [id, b] of boxes) write(id, b);
        }
    };
}
