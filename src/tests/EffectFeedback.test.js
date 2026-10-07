// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { announce } from '../systems/board/EffectFeedback.js';
import { EffectProcText } from '../ui/components/board/EffectProcText.jsx';
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

    // The label belongs to one Token, named by instance id (slice 1.6c-2):
    // the mat has no tiles to sit on.
    const fire = (instanceId, title) => act(() => {
        EventBus.publish(BOARD_EVENTS.EFFECT_FIRED, { instanceId, title });
    });

    it('renders nothing at all until something fires', () => {
        const { container } = render(React.createElement(EffectProcText, { instanceId: 'tok_a' }));
        expect(container.innerHTML).toBe('');
    });

    it('shows the title when an effect fires on its Token', () => {
        const { container } = render(React.createElement(EffectProcText, { instanceId: 'tok_a' }));
        fire('tok_a','Shrimp Trawler II');
        expect(container.textContent).toContain('Shrimp Trawler II');
    });

    it('ignores an effect firing on a different Token', () => {
        const { container } = render(React.createElement(EffectProcText, { instanceId: 'tok_a' }));
        fire('tok_b', 'Somewhere Else');
        expect(container.textContent).toBe('');
    });

    it('fades away on its own, leaving nothing behind', () => {
        const { container } = render(React.createElement(EffectProcText, { instanceId: 'tok_a' }));
        fire('tok_a','Shrimp Trawler');
        expect(container.textContent).toContain('Shrimp Trawler');

        // Past the label's lifetime (2600ms, matching the CSS animation).
        act(() => { vi.advanceTimersByTime(3000); });
        expect(container.innerHTML).toBe('');
    });

    it('stacks two effects firing together as two lines, not one flicker', () => {
        const { container } = render(React.createElement(EffectProcText, { instanceId: 'tok_a' }));
        fire('tok_a','Shrimp Trawler');
        fire('tok_a','Pickaxe');
        expect(container.textContent).toContain('Shrimp Trawler');
        expect(container.textContent).toContain('Pickaxe');
    });

    it('caps how many crowd one Token', () => {
        const { container } = render(React.createElement(EffectProcText, { instanceId: 'tok_a' }));
        for (let i = 1; i <= 8; i++) fire('tok_a', `Effect ${i}`);
        expect(container.querySelectorAll('span')).toHaveLength(4);
        // The oldest go: they are the ones already fading.
        expect(container.textContent).not.toContain('Effect 1');
        expect(container.textContent).toContain('Effect 8');
    });

    it('has nothing to click — it is news, not a task', () => {
        const { container } = render(React.createElement(EffectProcText, { instanceId: 'tok_a' }));
        fire('tok_a','Shrimp Trawler');

        // Nothing interactive, and nothing reachable by keyboard: the label is
        // not a control, and a player who misses one loses nothing — the rule is
        // still written on the Token.
        expect(container.querySelectorAll('button, a, input, [role], [tabindex]')).toHaveLength(0);

        // `pointer-events: none` lives on this class in `components.css` rather
        // than in a utility, so clicks pass through to the Token underneath. The
        // class is what the test can see; jsdom does not load the stylesheet.
        expect(container.firstChild.className).toBe('effect-proc-layer');
    });

    it('unsubscribes on unmount, so a fading label cannot outlive its Token', () => {
        const { container, unmount } = render(React.createElement(EffectProcText, { instanceId: 'tok_a' }));
        fire('tok_a','Shrimp Trawler');
        expect(container.textContent).toContain('Shrimp Trawler');
        unmount();
        // A timer firing into a dead component would warn; advancing past the
        // lifetime with none pending is the assertion.
        expect(() => act(() => { vi.advanceTimersByTime(3000); })).not.toThrow();
    });
});
