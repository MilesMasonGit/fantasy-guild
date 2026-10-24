// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import React from 'react';
import { render, cleanup, fireEvent, within } from '@testing-library/react';
import { asLoaded } from './fixtures/shippedAsLoaded.js';

import { useEntityStore, makeLifecycleBlock, TOKEN_LIFECYCLE_BLOCKS } from '../../cms/src/stores/useEntityStore';
import { useSimulationStore } from '../../cms/src/stores/useSimulationStore';
import { syncFiles } from '../../cms/src/engine/recipeSync';
import { GUARDIAN_DEFAULTS as CMS_GUARDIAN_DEFAULTS, SUMMON_SHOP_SECTION as CMS_SUMMON } from '../../cms/src/utils/constants';
import { GUARDIAN_DEFAULTS, SUMMON_SHOP_SECTION } from '../config/registries/tokenConstants.js';
import { isBossEnemy, isHostileEnemy } from '../config/registries/enemyProfile.js';
import { auditLifecycleBlocks } from '../systems/core/lifecycleAudit.js';
import { slotsOf } from '../systems/effects/statementSlots.js';
import { KEYWORD, makeStatement } from '../systems/effects/statements.js';
import TokenEditor from '../../cms/src/components/editors/TokenEditor.jsx';

/**
 * The CMS side of brief 220, C5: an enemy's Boss mark, a Token's Guardian / lair block, the Shop's
 * Summons section and a Spawns rule that never offers a boss. Each authored in the Token editor,
 * carried through Recalculate and Sync exactly as written, and gone without a trace when removed.
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
    return { container, block: () => container.querySelector('[data-block="guardian"]') };
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
    it('ticking Boss writes enemy.boss and clears Hostile; the Hostile box is then off and greyed', () => {
        const id = 'token_goblin_chief';
        const { container } = openEditor(id);
        expect(useEntityStore.getState().tokens[id].enemy.hostile).toBe(true);
        fireEvent.click(within(container).getByLabelText('Boss'));
        const enemy = useEntityStore.getState().tokens[id].enemy;
        expect(enemy.boss).toBe(true);
        expect(enemy).not.toHaveProperty('hostile');
        const hostile = within(container).getByLabelText('Hostile');
        expect(hostile.disabled).toBe(true);
        expect(hostile.checked).toBe(false);

        const written = syncTwice()['tokens.json'][id];
        expect(isBossEnemy(written)).toBe(true);
        expect(isHostileEnemy(written)).toBe(false);
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

describe('⭐ the Guardian / lair block', () => {
    it('is one of the lifecycle blocks; a new one names no enemy and writes no return time (the default)', () => {
        expect(TOKEN_LIFECYCLE_BLOCKS).toContain('guardian');
        expect(makeLifecycleBlock('guardian')).toEqual({ typeId: '' });
        expect(CMS_GUARDIAN_DEFAULTS).toBe(GUARDIAN_DEFAULTS);
    });

    it('Add, pick an enemy (only enemies offered, a boss marked), type a return, Sync, reload, Sync: the same bytes', () => {
        const store = useEntityStore.getState();
        const boss = store.addToken({ name: 'Boss Fixture', enemy: { level: 5, style: 'melee', boss: true } });
        const vein = store.addToken({ name: 'Rich Vein Fixture', config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 3000, xp: 1, inputs: [], outputs: [] } });
        const { block } = openEditor(vein);
        fireEvent.click(within(block()).getByText('Add'));
        const pick = within(block()).getByLabelText('Guardian enemy');
        const offered = [...pick.options].map((o) => o.value).filter(Boolean);
        const tokens = useEntityStore.getState().tokens;
        expect(offered.length).toBeGreaterThan(0);
        expect(offered.every((v) => tokens[v]?.enemy?.level != null)).toBe(true);
        expect(offered).toContain('token_goblin');
        expect([...pick.options].find((o) => o.value === boss).textContent).toMatch(/\(boss\)/);

        fireEvent.change(pick, { target: { value: 'token_goblin' } });
        const time = within(block()).getByLabelText('Back after (ms)');
        expect(time.value).toBe('');
        expect(time.placeholder).toMatch(String(GUARDIAN_DEFAULTS.returnMs));
        expect(within(block()).getByText(/guards this Token/)).toBeTruthy();
        fireEvent.change(time, { target: { value: '300000' } });
        expect(useEntityStore.getState().tokens[vein].guardian).toEqual({ typeId: 'token_goblin', returnMs: 300000 });

        expect(syncTwice()['tokens.json'][vein].guardian).toEqual({ typeId: 'token_goblin', returnMs: 300000 });

        // Cleared, the time goes back to the default and leaves no key.
        cleanup();
        const again = openEditor(vein);
        fireEvent.change(within(again.block()).getByLabelText('Back after (ms)'), { target: { value: '' } });
        expect(useEntityStore.getState().tokens[vein].guardian).toEqual({ typeId: 'token_goblin' });
    });

    it('on a Token with no work it reads as a lair, with the boss default', () => {
        const store = useEntityStore.getState();
        const boss = store.addToken({ name: 'Boss Fixture', enemy: { level: 5, style: 'melee', boss: true } });
        const den = store.addToken({ name: 'Den Fixture', guardian: { typeId: boss } });
        const { block } = openEditor(den);
        expect(within(block()).getByText(/lair of Boss Fixture/)).toBeTruthy();
        expect(within(block()).getByLabelText('Back after (ms)').placeholder).toMatch(String(GUARDIAN_DEFAULTS.bossReturnMs));
    });

    it('Remove leaves no key behind; renaming its enemy repoints it', () => {
        const store = useEntityStore.getState();
        const imp = store.addToken({ name: 'Imp Fixture', enemy: { level: 1, style: 'melee' } });
        const vein = store.addToken({ name: 'Vein Fixture', guardian: { typeId: imp, returnMs: 5000 } });
        useEntityStore.getState().renameEntityId(imp, 'token_fixture_imp_two', 'token');
        expect(useEntityStore.getState().tokens[vein].guardian).toEqual({ typeId: 'token_fixture_imp_two', returnMs: 5000 });
        const { block } = openEditor(vein);
        fireEvent.click(within(block()).getByText('Remove'));
        expect(useEntityStore.getState().tokens[vein].guardian).toBeUndefined();
        expect(JSON.parse(JSON.stringify(syncPayload()['tokens.json']))[vein]).not.toHaveProperty('guardian');
    });

    it('the content audit names a guardian that is not an enemy, one on an enemy, a bad time, and a hostile boss', () => {
        const tokens = {
            node: { id: 'node', name: 'Node', guardian: { typeId: 'tree' } },
            tree: { id: 'tree', name: 'Tree' },
            imp: { id: 'imp', name: 'Imp', enemy: { level: 1 }, guardian: { typeId: 'imp2' } },
            imp2: { id: 'imp2', name: 'Imp Two', enemy: { level: 1 } },
            slow: { id: 'slow', name: 'Slow', guardian: { typeId: 'imp2', returnMs: 5 } },
            fine: { id: 'fine', name: 'Fine', guardian: { typeId: 'imp2', returnMs: 60000 } },
            boss: { id: 'boss', name: 'Boss', enemy: { level: 1, boss: true, hostile: true } }
        };
        const found = auditLifecycleBlocks({ tokens, items: {}, recipes: {}, skills: [] });
        const on = (id) => found.filter((f) => f.entityId === id);
        expect(on('node').map((f) => f.field)).toContain('guardian.typeId');
        expect(on('imp').map((f) => f.field)).toContain('guardian');
        expect(on('slow').map((f) => f.field)).toContain('guardian.returnMs');
        expect(on('fine')).toEqual([]);
        expect(on('boss')).toEqual([expect.objectContaining({ severity: 'warning', field: 'enemy.hostile' })]);
    });
});

describe('⭐ summons and ambushes in the editor', () => {
    it('the Shop section offers Summons', () => {
        expect(CMS_SUMMON).toBe(SUMMON_SHOP_SECTION);
        const store = useEntityStore.getState();
        const boss = store.addToken({ name: 'Called Boss Fixture', enemy: { level: 5, style: 'melee', boss: true }, shop: { price: [], section: 'general' } });
        const { container } = openEditor(boss);
        const shop = container.querySelector('[data-block="shop"]');
        const select = [...shop.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.value === 'general'));
        expect([...select.options].map((o) => o.value)).toContain(SUMMON_SHOP_SECTION);
        fireEvent.change(select, { target: { value: SUMMON_SHOP_SECTION } });
        expect(useEntityStore.getState().tokens[boss].shop.section).toBe(SUMMON_SHOP_SECTION);
        expect(syncTwice()['tokens.json'][boss].shop.section).toBe(SUMMON_SHOP_SECTION);
    });

    it('a Spawns rule never offers a boss', () => {
        const tokens = {
            imp: { id: 'imp', name: 'Imp', enemy: { level: 1 } },
            boss: { id: 'boss', name: 'Boss', enemy: { level: 1, boss: true } },
            rock: { id: 'rock', name: 'Rock' }
        };
        const slot = slotsOf(makeStatement(KEYWORD.SPAWNS), { tokens }).find((s) => s.id === 'typeId');
        expect(slot.options.map((o) => o.id)).toEqual(['imp', 'rock']);
    });
});
