// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import './fixtures/testTokens.js';

/**
 * ⭐ **Loot lands without its extra effects** (owner: they looked wrong and cost frames): no
 * afterimages on the hop, no rare twinkle, no trail or plink on the flight to the Bank. Each is
 * turned off by one switch in `ui/utils/lootEffects.js`, not deleted; flipped on, it plays again.
 */

const switches = vi.hoisted(() => ({ on: null }));
vi.mock('../ui/utils/lootEffects.js', async (importOriginal) => {
    const real = await importOriginal();
    const pick = (name) => (switches.on == null ? real[name] : switches.on);
    return {
        get LOOT_HOP_AFTERIMAGES() { return pick('LOOT_HOP_AFTERIMAGES'); },
        get LOOT_RARE_TWINKLE() { return pick('LOOT_RARE_TWINKLE'); },
        get LOOT_FLIGHT_SPARKLES() { return pick('LOOT_FLIGHT_SPARKLES'); },
        real
    };
});
vi.mock('../ui/components/board/fx/rareTwinkle.js', async (importOriginal) => {
    const real = await importOriginal();
    return { ...real, watchRareDrops: vi.fn(real.watchRareDrops), playRareTwinkle: vi.fn() };
});
vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

import * as LootEffects from '../ui/utils/lootEffects.js';
import { GameState } from '../state/GameState.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { SpriteLayerView } from '../ui/components/board/SpriteLayerView.jsx';
import { playLootArc } from '../ui/utils/lootArc.js';
import { watchRareDrops, playRareTwinkle } from '../ui/components/board/fx/rareTwinkle.js';
import { setSpriteFxManifest } from '../ui/utils/spriteFx.js';

const h = React.createElement;
const ITEM = 'assets/items/i_test.png';
let animations;

beforeEach(() => {
    switches.on = null;
    vi.clearAllMocks();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    GameState.state.board.sprites = [];
    animations = [];
    HTMLElement.prototype.animate = function (keyframes, options) {
        animations.push({ el: this, keyframes, options });
        return { cancel() {}, finished: Promise.resolve() };
    };
    // The generated pictures the afterimages are made from.
    setSpriteFxManifest({ sprites: { [ITEM]: { w: 32, h: 32, outlined: true, hash: 'c' } } });
});

afterEach(() => {
    cleanup();
    setSpriteFxManifest(null);
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    delete HTMLElement.prototype.animate;
});

/** A loot sprite's box as `SpriteLayerView` draws it: the art, its shadow, a count. */
function lootBox(size = 64) {
    const box = document.createElement('button');
    box.innerHTML = `<div><span><span><span data-sprite-shadow="true"></span><img src="/${ITEM}" style="width: ${size}px; height: ${size}px"></span></span></div><span>3</span>`;
    document.body.appendChild(box);
    return box;
}

describe('⭐ the switches, all off', () => {
    it('every loot effect switch ships off', () => {
        const { LOOT_HOP_AFTERIMAGES, LOOT_RARE_TWINKLE, LOOT_FLIGHT_SPARKLES } = LootEffects.real;
        expect({ LOOT_HOP_AFTERIMAGES, LOOT_RARE_TWINKLE, LOOT_FLIGHT_SPARKLES }).toEqual({
            LOOT_HOP_AFTERIMAGES: false,
            LOOT_RARE_TWINKLE: false,
            LOOT_FLIGHT_SPARKLES: false
        });
    });
});

describe('⭐ the hop: no afterimages', () => {
    it('off: the box hops and its shadow keeps to the ground, and nothing else is made or played', () => {
        const box = lootBox();
        playLootArc(box, -120, 60, { unit: 2 });
        expect(box.querySelectorAll('[data-fx-copy]')).toHaveLength(0);
        expect(animations.map(a => (a.el === box ? 'box' : a.el.getAttribute('data-sprite-shadow') ? 'shadow' : 'other'))).toEqual(['box', 'shadow']);
    });

    it('switched on, the two afterimages come back', () => {
        switches.on = true;
        const box = lootBox();
        playLootArc(box, -120, 60, { unit: 2 });
        expect(box.querySelectorAll('[data-fx-copy^="white-dither"]')).toHaveLength(2);
    });
});

describe('⭐ a rare find: no twinkle', () => {
    async function rareDrop() {
        let view;
        await act(async () => { view = render(h(SpriteLayerView)); });
        await act(async () => {
            const sprite = SpriteLayer.addSprite('item', 'fixture_oak_wood', 1, { centre: { x: 500, y: 400 } });
            EventBus.publish(BOARD_EVENTS.RARE_DROP, { spriteId: sprite.id, itemId: sprite.refId, chance: 5 });
        });
        return view;
    }

    it('off: the floor does not listen for rare drops, and plays no twinkle', async () => {
        await rareDrop();
        expect(watchRareDrops).not.toHaveBeenCalled();
        expect(playRareTwinkle).not.toHaveBeenCalled();
    });

    it('switched on, the floor listens again', async () => {
        switches.on = true;
        await act(async () => { render(h(SpriteLayerView)); });
        expect(watchRareDrops).toHaveBeenCalledTimes(1);
    });
});
