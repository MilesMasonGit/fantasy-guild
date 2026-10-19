import { describe, it, expect, afterEach } from 'vitest';
import { buildGroundPlan } from '../systems/board/TerrainSurface.js';
import { drawGrass, grassNoise, lookRules, COLOUR, SLOT_SHIFT } from '../systems/board/TerrainGrass.js';
import { buildScreenPass } from '../ui/components/board/groundScreen.js';
import {
    groundLife, createShimmer, createGust, createLava, lavaLevel, swellLit, ambientRandom,
    SHIMMER, GUST, LAVA
} from '../ui/components/board/ambientGround.js';
import {
    createSky, perchProfile, perchSpot, cloudShape, skyWorld, isIdle, BIRDS, BIRD_SHAPES, CLOUDS, PARTICLES
} from '../ui/components/board/ambientSky.js';
import { ambientSettings } from '../ui/components/board/ambientSettings.js';
import { LOOKS } from '../config/registries/terrainRegistry.js';
import { setTuning, resetTuning } from '../config/playmatTuning.js';
import { groundWith } from './fixtures/ground.js';

afterEach(() => resetTuning());

/**
 * The mat's ambient life (brief 190 P3): slow, lazy and subtle. The ground's effects are drawn on
 * canvases of their own over the ground's picture, touching only what moves; the sky's are a few
 * small sprites over the Tokens. These pin the pure parts: which pixels each effect may touch, its
 * pace, the birds' visits, the clouds' fixed shapes, and the switches.
 */

/** Grass with a lake, a beach, and rock: every effect but the lava has something to do. */
const lakeGround = (seed = 21) => groundWith(24, 14, (c, r) => {
    const dx = (c - 16) / 5;
    const dy = (r - 7) / 4;
    if (dx * dx + dy * dy < 1) return 'water';
    return c < 3 ? 'rock' : 'grass';
}, { seed, biomes: null });

/** One look's ground everywhere. */
const lookGround = (id, seed = 5) => {
    const terrain = LOOKS[id].terrain;
    return groundWith(24, 14, () => terrain, { seed, biomes: { main: id, terrains: { [id]: terrain } } });
};

/** The ground's picture at the shipped 2× ground pixel, with the swaying pieces found. */
function pictureOf(ground) {
    const plan = buildGroundPlan(ground);
    const pass = buildScreenPass(plan, { mat: ground.mat, unit: 4, pixel: 2, sheet: () => null, pieces: true });
    return { plan, pass, life: groundLife(pass, plan) };
}

/** The details on the ground grid, as the screen pass draws them. */
function detailsOf(plan, unit = 4, pixel = 2) {
    const cols = Math.ceil((plan.width * plan.unit) / unit - 1e-6);
    const rows = Math.ceil((plan.height * plan.unit) / unit - 1e-6);
    const planCol = Int32Array.from({ length: cols }, (_, c) => Math.min(plan.width - 1, Math.floor(((c + 0.5) * unit) / plan.unit)));
    const planRow = Int32Array.from({ length: rows }, (_, r) => Math.min(plan.height - 1, Math.floor(((r + 0.5) * unit) / plan.unit)) * plan.width);
    return { cols, rows, ...drawGrass(plan.grass, plan.seed, cols, rows, planCol, planRow, null, pixel) };
}

/** Whether a colour index is one of a kind's strokes, or a tuft's or an overlay blade's tone. */
const strokeOrTuft = (k) => {
    if (k < COLOUR.KIND) return k === COLOUR.EARTH;          // a tuft's shadow pixel on the earth
    const offset = (k - COLOUR.KIND) % COLOUR.STRIDE;
    return offset >= COLOUR.STROKES || offset === COLOUR.GRASS || offset === 2 || offset === 3;
};

describe('⭐ the generator knows the grass pieces', () => {
    it('⭐ lifts only blades, tufts and their shadow pixels, of grass that sways, never water', () => {
        const { plan } = pictureOf(lakeGround());
        const { colour, body, kinds } = detailsOf(plan);
        expect(body).not.toBeNull();
        const water = new Set();
        plan.grass.looks.forEach((id, slot) => { if (lookRules(id).water) water.add((slot << SLOT_SHIFT) | 1); });
        let pieces = 0;
        for (let i = 0; i < colour.length; i++) {
            if (body[i] === colour[i]) continue;
            pieces++;
            expect(water.has(kinds[i]), `water at ${i}`).toBe(false);
            expect(strokeOrTuft(colour[i] % COLOUR.DIM), `piece colour ${colour[i]} at ${i}`).toBe(true);
            // Under a piece: the body or the earth as the body pass drew it, never another stroke.
            const under = body[i] % COLOUR.DIM;
            const offset = (under - COLOUR.KIND) % COLOUR.STRIDE;
            expect(under < COLOUR.KIND || offset < COLOUR.STROKES, `under ${under} at ${i}`).toBe(true);
        }
        expect(pieces).toBeGreaterThan(500);
    });

    it('⭐ finds none on ground with no grass: the volcano\'s rock, ash and lava lie still', () => {
        const { plan } = pictureOf(lookGround('volcano'));
        expect(detailsOf(plan).body).toBeNull();
    });

    it('takes the cherry grove\'s green blades and none of its petals or moss', () => {
        const { plan } = pictureOf(lookGround('cherry_grove'));
        const { colour, body } = detailsOf(plan);
        const rules = lookRules('cherry_grove');
        const green = rules.kinds.findIndex(k => k.id === 'green');
        let onGreen = 0;
        let elsewhere = 0;
        for (let i = 0; i < colour.length; i++) {
            if (body[i] === colour[i]) continue;
            // An overlay's blades reach up over the patch's top edge, so they may stand on moss.
            const k = colour[i] % COLOUR.DIM;
            const kind = Math.floor((k - COLOUR.KIND) / COLOUR.STRIDE);
            if (kind === green) onGreen++;
            else elsewhere++;
        }
        expect(onGreen).toBeGreaterThan(50);
        expect(elsewhere).toBe(0);
    });

    it('⭐ leaves the picture as it was: finding the pieces paints a second picture, never the first', () => {
        const ground = lakeGround();
        const plan = buildGroundPlan(ground);
        const plain = buildScreenPass(plan, { mat: ground.mat, unit: 4, pixel: 2, sheet: () => null }).data.slice();
        const withPieces = buildScreenPass(plan, { mat: ground.mat, unit: 4, pixel: 2, sheet: () => null, pieces: true });
        expect(Buffer.from(withPieces.data).equals(Buffer.from(plain))).toBe(true);
        expect(withPieces.pieces.at.length).toBeGreaterThan(500);
    });
});

describe('⭐ the gust', () => {
    const setup = () => {
        const { life } = pictureOf(lakeGround());
        const out = new Uint32Array(life.cols * life.rows);
        const gust = createGust(life.gust, { cols: life.cols, matW: 768, out, random: ambientRandom(7) });
        return { life, out, gust };
    };

    it('⭐ is still until one is due, then crosses the mat west to east and leaves nothing behind', () => {
        const { life, out, gust } = setup();
        const gap = 400;
        let started = null;
        const centres = [];
        for (let f = 1; f < 3000; f++) {
            gust.step(f, { gapFrames: gap });
            if (gust.crossing && started === null) started = f;
            if (started !== null && !gust.crossing) break;
            if (!gust.crossing) {
                expect(out.some(Boolean), `drawn while still at ${f}`).toBe(false);
                continue;
            }
            let sum = 0;
            let n = 0;
            out.forEach((w, i) => { if (w) { sum += i % life.cols; n++; } });
            if (n) centres.push(sum / n);
        }
        expect(started).toBeGreaterThanOrEqual(gap * 0.25);
        expect(started).toBeLessThanOrEqual(gap * 0.75 + 1);
        expect(out.some(Boolean)).toBe(false);
        // East: the band's middle moves right, frame on frame (a little noise at its ragged ends).
        const rising = centres.slice(1).filter((c, k) => c >= centres[k]).length;
        expect(rising / (centres.length - 1)).toBeGreaterThan(0.85);
        // Slow: 20 mat units a frame, across 768 and the band's width in about 45 frames.
        expect(centres.length).toBeGreaterThan(30);
    });

    it('⭐ moves only the grass pieces, one ground pixel downwind, in their own colours: the grass colour is untouched', () => {
        const { life, out, gust } = setup();
        const { at, lean, colour, body } = life.gust;
        const allowed = new Map();
        for (let k = 0; k < at.length; k++) {
            if (!allowed.has(at[k])) allowed.set(at[k], new Set());
            allowed.get(at[k]).add(body[k]);
            if (lean[k] >= 0) {
                expect(lean[k]).toBe(at[k] + 1);
                if (!allowed.has(lean[k])) allowed.set(lean[k], new Set());
                allowed.get(lean[k]).add(colour[k]);
            }
        }
        gust.now(0);
        let drawn = 0;
        for (let f = 1; f < 80; f++) {
            gust.step(f, { gapFrames: 1e9 });
            out.forEach((w, i) => {
                if (!w) return;
                drawn++;
                expect(allowed.has(i), `pixel ${i} is no piece's`).toBe(true);
                expect(allowed.get(i).has(w), `pixel ${i} took a colour no piece there has`).toBe(true);
            });
        }
        expect(drawn).toBeGreaterThan(1000);
    });

    it('leans each piece for a moment, then lets it spring back', () => {
        const { life, out, gust } = setup();
        const first = life.gust.at[Math.floor(life.gust.at.length / 2)];
        gust.now(0);
        const leaning = [];
        for (let f = 1; f < 80; f++) {
            gust.step(f, { gapFrames: 1e9 });
            if (out[first]) leaning.push(f);
        }
        expect(leaning.length).toBeGreaterThan(0);
        expect(leaning.length).toBeLessThanOrEqual(Math.ceil(GUST.width / GUST.speed) + 1);
        expect(leaning.at(-1) - leaning[0] + 1).toBe(leaning.length);
    });
});

describe('⭐ the water\'s shimmer', () => {
    const setup = () => {
        const { life, plan, pass } = pictureOf(lakeGround());
        const out = new Uint32Array(life.cols * life.rows);
        const shimmer = createShimmer(life.water, { cols: life.cols, out, random: ambientRandom(5) });
        return { life, plan, pass, out, shimmer };
    };

    it('⭐ lights the swell where the slow wave is high, as `sin(φ + θ) > cut`, and only on water', () => {
        const { life, plan, out, shimmer } = setup();
        const { at, on, off, swell } = life.water;
        const Q = SHIMMER.cycleFrames;
        const step = (2 * Math.PI) / Q;
        shimmer.paintAll(0);
        for (let q = 0; q < Q; q++) {
            if (q) shimmer.step(q, { sparkles: 0 });
            for (let k = 0; k < at.length; k += 7) {
                const i = at[k];
                const r = Math.floor(i / life.cols);
                const x = (i - r * life.cols + 0.5) * life.unit;
                const y = (r + 0.5) * life.unit;
                const phi = SHIMMER.slope[0] * x + SHIMMER.slope[1] * y + SHIMMER.bend * grassNoise(x, y, plan.seed, SHIMMER.bendCell, 0x7a01);
                const v = Math.sin(phi + q * step);
                if (Math.abs(v - SHIMMER.cut) < 1e-6) continue;
                expect(swellLit(on[k], off[k], q), `pixel ${i} at step ${q}`).toBe(v > SHIMMER.cut);
                expect(out[i]).toBe(v > SHIMMER.cut ? swell[k] : 0);
            }
        }
        const water = new Set(at);
        out.forEach((w, i) => { if (w) expect(water.has(i)).toBe(true); });
    });

    it('keeps the swell faint: 5 % brighter than the water under it', () => {
        const { life, pass } = setup();
        const words = new Uint32Array(pass.data.buffer);
        const { at, swell } = life.water;
        for (let k = 0; k < at.length; k += 11) {
            const base = words[at[k]];
            for (const s of [0, 8, 16]) {
                const want = Math.min(255, Math.round(((base >>> s) & 255) * SHIMMER.swell));
                expect((swell[k] >>> s) & 255).toBe(want);
            }
        }
    });

    it('⭐ sparkles: a few, on water only, each out after half a second', () => {
        const { life, out, shimmer } = setup();
        shimmer.paintAll(0);
        const water = new Set(life.water.at);
        const born = new Map();
        const counts = [];
        for (let f = 1; f <= 400; f++) {
            shimmer.step(f, { sparkles: 6 });
            const { sparkles } = shimmer.state;
            counts.push(sparkles.size);
            for (const [k, until] of sparkles) {
                const i = life.water.at[k];
                expect(water.has(i)).toBe(true);
                expect(out[i]).toBe(SHIMMER.sparkle);
                if (!born.has(k)) born.set(k, f);
                expect(until - born.get(k)).toBe(SHIMMER.sparkleFrames);
            }
            for (const k of [...born.keys()]) if (!sparkles.has(k)) born.delete(k);
        }
        const mean = counts.slice(50).reduce((a, b) => a + b, 0) / (counts.length - 50);
        expect(mean).toBeGreaterThan(4);
        expect(mean).toBeLessThan(7);
    });
});

describe('the lava\'s pulse', () => {
    it('⭐ brightens the lava, and only the lava, in hard steps up and down once a cycle', () => {
        const { life, plan } = pictureOf(lookGround('volcano'));
        expect(life.lava).not.toBeNull();
        expect(life.water).toBeNull();
        expect(life.gust).toBeNull();
        const glow = new Set();
        plan.grass.looks.forEach((id, slot) => lookRules(id).kinds.forEach((kind, k) => { if (kind.glow) glow.add((slot << SLOT_SHIFT) | (k + 1)); }));
        const out = new Uint32Array(life.cols * life.rows);
        const lava = createLava(life.lava, { cols: life.cols, out });
        const levels = [];
        for (let f = 0; f < LAVA.cycleFrames; f++) {
            lava.step(f);
            levels.push(lava.level);
        }
        expect(Math.min(...levels)).toBe(0);
        expect(Math.max(...levels)).toBe(LAVA.levels);
        expect(new Set(levels).size).toBe(LAVA.levels + 1);
        expect(lavaLevel(0)).toBe(0);
        expect(lavaLevel(LAVA.cycleFrames / 2)).toBe(LAVA.levels);
        const at = new Set(life.lava.at);
        out.forEach((w, i) => { if (w) expect(at.has(i)).toBe(true); });
    });
});

/** A Token's art: an opaque disc with a narrow top, 16 pixels square. */
const ART = (() => {
    const data = new Uint8Array(16 * 16);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if ((x - 7.5) ** 2 + (y - 9) ** 2 < 36) data[y * 16 + x] = 255;
    return { width: 16, height: 16, data };
})();

/** A sky over Tokens `tokens` (id → x, y), the art above for all of them, 128 mat units across. */
function skyCtx(tokens, { worked = new Set(), carried = null, settings = {} } = {}) {
    const profile = perchProfile(ART);
    return {
        world: { artU: 2, unitU: 4, birdColourAt: () => '#fbfaf4', spots: {}, share: {} },
        mat: { w: 1760, h: 1126 },
        tokens: new Map(Object.entries(tokens).map(([id, p]) => [id, { id, typeId: 'tree', ...p }])),
        worked, carried,
        art: { perchOf: () => ({ profile, size: 128 }) },
        settings: { birds: true, birdGapFrames: 40, birdPixel: 2, clouds: false, cloudCount: 0, cloudSize: 1, particles: false, particleRate: 1, ...settings }
    };
}

describe('⭐ the birds', () => {
    it('finds a Token\'s top from its art: the top row\'s middle, and each column\'s own top', () => {
        const p = perchProfile(ART);
        expect(p.top).toBe(4);
        expect(p.tops[p.col]).toBe(4);
        expect(p.col).toBeGreaterThanOrEqual(6);
        expect(p.col).toBeLessThanOrEqual(9);
        expect(p.tops[2]).toBeGreaterThan(p.top);
    });

    it('⭐ perches on the art\'s top, unless another Token\'s art in front covers it', () => {
        const ctx = skyCtx({ a: { x: 400, y: 400 } });
        const spot = perchSpot(ctx.tokens.get('a'), ctx);
        expect(spot.y).toBeCloseTo(400 - 64 + 4 * 8);
        expect(Math.abs(spot.x - 400)).toBeLessThan(12);
        // A tall Token lower on the mat, its art over the spot: drawn in front, so the top is covered.
        const block = perchProfile({ width: 16, height: 16, data: new Uint8Array(256).fill(255) });
        const covered = skyCtx({ a: { x: 400, y: 400 }, b: { x: 400, y: 430, typeId: 'tall' } });
        const art = covered.art;
        covered.art = { perchOf: (typeId) => (typeId === 'tall' ? { profile: block, size: 128 } : art.perchOf(typeId)) };
        expect(perchSpot(covered.tokens.get('a'), covered)).toBeNull();
        // A Token higher on the mat is behind: the top is clear, unless a hero works it (worked
        // Tokens are drawn in front of every Token at rest).
        const behind = skyCtx({ a: { x: 400, y: 400 }, b: { x: 400, y: 380 } });
        expect(perchSpot(behind.tokens.get('a'), behind)).not.toBeNull();
        behind.worked = new Set(['b']);
        expect(perchSpot(behind.tokens.get('a'), behind)).toBeNull();
    });

    it('⭐ lands only on idle Tokens: never one worked, in the hand, walking or an enemy', () => {
        const tokens = { idle: { x: 300, y: 300 }, worked: { x: 700, y: 300 }, held: { x: 1100, y: 300 }, walker: { x: 300, y: 800, walking: true }, foe: { x: 900, y: 800, enemy: true } };
        const landed = new Set();
        for (let seed = 1; seed < 40; seed++) {
            const sky = createSky({ random: ambientRandom(seed) });
            const ctx = skyCtx(tokens, { worked: new Set(['worked']), carried: 'held' });
            for (let f = 1; f < 400; f++) {
                sky.step(f, ctx);
                for (const b of sky.birds) landed.add(b.tokenId);
            }
        }
        expect([...landed]).toEqual(['idle']);
        expect(isIdle({ id: 'x' }, new Set(), null)).toBe(true);
    });

    it('⭐ flies in slowly, flapping, sits a while turning its head now and then, and flies off', () => {
        const sky = createSky({ random: ambientRandom(3) });
        const ctx = skyCtx({ a: { x: 800, y: 500 } }, { settings: { birdGapFrames: 1e9 } });
        sky.visitNow(1);
        const states = [];
        const shapes = { in: new Set(), sit: new Set(), out: new Set() };
        let key = null;
        for (let f = 1; f < 800; f++) {
            sky.step(f, ctx);
            const b = sky.birds.find(x => !key || x.key === key);
            if (!b) { if (key) break; continue; }
            key = b.key;
            if (states.at(-1) !== b.state) states.push(b.state);
            shapes[b.state].add(b.shape);
            if (b.state === 'sit') {
                const s = sky.sprites().find(x => x.key === key);
                // Its feet one art pixel into the Token's top.
                expect(s.y + 2 * s.px).toBeCloseTo(b.spot.y + 2, 5);
            }
        }
        expect(states).toEqual(['in', 'sit', 'out']);
        expect(shapes.in).toEqual(new Set([BIRD_SHAPES.up, BIRD_SHAPES.down]));
        expect(shapes.sit.has(BIRD_SHAPES.sit)).toBe(true);
        expect(shapes.sit.has(BIRD_SHAPES.lookLeft) || shapes.sit.has(BIRD_SHAPES.lookRight)).toBe(true);
        expect(sky.birds.find(x => x.key === key)).toBeUndefined();
    });

    it('⭐ flies off at once when its Token is worked, picked up, moved or gone', () => {
        for (const change of ['worked', 'carried', 'moved', 'gone']) {
            const sky = createSky({ random: ambientRandom(11) });
            const ctx = skyCtx({ a: { x: 800, y: 500 } }, { settings: { birdGapFrames: 1e9 } });
            sky.visitNow(1);
            let f = 1;
            for (; f < 400 && !sky.birds.some(b => b.state === 'sit'); f++) sky.step(f, ctx);
            const bird = sky.birds.find(b => b.state === 'sit');
            expect(bird, change).toBeDefined();
            if (change === 'worked') ctx.worked = new Set(['a']);
            if (change === 'carried') ctx.carried = 'a';
            if (change === 'moved') ctx.tokens.set('a', { id: 'a', typeId: 'tree', x: 900, y: 500 });
            if (change === 'gone') ctx.tokens.delete('a');
            sky.step(f, ctx);
            expect(bird.state, change).toBe('out');
        }
    });

    it('keeps to three at most, one light colour each, the bird pixel as the slider says', () => {
        const sky = createSky({ random: ambientRandom(5) });
        const tokens = Object.fromEntries(Array.from({ length: 12 }, (_, k) => [`t${k}`, { x: 200 + (k % 6) * 250, y: 300 + Math.floor(k / 6) * 400 }]));
        const ctx = skyCtx(tokens, { settings: { birdGapFrames: 4, birdPixel: 1 } });
        let most = 0;
        for (let f = 1; f < 2000; f++) {
            sky.step(f, ctx);
            most = Math.max(most, sky.birds.length);
            for (const s of sky.sprites()) {
                expect(s.colour).toBe('#fbfaf4');
                expect(s.px).toBe(2);
            }
        }
        expect(most).toBe(BIRDS.max);
    });

    it('takes its colour from the biome under its Token', () => {
        const { plan, life } = pictureOf(lookGround('coast'));
        const world = skyWorld({ plan, life, unitU: 4, artU: 2 }, ambientRandom(1));
        expect(world.birdColourAt(100, 100)).toBe(LOOKS.coast.ambient.bird);
    });
});

describe('⭐ the cloud shadows', () => {
    it('⭐ keep the same silhouette for their whole trip, drifting east a ground pixel every two frames', () => {
        const sky = createSky({ random: ambientRandom(8) });
        const ctx = skyCtx({}, { settings: { birds: false, clouds: true, cloudCount: 3 } });
        const seen = new Map();
        for (let f = 1; f < 2500; f++) {
            sky.step(f, ctx);
            for (const s of sky.sprites(0.15).filter(x => x.layer === 'cloud')) {
                const prev = seen.get(s.key);
                if (!prev) { seen.set(s.key, { shape: s.shape, cells: s.shape.cells.slice(), y: s.y, x: s.x, f, lastX: s.x }); continue; }
                expect(s.shape).toBe(prev.shape);
                expect(Array.from(s.shape.cells)).toEqual(Array.from(prev.cells));
                expect(s.y).toBe(prev.y);
                // A ground pixel at a time, never more in a frame.
                expect(s.x - prev.lastX).toBeGreaterThanOrEqual(0);
                expect(s.x - prev.lastX).toBeLessThanOrEqual(ctx.world.unitU);
                expect(s.colour).toBe('rgba(0,0,0,0.15)');
                prev.lastX = s.x;
                prev.lastF = f;
            }
        }
        expect(seen.size).toBeGreaterThan(4);
        for (const c of seen.values()) {
            if (c.lastF === undefined || c.lastF - c.f < 40) continue;
            const pixels = (c.lastX - c.x) / ctx.world.unitU;
            expect(Math.abs(pixels - (c.lastF - c.f) / CLOUDS.framesPerPixel)).toBeLessThanOrEqual(1);
        }
    });

    it('is one level of see-through shade: a shape of filled and empty pixels, nothing between', () => {
        const random = ambientRandom(2);
        for (let k = 0; k < 50; k++) {
            const s = cloudShape(random, 20, 10);
            expect(s.w).toBeLessThanOrEqual(20);
            expect(s.h).toBeLessThanOrEqual(10);
            expect(s.cells.every(v => v === 0 || v === 1)).toBe(true);
            expect(s.cells.some(Boolean)).toBe(true);
        }
    });

    it('keeps as many on the mat as the slider says', () => {
        const sky = createSky({ random: ambientRandom(4) });
        const ctx = skyCtx({}, { settings: { birds: false, clouds: true, cloudCount: 5 } });
        sky.step(1, ctx);
        expect(sky.clouds.length).toBe(5);
    });
});

describe('the particles', () => {
    const worldOf = (id) => {
        const { plan, life } = pictureOf(lookGround(id));
        return skyWorld({ plan, life, unitU: 4, artU: 2 }, ambientRandom(1));
    };

    it('⭐ leaves only over the forest, petals over the cherry grove, embers over the volcano; none over the meadow', () => {
        expect(worldOf('forest').share).toMatchObject({ leaves: 1, petals: 0, embers: 0 });
        expect(worldOf('cherry_grove').share).toMatchObject({ leaves: 0, petals: 1, embers: 0 });
        expect(worldOf('volcano').share).toMatchObject({ leaves: 0, petals: 0, embers: 1 });
        expect(worldOf('meadow').share).toMatchObject({ leaves: 0, petals: 0, embers: 0 });
    });

    it('⭐ are sparse, leaves fall and embers rise, each for a few seconds', () => {
        for (const [id, kind] of [['forest', 'leaves'], ['volcano', 'embers']]) {
            const world = worldOf(id);
            const sky = createSky({ random: ambientRandom(6) });
            const ctx = { ...skyCtx({}, { settings: { birds: false, particles: true } }), world };
            const tracks = new Map();
            let most = 0;
            for (let f = 1; f < 1200; f++) {
                sky.step(f, ctx);
                most = Math.max(most, sky.particles.length);
                for (const s of sky.sprites()) {
                    if (!tracks.has(s.key)) tracks.set(s.key, []);
                    tracks.get(s.key).push(s.y);
                }
            }
            expect(most, id).toBeLessThanOrEqual(PARTICLES[kind].alive * 3);
            expect(most, id).toBeGreaterThan(0);
            for (const ys of tracks.values()) {
                expect(ys.length).toBeLessThanOrEqual(PARTICLES[kind].life[1]);
                if (ys.length > 20) expect(Math.sign(ys.at(-1) - ys[0]), id).toBe(kind === 'embers' ? -1 : 1);
            }
        }
    });
});

describe('⭐ a switch per effect', () => {
    it('reads each effect\'s Ground tuner switch and its drawing switch', () => {
        expect(ambientSettings()).toMatchObject({ water: true, gust: true, lava: true, particles: true, birds: true, clouds: true });
        setTuning('ambientBirds', 0);
        expect(ambientSettings().birds).toBe(false);
        expect(ambientSettings(name => name !== 'ambientClouds').clouds).toBe(false);
    });

    it('takes every sprite of an effect away when it is switched off', () => {
        const sky = createSky({ random: ambientRandom(3) });
        const ctx = skyCtx({ a: { x: 800, y: 500 } }, { settings: { clouds: true, cloudCount: 3 } });
        sky.visitNow(1);
        for (let f = 1; f < 120; f++) sky.step(f, ctx);
        expect(sky.sprites().length).toBeGreaterThan(3);
        ctx.settings = { ...ctx.settings, birds: false, clouds: false };
        sky.step(120, ctx);
        expect(sky.sprites()).toEqual([]);
    });
});
