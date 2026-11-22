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
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { artRadiusOf } from '../config/matGeometry.js';
import { placeAt, clearMat } from './fixtures/mat.js';
import { manualFrames } from './fixtures/manualFrames.js';
import { RING_GROW_MS } from '../ui/components/board/growRing.js';
import { setDrawingPaused } from '../ui/components/board/frameClock.js';
import { pixelRingCells } from '../ui/components/board/pixelRing.js';
import { MAT_Z } from '../ui/components/board/matLayers.js';
import { TaskRings } from '../ui/components/board/TaskRings.jsx';
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import {
    TASK_DIM_LIGHT, TASK_DIM_GREY, TASK_RING_PAD_PX,
    taskRingOf, taskJobsOf, taskJobsKey, taskRingTarget, createTaskRingSet, diskRows, dimRuns, dimPath
} from '../ui/components/board/taskRing.js';

/**
 * ⭐ The task ring (brief 720 R4, the owner's pick C, dimmer and greyer): a work-green ring round
 * every job in progress, the ground inside dimmed and drained toward grey by one shared layer, so
 * overlapping rings dim the ground once. It grows when a job starts and shrinks when it ends; at
 * rest nothing runs; a pause, a load or a catch-up jumps every ring to its end instead of
 * replaying it. Working has no green outline any more (`SpriteFxLook.test.js`).
 */

const h = React.createElement;
const SCALE = 2;

let frames;
beforeEach(() => { frames = manualFrames(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const job = (id, x, y, r = 96) => ({ id, x, y, r });
const target = (id, cx, cy, px) => ({ id, cx, cy, px });
const ringsIn = (container) => [...container.querySelectorAll('[data-task-ring]')]
    .map(el => ({ id: el.getAttribute('data-task-ring'), px: Number(el.getAttribute('data-px')) }));
const pxIn = (container, id) => ringsIn(container).find(r => r.id === id)?.px ?? null;

describe('a job\'s ring: fitted round the Token and its heroes', () => {
    const token = { id: 't1', typeId: 'fixture_producer', x: 600, y: 400 };
    const body = artRadiusOf('fixture_producer');

    it('one hero beside it: the circle round the box of the Token body and where the hero stands, centred between them', () => {
        const hero = { x: 600 + body + 32, y: 400 };
        const ring = taskRingOf(token, [hero], SCALE);
        const left = token.x - body;
        const right = hero.x;
        const top = token.y - body;
        const bottom = token.y + body;
        expect(ring.x).toBe((left + right) / 2);
        expect(ring.y).toBe(token.y);
        expect(ring.r).toBeCloseTo(Math.hypot(right - left, bottom - top) / 2 + TASK_RING_PAD_PX * SCALE);
        // Every corner of the box is inside, and so is the hero's point.
        for (const [x, y] of [[left, top], [right, top], [left, bottom], [right, bottom]]) {
            expect(Math.hypot(x - ring.x, y - ring.y)).toBeLessThan(ring.r);
        }
        expect(ring.x).toBeGreaterThan(token.x);
    });

    it('the pick C: 48 art pixels round a one-cell Token and one hero at a 1920 x 1080 window', () => {
        // That window fits the mat at 0.9: two screen pixels an art pixel, 2.22 mat units an art pixel.
        const artScale = 2 / 0.9;
        const ring = taskRingOf(token, [{ x: 600 + body + 32, y: 400 }], artScale);
        expect(taskRingTarget(ring, artScale).px).toBe(48);
    });

    it('two heroes on either side: centred on the Token, and bigger than for one', () => {
        const one = taskRingOf(token, [{ x: 600 + body + 32, y: 400 }], SCALE);
        const two = taskRingOf(token, [{ x: 600 + body + 32, y: 400 }, { x: 600 - body - 32, y: 400 }], SCALE);
        expect(two.x).toBe(token.x);
        expect(two.r).toBeGreaterThan(one.r);
    });

    it('on the art grid: the centre cell as the reach ring snaps it, the radius in whole art pixels', () => {
        const t = taskRingTarget({ id: 'a', x: 101, y: 51, r: 97 }, SCALE);
        expect(t).toEqual({ id: 'a', cx: 50, cy: 25, px: 49 });
    });
});

describe('which jobs have a ring', () => {
    const tokens = [
        { id: 'b', typeId: 'fixture_producer', x: 900, y: 400 },
        { id: 'a', typeId: 'fixture_producer', x: 400, y: 400 },
        { id: 'walker', typeId: 'fixture_producer', x: null, y: 300 },
        { id: 'held', typeId: 'fixture_producer', x: 1200, y: 400 }
    ];
    const hero = (heroId, tokenId, more = {}) => ({ heroId, tokenId, stuck: false, x: 500, y: 400, ...more });

    it('one ring per worked Token, every hero working it inside, sorted by Token id', () => {
        const jobs = taskJobsOf([hero('h1', 'b', { x: 1000 }), hero('h2', 'a'), hero('h3', 'b', { x: 800 })], tokens, { artScale: SCALE });
        expect(jobs.map(j => j.id)).toEqual(['a', 'b']);
        expect(jobs[1].x).toBe(900);
    });

    it('not for a hero who is not working, still walking up, or stuck; not for a walking or carried Token', () => {
        const heroes = [
            hero('idle', null),
            hero('walking', 'a', { x: null, y: null }),
            hero('stuck', 'b', { stuck: true }),
            hero('w', 'walker'),
            hero('c', 'held')
        ];
        expect(taskJobsOf(heroes, tokens, { carriedId: 'held', artScale: SCALE })).toEqual([]);
    });

    it('the key changes only when a ring would', () => {
        const a = taskJobsOf([hero('h2', 'a')], tokens, { artScale: SCALE });
        const b = taskJobsOf([hero('h2', 'a'), hero('idle', null, { x: 123 })], tokens, { artScale: SCALE });
        expect(taskJobsKey(a)).toBe(taskJobsKey(b));
        const c = taskJobsOf([hero('h2', 'a', { x: 300 })], tokens, { artScale: SCALE });
        expect(taskJobsKey(c)).not.toBe(taskJobsKey(a));
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
});

describe('⭐ one dim for every ring: overlapping rings dim the ground once', () => {
    /** Every cell inside a ring, from its own cells. */
    function cellsInside({ cx, cy, px }) {
        const out = new Set();
        for (const [dy, [x0, x1]] of diskRows(px)) for (let x = x0; x <= x1; x++) out.add(`${cx + x},${cy + dy}`);
        return out;
    }

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
        expect(dimPath([{ cx: 0, cy: 0, px: 1 }])).toBe('M-1 0h3v1h-3zM0 1h1v1h-1zM0 -1h1v1h-1z');
    });
});

describe('TaskRings: drawn on the ground, grown and shrunk per job, still at rest', () => {
    const mount = (jobs) => {
        const out = render(h(TaskRings, { jobs }));
        return { ...out, again: (next) => out.rerender(h(TaskRings, { jobs: next })) };
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

    it('⭐ one dim layer for every ring: a saturation-blended grey and a black, each one path of the union', () => {
        const jobs = [job('a', 400, 400), job('b', 520, 410)];
        const { container } = mount(jobs);
        const grey = container.querySelectorAll('[data-task-dim="grey"] path');
        const dark = container.querySelectorAll('[data-task-dim="dark"] path');
        expect(grey).toHaveLength(1);
        expect(dark).toHaveLength(1);
        expect(container.querySelector('[data-task-dim="grey"]').style.mixBlendMode).toBe('saturation');
        expect(Number(grey[0].getAttribute('fill-opacity'))).toBe(TASK_DIM_GREY);
        expect(Number(dark[0].getAttribute('fill-opacity'))).toBeCloseTo(1 - TASK_DIM_LIGHT);
        const want = dimPath(jobs.map(j => taskRingTarget(j, SCALE)));
        expect(grey[0].getAttribute('d')).toBe(want);
        expect(dark[0].getAttribute('d')).toBe(want);
        expect(ringsIn(container).map(r => r.id)).toEqual(['a', 'b']);
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

    it('on the ground: the dim and the rings under every Token, over the ground and its life; the wrapper makes no stacking context', () => {
        const { container } = mount(A);
        const wrapper = container.querySelector('[data-task-rings]');
        expect(wrapper.style.zIndex).toBe('');
        const z = (sel) => Number(container.querySelector(sel).style.zIndex);
        for (const sel of ['[data-task-dim="grey"]', '[data-task-dim="dark"]', '[data-task-ring-layer]']) {
            expect(z(sel)).toBeGreaterThan(MAT_Z.GROUND_FX);
            expect(z(sel)).toBeLessThan(MAT_Z.TOKEN_BASE);
        }
        expect(z('[data-task-ring-layer]')).toBeGreaterThan(z('[data-task-dim="dark"]'));
        expect(MAT_Z.GROUND_GRID).toBeGreaterThan(z('[data-task-ring-layer]'));
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
        act(() => {
            EventBus.publish(ENGINE_EVENTS.GAME_RESET, {});
            again([job('a', 400, 400), job('b', 900, 400)]);
        });
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
        act(() => { EventBus.publish(ENGINE_EVENTS.GAME_RESET, {}); });
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
