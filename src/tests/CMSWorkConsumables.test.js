// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { asLoaded } from './fixtures/shippedAsLoaded.js';
import React from 'react';
import { render, cleanup } from '@testing-library/react';

import { useEntityStore } from '../../cms/src/stores/useEntityStore';
import { useSimulationStore } from '../../cms/src/stores/useSimulationStore';
import { syncFiles } from '../../cms/src/engine/recipeSync';
import { doseKindsOf as CMS_DOSE_KINDS_OF } from '../../cms/src/utils/constants';
import { doseKindsOf } from '../systems/core/consumableRule.js';
import ItemEditor from '../../cms/src/components/editors/ItemEditor.jsx';
import { slotsOf, slotsWithoutWords } from '../systems/effects/statementSlots.js';
import { renderSegments } from '../systems/effects/statementText.js';
import { makeStatement, KEYWORD } from '../systems/effects/statements.js';

/**
 * Brief 230 S6b in the CMS: the skill on On Work Start, "for the cycle", and the Item editor saying
 * how a food, drink or potion is used (an elixir 10 fights, a drink 10 work cycles, a work potion
 * one cycle of its skill), with a warning on an always-on rule that one would ignore. Carried
 * through Recalculate and Sync byte-identical.
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

const workStart = (effectId, skill) => ({
    ...makeStatement(KEYWORD.APPLIES),
    id: `stm_cms_${effectId}`,
    when: { event: 'WORK_START', scope: 'self', ...(skill ? { skill } : {}) },
    target: { role: 'actor' },
    payload: { effectId, scale: 1, durationMs: 0, forCycle: true, chance: 100 }
});
const standing = (id) => ({ ...makeStatement(KEYWORD.PROVIDES), id, payload: { type: 'WORK_TIME', bucket: 'percentage', value: -0.1 } });

/** Shipped content plus a Birdwatcher, a Coffee and an always-on potion, as an author would make them. */
function withS6b(files) {
    const out = Object.fromEntries(FILES.map((f) => [f, JSON.parse(JSON.stringify(files[f]))]));
    Object.assign(out['effects.json'], {
        effect_cms_birdwatcher: { id: 'effect_cms_birdwatcher', name: 'Birdwatcher', statements: [{ ...makeStatement(KEYWORD.GRANTS), id: 'stm_cms_nest', payload: { type: 'BONUS_DROP', itemId: 'item_water', quantity: 1, chance: 25 } }] },
        effect_cms_birdwatcher_potion: { id: 'effect_cms_birdwatcher_potion', name: 'Birdwatcher Potion', statements: [workStart('effect_cms_birdwatcher', 'forestry')] },
        effect_cms_coffee: { id: 'effect_cms_coffee', name: 'Coffee', statements: [standing('stm_cms_coffee')] },
        effect_cms_coffee_drink: { id: 'effect_cms_coffee_drink', name: 'Coffee Drink', statements: [workStart('effect_cms_coffee')] }
    });
    Object.assign(out['items.json'], {
        item_cms_birdwatcher: { id: 'item_cms_birdwatcher', name: 'Birdwatcher', type: 'potion', equipSlot: 'consumable', stackable: true, sprite: 'i_potion_shrimp_pink', effects: [{ effectId: 'effect_cms_birdwatcher_potion', scale: 1 }] },
        item_cms_coffee: { id: 'item_cms_coffee', name: 'Coffee', type: 'drink', equipSlot: 'drink', stackable: true, sprite: 'i_potion_shrimp_pink', effects: [{ effectId: 'effect_cms_coffee_drink', scale: 1 }] },
        item_cms_haste: { id: 'item_cms_haste', name: 'Haste Potion', type: 'potion', equipSlot: 'consumable', stackable: true, sprite: 'i_potion_shrimp_pink', effects: [{ effectId: 'effect_cms_coffee', scale: 1 }] },
        item_cms_charm: { id: 'item_cms_charm', name: 'Haste Charm', type: 'armor', equipSlot: 'trinket', stackable: true, sprite: 'i_potion_shrimp_pink', effects: [{ effectId: 'effect_cms_coffee', scale: 1 }] },
        // A drink with no rule: the shipped Water now carries one.
        item_cms_plain_water: { id: 'item_cms_plain_water', name: 'Plain Water', type: 'drink', equipSlot: 'drink', stackable: true, sprite: 'i_potion_shrimp_pink' }
    });
    return out;
}

const shipped = () => Object.fromEntries(FILES.map((f) => [f, JSON.parse(raw[f])]));
const store = () => useEntityStore.getState();
const syncPayload = () => syncFiles(store().recalculateEconomy({}));
const asFile = (files) => Object.fromEntries(FILES.map((f) => [f, JSON.parse(JSON.stringify(files[f], null, 2))]));

function openItem(id) {
    store().setActiveEntity(id, 'item');
    return render(React.createElement(ItemEditor)).container;
}
const q = (container, sel) => container.querySelector(sel);

const noStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
let storedBefore;
beforeAll(() => {
    storedBefore = globalThis.localStorage?.getItem('fantasy-guild-cms-v2') ?? null;
    useEntityStore.persist.setOptions({ storage: noStorage });
});
beforeEach(() => store().hydrate(workspaceFromFiles(withS6b(shipped()))));
afterEach(() => {
    cleanup();
    useSimulationStore.getState().clearResults();
    expect(globalThis.localStorage?.getItem('fantasy-guild-cms-v2') ?? null).toBe(storedBefore);
});

describe('⭐ On Work Start and "for the cycle" in the Rules line', () => {
    const slot = (statement, id) => slotsOf(statement, {}).find((s) => s.id === id);

    it('offers a skill on On Work Start: Any skill first, then the game\'s skills; picking writes it, Any clears it', () => {
        const statement = workStart('effect_cms_coffee');
        const skill = slot(statement, 'skill');
        expect(skill.options[0]).toMatchObject({ id: '', label: 'Any skill' });
        expect(skill.options.map((o) => o.id)).toContain('forestry');
        expect(skill.patch('forestry').when).toEqual({ event: 'WORK_START', scope: 'self', skill: 'forestry' });
        expect(slot({ ...statement, when: { ...statement.when, skill: 'forestry' } }, 'skill').patch('').when)
            .toEqual({ event: 'WORK_START', scope: 'self' });
    });

    it('the chosen skill is a word in the sentence; Any skill is a quiet chip beside it', () => {
        const named = { ...workStart('effect_cms_coffee'), when: { event: 'WORK_START', scope: 'self', skill: 'forestry' } };
        expect(renderSegments(named, { effect: () => 'Coffee' }).find((s) => s.slot === 'skill')?.text).toBe('Forestry');
        const any = workStart('effect_cms_coffee');
        expect(slotsWithoutWords(slotsOf(any, {}), renderSegments(any, {})).map((s) => s.id)).toContain('skill');
    });

    it('a carried moment offers no cooldown; leaving it for another moment drops the skill', () => {
        const statement = { ...workStart('effect_cms_coffee'), when: { event: 'WORK_START', scope: 'self', skill: 'mining' } };
        expect(slot(statement, 'cooldown')).toBeUndefined();
        const moved = slot(statement, 'moment').patch('CYCLE_START').when;
        expect(moved).not.toHaveProperty('skill');
        expect(moved.event).toBe('CYCLE_START');
        expect(slot({ ...statement, when: moved }, 'skill')).toBeUndefined();
    });

    it('"for the cycle" is offered on a work moment, and where already set; it writes forCycle', () => {
        const statement = workStart('effect_cms_coffee');
        const flag = slot(statement, 'forCycle');
        expect(flag).toMatchObject({ label: 'for the cycle', value: true });
        expect(flag.patch(false).payload).not.toHaveProperty('forCycle');
        const onFight = { ...statement, when: { event: 'COMBAT_ENGAGED', scope: 'nearby' }, payload: { effectId: 'x', chance: 100 } };
        expect(slot(onFight, 'forCycle')).toBeUndefined();
        expect(slot({ ...onFight, payload: { ...onFight.payload, forCycle: true } }, 'forCycle')).toBeDefined();
    });
});

describe('⭐ the Item editor says how a food, drink or potion is used', () => {
    it('reads the game\'s own rule', () => {
        expect(CMS_DOSE_KINDS_OF).toBe(doseKindsOf);
    });

    it('a drink with an On Work Start rule lasts ten work cycles', () => {
        const container = openItem('item_cms_coffee');
        expect(q(container, '[data-dose="drink"]').textContent).toContain('lasts 10 work cycles');
    });

    it('a work potion is drunk for each cycle of its skill', () => {
        const container = openItem('item_cms_birdwatcher');
        expect(q(container, '[data-dose="potion"]').textContent).toContain('each time a work cycle of its skill starts');
    });

    it('an elixir lasts ten fights', () => {
        const container = openItem('item_elixir_of_valor');
        expect(q(container, '[data-dose="elixir"]').textContent).toContain('lasts 10 fights');
    });

    it('a drink with no work rule says it does nothing; gear says nothing', () => {
        expect(q(openItem('item_cms_plain_water'), '[data-dose="none"]').textContent).toContain('does nothing');
        cleanup();
        expect(q(openItem('item_cms_charm'), '[data-field="dose"]')).toBeNull();
    });

    it('warns on an always-on rule on a potion, not on the same rule worn on a trinket', () => {
        expect(q(openItem('item_cms_haste'), '[data-always-on-warning]').textContent).toContain('does nothing');
        cleanup();
        expect(q(openItem('item_cms_charm'), '[data-always-on-warning]')).toBeNull();
        cleanup();
        expect(q(openItem('item_cms_coffee'), '[data-always-on-warning]')).toBeNull();
    });
});

describe('⭐ through Recalculate, Sync and a reload', () => {
    it('the skill and "for the cycle" survive, and a second sync is byte-identical', () => {
        const first = asFile(syncPayload());
        expect(first['effects.json'].effect_cms_birdwatcher_potion.statements[0].when).toMatchObject({ event: 'WORK_START', skill: 'forestry' });
        expect(first['effects.json'].effect_cms_coffee_drink.statements[0].payload.forCycle).toBe(true);

        store().hydrate(workspaceFromFiles(first));
        const second = asFile(syncPayload());
        for (const f of FILES) expect(JSON.stringify(second[f], null, 2)).toBe(JSON.stringify(first[f], null, 2));
    });

    it('today\'s data still round-trips byte-identical', () => {
        store().hydrate(workspaceFromFiles(shipped()));
        const files = syncPayload();
        for (const f of FILES) expect(JSON.stringify(files[f], null, 2)).toBe(raw[f].trimEnd());
    });
});
