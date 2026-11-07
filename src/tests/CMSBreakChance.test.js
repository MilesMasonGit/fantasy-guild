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
import { breakChanceOf as cmsBreakChanceOf } from '../../cms/src/utils/constants';
import { breakChanceOf } from '../config/registries/itemBreak.js';
import { toolFindings } from '../systems/core/toolRule.js';
import ItemEditor from '../../cms/src/components/editors/ItemEditor.jsx';

/**
 * ⭐ Brief 480 L1 in the CMS: a tool's or weapon's Break chance, written as `breakChance` only when
 * above 0, carried through Recalculate and Sync; the field is offered only where something can
 * break, and cleared when the item stops being one; the Economy Audit (and the boot audit, through
 * the same `toolFindings`) names a chance that never breaks anything. No shipped item has one.
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
const edit = (patch) => {
    const id = store().addItem({ name: 'Brittle Fixture', ...patch });
    store().setActiveEntity(id, 'item');
    return { id, ...render(React.createElement(ItemEditor)) };
};

describe('⭐ the item editor\'s Break chance', () => {
    it('the CMS reads the chance with the game\'s own rule', () => {
        expect(cmsBreakChanceOf).toBe(breakChanceOf);
    });

    it('offered on a tool and on a weapon; not on an off-hand item, worn gear or a material', () => {
        expect(field(edit({ equipSlot: 'hand', type: 'tool', tool: { kind: 'woodaxe', tier: 1 } }).container, 'break-chance')).not.toBeNull();
        cleanup();
        expect(field(edit({ equipSlot: 'hand', type: 'weapon', styles: ['melee'] }).container, 'break-chance')).not.toBeNull();
        cleanup();
        expect(field(edit({ equipSlot: 'hand', type: 'armor', offHand: true }).container, 'break-chance')).toBeNull();
        cleanup();
        expect(field(edit({ equipSlot: 'chest', type: 'armor' }).container, 'break-chance')).toBeNull();
        cleanup();
        expect(field(edit({ equipSlot: '' }).container, 'break-chance')).toBeNull();
    });

    it('a percent above 0 is written; blank or 0 clears it; above 100 is held at 100; "0." on the way to 0.5 stays typed', () => {
        const { id, container } = edit({ equipSlot: 'hand', type: 'tool', tool: { kind: 'pickaxe', tier: 1 } });
        const input = () => field(container, 'break-chance');
        fireEvent.change(input(), { target: { value: '1' } });
        expect(store().items[id].breakChance).toBe(1);
        fireEvent.change(input(), { target: { value: '0' } });
        expect(store().items[id].breakChance).toBeUndefined();
        expect(input().value).toBe('0');
        fireEvent.change(input(), { target: { value: '0.5' } });
        expect(store().items[id].breakChance).toBe(0.5);
        fireEvent.change(input(), { target: { value: '250' } });
        expect(store().items[id].breakChance).toBe(100);
        fireEvent.change(input(), { target: { value: '' } });
        expect(store().items[id].breakChance).toBeUndefined();
    });

    it('an item that stops being something that breaks loses it: out of the hands, or made an off-hand item', () => {
        let { id, container } = edit({ equipSlot: 'hand', type: 'weapon', styles: ['melee'], breakChance: 2 });
        fireEvent.change(field(container, 'held-as'), { target: { value: 'offhand' } });
        expect(store().items[id].breakChance).toBeUndefined();
        cleanup();

        ({ id, container } = edit({ equipSlot: 'hand', type: 'tool', tool: { kind: 'sickle', tier: 1 }, breakChance: 2 }));
        fireEvent.change(container.querySelector('select'), { target: { value: 'trinket' } });
        expect(store().items[id].breakChance).toBeUndefined();
    });

    it('a tool made a weapon (its Tool cleared) keeps its chance: a weapon breaks too', () => {
        const { id, container } = edit({ equipSlot: 'hand', type: 'tool', tool: { kind: 'woodaxe', tier: 1 }, breakChance: 3 });
        fireEvent.change(field(container, 'tool-kind'), { target: { value: '' } });
        expect(store().items[id].breakChance).toBe(3);
    });
});

describe('⭐ the chance survives Recalculate and Sync', () => {
    it('written as typed on the tool and the weapon; no shipped item carries one', () => {
        const axe = store().addItem({ name: 'Rusty Fixture Axe', equipSlot: 'hand', type: 'tool', tool: { kind: 'woodaxe', tier: 1 }, breakChance: 1 });
        const sword = store().addItem({ name: 'Rusty Fixture Sword', equipSlot: 'hand', type: 'weapon', styles: ['melee'], breakChance: 1.5 });
        const files = syncPayload();
        expect(files['items.json'][axe].breakChance).toBe(1);
        expect(files['items.json'][sword].breakChance).toBe(1.5);
        const shipped = JSON.parse(raw['items.json']);
        expect(Object.values(shipped).filter(i => i.breakChance != null)).toEqual([]);
    });
});

describe('⭐ the audits name a chance that never breaks anything', () => {
    const items = {
        fx_axe: { id: 'fx_axe', name: 'Fine Axe', equipSlot: 'hand', tool: { kind: 'woodaxe', tier: 1 }, breakChance: 1 },
        fx_wild: { id: 'fx_wild', name: 'Wild Axe', equipSlot: 'hand', tool: { kind: 'woodaxe', tier: 1 }, breakChance: 140 },
        fx_hat: { id: 'fx_hat', name: 'Brittle Hat', equipSlot: 'hat', breakChance: 5 },
        fx_shield: { id: 'fx_shield', name: 'Brittle Shield', equipSlot: 'hand', offHand: true, breakChance: 5 }
    };

    it('the boot audit\'s rule: a value out of range, and a chance on something that is neither tool nor weapon', () => {
        const found = toolFindings({ items }).map(f => `${f.entityId}: ${f.message}`);
        expect(found).toEqual([
            'fx_wild: its Break chance "140" is not a percent above 0 and up to 100, so it never breaks',
            'fx_hat: has a Break chance, but only a tool or a weapon breaks, so it never will',
            'fx_shield: has a Break chance, but only a tool or a weapon breaks, so it never will'
        ]);
    });

    it('the CMS Economy Audit says the same, as warnings', () => {
        const issues = auditConnectivity({ items, tokens: {}, recipes: {}, effects: {} })
            .filter(i => /Break chance/.test(i.details));
        expect(issues.map(i => i.entityId).sort()).toEqual(['fx_hat', 'fx_shield', 'fx_wild']);
        expect(issues.every(i => i.severity === 'Warning')).toBe(true);
    });
});
