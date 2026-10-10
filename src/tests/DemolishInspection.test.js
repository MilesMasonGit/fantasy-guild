// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Demolition from '../systems/board/Demolition.js';
import * as Flags from '../systems/board/Flags.js';
import * as QuestTokens from '../systems/quests/QuestTokens.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { QUEST_TOKEN_TYPE } from '../config/registries/engineTokens.js';
import { EngineContext } from '../ui/context/EngineContext';
import { TokenInspection } from '../ui/components/drawer/TokenInspection.jsx';
import { CalloutLayer } from '../ui/components/board/CalloutLayer.jsx';
import { calloutText } from '../ui/components/board/callouts.js';
import { lifecycleLines } from '../ui/components/drawer/lifecycleLines.js';
import { tokenDetailOf } from '../ui/components/board/useTokenDetail.js';
import { TokenBubbles } from '../ui/components/board/TokenBubbles.jsx';
import { getTokenType, tokenName } from '../config/registries/tokenRegistry.js';
import { placeAt, clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/**
 * Demolition from the inspection: a Demolish button where the engine allows it, the reason where it
 * does not, Cancel demolition once marked, the countdown line, and a Dismiss for bounties (never for
 * tutorial steps).
 */

const h = React.createElement;
const mount = (...els) => render(
    h(EngineContext.Provider, { value: { GameState, EventBus } }, h(DndContext, null, ...els))
);
const inspect = (instance) => mount(h(TokenInspection, { typeId: instance.typeId, instanceId: instance.id }));
const control = (c) => c.querySelector('[data-demolish]');

beforeAll(() => Flags.init());
afterAll(() => Flags.teardown());
afterEach(() => cleanup());
beforeEach(() => {
    GameState.initNew();
    clearMat();
});

describe('the Demolish button', () => {
    it('marks the Token, then Cancel demolition unmarks it', async () => {
        const t = placeAt('fixture_producer', 400, 300);
        const { container } = inspect(t);
        const btn = control(container);
        expect(btn.getAttribute('data-demolish')).toBe('mark');
        expect(btn.textContent).toBe('Demolish');

        await act(async () => { fireEvent.click(btn); });
        expect(Demolition.isMarked(t)).toBe(true);
        expect(control(container).getAttribute('data-demolish')).toBe('cancel');
        expect(control(container).textContent).toBe('Cancel demolition');

        await act(async () => { fireEvent.click(control(container)); });
        expect(Demolition.isMarked(t)).toBe(false);
        expect(control(container).getAttribute('data-demolish')).toBe('mark');
    });

    it('follows a mark made elsewhere (the console)', async () => {
        const t = placeAt('fixture_producer', 400, 300);
        const { container } = inspect(t);
        await act(async () => { Demolition.mark(t.id); });
        expect(control(container).getAttribute('data-demolish')).toBe('cancel');
    });

    it('shows the refusal for the Guild Hall, with no button', () => {
        const hall = placeAt('token_guild_hall', 880, 560);
        const { container } = inspect(hall);
        const hint = control(container);
        expect(hint.getAttribute('data-demolish')).toBe('refused');
        expect(hint.tagName).not.toBe('BUTTON');
        expect(hint.textContent).toBe(Demolition.REFUSAL_TEXT[Demolition.REFUSAL.GUILD_HALL]);
        expect(container.querySelector('button[data-demolish]')).toBeNull();
    });

    it('shows the refusal for a map node', () => {
        const node = placeAt('fixture_producer', 400, 300);
        node.fixture = true;
        const { container } = inspect(node);
        expect(control(container).getAttribute('data-demolish')).toBe('refused');
        expect(control(container).textContent).toBe(Demolition.REFUSAL_TEXT[Demolition.REFUSAL.MAP_NODE]);
    });

    it('a Shop inspection (no instance) offers nothing', () => {
        const { container } = mount(h(TokenInspection, { typeId: 'fixture_producer' }));
        expect(control(container)).toBeNull();
    });
});

describe('a marked Token reads as demolition work', () => {
    it('the lifecycle lines say it is marked, and count down while a hero works it', () => {
        const t = placeAt('fixture_producer', 400, 300);
        Demolition.mark(t.id);
        const src = {
            typeOf: getTokenType, tokenName, itemName: (id) => id,
            spawnerStatus: () => null, passive: () => null, respawn: () => null,
            selectedRecipe: () => null, poolFor: () => [], originOf: () => 'placed',
            workerOf: () => null, demolishMs: Demolition.DEMOLISH_MS, dev: false
        };
        expect(lifecycleLines(t, src)).toEqual([
            { label: 'Marked for demolition', value: 'Waiting for a hero with Construction', tone: 'warning' }
        ]);
        t.cycleElapsedMs = Demolition.DEMOLISH_MS - 6000;
        expect(lifecycleLines(t, { ...src, workerOf: () => 'h1' })).toEqual([
            { label: 'Marked for demolition', value: '6 s left', tone: 'warning' }
        ]);
    });

    it('the inspection shows the line and the Construction skill', () => {
        const t = placeAt('fixture_producer', 400, 300);
        Demolition.mark(t.id);
        const { container } = inspect(t);
        expect(container.querySelector('[data-lifecycle-lines]').textContent).toContain('Marked for demolition');
        expect(container.querySelector('[data-skill-req]').textContent).toContain('Construction');
    });

    it('the Token detail carries the mark and no frozen countdowns', () => {
        const t = placeAt('fixture_producer', 400, 300);
        expect(tokenDetailOf(t.id, getTokenType(t.typeId)).marked).toBe(false);
        Demolition.mark(t.id);
        const d = tokenDetailOf(t.id, getTokenType(t.typeId));
        expect(d.marked).toBe(true);
        expect(d.turns || d.grows || d.resting).toBe(false);
    });
});

describe('the marked badge', () => {
    it('shows in the middle row, and the recipe gear does not while marked', () => {
        const t = placeAt('fixture_producer', 400, 300);
        const props = { instanceId: t.id, token: { typeId: t.typeId }, gear: { show: true, pulsing: true, recipe: null } };
        const plain = mount(h(TokenBubbles, props));
        expect(plain.container.querySelector('[data-station-gear]')).not.toBeNull();
        expect(plain.container.querySelector('[data-demolish-badge]')).toBeNull();
        cleanup();
        const marked = mount(h(TokenBubbles, { ...props, marked: true }));
        expect(marked.container.querySelector('[data-demolish-badge]')).not.toBeNull();
        expect(marked.container.querySelector('[data-station-gear]')).toBeNull();
    });
});

describe('the demolished callout', () => {
    it('says the Token is gone where it stood', () => {
        vi.useFakeTimers();
        try {
            const { container } = render(h(CalloutLayer));
            act(() => {
                EventBus.publish(BOARD_EVENTS.TOKEN_DEMOLISHED, { instanceId: 'gone', typeId: 'fixture_producer', x: 400, y: 300, heroId: 'h1' });
            });
            const name = tokenName('fixture_producer');
            expect(container.querySelector('[data-callout]').textContent).toBe(calloutText.demolished(name));
            expect(calloutText.demolished(name)).toBe(`Demolished ${name}`);
        } finally {
            vi.useRealTimers();
        }
    });
});

describe('Dismiss for bounties', () => {
    function quest(tutorial) {
        const q = placeAt(QUEST_TOKEN_TYPE, 600, 300);
        q.quest = { id: tutorial ? 'tut' : 'bounty', title: 'Q', tutorial, targetType: 'x', requiredCount: 3, currentCount: 0, rewardItems: [], done: false };
        return q;
    }

    it('a bounty has a Dismiss that takes it off the mat', async () => {
        const b = quest(false);
        const { container } = inspect(b);
        expect(control(container)).toBeNull();
        const btn = container.querySelector('[data-dismiss-bounty]');
        expect(btn.textContent).toBe('Dismiss bounty');
        await act(async () => { fireEvent.click(btn); });
        expect(BoardState.getTokenById(b.id)).toBeNull();
        expect(QuestTokens.bountyTokens()).toHaveLength(0);
    });

    it('a tutorial step has neither Dismiss nor Demolish', () => {
        const t = quest(true);
        const { container } = inspect(t);
        expect(container.querySelector('[data-dismiss-bounty]')).toBeNull();
        expect(control(container)).toBeNull();
    });
});
