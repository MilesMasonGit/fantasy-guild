// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { UI_EVENTS } from '../systems/core/engineEvents.js';
import { artRadiusOf, matW, matH } from '../config/matGeometry.js';
import { CalloutLayer } from '../ui/components/board/CalloutLayer.jsx';
import { keepInMat, CALLOUT_RISE_PX } from '../ui/components/board/calloutPlace.js';
import { placeAt, clearMat } from './fixtures/mat.js';

/**
 * ⭐ **A popup over a Token on the mat's edge stays inside the mat.** The mat's box clips, and a
 * Token's circle may touch the edge: a reason said over a Token in the top row ("Needs Pickaxe",
 * a refused drop, the Guild Hall's) was drawn above the mat and never seen. It goes below the
 * Token when there is no room above, and is held inside the mat's sides.
 */

const h = React.createElement;
const MAT = { w: 1920, h: 1040 };

describe('keepInMat', () => {
    it('leaves a popup with room above it where it was', () => {
        expect(keepInMat({ x: 900, top: 400, w: 200, h: 30, belowTop: 520 }, MAT)).toEqual({ x: 900, top: 400, dx: 0, below: false });
    });

    it('with no room above, says it below the Token', () => {
        const at = keepInMat({ x: 900, top: 20, w: 200, h: 30, belowTop: 150 }, MAT);
        expect(at).toEqual({ x: 900, top: 180, dx: 0, below: true });
    });

    it('needs room for its drift up as well', () => {
        expect(keepInMat({ x: 900, top: 30 + CALLOUT_RISE_PX, w: 200, h: 30, belowTop: 150 }, MAT).below).toBe(false);
        expect(keepInMat({ x: 900, top: 29 + CALLOUT_RISE_PX, w: 200, h: 30, belowTop: 150 }, MAT).below).toBe(true);
    });

    it('with no room below either, holds it at the mat\'s top', () => {
        expect(keepInMat({ x: 900, top: 20, w: 200, h: 30, belowTop: 1030 }, MAT)).toMatchObject({ top: 30 + CALLOUT_RISE_PX, below: false });
        expect(keepInMat({ x: 900, top: 20, w: 200, h: 30 }, MAT)).toMatchObject({ top: 30 + CALLOUT_RISE_PX, below: false });
    });

    it('holds it inside the mat\'s sides, and says how far it moved', () => {
        expect(keepInMat({ x: 40, top: 400, w: 200, h: 30 }, MAT)).toMatchObject({ x: 100, dx: 60 });
        expect(keepInMat({ x: 1900, top: 400, w: 200, h: 30 }, MAT)).toMatchObject({ x: 1820, dx: -80 });
        expect(keepInMat({ x: 300, top: 400, w: 3000, h: 30 }, MAT)).toMatchObject({ x: 960 });
    });
});

/** The callout group's place, from its transform: its bottom edge's middle. */
function placeOf(container) {
    const group = container.querySelector('[data-callout]').parentElement;
    const m = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(group.style.transform);
    return { x: Number(m[1]), top: Number(m[2]), group };
}

describe('a callout over a Token on the mat\'s edge', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        GameState.initNew();
        clearMat();
    });
    afterEach(() => {
        cleanup();
        vi.useRealTimers();
    });

    const say = (instanceId, text) => act(() => {
        EventBus.publish(UI_EVENTS.UI_TOKEN_ALERT, { instanceId, severity: 'disallow', type: 'drop_rejected', title: text, message: text });
    });

    it('in the top row: said below the Token, tail and all inside the mat', () => {
        const r = artRadiusOf('fixture_producer');
        const t = placeAt('fixture_producer', 900, r);
        const { container } = render(h(CalloutLayer));
        say(t.id, 'Guild Hall cannot be removed from the playmat.');
        const { top, group } = placeOf(container);
        // Its bottom edge lies under the Token's foot, so its top edge is below the Token.
        expect(top).toBeGreaterThan(t.y + r);
        expect(group.querySelector('[data-speech-tail]')).toBeNull();
    });

    it('away from the edges: where it always was, tail on', () => {
        const t = placeAt('fixture_producer', 900, 500);
        const { container } = render(h(CalloutLayer));
        say(t.id, 'Needs Pickaxe');
        const { x, top, group } = placeOf(container);
        expect(x).toBe(900);
        expect(top).toBe(500 - artRadiusOf('fixture_producer') - 6);
        expect(group.querySelector('[data-speech-tail]')).not.toBeNull();
    });

    it('at the left or right edge: held inside the mat\'s side', () => {
        const r = artRadiusOf('fixture_producer');
        const left = placeAt('fixture_producer', r, 500);
        const right = placeAt('fixture_producer', matW() - r, 800);
        const { container } = render(h(CalloutLayer));
        const long = 'A long reason that is wider than the Token it is said over';
        say(left.id, long);
        say(right.id, long);
        const groups = [...container.querySelectorAll('[data-callout]')].map(b => b.parentElement);
        const xs = groups.map(g => Number(/translate\(([-\d.]+)px/.exec(g.style.transform)[1]));
        expect(xs[0]).toBeGreaterThan(left.x);
        expect(xs[1]).toBeLessThan(right.x);
        expect(xs[1]).toBeLessThan(matW());
        expect(matH()).toBeGreaterThan(0);
    });
});
