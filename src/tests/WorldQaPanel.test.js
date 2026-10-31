// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { GameState } from '../state/GameState.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as World from '../systems/world/World.js';
import * as Arrival from '../systems/world/Arrival.js';
import * as Atlas from '../systems/atlas/Atlas.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Occupation from '../systems/board/Occupation.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { QuestManager } from '../systems/quests/QuestManager.js';
import * as QuestTokens from '../systems/quests/QuestTokens.js';
import { TUTORIAL_QUESTS } from '../systems/quests/tutorialQuests.js';
import { worldTables } from '../config/registries/worldTablesRegistry.js';
import { AtlasDevSection } from '../ui/dev/AtlasDevSection.jsx';
import { fixtureCell } from '../ui/dev/worldDev.js';
import { useWorldMapRequests } from '../ui/hooks/useWorldMapRequests.js';

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

describe("the QA panel's fixture places (brief 330 W3)", () => {
    const said = (view) => view.container.querySelector('[data-qa-world-said]')?.textContent || '';
    const stoneCells = () => {
        const t = Atlas.activeRegion().terrain;
        const i = t.legend.indexOf('stone');
        return i < 0 ? 0 : [...t.cells].filter(c => parseInt(c, 36) === i).length;
    };

    it('settles a Highland place for free: written from its kit, with Stone, and held by its arrival', () => {
        newGame();
        Arrival.init();
        try {
            const home = Atlas.activeRegionId();
            const view = render(h(AtlasDevSection));
            fireEvent.click(view.container.querySelector('[data-qa-world-fixture="highland"]'));
            expect(said(view)).toMatch(/^Settled Highland .*: 4 enemies hold it$/);
            const region = Atlas.activeRegion();
            expect(region.id).not.toBe(home);
            expect(region.cellId).toBeNull();
            expect(region.biome).toEqual({ mountain: 1 });
            expect(stoneCells()).toBeGreaterThan(20);
            expect(Occupation.isOccupied()).toBe(true);
            // Off the world map: the frontier is as it was.
            expect([...World.settledCellIds()]).toEqual(['0,0']);

            fireEvent.click(view.container.querySelector('[data-qa-world-beat]'));
            expect(said(view)).toBe("4 enemies beaten: the mat is the guild's");
            expect(Occupation.isOccupied()).toBe(false);
            fireEvent.click(view.container.querySelector('[data-qa-world-beat]'));
            expect(said(view)).toBe('Nothing holds this mat');
        } finally {
            Arrival.teardown();
        }
    });

    it("every kit's fixture is a ring-1 place of the line that leans most to it", () => {
        newGame();
        for (const kit of worldTables().kits) {
            const cell = fixtureCell(kit.id);
            expect(cell.kit).toBe(kit.id);
            expect(cell.ring).toBe(1);
            expect(cell.origins.length).toBeGreaterThan(0);
            expect(cell.arrival[0].count).toBeGreaterThanOrEqual(3);
        }
    });

    it('jumps the tutorial to its last step, which arrives on the mat and opens the world map', () => {
        newGame();
        QuestManager.init();
        const opened = vi.fn();
        const Probe = () => { useWorldMapRequests(opened); return null; };
        render(h(Probe));
        try {
            const view = render(h(AtlasDevSection));
            fireEvent.click(view.container.querySelector('[data-qa-world-tutorial]'));
            expect(said(view)).toMatch(/last step/);
            expect(QuestTokens.tutorialTokens().map(t => t.quest.id)).toEqual(['cart_first_place']);
            expect(GameState.state.quests.completedTutorials).toEqual(TUTORIAL_QUESTS.slice(0, -1).map(t => t.id));
            expect(opened).toHaveBeenCalledTimes(1);
        } finally {
            QuestManager.cleanup();
        }
    });

    it('only the step marked so opens the world map', () => {
        const opened = vi.fn();
        const Probe = () => { useWorldMapRequests(opened); return null; };
        render(h(Probe));
        EventBus.publish(ENGINE_EVENTS.QUEST_SPAWNED, { questId: 'cart_goblin', tutorial: true });
        EventBus.publish(ENGINE_EVENTS.QUEST_SPAWNED, { questId: 'cart_first_place', tutorial: false });
        expect(opened).not.toHaveBeenCalled();
        EventBus.publish(ENGINE_EVENTS.QUEST_SPAWNED, { questId: 'cart_first_place', tutorial: true });
        expect(opened).toHaveBeenCalledTimes(1);
    });

    it('the jump is only played on the Starter Camp', () => {
        newGame();
        const { region } = Atlas.createRegion();
        expect(Atlas.travel(region.id).success).toBe(true);
        const view = render(h(AtlasDevSection));
        fireEvent.click(view.container.querySelector('[data-qa-world-tutorial]'));
        expect(said(view)).toBe('Travel to the Starter Camp first');
        expect(BoardState.tokens().some(t => t.quest?.id === 'cart_first_place')).toBe(false);
    });
});
