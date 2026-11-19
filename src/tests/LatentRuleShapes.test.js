import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as Orders from '../systems/board/Orders.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as TriggerSystem from '../systems/board/TriggerSystem.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as RecipeResolver from '../systems/board/RecipeResolver.js';
import * as FightMoments from '../systems/board/FightMoments.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import { tickUpkeep, isStatementPaid } from '../systems/board/BlockUpkeep.js';
import { SIDE } from '../systems/combat/FightHooks.js';
import { FIGHT_MOMENT } from '../config/registries/triggerRegistry.js';
import { ModifierAggregator } from '../systems/effects/ModifierAggregator.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes, tokenStartingUses, getTokenType } from '../config/registries/tokenRegistry.js';
import { getAllSkillIds } from '../config/registries/skillRegistry.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import * as LiveEffects from '../systems/effects/LiveEffects.js';
import * as Charges from '../systems/board/Charges.js';
import * as Hand from '../systems/board/Hand.js';
import * as WorkCheck from '../systems/board/WorkCheck.js';
import { workConfigOf } from '../systems/board/StationRecipe.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import * as GameClock from '../systems/core/GameClock.js';
import { processCombat } from '../systems/combat/CombatProcessor.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * Rule shapes the CMS can author and no shipped Token uses yet: each test authors the shape on a
 * fixture and checks the engine does what the sentence says.
 */

/** Test layout only: spots 160 u apart, inside the shipped Near. */
const C = (i) => ({ x: 400 + (i % 6) * 160, y: 200 + Math.floor(i / 6) * 160 });

const COAL = 'fixture_charcoal';
const ORE = 'fixture_copper_ore';
const BONUS = 'fixture_control_item';
const WOOD = 'fixture_oak_wood';

function makeHero(id) {
    const skills = {};
    for (const s of getAllSkillIds()) skills[s] = { level: 50, xp: 0 };
    return {
        id, name: id, status: 'idle', level: 50, skills,
        hp: { current: 100, max: 100 }, statuses: [], effects: [],
        aggregator: new ModifierAggregator(id)
    };
}

function place(spot, typeId, heroId = null, uses = undefined) {
    const instance = BoardState.createTokenInstance(
        typeId, uses === undefined ? tokenStartingUses(typeId) : uses
    );
    Placement.placeTokenAt(instance, C(spot));
    TileModifiers.rebuildAround([instance]);
    if (heroId) Orders.orderAt(heroId, C(spot));
    return instance;
}

const run = (ms, step = 100) => { for (let t = 0; t < ms; t += step) BoardRunner.tick(step); };

const upkeep = (quantity = 1, cadenceMs = 1000) => ({ items: [{ itemId: COAL, quantity }], cadenceMs });

/** A grant of one bonus item onto the bearer, on a moment, free of charges. */
const grantOn = (id, when, extra = {}) => ({
    id, keyword: 'grants',
    payload: { type: 'BONUS_DROP', itemId: BONUS, quantity: 1, chance: 100 },
    chargeDelta: 0, to: null, reach: null, target: null, when, ...extra
});

/** A plain one-second producer that needs no hero. */
const producer = (id, extra = {}) => ({
    id, name: id, tokenType: 'resource', rarity: 'common', theme: 'fixture', sprite: 's_nature',
    requiresHero: false,
    config: {
        skill: 'forestry', skillRequired: 1, cycleTimeMs: 1000, xp: 0,
        inputs: [], outputs: [{ itemId: WOOD, quantity: 1, chance: 100 }]
    },
    ...extra
});

/** Doubles the yield of every nearby Token the filters name. */
const booster = (id, filters) => ({
    id, name: id, tokenType: 'buff', rarity: 'common', theme: 'fixture', sprite: 's_occult',
    statements: [{
        id: `stm_${id}`, keyword: 'provides', to: { mode: 'all', value: '', filters },
        payload: { type: 'YIELD', bucket: 'percentage', value: 1 }
    }]
});

registerEffects({
    fixture_rs_mark: { id: 'fixture_rs_mark', name: 'Mark', statements: [] },
    fixture_rs_thrift: {
        id: 'fixture_rs_thrift', name: 'Thrift',
        statements: [{ id: 'stm_rs_thrift', keyword: 'provides', payload: { type: 'INPUT_COST', bucket: 'percentage', value: -0.5 } }]
    }
});

registerTokenTypes({
    fixture_rs_coal_pick: {
        id: 'fixture_rs_coal_pick', name: 'Coal-fed Pickaxe', tokenType: 'support', rarity: 'common',
        sprite: 's_mining', requiresHero: false,
        statements: [{
            id: 'stm_rs_coal_pick', keyword: 'acts_as', payload: { tag: 'pickaxe', tier: 1 },
            chargeDelta: 0, to: null, reach: null, target: null, when: null, upkeep: upkeep()
        }]
    },
    fixture_rs_upkept_moment: producer('fixture_rs_upkept_moment', {
        statements: [grantOn('stm_rs_upkept_moment',
            { event: 'SELF_CYCLE_COMPLETE', scope: 'self', cooldownMs: 0 }, { upkeep: upkeep() })]
    }),
    fixture_rs_last_cycle: producer('fixture_rs_last_cycle', {
        uses: 1,
        statements: [grantOn('stm_rs_last_cycle',
            { event: 'SELF_CYCLE_COMPLETE', scope: 'self', cooldownMs: 0 })]
    }),
    fixture_rs_last_cycle_refund: producer('fixture_rs_last_cycle_refund', {
        uses: 1,
        statements: [grantOn('stm_rs_last_cycle_refund',
            { event: 'SELF_CYCLE_COMPLETE', scope: 'self', cooldownMs: 0 }, { chargeDelta: 1 })]
    }),
    fixture_rs_one_use: producer('fixture_rs_one_use', { uses: 1 }),
    fixture_rs_cycle_listener: {
        id: 'fixture_rs_cycle_listener', name: 'Cycle Listener', tokenType: 'support', rarity: 'common',
        sprite: 's_nature', requiresHero: false,
        statements: [grantOn('stm_rs_cycle_listener',
            { event: 'CYCLE_COMPLETE', scope: 'nearby', cooldownMs: 0 })]
    },
    fixture_rs_upkept_thorns: {
        id: 'fixture_rs_upkept_thorns', name: 'Coal Thorns', tokenType: 'support', rarity: 'common',
        sprite: 's_nature', requiresHero: false,
        statements: [{
            id: 'stm_rs_upkept_thorns', keyword: 'deals', payload: { amount: 1 },
            chargeDelta: 0, to: null, reach: null, target: { role: 'actor' },
            when: { event: 'FIGHT_STRUCK', scope: 'self' }, upkeep: upkeep()
        }]
    },
    fixture_rs_wear_booster: booster('fixture_rs_wear_booster', [{ kind: 'charges_below', value: 3 }]),
    fixture_rs_mark_booster: booster('fixture_rs_mark_booster', [{ kind: 'carrying', value: 'fixture_rs_mark' }]),
    fixture_rs_worn_node: producer('fixture_rs_worn_node', { uses: 5, requiresHero: true }),
    fixture_rs_becomes: producer('fixture_rs_becomes', {
        uses: 2,
        statements: [
            {
                id: 'stm_rs_becomes', keyword: 'transforms', payload: { typeId: 'fixture_rs_one_use' },
                chargeDelta: 0, to: null, reach: null, target: { role: 'self' },
                when: { event: 'SELF_CYCLE_COMPLETE', scope: 'self', cooldownMs: 0 }
            },
            grantOn('stm_rs_becomes_grant',
                { event: 'SELF_CYCLE_COMPLETE', scope: 'self', cooldownMs: 0 }, { chargeDelta: -1 })
        ]
    }),
    fixture_rs_changer: {
        id: 'fixture_rs_changer', name: 'Changer', tokenType: 'support', rarity: 'common',
        sprite: 's_occult', requiresHero: false, uses: 5,
        statements: [{
            id: 'stm_rs_changer', keyword: 'transforms', payload: { typeId: 'fixture_rs_one_use' },
            chargeDelta: -1, to: null, reach: null, target: { role: 'source' },
            when: { event: 'CYCLE_COMPLETE', scope: 'nearby', cooldownMs: 0 }
        }]
    },
    fixture_rs_endless: producer('fixture_rs_endless'),
    fixture_rs_stumper: producer('fixture_rs_stumper', {
        statements: [{
            id: 'stm_rs_stumper', keyword: 'spawns', payload: { typeId: 'fixture_rs_one_use', placement: 'here', chance: 100 },
            chargeDelta: 0, to: null, reach: null, target: null,
            when: { event: 'SELF_CYCLE_COMPLETE', scope: 'self', cooldownMs: 0 }
        }]
    }),
    fixture_rs_turns_on_cycle: {
        id: 'fixture_rs_turns_on_cycle', name: 'Turns', tokenType: 'support', rarity: 'common',
        sprite: 's_occult', requiresHero: false,
        statements: [{
            id: 'stm_rs_turns_on_cycle', keyword: 'transforms', payload: { typeId: 'fixture_rs_one_use' },
            chargeDelta: 0, to: null, reach: null, target: { role: 'self' },
            when: { event: 'CYCLE_COMPLETE', scope: 'nearby', cooldownMs: 0 }
        }]
    },
    fixture_rs_stumps_on_cycle: {
        id: 'fixture_rs_stumps_on_cycle', name: 'Stumps', tokenType: 'support', rarity: 'common',
        sprite: 's_occult', requiresHero: false,
        statements: [{
            id: 'stm_rs_stumps_on_cycle', keyword: 'spawns', payload: { typeId: 'fixture_rs_one_use', placement: 'here', chance: 100 },
            chargeDelta: 0, to: null, reach: null, target: null,
            when: { event: 'CYCLE_COMPLETE', scope: 'nearby', cooldownMs: 0 }
        }]
    },
    fixture_rs_coal_forge: producer('fixture_rs_coal_forge', {
        requiresHero: true,
        config: {
            skill: 'smithing', skillRequired: 1, cycleTimeMs: 1000, xp: 0,
            inputs: [{ itemId: COAL, quantity: 10 }], outputs: [{ itemId: WOOD, quantity: 1, chance: 100 }]
        }
    }),
    fixture_rs_lone_booster: {
        ...booster('fixture_rs_lone_booster', []),
        noStackDuplicates: true,
        statements: [{
            id: 'stm_rs_lone_booster', keyword: 'provides', to: { mode: 'all', value: '' },
            payload: { type: 'YIELD', bucket: 'percentage', value: 1 }, upkeep: upkeep()
        }]
    },
    fixture_rs_sigil: {
        id: 'fixture_rs_sigil', name: 'Ore Sigil', tokenType: 'support', rarity: 'common',
        sprite: 's_mining', requiresHero: false,
        statements: [{
            id: 'stm_rs_sigil', keyword: 'converts',
            payload: { type: 'CONVERT', consumes: [{ itemId: ORE, quantity: 1 }], produces: [{ itemId: BONUS, quantity: 1 }], chance: 100 },
            chargeDelta: 0, to: { mode: 'all', value: '' }, reach: null, target: null,
            when: { event: 'ITEM_THRESHOLD', scope: 'global', watchItemId: ORE, threshold: 1, cooldownMs: 2000 },
            upkeep: null
        }]
    }
});

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    TileModifiers.init();
    TriggerSystem.resetCascadeGuard();
    TriggerSystem.init();
    GameState.state.heroes = [makeHero('miner')];
    GameState.state.inventory.maxSlots = 50;
});

afterEach(() => {
    TriggerSystem.teardown();
    TileModifiers.teardown();
});

describe('an upkeep is enforced on every rule that can carry one', () => {
    it('an Acts as whose upkeep is unpaid hands its neighbours no capability', () => {
        InventoryManager.addItem(COAL, 2);
        const vein = place(12, 'fixture_copper_vein', 'miner');
        place(13, 'fixture_rs_coal_pick');

        // Two seconds paid, then the Bank runs dry; the vein's ten-second cycle never finishes.
        run(15000);

        expect(InventoryManager.getItemCount(COAL)).toBe(0);
        expect(RecipeResolver.contextTiersAround(vein.id).pickaxe).toBeUndefined();
        expect(SpriteLayer.countOnBoard(WOOD)).toBe(0);
    });

    it('an Acts as works again once the Bank can pay its upkeep', () => {
        const vein = place(12, 'fixture_copper_vein', 'miner');
        place(13, 'fixture_rs_coal_pick');
        run(1000);
        expect(RecipeResolver.contextTiersAround(vein.id).pickaxe).toBeUndefined();

        InventoryManager.addItem(COAL, 50);
        run(1000);
        expect(RecipeResolver.contextTiersAround(vein.id).pickaxe).toBe(1);
        run(10000);
        expect(SpriteLayer.countOnBoard(WOOD)).toBe(2);
    });

    it('a rule with a moment does not fire while its upkeep is unpaid', () => {
        place(0, 'fixture_rs_upkept_moment');
        run(5000);
        expect(SpriteLayer.countOnBoard(WOOD)).toBe(5);
        expect(SpriteLayer.countOnBoard(BONUS)).toBe(0);
    });

    it('a rule with a moment fires while its upkeep is paid', () => {
        InventoryManager.addItem(COAL, 50);
        place(0, 'fixture_rs_upkept_moment');
        run(5000);
        expect(SpriteLayer.countOnBoard(BONUS)).toBe(5);
    });
});

describe('an upkeep on a rule an enemy Token carries on a fight moment', () => {
    /** A fight against the Token, as far as its moment rules read one. */
    const fightAgainst = (instance) => ({
        combat: { enemyHp: { current: 10, max: 10 } }, enemyId: instance.typeId,
        instanceId: instance.id, assignedHeroId: 'miner', enemy: { kinds: [] }, effects: []
    });
    const struck = (instance) => {
        tickUpkeep(instance, getTokenType(instance.typeId), 1000);
        FightMoments.run(fightAgainst(instance), SIDE.ENEMY, FIGHT_MOMENT.STRUCK, 1);
        return HeroManager.getHero('miner').hp.current;
    };

    it('keeps the rule off while unpaid', () => {
        expect(struck(place(0, 'fixture_rs_upkept_thorns'))).toBe(100);
    });

    it('runs the rule while paid', () => {
        InventoryManager.addItem(COAL, 5);
        expect(struck(place(0, 'fixture_rs_upkept_thorns'))).toBe(99);
    });
});

describe('an upkeep naming one item on two lines', () => {
    const def = {
        statements: [{
            id: 'stm_rs_twice', keyword: 'provides', payload: { type: 'YIELD', bucket: 'percentage', value: 1 },
            upkeep: { items: [{ itemId: COAL, quantity: 1 }, { itemId: COAL, quantity: 1 }], cadenceMs: 1000 }
        }]
    };

    it('costs both lines, and is unpaid with stock for only one', () => {
        InventoryManager.addItem(COAL, 1);
        const instance = { id: 'x', typeId: 'x' };
        tickUpkeep(instance, def, 1000);
        expect(isStatementPaid(instance, 'stm_rs_twice')).toBe(false);
        expect(InventoryManager.getItemCount(COAL)).toBe(1);
    });

    it('takes both lines when the Bank holds them', () => {
        InventoryManager.addItem(COAL, 3);
        const instance = { id: 'x', typeId: 'x' };
        tickUpkeep(instance, def, 1000);
        expect(isStatementPaid(instance, 'stm_rs_twice')).toBe(true);
        expect(InventoryManager.getItemCount(COAL)).toBe(1);
    });
});

describe('a buff whose filter reads live state follows it', () => {
    const yieldAt = (instance) => TileModifiers.resolveAxis(instance.id, EFFECT_TYPES.YIELD, 10, 'forestry');

    it('reaches a Token once its charges fall below the line', () => {
        const node = place(0, 'fixture_rs_worn_node', 'miner');
        place(1, 'fixture_rs_wear_booster');
        run(100);
        expect(yieldAt(node)).toBe(10);

        // Three cycles spend three of its five charges.
        run(3000);
        expect(node.usesRemaining).toBe(2);
        expect(yieldAt(node)).toBe(20);
    });

    it('lets go of a Token whose charges climb back over the line', () => {
        const node = place(0, 'fixture_rs_worn_node', null, 2);
        place(1, 'fixture_rs_wear_booster');
        run(100);
        expect(yieldAt(node)).toBe(20);
        Charges.applyDelta(node, 3);
        run(100);
        expect(yieldAt(node)).toBe(10);
    });

    it('reaches a Token once its hero carries the effect, and lets go when it ends', () => {
        const node = place(0, 'fixture_rs_worn_node', 'miner');
        place(1, 'fixture_rs_mark_booster');
        run(100);
        expect(BoardState.workerOf(node.id)).toBe('miner');
        expect(yieldAt(node)).toBe(10);

        LiveEffects.applyToHero('miner', { effectId: 'fixture_rs_mark', durationMs: 60000 });
        run(100);
        expect(yieldAt(node)).toBe(20);

        LiveEffects.removeFromHero('miner', 'fixture_rs_mark');
        run(100);
        expect(yieldAt(node)).toBe(10);
    });
});

describe('the cycle that uses a Token up is still a cycle', () => {
    it('a rule on its own cycle fires on the cycle that empties the Token', () => {
        const last = place(0, 'fixture_rs_last_cycle');
        run(2000);
        expect(BoardState.getTokenById(last.id)).toBeNull();
        expect(SpriteLayer.countOnBoard(WOOD)).toBe(1);
        expect(SpriteLayer.countOnBoard(BONUS)).toBe(1);
    });

    it('a neighbour hears the cycle that empties a Token', () => {
        const last = place(0, 'fixture_rs_one_use');
        place(1, 'fixture_rs_cycle_listener');
        run(2000);
        expect(BoardState.getTokenById(last.id)).toBeNull();
        expect(SpriteLayer.countOnBoard(BONUS)).toBe(1);
    });

    it('a rule that gives charges back does not refill a Token already gone', () => {
        const last = place(0, 'fixture_rs_last_cycle_refund');
        const changes = [];
        const unsub = EventBus.subscribe(BOARD_EVENTS.TOKEN_CHARGES_CHANGED, (p) => {
            if (p.instanceId === last.id) changes.push(p.remaining);
        });
        run(2000);
        unsub();
        expect(BoardState.getTokenById(last.id)).toBeNull();
        expect(SpriteLayer.countOnBoard(BONUS)).toBe(1);
        // Spent to nothing once, and never announced as refilled after it left.
        expect(changes).toEqual([0]);
        expect(last.usesRemaining).toBe(0);
    });
});

describe('a second rule on the moment a Token was replaced', () => {
    it('spends nothing from the Token that is gone and announces no depletion', () => {
        const before = place(0, 'fixture_rs_becomes');
        const depleted = [];
        const charged = [];
        const offs = [
            EventBus.subscribe(BOARD_EVENTS.TOKEN_DEPLETED, (p) => depleted.push(p.instanceId)),
            EventBus.subscribe(BOARD_EVENTS.TOKEN_CHARGES_CHANGED, (p) => {
                if (p.instanceId === before.id) charged.push(p.remaining);
            })
        ];
        run(1000);
        offs.forEach(off => off());

        expect(BoardState.getTokenById(before.id)).toBeNull();
        expect(BoardState.tokens().map(t => t.typeId)).toEqual(['fixture_rs_one_use']);
        // Its cycle spent one charge; nothing after it became something else.
        expect(charged).toEqual([1]);
        expect(depleted).toEqual([]);
    });
});

describe('a Transforms aimed at another Token', () => {
    it('costs its bearer the charge it names', () => {
        const changer = place(1, 'fixture_rs_changer');
        const node = place(0, 'fixture_rs_endless');
        run(1000);
        expect(BoardState.getTokenById(node.id)).toBeNull();
        expect(BoardState.getTokenById(changer.id)).toBe(changer);
        expect(changer.usesRemaining).toBe(4);
    });
});

describe('a rule that puts a Token in another’s place', () => {
    it('a Spawns here says the Token it replaced has gone', () => {
        const bearer = place(0, 'fixture_rs_stumper');
        const changed = [];
        const off = EventBus.subscribe(BOARD_EVENTS.TILE_CHANGED, (p) => changed.push(p));
        run(1000);
        off();
        expect(BoardState.getTokenById(bearer.id)).toBeNull();
        expect(changed.find(p => p.instanceId === bearer.id)).toMatchObject({ typeId: null, x: C(0).x, y: C(0).y });
    });

    it('a Transforms waits while its Token is in the player’s hand', () => {
        const held = place(1, 'fixture_rs_turns_on_cycle');
        place(0, 'fixture_rs_endless');
        Hand.setInHand(held.id, true);
        run(2000);
        expect(BoardState.getTokenById(held.id)).toBe(held);

        Hand.setInHand(held.id, false);
        run(1000);
        expect(BoardState.getTokenById(held.id)).toBeNull();
    });

    it('a Spawns here waits while its bearer is in the player’s hand', () => {
        const held = place(1, 'fixture_rs_stumps_on_cycle');
        place(0, 'fixture_rs_endless');
        Hand.setInHand(held.id, true);
        run(2000);
        expect(BoardState.getTokenById(held.id)).toBe(held);

        Hand.setInHand(held.id, false);
        run(1000);
        expect(BoardState.getTokenById(held.id)).toBeNull();
    });
});

describe('an effect carried both for the fight and for a while', () => {
    const carried = () => HeroManager.getHero('miner').effects.map(e => e.effectId);
    const hero = () => LiveEffects.heroBearer(HeroManager.getHero('miner'));

    afterEach(() => GameClock.end());

    it('keeps the rest of its while when the fight ends', () => {
        GameClock.begin(1_000_000);
        LiveEffects.applyToHero('miner', { effectId: 'fixture_rs_mark', durationMs: 60000 });
        LiveEffects.applyToHero('miner', { effectId: 'fixture_rs_mark', forFight: true });
        GameClock.advance(10000);
        LiveEffects.endFightEffects(hero());
        expect(carried()).toEqual(['fixture_rs_mark']);

        // It then runs out when its while does.
        GameClock.advance(49000);
        LiveEffects.tick(3000);
        expect(carried()).toEqual(['fixture_rs_mark']);
        GameClock.advance(2000);
        LiveEffects.tick(3000);
        expect(carried()).toEqual([]);
    });

    it('keeps a while that lands during the fight', () => {
        GameClock.begin(1_000_000);
        LiveEffects.applyToHero('miner', { effectId: 'fixture_rs_mark', forFight: true });
        LiveEffects.applyToHero('miner', { effectId: 'fixture_rs_mark', durationMs: 60000 });
        LiveEffects.endFightEffects(hero());
        expect(carried()).toEqual(['fixture_rs_mark']);
    });

    it('ends with the fight when its while is already over', () => {
        GameClock.begin(1_000_000);
        LiveEffects.applyToHero('miner', { effectId: 'fixture_rs_mark', durationMs: 5000 });
        LiveEffects.applyToHero('miner', { effectId: 'fixture_rs_mark', forFight: true });
        GameClock.advance(10000);
        LiveEffects.endFightEffects(hero());
        expect(carried()).toEqual([]);
    });
});

describe('a hero who carries Efficiency', () => {
    it('is judged able to afford a station by their own cost cut', () => {
        InventoryManager.addItem(COAL, 5);
        const forge = place(0, 'fixture_rs_coal_forge');
        LiveEffects.applyToHero('miner', { effectId: 'fixture_rs_thrift', durationMs: 600000 });
        const config = workConfigOf(getTokenType(forge.typeId), forge);
        expect(WorkCheck.whyCannotRun(forge.id, forge, 'miner', config)).toBeNull();
    });

    it('takes the station and works it', () => {
        InventoryManager.addItem(COAL, 5);
        LiveEffects.applyToHero('miner', { effectId: 'fixture_rs_thrift', durationMs: 600000 });
        const forge = place(0, 'fixture_rs_coal_forge', 'miner');
        run(1500);
        expect(BoardState.workerOf(forge.id)).toBe('miner');
        expect(SpriteLayer.countOnBoard(WOOD)).toBe(1);
        expect(InventoryManager.getItemCount(COAL)).toBe(0);
    });

    it('a hero without it is still passed over', () => {
        InventoryManager.addItem(COAL, 5);
        const forge = place(0, 'fixture_rs_coal_forge');
        const config = workConfigOf(getTokenType(forge.typeId), forge);
        expect(WorkCheck.whyCannotRun(forge.id, forge, 'miner', config)).toBe('inputs');
    });
});

describe('a Token that does not stack with its own kind', () => {
    it('an unpaid copy does not stop a paid one reaching', () => {
        const target = place(0, 'fixture_rs_endless');
        const unpaid = place(1, 'fixture_rs_lone_booster');
        tickUpkeep(unpaid, getTokenType(unpaid.typeId), 1000);
        expect(isStatementPaid(unpaid, 'stm_rs_lone_booster')).toBe(false);

        place(6, 'fixture_rs_lone_booster');
        TileModifiers.rebuildToken(target.id);
        expect(TileModifiers.resolveAxis(target.id, EFFECT_TYPES.YIELD, 10, 'forestry')).toBe(20);
    });

    it('two paid copies still count once', () => {
        const target = place(0, 'fixture_rs_endless');
        place(1, 'fixture_rs_lone_booster');
        place(6, 'fixture_rs_lone_booster');
        TileModifiers.rebuildToken(target.id);
        expect(TileModifiers.resolveAxis(target.id, EFFECT_TYPES.YIELD, 10, 'forestry')).toBe(20);
    });
});

describe('a swing faster than a second', () => {
    /** Ten seconds of a fight in steps of `step` ms: how many swings each side made. */
    function swingsIn(step) {
        const hero = HeroManager.getHero('miner');
        hero.hp = { current: 1000, max: 1000 };
        // A quarter of a normal swing: 750 ms.
        hero.aggregator.addModifier({ type: EFFECT_TYPES.SWING_TIME, bucket: 'percentage', value: -0.75, source: 'test' });
        const enemy = { id: 'fixture_rs_gnat', name: 'Gnat', hp: 1e9, attackSpeed: 500, level: 1, hit: 0 };
        const fight = {
            id: 'fight_rs', instanceId: null, assignedHeroId: 'miner', enemy, drops: [], traits: [],
            status: 'active', combat: { enemyHp: { current: 1e9, max: 1e9 }, enemyTickProgress: 0, heroTickProcesses: {} }
        };
        const seen = { hero: 0, enemy: 0 };
        const offs = [
            EventBus.subscribe(ENGINE_EVENTS.COMBAT_HERO_ATTACK, () => { seen.hero++; }),
            EventBus.subscribe(ENGINE_EVENTS.COMBAT_ENEMY_ATTACK, () => { seen.enemy++; })
        ];
        for (let t = 0; t < 10000; t += step) processCombat(fight, { enemy }, step);
        offs.forEach(off => off());
        return seen;
    }

    it('swings as often in one-second steps as in the live tick', () => {
        const live = swingsIn(100);
        expect(live).toEqual({ hero: 13, enemy: 20 });
        GameState.state.heroes = [makeHero('miner')];
        expect(swingsIn(1000)).toEqual(live);
    });
});

describe('On Bank Holds fires while the Bank holds', () => {
    it('fires again when its cooldown ends, with no change in the Bank', () => {
        place(0, 'fixture_rs_sigil');
        InventoryManager.addItem(ORE, 5);
        // The Bank moving fires it once at once.
        expect(InventoryManager.getItemCount(ORE)).toBe(4);

        // Every two seconds after, while ore remains.
        run(10000);
        expect(InventoryManager.getItemCount(ORE)).toBe(0);
        expect(SpriteLayer.countOnBoard(BONUS)).toBe(5);
    });

    it('waits for the Bank once it no longer holds', () => {
        place(0, 'fixture_rs_sigil');
        InventoryManager.addItem(ORE, 1);
        run(6000);
        expect(InventoryManager.getItemCount(ORE)).toBe(0);
        expect(SpriteLayer.countOnBoard(BONUS)).toBe(1);

        InventoryManager.addItem(ORE, 1);
        expect(InventoryManager.getItemCount(ORE)).toBe(0);
        expect(SpriteLayer.countOnBoard(BONUS)).toBe(2);
    });
});
