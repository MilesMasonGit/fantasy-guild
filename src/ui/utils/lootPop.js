import { signedAmount } from '../components/notifications/stubText.js';

/**
 * The amount gained, popped out of an item notice's side as collected loot lands on it
 * (`ParticleOverlay`): written as the notice writes its count ("+12", "+2.5k"), in the notice's own
 * font, size and black outline, made hard-edged. It slides out to the left (the mat side), flashes
 * white, turns the gain green, and fades in steps. Its picture is made once per landing, never per frame.
 */

/** How long the pop shows, from the landing. */
export const POP_MS = 750;
/** How far it slides out from the notice's side, in px. */
export const POP_TRAVEL_PX = 24;
/** How long it is white before it turns its colour. */
export const POP_WHITE_MS = 90;
/** The share of `POP_MS` the slide takes; then it holds and fades. */
const POP_SLIDE_SHARE = 0.4;
/** The fade: the last of `POP_MS`, in two steps. */
const POP_FADE_MS = 200;

/** The notice's count: its font (`font-pixel`, `ui-text-body`, bold) and gain colour (`--color-gi-success`). */
export const POP_FONT = 'bold 16px "Pixelify Sans", monospace';
export const POP_COLOUR = '#09b554';
/** Room round the text for its 1 px outline. */
const PAD = 2;

/** The pop's words for an amount gained. */
export const popText = (quantity) => signedAmount(quantity);

/**
 * The pop `ms` after the landing, or null once it is over: how far left it has slid (px), whether it
 * is still white, and its opacity step.
 */
export function popAt(ms) {
    if (!(ms >= 0) || ms >= POP_MS) return null;
    const t = Math.min(1, ms / (POP_MS * POP_SLIDE_SHARE));
    const out = Math.round(POP_TRAVEL_PX * (1 - (1 - t) ** 3));
    const fadeFrom = POP_MS - POP_FADE_MS;
    const alpha = ms < fadeFrom ? 1 : ms < fadeFrom + POP_FADE_MS / 2 ? 2 / 3 : 1 / 3;
    return { out, white: ms < POP_WHITE_MS, alpha };
}

/**
 * The pop's two pictures, white and coloured, each with the black outline: the text drawn once,
 * cut to hard pixels (no soft edge), its outline one pixel round it.
 * @returns {{ white: HTMLCanvasElement, coloured: HTMLCanvasElement, w: number, h: number }|null}
 */
export function popPictures(text, makeCanvas = () => document.createElement('canvas')) {
    try {
        const probe = makeCanvas().getContext('2d');
        probe.font = POP_FONT;
        const w = Math.ceil(probe.measureText(text).width) + PAD * 2;
        const h = 16 + PAD * 2 + 4;
        const c = makeCanvas();
        c.width = w; c.height = h;
        const g = c.getContext('2d', { willReadFrequently: true });
        g.font = POP_FONT;
        g.textBaseline = 'middle';
        g.fillStyle = '#ffffff';
        g.fillText(text, PAD, h / 2);
        const src = g.getImageData(0, 0, w, h).data;
        const ink = new Uint8Array(w * h);
        for (let i = 0; i < ink.length; i++) ink[i] = src[i * 4 + 3] >= 128 ? 1 : 0;
        const paint = (rgb) => {
            const out = makeCanvas();
            out.width = w; out.height = h;
            const og = out.getContext('2d');
            const img = og.createImageData(w, h);
            for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
                const i = y * w + x;
                let px = null;
                if (ink[i]) px = rgb;
                else if (nearInk(ink, w, h, x, y)) px = [0, 0, 0];
                if (px) img.data.set([px[0], px[1], px[2], 255], i * 4);
            }
            og.putImageData(img, 0, 0);
            return out;
        };
        const colour = [1, 3, 5].map(i => parseInt(POP_COLOUR.slice(i, i + 2), 16));
        return { white: paint([255, 255, 255]), coloured: paint(colour), w, h };
    } catch {
        return null;
    }
}

/** Whether a pixel touches the text, side or corner: the outline's pixels. */
function nearInk(ink, w, h, x, y) {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h && ink[ny * w + nx]) return true;
    }
    return false;
}
