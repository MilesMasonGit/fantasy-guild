import React, { useEffect, useRef } from 'react';
import { BOARD_PX } from '../../../config/boardGeometry.js';
import {
    subtileArtPx, resolveLattice, resolveArtPixels
} from '../../../systems/board/TerrainLattice.js';
import { buildSurface } from '../../../systems/board/TerrainSurface.js';
import { propsForBoard } from '../../../systems/board/TerrainProps.js';
import { substrateSprite, propSprite } from '../../../config/registries/terrainRegistry.js';
import { EventBus } from '../../../systems/core/EventBus.js';

/**
 * The playmat's ground, drawn under everything else.
 *
 * ## Why a canvas and not 841 divs
 *
 * The lattice is 29×29, so a div-per-subtile would put **841 elements** under a
 * board that draws 53 today, and the whole page is 272. One canvas is one
 * element, and a redraw is a tight loop over a typed grid with no DOM work.
 *
 * The trade is that terrain cannot be hit-tested or hovered. It does not need to
 * be: dropping, hovering and inspection all belong to the tiles above, which are
 * still real elements. Terrain is scenery.
 *
 * ## ⚠️ One buffer, one blit
 *
 * This used to be five passes — flat fills, a clipped draw per ragged boundary
 * pixel, beaches, shore bands, ground patches — each compositing over the whole
 * 928×928 board. It cost **55–63ms per repaint**, with 2,455 `clip()` calls in
 * the boundary pass alone, and every new terrain feature added another 8–17ms.
 *
 * All five were answering one question: what is at this pixel. `buildSurface`
 * answers it once, and this writes the answer into a single art-resolution
 * buffer — 232×232, not 928×928 — which reaches the screen in one scaled blit.
 * A wandering coastline is a different value in that buffer rather than a
 * clipped draw, so the most expensive pass stopped existing rather than getting
 * faster.
 *
 * Props stay a separate pass. They are sprites standing *on* the ground rather
 * than part of it, they overlap each other, and there are only about eighty.
 *
 * ## Crispness
 *
 * The buffer is written at art resolution and scaled up with
 * `imageSmoothingEnabled = false`, an exact 2× or 4×. Nothing is drawn at a
 * fractional coordinate, which is the one thing pixel art cannot survive. The
 * board's fit-to-window scaling happens in CSS on an ancestor, so it scales the
 * finished picture rather than the arithmetic.
 */

/**
 * Sprite pixels, extracted once and kept as raw bytes.
 *
 * ⚠️ Reading a substrate through `drawImage` per subtile was most of the old
 * renderer's cost. The loop below needs the *numbers*, so each sprite is decoded
 * to an `ImageData` once and sampled from an array after that — and a tinted
 * variant is a second array computed once, rather than a blend per board pixel.
 */
const texelCache = new Map();
const imageCache = new Map();
let pendingRedraw = null;

function loadImage(cacheKey, src) {
    const cached = imageCache.get(cacheKey);
    if (cached) return cached.complete && cached.naturalWidth > 0 ? cached : null;
    const img = new Image();
    img.onload = () => { texelCache.clear(); pendingRedraw?.(); };
    img.src = src;
    imageCache.set(cacheKey, img);
    return null;
}

/**
 * The RGBA bytes of one substrate variant, optionally tinted.
 *
 * @returns {Uint8ClampedArray|null} Null while the art is still loading; the
 *   caller leaves those pixels alone and the image's `onload` redraws.
 */
function texels(substrateId, variant, tint) {
    const key = `${substrateId}|${variant}|${tint ? `${tint.tint}|${tint.amount}` : ''}`;
    const cached = texelCache.get(key);
    if (cached) return cached;

    const img = loadImage(`${substrateId}|${variant}`, substrateSprite(substrateId, variant));
    if (!img) return null;

    const size = img.naturalWidth;
    const off = document.createElement('canvas');
    off.width = size;
    off.height = size;
    const ctx = off.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, size, size).data;

    if (tint) {
        // Mixed in here rather than per board pixel: a tint is a property of the
        // substrate, so this is 64 blends instead of fifty thousand.
        const r = parseInt(tint.tint.slice(1, 3), 16);
        const g = parseInt(tint.tint.slice(3, 5), 16);
        const b = parseInt(tint.tint.slice(5, 7), 16);
        const a = Math.min(1, tint.amount);
        for (let i = 0; i < data.length; i += 4) {
            data[i] = data[i] * (1 - a) + r * a;
            data[i + 1] = data[i + 1] * (1 - a) + g * a;
            data[i + 2] = data[i + 2] * (1 - a) + b * a;
        }
    }

    texelCache.set(key, data);
    return data;
}

/** Prop art, kept as images — props are blitted whole, not sampled. */
function propImage(propId) {
    return loadImage(`prop|${propId}`, propSprite(propId));
}

export const TerrainCanvas = ({ terrain, seed }) => {
    const canvasRef = useRef(null);
    const bufferRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return undefined;
        const ctx = canvas.getContext('2d');
        if (!ctx) return undefined;

        const draw = () => {
            ctx.imageSmoothingEnabled = false;
            ctx.clearRect(0, 0, BOARD_PX, BOARD_PX);

            const grid = resolveLattice(terrain || {}, seed || 0);
            const pixels = resolveArtPixels(grid, seed || 0);
            const { size, substrates, substrateAt, variantAt, tintAt, tints } =
                buildSurface(pixels, seed || 0);
            const artPx = subtileArtPx();

            // The buffer is reused across redraws. Allocating a 232×232 image
            // each time is cheap next to what this replaced, but it is also
            // pointless — the board never changes size.
            let buffer = bufferRef.current;
            if (!buffer || buffer.canvas.width !== size) {
                const off = document.createElement('canvas');
                off.width = size;
                off.height = size;
                const offCtx = off.getContext('2d');
                buffer = { canvas: off, ctx: offCtx, image: offCtx.createImageData(size, size) };
                bufferRef.current = buffer;
            }

            const out = buffer.image.data;
            out.fill(0);

            for (let py = 0; py < size; py++) {
                const ty = py % artPx;
                for (let px = 0; px < size; px++) {
                    const i = py * size + px;
                    const substrate = substrateAt[i];
                    if (substrate < 0) continue;   // bare table, left transparent

                    const tintId = tintAt[i];
                    const source = texels(
                        substrates[substrate],
                        variantAt[i],
                        tintId >= 0 ? tints[tintId] : null
                    );
                    if (!source) continue;         // art loading; onload redraws

                    const s = (ty * artPx + (px % artPx)) * 4;
                    const d = i * 4;
                    out[d] = source[s];
                    out[d + 1] = source[s + 1];
                    out[d + 2] = source[s + 2];
                    out[d + 3] = source[s + 3];
                }
            }

            buffer.ctx.putImageData(buffer.image, 0, 0);
            ctx.drawImage(buffer.canvas, 0, 0, size, size, 0, 0, BOARD_PX, BOARD_PX);

            // --- Props, back to front ---------------------------------------
            //
            // Already sorted by where each stands, so painting the list in order
            // is the whole depth rule: a tree lower on the board covers one
            // behind it.
            for (const prop of propsForBoard(grid, seed || 0, pixels)) {
                const img = propImage(prop.propId);
                if (!img) continue;
                ctx.drawImage(img, prop.x, prop.y, prop.size, prop.size);
            }
        };

        pendingRedraw = draw;
        draw();

        // The QA panel's art-set toggle and tuning sliders change what the
        // sprites mean without changing any game state, so nothing else would
        // prompt a repaint.
        const unsubscribe = EventBus.subscribe('terrain_art_set_changed', () => {
            texelCache.clear();
            draw();
        });

        return () => {
            unsubscribe?.();
            if (pendingRedraw === draw) pendingRedraw = null;
        };
    }, [terrain, seed]);

    return (
        <canvas
            ref={canvasRef}
            width={BOARD_PX}
            height={BOARD_PX}
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none"
            style={{ width: BOARD_PX, height: BOARD_PX, imageRendering: 'pixelated' }}
        />
    );
};

export default TerrainCanvas;
