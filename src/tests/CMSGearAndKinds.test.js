// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { asLoaded } from './fixtures/shippedAsLoaded.js';
import React from 'react';
import { render, cleanup, fireEvent, within } from '@testing-library/react';

import { useEntityStore } from '../../cms/src/stores/useEntityStore';
import { useSimulationStore } from '../../cms/src/stores/useSimulationStore';
import { syncFiles } from '../../cms/src/engine/recipeSync';
import ItemEditor from '../../cms/src/components/editors/ItemEditor.jsx';
import TokenEditor from '../../cms/src/components/editors/TokenEditor.jsx';
import EffectEditor from '../../cms/src/components/editors/EffectEditor.jsx';
import { enemyProfileOf } from '../config/registries/enemyProfile.js';
import { weaponStyleOf, gearLevelRequirement } from '../config/registries/weaponStyles.js';

/**
 * ⭐ Gear and enemies in the CMS (brief 220, C2; classless heroes): a hand item that is not a tool is
 * a weapon with one style, damage and speed, and gear asks a level in its style; an enemy's numbers are filled from its level, shown as
 * defaults, and any can be typed over; its kinds are none to two library effects, whose numbers add in a fight. Everything written
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

    it('a Magic weapon names the Mote it burns; a Stealth one may be thrown; another style clears either', () => {
        const mote = store().addItem({ name: 'Fixture Fire Mote', equipSlot: 'consumable' });
        const id = store().addItem({ name: 'Wand Fixture', equipSlot: 'hand', styles: ['magic'] });
        const { container, rerender } = itemEditor(id);
        expect(field(container, 'weapon-thrown')).toBeNull();
        const picker = field(container, 'weapon-mote');
        expect([...picker.options].some(o => o.value === mote)).toBe(true);
        // Only Consumables are offered.
        expect([...picker.options].some(o => o.value === id)).toBe(false);
        fireEvent.change(picker, { target: { value: mote } });
        expect(store().items[id].mote).toBe(mote);
        fireEvent.change(field(container, 'weapon-mote'), { target: { value: '' } });
        expect(store().items[id].mote).toBeUndefined();
        fireEvent.change(field(container, 'weapon-mote'), { target: { value: mote } });

        fireEvent.change(field(container, 'weapon-style'), { target: { value: 'stealth' } });
        rerender(React.createElement(ItemEditor));
        expect(store().items[id].mote).toBeUndefined();
        expect(field(container, 'weapon-mote')).toBeNull();
        fireEvent.click(field(container, 'weapon-thrown'));
        expect(store().items[id].thrown).toBe(true);
        fireEvent.change(field(container, 'weapon-style'), { target: { value: 'melee' } });
        expect(store().items[id].thrown).toBeUndefined();
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
        // Flat armour and Pierce are retired with damage types: no box for either.
        expect(field(container, 'enemy-armor')).toBeNull();
        expect(field(container, 'enemy-pierce')).toBeNull();
        expect(field(container, 'enemy-xp').value).toBe(String(p.xpAwarded));
        expect(field(container, 'enemy-dodge').value).toBe('0');
        expect(field(container, 'enemy-critChance').value).toBe('5');
        expect(field(container, 'enemy-speed').value).toBe('');
        expect(field(container, 'enemy-speed').selectedOptions[0].textContent).toBe('3 s (Normal)');
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
        // 20 + 30, and 4 more HP per 30 levels where 1 armour was.
        expect(field(container, 'enemy-hp').value).toBe('54');
        expect(field(container, 'enemy-hit').value).toBe('2');
        expect(field(container, 'enemy-xp').value).toBe('7');
    });

    it('the speed list: blank is the filled speed; a pick is written; blank again removes it', () => {
        const { container } = tokenEditor(cow);
        fireEvent.change(field(container, 'enemy-speed'), { target: { value: 'fast' } });
        expect(store().tokens[cow].enemy.speed).toBe('fast');
        fireEvent.change(field(container, 'enemy-speed'), { target: { value: '' } });
        expect(store().tokens[cow].enemy).not.toHaveProperty('speed');
    });

    it('there is no Boss or Budget scale box; leftovers the game no longer reads are named and removed with one click', () => {
        const first = tokenEditor(cow).container;
        expect(within(first).queryByLabelText('Budget scale')).toBeNull();
        expect(within(first).queryByLabelText('Boss')).toBeNull();
        expect(field(first, 'enemy-leftovers')).toBeNull();
        cleanup();
        store().updateToken(cow, { enemy: { level: 1, style: 'melee', budgetScale: 0.3, boss: true, hostile: true } });
        const { container } = tokenEditor(cow);
        expect(field(container, 'enemy-leftovers').textContent).toContain('boss, hostile, budgetScale');
        // The level fills the numbers: a budget scale no longer scales them.
        expect(field(container, 'enemy-hp').value).toBe('21');
        fireEvent.click(field(container, 'enemy-leftovers-remove'));
        expect(store().tokens[cow].enemy).toEqual({ level: 1, style: 'melee' });
    });

    it('an enemy\'s work-cycle XP is shown as never paid (a kill pays its level\'s), and one click removes it', () => {
        // As the Cow was written before its work-cycle XP was taken off.
        store().updateToken(cow, { config: { ...store().tokens[cow].config, xp: 2 } });
        expect(store().tokens[cow].config.xp).toBe(2);
        const { container } = tokenEditor(cow);
        expect(field(container, 'enemy-cycle-xp').textContent).toContain('a kill never pays it');
        fireEvent.click(field(container, 'enemy-cycle-xp-remove'));
        expect(store().tokens[cow].config).not.toHaveProperty('xp');
        expect(field(container, 'enemy-cycle-xp').textContent).toBe("A kill pays its level's XP, below.");
    });
});

describe('⭐ the kinds: none, one or two library effects', () => {
    const cow = 'token_cow';
    const THIRD = 1 / 3;
    const provides = (type, value, bucket, category) => ({ id: `stm_k_${type}_${category || bucket}_${value}`, keyword: 'provides', payload: { type, bucket, value, ...(category ? { category } : {}) }, to: null, target: null, when: null });
    /** The four kinds as the content pack authors them. */
    const KINDS = {
        effect_armoured: { id: 'effect_armoured', name: 'Armoured', autoSyncId: true, statements: [
            provides('TYPE_RESIST', 50, 'flat', 'slash'), provides('TYPE_RESIST', 50, 'flat', 'crush'), provides('TYPE_RESIST', 50, 'flat', 'stab'),
            provides('SWING_TIME', THIRD, 'percentage')
        ] },
        effect_nimble: { id: 'effect_nimble', name: 'Nimble', autoSyncId: true, statements: [provides('DODGE', 15, 'flat')] },
        effect_swift: { id: 'effect_swift', name: 'Swift', autoSyncId: true, statements: [provides('SWING_TIME', -THIRD, 'percentage'), provides('DAMAGE', -THIRD, 'percentage')] },
        effect_brute: { id: 'effect_brute', name: 'Brute', autoSyncId: true, statements: [provides('SWING_TIME', THIRD, 'percentage'), provides('DAMAGE', THIRD, 'percentage')] }
    };
    const withKinds = () => useEntityStore.setState((st) => ({ effects: { ...st.effects, ...KINDS } }));
    const options = (select) => [...select.options].map((o) => o.value);

    it('a kind naming no effect the library holds (an old preset\'s id) shows as None and adds nothing', () => {
        withKinds();
        store().updateToken(cow, { enemy: { ...store().tokens[cow].enemy, kinds: ['armoured'] } });
        const { container } = tokenEditor(cow);
        expect(field(container, 'enemy-kind-1').value).toBe('');
        expect(options(field(container, 'enemy-kind-1'))).not.toContain('armoured');
        expect(field(container, 'enemy-resist-slash')).toBeNull();
        expect(field(container, 'enemy-speed').selectedOptions[0].textContent).toBe('3 s (Normal)');
        expect(field(container, 'enemy-speed-source').textContent).toBe('from level');
        // Picking a kind writes over it.
        fireEvent.change(field(container, 'enemy-kind-1'), { target: { value: 'effect_armoured' } });
        expect(store().tokens[cow].enemy.kinds).toEqual(['effect_armoured']);
    });

    it('the boxes offer effects that can be a trait, never a status; picking writes the effect\'s id, the second box opens', () => {
        withKinds();
        const { container } = tokenEditor(cow);
        const offered = options(field(container, 'enemy-kind-1'));
        for (const id of Object.keys(KINDS)) expect(offered).toContain(id);
        expect(offered).not.toContain('effect_venom');
        expect(field(container, 'enemy-kind-2').disabled).toBe(true);
        fireEvent.change(field(container, 'enemy-kind-1'), { target: { value: 'effect_armoured' } });
        expect(store().tokens[cow].enemy.kinds).toEqual(['effect_armoured']);
        expect(field(container, 'enemy-kinds-note').textContent).toBe('Armoured: resists Slash 50%, Crush 50%, Stab 50%; attacks every 4.0s.');
        expect(field(container, 'enemy-kind-2').disabled).toBe(false);
        expect(options(field(container, 'enemy-kind-2'))).not.toContain('effect_armoured');
        fireEvent.change(field(container, 'enemy-kind-2'), { target: { value: 'effect_brute' } });
        expect(store().tokens[cow].enemy.kinds).toEqual(['effect_armoured', 'effect_brute']);
        // None in the first box keeps the second.
        fireEvent.change(field(container, 'enemy-kind-1'), { target: { value: '' } });
        expect(store().tokens[cow].enemy.kinds).toEqual(['effect_brute']);
        fireEvent.change(field(container, 'enemy-kind-1'), { target: { value: '' } });
        expect(store().tokens[cow].enemy).not.toHaveProperty('kinds');
    });

    it('a kind\'s lines add to the ones written: the Crab\'s Crush −100 and Armoured\'s 50 make weak 50 % in a fight', () => {
        withKinds();
        store().updateToken(cow, { enemy: { ...store().tokens[cow].enemy, kinds: ['effect_armoured'], resistances: { crush: -100 } } });
        const { container } = tokenEditor(cow);
        expect(field(container, 'enemy-resist-crush-step').value).toBe('-100');
        expect(field(container, 'enemy-resist-crush-total').textContent).toBe('kinds add +50: Weak 50% in a fight');
        expect(field(container, 'enemy-resist-slash-step').value).toBe('');
        expect(field(container, 'enemy-resist-slash-total').textContent).toBe('kinds add +50: Resist 50% in a fight');
        expect(field(container, 'enemy-resist-electric')).toBeNull();
        expect(field(container, 'enemy-preview-resists').textContent).toBe('Slash 50%, Crush weak 50%, Stab 50%');
        const box = within(container).getByText('What the fight uses').parentElement.parentElement;
        expect(box.textContent).toContain('Attacks every4.0s');
        expect(field(container, 'enemy-speed-source').textContent).toBe('from level; kinds add in a fight');
    });

    it('a Brute\'s Damage % rolls on its written hit, which may be a fraction: 2.25 hits 3', () => {
        withKinds();
        store().updateToken(cow, { enemy: { ...store().tokens[cow].enemy, kinds: ['effect_brute'] } });
        const { container } = tokenEditor(cow);
        fireEvent.change(field(container, 'enemy-hit'), { target: { value: '2.25' } });
        expect(store().tokens[cow].enemy.hit).toBe(2.25);
        expect(field(container, 'enemy-preview-hit').textContent).toMatch(/^3 /);
    });

    it('kinds reach tokens.json as written, survive a reload, and the fight reads them; renaming the effect moves them', () => {
        withKinds();
        const { container } = tokenEditor(cow);
        fireEvent.change(field(container, 'enemy-kind-1'), { target: { value: 'effect_nimble' } });
        fireEvent.change(field(container, 'enemy-dodge'), { target: { value: '5' } });
        const files = expectStableRoundTrip();
        const written = files['tokens.json'][cow];
        expect(written.enemy).toEqual({ ...shipped()['tokens.json'][cow].enemy, kinds: ['effect_nimble'], dodge: 5 });
        expect(enemyProfileOf(written, files['effects.json'])).toMatchObject({ dodge: 5, kinds: ['effect_nimble'], kindEffects: ['effect_nimble'] });
        const before = shipped()['tokens.json'];
        for (const other of Object.keys(before).filter(t => t !== cow)) {
            expect(JSON.stringify(files['tokens.json'][other]), other).toBe(JSON.stringify(before[other]));
        }
        cleanup();
        store().updateEffect('effect_nimble', { name: 'Quick Feet' });
        expect(store().effects.effect_quick_feet).toBeDefined();
        expect(store().tokens[cow].enemy.kinds).toEqual(['effect_quick_feet']);
    });

    it('the Effect editor names the enemies carrying it as a kind', () => {
        withKinds();
        store().updateToken(cow, { enemy: { ...store().tokens[cow].enemy, kinds: ['effect_armoured'] } });
        store().setActiveEntity('effect_armoured', 'effect');
        const { container } = render(React.createElement(EffectEditor));
        expect(container.querySelector('[data-kind-users]').textContent).toContain(store().tokens[cow].name);
    });
});

describe('⭐ damage types in the CMS: a weapon\'s type, an arrow, an enemy\'s resistances', () => {
    const cow = 'token_cow';

    it('a weapon\'s Damage type: blank is its style\'s default; a pick is written; blank removes it', () => {
        const id = store().addItem({ name: 'Wand Fixture', equipSlot: 'hand' });
        const { container } = itemEditor(id);
        fireEvent.change(field(container, 'weapon-style'), { target: { value: 'magic' } });
        expect(field(container, 'weapon-damage-type').value).toBe('');
        expect(field(container, 'weapon-damage-type').selectedOptions[0].textContent).toBe("Magic's default (Fire)");
        fireEvent.change(field(container, 'weapon-damage-type'), { target: { value: 'ice' } });
        expect(store().items[id]).toMatchObject({ type: 'weapon', damageType: 'ice' });
        fireEvent.change(field(container, 'weapon-damage-type'), { target: { value: '' } });
        expect(store().items[id].damageType).toBeUndefined();
    });

    it('a Consumable may be an arrow: ticked it writes damage 1, Stab; its fields write; unticked removes it', () => {
        const id = store().addItem({ name: 'Arrow Fixture', equipSlot: 'consumable' });
        const { container } = itemEditor(id);
        expect(field(container, 'arrow-damage')).toBeNull();
        fireEvent.click(field(container, 'arrow'));
        expect(store().items[id].arrow).toEqual({ damage: 1, damageType: 'stab' });
        fireEvent.change(field(container, 'arrow-damage'), { target: { value: '2' } });
        fireEvent.change(field(container, 'arrow-damage-type'), { target: { value: 'fire' } });
        expect(store().items[id].arrow).toEqual({ damage: 2, damageType: 'fire' });
        fireEvent.click(field(container, 'arrow'));
        expect(store().items[id].arrow).toBeUndefined();

        const hat = store().addItem({ name: 'Hat Fixture', equipSlot: 'hat' });
        cleanup();
        expect(field(itemEditor(hat).container, 'arrow')).toBeNull();
    });

    it('an enemy\'s resistances: add a line, change its step, take it away; nothing written until then', () => {
        const before = JSON.stringify(store().tokens[cow].enemy);
        const { container } = tokenEditor(cow);
        expect(JSON.stringify(store().tokens[cow].enemy)).toBe(before);
        fireEvent.change(field(container, 'enemy-resist-add'), { target: { value: 'fire' } });
        expect(store().tokens[cow].enemy.resistances).toEqual({ fire: 50 });
        fireEvent.change(field(container, 'enemy-resist-fire-step'), { target: { value: '100' } });
        fireEvent.change(field(container, 'enemy-resist-add'), { target: { value: 'ice' } });
        fireEvent.change(field(container, 'enemy-resist-ice-step'), { target: { value: '-50' } });
        expect(store().tokens[cow].enemy.resistances).toEqual({ fire: 100, ice: -50 });
        expect(enemyProfileOf(store().tokens[cow]).resistances).toEqual({ fire: 100, ice: -50 });
        fireEvent.change(field(container, 'enemy-resist-fire-step'), { target: { value: '' } });
        fireEvent.change(field(container, 'enemy-resist-ice-step'), { target: { value: '' } });
        expect(store().tokens[cow].enemy).not.toHaveProperty('resistances');
    });

    it('an older enemy\'s typed Armour is said to be retired, and one click removes it', () => {
        store().updateToken(cow, { enemy: { level: 1, style: 'melee', armor: 2 } });
        const { container } = tokenEditor(cow);
        expect(field(container, 'enemy-retired-numbers').textContent).toContain('Armour 2: retired');
        fireEvent.click(within(field(container, 'enemy-retired-numbers')).getByRole('button'));
        expect(store().tokens[cow].enemy).not.toHaveProperty('armor');
    });

    it('a weapon\'s type, an arrow and resistances survive Recalculate, Sync and a reload unchanged', () => {
        const wand = store().addItem({ name: 'Wand Fixture', equipSlot: 'hand' });
        store().updateItem(wand, { type: 'weapon', styles: ['magic'], damage: 2, damageType: 'ice' });
        const arrow = store().addItem({ name: 'Arrow Fixture', equipSlot: 'consumable' });
        store().updateItem(arrow, { arrow: { damage: 1, damageType: 'stab' } });
        store().updateToken(cow, { enemy: { level: 1, style: 'melee', kinds: ['effect_armoured'], resistances: { crush: -100 } } });
        const synced = expectStableRoundTrip();
        expect(synced['items.json'][wand]).toMatchObject({ damageType: 'ice' });
        expect(synced['items.json'][arrow]).toMatchObject({ arrow: { damage: 1, damageType: 'stab' } });
        expect(synced['tokens.json'][cow].enemy).toMatchObject({ kinds: ['effect_armoured'], resistances: { crush: -100 } });
    });
});
