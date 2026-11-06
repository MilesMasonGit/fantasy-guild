import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as EnemyMotion from '../systems/board/EnemyMotion.js';
import * as Flags from '../systems/board/Flags.js';
import * as Orders from '../systems/board/Orders.js';
import * as HeroMotion from '../systems/board/HeroMotion.js';
import * as FightRoom from '../systems/board/FightRoom.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { matW, matH, artRadiusOf } from '../config/matGeometry.js';
import { MAT_BAR, CHIP, CHIP_PX, fightReach, fightBarShift, fightButtonPlace, heroBarPlace, enemyBarPlace } from '../ui/components/board/healthBar.js';
import { HERO_BOX_PX, HERO_HIT_PX } from '../ui/components/board/boardConstants.js';
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
 * ⭐ **Crowded fights step to open space** (brief 360 C4). When a hero reaches an enemy and the
 * fight about to start would cover another fight or a standing hero, the enemy walks to the
 * nearest clear spot within `STEP_REACH` and the hero walks with it; the fight starts there. A
 * lone fight, or one with no clear spot that close, starts where it stands.
 *
 * Heroes walk here (instant arrival off), 120 u a second; enemies 90.
 */

const DAY = 24 * 60 * 60 * 1000;
const SPEED = 120;
const ENEMY_SPEED = 90;

registerTokenTypes({
    /** A creature that never falls (and barely hurts): the fight lasts the whole test. */
    fs_dummy: {
        id: 'fs_dummy', name: 'FS Dummy', tokenType: 'enemy',
        rarity: 'common', theme: 'fixture', uses: 50, sprite: 's_occult',
        enemy: { level: 1, style: 'melee', hp: 100000, hit: 1 },
        config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
    },
    fs_small: {
        id: 'fs_small', name: 'FS Small', tokenType: 'enemy', artSize: 'small',
        rarity: 'common', theme: 'fixture', uses: 50, sprite: 's_occult',
        enemy: { level: 1, style: 'melee', hp: 100000, hit: 1 },
        config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
    },
    fs_big: {
        id: 'fs_big', name: 'FS Big', tokenType: 'enemy', size: 2,
        rarity: 'common', theme: 'fixture', uses: 50, sprite: 's_occult',
        enemy: { level: 1, style: 'melee', hp: 100000, hit: 1, boss: true },
        config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
    },
    fs_camp: {
        id: 'fs_camp', name: 'FS Camp', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature',
        spawner: { spawns: [{ typeId: 'fs_dummy', weight: 1 }], allowance: 4, intervalMs: DAY, upkeep: [] }
    },
    /** Hostile, one kill and gone: the Goblin's shape. */
    fs_goblin: {
        id: 'fs_goblin', name: 'FS Goblin', tokenType: 'enemy',
        rarity: 'common', theme: 'fixture', uses: 1, sprite: 's_occult',
        enemy: { level: 1, style: 'melee', budgetScale: 0.3, hostile: true },
        config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
    },
    fs_hostile_camp: {
        id: 'fs_hostile_camp', name: 'FS Hostile Camp', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature',
        spawner: { spawns: [{ typeId: 'fs_goblin', weight: 1 }], allowance: 4, intervalMs: DAY, upkeep: [] }
    }
});

function fighter(id) {
    const hero = generateHero({ name: id });
    hero.id = id;
    hero.name = id;
    hero.status = 'idle';
    hero.hp = { current: 100, max: 100 };
    Object.values(hero.skills).forEach(s => { s.level = 50; });
    hero.skills.melee = { level: 50, xp: 0 };
    return hero;
}

let clock = 0;
const run = (ms, step = 100) => { for (let t = 0; t < ms; t += step) { BoardRunner.tick(step); clock += step; } };
const body = (heroId) => BoardState.heroBodyOf(heroId);
const fightOf = (heroId) => BoardCombat.fightOfHero(heroId);

/** Run 100 ms ticks until `done()` (at most `maxMs`), returning the game time it took. */
function runUntil(done, maxMs = 20000) {
    const start = clock;
    while (!done() && clock - start < maxMs) run(100);
    expect(done()).toBe(true);
    return clock - start;
}

/** `heroId` appears on bare ground by `from` (no Guild Hall), then is sent at `token`. */
function sendFrom(heroId, from, token) {
    Orders.orderAt(heroId, from);
    return Orders.orderAt(heroId, { x: token.x, y: token.y });
}

/** The box a hero's fight takes up, read from where they stand now. */
const boxOf = (heroId) => {
    const fight = fightOf(heroId);
    const enemy = BoardState.getTokenById(fight.instanceId);
    return FightRoom.fightBox(enemy.typeId, enemy, body(heroId).side);
};

beforeAll(() => {
    Flags.init();
    BoardCombat.init();
});
afterAll(() => { Flags.teardown(); resetMatTuning(); });

beforeEach(() => {
    vi.clearAllMocks();
    BoardState.setInstantArrival(false);
    resetMatTuning();
    setMatTuning('walkSpeed', SPEED);
    setMatTuning('enemyWalkSpeed', ENEMY_SPEED);
    setMatTuning('potterRadius', 0);
    setMatTuning('enemyPotterRadius', 0);
    setMatTuning('watchRadius', 300);
    GameState.initNew();
    GameState.state.progress.rosterLimit = 40;
    InventoryManager.init();
    SpriteLayer.init();
    LootSystem.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    clearMat();
    GameState.state.heroes = ['h1', 'h2', 'h3', 'h4'].map(fighter);
    GameState.state.inventory.maxSlots = 50;
    clock = 0;
    FightRoom.resetStats();
});

afterEach(() => {
    BoardState.setInstantArrival(true);
    EnemyMotion.setRandomForTests();
    HeroMotion.setRandomForTests();
});

describe('⭐ a lone fight stays where it starts', () => {
    it('the enemy never moves and the fight starts the moment the hero arrives', () => {
        const enemy = placeAt('fs_dummy', 800, 500);
        sendFrom('h1', { x: 500, y: 500 }, enemy);
        let stepped = false;
        const took = runUntil(() => {
            if (FightRoom.stepOf(enemy.id)) stepped = true;
            return !!fightOf('h1');
        });
        expect(stepped).toBe(false);
        expect({ x: enemy.x, y: enemy.y }).toEqual({ x: 800, y: 500 });
        // The walk from the flag's idle spot (572, 428) to (704, 500) is about 150 u: 1.3 s at 120.
        expect(took).toBeLessThanOrEqual(1400);
        expect(FightRoom.stats().searches).toBe(0);
    });
});

describe('⭐ a fight that would cover another fight steps to the nearest clear spot', () => {
    it('the second enemy walks 40 u clear of the first fight, its hero with it, and only then do they fight', () => {
        const first = placeAt('fs_dummy', 800, 500);
        sendFrom('h1', { x: 500, y: 500 }, first);
        runUntil(() => !!fightOf('h1'));

        // 100 u right and 60 u down of the first: its fight would cover the first one's.
        const second = placeAt('fs_dummy', 900, 560);
        sendFrom('h2', { x: 1400, y: 560 }, second);
        runUntil(() => !!FightRoom.stepOf(second.id));
        const arrivedAt = clock;
        // Standing beside it, not fighting: the step comes first.
        expect(fightOf('h2')).toBeNull();
        expect(BoardState.workerOf(second.id)).toBeNull();
        expect(FightRoom.stepOf(second.id)).toMatchObject({ heroId: 'h2', x: 940, y: 560 });

        runUntil(() => !!fightOf('h2'));
        // The nearest clear spot: 40 u right (down would take 104).
        expect({ x: second.x, y: second.y }).toEqual({ x: 940, y: 560 });
        expect(body('h2')).toMatchObject({ ...HeroMotion.standingSpot('fs_dummy', second, 1), moving: false });
        expect(FightRoom.stepOf(second.id)).toBeNull();
        expect(FightRoom.crowds(boxOf('h1'), boxOf('h2'))).toBe(false);
        // The first fight never moved.
        expect({ x: first.x, y: first.y }).toEqual({ x: 800, y: 500 });

        // What it cost: 40 u at 90 u/s is 0.44 s, and the hero catches up within a tick.
        const cost = clock - arrivedAt;
        expect(cost).toBeGreaterThanOrEqual(400);
        expect(cost).toBeLessThanOrEqual(700);
    });

    it('the first fight does not move when a second starts beside it, wherever that one goes', () => {
        const first = placeAt('fs_dummy', 800, 500);
        sendFrom('h1', { x: 500, y: 500 }, first);
        runUntil(() => !!fightOf('h1'));
        const second = placeAt('fs_dummy', 900, 560);
        sendFrom('h2', { x: 1400, y: 560 }, second);
        runUntil(() => !!fightOf('h2'));
        run(5000);
        expect({ x: first.x, y: first.y }).toEqual({ x: 800, y: 500 });
        expect(FightRoom.stats().searches).toBe(1);
    });
});

describe('⭐ a fight that would cover a standing hero steps away from them', () => {
    it('a hero at work beside the enemy: the fight steps 32 u the other way', () => {
        // h3 works a Producer and stands at (904, 450).
        const producer = placeAt('fixture_producer', 1000, 450);
        sendFrom('h3', { x: 850, y: 450 }, producer);
        runUntil(() => BoardState.workTokenOf('h3') === producer.id);
        expect(body('h3')).toMatchObject({ x: 904, y: 450, moving: false });

        const enemy = placeAt('fs_dummy', 800, 500);
        sendFrom('h1', { x: 500, y: 500 }, enemy);
        runUntil(() => !!fightOf('h1'));
        expect({ x: enemy.x, y: enemy.y }).toEqual({ x: 768, y: 500 });
        expect(FightRoom.crowds(boxOf('h1'), FightRoom.heroBox(body('h3')))).toBe(false);
        // The hero at work never moved.
        expect(body('h3')).toMatchObject({ x: 904, y: 450 });
    });

    it('a hero waiting their turn at the same enemy does not push the fight away', () => {
        const enemy = placeAt('fs_dummy', 800, 500);
        // h1 takes it from far off; h2, sent after, waits beside it on the far side and is
        // standing there well before h1 arrives.
        sendFrom('h1', { x: 300, y: 500 }, enemy);
        sendFrom('h2', { x: 1000, y: 500 }, enemy);
        let waiting = null;
        runUntil(() => {
            if (fightOf('h1')) waiting = { ...body('h2') };
            return !!fightOf('h1');
        });
        expect(waiting).toMatchObject({ x: 896, y: 500, moving: false });
        expect(FightRoom.crowds(FightRoom.fightBox('fs_dummy', enemy, -1), FightRoom.heroBox(waiting))).toBe(true);
        expect({ x: enemy.x, y: enemy.y }).toEqual({ x: 800, y: 500 });
        expect(FightRoom.stats().searches).toBe(0);
    });
});

describe('who counts', () => {
    it('a hero walking past does not count; the same hero standing there does', () => {
        const enemy = placeAt('fs_dummy', 800, 500);
        // A body of a hero walking through the fight's box.
        BoardState.setHeroBody('h4', { x: 760, y: 480, targetId: null, side: -1, atWork: null, moving: true, facing: 1 });
        expect(FightRoom.planFor('h1', enemy, -1)).toEqual({ crowded: false, to: null });
        BoardState.heroBodyOf('h4').moving = false;
        const plan = FightRoom.planFor('h1', enemy, -1);
        expect(plan.crowded).toBe(true);
        expect(plan.to).not.toBeNull();
        const at = plan.to;
        expect(Math.hypot(at.x - 800, at.y - 500)).toBeLessThanOrEqual(FightRoom.STEP_REACH);
        expect(FightRoom.crowds(FightRoom.fightBox('fs_dummy', at, -1), FightRoom.heroBox({ x: 760, y: 480 }))).toBe(false);
    });

    it('with no clear spot within reach the fight starts where it stands', () => {
        const enemy = placeAt('fs_dummy', 800, 500);
        // Heroes standing every 120 u across the mat: no box of a fight is clear of them anywhere.
        let n = 0;
        for (let y = 60; y < matH(); y += 120) {
            for (let x = 60; x < matW(); x += 120) {
                BoardState.setHeroBody(`crowd_${n++}`, { x, y, targetId: null, side: -1, atWork: null, moving: false, facing: 1 });
            }
        }
        expect(FightRoom.planFor('h1', enemy, -1)).toEqual({ crowded: true, to: null });
        expect(FightRoom.holdsArrival('h1', enemy, -1)).toBe(false);
        expect(FightRoom.stepOf(enemy.id)).toBeNull();
    });

    it('a step never leaves the mat: a spot whose box would cross the edge is passed over', () => {
        // At the top edge, its box touching it, with a hero standing just below.
        const enemy = placeAt('fs_dummy', 800, 90);
        expect(FightRoom.fightBox('fs_dummy', enemy, -1).top).toBe(0);
        BoardState.setHeroBody('h4', { x: 800, y: 240, targetId: null, side: -1, atWork: null, moving: false, facing: 1 });
        // 8 u up would clear the hero but put the bars off the mat; the nearest spot on it is 136 u left.
        expect(FightRoom.crowds(FightRoom.fightBox('fs_dummy', { x: 800, y: 82 }, -1), FightRoom.heroBox({ x: 800, y: 240 }))).toBe(false);
        expect(FightRoom.planFor('h1', enemy, -1)).toEqual({ crowded: true, to: { x: 664, y: 90 } });
    });
});

describe('⭐ after a stepped fight', () => {
    it('a camp\'s enemy walks back home to where it stood', () => {
        // Its ground: 64 u of camp and 20 u of wander, so 84 u round the camp's centre.
        setMatTuning('enemyPotterRadius', 20);
        const camp = placeAt('fs_camp', 800, 700);
        const enemy = placeAt('fs_dummy', 880, 700);
        enemy.tether = camp.id;
        run(100);
        // A hero idling at (760, 700), left of the fight to come.
        Orders.orderAt('h3', { x: 688, y: 772 });
        run(1500);
        expect(body('h3')).toMatchObject({ x: 760, y: 700, moving: false });

        sendFrom('h1', { x: 1200, y: 700 }, enemy);
        runUntil(() => !!fightOf('h1'));
        // It stepped right, out of its camp's ground.
        expect(enemy.x).toBeGreaterThan(880);
        expect(Math.hypot(enemy.x - 800, enemy.y - 700)).toBeGreaterThan(84);
        run(3000);

        // The hero is called home: the fight is over, and the enemy walks back.
        Orders.sendHome('h1');
        run(3000);
        expect(fightOf('h1')).toBeNull();
        expect({ x: enemy.x, y: enemy.y }).toEqual({ x: 880, y: 700 });
        expect(EnemyMotion.isWalking(enemy.id)).toBe(false);
    });

    it('an ambushed hero goes back to their job once the stepped fight is won', () => {
        // The camp's ground reaches the goblin's spot, so it stands there until it attacks.
        setMatTuning('enemyPotterRadius', 128);
        const camp = placeAt('fs_hostile_camp', 800, 500);
        const goblin = placeAt('fs_goblin', 900, 500);
        goblin.tether = camp.id;
        // h2 idles on open ground at (1000, 520), just right of where the fight will be; a hero
        // on a spot is never attacked.
        Orders.orderAt('h2', { x: 928, y: 592 });
        run(1500);
        expect(body('h2')).toMatchObject({ x: 1000, y: 520, moving: false });

        // h1 works a Producer inside the camp's watch, and is attacked.
        const producer = placeAt('fixture_producer', 800, 750);
        sendFrom('h1', { x: 600, y: 750 }, producer);
        let foughtAt = null;
        runUntil(() => {
            const fight = fightOf('h1');
            if (fight && !foughtAt) foughtAt = { x: goblin.x, y: goblin.y };
            return !!foughtAt;
        });
        expect(Flags.ambusherOf('h1')).toBe(goblin.id);
        // It stepped left, clear of h2.
        expect(foughtAt.x).toBeLessThan(900);
        expect(foughtAt.y).toBe(500);

        // The kill, then back to the Producer.
        runUntil(() => !BoardState.getTokenById(goblin.id), 60000);
        runUntil(() => BoardState.workTokenOf('h1') === producer.id, 10000);
        expect(Flags.ambusherOf('h1')).toBeNull();
    });
});

describe('⭐ a full mat does not stall', () => {
    it('128 Tokens and eight crowded fights: one search per fight, each bounded, nothing retried', () => {
        // A lattice of Producers filling the mat (Tokens do not count: only fights and heroes).
        let placed = 0;
        for (let y = 80; y < matH() && placed < 120; y += 130) {
            for (let x = 80; x < matW() && placed < 120; x += 130) { placeAt('fixture_producer', x, y); placed++; }
        }
        // Eight enemies packed in a row, 90 u apart, and a hero sent at each from below.
        GameState.state.heroes = Array.from({ length: 8 }, (_, i) => fighter(`f${i}`));
        const enemies = [];
        for (let i = 0; i < 8; i++) enemies.push(placeAt('fs_dummy', 500 + i * 90, 500));
        expect(BoardState.tokens().length).toBe(128);
        enemies.forEach((e, i) => sendFrom(`f${i}`, { x: e.x, y: 900 }, e));

        const t0 = performance.now();
        run(60000);
        const ms = performance.now() - t0;

        expect(enemies.every((e, i) => fightOf(`f${i}`)?.instanceId === e.id)).toBe(true);
        const { searches, candidates, worst } = FightRoom.stats();
        // One search per fight that found itself crowded, at most one per hero.
        expect(searches).toBeGreaterThan(0);
        expect(searches).toBeLessThanOrEqual(8);
        // Each search is bounded by the candidate table, however full the mat.
        expect(worst).toBeLessThanOrEqual(FightRoom.CANDIDATES);
        expect(candidates).toBeLessThanOrEqual(8 * FightRoom.CANDIDATES);
        console.info(`full mat: 600 ticks in ${ms.toFixed(0)} ms, ${searches} searches, ${candidates} candidates (worst ${worst})`);
    });
});

describe('a fight\'s box is what the screen draws over it', () => {
    it('matches the bars, the button and both fighters\' art at the mat\'s natural size', () => {
        // The UI's own numbers, at a fit of 1 (one plate pixel is one mat unit).
        expect(MAT_BAR.W).toBe(64);
        expect(fightReach(1)).toBe(26);
        for (const typeId of ['fs_dummy', 'fs_small', 'fs_big']) {
            for (const side of [-1, 1]) {
                const e = { x: 800, y: 500 };
                const h = HeroMotion.standingSpot(typeId, e, side);
                const box = FightRoom.fightBox(typeId, e, side);
                const r = artRadiusOf(typeId);
                const shift = fightBarShift(h.x - e.x, 1);
                const away = h.x > e.x ? 1 : -1;
                const eBar = enemyBarPlace(2 * r, 1);
                const hBar = heroBarPlace(HERO_BOX_PX, 1);
                const button = fightButtonPlace({ heroX: h.x, enemyX: e.x, heroArtTop: h.y - HERO_BOX_PX / 2, enemyBoxTop: e.y - r, u: 1, fit: 1 });
                const parts = [
                    { left: e.x - r, top: e.y - r, right: e.x + r, bottom: e.y + r },
                    { left: h.x - HERO_BOX_PX / 2, top: h.y - HERO_BOX_PX / 2, right: h.x + HERO_BOX_PX / 2, bottom: h.y + HERO_BOX_PX / 2 },
                    { left: e.x - r + eBar.left - away * shift, top: e.y - r + eBar.top, right: e.x - r + eBar.left + eBar.width - away * shift, bottom: e.y - r + eBar.top + MAT_BAR.H },
                    { left: h.x - HERO_HIT_PX / 2 + hBar.left + away * shift, top: h.y - HERO_BOX_PX / 2 + hBar.top, right: h.x - HERO_HIT_PX / 2 + hBar.left + hBar.width + away * shift, bottom: h.y - HERO_BOX_PX / 2 + hBar.top + MAT_BAR.H },
                    { left: button.left, top: button.top, right: button.left + button.size, bottom: button.top + button.size }
                ];
                const want = {
                    left: Math.min(...parts.map(p => p.left)), top: Math.min(...parts.map(p => p.top)),
                    right: Math.max(...parts.map(p => p.right)), bottom: Math.max(...parts.map(p => p.bottom))
                };
                expect(box, `${typeId} side ${side}`).toEqual(want);
            }
        }
        expect(CHIP.GAP).toBe(4);
        expect(CHIP_PX).toBe(32);
    });
});
