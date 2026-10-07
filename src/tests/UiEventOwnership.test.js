// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
import { EngineContext } from '../ui/context/EngineContext';
import { TokenCentreAlert } from '../ui/components/board/TokenEventAlert.jsx';

/**
 * The dev panels below are the only exception: they fake engine changes on
 * purpose.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, '..');

const DEV_PANELS = new Set([
    'ui/components/TestDashboard.jsx',
    'ui/components/MatTuner.jsx'
]);

function sourceFiles(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return [full].flatMap(sourceFiles);
        return /\.(js|jsx|mjs)$/.test(entry.name) ? [full] : [];
    });
}
const codeOf = (text) => text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

const UI_FILES = [...sourceFiles(path.join(SRC, 'ui')), path.join(SRC, 'main.jsx')]
    .map(f => ({ rel: path.relative(SRC, f).split(path.sep).join('/'), code: codeOf(fs.readFileSync(f, 'utf8')) }))
    .filter(f => !f.rel.startsWith('ui/dev/') && !DEV_PANELS.has(f.rel));

describe('the UI never publishes an engine event (CR3-306)', () => {
    it('scans the UI', () => {
        expect(UI_FILES.length).toBeGreaterThan(80);
    });

    it('every UI publish names a UI event or asks for a sound', () => {
        // Local aliases of a UI event (`TUTORIAL_AIDE_EVENTS.HOVER`) resolve here.
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

    it('UI_TOKEN_ALERT draws on that Token like an engine alert', () => {
        const { container } = render(React.createElement(
            EngineContext.Provider, { value: { GameState, EventBus } },
            React.createElement(DndContext, null, React.createElement(TokenCentreAlert, { instanceId: 'tok_hall' }))
        ));
        expect(container.querySelector('[data-alert-kind]')).toBeNull();
        act(() => {
            EventBus.publish(UI_EVENTS.UI_TOKEN_ALERT, {
                instanceId: 'tok_hall', severity: 'disallow', type: 'drop_rejected', name: 'Guild Hall',
                title: 'Guild Hall cannot be removed from the playmat.', rulesText: null,
                message: 'Guild Hall cannot be removed from the playmat.'
            });
        });
        expect(container.querySelector('[data-alert-kind]')).not.toBeNull();
    });
});
