// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, fireEvent, act, cleanup } from '@testing-library/react';
import { WorldCamera, WORLD_CAMERA, worldCameraAfter, useWorldInsets, insetsOf } from '../ui/components/atlas/WorldCamera.jsx';
import { HallCamera, CAMERA, GLIDE_MS, SETTLE } from '../ui/components/board/HallCamera.jsx';
import { hallCameraSides } from './fixtures/hallCameraSides.js';

/**
 * The pan down from the mat to the world map: the map lies one room height below the mat, and
 * opening it glides the mat up and away and the map up into place, the wood table round the mat
 * moving with it; closing glides back. A click or a key finishes a glide; reduced motion swaps at
 * once. At rest on the mat nothing of the map is mounted, and on the map the mat is gone. It
 * never glides together with the Hall's camera. The map is laid under the whole screen (the table
 * anchor), not in the room, and the two glide together by a screen height.
 */

const ROOM_H = 700;
/** The screen (the table anchor) is taller than the mat's room by the hero bar. */
const SCREEN_H = 820;
const h = React.createElement;
const q = (c, sel) => c.querySelector(sel);

let anims;
let rafs;
let rafId;
let saved;
let reduced;
let clock;
let anchor;

function fakeAnimate(keyframes, options) {
    const anim = {
        el: this, keyframes, options, onfinish: null, cancelled: false,
        finish() { this.onfinish?.(); },
        cancel() { this.cancelled = true; }
    };
    anims.push(anim);
    return anim;
}

/** The browser draws `n` frames `gapMs` apart. */
function frames(n = SETTLE.frames, gapMs = 16) {
    for (let i = 0; i < n; i++) {
        clock += gapMs;
        const due = [...rafs.values()];
        rafs.clear();
        act(() => { for (const cb of due) cb(clock); });
    }
}

beforeEach(() => {
    anims = [];
    rafs = new Map();
    rafId = 0;
    clock = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    saved = { raf: window.requestAnimationFrame, caf: window.cancelAnimationFrame };
    window.requestAnimationFrame = (cb) => { rafs.set(++rafId, cb); return rafId; };
    window.cancelAnimationFrame = (id) => { rafs.delete(id); };
    reduced = false;
    HTMLElement.prototype.animate = fakeAnimate;
    window.matchMedia = vi.fn(() => ({ matches: reduced, addEventListener() {}, removeEventListener() {} }));
    anchor = document.body.appendChild(document.createElement('div'));
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function () { return this === anchor ? SCREEN_H : ROOM_H; });
});

afterEach(() => {
    cleanup();
    anchor.remove();
    vi.restoreAllMocks();
    delete HTMLElement.prototype.animate;
    delete window.matchMedia;
    window.requestAnimationFrame = saved.raf;
    window.cancelAnimationFrame = saved.caf;
});

const WOOD = { backgroundColor: 'rgb(1, 2, 3)', backgroundSize: '512px' };

function setup({ open = false, away = false, screen = true } = {}) {
    const tableAnchor = screen ? { current: anchor } : undefined;
    const element = (props) => h(WorldCamera, {
        open, away, table: WOOD, tableAnchor, world: h('div', { 'data-test-world': '' }), ...props
    }, h('div', { 'data-test-mat': '' }));
    const view = render(element({}));
    return {
        ...view,
        camera: () => q(view.container, '[data-world-camera]'),
        phase: () => q(view.container, '[data-world-camera]').getAttribute('data-world-camera'),
        stage: () => q(document, '[data-world-stage]'),
        layer: () => q(anchor, '[data-world-table]'),
        has: (name) => !!q(document, `[data-test-${name}]`),
        set: (props) => view.rerender(element(props)),
        go: (props) => { view.rerender(element(props)); frames(); }
    };
}
const camAnim = () => anims.filter(a => a.el.hasAttribute('data-world-camera')).at(-1);
const layerAnim = () => anims.filter(a => a.el.hasAttribute('data-world-table')).at(-1);
const fromTo = (anim) => anim.keyframes.map(k => k.transform);

describe('the camera between the mat and the world map', () => {
    it('rests on the mat with nothing of the map mounted or moved', () => {
        const s = setup();
        expect(s.camera().getAttribute('style')).toBeNull();
        expect(s.stage()).toBeNull();
        expect([s.has('mat'), s.has('world')]).toEqual([true, false]);
        expect(anims).toHaveLength(0);
    });

    it('opening pans down: the mat and the wood glide up and away, the map one screen height below comes up into place', () => {
        const s = setup();
        s.go({ open: true });
        expect(s.phase()).toBe(WORLD_CAMERA.TO_WORLD);
        expect([s.has('mat'), s.has('world')]).toEqual([true, true]);
        // The map lies under the whole screen, below a copy of the wood: the lower half of a layer
        // two screens tall, in the table anchor, not in the mat's room.
        expect(s.layer().contains(s.stage())).toBe(true);
        expect(s.container.contains(s.stage())).toBe(false);
        expect([s.layer().style.top, s.layer().style.height]).toEqual(['0px', '200%']);
        expect([s.stage().style.top, s.stage().style.height]).toEqual(['50%', '50%']);
        const wood = q(anchor, '[data-world-wood]');
        expect([wood.style.top, wood.style.height, wood.style.backgroundColor]).toEqual(['0px', '50%', 'rgb(1, 2, 3)']);
        // The wood round the mat moves with it: a copy of the table on the moving camera.
        expect(s.camera().style.backgroundColor).toBe('rgb(1, 2, 3)');
        // Both glide a screen height by the same keyframes, from the same frame.
        expect(anims).toHaveLength(2);
        expect(camAnim().el).toBe(s.camera());
        expect(layerAnim().el).toBe(s.layer());
        expect(fromTo(camAnim())).toEqual(['translateY(0px)', `translateY(${-SCREEN_H}px)`]);
        expect(fromTo(layerAnim())).toEqual(fromTo(camAnim()));
        expect(layerAnim().options).toEqual(camAnim().options);
        expect(camAnim().options.duration).toBe(GLIDE_MS);
        expect(q(s.container, '[data-world-skip]')).toBeTruthy();
        expect(q(anchor, '[data-world-skip-screen]')).toBeTruthy();
    });

    it('without a screen box to lay it in, the map comes up into the room, one room height below', () => {
        const s = setup({ screen: false });
        s.go({ open: true });
        expect(s.container.contains(s.stage())).toBe(true);
        expect([s.stage().style.top, s.stage().style.height]).toEqual(['100%', '100%']);
        expect(anims).toHaveLength(1);
        expect(fromTo(camAnim())).toEqual(['translateY(0px)', `translateY(${-ROOM_H}px)`]);
    });

    it('waits for frames to flow before it starts, so the first picture of the map does not eat the glide', () => {
        const s = setup();
        s.set({ open: true });
        expect(anims).toHaveLength(0);
        frames();
        expect(anims).toHaveLength(2);
    });

    it('arrives on the map with the mat gone and nothing moved; closing glides back up to the mat', () => {
        const s = setup();
        s.go({ open: true });
        act(() => camAnim().finish());
        expect(s.phase()).toBe(WORLD_CAMERA.WORLD);
        expect([s.camera().style.transform, s.camera().style.willChange, s.camera().style.backgroundColor]).toEqual(['', '', '']);
        expect([s.has('mat'), s.has('world')]).toEqual([false, true]);
        // At rest the map covers the screen, nothing moved, the wood copy and the catchers gone.
        expect([s.stage().style.top, s.stage().style.height]).toEqual(['0px', '100%']);
        expect([s.layer().style.top, s.layer().style.height, s.layer().style.transform]).toEqual(['0px', '100%', '']);
        expect(q(anchor, '[data-world-wood]')).toBeNull();
        expect(q(anchor, '[data-world-skip-screen]')).toBeNull();
        // Behind the nav and the column: no layer of its own, and it lets presses through but for the map.
        expect(q(anchor, '[data-world-backdrop]').className).toContain('pointer-events-none');
        expect(q(anchor, '[data-world-backdrop]').className).not.toMatch(/(^| )z-/);

        s.go({ open: false });
        expect(s.phase()).toBe(WORLD_CAMERA.TO_MAT);
        expect(fromTo(camAnim())).toEqual([`translateY(${-SCREEN_H}px)`, 'translateY(0px)']);
        expect(fromTo(layerAnim())).toEqual(fromTo(camAnim()));
        act(() => camAnim().finish());
        expect(s.phase()).toBe(WORLD_CAMERA.MAT);
        expect([s.has('mat'), s.has('world')]).toEqual([true, false]);
        expect(anchor.childElementCount).toBe(0);
    });

    it('a click or a key finishes a glide; Escape on the way down is left to the map', () => {
        const s = setup();
        s.go({ open: true });
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(s.phase()).toBe(WORLD_CAMERA.TO_WORLD);
        fireEvent.keyDown(window, { key: 'a' });
        expect(s.phase()).toBe(WORLD_CAMERA.WORLD);
        s.go({ open: false });
        fireEvent.pointerDown(q(s.container, '[data-world-skip]'));
        expect(s.phase()).toBe(WORLD_CAMERA.MAT);
        // A press on the moving screen outside the room lands it too.
        s.go({ open: true });
        fireEvent.pointerDown(q(anchor, '[data-world-skip-screen]'));
        expect(s.phase()).toBe(WORLD_CAMERA.WORLD);
    });

    it('reduced motion swaps at once', () => {
        reduced = true;
        const s = setup();
        s.set({ open: true });
        expect(s.phase()).toBe(WORLD_CAMERA.WORLD);
        s.set({ open: false });
        expect(s.phase()).toBe(WORLD_CAMERA.MAT);
        expect(anims).toHaveLength(0);
        expect(worldCameraAfter(WORLD_CAMERA.TO_WORLD, false, true)).toBe(WORLD_CAMERA.MAT);
    });

    it('another view taking over (the Hall) sets it on the mat at once, with no glide back', () => {
        const s = setup();
        s.go({ open: true });
        act(() => camAnim().finish());
        const before = anims.length;
        s.set({ open: false, away: true });
        expect(s.phase()).toBe(WORLD_CAMERA.MAT);
        frames();
        expect(anims.length).toBe(before);
    });

    it('never glides together with the Hall\'s camera: it lies on the mat\'s side of it, and is set down when the Hall opens', () => {
        const element = ({ hallOpen, mapOpen }) => h(HallCamera, {
            open: hallOpen, away: mapOpen, sky: h('div'), hall: h('div', { 'data-test-hall': '' }), table: WOOD, tableAnchor: { current: anchor }
        }, h(WorldCamera, {
            open: mapOpen, away: hallOpen, table: WOOD, tableAnchor: { current: anchor }, world: h('div', { 'data-test-world': '' })
        }, h('div', { 'data-test-mat': '' })));
        const live = () => anims.filter(a => !a.cancelled && !a.finished);
        const ownedBy = (attr) => live().filter(a => a.el.hasAttribute(attr));
        const view = render(element({ hallOpen: false, mapOpen: true }));
        const worldPhase = () => q(view.container, '[data-world-camera]')?.getAttribute('data-world-camera');
        const hallPhase = () => q(view.container, '[data-hall-camera]').getAttribute('data-hall-camera');
        // Opened straight onto the map: no glide at all.
        frames();
        expect(live()).toHaveLength(0);
        // From the map to the Hall: the map is set down at once, and only the Hall glides.
        view.rerender(element({ hallOpen: true, mapOpen: false }));
        frames();
        expect(hallPhase()).toBe(CAMERA.TO_SKY);
        expect(worldPhase()).toBe(WORLD_CAMERA.MAT);
        expect(ownedBy('data-world-camera')).toHaveLength(0);
        expect(ownedBy('data-hall-camera')).toHaveLength(1);
        // Back to the map before the Hall's glide ends: the Hall's glide is cancelled first, then the map's runs alone.
        view.rerender(element({ hallOpen: false, mapOpen: true }));
        frames();
        expect(hallPhase()).toBe(CAMERA.MAT);
        expect(ownedBy('data-hall-camera')).toHaveLength(0);
        expect(worldPhase()).toBe(WORLD_CAMERA.TO_WORLD);
        expect(ownedBy('data-world-camera')).toHaveLength(1);
        // To the Hall again, all the way up: the mat (and the map's camera with it) is gone; back
        // to the map, it lands on the map at once with nothing gliding.
        view.rerender(element({ hallOpen: true, mapOpen: false }));
        frames();
        expect(ownedBy('data-world-camera')).toHaveLength(0);
        const up = ownedBy('data-hall-camera')[0];
        act(() => { up.finished = true; up.finish(); });
        expect(hallPhase()).toBe(CAMERA.SKY);
        expect(worldPhase()).toBeUndefined();
        view.rerender(element({ hallOpen: false, mapOpen: true }));
        frames();
        expect(hallPhase()).toBe(CAMERA.MAT);
        expect(worldPhase()).toBe(WORLD_CAMERA.WORLD);
        expect(live().filter(a => !a.finished)).toHaveLength(0);
    });
});

describe('the map under the whole screen', () => {
    it('measures the mat\'s room inside the screen, and hands it to the map', () => {
        expect(insetsOf({ left: 152, top: 0, right: 1366, bottom: 668.4 }, { left: 0, top: 0, right: 1366, bottom: 768 }))
            .toEqual({ left: 152, top: 0, right: 0, bottom: 100 });
        const room = { left: 0, top: 0, right: 1768, bottom: 960 };
        const shown = [];
        const Probe = () => { shown.push(useWorldInsets()); return null; };
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
            if (this === anchor) return { left: 0, top: 0, right: 1920, bottom: 1080 };
            return this.hasAttribute('data-world-camera-room') ? room : { left: 0, top: 0, right: 0, bottom: 0 };
        });
        render(h(WorldCamera, { open: true, table: WOOD, tableAnchor: { current: anchor }, world: h(Probe) }, h('div')));
        expect(shown.at(-1)).toEqual({ left: 0, top: 0, right: 152, bottom: 120 });
        // Laid in the room (no screen box), the map has nothing round it.
        cleanup();
        shown.length = 0;
        render(h(WorldCamera, { open: true, table: WOOD, world: h(Probe) }, h('div')));
        expect(shown.at(-1)).toEqual({ left: 0, top: 0, right: 0, bottom: 0 });
    });

    it('in the game, the map is laid in the screen box that holds the nav and the column, as the Hall\'s sky', () => {
        const { code, mat } = hallCameraSides();
        const camera = mat.slice(mat.indexOf('<WorldCamera'), mat.indexOf('>', mat.indexOf('tableAnchor=', mat.indexOf('<WorldCamera'))) + 1);
        expect(camera).toContain('tableAnchor={tableRef}');
        const box = code.slice(code.indexOf('ref={tableRef}'), code.indexOf('</ViewportProvider>'));
        expect(box.indexOf('<BubbleMenu')).toBeGreaterThan(0);
        expect(box.indexOf('<WorldCamera')).toBeGreaterThan(0);
        expect(box.indexOf('<BottomHeroDock')).toBeGreaterThan(0);
    });
});
