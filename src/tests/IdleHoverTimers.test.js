// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as Flags from '../systems/board/Flags.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Demolition from '../systems/board/Demolition.js';
import * as Respawn from '../systems/board/Respawn.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { tokenStartingUses, registerTokenTypes, getTokenType } from '../config/registries/tokenRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { matW, matH } from '../config/matGeometry.js';
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import { cardLifecycle, liveCardSources } from '../ui/components/board/tokenCard.js';
import { restHover } from './fixtures/hoverRest.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * The idle hover is gone (brief 830 D3, concept_playmat_declutter §15.3): resting on an unworked
 * Token shows no refresh, regrow, spawn or demolition timer on the mat; the card keeps each one in
 * its own sentence (one writer, `tokenTimers.js`).
 */

registerTokenTypes({
    iht_sapling: { id: 'iht_sapling', name: 'IHT Sapling', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature' },
    iht_forest: {
        id: 'iht_forest', name: 'IHT Forest', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null,
        sprite: 's_nature', requiresHero: false,
        spawner: { spawns: [{ typeId: 'iht_sapling', weight: 1 }], allowance: 2, intervalMs: 1000 }
    },
    iht_vein: {
        id: 'iht_vein', name: 'IHT Vein', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: 5, sprite: 's_nature',
        config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 2000, xp: 1, inputs: [], outputs: [] },
        respawn: { mode: 'refill', afterMs: 60000 }
    }
});

const h = React.createElement;
const AT = { x: 560, y: 520 };

function put(typeId, point = AT) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeTokenAt(instance, point);
    return instance;
}

function hover(container, tok) {
    const root = container.querySelector('[data-mat-board]');
    root.getBoundingClientRect = () => ({ left: 0, top: 0, width: matW(), height: matH(), right: matW(), bottom: matH(), x: 0, y: 0 });
    fireEvent.pointerMove(root, { clientX: tok.x, clientY: tok.y });
    restHover();
}

/** The hovered Token's timer cells, each as `{ text, tip }`. */
function timerCells(container, tok) {
    const plate = container.querySelector(`[data-idle-plate="${tok.id}"]`);
    return [...(plate?.querySelectorAll('[data-plate-cell="timer"]') || [])].map(cell => {
        fireEvent.pointerEnter(cell);
        const tip = document.body.querySelector('[data-bubble-tip]')?.textContent ?? null;
        fireEvent.pointerLeave(cell);
        return { text: cell.textContent, tip };
    });
}

const cardTips = (tok) => cardLifecycle(tok, getTokenType(tok.typeId), liveCardSources()).map(l => l.tip);

beforeAll(() => Flags.init());
afterAll(() => { Flags.teardown(); resetMatTuning(); });
beforeEach(() => {
    vi.useFakeTimers();
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    GameState.state.heroes = [];
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('the card says it; the mat shows no timer, hovered or not', () => {
    it('an exhausted Token: its countdown on the card alone', () => {
        const vein = put('iht_vein');
        vein.usesRemaining = 0;
        vein.clocks = { [Respawn.CLOCK]: 18000 };
        const { container } = mount();
        hover(container, vein);
        expect(timerCells(container, vein)).toEqual([]);
        expect(container.querySelector('[data-idle-plate]')).toBeNull();
        expect(cardTips(vein)).toContain('Exhausted · respawns in 42s');
    });

    it('a full spawner: full, on the card alone', () => {
        const forest = put('iht_forest');
        put('iht_sapling', { x: 700, y: 520 });
        put('iht_sapling', { x: 640, y: 380 });
        const { container } = mount();
        hover(container, forest);
        expect(timerCells(container, forest)).toEqual([]);
        expect(cardTips(forest)).toContain('Spawns IHT Sapling. Its family is full: it waits for room.');
    });

    it('a Token marked for demolition: waiting for a hero, on the card alone', () => {
        const vein = put('iht_vein');
        Demolition.mark(vein.id);
        const { container } = mount();
        hover(container, vein);
        expect(timerCells(container, vein)).toEqual([]);
        expect(cardTips(vein)).toEqual(['Marked for demolition: waiting for a hero with Construction']);
    });
});

function mount() {
    return render(h(DndContext, null, h(MatBoard)));
}
