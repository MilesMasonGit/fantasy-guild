// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, fireEvent, act, cleanup } from '@testing-library/react';
import { HallCamera, CAMERA, GLIDE_MS, SETTLE, FIRST_FRAME_WAIT_MS, cameraAfter, translateYOf } from '../ui/components/board/HallCamera.jsx';
import { hallCameraSides } from './fixtures/hallCameraSides.js';

/**
 * The camera move between the playmat and the Guild Hall's night sky: the sky lies above the
 * wood table, and opening the Hall glides the view up from the mat to it; closing glides back
 * down. The mat, the Hall's screen and the whole backdrop (sky over wood) move together by one
 * compositor transform each, starting once the side just laid down has been drawn. A click or a
 * key finishes a glide, reduced motion swaps at once, and at rest each side is drawn exactly as
 * it is without the camera: on the mat nothing of the Hall is mounted, styled or listening, and
 * on the sky the mat is gone and nothing is moved.
 */

const COLUMN_H = 800;
const h = React.createElement;
const q = (c, sel) => c.querySelector(sel);

let anims;
let rafs;
let rafId;
let saved;
let reduced;
let computedY;
let anchor;

/** A stand-in for the browser's animation: it runs until `finish()` or `cancel()`. */
function fakeAnimate(keyframes, options) {
    const anim = {
        el: this, keyframes, options, onfinish: null, cancelled: false,
        finish() { this.onfinish?.(); },
        cancel() { this.cancelled = true; }
    };
    anims.push(anim);
    return anim;
}

/**
 * The browser draws `n` frames `gapMs` apart: the animation-frame callbacks due run with the
 * frame's time, then the next ones. By default, the frames a fresh glide waits for.
 */
let clock;
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
    computedY = null;
    HTMLElement.prototype.animate = fakeAnimate;
    window.matchMedia = vi.fn(() => ({ matches: reduced, addEventListener() {}, removeEventListener() {} }));
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(() => COLUMN_H);
    const real = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el) => {
        const style = real(el);
        if (computedY == null || !el.hasAttribute('data-hall-camera')) return style;
        return { ...style, transform: `matrix(1, 0, 0, 1, 0, ${computedY})` };
    });
    // The element the wood is drawn on, around the nav and the mat's column.
    anchor = document.body.appendChild(document.createElement('div'));
});

afterEach(() => {
    cleanup();
    anchor.remove();
    vi.restoreAllMocks();
    vi.useRealTimers();
    delete HTMLElement.prototype.animate;
    delete window.matchMedia;
    window.requestAnimationFrame = saved.raf;
    window.cancelAnimationFrame = saved.caf;
});

/**
 * Stand-ins that count their own renders and mounts, memoised as the mat's own component is, so
 * a new element from each parent render (as ReactRoot makes) does not redraw them by itself.
 */
const renders = { mat: 0, hall: 0, sky: 0 };
const mounts = { mat: 0, hall: 0, sky: 0 };
const counted = (name) => React.memo(function Counted() {
    renders[name]++;
    React.useEffect(() => { mounts[name]++; }, []);
    return h('div', { [`data-test-${name}`]: '' });
});
const Hall = counted('hall');
const Sky = counted('sky');
const WOOD = { backgroundColor: 'rgb(1, 2, 3)', backgroundSize: '512px' };

/** React's own commit log for the mat's subtree, profiled inside its memo as the game's is. */
let matCommits;
const onMatCommit = (id, phase) => matCommits.push(phase);
const MatInner = counted('mat');
const Mat = React.memo(function Mat() {
    return h(React.Profiler, { id: 'mat', onRender: onMatCommit }, h(MatInner));
});

function setup({ open = false, away = false } = {}) {
    for (const k of Object.keys(renders)) { renders[k] = 0; mounts[k] = 0; }
    matCommits = [];
    const tableAnchor = { current: anchor };
    // New elements on every render, as ReactRoot's are.
    const element = (props) => h(HallCamera, {
        open, away, table: WOOD, tableAnchor,
        sky: h(Sky), hall: h(Hall),
        ...props
    }, h(Mat));
    const view = render(element({}));
    return {
        ...view,
        camera: () => q(view.container, '[data-hall-camera]'),
        phase: () => q(view.container, '[data-hall-camera]').getAttribute('data-hall-camera'),
        stage: () => q(view.container, '[data-hall-stage]'),
        backdrop: () => q(anchor, '[data-hall-backdrop]'),
        table: () => q(anchor, '[data-hall-table]'),
        wood: () => q(anchor, '[data-hall-wood]'),
        has: (name) => !!(q(view.container, `[data-test-${name}]`) || q(anchor, `[data-test-${name}]`)),
        set: (props) => view.rerender(element(props)),
        /** A change of props, then the two frames a fresh glide waits for. */
        go: (props) => { view.rerender(element(props)); frames(); }
    };
}

/** The camera's animation of the latest glide (its finish ends the glide), and the table's. */
const camAnim = () => anims.filter(a => a.el.hasAttribute('data-hall-camera')).at(-1);
const tableAnim = () => anims.filter(a => a.el.hasAttribute('data-hall-table')).at(-1);
/** No transform and no layer hint on it. */
const unmoved = (el) => el.style.transform === '' && el.style.willChange === '';
const fromTo = (anim) => anim.keyframes.map(k => k.transform);

describe('the camera between the mat and the Hall sky', () => {
    it('rests on the mat with nothing of the Hall mounted, styled or listening', () => {
        const added = vi.spyOn(window, 'addEventListener');
        const s = setup();
        expect(s.camera().getAttribute('style')).toBeNull();
        expect(s.backdrop()).toBeNull();
        expect(s.stage()).toBeNull();
        expect(q(s.container, '[data-hall-skip]')).toBeNull();
        expect([s.has('hall'), s.has('sky'), s.has('mat')]).toEqual([false, false, true]);
        expect(anims).toHaveLength(0);
        expect(added.mock.calls.filter(([type]) => type === 'keydown')).toHaveLength(0);
    });

    it('opening glides the mat, the Hall and the whole backdrop up together, the sky above the table', () => {
        const s = setup();
        s.go({ open: true });
        expect(s.phase()).toBe(CAMERA.TO_SKY);
        // The Hall's screen lies one column height above the mat; the mat stays as it was.
        expect([s.stage().style.top, s.stage().style.height]).toEqual(['-100%', '100%']);
        expect(q(s.stage(), '[data-test-hall]')).toBeTruthy();
        expect(s.has('mat')).toBe(true);
        // The mat first, so a lookup of the board's marker (the web carries it too) finds the mat.
        expect(s.camera().firstElementChild.hasAttribute('data-test-mat')).toBe(true);
        // The backdrop is laid in the element the wood is drawn on, under the nav too, in a
        // clipped box: moved, it must not make that element scrollable.
        const clip = s.backdrop();
        expect(clip.parentElement).toBe(anchor);
        expect(clip.className).toContain('overflow-clip');
        expect(clip.className).toContain('inset-0');
        expect([s.table().style.top, s.table().style.height]).toEqual(['-100%', '200%']);
        // The sky in its top half, the wood (the Settings one, as around the mat) in its bottom.
        const skyHalf = q(s.table(), '[data-test-sky]').parentElement;
        expect([skyHalf.style.top, skyHalf.style.height]).toEqual(['0px', '50%']);
        expect([s.wood().style.top, s.wood().style.height, s.wood().style.backgroundColor]).toEqual(['50%', '50%', 'rgb(1, 2, 3)']);

        expect(anims).toHaveLength(2);
        expect(camAnim().el).toBe(s.camera());
        expect(tableAnim().el).toBe(s.table());
        for (const anim of [camAnim(), tableAnim()]) {
            expect(fromTo(anim)).toEqual(['translateY(0px)', `translateY(${COLUMN_H}px)`]);
            expect(anim.options.duration).toBe(GLIDE_MS);
        }
        expect(GLIDE_MS).toBeLessThan(1000);
        expect(q(s.container, '[data-hall-skip]')).toBeTruthy();
    });

    it('arrives on the sky with the Hall drawn as it is without the camera: nothing moved, the mat gone', () => {
        const s = setup();
        s.go({ open: true });
        act(() => camAnim().finish());
        expect(s.phase()).toBe(CAMERA.SKY);
        expect(unmoved(s.camera())).toBe(true);
        expect([s.stage().style.top, s.stage().style.height]).toEqual(['0px', '100%']);
        expect(unmoved(s.table())).toBe(true);
        expect([s.table().style.top, s.table().style.height]).toEqual(['0px', '100%']);
        expect(q(s.table(), '[data-test-sky]').parentElement.style.height).toBe('100%');
        expect(s.wood()).toBeNull();
        expect(s.has('mat')).toBe(false);
        expect(q(s.container, '[data-hall-skip]')).toBeNull();
        expect(anims.every(a => a.cancelled)).toBe(true);
        // The sky and the Hall were not mounted again on arrival: the sky's drift runs on.
        expect([mounts.sky, mounts.hall]).toEqual([1, 1]);
    });

    it('closing glides back down, the mat laid back first, and the Hall stays until the camera is on the mat', () => {
        const s = setup();
        s.go({ open: true });
        act(() => camAnim().finish());
        s.go({ open: false });
        expect(s.phase()).toBe(CAMERA.TO_MAT);
        expect(s.has('mat')).toBe(true);
        expect([s.stage().style.top, s.stage().style.height]).toEqual(['-100%', '100%']);
        expect(fromTo(camAnim())).toEqual([`translateY(${COLUMN_H}px)`, 'translateY(0px)']);
        expect(fromTo(tableAnim())).toEqual(fromTo(camAnim()));
        expect([s.has('hall'), s.has('sky')]).toEqual([true, true]);
        expect(s.wood()).toBeTruthy();

        act(() => camAnim().finish());
        expect(s.phase()).toBe(CAMERA.MAT);
        expect(s.camera().getAttribute('style') || '').toBe('');
        expect([s.has('hall'), s.has('sky'), s.has('mat')]).toEqual([false, false, true]);
        expect(s.stage()).toBeNull();
        expect(s.backdrop()).toBeNull();
        expect(anims.every(a => a.cancelled)).toBe(true);
    });

    it('never redraws the mat while the camera moves: it renders only when it is laid on the table', () => {
        const s = setup();
        expect([renders.mat, matCommits]).toEqual([1, ['mount']]);
        // Up: the parent's render that opens the Hall, the glide and the arrival commit nothing
        // in the mat's subtree; on the sky the mat is gone.
        s.go({ open: true });
        act(() => camAnim().finish());
        expect([renders.mat, matCommits]).toEqual([1, ['mount']]);
        // Down: the mat is laid back once, in the render that asks for the glide, before its
        // first frame, and nothing in it commits again on the way or on arrival.
        s.go({ open: false });
        expect([renders.mat, matCommits]).toEqual([2, ['mount', 'mount']]);
        fireEvent.keyDown(document, { key: 'a' });
        expect(s.phase()).toBe(CAMERA.MAT);
        expect([renders.mat, matCommits]).toEqual([2, ['mount', 'mount']]);
        // Nor does a turn back mid-glide, either way.
        s.go({ open: true });
        computedY = 300;
        s.set({ open: false });
        computedY = 200;
        s.set({ open: true });
        expect(s.phase()).toBe(CAMERA.TO_SKY);
        expect([renders.mat, matCommits.length]).toEqual([2, 2]);
        // The Hall's screen likewise: drawn once each time it is laid in the sky, never redrawn.
        expect([renders.hall, mounts.hall]).toEqual([2, 2]);
    });

    it('a click or a key finishes the glide at once, moving or still waiting for its first frame', () => {
        const s = setup();
        s.go({ open: true });
        fireEvent.pointerDown(q(s.container, '[data-hall-skip]'));
        expect(s.phase()).toBe(CAMERA.SKY);
        expect(s.has('mat')).toBe(false);

        s.go({ open: false });
        fireEvent.keyDown(document, { key: 'a' });
        expect(s.phase()).toBe(CAMERA.MAT);
        expect(s.has('hall')).toBe(false);

        // Before it has moved at all.
        s.set({ open: true });
        expect(anims.filter(a => !a.cancelled)).toHaveLength(0);
        fireEvent.pointerDown(q(s.container, '[data-hall-skip]'));
        expect(s.phase()).toBe(CAMERA.SKY);
        frames();
        expect(anims.filter(a => !a.cancelled)).toHaveLength(0);
    });

    it('holds where it starts until the side just laid down has been drawn, then glides', () => {
        const s = setup();
        s.set({ open: true });
        expect(s.phase()).toBe(CAMERA.TO_SKY);
        expect(s.has('hall')).toBe(true);
        expect([s.camera().style.transform, s.table().style.transform]).toEqual(['translateY(0px)', 'translateY(0px)']);
        expect(anims).toHaveLength(0);
        frames(SETTLE.frames - 1);
        expect(anims).toHaveLength(0);
        frames(1);
        expect(anims).toHaveLength(2);
        expect(fromTo(camAnim())).toEqual(['translateY(0px)', `translateY(${COLUMN_H}px)`]);
        act(() => camAnim().finish());

        // Down likewise: held on the sky while the mat is laid back and first drawn.
        s.set({ open: false });
        expect(s.has('mat')).toBe(true);
        expect([s.camera().style.transform, s.table().style.transform]).toEqual(['translateY(100%)', 'translateY(50%)']);
        expect(anims.filter(a => !a.cancelled)).toHaveLength(0);
        frames();
        expect(fromTo(camAnim())).toEqual([`translateY(${COLUMN_H}px)`, 'translateY(0px)']);
    });

    it('waits out frames that stall after the side is laid down, so the glide is seen whole', () => {
        const s = setup();
        s.set({ open: true });
        // The browser readies the new layers: two frames come 300 ms late.
        frames(2);
        frames(2, 300);
        expect(anims).toHaveLength(0);
        // The first frame on time after that starts it, from the start.
        frames(1);
        expect(anims).toHaveLength(2);
        expect(fromTo(camAnim())).toEqual(['translateY(0px)', `translateY(${COLUMN_H}px)`]);
    });

    it('starts anyway when frames never steady, at most a second after it was asked for', () => {
        const s = setup();
        s.set({ open: true });
        frames(Math.floor(SETTLE.maxMs / 300), 300);
        expect(anims).toHaveLength(0);
        frames(1, 300);
        expect(anims).toHaveLength(2);
        expect(SETTLE.maxMs).toBeLessThan(FIRST_FRAME_WAIT_MS);
    });

    it('turned back before it has moved, it lands back where it was at once', () => {
        const s = setup();
        s.set({ open: true });
        s.set({ open: false });
        expect(s.phase()).toBe(CAMERA.MAT);
        expect(s.has('hall')).toBe(false);
        frames();
        expect(anims).toHaveLength(0);
    });

    it('Escape on the way up is left to the screen, which closes it; on the way down it lands', () => {
        const s = setup();
        s.go({ open: true });
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(s.phase()).toBe(CAMERA.TO_SKY);
        s.set({ open: false });
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(s.phase()).toBe(CAMERA.MAT);
    });

    it('turning back mid-glide glides from where the camera is, in the time left, at once', () => {
        const s = setup();
        s.go({ open: true });
        const up = [camAnim(), tableAnim()];
        computedY = 300;
        s.set({ open: false });
        expect(up.every(a => a.cancelled)).toBe(true);
        expect(s.phase()).toBe(CAMERA.TO_MAT);
        // Both sides are drawn already: no frame to wait for, or the camera would jump to its
        // rest style meanwhile.
        expect(anims.filter(a => !a.cancelled)).toHaveLength(2);
        for (const anim of [camAnim(), tableAnim()]) {
            expect(fromTo(anim)).toEqual(['translateY(300px)', 'translateY(0px)']);
            expect(anim.options.duration).toBe(Math.round(GLIDE_MS * 300 / COLUMN_H));
        }
        // The cancelled glide reporting late changes nothing.
        act(() => up[0].onfinish?.());
        expect(s.phase()).toBe(CAMERA.TO_MAT);
    });

    it('under reduced motion it is a plain swap', () => {
        reduced = true;
        const s = setup();
        s.set({ open: true });
        expect(s.phase()).toBe(CAMERA.SKY);
        expect(unmoved(s.camera())).toBe(true);
        expect(s.stage().style.top).toBe('0px');
        expect([s.has('hall'), s.has('sky'), s.has('mat')]).toEqual([true, true, false]);
        expect(s.wood()).toBeNull();
        s.set({ open: false });
        expect(s.camera().getAttribute('style')).toBeNull();
        expect([s.has('hall'), s.has('sky'), s.has('mat')]).toEqual([false, false, true]);
        expect(s.backdrop()).toBeNull();
        expect(anims).toHaveLength(0);
        expect(q(s.container, '[data-hall-skip]')).toBeNull();
    });

    it('another view opening as the Hall closes lands on the mat at once', () => {
        const s = setup();
        s.go({ open: true });
        act(() => camAnim().finish());
        s.go({ open: false });
        expect(s.phase()).toBe(CAMERA.TO_MAT);
        s.set({ open: false, away: true });
        expect(s.phase()).toBe(CAMERA.MAT);
        expect(s.has('hall')).toBe(false);
    });

    it('a glide in a window that draws no frames (hidden) still lands', () => {
        // Timers only: the window's frames stay this file's own, and none are drawn.
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        const s = setup();
        s.set({ open: true });
        act(() => { vi.advanceTimersByTime(FIRST_FRAME_WAIT_MS - 50); });
        expect(s.phase()).toBe(CAMERA.TO_SKY);
        act(() => { vi.advanceTimersByTime(100); });
        expect(s.phase()).toBe(CAMERA.SKY);
        // And one that started but never reports its end.
        s.go({ open: false });
        expect(s.phase()).toBe(CAMERA.TO_MAT);
        act(() => { vi.advanceTimersByTime(GLIDE_MS + 300); });
        expect(s.phase()).toBe(CAMERA.MAT);
    });
});

describe('the camera, worked out', () => {
    it('opens and closes by gliding, or at once under reduced motion, and turns back mid-glide', () => {
        expect(cameraAfter(CAMERA.MAT, true, false)).toBe(CAMERA.TO_SKY);
        expect(cameraAfter(CAMERA.MAT, true, true)).toBe(CAMERA.SKY);
        expect(cameraAfter(CAMERA.SKY, false, false)).toBe(CAMERA.TO_MAT);
        expect(cameraAfter(CAMERA.SKY, false, true)).toBe(CAMERA.MAT);
        expect(cameraAfter(CAMERA.TO_SKY, false, false)).toBe(CAMERA.TO_MAT);
        expect(cameraAfter(CAMERA.TO_MAT, true, false)).toBe(CAMERA.TO_SKY);
        expect(cameraAfter(CAMERA.TO_SKY, true, false)).toBe(CAMERA.TO_SKY);
        expect(cameraAfter(CAMERA.MAT, false, false)).toBe(CAMERA.MAT);
        // Reduced motion asked mid-glide lands where the glide was heading.
        expect(cameraAfter(CAMERA.TO_SKY, false, true)).toBe(CAMERA.MAT);
        expect(cameraAfter(CAMERA.TO_MAT, true, true)).toBe(CAMERA.SKY);
    });

    it('reads the vertical move out of a computed transform', () => {
        expect(translateYOf('none')).toBe(0);
        expect(translateYOf('')).toBe(0);
        expect(translateYOf('matrix(1, 0, 0, 1, 0, 412.5)')).toBe(412.5);
        expect(translateYOf('matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -20, 0, 1)')).toBe(-20);
    });
});

describe('the camera in the game\'s layout', () => {
    const count = (code, tag) => [...code.matchAll(new RegExp(`<${tag}\\b`, 'g'))].length;

    it('lays the Hall screen in the sky: the upgrade web (with the Effects on its Hall star) and the details panel', () => {
        const { code, hall } = hallCameraSides();
        for (const tag of ['GuildHallBoard', 'GuildHallDetails']) {
            expect(count(hall, tag), tag).toBe(1);
            expect(count(code, tag), tag).toBe(1);
        }
        expect(hall).toContain('data-hall-details');
        expect([...code.matchAll(/data-hall-details/g)]).toHaveLength(1);
        // The sky under the whole screen, laid by the camera only while it is off the mat.
        expect(count(code, 'HallSky')).toBe(1);
        expect(code).toContain('sky={<HallSky />}');
    });

    it('keeps the mat, its top bar, the hero dock, the work rules and the notifications on the table', () => {
        const { code, mat } = hallCameraSides();
        for (const tag of ['Board', 'MatTopBar', 'BottomHeroDock', 'WorkRulesDrawer', 'ItemStubColumn', 'BannerStack']) {
            expect(count(mat, tag), tag).toBe(1);
            expect(count(code, tag), tag).toBe(1);
        }
        // Drawn as on the mat while the camera glides away and back: nothing on the table side
        // follows the open view, or the mat would change size and be drawn again mid-glide.
        expect(mat).not.toMatch(/isGuildView|fullscreen\.view|isAtlasOpen/);
    });

    it('opens on the Guild view, and another view taking over lands it at once', () => {
        const { camera } = hallCameraSides();
        expect(camera).toContain('open={isGuildView}');
        expect(camera).toMatch(/away=\{!isGuildView && \(ui\.fullscreen\.view !== null \|\| isBankOpen \|\| ui\.shop\.isOpen \|\| ui\.settings\.isOpen\)\}/);
        expect(camera).toContain('tableAnchor={tableRef}');
    });

    it('clips the column rather than hiding it, so focus on a moved side scrolls nothing', () => {
        const { code } = hallCameraSides();
        const column = code.slice(code.lastIndexOf('<div', code.indexOf('<HallCamera')), code.indexOf('<HallCamera'));
        expect(column).toContain('overflow-clip');
        expect(column).not.toContain('overflow-hidden');
    });
});
