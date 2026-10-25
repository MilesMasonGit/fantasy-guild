// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { asLoaded } from './fixtures/shippedAsLoaded.js';
import React from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';

import { useEntityStore } from '../../cms/src/stores/useEntityStore';
import { useSimulationStore } from '../../cms/src/stores/useSimulationStore';
import { syncFiles } from '../../cms/src/engine/recipeSync';
import { auditConnectivity } from '../../cms/src/engine/connectivityAuditor';
import { catchPoolsOf as CMS_CATCH_POOLS_OF } from '../../cms/src/utils/constants';
import { catchPoolsOf } from '../config/registries/catchPools.js';
import TokenEditor from '../../cms/src/components/editors/TokenEditor.jsx';

/**
 * Brief 230 S5 in the CMS Token editor: the Catch pools block (`catchPools`), which turns a Token
 * into water: one weighted pool per tool kind and bait. Carried through Recalculate and Sync, its
 * item ids follow a rename, and the Economy Audit counts a pool's catches as produced.
 *
 * ⚠️ No real workspace: the store's persistence is a no-op here (TESTING, "The CMS").
 */

const DATA = path.resolve(__dirname, '../../data');
const FILES = ['items.json', 'tokens.json', 'tokenRecipes.json', 'effects.json'];
const read = (file) => fs.readFileSync(path.join(DATA, file), 'utf8').replace(/\r\n/g, '\n');
const raw = Object.fromEntries(FILES.map((f) => [f, asLoaded(f, read(f))]));

function workspaceFromFiles(files) {
    const recipePools = {};
    for (const recipe of files['tokenRecipes.json']) (recipePools[recipe.skill || 'general'] ||= []).push(recipe);
    return { items: files['items.json'], tokens: files['tokens.json'], effects: files['effects.json'], recipePools };
}
const loadShipped = () => useEntityStore.getState().hydrate(workspaceFromFiles(
    Object.fromEntries(FILES.map((f) => [f, JSON.parse(raw[f])]))
));
const store = () => useEntityStore.getState();
const syncPayload = () => syncFiles(store().recalculateEconomy({}));
const asFile = (files) => Object.fromEntries(FILES.map((f) => [f, JSON.parse(JSON.stringify(files[f], null, 2))]));

function openEditor(id) {
    store().setActiveEntity(id, 'token');
    return render(React.createElement(TokenEditor)).container;
}
const q = (container, sel) => container.querySelector(sel);
const qa = (container, sel) => [...container.querySelectorAll(sel)];

const noStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
let storedBefore;
beforeAll(() => {
    storedBefore = globalThis.localStorage?.getItem('fantasy-guild-cms-v2') ?? null;
    useEntityStore.persist.setOptions({ storage: noStorage });
});
beforeEach(() => loadShipped());
afterEach(() => {
    cleanup();
    useSimulationStore.getState().clearResults();
    expect(globalThis.localStorage?.getItem('fantasy-guild-cms-v2') ?? null).toBe(storedBefore);
});

/** The Coast (no work cycle today) authored as a sea: a rod's basic pool and a baited one. */
const SEA_POOLS = [
    { tool: 'fishing_rod', catches: [{ itemId: 'item_raw_shrimp', weight: 50 }, { itemId: 'item_shrimp', weight: 40 }, { itemId: 'item_water', weight: 10 }] },
    { tool: 'fishing_rod', bait: 'item_shrimp_trawler_potion', catches: [{ itemId: 'item_shrimp', weight: 1 }] }
];

describe('⭐ the Catch pools block', () => {
    it('reads the game\'s own pools', () => {
        expect(CMS_CATCH_POOLS_OF).toBe(catchPoolsOf);
    });

    it('adding the first pool writes catchPools and gives a Token with no work cycle a Fishing one', () => {
        expect(store().tokens.token_coast.config).toBeNull();
        const container = openEditor('token_coast');
        expect(q(container, '[data-field="catch-pools"]')).not.toBeNull();
        expect(qa(container, '[data-pool-index]')).toHaveLength(0);

        fireEvent.click(q(container, '[data-add-pool]'));
        const coast = store().tokens.token_coast;
        expect(coast.catchPools).toEqual([{ tool: 'fishing_rod', catches: [] }]);
        expect(coast.config).toMatchObject({ skill: 'fishing', cycleTimeMs: 10000, xp: 1, inputs: [], outputs: [] });

        fireEvent.click(q(container, '[data-add-catch]'));
        fireEvent.change(q(container, '[data-catch-item]'), { target: { value: 'item_raw_shrimp' } });
        fireEvent.change(q(container, '[data-catch-weight]'), { target: { value: '50' } });
        fireEvent.click(q(container, '[data-add-catch]'));
        fireEvent.change(qa(container, '[data-catch-item]')[1], { target: { value: 'item_shrimp' } });
        fireEvent.change(qa(container, '[data-catch-weight]')[1], { target: { value: '150' } });
        expect(store().tokens.token_coast.catchPools[0].catches).toEqual([
            { itemId: 'item_raw_shrimp', weight: 50 }, { itemId: 'item_shrimp', weight: 150 }
        ]);
        expect(qa(container, '[data-catch-share]').map((n) => n.textContent)).toEqual(['25%', '75%']);
    });

    it('the bait list offers only Consumables; choosing one writes bait, No bait drops the key', () => {
        store().updateToken('token_coast', { catchPools: [{ tool: 'fishing_rod', catches: [{ itemId: 'item_raw_shrimp', weight: 1 }] }] });
        const container = openEditor('token_coast');
        const bait = q(container, '[data-catch-bait]');
        const offered = [...bait.querySelectorAll('option')].map((o) => o.value).filter(Boolean);
        expect(offered).toContain('item_shrimp_trawler_potion');
        expect(offered).not.toContain('item_raw_shrimp');
        expect(offered.every((id) => store().items[id].equipSlot === 'consumable')).toBe(true);

        fireEvent.change(bait, { target: { value: 'item_shrimp_trawler_potion' } });
        expect(store().tokens.token_coast.catchPools[0].bait).toBe('item_shrimp_trawler_potion');
        fireEvent.change(q(container, '[data-catch-bait]'), { target: { value: '' } });
        expect(store().tokens.token_coast.catchPools[0]).not.toHaveProperty('bait');
    });

    it('the tool picker offers every kind; with a pool the Needs tool field says the pools set it, and can clear an old one', () => {
        store().updateToken('token_shrimp_coast', { catchPools: [
            { tool: 'fishing_rod', catches: [{ itemId: 'item_raw_shrimp', weight: 1 }] },
            { tool: 'fishing_net', catches: [{ itemId: 'item_raw_shrimp', weight: 1 }] }
        ] });
        const container = openEditor('token_shrimp_coast');
        const kinds = [...q(container, '[data-catch-tool]').querySelectorAll('option')].map((o) => o.value);
        expect(kinds).toEqual(['pickaxe', 'woodaxe', 'fishing_rod', 'sickle', 'fishing_net', 'fishing_cage']);
        expect(q(container, '[data-field="needs-tool"]')).toBeNull();
        expect(q(container, '[data-field="needs-tool-pools"]').textContent).toContain('a Fishing Rod or Fishing Net, at any tier');
        expect(q(container, '[data-field="needs-tool-pools"]').textContent).toContain('Its own Needs tool is ignored.');
        fireEvent.click(q(container, '[data-clear-needs-tool]'));
        expect(store().tokens.token_shrimp_coast.needsTool).toBeUndefined();
        // Water never wears: the Charges field says so.
        expect(q(container, '[data-field="never-wears"]').textContent).toContain('water never runs out');
    });

    it('removing the last pool drops the key: the synced record has no catchPools', () => {
        store().updateToken('token_coast', { catchPools: [{ tool: 'fishing_rod', catches: [] }] });
        const container = openEditor('token_coast');
        fireEvent.click(q(container, '[data-remove-pool]'));
        expect(store().tokens.token_coast.catchPools).toBeUndefined();
        expect(JSON.parse(JSON.stringify(syncPayload()['tokens.json'].token_coast))).not.toHaveProperty('catchPools');
    });
});

describe('⭐ catch pools through Recalculate, Sync and a reload', () => {
    it('survive Recalculate and Sync, file the Token as a resource, and a reload and a second sync keep them byte-identical', () => {
        store().updateToken('token_coast', { catchPools: SEA_POOLS, config: { skill: 'fishing', skillRequired: 1, cycleTimeMs: 10000, xp: 1, inputs: [], outputs: [] } });
        const first = asFile(syncPayload());
        expect(first['tokens.json'].token_coast.catchPools).toEqual(SEA_POOLS);
        expect(first['tokens.json'].token_coast.tokenType).toBe('resource');

        store().hydrate(workspaceFromFiles(first));
        expect(store().tokens.token_coast.catchPools).toEqual(SEA_POOLS);
        const second = asFile(syncPayload());
        for (const f of FILES) expect(JSON.stringify(second[f], null, 2)).toBe(JSON.stringify(first[f], null, 2));
    });

    it('today\'s data, which has no catch pools, still round-trips byte-identical', () => {
        const files = syncPayload();
        for (const f of FILES) expect(JSON.stringify(files[f], null, 2)).toBe(raw[f].trimEnd());
    });

    it('renaming an item follows it into the pools, as a catch and as a bait', () => {
        store().updateToken('token_coast', { catchPools: SEA_POOLS });
        expect(store().renameEntityId('item_shrimp', 'item_cooked_shrimp', 'item')).toBe(true);
        expect(store().renameEntityId('item_shrimp_trawler_potion', 'item_shrimp_lure', 'item')).toBe(true);
        const pools = store().tokens.token_coast.catchPools;
        expect(pools[0].catches.map((c) => c.itemId)).toEqual(['item_raw_shrimp', 'item_cooked_shrimp', 'item_water']);
        expect(pools[1]).toEqual({ tool: 'fishing_rod', bait: 'item_shrimp_lure', catches: [{ itemId: 'item_cooked_shrimp', weight: 1 }] });
    });

    it('the Economy Audit counts a pool\'s catches as produced there, and names a broken pool', () => {
        const s = store();
        s.addItem({ name: 'Lake Trout Fixture' });
        const troutId = Object.keys(store().items).find((id) => store().items[id].name === 'Lake Trout Fixture');
        const audit = () => {
            const st = store();
            return auditConnectivity({ items: st.items, tokens: st.tokens, recipes: Object.values(st.recipePools).flat(), effects: st.effects });
        };
        const unreachable = () => audit().filter((r) => r.entityId === troutId && /Unreachable/.test(r.details));
        expect(unreachable()).toHaveLength(1);
        store().updateToken('token_coast', {
            config: { skill: 'fishing', skillRequired: 1, cycleTimeMs: 10000, xp: 1, inputs: [], outputs: [] },
            catchPools: [{ tool: 'fishing_rod', catches: [{ itemId: troutId, weight: 1 }] }, { tool: 'harpoon', catches: [{ itemId: troutId, weight: 1 }] }]
        });
        expect(unreachable()).toHaveLength(0);
        expect(audit().some((r) => r.entityId === 'token_coast' && /names the tool kind "harpoon"/.test(r.details))).toBe(true);
    });
});
