import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { EngineContext } from '../ui/context/EngineContext';
import { placeAt, clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

// The render-count spy: the real MatToken, behind a memo with the real one's
// comparison, counting how often its body runs.
const renders = { count: 0 };
vi.mock('../ui/components/board/MatToken.jsx', async (importOriginal) => {
    const real = await importOriginal();
    const R = await import('react');
    const Inner = real.MatToken.type;
    const Counted = R.memo(function CountedMatToken(props) {
        renders.count++;
        return R.createElement(Inner, props);
    }, real.MatToken.compare);
    return { ...real, MatToken: Counted };
});

import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import { useUIModals } from '../ui/hooks/useUIModals.js';
import { useInspectTokenHandlers } from '../ui/hooks/useInspectTokenHandlers.js';


const h = React.createElement;
const engine = { GameState, EventBus };

function Harness({ inline, api }) {
    const ui = useUIModals(engine);
    const [inspectHeroId, setInspectHeroId] = React.useState(null);
    api.inspectHero = setInspectHeroId;
    const stable = useInspectTokenHandlers(ui.inspect);
    const handlers = inline
        ? {
            onInspectToken: (typeId, rect, instanceId) => ui.inspect.set('token', typeId, { rect, instanceId }),
            onClearInspect: () => ui.inspect.clear()
        }
        : stable;
    return h(MatBoard, { inspectedHeroId: inspectHeroId, ...handlers });
}

const mount = (props) => render(
    h(EngineContext.Provider, { value: engine }, h(DndContext, null, h(Harness, props)))
);

describe('inspecting a hero does not re-render the mat Tokens (CR3-302)', () => {
    beforeEach(() => {
        GameState.initNew();
        InventoryManager.init();
        SpriteLayer.init();
        BoardCombat.clearAll();
        TileModifiers.clearAll();
        clearMat();
        for (let i = 0; i < 6; i++) placeAt('fixture_producer', 300 + i * 200, 400);
        renders.count = 0;
    });

    afterEach(() => cleanup());

    it('with the stable handlers, no MatToken renders again', () => {
        const api = {};
        mount({ inline: false, api });
        expect(renders.count).toBeGreaterThanOrEqual(6);

        renders.count = 0;
        act(() => { api.inspectHero('h1'); });
        act(() => { api.inspectHero(null); });
        expect(renders.count).toBe(0);
    });

    it('the inline arrows it replaced re-render every Token (the spy sees it)', () => {
        const api = {};
        mount({ inline: true, api });

        renders.count = 0;
        act(() => { api.inspectHero('h1'); });
        expect(renders.count).toBeGreaterThanOrEqual(6);
    });
});
