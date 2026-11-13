// @vitest-environment jsdom
// The Guild Hall's sky with authored stars (brief 320 H1): a constellation per skill drawn from its
// data positions, the sky growing to hold them and dragged when too big, a star's ranks in words in
// the Upgrade drawer, and the Hall's Effects listing what the stars give.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, act, cleanup, fireEvent } from '@testing-library/react';
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
import { qaHallSky, installQaSky } from './fixtures/qaHallSky.js';

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

describe('the Upgrade drawer reads a star', () => {
    const sheet = (id) => render(React.createElement(GuildUpgradeInspection, { upgradeDef: getUpgradeDef(id) })).container;
    const text = (c, sel) => c.querySelector(sel)?.textContent;
    const rows = (c) => [...c.querySelectorAll('[data-rank-row]')];

    it('says what the star does, then lists every rank in Roman numerals, Arabic underneath, with what it gives', () => {
        const c = sheet('qa_mining_xp');
        expect(text(c, '[data-star-sentence]')).toBe('Every Mining Token awards more XP.');
        expect(c.querySelector('[data-drawer-icon]').className).toMatch(/\bgrayscale\b/);
        expect(rows(c).map(r => r.querySelector('[data-rank-roman]').textContent)).toEqual(['I', 'II', 'III']);
        expect(rows(c).map(r => r.querySelector('[data-rank-arabic]').textContent)).toEqual(['1', '2', '3']);
        // The Arabic number shows only while its row is under the pointer.
        expect(rows(c)[0].className).toMatch(/\bgroup\b/);
        expect(rows(c)[0].querySelector('[data-rank-roman]').className).toMatch(/group-hover:hidden/);
        expect(rows(c)[0].querySelector('[data-rank-arabic]').className).toMatch(/\bhidden group-hover:inline/);
        expect(text(c, '[data-rank-row="1"] [data-rank-amount]')).toBe('50% more XP');
        expect(text(c, '[data-rank-row="3"] [data-rank-amount]')).toBe('200% more XP');
    });

    it('reads a Well star\'s line and a Hearth star\'s rule, with no time on the line', () => {
        GameState.state.progress.guildUpgrades = { qa_well_copper: 1, qa_infirmary: 1 };
        const well = sheet('qa_well_copper');
        expect(text(well, '[data-star-sentence]')).toBe('The Guild Hall draws Copper Ore every lap, no hero needed.');
        expect(text(well, '[data-rank-row="2"] [data-rank-amount]')).toBe('20 Copper Ore');
        const infirmary = sheet('qa_infirmary');
        expect(text(infirmary, '[data-star-sentence]')).toBe('Every hero recovers from a wound faster.');
        expect(text(infirmary, '[data-rank-row="1"] [data-rank-amount]')).toBe('20% faster');
        expect(infirmary.querySelector('[data-rank-row="1"]').getAttribute('data-rank-state')).toBe('bought');
    });

    it('has no button at the top rank, and says so', () => {
        GameState.state.progress.guildUpgrades = { qa_mining_xp: 3 };
        const top = sheet('qa_mining_xp');
        expect(top.querySelector('[data-star-maxed]')).toBeTruthy();
        expect(top.querySelector('#guild-upgrade-button')).toBeNull();
        expect(rows(top).every(r => r.getAttribute('data-rank-state') === 'bought')).toBe(true);
    });

    it('chooses the next rank by default; a later rank is chosen by a click, its price shown, the total while Upgrade is hovered', () => {
        const c = sheet('qa_mining_xp');
        expect(c.querySelector('[data-rank-row="1"]').getAttribute('data-rank-state')).toBe('chosen');
        expect(text(c, '#guild-upgrade-button')).toMatch(/^Upgrade$/i);
        const rankPrice = (r) => GuildUpgradeManager.getRanksCost('qa_mining_xp', r).length;
        expect(rankPrice(1)).toBeGreaterThan(0);

        fireEvent.click(c.querySelector('[data-rank-row="3"]'));
        expect(c.querySelector('[data-rank-row="2"]').getAttribute('data-rank-state')).toBe('in-range');
        expect(c.querySelector('[data-rank-row="3"]').getAttribute('data-rank-state')).toBe('chosen');
        expect(text(c, '#guild-upgrade-button')).toBe('Upgrade (+3 Ranks)');
        expect(c.querySelector('[data-card-block="price"]').getAttribute('data-price-shows')).toBe('rank');
        expect(c.querySelector('[data-card-block="price"]').textContent).toContain('Rank III price');

        fireEvent.mouseEnter(c.querySelector('[data-upgrade-hover]'));
        const price = c.querySelector('[data-card-block="price"]');
        expect(price.getAttribute('data-price-shows')).toBe('total');
        expect(price.textContent).toContain('Total, ranks I to III');
        const total = GuildUpgradeManager.getRanksCost('qa_mining_xp', 3);
        for (const p of total) {
            expect(price.querySelector(`[data-upgrade-price-item="${p.itemId}"]`).textContent).toContain(`0/${p.quantity}`);
        }
        fireEvent.mouseLeave(c.querySelector('[data-upgrade-hover]'));
        expect(c.querySelector('[data-card-block="price"]').getAttribute('data-price-shows')).toBe('rank');
    });

    it('greys the button with what the Bank is short of, in short numbers', () => {
        const c = sheet('qa_mining_xp');
        expect(c.querySelector('#guild-upgrade-button').disabled).toBe(true);
        const short = GuildUpgradeManager.getShortfall(GuildUpgradeManager.getRanksCost('qa_mining_xp', 1));
        expect(short.length).toBeGreaterThan(0);
        expect(text(c, '[data-upgrade-short]')).toBe(`Short: ${short.map(s => `${s.needed - s.have} ${s.name}`).join(', ')}`);
    });

    it('buys every rank up to the chosen one at once, and chooses the next rank after', async () => {
        for (const p of GuildUpgradeManager.getRanksCost('qa_mining_xp', 2)) InventoryManager.addItem(p.itemId, p.quantity + 3600);
        const c = sheet('qa_mining_xp');
        // Short numbers: thousands read "3.6k".
        expect(c.querySelector('[data-price-count]').textContent).toMatch(/^3\.\dk\//);
        fireEvent.click(c.querySelector('[data-rank-row="2"]'));
        expect(c.querySelector('#guild-upgrade-button').disabled).toBe(false);
        const heard = [];
        const off = EventBus.subscribe(ENGINE_EVENTS.GUILD_UPGRADES_UPDATED, (d) => heard.push(d));
        try {
            await act(async () => { fireEvent.click(c.querySelector('#guild-upgrade-button')); });
        } finally {
            off();
        }
        expect(ranks().qa_mining_xp).toBe(2);
        expect(heard).toEqual([{ upgradeId: 'qa_mining_xp', rank: 2, fromRank: 0, count: 2 }]);
        expect(c.querySelector('[data-rank-row="3"]').getAttribute('data-rank-state')).toBe('chosen');
        expect(text(c, '#guild-upgrade-button')).toMatch(/^Upgrade$/i);
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
