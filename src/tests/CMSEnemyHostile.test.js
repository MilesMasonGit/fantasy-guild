// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { asLoaded } from './fixtures/shippedAsLoaded.js';
import React from 'react';
import { render, cleanup, fireEvent, within } from '@testing-library/react';

import { useEntityStore } from '../../cms/src/stores/useEntityStore';
import { useSimulationStore } from '../../cms/src/stores/useSimulationStore';
import { syncFiles } from '../../cms/src/engine/recipeSync';
import TokenEditor from '../../cms/src/components/editors/TokenEditor.jsx';
import { enemyProfileOf } from '../config/registries/enemyProfile.js';
import { COMBAT_SKILL_IDS } from '../config/registries/skillRegistry.js';
import { DAMAGE_GROUPS, DAMAGE_TYPES, damageTypeLabel } from '../config/registries/damageTypes.js';

/** The preview's resistances as the editor writes them: groups first, a weakness said so. */
const resistText = (map) => {
    const ids = [...DAMAGE_GROUPS, ...DAMAGE_TYPES].map(x => x.id).filter(id => map?.[id]);
    return ids.length ? ids.map(id => (map[id] < 0 ? `${damageTypeLabel(id)} weak ${-map[id]}%` : `${damageTypeLabel(id)} ${map[id]}%`)).join(', ') : 'none';
};

/** The preview's hit: a plain Physical swing, or its moves by name and the type each hits with. */
const hitText = (p) => (p.moves?.length
    ? `${p.hit} · ${p.moves.map(m => `${m.name || 'Attack'}${m.hits ? ` ${damageTypeLabel(m.type)}` : ''}`).join(', ')}`
    : `${p.hit} Physical`);

/**
 * The CMS's enemy block: a control Sync changes nothing, the Style dropdown, the level preview. No
 * enemy is hostile any more; an old `enemy.hostile` in the content is carried untouched (Sync
 * destroys what the CMS does not carry) and read by nothing.
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
    it('load → Recalculate → Sync writes all four files byte-identical', () => {
        const files = syncPayload();
        for (const f of FILES) expect(JSON.stringify(files[f], null, 2)).toBe(raw[f].trimEnd());
    });
});

/** The enemy Style dropdown: the one select offering combat skills and nothing else. */
function styleSelect(container) {
    const found = [...container.querySelectorAll('select')].filter((s) => s.options.length
        && [...s.options].every((o) => COMBAT_SKILL_IDS.includes(o.value)));
    expect(found).toHaveLength(1);
    return found[0];
}

function editor(id) {
    useEntityStore.getState().setActiveEntity(id, 'token');
    return render(React.createElement(TokenEditor));
}

describe('the Token editor’s Style dropdown', () => {
    it('offers stealth, and exactly the registry’s combat skills', () => {
        const { container } = editor(enemyIds[0]);
        const values = [...styleSelect(container).options].map((o) => o.value);
        expect(values).toContain('stealth');
        expect(values).toEqual(COMBAT_SKILL_IDS);
    });
});

describe('no Hostile box: an old hostile mark is carried, and read by nothing', () => {
    it('an enemy’s editor shows no Hostile box', () => {
        const { container } = editor(enemyIds[0]);
        expect(within(container).queryByLabelText('Hostile')).toBeNull();
    });

    it('editing an enemy that still carries hostile keeps it, so a Sync moves nothing else', () => {
        const id = enemyIds[0];
        const enemy = useEntityStore.getState().tokens[id].enemy;
        useEntityStore.getState().updateToken(id, { enemy: { ...enemy, hostile: true } });
        const { container } = editor(id);
        fireEvent.change(styleSelect(container), { target: { value: 'ranged' } });
        expect(useEntityStore.getState().tokens[id].enemy).toMatchObject({ style: 'ranged', hostile: true });
    });
});

describe('the Token editor’s level preview', () => {
    // Renders every shipped enemy's editor, so it needs more than the default timeout under full-suite load.
    // Rewritten for damage types: flat armour gave way to the enemy's resistances, and the hit names its type.
    it('shows the fight’s own numbers for every shipped enemy: HP, hit, resistances, swing time, XP', { timeout: 20000 }, () => {
        for (const id of enemyIds) {
            const p = enemyProfileOf(useEntityStore.getState().tokens[id]);
            const { container, unmount } = editor(id);
            const box = within(container).getByText('What the fight uses').parentElement.parentElement;
            expect(box.textContent, id).toContain(
                `HP${p.hp}Hit${hitText(p)}Resists${resistText(p.resistances)}Attacks every${(p.attackSpeed / 1000).toFixed(1)}sXP${p.xpAwarded}`);
            unmount();
        }
    });

    // A fixture, not a shipped enemy: what an older budget scale does must not hang on content.
    it('a level 1 enemy scaled by a budget of 0.3 reads 6 HP, a hit of 1 and 3 XP', () => {
        const id = 'token_cow';
        useEntityStore.getState().updateToken(id, { enemy: { level: 1, style: 'melee', budgetScale: 0.3 } });
        const { container } = editor(id);
        const box = within(container).getByText('What the fight uses').parentElement.parentElement;
        expect(box.textContent).toContain('HP6Hit1 PhysicalResistsnoneAttacks every3.0sXP3');
    });
});
