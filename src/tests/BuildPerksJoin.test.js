import { describe, it, expect, afterAll, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BuildPrices from '../systems/board/BuildPrices.js';
import * as Shop from '../systems/board/Shop.js';
import { loadoutStatements } from '../systems/hero/HeroEffects.js';
import { getGlobalAggregator } from '../systems/effects/GuildModifiers.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { registerSkillPerks } from '../config/registries/perkRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { buildRateBook } from '../../cms/src/engine/ledger/rates.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/**
 * ⭐ Master Builder (Build Discount) beside Summoned workers and the coin ledger:
 *
 * - The guild's Build Discount is its best **hero's**. A Summoned worker is no hero of the guild (no
 *   place on the roster, none in settling's best levels): its trait reaches the Token it works, so a
 *   trait carrying Build Discount cuts no Foundation's price, and a guild of Summoned workers alone
 *   has none, a Guild Hall star's included.
 * - The CMS rate calculator does not read Build Discount: a rule carrying it that reaches a build is
 *   listed as unmodelled, never dropped.
 */

const WOOD = 'item_oak_wood';
const PRICE = [{ itemId: WOOD, quantity: 10 }];
const COINS = 10;

const discount = (id, value) => ({
    id, name: id,
    statements: [{
        id: `stm_${id}`, keyword: KEYWORD.PROVIDES, to: { mode: 'all', value: '' }, reach: 'nearby',
        payload: { type: EFFECT_TYPES.BUILD_DISCOUNT, bucket: 'flat', value }
    }]
});
registerEffects({ bj_master_builder: discount('bj_master_builder', 20) });
registerTokenTypes({
    bj_foundation: {
        id: 'bj_foundation', name: 'BJ Foundation', rarity: 'common', theme: 'fixture', uses: 1,
        foundation: { kind: 'bj_kind', skill: 'construction' },
        shop: { price: PRICE, coins: COINS, section: 'general' }
    },
    bj_enemy: {
        id: 'bj_enemy', name: 'BJ Enemy', tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: 1, sprite: 'e_goblin',
        requiresHero: true, enemy: { level: 5, style: 'melee' },
        config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 1, inputs: [], outputs: [] }
    },
    bj_summoned_builder: {
        id: 'bj_summoned_builder', name: 'BJ Summoned Builder', rarity: 'common', theme: 'fixture', sprite: 's_occult',
        summon: { of: 'bj_enemy', skills: { construction: 99 }, trait: { effectId: 'bj_master_builder', scale: 1 } }
    }
});

const hero = (id, construction) => ({
    id, name: id, status: 'idle', level: 50, hp: { current: 100, max: 100 },
    skills: { construction: { level: construction, xp: 0 } }
});
const summoned = (id) => ({
    id, name: id, status: 'idle', hp: { current: 10, max: 10 },
    skills: { construction: { level: 99, xp: 0 } },
    summon: { typeId: 'bj_summoned_builder', circleId: 'bj_circle', charges: 5 }
});
const roster = (...records) => { GameState.state.heroes = records; };
const price = () => [...Shop.priceOf('bj_foundation').map(l => [l.itemId, l.quantity]), ['coins', Shop.coinPriceOf('bj_foundation')]];
const LIST = [[WOOD, 10], ['coins', 10]];
const CUT = [[WOOD, 8], ['coins', 8]];

beforeEach(() => {
    resetMatTuning();
    registerSkillPerks({ construction: { perks: [{ level: 99, effectId: 'bj_master_builder' }] } });
    GameState.initNew();
    InventoryManager.init();
});
afterAll(() => {
    registerSkillPerks({ construction: { perks: [] } });
    resetMatTuning();
});

describe('⭐ Build Discount is the guild\'s best hero\'s, never a Summoned worker\'s', () => {
    it('the control: a hero holding Master Builder cuts a Foundation\'s price, items and coins', () => {
        roster(hero('master', 99));
        expect(BuildPrices.buildDiscount()).toBe(20);
        expect(price()).toEqual(CUT);
    });

    it('⭐ a Summoned worker whose trait is Build Discount cuts nothing, though the trait is on it', () => {
        const worker = summoned('bj_worker');
        roster(hero('novice', 10), worker);
        // The trait is read as its loadout: what keeps it off the price is that it is no hero.
        expect(loadoutStatements(worker).some(s => s.payload?.type === EFFECT_TYPES.BUILD_DISCOUNT)).toBe(true);
        expect(BuildPrices.buildDiscount()).toBe(0);
        expect(price()).toEqual(LIST);
    });

    it('a guild of Summoned workers alone has no Build Discount, a Guild Hall star\'s included', () => {
        const guild = getGlobalAggregator();
        guild.addModifier({ type: EFFECT_TYPES.BUILD_DISCOUNT, bucket: 'flat', value: 10, source: 'bj_star' });
        try {
            roster(summoned('bj_worker'));
            expect(BuildPrices.buildDiscount()).toBe(0);
            expect(price()).toEqual(LIST);
            // A hero joining brings the star's in, and only the star's: the worker's trait still counts for nothing.
            roster(summoned('bj_worker'), hero('novice', 10));
            expect(BuildPrices.buildDiscount()).toBe(10);
        } finally {
            guild.removeModifiersBySource('bj_star');
        }
    });
});

describe('the CMS rate calculator and Build Discount', () => {
    it('a rule carrying Build Discount that reaches the work is listed as unmodelled, not dropped', () => {
        const book = buildRateBook({
            tokens: {
                bj_work: {
                    id: 'bj_work', name: 'bj_work', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature', requiresHero: true,
                    config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 1000, xp: 1, inputs: [], outputs: [{ itemId: 'bj_ore', chance: 100, minQty: 1, maxQty: 1 }] }
                },
                bj_support: {
                    id: 'bj_support', name: 'bj_support', tokenType: 'buff', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature', requiresHero: false,
                    statements: [{ id: 'stm_bj_support', keyword: 'provides', to: { mode: 'all' }, reach: 'nearby', payload: { type: EFFECT_TYPES.BUILD_DISCOUNT, bucket: 'flat', value: 20 } }]
                }
            },
            items: { bj_ore: { id: 'bj_ore', name: 'Ore', type: 'material', stackable: true, equipSlot: '' } },
            recipes: [], effects: {}, starterCamp: { tokens: [] }
        });
        const rate = book.rateOf({ token: 'bj_work' }, { supports: ['bj_support'] });
        expect(rate.unmodelled).toContainEqual(expect.objectContaining({ source: 'bj_support', what: EFFECT_TYPES.BUILD_DISCOUNT }));
    });
});
