// Fantasy Guild — keeping speech bubbles from crowding each other (Hero Speech Bubbles slice SB-D)

/**
 * How far the little tail hangs below the bottom of a bubble, in mat units:
 * an 8 px square turned 45° and centred on the bubble's bottom edge
 * (`HeroBubbleLayer`), so its tip is half a diagonal (~5.7) down.
 */
export const BUBBLE_TAIL_PX = 6;

/** Clear air between the tail's tip and the top of the hero's head. */
export const BUBBLE_HEAD_GAP_PX = 2;

/**
 * ⭐ **Where a hero's stack of bubbles sits: the tail just above the head**
 * (Token Lifecycle feedback Q6, FB-20).
 *
 * The hero's art is a square of `artPx` mat units centred on the hero's point,
 * and the head reaches the very top of it (the shipped sheets have their
 * first opaque row at 0–3 of 64). The art's size in mat units changes with the
 * mat's scale (`boardScaleAt`: it steps to whole screen pixels while the mat
 * glides), so the anchor is read from the art, not from the hero's fixed
 * 64 × 128 hit box — that fixed box is what put the bubble over the head
 * before, worse the smaller the mat was drawn.
 *
 * @param {number} heroY  the hero's point, mat units
 * @param {number} artPx  the hero's art size, mat units (`tokenSizeFor(BOARD, 1, boardScaleAt(fit))`)
 * @returns {number} the y the bottom of the stack sits on
 */
export function bubbleAnchorY(heroY, artPx) {
    return heroY - artPx / 2 - BUBBLE_TAIL_PX - BUBBLE_HEAD_GAP_PX;
}

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
