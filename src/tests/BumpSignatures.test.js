// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { Profiler } from 'react';
import { render, act, cleanup } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Flags from '../systems/board/Flags.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { resetMatTuning } from '../config/matTuning.js';
import { EngineContext } from '../ui/context/EngineContext';
import { MatCapBadge } from '../ui/components/board/MatCapBadge.jsx';
import { AllowAllButton } from '../ui/components/board/MatModeControls.jsx';
import { MatRegionName } from '../ui/components/board/MatRegionName.jsx';
import { placeAt, clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/**
 * the "bump" subscribers re-render only when what they draw has changed. R5
 * measured `MatCapBadge` and `AllowAllButton` re-rendering on all 10 of 10
 * bare `state_changed` publishes, with nothing changed; that event is retired, and the same holds
 * for the broad one that replaced it, `GAME_RESET`.
 */

const h = React.createElement;
function mountCounting(el) {
    const counts = { n: 0 };
    const r = render(h(EngineContext.Provider, { value: { GameState, EventBus } },
        h(DndContext, null, h(Profiler, { id: 'x', onRender: () => { counts.n++; } }, el))));
    return { ...r, counts };
}

beforeEach(() => {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    clearMat();
});
afterEach(() => cleanup());

describe('bump subscribers bail out when nothing they draw changed (CR3-309)', () => {
    const NamedRegion = () => h(MatRegionName, { readName: () => ({ name: 'Elderfield', practical: 'Starter Camp' }) });
    for (const [name, Comp] of [['MatCapBadge', MatCapBadge], ['AllowAllButton', AllowAllButton], ['MatRegionName', NamedRegion]]) {
        it(`${name}: ten bare GAME_RESET, no re-render`, () => {
            const { counts } = mountCounting(h(Comp));
            const before = counts.n;
            act(() => { for (let i = 0; i < 10; i++) EventBus.publish(ENGINE_EVENTS.GAME_RESET, { reason: 'load' }); });
            expect(counts.n).toBe(before);
        });
    }

    it('MatCapBadge still follows a Token placed', () => {
        const { container } = mountCounting(h(MatCapBadge));
        const text = () => container.querySelector('[data-mat-cap-count]').textContent;
        const before = text();
        act(() => {
            const t = placeAt('fixture_producer', 600, 600);
            EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId: t.id, typeId: t.typeId });
        });
        expect(text()).not.toBe(before);
    });

    it('AllowAllButton still follows a Token disallowed', () => {
        const t = placeAt('fixture_producer', 600, 600);
        const { container } = mountCounting(h(AllowAllButton));
        expect(container.querySelector('[data-allow-all]').getAttribute('data-allow-all')).toBe('0');
        act(() => { Flags.setDisallowed(t.id, true); });
        expect(container.querySelector('[data-allow-all]').getAttribute('data-allow-all')).toBe('1');
    });
});
