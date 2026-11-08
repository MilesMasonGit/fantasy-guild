// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import React from 'react';
import { render, cleanup, fireEvent, within } from '@testing-library/react';
import { asLoaded } from './fixtures/shippedAsLoaded.js';

import { useEntityStore } from '../../cms/src/stores/useEntityStore';
import { useSimulationStore } from '../../cms/src/stores/useSimulationStore';
import { syncFiles } from '../../cms/src/engine/recipeSync';
import { isBossEnemy } from '../config/registries/enemyProfile.js';
import { auditLifecycleBlocks } from '../systems/core/lifecycleAudit.js';
import { slotsOf } from '../../cms/src/engine/ledger/statementSlots.js';
import { KEYWORD, makeStatement } from '../systems/effects/statements.js';
import TokenEditor from '../../cms/src/components/editors/TokenEditor.jsx';

/**
 * The CMS side of the encounters: an enemy's Boss mark, carried through Recalculate and Sync exactly
 * as written and gone without a trace when unticked; the audit naming a rule that spawns an enemy;
 * and a Spawns rule that never offers one. Camps of one and Summoning Circles are ordinary spawners and Tokens, so
 * they need nothing new in the CMS.
 *
 * ⚠️ The store's persistence is pointed at a no-op for this file, so nothing here can reach the
 * owner's real workspace (`localStorage['fantasy-guild-cms-v2']`) and from there `data/`.
 */

const DATA = path.resolve(__dirname, '../../data');
const FILES = ['items.json', 'tokens.json', 'tokenRecipes.json', 'effects.json'];
const read = (file) => fs.readFileSync(path.join(DATA, file), 'utf8').replace(/\r\n/g, '\n');
const raw = Object.fromEntries(FILES.map((f) => [f, asLoaded(f, read(f))]));

const NOOP = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const WORKSPACE_KEY = 'fantasy-guild-cms-v2';

function workspaceFromFiles(files) {
    const recipePools = {};
    for (const recipe of files['tokenRecipes.json']) (recipePools[recipe.skill || 'general'] ||= []).push(recipe);
    return {
        items: files['items.json'], tokens: files['tokens.json'],
        effects: files['effects.json'], recipePools,
    };
}

const load = (files) => useEntityStore.getState().hydrate(workspaceFromFiles(files));
const shipped = () => Object.fromEntries(FILES.map((f) => [f, JSON.parse(raw[f])]));
const syncPayload = () => syncFiles(useEntityStore.getState().recalculateEconomy({}));

function openEditor(id) {
    useEntityStore.getState().setActiveEntity(id, 'token');
    const { container } = render(React.createElement(TokenEditor));
    return { container };
}

/** Sync, load what was written, sync again: the second must equal the first, byte for byte. */
function syncTwice() {
    const first = syncPayload();
    const serialised = Object.fromEntries(FILES.map((f) => [f, JSON.stringify(first[f], null, 2)]));
    load(Object.fromEntries(FILES.map((f) => [f, JSON.parse(serialised[f])])));
    const second = syncPayload();
    for (const f of FILES) expect(JSON.stringify(second[f], null, 2)).toBe(serialised[f]);
    return second;
}

let storageBefore;
beforeAll(() => {
    storageBefore = localStorage.getItem(WORKSPACE_KEY);
    useEntityStore.persist.setOptions({ storage: NOOP });
});
afterAll(() => {
    expect(localStorage.getItem(WORKSPACE_KEY)).toBe(storageBefore);
});
beforeEach(() => load(shipped()));
afterEach(() => {
    cleanup();
    useSimulationStore.getState().clearResults();
});

describe('⭐ the Boss mark', () => {
    it('ticking Boss writes enemy.boss and leaves the rest of the block as written; there is no Hostile box', () => {
        const id = 'token_cow';
        const before = { ...useEntityStore.getState().tokens[id].enemy };
        const { container } = openEditor(id);
        expect(within(container).queryByLabelText('Hostile')).toBeNull();
        fireEvent.click(within(container).getByLabelText('Boss'));
        expect(useEntityStore.getState().tokens[id].enemy).toEqual({ ...before, boss: true });

        const written = syncTwice()['tokens.json'][id];
        expect(isBossEnemy(written)).toBe(true);
    });

    it('unticking leaves no key behind, and the rest of the enemy block untouched', () => {
        const id = 'token_cow';
        const before = { ...useEntityStore.getState().tokens[id].enemy };
        const { container } = openEditor(id);
        fireEvent.click(within(container).getByLabelText('Boss'));
        fireEvent.click(within(container).getByLabelText('Boss'));
        expect(useEntityStore.getState().tokens[id].enemy).toEqual(before);
        expect(syncPayload()['tokens.json'][id].enemy).toEqual(before);
    });
});

describe('⭐ the content audit names a rule that spawns an enemy', () => {
    const spawns = (typeId, sourceEffectId) => ({ ...makeStatement(KEYWORD.SPAWNS), payload: { typeId, placement: 'nearest_free', chance: 2 }, ...(sourceEffectId ? { sourceEffectId } : {}) });

    it('an enemy or a boss, inline or from the library, says so; a plain Token says nothing', () => {
        const tokens = {
            imp: { id: 'imp', name: 'Imp', enemy: { level: 1 } },
            boss: { id: 'boss', name: 'Boss', enemy: { level: 1, boss: true } },
            rock: { id: 'rock', name: 'Rock' },
            vein: { id: 'vein', name: 'Haunted Vein', statements: [spawns('imp', 'effect_imp_ambush')] },
            den: { id: 'den', name: 'Odd Den', statements: [spawns('boss')] },
            quarry: { id: 'quarry', name: 'Quarry', statements: [spawns('rock')] }
        };
        const found = auditLifecycleBlocks({ tokens, items: {}, recipes: {}, skills: [] }).filter((f) => f.field === 'statements');
        expect(found.map((f) => f.entityId).sort()).toEqual(['den', 'vein']);
        const vein = found.find((f) => f.entityId === 'vein');
        expect(vein.severity).toBe('warning');
        expect(vein.message).toContain('effect_imp_ambush');
        expect(vein.message).toContain('Imp (imp)');
        expect(vein.message).toContain('Delete it');
    });
});

describe('⭐ a Spawns rule in the editor', () => {
    it('never offers an enemy, a boss or not', () => {
        const tokens = {
            imp: { id: 'imp', name: 'Imp', enemy: { level: 1 } },
            boss: { id: 'boss', name: 'Boss', enemy: { level: 1, boss: true } },
            rock: { id: 'rock', name: 'Rock' }
        };
        const slot = slotsOf(makeStatement(KEYWORD.SPAWNS), { tokens }).find((s) => s.id === 'typeId');
        expect(slot.options.map((o) => o.id)).toEqual(['rock']);
    });
});
