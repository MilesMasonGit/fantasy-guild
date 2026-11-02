// @vitest-environment jsdom
// The Guild Hall's sky with authored stars (brief 320 H1): a constellation per skill drawn from its
// data positions, the sky growing to hold them and dragged when too big, a star's ranks in words in
// the details panel, and the Hall's Effects listing what the stars give.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, act, cleanup } from '@testing-library/react';
import {
    GuildHallBoard, webSize, panLimit, clampPan, MIN_SKY_SCALE, WEB_W, WEB_H, WEB_UNIT_PX
} from '../ui/components/board/GuildHallBoard.jsx';
import { GuildUpgradeInspection } from '../ui/components/drawer/GuildUpgradeInspection.jsx';
import { GuildHallEffectsList, hallEffectsNow } from '../ui/components/board/GuildHallEffectsPopover.jsx';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { GuildUpgradeManager } from '../systems/progression/GuildUpgradeManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { getUpgradeDef, GUILD_UPGRADES } from '../config/guildUpgrades.js';
import { registerHallSky } from '../config/registries/hallStarRegistry.js';
import { qaHallSky, installQaSky } from '../ui/dev/hallStarsDev.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn(), notify: vi.fn()
}));

const renderWeb = (props = {}) => render(React.createElement(GuildHallBoard, props));
const ranks = () => GameState.state.progress.guildUpgrades;

beforeEach(() => {
    GameState.initNew();
    GameState.state.heroes = [];
    GameState.state.progress.guildUpgrades = {};
    InventoryManager.init();
    registerHallSky(qaHallSky());
    GuildUpgradeManager.recompute();
});

afterEach(() => {
    cleanup();
    registerHallSky(null);
    GuildUpgradeManager.recompute();
});

describe('the sky draws the authored constellations', () => {
    it('draws every star and the Mining constellation\'s name, its first star buyable and the rest locked', () => {
        const { container } = renderWeb();
        for (const def of GUILD_UPGRADES) expect(container.querySelector(`[data-hall-node="${def.id}"]`), def.id).toBeTruthy();
        expect(container.querySelector('[data-constellation="qa_mining"]').textContent).toBe('Mining');
        const state = (id) => container.querySelector(`[data-hall-node="${id}"]`).getAttribute('data-node-state');
        expect(state('qa_mining_xp')).toBe('buyable');
        expect(state('qa_mining_yield')).toBe('locked');
        expect(state('qa_infirmary')).toBe('locked');
        expect(container.querySelector('[data-hall-node="qa_mining_xp"]').parentElement.textContent).toContain('Miner’s Lore 0/3');
        expect(container.querySelector('[data-hall-link="qa_mining_xp:hall"]')).toBeTruthy();
    });

    it('opens the next stars and lights the line as a rank is bought', async () => {
        const { container } = renderWeb();
        InventoryManager.addItem('item_copper_ore', 100);
        await act(async () => { expect(GuildUpgradeManager.purchase('qa_mining_xp').success).toBe(true); });
        const state = (id) => container.querySelector(`[data-hall-node="${id}"]`).getAttribute('data-node-state');
        expect(state('qa_mining_xp')).toBe('bought');
        expect(state('qa_mining_yield')).toBe('buyable');
        expect(container.querySelector('[data-hall-link="qa_mining_xp:hall"]').getAttribute('data-link-lit')).toBe('true');
    });

    it('redraws when the sky itself changes under it', async () => {
        registerHallSky(null);
        const { container } = renderWeb();
        expect(container.querySelector('[data-hall-node="qa_mining_xp"]')).toBeNull();
        await act(async () => { installQaSky(); });
        expect(container.querySelector('[data-hall-node="qa_mining_xp"]')).toBeTruthy();
    });
});

describe('the sky grows to hold its stars, and drags when too big', () => {
    it('keeps today\'s size for a small sky and grows past it for far stars', () => {
        registerHallSky({});
        expect(webSize()).toEqual({ w: WEB_W, h: WEB_H });
        registerHallSky({ stars: { far: { id: 'far', constellation: 'well', links: ['hall'], node: { x: 2, y: -1.5 }, ranks: [{ price: [] }] } } });
        expect(webSize()).toEqual({ w: Math.ceil(2 * (2 * WEB_UNIT_PX + 170)), h: Math.ceil(2 * (1.5 * WEB_UNIT_PX + 70)) });
    });

    it('drags no further than either edge, and not at all when the sky fits', () => {
        expect(panLimit({ w: 1000, h: 800 }, { w: 1200, h: 900 })).toEqual({ x: 0, y: 0 });
        const limit = panLimit({ w: 2000, h: 1200 }, { w: 1200, h: 900 });
        expect(limit).toEqual({ x: 400, y: 150 });
        expect(clampPan({ x: 900, y: -500 }, limit)).toEqual({ x: 400, y: -150 });
        expect(MIN_SKY_SCALE).toBeGreaterThan(0.5);
    });

    it('draws no smaller than the floor, so a crowded sky can be dragged instead', () => {
        const { container } = renderWeb();
        const board = container.querySelector('[data-guild-hall-board]');
        expect(Number(board.getAttribute('data-sky-scale'))).toBeGreaterThanOrEqual(MIN_SKY_SCALE);
        expect(Number(board.getAttribute('data-natural-width'))).toBe(webSize().w);
    });
});

describe('the details panel reads a star\'s ranks', () => {
    it('lists each rank as what it gives, the Mining scope said', () => {
        const { container } = render(React.createElement(GuildUpgradeInspection, { upgradeDef: getUpgradeDef('qa_mining_xp') }));
        const rows = [...container.querySelectorAll('[data-rank-row]')].map(r => r.textContent);
        expect(rows).toHaveLength(3);
        expect(rows[0]).toContain('50% more XP, but only for Mining work');
        expect(rows[2]).toContain('200% more XP');
        expect(container.textContent).toContain('Mining teaches more.');
    });

    it('reads a Well star\'s line and a Hearth star\'s rule', () => {
        const well = render(React.createElement(GuildUpgradeInspection, { upgradeDef: getUpgradeDef('qa_well_copper') }));
        expect(well.container.querySelector('[data-rank-row="2"]').textContent).toContain('20 Copper Ore / 5 min');
        const infirmary = render(React.createElement(GuildUpgradeInspection, { upgradeDef: getUpgradeDef('qa_infirmary') }));
        expect(infirmary.container.querySelector('[data-rank-row="1"]').textContent).toContain('recover from a wound 20% faster');
    });
});

describe('the Hall\'s Effects list what the stars give', () => {
    it('lists the Hall\'s Passive Production and every held rule', async () => {
        const { container } = render(React.createElement(GuildHallEffectsList));
        expect(container.querySelectorAll('[data-hall-effect-statement]')).toHaveLength(0);
        expect(container.querySelector('[data-hall-effect-output="item_copper_ore"]')).toBeNull();
        await act(async () => {
            GameState.state.progress.guildUpgrades = { wishing_well: 1, qa_well_copper: 2, qa_mining_xp: 1, roster_size: 1, qa_infirmary: 1 };
            GuildUpgradeManager.recompute();
            EventBus.publish(ENGINE_EVENTS.GUILD_UPGRADES_UPDATED, {});
        });
        expect(container.querySelector('[data-hall-effect-output="item_copper_ore"]').textContent).toContain('20');
        expect(container.querySelector('[data-hall-effect-output="item_water"]')).toBeTruthy();
        const boosts = [...container.querySelectorAll('[data-hall-effect-statement]')].map(n => n.textContent);
        expect(boosts).toEqual([
            'Makes every Token on the board award 50% more XP, but only for Mining work.',
            'Makes every hero recover from a wound 20% faster.'
        ]);
        expect(hallEffectsNow(GameState.state).outputs).toContainEqual({ itemId: 'item_copper_ore', quantity: 20 });
        expect(ranks().qa_mining_xp).toBe(1);
    });
});
