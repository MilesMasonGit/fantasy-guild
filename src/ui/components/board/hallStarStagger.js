// The Guild Hall sky's title rule: stars whose titles would overlap are moved down when drawn.

/** The gap kept between a title and anything else, in screen pixels. */
export const TITLE_GAP_PX = 4;
/** The space between a star and its title (`tagPlacement` in GuildHallBoard). */
export const TITLE_DROP_PX = 2;
/** The furthest a star is ever moved; a sky that needs more is left as it is past that. */
const MAX_NUDGE_PX = 160;

/**
 * A star's two boxes at a downward move `dy`: its drawn star (`px` square, centred on its place) and
 * its title (`w` wide, centred under it). All in screen pixels.
 */
function boxes(s, dy) {
    const y = s.y + dy;
    const half = s.px / 2;
    const titleTop = y + half + TITLE_DROP_PX;
    return {
        star: { l: s.x - half, r: s.x + half, t: y - half, b: y + half },
        title: { l: s.x - s.w / 2, r: s.x + s.w / 2, t: titleTop, b: titleTop + s.h }
    };
}

const hits = (a, b, gap) => a.l < b.r + gap && b.l < a.r + gap && a.t < b.b + gap && b.t < a.b + gap;

/** True when either star's title overlaps the other's title or star. */
function clash(a, da, b, db, gap) {
    const A = boxes(a, da);
    const B = boxes(b, db);
    return hits(A.title, B.title, gap) || hits(A.title, B.star, gap) || hits(B.title, A.star, gap);
}

/**
 * The drawing-time rule that keeps star titles apart (the authored places never change). Stars
 * whose titles share a band and touch stand side by side: every second one of such a row, left to
 * right, drops by the least amount that clears the whole row, a stagger. Any clash left after that
 * (one star's title over the star below it) moves the lower star down just clear of it.
 * @param {Array<{ id: string, x: number, y: number, px: number, w: number, h: number }>} stars each
 *   star's place, its drawn size, and its title's measured width and height, in screen pixels
 * @param {{ gap?: number }} [opts]
 * @returns {Map<string, number>} the stars moved, each with how far down, in whole pixels
 */
export function staggerStars(stars, { gap = TITLE_GAP_PX } = {}) {
    const list = (stars || []).filter(s => s && Number.isFinite(s.x) && Number.isFinite(s.y));
    const dy = new Map(list.map(s => [s.id, 0]));
    const at = (s) => dy.get(s.id);

    // Rows: stars side by side, titles in one band, joined by a clash.
    const sameBand = (a, b) => Math.abs(a.y - b.y) <= Math.max(a.h, b.h) + TITLE_DROP_PX;
    const row = new Map();
    const rows = [];
    for (const a of list) {
        for (const b of list) {
            if (a === b || !sameBand(a, b) || !clash(a, 0, b, 0, gap)) continue;
            const ra = row.get(a.id);
            const rb = row.get(b.id);
            if (ra && rb && ra !== rb) {
                for (const s of rb) { ra.push(s); row.set(s.id, ra); }
                rows.splice(rows.indexOf(rb), 1);
            } else if (!ra && !rb) {
                const r = [a, b];
                rows.push(r);
                row.set(a.id, r);
                row.set(b.id, r);
            } else if (!ra) {
                rb.push(a);
                row.set(a.id, rb);
            } else if (!rb) {
                ra.push(b);
                row.set(b.id, ra);
            }
        }
    }
    for (const r of rows) {
        r.sort((a, b) => a.x - b.x || a.y - b.y);
        const dropped = r.filter((_, i) => i % 2 === 1);
        const clear = (d) => r.every((a, i) => r.every((b, j) => j <= i
            || !clash(a, i % 2 ? d : 0, b, j % 2 ? d : 0, gap)));
        let d = 1;
        while (d < MAX_NUDGE_PX && !clear(d)) d += 1;
        for (const s of dropped) dy.set(s.id, d);
    }

    // What is left: a lower star under another's title moves down, top to bottom.
    const order = [...list].sort((a, b) => a.y - b.y || a.x - b.x);
    for (let pass = 0; pass < 4; pass++) {
        let moved = false;
        for (let i = 0; i < order.length; i++) {
            for (let j = 0; j < order.length; j++) {
                if (i === j) continue;
                const a = order[i];
                const b = order[j];
                const lower = a.y + at(a) > b.y + at(b) || (a.y + at(a) === b.y + at(b) && a.x > b.x) ? a : b;
                if (lower !== a) continue;
                if (!clash(a, at(a), b, at(b), gap)) continue;
                let d = at(a);
                while (d < MAX_NUDGE_PX && clash(a, d, b, at(b), gap)) d += 1;
                if (d !== at(a)) { dy.set(a.id, d); moved = true; }
            }
        }
        if (!moved) break;
    }

    return new Map([...dy].filter(([, d]) => d > 0).map(([id, d]) => [id, Math.round(d)]));
}

/** The pairs of stars whose titles still clash with these moves: none, unless the sky needs more than the cap. */
export function titleClashes(stars, moves = new Map(), { gap = TITLE_GAP_PX } = {}) {
    const out = [];
    for (let i = 0; i < stars.length; i++) {
        for (let j = i + 1; j < stars.length; j++) {
            const a = stars[i];
            const b = stars[j];
            if (clash(a, moves.get(a.id) || 0, b, moves.get(b.id) || 0, gap)) out.push([a.id, b.id]);
        }
    }
    return out;
}
