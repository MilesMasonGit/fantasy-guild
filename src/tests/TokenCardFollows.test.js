// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act, fireEvent } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { pickRecipe } from './fixtures/stations.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Flags from '../systems/board/Flags.js';
import * as EffectActions from '../systems/board/EffectActions.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { useUIModals } from '../ui/hooks/useUIModals.js';
import { useInspectFollowsToken, followedSelection } from '../ui/hooks/useInspectFollowsToken.js';
import { TokenInspectPopup } from '../ui/components/board/TokenInspectPopup.jsx';
import { TokenCard } from '../ui/components/board/TokenCard.jsx';
import { requestRecipeList } from '../ui/components/board/recipeFlip.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * The Token card stays with its Token: it follows it into what it becomes, closes when it leaves
 * the mat, and a second Token of the same type is a second selection with its own recipe list.
 */

const h = React.createElement;

function put(typeId, x = 400, y = 300) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeTokenAt(instance, { x, y });
    return instance;
}

/** `useUIModals` with the follow hook, and the popup drawn from its selection as `ReactRoot` does. */
function Harness({ api }) {
    const ui = useUIModals();
    useInspectFollowsToken(ui.inspect);
    api.ui = ui;
    const sel = ui.inspect.selection;
    return sel?.type === 'token' && sel.source?.instanceId != null
        ? h(TokenInspectPopup, { typeId: sel.id, instanceId: sel.source.instanceId, anchorRect: sel.source.rect, onClose: () => ui.inspect.clear() })
        : null;
}

const mountHarness = () => {
    const api = {};
    render(h(DndContext, null, h(Harness, { api })));
    return api;
};
const open = (api, instance, rect = { top: 100, left: 100, right: 132, bottom: 132, width: 32, height: 32 }) => {
    act(() => api.ui.inspect.set('token', instance.typeId, { rect, instanceId: instance.id }));
};
const cardName = () => document.querySelector('[data-token-card] h3')?.textContent ?? null;

beforeAll(() => Flags.init());
afterAll(() => Flags.teardown());
afterEach(() => { cleanup(); vi.useRealTimers(); });
beforeEach(() => {
    vi.clearAllMocks();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    GameState.state.heroes = [];
});

describe('followedSelection', () => {
    const sel = { type: 'token', id: 'fixture_station', source: { instanceId: 'a', rect: { top: 1 } }, pane: 'shop' };

    it('moves a card on the transformed Token to the new one, keeping where it was opened', () => {
        expect(followedSelection(sel, { fromId: 'a', instanceId: 'b', typeId: 'fixture_kitchen' })).toEqual({
            type: 'token', id: 'fixture_kitchen', source: { instanceId: 'b', rect: { top: 1 } }, pane: 'shop'
        });
    });

    it('ignores another Token’s transform and a card that is not on the mat', () => {
        expect(followedSelection(sel, { fromId: 'z', instanceId: 'b', typeId: 'fixture_kitchen' })).toBeNull();
        expect(followedSelection({ type: 'token', id: 'fixture_station', source: { rect: { top: 1 } } }, { fromId: 'a', instanceId: 'b', typeId: 'x' })).toBeNull();
        expect(followedSelection({ type: 'item', id: 'a' }, { fromId: 'a', instanceId: 'b', typeId: 'x' })).toBeNull();
        expect(followedSelection(null, { fromId: 'a', instanceId: 'b', typeId: 'x' })).toBeNull();
    });
});

describe('the card follows its Token', () => {
    it('into what it becomes (a transform): the card now names the new Token', () => {
        const api = mountHarness();
        const old = put('fixture_station');
        open(api, old);
        expect(cardName()).toBe('Fixture Station');

        let next = null;
        act(() => { next = EffectActions.transformInstance(BoardState.getTokenById(old.id), 'fixture_kitchen', { cause: 'build' }); });
        expect(next).not.toBeNull();
        expect(api.ui.inspect.selection).toMatchObject({ type: 'token', id: 'fixture_kitchen', source: { instanceId: next.id } });
        expect(cardName()).toBe('Fixture Kitchen');
    });

    it('closes when its Token leaves the mat', () => {
        const api = mountHarness();
        const station = put('fixture_station');
        open(api, station);
        expect(cardName()).toBe('Fixture Station');

        act(() => { Placement.removePlacedToken(station.id); });
        expect(api.ui.inspect.selection).toBeNull();
        expect(document.querySelector('[data-token-card]')).toBeNull();
    });

    it('stays when another Token leaves or becomes something else', () => {
        const api = mountHarness();
        const station = put('fixture_station');
        const other = put('fixture_kitchen', 800, 300);
        const third = put('fixture_kitchen', 1100, 300);
        open(api, station);
        const before = api.ui.inspect.selection;

        act(() => { Placement.removePlacedToken(other.id); });
        act(() => { EffectActions.transformInstance(BoardState.getTokenById(third.id), 'fixture_station'); });
        expect(api.ui.inspect.selection).toBe(before);
        expect(cardName()).toBe('Fixture Station');
    });
});

describe('the same selection is the same Token', () => {
    it('a second Token of the same type at the same height is a new selection; the same Token again keeps the object', () => {
        const api = mountHarness();
        const a = put('fixture_station', 400, 300);
        const b = put('fixture_station', 900, 300);
        const rect = { top: 100, left: 100, right: 132, bottom: 132, width: 32, height: 32 };
        open(api, a, rect);
        const first = api.ui.inspect.selection;

        open(api, a, { ...rect });
        expect(api.ui.inspect.selection).toBe(first);

        open(api, b, { ...rect, left: 600, right: 632 });
        expect(api.ui.inspect.selection.source.instanceId).toBe(b.id);
    });

    it('the gear on a second station opens its own list, with an empty search', () => {
        GameState.state.heroes = [{ id: 'smith', name: 'Smith', skills: { fixture_station_skill: { level: 10, xp: 0 } } }];
        const a = pickRecipe(put('fixture_station', 400, 300), 'recipe_a');
        const b = pickRecipe(put('fixture_station', 900, 300), 'recipe_b');
        const view = render(h(DndContext, null, h(TokenCard, { typeId: 'fixture_station', instanceId: a.id })));
        fireEvent.click(document.querySelector('[data-card-change-recipe]'));
        const search = () => document.querySelector('[data-recipe-search]');
        fireEvent.change(search(), { target: { value: 'coal' } });
        expect(search().value).toBe('coal');

        requestRecipeList(b.id);
        view.rerender(h(DndContext, null, h(TokenCard, { typeId: 'fixture_station', instanceId: b.id })));
        expect(document.querySelector('[data-token-card]').dataset.cardView).toBe('recipes');
        expect(search().value).toBe('');
        expect(document.querySelector('[data-recipe-selected="true"]').dataset.recipeId).toBe('recipe_b');
    });
});
