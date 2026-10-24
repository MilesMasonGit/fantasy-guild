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
import { weaponStylesOf } from '../config/registries/weaponStyles.js';

/**
 * ⭐ Gear and enemies in the CMS (brief 220, C2): a hand item that is not a tool is a weapon with
 * styles, damage and speed; an enemy's numbers are filled from its level and kinds, shown as
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

describe('⭐ the item editor: a weapon has styles, damage and speed', () => {
    it('a hand item that is not a tool shows the Weapon fields; a tool or a hat does not', () => {
        const id = store().addItem({ name: 'Weapon Fixture', equipSlot: 'hand' });
        const { container, rerender } = itemEditor(id);
        for (const name of ['weapon-style-melee', 'weapon-style-ranged', 'weapon-style-magic', 'weapon-style-stealth', 'weapon-damage', 'weapon-speed']) {
            expect(field(container, name), name).not.toBeNull();
        }

        fireEvent.change(field(container, 'tool-kind'), { target: { value: 'pickaxe' } });
        rerender(React.createElement(ItemEditor));
        expect(field(container, 'weapon-damage')).toBeNull();

        const hat = store().addItem({ name: 'Hat Fixture', equipSlot: 'hat' });
        cleanup();
        expect(field(itemEditor(hat).container, 'weapon-damage')).toBeNull();
    });

    it('ticking Stealth then Melee writes both in the game\'s order, as a weapon; none ticked removes the key', () => {
        const id = store().addItem({ name: 'Dagger Fixture', equipSlot: 'hand' });
        const { container } = itemEditor(id);
        fireEvent.click(field(container, 'weapon-style-stealth'));
        fireEvent.click(field(container, 'weapon-style-melee'));
        expect(store().items[id]).toMatchObject({ type: 'weapon', styles: ['melee', 'stealth'] });
        expect(field(container, 'weapon-style-melee').checked).toBe(true);

        fireEvent.click(field(container, 'weapon-style-melee'));
        fireEvent.click(field(container, 'weapon-style-stealth'));
        expect(store().items[id].styles).toBeUndefined();
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

    it('an older item\'s skillRequired style shows ticked and is folded into styles on the first change', () => {
        const id = store().addItem({ name: 'Old Bow Fixture', equipSlot: 'hand', skillRequired: 'ranged' });
        const { container } = itemEditor(id);
        expect(field(container, 'weapon-style-ranged').checked).toBe(true);
        fireEvent.click(field(container, 'weapon-style-melee'));
        expect(store().items[id].styles).toEqual(['melee', 'ranged']);
        expect(store().items[id].skillRequired).toBeUndefined();
    });

    it('making it a tool, or moving it out of the hands, clears the weapon fields', () => {
        const id = store().addItem({ name: 'Sword Fixture', equipSlot: 'hand', styles: ['melee'], damage: 2, speed: 'slow' });
        const { container } = itemEditor(id);
        fireEvent.change(field(container, 'tool-kind'), { target: { value: 'woodaxe' } });
        expect(store().items[id]).toMatchObject({ tool: { kind: 'woodaxe', tier: 1 } });
        for (const key of ['styles', 'damage', 'speed']) expect(store().items[id][key], key).toBeUndefined();

        const other = store().addItem({ name: 'Sword Fixture Two', equipSlot: 'hand', styles: ['melee'], damage: 2 });
        cleanup();
        const second = itemEditor(other).container;
        fireEvent.change(second.querySelector('select'), { target: { value: 'chest' } });
        for (const key of ['styles', 'damage', 'speed']) expect(store().items[other][key], key).toBeUndefined();
    });

    it('a weapon reaches items.json as written and survives a reload; the game reads its styles', () => {
        const id = store().addItem({ name: 'Round Trip Dagger', equipSlot: 'hand' });
        const { container } = itemEditor(id);
        fireEvent.click(field(container, 'weapon-style-melee'));
        fireEvent.click(field(container, 'weapon-style-stealth'));
        fireEvent.change(field(container, 'weapon-damage'), { target: { value: '1' } });
        fireEvent.change(field(container, 'weapon-speed'), { target: { value: 'fast' } });

        const files = expectStableRoundTrip();
        const written = files['items.json'][id];
        expect(written).toMatchObject({ type: 'weapon', equipSlot: 'hand', styles: ['melee', 'stealth'], damage: 1, speed: 'fast' });
        expect(weaponStylesOf(written)).toEqual(['melee', 'stealth']);
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
        expect(within(tokenEditor('token_goblin').container).queryByLabelText('Budget scale')).not.toBeNull();
        cleanup();
        expect(within(tokenEditor(cow).container).queryByLabelText('Budget scale')).toBeNull();
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
