// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, fireEvent, act, cleanup } from '@testing-library/react';
import { WorldCamera, WORLD_CAMERA, worldCameraAfter } from '../ui/components/atlas/WorldCamera.jsx';
import { HallCamera, CAMERA, GLIDE_MS, SETTLE } from '../ui/components/board/HallCamera.jsx';

/**
 * The pan down from the mat to the world map: the map lies one room height below the mat, and
 * opening it glides the mat up and away and the map up into place, the wood table round the mat
 * moving with it; closing glides back. A click or a key finishes a glide; reduced motion swaps at
 * once. At rest on the mat nothing of the map is mounted, and on the map the mat is gone. It
 * never glides together with the Hall's camera.
 */

const ROOM_H = 700;
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
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(() => ROOM_H);
    anchor = document.body.appendChild(document.createElement('div'));
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

function setup({ open = false, away = false } = {}) {
    const tableAnchor = { current: anchor };
    const element = (props) => h(WorldCamera, {
        open, away, table: WOOD, tableAnchor, world: h('div', { 'data-test-world': '' }), ...props
    }, h('div', { 'data-test-mat': '' }));
    const view = render(element({}));
    return {
        ...view,
        camera: () => q(view.container, '[data-world-camera]'),
        phase: () => q(view.container, '[data-world-camera]').getAttribute('data-world-camera'),
        stage: () => q(view.container, '[data-world-stage]'),
        has: (name) => !!q(view.container, `[data-test-${name}]`),
        set: (props) => view.rerender(element(props)),
        go: (props) => { view.rerender(element(props)); frames(); }
    };
}
const camAnim = () => anims.at(-1);
const fromTo = (anim) => anim.keyframes.map(k => k.transform);

describe('the camera between the mat and the world map', () => {
    it('rests on the mat with nothing of the map mounted or moved', () => {
        const s = setup();
        expect(s.camera().getAttribute('style')).toBeNull();
        expect(s.stage()).toBeNull();
        expect([s.has('mat'), s.has('world')]).toEqual([true, false]);
        expect(anims).toHaveLength(0);
    });

    it('opening pans down: the mat and the wood glide up and away, the map one room height below comes up into place', () => {
        const s = setup();
        s.go({ open: true });
        expect(s.phase()).toBe(WORLD_CAMERA.TO_WORLD);
        expect([s.has('mat'), s.has('world')]).toEqual([true, true]);
        expect([s.stage().style.top, s.stage().style.height]).toEqual(['100%', '100%']);
        // The wood round the mat moves with it: a copy of the table on the moving camera.
        expect(s.camera().style.backgroundColor).toBe('rgb(1, 2, 3)');
        expect(anims).toHaveLength(1);
        expect(camAnim().el).toBe(s.camera());
        expect(fromTo(camAnim())).toEqual(['translateY(0px)', `translateY(${-ROOM_H}px)`]);
        expect(camAnim().options.duration).toBe(GLIDE_MS);
        expect(q(s.container, '[data-world-skip]')).toBeTruthy();
    });

    it('waits for frames to flow before it starts, so the first picture of the map does not eat the glide', () => {
        const s = setup();
        s.set({ open: true });
        expect(anims).toHaveLength(0);
        frames();
        expect(anims).toHaveLength(1);
    });

    it('arrives on the map with the mat gone and nothing moved; closing glides back up to the mat', () => {
        const s = setup();
        s.go({ open: true });
        act(() => camAnim().finish());
        expect(s.phase()).toBe(WORLD_CAMERA.WORLD);
        expect([s.camera().style.transform, s.camera().style.willChange, s.camera().style.backgroundColor]).toEqual(['', '', '']);
        expect([s.has('mat'), s.has('world')]).toEqual([false, true]);
        expect(s.stage().style.top).toBe('0px');

        s.go({ open: false });
        expect(s.phase()).toBe(WORLD_CAMERA.TO_MAT);
        expect(fromTo(camAnim())).toEqual([`translateY(${-ROOM_H}px)`, 'translateY(0px)']);
        act(() => camAnim().finish());
        expect(s.phase()).toBe(WORLD_CAMERA.MAT);
        expect([s.has('mat'), s.has('world')]).toEqual([true, false]);
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
