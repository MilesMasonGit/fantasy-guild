// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { asLoaded } from './fixtures/shippedAsLoaded.js';
import React from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';

import { useEntityStore } from '../../cms/src/stores/useEntityStore';
import { useSimulationStore } from '../../cms/src/stores/useSimulationStore';
import { syncFiles } from '../../cms/src/engine/recipeSync';
import SupplyChainLayout from '../../cms/src/components/layout/SupplyChainLayout.jsx';
import { enemyDropsOf } from '../config/registries/enemyProfile.js';

/**
 * The CMS marks an enemy's drop line "First kill always drops" (brief 240 K0.3): a box on each
 * item line of an enemy's Drops, never on another Token's Outputs, and the mark survives
 * Recalculate and Sync. No-op storage (TESTING, "The CMS").
 */

const DATA = path.resolve(__dirname, '../../data');
const FILES = ['items.json', 'tokens.json', 'tokenRecipes.json', 'effects.json'];
const read = (file) => fs.readFileSync(path.join(DATA, file), 'utf8').replace(/\r\n/g, '\n');
const raw = Object.fromEntries(FILES.map((f) => [f, asLoaded(f, read(f))]));
const WORKSPACE_KEY = 'fantasy-guild-cms-v2';
const noStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
let storedBefore;

function load() {
    const files = Object.fromEntries(FILES.map((f) => [f, JSON.parse(raw[f])]));
    const recipePools = {};
    for (const recipe of files['tokenRecipes.json']) (recipePools[recipe.skill || 'general'] ||= []).push(recipe);
    useEntityStore.getState().hydrate({ items: files['items.json'], tokens: files['tokens.json'], effects: files['effects.json'], recipePools });
}

const boxes = (container) => [...container.querySelectorAll('input[data-field="firstKill"]')];

beforeAll(() => {
    storedBefore = localStorage.getItem(WORKSPACE_KEY);
    useEntityStore.persist.setOptions({ storage: noStorage });
});
afterAll(() => expect(localStorage.getItem(WORKSPACE_KEY)).toBe(storedBefore));
beforeEach(load);
afterEach(() => {
    cleanup();
    useSimulationStore.getState().clearResults();
});

describe('First kill always drops, in the CMS', () => {
    it('ticks a Goblin Chief drop line, and the mark reaches the game through Recalculate and Sync', () => {
        useEntityStore.getState().setActiveEntity('token_goblin_chief', 'token');
        const { container } = render(React.createElement(SupplyChainLayout, null, React.createElement('div')));
        const lines = useEntityStore.getState().tokens.token_goblin_chief.config.outputs;
        expect(boxes(container)).toHaveLength(lines.filter((o) => o.itemId).length);
        expect(boxes(container).every((b) => !b.checked)).toBe(true);
        fireEvent.click(boxes(container)[0]);
        expect(useEntityStore.getState().tokens.token_goblin_chief.config.outputs[0].firstKill).toBe(true);

        const chief = JSON.parse(JSON.stringify(syncFiles(useEntityStore.getState().recalculateEconomy({}))['tokens.json'])).token_goblin_chief;
        expect(chief.config.outputs[0].firstKill).toBe(true);
        expect(enemyDropsOf(chief)[0].firstKill).toBe(true);
        expect(enemyDropsOf(chief).slice(1).some((d) => d.firstKill)).toBe(false);

        fireEvent.click(boxes(container)[0]);
        expect(useEntityStore.getState().tokens.token_goblin_chief.config.outputs[0].firstKill).toBeUndefined();
    });

    it('offers no box on a Token that is not an enemy', () => {
        useEntityStore.getState().setActiveEntity('token_oak_tree', 'token');
        const { container } = render(React.createElement(SupplyChainLayout, null, React.createElement('div')));
        expect(boxes(container)).toHaveLength(0);
    });
});
