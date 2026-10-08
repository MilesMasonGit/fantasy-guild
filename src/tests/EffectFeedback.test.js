// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { announce } from '../systems/board/EffectFeedback.js';
import { CalloutLayer } from '../ui/components/board/CalloutLayer.jsx';
import { CALLOUT_MS, MAX_PER_ANCHOR } from '../ui/components/board/callouts.js';
import './fixtures/testTokens.js';
import { placeAt } from './fixtures/mat.js';
import { GameState } from '../state/GameState.js';
import { expandBearer } from '../systems/effects/effectLibrary.js';
import { statementsOf, makeStatement, KEYWORD } from '../systems/effects/statements.js';

/**
 * Announcing a named effect — Unified Effects P3.
 *
 * The phase is one sentence of behaviour: **when a named effect does something,
 * its title floats off the tile and fades.** These tests hold the two halves
 * that make it worth having — that the name shown is the *right* one, scale
 * numeral included, and that the announcement is restrained enough to stay
 * meaningful.
 */

describe('the announcement channel', () => {
    let heard;
    let unsubscribe;

    beforeEach(() => {
        heard = [];
        unsubscribe = EventBus.subscribe(BOARD_EVENTS.EFFECT_FIRED, (p) => heard.push(p));
    });

    afterEach(() => {
        if (typeof unsubscribe === 'function') unsubscribe();
    });

    it('publishes the Token (by instance id) and the title', () => {
        announce('tok_7', { effectTitle: 'Shrimp Trawler' });
        expect(heard).toEqual([{ instanceId: 'tok_7', title: 'Shrimp Trawler' }]);
    });

    it('says the SCALED title, because a bearer’s version is what fired', () => {
        const library = {
            effect_trawler: {
                id: 'effect_trawler',
                name: 'Shrimp Trawler',
                statements: [{ ...makeStatement(KEYWORD.GRANTS), payload: { type: 'BONUS_DROP', itemId: 'item_shrimp', quantity: 1, chance: 100 } }],
            },
        };
        const def = expandBearer({ effects: [{ effectId: 'effect_trawler', scale: 3 }] }, library);

        announce('tok_2', statementsOf(def)[0]);
        expect(heard[0].title).toBe('Shrimp Trawler III');
    });

    it('stays silent for a statement with no library entry behind it', () => {
        // A fixture authoring statements inline has no name to say, and a
        // nameless pop would be worse than none.
        announce('tok_3', makeStatement(KEYWORD.PROVIDES));
        announce('tok_3', null);
        expect(heard).toEqual([]);
    });

    it('stays silent when there is no Token to say it on', () => {
        announce(null, { effectTitle: 'Shrimp Trawler' });
        expect(heard).toEqual([]);
    });
});

describe('the popup', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        cleanup();
        vi.useRealTimers();
    });

    // The callout belongs to one Token, named by instance id (slice 1.6c-2): the mat has no
    // tiles to sit on.
    const fire = (instanceId, title) => act(() => {
        EventBus.publish(BOARD_EVENTS.EFFECT_FIRED, { instanceId, title });
    });

    let a;
    beforeEach(() => {
        GameState.initNew();
        a = placeAt('fixture_producer', 600, 500);
    });

    it('renders nothing at all until something fires', () => {
        const { container } = render(React.createElement(CalloutLayer));
        expect(container.innerHTML).toBe('');
    });

    it('shows the title as a callout over its Token when an effect fires', () => {
        const { container } = render(React.createElement(CalloutLayer));
        fire(a.id, 'Shrimp Trawler II');
        expect(container.querySelector('[data-callout]').textContent).toBe('Shrimp Trawler II');
    });

    it('ignores an effect firing on a Token that is not on the mat', () => {
        const { container } = render(React.createElement(CalloutLayer));
        fire('tok_gone', 'Somewhere Else');
        expect(container.textContent).toBe('');
    });

    it('fades away on its own, leaving nothing behind', () => {
        const { container } = render(React.createElement(CalloutLayer));
        fire(a.id, 'Shrimp Trawler');
        expect(container.textContent).toContain('Shrimp Trawler');
        act(() => { vi.advanceTimersByTime(CALLOUT_MS + 100); });
        expect(container.innerHTML).toBe('');
    });

    it('stacks two effects firing together as two lines, not one flicker', () => {
        const { container } = render(React.createElement(CalloutLayer));
        fire(a.id, 'Shrimp Trawler');
        fire(a.id, 'Pickaxe');
        expect(container.querySelectorAll('[data-callout]')).toHaveLength(2);
    });

    it('caps how many crowd one Token', () => {
        const { container } = render(React.createElement(CalloutLayer));
        for (let i = 1; i <= 8; i++) fire(a.id, `Effect ${i}`);
        expect(container.querySelectorAll('[data-callout]')).toHaveLength(MAX_PER_ANCHOR);
        // The oldest go: they are the ones already fading.
        expect(container.textContent).not.toContain('Effect 1');
        expect(container.textContent).toContain('Effect 8');
    });

    it('has nothing to click: it is news, not a task', () => {
        const { container } = render(React.createElement(CalloutLayer));
        fire(a.id, 'Shrimp Trawler');
        expect(container.querySelectorAll('button, a, input, [role], [tabindex]')).toHaveLength(0);
        expect(container.firstChild.className).toContain('pointer-events-none');
    });

    it('unsubscribes on unmount, so a fading callout cannot outlive the layer', () => {
        const { container, unmount } = render(React.createElement(CalloutLayer));
        fire(a.id, 'Shrimp Trawler');
        expect(container.textContent).toContain('Shrimp Trawler');
        unmount();
        expect(() => act(() => { vi.advanceTimersByTime(CALLOUT_MS + 100); })).not.toThrow();
    });
});
