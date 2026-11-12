// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn(), recordKill: vi.fn(), recordEnemyKill: vi.fn() }
}));

import { TestDashboard } from '../ui/components/TestDashboard.jsx';
import { filterByName, itemChoices, tokenChoices } from '../ui/dev/qaTools.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { placeAt } from './fixtures/mat.js';
import './fixtures/testTokens.js';

/**
 * ⭐ The QA panel holds the essentials only (owner, 2026-11-12): give any item, change the heroes,
 * put any Token or enemy on the mat.
 */

registerItems({
    item_qa_zircon_shard: { id: 'item_qa_zircon_shard', name: 'Zircon Shard', type: 'material', stackable: true, sprite: 'i_ore_copper' },
    item_qa_zircon_ring: { id: 'item_qa_zircon_ring', name: 'Zircon Ring', type: 'material', stackable: true, sprite: 'i_ore_copper' },
    item_qa_quartz_lump: { id: 'item_qa_quartz_lump', name: 'Quartz Lump', type: 'material', stackable: true, sprite: 'i_ore_copper' }
});
registerTokenTypes({
    qa_panel_bramble: {
        id: 'qa_panel_bramble', name: 'Panel Bramble', tokenType: 'resource', rarity: 'common', theme: 'fixture',
        uses: 10, sprite: 's_nature', size: 1, config: null
    },
    qa_panel_ogre: {
        id: 'qa_panel_ogre', name: 'Panel Ogre', tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: 1,
        sprite: 's_crime', requiresHero: true, enemy: { level: 3, style: 'melee' },
        config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
    }
});

const rows = (picker) => [...picker.querySelectorAll('[data-qa-pick]')];
const names = (picker) => rows(picker).map(b => b.textContent);

function openPanel() {
    const view = render(React.createElement(TestDashboard));
    fireEvent.click(view.getByTitle('Open QA Dashboard'));
    return view;
}

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    placeAt('token_guild_hall', 880, 563);
});

afterEach(() => cleanup());

describe('the pickers search by name', () => {
    it('every word typed must be in the name, in any case', () => {
        const list = [{ id: 'a', name: 'Oak Wood' }, { id: 'b', name: 'Oak Seed' }, { id: 'c', name: 'Birch Wood' }];
        expect(filterByName(list, '')).toEqual(list);
        expect(filterByName(list, 'OAK').map(c => c.id)).toEqual(['a', 'b']);
        expect(filterByName(list, 'wood oak').map(c => c.id)).toEqual(['a']);
        expect(filterByName(list, 'pine')).toEqual([]);
    });

    it('the item picker lists every item by name and narrows as you type', () => {
        const view = openPanel();
        const picker = view.getByTestId('qa-item-picker');
        expect(itemChoices().some(c => c.id === 'item_qa_quartz_lump')).toBe(true);
        fireEvent.change(picker.querySelector('input'), { target: { value: 'zircon' } });
        expect(names(picker)).toEqual(['Zircon Ring', 'Zircon Shard']);
        expect(picker.querySelectorAll('img').length).toBe(2);
    });

    it('the Token picker lists Tokens and enemies, the enemies marked', () => {
        const view = openPanel();
        const picker = view.getByTestId('qa-token-picker');
        expect(tokenChoices().find(c => c.id === 'qa_panel_ogre')?.enemy).toBe(true);
        fireEvent.change(picker.querySelector('input'), { target: { value: 'panel' } });
        expect(names(picker)).toEqual(['Panel Bramble', 'Panel Ogreenemy']);
    });
});

describe('Give items', () => {
    it('Give puts the amount of the picked item in the Bank', () => {
        const view = openPanel();
        const picker = view.getByTestId('qa-item-picker');
        fireEvent.change(picker.querySelector('input'), { target: { value: 'quartz lump' } });
        fireEvent.click(rows(picker)[0]);
        fireEvent.change(view.getByLabelText('Amount'), { target: { value: '7' } });
        fireEvent.click(view.getByText('Give'));
        expect(InventoryManager.getItemCount('item_qa_quartz_lump')).toBe(7);
        expect(view.getByRole('status').textContent).toBe('Gave 7 Quartz Lump to the Bank');
    });

    it('Give with nothing picked says so and gives nothing', () => {
        const view = openPanel();
        fireEvent.click(view.getByText('Give'));
        expect(view.getByRole('status').textContent).toBe('Pick an item first');
    });

    it('One of every item puts one of each kind in the Bank', () => {
        const view = openPanel();
        fireEvent.click(view.getByText('One of every item'));
        const kinds = Object.values(InventoryManager.getAllItems()).filter(e => e?.quantity > 0).length;
        const [, added] = /^Put (\d+) kinds in the Bank/.exec(view.getByRole('status').textContent);
        expect(Number(added)).toBeGreaterThan(10);
        expect(kinds).toBe(Number(added));
    });

    it('Fill the Bank takes every free slot', () => {
        const view = openPanel();
        fireEvent.click(view.getByText('Fill the Bank'));
        expect(InventoryManager.freeSlots()).toBe(0);
    });
});

describe('Place a Token or enemy', () => {
    it('a click puts the chosen Token on the mat, at a free spot', () => {
        const view = openPanel();
        const picker = view.getByTestId('qa-token-picker');
        fireEvent.change(picker.querySelector('input'), { target: { value: 'bramble' } });
        fireEvent.click(rows(picker)[0]);
        fireEvent.click(rows(picker)[0]);
        const placed = BoardState.tokens().filter(t => t.typeId === 'qa_panel_bramble');
        expect(placed).toHaveLength(2);
        expect(placed[0].x !== placed[1].x || placed[0].y !== placed[1].y).toBe(true);
        expect(view.getByRole('status').textContent).toBe('Placed Panel Bramble');
    });

    it('an enemy goes on the mat the same way', () => {
        const view = openPanel();
        const picker = view.getByTestId('qa-token-picker');
        fireEvent.change(picker.querySelector('input'), { target: { value: 'ogre' } });
        fireEvent.click(rows(picker)[0]);
        expect(BoardState.tokens().filter(t => t.typeId === 'qa_panel_ogre')).toHaveLength(1);
    });

    it('Clear the board takes every Token off', () => {
        const view = openPanel();
        fireEvent.click(view.getByText('Clear the board'));
        expect(BoardState.tokens()).toHaveLength(0);
    });
});

describe('Heroes', () => {
    const heroes = () => GameState.state.heroes.filter(h => !h.isVillager);

    it('Spawn a party adds four heroes at level 50 and full health', () => {
        const view = openPanel();
        fireEvent.click(view.getByText('Spawn a party'));
        expect(heroes()).toHaveLength(4);
        for (const h of heroes()) {
            expect(Object.values(h.skills).every(s => s.level === 50)).toBe(true);
            expect(h.hp.current).toBe(h.hp.max);
        }
    });

    it('Level all +1 and +10 raise every skill by that much', () => {
        const view = openPanel();
        fireEvent.click(view.getByText('Hire a hero'));
        const [hero] = heroes();
        const before = Object.fromEntries(Object.entries(hero.skills).map(([id, s]) => [id, s.level]));
        fireEvent.click(view.getByText('Level all +1'));
        fireEvent.click(view.getByText('Level all +10'));
        for (const [id, level] of Object.entries(before)) expect(hero.skills[id].level).toBe(Math.min(99, level + 11));
    });

    it('Knock out a hero knocks one out for real; Heal everyone brings them back at full health', () => {
        const view = openPanel();
        fireEvent.click(view.getByText('Hire a hero'));
        const [hero] = heroes();
        fireEvent.click(view.getByText('Knock out a hero'));
        expect(HeroManager.getHero(hero.id).status).toBe('wounded');
        expect(view.getByRole('status').textContent).toBe(`${hero.name} is knocked out`);
        fireEvent.click(view.getByText('Heal everyone'));
        expect(HeroManager.getHero(hero.id).status).not.toBe('wounded');
        expect(hero.hp.current).toBe(hero.hp.max);
    });

    it('Knock out with nobody to knock out says so', () => {
        GameState.state.heroes = [];
        const view = openPanel();
        fireEvent.click(view.getByText('Knock out a hero'));
        expect(view.getByRole('status').textContent).toBe('No hero to knock out');
    });
});

describe('only the essentials', () => {
    it('three groups and the tools, and nothing else', () => {
        const view = openPanel();
        const body = view.getByTestId('qa-panel-body');
        const labels = [...body.querySelectorAll('[data-qa-group] > .ui-text-title')].map(l => l.textContent);
        expect(labels).toEqual(['Give items', 'Heroes', 'Place a Token or enemy', 'Tools']);
        expect([...body.querySelectorAll('[data-qa-group]')].map(g => g.textContent).join(' ')).not.toMatch(/dev only/i);
        expect(view.getByText('Animation Studio')).toBeTruthy();
        expect(view.getByText('Save as Starter Camp')).toBeTruthy();
    });
});
