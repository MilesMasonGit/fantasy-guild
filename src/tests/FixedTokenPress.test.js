// @vitest-environment jsdom
import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { useDndMonitor } from '@dnd-kit/core';
import { DeckDndProvider } from '../ui/dnd/DndKit.jsx';
import './fixtures/testTokens.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { QUEST_TOKEN_TYPE } from '../config/registries/engineTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Flags from '../systems/board/Flags.js';
import * as Landmarks from '../systems/board/Landmarks.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { matW, matH } from '../config/matGeometry.js';
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import { MAT_TOKEN_DRAG_ID } from '../ui/components/board/MatToken.jsx';
import { MatFitProvider } from '../ui/components/board/MatFitContext.jsx';
import { placeAt, clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ **A fixed Token answers a click but not a drag** (Atlas D-6 B), and only movable Tokens carry
 * the faint marker at rest and show the grab cursor. The Guild Hall is movable (T-148).
 * Hovering any Token shows the white outline and moves nothing (T-147).
 */

registerTokenTypes({
    fxp_sapling: {
        id: 'fxp_sapling', name: 'Fxp Sapling', tokenType: 'resource', rarity: 'common',
        theme: 'fixture', sprite: 's_nature', uses: null, grows: { into: 'fixture_producer', afterMs: 30000 }
    },
    fxp_enemy: {
        id: 'fxp_enemy', name: 'Fxp Goblin', tokenType: 'enemy', rarity: 'common', theme: 'fixture',
        sprite: 's_nature', uses: 1, enemy: { level: 1, style: 'melee' }
    },
    fxp_site: {
        id: 'fxp_site', name: 'Fxp Site', tokenType: 'resource', rarity: 'common', theme: 'fixture',
        sprite: 's_nature', uses: null, landmark: true
    }
});

const h = React.createElement;
const FIT = 0.87;

function fixtureAt(x, y) {
    const instance = BoardState.createTokenInstance('fixture_producer', 100, null, BoardState.ORIGIN.PLACED);
    instance.fixture = true;
    return BoardState.addToken(instance, x, y);
}
/** A Token the Starter Camp laid: placed, with the camp's fixture mark. */
function campFixtureAt(x, y) {
    const instance = BoardState.createTokenInstance('fixture_producer', 100, null, BoardState.ORIGIN.PLACED);
    instance.fixture = BoardState.FIXTURE.CAMP;
    return BoardState.addToken(instance, x, y);
}
const spawnedAt = (typeId, x, y) =>
    BoardState.addToken(BoardState.createTokenInstance(typeId, null, null, BoardState.ORIGIN.SPAWNED), x, y);

function mount(props = {}) {
    const started = [];
    const flyBack = [];
    const Spy = () => {
        useDndMonitor({
            onDragStart: (e) => {
                started.push(e.active.id === MAT_TOKEN_DRAG_ID ? e.active.data.current.from.instanceId : e.active.id);
                flyBack.push(typeof e.active.data.current?.onMiss === 'function');
            }
        });
        return null;
    };
    const view = render(
        h(DeckDndProvider, null,
                h(MatFitProvider, { value: FIT }, h(MatBoard, props), h(Spy)))
    );
    const mat = view.container.querySelector('[data-mat-board]');
    mat.getBoundingClientRect = () => ({ left: 0, top: 0, x: 0, y: 0, width: matW(), height: matH(), right: matW(), bottom: matH() });
    return { ...view, started, flyBack };
}

const hitOf = (container, id) => container.querySelector(`[data-token-hit="${id}"]`);
const artOf = (container, id) => container.querySelector(`[data-token-art][data-token-id="${id}"]`);

function pressAndPull(el, x, y) {
    act(() => {
        fireEvent.pointerDown(el, { pointerId: 1, clientX: x, clientY: y, isPrimary: true, button: 0 });
        fireEvent.pointerMove(document, { pointerId: 1, clientX: x + 30, clientY: y, isPrimary: true });
    });
}

beforeAll(() => Flags.init());
afterAll(() => Flags.teardown());
beforeEach(() => {
    vi.clearAllMocks();
    GameState.initNew();
    GameState.state.heroes = [];
    InventoryManager.init();
    SpriteLayer.init();
    clearMat();
});
afterEach(async () => {
    fireEvent.pointerUp(document, { pointerId: 1, clientX: 0, clientY: 0 });
    await new Promise(r => setTimeout(r, 80));
    document.body.classList.remove('gi-dnd-active');
    cleanup();
});

describe('⭐ a fixed Token refuses a drag; the press still inspects', () => {
    it('a map node is not picked up', () => {
        const node = fixtureAt(600, 500);
        const { container, started } = mount();
        pressAndPull(hitOf(container, node.id), 600, 500);
        expect(started).toEqual([]);
    });

    it('a planted Sapling is not picked up either', () => {
        const sapling = spawnedAt('fxp_sapling', 400, 400);
        const { container, started } = mount();
        pressAndPull(hitOf(container, sapling.id), 400, 400);
        expect(started).toEqual([]);
    });

    it('the Guild Hall is picked up like a bought Token, and flies back if let go off the mat', () => {
        const hall = placeAt('token_guild_hall', 900, 600);
        const { container, started, flyBack } = mount();
        pressAndPull(hitOf(container, hall.id), 900, 600);
        expect(started).toEqual([hall.id]);
        expect(flyBack).toEqual([true]);
        expect(artOf(container, hall.id).className).toContain('cursor-grab');
        expect(artOf(container, hall.id).getAttribute('data-token-fixed')).toBeNull();
    });

    it('a click on a map node still inspects it', () => {
        const node = fixtureAt(600, 500);
        const onInspectToken = vi.fn();
        const { container } = mount({ onInspectToken });
        fireEvent.click(hitOf(container, node.id), { clientX: 600, clientY: 500 });
        expect(onInspectToken).toHaveBeenCalledWith('fixture_producer', expect.anything(), node.id);
    });

    it('a bought Token is picked up as before', () => {
        const tok = placeAt('fixture_producer', 600, 500);
        const { container, started } = mount();
        pressAndPull(hitOf(container, tok.id), 600, 500);
        expect(started).toEqual([tok.id]);
    });
});

describe('⭐ only movable Tokens carry the marker and show the grab cursor', () => {
    it('the marker is on a bought Token and the Hall, never a fixed one, an enemy or a quest', () => {
        const bought = placeAt('fixture_producer', 300, 300);
        const node = fixtureAt(600, 300);
        const hall = placeAt('token_guild_hall', 900, 600);
        const sapling = spawnedAt('fxp_sapling', 1200, 300);
        const enemy = spawnedAt('fxp_enemy', 300, 800);
        const quest = spawnedAt(QUEST_TOKEN_TYPE, 600, 800);
        const { container } = mount();
        const marked = [...container.querySelectorAll('[data-token-movable]')].map(el => el.getAttribute('data-token-hit'));
        expect(marked.sort()).toEqual([bought.id, hall.id].sort());
        for (const t of [node, sapling, enemy, quest]) expect(hitOf(container, t.id)).toBeTruthy();
    });

    it('hovered, any Token shows the white outline and nothing moves; at rest it has none', () => {
        const bought = placeAt('fixture_producer', 300, 300);
        const node = fixtureAt(900, 300);
        const { container } = mount();
        const moved = (id) => [artOf(container, id), ...artOf(container, id).querySelectorAll('*')]
            .filter(el => /hop|bob|lift/.test(el.getAttribute('class') || '')
                || (el.style.transform && el.style.transform !== 'none')
                || el.style.translate || el.style.animation);

        expect(artOf(container, bought.id).getAttribute('data-outline')).toBeNull();
        const resting = moved(bought.id);

        fireEvent.pointerMove(hitOf(container, bought.id), { clientX: 300, clientY: 300 });
        expect(artOf(container, bought.id).getAttribute('data-outline')).toBe('hover');
        expect(moved(bought.id)).toEqual(resting);

        fireEvent.pointerMove(hitOf(container, node.id), { clientX: 900, clientY: 300 });
        expect(artOf(container, node.id).getAttribute('data-outline')).toBe('hover');
        expect(artOf(container, bought.id).getAttribute('data-outline')).toBeNull();
        expect(moved(node.id)).toEqual([]);
    });

    it('the grab cursor is on movable Tokens, a goblin included; a fixed Token shows the click cursor', () => {
        const bought = placeAt('fixture_producer', 300, 300);
        const enemy = spawnedAt('fxp_enemy', 600, 300);
        const node = fixtureAt(900, 300);
        const { container } = mount();
        expect(artOf(container, bought.id).className).toContain('cursor-grab');
        expect(artOf(container, enemy.id).className).toContain('cursor-grab');
        expect(artOf(container, node.id).className).not.toContain('cursor-grab');
        expect(artOf(container, node.id).className).toContain('cursor-pointer');
        expect(artOf(container, node.id).getAttribute('data-token-fixed')).toBe('true');
    });
});

describe('⭐ the dev layout tool lifts a camp Token and a landmark already on the mat', () => {
    const fixedMark = (container, id) => artOf(container, id).getAttribute('data-token-fixed');

    it('a camp Token is not picked up until the tool is ticked, then is, with the grab cursor', () => {
        const camp = campFixtureAt(600, 500);
        const { container, started } = mount();
        pressAndPull(hitOf(container, camp.id), 600, 500);
        expect(started).toEqual([]);
        expect(fixedMark(container, camp.id)).toBe('true');
        try {
            act(() => Landmarks.setLayoutEditing(true));
            expect(fixedMark(container, camp.id)).toBeNull();
            expect(artOf(container, camp.id).className).toContain('cursor-grab');
            pressAndPull(hitOf(container, camp.id), 600, 500);
            expect(started).toEqual([camp.id]);
        } finally {
            act(() => Landmarks.setLayoutEditing(false));
        }
    });

    it('ticked and unticked, a camp Token and a landmark are lifted and fixed again; a map node never is', () => {
        const camp = campFixtureAt(400, 400);
        const site = placeAt('fxp_site', 800, 400);
        const node = fixtureAt(1200, 400);
        const { container } = mount();
        const marks = () => [camp, site, node].map(t => fixedMark(container, t.id));
        expect(marks()).toEqual(['true', 'true', 'true']);
        try {
            act(() => Landmarks.setLayoutEditing(true));
            expect(marks()).toEqual([null, null, 'true']);
        } finally {
            act(() => Landmarks.setLayoutEditing(false));
        }
        expect(marks()).toEqual(['true', 'true', 'true']);
    });
});
