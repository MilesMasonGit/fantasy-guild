import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as Flags from '../systems/board/Flags.js';
import * as HeroMotion from '../systems/board/HeroMotion.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as EquipmentManager from '../systems/equipment/EquipmentManager.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { dropOnMat } from '../ui/components/board/dropOnMat.js';
import { DRAG_KIND, rosterFlagPayload } from '../ui/dnd/dragConstants.js';
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
 * A new hero sent at a Goblin by the player's drop: from the hero bar, or by moving their
 * pennant. Everyone fights, so dropped ON the Goblin they are ordered onto it and fight it. Dropped
 * NEAR it, they work or idle there, and the Goblin never attacks them.
 */

registerTokenTypes({
    /** The Goblin's shape: one kill and gone, level 1. */
    fixture_drop_goblin: {
        id: 'fixture_drop_goblin', name: 'Fixture Drop Goblin', tokenType: 'enemy',
        rarity: 'common', theme: 'fixture', uses: 1, sprite: 's_occult',
        enemy: { level: 1, style: 'melee', budgetScale: 0.3 },
        config: { skill: '', skillRequired: 1, cycleTimeMs: 12000, xp: 0, inputs: [], outputs: [] }
    }
});

const GOBLIN = { x: 880, y: 560 };

/** A freshly hired hero: every skill at 1, nothing in their hands, Fight rule as hired (on). */
function recruit(id) {
    const hero = generateHero({ name: id });
    hero.id = id;
    hero.status = 'idle';
    return hero;
}

/** The hero bar's drop (a hero not yet on the mat) and the planted flag's drop. */
const barDrop = (heroId, point) => dropOnMat(rosterFlagPayload(heroId), point);
const flagDrop = (heroId, point) => dropOnMat({ kind: DRAG_KIND.FLAG, heroId, from: { flag: true } }, point);

/** Tick in game steps for up to `ms`, noting whether `heroId` ever fought; stops when `enemy` has left. */
function play(heroId, enemy, ms = 60000) {
    let fought = false;
    for (let t = 0; t < ms && BoardState.getTokenById(enemy.id); t += 100) {
        BoardRunner.tick(100);
        if (BoardCombat.fightOfHero(heroId)?.instanceId === enemy.id) fought = true;
    }
    return { fought, gone: !BoardState.getTokenById(enemy.id) };
}

function expectRecruitWon(heroId, enemy, skillsBefore) {
    const { fought, gone } = play(heroId, enemy);
    expect(fought).toBe(true);
    expect(gone).toBe(true);
    const hero = GameState.state.heroes.find(h => h.id === heroId);
    expect(hero.status).not.toBe('wounded');
    // Rewritten with classless heroes: a punch is Melee, so the kill trains Melee and nothing else.
    const before = JSON.parse(skillsBefore);
    expect(hero.skills.melee.xp).toBeGreaterThan(before.melee.xp);
    const { melee: _m, ...rest } = hero.skills;
    const { melee: _b, ...restBefore } = before;
    expect(rest).toEqual(restBefore);
}

beforeAll(() => {
    Flags.init();
    BoardCombat.init();
});
afterAll(() => { Flags.teardown(); resetMatTuning(); });

beforeEach(() => {
    vi.clearAllMocks();
    resetMatTuning();
    setMatTuning('potterRadius', 0);
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    LootSystem.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    clearMat();
    GameState.state.heroes = [recruit('r1')];
    GameState.state.inventory.maxSlots = 50;
    // Fed, so every fight here is a sure win: what these tests check is the drop and the flag,
    // not combat odds (unfed, a new hero loses to this Goblin about one time in forty). A Steak is
    // eaten from the Bank below a quarter HP and fills the bar; the Goblin hits for 1, a crit 2.
    InventoryManager.addItem('item_steak', 10);
    expect(EquipmentManager.equipItem('r1', 'item_steak').success).toBe(true);
    BoardState.setInstantArrival(false);
});
afterEach(() => BoardState.setInstantArrival(true));

describe('a new hero dropped ON a Goblin fights it and wins', () => {
    it('from the hero bar: pinned to the Goblin, fights, kills it, earns Melee XP', () => {
        const goblin = placeAt('fixture_drop_goblin', GOBLIN.x, GOBLIN.y);
        const skillsBefore = JSON.stringify(GameState.state.heroes[0].skills);

        const res = barDrop('r1', GOBLIN);

        expect(res.success).toBe(true);
        expect(res.pinnedTo).toBe(goblin.id);
        expectRecruitWon('r1', goblin, skillsBefore);
    });

    it('by moving their planted flag onto it: pinned to the Goblin, fights, kills it', () => {
        expect(barDrop('r1', { x: 200, y: 950 }).success).toBe(true);
        for (let i = 0; i < 50; i++) BoardRunner.tick(100);
        const goblin = placeAt('fixture_drop_goblin', GOBLIN.x, GOBLIN.y);
        const skillsBefore = JSON.stringify(GameState.state.heroes[0].skills);

        const res = flagDrop('r1', GOBLIN);

        expect(res.success).toBe(true);
        expect(res.pinnedTo).toBe(goblin.id);
        expectRecruitWon('r1', goblin, skillsBefore);
    });
});

describe('a new hero sent to work NEAR a Goblin: never attacked, on every side', () => {
    const SIDES = { right: [1, 0], left: [-1, 0], above: [0, -1], below: [0, 1] };
    const WHERE = { right: 'right of it', left: 'left of it', above: 'above it', below: 'below it' };

    /** The hero out on the mat far up and to the right, then sent to work a Producer beside the Goblin. */
    function nearDrop(side, distance) {
        expect(barDrop('r1', { x: 1500, y: 300 }).success).toBe(true);
        for (let i = 0; i < 50; i++) BoardRunner.tick(100);
        const goblin = placeAt('fixture_drop_goblin', GOBLIN.x, GOBLIN.y);
        const [ux, uy] = SIDES[side];
        const work = placeAt('fixture_producer', GOBLIN.x + ux * distance, GOBLIN.y + uy * distance);
        const res = flagDrop('r1', { x: work.x, y: work.y });
        expect(res.success).toBe(true);
        expect(res.pinnedTo).toBe(work.id);
        return goblin;
    }

    for (const side of Object.keys(SIDES)) {
        it(`${WHERE[side]}, working a Token right beside it: the Goblin leaves the hero alone`, () => {
            const goblin = nearDrop(side, 160);
            const { fought, gone } = play('r1', goblin, 30000);
            expect(fought).toBe(false);
            expect(gone).toBe(false);
            expect(Flags.statusOf('r1').state).toBe('working');
        });
    }

    it('walking past it to a spot far beyond: not attacked on the way', () => {
        expect(barDrop('r1', { x: 200, y: GOBLIN.y }).success).toBe(true);
        for (let i = 0; i < 50; i++) BoardRunner.tick(100);
        const goblin = placeAt('fixture_drop_goblin', GOBLIN.x, GOBLIN.y);
        expect(flagDrop('r1', { x: 1600, y: GOBLIN.y }).success).toBe(true);
        let closest = Infinity;
        for (let t = 0; t < 20000; t += 100) {
            BoardRunner.tick(100);
            const body = HeroMotion.heroPointOf('r1');
            closest = Math.min(closest, Math.hypot(body.x - GOBLIN.x, body.y - GOBLIN.y));
            expect(BoardCombat.fightOfHero('r1')).toBeNull();
        }
        expect(closest).toBeLessThan(160);
        expect(BoardState.getTokenById(goblin.id)).not.toBeNull();
    });
});
