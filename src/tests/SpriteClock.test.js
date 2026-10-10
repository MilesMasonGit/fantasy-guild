// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { Profiler } from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { EngineContext } from '../ui/context/EngineContext';
import { DeckDndProvider } from '../ui/dnd/DndKit.jsx';
import { AnimatedHeroSprite } from '../ui/components/board/AnimatedHeroSprite.jsx';
import { AnimatedEnemySprite } from '../ui/components/board/AnimatedEnemySprite.jsx';
import { MatHero } from '../ui/components/board/MatHero.jsx';
import { TokenHitArt, COMBAT_ATTACK_EVENT } from '../ui/components/board/TokenHitArt.jsx';
import { BottomHeroDock } from '../ui/components/dock/BottomHeroDock.jsx';
import { setLiveMatFit } from '../ui/components/board/MatFitContext.jsx';
import { setSpriteFxManifest } from '../ui/utils/spriteFx.js';
import {
    heroSpriteFrame, heroPhaseMs, HERO_FRAME_MS, HIT_PERIOD_MS, STRIKE_FRAME, STRIKE_DELAY_MS
} from '../ui/components/board/hitAnimations.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ **The sprites step on one clock** (brief 60, cause #4). The 16 sprites of a working board
 * (8 heroes on the mat, the same 8 in the hero bar) used to keep 16 timers, each waking on its
 * own, so most frames carried one sprite's step. Now they share one: a timer for the soonest step
 * due, then one animation frame that steps every sprite due by then. Each sprite still shows,
 * in every frame, exactly the frame its own clock says, so the Token's hit still meets the strike.
 */

const h = React.createElement;

// A page clock: `performance.now()`, timers and animation frames move together, a frame every
// 6 ms (the owner's 165 Hz screen).
let queue;      // [{ id, cb }]: requested animation frames
let nextId;
let clock;
let framesAsked;
let watcher = null;

/** One frame: the time passes, due timers fire, then the frame's callbacks. Returns the sprites it wrote. */
function frame(ms = 6) {
    act(() => {
        clock += ms;
        vi.advanceTimersByTime(ms);
        const due = queue;
        queue = [];
        for (const { cb } of due) cb(clock);
    });
    return written();
}
/** Time passes and no frame is drawn: a hidden tab, or a stopped frame loop. */
function dark(ms) {
    act(() => {
        clock += ms;
        vi.advanceTimersByTime(ms);
    });
}
const pending = () => vi.getTimerCount() + queue.length;

function watch(container) {
    watcher?.disconnect();
    watcher = new MutationObserver(() => {});
    watcher.observe(container, { attributes: true, subtree: true });
}
/** The sprites written to since the last call. */
function written() {
    const out = new Set();
    for (const r of watcher?.takeRecords() ?? []) {
        const el = r.target.closest?.('[data-sprite]');
        if (el) out.add(el.getAttribute('data-sprite'));
    }
    return out;
}

const shown = (el) => {
    const root = el.querySelector('[data-hero-row]');
    return { row: root.getAttribute('data-hero-row'), frame: Number(root.getAttribute('data-hero-frame')) };
};

const IDS = ['hero_1', 'hero_2', 'hero_3', 'hero_4', 'hero_5', 'hero_6', 'hero_7', 'hero_8'];
/** A working board: 8 heroes on the mat (working, walking, one limping, idle) and the same 8 in the bar. */
const BOARD = [
    ...IDS.map((heroId, i) => ({
        key: `mat-${heroId}`, heroId, size: 128,
        animationState: ['attack', 'attack', 'walk', 'idle', 'attack', 'walk', 'attack', 'idle'][i],
        frameMs: i === 5 ? 250 : undefined
    })),
    ...IDS.map(heroId => ({ key: `bar-${heroId}`, heroId, size: 96, animationState: 'idle' }))
];
const sprites = (list) => h('div', null, ...list.map(s => h('div', { key: s.key, 'data-sprite': s.key },
    h(AnimatedHeroSprite, { src: 'h.png', heroId: s.heroId, size: s.size, animationState: s.animationState, frameMs: s.frameMs }))));
const want = (s, now) => {
    const f = heroSpriteFrame(s.animationState, now, { heroId: s.heroId, frameMs: s.frameMs ?? HERO_FRAME_MS });
    return { row: f.row, frame: f.frame };
};
const spriteEl = (container, key) => container.querySelector(`[data-sprite="${key}"]`);

beforeEach(() => {
    queue = [];
    nextId = 1;
    clock = 1003;   // off any frame boundary
    framesAsked = 0;
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    vi.stubGlobal('requestAnimationFrame', (cb) => { framesAsked += 1; const id = nextId++; queue.push({ id, cb }); return id; });
    vi.stubGlobal('cancelAnimationFrame', (id) => { queue = queue.filter(q => q.id !== id); });
    GameState.initNew();
});

afterEach(() => {
    watcher?.disconnect();
    watcher = null;
    cleanup();
    setSpriteFxManifest(null);
    // Spies off the fake timers first, so restoring them cannot put a fake back.
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

describe('⭐ the sprites share one clock', () => {
    it('⭐ sixteen sprites due together: one timer and one frame callback per step, not sixteen', () => {
        // The bar and the mat draw the same hero on the same clock, so their steps fall due together.
        const same = [
            ...Array.from({ length: 8 }, (_, i) => ({ key: `mat-${i}`, heroId: 'hero_1', size: 128, animationState: 'walk' })),
            ...Array.from({ length: 8 }, (_, i) => ({ key: `bar-${i}`, heroId: 'hero_1', size: 96, animationState: 'idle' }))
        ];
        const { container } = render(sprites(same));
        expect(container.querySelectorAll('[data-hero-row]')).toHaveLength(16);
        expect(pending()).toBe(1);
        watch(container);
        const timers = vi.spyOn(globalThis, 'setTimeout');
        framesAsked = 0;

        const start = clock;
        const log = [];
        for (let i = 0; i < 167; i++) {
            log.push(frame());
            expect(pending()).toBeLessThanOrEqual(1);
        }
        // Every 125 ms boundary of hero_1's clock in the window.
        const p = heroPhaseMs('hero_1');
        const steps = Math.floor((clock + p) / HERO_FRAME_MS) - Math.floor((start + p) / HERO_FRAME_MS);
        expect(steps).toBeGreaterThanOrEqual(8);
        const stepping = log.filter(s => s.size > 0);
        expect(stepping).toHaveLength(steps);
        for (const s of stepping) expect(s.size).toBe(16);
        expect(framesAsked).toBe(steps);
        expect(timers).toHaveBeenCalledTimes(steps);
    });

    it('⭐ a working board: every sprite shows its own clock’s frame in every frame; one callback a frame at most, none wasted', () => {
        const { container } = render(sprites(BOARD));
        watch(container);
        framesAsked = 0;
        let stepFrames = 0;
        let spriteSteps = 0;
        for (let i = 0; i < 500; i++) {          // 3 s
            const asked = framesAsked;
            const wrote = frame();
            if (wrote.size) {
                stepFrames += 1;
                spriteSteps += wrote.size;
            }
            for (const s of BOARD) expect(shown(spriteEl(container, s.key))).toEqual(want(s, clock));
            expect(pending()).toBeLessThanOrEqual(1);
            expect(framesAsked - asked).toBeLessThanOrEqual(1);
        }
        // Every frame callback stepped something; the 16 sprites took ~370 steps in far fewer.
        expect(framesAsked).toBe(stepFrames);
        expect(spriteSteps).toBeGreaterThan(350);
        expect(stepFrames).toBeLessThanOrEqual(8 * 25);    // at most one per hero's step
    });

    it('⭐ a hidden tab (no frames drawn) holds one callback, not a pile; back on screen one frame steps every sprite to its clock', () => {
        const { container } = render(sprites(BOARD));
        for (let i = 0; i < 50; i++) frame();
        watch(container);
        const timers = vi.spyOn(globalThis, 'setTimeout');
        framesAsked = 0;

        for (let i = 0; i < 105; i++) {           // 10.5 s without a frame
            dark(100);
            expect(pending()).toBeLessThanOrEqual(1);
        }
        expect(written().size).toBe(0);
        expect(framesAsked).toBe(1);
        expect(queue).toHaveLength(1);
        expect(vi.getTimerCount()).toBe(0);
        expect(timers.mock.calls.length).toBeLessThanOrEqual(1);

        const back = frame();
        expect(back.size).toBe(16);
        for (const s of BOARD) expect(shown(spriteEl(container, s.key))).toEqual(want(s, clock));
        expect(pending()).toBe(1);
        expect(framesAsked).toBe(1);
    });

    it('⭐ heroes and an enemy step on the same clock: one timer between them', () => {
        const { container } = render(h('div', null,
            sprites(BOARD.slice(0, 4)),
            h('div', { 'data-sprite': 'enemy' }, h(AnimatedEnemySprite, { src: 'e.png', size: 64, frameMs: 125 }))));
        watch(container);
        const cells = new Set();
        for (let i = 0; i < 200; i++) {
            frame();
            expect(pending()).toBeLessThanOrEqual(1);
            cells.add(container.querySelector('[role="img"]').style.backgroundPosition);
        }
        expect(cells.size).toBe(8);
    });

    it('an outline that is off is not written each step; turned on, it takes the frame showing', () => {
        const src = 'assets/heroes/animations/ani_look_0.png';
        setSpriteFxManifest({ sprites: { [src]: { w: 512, h: 192, cols: 8, rows: 3, outlined: true } } });
        const props = { src, heroId: 'hero_2', size: 128, animationState: 'walk' };
        const { container, rerender } = render(h(AnimatedHeroSprite, { ...props, outline: null }));
        const ring = container.querySelector('span[aria-hidden]');
        const img = container.querySelector('img');
        const ringWrites = new MutationObserver(() => {});
        ringWrites.observe(ring, { attributes: true });
        const art = new Set();
        for (let i = 0; i < 100; i++) {
            frame();
            art.add(img.style.transform);
        }
        expect(art.size).toBeGreaterThan(3);
        expect(ringWrites.takeRecords()).toHaveLength(0);
        rerender(h(AnimatedHeroSprite, { ...props, outline: 'work' }));
        expect(ring.getAttribute('data-sprite-ring')).toBe('work');
        expect(ring.style.transform).toBe(img.style.transform);
        for (let i = 0; i < 100; i++) {
            frame();
            expect(ring.style.transform).toBe(img.style.transform);
        }
        ringWrites.disconnect();
    });

    it('nothing is scheduled once the last sprite goes', () => {
        const { unmount } = render(sprites(BOARD));
        for (let i = 0; i < 20; i++) frame();
        unmount();
        expect(pending()).toBe(0);
    });
});

describe('⭐ the strike frame meets the hit', () => {
    function stubAnimate() {
        const calls = [];
        const proto = window.HTMLElement.prototype;
        const had = Object.prototype.hasOwnProperty.call(proto, 'animate');
        const original = proto.animate;
        proto.animate = function animate(keyframes, options) {
            const a = { keyframes, options, at: clock, startTime: null, cancel: vi.fn() };
            calls.push(a);
            return a;
        };
        return { calls, restore() { if (had) proto.animate = original; else delete proto.animate; } };
    }
    const mount = (...els) => render(h(EngineContext.Provider, { value: { GameState, EventBus } }, h(DndContext, null, ...els)));
    const mod = (a, n) => ((a % n) + n) % n;

    it('⭐ at work: the hero shows its strike frame in exactly the frames where the Token’s hit loop begins again', () => {
        const anim = stubAnimate();
        try {
            const { container } = mount(
                h(TokenHitArt, { key: 't', instanceId: 't1', skill: 'forestry', heroId: 'hero_7', active: true }, h('span')),
                h('div', { key: 's', 'data-sprite': 'hero' }, h(AnimatedHeroSprite, { src: 'h.png', heroId: 'hero_7', size: 128, animationState: 'attack' }))
            );
            expect(anim.calls).toHaveLength(1);
            const loopStart = anim.calls[0].startTime;
            let strikes = 0;
            for (let i = 0; i < 500; i++) {
                frame();
                const s = shown(spriteEl(container, 'hero'));
                expect(s.row).toBe('attack');
                const hitBegins = mod(clock - loopStart, HIT_PERIOD_MS) < HERO_FRAME_MS;
                expect(s.frame === STRIKE_FRAME).toBe(hitBegins);
                if (hitBegins) strikes += 1;
            }
            expect(strikes).toBeGreaterThan(40);   // ~21 frames a strike, 3 strikes
        } finally {
            anim.restore();
        }
    });

    it('⭐ in a fight: the attack row plays from the attack, and its strike frame shows exactly while the knockback starts', () => {
        const anim = stubAnimate();
        try {
            const { container } = mount(
                h(TokenHitArt, { key: 't', instanceId: 'enemy_1', skill: 'combat', heroId: 'hero_q6', active: true, tokenX: 600 }, h('span')),
                h('div', { key: 's', 'data-sprite': 'hero' }, h(MatHero, {
                    heroId: 'hero_q6', name: 'Q6', sprite: 'recruit', left: 0, top: 0, z: 1, animationState: 'combat'
                }))
            );
            for (let i = 0; i < 37; i++) frame();
            expect(shown(spriteEl(container, 'hero')).row).toBe('idle');
            act(() => EventBus.publish(COMBAT_ATTACK_EVENT, { instanceId: 'enemy_1', heroId: 'hero_q6', hit: true }));
            expect(anim.calls).toHaveLength(1);
            const knockAt = anim.calls[0].at + anim.calls[0].options.delay;
            expect(anim.calls[0].options.delay).toBe(STRIKE_DELAY_MS);

            const seen = [];
            for (let i = 0; i < 200; i++) {
                frame();
                const s = shown(spriteEl(container, 'hero'));
                const knockBegins = clock >= knockAt && clock < knockAt + HERO_FRAME_MS;
                expect(s.row === 'attack' && s.frame === STRIKE_FRAME).toBe(knockBegins);
                if (seen[seen.length - 1] !== `${s.row}:${s.frame}`) seen.push(`${s.row}:${s.frame}`);
            }
            expect(seen.slice(0, 8)).toEqual(['attack:0', 'attack:1', 'attack:2', 'attack:3', 'attack:4', 'attack:5', 'attack:6', 'attack:7']);
            expect(seen[8].startsWith('idle:')).toBe(true);
        } finally {
            anim.restore();
        }
    });
});

describe('⭐ the hero bar: sprite frames redraw nothing around them', () => {
    const hero = (id, name) => ({ id, name, spriteId: 'hero_recruit_0', hp: { current: 100, max: 100 }, status: 'idle', equipment: {} });
    const engine = { GameState, EventBus, BoardPlacement: { recallHeroById: vi.fn() }, EquipmentManager: { equipItem: vi.fn() } };

    it('⭐ 8 bar heroes idling: no React commit, and the slots’ layout animation never measures', async () => {
        GameState.state.heroes = IDS.map(id => hero(id, id));
        setLiveMatFit(1);
        let commits = 0;
        const { container } = render(h(EngineContext.Provider, { value: engine },
            h(DeckDndProvider, null,
                h(Profiler, { id: 'bar', onRender: () => { commits += 1; } }, h(BottomHeroDock, { selectedHeroId: null })))));
        expect(container.querySelectorAll('[data-dock-hero] [data-hero-row]')).toHaveLength(8);
        for (let i = 0; i < 10; i++) frame();

        const rects = vi.spyOn(Element.prototype, 'getBoundingClientRect');
        commits = 0;
        const frames = new Set();
        for (let i = 0; i < 330; i++) {          // 2 s
            frame();
            frames.add(container.querySelector('[data-dock-hero="hero_3"] [data-hero-row]').getAttribute('data-hero-frame'));
        }
        expect(frames.size).toBe(8);            // the bar's heroes did idle
        expect(commits).toBe(0);
        expect(rects).not.toHaveBeenCalled();

        // The probe sees a measure when there is one: reordering the bar re-measures its slots.
        await act(async () => {
            GameState.state.heroes = [...GameState.state.heroes].reverse();
            EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, {});
            await Promise.resolve();    // the hook's update waits for a microtask
        });
        for (let i = 0; i < 5; i++) frame();
        expect(commits).toBeGreaterThan(0);
        expect(rects).toHaveBeenCalled();
    });
});
