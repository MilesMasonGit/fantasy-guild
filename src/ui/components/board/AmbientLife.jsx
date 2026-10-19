import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { MAT_Z } from './matLayers.js';
import { MAT_EDGE } from './groundScreen.js';
import { onDue } from './frameClock.js';
import { onAmbientCue } from './ambientCues.js';
import { FRAME_MS, ambientRandom, createShimmer, createGust, createLava } from './ambientGround.js';
import { createSky, skyWorld, perchProfile } from './ambientSky.js';
import { AMBIENT_EFFECTS, ambientSettings } from './ambientSettings.js';
import { boardScaleAt, tokenSizeFor, TOKEN_SURFACE } from '../base/TokenSprite.jsx';
import { preloadAlphaMask } from '../../utils/alphaHitTest.js';
import { tokenSpritePath, getTokenType } from '../../../config/registries/tokenRegistry.js';
import { onTuningChanged, isAmbientKey } from '../../../config/playmatTuning.js';
import { useDrawn, isDrawn } from '../../dev/perf/drawSwitches.js';

/**
 * The mat's ambient life (brief 190 P3): slow, lazy and subtle, long quiet stretches and now and
 * then something happening.
 * - **On the ground** (`MAT_Z.GROUND_FX`, under every Token): a canvas per effect over the ground's
 * picture, its own grid, holding only what moves: the water's swell and sparkles, a gust leaning
 * the grass pieces, the lava's pulse (`ambientGround.js`). A step puts back only the box it changed;
 * the ground's own picture is never redrawn.
 * - **In the sky** (`MAT_Z.AMBIENT_SKY`, over every Token): each cloud shadow, leaf, petal, ember and
 * bird its own tiny canvas, moved by a 2D `translate` (`ambientSky.js`), so a step repaints only the
 * few small boxes that moved.
 * Each effect has its switch in the Ground tuner (Ambient life) and a drawing switch of its own
 * (`?off=ambientBirds`, the perf bench); all of it is off under reduced motion. Every step is on the
 * shared sprite clock (`frameClock.onDue`, 8 a second), which stops while the window is hidden or
 * minimised; the life picks up where it was.
 * ⚠️ Every canvas here keeps to the mat's own layer, as the ground's does (T-145,
 * `MatPixelLayers.test.js`): a CPU-backed 2D context (`willReadFrequently`), and no `will-change`,
 * filter or opacity. Ambience only: it reads where the Tokens stand and who works them, never
 * writes the game, and rolls its own dice (`ambientRandom`).
 */

/**
 * The ground's pictures as `TerrainCanvas` hands them on (`set`), for the ambient life to read
 * (`get`, `subscribe`). One per mat.
 * ⚠️ Never hand a picture to a component as a prop: it holds the ground's plan, arrays of hundreds
 * of thousands of entries, and React's development build lists every entry of a changed prop in
 * its performance-timeline record of the render. The dev game froze for about 2.5 s on every new
 * picture (a travel, a resize, a Ground tuner slider) until the picture went this way
 * (`GroundPictureDevCost.test.js`).
 */
export function createGroundPictures() {
    let picture = null;
    const listeners = new Set();
    return {
        set(next) {
            if (next === picture) return;
            picture = next;
            for (const fn of [...listeners]) fn();
        },
        get: () => picture,
        subscribe(fn) {
            listeners.add(fn);
            return () => listeners.delete(fn);
        }
    };
}

const NO_PICTURES = Object.freeze({ get: () => null, subscribe: () => () => {} });

/** Whether the player asked the system for less motion; follows the setting live. */
const REDUCED = '(prefers-reduced-motion: reduce)';
function subscribeReduced(fn) {
    const query = typeof window !== 'undefined' ? window.matchMedia?.(REDUCED) : null;
    if (!query?.addEventListener) return () => {};
    query.addEventListener('change', fn);
    return () => query.removeEventListener('change', fn);
}
const reducedNow = () => (typeof window !== 'undefined' && !!window.matchMedia?.(REDUCED)?.matches);
export function usePrefersReducedMotion() {
    return useSyncExternalStore(subscribeReduced, reducedNow, () => false);
}

/** Each effect's switch: its Ground tuner toggle and its drawing switch both on. */
function useSwitches() {
    const [revision, setRevision] = useState(0);
    useEffect(() => onTuningChanged((key) => {
        if (key === null || isAmbientKey(key)) setRevision(n => n + 1);
    }), []);
    // One hook per switch, so each re-renders this when it flips.
    const water = useDrawn(AMBIENT_EFFECTS.water);
    const gust = useDrawn(AMBIENT_EFFECTS.gust);
    const lava = useDrawn(AMBIENT_EFFECTS.lava);
    const particles = useDrawn(AMBIENT_EFFECTS.particles);
    const birds = useDrawn(AMBIENT_EFFECTS.birds);
    const clouds = useDrawn(AMBIENT_EFFECTS.clouds);
    return useMemo(() => {
        const s = ambientSettings(isDrawn);
        return { water: s.water, gust: s.gust, lava: s.lava, particles: s.particles, birds: s.birds, clouds: s.clouds };
    }, [revision, water, gust, lava, particles, birds, clouds]);   // eslint-disable-line react-hooks/exhaustive-deps
}

/** Each sprite's perch, by its art: read from the art's alpha once it has loaded. */
const perches = new Map();
function perchOfSprite(src) {
    const known = perches.get(src);
    if (known !== undefined) return known === 'loading' ? null : known;
    perches.set(src, 'loading');
    preloadAlphaMask(src).then(
        (mask) => perches.set(src, mask ? perchProfile(mask) : null),
        () => perches.set(src, null)
    );
    return null;
}

/** The Tokens as the sky reads them: where each stands, whether it walks, whether it is an enemy. */
function boardOf(tokens) {
    const map = new Map();
    for (const t of tokens || []) {
        const walking = t.walkFacing != null || t.x == null;
        map.set(t.id, { id: t.id, typeId: t.typeId, x: t.x, y: t.y, walking, enemy: !!getTokenType(t.typeId)?.enemy });
    }
    return map;
}

/** One ground effect's canvas: its image, its words, and a put of the box a step changed. */
function attachCanvas(canvas, cols, rows) {
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    const image = ctx.createImageData(cols, rows);
    const out = new Uint32Array(image.data.buffer, image.data.byteOffset, cols * rows);
    return {
        out,
        put(box) { if (box) ctx.putImageData(image, 0, 0, box.x, box.y, box.w, box.h); }
    };
}

/**
 * The sky's sprites as elements: one small canvas each in its layer, created when it first
 * appears, redrawn only when its shape or colour changes, moved by `translate` when it moves,
 * removed when it is gone.
 */
function createSkyView(root) {
    const layers = { cloud: document.createElement('div'), life: document.createElement('div') };
    for (const layer of Object.values(layers)) {
        layer.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%';
        root.appendChild(layer);
    }
    const shown = new Map();
    return {
        draw(sprites) {
            const seen = new Set();
            for (const s of sprites) {
                seen.add(s.key);
                let e = shown.get(s.key);
                if (!e) {
                    const el = document.createElement('canvas');
                    el.setAttribute('data-ambient-sprite', s.layer);
                    el.style.cssText = 'position:absolute;left:0;top:0;image-rendering:pixelated;pointer-events:none';
                    layers[s.layer].appendChild(el);
                    e = { el, ctx: el.getContext('2d', { willReadFrequently: true }), shape: null, colour: null, px: 0, x: null, y: null };
                    shown.set(s.key, e);
                }
                if (e.shape !== s.shape || e.colour !== s.colour) {
                    const { w, h, cells } = s.shape;
                    if (e.el.width !== w) e.el.width = w;
                    if (e.el.height !== h) e.el.height = h;
                    if (e.ctx) {
                        e.ctx.clearRect(0, 0, w, h);
                        e.ctx.fillStyle = s.colour;
                        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (cells[y * w + x]) e.ctx.fillRect(x, y, 1, 1);
                    }
                }
                if (e.shape !== s.shape || e.px !== s.px) {
                    e.el.style.width = `${s.shape.w * s.px}px`;
                    e.el.style.height = `${s.shape.h * s.px}px`;
                }
                e.shape = s.shape;
                e.colour = s.colour;
                e.px = s.px;
                if (e.x !== s.x || e.y !== s.y) {
                    e.x = s.x;
                    e.y = s.y;
                    e.el.style.transform = `translate(${s.x}px, ${s.y}px)`;
                }
            }
            for (const [key, e] of shown) {
                if (seen.has(key)) continue;
                e.el.remove();
                shown.delete(key);
            }
        },
        /** Every sprite gone at once (a new Region). */
        clear() {
            for (const e of shown.values()) e.el.remove();
            shown.clear();
        },
        root,
        get count() { return shown.size; }
    };
}

/** When the next step is due: the next whole frame of the sprite clock's grid. */
const nextFrameAt = (now) => (Math.floor(now / FRAME_MS) + 1) * FRAME_MS;

/**
 * @param {{pictures: object|null, tokens: object[], workedBy: Map<string, string>,
 *   carriedId: string|null}} props  `pictures` the ground's pictures ({@link createGroundPictures},
 *   null while the mat draws no ground); the Tokens as `MatBoard` lists them, who works which, and
 *   the one in the hand
 */
export const AmbientLife = React.memo(function AmbientLife({ pictures = null, tokens, workedBy, carriedId = null }) {
    const source = pictures || NO_PICTURES;
    const picture = useSyncExternalStore(source.subscribe, source.get, source.get);
    const reduced = usePrefersReducedMotion();
    const on = useSwitches();
    const life = picture?.life || null;
    const live = !reduced && !!picture;
    const ground = {
        water: live && on.water && !!life?.water,
        gust: live && on.gust && !!life?.gust,
        lava: live && on.lava && !!life?.lava
    };
    const sky = live && (on.birds || on.clouds || on.particles);

    // The board as of the last render, read by each step; the map is rebuilt only for a new list.
    const board = useRef({ tokens: null, map: new Map(), workedBy: new Map(), carriedId: null });
    useLayoutEffect(() => {
        const b = board.current;
        if (b.tokens !== tokens) {
            b.tokens = tokens;
            b.map = boardOf(tokens);
            // Each Token's perch read ahead of the first bird: its art's alpha, once per sprite.
            for (const t of b.map.values()) {
                const src = t.enemy ? null : tokenSpritePath(t.typeId);
                if (src) perchOfSprite(src);
            }
        }
        b.workedBy = workedBy || new Map();
        b.carriedId = carriedId;
    }, [tokens, workedBy, carriedId]);

    const random = useRef(null);
    if (!random.current) random.current = ambientRandom(Math.floor(performance.now() * 1000) ^ 0x5eed);
    const frame = useRef(0);
    const skyLife = useRef(null);
    /** The Region the sky's life belongs to (its seed): another Region starts it afresh. */
    const skyRegion = useRef(null);
    const cues = useRef({ gust: false, birds: false });
    useEffect(() => onAmbientCue((what) => { if (what in cues.current) cues.current[what] = true; }), []);

    const world = useMemo(() => (picture
        ? skyWorld({ plan: picture.plan, life, unitU: picture.unit, artU: boardScaleAt(picture.fit) }, random.current)
        : null), [picture, life]);

    const waterRef = useRef(null);
    const gustRef = useRef(null);
    const lavaRef = useRef(null);
    const skyRef = useRef(null);
    // The sky's elements live as long as its layer: kept from step to step and across a new
    // picture (a resize), so nothing blinks out; a new layer (the sky switched back on) gets a new view.
    const skyView = useRef(null);

    useLayoutEffect(() => {
        if (!live || !(ground.water || ground.gust || ground.lava || sky)) return undefined;
        const { cols, rows } = picture;
        const rnd = random.current;
        const water = ground.water ? attachCanvas(waterRef.current, cols, rows) : null;
        const shimmer = water && createShimmer(life.water, { cols, out: water.out, random: rnd });
        if (shimmer) water.put(shimmer.paintAll(frame.current));
        const leaning = ground.gust ? attachCanvas(gustRef.current, cols, rows) : null;
        const gust = leaning && createGust(life.gust, { cols, matW: picture.mat.w, out: leaning.out, random: rnd });
        const glowing = ground.lava ? attachCanvas(lavaRef.current, cols, rows) : null;
        const lava = glowing && createLava(life.lava, { cols, out: glowing.out });
        if (sky && skyRef.current && skyView.current?.root !== skyRef.current) skyView.current = createSkyView(skyRef.current);
        const view = sky && skyRef.current ? skyView.current : null;
        if (view && skyRegion.current !== picture.plan.seed) {
            skyRegion.current = picture.plan.seed;
            skyLife.current = null;
            view.clear();
        }
        if (view && !skyLife.current) skyLife.current = createSky({ random: rnd });
        const art = {
            perchOf(typeId) {
                const src = tokenSpritePath(typeId);
                const profile = src ? perchOfSprite(src) : null;
                return profile ? { profile, size: tokenSizeFor(TOKEN_SURFACE.BOARD, typeId, world.artU) } : null;
            }
        };

        const step = (now) => {
            const f = ++frame.current;
            // The amounts live, the switches as rendered (each one mounts or drops a canvas).
            const settings = { ...ambientSettings(), birds: on.birds, clouds: on.clouds, particles: on.particles };
            if (shimmer) water.put(shimmer.step(f, { sparkles: settings.sparkles * life.waterShare }));
            if (gust) {
                if (cues.current.gust) { cues.current.gust = false; gust.now(f); }
                leaning.put(gust.step(f, { gapFrames: settings.gustGapFrames }));
            }
            if (lava) glowing.put(lava.step(f));
            if (view) {
                const sim = skyLife.current;
                if (cues.current.birds) { cues.current.birds = false; sim.visitNow(f); }
                const b = board.current;
                sim.step(f, { world, mat: picture.mat, tokens: b.map, worked: b.workedBy, carried: b.carriedId, art, settings });
                view.draw(sim.sprites(settings.cloudShade));
            }
            return nextFrameAt(now);
        };
        return onDue(step, nextFrameAt(performance.now()));
    }, [live, picture, life, world, ground.water, ground.gust, ground.lava, sky, on.birds, on.clouds, on.particles]);

    if (!live) return null;
    const size = picture ? { width: picture.cols * picture.unit, height: picture.rows * picture.unit } : null;
    const groundCanvas = (which, ref) => (
        <canvas
            ref={ref}
            data-ambient={which}
            aria-hidden="true"
            width={picture.cols}
            height={picture.rows}
            className="absolute left-0 top-0 pointer-events-none"
            style={{ ...size, zIndex: MAT_Z.GROUND_FX, imageRendering: 'pixelated' }}
        />
    );
    return (
        <>
            {ground.water && groundCanvas('water', waterRef)}
            {ground.gust && groundCanvas('gust', gustRef)}
            {ground.lava && groundCanvas('lava', lavaRef)}
            {sky && (
                <div
                    ref={skyRef}
                    data-ambient-sky
                    aria-hidden="true"
                    className="absolute left-0 top-0 pointer-events-none"
                    style={{
                        width: picture.mat.w,
                        height: picture.mat.h,
                        zIndex: MAT_Z.AMBIENT_SKY,
                        borderRadius: MAT_EDGE.radius,
                        overflow: 'clip'
                    }}
                />
            )}
        </>
    );
});

export default AmbientLife;
