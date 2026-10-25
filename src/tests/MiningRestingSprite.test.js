// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as Flags from '../systems/board/Flags.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as Respawn from '../systems/board/Respawn.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import { placeAt, clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * Brief 230 S3: a resting vein is drawn as the one shared empty rock (its type's
 * `respawn.restingSprite`), not greyed; full again, it is drawn as its own ore. A resting Token
 * whose type names no resting sprite is drawn as today: its own art, greyed.
 */

const mining = { skill: 'mining', skillRequired: 1, cycleTimeMs: 2000, xp: 1, inputs: [], outputs: [{ itemId: 'fixture_copper_ore', quantity: 1, chance: 100 }] };
registerTokenTypes({
    rs_vein: {
        id: 'rs_vein', name: 'RS Copper Vein', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: 5,
        sprite: 't_ore_vein_copper', respawn: { mode: 'refill', afterMs: 60000, restingSprite: 't_vein_stone' }, config: mining
    },
    rs_plain: {
        id: 'rs_plain', name: 'RS Plain Vein', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: 5,
        sprite: 't_ore_vein_copper', respawn: { mode: 'refill', afterMs: 60000 }, config: mining
    }
});

const h = React.createElement;
/** Mount the mat and let its mount settle, so a change right after it is not hidden by a pending read. */
async function mount() {
    let out;
    await act(async () => { out = render(h(DndContext, null, h(MatBoard))); });
    return out;
}

/** Set a Token's charges the way the engine does, so its details refresh. */
async function setCharges(t, remaining) {
    const delta = remaining - t.usesRemaining;
    t.usesRemaining = remaining;
    await act(async () => {
        EventBus.publish(BOARD_EVENTS.TOKEN_CHARGES_CHANGED, { instanceId: t.id, delta, remaining, typeId: t.typeId });
    });
}

const artOf = (container, id) => container.querySelector(`[data-token-art="true"][data-token-id="${id}"]`);
const imgSrcs = (el) => [...el.querySelectorAll('img')].map(i => i.getAttribute('src'));

describe('a resting vein on the mat', () => {
    beforeAll(() => Flags.init());
    afterAll(() => { Flags.teardown(); resetMatTuning(); });
    afterEach(() => cleanup());

    beforeEach(() => {
        resetMatTuning();
        GameState.initNew();
        InventoryManager.init();
        SpriteLayer.init();
        BoardCombat.clearAll();
        TileModifiers.clearAll();
        clearMat();
        GameState.state.heroes = [];
    });

    it('is drawn as the empty rock, not greyed, and as its ore again once it refills', async () => {
        const vein = placeAt('rs_vein', 600, 600);
        const { container } = await mount();
        let art = artOf(container, vein.id);
        expect(imgSrcs(art)).toContain('/assets/tokens/ore/t_ore_vein_copper.png');
        expect(art.hasAttribute('data-token-state-sprite')).toBe(false);

        await setCharges(vein, 0);
        expect(Respawn.isResting(vein)).toBe(true);
        art = artOf(container, vein.id);
        expect(art.getAttribute('data-token-resting')).toBe('true');
        expect(art.getAttribute('data-token-state-sprite')).toBe('t_vein_stone');
        expect(imgSrcs(art)).toContain('/assets/tokens/ore/t_vein_stone.png');
        expect(imgSrcs(art)).not.toContain('/assets/tokens/ore/t_ore_vein_copper.png');
        expect(art.querySelector('.gi-token-resting')).toBeNull();
        // Its name still says which ore.
        expect(art.querySelector('img').getAttribute('alt')).toBe('RS Copper Vein');

        await setCharges(vein, 5);
        art = artOf(container, vein.id);
        expect(imgSrcs(art)).toContain('/assets/tokens/ore/t_ore_vein_copper.png');
        expect(art.hasAttribute('data-token-state-sprite')).toBe(false);
    });

    it('a resting Token with no resting sprite keeps its own art, greyed', async () => {
        const vein = placeAt('rs_plain', 600, 600);
        const { container } = await mount();
        await setCharges(vein, 0);
        const art = artOf(container, vein.id);
        expect(imgSrcs(art)).toContain('/assets/tokens/ore/t_ore_vein_copper.png');
        expect(art.querySelector('.gi-token-resting')).not.toBeNull();
    });
});
