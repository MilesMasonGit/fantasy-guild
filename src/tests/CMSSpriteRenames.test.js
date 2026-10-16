// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import React from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { asLoaded } from './fixtures/shippedAsLoaded.js';

import { useEntityStore } from '../../cms/src/stores/useEntityStore';
import { useSimulationStore } from '../../cms/src/stores/useSimulationStore';
import { syncFiles } from '../../cms/src/engine/recipeSync';
import { pendingSpriteRenames, applySpriteRenamesTo } from '../../cms/src/engine/spriteRenames';
import SpriteRenamesCard from '../../cms/src/components/audit/SpriteRenamesCard.jsx';
import { resolveSpritePath } from '../utils/AssetManager.js';
import { LEGACY_SPRITE_NAMES } from '../config/registries/legacySpriteNames.js';

/**
 * ⭐ The CMS's "Apply renames" (Sprite Audit page): the art was renamed, and the workspace's sprite
 * fields may hold the old names. One click rewrites them in the workspace; Sync to Game then writes
 * them to data/. Run here on the shipped content loaded into a workspace with no-op storage, never
 * on the real workspace or data/ (TESTING, "The CMS").
 */

const DATA = path.resolve(__dirname, '../../data');
const FILES = ['items.json', 'tokens.json', 'tokenRecipes.json', 'effects.json'];
const read = (file) => fs.readFileSync(path.join(DATA, file), 'utf8').replace(/\r\n/g, '\n');
const raw = Object.fromEntries(FILES.map((f) => [f, asLoaded(f, read(f))]));

/** The workspace `/api/load-game-data` builds from `data/`. */
function workspaceFromFiles() {
    const files = Object.fromEntries(FILES.map((f) => [f, JSON.parse(raw[f])]));
    const recipePools = {};
    for (const recipe of files['tokenRecipes.json']) (recipePools[recipe.skill || 'general'] ||= []).push(recipe);
    return { items: files['items.json'], tokens: files['tokens.json'], effects: files['effects.json'], recipePools, starterCamp: null };
}

/** A small workspace holding old names, current names and no name. */
const SMALL = () => ({
    items: {
        item_a: { id: 'item_a', name: 'Copper Ore', sprite: 'ore_copper' },
        item_b: { id: 'item_b', name: 'Torch', sprite: 'Item_torch' },
        item_c: { id: 'item_c', name: 'Already New', sprite: 'i_ingot_copper' },
        item_d: { id: 'item_d', name: 'No Sprite' }
    },
    tokens: {
        token_a: { id: 'token_a', name: 'Copper Vein', sprite: 'token_ore_copper' },
        token_b: { id: 'token_b', name: 'Emoji', sprite: '🌲' }
    }
});

const syncPayload = () => syncFiles(useEntityStore.getState().recalculateEconomy({}));
const noStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const WORKSPACE_KEY = 'fantasy-guild-cms-v2';
let storedBefore;

beforeAll(() => {
    storedBefore = localStorage.getItem(WORKSPACE_KEY);
    useEntityStore.persist.setOptions({ storage: noStorage });
});
afterAll(() => {
    expect(localStorage.getItem(WORKSPACE_KEY)).toBe(storedBefore);
});
beforeEach(() => {
    useEntityStore.getState().hydrate(workspaceFromFiles());
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) })));
});
afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    useSimulationStore.getState().clearResults();
});

describe('which sprite fields hold an old name', () => {
    it('lists every old name with its new one, and nothing else', () => {
        const pending = pendingSpriteRenames(SMALL());
        expect(pending.map(r => [r.collection, r.id, r.field, r.from, r.to])).toEqual([
            ['items', 'item_a', 'sprite', 'ore_copper', 'i_ore_copper'],
            ['items', 'item_b', 'sprite', 'Item_torch', 'i_torch'],
            ['tokens', 'token_a', 'sprite', 'token_ore_copper', 't_ore_vein_copper']
        ]);
        expect(pending[0].name).toBe('Copper Ore');
    });

    it('renames them without touching the workspace it was given, and a second time changes nothing', () => {
        const ws = SMALL();
        const before = JSON.stringify(ws);
        const changed = applySpriteRenamesTo(ws);
        expect(JSON.stringify(ws)).toBe(before);
        expect(changed.items.item_a.sprite).toBe('i_ore_copper');
        expect(changed.items.item_c).toBe(ws.items.item_c);
        expect(changed.tokens.token_b).toBe(ws.tokens.token_b);
        const again = { ...ws, ...changed };
        expect(pendingSpriteRenames(again)).toEqual([]);
        expect(applySpriteRenamesTo(again)).toEqual({});
    });
});

describe('Apply renames on the shipped content', () => {
    it('finds the old names the content holds today', () => {
        const ws = useEntityStore.getState();
        const old = [...Object.values(ws.items), ...Object.values(ws.tokens)].filter(e => typeof e?.sprite === 'string' && LEGACY_SPRITE_NAMES[e.sprite]);
        expect(pendingSpriteRenames(ws)).toHaveLength(old.length);
    });

    it('rewrites every one, each drawing the same picture, and a second click changes nothing', () => {
        const before = useEntityStore.getState();
        const pictures = Object.fromEntries([...Object.values(before.items), ...Object.values(before.tokens)]
            .map(e => [e.id, resolveSpritePath(e.sprite)]));
        const count = pendingSpriteRenames(before).length;

        expect(useEntityStore.getState().applySpriteRenames()).toBe(count);
        const after = useEntityStore.getState();
        expect(pendingSpriteRenames(after)).toEqual([]);
        for (const e of [...Object.values(after.items), ...Object.values(after.tokens)]) {
            expect(resolveSpritePath(e.sprite), e.id).toBe(pictures[e.id]);
        }
        expect(useEntityStore.getState().applySpriteRenames()).toBe(0);
    });

    it('Sync to Game then writes the new names, and nothing else changes', () => {
        const without = (files) => JSON.parse(JSON.stringify(files, (k, v) => (k === 'sprite' ? undefined : v)));
        const before = syncPayload();
        useEntityStore.getState().applySpriteRenames();
        const after = syncPayload();
        expect(without(after)).toEqual(without(before));
        const sprites = [...Object.values(after['items.json']), ...Object.values(after['tokens.json'])].map(e => e.sprite).filter(Boolean);
        expect(sprites.filter(s => LEGACY_SPRITE_NAMES[s])).toEqual([]);
        expect(sprites.length).toBeGreaterThan(100);
    });

    it('is persisted with the workspace, the path Sync to Game reads', () => {
        useEntityStore.getState().applySpriteRenames();
        const persisted = useEntityStore.persist.getOptions().partialize(useEntityStore.getState());
        expect(pendingSpriteRenames(persisted)).toEqual([]);
        expect(persisted.items).toBe(useEntityStore.getState().items);
    });
});

describe('the Art renames card', () => {
    it('says how many, lists them, and applies them on the click', () => {
        useEntityStore.getState().hydrate(SMALL());
        const { container, getByRole } = render(React.createElement(SpriteRenamesCard));
        const status = () => container.querySelector('[data-sprite-renames-status]').textContent;
        expect(status()).toMatch(/3 sprite names .*2 in items, 1 in Tokens/);
        expect(container.textContent).toContain('ore_copper');
        expect(container.textContent).toContain('t_ore_vein_copper');

        fireEvent.click(getByRole('button', { name: 'Apply renames' }));
        expect(status()).toMatch(/Renamed 3 sprite names\. Now press Sync to Game\./);
        expect(getByRole('button', { name: 'Apply renames' }).disabled).toBe(true);
        expect(useEntityStore.getState().items.item_b.sprite).toBe('i_torch');
    });

    it('says there is nothing to do when every name is current', () => {
        useEntityStore.getState().hydrate({ items: { item_c: SMALL().items.item_c }, tokens: {} });
        const { container } = render(React.createElement(SpriteRenamesCard));
        expect(container.querySelector('[data-sprite-renames-status]').textContent).toMatch(/Nothing to rename/);
    });
});
