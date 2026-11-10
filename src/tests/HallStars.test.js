import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import './fixtures/fixtureItems.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as Orders from '../systems/board/Orders.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Respawn from '../systems/board/Respawn.js';
import * as TimedChanges from '../systems/board/TimedChanges.js';
import * as Camps from '../systems/board/Camps.js';
import * as PassiveProduction from '../systems/board/PassiveProduction.js';
import * as EquipmentManager from '../systems/equipment/EquipmentManager.js';
import { loadoutCapOf } from '../systems/equipment/loadoutCaps.js';
import { WoundedSystem, woundTimeMs, BASE_RECOVERY_TIME_MS } from '../systems/combat/WoundedSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { GuildUpgradeManager } from '../systems/progression/GuildUpgradeManager.js';
import * as HallRules from '../systems/progression/HallRules.js';
import { hallRulesOf, hallLinesOf } from '../systems/progression/hallModifiers.js';
import { describeStarRank } from '../systems/progression/hallStarText.js';
import { hallStarFindings } from '../systems/core/hallStarRule.js';
import { getGlobalAggregator, aimedModifiers } from '../systems/effects/GuildModifiers.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { paletteForKeyword, KEYWORD } from '../systems/effects/statements.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import { GAME_VERSION } from '../state/StateSchema.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { registerItems, ITEMS } from '../config/registries/itemRegistry.js';
import { TOKENS } from '../config/registries/tokenRegistry.js';
import { registerHallSky } from '../config/registries/hallStarRegistry.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { rehydrateHero } from '../systems/hero/logic/HeroRehydration.js';
import { getAllSkillIds } from '../config/registries/skillRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { STANDARD_REACH_U } from '../config/registries/reachRegistry.js';
import {
    GUILD_UPGRADES, CONSTELLATIONS, BUILT_IN_UPGRADE_IDS, HALL_NODE, getUpgradeDef, isUpgradeAccessible,
    authoredStars, skyVersion, setHallSky
} from '../config/guildUpgrades.js';
import { normaliseHallSky, hallStarsFile } from '../config/hallStars.js';
import { qaHallSky } from '../ui/dev/hallStarsDev.js';

/**
 * Brief 320 H1: the Guild Hall's stars as data. A constellation per skill linked to the Hall; a
 * held rank's rules hold guild-wide (a skill's XP, yield, work speed) or on the Tokens they name (a
 * vein's rest, a tree's regrowth, a camp's reach); the Well's lines pay with the Hall's Passive
 * Production; the Hearth's Infirmary and loadout slots reach every hero.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

const VEIN = 'h1_vein';
const OTHER_VEIN = 'h1_other_vein';
const STUMP = 'h1_stump';
const CAMP = 'h1_camp';
const OTHER_CAMP = 'h1_other_camp';
const MINER = 'fixture_producer_alt';   // mining, 15 s, 5 XP
const FELLER = 'fixture_producer';      // forestry, 12 s, 4 XP

registerTokenTypes({
    [VEIN]: {
        id: VEIN, name: 'H1 Vein', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: 2, sprite: 's_industry', tags: ['Ore'],
        respawn: { mode: 'refill', afterMs: 60000 },
        config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 3000, xp: 2, inputs: [], outputs: [{ itemId: 'fixture_copper_ore', quantity: 1, chance: 100 }] }
    },
    [OTHER_VEIN]: {
        id: OTHER_VEIN, name: 'H1 Other Vein', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: 2, sprite: 's_industry', tags: ['Ore'],
        respawn: { mode: 'refill', afterMs: 60000 },
        config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 3000, xp: 2, inputs: [], outputs: [{ itemId: 'fixture_copper_ore', quantity: 1, chance: 100 }] }
    },
    [STUMP]: {
        id: STUMP, name: 'H1 Stump', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature', tags: ['Oak'],
        requiresHero: false, grows: { into: FELLER, afterMs: 100000 }
    },
    [CAMP]: {
        id: CAMP, name: 'H1 Camp', tokenType: 'station', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_industry',
        requiresHero: false, camp: { skill: 'mining' }
    },
    [OTHER_CAMP]: {
        id: OTHER_CAMP, name: 'H1 Other Camp', tokenType: 'station', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_industry',
        requiresHero: false, camp: { skill: 'mining' }
    }
});
registerItems({
    h1_apple: { id: 'h1_apple', name: 'H1 Apple', type: 'food', equipSlot: 'food', restoreAmount: 5, restoreType: 'HP', stackable: true, tags: [], value: 1 },
    h1_pear: { id: 'h1_pear', name: 'H1 Pear', type: 'food', equipSlot: 'food', restoreAmount: 5, restoreType: 'HP', stackable: true, tags: [], value: 1 }
});

let seq = 0;
const provides = (type, value, { bucket = 'percentage', category, to } = {}) => ({
    id: `stm_h1_${++seq}`, keyword: KEYWORD.PROVIDES,
    payload: { type, bucket, value, ...(category ? { category } : {}) },
    chargeDelta: 0, to: to || { mode: 'all', value: '' }, reach: 'nearby', target: null, when: null, upkeep: null
});
const ore = (n) => [{ itemId: 'fixture_copper_ore', quantity: n }];

/** The test sky: a Mining constellation off the Hall, and one star of every other kind. */
function testSky() {
    const rank = (price, rules, lines = [], tier = 1) => ({ tier, price, rules, lines });
    return {
        constellations: { mining: { id: 'mining', name: 'Mining', label: { x: 1.1, y: -0.6 }, skill: 'mining' } },
        stars: {
            m_xp: { id: 'm_xp', constellation: 'mining', name: 'Lore', node: { x: 0.7, y: -0.2 }, links: [HALL_NODE], ranks: [
                rank(ore(5), [provides(EFFECT_TYPES.XP_BONUS, 1, { category: 'mining' })]),
                rank(ore(10), [provides(EFFECT_TYPES.XP_BONUS, 2, { category: 'mining' })])
            ] },
            m_yield: { id: 'm_yield', constellation: 'mining', name: 'Seams', node: { x: 1.0, y: -0.3 }, links: ['m_xp'], ranks: [
                rank(ore(5), [provides(EFFECT_TYPES.YIELD, 1, { category: 'mining' })])
            ] },
            m_speed: { id: 'm_speed', constellation: 'mining', name: 'Picks', node: { x: 1.0, y: 0 }, links: ['m_xp'], ranks: [
                rank(ore(5), [provides(EFFECT_TYPES.WORK_TIME, -0.4, { category: 'mining' })])
            ] },
            m_rest: { id: 'm_rest', constellation: 'mining', name: 'Deep', node: { x: 1.3, y: -0.3 }, links: ['m_yield'], ranks: [
                rank(ore(5), [provides(EFFECT_TYPES.GROW_TIME, -0.5, { to: { mode: 'id', value: VEIN } })])
            ] },
            m_camp: { id: 'm_camp', constellation: 'mining', name: 'Rails', node: { x: 1.3, y: 0 }, links: ['m_speed'], ranks: [
                rank(ore(5), [provides(EFFECT_TYPES.CAMP_REACH, 0.5, { to: { mode: 'id', value: CAMP } })])
            ] },
            f_regrow: { id: 'f_regrow', constellation: 'mining', name: 'Thumb', node: { x: 0.7, y: 0.3 }, links: [HALL_NODE], ranks: [
                rank(ore(5), [provides(EFFECT_TYPES.GROW_TIME, -0.5, { to: { mode: 'tag', value: 'Oak' } })])
            ] },
            w_ore: { id: 'w_ore', constellation: 'well', name: 'Spring', node: { x: 0.4, y: 0.7 }, links: ['wishing_well'], ranks: [
                rank(ore(5), [], ore(10)),
                rank(ore(10), [], ore(25))
            ] },
            h_infirmary: { id: 'h_infirmary', constellation: 'hearth', name: 'Infirmary', node: { x: 0.4, y: -0.7 }, links: ['roster_size'], ranks: [
                rank(ore(5), [provides(EFFECT_TYPES.WOUND_TIME, -0.4)])
            ] },
            h_food: { id: 'h_food', constellation: 'hearth', name: 'Larder', node: { x: -0.4, y: -0.7 }, links: ['roster_size'], ranks: [
                rank(ore(5), [provides(EFFECT_TYPES.LOADOUT_SLOTS, 1, { bucket: 'flat', category: 'food' })])
            ] }
        }
    };
}

function makeHero(id) {
    const skills = {};
    for (const s of getAllSkillIds()) skills[s] = { level: 50, xp: 0 };
    return { id, name: id, status: 'idle', level: 50, skills, hp: { current: 100, max: 100 } };
}

function place(point, typeId, heroId = null) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    expect(Placement.placeTokenAt(instance, point)?.success, typeId).toBe(true);
    TileModifiers.rebuildAround([instance]);
    if (heroId) Orders.orderAt(heroId, point);
    return instance;
}

const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };
const ranks = () => GameState.state.progress.guildUpgrades;
/** Buy a star's ranks up to `rank`, with the Bank stocked for them. */
function buy(id, rank = 1) {
    InventoryManager.addItem('fixture_copper_ore', 1000);
    InventoryManager.addItem('item_oak_wood', 1000);
    while (GuildUpgradeManager.getRank(id) < rank) {
        const r = GuildUpgradeManager.purchase(id);
        expect(r.success, `${id}: ${r.error}`).toBe(true);
    }
}

beforeEach(() => {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    GameState.state.heroes = [makeHero('hero_1')];
    GameState.state.inventory.maxSlots = 200;
    registerHallSky(testSky());
    GuildUpgradeManager.recompute();
});

afterEach(() => {
    registerHallSky(null);
    HallRules.apply({});
});

describe('the sky holds authored stars beside the built-in ones', () => {
    it('adds the authored constellations and stars after the built-in ones, in the file\'s order', () => {
        expect(GUILD_UPGRADES.slice(0, 3).map(u => u.id)).toEqual(['bank_tabs', 'roster_size', 'wishing_well']);
        expect(authoredStars().map(s => s.id)).toEqual(['m_xp', 'm_yield', 'm_speed', 'm_rest', 'm_camp', 'f_regrow', 'w_ore', 'h_infirmary', 'h_food']);
        expect(CONSTELLATIONS.map(c => c.id)).toEqual(['hearth', 'vault', 'well', 'mining']);
        const def = getUpgradeDef('m_xp');
        expect(def).toMatchObject({ authored: true, maxRank: 2, constellation: 'mining', prices: [ore(5), ore(10)] });
    });

    it('replaces exactly what it put in, leaves other tracks alone, and refuses a built-in id', () => {
        const before = skyVersion();
        const other = { id: 'test_track', constellation: 'vault', name: 'Test', node: { x: -1, y: 0 }, links: [HALL_NODE], maxRank: 1, prices: [[]] };
        GUILD_UPGRADES.push(other);
        try {
            const put = registerHallSky({ stars: { bank_tabs: { id: 'bank_tabs', name: 'Imposter', links: [HALL_NODE], ranks: [{ price: [] }] }, solo: { id: 'solo', constellation: 'vault', links: [HALL_NODE], ranks: [{ price: [] }] } } });
            expect(put.stars.map(s => s.id)).toEqual(['solo']);
            expect(GUILD_UPGRADES.filter(u => u.id === 'bank_tabs')).toHaveLength(1);
            expect(getUpgradeDef('bank_tabs').name).toBe('Bank Tabs');
            expect(GUILD_UPGRADES).toContain(other);
            expect(getUpgradeDef('m_xp')).toBeNull();
            expect(skyVersion()).toBeGreaterThan(before);
        } finally {
            GUILD_UPGRADES.splice(GUILD_UPGRADES.indexOf(other), 1);
        }
    });

    it('opens a skill constellation\'s first star at once, the rest by the neighbour rule', () => {
        expect(isUpgradeAccessible('m_xp', {})).toBe(true);
        expect(isUpgradeAccessible('m_yield', {})).toBe(false);
        expect(isUpgradeAccessible('m_rest', { m_xp: 1 })).toBe(false);
        expect(isUpgradeAccessible('m_yield', { m_xp: 1 })).toBe(true);
        expect(isUpgradeAccessible('h_infirmary', {})).toBe(false);
        expect(isUpgradeAccessible('h_infirmary', { roster_size: 1 })).toBe(true);
    });

    it('pays each rank\'s own price from the Bank, all or nothing', () => {
        InventoryManager.addItem('fixture_copper_ore', 12);
        expect(GuildUpgradeManager.purchase('m_xp').success).toBe(true);
        expect(InventoryManager.getItemCount('fixture_copper_ore')).toBe(7);
        const short = GuildUpgradeManager.purchase('m_xp');
        expect(short.success).toBe(false);
        expect(InventoryManager.getItemCount('fixture_copper_ore')).toBe(7);
        expect(ranks().m_xp).toBe(1);
    });

    it('reads a sky file in one shape: a star with no rank is left out, a tag defaults below, a later duplicate dropped', () => {
        const sky = normaliseHallSky({
            constellations: [{ id: 'a', name: 'A' }, { id: 'a', name: 'Again' }],
            stars: { s1: { name: 'One', links: ['hall', 'hall'], ranks: [{ tier: '2', price: [{ itemId: 'x', quantity: 2.7 }, { itemId: '', quantity: 1 }] }] }, s2: { ranks: [] } }
        });
        expect(sky.constellations).toEqual([{ id: 'a', name: 'A', label: { x: 0, y: 0 } }]);
        expect(sky.stars).toHaveLength(1);
        expect(sky.stars[0]).toMatchObject({ id: 's1', tag: 'below', links: ['hall'], ranks: [{ tier: 2, price: [{ itemId: 'x', quantity: 2 }], rules: [], lines: [] }] });
        expect(Object.keys(hallStarsFile({ constellations: { a: {} }, hallStars: { s1: { ranks: [{}] }, s2: {} } }).stars)).toEqual(['s1']);
    });
});

describe('a skill\'s boosts: XP, yield and work speed, for that skill only', () => {
    it('raises Mining XP per cycle by its rank, and leaves Forestry alone', () => {
        GameState.state.heroes.push(makeHero('hero_2'));
        const xpOf = (heroId, skill) => GameState.state.heroes.find(h => h.id === heroId).skills[skill].xp;
        place({ x: 300, y: 300 }, MINER, 'hero_1');
        place({ x: 900, y: 300 }, FELLER, 'hero_2');
        run(15000);
        const mining0 = xpOf('hero_1', 'mining');
        const forestry0 = xpOf('hero_2', 'forestry');
        expect(mining0).toBe(5);
        expect(forestry0).toBe(4);

        buy('m_xp', 1);
        run(15000);
        expect(xpOf('hero_1', 'mining') - mining0).toBe(10);   // 5 XP at +100 %
        expect(xpOf('hero_2', 'forestry') - forestry0).toBe(4);

        buy('m_xp', 2);
        run(15000);
        expect(xpOf('hero_1', 'mining') - mining0).toBe(10 + 15);   // rank 2 is +200 %, not +300 %
    });

    it('yields more on Mining work and shortens its cycle, on mining Tokens only', () => {
        const miner = place({ x: 300, y: 300 }, MINER);
        const feller = place({ x: 900, y: 300 }, FELLER);
        expect(TileModifiers.resolveAxis(miner.id, EFFECT_TYPES.YIELD, 2, 'mining')).toBe(2);
        buy('m_xp');
        buy('m_yield');
        buy('m_speed');
        expect(TileModifiers.resolveAxis(miner.id, EFFECT_TYPES.YIELD, 2, 'mining')).toBe(4);
        expect(TileModifiers.resolveAxis(feller.id, EFFECT_TYPES.YIELD, 2, 'forestry')).toBe(2);
        expect(TileModifiers.workTimeOf(miner.id, 15000, 'mining')).toBe(9000);
        expect(TileModifiers.workTimeOf(feller.id, 12000, 'forestry')).toBe(12000);
    });

    it('lands the extra yield on the mat in a real cycle', () => {
        place({ x: 300, y: 300 }, MINER, 'hero_1');
        buy('m_xp');
        buy('m_yield');
        run(15000);
        expect(SpriteLayer.countOnBoard('fixture_copper_ore')).toBe(4);
    });
});

describe('Token upgrades: aimed at a Token kind or a tag', () => {
    it('shortens a named vein\'s rest and no other vein\'s', () => {
        const vein = place({ x: 300, y: 300 }, VEIN);
        const other = place({ x: 900, y: 300 }, OTHER_VEIN);
        expect(Respawn.restMsOf(vein)).toBe(60000);
        buy('m_xp');
        buy('m_yield');
        buy('m_rest');
        expect(Respawn.restMsOf(vein)).toBe(30000);
        expect(Respawn.restMsOf(other)).toBe(60000);
    });

    it('rests a worked-out vein for the shortened time, then refills it', () => {
        buy('m_xp');
        buy('m_yield');
        buy('m_rest');
        const vein = place({ x: 300, y: 300 }, VEIN, 'hero_1');
        run(6000);                     // two cycles: out of charges
        expect(BoardState.getTokenById(vein.id).usesRemaining).toBe(0);
        expect(Respawn.isResting(BoardState.getTokenById(vein.id))).toBe(true);
        for (let t = 0; t < 30000; t += 1000) TimedChanges.tick(1000);
        expect(BoardState.getTokenById(vein.id).usesRemaining).toBe(2);
    });

    it('regrows everything with the tag faster', () => {
        const stump = place({ x: 300, y: 300 }, STUMP);
        expect(TimedChanges.growMsOf(stump)).toBe(100000);
        buy('f_regrow');
        expect(TimedChanges.growMsOf(BoardState.getTokenById(stump.id))).toBe(50000);
    });

    it('a Camp Reach star (retired) widens no camp: every camp keeps the one standard reach', () => {
        const camp = place({ x: 300, y: 300 }, CAMP);
        const other = place({ x: 900, y: 300 }, OTHER_CAMP);
        expect(Camps.reachRingOf(camp).r).toBe(STANDARD_REACH_U);
        buy('m_xp');
        buy('m_speed');
        buy('m_camp');
        expect(GuildUpgradeManager.getRanks().m_camp).toBe(1);
        expect(Camps.reachRingOf(camp).r).toBe(STANDARD_REACH_U);
        expect(Camps.reachRingOf(other).r).toBe(STANDARD_REACH_U);
        // Nothing of it reaches the camp's own modifiers or the guild's either.
        expect([...TileModifiers.getTokenAggregator(camp.id).modifiers].some(m => m.type === EFFECT_TYPES.CAMP_REACH)).toBe(false);
        expect(aimedModifiers().some(a => a.modifier.type === EFFECT_TYPES.CAMP_REACH)).toBe(false);
    });
});

describe('the Well: a Passive Production line per star, ranked', () => {
    const hall = () => ({ id: 'hall_1', typeId: 'token_guild_hall' });

    it('adds the rank\'s line beside the Wishing Well\'s Water', () => {
        expect(PassiveProduction.linesOf(hall(), undefined, ranks()).find(l => l.itemId === 'fixture_copper_ore')).toBeUndefined();
        buy('wishing_well', 1);
        buy('w_ore', 1);
        expect(PassiveProduction.linesOf(hall(), undefined, ranks())).toContainEqual({ itemId: 'fixture_copper_ore', quantity: 10, source: 'hall_star' });
        buy('w_ore', 2);
        expect(PassiveProduction.linesOf(hall(), undefined, ranks())).toContainEqual({ itemId: 'fixture_copper_ore', quantity: 25, source: 'hall_star' });
        expect(hallLinesOf(authoredStars(), { w_ore: 2 })).toEqual([{ itemId: 'fixture_copper_ore', quantity: 25 }]);
    });

    it('pays the line on the mat beside the Hall with no hero', () => {
        buy('wishing_well', 1);
        buy('w_ore', 1);
        const before = InventoryManager.getItemCount('fixture_copper_ore');
        const h = place({ x: 600, y: 600 }, 'token_guild_hall');
        PassiveProduction.advance(h, PassiveProduction.PASSIVE_LAP_BASE_MS);
        expect(SpriteLayer.countOnBoard('fixture_copper_ore')).toBe(10);
        expect(InventoryManager.getItemCount('fixture_copper_ore')).toBe(before);
    });
});

describe('the Hearth: the Infirmary and loadout slots', () => {
    it('shortens a wound, floored like every speed-up', () => {
        expect(woundTimeMs()).toBe(BASE_RECOVERY_TIME_MS);
        buy('roster_size', 1);
        buy('h_infirmary');
        expect(woundTimeMs()).toBe(BASE_RECOVERY_TIME_MS * 0.6);
        const hero = GameState.state.heroes[0];
        hero.status = 'wounded';
        hero.woundedRemainingMs = null;
        WoundedSystem.tick(1000);
        expect(hero.woundedRemainingMs).toBe(BASE_RECOVERY_TIME_MS * 0.6 - 1000);
    });

    it('lets every hero carry a second Food', () => {
        const hero = generateHero({ name: 'Eater' });
        hero.id = 'eater';
        GameState.state.heroes.push(hero);
        rehydrateHero(hero);
        InventoryManager.addItem('h1_apple', 3);
        InventoryManager.addItem('h1_pear', 3);
        expect(loadoutCapOf('food')).toBe(1);
        expect(EquipmentManager.equipItem('eater', 'h1_apple').success).toBe(true);
        expect(EquipmentManager.equipItem('eater', 'h1_pear').success).toBe(true);
        expect(hero.equipment.filter(Boolean)).toEqual(['h1_pear']);   // the cap displaced the apple

        buy('roster_size', 2);
        buy('h_food');
        expect(loadoutCapOf('food')).toBe(2);
        expect(loadoutCapOf('consumable')).toBe(Infinity);
        expect(loadoutCapOf('trinket')).toBe(2);
        expect(EquipmentManager.equipItem('eater', 'h1_apple').success).toBe(true);
        expect(hero.equipment.filter(Boolean).sort()).toEqual(['h1_apple', 'h1_pear']);
    });

    it('offers neither guild-only axis in a Token\'s or an item\'s rules editor', () => {
        const offered = paletteForKeyword(KEYWORD.PROVIDES).map(e => e.type);
        expect(offered).not.toContain(EFFECT_TYPES.WOUND_TIME);
        expect(offered).not.toContain(EFFECT_TYPES.LOADOUT_SLOTS);
        // Nor the retired Camp Reach: every camp works the one standard reach.
        expect(offered).not.toContain(EFFECT_TYPES.CAMP_REACH);
    });
});

describe('the rules are the save\'s ranks, put back whenever the game may have changed', () => {
    it('holds nothing guild-wide with no rank, and never rebuilds the mat for it', () => {
        const spy = vi.spyOn(TileModifiers, 'rebuildAll');
        const out = HallRules.apply({});
        expect(out).toEqual({ sources: [], aimed: 0, ignored: [] });
        expect(aimedModifiers()).toEqual([]);
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });

    it('puts a bought rank back after the aggregator is emptied, as a load does', () => {
        const miner = place({ x: 300, y: 300 }, MINER);
        buy('m_xp');
        getGlobalAggregator().clearAll();
        expect(TileModifiers.resolveAxis(miner.id, EFFECT_TYPES.XP_BONUS, 5, 'mining')).toBe(5);
        GuildUpgradeManager.init();
        EventBus.publish(ENGINE_EVENTS.GAME_LOADED, {});
        expect(TileModifiers.resolveAxis(miner.id, EFFECT_TYPES.XP_BONUS, 5, 'mining')).toBe(10);
    });

    it('drops the last game\'s rules on a new one', () => {
        buy('m_xp');
        buy('m_yield');
        buy('m_rest');
        expect(HallRules.installedSources().length).toBe(2);
        HallRules.init();
        GameState.initNew();
        EventBus.publish(ENGINE_EVENTS.GAME_RESET, { reason: 'new_game' });
        expect(HallRules.installedSources()).toEqual([]);
        expect(aimedModifiers()).toEqual([]);
        HallRules.teardown();
    });

    it('splits a rank\'s rules into guild-wide and aimed, and reports what it cannot hold', () => {
        const star = normaliseHallSky({ stars: { s: { id: 's', links: [HALL_NODE], ranks: [{ rules: [
            provides(EFFECT_TYPES.XP_BONUS, 0.1, { category: 'mining' }),
            provides(EFFECT_TYPES.GROW_TIME, -0.1, { to: { mode: 'tag', value: 'Ore' } }),
            { ...provides(EFFECT_TYPES.YIELD, 0.1), when: { event: 'ON_CYCLE' } },
            provides(EFFECT_TYPES.YIELD, 0.1, { to: { mode: 'all', value: '', filters: [{ kind: 'worked' }] } }),
            { id: 'g', keyword: KEYWORD.GRANTS, payload: { type: EFFECT_TYPES.BONUS_DROP, itemId: 'x', quantity: 1 } }
        ] }] } } }).stars;
        const out = hallRulesOf(star, { s: 1 });
        expect(out.modifiers).toHaveLength(1);
        expect(out.modifiers[0]).toMatchObject({ type: EFFECT_TYPES.XP_BONUS, value: 0.1, target: { category: 'mining' } });
        expect(out.aimed).toHaveLength(1);
        expect(out.aimed[0].to).toEqual({ mode: 'tag', value: 'Ore' });
        expect(out.ignored.map(i => i.reason)).toEqual(['triggered', 'a filter that reads live state', 'not a Provides']);
        expect(hallRulesOf(star, {}).modifiers).toEqual([]);
    });
});

describe('the retired Compass: an old save drops its ranks and loads', () => {
    it('drops Token Cap, Cartography Table and Notice Board ranks, and keeps the rest', () => {
        const old = { progress: { guildUpgrades: { roster_size: 2, token_cap: 4, cartography_slots: 2, notice_board: 3, bank_tabs: 1 } } };
        const loaded = migrateState(old, GAME_VERSION);
        expect(loaded.progress.guildUpgrades).toEqual({ roster_size: 2, bank_tabs: 1 });
        expect(BUILT_IN_UPGRADE_IDS).toEqual(['bank_tabs', 'roster_size', 'wishing_well']);
        expect(CONSTELLATIONS.map(c => c.id)).not.toContain('compass');
    });
});

describe('a star in words, and the audit', () => {
    it('reads each rank as its rules and lines, at whole-guild reach', () => {
        const star = (id) => authoredStars().find(s => s.id === id);
        expect(describeStarRank(star('m_xp'), 1)).toBe('Makes every Token on the board award 100% more XP, but only for Mining work.');
        expect(describeStarRank(star('m_rest'), 1)).toBe('Makes every H1 Vein on the board grow and refill 50% faster.');
        expect(describeStarRank(star('w_ore'), 2)).toBe('25 Fixture Copper Ore a lap');
        expect(describeStarRank(star('h_infirmary'), 1)).toBe('Makes every hero recover from a wound 40% faster.');
        expect(describeStarRank(star('h_food'), 1)).toBe('Provides every hero 1 more Food slot.');
        expect(getUpgradeDef('m_xp').statLabel(0)).toBe('Not yet bought');
        expect(getUpgradeDef('m_xp').nextStatLabel(1)).toContain('200% more XP');
    });

    it('finds nothing wrong with the QA fixture sky, and in the test sky only its retired Camp Reach star, to delete', () => {
        expect(hallStarFindings({ sky: qaHallSky(), items: ITEMS, tokens: TOKENS })).toEqual([]);
        expect(hallStarFindings({ sky: testSky(), items: ITEMS, tokens: TOKENS }).map(f => `${f.entityId}: ${f.message}`)).toEqual([
            'm_camp: carries only Camp Reach rules, retired: every camp works the one standard reach, so the star gives nothing. Delete the star in the CMS.'
        ]);
    });

    it('names a retired rule beside live ones by itself, and never calls a ring star first rank empty', () => {
        const findings = hallStarFindings({
            sky: { stars: {
                mixed: { id: 'mixed', constellation: 'well', links: [HALL_NODE], ranks: [{ price: ore(5), rules: [
                    provides(EFFECT_TYPES.XP_BONUS, 0.1, { category: 'mining' }),
                    provides(EFFECT_TYPES.CAMP_REACH, 0.5, { to: { mode: 'id', value: CAMP } })
                ] }] },
                ring: { id: 'ring', constellation: 'well', links: [HALL_NODE], opensRing: 2, ranks: [{ price: ore(5) }, { price: ore(5) }] }
            } },
            items: ITEMS, tokens: TOKENS
        }).map(f => `${f.entityId}: ${f.message}`);
        expect(findings).toEqual([
            'mixed: rank 1 has a Camp Reach rule, retired: every camp works the one standard reach, so the rule does nothing. Delete the rule in the CMS.',
            'ring: rank 2 gives nothing: no rule and no Passive Production line.'
        ]);
    });

    it('names a star that cannot open, costs a missing item, or takes a built-in id', () => {
        const findings = hallStarFindings({
            sky: { stars: {
                lonely: { id: 'lonely', constellation: 'nowhere', ranks: [{ price: [{ itemId: 'no_such_item', quantity: 1 }], rules: [provides(EFFECT_TYPES.XP_BONUS, 0.1)] }] },
                bank_tabs: { id: 'bank_tabs', links: [HALL_NODE], ranks: [{ rules: [provides(EFFECT_TYPES.XP_BONUS, 0.1)] }] },
                dangling: { id: 'dangling', constellation: 'well', links: ['ghost'], ranks: [{}] }
            } },
            items: ITEMS, tokens: TOKENS
        }).map(f => `${f.entityId}: ${f.message}`);
        expect(findings.some(f => f.startsWith('lonely: names the constellation "nowhere"'))).toBe(true);
        expect(findings.some(f => f.startsWith('lonely: is linked to nothing'))).toBe(true);
        expect(findings.some(f => f.includes('"no_such_item", which does not exist'))).toBe(true);
        expect(findings.some(f => f.startsWith('bank_tabs: takes the id of a built-in'))).toBe(true);
        expect(findings.some(f => f.startsWith('dangling: is linked to "ghost"'))).toBe(true);
        expect(findings.some(f => f.startsWith('dangling: rank 1 gives nothing'))).toBe(true);
    });
});

describe('with no authored sky', () => {
    it('holds only the built-in tracks, and the data file is absent today', () => {
        setHallSky(null);
        expect(GUILD_UPGRADES.map(u => u.id)).toEqual(['bank_tabs', 'roster_size', 'wishing_well']);
        expect(CONSTELLATIONS.map(c => c.id)).toEqual(['hearth', 'vault', 'well']);
        expect(authoredStars()).toEqual([]);
    });
});
