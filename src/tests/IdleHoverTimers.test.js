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
 * The idle hover on the mat: an unworked Token's plate shows the timers and stuck reasons its card
 * has, each cell's tooltip the card's own sentence (one writer, `tokenTimers.js`).
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

describe('the idle hover says what the card says', () => {
    it('an exhausted Token: its countdown, and the card\'s sentence on hover', () => {
        const vein = put('iht_vein');
        vein.usesRemaining = 0;
        vein.clocks = { [Respawn.CLOCK]: 18000 };
        const { container } = mount();
        hover(container, vein);
        const cells = timerCells(container, vein);
        expect(cells).toEqual([{ text: '42s', tip: 'Exhausted · respawns in 42s' }]);
        expect(cardTips(vein)).toContain(cells[0].tip);
    });

    it('a full spawner: full, where a spawning one shows nothing', () => {
        const forest = put('iht_forest');
        put('iht_sapling', { x: 1200, y: 520 });
        put('iht_sapling', { x: 1400, y: 300 });
        const { container } = mount();
        hover(container, forest);
        const cells = timerCells(container, forest);
        expect(cells).toEqual([{ text: 'full', tip: 'Spawns IHT Sapling. Its family is full: it waits for room.' }]);
        expect(cardTips(forest)).toContain(cells[0].tip);
    });

    it('a Token marked for demolition: waiting for a hero, as its card says', () => {
        const vein = put('iht_vein');
        Demolition.mark(vein.id);
        const { container } = mount();
        hover(container, vein);
        const cells = timerCells(container, vein);
        expect(cells).toEqual([{ text: '–', tip: 'Marked for demolition: waiting for a hero with Construction' }]);
        expect(cardTips(vein)).toEqual([cells[0].tip]);
    });
});

function mount() {
    return render(h(DndContext, null, h(MatBoard)));
}
