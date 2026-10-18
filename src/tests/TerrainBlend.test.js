import { describe, it, expect, afterEach } from 'vitest';
import {
    BLEND, BLEND_ORDER, BLEND_RULES, FADE_TINT, blendStylesFor, blendStyleOf, pairOf, blendBorders, groundTone
} from '../systems/board/TerrainBlend.js';
import { resolveArtPixels, distanceFromSeeds, PLAN_PIXEL_U } from '../systems/board/TerrainLattice.js';
import { buildGroundPlan } from '../systems/board/TerrainSurface.js';
import { buildScreenPass } from '../ui/components/board/groundScreen.js';
import { LAWN_TERRAIN } from '../config/registries/terrainRegistry.js';
import { budget } from '../systems/atlas/Budget.js';
import { layout } from '../systems/atlas/Layout.js';
import { DEV_MAPS } from '../systems/atlas/devMaps.js';
import { regionGround } from '../systems/atlas/regionGround.js';
import { tuning, setTuning, resetTuning } from '../config/playmatTuning.js';
import { groundWith } from './fixtures/ground.js';

/**
 * Brief 180 G6: where two biomes' ground meet, the drawing blends them in one of the owner's
 * styles from the world rounds (mixed band, islands, fingers, a lawn between, a fade), picked per
 * pair of grounds by the Region's seed. Drawing only: the plan's pixel map changes near borders,
 * the stored cells and placement never.
 */

afterEach(() => resetTuning());

const ALL = Object.freeze([BLEND.BAND, BLEND.ISLANDS, BLEND.FINGERS, BLEND.LAWN, BLEND.FADE]);
const NO_LAWN = Object.freeze([BLEND.BAND, BLEND.ISLANDS, BLEND.FINGERS, BLEND.FADE]);

/**
 * Forest grass on the left, mountain rock on the right with a bay of it reaching into the grass,
 * a strip of beach sand along the top, and a sea pool in the grass: every kind of border.
 */
const scene = (seed = 7) => groundWith(30, 18, (c, r) => {
    if (r < 3) return 'sand';
    if (c >= 8 && c < 11 && r >= 9 && r < 12) return 'water';
    if (c >= 16 || (c >= 12 && r >= 6 && r < 11)) return 'rock';
    return 'grass';
}, { seed });

/** The pixel map with and without the blend, the beach left out so only the blend differs. */
function maps(ground) {
    const plain = resolveArtPixels(ground, false, null);
    const blended = resolveArtPixels(ground, false, blendBorders);
    return { plain, blended };
}

/** The furthest a blend reaches from the border, in plan pixels, with the coarse grid's slack. */
function furthest() {
    const R = BLEND_RULES;
    const half = tuning('blendWidth') / 2 / PLAN_PIXEL_U;
    const own = Math.max(R.islandReach, R.fingerReach, Math.max(R.lawnFrom, R.lawnTo) + R.jag / 2 / half);
    // The samples lie 4 pixels apart and the chamfer distance is within 8 % of the straight one.
    return (own + R.wander) * half * 1.08 + 3 * 4;
}

describe('⭐ Which style a pair of grounds takes', () => {
    it('offers every pair the band, the islands, the fingers and the fade, and a lawn only between a wood and rock or sand', () => {
        expect(blendStylesFor('forest', 'mountain')).toEqual(ALL);
        expect(blendStylesFor('mountain', 'forest')).toEqual(ALL);
        expect(blendStylesFor('yellowstone', 'coast')).toEqual(ALL);
        expect(blendStylesFor('cherry_grove', 'mountain')).toEqual(ALL);
        // A meadow's grass is a lawn already; lava grows none; sand and rock have no wood.
        for (const [a, b] of [['meadow', 'mountain'], ['flower_meadow', 'coast'], ['volcano', 'forest'], ['coast', 'mountain']]) {
            expect(blendStylesFor(a, b), `${a} + ${b}`).toEqual(NO_LAWN);
        }
    });

    it('faces each pair soft side first: grass, then sand, then rock', () => {
        expect(pairOf('mountain', 'forest')).toEqual(['forest', 'mountain']);
        expect(pairOf('mountain', 'coast')).toEqual(['coast', 'mountain']);
        expect(pairOf('coast', 'yellowstone')).toEqual(['yellowstone', 'coast']);
        expect(pairOf('volcano', 'mountain')).toEqual(['mountain', 'volcano']);
    });

    it('⭐ picks one by the Region\'s seed and the pair: the same every time and either way round, and every style in some Region', () => {
        const seen = new Set();
        let differ = 0;
        for (let seed = 0; seed < 200; seed++) {
            const style = blendStyleOf(seed, 'forest', 'mountain');
            expect(blendStyleOf(seed, 'mountain', 'forest')).toBe(style);
            expect(blendStyleOf(seed, 'forest', 'mountain')).toBe(style);
            seen.add(style);
            if (blendStyleOf(seed, 'forest', 'coast') !== style) differ++;
        }
        expect([...seen].sort()).toEqual([...ALL].sort());
        // Two pairs in one Region pick apart.
        expect(differ).toBeGreaterThan(50);
    });

    it('lets the Blend style slider name one for the eye-check; a pair it does not suit keeps its own pick', () => {
        const own = blendStyleOf(11, 'meadow', 'mountain');
        BLEND_ORDER.forEach((style, k) => {
            setTuning('blendStyle', k + 1);
            expect(blendStyleOf(11, 'forest', 'mountain')).toBe(style);
            expect(blendStyleOf(11, 'meadow', 'mountain')).toBe(style === BLEND.LAWN ? own : style);
        });
    });
});

describe('⭐ The band: only near a border, only land, only the pair\'s grounds', () => {
    it('⭐ changes pixels only within the style\'s reach of a border between two land looks, and never the water', () => {
        for (let style = 1; style <= BLEND_ORDER.length; style++) {
            setTuning('blendStyle', style);
            const { plain, blended } = maps(scene());
            const { width, height, palette } = plain;
            const land = (p) => ['grass', 'rock', 'sand'].includes(palette[p]);
            // The border pixels of the map before the blend: a side neighbour of another land look.
            const border = new Uint8Array(width * height);
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const i = y * width + x;
                    const a = plain.at[i];
                    if (!land(a)) continue;
                    for (const j of [x + 1 < width ? i + 1 : -1, y + 1 < height ? i + width : -1]) {
                        if (j >= 0 && land(plain.at[j]) && plain.at[j] !== a) { border[i] = 1; border[j] = 1; }
                    }
                }
            }
            const dist = distanceFromSeeds(border, width, height);
            const name = BLEND_ORDER[style - 1];
            let changed = 0;
            let far = 0;
            const wrong = [];
            for (let i = 0; i < plain.at.length; i++) {
                const before = blended.palette[plain.at[i]];
                const after = blended.palette[blended.at[i]];
                if (before === after) continue;
                changed++;
                if (before === 'water' || !['grass', 'rock', 'sand', LAWN_TERRAIN].includes(after)) wrong.push(`${i}: ${before} > ${after}`);
                far = Math.max(far, dist[i] / 3);
            }
            expect(wrong.slice(0, 5), `${name}: ${wrong.length} wrong`).toEqual([]);
            expect(changed, name).toBeGreaterThan(500);
            expect(far, name).toBeLessThanOrEqual(furthest());
            expect(blended.blend.changed, name).toBe(changed);
        }
    });

    it('⭐ moves the border both ways: each ground\'s pieces lie in the other (the lawn on both sides)', () => {
        for (let style = 1; style <= BLEND_ORDER.length; style++) {
            setTuning('blendStyle', style);
            const { plain, blended } = maps(scene());
            const moves = new Map();
            for (let i = 0; i < plain.at.length; i++) {
                const from = plain.palette[plain.at[i]];
                const to = blended.palette[blended.at[i]];
                if (from !== to) moves.set(`${from}>${to}`, (moves.get(`${from}>${to}`) || 0) + 1);
            }
            const name = BLEND_ORDER[style - 1];
            if (name === BLEND.LAWN) {
                expect(moves.get(`grass>${LAWN_TERRAIN}`), name).toBeGreaterThan(100);
                expect(moves.get(`rock>${LAWN_TERRAIN}`), name).toBeGreaterThan(100);
            } else {
                expect(moves.get('grass>rock'), name).toBeGreaterThan(100);
                expect(moves.get('rock>grass'), name).toBeGreaterThan(100);
            }
        }
    });

    it('is the same on every build, and another Region\'s seed blends otherwise', () => {
        const a = maps(scene(7)).blended;
        const b = maps(scene(7)).blended;
        expect(Buffer.from(b.at).equals(Buffer.from(a.at))).toBe(true);
        const c = maps(scene(8)).blended;
        expect(Buffer.from(c.at).equals(Buffer.from(a.at))).toBe(false);
    });

    it('lays the lawn only where a lawn suits and claims its palette entry only when it lands', () => {
        setTuning('blendStyle', 4);
        const { blended } = maps(scene());
        const lawn = blended.palette.indexOf(LAWN_TERRAIN);
        expect(lawn).toBeGreaterThanOrEqual(0);
        expect(blended.present[lawn]).toBe(1);
        // Grass beside sand and rock takes it; the sand beside the rock keeps its own pick.
        expect(blended.blend.pairs).toContainEqual({ soft: 'forest', hard: 'mountain', style: BLEND.LAWN });
        expect(blended.blend.pairs.find(p => p.soft === 'coast' && p.hard === 'mountain')?.style ?? 'none').not.toBe(BLEND.LAWN);
        setTuning('blendStyle', 1);
        expect(maps(scene()).blended.palette).not.toContain(LAWN_TERRAIN);
    });

    it('does nothing with the switch off, or with fewer than two land looks', () => {
        setTuning('blendOn', 0);
        const { plain, blended } = maps(scene());
        expect(blended.blend).toBeNull();
        expect(Buffer.from(blended.at).equals(Buffer.from(plain.at))).toBe(true);
        resetTuning();
        const oneLook = groundWith(20, 12, (c) => (c < 5 ? 'water' : 'grass'), { seed: 3 });
        expect(resolveArtPixels(oneLook, false, blendBorders).blend).toBeNull();
    });
});

describe('⭐ The fade: a touch of the other ground\'s colour in its middle', () => {
    it('marks only pixels in the band\'s middle, each with the other ground of its pair', () => {
        setTuning('blendStyle', 5);
        const { blended } = maps(scene());
        const { tint, spans } = blended.blend;
        const { width, height, palette } = blended;
        let marked = 0;
        const wrong = [];
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = y * width + x;
                if (!tint[i]) continue;
                marked++;
                const toward = palette[tint[i] - 1];
                const here = palette[blended.at[i]];
                if (x < spans[2 * y] || x > spans[2 * y + 1]) wrong.push(`${x},${y} outside its row's span`);
                if (!['grass', 'rock', 'sand'].includes(toward) || toward === here) wrong.push(`${x},${y}: ${here} toward ${toward}`);
            }
        }
        expect(wrong.slice(0, 5), `${wrong.length} wrong`).toEqual([]);
        expect(marked).toBeGreaterThan(500);
        expect(FADE_TINT).toBeCloseTo(0.35 * 2 / 3, 6);
    });

    it('⭐ mixes the other ground\'s tone into exactly those pixels on screen', () => {
        setTuning('blendStyle', 5);
        const ground = scene();
        const plan = buildGroundPlan(ground);
        expect(plan.blend).not.toBeNull();
        const mat = ground.mat;
        const withTint = buildScreenPass(plan, { mat, unit: PLAN_PIXEL_U, sheet: () => null });
        const without = buildScreenPass({ ...plan, blend: null }, { mat, unit: PLAN_PIXEL_U, sheet: () => null });
        expect([withTint.cols, withTint.rows]).toEqual([plan.width, plan.height]);
        let moved = 0;
        const wrong = [];
        for (let i = 0; i < plan.width * plan.height; i++) {
            const d = i * 4;
            const same = withTint.data[d] === without.data[d] && withTint.data[d + 1] === without.data[d + 1] && withTint.data[d + 2] === without.data[d + 2];
            if (!plan.blend.tint[i]) {
                if (!same) wrong.push(`pixel ${i} changed with no tint`);
                continue;
            }
            if (!same) moved++;
            // Toward the tone, away from the mat's shaded edge: no channel further from it than before.
            const x = i % plan.width;
            const y = (i - x) / plan.width;
            if (x < 60 || y < 60 || x >= plan.width - 60 || y >= plan.height - 60) continue;
            const tone = plan.blend.tones[plan.blend.tint[i] - 1];
            for (let ch = 0; ch < 3; ch++) {
                if (Math.abs(withTint.data[d + ch] - tone[ch]) > Math.abs(without.data[d + ch] - tone[ch]) + 1) wrong.push(`pixel ${i} away from the tone`);
            }
        }
        expect(wrong.slice(0, 5), `${wrong.length} wrong`).toEqual([]);
        expect(moved).toBeGreaterThan(500);
    });

    it('takes each ground\'s tone from its kinds\' bodies, none for water', () => {
        expect(groundTone('mountain')).toHaveLength(3);
        expect(groundTone('forest')[1]).toBeGreaterThan(groundTone('forest')[0]);
        expect(groundTone('sea')).toBeNull();
        setTuning('grassOn', 0);
        expect(groundTone('forest')).toBeNull();
    });
});

describe('⭐ Drawing only: the stored ground and placement are the blend\'s to read, never to change', () => {
    const MAT = Object.freeze({ w: 1760, h: 1126 });
    const settle = (names, seed) => {
        const summary = budget(names.map(n => DEV_MAPS[n]), { cap: 128 });
        const result = layout(summary, { seed, mat: MAT, crowding: { hitboxPct: 80, overlapPct: 40 }, artRadius: () => 64 });
        return { seed, ground: summary.ground, terrain: result.terrain, nodes: result.nodes };
    };

    it('lays out the same Tokens on the same cells whatever the blend sliders say', () => {
        const before = settle(['forest', 'mountain'], 301);
        for (const [key, value] of [['blendOn', 0], ['blendStyle', 4], ['blendWidth', 256]]) {
            setTuning(key, value);
            expect(settle(['forest', 'mountain'], 301), key).toEqual(before);
            resetTuning();
        }
    });

    it('⭐ keeps a beach wherever the sea meets land, in every style', () => {
        for (const names of [['forest', 'coast'], ['mountain', 'coast'], ['volcano', 'coast'], ['yellowstone', 'coast']]) {
            const region = settle(names, 302);
            for (let style = 0; style <= BLEND_ORDER.length; style++) {
                setTuning('blendStyle', style);
                const plan = buildGroundPlan(regionGround(region, MAT));
                const { width, height, palette, terrainAt } = plan;
                const sea = palette.indexOf('water');
                expect(sea, names.join('+')).toBeGreaterThanOrEqual(0);
                let shore = 0;
                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        if (terrainAt[y * width + x] !== sea) continue;
                        for (let dy = -1; dy <= 1; dy++) {
                            for (let dx = -1; dx <= 1; dx++) {
                                const nx = x + dx;
                                const ny = y + dy;
                                if ((!dx && !dy) || nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                                const t = palette[terrainAt[ny * width + nx]];
                                if (t.startsWith('water')) continue;
                                shore++;
                                if (t !== 'sand') throw new Error(`${names.join('+')} style ${style}: the sea at ${x},${y} meets ${t}`);
                            }
                        }
                    }
                }
                expect(shore, names.join('+')).toBeGreaterThan(100);
            }
        }
    });
});
