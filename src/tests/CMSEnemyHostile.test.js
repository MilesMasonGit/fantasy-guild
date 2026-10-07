// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import React from 'react';
import { render, cleanup, fireEvent, within } from '@testing-library/react';

import { useEntityStore } from '../../cms/src/stores/useEntityStore';
import { useSimulationStore } from '../../cms/src/stores/useSimulationStore';
import { syncFiles } from '../../cms/src/engine/recipeSync';
import TokenEditor from '../../cms/src/components/editors/TokenEditor.jsx';
import { isHostileEnemy } from '../config/registries/enemyProfile.js';

/**
 * B7.2 — the CMS models **`enemy.hostile`** before any content uses it
 * (roadmap v1 §0.3: Sync destroys what the CMS does not carry).
 */

const DATA = path.resolve(__dirname, '../../data');
const FILES = ['items.json', 'tokens.json', 'maps.json', 'tokenRecipes.json', 'effects.json'];
// git may check these out with CRLF; JSON.stringify always emits LF.
const read = (file) => fs.readFileSync(path.join(DATA, file), 'utf8').replace(/\r\n/g, '\n');
const raw = Object.fromEntries(FILES.map((f) => [f, read(f)]));

/** The workspace `/api/load-game-data` builds from `data/` (vite-plugin-cms-api.js). */
function workspaceFromFiles(files) {
    const recipePools = {};
    for (const recipe of files['tokenRecipes.json']) {
        (recipePools[recipe.skill || 'general'] ||= []).push(recipe);
    }
    return {
        items: files['items.json'],
        tokens: files['tokens.json'],
        maps: files['maps.json'],
        effects: files['effects.json'],
        recipePools,
    };
}

function load(files) {
    useEntityStore.getState().hydrate(workspaceFromFiles(files));
}

const shipped = () => Object.fromEntries(FILES.map((f) => [f, JSON.parse(raw[f])]));

/** Recalculate + build the sync payload, exactly as `syncToGame` does, minus the POST. */
function syncPayload() {
    const balanced = useEntityStore.getState().recalculateEconomy({});
    return syncFiles(balanced);
}

const shippedTokens = JSON.parse(raw['tokens.json']);
const enemyIds = Object.keys(shippedTokens).filter((id) => shippedTokens[id].enemy);

beforeEach(() => load(shipped()));
afterEach(() => {
    cleanup();
    useSimulationStore.getState().clearResults();
});

describe('a control sync of today’s data changes nothing', () => {
    it('B7.3: exactly Goblin and Goblin Chief ship hostile; Cow and Thorn Elemental do not', () => {
        expect(enemyIds.length).toBeGreaterThan(0);
        const hostile = enemyIds.filter((id) => shippedTokens[id].enemy.hostile === true).sort();
        expect(hostile).toEqual(['token_goblin', 'token_goblin_chief']);
        for (const id of ['token_cow', 'token_thorn_elemental']) {
            expect(shippedTokens[id].enemy).not.toHaveProperty('hostile');
            expect(isHostileEnemy(shippedTokens[id])).toBe(false);
        }
        for (const id of hostile) expect(isHostileEnemy(shippedTokens[id])).toBe(true);
    });

    it('load → Recalculate → Sync writes all five files byte-identical', () => {
        const files = syncPayload();
        for (const f of FILES) expect(JSON.stringify(files[f], null, 2)).toBe(raw[f].trimEnd());
    });
});

describe('enemy.hostile survives load → edit → sync → reload', () => {
    // A Token that ships peaceful (the goblins ship hostile since B7.3).
    const target = () => enemyIds.find((id) => id === 'token_cow') || enemyIds.find((id) => !shippedTokens[id].enemy.hostile);

    it('hostile: true reaches tokens.json, the rest of the enemy block untouched', () => {
        const id = target();
        const before = { ...useEntityStore.getState().tokens[id].enemy };
        useEntityStore.getState().updateToken(id, { enemy: { ...before, hostile: true } });

        const written = syncPayload()['tokens.json'][id];
        expect(written.enemy).toEqual({ ...before, hostile: true });
        expect(isHostileEnemy(written)).toBe(true);
    });

    it('a second load of the synced files and a second sync change nothing, and keep it', () => {
        const id = target();
        const enemy = useEntityStore.getState().tokens[id].enemy;
        useEntityStore.getState().updateToken(id, { enemy: { ...enemy, hostile: true } });
        const first = syncPayload();
        const serialised = Object.fromEntries(FILES.map((f) => [f, JSON.stringify(first[f], null, 2)]));

        load(Object.fromEntries(FILES.map((f) => [f, JSON.parse(serialised[f])])));
        const second = syncPayload();
        for (const f of FILES) expect(JSON.stringify(second[f], null, 2)).toBe(serialised[f]);
        expect(second['tokens.json'][id].enemy.hostile).toBe(true);

        // Only that one Token's file entry differs from the shipped data.
        const now = second['tokens.json'];
        for (const other of Object.keys(shippedTokens).filter((t) => t !== id)) {
            expect(JSON.stringify(now[other])).toBe(JSON.stringify(shippedTokens[other]));
        }
    });
});

describe('the Token editor’s Hostile checkbox', () => {
    function editor(id) {
        useEntityStore.getState().setActiveEntity(id, 'token');
        return render(React.createElement(TokenEditor));
    }

    it('ticking writes hostile: true; unticking removes the key (absent = peaceful)', () => {
        const id = enemyIds.find((t) => t === 'token_cow') || enemyIds.find((t) => !shippedTokens[t].enemy.hostile);
        const before = JSON.stringify(useEntityStore.getState().tokens[id].enemy);
        const { container } = editor(id);
        const box = within(container).getByLabelText('Hostile');
        expect(box.checked).toBe(false);

        fireEvent.click(box);
        expect(useEntityStore.getState().tokens[id].enemy.hostile).toBe(true);
        expect(box.checked).toBe(true);

        fireEvent.click(box);
        expect(useEntityStore.getState().tokens[id].enemy).not.toHaveProperty('hostile');
        expect(JSON.stringify(useEntityStore.getState().tokens[id].enemy)).toBe(before);
        const files = syncPayload();
        expect(JSON.stringify(files['tokens.json'], null, 2)).toBe(raw['tokens.json'].trimEnd());
    });

    it('editing the style keeps hostile', () => {
        const id = enemyIds.find((t) => t === 'token_cow') || enemyIds.find((t) => !shippedTokens[t].enemy.hostile);
        const enemy = useEntityStore.getState().tokens[id].enemy;
        useEntityStore.getState().updateToken(id, { enemy: { ...enemy, hostile: true } });
        const { container } = editor(id);
        const style = [...container.querySelectorAll('select')]
            .find((s) => [...s.options].map((o) => o.value).join() === 'melee,ranged,magic');
        fireEvent.change(style, { target: { value: 'ranged' } });
        expect(useEntityStore.getState().tokens[id].enemy).toMatchObject({ style: 'ranged', hostile: true });
    });

    it('a Token that is not an enemy shows no Hostile box', () => {
        const id = useEntityStore.getState().addToken({ name: 'Plain Fixture' });
        const { container } = editor(id);
        expect(within(container).queryByLabelText('Hostile')).toBeNull();
    });
});
