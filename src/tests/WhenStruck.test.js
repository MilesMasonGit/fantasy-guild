import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as Orders from '../systems/board/Orders.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as FightMoments from '../systems/board/FightMoments.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as TriggerSystem from '../systems/board/TriggerSystem.js';
import * as Flags from '../systems/board/Flags.js';
import * as LiveEffects from '../systems/effects/LiveEffects.js';
import * as EquipmentManager from '../systems/equipment/EquipmentManager.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import { SIDE } from '../systems/combat/FightHooks.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { ROLE } from '../config/registries/roleRegistry.js';
import { FIGHT_MOMENT, getTriggerEvent, isFightMoment } from '../config/registries/triggerRegistry.js';
import { KEYWORD, makeStatement } from '../systems/effects/statements.js';
import { renderStatement } from '../systems/effects/statementText.js';
import { slotsOf, costSlots } from '../../cms/src/engine/ledger/statementSlots.js';
import { checkTargets } from '../../cms/schemaCheck.js';
import { registerStatusFixtures, BURN } from './fixtures/statusEffects.js';

/**
 * When Struck: the fight moment of the side a hit lands ON. The side carrying the rule reacts once
 * the other side's hit has landed and both still stand: an enemy's thorns prick the hero who strikes
 * it, and a hero's armour can strike back at the enemy the same way. A chance on it is drawn in
 * authored order, beside the other rules on the moment.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/** A rule on a fight moment, as the CMS writes one. */
const rule = (id, keyword, when, target, payload) => ({
    ...makeStatement(keyword), id, when: { scope: 'self', ...when }, target, payload
});

const STRUCK = FIGHT_MOMENT.STRUCK;
const PRICK = rule('stm_ws_prick', KEYWORD.DEALS, { event: STRUCK }, { role: ROLE.ACTOR }, { amount: 1 });

registerEffects({
    ws_thorns: { id: 'ws_thorns', name: 'Thorns', statements: [PRICK] },
    ws_thorns_10: {
        id: 'ws_thorns_10', name: 'Thorns',
        statements: [rule('stm_ws_prick_10', KEYWORD.DEALS, { event: STRUCK }, { role: ROLE.ACTOR }, { amount: 1, chance: 10 })]
    },
    // A stray count left from an On Hit the author switched away from: When Struck has none.
    ws_thorns_stray_every: {
        id: 'ws_thorns_stray_every', name: 'Thorns',
        statements: [rule('stm_ws_prick_every', KEYWORD.DEALS, { event: STRUCK, every: 3 }, { role: ROLE.ACTOR }, { amount: 1 })]
    },
    ws_slay: {
        id: 'ws_slay', name: 'Slayer',
        statements: [rule('stm_ws_slay', KEYWORD.DEALS, { event: FIGHT_MOMENT.HIT }, { role: ROLE.OPPONENT }, { amount: 1000 })]
    },
    ws_spikes: {
        id: 'ws_spikes', name: 'Spikes',
        statements: [rule('stm_ws_spikes', KEYWORD.DEALS, { event: STRUCK }, { role: ROLE.OPPONENT }, { amount: 2 })]
    },
    ws_burn_then_prick: {
        id: 'ws_burn_then_prick', name: 'Bramble',
        statements: [
            rule('stm_ws_burn', KEYWORD.APPLIES, { event: STRUCK }, { role: ROLE.ACTOR }, { effectId: BURN, scale: 1, chance: 50 }),
            rule('stm_ws_prick_50', KEYWORD.DEALS, { event: STRUCK }, { role: ROLE.ACTOR }, { amount: 1, chance: 50 })
        ]
    }
});

const enemyType = (id, effects, enemy = {}, extra = {}) => ({
    id, name: id, tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: 50, sprite: 's_occult',
    enemy: { level: 1, style: 'magic', hp: 500, hit: 2, ...enemy },
    config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] },
    effects: effects.map(effectId => ({ effectId, scale: 1 })),
    ...extra
});

registerTokenTypes({
    ws_thorny: enemyType('ws_thorny', ['ws_thorns']),
    ws_thorny_10: enemyType('ws_thorny_10', ['ws_thorns_10']),
    ws_thorny_stray: enemyType('ws_thorny_stray', ['ws_thorns_stray_every']),
    ws_bramble: enemyType('ws_bramble', ['ws_burn_then_prick']),
    ws_thorny_frail: enemyType('ws_thorny_frail', ['ws_thorns'], { hp: 10 }, { uses: 1 }),
    ws_dummy: enemyType('ws_dummy', [])
});

registerItems({
    ws_slayer: {
        id: 'ws_slayer', name: 'Slayer Sword', type: 'weapon', equipSlot: 'hand', styles: ['melee'], damage: 2, stackable: true,
        effects: [{ effectId: 'ws_slay', scale: 1 }]
    },
    ws_spiked_plate: {
        id: 'ws_spiked_plate', name: 'Spiked Plate', type: 'armor', equipSlot: 'chest', stackable: true,
        effects: [{ effectId: 'ws_spikes', scale: 1 }]
    }
});

const AT = { x: 400, y: 300 };

function startFight(typeId) {
    const hero = generateHero({ name: 'Bram' });
    hero.id = 'ws_hero';
    hero.status = 'idle';
    hero.skills.melee = { level: 99, xp: 0 };
    hero.hp = { current: 400, max: 400 };
    GameState.state.heroes.push(hero);
    const enemy = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeTokenAt(enemy, AT);
    TileModifiers.rebuildAround([enemy]);
    Orders.orderAt(hero.id, AT);
    return { hero, enemy };
}

/** Run the board and the Rules tick together, as the game loop does, recording the fight. */
function play(ms, enemy = null) {
    const seen = { heroHits: [], enemyHits: [], fired: [], applied: [] };
    const offs = [
        EventBus.subscribe(ENGINE_EVENTS.COMBAT_HERO_ATTACK, (p) => { if (p.hit) seen.heroHits.push(p); }),
        EventBus.subscribe(ENGINE_EVENTS.COMBAT_ENEMY_ATTACK, (p) => { if (p.hit) seen.enemyHits.push(p); }),
        EventBus.subscribe(BOARD_EVENTS.EFFECT_FIRED, (p) => seen.fired.push(p.title)),
        EventBus.subscribe(ENGINE_EVENTS.STATUS_APPLIED, (p) => seen.applied.push(`${p.targetType}:${p.statusId}`))
    ];
    for (let t = 0; t < ms; t += 100) {
        if (enemy && !BoardState.getTokenById(enemy.id)) break;
        LiveEffects.tick(100, TriggerSystem.fireLiveStatement);
        BoardRunner.tick(100);
    }
    offs.forEach(off => off());
    return seen;
}

const named = (seen, title) => seen.fired.filter(t => t === title).length;

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    LootSystem.init();
    BoardCombat.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    TriggerSystem.init();
    Flags.init();
    registerStatusFixtures();
    LiveEffects.resetClock();
});

afterEach(() => {
    TriggerSystem.teardown();
    Flags.teardown();
    vi.restoreAllMocks();
});

describe('the moment', () => {
    it('is a fight moment beside On Swing, On Hit and On Health Below, with the same verbs and roles', () => {
        const struck = getTriggerEvent(STRUCK);
        const hit = getTriggerEvent(FIGHT_MOMENT.HIT);
        expect(struck).toMatchObject({ label: 'When Struck', event: null, fightMoment: true });
        expect(isFightMoment(STRUCK)).toBe(true);
        expect(struck.keywords).toEqual(hit.keywords);
        expect(struck.roles).toEqual(hit.roles);
        expect(struck.scopes).toEqual(hit.scopes);
        // No count of its own: it fires on every hit that lands on its side.
        expect(struck.countNoun).toBeUndefined();
    });
});

describe('an enemy\'s thorns', () => {
    beforeEach(() => {
        // Every swing hits and none crits, so the counts below are exact.
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
    });

    it('prick the hero once for every hit of theirs that lands and leaves both standing', () => {
        const { hero } = startFight('ws_thorny');
        const start = hero.hp.current;
        const seen = play(30000);

        expect(seen.heroHits.length).toBeGreaterThan(3);
        expect(named(seen, 'Thorns')).toBe(seen.heroHits.length);
        const struckBy = seen.enemyHits.reduce((sum, p) => sum + p.damage, 0);
        expect(start - HeroManager.getHero(hero.id).hp.current).toBe(struckBy + seen.heroHits.length);
    });

    it('⚠️ never on the enemy\'s own hits: the struck side reacts, not the striker', () => {
        const { hero } = startFight('ws_thorny');
        // Hold the hero's swings back: only the enemy swings, and nothing pricks.
        const fight = () => BoardCombat.fightOfHero(hero.id);
        const seen = { heroHits: [], enemyHits: [], fired: [] };
        const offs = [
            EventBus.subscribe(ENGINE_EVENTS.COMBAT_ENEMY_ATTACK, (p) => { if (p.hit) seen.enemyHits.push(p); }),
            EventBus.subscribe(BOARD_EVENTS.EFFECT_FIRED, (p) => seen.fired.push(p.title))
        ];
        for (let t = 0; t < 20000; t += 100) {
            const f = fight();
            if (f?.combat) f.combat.heroTickProcesses[hero.id] = -1e9;
            BoardRunner.tick(100);
        }
        offs.forEach(off => off());
        expect(seen.enemyHits.length).toBeGreaterThan(2);
        expect(named(seen, 'Thorns')).toBe(0);
    });

    it('not on the hit that ends the fight', () => {
        // Ten health and the hero hits for 5: the first hit pricks, the killing one does not.
        const { enemy } = startFight('ws_thorny_frail');
        const seen = play(30000, enemy);
        const killing = seen.heroHits.filter(p => p.enemyHpRemaining === 0);
        expect(killing).toHaveLength(1);
        expect(seen.heroHits.length).toBeGreaterThan(1);
        expect(named(seen, 'Thorns')).toBe(seen.heroHits.length - 1);
    });

    it('not when the hit\'s own On Hit rules end the fight: they run first', () => {
        // A sword whose every hit deals 1000 more: the enemy falls to the hit's rule, then nothing pricks.
        const { hero, enemy } = startFight('ws_thorny_frail');
        InventoryManager.addItem('ws_slayer', 1);
        expect(EquipmentManager.equipItem(hero.id, 'ws_slayer').success).toBe(true);
        const seen = play(30000, enemy);
        expect(seen.heroHits.length).toBe(1);
        expect(seen.heroHits[0].enemyHpRemaining).toBeGreaterThan(0);
        expect(named(seen, 'Slayer')).toBe(1);
        expect(named(seen, 'Thorns')).toBe(0);
    });

    it('a count left over from another moment is not read: When Struck fires on every hit', () => {
        startFight('ws_thorny_stray');
        const seen = play(30000);
        expect(seen.heroHits.length).toBeGreaterThan(3);
        expect(named(seen, 'Thorns')).toBe(seen.heroHits.length);
    });

    it('spend no charge of the enemy Token', () => {
        const { enemy } = startFight('ws_thorny');
        play(30000);
        expect(BoardState.getTokenById(enemy.id).usesRemaining).toBe(50);
    });
});

describe('a hero\'s armour can carry it', () => {
    beforeEach(() => {
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
    });

    it('strikes back at the enemy each time the enemy\'s hit lands on the hero, and never on the hero\'s own', () => {
        const { hero, enemy } = startFight('ws_dummy');
        InventoryManager.addItem('ws_spiked_plate', 1);
        expect(EquipmentManager.equipItem(hero.id, 'ws_spiked_plate').success).toBe(true);
        const seen = play(30000);

        expect(seen.enemyHits.length).toBeGreaterThan(3);
        expect(named(seen, 'Spikes')).toBe(seen.enemyHits.length);
        const fight = BoardCombat.getFight(enemy.id);
        const dealt = seen.heroHits.reduce((sum, p) => sum + p.damage, 0);
        expect(fight.combat.enemyHp.max - fight.combat.enemyHp.current).toBe(dealt + 2 * seen.enemyHits.length);
    });
});

describe('a chance on When Struck', () => {
    /** A live fight against `typeId`, engaged and not yet swinging. */
    function engaged(typeId) {
        const { hero, enemy } = startFight(typeId);
        BoardRunner.tick(100);
        const fight = BoardCombat.getFight(enemy.id);
        expect(fight?.combat).toBeTruthy();
        return { hero, fight };
    }

    it('draws in authored order, an Applies chance and a Deals chance alike', () => {
        const { hero, fight } = engaged('ws_bramble');
        const applied = [];
        const off = EventBus.subscribe(ENGINE_EVENTS.STATUS_APPLIED, (p) => applied.push(p.statusId));
        const hp = () => HeroManager.getHero(hero.id).hp.current;

        // First draw low, second high: the first rule (the burn) lands, the second (the prick) misses.
        const before = hp();
        vi.spyOn(Math, 'random').mockReturnValueOnce(0.1).mockReturnValueOnce(0.9).mockReturnValue(0.99);
        FightMoments.run(fight, SIDE.ENEMY, STRUCK, 1);
        expect(applied).toEqual([BURN]);
        expect(hp()).toBe(before);

        // Reversed: the burn misses, the prick lands.
        vi.restoreAllMocks();
        applied.length = 0;
        vi.spyOn(Math, 'random').mockReturnValueOnce(0.9).mockReturnValueOnce(0.1).mockReturnValue(0.99);
        FightMoments.run(fight, SIDE.ENEMY, STRUCK, 2);
        expect(applied).toEqual([]);
        expect(hp()).toBe(before - 1);
        off();
    });

    it('a missed roll does nothing and says nothing', () => {
        const { hero, fight } = engaged('ws_thorny_10');
        const fired = [];
        const off = EventBus.subscribe(BOARD_EVENTS.EFFECT_FIRED, (p) => fired.push(p.title));
        const before = HeroManager.getHero(hero.id).hp.current;
        vi.spyOn(Math, 'random').mockReturnValue(0.1);   // 10 is not below 10
        FightMoments.run(fight, SIDE.ENEMY, STRUCK, 1);
        expect(fired).toEqual([]);
        expect(HeroManager.getHero(hero.id).hp.current).toBe(before);
        vi.restoreAllMocks();
        vi.spyOn(Math, 'random').mockReturnValue(0.09);
        FightMoments.run(fight, SIDE.ENEMY, STRUCK, 2);
        expect(fired).toEqual(['Thorns']);
        expect(HeroManager.getHero(hero.id).hp.current).toBe(before - 1);
        off();
    });

    it('is drawn once per landed hit, and only for a rule that waits on it', () => {
        const { fight } = engaged('ws_thorny_10');
        const draws = vi.spyOn(Math, 'random').mockReturnValue(0.5);
        FightMoments.run(fight, SIDE.ENEMY, STRUCK, 1);
        expect(draws).toHaveBeenCalledTimes(1);
        FightMoments.run(fight, SIDE.ENEMY, FIGHT_MOMENT.HIT, 1);
        FightMoments.run(fight, SIDE.HERO, STRUCK, 1);
        expect(draws).toHaveBeenCalledTimes(1);
    });

    it('in a real fight at 10 % it pricks on some hits, not all', () => {
        const { hero } = startFight('ws_thorny_10');
        const seen = play(240000);
        const pricks = named(seen, 'Thorns');
        expect(seen.heroHits.length).toBeGreaterThan(30);
        expect(pricks).toBeGreaterThan(0);
        expect(pricks).toBeLessThan(seen.heroHits.length / 3);
        void hero;
    });
});

describe('the sentence and the CMS', () => {
    it('reads "When Struck: deals 1 damage to the hero", with its chance', () => {
        expect(renderStatement(PRICK)).toBe('When Struck: deals 1 damage to the hero.');
        expect(renderStatement({ ...PRICK, payload: { amount: 1, chance: 10 } }))
            .toBe('When Struck: deals 1 damage to the hero, 10% of the time.');
    });

    it('⭐ is authored in the CMS editor and read back by the game as written', () => {
        // Born as the Thorns case, then moved to When Struck through the moment slot.
        let statement = { ...makeStatement(KEYWORD.DEALS), id: 'stm_ws_cms' };
        const moment = slotsOf(statement).find(s => s.id === 'moment');
        expect(moment.options.find(o => o.id === STRUCK)?.label).toBe('When Struck');
        statement = { ...statement, ...moment.patch(STRUCK) };
        expect(statement.when).toMatchObject({ event: STRUCK, scope: 'self' });

        const slots = slotsOf(statement);
        // No count and no cooldown: When Struck fires on every hit that lands.
        expect(slots.map(s => s.id)).not.toContain('every');
        expect(slots.map(s => s.id)).not.toContain('cooldown');
        expect(slots.find(s => s.id === 'role').options.map(o => o.label)).toEqual(['itself', 'the hero', 'the enemy']);
        // A fight moment never spends a charge, so it offers none to set.
        expect(costSlots(statement)).toEqual([]);

        const chance = slots.find(s => s.id === 'chance');
        expect(chance).toMatchObject({ value: 100, min: 1, max: 100, optional: true });
        statement = { ...statement, ...chance.patch(10) };
        expect(statement.payload).toEqual({ amount: 1, chance: 10 });
        expect(renderStatement(statement)).toBe('When Struck: deals 1 damage to the hero, 10% of the time.');

        // The content schema the Sync and the packs are checked against takes it.
        const effects = { effect_ws_cms: { id: 'effect_ws_cms', name: 'Thorns', statements: [statement] } };
        expect(checkTargets([{ where: 'effects.json', schema: 'effects', value: effects }]).errors).toEqual([]);

        // And the game runs it as written: an enemy carrying it pricks on roughly one hit in ten.
        registerEffects({ effect_ws_cms: effects.effect_ws_cms });
        registerTokenTypes({ ws_cms_enemy: enemyType('ws_cms_enemy', ['effect_ws_cms']) });
        startFight('ws_cms_enemy');
        const seen = play(240000);
        expect(named(seen, 'Thorns')).toBeGreaterThan(0);
        expect(named(seen, 'Thorns')).toBeLessThan(seen.heroHits.length / 3);
    });
});
