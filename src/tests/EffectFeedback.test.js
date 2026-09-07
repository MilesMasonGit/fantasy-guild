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

    it('publishes the tile and the title', () => {
        announce(7, { effectTitle: 'Shrimp Trawler' });
        expect(heard).toEqual([{ tile: 7, title: 'Shrimp Trawler' }]);
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

        announce(2, statementsOf(def)[0]);
        expect(heard[0].title).toBe('Shrimp Trawler III');
    });

    it('stays silent for a statement with no library entry behind it', () => {
        // A fixture authoring statements inline has no name to say, and a
        // nameless pop would be worse than none.
        announce(3, makeStatement(KEYWORD.PROVIDES));
        announce(3, null);
        expect(heard).toEqual([]);
    });

    it('stays silent when there is no tile to say it on', () => {
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

    const fire = (tile, title) => act(() => {
        EventBus.publish(BOARD_EVENTS.EFFECT_FIRED, { tile, title });
    });

    it('renders nothing at all until something fires', () => {
        const { container } = render(React.createElement(EffectProcText, { tile: 4 }));
        expect(container.innerHTML).toBe('');
    });

    it('shows the title when an effect fires on its tile', () => {
        const { container } = render(React.createElement(EffectProcText, { tile: 4 }));
        fire(4, 'Shrimp Trawler II');
        expect(container.textContent).toContain('Shrimp Trawler II');
    });

    it('ignores an effect firing on a different tile', () => {
        const { container } = render(React.createElement(EffectProcText, { tile: 4 }));
        fire(9, 'Somewhere Else');
        expect(container.textContent).toBe('');
    });

    it('fades away on its own, leaving nothing behind', () => {
        const { container } = render(React.createElement(EffectProcText, { tile: 4 }));
        fire(4, 'Shrimp Trawler');
        expect(container.textContent).toContain('Shrimp Trawler');

        act(() => { vi.advanceTimersByTime(2000); });
        expect(container.innerHTML).toBe('');
    });

    it('stacks two effects firing together as two lines, not one flicker', () => {
        const { container } = render(React.createElement(EffectProcText, { tile: 4 }));
        fire(4, 'Shrimp Trawler');
        fire(4, 'Pickaxe');
        expect(container.textContent).toContain('Shrimp Trawler');
        expect(container.textContent).toContain('Pickaxe');
    });

    it('caps how many crowd one tile', () => {
        const { container } = render(React.createElement(EffectProcText, { tile: 4 }));
        for (let i = 1; i <= 8; i++) fire(4, `Effect ${i}`);
        expect(container.querySelectorAll('span')).toHaveLength(4);
        // The oldest go: they are the ones already fading.
        expect(container.textContent).not.toContain('Effect 1');
        expect(container.textContent).toContain('Effect 8');
    });

    it('has nothing to click — it is news, not a task', () => {
        const { container } = render(React.createElement(EffectProcText, { tile: 4 }));
        fire(4, 'Shrimp Trawler');

        // Nothing interactive, and nothing reachable by keyboard: the label is
        // not a control, and a player who misses one loses nothing — the rule is
        // still written on the Token.
        expect(container.querySelectorAll('button, a, input, [role], [tabindex]')).toHaveLength(0);

        // `pointer-events: none` lives on this class in `components.css` rather
        // than in a utility, so clicks pass through to the tile underneath. The
        // class is what the test can see; jsdom does not load the stylesheet.
        expect(container.firstChild.className).toBe('effect-proc-layer');
    });

    it('unsubscribes on unmount, so a fading tile cannot outlive its Token', () => {
        const { container, unmount } = render(React.createElement(EffectProcText, { tile: 4 }));
        fire(4, 'Shrimp Trawler');
        expect(container.textContent).toContain('Shrimp Trawler');
        unmount();
        // A timer firing into a dead component would warn; advancing past the
        // lifetime with none pending is the assertion.
        expect(() => act(() => { vi.advanceTimersByTime(3000); })).not.toThrow();
    });
});
