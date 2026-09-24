// Fantasy Guild — keeping speech bubbles from crowding each other (Hero Speech Bubbles slice SB-D)

/**
 * ⭐ **Where each hero's stack of bubbles really goes** (SB-4).
 *
 * Every stack starts centred over its hero's head, its bottom edge on the
 * anchor. With up to eight heroes that puts bubbles on top of each other, so:
 *
 * 1. a stack is **clamped inside the mat** — never off the left, right or top;
 * 2. a stack that would overlap one already placed **slides sideways** to the
 *    nearest free spot (the smallest nudge wins, so it stays close to its hero);
 * 3. if there is no room beside, it is **lifted above** what it collided with.
 *
 * Earlier items in the list keep their place; later ones give way, so the
 * result depends only on the order given (the caller passes a stable one).
 * Pure — sizes and positions in, offsets out.
 *
 * @param {{id: string, x: number, y: number, w: number, h: number}[]} items
 *        `x` is the hero's centre, `y` the anchor the stack's bottom sits on.
 * @param {{w: number, h: number}} bounds  the mat
 * @returns {Map<string, {dx: number, dy: number}>} offsets to add to the anchor
 */
export function layoutStacks(items, bounds, gap = 4) {
    const placed = [];
    const out = new Map();

    const rectOf = (it, dx, dy) => ({
        left: it.x - it.w / 2 + dx,
        right: it.x + it.w / 2 + dx,
        top: it.y - it.h + dy,
        bottom: it.y + dy
    });
    const hits = (a, b) => a.left < b.right + gap && a.right + gap > b.left && a.top < b.bottom + gap && a.bottom + gap > b.top;
    const clampDx = (it, dx) => {
        // Wider than the mat: centre it and give up on fitting.
        if (it.w >= bounds.w) return (bounds.w / 2) - it.x;
        return Math.min(Math.max(dx, -(it.x - it.w / 2)), bounds.w - (it.x + it.w / 2));
    };
    const clampDy = (it, dy) => Math.max(dy, it.h - it.y);          // top edge ≥ 0

    for (const it of items) {
        const dy0 = clampDy(it, 0);
        const free = (dx, dy) => {
            const r = rectOf(it, dx, dy);
            return placed.every(p => !hits(r, p));
        };

        let dx = clampDx(it, 0);
        let dy = dy0;

        if (!free(dx, dy)) {
            // Candidate nudges: just clear of each placed rect, either side.
            const home = it.x - it.w / 2;
            const candidates = [];
            for (const p of placed) {
                candidates.push(clampDx(it, p.right + gap - home));
                candidates.push(clampDx(it, p.left - gap - it.w - home));
            }
            candidates.sort((a, b) => Math.abs(a) - Math.abs(b));
            const beside = candidates.find(c => free(c, dy0));
            if (beside !== undefined) {
                dx = beside;
            } else {
                // No room beside: lift above whatever is in the way, until clear.
                for (let i = 0; i < 12 && !free(dx, dy); i += 1) {
                    const r = rectOf(it, dx, dy);
                    const blocker = placed.filter(p => hits(r, p)).reduce((m, p) => Math.min(m, p.top), Infinity);
                    dy = blocker - gap - it.y;
                }
                dy = clampDy(it, dy);
            }
        }

        out.set(it.id, { dx, dy });
        placed.push(rectOf(it, dx, dy));
    }
    return out;
}
