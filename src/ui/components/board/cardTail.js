import { SPEECH_LINE, SPEECH_TONE, speechFillOf } from './speechTone.js';

/**
 * The Token card's tail: the speech bubble's stepped pixel point (`SpeechFrame`) on whichever
 * edge of the card faces its Token, aimed at the Token. Pure, so where it lands is tested without
 * a screen.
 */

/** One frame pixel in screen px: the frames' 3-pixel pictures are drawn at 2×. */
export const TAIL_ART_PX = 2;

/**
 * The point in tail-local pixels: `u` along the card's edge, `v` out from it. Row 0 lies over the
 * frame's line, so the card opens into the tail; row 3 is the tip.
 */
const ROWS = [[0, 7], [1, 5], [2, 3], [3, 1]];
const BASE = 3;
const TIP = ROWS.length - 1;
/** Its hard shadow, like the frame's: 2 frame pixels down-right whichever way it points. */
const SHADOW = 2;

/** Which way the tail points for each side of the Token the card stands on. */
export const TAIL_POINT = Object.freeze({ top: 'down', bottom: 'up', right: 'left', left: 'right' });

/** Tail-local (u, v) to picture (x, y), for each way it points. */
const TO_PICTURE = Object.freeze({
    down: (u, v) => [u, v],
    up: (u, v) => [u, TIP - v],
    right: (u, v) => [v, u],
    left: (u, v) => [TIP - v, u]
});
/** Picture (x, y) back to how far out from the card's edge it is (`v`). */
const OUT_OF = Object.freeze({
    down: (x, y) => y,
    up: (x, y) => TIP - y,
    right: (x) => x,
    left: (x) => TIP - x
});

const px = (x, y) => `M${x} ${y}h1v1h-1z`;

/**
 * The tail's picture pointing `point`, in frame pixels: its SVG data URI and size, and where its
 * base's middle pixel is. The shadow is left off wherever it would fall inside the card, so it
 * never darkens the card's own frame.
 */
export function tailPicture(point, tone = SPEECH_TONE.PLAIN) {
    const toPic = TO_PICTURE[point] || TO_PICTURE.down;
    const outOf = OUT_OF[point] || OUT_OF.down;
    const edge = [];
    const fill = [];
    ROWS.forEach(([x0, w], v) => {
        for (let u = x0; u < x0 + w; u++) {
            const onEdge = u === x0 || u === x0 + w - 1;
            (onEdge ? edge : fill).push(toPic(u, v));
        }
    });
    const drawn = new Set([...edge, ...fill].map(([x, y]) => `${x},${y}`));
    const shadow = [...edge, ...fill]
        .map(([x, y]) => [x + SHADOW, y + SHADOW])
        .filter(([x, y]) => outOf(x, y) >= 0 && !drawn.has(`${x},${y}`));
    const all = [...edge, ...fill, ...shadow];
    const w = Math.max(...all.map(([x]) => x)) + 1;
    const h = Math.max(...all.map(([, y]) => y)) + 1;
    const line = (SPEECH_LINE[tone] || SPEECH_LINE[SPEECH_TONE.PLAIN]).replace('#', '%23');
    const fillColour = speechFillOf(tone).replace('#', '%23');
    const path = (cells) => cells.map(([x, y]) => px(x, y)).join('');
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' shape-rendering='crispEdges'>`
        + `<path fill='%23000' d='${path(shadow)}'/><path fill='${line}' d='${path(edge)}'/><path fill='${fillColour}' d='${path(fill)}'/></svg>`;
    const [baseX, baseY] = toPic(BASE, 0);
    return { uri: `url("data:image/svg+xml,${svg}")`, w, h, baseX, baseY, cells: { edge, fill, shadow } };
}

/** How far from the card's corners the tail's middle may go: past the chamfered corner. */
export const TAIL_INSET_PX = (3 + ROWS[0][1] / 2) * TAIL_ART_PX;

/** Rounds to the frame's art grid, so the tail's pixels line up with the frame's. */
const onGrid = (n) => Math.round(n / TAIL_ART_PX) * TAIL_ART_PX;

/**
 * Where the tail goes on a card placed at `card` (`left`, `top`, `w`, `h`, screen px) on side
 * `side` of its Token (`TokenInspectPopup`'s `dir`), aimed at the middle of `target` (the Token's
 * screen rectangle): the box's `left` and `top` relative to the card, its size, and which way it
 * points. Its base lies over the card's edge line; its middle follows the Token along that edge,
 * kept clear of the corners. Null with nothing to aim at.
 */
export function tailPlacement(side, card, target) {
    const point = TAIL_POINT[side];
    if (!point || !card || !target || !(card.w > 0) || !(card.h > 0)) return null;
    const pic = tailPicture(point);
    const a = TAIL_ART_PX;
    const across = point === 'down' || point === 'up';
    const size = across ? card.w : card.h;
    const aim = across
        ? target.left + target.width / 2 - card.left
        : target.top + target.height / 2 - card.top;
    const along = Math.min(size - TAIL_INSET_PX, Math.max(TAIL_INSET_PX, aim));
    // The base's middle pixel is centred on `along`; the rest of the box is laid from there.
    const start = onGrid(along - a / 2);
    let left;
    let top;
    if (across) {
        left = start - pic.baseX * a;
        top = point === 'down' ? card.h - a : -pic.baseY * a;
    } else {
        top = start - pic.baseY * a;
        left = point === 'right' ? card.w - a : -pic.baseX * a;
    }
    return { point, left, top, width: pic.w * a, height: pic.h * a, uri: pic.uri, along };
}
