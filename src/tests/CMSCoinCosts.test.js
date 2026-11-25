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
import { auditConnectivity } from '../../cms/src/engine/connectivityAuditor.js';
import { validatePack } from '../../cms/src/engine/changePacks.js';
import { shopCoinsOf as cmsShopCoinsOf, enemyCoinDropOf as cmsEnemyCoinDropOf } from '../../cms/src/utils/constants';
import { shopCoinsOf, enemyCoinDropOf } from '../config/registries/coinCosts.js';
import { paletteForKeyword, KEYWORD } from '../systems/effects/statements.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import TokenEditor from '../../cms/src/components/editors/TokenEditor.jsx';

/**
 * ⭐ Coin costs and coin drops in the CMS: a Shop block's Coins (`shop.coins`) and an enemy's Coin
 * drop (`enemy.coinDrop`), each a whole number above 0 or nothing, carried through Recalculate and
 * Sync and read with the game's own rule; the Economy Audit names one the game cannot read; Coin
 * Find is offered on a Token's rules, and a Guild Hall star carrying it is refused.
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
const loadShipped = () => useEntityStore.getState().hydrate(workspaceFromFiles(Object.fromEntries(FILES.map((f) => [f, JSON.parse(raw[f])]))));
const syncPayload = () => JSON.parse(JSON.stringify(syncFiles(useEntityStore.getState().recalculateEconomy({}))));

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

const store = () => useEntityStore.getState();
const field = (container, name) => container.querySelector(`[data-field="${name}"]`);
function editor(patch) {
    const id = store().addToken({ name: 'Coin Fixture' });
    store().updateToken(id, patch);
    store().setActiveEntity(id, 'token');
    return { id, ...render(React.createElement(TokenEditor)) };
}

describe('⭐ the Shop block\'s Coins', () => {
    it('the CMS reads coin costs and drops with the game\'s own rules', () => {
        expect(cmsShopCoinsOf).toBe(shopCoinsOf);
        expect(cmsEnemyCoinDropOf).toBe(enemyCoinDropOf);
    });

    it('a whole number above 0 is written; 0, blank, a fraction or below 0 writes nothing; it reaches tokens.json', () => {
        const { id, container } = editor({ shop: { price: [], section: 'general' } });
        const input = () => container.querySelector('[data-block="shop"] [data-field="shop-coins"]');
        expect(input().value).toBe('');
        expect(field(container, 'shop-coins-line').textContent).toMatch(/Asks no coins/);
        fireEvent.change(input(), { target: { value: '25' } });
        expect(store().tokens[id].shop).toEqual({ price: [], section: 'general', coins: 25 });
        expect(field(container, 'shop-coins-line').textContent).toMatch(/Asks 25 coins beside the items/);
        expect(syncPayload()['tokens.json'][id].shop.coins).toBe(25);
        for (const value of ['0', '', '2.5', '-4']) {
            fireEvent.change(input(), { target: { value } });
            expect(store().tokens[id].shop, value).toEqual({ price: [], section: 'general' });
        }
        expect(syncPayload()['tokens.json'][id].shop).not.toHaveProperty('coins');
    });
});

describe('⭐ the enemy\'s Coin drop', () => {
    it('a whole number above 0 is written beside the level; anything else writes nothing; it reaches tokens.json', () => {
        const { id, container } = editor({ enemy: { level: 2, style: 'melee' } });
        const input = () => field(container, 'enemy-coin-drop');
        expect(input().value).toBe('');
        fireEvent.change(input(), { target: { value: '6' } });
        expect(store().tokens[id].enemy).toEqual({ level: 2, style: 'melee', coinDrop: 6 });
        expect(field(container, 'enemy-coin-drop-line').textContent).toMatch(/Each kill drops 6 coins/);
        expect(syncPayload()['tokens.json'][id].enemy.coinDrop).toBe(6);
        fireEvent.change(input(), { target: { value: '0' } });
        expect(store().tokens[id].enemy).toEqual({ level: 2, style: 'melee' });
    });
});

describe('⭐ the Economy Audit names a coin cost or drop the game cannot read', () => {
    it('as a warning, in the game\'s words', () => {
        const tokens = {
            fx_shop: { id: 'fx_shop', name: 'Bad Shop', shop: { price: [], coins: -2 } },
            fx_enemy: { id: 'fx_enemy', name: 'Bad Enemy', enemy: { level: 1, coinDrop: 0.5 } },
            fx_fine: { id: 'fx_fine', name: 'Fine', shop: { price: [], coins: 4 }, enemy: { level: 1, coinDrop: 3 } }
        };
        const issues = auditConnectivity({ items: {}, tokens, recipes: {}, effects: {} })
            .filter(i => /Shop coins|Coin drop/.test(i.details));
        expect(issues.map(i => i.entityId).sort()).toEqual(['fx_enemy', 'fx_shop']);
        expect(issues.every(i => i.severity === 'Warning')).toBe(true);
    });
});

describe('⭐ Coin Find', () => {
    it('is offered on a Token\'s Provides rules', () => {
        expect(paletteForKeyword(KEYWORD.PROVIDES, false, { onToken: true }).map(e => e.type)).toContain(EFFECT_TYPES.COIN_FIND);
    });

    it('a Guild Hall star carrying it is refused by the pack check: no star touches coins', () => {
        const rule = { id: 'stm_x', keyword: 'provides', payload: { type: 'COIN_FIND', bucket: 'percentage', value: 0.5 }, to: { mode: 'all', value: '' } };
        const star = {
            id: 'star_coin', constellation: 'mining', name: 'Coin Star', node: { x: 1, y: 1 }, links: ['hall'],
            ranks: [{ tier: 1, price: [], rules: [rule], lines: [] }]
        };
        const pack = {
            format: 'fantasy-guild-change-pack', version: 1, id: 'coin-star', createdAt: '2026-11-25T10:00:00Z', asked: 'A coin star',
            entries: [
                { op: 'create', kind: 'hallConstellation', id: 'mining', value: { id: 'mining', name: 'Mining', label: { x: 1, y: 0 }, skill: 'mining' }, note: 'n' },
                { op: 'create', kind: 'hallStar', id: star.id, value: star, note: 'n' }
            ]
        };
        expect(validatePack(pack).errors.join(' ')).toMatch(/rank 1 carries a Coin Find rule, which a star cannot carry: no Guild Hall star touches coins/);
    });
});
