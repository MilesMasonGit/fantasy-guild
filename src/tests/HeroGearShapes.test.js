import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { applyDefeatPenalties } from '../systems/combat/DefeatPenalties.js';
import { registerItems, DEFAULT_MAX_STACK } from '../config/registries/itemRegistry.js';
import { createEmptyEquipment } from '../config/registries/equipmentConstants.js';
import { ModifierAggregator } from '../systems/effects/ModifierAggregator.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { startNewsCollector } from '../systems/notifications/catchUpNews.js';
import * as Banners from '../systems/notifications/banners.js';
import { wireNotifications, unwireNotifications } from '../systems/notifications/routing.js';
import { toolFindings } from '../systems/core/toolRule.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as Orders from '../systems/board/Orders.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as LoadoutMoments from '../systems/board/LoadoutMoments.js';
import * as LiveEffects from '../systems/effects/LiveEffects.js';
import * as EquipmentManager from '../systems/equipment/EquipmentManager.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { KEYWORD, makeStatement } from '../systems/effects/statements.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { activeElixirsOf, statusesView, enemySide } from '../ui/components/combat/fightView.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * Hero, gear and fight shapes the CMS (or its AI Generate, or a change pack) can author and no
 * shipped content uses yet: each test authors the shape on a fixture and checks the game does what
 * the shape says.
 */

const PLAIN = { description: '', tags: [], restoreAmount: 0, restoreType: '', regen: 0, value: 1, sprite: 'wood_oak' };

registerItems({
    // A hat the owner turned into a crafting material: its Equip Category is now "Not Equippable".
    fixture_hg_pelt: { ...PLAIN, id: 'fixture_hg_pelt', name: 'Wolf Pelt', type: 'material', equipSlot: '', stackable: true },
    fixture_hg_pie: { ...PLAIN, id: 'fixture_hg_pie', name: 'Pie', type: 'food', equipSlot: 'food', stackable: true },
    // What the CMS's AI Generate writes on every item it makes.
    fixture_hg_capped: { ...PLAIN, id: 'fixture_hg_capped', name: 'Capped Ore', type: 'material', equipSlot: '', stackable: true, maxStack: 10 },
    fixture_hg_single: { ...PLAIN, id: 'fixture_hg_single', name: 'Lone Relic', type: 'material', equipSlot: '', stackable: false }
});

function makeHero(id, equipment = createEmptyEquipment()) {
    return {
        id, name: id, status: 'idle', level: 1, skills: {},
        hp: { current: 0, max: 100 }, statuses: [], effects: [], equipment,
        aggregator: new ModifierAggregator(id)
    };
}

const count = (itemId) => InventoryManager.getItemCount(itemId);

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
});

describe('a loadout slot whose item is no longer equippable', () => {
    it('costs nothing on defeat; carried food still loses its share', () => {
        const grid = createEmptyEquipment();
        grid[0] = 'fixture_hg_pelt';
        grid[1] = 'fixture_hg_pie';
        GameState.state.heroes = [makeHero('h1', grid)];
        InventoryManager.addItem('fixture_hg_pelt', 100);
        InventoryManager.addItem('fixture_hg_pie', 100);

        const lost = applyDefeatPenalties('h1');

        expect(count('fixture_hg_pelt')).toBe(100);
        expect(count('fixture_hg_pie')).toBe(75);
        expect(lost).toEqual(['25 Pie']);
    });
});

describe('a stack\'s limit', () => {
    /** Everything published on `names` while `fn` runs, as `[name, payload]`. */
    function heard(names, fn) {
        const seen = [];
        const offs = names.map(name => EventBus.subscribe(name, (p) => seen.push([name, p])));
        try { fn(); } finally { offs.forEach(off => off()); }
        return seen;
    }

    it('an item\'s own stack limit, or a mark that it is not stackable, is not read: the Bank takes the whole pile', () => {
        InventoryManager.addItem('fixture_hg_capped', 10);
        SpriteLayer.addSprite('item', 'fixture_hg_capped', 3, null);
        const said = heard([ENGINE_EVENTS.BANK_FULL], () => SpriteLayer.collectAll());
        expect(said).toEqual([]);
        expect(count('fixture_hg_capped')).toBe(13);
        expect(SpriteLayer.countOnBoard('fixture_hg_capped')).toBe(0);

        expect(InventoryManager.addItem('fixture_hg_single', 3)).toBe(3);
        expect(InventoryManager.addItem('fixture_hg_single', 1)).toBe(1);
        expect(count('fixture_hg_single')).toBe(4);
        expect(InventoryManager.hasRoomFor(['fixture_hg_single', 'fixture_hg_capped'])).toBe(true);
    });

    it('at the one ceiling every stack shares, the part of a pile that fits is collected and the stack is said full', () => {
        InventoryManager.addItem('fixture_hg_pelt', DEFAULT_MAX_STACK - 2);
        SpriteLayer.addSprite('item', 'fixture_hg_pelt', 5, null);

        const said = heard([BOARD_EVENTS.SPRITE_COLLECTED, ENGINE_EVENTS.BANK_FULL], () => SpriteLayer.collectAll());

        expect(count('fixture_hg_pelt')).toBe(DEFAULT_MAX_STACK);
        expect(SpriteLayer.countOnBoard('fixture_hg_pelt')).toBe(3);
        expect(InventoryManager.freeSlots()).toBeGreaterThan(0);
        expect(said.map(([name, p]) => [name, p.refId ?? p.itemId, p.quantity ?? p.reason])).toEqual([
            [BOARD_EVENTS.SPRITE_COLLECTED, 'fixture_hg_pelt', 2],
            [ENGINE_EVENTS.BANK_FULL, 'fixture_hg_pelt', 'stack']
        ]);
    });

    it('a Bank with no slot still says the Bank is full', () => {
        GameState.state.inventory.maxSlots = 0;
        const said = heard([ENGINE_EVENTS.BANK_FULL], () => InventoryManager.addItem('fixture_hg_pie', 2));
        expect(said).toEqual([[ENGINE_EVENTS.BANK_FULL, { itemId: 'fixture_hg_pie', reason: 'slots' }]]);
    });

    describe('what the player is told', () => {
        beforeEach(() => { Banners.reset(); wireNotifications(); });
        afterEach(() => { unwireNotifications(); Banners.reset(); });

        it('a full stack has its own banner', () => {
            EventBus.publish(ENGINE_EVENTS.BANK_FULL, { itemId: 'fixture_hg_capped', reason: 'stack' });
            EventBus.publish(ENGINE_EVENTS.BANK_FULL, { itemId: 'fixture_hg_pie', reason: 'slots' });
            const all = Banners.getAll();
            expect(all.map(b => [b.kind, b.tone]).sort()).toEqual([['bankFull', 'problem'], ['stackFull', 'problem']]);
            expect(all.find(b => b.kind === 'stackFull').line).toMatch(/Capped Ore waits on the mat/);
            expect(all.find(b => b.kind === 'stackFull').line).not.toMatch(/until the Bank has room/);
        });

        it('a catch-up keeps the two apart', () => {
            const news = startNewsCollector();
            EventBus.publish(ENGINE_EVENTS.BANK_FULL, { itemId: 'fixture_hg_capped', reason: 'stack' });
            EventBus.publish(ENGINE_EVENTS.BANK_FULL, { itemId: 'fixture_hg_pie', reason: 'slots' });
            const said = news.stop();
            expect(said.bankFull).toEqual(['fixture_hg_pie']);
            expect(said.stackFull).toEqual(['fixture_hg_capped']);
        });
    });
});

describe('a gathering tool with a level requirement', () => {
    // The tool gate never asks for a level, so the content audit says so instead.
    const pick = { id: 'fx_req_pick', name: 'Steel Pickaxe', equipSlot: 'hand', tool: { kind: 'pickaxe', tier: 2 } };

    it('is named by the content audit, whether the level is its own or in its requirements list', () => {
        const items = {
            own: { ...pick, id: 'own', skillRequired: 'mining', levelRequired: 15 },
            listed: { ...pick, id: 'listed', requirements: [{ skill: 'mining', level: 10 }] },
            plain: { ...pick, id: 'plain' }
        };
        const found = toolFindings({ items }).filter(f => /level/.test(f.message));
        expect(found.map(f => f.entityId).sort()).toEqual(['listed', 'own']);
        expect(found.find(f => f.entityId === 'own').message).toMatch(/Mining 15/);
    });
});

/** A hero who can fight, standing on the roster. */
function fighter(id) {
    const hero = generateHero({ name: id });
    hero.id = id;
    hero.status = 'idle';
    hero.hp = { current: 100, max: 100 };
    Object.values(hero.skills).forEach(sk => { sk.level = 50; });
    hero.aggregator = new ModifierAggregator(id);
    hero.statuses = [];
    hero.effects = [];
    GameState.state.heroes = [hero];
    return hero;
}

/** An enemy Token at a test spot with `heroId` sent to it, and the fight started. */
function engage(heroId) {
    const instance = BoardState.createTokenInstance('fixture_enemy', tokenStartingUses('fixture_enemy'));
    Placement.placeTokenAt(instance, { x: 600, y: 400 });
    TileModifiers.rebuildAround([instance]);
    Orders.orderAt(heroId, { x: 600, y: 400 });
    for (let t = 0; t < 300; t += 100) BoardRunner.tick(100);
    const fight = BoardCombat.getFight(instance.id);
    expect(fight, 'no fight started').toBeTruthy();
    return fight;
}

registerEffects({
    fx_hg_tested: {
        id: 'fx_hg_tested', name: 'Tested',
        statements: [{ ...makeStatement(KEYWORD.PROVIDES), id: 'stm_hg_tested', payload: { type: EFFECT_TYPES.ARMOR, bucket: 'flat', value: 1 } }]
    },
    // "Aims at: whoever its filter reaches", the first option, saves no role.
    fx_hg_elixir_any: {
        id: 'fx_hg_elixir_any', name: 'Elixir of Anyone',
        statements: [{
            ...makeStatement(KEYWORD.APPLIES), id: 'stm_hg_elixir_any',
            when: { event: 'COMBAT_ENGAGED', scope: 'self' },
            payload: { effectId: 'fx_hg_tested', scale: 1, durationMs: 0, forFight: true, chance: 100 }
        }]
    }
});
registerItems({
    fixture_hg_elixir: { ...PLAIN, id: 'fixture_hg_elixir', name: 'Elixir of Anyone', type: 'potion', equipSlot: 'consumable', stackable: true, effects: [{ effectId: 'fx_hg_elixir_any' }] }
});

describe('an elixir whose rule names no role', () => {
    beforeEach(() => {
        TileModifiers.clearAll();
        TileModifiers.init();
        BoardCombat.clearAll();
        LoadoutMoments.init();
        LiveEffects.resetClock();
        GameState.state.inventory.maxSlots = 50;
    });
    afterEach(() => {
        LoadoutMoments.teardown?.();
        TileModifiers.teardown();
        BoardCombat.clearAll();
    });

    it('is still listed in its last fight, while its effect is on', () => {
        const hero = fighter('hero_1');
        InventoryManager.addItem('fixture_hg_elixir', 10);
        expect(EquipmentManager.equipItem(hero.id, 'fixture_hg_elixir').success).toBe(true);

        engage(hero.id);

        const carried = hero.effects.find(e => e.effectId === 'fx_hg_tested');
        expect(carried?.sourceId).toBe('fx_hg_elixir_any');
        // Its last fight: no fights left to count, only the one under way.
        hero.elixirFights.fixture_hg_elixir = 0;
        expect(activeElixirsOf(hero).map(e => e.itemId)).toEqual(['fixture_hg_elixir']);
    });
});

registerEffects({
    fx_hg_venom: { id: 'fx_hg_venom', name: 'Venom', status: { stacks: 3, ticks: 0 }, statements: [] },
    // Authored past the engine's limit of five stacks.
    fx_hg_swarm: { id: 'fx_hg_swarm', name: 'Swarm', status: { stacks: 9, ticks: 0 }, statements: [] }
});

describe('a status the gear moves the stack limit of', () => {
    it('shows the limit the hero holds it at, not the limit the status names', () => {
        const hero = fighter('hero_1');
        // "Venom stacks at most 1 lower"
        hero.aggregator.addModifier({ type: EFFECT_TYPES.STATUS_MAX_STACKS, bucket: 'flat', value: -1, target: { category: 'fx_hg_venom' }, source: 'test' });
        hero.effects.push(
            { effectId: 'fx_hg_venom', scale: 1, stacks: 2, expiresAt: Infinity, forFight: true },
            { effectId: 'fx_hg_swarm', scale: 1, stacks: 5, expiresAt: Infinity, forFight: true }
        );
        const caps = Object.fromEntries(statusesView(hero).map(v => [v.id, v.maxStacks]));
        expect(caps).toEqual({ fx_hg_venom: 2, fx_hg_swarm: 5 });
    });
});

describe('an enemy a rule lends flat Damage and Type Damage', () => {
    it('shows the hit the engine swings for, and the type boost under it', () => {
        const aggregator = new ModifierAggregator('enemy');
        aggregator.addModifier({ type: EFFECT_TYPES.DAMAGE, bucket: 'flat', value: 2, source: 'test' });
        aggregator.addModifier({ type: EFFECT_TYPES.DAMAGE, bucket: 'percentage', value: 0.5, source: 'test' });
        aggregator.addModifier({ type: EFFECT_TYPES.TYPE_DAMAGE, bucket: 'flat', value: 50, target: { category: 'crush' }, source: 'test' });
        const fight = {
            enemy: { id: 'fixture_enemy', name: 'Brute', hit: 4, hp: 10, level: 1, aggregator },
            aggregator, effects: [], combat: { enemyHp: { current: 10, max: 10 } }
        };

        const side = enemySide('fixture_enemy', fight);

        expect(side.hit).toBe(9);
        expect(side.hitLines).toEqual(['Crush damage: +50%']);
    });
});
