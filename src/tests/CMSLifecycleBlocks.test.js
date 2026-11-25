// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { asLoaded } from './fixtures/shippedAsLoaded.js';
import React from 'react';
import { render, cleanup, fireEvent, within } from '@testing-library/react';

import {
    useEntityStore,
    makeLifecycleBlock,
    TOKEN_LIFECYCLE_BLOCKS,
} from '../../cms/src/stores/useEntityStore';
import { useSimulationStore } from '../../cms/src/stores/useSimulationStore';
import { syncFiles } from '../../cms/src/engine/recipeSync';
import { FOUNDATION_KINDS } from '../../cms/src/utils/constants';
import { FOUNDATION_KINDS as GAME_FOUNDATION_KINDS } from '../config/registries/tokenConstants.js';
import TokenEditor from '../../cms/src/components/editors/TokenEditor.jsx';

/**
 * Token Lifecycle slice 4.1 — the CMS carries the six new Token blocks
 * (`spawner`, `grows`, `foundation`, `shop`, `trickle`) and the new
 * recipe field `foundationKinds` through load → edit → Recalculate → Sync.
 *
 * ## ⚠️ Why this matters
 * Sync writes `data/*.json` wholesale and destroys anything the CMS does not
 * carry. Before any content uses the new blocks (roadmap Phase 7), a Token with
 * every block has to come out of a sync exactly as it went in — and today's
 * content, which uses none of them, has to come out byte for byte unchanged.
 */

const DATA = path.resolve(__dirname, '../../data');
const FILES = ['items.json', 'tokens.json', 'tokenRecipes.json', 'effects.json'];
// git may check these out with CRLF; JSON.stringify always emits LF.
const read = (file) => fs.readFileSync(path.join(DATA, file), 'utf8').replace(/\r\n/g, '\n');
// ⚠️ As the CMS holds the files once loaded: it renames retired skill ids, so until the
// owner's next Sync writes them, a sync differs from data/ by that rename and nothing else.
const raw = Object.fromEntries(FILES.map((f) => [f, asLoaded(f, read(f))]));

/** The workspace `/api/load-game-data` builds from `data/` (vite-plugin-cms-api.js). */
function workspaceFromFiles(files) {
    const recipePools = {};
    for (const recipe of files['tokenRecipes.json']) {
        (recipePools[recipe.skill || 'general'] ||= []).push(recipe);
    }
    return {
        items: files['items.json'],
        tokens: files['tokens.json'],
        effects: files['effects.json'],
        recipePools,
    };
}

function loadShipped() {
    const parsed = Object.fromEntries(FILES.map((f) => [f, JSON.parse(raw[f])]));
    useEntityStore.getState().hydrate(workspaceFromFiles(parsed));
}

/** Recalculate + build the sync payload, exactly as `syncToGame` does, minus the POST. */
function syncPayload() {
    const balanced = useEntityStore.getState().recalculateEconomy({});
    return syncFiles(balanced);
}

const shippedTokens = JSON.parse(raw['tokens.json']);
const shippedItems = JSON.parse(raw['items.json']);
const shippedRecipes = JSON.parse(raw['tokenRecipes.json']);
const tokenIds = Object.keys(shippedTokens);
const liveItemIds = Object.keys(shippedItems).filter((id) => id.startsWith('item_'));

/** One of each block, naming real shipped Tokens and live `item_*` items. */
function everyBlock() {
    const [t1, t2, t3] = tokenIds;
    const [i1, i2, i3] = liveItemIds;
    return {
        spawner: {
            spawns: [{ typeId: t1, weight: 3 }, { typeId: t2, weight: 1 }],
            allowance: 5,
            intervalMs: 20000,
            upkeep: [{ itemId: i1, quantity: 1 }],
        },
        grows: { into: t3, afterMs: 30000 },
        foundation: { kind: 'stone', skill: 'construction', tier: 2 },
        shop: {
            price: [{ itemId: i2, quantity: 10 }, { itemId: i3, quantity: 2 }],
            section: 'forestry',
            group: 'Fixture Group',
        },
        trickle: [{ itemId: i1, quantity: 1 }],
        respawn: { mode: 'refill', afterMs: 15000 },
        field: { emptySprite: 't_farmland', growingSprite: 't_garden' },
        camp: { skill: 'forestry', reach: 280 },
        shrine: { maxLitMs: 120000 },
        laboratory: { maxLevel: 40 },
        mastery: { ranks: [{ points: 10, effectId: 'effect_oak_forest_growth', scale: 1 }] },
    };
}

beforeEach(() => loadShipped());
afterEach(() => {
    cleanup();
    useSimulationStore.getState().clearResults();
});

describe('Today’s data round-trips unchanged', () => {
    it('the shipped content now uses the new blocks (Logging chain, slice 7.1), so the byte-identical round trips below cover them too', () => {
        const used = new Set();
        for (const token of Object.values(shippedTokens)) {
            for (const key of TOKEN_LIFECYCLE_BLOCKS) if (token[key] !== undefined) used.add(key);
        }
        for (const key of ['spawner', 'grows', 'shop', 'trickle']) expect(used).toContain(key);
    });

    it('load → export writes all four files back byte-identical', () => {
        const files = syncFiles(useEntityStore.getState());
        for (const f of FILES) expect(JSON.stringify(files[f], null, 2)).toBe(raw[f].trimEnd());
    });

    it('load → Recalculate → Sync payload is byte-identical to data/ for all four files', () => {
        const files = syncPayload();
        for (const f of FILES) expect(JSON.stringify(files[f], null, 2)).toBe(raw[f].trimEnd());
    });

    it('a new Token carries no lifecycle block until one is added', () => {
        const id = useEntityStore.getState().addToken({ name: 'Plain Fixture' });
        const token = syncPayload()['tokens.json'][id];
        for (const key of TOKEN_LIFECYCLE_BLOCKS) expect(token).not.toHaveProperty(key);
    });
});

describe('A Token with every block survives load → edit → sync → reload', () => {
    /** Author the fixture the way the editor does: add the Token, then add each block. */
    function authorFixture() {
        const store = useEntityStore.getState();
        const id = store.addToken({ name: 'Lifecycle Fixture' });
        const blocks = everyBlock();
        for (const key of TOKEN_LIFECYCLE_BLOCKS) {
            useEntityStore.getState().updateToken(id, { [key]: makeLifecycleBlock(key) });
            useEntityStore.getState().updateToken(id, { [key]: blocks[key] });
        }
        return { id, blocks };
    }

    it('every block reaches tokens.json exactly as authored, key order included', () => {
        const { id, blocks } = authorFixture();
        const written = syncPayload()['tokens.json'][id];
        for (const key of TOKEN_LIFECYCLE_BLOCKS) {
            expect(written[key]).toEqual(blocks[key]);
            expect(JSON.stringify(written[key])).toBe(JSON.stringify(blocks[key]));
        }
    });

    it('a second load of the synced files and a second sync change nothing', () => {
        const { id } = authorFixture();
        const first = syncPayload();
        const serialised = Object.fromEntries(FILES.map((f) => [f, JSON.stringify(first[f], null, 2)]));

        useEntityStore.getState().hydrate(workspaceFromFiles(
            Object.fromEntries(FILES.map((f) => [f, JSON.parse(serialised[f])]))
        ));
        const second = syncPayload();

        for (const f of FILES) expect(JSON.stringify(second[f], null, 2)).toBe(serialised[f]);
        expect(second['tokens.json'][id].spawner).toEqual(everyBlock().spawner);
    });

    it('survives the persisted workspace (localStorage) path too', () => {
        const { id, blocks } = authorFixture();
        // What `partialize` hands to storage, through JSON, then back through `merge`.
        const persisted = JSON.parse(JSON.stringify({ tokens: useEntityStore.getState().tokens }));
        for (const key of TOKEN_LIFECYCLE_BLOCKS) expect(persisted.tokens[id][key]).toEqual(blocks[key]);
    });

    it('editing a Passive Production line drops its stale time but keeps the times of the other blocks', () => {
        const { id } = authorFixture();
        const store = useEntityStore.getState();
        const line = store.tokens[id].trickle[0];
        store.updateToken(id, { trickle: [{ ...line, quantity: 3, everyMs: 300000 }] });
        const after = useEntityStore.getState().tokens[id];
        expect(after.trickle).toEqual([{ itemId: line.itemId, quantity: 3 }]);
        expect(after.spawner.intervalMs).toBe(20000);
        expect(after.grows.afterMs).toBe(30000);
    });

    it('removing a block leaves no key behind in the file', () => {
        const { id } = authorFixture();
        useEntityStore.getState().updateToken(id, { grows: undefined, trickle: undefined });
        const json = JSON.parse(JSON.stringify(syncPayload()['tokens.json']));
        expect(json[id]).not.toHaveProperty('grows');
        expect(json[id]).not.toHaveProperty('trickle');
        expect(json[id]).toHaveProperty('spawner');
    });
});

describe('Renames reach the lifecycle blocks', () => {
    it('renaming an item repoints upkeep, shop price and trickle', () => {
        const store = useEntityStore.getState();
        const itemId = store.addItem({ name: 'Fixture Seed' });
        const id = store.addToken({ name: 'Rename Fixture' });
        useEntityStore.getState().updateToken(id, {
            spawner: { spawns: [], allowance: 1, intervalMs: 20000, upkeep: [{ itemId, quantity: 1 }] },
            shop: { price: [{ itemId, quantity: 3 }], section: 'general' },
            trickle: [{ itemId, quantity: 1, everyMs: 5000 }],
        });

        useEntityStore.getState().renameEntityId(itemId, 'item_fixture_acorn', 'item');
        const token = useEntityStore.getState().tokens[id];
        expect(token.spawner.upkeep[0].itemId).toBe('item_fixture_acorn');
        expect(token.shop.price[0].itemId).toBe('item_fixture_acorn');
        expect(token.trickle[0].itemId).toBe('item_fixture_acorn');
    });

    it('renaming a Token repoints spawns and grows.into', () => {
        const store = useEntityStore.getState();
        const target = store.addToken({ name: 'Fixture Sapling' });
        const id = store.addToken({ name: 'Fixture Forest' });
        useEntityStore.getState().updateToken(id, {
            spawner: { spawns: [{ typeId: target, weight: 1 }], allowance: 2, intervalMs: 20000, upkeep: [] },
            grows: { into: target, afterMs: 30000 },
        });

        useEntityStore.getState().renameEntityId(target, 'token_fixture_seedling', 'token');
        const token = useEntityStore.getState().tokens[id];
        expect(token.spawner.spawns[0].typeId).toBe('token_fixture_seedling');
        expect(token.grows.into).toBe('token_fixture_seedling');
    });
});

describe('The recipe field foundationKinds', () => {
    it('is the game’s list, re-exported rather than copied', () => {
        expect(FOUNDATION_KINDS).toBe(GAME_FOUNDATION_KINDS);
        expect([...FOUNDATION_KINDS]).toEqual(['wood', 'stone', 'farmland', 'excavation', 'dock', 'battlefield']);
    });

    it('survives load → edit → Recalculate → Sync, and absent stays absent', () => {
        const [skill] = Object.keys(useEntityStore.getState().recipePools);
        useEntityStore.getState().updateRecipe(skill, 0, { foundationKinds: ['stone', 'wood'], foundationMinTier: 2 });
        const recipeId = useEntityStore.getState().recipePools[skill][0].id;

        const written = syncPayload()['tokenRecipes.json'];
        const recipe = written.find((r) => r.id === recipeId);
        expect(recipe.foundationKinds).toEqual(['stone', 'wood']);
        expect(recipe.foundationMinTier).toBe(2);
        // Every other recipe keeps exactly what it shipped with: absent stays
        // absent, and the shipped building recipes (7.4's Farming) keep theirs.
        const shipped = new Map(shippedRecipes.map((r) => [r.id, r]));
        for (const other of written.filter((r) => r.id !== recipeId)) {
            expect(other.foundationKinds).toEqual(shipped.get(other.id).foundationKinds);
            expect(other.foundationMinTier).toEqual(shipped.get(other.id).foundationMinTier);
        }

        useEntityStore.getState().updateRecipe(skill, 0, { foundationKinds: undefined, foundationMinTier: undefined });
        const cleared = JSON.parse(JSON.stringify(syncPayload()['tokenRecipes.json']));
        expect(cleared.find((r) => r.id === recipeId)).not.toHaveProperty('foundationKinds');
        expect(cleared.find((r) => r.id === recipeId)).not.toHaveProperty('foundationMinTier');
    });
});

describe('The Token editor’s Lifecycle section', () => {
    it('adds and removes a block through the store', () => {
        const id = useEntityStore.getState().addToken({ name: 'Editor Fixture' });
        useEntityStore.getState().setActiveEntity(id, 'token');
        const { container } = render(React.createElement(TokenEditor));

        const grows = container.querySelector('[data-block="grows"]');
        fireEvent.click(within(grows).getByText('Add'));
        expect(useEntityStore.getState().tokens[id].grows).toEqual(makeLifecycleBlock('grows'));

        fireEvent.click(within(container.querySelector('[data-block="grows"]')).getByText('Remove'));
        expect(useEntityStore.getState().tokens[id].grows).toBeUndefined();
    });

    it('the Shop block edits its group: typing sets it, clearing drops the key, and it reaches tokens.json', () => {
        const id = useEntityStore.getState().addToken({ name: 'Group Fixture' });
        useEntityStore.getState().updateToken(id, { shop: { price: [], section: 'general' } });
        useEntityStore.getState().setActiveEntity(id, 'token');
        const { container } = render(React.createElement(TokenEditor));
        const input = container.querySelector('[data-block="shop"] [data-field="shop-group"]');
        fireEvent.change(input, { target: { value: 'Wood Foundation' } });
        expect(useEntityStore.getState().tokens[id].shop).toEqual({ price: [], section: 'general', group: 'Wood Foundation' });
        expect(syncPayload()['tokens.json'][id].shop.group).toBe('Wood Foundation');

        fireEvent.change(container.querySelector('[data-block="shop"] [data-field="shop-group"]'), { target: { value: '' } });
        expect(useEntityStore.getState().tokens[id].shop).toEqual({ price: [], section: 'general' });
        expect(JSON.parse(JSON.stringify(syncPayload()['tokens.json'][id].shop))).not.toHaveProperty('group');
    });

    it('the Shop block edits its skill icons and place in the list; empty drops the keys, and both reach tokens.json', () => {
        const id = useEntityStore.getState().addToken({ name: 'Icons Fixture' });
        useEntityStore.getState().updateToken(id, { shop: { price: [], section: 'general' } });
        useEntityStore.getState().setActiveEntity(id, 'token');
        const { container } = render(React.createElement(TokenEditor));
        const add = () => container.querySelector('[data-block="shop"] [data-field="shop-skill-add"]');
        fireEvent.change(add(), { target: { value: 'smithing' } });
        fireEvent.change(add(), { target: { value: 'faith' } });
        expect(useEntityStore.getState().tokens[id].shop.skills).toEqual(['smithing', 'faith']);
        // A chosen skill is not offered twice.
        expect([...add().querySelectorAll('option')].map((o) => o.value)).not.toContain('smithing');

        const order = container.querySelector('[data-block="shop"] [data-field="shop-order"]');
        fireEvent.change(order, { target: { value: '2' } });
        expect(useEntityStore.getState().tokens[id].shop).toEqual({ price: [], section: 'general', skills: ['smithing', 'faith'], order: 2 });
        expect(syncPayload()['tokens.json'][id].shop).toEqual({ price: [], section: 'general', skills: ['smithing', 'faith'], order: 2 });

        fireEvent.change(container.querySelector('[data-block="shop"] [data-field="shop-order"]'), { target: { value: '' } });
        fireEvent.click(container.querySelector('[data-block="shop"] [data-skill="smithing"] button'));
        expect(useEntityStore.getState().tokens[id].shop.skills).toEqual(['faith']);
        fireEvent.click(container.querySelector('[data-block="shop"] [data-skill] button'));
        expect(useEntityStore.getState().tokens[id].shop).toEqual({ price: [], section: 'general' });
    });

    it('the Foundation block edits its tier: an absent tier shows 1, and an edit reaches tokens.json', () => {
        const id = useEntityStore.getState().addToken({ name: 'Tier Fixture' });
        useEntityStore.getState().updateToken(id, { foundation: { kind: 'wood', skill: 'construction' } });
        useEntityStore.getState().setActiveEntity(id, 'token');
        const { container } = render(React.createElement(TokenEditor));
        const tier = within(container.querySelector('[data-block="foundation"]')).getByLabelText('Tier');
        expect(tier.value).toBe('1');
        // Untouched, the block keeps no tier key: absent reads as tier 1 in the game.
        expect(syncPayload()['tokens.json'][id].foundation).toEqual({ kind: 'wood', skill: 'construction' });

        fireEvent.change(tier, { target: { value: '3' } });
        expect(useEntityStore.getState().tokens[id].foundation).toEqual({ kind: 'wood', skill: 'construction', tier: 3 });
        expect(syncPayload()['tokens.json'][id].foundation).toEqual({ kind: 'wood', skill: 'construction', tier: 3 });

        fireEvent.change(within(container.querySelector('[data-block="foundation"]')).getByLabelText('Tier'), { target: { value: '0' } });
        expect(useEntityStore.getState().tokens[id].foundation.tier).toBe(1);
    });

    it('the Foundation block offers every gathering kind: an Excavation and a Dock reach tokens.json', () => {
        const id = useEntityStore.getState().addToken({ name: 'Kind Fixture' });
        useEntityStore.getState().updateToken(id, { foundation: { kind: 'wood', skill: 'construction' } });
        useEntityStore.getState().setActiveEntity(id, 'token');
        const { container } = render(React.createElement(TokenEditor));
        const kindSelect = () => [...container.querySelectorAll('[data-block="foundation"] select')]
            .find((s) => [...s.options].some((o) => o.value === 'wood'));
        const labels = [...kindSelect().options].map((o) => o.textContent);
        expect(labels).toEqual(expect.arrayContaining(['Excavation', 'Dock', 'Farmland']));
        expect(labels).not.toContain('Nursery');

        fireEvent.change(kindSelect(), { target: { value: 'excavation' } });
        expect(syncPayload()['tokens.json'][id].foundation).toEqual({ kind: 'excavation', skill: 'construction' });
        fireEvent.change(kindSelect(), { target: { value: 'dock' } });
        expect(syncPayload()['tokens.json'][id].foundation).toEqual({ kind: 'dock', skill: 'construction' });
    });

    it('renders a Token carrying every block without throwing', () => {
        const id = useEntityStore.getState().addToken({ name: 'Full Fixture', ...everyBlock() });
        useEntityStore.getState().setActiveEntity(id, 'token');
        const { container } = render(React.createElement(TokenEditor));
        for (const key of TOKEN_LIFECYCLE_BLOCKS) {
            expect(within(container.querySelector(`[data-block="${key}"]`)).getByText('Remove')).toBeTruthy();
        }
    });
});

describe('Recalculate files the lifecycle blocks under a sensible type (slice 4.4)', () => {
    const cases = [
        ['spawner', 'spawner'],
        ['foundation', 'station'],
        ['camp', 'camp'],
    ];
    for (const [block, type] of cases) {
        it(`a ${block}-only Token is written as tokenType ${type}, not buff`, () => {
            const id = useEntityStore.getState().addToken({ name: `Only ${block}` });
            useEntityStore.getState().updateToken(id, { [block]: everyBlock()[block] });
            expect(syncPayload()['tokens.json'][id].tokenType).toBe(type);
        });
    }
});
