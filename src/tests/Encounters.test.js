import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as EnemyMotion from '../systems/board/EnemyMotion.js';
import * as Flags from '../systems/board/Flags.js';
import * as FlagRules from '../systems/board/FlagRules.js';
import * as SpawnerSystem from '../systems/board/SpawnerSystem.js';
import * as Hostiles from '../systems/board/Hostiles.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as TriggerSystem from '../systems/board/TriggerSystem.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as WorkCheck from '../systems/board/WorkCheck.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { auditContent } from '../systems/core/ContentAudit.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS, ALERT } from '../systems/board/boardEvents.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { registerTokenTypes, getTokenType } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { isHostileEnemy, isBossEnemy } from '../config/registries/enemyProfile.js';
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
 * Encounters (brief 220, C5, as the owner simplified it on 2026-10-24): every fight one-on-one;
 * bosses and guardians from camps of one, ordinary spawners; node ambushes that attack the worker;
 * bosses that never attack first and meet each hero whole; a Summoning Circle whose work uses up a
 * summon item and puts its boss on the mat.
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
        config: enemyConfig
    },
    /** A hostile guardian: a tough enemy whose camp stands by a rich node. */
    enc_guardian: {
        id: 'enc_guardian', name: 'Encounter Guardian', tokenType: 'enemy', rarity: 'common', theme: 'fixture',
        uses: 1, sprite: 's_occult', enemy: { level: 2, style: 'melee', hostile: true }, config: enemyConfig
    },
    /** A boss's den: an ordinary camp that keeps one, every 60 s. */
    enc_den: {
        id: 'enc_den', name: 'Encounter Den', tokenType: 'spawner', rarity: 'rare', theme: 'fixture',
        uses: null, sprite: 's_crime',
        spawner: { spawns: [{ typeId: 'enc_boss', weight: 1 }], allowance: 1, intervalMs: 60000, upkeep: [] }
    },
    /** A guardian's camp: the same, for the guardian. */
    enc_guardian_camp: {
        id: 'enc_guardian_camp', name: 'Encounter Guardian Camp', tokenType: 'spawner', rarity: 'common', theme: 'fixture',
        uses: null, sprite: 's_crime',
        spawner: { spawns: [{ typeId: 'enc_guardian', weight: 1 }], allowance: 1, intervalMs: 30000, upkeep: [] }
    },
    /**
     * A Summoning Circle: its work uses up a Summoning Horn and puts the boss beside it. Alchemy is
     * a Starting skill, which every hero holds, so any hero may work it.
     */
    enc_circle: {
        id: 'enc_circle', name: 'Encounter Circle', tokenType: 'resource', rarity: 'rare', theme: 'fixture',
        uses: null, sprite: 's_occult',
        config: {
            skill: 'alchemy', skillRequired: 1, cycleTimeMs: 3000, xp: 0,
            inputs: [{ itemId: 'enc_summon_horn', quantity: 1 }],
            outputs: [{ tokenId: 'enc_boss', chance: 100, minQty: 1, maxQty: 1 }]
        }
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

describe('⭐ camps of one: bosses and guardians from ordinary spawners', () => {
    it('a den keeps its one boss: the first after its interval, never a second while it stands', () => {
        const den = placeAt('enc_den', A.x, A.y);
        run(59000, 1000);
        expect(enemiesOf('enc_boss')).toHaveLength(0);
        run(1000, 1000);
        const [boss] = enemiesOf('enc_boss');
        expect(boss).toBeTruthy();
        expect(boss.tether).toBe(den.id);
        expect(EnemyMotion.spawnerOf(boss.id)).toBe(den);
        run(180000, 1000);
        expect(enemiesOf('enc_boss')).toHaveLength(1);
        expect(SpawnerSystem.spawnerStatus(den.id)).toEqual(expect.objectContaining({ state: 'at_cap', count: 1, cap: 1 }));
    });

    it('⚠️ as every camp today: a den full for its interval replaces a beaten boss on the next tick', () => {
        placeAt('enc_den', A.x, A.y);
        run(61000, 1000);
        // The den has been full long enough for its clock to fill and wait.
        run(70000, 1000);
        const [first] = enemiesOf('enc_boss');
        Flags.plant('h1', { x: first.x, y: first.y }, { pin: true });
        expect(until(() => !BoardState.getTokenById(first.id))).toBe(true);
        run(1000, 1000);
        const [next] = enemiesOf('enc_boss');
        expect(next).toBeTruthy();
        expect(next.id).not.toBe(first.id);
    });

    it('a guardian is a hostile enemy whose camp stands by a rich node: it attacks whoever works there, and blocks nothing', () => {
        const camp = placeAt('enc_guardian_camp', A.x, A.y);
        const node = placeAt('enc_node', A.x + 160, A.y);
        SpawnerSystem.attemptSpawn(camp, getTokenType(camp.typeId));
        const [guardian] = enemiesOf('enc_guardian');
        expect(guardian).toBeTruthy();
        // Nothing blocks the node: the work check has no word for a guardian.
        expect(WorkCheck.fixableReason(node.id, node).reason).toBeNull();
        FlagRules.heroRecord('h1').flagRules = { [FlagRules.FIGHT]: { allowed: false, priority: 3 } };
        Flags.plant('h1', node, { pin: true });
        run(500);
        // Its rule against fighting does not save the gatherer: a hostile guardian attacks.
        expect(Flags.ambusherOf('h1')).toBe(guardian.id);
        expect(until(() => !BoardState.getTokenById(guardian.id))).toBe(true);
        expect(until(() => BoardState.workTokenOf('h1') === node.id, 5000)).toBe(true);
    });
});

describe('⭐ bosses: never first to attack, whole for every hero, called by a Summoning Circle', () => {
    it('a boss is never hostile, whatever it says, and no flag watch sets it on anyone', () => {
        expect(isBossEnemy({ enemy: { level: 1, boss: true } })).toBe(true);
        expect(isHostileEnemy({ enemy: { level: 1, boss: true, hostile: true } })).toBe(false);
        const boss = placeAt('enc_boss', A.x, A.y);
        FlagRules.heroRecord('h1').flagRules = { [FlagRules.FIGHT]: { allowed: false, priority: 3 } };
        Flags.plant('h1', { x: boss.x + 20, y: boss.y });
        expect(Hostiles.scan()).toEqual([]);
        expect(Flags.ambush('h1', boss.id)).toBe(false);
        run(2000);
        expect(BoardCombat.fightOfHero('h1')).toBeNull();
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

    it('a Summoning Circle: any hero works it, a Horn is used up, the boss stands beside it, and without a Horn it waits', () => {
        // A Recruit: no combat skill, nothing but the Starting skills every hero holds.
        const recruit = generateHero({ name: 'r1' });
        recruit.id = 'r1';
        recruit.status = 'idle';
        GameState.state.heroes = [recruit, fighter('h2')];
        InventoryManager.addItem('enc_summon_horn', 1);
        const circle = placeAt('enc_circle', A.x, A.y);
        Flags.plant('r1', circle, { pin: true });
        expect(BoardState.workTokenOf('r1')).toBe(circle.id);
        run(3100);
        expect(InventoryManager.getItemCount('enc_summon_horn')).toBe(0);
        const [boss] = enemiesOf('enc_boss');
        expect(boss).toBeTruthy();
        expect(Math.hypot(boss.x - circle.x, boss.y - circle.y)).toBeLessThan(400);
        // No Horn left: the circle waits, saying it needs one, and calls nothing more.
        run(6000);
        expect(enemiesOf('enc_boss')).toHaveLength(1);
        expect(circle.alert).toBe(ALERT.INPUTS);
        // The boss it called is fought like any other, and is gone once beaten.
        Flags.plant('h2', { x: boss.x, y: boss.y }, { pin: true });
        expect(until(() => !BoardState.getTokenById(boss.id))).toBe(true);
        run(10000, 1000);
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

    it('bosses never ambush: a rule naming one rolls nothing and spawns nothing, and the audit says so', () => {
        const nodeType = ambushNode('enc_boss', 50);
        const node = placeAt(nodeType, A.x, A.y);
        const random = vi.spyOn(Math, 'random').mockReturnValue(0);
        EventBus.publish(BOARD_EVENTS.CYCLE_COMPLETE, { instanceId: node.id, typeId: node.typeId, heroId: 'h1', failed: false, produced: [] });
        expect(enemiesOf('enc_boss')).toHaveLength(0);
        expect(random).not.toHaveBeenCalled();
        random.mockRestore();
        const said = auditContent().filter(f => f.where === `Token "${nodeType}"`).map(f => f.what);
        expect(said.some(w => w.includes('a boss'))).toBe(true);
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

    it('an ambusher standing by its node blocks nothing: the node stays workable', () => {
        const nodeType = ambushNode('enc_imp', 100);
        const node = placeAt(nodeType, A.x, A.y);
        EventBus.publish(BOARD_EVENTS.CYCLE_COMPLETE, { instanceId: node.id, typeId: node.typeId, heroId: null, failed: false, produced: [] });
        expect(enemiesOf('enc_imp')).toHaveLength(1);
        expect(WorkCheck.fixableReason(node.id, node).reason).toBeNull();
    });
});
