// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { SRC, listFiles, readSource, rel, setScanTimeout } from './fixtures/sourceScan.js';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';

vi.mock('../config/registries/recipePoolRegistry.js', async (orig) => ({
    ...(await orig()),
    recipesForToken: () => [{ id: 'recipe_a' }, { id: 'recipe_b' }]
}));

import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { UI_EVENTS } from '../systems/core/engineEvents.js';
import * as StationRecipe from '../systems/board/StationRecipe.js';
import { CalloutLayer } from '../ui/components/board/CalloutLayer.jsx';
import './fixtures/testTokens.js';
import { placeAt } from './fixtures/mat.js';

/**
 * The dev panels below are the only exception: they fake engine changes on
 * purpose.
 */

setScanTimeout();

const DEV_PANELS = new Set([
    'ui/components/TestDashboard.jsx'
]);

const codeOf = (text) => text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

const UI_FILES = [...listFiles(`${SRC}/ui`, { ext: /\.(js|jsx|mjs)$/ }), `${SRC}/main.jsx`]
    .map(f => ({ rel: rel(f), code: codeOf(readSource(f)) }))
    .filter(f => !f.rel.startsWith('ui/dev/') && !DEV_PANELS.has(f.rel));

describe('the UI never publishes an engine event (CR3-306)', () => {
    it('scans the UI', () => {
        expect(UI_FILES.length).toBeGreaterThan(80);
    });

    it('every UI publish names a UI event or asks for a sound', () => {
        // Local aliases of a UI event (`const X = { HOVER: UI_EVENTS.Y }`) resolve here.
        const aliases = new Set();
        for (const { code } of UI_FILES) {
            for (const m of code.matchAll(/(\w+)\s*[:=]\s*UI_EVENTS\.\w+/g)) aliases.add(m[1]);
        }
        const hits = [];
        for (const { rel, code } of UI_FILES) {
            for (const m of code.matchAll(/\.publish\(\s*([\w.]+)/g)) {
                const arg = m[1];
                const ok = arg.startsWith('UI_EVENTS.')
                    || arg === 'ENGINE_EVENTS.AUDIO_PLAY'
                    || aliases.has(arg.split('.').pop());
                if (!ok) hits.push(`${rel}: publish(${arg})`);
            }
        }
        expect(hits).toEqual([]);
    });
});

describe('StationRecipe.setSelectedRecipe announces its own change', () => {
    const station = () => ({ id: 'tok_station', typeId: 'fixture_station' });
    const listen = () => {
        const seen = [];
        const offTile = EventBus.subscribe(BOARD_EVENTS.TILE_CHANGED, p => seen.push(p));
        return { seen, off: offTile };
    };

    it('publishes TILE_CHANGED for that Token when the selection changes', () => {
        const inst = station();
        const { seen, off } = listen();
        try {
            expect(StationRecipe.setSelectedRecipe(inst, 'recipe_a', {})).toBe(true);
        } finally { off(); }
        expect(seen).toEqual([{ instanceId: 'tok_station', typeId: 'fixture_station' }]);
    });

    it('says nothing when refused, or when the selection is unchanged', () => {
        const inst = { ...station(), selectedRecipeId: 'recipe_b' };
        const { seen, off } = listen();
        try {
            expect(StationRecipe.setSelectedRecipe(inst, 'not_in_pool', {})).toBe(false);
            expect(StationRecipe.setSelectedRecipe(inst, 'recipe_b', {})).toBe(true);
        } finally { off(); }
        expect(seen).toEqual([]);
    });
});

describe('a message the screen raises on one Token (CR3-306, CR3-013)', () => {
    afterEach(() => cleanup());

    it('UI_TOKEN_ALERT is said as a callout over that Token', () => {
        GameState.initNew();
        const hall = placeAt('fixture_producer', 600, 500);
        const { container } = render(React.createElement(CalloutLayer));
        expect(container.querySelector('[data-callout]')).toBeNull();
        act(() => {
            EventBus.publish(UI_EVENTS.UI_TOKEN_ALERT, {
                instanceId: hall.id, severity: 'disallow', type: 'drop_rejected', name: 'Guild Hall',
                title: 'Guild Hall cannot be removed from the playmat.', rulesText: null,
                message: 'Guild Hall cannot be removed from the playmat.'
            });
        });
        expect(container.querySelector('[data-callout]').textContent).toBe('Guild Hall cannot be removed from the playmat.');
    });
});
