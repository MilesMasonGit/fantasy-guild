import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as Flags from '../systems/board/Flags.js';
import * as Orders from '../systems/board/Orders.js';
import * as Summons from '../systems/board/Summons.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as TriggerSystem from '../systems/board/TriggerSystem.js';
import * as StationRecipe from '../systems/board/StationRecipe.js';
import * as HeroEffects from '../systems/hero/HeroEffects.js';
import * as SkillSystem from '../systems/hero/SkillSystem.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import * as EquipmentManager from '../systems/equipment/EquipmentManager.js';
import { earnedPerks } from '../systems/hero/HeroPerks.js';
import { guildSkillLevel } from '../systems/world/Settling.js';
import { isSummoned } from '../systems/hero/summoned.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import { validateSaveData } from '../state/StateSchema.js';
import { loadSavedState } from '../systems/core/LoadedState.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { registerRecipePools } from '../config/registries/recipePoolRegistry.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { xpForLevel } from '../utils/XPCurve.js';
import { t } from '../i18n/index.js';
import { resetMatTuning, setMatTuning } from '../config/matTuning.js';
import { placeAt, clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * Summoned workers (brief 810 K5): a Summoning Circle's finished cycle calls or charges its one
 * Summoned worker, who is ordered like a hero, holds only its own skills at fixed levels, never
 * gains XP, carries one trait, never fights, spends a charge a cycle and leaves at none. Every
 * Token, item, effect and recipe here is a fixture: the summons themselves are content.
 */

const provides = (id, payload) => ({ id, keyword: KEYWORD.PROVIDES, payload, to: { mode: 'all', value: '' }, reach: 'nearby' });

registerItems({
    k5_drop: { id: 'k5_drop', name: 'Slime Gel', type: 'material', stackable: true, sprite: 'i_bones' },
    k5_mote: { id: 'k5_mote', name: 'Earth Mote', type: 'material', stackable: true, sprite: 'i_bones' },
    k5_ore: { id: 'k5_ore', name: 'Fixture Ore', type: 'material', stackable: true, sprite: 'i_bones' },
    k5_pick: { id: 'k5_pick', name: 'Fixture Deep Pickaxe', type: 'tool', equipSlot: 'hand', sprite: 'i_bones', tool: { kind: 'pickaxe', tier: 3 } }
});

registerEffects({
    k5_rich_seams: {
        id: 'k5_rich_seams', name: 'Rich Seams',
        statements: [provides('stm_k5_rich_seams', { type: EFFECT_TYPES.YIELD, bucket: 'percentage', value: 0.5, category: 'mining' })]
    }
});

const mining = (skillRequired) => ({
    skill: 'mining', skillRequired, cycleTimeMs: 1000, xp: 5, inputs: [],
    outputs: [{ itemId: 'k5_ore', chance: 100, minQty: 2, maxQty: 2 }]
});

registerTokenTypes({
    k5_slime: {
        id: 'k5_slime', name: 'Fixture Slime', tokenType: 'enemy', rarity: 'common', theme: 'fixture',
        uses: 5, sprite: 's_occult', enemy: { level: 1, style: 'melee' },
        config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
    },
    /** A Summoned worker's kind: Mining 30, and a trait that widens what it mines. */
    k5_summoned_slime: {
        id: 'k5_summoned_slime', name: 'Summoned Fixture Slime', rarity: 'common', theme: 'fixture', sprite: 's_occult',
        summon: { of: 'k5_slime', skills: { mining: 30 }, trait: { effectId: 'k5_rich_seams', scale: 1 } }
    },
    /** A second kind, called from level 20. */
    k5_summoned_digger: {
        id: 'k5_summoned_digger', name: 'Summoned Fixture Digger', rarity: 'common', theme: 'fixture', sprite: 's_occult',
        summon: { of: 'k5_slime', skills: { mining: 40 } }
    },
    /** A Summoning Circle: 3 charges a cycle, and one more for every 10 Summoning levels. */
    k5_circle: {
        id: 'k5_circle', name: 'Fixture Summoning Circle', tokenType: 'station', rarity: 'rare', theme: 'fixture',
        uses: null, sprite: 's_occult', summonCircle: { charges: 3, perLevel: 0.1 },
        config: { skill: 'summoning', skillRequired: 1, cycleTimeMs: 2000, xp: 0, inputs: [], outputs: [] },
        statements: [{ id: 'stm_k5_circle_station', keyword: KEYWORD.STATION, payload: { skill: 'summoning' } }]
    },
    /** A vein a pickaxe is needed for, at Mining 20. */
    k5_vein: {
        id: 'k5_vein', name: 'Fixture Deep Vein', tokenType: 'resource', rarity: 'common', theme: 'fixture',
        uses: null, sprite: 's_industry', needsTool: { kind: 'pickaxe', minTier: 3 }, config: mining(20)
    },
    k5_tree: {
        id: 'k5_tree', name: 'Fixture Tree', tokenType: 'resource', rarity: 'common', theme: 'fixture',
        uses: null, sprite: 's_nature',
        config: { skill: 'forestry', skillRequired: 1, cycleTimeMs: 1000, xp: 1, inputs: [], outputs: [{ itemId: 'fixture_oak_wood', chance: 100, minQty: 1, maxQty: 1 }] }
    }
});

registerRecipePools({
    summoning: [
        {
            id: 'recipe_k5_slime', name: 'Summoned Fixture Slime', skill: 'summoning', levelRequirement: 1, requiresContext: [],
            inputs: [{ itemId: 'k5_drop', quantity: 1 }, { itemId: 'k5_mote', quantity: 1 }],
            outputs: [{ tokenId: 'k5_summoned_slime', chance: 100, minQty: 1, maxQty: 1 }],
            durationMs: 2000, xp: 7
        },
        {
            id: 'recipe_k5_digger', name: 'Summoned Fixture Digger', skill: 'summoning', levelRequirement: 20, requiresContext: [],
            inputs: [{ itemId: 'k5_mote', quantity: 1 }],
            outputs: [{ tokenId: 'k5_summoned_digger', chance: 100, minQty: 1, maxQty: 1 }],
            durationMs: 2000, xp: 7
        }
    ]
});

const CIRCLE = { x: 400, y: 400 };
const VEIN = { x: 900, y: 400 };
const TREE = { x: 900, y: 800 };
const SLIME = { x: 1300, y: 800 };

/** A hero at `level` in every skill, on the roster. */
function hero(id, level = 1) {
    const h = generateHero({ name: id });
    h.id = id;
    h.name = id;
    h.status = 'idle';
    for (const s of Object.values(h.skills)) {
        s.level = level;
        s.xp = xpForLevel(level);
    }
    GameState.state.heroes.push(h);
    HeroManager.rehydrateHero(h);
    return h;
}

/** Put the deep pickaxe in `heroId`'s hands, from the Bank. */
function holdPick(heroId) {
    InventoryManager.addItem('k5_pick', 1);
    expect(EquipmentManager.equipItem(heroId, 'k5_pick').success).toBe(true);
}

const run = (ms, step = 100) => { for (let t = 0; t < ms; t += step) BoardRunner.tick(step); };
const summoned = () => GameState.state.heroes.filter(isSummoned);
const oreOnMat = () => SpriteLayer.getSprites().filter(s => s.refId === 'k5_ore').reduce((n, s) => n + (s.quantity || 0), 0);

let circle;

/** The Circle set to call `recipeId`, its hero `summoner` on it, and stock for `cycles` calls in the Bank. */
function circleAt(recipeId = 'recipe_k5_slime', cycles = 3) {
    circle = placeAt('k5_circle', CIRCLE.x, CIRCLE.y);
    StationRecipe.setSelectedRecipe(circle, recipeId);
    InventoryManager.addItem('k5_drop', cycles);
    InventoryManager.addItem('k5_mote', cycles);
    Orders.orderAt('summoner', CIRCLE);
    return circle;
}

/** Run the Circle once, then take its hero home: one Summoned worker stands beside it. */
function callOne(recipeId) {
    circleAt(recipeId);
    run(2000);
    Orders.sendHome('summoner');
    run(100);
    const [s] = summoned();
    return s;
}

beforeAll(() => {
    Flags.init();
    BoardCombat.init();
    Summons.init();
});
afterAll(() => {
    Flags.teardown();
    Summons.teardown();
    resetMatTuning();
});

beforeEach(() => {
    vi.clearAllMocks();
    resetMatTuning();
    setMatTuning('potterRadius', 0);
    GameState.initNew();
    GameState.state.progress.rosterLimit = 3;
    GameState.state.inventory.maxSlots = 50;
    InventoryManager.init();
    SpriteLayer.init();
    LootSystem.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    clearMat();
    TriggerSystem.init();
    hero('summoner', 10);
});

afterEach(() => {
    vi.restoreAllMocks();
    TriggerSystem.teardown();
});

describe('⭐ a Summoning Circle calls and charges its one Summoned worker', () => {
    it('a finished cycle calls a Summoned worker beside the Circle, charged by its hero\'s Summoning level, spending the recipe', () => {
        circleAt();
        run(2000);
        const [s] = summoned();
        expect(s).toBeTruthy();
        expect(s.name).toBe('Summoned Fixture Slime');
        expect(s.summon).toMatchObject({ typeId: 'k5_summoned_slime', circleId: circle.id, charges: 4 });
        // Only its own skill, at its fixed level.
        expect(Object.keys(s.skills)).toEqual(['mining']);
        expect(s.skills.mining.level).toBe(30);
        // Standing idle beside the Circle, ordered like a hero: a spot order of its own.
        const flag = BoardState.flagOf(s.id);
        expect(Flags.isSpot(flag)).toBe(true);
        expect(Math.hypot(flag.x - CIRCLE.x, flag.y - CIRCLE.y)).toBeLessThan(400);
        expect(Summons.summonOfCircle(circle.id)?.id).toBe(s.id);
        // The recipe's drops and Mote were spent, and its hero learnt from it.
        expect(InventoryManager.getItemCount('k5_drop')).toBe(2);
        expect(InventoryManager.getItemCount('k5_mote')).toBe(2);
        expect(GameState.state.heroes.find(h => h.id === 'summoner').skills.summoning.xp).toBeGreaterThan(xpForLevel(10));
    });

    it('the next cycle adds charges to the same Summoned worker rather than calling a second', () => {
        circleAt();
        run(4000);
        expect(summoned()).toHaveLength(1);
        expect(summoned()[0].summon.charges).toBe(8);
    });

    it('a Circle\'s charges grow with its hero\'s Summoning level', () => {
        GameState.state.heroes.find(h => h.id === 'summoner').skills.summoning = { level: 40, xp: xpForLevel(40) };
        circleAt();
        run(2000);
        expect(summoned()[0].summon.charges).toBe(7);
    });

    it('a summon is called only from the level its recipe asks: Summoning decides which a hero can call', () => {
        circleAt('recipe_k5_digger');
        // At Summoning 10 the Circle set to a level 20 summon refuses its hero, as any recipe's level does.
        expect(BoardState.flagOf('summoner')).toBeNull();
        run(4000);
        expect(summoned()).toHaveLength(0);
        GameState.state.heroes.find(h => h.id === 'summoner').skills.summoning = { level: 20, xp: xpForLevel(20) };
        expect(Orders.orderAt('summoner', CIRCLE).success).toBe(true);
        run(2100);
        expect(summoned().map(s => s.summon.typeId)).toEqual(['k5_summoned_digger']);
    });
});

describe('⭐ a Summoned worker is ordered like a hero, works only, and leaves at no charges', () => {
    it('works a vein its skill reaches, with no tool in hand, one charge a cycle, and never gains XP', () => {
        const s = callOne();
        const xp = s.skills.mining.xp;
        const vein = placeAt('k5_vein', VEIN.x, VEIN.y);
        expect(Orders.orderAt(s.id, VEIN).success).toBe(true);
        run(1000);
        expect(BoardState.workTokenOf(s.id)).toBe(vein.id);
        expect(s.summon.charges).toBe(3);
        run(1000);
        expect(s.summon.charges).toBe(2);
        expect(s.skills.mining.xp).toBe(xp);
        expect(oreOnMat()).toBeGreaterThanOrEqual(4);
    });

    it('is refused an enemy and work outside its own skills, with words that say why', () => {
        const s = callOne();
        placeAt('k5_slime', SLIME.x, SLIME.y);
        placeAt('k5_tree', TREE.x, TREE.y);
        const atEnemy = Orders.orderAt(s.id, SLIME);
        expect(atEnemy.success).toBe(false);
        expect(atEnemy.reason).toBe(t('orders.summonNeverFights'));
        const atTree = Orders.orderAt(s.id, TREE);
        expect(atTree.success).toBe(false);
        expect(atTree.reason).toBe(t('orders.summonWorksOnly', { skills: 'Mining' }));
        expect(Flags.canFight(s.id)).toBe(false);
        // A hero is still sent at both.
        expect(Orders.orderAt('summoner', SLIME).success).toBe(true);
    });

    it('leaves the mat when its last charge is spent mid-work: its Token is free for the next hero at once', () => {
        const s = callOne();
        s.summon.charges = 2;
        const vein = placeAt('k5_vein', VEIN.x, VEIN.y);
        Orders.orderAt(s.id, VEIN);
        const left = [];
        const off = EventBus.subscribe(BOARD_EVENTS.SUMMON_CHANGED, (p) => { if (p.change === 'left') left.push(p); });
        run(1000);
        expect(summoned()).toHaveLength(1);
        run(1000);
        off();
        expect(summoned()).toHaveLength(0);
        expect(left).toEqual([expect.objectContaining({ heroId: s.id, typeId: 'k5_summoned_slime', reason: 'spent' })]);
        expect(BoardState.flagOf(s.id)).toBeNull();
        expect(BoardState.heroBodyOf(s.id)).toBeFalsy();
        expect(BoardState.claimOfHero(s.id)).toBeFalsy();
        expect(BoardState.workerOf(vein.id)).toBeNull();
        expect(BoardState.savedWorkClaims().map(([id]) => id)).not.toContain(s.id);
        // Both cycles it paid for landed, each widened by its trait (2 ore and half again).
        expect(oreOnMat()).toBe(6);
        // Nothing is left that names it, so the next ticks run clean and a hero takes the vein.
        expect(() => run(500)).not.toThrow();
        hero('miner', 30);
        holdPick('miner');
        expect(Orders.orderAt('miner', VEIN).success).toBe(true);
        run(1000);
        expect(BoardState.workTokenOf('miner')).toBe(vein.id);
    });
});

describe('⭐ one summon per Circle', () => {
    it('picking another summon on the Circle warns first, then dismisses the old one at once, mid-work', () => {
        GameState.state.heroes.find(h => h.id === 'summoner').skills.summoning = { level: 20, xp: xpForLevel(20) };
        const s = callOne();
        const vein = placeAt('k5_vein', VEIN.x, VEIN.y);
        Orders.orderAt(s.id, VEIN);
        run(500);
        expect(vein.cycleElapsedMs).toBeGreaterThan(0);

        expect(Summons.dismissWarning(circle, 'recipe_k5_slime')).toBeNull();
        expect(Summons.dismissWarning(circle, 'recipe_k5_digger')).toEqual({ heroId: s.id, name: 'Summoned Fixture Slime', charges: s.summon.charges });

        expect(StationRecipe.setSelectedRecipe(circle, 'recipe_k5_digger')).toBe(true);
        expect(summoned()).toHaveLength(0);
        expect(vein.cycleElapsedMs).toBe(0);
        expect(BoardState.workerOf(vein.id)).toBeNull();

        // The Circle's next cycle calls the new kind.
        Orders.orderAt('summoner', CIRCLE);
        run(2100);
        expect(summoned().map(x => x.summon.typeId)).toEqual(['k5_summoned_digger']);
        expect(Summons.dismissWarning(circle, 'recipe_k5_digger')).toBeNull();
    });

    it('a Circle with no Summoned worker standing warns of nothing', () => {
        circleAt();
        expect(Summons.dismissWarning(circle, 'recipe_k5_digger')).toBeNull();
    });
});

describe('⭐ its trait, and nothing a hero has', () => {
    it('its trait reaches the Token it works, as a hero\'s carried rules do; a hero there gets none of it', () => {
        const s = callOne();
        const vein = placeAt('k5_vein', VEIN.x, VEIN.y);
        Orders.orderAt(s.id, VEIN);
        run(100);
        expect(TileModifiers.resolveAxis(vein.id, EFFECT_TYPES.YIELD, 10, 'mining')).toBe(15);
        Orders.sendHome(s.id);
        hero('miner', 30);
        holdPick('miner');
        expect(Orders.orderAt('miner', VEIN).success).toBe(true);
        run(100);
        expect(BoardState.workTokenOf('miner')).toBe(vein.id);
        expect(TileModifiers.resolveAxis(vein.id, EFFECT_TYPES.YIELD, 10, 'mining')).toBe(10);
    });

    it('holds no milestone perks at its fixed level, only its one trait', () => {
        const s = callOne();
        expect(earnedPerks(s)).toEqual([]);
        const statements = HeroEffects.loadoutStatements(s);
        expect(statements.map(st => st.id)).toEqual(['stm_k5_rich_seams']);
    });

    it('never gains XP, wears nothing, and is no hero of the guild: not counted on the roster or in its best levels', () => {
        const s = callOne();
        const before = s.skills.mining.xp;
        expect(SkillSystem.addXP(s.id, 'mining', 500).success).toBe(false);
        expect(SkillSystem.giveXpInEverySkill(s.id, 500)).toBeNull();
        expect(s.skills.mining.xp).toBe(before);
        expect(EquipmentManager.equipItem(s.id, 'k5_ore').success).toBe(false);
        // A roster of 3 holding one hero and one Summoned worker has room for two more heroes.
        expect(HeroManager.isRosterFull()).toBe(false);
        hero('second', 1);
        expect(HeroManager.isRosterFull()).toBe(false);
        // Settling asks the heroes' best level: the Summoned worker's Mining 30 is not the guild's.
        expect(guildSkillLevel('mining')).toBe(10);
    });
});

describe('⭐ save and load', () => {
    function saveAndReload() {
        const saved = JSON.parse(GameState.serializeJson());
        const migrated = migrateState(saved.state, saved.version);
        expect(validateSaveData({ version: saved.version, state: migrated })).toMatchObject({ valid: true });
        loadSavedState(migrated);
        EventBus.publish(ENGINE_EVENTS.GAME_LOADED, { slot: 0 });
    }

    it('a Summoned worker at work comes back as it was: its charges, its skills, its trait, its work, its Circle', () => {
        const s = callOne();
        const id = s.id;
        s.summon.charges = 3;
        const vein = placeAt('k5_vein', VEIN.x, VEIN.y);
        Orders.orderAt(id, VEIN);
        run(500);

        saveAndReload();

        const back = GameState.state.heroes.find(h => h.id === id);
        expect(isSummoned(back)).toBe(true);
        expect(back.summon).toEqual({ typeId: 'k5_summoned_slime', circleId: circle.id, charges: 3 });
        expect(Object.keys(back.skills)).toEqual(['mining']);
        expect(back.skills.mining.level).toBe(30);
        expect(BoardState.workTokenOf(id)).toBe(vein.id);
        run(100);
        expect(TileModifiers.resolveAxis(vein.id, EFFECT_TYPES.YIELD, 10, 'mining')).toBe(15);
        expect(Summons.summonOfCircle(circle.id)?.id).toBe(id);
        // It works on, and leaves at no charges, as before.
        run(3000);
        expect(summoned()).toHaveLength(0);
        expect(BoardState.flagOf(id)).toBeNull();
    });

    it('its skills and trait follow the content on load, never the save', () => {
        const s = callOne();
        s.skills.mining = { level: 99, xp: xpForLevel(99) };
        s.skills.melee = { level: 50, xp: xpForLevel(50) };
        saveAndReload();
        const back = GameState.state.heroes.find(h => h.id === s.id);
        expect(back.skills).toEqual({ mining: { level: 30, xp: xpForLevel(30) } });
    });
});
