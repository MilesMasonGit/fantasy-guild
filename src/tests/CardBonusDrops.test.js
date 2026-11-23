// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as Orders from '../systems/board/Orders.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as LiveEffects from '../systems/effects/LiveEffects.js';
import * as LoadoutMoments from '../systems/board/LoadoutMoments.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import * as EquipmentManager from '../systems/equipment/EquipmentManager.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { getAllSkillIds } from '../config/registries/skillRegistry.js';
import { ModifierAggregator } from '../systems/effects/ModifierAggregator.js';
import { makeStatement, KEYWORD } from '../systems/effects/statements.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { xpForLevel } from '../utils/XPCurve.js';
import { TokenCard } from '../ui/components/board/TokenCard.jsx';
import { tokenCardModel, CARD_BLOCK } from '../ui/components/board/tokenCard.js';
import { withoutShippedPerks } from './fixtures/noPerks.js';

withoutShippedPerks();

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * The Token card lists the bonus drops a working hero brings under Makes, marked bonus with its
 * source, from the same grants the engine rolls (`TileModifiers.collectItemGrants`).
 */

const grants = (itemId, chance) => ({
    ...makeStatement(KEYWORD.GRANTS),
    payload: { type: EFFECT_TYPES.BONUS_DROP, itemId, quantity: 1, chance },
    to: null,
    chargeDelta: 0
});

registerEffects({
    cb_fx_nest: { id: 'cb_fx_nest', name: 'Nest Finder', statements: [grants('cb_nest', 25)] },
    cb_fx_feather: { id: 'cb_fx_feather', name: 'Feather Finder', statements: [grants('cb_feather', 10)] },
    cb_fx_pouch: { id: 'cb_fx_pouch', name: 'Nest Pouch', statements: [{ ...grants('cb_nest', 50), chargeDelta: -1 }] },
    cb_fx_watch: { id: 'cb_fx_watch', name: 'Birdwatcher', statements: [grants('cb_nest', 25)] },
    cb_fx_watch_potion: {
        id: 'cb_fx_watch_potion', name: 'Birdwatcher Potion',
        statements: [{
            ...makeStatement(KEYWORD.APPLIES),
            when: { event: 'WORK_START', scope: 'self' },
            target: { role: 'actor' },
            payload: { effectId: 'cb_fx_watch', scale: 1, durationMs: 0, forCycle: true, chance: 100 }
        }]
    }
});

registerItems({
    cb_nest: { id: 'cb_nest', name: 'Bird Nest', stackable: true },
    cb_feather: { id: 'cb_feather', name: 'Feather', stackable: true },
    cb_log: { id: 'cb_log', name: 'Log', stackable: true },
    cb_nest_charm: { id: 'cb_nest_charm', name: 'Nest Charm', equipSlot: 'trinket', stackable: true, sprite: 'i_potion_shrimp_pink', effects: [{ effectId: 'cb_fx_nest' }] },
    cb_nest_pouch: { id: 'cb_nest_pouch', name: 'Nest Pouch', equipSlot: 'trinket', stackable: true, sprite: 'i_potion_shrimp_pink', effects: [{ effectId: 'cb_fx_pouch' }] },
    cb_watch_potion: { id: 'cb_watch_potion', name: 'Birdwatcher Potion', equipSlot: 'consumable', stackable: true, sprite: 'i_potion_shrimp_pink', effects: [{ effectId: 'cb_fx_watch_potion' }] },
    cb_feather_hat: { id: 'cb_feather_hat', name: 'Feather Hat', equipSlot: 'hat', stackable: true, sprite: 'i_potion_shrimp_pink', effects: [{ effectId: 'cb_fx_feather' }] }
});

registerTokenTypes({
    cb_tree: {
        id: 'cb_tree', name: 'Bonus Tree', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature',
        requiresHero: true,
        config: { skill: 'forestry', skillRequired: 1, cycleTimeMs: 4000, xp: 10, inputs: [], outputs: [{ itemId: 'cb_log', quantity: 1, chance: 100 }] }
    }
});

function makeHero(id, name) {
    const h = generateHero({ name });
    h.id = id;
    h.name = name;
    h.status = 'idle';
    h.hp = { current: 100, max: 100 };
    for (const s of getAllSkillIds()) h.skills[s] = { level: 60, xp: xpForLevel(60) };
    h.equipment = Array(9).fill(null);
    h.aggregator = new ModifierAggregator(h.id);
    return h;
}

function placeTree(at) {
    const tree = BoardState.createTokenInstance('cb_tree', tokenStartingUses('cb_tree'));
    Placement.placeTokenAt(tree, at);
    TileModifiers.rebuildAround([tree]);
    return tree;
}

function equip(hero, itemId) {
    InventoryManager.addItem(itemId, 1);
    EquipmentManager.equipItem(hero.id, itemId);
}

const bonusOf = (tree) => tokenCardModel('cb_tree', tree.id).blocks.find(b => b.id === CARD_BLOCK.RECIPE).bonus;
const lineOf = (b) => `${b.text} · ${b.note}`;

let ana;
let bo;

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    BoardCombat.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    ana = makeHero('hero_cb_ana', 'Ana');
    bo = makeHero('hero_cb_bo', 'Bo');
    GameState.state.heroes = [ana, bo];
    GameState.state.inventory.maxSlots = 50;
});

afterEach(cleanup);

describe('the card shows a working hero bonus drops', () => {
    it('a hero with a bonus-drop gear piece working the Token shows the line under Makes', () => {
        equip(ana, 'cb_nest_charm');
        const tree = placeTree({ x: 400, y: 400 });
        Orders.orderAt(ana.id, { x: 400, y: 400 });
        expect(BoardState.workerOf(tree.id)).toBe(ana.id);

        expect(bonusOf(tree).map(lineOf)).toEqual(["Bird Nest 25% · bonus (Ana's Nest Charm)"]);
        // The very grant the engine rolls at the end of a cycle.
        expect(TileModifiers.collectItemGrants(tree.id, EFFECT_TYPES.BONUS_DROP).map(g => g.itemId)).toEqual(['cb_nest']);

        const { container } = render(React.createElement(TokenCard, { typeId: 'cb_tree', instanceId: tree.id }));
        const makes = container.querySelector('[data-card-block="makes"]');
        const row = makes.querySelector('[data-card-bonus="cb_nest"]');
        expect(row).not.toBeNull();
        expect(row.getAttribute('data-card-bonus-hero')).toBe(ana.id);
        expect(row.textContent).toContain("bonus (Ana's Nest Charm)");
        expect(row.textContent).toContain('25%');
        expect(row.getAttribute('title')).toBe("Bird Nest 25% · bonus (Ana's Nest Charm)");
    });

    it('the line is one line, as the drop rows above it: no subtitle, cut off rather than wrapped', () => {
        equip(ana, 'cb_nest_charm');
        const tree = placeTree({ x: 400, y: 400 });
        Orders.orderAt(ana.id, { x: 400, y: 400 });
        const { container } = render(React.createElement(TokenCard, { typeId: 'cb_tree', instanceId: tree.id }));
        const row = container.querySelector('[data-card-bonus="cb_nest"]');
        const drop = container.querySelector('[data-card-makes] [data-item-bar]:not([data-card-bonus])');
        const name = row.querySelector('[data-item-bar-name]');
        expect(name.textContent).toBe("bonus (Ana's Nest Charm)");
        expect(name.nextElementSibling).toBeNull();
        expect(name.className).toContain('truncate');
        // The same text size and padding as the Token's own drop row.
        expect(name.className.split(' ').filter(c => c.startsWith('text-'))).toEqual(
            drop.querySelector('[data-item-bar-name]').className.split(' ').filter(c => c.startsWith('text-'))
        );
        expect(row.className).toBe(drop.className);
    });

    it('a potion carried for the cycle names its effect', () => {
        const tree = placeTree({ x: 400, y: 400 });
        Orders.orderAt(ana.id, { x: 400, y: 400 });
        const other = placeTree({ x: 900, y: 400 });
        // Applied as the cycle at another Token started: it lends nothing here.
        expect(LiveEffects.applyToHero(ana.id, { effectId: 'cb_fx_watch', forCycle: other.id })).toBe(true);
        expect(bonusOf(tree)).toEqual([]);
        LiveEffects.removeFromHero(ana.id);
        expect(LiveEffects.applyToHero(ana.id, { effectId: 'cb_fx_watch', forCycle: tree.id })).toBe(true);
        expect(bonusOf(tree).map(lineOf)).toEqual(["Bird Nest 25% · bonus (Ana's Birdwatcher)"]);
    });

    it('two heroes, two lines: each card names the hero working it', () => {
        equip(ana, 'cb_nest_charm');
        equip(bo, 'cb_feather_hat');
        const first = placeTree({ x: 400, y: 400 });
        const second = placeTree({ x: 900, y: 400 });
        Orders.orderAt(ana.id, { x: 400, y: 400 });
        Orders.orderAt(bo.id, { x: 900, y: 400 });
        expect(bonusOf(first).map(lineOf)).toEqual(["Bird Nest 25% · bonus (Ana's Nest Charm)"]);
        expect(bonusOf(second).map(lineOf)).toEqual(["Feather 10% · bonus (Bo's Feather Hat)"]);
    });

    it('one line per bonus a hero brings', () => {
        equip(ana, 'cb_nest_charm');
        equip(ana, 'cb_feather_hat');
        const tree = placeTree({ x: 400, y: 400 });
        Orders.orderAt(ana.id, { x: 400, y: 400 });
        expect(bonusOf(tree).map(lineOf).sort()).toEqual([
            "Bird Nest 25% · bonus (Ana's Nest Charm)",
            "Feather 10% · bonus (Ana's Feather Hat)"
        ]);
        const { container } = render(React.createElement(TokenCard, { typeId: 'cb_tree', instanceId: tree.id }));
        expect(container.querySelectorAll('[data-card-block="makes"] [data-card-bonus]')).toHaveLength(2);
    });

    it('the hero leaves, the line goes', () => {
        equip(ana, 'cb_nest_charm');
        const tree = placeTree({ x: 400, y: 400 });
        Orders.orderAt(ana.id, { x: 400, y: 400 });
        expect(bonusOf(tree)).toHaveLength(1);

        Orders.stop(ana.id);
        expect(BoardState.workerOf(tree.id)).toBeNull();
        expect(bonusOf(tree)).toEqual([]);
        const { container } = render(React.createElement(TokenCard, { typeId: 'cb_tree', instanceId: tree.id }));
        expect(container.querySelector('[data-card-bonus]')).toBeNull();
        // The Token's own outputs still show.
        expect(container.querySelector('[data-card-block="makes"]')).not.toBeNull();
    });

    it('a grant that spends its item shows only while one is left to spend', () => {
        equip(ana, 'cb_nest_pouch');
        const tree = placeTree({ x: 400, y: 400 });
        Orders.orderAt(ana.id, { x: 400, y: 400 });
        InventoryManager.addItem('cb_nest_pouch', 2);
        expect(bonusOf(tree).map(lineOf)).toEqual(["Bird Nest 50% · bonus (Ana's Nest Pouch)"]);
        InventoryManager.removeItem('cb_nest_pouch', InventoryManager.getItemCount('cb_nest_pouch'));
        expect(bonusOf(tree)).toEqual([]);
    });

    describe('a potion carried for the cycle holds its line between cycles', () => {
        let offs = [];
        beforeEach(() => {
            LoadoutMoments.init();
            ana.equipment[0] = 'cb_watch_potion';
        });
        afterEach(() => { offs.forEach(off => off()); offs = []; LoadoutMoments.teardown(); });

        const step = (n = 1) => { for (let i = 0; i < n; i++) BoardRunner.tick(100); };
        const stepUntil = (done, max = 400) => {
            for (let i = 0; i < max && !done(); i++) step();
            return done();
        };
        // What the card shows at each completion, read after the potion's effect has come off.
        const atEachCompletion = (tree) => {
            const out = [];
            offs.push(EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, ({ instanceId }) => {
                if (instanceId !== tree.id) return;
                out.push({
                    live: TileModifiers.heroItemGrants(tree.id, EFFECT_TYPES.BONUS_DROP).length,
                    shown: bonusOf(tree).map(lineOf)
                });
            }));
            return out;
        };
        const LINE = "Bird Nest 25% · bonus (Ana's Birdwatcher)";

        it('across a cycle boundary the line stays', () => {
            InventoryManager.addItem('cb_watch_potion', 5);
            const tree = placeTree({ x: 400, y: 400 });
            const seen = atEachCompletion(tree);
            Orders.orderAt(ana.id, { x: 400, y: 400 });
            expect(stepUntil(() => bonusOf(tree).length > 0)).toBe(true);
            expect(stepUntil(() => seen.length >= 2)).toBe(true);
            // The effect is off the hero at the boundary, yet the card keeps the line.
            expect(seen[0].live).toBe(0);
            expect(seen.map(s => s.shown)).toEqual([[LINE], [LINE]]);
            const { container } = render(React.createElement(TokenCard, { typeId: 'cb_tree', instanceId: tree.id }));
            expect(container.querySelector('[data-card-bonus="cb_nest"]')).not.toBeNull();
        });

        it('the hero leaves, the held line goes', () => {
            InventoryManager.addItem('cb_watch_potion', 5);
            const tree = placeTree({ x: 400, y: 400 });
            const seen = atEachCompletion(tree);
            Orders.orderAt(ana.id, { x: 400, y: 400 });
            // The card is open: it has shown the line during the cycle.
            expect(stepUntil(() => bonusOf(tree).length > 0)).toBe(true);
            expect(stepUntil(() => seen.length >= 1)).toBe(true);
            expect(bonusOf(tree).map(lineOf)).toEqual([LINE]);
            Orders.stop(ana.id);
            expect(bonusOf(tree)).toEqual([]);
        });

        it('the potion runs out, the line goes as the next cycle starts without it', () => {
            InventoryManager.addItem('cb_watch_potion', 1);
            const tree = placeTree({ x: 400, y: 400 });
            const seen = atEachCompletion(tree);
            Orders.orderAt(ana.id, { x: 400, y: 400 });
            // The card is open: it has shown the line during the cycle.
            expect(stepUntil(() => bonusOf(tree).length > 0)).toBe(true);
            expect(stepUntil(() => seen.length >= 1)).toBe(true);
            expect(seen[0].shown).toEqual([LINE]);
            expect(InventoryManager.getItemCount('cb_watch_potion')).toBe(0);
            // The next cycle begins with no potion to drink.
            expect(stepUntil(() => tree.cycleElapsedMs > 0)).toBe(true);
            expect(BoardState.workerOf(tree.id)).toBe(ana.id);
            expect(bonusOf(tree)).toEqual([]);
        });
    });

    it('a Token nobody works and an off-mat card show no bonus', () => {
        equip(ana, 'cb_nest_charm');
        const tree = placeTree({ x: 400, y: 400 });
        expect(bonusOf(tree)).toEqual([]);
        expect(tokenCardModel('cb_tree').blocks.find(b => b.id === CARD_BLOCK.RECIPE).bonus).toEqual([]);
    });
});
