// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS, ALERT } from '../systems/board/boardEvents.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { INPUT_CALLOUT_GAP_MS } from '../ui/components/board/callouts.js';
import { CalloutLayer } from '../ui/components/board/CalloutLayer.jsx';
import { clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/**
 * A Stump stopped for want of its seedling says so over itself (brief 230 S2a), in S1b's "Needs
 * Coal" look: the red "can't" callout, said as it stops and no more often than "Needs Coal". One
 * waiting for its Forest says nothing out loud; its mark says it.
 */

registerTokenTypes({
    cf_stump: { id: 'cf_stump', name: 'CF Stump', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature', grows: { into: 'cf_stump', afterMs: 1000 } }
});

const h = React.createElement;

beforeEach(() => {
    vi.useFakeTimers();
    GameState.initNew();
    InventoryManager.init();
    clearMat();
});
afterEach(() => {
    cleanup();
    vi.useRealTimers();
    clearMat();
});

function stump() {
    const t = BoardState.createTokenInstance('cf_stump', tokenStartingUses('cf_stump'));
    return BoardState.addToken(t, 800, 500);
}
const say = (id, alert, needs) => act(() => {
    EventBus.publish(BOARD_EVENTS.GROWTH_ALERT_CHANGED, { instanceId: id, alert, needs });
});

describe('⭐ "Needs Oak Seedling" over a stopped Stump', () => {
    it('said as it stops, red, spaced like "Needs Coal"', () => {
        const s = stump();
        const { container } = render(h(CalloutLayer));
        say(s.id, ALERT.GROW_NEEDS_ITEM, ['item_oak_seedling']);
        const bubble = container.querySelector('[data-callout]');
        expect(bubble.textContent).toBe('Needs Oak Seedling');
        expect(bubble.getAttribute('data-speech-tone')).toBe('cant');

        act(() => { vi.advanceTimersByTime(3000); });
        say(s.id, null, []);
        say(s.id, ALERT.GROW_NEEDS_ITEM, ['item_oak_seedling']);
        expect(container.querySelector('[data-callout]')).toBeNull();
        act(() => { vi.advanceTimersByTime(INPUT_CALLOUT_GAP_MS); });
        say(s.id, ALERT.GROW_NEEDS_ITEM, ['item_oak_seedling']);
        expect(container.querySelector('[data-callout]').textContent).toBe('Needs Oak Seedling');
    });

    it('a Stump waiting for its Forest says nothing out loud', () => {
        const s = stump();
        const { container } = render(h(CalloutLayer));
        say(s.id, ALERT.GROW_NEEDS_NEARBY, ['token_oak_forest']);
        expect(container.querySelector('[data-callout]')).toBeNull();
    });
});
