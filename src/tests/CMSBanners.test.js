// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';

import { useEntityStore } from '../../cms/src/stores/useEntityStore';
import { useSimulationStore } from '../../cms/src/stores/useSimulationStore';
import { syncFiles } from '../../cms/src/engine/recipeSync';
import StarterCampPage from '../../cms/src/components/starterCamp/StarterCampPage.jsx';

/**
 * The banner field in the CMS: a Base Map and the Starter Camp each pick an area banner (or leave
 * it to the game's default by biome), and Sync writes the pick. Modifiers have none. No-op storage,
 * so nothing reaches the author's real workspace (TESTING, "The CMS").
 */

const STORAGE_KEY = 'fantasy-guild-cms-v2';
const NO_STORAGE = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
let storedBefore;

beforeAll(() => {
    storedBefore = window.localStorage.getItem(STORAGE_KEY);
    useEntityStore.persist.setOptions({ storage: NO_STORAGE });
});
afterAll(() => {
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(storedBefore);
});

const workspace = (starterCamp = null) => ({
    items: { item_fixture_log: { id: 'item_fixture_log', name: 'Fixture Log', type: 'material', value: null, valueSource: null, autoSyncId: true } },
    tokens: { token_fixture_tree: { id: 'token_fixture_tree', name: 'Fixture Tree', tokenType: 'resource', rarity: 'common', uses: null, config: null } },
    effects: {},
    recipePools: {},
    starterCamp
});
const CAMP = { tokens: [{ typeId: 'token_fixture_tree', x: 100, y: 100 }], bank: { item_fixture_log: 2 } };
const syncPayload = () => syncFiles(useEntityStore.getState().recalculateEconomy({}));
const choose = (container, id) => fireEvent.click(container.querySelector(`[data-banner-choice="${id}"]`));

beforeEach(() => {
    useEntityStore.getState().hydrate(workspace());
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ camp: null }) })));
});
afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    useSimulationStore.getState().clearResults();
});

describe('the Starter Camp\'s banner', () => {
    it('is picked on the page and written by Sync', () => {
        useEntityStore.getState().setStarterCamp(CAMP);
        const { container } = render(React.createElement(StarterCampPage));
        expect(container.querySelector('[data-banner-choice="default"]').getAttribute('title')).toBe('Default (Golden plains)');
        choose(container, 'b_village');
        expect(syncPayload()['starterCamp.json'].banner).toBe('b_village');
        choose(container, 'default');
        expect('banner' in syncPayload()['starterCamp.json']).toBe(false);
    });

    it('survives taking a new layout from the game', async () => {
        useEntityStore.getState().setStarterCamp({ ...CAMP, banner: 'b_village' });
        const pending = { tokens: [{ typeId: 'token_fixture_tree', x: 300, y: 300 }], bank: {} };
        vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => ({
            ok: true, json: async () => (options.method === 'DELETE' ? { success: true } : { camp: pending })
        })));
        const { findByText, getByText } = render(React.createElement(StarterCampPage));
        await findByText('Use this layout');
        await act(async () => { fireEvent.click(getByText('Use this layout')); });
        expect(useEntityStore.getState().starterCamp.tokens).toEqual(pending.tokens);
        expect(useEntityStore.getState().starterCamp.banner).toBe('b_village');
    });
});
