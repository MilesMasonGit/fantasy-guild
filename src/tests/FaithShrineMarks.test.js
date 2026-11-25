// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { litLine, timerLines, TIMER_KIND } from '../ui/components/board/tokenTimers.js';
import { cardLifecycle, liveCardSources } from '../ui/components/board/tokenCard.js';
import { getTokenType } from '../config/registries/tokenRegistry.js';
import { createLitBar } from '../ui/components/board/litBar.js';
import { shrineBarOf, isShrineType, BAR } from '../ui/components/board/matMarks.js';
import { WorkBarLayer } from '../ui/components/board/WorkBarLayer.jsx';
import { clearMat, placeAt } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * A shrine's timer on the mat and its card (brief 810 K3; no plates, brief 830 §15): the card says
 * how long it stays lit, or that it is out; on the mat its strip is a gold bar draining with its lit
 * time and the time left beside it, in the work bar's place, worked or not, and nothing while it is
 * out and untended.
 */

const SHRINE = 'fsm_shrine';
registerTokenTypes({
    [SHRINE]: {
        id: SHRINE, name: 'Marks Shrine', tokenType: 'station', rarity: 'common', theme: 'fixture', uses: null,
        sprite: 't_shrine_forest', requiresHero: true, shrine: { maxLitMs: 60_000 },
        config: { skill: 'faith', skillRequired: 1, cycleTimeMs: 2000, xp: 0, inputs: [], outputs: [] },
        statements: [{ id: 'stm_fsm_works', keyword: KEYWORD.STATION, payload: { skill: 'faith', stationKind: 'shrine' } }]
    }
});

beforeAll(() => resetMatTuning());
beforeEach(() => {
    GameState.initNew();
    clearMat();
});
afterEach(() => cleanup());

describe('the card says how long a shrine stays lit', () => {
    it('lit: the time left, and that offerings keep it lit up to its most', () => {
        const line = litLine({ lit: true, litMs: 75_000, maxLitMs: 600_000, full: false });
        expect(line).toMatchObject({ kind: TIMER_KIND.LIT, label: 'Lit', text: '1m 15s' });
        expect(line.tip).toMatch(/^Lit: its blessing holds 1m.15s more; each offering a Faith hero makes keeps it lit longer, at most 10m$/);
    });

    it('full: its hero waits until it has burned down', () => {
        expect(litLine({ lit: true, litMs: 590_000, maxLitMs: 600_000, full: true }).tip).toMatch(/full: its hero offers again once it has burned down/);
    });

    it('out: its blessing is off until an offering lights it', () => {
        expect(litLine({ lit: false, litMs: 0, maxLitMs: 600_000, full: false })).toMatchObject({ label: 'Out', text: '–', tone: 'warning' });
    });

    it('is on the Token card of a shrine, among its lifecycle lines', () => {
        const shrine = placeAt(SHRINE, 400, 400);
        shrine.shrine = { litMs: 30_000 };
        const lines = cardLifecycle(shrine, getTokenType(SHRINE), liveCardSources());
        expect(lines).toContainEqual(expect.objectContaining({ kind: TIMER_KIND.LIT, label: 'Lit', text: '30s' }));
        shrine.shrine = { litMs: 0 };
        expect(cardLifecycle(shrine, getTokenType(SHRINE), liveCardSources()))
            .toContainEqual(expect.objectContaining({ kind: TIMER_KIND.LIT, label: 'Out' }));
    });

    it('is one of the card\'s timer lines for a shrine, and only a shrine', () => {
        const shrine = placeAt(SHRINE, 400, 400);
        shrine.shrine = { litMs: 30_000 };
        expect(timerLines(shrine).map(l => l.kind)).toEqual([TIMER_KIND.LIT]);
        const other = placeAt('fixture_producer', 800, 400);
        expect(timerLines(other).map(l => l.kind)).not.toContain(TIMER_KIND.LIT);
    });
});

describe('the lit bar runs down between the engine\'s words', () => {
    it('fills by what is left of its most and says the time left, draining as the clock runs', () => {
        let clock = 0;
        const model = createLitBar(() => clock);
        const bar = document.createElement('div');
        const text = document.createElement('span');
        model.attach(bar, text, BAR.W);
        model.set({ litMs: 30_000, maxLitMs: 60_000 });
        expect(Number(bar.getAttribute('data-work-bar-fill'))).toBe(BAR.W / 2);
        expect(text.textContent).toBe('30s');
        clock = 10_000;
        model.attach(bar, text, BAR.W);
        expect(Number(bar.getAttribute('data-work-bar-fill'))).toBe(Math.floor(BAR.W / 3));
        expect(text.textContent).toBe('20s');
        clock = 40_000;
        model.attach(bar, text, BAR.W);
        expect(Number(bar.getAttribute('data-work-bar-fill'))).toBe(0);
        expect(text.textContent).toBe('');
        model.dispose();
    });
});

describe('the shrine\'s strip on the mat', () => {
    it('is a shrine\'s, worked or not; nothing while it is out and untended', () => {
        const shrine = placeAt(SHRINE, 400, 400);
        expect(isShrineType(SHRINE)).toBe(true);
        expect(isShrineType('fixture_producer')).toBe(false);
        expect(shrineBarOf(shrine.id)).toBeNull();
        shrine.shrine = { litMs: 30_000 };
        expect(shrineBarOf(shrine.id)).toEqual({ typeId: SHRINE, heroId: null, side: 0, litMs: 30_000, maxLitMs: 60_000 });
    });

    it('shows the lit bar and its time when the shrine lights, and goes when it is out', async () => {
        const shrine = placeAt(SHRINE, 400, 400);
        const bars = [{ tokenId: shrine.id, heroId: null, typeId: SHRINE, x: 400, y: 400 }];
        const { container } = render(React.createElement(WorkBarLayer, { bars }));
        const slot = () => container.querySelector(`[data-shrine-bar-slot="${shrine.id}"]`);
        expect(slot()).toBeNull();
        await act(async () => {
            shrine.shrine = { litMs: 45_000 };
            EventBus.publish(BOARD_EVENTS.SHRINE_LIT, { instanceId: shrine.id, lit: true, litMs: 45_000, maxLitMs: 60_000 });
        });
        expect(slot()).not.toBeNull();
        expect(container.querySelector(`[data-shrine-lit="${shrine.id}"]`).textContent).toBe('45s');
        expect(container.querySelector(`[data-shrine-bar="${shrine.id}"]`).getAttribute('data-work-bar-fill')).toBe(String(Math.floor(BAR.W * 0.75)));
        // No cycle bar: a shrine's strip is its lit time.
        expect(container.querySelector(`[data-work-bar="${shrine.id}"]`)).toBeNull();
        await act(async () => {
            shrine.shrine = { litMs: 0 };
            EventBus.publish(BOARD_EVENTS.SHRINE_LIT, { instanceId: shrine.id, lit: false, litMs: 0, maxLitMs: 60_000 });
        });
        expect(slot()).toBeNull();
        expect(BoardState.getTokenById(shrine.id)).toBe(shrine);
    });
});
