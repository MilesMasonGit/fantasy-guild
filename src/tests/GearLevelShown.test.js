// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { markHeld } from '../systems/equipment/heldCopies.js';
import * as SkillSystem from '../systems/hero/SkillSystem.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { xpForLevel } from '../utils/XPCurve.js';
import { itemTipFacts } from '../ui/components/drawer/ItemTip.jsx';
import { DeckDndProvider } from '../ui/dnd/DndKit.jsx';
import { DockEquipmentGrid } from '../ui/components/dock/DockEquipmentGrid.jsx';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));

/**
 * A level a piece of gear asks for is shown before the drop is refused, and gear already worn below
 * it (a requirement authored after it was equipped) is marked on its slot: it lends nothing and a
 * weapon is not swung.
 */

const ITEMS = {
    gl_sword: { id: 'gl_sword', name: 'Iron Sword', type: 'weapon', equipSlot: 'hand', stackable: true, styles: ['melee'], damage: 4, levelRequired: 15 },
    gl_helm: { id: 'gl_helm', name: 'Iron Helm', type: 'armor', equipSlot: 'hat', stackable: true, requirements: [{ skill: 'mining', level: 10 }] },
    gl_cap: { id: 'gl_cap', name: 'Cloth Cap', type: 'armor', equipSlot: 'hat', stackable: true }
};

beforeAll(() => registerItems(ITEMS));

describe('the item tip', () => {
    it('says the level the gear asks for', () => {
        expect(itemTipFacts(ITEMS.gl_sword).needs).toBe('Needs Melee 15');
        expect(itemTipFacts(ITEMS.gl_helm).needs).toBe('Needs Mining 10');
        expect(itemTipFacts(ITEMS.gl_cap).needs).toBeNull();
    });
});

describe('a worn piece the hero is below the level of', () => {
    let hero;

    beforeEach(() => {
        localStorage.clear();
        GameState.initNew();
        InventoryManager.init();
        hero = generateHero({ name: 'Aela' });
        hero.skills.melee = { level: 12, xp: xpForLevel(12) };
        hero.equipment[0] = 'gl_sword';
        markHeld(hero, 0, true);
        hero.equipment[1] = 'gl_cap';
        markHeld(hero, 1, true);
        GameState.state.heroes = [hero];
    });
    afterEach(cleanup);

    const grid = () => render(React.createElement(DeckDndProvider, null, React.createElement(DockEquipmentGrid, { heroId: hero.id })));

    it('is marked on its slot, with what it needs', () => {
        const view = grid();
        const sword = view.container.querySelector('[data-equip-slot="0"]');
        expect(sword.querySelector('[data-equip-unmet]')).not.toBeNull();
        expect(sword.getAttribute('title')).toMatch(/Melee 15/);
        expect(view.container.querySelector('[data-equip-slot="1"] [data-equip-unmet]')).toBeNull();
    });

    it('loses the mark once the hero reaches the level', async () => {
        const view = grid();
        expect(view.container.querySelector('[data-equip-slot="0"] [data-equip-unmet]')).not.toBeNull();
        await act(async () => { SkillSystem.addXP(hero.id, 'melee', xpForLevel(15) - hero.skills.melee.xp); });
        expect(hero.skills.melee.level).toBe(15);
        expect(view.container.querySelector('[data-equip-slot="0"] [data-equip-unmet]')).toBeNull();
    });
});
