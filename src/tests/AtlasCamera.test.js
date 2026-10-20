// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, fireEvent, act, cleanup } from '@testing-library/react';
import {
    AtlasCamera, CAMERA, GLIDE_MS, cameraAfter, translateYOf, tableTileY
} from '../ui/components/atlas/AtlasCamera.jsx';

/**
 * The camera move between the playmat and the Atlas book, which lie on one wood table: opening
 * glides up from the mat to the book, closing glides back down, the mat and the whole table moving
 * together. A click or a key finishes it, reduced motion swaps at once, and nothing of it is
 * mounted, styled or listening while the camera rests on the mat.
 */

const COLUMN_H = 800;
const h = React.createElement;
const q = (c, sel) => c.querySelector(sel);

let anims;
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

beforeEach(() => {
    anims = [];
    reduced = false;
    computedY = null;
    HTMLElement.prototype.animate = fakeAnimate;
    window.matchMedia = vi.fn(() => ({ matches: reduced, addEventListener() {}, removeEventListener() {} }));
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(() => COLUMN_H);
    const real = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el) => {
        const style = real(el);
        if (computedY == null || !el.hasAttribute('data-atlas-camera')) return style;
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
});

/** Children that count their own renders: the mat and the book stand-ins. */
const renders = { mat: 0, book: 0 };
const Mat = () => { renders.mat++; return h('div', { 'data-test-mat': '' }); };
const Book = () => { renders.book++; return h('div', { 'data-test-book': '' }); };
const WOOD = { backgroundColor: 'rgb(1, 2, 3)', backgroundSize: '512px' };

function setup({ open = false, away = false, held = [] } = {}) {
    renders.mat = 0;
    renders.book = 0;
    // One element each, kept across rerenders, as ReactRoot's are between its own renders.
    const mat = h(Mat);
    const book = h(Book);
    const tableAnchor = { current: anchor };
    const arrival = (isHeld) => { held.push(isHeld); return null; };
    const element = (props) => h(AtlasCamera, { open, away, book, arrival, table: WOOD, tableAnchor, ...props }, mat);
    const view = render(element({}));
    return {
        ...view,
        held,
        camera: () => q(view.container, '[data-atlas-camera]'),
        phase: () => q(view.container, '[data-atlas-camera]').getAttribute('data-atlas-camera'),
        table: () => q(anchor, '[data-atlas-table]'),
        set: (props) => view.rerender(element(props))
    };
}

/** The camera's animation of the latest glide (its finish ends the glide), and the table's. */
const camAnim = () => anims.filter(a => a.el.hasAttribute('data-atlas-camera')).at(-1);
const tableAnim = () => anims.filter(a => a.el.hasAttribute('data-atlas-table')).at(-1);
/** Back on the mat: no transform and no layer hint left behind. */
const unmoved = (el) => el.style.transform === '' && el.style.willChange === '';
const fromTo = (anim) => anim.keyframes.map(k => k.transform);

describe('the camera between the mat and the book', () => {
    it('rests on the mat with nothing extra mounted, styled or listening', () => {
        const added = vi.spyOn(window, 'addEventListener');
        const { container, camera, table } = setup();
        expect(camera().getAttribute('style')).toBeNull();
        expect(table()).toBeNull();
        expect(q(container, '[data-atlas-stage]')).toBeNull();
        expect(q(container, '[data-atlas-skip]')).toBeNull();
        expect(q(container, '[data-test-book]')).toBeNull();
        expect(q(container, '[data-test-mat]')).toBeTruthy();
        expect(anims).toHaveLength(0);
        expect(added.mock.calls.filter(([type]) => type === 'keydown')).toHaveLength(0);
    });

    it('opening glides the mat and the whole table up together to the book lying above the mat', () => {
        const { container, camera, phase, table, set } = setup();
        set({ open: true });
        expect(phase()).toBe(CAMERA.TO_BOOK);
        const stage = q(container, '[data-atlas-stage]');
        expect(q(stage, '[data-test-book]')).toBeTruthy();
        expect([stage.style.top, stage.style.height]).toEqual(['-100%', '100%']);
        // The table is laid in the element the wood around the mat is drawn on, under the nav too,
        // in a clipped box: moved down, it must not make that element scrollable.
        const clip = table().parentElement;
        expect(clip.parentElement).toBe(anchor);
        expect(clip.className).toContain('overflow-clip');
        expect(clip.className).toContain('inset-0');
        expect([table().style.top, table().style.height, table().style.backgroundColor]).toEqual(['-100%', '200%', 'rgb(1, 2, 3)']);

        expect(anims).toHaveLength(2);
        expect(camAnim().el).toBe(camera());
        expect(tableAnim().el).toBe(table());
        for (const anim of [camAnim(), tableAnim()]) {
            expect(fromTo(anim)).toEqual(['translateY(0px)', `translateY(${COLUMN_H}px)`]);
            expect(anim.options.duration).toBe(GLIDE_MS);
        }
        expect(GLIDE_MS).toBeLessThan(1000);
        expect(q(container, '[data-atlas-skip]')).toBeTruthy();

        act(() => camAnim().finish());
        expect(phase()).toBe(CAMERA.BOOK);
        expect(camera().style.transform).toBe('translateY(100%)');
        expect(table().style.transform).toBe('translateY(50%)');
        expect(anims.every(a => a.cancelled)).toBe(true);
        expect(q(container, '[data-atlas-skip]')).toBeNull();
    });

    it('closing glides back down, and the book stays until the camera is on the mat', () => {
        const { container, camera, phase, table, set } = setup();
        set({ open: true });
        act(() => camAnim().finish());
        set({ open: false });
        expect(phase()).toBe(CAMERA.TO_MAT);
        expect(fromTo(camAnim())).toEqual([`translateY(${COLUMN_H}px)`, 'translateY(0px)']);
        expect(fromTo(tableAnim())).toEqual(fromTo(camAnim()));
        expect(q(container, '[data-test-book]')).toBeTruthy();

        act(() => camAnim().finish());
        expect(phase()).toBe(CAMERA.MAT);
        expect(unmoved(camera())).toBe(true);
        expect(q(container, '[data-test-book]')).toBeNull();
        expect(table()).toBeNull();
        expect(anims.every(a => a.cancelled)).toBe(true);
    });

    it('never redraws what is on the mat, nor the book while it glides', () => {
        const { set } = setup();
        expect([renders.mat, renders.book]).toEqual([1, 0]);
        set({ open: true });
        act(() => camAnim().finish());
        set({ open: false });
        act(() => camAnim().finish());
        expect(renders.mat).toBe(1);
        expect(renders.book).toBe(1);
    });

    it('a click or a key finishes the glide at once', () => {
        const { container, phase, set } = setup();
        set({ open: true });
        fireEvent.pointerDown(q(container, '[data-atlas-skip]'));
        expect(phase()).toBe(CAMERA.BOOK);

        set({ open: false });
        fireEvent.keyDown(document, { key: 'a' });
        expect(phase()).toBe(CAMERA.MAT);
        expect(q(container, '[data-test-book]')).toBeNull();
    });

    it('Escape on the way up is left to the screen, which closes it', () => {
        const { phase, set } = setup();
        set({ open: true });
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(phase()).toBe(CAMERA.TO_BOOK);
        set({ open: false });
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(phase()).toBe(CAMERA.MAT);
    });

    it('turning back mid-glide glides from where the camera is, in the time left', () => {
        const { phase, set } = setup();
        set({ open: true });
        const up = [camAnim(), tableAnim()];
        computedY = 300;
        set({ open: false });
        expect(up.every(a => a.cancelled)).toBe(true);
        expect(phase()).toBe(CAMERA.TO_MAT);
        for (const anim of [camAnim(), tableAnim()]) {
            expect(fromTo(anim)).toEqual(['translateY(300px)', 'translateY(0px)']);
            expect(anim.options.duration).toBe(Math.round(GLIDE_MS * 300 / COLUMN_H));
        }
        // The cancelled glide reporting late changes nothing.
        act(() => up[0].onfinish?.());
        expect(phase()).toBe(CAMERA.TO_MAT);
    });

    it('under reduced motion it is a plain swap', () => {
        reduced = true;
        const { container, camera, phase, table, set } = setup();
        set({ open: true });
        expect(phase()).toBe(CAMERA.BOOK);
        expect(camera().style.transform).toBe('translateY(100%)');
        expect(table().style.transform).toBe('translateY(50%)');
        expect(q(container, '[data-test-book]')).toBeTruthy();
        set({ open: false });
        expect(unmoved(camera())).toBe(true);
        expect(q(container, '[data-test-book]')).toBeNull();
        expect(table()).toBeNull();
        expect(anims).toHaveLength(0);
    });

    it('another full-screen view opening ends the glide at once', () => {
        const { phase, set } = setup();
        set({ open: true });
        act(() => camAnim().finish());
        set({ open: false });
        set({ open: false, away: true });
        expect(phase()).toBe(CAMERA.MAT);
    });

    it('a glide that never reports its end (a hidden window draws no frames) still ends', () => {
        vi.useFakeTimers();
        const { phase, set } = setup();
        set({ open: true });
        act(() => { vi.advanceTimersByTime(GLIDE_MS + 300); });
        expect(phase()).toBe(CAMERA.BOOK);
    });

    it('holds the arrival card until the camera is back on the mat', () => {
        const { held, set } = setup();
        held.length = 0;
        set({ open: true });
        expect(held.at(-1)).toBe(true);
        act(() => camAnim().finish());
        set({ open: false });
        expect(held.at(-1)).toBe(true);
        act(() => camAnim().finish());
        expect(held.at(-1)).toBe(false);
    });
});

describe('the camera, worked out', () => {
    it('opens and closes by gliding, or at once under reduced motion, and turns back mid-glide', () => {
        expect(cameraAfter(CAMERA.MAT, true, false)).toBe(CAMERA.TO_BOOK);
        expect(cameraAfter(CAMERA.MAT, true, true)).toBe(CAMERA.BOOK);
        expect(cameraAfter(CAMERA.BOOK, false, false)).toBe(CAMERA.TO_MAT);
        expect(cameraAfter(CAMERA.BOOK, false, true)).toBe(CAMERA.MAT);
        expect(cameraAfter(CAMERA.TO_BOOK, false, false)).toBe(CAMERA.TO_MAT);
        expect(cameraAfter(CAMERA.TO_MAT, true, false)).toBe(CAMERA.TO_BOOK);
        expect(cameraAfter(CAMERA.TO_BOOK, true, false)).toBe(CAMERA.TO_BOOK);
        expect(cameraAfter(CAMERA.MAT, false, false)).toBe(CAMERA.MAT);
    });

    it('reads the vertical move out of a computed transform', () => {
        expect(translateYOf('none')).toBe(0);
        expect(translateYOf('')).toBe(0);
        expect(translateYOf('matrix(1, 0, 0, 1, 0, 412.5)')).toBe(412.5);
        expect(translateYOf('matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -20, 0, 1)')).toBe(-20);
    });

    // jsdom drops a calc() background position, so the layer's own style is checked in the game.
    it('puts a tile edge at the table top whatever its height: the layer is two tables tall, one above', () => {
        // background-position-y p% of a layer of height L with tiles S sits at (L - S) * p.
        const edge = (tableH, tile) => (2 * tableH - tile) * 0.5 + tile / 2;
        for (const tableH of [600, 777, 1000]) expect(edge(tableH, 512)).toBe(tableH);
        expect(tableTileY('512px')).toBe('calc(50% + 256px)');
        expect(tableTileY(undefined)).toBe('0px');
    });
});
