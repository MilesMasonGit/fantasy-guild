// a node budget and a seed → where each Token stands

import { mulberry32 } from './seededRandom.js';

/**
 * The layout half of generation: places every Token a budget (`Budget.js`) writes, on a mat of a
 * given size, around a clear ring for the Guild Hall at the centre. A pure function of the budget,
 * the seed and the geometry it is handed: a reroll is a new seed, and moves only coordinates.
 *
 * - **Camps** go first, in the outer band of the mat ({@link CAMP_BAND}), spread from each other.
 * - **Nodes** grow in groves: each species gets one grove per {@link GROVE_SIZE} nodes, grove
 *   centres spread over the mat, and each node takes the free spot nearest its grove's centre.
 *   Species with the biggest bodies go first.
 * - **Treasures** go last, once each, into the most open spots left.
 *
 * A spot is legal by `MatPlacement`'s rules restated on explicit numbers: the art circle inside the
 * mat, centres at least the hitbox gap apart, plus clear of the Hall's ring and anything the
 * optional `allows` hook refuses (`layoutInputs.cannotCheck` asks the game's `Cannot` rules).
 * Nodes are spaced more loosely than that when the budget leaves room ({@link COMFORT_GAP}),
 * packing tighter as density modifiers add more.
 *
 * ⚠️ Determinism: every number comes from the seeded generator, whole-unit coordinates, and
 * arithmetic IEEE fixes exactly (+ − × ÷ sqrt). No trigonometry, no `Math.hypot`, no `**`: their
 * last bit may differ between browser engines, and a layout must be the same on every machine.
 */

/** The Token that stands at the centre of every Region. */
export const HALL_TYPE_ID = 'token_guild_hall';

/**
 * How far from the Hall's centre no generated Token's art may reach, in mat units: the Hall's art
 * (64) plus the shipped nudge reach (160), within which the Hall lands the quest Tokens it spawns.
 */
export const HALL_CLEARING = 224;

/** The spacing two standard Tokens get when the budget leaves room: a little art overlap reads as a grove. */
export const COMFORT_GAP = 112;

/**
 * The most of the free mat a layout fills when it spaces nodes out, so a dense budget packs its
 * nodes tighter rather than spreading them over the room left for building.
 */
export const NODE_AREA_SHARE = 0.5;

/**
 * Camps stand at least this far out from the centre towards the mat's edge (0 = the centre, 1 = a
 * Token touching the edge), measured on the nearer axis: their enemies wander and attack heroes
 * near them, so they stay away from the Hall.
 */
export const CAMP_BAND = 0.7;

/** The most nodes in one grove; a species with more grows several. */
export const GROVE_SIZE = 8;

/** How much more room a camp's preferred spacing gets, so its enemies have somewhere to stand. */
const CAMP_ROOM = 1.5;

const STANDARD_ART = 64;
const HEX = Math.sqrt(3) / 2;
const EPS = 1e-6;

/** Best-candidate draws when choosing a camp, grove or treasure centre. */
const CAMP_DRAWS = 8;
const GROVE_DRAWS = 10;
const TREASURE_DRAWS = 16;

/** Growing a grove: rounds of draws, each round reaching further from the grove. */
const GROW_ROUNDS = 4;
const GROW_DRAWS = 20;

/** Grid spacing of the last-resort scan, in mat units (as `MatPlacement.findSpotAnywhere`). */
const SCAN_STEP = 8;

const ROLE_CAMP = 'camp';
const ROLE_NODE = 'node';
const ROLE_TREASURE = 'treasure';

/** Where the Hall stands on a mat of this size: its centre, in whole units. */
export function hallSpot(mat) {
    return { x: Math.round(mat.w / 2), y: Math.round(mat.h / 2) };
}

/**
 * How far out from the centre a Token of art radius `art` stands, 0 at the centre and 1 touching
 * the mat's edge, by whichever axis is further out.
 */
export function campBand(point, art, mat) {
    const cx = mat.w / 2;
    const cy = mat.h / 2;
    const ex = Math.abs(point.x - cx) / Math.max(1, cx - art);
    const ey = Math.abs(point.y - cy) / Math.max(1, cy - art);
    return Math.max(ex, ey);
}

/**
 * Lay a budget out on the mat.
 *
 * @param {object|object[]} summary  a `Budget.budget()` result, or its `entries`
 * @param {object} options
 * @param {number} options.seed  any 32-bit number; a reroll passes a new one
 * @param {{w: number, h: number}} options.mat  the mat size in mat units, given explicitly so a
 *   layout means the same on every machine (the live mat size is a per-device dev setting)
 * @param {{hitboxPct: number, overlapPct: number}} options.crowding  the hitbox and overlap rules
 * @param {(typeId: string) => number} options.artRadius  a Token type's art radius
 * @param {(typeId: string, point: {x: number, y: number}, placed: {typeId: string, x: number, y: number}[]) => boolean} [options.allows]
 *   a last say on a spot that passes every geometric rule; `placed` includes the Hall
 * @param {string} [options.hallTypeId]
 * @returns {{seed: number, mat: {w: number, h: number}, hall: {typeId: string, x: number, y: number},
 *   nodes: {typeId: string, role: string, x: number, y: number}[], unplaced: {typeId: string, role: string}[]}}
 */
export function layout(summary, { seed, mat, crowding, artRadius, allows = null, hallTypeId = HALL_TYPE_ID } = {}) {
    if (!mat || !(mat.w > 0) || !(mat.h > 0)) throw new TypeError('layout() needs the mat size: { mat: { w, h } }');
    if (!crowding || !Number.isFinite(crowding.hitboxPct) || !Number.isFinite(crowding.overlapPct)) {
        throw new TypeError('layout() needs the crowding rules: { crowding: { hitboxPct, overlapPct } }');
    }
    if (typeof artRadius !== 'function') throw new TypeError('layout() needs artRadius(typeId)');

    const seed32 = (Number(seed) || 0) >>> 0;
    const random = mulberry32(seed32);
    const { w, h } = mat;
    const hall = hallSpot(mat);
    const factor = 1 - crowding.overlapPct / 100;

    const bodies = new Map();
    const bodyOf = (typeId) => {
        let body = bodies.get(typeId);
        if (!body) {
            const art = artRadius(typeId);
            body = { art, hit: Math.round(art * crowding.hitboxPct / 100) };
            bodies.set(typeId, body);
        }
        return body;
    };

    const items = expand(summary);
    // Squares written as products: `**` is `Math.pow`, which engines need not round alike.
    const units = items.reduce((n, it) => {
        const scale = bodyOf(it.typeId).art / STANDARD_ART;
        return n + scale * scale;
    }, 0);
    const ringReach = HALL_CLEARING + STANDARD_ART;
    const freeArea = Math.max(1, (w - 2 * STANDARD_ART) * (h - 2 * STANDARD_ART) - Math.PI * ringReach * ringReach);
    const spacing = units > 0 ? Math.min(COMFORT_GAP, Math.sqrt(NODE_AREA_SHARE * freeArea / (HEX * units))) : COMFORT_GAP;

    const minGap = (a, b) => (a.hit + b.hit) * factor;
    const prefGap = (a, aRole, b, bRole) => Math.max(minGap(a, b),
        spacing * (a.art + b.art) / (2 * STANDARD_ART) * (aRole === ROLE_CAMP || bRole === ROLE_CAMP ? CAMP_ROOM : 1));

    // Neighbours in square cells as wide as the widest gap any pair can ask for, so a spot only has
    // to look at the 3×3 cells round it.
    const hallBody = bodyOf(hallTypeId);
    let widest = hallBody;
    for (const it of items) if (bodyOf(it.typeId).art > widest.art) widest = bodyOf(it.typeId);
    const cell = Math.max(1, prefGap(widest, ROLE_CAMP, widest, ROLE_CAMP));
    const cols = Math.ceil(w / cell) + 1;
    const grid = new Map();
    const placed = [];

    const put = (record) => {
        const key = Math.floor(record.y / cell) * cols + Math.floor(record.x / cell);
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(record);
        placed.push(record);
    };

    const clearAt = (x, y, body, role, loose) => {
        const cx = Math.floor(x / cell);
        const cy = Math.floor(y / cell);
        for (let iy = cy - 1; iy <= cy + 1; iy++) {
            for (let ix = cx - 1; ix <= cx + 1; ix++) {
                if (ix < 0 || iy < 0 || ix >= cols) continue;
                const bucket = grid.get(iy * cols + ix);
                if (!bucket) continue;
                for (const p of bucket) {
                    const gap = loose ? minGap(body, p.body) : prefGap(body, role, p.body, p.role);
                    const dx = x - p.x;
                    const dy = y - p.y;
                    if (dx * dx + dy * dy < gap * gap - EPS) return false;
                }
            }
        }
        return true;
    };

    const outsideRing = (x, y, art) => {
        const dx = x - hall.x;
        const dy = y - hall.y;
        const reach = HALL_CLEARING + art;
        return dx * dx + dy * dy >= reach * reach;
    };

    /** `loose`: only the game's own gap, not the comfortable one (the last resort). */
    const legal = (item, x, y, loose = false) => {
        const body = bodyOf(item.typeId);
        if (x < body.art || y < body.art || x > w - body.art || y > h - body.art) return false;
        if (!outsideRing(x, y, body.art)) return false;
        if (item.role === ROLE_CAMP && campBand({ x, y }, body.art, mat) < CAMP_BAND) return false;
        if (!clearAt(x, y, body, item.role, loose)) return false;
        return !allows || allows(item.typeId, { x, y }, placed) === true;
    };

    const between = (lo, hi) => lo + Math.floor(random() * (hi - lo + 1));
    const onMat = (art) => ({ x: between(Math.ceil(art), Math.floor(w - art)), y: between(Math.ceil(art), Math.floor(h - art)) });

    /** A whole-unit point between `lo` and `hi` from `(cx, cy)`, by rejection: no trigonometry. */
    const around = (cx, cy, lo, hi) => {
        for (let tries = 0; tries < 16; tries++) {
            const dx = (random() * 2 - 1) * hi;
            const dy = (random() * 2 - 1) * hi;
            const d2 = dx * dx + dy * dy;
            if (d2 >= lo * lo && d2 <= hi * hi) return { x: Math.round(cx + dx), y: Math.round(cy + dy) };
        }
        return null;
    };

    /** Of `draws` accepted random points, the one furthest from everything in `from`. */
    const roomiest = (art, draws, accept, from) => {
        let best = null;
        let bestScore = -1;
        let accepted = 0;
        for (let tries = 0; accepted < draws && tries < draws * 40; tries++) {
            const p = onMat(art);
            if (!accept(p)) continue;
            accepted++;
            let score = Infinity;
            for (const a of from) {
                const dx = p.x - a.x;
                const dy = p.y - a.y;
                score = Math.min(score, dx * dx + dy * dy);
            }
            if (score > bestScore) {
                best = p;
                bestScore = score;
            }
        }
        return best || { x: hall.x, y: hall.y };
    };

    /**
     * The nearest legal grid spot to `anchor`, walking out in square rings and stopping once no
     * further ring can hold anything nearer.
     */
    const scan = (item, anchor, loose) => {
        const { art } = bodyOf(item.typeId);
        const x0 = Math.ceil(art);
        const y0 = Math.ceil(art);
        const iMax = Math.floor((Math.floor(w - art) - x0) / SCAN_STEP);
        const jMax = Math.floor((Math.floor(h - art) - y0) / SCAN_STEP);
        if (iMax < 0 || jMax < 0) return null;
        const ci = Math.min(iMax, Math.max(0, Math.round((anchor.x - x0) / SCAN_STEP)));
        const cj = Math.min(jMax, Math.max(0, Math.round((anchor.y - y0) / SCAN_STEP)));
        let best = null;
        let bestD = Infinity;
        const tryAt = (i, j) => {
            if (i < 0 || j < 0 || i > iMax || j > jMax) return;
            const x = x0 + i * SCAN_STEP;
            const y = y0 + j * SCAN_STEP;
            const dx = x - anchor.x;
            const dy = y - anchor.y;
            const d = dx * dx + dy * dy;
            if (d < bestD && legal(item, x, y, loose)) {
                best = { x, y };
                bestD = d;
            }
        };
        const kMax = Math.max(ci, iMax - ci, cj, jMax - cj);
        for (let k = 0; k <= kMax; k++) {
            const near = (k - 1) * SCAN_STEP;
            if (best && near > 0 && bestD <= near * near) break;
            if (k === 0) { tryAt(ci, cj); continue; }
            for (let i = ci - k; i <= ci + k; i++) { tryAt(i, cj - k); tryAt(i, cj + k); }
            for (let j = cj - k + 1; j <= cj + k - 1; j++) { tryAt(ci - k, j); tryAt(ci + k, j); }
        }
        return best;
    };

    /** A spot for `item` as near `anchor` as the grove allows, else anywhere legal, else null. */
    const spotNear = (item, anchor, members) => {
        if (!members.length && legal(item, anchor.x, anchor.y)) return { x: anchor.x, y: anchor.y };
        const body = bodyOf(item.typeId);
        const gap = prefGap(body, item.role, body, item.role);
        for (let round = 0; round < GROW_ROUNDS; round++) {
            const reach = gap * (1.6 + 0.8 * round);
            let best = null;
            let bestScore = Infinity;
            for (let k = 0; k < GROW_DRAWS; k++) {
                const from = members.length ? members[Math.floor(random() * members.length)] : anchor;
                const p = around(from.x, from.y, members.length ? gap : 0, reach);
                if (!p || !legal(item, p.x, p.y)) continue;
                const dx = p.x - anchor.x;
                const dy = p.y - anchor.y;
                // A little jitter, so a grove's edge is ragged rather than a perfect disc.
                const score = (dx * dx + dy * dy) * (0.8 + 0.4 * random());
                if (score < bestScore) {
                    best = p;
                    bestScore = score;
                }
            }
            if (best) return best;
        }
        return scan(item, anchor, false) || scan(item, anchor, true);
    };

    const nodes = [];
    const unplaced = [];
    const place = (item, spot) => {
        if (!spot) {
            unplaced.push({ typeId: item.typeId, role: item.role });
            return null;
        }
        const record = { typeId: item.typeId, role: item.role, x: spot.x, y: spot.y, body: bodyOf(item.typeId) };
        put(record);
        nodes.push(record);
        return record;
    };

    put({ typeId: hallTypeId, role: 'hall', x: hall.x, y: hall.y, body: hallBody });

    const anchors = [{ x: hall.x, y: hall.y }];
    for (const item of items.filter(it => it.role === ROLE_CAMP)) {
        const { art } = bodyOf(item.typeId);
        const anchor = roomiest(art, CAMP_DRAWS, p => campBand(p, art, mat) >= CAMP_BAND, anchors);
        const record = place(item, spotNear(item, anchor, []));
        anchors.push(record || anchor);
    }

    // Biggest bodies first, as in any packing: a 2×2 placed last finds only the gaps small Tokens
    // left, which on a dense mat are too small for it.
    const bySize = speciesOf(items).sort((a, b) => bodyOf(b.typeId).art - bodyOf(a.typeId).art);
    const groves = [];
    for (const species of bySize) {
        const count = species.items.length;
        const k = Math.ceil(count / GROVE_SIZE);
        let next = 0;
        for (let g = 0; g < k; g++) {
            const size = Math.floor(count / k) + (g < count % k ? 1 : 0);
            const { art } = bodyOf(species.typeId);
            const anchor = roomiest(art, GROVE_DRAWS, p => outsideRing(p.x, p.y, art), anchors);
            anchors.push(anchor);
            groves.push({ anchor, items: species.items.slice(next, next + size) });
            next += size;
        }
    }
    for (const grove of groves) {
        const members = [];
        for (const item of grove.items) {
            const record = place(item, spotNear(item, grove.anchor, members));
            if (record) members.push(record);
        }
    }

    for (const item of items.filter(it => it.role === ROLE_TREASURE)) {
        const { art } = bodyOf(item.typeId);
        const anchor = roomiest(art, TREASURE_DRAWS, p => outsideRing(p.x, p.y, art), placed);
        place(item, spotNear(item, anchor, []));
    }

    return {
        seed: seed32,
        mat: { w, h },
        hall: { typeId: hallTypeId, x: hall.x, y: hall.y },
        nodes: nodes.map(({ typeId, role, x, y }) => ({ typeId, role, x, y })),
        unplaced
    };
}

/** One item per Token to place, camps first, then nodes, then treasures, in budget order. */
function expand(summary) {
    const entries = Array.isArray(summary) ? summary : (summary?.entries || []);
    const items = [];
    for (const role of [ROLE_CAMP, ROLE_NODE, ROLE_TREASURE]) {
        for (const e of entries) {
            if (e?.role !== role || !e.typeId) continue;
            const count = Math.max(0, Math.floor(e.count) || 0);
            for (let i = 0; i < count; i++) items.push({ typeId: e.typeId, role });
        }
    }
    return items;
}

/** The node items grouped by species, in the order they first appear. */
function speciesOf(items) {
    const bySpecies = new Map();
    for (const item of items) {
        if (item.role !== ROLE_NODE) continue;
        if (!bySpecies.has(item.typeId)) bySpecies.set(item.typeId, { typeId: item.typeId, items: [] });
        bySpecies.get(item.typeId).items.push(item);
    }
    return [...bySpecies.values()];
}
