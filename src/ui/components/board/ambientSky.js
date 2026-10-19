// ambient life above the Tokens: cloud shadows, small birds that land on idle Tokens, drifting leaves, petals and embers

/**
 * Slow, lazy and subtle (owner, brief 190 P3): a few small things, each drawn as a tiny sprite of
 * its own over the Tokens (`AmbientLife.jsx`), stepped on the shared sprite clock. Pure: the mat,
 * its Tokens and the switches in, a list of sprites out, each with a stable `key` so the view
 * moves the same element from step to step. Positions are mat units; sizes are counted in art
 * pixels (`artU` mat units each, `boardScaleAt`) or ground pixels (`unitU`), so every sprite lands
 * on whole screen pixels. Pace and shapes after the prototype's round V9
 * (`docs/active/research/ground_gen/style7.py`: `clouds9`, `birds9`, `perches`, `particles`),
 * slowed where the owner asked.
 *
 * ⚠️ Ambience only: it reads the Tokens' places and nothing else, and draws its randomness from
 * its own generator, never `Math.random`.
 */

import { LOOKS } from '../../../config/registries/terrainRegistry.js';

const TAU = Math.PI * 2;

/** A bird's colour where no look under it names one. */
const DEFAULT_BIRD = '#f2ecd6';

/** A shape from rows of `X` and `.`, as a bitmap. */
export function shapeOf(rows) {
    const h = rows.length;
    const w = rows[0].length;
    const cells = new Uint8Array(w * h);
    rows.forEach((row, y) => { for (let x = 0; x < w; x++) cells[y * w + x] = row[x] === 'X' ? 1 : 0; });
    return Object.freeze({ w, h, cells });
}

/**
 * The small birds (the V8 butterflies): three pixels wide, two tall, one light colour. Flying
 * they flap every two frames; sitting they fold, and now and then turn their head.
 */
export const BIRD_SHAPES = Object.freeze({
    up: shapeOf(['X.X', '.X.']),
    down: shapeOf(['.X.', 'XXX']),
    sit: shapeOf(['.X.', 'XXX']),
    lookLeft: shapeOf(['X..', 'XXX']),
    lookRight: shapeOf(['..X', 'XXX'])
});

/** Leaves tumble between a square and a slant; petals are a square; embers one art pixel. */
export const PARTICLE_SHAPES = Object.freeze({
    leafFlat: shapeOf(['XX', 'XX']),
    leafSlant: shapeOf(['XX..', '..XX']),
    petal: shapeOf(['XX', 'XX']),
    ember: shapeOf(['X'])
});

/**
 * Bird timings, in frames (8 a second) and mat units. They fly in at about `speed` a frame on an
 * arc `arc` high, sit `sit` frames, and leave faster; at most `max` at once; a visit brings a second
 * bird to the same Token `pairChance` of the time, `pairOffset` art pixels along its top.
 */
export const BIRDS = Object.freeze({
    max: 3, speed: 7.5, minFly: 32, maxFly: 112, arc: 60, outArc: 50, leave: Object.freeze([36, 56]), startled: Object.freeze([20, 30]),
    sit: Object.freeze([64, 144]), lookEvery: Object.freeze([24, 64]), lookFor: Object.freeze([6, 12]),
    pairChance: 0.3, pairDelay: Object.freeze([6, 20]), pairOffset: 5, outside: 30, firstVisit: Object.freeze([40, 120])
});

/**
 * Cloud shadows (`clouds9`, finer): small clouds of ground pixels, one see-through shade, each
 * keeping its shape for its whole trip, drifting east one ground pixel every `framesPerPixel`.
 */
export const CLOUDS = Object.freeze({ framesPerPixel: 2, w: Object.freeze([12, 26]), h: Object.freeze([6, 12]) });

/**
 * The drifting particles, sparse: about `alive` at once over a mat all of their biome, each living
 * `life` frames, drifting `vx`, `vy` mat units a frame and swaying `sway` either way once a `period`.
 */
export const PARTICLES = Object.freeze({
    leaves: Object.freeze({ alive: 5, life: Object.freeze([40, 64]), vx: 1.2, vy: 2.4, sway: 16, period: 24, grid: 'ground',
        colours: Object.freeze(['#be7828', '#96a032', '#c85a28']) }),
    petals: Object.freeze({ alive: 7, life: Object.freeze([48, 80]), vx: 1.6, vy: 1.2, sway: 16, period: 32, grid: 'ground',
        colours: Object.freeze(['#fabed7', '#ffdceb', '#eb96be']) }),
    embers: Object.freeze({ alive: 8, life: Object.freeze([32, 56]), vx: 0, vy: -1.2, sway: 6, period: 24, grid: 'art',
        colours: Object.freeze(['#ffc850', '#ff8c28', '#ff5a1e']), flash: '#fff0aa' })
});

const intBetween = (random, [lo, hi]) => Math.floor(lo + random() * (hi - lo + 1));
const smooth = (u) => u * u * (3 - 2 * u);
const snap = (v, step, from = 0) => from + Math.round((v - from) / step) * step;

/**
 * A cloud's silhouette: a few overlapping round puffs on the ground's grid, `w` by `h` pixels at
 * most, cropped to what is filled. Made once; the cloud keeps it for its whole trip.
 */
export function cloudShape(random, w, h) {
    const cells = new Uint8Array(w * h);
    const puffs = 3 + Math.floor(random() * 3);
    for (let p = 0; p < puffs; p++) {
        const cx = w * (0.2 + 0.6 * (p + random() * 0.6) / puffs);
        const cy = h * (0.45 + (random() - 0.5) * 0.3);
        const rx = w * (0.16 + random() * 0.14);
        const ry = h * (0.3 + random() * 0.2);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const dx = (x + 0.5 - cx) / rx;
                const dy = (y + 0.5 - cy) / ry;
                if (dx * dx + dy * dy <= 1) cells[y * w + x] = 1;
            }
        }
    }
    let x0 = w; let x1 = -1; let y0 = h; let y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (!cells[y * w + x]) continue;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
    }
    if (x1 < 0) return shapeOf(['X']);
    const cw = x1 - x0 + 1;
    const ch = y1 - y0 + 1;
    const out = new Uint8Array(cw * ch);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) out[y * cw + x] = cells[(y + y0) * w + x + x0];
    return Object.freeze({ w: cw, h: ch, cells: out });
}

/**
 * Where a bird sits on a Token: its art's highest pixels. From the art's alpha (`mask`, its own
 * pixels): the top row's middle, and each column's own top, for a second bird beside the first.
 * Null for art with nothing opaque.
 * @param {{width: number, height: number, data: Uint8Array}} mask
 */
export function perchProfile(mask, threshold = 128) {
    const { width, height, data } = mask;
    const tops = new Int16Array(width).fill(-1);
    let top = -1;
    for (let y = 0; y < height && top < 0; y++) {
        for (let x = 0; x < width; x++) if (data[y * width + x] >= threshold) { top = y; break; }
    }
    if (top < 0) return null;
    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) if (data[y * width + x] >= threshold) { tops[x] = y; break; }
    }
    let sum = 0;
    let n = 0;
    for (let x = 0; x < width; x++) if (tops[x] === top) { sum += x; n++; }
    return Object.freeze({ width, height, top, col: Math.round(sum / n - 0.5), tops, opaque: (x, y) => data[y * width + x] >= threshold });
}

/**
 * Whether a Token's art can take a bird now: on the mat, standing still, nobody working it, not in
 * the player's hand.
 */
export function isIdle(token, worked, carried) {
    return !!token && token.walking !== true && !token.enemy && !worked.has(token.id) && token.id !== carried;
}

/**
 * Where a bird would sit on `token`, in mat units, or null: its art's top (`art.perchOf`), not under
 * another Token's art drawn in front of it (lower on the mat, or being worked), inside the mat.
 * `offset` art pixels along the top, for a second bird.
 */
export function perchSpot(token, { tokens, worked, art, mat }, offset = 0) {
    const look = art.perchOf(token.typeId);
    if (!look) return null;
    const { profile, size } = look;
    const col = profile.col + offset;
    if (col < 0 || col >= profile.width || profile.tops[col] < 0) return null;
    const row = profile.tops[col];
    const sx = size / profile.width;
    const left = token.x - size / 2;
    const top = token.y - size / 2;
    const x = left + (col + 0.5) * sx;
    const y = top + row * sx;
    if (x < 8 || x > mat.w - 8 || y < 16 || y > mat.h - 4) return null;
    for (const other of tokens.values()) {
        if (other.id === token.id) continue;
        const inFront = worked.has(other.id) || other.y > token.y;
        if (!inFront) continue;
        const o = art.perchOf(other.typeId);
        if (!o) continue;
        const half = o.size / 2;
        const u = (x - (other.x - half)) / o.size;
        const v = (y - (other.y - half)) / o.size;
        if (u < 0 || v < 0 || u >= 1 || v >= 1) continue;
        if (o.profile.opaque(Math.floor(u * o.profile.width), Math.floor(v * o.profile.height))) return null;
    }
    return { x, y, left, sx };
}

/**
 * The sky's life, stepping. `step` advances one frame; `sprites` lists what to draw.
 *
 * @param {{random: () => number}} options
 */
export function createSky({ random }) {
    let birds = [];
    let clouds = [];
    let particles = [];
    let nextKey = 1;
    let nextVisit = null;
    let nextCloud = 0;
    let seeded = false;
    const owed = { leaves: 0, petals: 0, embers: 0 };

    /** A point just off the mat's edge nearest `p`, or off a random edge. */
    const offEdge = (p, mat, nearest) => {
        const o = BIRDS.outside;
        const sides = [
            { d: p.x, at: () => ({ x: -o, y: p.y + (random() - 0.5) * 500 }) },
            { d: mat.w - p.x, at: () => ({ x: mat.w + o, y: p.y + (random() - 0.5) * 500 }) },
            { d: p.y, at: () => ({ x: p.x + (random() - 0.5) * 700, y: -o }) }
        ];
        let side;
        if (nearest) {
            sides.sort((a, b) => a.d - b.d);
            side = random() < 0.75 ? sides[0] : sides[1];
        } else side = sides[Math.floor(random() * sides.length)];
        const q = side.at();
        return { x: Math.max(-o, Math.min(mat.w + o, q.x)), y: Math.max(-o, Math.min(mat.h, q.y)) };
    };

    const flightFrames = (a, b) => Math.round(Math.max(BIRDS.minFly, Math.min(BIRDS.maxFly, Math.hypot(b.x - a.x, b.y - a.y) / BIRDS.speed)));

    /** Send a bird away from where it is, now. */
    const leave = (bird, frame, mat, range) => {
        const from = { x: bird.x, y: bird.y };
        const to = offEdge(from, mat, false);
        bird.state = 'out';
        bird.from = from;
        bird.to = to;
        bird.start = frame;
        bird.frames = intBetween(random, range);
    };

    /** A visit: one bird, sometimes two, to an idle Token whose top is clear. */
    const visit = (frame, ctx) => {
        const { tokens, worked, carried } = ctx;
        const taken = new Set(birds.map(b => b.tokenId));
        const free = [];
        for (const t of tokens.values()) {
            if (!isIdle(t, worked, carried) || taken.has(t.id)) continue;
            free.push(t);
        }
        // A few tries: a Token whose art has not loaded yet, or whose top is covered, is passed over.
        for (let tries = 0; tries < 6 && free.length; tries++) {
            const token = free[Math.floor(random() * free.length)];
            const spot = perchSpot(token, ctx);
            if (!spot) continue;
            const pair = birds.length + 2 <= BIRDS.max && random() < BIRDS.pairChance;
            const side = random() < 0.5 ? -1 : 1;
            add(frame, token, spot, ctx, 0);
            if (pair) {
                const second = perchSpot(token, ctx, side * BIRDS.pairOffset);
                if (second) add(frame + intBetween(random, BIRDS.pairDelay), token, second, ctx, side * BIRDS.pairOffset);
            }
            return;
        }
    };

    const add = (start, token, spot, ctx, offset) => {
        const { mat, settings } = ctx;
        const from = offEdge(spot, mat, true);
        birds.push({
            key: `bird${nextKey++}`, tokenId: token.id, at: { x: token.x, y: token.y }, offset,
            spot, state: 'in', from, to: spot, start, frames: flightFrames(from, spot),
            sitFrames: intBetween(random, BIRDS.sit), lookAt: null, lookUntil: 0, look: 'lookLeft',
            colour: ctx.world.birdColourAt(spot.x, spot.y), x: from.x, y: from.y, shape: BIRD_SHAPES.up, px: settings.birdPixel * ctx.world.artU
        });
    };

    /**
     * The bird's spot, looked at again every frame: null (and the bird flies off) once its Token is
     * worked, picked up, moved or gone, or another Token covers its top.
     */
    const perchNow = (bird, ctx) => {
        const t = ctx.tokens.get(bird.tokenId);
        if (!isIdle(t, ctx.worked, ctx.carried) || t.x !== bird.at.x || t.y !== bird.at.y) return null;
        return perchSpot(t, ctx, bird.offset);
    };

    const stepBird = (bird, frame, ctx) => {
        const { mat, world, settings } = ctx;
        const bp = settings.birdPixel * world.artU;
        bird.px = bp;
        const age = frame - bird.start;
        if (age < 0) return true;
        if (bird.state !== 'out') {
            const spot = perchNow(bird, ctx);
            if (!spot) leave(bird, frame, mat, BIRDS.startled);
            else if (bird.state === 'in') bird.to = bird.spot = spot;
            else bird.spot = spot;
        }
        if (bird.state === 'in' && age >= bird.frames) {
            bird.state = 'sit';
            bird.start = frame;
            bird.lookAt = frame + intBetween(random, BIRDS.lookEvery);
        }
        if (bird.state === 'sit' && frame - bird.start >= bird.sitFrames) leave(bird, frame, mat, BIRDS.leave);
        const flap = Math.floor(frame / 2) % 2 ? BIRD_SHAPES.down : BIRD_SHAPES.up;
        if (bird.state === 'in') {
            const u = (frame - bird.start) / bird.frames;
            const e = smooth(u);
            bird.x = bird.from.x + (bird.to.x - bird.from.x) * e;
            bird.y = bird.from.y + (bird.to.y - bird.from.y) * e - Math.sin(u * Math.PI) * BIRDS.arc;
            bird.shape = flap;
        } else if (bird.state === 'sit') {
            bird.x = bird.spot.x;
            bird.y = bird.spot.y;
            if (bird.lookAt !== null && frame >= bird.lookAt) {
                bird.look = random() < 0.5 ? 'lookLeft' : 'lookRight';
                bird.lookUntil = frame + intBetween(random, BIRDS.lookFor);
                bird.lookAt = bird.lookUntil + intBetween(random, BIRDS.lookEvery);
            }
            bird.shape = frame < bird.lookUntil ? BIRD_SHAPES[bird.look] : BIRD_SHAPES.sit;
        } else {
            const u = (frame - bird.start) / bird.frames;
            if (u >= 1) return false;
            const e = u * u;
            bird.x = bird.from.x + (bird.to.x - bird.from.x) * e;
            bird.y = bird.from.y + (bird.to.y - bird.from.y) * e - Math.sin(u * Math.PI) * BIRDS.outArc;
            bird.shape = flap;
        }
        return true;
    };

    /** Where a bird is drawn: sitting, on its Token's own art grid, feet one art pixel into the top. */
    const birdBox = (bird, artU) => {
        const bp = bird.px;
        if (bird.state === 'sit') {
            const { spot } = bird;
            const left = spot.x - 1.5 * bp;
            const top = spot.y + artU - 2 * bp;
            return { x: snap(left, artU, spot.left), y: snap(top, artU, spot.y) };
        }
        return { x: snap(bird.x - 1.5 * bp, artU), y: snap(bird.y - 2 * bp, artU) };
    };

    const newCloud = (ctx, x) => {
        const { world, mat, settings } = ctx;
        const k = settings.cloudSize ?? 1;
        const shape = cloudShape(random, Math.max(2, Math.round(intBetween(random, CLOUDS.w) * k)), Math.max(2, Math.round(intBetween(random, CLOUDS.h) * k)));
        const y = random() * (mat.h + shape.h * world.unitU) - shape.h * world.unitU / 2;
        clouds.push({ key: `cloud${nextKey++}`, shape, x, y });
    };

    const stepClouds = (frame, ctx) => {
        const { world, mat, settings } = ctx;
        const unitU = world.unitU;
        const crossing = (mat.w / unitU + 30) * CLOUDS.framesPerPixel;
        if (!seeded) {
            seeded = true;
            for (let k = 0; k < settings.cloudCount; k++) newCloud(ctx, random() * mat.w);
            nextCloud = frame + Math.round(crossing / Math.max(1, settings.cloudCount) * random());
        }
        for (const c of clouds) c.x += unitU / CLOUDS.framesPerPixel;
        clouds = clouds.filter(c => c.x < mat.w + unitU);
        if (clouds.length < settings.cloudCount && frame >= nextCloud) {
            const shapeW = CLOUDS.w[1] * (settings.cloudSize ?? 1) * unitU;
            newCloud(ctx, -shapeW);
            nextCloud = frame + Math.round((crossing / Math.max(1, settings.cloudCount)) * (0.5 + random()));
        }
        while (clouds.length > settings.cloudCount) clouds.shift();
    };

    const stepParticles = (frame, ctx) => {
        const { world, mat, settings } = ctx;
        particles = particles.filter(p => frame - p.born < p.life);
        for (const kind of Object.keys(PARTICLES)) {
            const spec = PARTICLES[kind];
            const spots = world.spots?.[kind];
            if (!spots || !spots.length) { owed[kind] = 0; continue; }
            const alive = spec.alive * (world.share?.[kind] ?? 0) * settings.particleRate;
            owed[kind] += alive / ((spec.life[0] + spec.life[1]) / 2);
            while (owed[kind] >= 1) {
                owed[kind] -= 1;
                const s = Math.floor(random() * (spots.length / 2)) * 2;
                const x = spots[s] + (random() - 0.5) * 8;
                const y = spots[s + 1] + (random() - 0.5) * 8;
                if (x < 0 || y < 0 || x > mat.w || y > mat.h) continue;
                particles.push({
                    key: `${kind}${nextKey++}`, kind, born: frame, life: intBetween(random, spec.life), x0: x, y0: y,
                    phase: random() * TAU, colour: spec.colours[Math.floor(random() * spec.colours.length)], i: nextKey
                });
            }
        }
    };

    const particleSprite = (p, frame, world) => {
        const spec = PARTICLES[p.kind];
        const age = frame - p.born;
        const x = p.x0 + spec.vx * age + Math.sin((TAU * age) / spec.period + p.phase) * spec.sway;
        const y = p.y0 + spec.vy * age;
        const grid = spec.grid === 'ground' ? world.unitU : world.artU;
        let shape = PARTICLE_SHAPES.ember;
        let colour = p.colour;
        if (p.kind === 'leaves') shape = (age + p.i) % 4 < 2 ? PARTICLE_SHAPES.leafFlat : PARTICLE_SHAPES.leafSlant;
        else if (p.kind === 'petals') shape = PARTICLE_SHAPES.petal;
        else if ((age + p.i) % 5 === 0) colour = spec.flash;
        return { key: p.key, layer: 'life', x: snap(x, grid), y: snap(y, grid), px: world.artU, shape, colour };
    };

    let lastFrame = 0;
    let lastWorld = null;

    return {
        /**
         * One frame.
         * @param {number} frame
         * @param {{world: object, mat: {w: number, h: number}, tokens: Map<string, object>,
         *   worked: Set<string>, carried: string|null, art: {perchOf: (typeId: string) => object|null},
         *   settings: {birds: boolean, birdGapFrames: number, birdPixel: number, clouds: boolean,
         *   cloudCount: number, particles: boolean, particleRate: number}}} ctx
         */
        step(frame, ctx) {
            lastFrame = frame;
            lastWorld = ctx.world;
            const { settings } = ctx;
            if (settings.birds) {
                if (nextVisit === null) nextVisit = frame + intBetween(random, BIRDS.firstVisit);
                birds = birds.filter(b => stepBird(b, frame, ctx));
                if (frame >= nextVisit) {
                    if (birds.length < BIRDS.max) visit(frame, ctx);
                    nextVisit = frame + Math.round(settings.birdGapFrames * (0.5 + random()));
                }
            } else {
                birds = [];
                nextVisit = null;
            }
            if (settings.clouds) stepClouds(frame, ctx);
            else { clouds = []; seeded = false; }
            if (settings.particles) stepParticles(frame, ctx);
            else particles = [];
        },
        /** A visit now (the dev panel's button). */
        visitNow(frame) { nextVisit = frame; },
        /**
         * What to draw now: each sprite's `key`, its `layer` (`cloud` under `life`), its top-left in
         * mat units, the mat units per pixel of its `shape`, and its colour (`shade`: a cloud's
         * see-through black).
         */
        sprites(shade = 0.15) {
            const world = lastWorld;
            if (!world) return [];
            const out = [];
            for (const c of clouds) {
                out.push({
                    key: c.key, layer: 'cloud', shape: c.shape, px: world.unitU, colour: `rgba(0,0,0,${shade})`,
                    x: Math.floor(c.x / world.unitU) * world.unitU, y: Math.round(c.y / world.unitU) * world.unitU
                });
            }
            for (const p of particles) out.push(particleSprite(p, lastFrame, world));
            for (const b of birds) {
                if (lastFrame < b.start) continue;
                const { x, y } = birdBox(b, world.artU);
                out.push({ key: b.key, layer: 'life', x, y, px: b.px, shape: b.shape, colour: b.colour });
            }
            return out;
        },
        get birds() { return birds; },
        get clouds() { return clouds; },
        get particles() { return particles; }
    };
}

/**
 * What the sky needs of the ground under it: the art and ground pixel sizes, each look's bird
 * colour at a mat point, and for each kind of particle a scatter of points over its biome
 * (`samples` tries over the plan; embers rise from the lava's own pixels where there are any) with
 * the share of the mat its biome covers.
 *
 * @param {{plan: object, life: object|null, unitU: number, artU: number}} picture
 */
export function skyWorld({ plan, life, unitU, artU }, random, samples = 3000) {
    const { looks, terrainAt, width: W, height: H, unit: U } = plan;
    const lookAt = (x, y) => {
        const px = Math.min(W - 1, Math.max(0, Math.floor(x / U)));
        const py = Math.min(H - 1, Math.max(0, Math.floor(y / U)));
        return looks[terrainAt[py * W + px]];
    };
    const fallback = looks.map(id => LOOKS[id]?.ambient?.bird).find(Boolean) || DEFAULT_BIRD;
    const birdColourAt = (x, y) => LOOKS[lookAt(x, y)]?.ambient?.bird || fallback;
    const found = { leaves: [], petals: [], embers: [] };
    for (let k = 0; k < samples; k++) {
        const px = Math.floor(random() * W);
        const py = Math.floor(random() * H);
        const kind = LOOKS[looks[terrainAt[py * W + px]]]?.ambient?.particles;
        if (kind && found[kind]) found[kind].push((px + 0.5) * U, (py + 0.5) * U);
    }
    const share = Object.fromEntries(Object.entries(found).map(([kind, pts]) => [kind, pts.length / 2 / samples]));
    if (life?.lava && found.embers.length) {
        const { at } = life.lava;
        const pts = [];
        for (let k = 0; k < Math.min(1500, at.length); k++) {
            const i = at[Math.floor(random() * at.length)];
            const r = (i / life.cols) | 0;
            pts.push((i - r * life.cols + 0.5) * life.unit, (r + 0.5) * life.unit);
        }
        found.embers = pts;
    }
    const spots = Object.fromEntries(Object.entries(found).map(([kind, pts]) => [kind, Float32Array.from(pts)]));
    return { artU, unitU, birdColourAt, lookAt, spots, share };
}
