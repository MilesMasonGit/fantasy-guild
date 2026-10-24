import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as EnemyMotion from '../systems/board/EnemyMotion.js';
import * as Flags from '../systems/board/Flags.js';
import * as FlagRules from '../systems/board/FlagRules.js';
import * as Guardians from '../systems/board/Guardians.js';
import * as Hostiles from '../systems/board/Hostiles.js';
import * as Shop from '../systems/board/Shop.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as TriggerSystem from '../systems/board/TriggerSystem.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as WorkCheck from '../systems/board/WorkCheck.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS, ALERT } from '../systems/board/boardEvents.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { isHostileEnemy, isBossEnemy } from '../config/registries/enemyProfile.js';
import { GUARDIAN_DEFAULTS, SUMMON_SHOP_SECTION } from '../config/registries/tokenConstants.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { KEYWORD, makeStatement } from '../systems/effects/statements.js';
import { PLACEMENT } from '../config/registries/placementRegistry.js';
import { placeAt, clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));
vi.mock('../systems/combat/DefeatPenalties.js', () => ({
    applyDefeatPenalties: vi.fn(() => [])
}));

/**
 * Encounters (brief 220, C5): every fight one-on-one; guardians that block their Token until beaten
 * and come back; node ambushes that attack the worker; bosses that never attack first, live in lairs
 * or are summoned, and meet each hero whole.
 */

const drops = [{ itemId: 'item_blackberry', chance: 100, minQty: 1, maxQty: 1 }];
const enemyConfig = { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: drops };

registerItems({
    enc_summon_horn: { id: 'enc_summon_horn', name: 'Summoning Horn', type: 'material', stackable: true, sprite: 'i_bones' }
});

registerTokenTypes({
    /** A level 2 enemy with many uses: a fight that lasts, and comes back after each kill. */
    enc_brute: {
        id: 'enc_brute', name: 'Encounter Brute', tokenType: 'enemy', rarity: 'common', theme: 'fixture',
        uses: 20, sprite: 's_occult', enemy: { level: 2, style: 'melee' }, config: enemyConfig
    },
    /** A quick one-kill enemy, peaceful. */
    enc_imp: {
        id: 'enc_imp', name: 'Encounter Imp', tokenType: 'enemy', rarity: 'common', theme: 'fixture',
        uses: 100, sprite: 's_occult', enemy: { level: 1, style: 'melee', budgetScale: 0.3 }, config: enemyConfig
    },
    /** A boss, authored hostile on purpose: a boss never attacks first all the same. */
    enc_boss: {
        id: 'enc_boss', name: 'Encounter Boss', tokenType: 'enemy', rarity: 'rare', theme: 'fixture',
        uses: 1, sprite: 's_occult', enemy: { level: 1, style: 'melee', budgetScale: 0.3, boss: true, hostile: true },
        config: enemyConfig,
        shop: { price: [{ itemId: 'enc_summon_horn', quantity: 1 }], section: SUMMON_SHOP_SECTION }
    },
    /** A rich node guarded by an Imp that comes back 5 s after it is beaten. */
    enc_guarded_vein: {
        id: 'enc_guarded_vein', name: 'Guarded Vein', tokenType: 'resource', rarity: 'common', theme: 'fixture',
        uses: null, sprite: 's_nature',
        guardian: { typeId: 'enc_imp', returnMs: 5000 },
        config: { skill: 'forestry', skillRequired: 1, cycleTimeMs: 1000, xp: 1, inputs: [], outputs: [{ itemId: 'fixture_oak_wood', quantity: 1, chance: 100 }] }
    },
    /** A lair: no work of its own, home of the boss (its default return). */
    enc_lair: {
        id: 'enc_lair', name: 'Encounter Lair', tokenType: 'resource', rarity: 'common', theme: 'fixture',
        uses: null, sprite: 's_nature', guardian: { typeId: 'enc_boss' }
    },
    /** A plain node, nothing guarding it. */
    enc_node: {
        id: 'enc_node', name: 'Encounter Node', tokenType: 'resource', rarity: 'common', theme: 'fixture',
        uses: null, sprite: 's_nature',
        config: { skill: 'forestry', skillRequired: 1, cycleTimeMs: 1000, xp: 1, inputs: [], outputs: [{ itemId: 'fixture_oak_wood', quantity: 1, chance: 100 }] }
    }
});

let nodeCount = 0;

/** A node gathered in 1 s cycles whose own cycle may spawn `typeId` (an ambush rule). */
function ambushNode(typeId, chance = 100) {
    nodeCount += 1;
    const id = `enc_ambush_node_${nodeCount}`;
    registerTokenTypes({
        [id]: {
            id, name: 'Ambush Node', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature',
            config: { skill: 'forestry', skillRequired: 1, cycleTimeMs: 1000, xp: 1, inputs: [], outputs: [{ itemId: 'fixture_oak_wood', quantity: 1, chance: 100 }] },
            statements: [{
                ...makeStatement(KEYWORD.SPAWNS),
                id: `stm_enc_ambush_${nodeCount}`,
                payload: { typeId, placement: PLACEMENT.NEAREST_FREE, chance },
                when: { event: 'SELF_CYCLE_COMPLETE', scope: 'self', cooldownMs: 0 },
                chargeDelta: 0
            }]
        }
    });
    return id;
}

const A = { x: 600, y: 500 };
const B = { x: 900, y: 500 };
const FAR = { x: 1600, y: 900 };

/** A hero who fights and gathers at level 50, with plenty of HP. */
function fighter(id, { level = 50, hp = 100 } = {}) {
    const hero = generateHero({ name: id });
    hero.id = id;
    hero.name = id;
    hero.status = 'idle';
    hero.hp = { current: hp, max: hp };
    hero.skills.melee = { level, xp: 0 };
    Object.values(hero.skills).forEach(s => { s.level = level; });
    return hero;
}

const run = (ms, step = 100) => { for (let t = 0; t < ms; t += step) BoardRunner.tick(step); };
const enemiesOf = (typeId) => BoardState.tokens().filter(t => t.typeId === typeId);
const heroOf = (id) => GameState.state.heroes.find(h => h.id === id);

/** Tick until `predicate()` holds, in 100 ms steps, at most `ms`. */
function until(predicate, ms = 120000) {
    for (let t = 0; t < ms; t += 100) {
        if (predicate()) return true;
        BoardRunner.tick(100);
    }
    return predicate();
}

beforeAll(() => {
    Flags.init();
    BoardCombat.init();
    Guardians.init();
});
afterAll(() => { Flags.teardown(); resetMatTuning(); });

beforeEach(() => {
    vi.clearAllMocks();
    resetMatTuning();
    setMatTuning('flagRadius', 400);
    setMatTuning('potterRadius', 0);
    setMatTuning('enemyPotterRadius', 0);
    GameState.initNew();
    GameState.state.progress.rosterLimit = 20;
    InventoryManager.init();
    SpriteLayer.init();
    LootSystem.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    clearMat();
    TriggerSystem.init();
    GameState.state.heroes = [fighter('h1'), fighter('h2')];
    GameState.state.inventory.maxSlots = 50;
});

afterEach(() => {
    vi.restoreAllMocks();
    TriggerSystem.teardown();
    EnemyMotion.setRandomForTests();
});

// ---------------------------------------------------------------------------

describe('⭐ every fight is one-on-one', () => {
    it('a second area flag at a busy enemy never joins or restarts the fight: it waits at its flag', () => {
        const brute = placeAt('enc_brute', A.x, A.y);
        Flags.plant('h1', A);
        run(100);
        const fight = BoardCombat.getFight(brute.id);
        expect(fight?.assignedHeroId).toBe('h1');

        Flags.plant('h2', { x: A.x + 40, y: A.y });
        let lowest = fight.combat.enemyHp.current;
        for (let i = 0; i < 100; i++) {
            run(100);
            const now = BoardCombat.getFight(brute.id);
            // The same fight, with the same hero, and the enemy never made whole by a newcomer.
            expect(now).toBe(fight);
            expect(now.assignedHeroId).toBe('h1');
            if (now.combat.state.intermissionTimer > 0) break;
            expect(now.combat.enemyHp.current).toBeLessThanOrEqual(lowest);
            lowest = now.combat.enemyHp.current;
        }
        expect(BoardCombat.fightOfHero('h2')).toBeNull();
        expect(Flags.skipsOf(brute.id)).toEqual([{ heroId: 'h2', reason: Flags.SKIP.CLAIMED }]);
        expect(Flags.statusOf('h2').state).toBe('idle');
        expect(Flags.waitingFor('h2')).toBe(brute.id);
        expect(Flags.waitingFor('h1')).toBeNull();
    });

    it('a second area flag with another enemy in reach fights that one instead', () => {
        const first = placeAt('enc_brute', A.x, A.y);
        const second = placeAt('enc_brute', A.x + 200, A.y);
        Flags.plant('h1', { x: A.x - 20, y: A.y });
        Flags.plant('h2', { x: A.x - 10, y: A.y });
        run(200);
        expect(BoardCombat.fightOfHero('h1')?.instanceId).toBe(first.id);
        expect(BoardCombat.fightOfHero('h2')?.instanceId).toBe(second.id);
        expect(Flags.waitingFor('h2')).toBeNull();
    });

    it('a flag pinned to a busy enemy waits beside it, then meets it whole once its hero leaves', () => {
        const brute = placeAt('enc_brute', A.x, A.y);
        Flags.plant('h1', A, { pin: true });
        run(100);
        Flags.plant('h2', A, { pin: true });
        expect(Flags.pinnedIdOf('h2')).toBe(brute.id);
        expect(until(() => BoardCombat.getFight(brute.id)?.combat.enemyHp.current < BoardCombat.getFight(brute.id)?.combat.enemyHp.max, 30000)).toBe(true);
        expect(Flags.waitingFor('h2')).toBe(brute.id);

        Flags.furl('h1');
        run(1100);
        const fight = BoardCombat.fightOfHero('h2');
        expect(fight?.instanceId).toBe(brute.id);
        expect(fight.combat.enemyHp.current).toBe(fight.combat.enemyHp.max);
    });

    it('an old save with two heroes on one enemy loads into one fight: the second chooses again', () => {
        const brute = placeAt('enc_brute', A.x, A.y);
        BoardState.setFlag('h1', { x: A.x, y: A.y, plantedAt: 1, pinnedTo: brute.id });
        BoardState.setFlag('h2', { x: A.x, y: A.y, plantedAt: 2, pinnedTo: brute.id });
        GameState.state.board.workClaims = {
            h1: { instanceId: brute.id, side: 1 },
            h2: { instanceId: brute.id, side: -1 }
        };
        Flags.reset();
        Flags.restoreWork();
        run(1000);
        expect(BoardCombat.fightOfHero('h1')?.instanceId).toBe(brute.id);
        expect(BoardCombat.fightOfHero('h2')).toBeNull();
        expect(BoardState.heroOfInstance(brute.id)).toBe('h1');
        expect(Flags.waitingFor('h2')).toBe(brute.id);
    });

    it('a hostile enemy attacks one hero only, however many flags stand by it', () => {
        registerTokenTypes({
            enc_hostile: {
                id: 'enc_hostile', name: 'Encounter Raider', tokenType: 'enemy', rarity: 'common', theme: 'fixture',
                uses: 20, sprite: 's_occult', enemy: { level: 2, style: 'melee', hostile: true }, config: enemyConfig
            }
        });
        const raider = placeAt('enc_hostile', A.x, A.y);
        FlagRules.heroRecord('h1').flagRules = { [FlagRules.FIGHT]: { allowed: false, priority: 3 } };
        FlagRules.heroRecord('h2').flagRules = { [FlagRules.FIGHT]: { allowed: false, priority: 3 } };
        Flags.plant('h1', { x: A.x + 30, y: A.y });
        Flags.plant('h2', { x: A.x - 30, y: A.y });
        run(1000);
        const fighting = ['h1', 'h2'].filter(id => BoardCombat.fightOfHero(id)?.instanceId === raider.id);
        expect(fighting).toHaveLength(1);
    });
});

describe('⭐ guardians block their Token until beaten, and come back', () => {
    it('appears beside its Token on the first tick: tethered to it, one use, said from the Token', () => {
        const spawned = [];
        const off = EventBus.subscribe(BOARD_EVENTS.TOKEN_SPAWNED, (p) => spawned.push(p));
        const vein = placeAt('enc_guarded_vein', A.x, A.y);
        run(100);
        off();
        const [imp] = enemiesOf('enc_imp');
        expect(imp).toBeTruthy();
        expect(imp.tether).toBe(vein.id);
        expect(imp.guards).toBe(vein.id);
        expect(imp.usesRemaining).toBe(1);
        expect(vein.guardianId).toBe(imp.id);
        expect(Guardians.isGuarded(vein)).toBe(true);
        expect(spawned).toEqual([expect.objectContaining({ spawnerId: vein.id, instanceId: imp.id, typeId: 'enc_imp' })]);
        // One guardian, however long it stands.
        run(3000);
        expect(enemiesOf('enc_imp')).toHaveLength(1);
    });

    it('while it stands nobody works the Token: a gatherer skips it as guarded, a pinned one waits', () => {
        const vein = placeAt('enc_guarded_vein', A.x, A.y);
        run(100);
        expect(WorkCheck.fixableReason(vein.id, vein).reason).toBe(ALERT.GUARDED);
        FlagRules.heroRecord('h1').flagRules = { [FlagRules.FIGHT]: { allowed: false, priority: 3 } };
        Flags.plant('h1', A, { pin: true });
        run(2000);
        expect(BoardState.workTokenOf('h1')).toBeNull();
        expect(Flags.skipsOf(vein.id)).toEqual([{ heroId: 'h1', reason: ALERT.GUARDED }]);
        expect(vein.alert ?? null).toBeNull();
    });

    it('a hero with Fight on beats the guardian first, then works the Token', () => {
        const vein = placeAt('enc_guarded_vein', A.x, A.y);
        run(100);
        const [imp] = enemiesOf('enc_imp');
        Flags.plant('h1', A);
        run(100);
        expect(BoardCombat.fightOfHero('h1')?.instanceId).toBe(imp.id);
        expect(until(() => BoardState.workTokenOf('h1') === vein.id)).toBe(true);
        expect(BoardState.getTokenById(imp.id)).toBeNull();
        expect(Guardians.isGuarded(vein)).toBe(false);
    });

    it('comes back after its return time, not before; the worker lets go and it drops again when beaten', () => {
        const vein = placeAt('enc_guarded_vein', A.x, A.y);
        run(100);
        const kills = [];
        const off = EventBus.subscribe(ENGINE_EVENTS.COMBAT_VICTORY, (p) => kills.push(p));
        const sprites = () => SpriteLayer.getSprites ? SpriteLayer.getSprites().length : null;
        Flags.plant('h1', A);
        expect(until(() => BoardState.workTokenOf('h1') === vein.id)).toBe(true);
        expect(kills).toHaveLength(1);
        const firstId = vein.guardianId;

        // The clock starts at the kill: 5 s (authored), not before.
        const state = Guardians.guardianState(vein);
        expect(state).toEqual(expect.objectContaining({ standing: false, beaten: true, returnMs: 5000 }));
        expect(state.inMs).toBeGreaterThan(4000);
        run(Math.max(0, state.inMs - 200));
        expect(Guardians.isGuarded(vein)).toBe(false);
        run(300);
        expect(Guardians.isGuarded(vein)).toBe(true);
        expect(vein.guardianId).not.toBe(firstId);

        // Back again, and beaten again: two kills, two drops.
        expect(until(() => kills.length >= 2)).toBe(true);
        off();
        expect(kills.every(k => k.enemyId === 'enc_imp')).toBe(true);
        void sprites;
    });

    it('a guardian with no return written waits 10 minutes; a boss 2', () => {
        expect(Guardians.guardianOf({ guardian: { typeId: 'enc_imp' } })).toEqual({ typeId: 'enc_imp', returnMs: GUARDIAN_DEFAULTS.returnMs, boss: false });
        expect(Guardians.guardianOf({ guardian: { typeId: 'enc_boss' } })).toEqual({ typeId: 'enc_boss', returnMs: GUARDIAN_DEFAULTS.bossReturnMs, boss: true });
        expect(GUARDIAN_DEFAULTS).toEqual({ returnMs: 600000, bossReturnMs: 120000 });
        // A block naming something that is not an enemy, or on an enemy, keeps nothing.
        expect(Guardians.guardianOf({ guardian: { typeId: 'enc_node' } })).toBeNull();
        expect(Guardians.guardianOf({ enemy: { level: 1 }, guardian: { typeId: 'enc_imp' } })).toBeNull();
    });

    it('waits while the mat is at its Token cap, and comes as soon as there is room', () => {
        setMatTuning('tokenCap', 1);
        const vein = placeAt('enc_guarded_vein', A.x, A.y);
        run(1000);
        expect(Guardians.isGuarded(vein)).toBe(false);
        expect(enemiesOf('enc_imp')).toHaveLength(0);
        setMatTuning('tokenCap', 10);
        run(100);
        expect(Guardians.isGuarded(vein)).toBe(true);
    });
});

describe('⭐ bosses: lairs, never first to attack, whole for every hero, summoned at the Shop', () => {
    it('a boss is never hostile, whatever it says, and no flag watch sets it on anyone', () => {
        expect(isBossEnemy({ enemy: { level: 1, boss: true } })).toBe(true);
        expect(isHostileEnemy({ enemy: { level: 1, boss: true, hostile: true } })).toBe(false);
        placeAt('enc_lair', A.x, A.y);
        run(100);
        const [boss] = enemiesOf('enc_boss');
        expect(boss).toBeTruthy();
        FlagRules.heroRecord('h1').flagRules = { [FlagRules.FIGHT]: { allowed: false, priority: 3 } };
        Flags.plant('h1', { x: boss.x + 20, y: boss.y });
        expect(Hostiles.scan()).toEqual([]);
        expect(Flags.ambush('h1', boss.id)).toBe(false);
        run(2000);
        expect(BoardCombat.fightOfHero('h1')).toBeNull();
    });

    it('lives in its lair, potters by it, and comes back on the boss timer after it is beaten', () => {
        setMatTuning('enemyPotterRadius', 60);
        const lair = placeAt('enc_lair', A.x, A.y);
        run(100);
        const [boss] = enemiesOf('enc_boss');
        expect(EnemyMotion.spawnerOf(boss.id)).toBe(lair);
        expect(Flags.isHeroWorkable(lair)).toBe(false);

        Flags.plant('h1', A);
        expect(until(() => !BoardState.getTokenById(boss.id))).toBe(true);
        const state = Guardians.guardianState(lair);
        expect(state).toEqual(expect.objectContaining({ standing: false, beaten: true, boss: true, lair: true, returnMs: 120000 }));
        run(119000, 1000);
        expect(enemiesOf('enc_boss')).toHaveLength(0);
        run(2000, 1000);
        expect(enemiesOf('enc_boss')).toHaveLength(1);
    });

    it('meets each hero whole: a knocked-out hero leaves it at full HP for the next', () => {
        const strongBoss = 'enc_boss_strong';
        registerTokenTypes({
            [strongBoss]: {
                id: strongBoss, name: 'Strong Boss', tokenType: 'enemy', rarity: 'rare', theme: 'fixture',
                uses: 1, sprite: 's_occult', enemy: { level: 30, style: 'melee', boss: true }, config: enemyConfig
            }
        });
        GameState.state.heroes = [fighter('weak', { level: 1, hp: 3 }), fighter('h2')];
        const boss = placeAt(strongBoss, A.x, A.y);
        const defeated = [];
        const off = EventBus.subscribe(BOARD_EVENTS.HERO_DEFEATED, (p) => defeated.push(p.heroId));
        Flags.plant('weak', A, { pin: true });
        expect(until(() => defeated.includes('weak'), 60000)).toBe(true);
        off();
        expect(BoardCombat.getFight(boss.id)).toBeNull();

        Flags.plant('h2', A, { pin: true });
        run(100);
        const fight = BoardCombat.fightOfHero('h2');
        expect(fight?.instanceId).toBe(boss.id);
        expect(fight.combat.enemyHp.current).toBe(fight.combat.enemyHp.max);
    });

    it('is summoned at the Shop for its summon item, where it is dropped, and gone once beaten', () => {
        const section = Shop.catalogue().find(s => s.section === SUMMON_SHOP_SECTION);
        expect(section?.name).toBe('Summons');
        expect(section.items.map(i => i.typeId)).toContain('enc_boss');

        expect(Shop.buyAt('enc_boss', A).success).toBe(false);
        InventoryManager.addItem('enc_summon_horn', 2);
        const res = Shop.buyAt('enc_boss', A);
        expect(res.success).toBe(true);
        expect(InventoryManager.getItemCount('enc_summon_horn')).toBe(1);
        const boss = BoardState.getTokenById(res.instance.id);
        expect(boss).toBeTruthy();

        Flags.plant('h1', A);
        expect(until(() => !BoardState.getTokenById(boss.id))).toBe(true);
        run(200000, 1000);
        expect(enemiesOf('enc_boss')).toHaveLength(0);
    });
});

describe('⭐ node ambushes: the enemy attacks the worker', () => {
    it('a peaceful enemy sprung by the node attacks the hero working it, who goes back to work after', () => {
        const nodeType = ambushNode('enc_imp', 100);
        const node = placeAt(nodeType, A.x, A.y);
        const sprung = [];
        const off = EventBus.subscribe(BOARD_EVENTS.AMBUSHED, (p) => sprung.push(p));
        Flags.plant('h1', A, { pin: true });
        expect(BoardState.workTokenOf('h1')).toBe(node.id);
        run(1000);
        off();
        expect(sprung).toHaveLength(1);
        const [imp] = enemiesOf('enc_imp');
        expect(sprung[0]).toEqual({ instanceId: imp.id, heroId: 'h1', nodeId: node.id });
        expect(imp.usesRemaining).toBe(1);
        expect(imp.ambushedFrom).toBe(node.id);

        run(100);
        expect(Flags.ambusherOf('h1')).toBe(imp.id);
        expect(BoardCombat.fightOfHero('h1')?.instanceId).toBe(imp.id);
        // One kill and it is gone; the pinned hero is back on the node.
        expect(until(() => !BoardState.getTokenById(imp.id))).toBe(true);
        expect(until(() => BoardState.workTokenOf('h1') === node.id, 5000)).toBe(true);
    });

    it('holds one ambusher at a time: while it stands, the rule rolls nothing and spawns nothing', () => {
        const nodeType = ambushNode('enc_imp', 50);
        const node = placeAt(nodeType, A.x, A.y);
        FlagRules.heroRecord('h1').flagRules = { [FlagRules.FIGHT]: { allowed: false, priority: 3 } };
        // Out of the way: the worker cannot fight, so the ambusher stays.
        const cycle = () => EventBus.publish(BOARD_EVENTS.CYCLE_COMPLETE, { instanceId: node.id, typeId: node.typeId, heroId: null, failed: false, produced: [] });
        const random = vi.spyOn(Math, 'random').mockReturnValue(0);
        cycle();
        expect(enemiesOf('enc_imp')).toHaveLength(1);
        const draws = random.mock.calls.length;
        for (let i = 0; i < 10; i++) cycle();
        expect(enemiesOf('enc_imp')).toHaveLength(1);
        expect(random.mock.calls.length).toBe(draws);
        random.mockRestore();

        // Beaten (here: removed), the node may spring another.
        BoardState.removeToken(enemiesOf('enc_imp')[0].id);
        vi.spyOn(Math, 'random').mockReturnValue(0);
        cycle();
        expect(enemiesOf('enc_imp')).toHaveLength(1);
    });

    it('bosses never ambush: a rule naming one rolls nothing and spawns nothing', () => {
        const nodeType = ambushNode('enc_boss', 50);
        const node = placeAt(nodeType, A.x, A.y);
        const random = vi.spyOn(Math, 'random').mockReturnValue(0);
        EventBus.publish(BOARD_EVENTS.CYCLE_COMPLETE, { instanceId: node.id, typeId: node.typeId, heroId: 'h1', failed: false, produced: [] });
        expect(enemiesOf('enc_boss')).toHaveLength(0);
        expect(random).not.toHaveBeenCalled();
    });

    it('with no worker named it stays by its node, as before: hostile ones watch it, peaceful ones wait', () => {
        const nodeType = ambushNode('enc_imp', 100);
        const node = placeAt(nodeType, A.x, A.y);
        EventBus.publish(BOARD_EVENTS.CYCLE_COMPLETE, { instanceId: node.id, typeId: node.typeId, heroId: null, failed: false, produced: [] });
        const [imp] = enemiesOf('enc_imp');
        expect(imp.tether).toBe(node.id);
        Flags.plant('h2', FAR);
        run(1000);
        expect(BoardCombat.fightOfHero('h2')).toBeNull();
        expect(EnemyMotion.spawnerOf(imp.id)).toBeNull();
    });

    it('the ambusher an unguarded node keeps is not a guardian: the node stays workable', () => {
        const nodeType = ambushNode('enc_imp', 100);
        const node = placeAt(nodeType, A.x, A.y);
        EventBus.publish(BOARD_EVENTS.CYCLE_COMPLETE, { instanceId: node.id, typeId: node.typeId, heroId: null, failed: false, produced: [] });
        expect(Guardians.isGuarded(node)).toBe(false);
        expect(WorkCheck.fixableReason(node.id, node).reason).toBeNull();
        void B;
    });
});
