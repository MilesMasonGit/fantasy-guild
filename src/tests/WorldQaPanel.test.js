// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { GameState } from '../state/GameState.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as World from '../systems/world/World.js';
import { AtlasDevSection } from '../ui/dev/AtlasDevSection.jsx';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * The QA panel's World block: this game's world, or a preview of any seed, in words, by clicking.
 */

const h = React.createElement;

function newGame() {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    EngineBootstrap.createDefaultGameData();
}

afterEach(() => cleanup());

describe('the QA panel\'s World block', () => {
    it('shows this game\'s world in words', () => {
        newGame();
        const view = render(h(AtlasDevSection));
        const world = World.currentWorld();
        expect(view.container.querySelector('[data-qa-world-status]').textContent).toContain(`seed ${world.seed}`);
        fireEvent.click(view.container.querySelector('[data-qa-world-show]'));
        const dump = view.container.querySelector('[data-qa-world-dump]').textContent;
        expect(dump.startsWith(`World ${world.seed} · 127 cells`)).toBe(true);
        expect(dump).toContain('Ring 3 · tier 3');
    });

    it('previews any seed, and the next, without touching the game\'s world', () => {
        newGame();
        const kept = World.currentWorld();
        const view = render(h(AtlasDevSection));
        fireEvent.change(view.container.querySelector('[data-qa-world-seed]'), { target: { value: '41' } });
        fireEvent.click(view.container.querySelector('[data-qa-world-preview]'));
        expect(view.container.querySelector('[data-qa-world-dump]').textContent.startsWith('World 41 ·')).toBe(true);
        fireEvent.click(view.container.querySelector('[data-qa-world-next]'));
        expect(view.container.querySelector('[data-qa-world-dump]').textContent.startsWith('World 42 ·')).toBe(true);
        expect(World.currentWorld()).toBe(kept);
    });

    it('a save from before worlds says so', () => {
        newGame();
        GameState.state.world = null;
        const view = render(h(AtlasDevSection));
        expect(view.container.querySelector('[data-qa-world-status]').textContent).toMatch(/no world/);
        fireEvent.click(view.container.querySelector('[data-qa-world-show]'));
        expect(view.container.querySelector('[data-qa-world-dump]').textContent).toMatch(/no world/);
    });
});
