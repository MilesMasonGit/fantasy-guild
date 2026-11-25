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
import { spotFindings as CMS_SPOT_FINDINGS } from '../../cms/src/utils/constants';
import { spotFindings } from '../systems/core/spotRule.js';
import { spotOf, spotRateOf } from '../config/registries/fishingSpots.js';
import TokenEditor from '../../cms/src/components/editors/TokenEditor.jsx';

/**
 * Brief 850 F1 in the CMS: the Token editor's Fishing spot block (`spot`) makes a Token a spot kind
 * (the water it lands on, the biomes, how often, how many at once, the chance to move on, the time
 * unworked), each catch pool can name the water and biomes it holds for, and the audit (the game's
 * own `spotRule.js`) names a retired fixed water still in the data and a spot kind that cannot work.
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

/** A fresh Token to make a spot of: nothing but a name and a Fishing work cycle. */
const SPOT_ID = 'token_test_spot';
function addBlankToken() {
    useEntityStore.setState((s) => ({ tokens: { ...s.tokens, [SPOT_ID]: {
        id: SPOT_ID, name: 'Test Spot', sprite: 't_fish_spot', rarity: 'common', tier: 1, tags: [], uses: null, requiresHero: true,
        config: { skill: 'fishing', skillRequired: 1, cycleTimeMs: 8000, xp: 1, inputs: [], outputs: [] }
    } } }));
}

function openEditor(id) {
    store().setActiveEntity(id, 'token');
    return render(React.createElement(TokenEditor)).container;
}
const q = (container, sel) => container.querySelector(sel);

const noStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
let storedBefore;
beforeAll(() => {
    storedBefore = globalThis.localStorage?.getItem('fantasy-guild-cms-v2') ?? null;
    useEntityStore.persist.setOptions({ storage: noStorage });
});
beforeEach(() => { loadShipped(); addBlankToken(); });
afterEach(() => {
    cleanup();
    useSimulationStore.getState().clearResults();
    expect(globalThis.localStorage?.getItem('fantasy-guild-cms-v2') ?? null).toBe(storedBefore);
});

describe('⭐ the Fishing spot block', () => {
    it('ticking it writes a spot with first numbers and stands it on water; unticking drops the key', () => {
        const container = openEditor(SPOT_ID);
        expect(store().tokens[SPOT_ID].spot).toBeUndefined();
        fireEvent.click(q(container, '[data-spot-on]'));
        const token = store().tokens[SPOT_ID];
        expect(token.spot).toEqual({ water: ['sea', 'fresh'], everyMinutes: 10, most: 3, leaveChance: 5, unworkedMinutes: 30 });
        expect(token.standsOn).toEqual(['water']);
        expect(q(container, '[data-spot-summary]').textContent).toContain('up to 3 on a mat at once');

        fireEvent.click(q(container, '[data-spot-on]'));
        expect(store().tokens[SPOT_ID].spot).toBeUndefined();
        expect(JSON.parse(JSON.stringify(syncPayload()['tokens.json'][SPOT_ID]))).not.toHaveProperty('spot');
    });

    it('its chips and numbers write the block the game reads', () => {
        store().updateToken(SPOT_ID, { spot: { water: ['sea'], everyMinutes: 10, most: 1 }, standsOn: ['water'] });
        const container = openEditor(SPOT_ID);
        fireEvent.click(q(container, '[data-spot-water="fresh"]'));
        fireEvent.click(q(container, '[data-spot-water="sea"]'));
        fireEvent.click(q(container, '[data-spot-biome="coast"]'));
        fireEvent.change(q(container, '[data-spot-every]'), { target: { value: '2.5' } });
        fireEvent.change(q(container, '[data-spot-most]'), { target: { value: '4' } });
        fireEvent.change(q(container, '[data-spot-leave]'), { target: { value: '8' } });
        fireEvent.change(q(container, '[data-spot-unworked]'), { target: { value: '20' } });
        const spot = store().tokens[SPOT_ID].spot;
        expect(spot).toEqual({ water: ['fresh'], biomes: ['coast'], everyMinutes: 2.5, most: 4, leaveChance: 8, unworkedMinutes: 20 });
        expect(spotOf(store().tokens[SPOT_ID])).toEqual({ water: ['fresh'], biomes: ['coast'], everyMs: 150000, most: 4, leaveChance: 8, unworkedMs: 1200000 });
    });

    it('survives Recalculate and Sync as authored', () => {
        const spot = { water: ['sea'], biomes: ['coast'], everyMinutes: 60, most: 1, leaveChance: 3, unworkedMinutes: 45 };
        store().updateToken(SPOT_ID, { spot, standsOn: ['water'], catchPools: [{ tool: 'fishing_rod', bait: 'item_shrimp_bait', catches: [{ itemId: 'item_raw_shrimp', weight: 1 }] }] });
        const synced = syncPayload()['tokens.json'][SPOT_ID];
        expect(synced.spot).toEqual(spot);
        expect(synced.standsOn).toEqual(['water']);
    });
});

describe('⭐ the Draws fishing spots block (any Token: the spot building)', () => {
    it('ticking it writes a raise of 100%; the number writes what the game reads; unticking drops the key', () => {
        const container = openEditor(SPOT_ID);
        expect(store().tokens[SPOT_ID].spotRate).toBeUndefined();
        fireEvent.click(q(container, '[data-spot-rate-on]'));
        expect(store().tokens[SPOT_ID].spotRate).toEqual({ percent: 100 });
        fireEvent.change(q(container, '[data-spot-rate-percent]'), { target: { value: '60' } });
        expect(store().tokens[SPOT_ID].spotRate).toEqual({ percent: 60 });
        expect(spotRateOf(store().tokens[SPOT_ID])).toBe(60);
        expect(q(container, '[data-spot-rate-summary]').textContent).toContain('60% more often');

        fireEvent.click(q(container, '[data-spot-rate-on]'));
        expect(store().tokens[SPOT_ID].spotRate).toBeUndefined();
        expect(JSON.parse(JSON.stringify(syncPayload()['tokens.json'][SPOT_ID]))).not.toHaveProperty('spotRate');
    });

    it('survives Recalculate and Sync as authored', () => {
        store().updateToken(SPOT_ID, { spotRate: { percent: 150 } });
        expect(syncPayload()['tokens.json'][SPOT_ID].spotRate).toEqual({ percent: 150 });
    });
});

describe('⭐ a catch pool names where it holds', () => {
    it('water and biome chips write `water` and `biomes`; none ticked drops each key', () => {
        store().updateToken(SPOT_ID, { catchPools: [{ tool: 'fishing_rod', bait: 'item_shrimp_bait', catches: [{ itemId: 'item_raw_shrimp', weight: 1 }] }] });
        const container = openEditor(SPOT_ID);
        fireEvent.click(q(container, '[data-pool-water="sea"]'));
        fireEvent.click(q(container, '[data-pool-biome="coast"]'));
        fireEvent.click(q(container, '[data-pool-biome="bog"]'));
        // Kept in the biome table's order, as ticked or not.
        expect(store().tokens[SPOT_ID].catchPools[0]).toMatchObject({ water: ['sea'], biomes: ['coast', 'bog'] });
        fireEvent.click(q(container, '[data-pool-water="sea"]'));
        fireEvent.click(q(container, '[data-pool-biome="coast"]'));
        fireEvent.click(q(container, '[data-pool-biome="bog"]'));
        const pool = store().tokens[SPOT_ID].catchPools[0];
        expect(pool).not.toHaveProperty('water');
        expect(pool).not.toHaveProperty('biomes');
    });
});

describe('⭐ the audit', () => {
    it('the CMS reads the game\'s own rule', () => {
        expect(CMS_SPOT_FINDINGS).toBe(spotFindings);
    });

    it('names every retired fixed water still in the data, for deletion', () => {
        const named = new Set(spotFindings({ tokens: store().tokens })
            .filter(f => /retired/.test(f.message)).map(f => f.entityId));
        for (const id of ['token_coast', 'token_river', 'token_lake', 'token_bog_pool']) {
            if (store().tokens[id]) expect(named.has(id), id).toBe(true);
        }
        const issues = auditConnectivity({ items: store().items, tokens: store().tokens, recipes: [] });
        if (store().tokens.token_coast) {
            expect(issues.some(i => i.entityId === 'token_coast' && /retired/.test(i.details))).toBe(true);
        }
    });

    it('names a spot kind that can never land or catches nothing, and a water or biome the game lacks', () => {
        const messages = (def) => spotFindings({ tokens: { t: { id: 't', name: 'T', ...def } } }).map(f => f.message);
        expect(messages({ spot: { water: ['sea'], everyMinutes: 5, most: 2 }, standsOn: ['water'], catchPools: [{ tool: 'fishing_rod', catches: [] }] })).toEqual([]);
        expect(messages({ spot: { water: ['sea'], everyMinutes: 5, most: 2 }, catchPools: [{}] }).join(' ')).toMatch(/does not stand on Water/);
        expect(messages({ spot: { water: ['sea'], everyMinutes: 5, most: 2 }, standsOn: ['water'] }).join(' ')).toMatch(/no catch pools/);
        expect(messages({ spot: { water: ['lava'], everyMinutes: 5, most: 2 }, standsOn: ['water'], catchPools: [{}] }).join(' ')).toMatch(/"lava".*no water to land on/);
        expect(messages({ spot: { water: ['sea'], everyMinutes: 5 }, standsOn: ['water'], catchPools: [{}] }).join(' ')).toMatch(/most of 0/);
        expect(messages({ spot: { water: ['sea'], biomes: ['tundra'] }, standsOn: ['water'], catchPools: [{}] }).join(' ')).toMatch(/biome "tundra"/);
        // An event-only kind (no rate) needs no water of its own.
        expect(messages({ spot: { leaveChance: 2 }, standsOn: ['water'], catchPools: [{}] })).toEqual([]);
        expect(messages({ catchPools: [{ tool: 'fishing_rod', water: ['ocean'], biomes: ['moon'], catches: [] }] }).join(' ')).toMatch(/"ocean".*biome "moon"/);
    });
});
