// @vitest-environment jsdom
// The Guild Hall's sky with authored stars (brief 320 H1): a constellation per skill drawn from its
// data positions, the sky growing to hold them and dragged when too big, a star's ranks in words in
// the details panel, and the Hall's Effects listing what the stars give.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, act, cleanup } from '@testing-library/react';
import {
    GuildHallBoard, webSize, panLimit, clampPan, MIN_SKY_SCALE, WEB_W, WEB_H, WEB_UNIT_PX, SKY_SPACING
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
    it('holds the built-in sky at its spacing and grows past it for far stars', () => {
        const unit = WEB_UNIT_PX * SKY_SPACING;
        registerHallSky({});
        // The built-in sky's reach is its names: the Vault's 0.72 out sideways, the Hearth's and the Well's 0.8 up and down.
        expect(webSize()).toEqual({ w: Math.max(WEB_W, Math.ceil(2 * (0.72 * unit + 120))), h: Math.max(WEB_H, Math.ceil(2 * (0.8 * unit + 40))) });
        registerHallSky({ stars: { far: { id: 'far', constellation: 'well', links: ['hall'], node: { x: 2, y: -1.5 }, ranks: [{ price: [] }] } } });
        expect(webSize()).toEqual({ w: Math.ceil(2 * (2 * unit + 170)), h: Math.ceil(2 * (1.5 * unit + 70)) });
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

describe('the details panel reads a star', () => {
    const sheet = (id) => render(React.createElement(GuildUpgradeInspection, { upgradeDef: getUpgradeDef(id) })).container;
    const text = (c, sel) => c.querySelector(sel)?.textContent;

    it('says what the star does in one sentence, then now, next and its top rank, the Mining scope said', () => {
        const c = sheet('qa_mining_xp');
        expect(text(c, '[data-star-sentence]')).toBe('Every Mining Token awards more XP.');
        expect(text(c, '[data-star-rank]')).toBe('0/3');
        expect(text(c, '[data-star-now]')).toBe('Nothing yet');
        expect(text(c, '[data-star-next]')).toBe('50% more XP');
        expect(text(c, '[data-star-top]')).toBe('At rank 3, the top: 200% more XP');
        expect(c.querySelector('[data-rank-row]')).toBeNull();
    });

    it('reads a Well star\'s line and a Hearth star\'s rule, with no time on the line', () => {
        GameState.state.progress.guildUpgrades = { qa_well_copper: 1, qa_infirmary: 1 };
        const well = sheet('qa_well_copper');
        expect(text(well, '[data-star-sentence]')).toBe('The Guild Hall draws Copper Ore every lap, no hero needed.');
        expect(text(well, '[data-star-next]')).toBe('20 Copper Ore');
        const infirmary = sheet('qa_infirmary');
        expect(text(infirmary, '[data-star-sentence]')).toBe('Every hero recovers from a wound faster.');
        expect(text(infirmary, '[data-star-now]')).toBe('20% faster');
    });

    it('drops the top-rank line when the next rank is the top, and says so at the top', () => {
        GameState.state.progress.guildUpgrades = { qa_mining_xp: 2 };
        expect(sheet('qa_mining_xp').querySelector('[data-star-top]')).toBeNull();
        GameState.state.progress.guildUpgrades = { qa_mining_xp: 3 };
        const top = sheet('qa_mining_xp');
        expect(text(top, '[data-star-now]')).toBe('200% more XP');
        expect(text(top, '[data-star-next]')).toBe('Top rank');
        expect(top.querySelector('#guild-upgrade-button')).toBeNull();
    });

    it('lists the price as ribbons with what the Bank holds, short in red, and greys the button', () => {
        const c = sheet('qa_mining_xp');
        const ribbons = c.querySelectorAll('[data-upgrade-price-item]');
        expect(ribbons.length).toBeGreaterThan(0);
        expect(ribbons[0].textContent).toMatch(/0\/\d/);
        expect(c.querySelector('#guild-upgrade-button').disabled).toBe(true);
        expect(c.querySelector('[data-upgrade-short]')).toBeTruthy();
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
