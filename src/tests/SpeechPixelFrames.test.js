// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import { render, cleanup, act } from '@testing-library/react';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { UI_EVENTS } from '../systems/core/engineEvents.js';
import { HeroBubbleLayer } from '../ui/components/board/HeroBubbleLayer.jsx';
import { CalloutLayer } from '../ui/components/board/CalloutLayer.jsx';
import { ScreenCalloutLayer } from '../ui/components/notifications/ScreenCalloutLayer.jsx';
import { SPEECH_TONE, momentTone } from '../ui/components/board/speechTone.js';
import { placeAt, clearMat } from './fixtures/mat.js';

/**
 * The speech family in pixel frames (UI_STYLE "Pixel frames", "Colours"): hero speech, the hero
 * bar's level-up alerts, the mat callouts and the off-mat refusal callout wear the chamfer frame
 * with its hard shadow and a stepped pixel tail, never the soft look they had.
 */

const h = React.createElement;

/** A class that would bring back the soft look: rounded corners, a blurred shadow, a glow, a turned square tail. */
const SOFT_CLASS = /^(rounded(-.+)?|shadow(-(sm|md|lg|xl|2xl|inner|\[.*\]))?|drop-shadow.*|blur.*|backdrop-blur.*|.*glow.*|rotate-45)$/;

/** Every soft class, filter or box shadow in a subtree. */
function softness(root) {
    const found = [];
    for (const el of [root, ...root.querySelectorAll('*')]) {
        const cls = typeof el.className === 'string' ? el.className : el.getAttribute('class') || '';
        for (const c of cls.split(/\s+/)) if (c && SOFT_CLASS.test(c)) found.push(c);
        if (el.style?.filter) found.push(`filter:${el.style.filter}`);
        if (el.style?.boxShadow) found.push(`box-shadow:${el.style.boxShadow}`);
    }
    return found;
}

/** The pixel frame's parts in one bubble. */
const framed = (el) => ({
    frame: !!el.querySelector(':scope > .ui-frame-chamfer'),
    shadow: !!el.querySelector(':scope > .ui-frame-shadow-chamfer'),
    tail: !!el.querySelector(':scope > [data-speech-tail]')
});

beforeEach(() => {
    vi.useFakeTimers();
    GameState.initNew();
    clearMat();
});
afterEach(() => {
    cleanup();
    vi.useRealTimers();
});

describe('the speech family wears the pixel frame', () => {
    it('a hero speaks in a chamfer frame with a pixel tail: gold going idle, bronze for news', () => {
        const heroes = [
            { heroId: 'h1', state: 'working', x: 300, y: 500, moving: false, tokenId: null, alert: null },
            { heroId: 'h2', state: 'working', x: 700, y: 500, moving: false, tokenId: null, alert: null }
        ];
        const view = render(h(HeroBubbleLayer, { heroes }));
        act(() => { vi.advanceTimersByTime(10); });
        act(() => {
            EventBus.publish(BOARD_EVENTS.TOKEN_DEPLETED, { instanceId: 'o', x: 1, y: 1, typeId: 'fixture_producer', exhaustedBy: 'h1' });
        });
        // The layer re-reads on a changed clock; frozen fake time would never change it.
        act(() => { vi.advanceTimersByTime(10); });
        view.rerender(h(HeroBubbleLayer, { heroes: heroes.map(x => (x.heroId === 'h1' ? { ...x, state: 'idle' } : x)) }));
        const bubbles = [...view.container.querySelectorAll('[data-hero-bubble]')];
        expect(bubbles.map(b => [b.getAttribute('data-hero-bubble'), b.getAttribute('data-speech-tone')])).toEqual([
            ['depleted:fixture_producer', SPEECH_TONE.PLAIN],
            ['idle', SPEECH_TONE.ATTENTION]
        ]);
        for (const b of bubbles) expect(framed(b)).toMatchObject({ frame: true, shadow: true });
        // The tail only on the bubble nearest the head.
        expect(bubbles.map(b => framed(b).tail)).toEqual([false, true]);
        expect(softness(view.container)).toEqual([]);
    });

    it('a mat callout is the same frame and tail, red for a refusal', () => {
        const forge = placeAt('fixture_producer', 600, 500);
        const view = render(h(CalloutLayer));
        act(() => {
            EventBus.publish(BOARD_EVENTS.EFFECT_FIRED, { instanceId: forge.id, title: 'Bountiful' });
            EventBus.publish(UI_EVENTS.UI_TOKEN_ALERT, { x: 200, y: 200, severity: 'disallow', type: 'drop_rejected', title: 'Too close to another Token' });
        });
        const bubbles = [...view.container.querySelectorAll('[data-callout]')];
        expect(bubbles.map(b => [b.getAttribute('data-callout'), b.getAttribute('data-speech-tone')])).toEqual([
            ['Bountiful', SPEECH_TONE.PLAIN],
            ['Too close to another Token', SPEECH_TONE.CANT]
        ]);
        for (const b of bubbles) {
            expect(framed(b)).toEqual({ frame: true, shadow: true, tail: true });
            expect(b.className).toContain('callout-bubble');
        }
        expect(view.container.querySelector('[data-speech-tone="cant"] > .ui-frame-chamfer').className).toContain('ui-frame-chamfer-red');
        expect(softness(view.container)).toEqual([]);
    });

    it('the off-mat refusal callout is a red chamfer frame', () => {
        render(h(ScreenCalloutLayer));
        act(() => { EventBus.publish(UI_EVENTS.UI_SCREEN_CALLOUT, { text: 'Requires Melee 10', x: 100, y: 100 }); });
        const bubble = document.body.querySelector('[data-screen-callouts] [data-callout]');
        expect(bubble.getAttribute('data-speech-tone')).toBe(SPEECH_TONE.CANT);
        expect(framed(bubble)).toMatchObject({ frame: true, shadow: true });
        expect(bubble.className).toContain('ui-text-title');
        expect(softness(document.body.querySelector('[data-screen-callouts]'))).toEqual([]);
    });

    it('the hero bar\'s level-up alerts are gold chamfer frames, with no soft look', () => {
        const src = readFileSync('src/ui/components/dock/DockHeroFigure.jsx', 'utf8');
        const bar = src.slice(src.indexOf('const BarBubbles'));
        expect(bar).toContain('<SpeechFrame');
        expect(bar).toContain('tone={SPEECH_TONE.ATTENTION}');
        const classes = [...bar.matchAll(/className=(?:"([^"]*)"|\{cn\(([\s\S]*?)\)\})/g)]
            .flatMap(m => (m[1] || m[2]).match(/[\w:/.[\]-]+/g) || []);
        expect(classes.filter(c => SOFT_CLASS.test(c))).toEqual([]);
        // A text shadow's third length is its blur.
        expect(bar).not.toMatch(/textShadow: '\S+ \S+ [1-9]\d*px/);
    });

    it('the callouts\' pop only moves: a scaled pixel frame draws odd-sized art pixels', () => {
        const css = readFileSync('src/styles/components.css', 'utf8');
        const pop = css.slice(css.indexOf('@keyframes callout-pop'), css.indexOf('/* The Token Summary'));
        expect(pop).toContain('translateY');
        expect(pop).not.toMatch(/scale/);
    });

    it('a moment\'s tone: idle asks to be looked at, the rest are plain news', () => {
        expect(momentTone('idle')).toBe(SPEECH_TONE.ATTENTION);
        expect(momentTone('depleted:token_oak')).toBe(SPEECH_TONE.PLAIN);
        expect(momentTone('arrived')).toBe(SPEECH_TONE.PLAIN);
    });
});
