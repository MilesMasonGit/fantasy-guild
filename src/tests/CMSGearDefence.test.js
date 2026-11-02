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
import ItemEditor from '../../cms/src/components/editors/ItemEditor.jsx';
import { gearResistancesOf, gearDamageCutOf } from '../config/registries/gearDefence.js';
import { isOffHand, isWeapon } from '../config/registries/weaponStyles.js';

/**
 * ⭐ Gear's defence in the CMS (brief 280 V2): a hand item that is not a tool is held as a weapon or
 * as an off-hand item; any worn piece has a Defence block, its resistances in free percents by type
 * or group and its damage cut to named styles; everything written survives Recalculate, Sync and a
 * reload unchanged, and the Economy Audit names a stack reaching 100 %. A workspace still holding
 * the Poison status moves it to Venom on load.
 *
 * ⚠️ No real workspace: the store's persistence is a no-op here (TESTING, "The CMS").
 */

const DATA = path.resolve(__dirname, '../../data');
const FILES = ['items.json', 'tokens.json', 'tokenRecipes.json', 'effects.json'];
const read = (file) => fs.readFileSync(path.join(DATA, file), 'utf8').replace(/\r\n/g, '\n');
const raw = Object.fromEntries(FILES.map((f) => [f, asLoaded(f, read(f))]));

/** The shipped content as a workspace saved before the rename: Venom back under Poison's id and name, in its place. */
function withPoison() {
    const files = Object.fromEntries(FILES.map((f) => [f, JSON.parse(read(f).replaceAll('"effect_venom"', '"effect_poison"'))]));
    files['effects.json'].effect_poison.name = 'Poison';
    return files;
}

function workspaceFromFiles(files) {
    const recipePools = {};
    for (const recipe of files['tokenRecipes.json']) (recipePools[recipe.skill || 'general'] ||= []).push(recipe);
    return { items: files['items.json'], tokens: files['tokens.json'], effects: files['effects.json'], recipePools };
}
const load = (files) => useEntityStore.getState().hydrate(workspaceFromFiles(files));
const shipped = () => Object.fromEntries(FILES.map((f) => [f, JSON.parse(raw[f])]));
const syncPayload = () => JSON.parse(JSON.stringify(syncFiles(useEntityStore.getState().recalculateEconomy({}))));

const noStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
let storedBefore;
beforeAll(() => {
    storedBefore = globalThis.localStorage?.getItem('fantasy-guild-cms-v2') ?? null;
    useEntityStore.persist.setOptions({ storage: noStorage });
});
beforeEach(() => load(shipped()));
afterEach(() => {
    cleanup();
    useSimulationStore.getState().clearResults();
    expect(globalThis.localStorage?.getItem('fantasy-guild-cms-v2') ?? null).toBe(storedBefore);
});

const field = (container, name) => container.querySelector(`[data-field="${name}"]`);
const store = () => useEntityStore.getState();
function itemEditor(id) {
    store().setActiveEntity(id, 'item');
    return render(React.createElement(ItemEditor));
}

/** A second load of a sync and a second sync change nothing. */
function expectStableRoundTrip() {
    const first = syncPayload();
    const serialised = Object.fromEntries(FILES.map((f) => [f, JSON.stringify(first[f], null, 2)]));
    load(Object.fromEntries(FILES.map((f) => [f, JSON.parse(serialised[f])])));
    const second = syncPayload();
    for (const f of FILES) expect(JSON.stringify(second[f], null, 2), f).toBe(serialised[f]);
    return first;
}

describe('⭐ the item editor: held as a weapon or an off-hand item', () => {
    it('Held as Off-hand writes the mark, hides the weapon fields and clears their numbers; Weapon takes it back', () => {
        const id = store().addItem({ name: 'Shield Fixture', equipSlot: 'hand' });
        const { container } = itemEditor(id);
        fireEvent.change(field(container, 'weapon-damage'), { target: { value: '3' } });
        expect(store().items[id].damage).toBe(3);
        fireEvent.change(field(container, 'held-as'), { target: { value: 'offhand' } });
        expect(store().items[id]).toMatchObject({ offHand: true, type: 'armor' });
        expect(store().items[id].damage).toBeUndefined();
        expect(isOffHand(store().items[id])).toBe(true);
        expect(field(container, 'weapon-style')).toBeNull();
        expect(field(container, 'hands')).toBeNull();
        expect(field(container, 'gear-defence')).not.toBeNull();

        fireEvent.change(field(container, 'held-as'), { target: { value: 'weapon' } });
        expect(store().items[id].offHand).toBeUndefined();
        expect(isWeapon(store().items[id])).toBe(true);
        expect(field(container, 'weapon-style')).not.toBeNull();
    });

    it('a tool shows no Held as, and leaving the hands clears the mark', () => {
        const id = store().addItem({ name: 'Off Fixture', equipSlot: 'hand' });
        const { container } = itemEditor(id);
        fireEvent.change(field(container, 'held-as'), { target: { value: 'offhand' } });
        fireEvent.change(field(container, 'tool-kind'), { target: { value: 'pickaxe' } });
        expect(store().items[id].offHand).toBeUndefined();
        expect(field(container, 'held-as')).toBeNull();
    });
});

describe('⭐ the Defence block: resistances and a damage cut on any worn piece', () => {
    it('adds, edits and removes resistance lines and cuts; the last removed drops the key', () => {
        const id = store().addItem({ name: 'Plate Fixture', equipSlot: 'chest' });
        const { container } = itemEditor(id);
        fireEvent.change(field(container, 'gear-resist-add'), { target: { value: 'physical' } });
        expect(store().items[id].resistances).toEqual({ physical: 10 });
        fireEvent.change(field(container, 'gear-resist-physical-value'), { target: { value: '20' } });
        fireEvent.change(field(container, 'gear-resist-add'), { target: { value: 'fire' } });
        fireEvent.change(field(container, 'gear-resist-fire-value'), { target: { value: '-10' } });
        expect(store().items[id].resistances).toEqual({ physical: 20, fire: -10 });

        fireEvent.change(field(container, 'gear-cut-add'), { target: { value: 'magic' } });
        fireEvent.change(field(container, 'gear-cut-magic-value'), { target: { value: '30' } });
        expect(store().items[id].damageCut).toEqual({ magic: 30 });
        expect(gearResistancesOf(store().items[id])).toEqual({ physical: 20, fire: -10 });
        expect(gearDamageCutOf(store().items[id])).toEqual({ magic: 30 });

        fireEvent.change(field(container, 'gear-cut-magic-value'), { target: { value: '' } });
        expect(store().items[id].damageCut).toBeUndefined();
        fireEvent.change(field(container, 'gear-resist-fire-value'), { target: { value: '0' } });
        expect(store().items[id].resistances).toEqual({ physical: 20 });
    });

    it('a food has no Defence block, and leaving the gear categories clears the fields', () => {
        const id = store().addItem({ name: 'Ring Fixture', equipSlot: 'trinket' });
        const { container, rerender } = itemEditor(id);
        fireEvent.change(field(container, 'gear-resist-add'), { target: { value: 'ice' } });
        store().updateItem(id, { equipSlot: 'food' });
        rerender(React.createElement(ItemEditor));
        expect(field(container, 'gear-defence')).toBeNull();
        const select = container.querySelector('select');
        fireEvent.change(select, { target: { value: 'food' } });
        expect(store().items[id].resistances).toBeUndefined();
    });

    it('everything written reaches items.json as written, survives a reload, and changes nothing else', () => {
        const id = store().addItem({ name: 'Kite Fixture', equipSlot: 'hand' });
        const { container } = itemEditor(id);
        fireEvent.change(field(container, 'held-as'), { target: { value: 'offhand' } });
        fireEvent.change(field(container, 'gear-resist-add'), { target: { value: 'physical' } });
        fireEvent.change(field(container, 'gear-cut-add'), { target: { value: 'stealth' } });
        const files = expectStableRoundTrip();
        expect(files['items.json'][id]).toMatchObject({ offHand: true, resistances: { physical: 10 }, damageCut: { stealth: 15 } });
        const before = shipped()['items.json'];
        for (const other of Object.keys(before)) {
            expect(JSON.stringify(files['items.json'][other]), other).toBe(JSON.stringify(before[other]));
        }
    });
});

describe('the Economy Audit names a stack reaching 100 %', () => {
    it('two pieces at 50 % Fire are named once; a third shipped-content stack is not', () => {
        const a = store().addItem({ name: 'Fire Hat Fixture', equipSlot: 'hat' });
        const b = store().addItem({ name: 'Fire Chest Fixture', equipSlot: 'chest' });
        store().updateItem(a, { resistances: { fire: 50 } });
        store().updateItem(b, { resistances: { elemental: 50 } });
        const s = store();
        const issues = auditConnectivity({ items: s.items, tokens: s.tokens, recipes: {}, effects: s.effects, skillPerks: s.skillPerks });
        const named = issues.filter(i => /best stack/.test(i.details));
        expect(named).toHaveLength(1);
        expect(named[0].details).toContain('Fire 100%');
        expect(named[0].severity).toBe('Critical');
    });
});

describe('a workspace still holding the Poison status', () => {
    it('loads with Venom under its new id, every reference following, and Syncs it so', () => {
        const old = withPoison();
        expect(old['effects.json'].effect_venom).toBeUndefined();
        expect(old['effects.json'].effect_greater_slime_moves.statements[0].payload.effectId).toBe('effect_poison');
        load(old);
        const s = store();
        expect(s.effects.effect_poison).toBeUndefined();
        expect(s.effects.effect_venom).toMatchObject({ id: 'effect_venom', name: 'Venom', status: { stacks: 3, ticks: 0 } });
        expect(s.effects.effect_greater_slime_moves.statements[0].payload.effectId).toBe('effect_venom');
        expect(JSON.stringify([s.tokens, s.items, s.effects])).not.toContain('effect_poison');
        // The library keeps its order: Venom sits where Poison sat.
        const ids = Object.keys(s.effects);
        expect(ids.indexOf('effect_venom')).toBe(Object.keys(old['effects.json']).indexOf('effect_poison'));
        const files = syncPayload();
        expect(files['effects.json'].effect_venom.name).toBe('Venom');
        expect(files['effects.json'].effect_poison).toBeUndefined();
    });
});
