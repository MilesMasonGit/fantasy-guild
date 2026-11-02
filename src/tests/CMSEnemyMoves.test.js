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
import TokenEditor from '../../cms/src/components/editors/TokenEditor.jsx';
import { enemyProfileOf } from '../config/registries/enemyProfile.js';
import { makeStatement, KEYWORD } from '../systems/effects/statements.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';

/**
 * ⭐ Enemy moves in the CMS (brief 280 V3): the Token editor's Moves block writes `enemy.moves` (a
 * name, whether it hits and in which type, an effect from the library on itself or the hero and for
 * how long, a weight); the preview says the moves; a problem shows under its row; renaming a library
 * effect repoints the moves that land it; everything written survives Recalculate, Sync and a reload.
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
function tokenEditor(id) {
    store().setActiveEntity(id, 'token');
    return render(React.createElement(TokenEditor));
}
const COW = 'token_cow';
const flutterEffect = () => store().addEffect({
    name: 'Flutter',
    statements: [{ ...makeStatement(KEYWORD.PROVIDES), to: null, payload: { type: EFFECT_TYPES.TYPE_RESIST, bucket: 'flat', value: 50, category: 'physical' } }]
});

describe('⭐ the Token editor\'s Moves block', () => {
    // The editor's own behaviour, on a cow with its shipped moves taken off.
    beforeEach(() => {
        const { moves, ...plain } = store().tokens[COW].enemy;
        store().updateToken(COW, { enemy: plain });
    });

    it('an enemy with none says it swings a plain Physical hit, and writes no key', () => {
        const { container } = tokenEditor(COW);
        expect(field(container, 'enemy-moves')).not.toBeNull();
        expect(field(container, 'enemy-move-0')).toBeNull();
        expect(field(container, 'enemy-preview-hit').textContent).toMatch(/Physical$/);
        expect(store().tokens[COW].enemy).not.toHaveProperty('moves');
    });

    it('authors the owner\'s chicken: Peck (Stab), Scratch (Slash), Flutter (no hit, Flutter on itself for one attack)', () => {
        const flutter = flutterEffect();
        const { container } = tokenEditor(COW);
        for (let i = 0; i < 3; i++) fireEvent.click(field(container, 'enemy-move-add'));
        const set = (i, name, value) => fireEvent.change(field(container, `enemy-move-${i}-${name}`), { target: { value } });
        set(0, 'name', 'Peck');
        set(0, 'type', 'stab');
        set(1, 'name', 'Scratch');
        set(1, 'type', 'slash');
        set(2, 'name', 'Flutter');
        fireEvent.click(field(container, 'enemy-move-2-hits'));
        set(2, 'effect', flutter);
        set(2, 'target', 'self');
        set(2, 'lasts', 'attack');
        expect(store().tokens[COW].enemy.moves).toEqual([
            { name: 'Peck', damageType: 'stab' },
            { name: 'Scratch', damageType: 'slash' },
            { name: 'Flutter', hits: false, effectId: flutter, target: 'self', lasts: 'attack' }
        ]);
        expect(field(container, 'enemy-move-2-type').disabled).toBe(true);
        expect(field(container, 'enemy-preview-hit').textContent).toBe('1 · Peck Stab, Scratch Slash, Flutter');
        expect(enemyProfileOf(store().tokens[COW]).moves.map(m => [m.name, m.hits, m.type, m.effectId, m.target, m.lasts])).toEqual([
            ['Peck', true, 'stab', null, 'hero', 'fight'],
            ['Scratch', true, 'slash', null, 'hero', 'fight'],
            ['Flutter', false, null, flutter, 'self', 'attack']
        ]);
        // No problem under any row.
        expect(container.querySelector('[data-field$="-problem"]')).toBeNull();
    });

    it('a weight above 1 is written, 1 or blank drops it; "for the swing" is offered only on itself; removing the last move drops the key', () => {
        const flutter = flutterEffect();
        const { container } = tokenEditor(COW);
        fireEvent.click(field(container, 'enemy-move-add'));
        fireEvent.change(field(container, 'enemy-move-0-weight'), { target: { value: '3' } });
        expect(store().tokens[COW].enemy.moves[0].weight).toBe(3);
        fireEvent.change(field(container, 'enemy-move-0-weight'), { target: { value: '1' } });
        expect(store().tokens[COW].enemy.moves[0]).not.toHaveProperty('weight');
        fireEvent.change(field(container, 'enemy-move-0-effect'), { target: { value: flutter } });
        const lasts = () => [...field(container, 'enemy-move-0-lasts').options].map(o => o.value);
        expect(lasts()).toEqual(['attack', 'fight']);
        fireEvent.change(field(container, 'enemy-move-0-target'), { target: { value: 'self' } });
        expect(lasts()).toEqual(['attack', 'swing', 'fight']);
        fireEvent.change(field(container, 'enemy-move-0-lasts'), { target: { value: 'swing' } });
        expect(store().tokens[COW].enemy.moves[0]).toMatchObject({ effectId: flutter, target: 'self', lasts: 'swing' });
        // Back on the hero, "for the swing" goes.
        fireEvent.change(field(container, 'enemy-move-0-target'), { target: { value: 'hero' } });
        expect(store().tokens[COW].enemy.moves[0]).not.toHaveProperty('lasts');
        fireEvent.click(field(container, 'enemy-move-0-remove'));
        expect(store().tokens[COW].enemy).not.toHaveProperty('moves');
    });

    it('shows the audit\'s problem under its row: no hit and no effect does nothing', () => {
        const { container } = tokenEditor(COW);
        fireEvent.click(field(container, 'enemy-move-add'));
        fireEvent.click(field(container, 'enemy-move-0-hits'));
        expect(field(container, 'enemy-move-0-problem').textContent).toBe('This move neither hits nor lands an effect — the swing does nothing. Tick Hits or pick an effect in the CMS.');
    });
});

describe('moves survive and follow their effect', () => {
    it('Recalculate, Sync and a reload leave them as written', () => {
        const flutter = flutterEffect();
        const moves = [{ name: 'Peck', damageType: 'stab' }, { name: 'Flutter', hits: false, effectId: flutter, target: 'self', lasts: 'attack', weight: 2 }];
        store().updateToken(COW, { enemy: { ...store().tokens[COW].enemy, moves } });
        const first = syncPayload();
        expect(first['tokens.json'][COW].enemy.moves).toEqual(moves);
        load(Object.fromEntries(FILES.map((f) => [f, JSON.parse(JSON.stringify(first[f]))])));
        const second = syncPayload();
        expect(JSON.stringify(second['tokens.json'])).toBe(JSON.stringify(first['tokens.json']));
    });

    it('renaming a library effect repoints the moves that land it', () => {
        const flutter = flutterEffect();
        store().updateToken(COW, { enemy: { ...store().tokens[COW].enemy, moves: [{ name: 'Flutter', hits: false, effectId: flutter, target: 'self' }, { name: 'Peck' }] } });
        store().updateEffect(flutter, { name: 'Flap' });
        const renamed = Object.keys(store().effects).find(id => store().effects[id].name === 'Flap');
        expect(renamed).not.toBe(flutter);
        expect(store().tokens[COW].enemy.moves).toEqual([{ name: 'Flutter', hits: false, effectId: renamed, target: 'self' }, { name: 'Peck' }]);
    });

    it('the Economy Audit names a move landing an effect the library does not hold', () => {
        store().updateToken(COW, { enemy: { ...store().tokens[COW].enemy, moves: [{ name: 'Ghost', effectId: 'effect_missing' }] } });
        const issues = auditConnectivity(store());
        const found = issues.filter(i => i.entityId === COW && /Ghost/.test(i.details));
        expect(found.map(i => i.details)).toEqual(['its move "Ghost" lands the effect "effect_missing", which is not in the effect library — it lands nothing. Pick the effect again in the CMS.']);
    });
});
