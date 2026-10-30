// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { asLoaded } from './fixtures/shippedAsLoaded.js';
import React from 'react';
import { render, cleanup, fireEvent, within, act } from '@testing-library/react';

import { useEntityStore } from '../../cms/src/stores/useEntityStore';
import { useSimulationStore } from '../../cms/src/stores/useSimulationStore';
import { syncFiles } from '../../cms/src/engine/recipeSync';
import ItemEditor from '../../cms/src/components/editors/ItemEditor.jsx';
import TokenEditor from '../../cms/src/components/editors/TokenEditor.jsx';
import { enemyProfileOf } from '../config/registries/enemyProfile.js';
import { weaponStyleOf, gearLevelRequirement } from '../config/registries/weaponStyles.js';

/**
 * ⭐ Gear and enemies in the CMS (brief 220, C2; classless heroes): a hand item that is not a tool is
 * a weapon with one style, damage and speed, and gear asks a level in its style; an enemy's numbers are filled from its level and kinds, shown as
 * defaults, and any can be typed over; the kinds are presets, none to two. Everything written
 * survives Recalculate, Sync and a reload unchanged.
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
function tokenEditor(id) {
    store().setActiveEntity(id, 'token');
    return render(React.createElement(TokenEditor));
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

// Rewritten with classless heroes: a weapon's style is one choice (it decides the style any hero
// fights in), the Recruit's tier rule is gone, and weapons and armour carry a level requirement.
describe('⭐ the item editor: a weapon has one style, damage and speed', () => {
    it('a hand item that is not a tool shows the Weapon fields; a tool or a hat does not', () => {
        const id = store().addItem({ name: 'Weapon Fixture', equipSlot: 'hand' });
        const { container, rerender } = itemEditor(id);
        for (const name of ['weapon-style', 'weapon-damage', 'weapon-speed', 'weapon-tier', 'gear-level']) {
            expect(field(container, name), name).not.toBeNull();
        }
        expect(field(container, 'gear-level-style')).toBeNull();

        fireEvent.change(field(container, 'tool-kind'), { target: { value: 'pickaxe' } });
        rerender(React.createElement(ItemEditor));
        expect(field(container, 'weapon-damage')).toBeNull();
        expect(field(container, 'gear-level')).toBeNull();

        const hat = store().addItem({ name: 'Hat Fixture', equipSlot: 'hat' });
        cleanup();
        const hatEditor = itemEditor(hat).container;
        expect(field(hatEditor, 'weapon-damage')).toBeNull();
        expect(field(hatEditor, 'gear-level')).not.toBeNull();
        expect(field(hatEditor, 'gear-level-style')).not.toBeNull();
    });

    it('picking a style writes that one, as a weapon; none written reads Melee', () => {
        const id = store().addItem({ name: 'Dagger Fixture', equipSlot: 'hand' });
        const { container } = itemEditor(id);
        expect(field(container, 'weapon-style').value).toBe('melee');
        expect(store().items[id].styles).toBeUndefined();
        fireEvent.change(field(container, 'weapon-style'), { target: { value: 'stealth' } });
        expect(store().items[id]).toMatchObject({ type: 'weapon', styles: ['stealth'] });
        fireEvent.change(field(container, 'weapon-style'), { target: { value: 'ranged' } });
        expect(store().items[id].styles).toEqual(['ranged']);
    });

    it('an older two-style weapon says it fights as its first; picking one keeps one', () => {
        const id = store().addItem({ name: 'Old Dagger Fixture', equipSlot: 'hand', styles: ['melee', 'stealth'] });
        const { container } = itemEditor(id);
        expect(field(container, 'weapon-style').value).toBe('melee');
        expect(field(container, 'weapon-style-many').textContent).toMatch(/Melee and Stealth.*fights as Melee/);
        fireEvent.change(field(container, 'weapon-style'), { target: { value: 'stealth' } });
        expect(store().items[id].styles).toEqual(['stealth']);
        expect(field(container, 'weapon-style-many')).toBeNull();
    });

    it('damage and speed are written as typed; Normal speed and a blank damage write nothing', () => {
        const id = store().addItem({ name: 'Dagger Fixture', equipSlot: 'hand' });
        const { container } = itemEditor(id);
        fireEvent.change(field(container, 'weapon-damage'), { target: { value: '2' } });
        fireEvent.change(field(container, 'weapon-speed'), { target: { value: 'fast' } });
        expect(store().items[id]).toMatchObject({ damage: 2, speed: 'fast' });

        fireEvent.change(field(container, 'weapon-speed'), { target: { value: 'normal' } });
        fireEvent.change(field(container, 'weapon-damage'), { target: { value: '' } });
        expect(store().items[id].speed).toBeUndefined();
        expect(store().items[id].damage).toBeUndefined();
    });

    it('the Tier box writes a whole number from 1 as `tier`; blank or 0 writes none (no tier)', () => {
        const id = store().addItem({ name: 'Tier Fixture', equipSlot: 'hand' });
        const { container } = itemEditor(id);
        expect(field(container, 'weapon-tier').value).toBe('');
        fireEvent.change(field(container, 'weapon-tier'), { target: { value: '1' } });
        expect(store().items[id]).toMatchObject({ type: 'weapon', tier: 1 });
        expect(field(container, 'weapon-tier').value).toBe('1');
        fireEvent.change(field(container, 'weapon-tier'), { target: { value: '2' } });
        expect(store().items[id].tier).toBe(2);
        fireEvent.change(field(container, 'weapon-tier'), { target: { value: '0' } });
        expect(store().items[id].tier).toBeUndefined();
        fireEvent.change(field(container, 'weapon-tier'), { target: { value: '1' } });
        fireEvent.change(field(container, 'weapon-tier'), { target: { value: '' } });
        expect(store().items[id].tier).toBeUndefined();
    });

    it('an older item\'s skillRequired style shows chosen and is folded into styles on the first pick', () => {
        const id = store().addItem({ name: 'Old Bow Fixture', equipSlot: 'hand', skillRequired: 'ranged' });
        const { container } = itemEditor(id);
        expect(field(container, 'weapon-style').value).toBe('ranged');
        fireEvent.change(field(container, 'weapon-style'), { target: { value: 'melee' } });
        expect(store().items[id].styles).toEqual(['melee']);
        expect(store().items[id].skillRequired).toBeUndefined();
    });

    it('a weapon\'s level is in its own style; blank or 0 writes none', () => {
        const id = store().addItem({ name: 'Iron Sword Fixture', equipSlot: 'hand', styles: ['melee'] });
        const { container } = itemEditor(id);
        fireEvent.change(field(container, 'gear-level'), { target: { value: '15' } });
        expect(store().items[id]).toMatchObject({ levelRequired: 15 });
        expect(store().items[id].skillRequired).toBeUndefined();
        expect(field(container, 'gear-level').parentElement.textContent).toMatch(/Needs Melee 15/);
        fireEvent.change(field(container, 'weapon-style'), { target: { value: 'ranged' } });
        expect(gearLevelRequirement(store().items[id])).toEqual({ skill: 'ranged', level: 15 });
        fireEvent.change(field(container, 'gear-level'), { target: { value: '0' } });
        expect(store().items[id].levelRequired).toBeUndefined();
    });

    it('armour names its style beside the level', () => {
        const id = store().addItem({ name: 'Helm Fixture', equipSlot: 'hat' });
        const { container } = itemEditor(id);
        fireEvent.change(field(container, 'gear-level-style'), { target: { value: 'magic' } });
        fireEvent.change(field(container, 'gear-level'), { target: { value: '30' } });
        expect(store().items[id]).toMatchObject({ skillRequired: 'magic', levelRequired: 30 });
        expect(gearLevelRequirement(store().items[id])).toEqual({ skill: 'magic', level: 30 });
        fireEvent.change(field(container, 'gear-level'), { target: { value: '' } });
        expect(store().items[id].levelRequired).toBeUndefined();
        expect(store().items[id].skillRequired).toBeUndefined();
    });

    it('making it a tool, or moving it out of the hands, clears the weapon fields and its level', () => {
        const id = store().addItem({ name: 'Sword Fixture', equipSlot: 'hand', styles: ['melee'], damage: 2, speed: 'slow', tier: 1, levelRequired: 15 });
        const { container } = itemEditor(id);
        fireEvent.change(field(container, 'tool-kind'), { target: { value: 'woodaxe' } });
        expect(store().items[id]).toMatchObject({ tool: { kind: 'woodaxe', tier: 1 } });
        for (const key of ['styles', 'damage', 'speed', 'tier', 'levelRequired']) expect(store().items[id][key], key).toBeUndefined();

        const other = store().addItem({ name: 'Sword Fixture Two', equipSlot: 'hand', styles: ['melee'], damage: 2, tier: 2, levelRequired: 15 });
        cleanup();
        const second = itemEditor(other).container;
        fireEvent.change(second.querySelector('select'), { target: { value: 'chest' } });
        for (const key of ['styles', 'damage', 'speed', 'tier', 'levelRequired']) expect(store().items[other][key], key).toBeUndefined();
    });

    it('a weapon reaches items.json as written and survives a reload; the game reads its style and level', () => {
        const id = store().addItem({ name: 'Round Trip Dagger', equipSlot: 'hand' });
        const { container } = itemEditor(id);
        fireEvent.change(field(container, 'weapon-style'), { target: { value: 'stealth' } });
        fireEvent.change(field(container, 'weapon-damage'), { target: { value: '1' } });
        fireEvent.change(field(container, 'weapon-speed'), { target: { value: 'fast' } });
        fireEvent.change(field(container, 'weapon-tier'), { target: { value: '1' } });
        fireEvent.change(field(container, 'gear-level'), { target: { value: '15' } });

        const files = expectStableRoundTrip();
        const written = files['items.json'][id];
        expect(written).toMatchObject({ type: 'weapon', equipSlot: 'hand', styles: ['stealth'], damage: 1, speed: 'fast', tier: 1, levelRequired: 15 });
        expect(weaponStyleOf(written)).toBe('stealth');
        expect(gearLevelRequirement(written)).toEqual({ skill: 'stealth', level: 15 });
        // Nothing else moved.
        const before = shipped()['items.json'];
        for (const other of Object.keys(before)) {
            expect(JSON.stringify(files['items.json'][other]), other).toBe(JSON.stringify(before[other]));
        }
    });
});

describe('⭐ the Token editor: an enemy\'s numbers, filled from the level and kinds', () => {
    const cow = 'token_cow';

    it('shows every number the level fills, as a default ("from level"), and writes nothing', () => {
        const before = JSON.stringify(store().tokens[cow].enemy);
        const { container } = tokenEditor(cow);
        const p = enemyProfileOf(store().tokens[cow]);
        expect(field(container, 'enemy-hp').value).toBe(String(p.hp));
        expect(field(container, 'enemy-hit').value).toBe(String(p.hit));
        expect(field(container, 'enemy-armor').value).toBe(String(p.armor));
        expect(field(container, 'enemy-xp').value).toBe(String(p.xpAwarded));
        expect(field(container, 'enemy-dodge').value).toBe('0');
        expect(field(container, 'enemy-critChance').value).toBe('5');
        expect(field(container, 'enemy-speed').value).toBe('');
        expect(field(container, 'enemy-speed').selectedOptions[0].textContent).toBe('Normal (3 s)');
        expect(field(container, 'enemy-hp-source').textContent).toBe('from level');
        expect(JSON.stringify(store().tokens[cow].enemy)).toBe(before);
    });

    it('a typed number is the author\'s ("yours") and wins; the button puts the filled one back', () => {
        const { container } = tokenEditor(cow);
        fireEvent.change(field(container, 'enemy-hp'), { target: { value: '30' } });
        expect(store().tokens[cow].enemy.hp).toBe(30);
        expect(field(container, 'enemy-hp-source').textContent).toBe('yours · back to 21');
        expect(enemyProfileOf(store().tokens[cow]).hp).toBe(30);

        fireEvent.click(within(field(container, 'enemy-hp-source')).getByRole('button'));
        expect(store().tokens[cow].enemy).not.toHaveProperty('hp');
        expect(field(container, 'enemy-hp').value).toBe('21');
    });

    it('a new level moves every number the author has not typed, and none they have', () => {
        const { container } = tokenEditor(cow);
        fireEvent.change(field(container, 'enemy-xp'), { target: { value: '7' } });
        fireEvent.change(field(container, 'enemy-level'), { target: { value: '30' } });
        expect(field(container, 'enemy-hp').value).toBe('50');
        expect(field(container, 'enemy-hit').value).toBe('2');
        expect(field(container, 'enemy-armor').value).toBe('1');
        expect(field(container, 'enemy-xp').value).toBe('7');
    });

    it('the speed list: blank is the filled speed; a pick is written; blank again removes it', () => {
        const { container } = tokenEditor(cow);
        fireEvent.change(field(container, 'enemy-speed'), { target: { value: 'fast' } });
        expect(store().tokens[cow].enemy.speed).toBe('fast');
        fireEvent.change(field(container, 'enemy-speed'), { target: { value: '' } });
        expect(store().tokens[cow].enemy).not.toHaveProperty('speed');
    });

    it('an older enemy shows its budget scale; one without does not', () => {
        expect(within(tokenEditor(cow).container).queryByLabelText('Budget scale')).toBeNull();
        cleanup();
        store().updateToken(cow, { enemy: { level: 1, style: 'melee', budgetScale: 0.3 } });
        const scale = within(tokenEditor(cow).container).queryByLabelText('Budget scale');
        expect(scale).not.toBeNull();
        expect(scale.value).toBe('0.3');
    });
});

describe('⭐ the kinds: none, one or two presets', () => {
    const cow = 'token_cow';

    it('ticking Armoured writes it and the numbers follow (+2 armour, a 4 s swing)', () => {
        const { container } = tokenEditor(cow);
        fireEvent.click(field(container, 'enemy-kind-armoured'));
        expect(store().tokens[cow].enemy.kinds).toEqual(['armoured']);
        expect(field(container, 'enemy-armor').value).toBe('2');
        expect(field(container, 'enemy-speed').selectedOptions[0].textContent).toBe('Slow (4 s)');
        expect(field(container, 'enemy-armor-source').textContent).toBe('from level + kinds');
    });

    it('Swift cannot go with Armoured (both set the swing); a third kind cannot be ticked', () => {
        const { container } = tokenEditor(cow);
        fireEvent.click(field(container, 'enemy-kind-armoured'));
        expect(field(container, 'enemy-kind-swift').disabled).toBe(true);
        expect(field(container, 'enemy-kind-brute').disabled).toBe(false);
        fireEvent.click(field(container, 'enemy-kind-nimble'));
        expect(store().tokens[cow].enemy.kinds).toEqual(['armoured', 'nimble']);
        for (const kind of ['brute', 'venomous', 'swift']) expect(field(container, `enemy-kind-${kind}`).disabled, kind).toBe(true);

        fireEvent.click(field(container, 'enemy-kind-armoured'));
        fireEvent.click(field(container, 'enemy-kind-nimble'));
        expect(store().tokens[cow].enemy).not.toHaveProperty('kinds');
    });

    it('kinds and typed numbers reach tokens.json as written, survive a reload, and the fight reads them', () => {
        const { container } = tokenEditor(cow);
        fireEvent.click(field(container, 'enemy-kind-brute'));
        fireEvent.click(field(container, 'enemy-kind-venomous'));
        fireEvent.change(field(container, 'enemy-dodge'), { target: { value: '5' } });

        const files = expectStableRoundTrip();
        const written = files['tokens.json'][cow];
        expect(written.enemy).toEqual({ level: 1, style: 'melee', kinds: ['brute', 'venomous'], dodge: 5 });
        expect(enemyProfileOf(written)).toMatchObject({ hit: 2, speed: 'slow', dodge: 5, kinds: ['brute', 'venomous'] });
        const before = shipped()['tokens.json'];
        for (const other of Object.keys(before).filter(t => t !== cow)) {
            expect(JSON.stringify(files['tokens.json'][other]), other).toBe(JSON.stringify(before[other]));
        }
    });

    it('the preview shows what the fight uses, kinds included: Venomous lands the Poison status effect', () => {
        // A library without Poison, whatever ships.
        act(() => useEntityStore.setState((s) => {
            const { effect_poison: _gone, ...effects } = s.effects;
            return { effects };
        }));
        const { container } = tokenEditor(cow);
        fireEvent.click(field(container, 'enemy-kind-venomous'));
        const box = () => within(container).getByText('What the fight uses').parentElement.parentElement;
        // No Poison in the library yet: the preview says so.
        expect(box().textContent).toContain('On hiteffect_poison (missing)');
        // Once the library has it, its name.
        act(() => useEntityStore.setState((s) => ({
            effects: { ...s.effects, effect_poison: { id: 'effect_poison', name: 'Poison', status: { stacks: 3, ticks: 0 }, statements: [] } }
        })));
        expect(box().textContent).toContain('On hitPoison');
    });
});
