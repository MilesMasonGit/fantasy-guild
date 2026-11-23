// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach, beforeAll, afterAll } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as Orders from '../systems/board/Orders.js';
import * as Flags from '../systems/board/Flags.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { ALERT, BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { artRadiusOf } from '../config/matGeometry.js';
import { HERO_HIT_PX, HERO_BOX_PX } from '../ui/components/board/boardConstants.js';
import { placeAt, clearMat } from './fixtures/mat.js';
import { manualFrames } from './fixtures/manualFrames.js';
import { RING_GROW_MS } from '../ui/components/board/growRing.js';
import { setDrawingPaused } from '../ui/components/board/frameClock.js';
import { pixelRingCells } from '../ui/components/board/pixelRing.js';
import { MAT_Z, taskRingZ } from '../ui/components/board/matLayers.js';
import { TaskRings } from '../ui/components/board/TaskRings.jsx';
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import {
    TASK_AREA_LAYERS, TASK_FADE_STEPS, TASK_FADE_STEP_PX, TASK_RING_PAD_PX,
    taskRingOf, taskJobsOf, taskJobsKey, taskRingTarget, createTaskRingSet, diskRows, dimRuns,
    erodeRuns, fadeBands, fadeStrength, runsPath
} from '../ui/components/board/taskRing.js';

/**
 * ⭐ The job areas (brief 830 D4, the owner's pick E): the ground round every job in progress toned
 * like old parchment by one shared shape, so overlapping areas tone the ground once, its outer edge
 * fading in whole art-pixel steps. No line, working or stuck: the "!" tells a stuck job. Each area
 * is centred between its Token and its heroes, grows when a job starts and shrinks when it ends; at
 * rest nothing runs; a pause, a load or a catch-up jumps every area to its end instead of replaying
 * it. Working has no green outline (`SpriteFxLook.test.js`).
 */

const h = React.createElement;
const SCALE = 2;

let frames;
beforeEach(() => { frames = manualFrames(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const job = (id, x, y, r = 96) => ({ id, x, y, r });
const target = (id, cx, cy, px) => ({ id, cx, cy, px });
/** The areas drawn, as the wrapper lists them: `id@px` each. */
const ringsIn = (container) => (container.querySelector('[data-task-rings]')?.getAttribute('data-task-jobs') || '')
    .split(' ').filter(Boolean).map(w => { const [id, px] = w.split('@'); return { id, px: Number(px) }; });
const pxIn = (container, id) => ringsIn(container).find(r => r.id === id)?.px ?? null;
const layerSel = (layer) => `[data-task-area-layer="${layer.blend ?? 'shade'}"]`;

/** The art-pixel cells an SVG path of one-cell-tall rectangles covers (`runsPath`'s form). */
function pathCells(d) {
    const out = new Set();
    for (const [, x, y, len] of (d || '').matchAll(/M(-?\d+) (-?\d+)h(\d+)v1h-?\d+z/g)) {
        for (let i = 0; i < Number(len); i++) out.add(`${Number(x) + i},${Number(y)}`);
    }
    return out;
}

/** The cells of a run map. */
function runCells(rows) {
    const out = new Set();
    for (const [y, runs] of rows) for (const [x0, x1] of runs) for (let x = x0; x <= x1; x++) out.add(`${x},${y}`);
    return out;
}

/** Every cell inside a circle, from its own cells. */
function cellsInside({ cx, cy, px }) {
    const out = new Set();
    for (const [dy, [x0, x1]] of diskRows(px)) for (let x = x0; x <= x1; x++) out.add(`${cx + x},${cy + dy}`);
    return out;
}

/** Each cell's four-neighbour distance from the ground outside the set, counted afresh. */
function distances(cells) {
    const d = new Map();
    let front = [];
    for (const k of cells) {
        const [x, y] = k.split(',').map(Number);
        if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !cells.has(`${x + dx},${y + dy}`))) {
            d.set(k, 1);
            front.push(k);
        }
    }
    for (let n = 2; front.length; n++) {
        const next = [];
        for (const k of front) {
            const [x, y] = k.split(',').map(Number);
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const j = `${x + dx},${y + dy}`;
                if (cells.has(j) && !d.has(j)) { d.set(j, n); next.push(j); }
            }
        }
        front = next;
    }
    return d;
}

describe('a job\'s area: centred between the Token and its heroes, framing them whole', () => {
    const token = { id: 't1', typeId: 'fixture_producer', x: 600, y: 400 };
    const body = artRadiusOf('fixture_producer');
    /** A hero's figure as `MatHero` draws it: HERO_HIT_PX wide, HERO_BOX_PX tall, centred on where they stand. */
    const heroBox = (h) => [h.x - HERO_HIT_PX / 2, h.y - HERO_BOX_PX / 2, h.x + HERO_HIT_PX / 2, h.y + HERO_BOX_PX / 2];
    const corners = ([l, t, r, b]) => [[l, t], [r, t], [l, b], [r, b]];

    // The owner, 23 Nov: centred between the art, not on the middle of the hit boxes.
    it('⭐ one hero beside it: centred halfway between the Token\'s point and the hero\'s, both whole inside', () => {
        const hero = { x: 600 + body + 32, y: 400 };
        const ring = taskRingOf(token, [hero], SCALE);
        expect(ring.x).toBe((token.x + hero.x) / 2);
        expect(ring.y).toBe(token.y);
        // Not the middle of the boxes, which leans to the Token.
        const tokenBox = [token.x - body, token.y - body, token.x + body, token.y + body];
        expect(ring.x).toBeGreaterThan((tokenBox[0] + heroBox(hero)[2]) / 2);
        // Its radius reaches the farthest corner of either box, plus the margin.
        const far = Math.max(...[...corners(tokenBox), ...corners(heroBox(hero))].map(([x, y]) => Math.hypot(x - ring.x, y - ring.y)));
        expect(ring.r).toBeCloseTo(far + TASK_RING_PAD_PX * SCALE);
    });

    it('a hero standing a little higher or lower: centred between the two points, both whole inside', () => {
        const hero = { x: 600 + body + 32, y: 430 };
        const ring = taskRingOf(token, [hero], SCALE);
        expect(ring.y).toBe((token.y + hero.y) / 2);
        for (const [x, y] of corners(heroBox(hero))) expect(Math.hypot(x - ring.x, y - ring.y)).toBeLessThan(ring.r);
    });

    it('about 60 art pixels round a one-cell Token and one hero at a 1920 x 1080 window (54 when it was centred on the boxes)', () => {
        // That window fits the mat at 0.9: two screen pixels an art pixel, 2.22 mat units an art pixel.
        const artScale = 2 / 0.9;
        const ring = taskRingOf(token, [{ x: 600 + body + 32, y: 400 }], artScale);
        expect(taskRingTarget(ring, artScale).px).toBe(60);
    });

    it('several heroes: centred on the middle of all their points and the Token\'s', () => {
        const heroes = [{ x: 600 + body + 32, y: 400 }, { x: 600 - body - 32, y: 400 }];
        const two = taskRingOf(token, heroes, SCALE);
        expect(two.x).toBe(token.x);
        expect(two.r).toBeGreaterThan(taskRingOf(token, heroes.slice(0, 1), SCALE).r);
        const three = taskRingOf(token, [...heroes, { x: 600, y: 400 + body + 64 }], SCALE);
        expect(three.y).toBe((400 * 3 + 400 + body + 64) / 4);
    });

    it('on the art grid: the centre cell as the reach ring snaps it, the radius in whole art pixels', () => {
        expect(taskRingTarget({ id: 'a', x: 101, y: 51, r: 97 }, SCALE)).toEqual({ id: 'a', cx: 50, cy: 25, px: 49 });
    });
});

describe('which jobs have an area', () => {
    const tokens = [
        { id: 'b', typeId: 'fixture_producer', x: 900, y: 400 },
        { id: 'a', typeId: 'fixture_producer', x: 400, y: 400 },
        { id: 'walker', typeId: 'fixture_producer', x: null, y: 300 },
        { id: 'held', typeId: 'fixture_producer', x: 1200, y: 400 }
    ];
    const hero = (heroId, tokenId, more = {}) => ({ heroId, tokenId, stuck: false, x: 500, y: 400, ...more });

    it('one area per worked Token, centred among its Token and every hero working it, sorted by Token id', () => {
        const jobs = taskJobsOf([hero('h1', 'b', { x: 1000 }), hero('h2', 'a'), hero('h3', 'b', { x: 800 })], tokens, { artScale: SCALE });
        expect(jobs.map(j => j.id)).toEqual(['a', 'b']);
        expect(jobs[1].x).toBe(900);
        expect(jobs[0].x).toBe(450);
    });

    it('not for a hero who is not working or still walking up; not for a walking or carried Token', () => {
        const heroes = [
            hero('idle', null),
            hero('walking', 'a', { x: null, y: null }),
            hero('w', 'walker'),
            hero('c', 'held')
        ];
        expect(taskJobsOf(heroes, tokens, { carriedId: 'held', artScale: SCALE })).toEqual([]);
    });

    // The owner, 23 Nov: no amber, no line; the "!" and its bubble tell a stuck job.
    it('⭐ a stuck job keeps its area exactly as a working one: nothing marks it stuck', () => {
        const stuck = taskJobsOf([hero('h2', 'b', { stuck: true, x: 1000 })], tokens, { artScale: SCALE });
        const working = taskJobsOf([hero('h2', 'b', { x: 1000 })], tokens, { artScale: SCALE });
        expect(stuck).toEqual(working);
        expect(Object.keys(stuck[0]).sort()).toEqual(['id', 'r', 'x', 'y']);
        expect(taskJobsKey(stuck)).toBe(taskJobsKey(working));
    });

    it('the key changes only when an area would', () => {
        const a = taskJobsOf([hero('h2', 'a')], tokens, { artScale: SCALE });
        const b = taskJobsOf([hero('h2', 'a'), hero('idle', null, { x: 123 })], tokens, { artScale: SCALE });
        expect(taskJobsKey(a)).toBe(taskJobsKey(b));
        const c = taskJobsOf([hero('h2', 'a', { x: 300 })], tokens, { artScale: SCALE });
        expect(taskJobsKey(c)).not.toBe(taskJobsKey(a));
    });
});

describe('the area set: grow, stay, shrink, never replay', () => {
    it('a new ring grows from nothing to full in RING_GROW_MS, in whole art pixels, then stands still', () => {
        const set = createTaskRingSet();
        set.aim([target('a', 10, 10, 40)], 0);
        expect(set.at(0)).toEqual([]);
        expect(set.at(RING_GROW_MS / 2)).toEqual([target('a', 10, 10, 20)]);
        expect(set.moving(RING_GROW_MS / 2)).toBe(true);
        expect(set.at(RING_GROW_MS)).toEqual([target('a', 10, 10, 40)]);
        expect(set.moving(RING_GROW_MS)).toBe(false);
        const settled = set.at(RING_GROW_MS);
        expect(set.at(RING_GROW_MS + 5000)).toBe(settled);
    });

    it('a ring no longer wanted shrinks from where it is, its centre held, and is forgotten', () => {
        const set = createTaskRingSet();
        set.aim([target('a', 10, 10, 40)], 0, true);
        set.aim([], 1000);
        expect(set.at(1000 + RING_GROW_MS / 2)).toEqual([target('a', 10, 10, 20)]);
        expect(set.at(1000 + RING_GROW_MS)).toEqual([]);
        expect(set.moving(1000 + RING_GROW_MS)).toBe(false);
    });

    it('wanted again while shrinking, it grows back from there', () => {
        const set = createTaskRingSet();
        set.aim([target('a', 10, 10, 40)], 0, true);
        set.aim([], 1000);
        set.aim([target('a', 10, 10, 40)], 1000 + RING_GROW_MS / 4);
        expect(set.at(1000 + RING_GROW_MS / 4)).toEqual([target('a', 10, 10, 30)]);
        expect(set.at(1000 + RING_GROW_MS / 2)).toEqual([target('a', 10, 10, 40)]);
    });

    it('a settled ring that changes size or moves (a hero joins, the fit) jumps, as the reach ring does', () => {
        const set = createTaskRingSet();
        set.aim([target('a', 10, 10, 40)], 0, true);
        set.aim([target('a', 12, 10, 48)], 100);
        expect(set.at(100)).toEqual([target('a', 12, 10, 48)]);
        expect(set.moving(100)).toBe(false);
    });

    it('a snap jumps every ring to its end, in and out', () => {
        const set = createTaskRingSet();
        set.aim([target('a', 10, 10, 40), target('b', 50, 10, 30)], 0, true);
        expect(set.at(0).map(r => r.px)).toEqual([40, 30]);
        expect(set.moving(0)).toBe(false);
        set.aim([target('b', 50, 10, 30)], 10, true);
        expect(set.at(10)).toEqual([target('b', 50, 10, 30)]);
    });

    it('⭐ a burst of starts and ends before the next frame is one tween per ring, not a replay', () => {
        const set = createTaskRingSet();
        // A job starts, ends and starts again inside one stalled stretch.
        set.aim([target('a', 10, 10, 40)], 0);
        set.aim([], 1);
        set.aim([target('a', 10, 10, 40)], 2);
        set.aim([target('a', 10, 10, 40), target('b', 60, 10, 40)], 3);
        // A long stall later: both whole, nothing moving.
        expect(set.at(10000).map(r => r.px)).toEqual([40, 40]);
        expect(set.moving(10000)).toBe(false);
    });
});

describe('⭐ one shape for every area: overlapping areas tone the ground once', () => {
    it('an area is as round as the reach ring: each row runs from its first ring cell to its last', () => {
        const cells = pixelRingCells(30);
        const rows = diskRows(30);
        for (const [x, y] of cells) {
            const [x0, x1] = rows.get(y);
            expect(x).toBeGreaterThanOrEqual(x0);
            expect(x).toBeLessThanOrEqual(x1);
        }
        for (let y = -30; y <= 30; y++) expect(rows.has(y)).toBe(true);
    });

    it('two overlapping areas: every cell of their union is covered once, never twice', () => {
        const a = { cx: 100, cy: 100, px: 40 };
        const b = { cx: 150, cy: 110, px: 36 };
        const inA = cellsInside(a);
        const inB = cellsInside(b);
        const union = new Set([...inA, ...inB]);
        const shared = [...inA].filter(c => inB.has(c));
        expect(shared.length).toBeGreaterThan(500);
        let covered = 0;
        for (const [y, runs] of dimRuns([a, b])) {
            for (let i = 0; i < runs.length; i++) {
                const [x0, x1] = runs[i];
                if (i > 0) expect(x0).toBeGreaterThan(runs[i - 1][1] + 1);
                for (let x = x0; x <= x1; x++) {
                    expect(union.has(`${x},${y}`)).toBe(true);
                    covered += 1;
                }
            }
        }
        expect(covered).toBe(union.size);
    });

    it('the path is one rectangle per run, in art pixels from the mat corner', () => {
        expect(runsPath(dimRuns([{ cx: 0, cy: 0, px: 1 }]))).toBe('M-1 0h3v1h-3zM0 1h1v1h-1zM0 -1h1v1h-1z');
    });
});

describe('⭐ the edge fades in whole art-pixel steps, only at the merged shape\'s outer edge', () => {
    const W = TASK_FADE_STEPS * TASK_FADE_STEP_PX;
    const a = { cx: 100, cy: 100, px: 40 };
    const b = { cx: 150, cy: 110, px: 36 };

    it('the owner\'s wider fade: six steps of two art pixels, twelve in all, each stronger inward, the core whole', () => {
        expect(TASK_FADE_STEPS).toBe(6);
        expect(TASK_FADE_STEP_PX).toBe(2);
        const s = Array.from({ length: TASK_FADE_STEPS }, (_, k) => fadeStrength(k));
        for (let k = 1; k < s.length; k++) expect(s[k]).toBeGreaterThan(s[k - 1]);
        expect(s[0]).toBeGreaterThan(0);
        expect(s.at(-1)).toBeLessThan(1);
    });

    it('erosion wears a shape away by one art pixel: a one-pixel circle keeps only its middle', () => {
        expect(runCells(erodeRuns(dimRuns([{ cx: 0, cy: 0, px: 1 }])))).toEqual(new Set(['0,0']));
    });

    it('⭐ a lone area: its bands and core cover it once, each cell in the band of its distance in from the edge', () => {
        const rows = dimRuns([a]);
        const all = runCells(rows);
        const { bands, core } = fadeBands(rows);
        expect(bands).toHaveLength(TASK_FADE_STEPS);
        const dist = distances(all);
        const seen = new Set();
        bands.forEach((band, k) => {
            const cells = runCells(band);
            expect(cells.size).toBeGreaterThan(0);
            for (const c of cells) {
                expect(seen.has(c)).toBe(false);
                seen.add(c);
                expect(dist.get(c)).toBeGreaterThan(k * TASK_FADE_STEP_PX);
                expect(dist.get(c)).toBeLessThanOrEqual((k + 1) * TASK_FADE_STEP_PX);
            }
        });
        for (const c of runCells(core)) {
            expect(seen.has(c)).toBe(false);
            seen.add(c);
            expect(dist.get(c)).toBeGreaterThan(W);
        }
        expect(seen).toEqual(all);
    });

    it('⭐ two overlapping areas fade only at their union\'s outer edge: deep inside the overlap is core', () => {
        const union = new Set([...cellsInside(a), ...cellsInside(b)]);
        const { bands, core } = fadeBands(dimRuns([a, b]));
        const coreCells = runCells(core);
        const dist = distances(union);
        // Each area's own edge, where it runs deep inside the other: no fade there.
        const ownEdgeDeep = [...pixelRingCells(a.px).map(([x, y]) => `${a.cx + x},${a.cy + y}`),
            ...pixelRingCells(b.px).map(([x, y]) => `${b.cx + x},${b.cy + y}`)].filter(k => dist.get(k) > W);
        expect(ownEdgeDeep.length).toBeGreaterThan(20);
        for (const k of ownEdgeDeep) expect(coreCells.has(k)).toBe(true);
        // And every band cell lies within the fade's width of the union's outside.
        for (const band of bands) for (const c of runCells(band)) expect(dist.get(c)).toBeLessThanOrEqual(W);
    });

    it('an area too small for the whole fade is all bands, no core', () => {
        const { bands, core } = fadeBands(dimRuns([{ cx: 0, cy: 0, px: 5 }]));
        expect(core.size).toBe(0);
        expect(runCells(bands[0]).size).toBeGreaterThan(0);
    });
});

describe('TaskRings: toned on the ground, grown and shrunk per job, still at rest', () => {
    /** `again(jobs, z, resets)`: the mat's next render; `resets` stays as last given unless named. */
    const mount = (jobs) => {
        const out = render(h(TaskRings, { jobs }));
        let resets = 0;
        const again = (next, z, count = resets) => {
            resets = count;
            out.rerender(h(TaskRings, { jobs: next, z, resets }));
        };
        return { ...out, again };
    };
    const A = [job('a', 400, 400)];

    it('⭐ a job starting grows its area from nothing, stepping, then it stands still asking for no frames', () => {
        const { container, again } = mount([]);
        expect(container.querySelector('[data-task-rings]')).toBeNull();
        again(A);
        const seen = [];
        for (let i = 0; i < 20; i++) {
            frames.frame(16);
            seen.push(pxIn(container, 'a') ?? 0);
        }
        const full = seen.at(-1);
        expect(full).toBe(48);
        for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]);
        expect(seen[Math.ceil(RING_GROW_MS / 16) - 1]).toBe(full);
        expect(seen.filter(px => px > 0 && px < full).length).toBeGreaterThan(5);
        expect(frames.pending()).toBe(0);
    });

    it('⭐ the job ending shrinks the area away, then nothing is drawn and no frame asked', () => {
        const { container, again } = mount([]);
        again(A);
        frames.run(RING_GROW_MS + 32);
        again([]);
        frames.frame(16);
        const mid = pxIn(container, 'a');
        expect(mid).toBeGreaterThan(0);
        expect(mid).toBeLessThan(48);
        frames.run(RING_GROW_MS + 32);
        expect(container.querySelector('[data-task-rings]')).toBeNull();
        expect(frames.pending()).toBe(0);
    });

    it('areas standing when the mat appears are drawn whole at once', () => {
        const { container } = mount(A);
        expect(pxIn(container, 'a')).toBe(48);
        expect(frames.pending()).toBe(0);
    });

    it('⭐ the parchment tone: one SVG per layer, in order, each the fade bands and the core at the layer\'s strength', () => {
        const jobs = [job('a', 400, 400), job('b', 520, 410)];
        const { container } = mount(jobs);
        const { bands, core } = fadeBands(dimRuns(jobs.map(j => taskRingTarget(j, SCALE))));
        const want = [...bands.map(runsPath), runsPath(core)];
        const svgs = [...container.querySelectorAll('[data-task-area-layer]')];
        expect(svgs).toHaveLength(TASK_AREA_LAYERS.length);
        TASK_AREA_LAYERS.forEach((layer, i) => {
            expect(svgs[i]).toBe(container.querySelector(layerSel(layer)));
            expect(svgs[i].style.mixBlendMode).toBe(layer.blend ?? '');
            expect(svgs[i].querySelector('g').getAttribute('fill')).toBe(layer.fill);
            const paths = [...svgs[i].querySelectorAll('path')];
            expect(paths.map(p => p.getAttribute('d'))).toEqual(want);
            paths.forEach((p, k) => {
                const strength = k === want.length - 1 ? 1 : fadeStrength(k);
                expect(Number(p.getAttribute('fill-opacity'))).toBeCloseTo(layer.opacity * strength);
            });
        });
        expect(TASK_AREA_LAYERS.map(l => l.blend)).toEqual(['saturation', 'color', 'soft-light', null]);
        expect(ringsIn(container).map(r => r.id)).toEqual(['a', 'b']);
    });

    it('⭐ no line: the tone covers the whole union, edge cells too, each cell once', () => {
        const jobs = [job('a', 400, 400), job('b', 520, 410)];
        const targets = jobs.map(j => taskRingTarget(j, SCALE));
        const { container } = mount(jobs);
        expect(container.querySelector('[data-task-ring]')).toBeNull();
        expect(container.querySelector('[data-task-ring-shadow]')).toBeNull();
        const union = new Set(targets.flatMap(t => [...cellsInside(t)]));
        const seen = [];
        for (const p of container.querySelectorAll(`${layerSel(TASK_AREA_LAYERS[0])} path`)) seen.push(...pathCells(p.getAttribute('d')));
        expect(seen).toHaveLength(union.size);
        expect(new Set(seen)).toEqual(union);
    });

    it('⭐ at rest the tone is never drawn again: a render with the same jobs touches nothing', () => {
        const { container, again } = mount(A);
        const path = container.querySelector('[data-task-area-layer] path');
        const changes = [];
        const watch = new MutationObserver(list => changes.push(...list));
        watch.observe(container, { subtree: true, attributes: true, childList: true });
        again(A);
        again([job('a', 400, 400)]);
        frames.run(500);
        watch.disconnect();
        expect(changes).toEqual([]);
        expect(container.querySelector('[data-task-area-layer] path')).toBe(path);
        expect(frames.pending()).toBe(0);
    });

    it('every layer at the z it is handed; the wrapper makes no stacking context', () => {
        const { container, again } = mount(A);
        const wrapper = container.querySelector('[data-task-rings]');
        expect(wrapper.style.zIndex).toBe('');
        const zs = () => [...container.querySelectorAll('[data-task-area-layer]')].map(el => Number(el.style.zIndex));
        // With no z handed (no Token worked), over every Token, under the heroes.
        expect(zs()).toEqual(TASK_AREA_LAYERS.map(() => MAT_Z.STANDING_HERO));
        again(A, 1234);
        expect(zs()).toEqual(TASK_AREA_LAYERS.map(() => 1234));
        expect(wrapper.className).toContain('pointer-events-none');
    });

    it('⭐ while drawing is paused a job starting or ending shows at once and asks for no frames', () => {
        const { container, again } = mount([]);
        setDrawingPaused(true);
        try {
            again(A);
            expect(pxIn(container, 'a')).toBe(48);
            expect(frames.pending()).toBe(0);
            again([]);
            expect(container.querySelector('[data-task-rings]')).toBeNull();
            expect(frames.pending()).toBe(0);
        } finally {
            setDrawingPaused(false);
        }
    });

    it('⭐ jobs arriving with a reset (a load, a catch-up) jump whole; the next job after it still grows', () => {
        const { container, again } = mount([]);
        // The mat hands the reset over in the same render as its jobs.
        again([job('a', 400, 400), job('b', 900, 400)], undefined, 1);
        expect(ringsIn(container).map(r => r.px)).toEqual([48, 48]);
        expect(frames.pending()).toBe(0);
        again([job('a', 400, 400), job('b', 900, 400), job('c', 1400, 400)]);
        frames.frame(16);
        const c = pxIn(container, 'c');
        expect(c).toBeGreaterThan(0);
        expect(c).toBeLessThan(48);
    });

    it('a reset that changes no job leaves nothing behind: the next job still grows', () => {
        const { container, again } = mount(A);
        again(A, undefined, 1);
        again([...A, job('b', 900, 400)]);
        frames.frame(16);
        expect(pxIn(container, 'b')).toBeLessThan(48);
        expect(pxIn(container, 'a')).toBe(48);
    });
});

describe('on the mat: an area for every hero at work, from the game itself', () => {
    const hero = (id) => ({ id, name: id, status: 'idle', level: 50, skills: { forestry: { level: 50, xp: 0 } }, hp: { current: 100, max: 100 } });
    const mountMat = () => render(h(DndContext, null, h(MatBoard)));

    beforeAll(() => Flags.init());
    afterAll(() => Flags.teardown());
    beforeEach(() => {
        GameState.initNew();
        InventoryManager.init();
        SpriteLayer.init();
        BoardCombat.clearAll();
        TileModifiers.clearAll();
        clearMat();
        GameState.state.heroes = [hero('h1'), hero('h2')];
    });

    it('⭐ a job whose Token runs out of an input keeps its area untouched: no amber, no line, the same size', async () => {
        GameState.state.heroes = [{ ...hero('h1'), skills: { alchemy: { level: 50, xp: 0 } } }];
        InventoryManager.addItem('fixture_oak_wood', 10);
        const t = placeAt('fixture_consumer', 600, 400);
        const run = (ms) => { for (let i = 0; i < ms; i += 100) BoardRunner.tick(100); };
        const { container } = mountMat();
        await act(async () => { Orders.orderAt('h1', { x: t.x, y: t.y }); });
        frames.run(RING_GROW_MS + 32);
        await act(async () => { run(1000); });
        expect(t.alert ?? null).toBeNull();
        const full = pxIn(container, t.id);
        expect(full).toBeGreaterThan(20);
        const before = container.querySelector('[data-task-rings]').innerHTML;

        await act(async () => {
            InventoryManager.removeItem('fixture_oak_wood', 10);
            run(3000);
        });
        expect(t.alert).toBe(ALERT.INPUTS);
        expect(Flags.statusOf('h1').state).toBe('working');
        expect(pxIn(container, t.id)).toBe(full);
        expect(container.querySelector('[data-task-rings]').innerHTML).toBe(before);
        expect(container.querySelector('[data-task-ring]')).toBeNull();
        expect(frames.pending()).toBe(0);
    });

    // The owner's eye-check, 22 Nov: a Token at rest half inside an area is toned on that half; the
    // worked Token and the heroes stand over it.
    it('⭐ the tone lies over the Tokens at rest and under the worked one and every hero; a Token half inside is toned on that half only', async () => {
        const worked = placeAt('fixture_producer', 600, 400);
        const near = placeAt('fixture_producer_alt', 600, 530);
        const far = placeAt('fixture_producer_alt', 1400, 400);
        const { container } = mountMat();
        await act(async () => { Orders.orderAt('h1', { x: worked.x, y: worked.y }); });
        frames.run(RING_GROW_MS + 32);
        expect(Flags.statusOf('h1').state).toBe('working');

        const layers = [...container.querySelectorAll('[data-task-area-layer]')];
        const ringZ = Number(layers[0].style.zIndex);
        for (const el of layers) expect(Number(el.style.zIndex)).toBe(ringZ);
        const art = (t) => container.querySelector(`[data-token-art][data-token-id="${t.id}"]`);
        const zOf = (el) => Number(el.style.zIndex);
        const after = (a, b) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
        // The Tokens at rest, their art and what is written on them, under the tone.
        for (const t of [near, far]) expect(zOf(art(t)) + 1).toBeLessThan(ringZ);
        // The worked Token over it: its z is the tone's, and it comes after it, so it wins.
        expect(zOf(art(worked))).toBeGreaterThanOrEqual(ringZ);
        expect(after(layers.at(-1), art(worked))).toBe(true);
        // Every hero over it.
        expect(zOf(container.querySelector('[data-board-hero="h1"]'))).toBeGreaterThan(ringZ);

        // The tone is cut to the area, not to whole Tokens: the near one's top part is in, the rest out.
        const toned = new Set();
        for (const p of layers[0].querySelectorAll('path')) for (const k of pathCells(p.getAttribute('d'))) toned.add(k);
        const footprint = (t) => {
            const half = artRadiusOf(t.typeId) / SCALE;
            const out = [];
            for (let y = Math.round(t.y / SCALE - half); y < Math.round(t.y / SCALE + half); y++) {
                for (let x = Math.round(t.x / SCALE - half); x < Math.round(t.x / SCALE + half); x++) out.push(`${x},${y}`);
            }
            return out;
        };
        const nearIn = footprint(near).filter(k => toned.has(k)).length;
        expect(nearIn).toBeGreaterThan(footprint(near).length * 0.1);
        expect(nearIn).toBeLessThan(footprint(near).length * 0.9);
        expect(footprint(far).filter(k => toned.has(k))).toEqual([]);
    });

    it('the areas\' z: the lowest worked Token\'s, over every Token at rest; with none worked, over every Token', () => {
        const z = new Map([['a', 40], ['b', 60], ['c', 90]]);
        expect(taskRingZ(z, ['c', 'b'])).toBe(60);
        expect(taskRingZ(z, new Map([['c', 'h1']]).keys())).toBe(90);
        expect(taskRingZ(z, [])).toBe(MAT_Z.STANDING_HERO);
        expect(taskRingZ(z, ['gone'])).toBe(MAT_Z.STANDING_HERO);
    });

    it('the "!" said on the bus changes nothing in the area', async () => {
        const t = placeAt('fixture_producer', 600, 400);
        const { container } = mountMat();
        await act(async () => { Orders.orderAt('h1', { x: t.x, y: t.y }); });
        frames.run(RING_GROW_MS + 32);
        const before = container.querySelector('[data-task-rings]').innerHTML;
        await act(async () => {
            t.alert = ALERT.NO_TOOL;
            EventBus.publish(BOARD_EVENTS.ALERT_CHANGED, { instanceId: t.id, alert: t.alert });
        });
        expect(container.querySelector('[data-task-rings]').innerHTML).toBe(before);
        expect(pxIn(container, t.id)).toBeGreaterThan(20);
    });

    it('⭐ a hero ordered to a Token: its area grows; ordered away: it shrinks and goes', async () => {
        const t = placeAt('fixture_producer', 600, 400);
        const { container } = mountMat();
        expect(container.querySelector('[data-task-rings]')).toBeNull();
        await act(async () => { Orders.orderAt('h1', { x: t.x, y: t.y }); });
        frames.frame(16);
        const early = pxIn(container, t.id);
        frames.run(RING_GROW_MS + 32);
        const full = pxIn(container, t.id);
        expect(full).toBeGreaterThan(20);
        expect(early).toBeLessThan(full);
        await act(async () => { Orders.orderAt('h1', { x: 1500, y: 800 }); });
        frames.frame(16);
        expect(pxIn(container, t.id)).toBeLessThan(full);
        frames.run(RING_GROW_MS + 32);
        expect(pxIn(container, t.id)).toBeNull();
    });

    it('⭐ after a catch-up (heard quietly, then a reset) the areas stand whole at once', async () => {
        const a = placeAt('fixture_producer', 500, 400);
        const b = placeAt('fixture_producer', 1100, 400);
        const { container } = mountMat();
        EventBus.setQuiet(true);
        Orders.orderAt('h1', { x: a.x, y: a.y });
        Orders.orderAt('h2', { x: b.x, y: b.y });
        EventBus.setQuiet(false);
        expect(container.querySelector('[data-task-rings]')).toBeNull();
        await act(async () => { EventBus.publish(ENGINE_EVENTS.GAME_RESET, {}); });
        const now = ringsIn(container);
        expect(now.map(r => r.id).sort()).toEqual([a.id, b.id].sort());
        frames.run(RING_GROW_MS + 32);
        expect(ringsIn(container)).toEqual(now);
    });
});
