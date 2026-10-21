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
import { TOOL_KINDS } from '../../cms/src/utils/constants';
import { TOOL_KINDS as GAME_TOOL_KINDS } from '../config/registries/toolKinds.js';
import { composeTokenDescription } from '../../cms/src/engine/descriptionDictionary';
import { auditConnectivity } from '../../cms/src/engine/connectivityAuditor.js';
import ItemEditor from '../../cms/src/components/editors/ItemEditor.jsx';
import TokenEditor from '../../cms/src/components/editors/TokenEditor.jsx';

/**
 * ⭐ Tools in the CMS: an item's Tool (kind, tier, starter) and Hands, a Token's Needs tool, carried
 * through edit → Recalculate → Sync; the description says what a hero must hold; the Economy Audit
 * names a tool no hero can hold.
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

const field = (container, name) => container.querySelector(`[data-field="${name}"]`);
const store = () => useEntityStore.getState();

describe('⭐ the item editor: a hand item can be a tool, with a tier and a starter mark', () => {
    it('offers the game\'s kinds, and only for an item held in a hand', () => {
        expect(TOOL_KINDS).toBe(GAME_TOOL_KINDS);
        const id = store().addItem({ name: 'Plain Fixture' });
        store().setActiveEntity(id, 'item');
        const { container, rerender } = render(React.createElement(ItemEditor));
        expect(field(container, 'tool-kind')).toBeNull();

        store().updateItem(id, { equipSlot: 'hand' });
        rerender(React.createElement(ItemEditor));
        const options = [...field(container, 'tool-kind').querySelectorAll('option')].map(o => o.value);
        expect(options).toEqual(['', 'pickaxe', 'woodaxe', 'fishing_rod', 'sickle']);
        expect(field(container, 'hands')).not.toBeNull();
    });

    it('picking a kind writes the Tool; tier and starter follow; a tool has no Hands choice', () => {
        const id = store().addItem({ name: 'Pick Fixture', equipSlot: 'hand' });
        store().setActiveEntity(id, 'item');
        const { container } = render(React.createElement(ItemEditor));

        fireEvent.change(field(container, 'tool-kind'), { target: { value: 'pickaxe' } });
        expect(store().items[id].tool).toEqual({ kind: 'pickaxe', tier: 1 });
        expect(field(container, 'hands')).toBeNull();

        fireEvent.change(field(container, 'tool-tier'), { target: { value: '3' } });
        fireEvent.click(field(container, 'tool-starter'));
        expect(store().items[id].tool).toEqual({ kind: 'pickaxe', tier: 3, starter: true });

        fireEvent.click(field(container, 'tool-starter'));
        expect(store().items[id].tool).toEqual({ kind: 'pickaxe', tier: 3 });

        fireEvent.change(field(container, 'tool-kind'), { target: { value: '' } });
        expect(store().items[id].tool).toBeUndefined();
    });

    it('Two hands is written only when chosen, and moving the item out of the hands clears it and any Tool', () => {
        const id = store().addItem({ name: 'Greatsword Fixture', equipSlot: 'hand' });
        store().setActiveEntity(id, 'item');
        const { container } = render(React.createElement(ItemEditor));
        fireEvent.change(field(container, 'hands'), { target: { value: '2' } });
        expect(store().items[id].hands).toBe(2);
        fireEvent.change(field(container, 'hands'), { target: { value: '1' } });
        expect(store().items[id].hands).toBeUndefined();

        store().updateItem(id, { hands: 2, tool: { kind: 'sickle', tier: 1 } });
        fireEvent.change(container.querySelector('select'), { target: { value: 'trinket' } });
        expect(store().items[id].tool).toBeUndefined();
        expect(store().items[id].hands).toBeUndefined();
    });
});

describe('⭐ the Token editor: Needs tool', () => {
    it('picking a kind writes { kind, minTier }; the tier follows; none clears it', () => {
        const veinId = Object.values(store().tokens).find(t => t.config?.skill === 'mining')?.id;
        expect(veinId).toBeTruthy();
        store().setActiveEntity(veinId, 'token');
        const { container } = render(React.createElement(TokenEditor));

        fireEvent.change(field(container, 'needs-tool'), { target: { value: 'pickaxe' } });
        expect(store().tokens[veinId].needsTool).toEqual({ kind: 'pickaxe', minTier: 1 });
        fireEvent.change(field(container, 'needs-tool-tier'), { target: { value: '2' } });
        expect(store().tokens[veinId].needsTool).toEqual({ kind: 'pickaxe', minTier: 2 });
        fireEvent.change(field(container, 'needs-tool'), { target: { value: '' } });
        expect(store().tokens[veinId].needsTool).toBeUndefined();
    });
});

describe('⭐ the fields survive Recalculate and Sync, and the description says what a hero must hold', () => {
    it('Tool, Hands and Needs tool reach the files as written', () => {
        // A tier no shipped pickaxe reaches, so the description can only name this one.
        const pick = store().addItem({ name: 'Round Trip Pick', equipSlot: 'hand', type: 'tool', tool: { kind: 'pickaxe', tier: 9, starter: true } });
        const sword = store().addItem({ name: 'Round Trip Greatsword', equipSlot: 'hand', type: 'tool', hands: 2 });
        const veinId = Object.values(store().tokens).find(t => t.config?.skill === 'mining')?.id;
        store().updateToken(veinId, { needsTool: { kind: 'pickaxe', minTier: 9 } });

        const files = syncPayload();
        expect(files['items.json'][pick].tool).toEqual({ kind: 'pickaxe', tier: 9, starter: true });
        expect(files['items.json'][sword].hands).toBe(2);
        expect(files['tokens.json'][veinId].needsTool).toEqual({ kind: 'pickaxe', minTier: 9 });
        expect(files['tokens.json'][veinId].description).toContain('Needs a Round Trip Pick or better in hand.');
    });

    it('the clause names the kind at the bottom rung', () => {
        const text = composeTokenDescription({ name: 'Reeds', needsTool: { kind: 'sickle', minTier: 1 }, config: { outputs: [] } }, {}, {}, {});
        expect(text).toContain('Needs a Sickle in hand.');
    });
});

describe('⭐ the Economy Audit names tool content that cannot work', () => {
    it('a tool not held in a hand, a need no tool answers, and an old pickaxe Token', () => {
        const items = {
            fx_charm: { id: 'fx_charm', name: 'Pick Charm', equipSlot: 'trinket', tool: { kind: 'pickaxe', tier: 1 } }
        };
        const tokens = {
            fx_reeds: { id: 'fx_reeds', name: 'Reeds', needsTool: { kind: 'sickle', minTier: 1 } },
            fx_old_pick: { id: 'fx_old_pick', name: 'Old Pick', effects: [{ effectId: 'fx_acts_pickaxe', scale: 1 }] }
        };
        const effects = {
            fx_acts_pickaxe: { id: 'fx_acts_pickaxe', name: 'Pickaxe', statements: [{ id: 'stm_fx', keyword: 'acts_as', payload: { tag: 'pickaxe', tier: 1 } }] }
        };
        const issues = auditConnectivity({ items, tokens, recipes: {}, effects });
        const tools = issues.filter(i => /tool|Tool|Pickaxe|Sickle|pickaxe/.test(i.details) && ['fx_charm', 'fx_reeds', 'fx_old_pick'].includes(i.entityId));
        expect(tools.map(i => i.entityId).sort()).toEqual(['fx_charm', 'fx_old_pick', 'fx_reeds']);
        expect(tools.every(i => i.severity === 'Warning' && i.issueType === 'Data Integrity')).toBe(true);
    });
});
