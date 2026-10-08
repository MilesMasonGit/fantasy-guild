// @vitest-environment jsdom
import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as Flags from '../systems/board/Flags.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { EngineContext } from '../ui/context/EngineContext';
import { resetMatTuning } from '../config/matTuning.js';
import { matW, matH } from '../config/matGeometry.js';
import { getItem } from '../config/registries/itemRegistry.js';
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import { MatHero } from '../ui/components/board/MatHero.jsx';
import { MatRings } from '../ui/components/board/MatRings.jsx';
import { CalloutLayer } from '../ui/components/board/CalloutLayer.jsx';
import { matStackOrder, sameStackOrder } from '../ui/components/board/matLayers.js';
import { placeAt, clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

// Render counters: each wraps the real component and counts its calls. A
// memoised parent that skips its render never calls these.
const calls = { heroSprite: 0, flagMark: 0, pixelArt: new Map() };
vi.mock('../ui/components/board/AnimatedHeroSprite.jsx', async (orig) => {
    const real = await orig();
    const AnimatedHeroSprite = (props) => { calls.heroSprite++; return real.AnimatedHeroSprite(props); };
    return { ...real, AnimatedHeroSprite, default: AnimatedHeroSprite };
});
vi.mock('../ui/components/board/FlagMark.jsx', async (orig) => {
    const real = await orig();
    const FlagMark = (props) => { calls.flagMark++; return real.FlagMark(props); };
    return { ...real, FlagMark, default: FlagMark };
});
vi.mock('../ui/components/base/TokenSprite.jsx', async (orig) => {
    const real = await orig();
    const PixelArt = (props) => { calls.pixelArt.set(props.alt, (calls.pixelArt.get(props.alt) || 0) + 1); return real.PixelArt(props); };
    return { ...real, PixelArt };
});

/**
 * ⭐ **A MatBoard render redraws only what changed** (R6 rule 8).
 */

const h = React.createElement;
const mount = (el) => render(
    h(EngineContext.Provider, { value: { GameState, EventBus } }, h(DndContext, null, el))
);

describe('⭐ the mat components are memoised', () => {
    it('MatHero, MatRings and CalloutLayer are React.memo', () => {
        for (const c of [MatHero, MatRings, CalloutLayer]) {
            expect(c.$$typeof).toBe(Symbol.for('react.memo'));
        }
    });
});

describe('⭐ stable stacking maps', () => {
    it('the same ranks give the same answer; a changed rank does not', () => {
        const a = matStackOrder({ tokens: [{ id: 't1', y: 1 }, { id: 't2', y: 2 }], flags: [{ heroId: 'h', y: 0 }] });
        const b = matStackOrder({ tokens: [{ id: 't1', y: 1 }, { id: 't2', y: 2 }], flags: [{ heroId: 'h', y: 0 }] });
        expect(sameStackOrder(a, b)).toBe(true);
        const c = matStackOrder({ tokens: [{ id: 't1', y: 3 }, { id: 't2', y: 2 }], flags: [{ heroId: 'h', y: 0 }] });
        expect(sameStackOrder(a, c)).toBe(false);
        expect(sameStackOrder(null, a)).toBe(false);
    });
});

describe('⭐ on the mat: moving the hover between Tokens redraws no hero, flag or loot', () => {
    beforeAll(() => Flags.init());
    afterAll(() => { Flags.teardown(); resetMatTuning(); });
    afterEach(() => cleanup());

    beforeEach(() => {
        vi.clearAllMocks();
        resetMatTuning();
        GameState.initNew();
        InventoryManager.init();
        SpriteLayer.init();
        BoardCombat.clearAll();
        TileModifiers.clearAll();
        clearMat();
        GameState.state.heroes = [{
            id: 'h1', name: 'h1', spriteId: 'recruit', status: 'idle', level: 50,
            skills: { forestry: { level: 50, xp: 0 } }, hp: { current: 100, max: 100 }
        }];
    });

    it('hovering one Token then another', () => {
        placeAt('fixture_producer', 600, 600);
        placeAt('fixture_producer', 900, 600);
        // High on the mat and far away: the flag sorts behind both Tokens, its
        // hero stays idle beside it, and neither moves when the hover does.
        Flags.plant('h1', { x: 250, y: 200 });
        expect(Flags.statusOf('h1').state).toBe('idle');
        SpriteLayer.addSprite('item', 'item_coal', 3, { centre: { x: 300, y: 800 } });
        const lootAlt = getItem('item_coal')?.name || 'item_coal';

        const { container } = mount(h(MatBoard));
        const root = container.querySelector('[data-mat-board]');
        root.getBoundingClientRect = () => ({ left: 0, top: 0, width: matW(), height: matH(), right: matW(), bottom: matH(), x: 0, y: 0 });
        expect(container.querySelector('[data-board-hero="h1"]')).not.toBeNull();
        expect(container.querySelector('[data-item-sprite]')).not.toBeNull();

        fireEvent.pointerMove(root, { clientX: 600, clientY: 600 });
        const before = { hero: calls.heroSprite, flag: calls.flagMark, loot: calls.pixelArt.get(lootAlt) || 0 };
        expect(before.hero).toBeGreaterThan(0);
        expect(before.flag).toBeGreaterThan(0);
        expect(before.loot).toBeGreaterThan(0);

        fireEvent.pointerMove(root, { clientX: 900, clientY: 600 });
        fireEvent.pointerMove(root, { clientX: 600, clientY: 600 });
        expect(calls.heroSprite - before.hero).toBe(0);
        expect(calls.flagMark - before.flag).toBe(0);
        expect((calls.pixelArt.get(lootAlt) || 0) - before.loot).toBe(0);
    });
});
