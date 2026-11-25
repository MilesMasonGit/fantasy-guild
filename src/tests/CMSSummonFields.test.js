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
import TokenEditor from '../../cms/src/components/editors/TokenEditor.jsx';
import { SummoningCircleFields } from '../../cms/src/components/editors/SummonBlocks.jsx';

/**
 * ⭐ Summoned workers in the CMS (brief 810 K5): the Token editor's Summoned worker section writes a
 * summon's block (its copied enemy, its skills at fixed levels, its trait), a Summoning Circle's
 * charge setting is written beside it, both reach the files through Recalculate and Sync with the
 * derived type `summon`, and the Economy Audit names a summon no recipe calls.
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
const anEnemy = () => Object.values(store().tokens).find(t => t.enemy?.level != null);
const anEffect = () => Object.values(store().effects).find(e => e?.id);

describe('⭐ the Token editor\'s Summoned worker section', () => {
    it('ticking it makes the Token a summon; the enemy, a skill, its level and the trait are written to its block', () => {
        const id = store().addToken({ name: 'Summoned Fixture Slime' });
        store().setActiveEntity(id, 'token');
        const { container } = render(React.createElement(TokenEditor));

        fireEvent.click(field(container, 'summon-on'));
        expect(store().tokens[id].summon).toEqual({ of: '', skills: {}, trait: null });

        const enemy = anEnemy();
        fireEvent.change(field(container, 'summon-of'), { target: { value: enemy.id } });
        fireEvent.click(field(container, 'summon-add-skill'));
        const added = Object.keys(store().tokens[id].summon.skills);
        expect(added).toHaveLength(1);
        fireEvent.change(container.querySelector('[data-field="summon-skills"] input[aria-label="Level"]'), { target: { value: '30' } });
        const fx = anEffect();
        fireEvent.change(field(container, 'summon-trait'), { target: { value: fx.id } });

        expect(store().tokens[id].summon).toEqual({ of: enemy.id, skills: { [added[0]]: 30 }, trait: { effectId: fx.id, scale: 1 } });

        fireEvent.click(field(container, 'summon-on'));
        expect(store().tokens[id].summon).toBeUndefined();
    });

    it('a Circle\'s charge setting writes its two numbers and previews the charges by level', () => {
        const writes = [];
        const { container } = render(React.createElement(SummoningCircleFields, {
            token: { summonCircle: { charges: 3, perLevel: 0.1 } }, stationSkill: 'summoning', onChange: (next) => writes.push(next)
        }));
        expect(field(container, 'circle-preview').textContent).toContain('1: 3 · 25: 5 · 50: 8 · 75: 10 · 99: 12');
        fireEvent.change(field(container, 'circle-charges'), { target: { value: '6' } });
        expect(writes.at(-1)).toEqual({ charges: 6, perLevel: 0.1 });
        cleanup();
        const { container: none } = render(React.createElement(SummoningCircleFields, { token: {}, stationSkill: 'smithing', onChange: () => {} }));
        expect(field(none, 'circle-charges')).toBeNull();
    });
});

describe('⭐ a summon reaches the files, and the audit names one no recipe calls', () => {
    it('Recalculate and Sync keep its block, give it the type summon, and keep a Circle\'s setting', () => {
        const enemy = anEnemy();
        const fx = anEffect();
        const id = store().addToken({ name: 'Summoned Trip Slime', sprite: enemy.sprite, summon: { of: enemy.id, skills: { mining: 40 }, trait: { effectId: fx.id, scale: 1 } } });
        const stationId = Object.values(store().tokens).find(t => t.config && !t.enemy)?.id;
        store().updateToken(stationId, { summonCircle: { charges: 4, perLevel: 0.2 } });

        const files = syncPayload();
        expect(files['tokens.json'][id].summon).toEqual({ of: enemy.id, skills: { mining: 40 }, trait: { effectId: fx.id, scale: 1 } });
        expect(files['tokens.json'][id].tokenType).toBe('summon');
        expect(files['tokens.json'][stationId].summonCircle).toEqual({ charges: 4, perLevel: 0.2 });

        const issues = auditConnectivity({ items: store().items, tokens: store().tokens, recipes: {}, effects: store().effects });
        const ours = issues.filter(i => i.entityId === id).map(i => i.details);
        expect(ours).toContain('Is a Summoned worker no Summoning recipe calls, so it is never summoned: give a Summoning recipe it as its output.');
    });
});
