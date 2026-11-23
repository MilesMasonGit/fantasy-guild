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
    TASK_DIM_LIGHT, TASK_DIM_GREY, TASK_RING_PAD_PX, TASK_RING_COLOUR, TASK_RING_STUCK_COLOUR,
    taskRingOf, taskJobsOf, taskJobsKey, taskRingTarget, createTaskRingSet, diskRows, dimRuns,
    edgeRuns, insideRuns, ringEdgePaths, runsPath
} from '../ui/components/board/taskRing.js';

/**
 * ⭐ The task ring (brief 720 R4, the owner's pick C, dimmer and greyer): a work-green ring round
 * every job in progress, the ground inside dimmed and drained toward grey by one shared layer, so
 * overlapping rings dim the ground once. It grows when a job starts and shrinks when it ends; at
 * rest nothing runs; a pause, a load or a catch-up jumps every ring to its end instead of
 * replaying it. Working has no green outline any more (`SpriteFxLook.test.js`).
 * The owner, 22 Nov: a stuck job (its Token shows its "!") keeps its ring, the edge in the warning
 * amber; where rings cross, only the outer edge of the merged shape is drawn.
 */

const h = React.createElement;
const SCALE = 2;

let frames;
beforeEach(() => { frames = manualFrames(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const job = (id, x, y, r = 96, stuck = false) => ({ id, x, y, r, stuck });
const target = (id, cx, cy, px, stuck = false) => ({ id, cx, cy, px, stuck });
const ringsIn = (container) => [...container.querySelectorAll('[data-task-ring]')]
    .map(el => ({ id: el.getAttribute('data-task-ring'), px: Number(el.getAttribute('data-px')) }));
const pxIn = (container, id) => ringsIn(container).find(r => r.id === id)?.px ?? null;
const fillOf = (container, id) => container.querySelector(`[data-task-ring="${id}"]`)?.getAttribute('fill') ?? null;

/** The art-pixel cells an SVG path of one-cell-tall rectangles covers (`runsPath`'s form). */
function pathCells(d) {
    const out = new Set();
    for (const [, x, y, len] of d.matchAll(/M(-?\d+) (-?\d+)h(\d+)v1h-?\d+z/g)) {
        for (let i = 0; i < Number(len); i++) out.add(`${Number(x) + i},${Number(y)}`);
    }
    return out;
}

/** Every cell inside a ring, from its own cells. */
function cellsInside({ cx, cy, px }) {
    const out = new Set();
    for (const [dy, [x0, x1]] of diskRows(px)) for (let x = x0; x <= x1; x++) out.add(`${cx + x},${cy + dy}`);
    return out;
}

/** The cells of a set with all four sides inside it: no edge of it can be drawn there. */
function interiorOf(cells) {
    const out = new Set();
    for (const k of cells) {
        const [x, y] = k.split(',').map(Number);
        if ([[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => cells.has(`${x + dx},${y + dy}`))) out.add(k);
    }
    return out;
}

/** A ring's own pixel ring, on the mat. */
const ringCellsOf = ({ cx, cy, px }) => new Set(pixelRingCells(px).map(([x, y]) => `${cx + x},${cy + y}`));

describe('a job\'s ring: fitted round the Token and its heroes, centred on them all', () => {
    const token = { id: 't1', typeId: 'fixture_producer', x: 600, y: 400 };
    const body = artRadiusOf('fixture_producer');
    /** A hero's figure as `MatHero` draws it: HERO_HIT_PX wide, HERO_BOX_PX tall, centred on where they stand. */
    const heroBox = (h) => [h.x - HERO_HIT_PX / 2, h.y - HERO_BOX_PX / 2, h.x + HERO_HIT_PX / 2, h.y + HERO_BOX_PX / 2];
    const corners = ([l, t, r, b]) => [[l, t], [r, t], [l, b], [r, b]];

    // The owner's eye-check, 22 Nov: the ring leaned to the Token, the hero's figure poking out.
    it('⭐ one hero beside it: centred between the Token and the hero, both whole inside', () => {
        const hero = { x: 600 + body + 32, y: 400 };
        const ring = taskRingOf(token, [hero], SCALE);
        const tokenBox = [token.x - body, token.y - body, token.x + body, token.y + body];
        // The middle of the pair: halfway between the Token's far side and the hero's.
        expect(ring.x).toBe((tokenBox[0] + heroBox(hero)[2]) / 2);
        expect(ring.y).toBe(token.y);
        expect(ring.x).toBeGreaterThan(token.x);
        expect(ring.x).toBeLessThan(hero.x);
        // Every corner of the Token's body and of the hero's figure is inside, the farthest just
        // the margin from the ring.
        const far = Math.max(...[...corners(tokenBox), ...corners(heroBox(hero))].map(([x, y]) => Math.hypot(x - ring.x, y - ring.y)));
        expect(ring.r).toBeCloseTo(far + TASK_RING_PAD_PX * SCALE);
        // R4's ring, round the hero's point only, left half the figure out.
        const before = Math.hypot(hero.x - (token.x - body), 2 * body) / 2 + TASK_RING_PAD_PX * SCALE;
        const beforeX = (token.x - body + hero.x) / 2;
        expect(Math.hypot(heroBox(hero)[2] - beforeX, heroBox(hero)[1] - token.y)).toBeGreaterThan(before);
    });

    it('a hero standing a little higher or lower: still both whole inside, the ring centred on them both', () => {
        const hero = { x: 600 + body + 32, y: 430 };
        const ring = taskRingOf(token, [hero], SCALE);
        expect(ring.y).toBe((token.y - body + hero.y + HERO_BOX_PX / 2) / 2);
        for (const [x, y] of corners(heroBox(hero))) expect(Math.hypot(x - ring.x, y - ring.y)).toBeLessThan(ring.r);
    });

    it('fitted round the pair: 54 art pixels round a one-cell Token and one hero at a 1920 x 1080 window', () => {
        // That window fits the mat at 0.9: two screen pixels an art pixel, 2.22 mat units an art pixel.
        const artScale = 2 / 0.9;
        const ring = taskRingOf(token, [{ x: 600 + body + 32, y: 400 }], artScale);
        expect(taskRingTarget(ring, artScale).px).toBe(54);
    });

    it('two heroes on either side: centred on the Token, and bigger than for one', () => {
        const one = taskRingOf(token, [{ x: 600 + body + 32, y: 400 }], SCALE);
        const two = taskRingOf(token, [{ x: 600 + body + 32, y: 400 }, { x: 600 - body - 32, y: 400 }], SCALE);
        expect(two.x).toBe(token.x);
        expect(two.r).toBeGreaterThan(one.r);
    });

    it('on the art grid: the centre cell as the reach ring snaps it, the radius in whole art pixels', () => {
        const t = taskRingTarget({ id: 'a', x: 101, y: 51, r: 97 }, SCALE);
        expect(t).toEqual({ id: 'a', cx: 50, cy: 25, px: 49, stuck: false });
        expect(taskRingTarget({ id: 'a', x: 101, y: 51, r: 97, stuck: true }, SCALE).stuck).toBe(true);
    });
});

describe('which jobs have a ring', () => {
    const tokens = [
        { id: 'b', typeId: 'fixture_producer', x: 900, y: 400 },
        { id: 'a', typeId: 'fixture_producer', x: 400, y: 400 },
        { id: 'walker', typeId: 'fixture_producer', x: null, y: 300 },
        { id: 'held', typeId: 'fixture_producer', x: 1200, y: 400 }
    ];
    const hero = (heroId, tokenId, more = {}) => ({ heroId, tokenId, stuck: false, jobStuck: false, x: 500, y: 400, ...more });

    it('one ring per worked Token, every hero working it inside, sorted by Token id', () => {
        const jobs = taskJobsOf([hero('h1', 'b', { x: 1000 }), hero('h2', 'a'), hero('h3', 'b', { x: 800 })], tokens, { artScale: SCALE });
        expect(jobs.map(j => j.id)).toEqual(['a', 'b']);
        expect(jobs[1].x).toBe(900);
        expect(jobs.map(j => j.stuck)).toEqual([false, false]);
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

    // The owner, 22 Nov: a stuck job keeps its ring (R4 dropped it, as the green outline was).
    it('⭐ a stuck job keeps its ring, marked stuck: its Token shows its "!", its hero standing idle beside it', () => {
        const heroes = [hero('h1', 'a'), hero('h2', 'b', { stuck: true, jobStuck: true, x: 1000 })];
        const jobs = taskJobsOf(heroes, tokens, { artScale: SCALE });
        expect(jobs.map(j => [j.id, j.stuck])).toEqual([['a', false], ['b', true]]);
        // Fitted exactly as a working one.
        const working = taskJobsOf([hero('h2', 'b', { x: 1000 })], tokens, { artScale: SCALE })[0];
        expect({ ...jobs[1], stuck: false }).toEqual(working);
    });

    it('stuck is the "!"\'s test, not the hero\'s idling: a hero idle with no "!" on the Token keeps a working ring', () => {
        const jobs = taskJobsOf([hero('h1', 'a', { stuck: true })], tokens, { artScale: SCALE });
        expect(jobs.map(j => [j.id, j.stuck])).toEqual([['a', false]]);
    });

    it('the key changes only when a ring would', () => {
        const a = taskJobsOf([hero('h2', 'a')], tokens, { artScale: SCALE });
        const b = taskJobsOf([hero('h2', 'a'), hero('idle', null, { x: 123 })], tokens, { artScale: SCALE });
        expect(taskJobsKey(a)).toBe(taskJobsKey(b));
        const c = taskJobsOf([hero('h2', 'a', { x: 300 })], tokens, { artScale: SCALE });
        expect(taskJobsKey(c)).not.toBe(taskJobsKey(a));
        const stuck = taskJobsOf([hero('h2', 'a', { jobStuck: true })], tokens, { artScale: SCALE });
        expect(taskJobsKey(stuck)).not.toBe(taskJobsKey(a));
    });
});

describe('the ring set: grow, stay, shrink, never replay', () => {
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

    it('⭐ a settled ring turning stuck, and unstuck again, changes at once: no tween, the same size', () => {
        const set = createTaskRingSet();
        set.aim([target('a', 10, 10, 40)], 0, true);
        const working = set.at(0);
        set.aim([target('a', 10, 10, 40, true)], 100);
        expect(set.moving(100)).toBe(false);
        const stuck = set.at(100);
        expect(stuck).toEqual([target('a', 10, 10, 40, true)]);
        expect(stuck).not.toBe(working);
        expect(set.at(200)).toBe(stuck);
        set.aim([target('a', 10, 10, 40)], 300);
        expect(set.moving(300)).toBe(false);
        expect(set.at(300)).toEqual([target('a', 10, 10, 40)]);
    });

    it('a ring growing when its job turns stuck keeps growing, in its new colour', () => {
        const set = createTaskRingSet();
        set.aim([target('a', 10, 10, 40)], 0);
        set.aim([target('a', 10, 10, 40, true)], RING_GROW_MS / 4);
        expect(set.at(RING_GROW_MS / 2)).toEqual([target('a', 10, 10, 20, true)]);
        expect(set.at(RING_GROW_MS)).toEqual([target('a', 10, 10, 40, true)]);
    });
});

describe('⭐ one dim for every ring: overlapping rings dim the ground once', () => {
    it('the dim ends exactly under the ring: each row runs from its first ring cell to its last', () => {
        const cells = pixelRingCells(30);
        const rows = diskRows(30);
        for (const [x, y] of cells) {
            const [x0, x1] = rows.get(y);
            expect(x).toBeGreaterThanOrEqual(x0);
            expect(x).toBeLessThanOrEqual(x1);
        }
        for (let y = -30; y <= 30; y++) expect(rows.has(y)).toBe(true);
    });

    it('two overlapping rings: every cell of their union is covered once, never twice', () => {
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

describe('⭐ where rings cross, only the outer edge of the merged shape', () => {
    const edgeCells = (rings) => {
        const out = new Set();
        for (const [y, runs] of edgeRuns(dimRuns(rings))) for (const [x0, x1] of runs) for (let x = x0; x <= x1; x++) out.add(`${x},${y}`);
        return out;
    };
    const a = { id: 'a', cx: 100, cy: 100, px: 40 };
    const b = { id: 'b', cx: 150, cy: 110, px: 36 };

    it('a lone ring\'s edge is exactly its own pixel ring, at every size', () => {
        for (const px of [1, 2, 3, 7, 20, 48, 61, 120]) {
            const ring = { cx: 30, cy: -12, px };
            expect(edgeCells([ring])).toEqual(ringCellsOf(ring));
        }
    });

    it('rings apart: each keeps its whole pixel ring', () => {
        const far = { id: 'f', cx: 400, cy: 100, px: 36 };
        const paths = ringEdgePaths([a, far], edgeRuns(dimRuns([a, far])));
        expect(pathCells(paths.get('a'))).toEqual(ringCellsOf(a));
        expect(pathCells(paths.get('f'))).toEqual(ringCellsOf(far));
    });

    it('⭐ two crossing rings draw no arc inside the shared dim: only the union\'s outer edge', () => {
        const union = new Set([...cellsInside(a), ...cellsInside(b)]);
        const ringA = ringCellsOf(a);
        const ringB = ringCellsOf(b);
        // Each ring's arc that runs inside the other's dim: what R4 drew and the owner ruled out.
        const insideA = interiorOf(cellsInside(a));
        const insideB = interiorOf(cellsInside(b));
        const innerA = [...ringA].filter(k => insideB.has(k));
        const innerB = [...ringB].filter(k => insideA.has(k));
        expect(innerA.length).toBeGreaterThan(20);
        expect(innerB.length).toBeGreaterThan(20);

        const paths = ringEdgePaths([a, b], edgeRuns(dimRuns([a, b])));
        const drawnA = pathCells(paths.get('a'));
        const drawnB = pathCells(paths.get('b'));
        const drawn = new Set([...drawnA, ...drawnB]);
        // Nothing drawn where the merged dim lies on all four sides.
        const inside = interiorOf(union);
        expect([...drawn].filter(k => inside.has(k))).toEqual([]);
        expect([...innerA, ...innerB].filter(k => drawn.has(k))).toEqual([]);
        // And the whole outer edge drawn, each ring drawing its own part of it.
        expect(drawn).toEqual(new Set([...union].filter(k => !inside.has(k))));
        expect([...drawnA].filter(k => !ringA.has(k))).toEqual([]);
        expect([...drawnB].filter(k => !ringB.has(k))).toEqual([]);
    });

    it('a ring wholly inside a bigger one draws nothing', () => {
        const big = { id: 'big', cx: 100, cy: 100, px: 40 };
        const small = { id: 'small', cx: 104, cy: 100, px: 10 };
        const paths = ringEdgePaths([big, small], edgeRuns(dimRuns([big, small])));
        expect(paths.get('small')).toBe('');
        expect(pathCells(paths.get('big'))).toEqual(ringCellsOf(big));
    });

    it('the edge as one path, in the dim\'s own form: the middle cell of a one-pixel ring is inside', () => {
        expect(runsPath(edgeRuns(dimRuns([{ cx: 0, cy: 0, px: 1 }])))).toBe('M-1 0h1v1h-1zM1 0h1v1h-1zM0 1h1v1h-1zM0 -1h1v1h-1z');
    });
});

describe('TaskRings: drawn on the ground, grown and shrunk per job, still at rest', () => {
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

    it('⭐ a job starting grows its ring from nothing, stepping, then it stands still asking for no frames', () => {
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

    it('⭐ the job ending shrinks the ring away, then nothing is drawn and no frame asked', () => {
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

    it('rings standing when the mat appears are drawn whole at once', () => {
        const { container } = mount(A);
        expect(pxIn(container, 'a')).toBe(48);
        expect(frames.pending()).toBe(0);
    });

    it('⭐ one dim layer for every ring: a saturation-blended grey and a black, each one path of the inside of the union', () => {
        const jobs = [job('a', 400, 400), job('b', 520, 410)];
        const { container } = mount(jobs);
        const grey = container.querySelectorAll('[data-task-dim="grey"] path');
        const dark = container.querySelectorAll('[data-task-dim="dark"] path');
        expect(grey).toHaveLength(1);
        expect(dark).toHaveLength(1);
        expect(container.querySelector('[data-task-dim="grey"]').style.mixBlendMode).toBe('saturation');
        expect(Number(grey[0].getAttribute('fill-opacity'))).toBe(TASK_DIM_GREY);
        expect(Number(dark[0].getAttribute('fill-opacity'))).toBeCloseTo(1 - TASK_DIM_LIGHT);
        const rows = dimRuns(jobs.map(j => taskRingTarget(j, SCALE)));
        const want = runsPath(insideRuns(rows, edgeRuns(rows)));
        expect(grey[0].getAttribute('d')).toBe(want);
        expect(dark[0].getAttribute('d')).toBe(want);
        expect(ringsIn(container).map(r => r.id)).toEqual(['a', 'b']);
    });

    it('⭐ the dim is everything inside the rings but their edge: the line keeps its colour over the Tokens it crosses', () => {
        const jobs = [job('a', 400, 400), job('b', 520, 410)];
        const targets = jobs.map(j => taskRingTarget(j, SCALE));
        const { container } = mount(jobs);
        const dim = pathCells(container.querySelector('[data-task-dim="grey"] path').getAttribute('d'));
        const edge = new Set();
        for (const el of container.querySelectorAll('[data-task-ring]')) for (const k of pathCells(el.getAttribute('d'))) edge.add(k);
        const union = new Set(targets.flatMap(t => [...cellsInside(t)]));
        expect([...edge].filter(k => dim.has(k))).toEqual([]);
        expect(new Set([...dim, ...edge])).toEqual(union);
    });

    it('⭐ a stuck job\'s ring is the warning amber, a working one the work green; unstuck, it is green again at once', () => {
        const { container, again } = mount([job('a', 400, 400), job('b', 1400, 400, 96, true)]);
        expect(TASK_RING_STUCK_COLOUR).toBe('var(--color-gi-warning)');
        expect(fillOf(container, 'a')).toBe(TASK_RING_COLOUR);
        expect(fillOf(container, 'b')).toBe(TASK_RING_STUCK_COLOUR);
        // The same ground under both: one dim, the same strength.
        expect(container.querySelectorAll('[data-task-dim="grey"] path')).toHaveLength(1);
        again([job('a', 400, 400), job('b', 1400, 400)]);
        expect(fillOf(container, 'b')).toBe(TASK_RING_COLOUR);
        expect(pxIn(container, 'b')).toBe(48);
        expect(frames.pending()).toBe(0);
        again([job('a', 400, 400, 96, true), job('b', 1400, 400)]);
        expect(fillOf(container, 'a')).toBe(TASK_RING_STUCK_COLOUR);
        expect(pxIn(container, 'a')).toBe(48);
        expect(frames.pending()).toBe(0);
    });

    it('⭐ two crossing rings draw only the outer edge: nothing inside the shared dim; the shadow is that edge one art pixel down and right', () => {
        const jobs = [job('a', 400, 400), job('b', 520, 410)];
        const targets = jobs.map(j => taskRingTarget(j, SCALE));
        const { container } = mount(jobs);
        const drawn = new Set();
        for (const el of container.querySelectorAll('[data-task-ring]')) for (const k of pathCells(el.getAttribute('d'))) drawn.add(k);
        const union = new Set(targets.flatMap(t => [...cellsInside(t)]));
        const inside = interiorOf(union);
        expect(inside.size).toBeGreaterThan(1000);
        expect([...drawn].filter(k => inside.has(k))).toEqual([]);
        expect(drawn).toEqual(new Set([...union].filter(k => !inside.has(k))));
        // R4 drew both whole rings: arcs ran through the shared dim.
        const both = targets.flatMap(t => [...ringCellsOf(t)]);
        expect(both.filter(k => inside.has(k)).length).toBeGreaterThan(20);

        const shadows = container.querySelectorAll('[data-task-ring-shadow]');
        expect(shadows).toHaveLength(1);
        expect(shadows[0].getAttribute('d')).toBe(runsPath(edgeRuns(dimRuns(targets))));
        expect(shadows[0].getAttribute('transform')).toBe(`translate(${SCALE} ${SCALE}) scale(${SCALE})`);
    });

    it('where a stuck ring crosses a working one it is drawn last, so the cells they share are amber', () => {
        const { container } = mount([job('a', 400, 400, 96, true), job('b', 520, 410)]);
        expect(ringsIn(container).map(r => r.id)).toEqual(['b', 'a']);
    });

    it('⭐ at rest the dim is never drawn again: a render with the same jobs touches nothing', () => {
        const { container, again } = mount(A);
        const path = container.querySelector('[data-task-dim="grey"] path');
        const changes = [];
        const watch = new MutationObserver(list => changes.push(...list));
        watch.observe(container, { subtree: true, attributes: true, childList: true });
        again(A);
        again([job('a', 400, 400)]);
        frames.run(500);
        watch.disconnect();
        expect(changes).toEqual([]);
        expect(container.querySelector('[data-task-dim="grey"] path')).toBe(path);
        expect(frames.pending()).toBe(0);
    });

    it('the dim and the line at the z they are handed, the line drawn last; the wrapper makes no stacking context', () => {
        const { container, again } = mount(A);
        const wrapper = container.querySelector('[data-task-rings]');
        expect(wrapper.style.zIndex).toBe('');
        const layers = ['[data-task-dim="grey"]', '[data-task-dim="dark"]', '[data-task-ring-layer]'];
        const z = (sel) => Number(container.querySelector(sel).style.zIndex);
        // With no z handed (no Token worked), over every Token, under the heroes.
        for (const sel of layers) expect(z(sel)).toBe(MAT_Z.STANDING_HERO);
        again(A, 1234);
        for (const sel of layers) expect(z(sel)).toBe(1234);
        // One z: the grey drains, the black darkens, then the line goes over both, keeping its colour.
        const svgs = [...wrapper.querySelectorAll('svg')];
        expect(layers.map(sel => svgs.indexOf(container.querySelector(sel)))).toEqual([0, 1, 2]);
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

describe('on the mat: a ring for every hero at work, from the game itself', () => {
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

    it('⭐ a job whose Token runs out of an input keeps its ring, turned amber at once; the input back, green again', async () => {
        GameState.state.heroes = [{ ...hero('h1'), skills: { alchemy: { level: 50, xp: 0 } } }];
        InventoryManager.addItem('fixture_oak_wood', 10);
        const t = placeAt('fixture_consumer', 600, 400);
        const run = (ms) => { for (let i = 0; i < ms; i += 100) BoardRunner.tick(100); };
        const { container } = mountMat();
        await act(async () => { Orders.orderAt('h1', { x: t.x, y: t.y }); });
        frames.run(RING_GROW_MS + 32);
        await act(async () => { run(1000); });
        expect(t.alert ?? null).toBeNull();
        expect(fillOf(container, t.id)).toBe(TASK_RING_COLOUR);
        const full = pxIn(container, t.id);
        expect(full).toBeGreaterThan(20);

        await act(async () => {
            InventoryManager.removeItem('fixture_oak_wood', 10);
            run(3000);
        });
        expect(t.alert).toBe(ALERT.INPUTS);
        expect(Flags.statusOf('h1').state).toBe('working');
        expect(fillOf(container, t.id)).toBe(TASK_RING_STUCK_COLOUR);
        expect(pxIn(container, t.id)).toBe(full);
        expect(frames.pending()).toBe(0);

        await act(async () => {
            InventoryManager.addItem('fixture_oak_wood', 10);
            run(1500);
        });
        expect(t.alert ?? null).toBeNull();
        expect(fillOf(container, t.id)).toBe(TASK_RING_COLOUR);
        expect(pxIn(container, t.id)).toBe(full);
    });

    // The owner's eye-check, 22 Nov: a Token at rest half inside a ring is dimmed on that half, and
    // the ring's line crosses its art; the worked Token and the heroes stand on the line.
    it('⭐ the dim and the line lie over the Tokens at rest and under the worked one and every hero; a Token half inside is dimmed on that half only', async () => {
        const worked = placeAt('fixture_producer', 600, 400);
        const near = placeAt('fixture_producer_alt', 600, 530);
        const far = placeAt('fixture_producer_alt', 1400, 400);
        const { container } = mountMat();
        await act(async () => { Orders.orderAt('h1', { x: worked.x, y: worked.y }); });
        frames.run(RING_GROW_MS + 32);
        expect(Flags.statusOf('h1').state).toBe('working');

        const dimEl = container.querySelector('[data-task-dim="grey"]');
        const lineEl = container.querySelector('[data-task-ring-layer]');
        const ringZ = Number(dimEl.style.zIndex);
        expect(Number(container.querySelector('[data-task-dim="dark"]').style.zIndex)).toBe(ringZ);
        expect(Number(lineEl.style.zIndex)).toBe(ringZ);
        const art = (t) => container.querySelector(`[data-token-art][data-token-id="${t.id}"]`);
        const zOf = (el) => Number(el.style.zIndex);
        const after = (a, b) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
        // The Tokens at rest, their art and what is written on them, under the dim and the line.
        for (const t of [near, far]) expect(zOf(art(t)) + 1).toBeLessThan(ringZ);
        // The worked Token over both: its z is theirs, and it comes after them, so it wins.
        expect(zOf(art(worked))).toBeGreaterThanOrEqual(ringZ);
        expect(after(dimEl, lineEl)).toBe(true);
        expect(after(lineEl, art(worked))).toBe(true);
        // Every hero over them.
        expect(zOf(container.querySelector('[data-board-hero="h1"]'))).toBeGreaterThan(ringZ);

        // The dim is cut to the ring, not to whole Tokens: the near one's top part is in, the rest out.
        const dim = pathCells(dimEl.querySelector('path').getAttribute('d'));
        const footprint = (t) => {
            const half = artRadiusOf(t.typeId) / SCALE;
            const out = [];
            for (let y = Math.round(t.y / SCALE - half); y < Math.round(t.y / SCALE + half); y++) {
                for (let x = Math.round(t.x / SCALE - half); x < Math.round(t.x / SCALE + half); x++) out.push(`${x},${y}`);
            }
            return out;
        };
        const nearIn = footprint(near).filter(k => dim.has(k)).length;
        expect(nearIn).toBeGreaterThan(footprint(near).length * 0.1);
        expect(nearIn).toBeLessThan(footprint(near).length * 0.9);
        expect(footprint(far).filter(k => dim.has(k))).toEqual([]);
    });

    it('the rings\' z: the lowest worked Token\'s, over every Token at rest; with none worked, over every Token', () => {
        const z = new Map([['a', 40], ['b', 60], ['c', 90]]);
        expect(taskRingZ(z, ['c', 'b'])).toBe(60);
        expect(taskRingZ(z, new Map([['c', 'h1']]).keys())).toBe(90);
        expect(taskRingZ(z, [])).toBe(MAT_Z.STANDING_HERO);
        expect(taskRingZ(z, ['gone'])).toBe(MAT_Z.STANDING_HERO);
    });

    it('the ring turns with the engine\'s own word for the "!": an alert said on the bus', async () => {
        const t = placeAt('fixture_producer', 600, 400);
        const { container } = mountMat();
        await act(async () => { Orders.orderAt('h1', { x: t.x, y: t.y }); });
        frames.run(RING_GROW_MS + 32);
        expect(fillOf(container, t.id)).toBe(TASK_RING_COLOUR);
        await act(async () => {
            t.alert = ALERT.NO_TOOL;
            EventBus.publish(BOARD_EVENTS.ALERT_CHANGED, { instanceId: t.id, alert: t.alert });
        });
        expect(fillOf(container, t.id)).toBe(TASK_RING_STUCK_COLOUR);
        await act(async () => {
            t.alert = null;
            EventBus.publish(BOARD_EVENTS.ALERT_CHANGED, { instanceId: t.id, alert: null });
        });
        expect(fillOf(container, t.id)).toBe(TASK_RING_COLOUR);
    });

    it('⭐ a hero ordered to a Token: its ring grows; ordered away: it shrinks and goes', async () => {
        const t = placeAt('fixture_producer', 600, 400);
        const { container } = mountMat();
        expect(container.querySelector('[data-task-ring]')).toBeNull();
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
        expect(container.querySelector(`[data-task-ring="${t.id}"]`)).toBeNull();
    });

    it('⭐ after a catch-up (heard quietly, then a reset) the rings stand whole at once', async () => {
        const a = placeAt('fixture_producer', 500, 400);
        const b = placeAt('fixture_producer', 1100, 400);
        const { container } = mountMat();
        EventBus.setQuiet(true);
        Orders.orderAt('h1', { x: a.x, y: a.y });
        Orders.orderAt('h2', { x: b.x, y: b.y });
        EventBus.setQuiet(false);
        expect(container.querySelector('[data-task-ring]')).toBeNull();
        await act(async () => { EventBus.publish(ENGINE_EVENTS.GAME_RESET, {}); });
        const now = ringsIn(container);
        expect(now.map(r => r.id).sort()).toEqual([a.id, b.id].sort());
        frames.run(RING_GROW_MS + 32);
        expect(ringsIn(container)).toEqual(now);
    });
});
