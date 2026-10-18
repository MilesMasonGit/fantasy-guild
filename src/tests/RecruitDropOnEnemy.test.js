import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as Flags from '../systems/board/Flags.js';
import * as FlagRules from '../systems/board/FlagRules.js';
import * as HeroMotion from '../systems/board/HeroMotion.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { dropOnMat } from '../ui/components/board/dropOnMat.js';
import { DRAG_KIND } from '../ui/dnd/dragConstants.js';
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
 * A new Recruit sent at a Goblin by the player's drop: from the hero bar, or by moving their flag.
 * Everyone fights, so dropped ON the Goblin they pin to it and fight it. Dropped NEAR it, the flag
 * reach and the Goblin's watch decide, as written in `Flags.js` and `Hostiles.js`.
 */

registerTokenTypes({
    /** The Goblin's shape: hostile, one kill and gone, level 1. */
    fixture_drop_goblin: {
        id: 'fixture_drop_goblin', name: 'Fixture Drop Goblin', tokenType: 'enemy',
        rarity: 'common', theme: 'fixture', uses: 1, sprite: 's_occult',
        enemy: { level: 1, style: 'melee', budgetScale: 0.3, hostile: true },
        config: { skill: '', skillRequired: 1, cycleTimeMs: 12000, xp: 0, inputs: [], outputs: [] }
    }
});

const GOBLIN = { x: 880, y: 560 };

/** A freshly hired Recruit: no combat skill, Fight rule as hired (on). */
function recruit(id) {
    const hero = generateHero({ name: id });
    hero.id = id;
    hero.status = 'idle';
    return hero;
}

/** The hero bar's drop (a hero not yet on the mat) and the planted flag's drop. */
const barDrop = (heroId, point) => dropOnMat({ kind: DRAG_KIND.HERO, heroId, from: { dock: true } }, point);
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
    // No combat XP until promotion: no skill moved and no combat skill appeared.
    expect(JSON.stringify(hero.skills)).toBe(skillsBefore);
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
    setMatTuning('enemyPotterRadius', 0);
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    LootSystem.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    clearMat();
    GameState.state.heroes = [recruit('r1')];
    GameState.state.inventory.maxSlots = 50;
    BoardState.setInstantArrival(false);
});
afterEach(() => BoardState.setInstantArrival(true));

describe('a Recruit dropped ON a Goblin fights it and wins', () => {
    it('from the hero bar: pinned to the Goblin, fights, kills it, earns no combat XP', () => {
        const goblin = placeAt('fixture_drop_goblin', GOBLIN.x, GOBLIN.y);
        const skillsBefore = JSON.stringify(GameState.state.heroes[0].skills);

        const res = barDrop('r1', GOBLIN);

        expect(res.success).toBe(true);
        expect(res.pinnedTo).toBe(goblin.id);
        expect(res.pinRefused).toBeNull();
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

describe('a Recruit dropped NEAR a hostile Goblin: it watches the flag, the same on every side', () => {
    /**
     * A hostile enemy attacks a hero whose FLAG stands inside the flag radius around it, wherever
     * the hero's body is. The Recruit's Fight rule is off here, so only the Goblin's watch can
     * start a fight (an attacked hero fights back whatever their rules say).
     */
    const SIDES = { right: [1, 0], left: [-1, 0], above: [0, -1], below: [0, 1] };
    const WHERE = { right: 'right of it', left: 'left of it', above: 'above it', below: 'below it' };

    /** The Recruit out on the mat far up and to the right, then their flag moved beside the Goblin. */
    function nearDrop(side, distance) {
        Flags.setRule('r1', FlagRules.FIGHT, { allowed: false });
        expect(barDrop('r1', { x: 1500, y: 300 }).success).toBe(true);
        for (let i = 0; i < 50; i++) BoardRunner.tick(100);
        const goblin = placeAt('fixture_drop_goblin', GOBLIN.x, GOBLIN.y);
        const [ux, uy] = SIDES[side];
        const res = flagDrop('r1', { x: GOBLIN.x + ux * distance, y: GOBLIN.y + uy * distance });
        expect(res.success).toBe(true);
        expect(res.pinnedTo).toBeNull();
        return goblin;
    }

    for (const side of Object.keys(SIDES)) {
        it(`${WHERE[side]}, the flag inside its watch: the Goblin attacks and the Recruit wins`, () => {
            const goblin = nearDrop(side, 150);
            const { fought, gone } = play('r1', goblin);
            expect(fought).toBe(true);
            expect(gone).toBe(true);
        });

        it(`${WHERE[side]}, the flag outside its watch: the Goblin leaves the Recruit alone`, () => {
            const goblin = nearDrop(side, 200);
            const { fought, gone } = play('r1', goblin, 30000);
            expect(fought).toBe(false);
            expect(gone).toBe(false);
            expect(Flags.ambusherOf('r1')).toBeNull();
            expect(Flags.statusOf('r1').state).toBe('idle');
        });
    }

    it('attacked as soon as the flag lands inside its watch, while the Recruit is still far away', () => {
        const goblin = nearDrop('left', 150);
        BoardRunner.tick(300);
        expect(Flags.ambusherOf('r1')).toBe(goblin.id);
        const body = HeroMotion.heroPointOf('r1');
        expect(Math.hypot(body.x - GOBLIN.x, body.y - GOBLIN.y)).toBeGreaterThan(Flags.flagRadius());
    });

    it('walking past it to a flag far beyond: not attacked on the way', () => {
        Flags.setRule('r1', FlagRules.FIGHT, { allowed: false });
        expect(barDrop('r1', { x: 200, y: GOBLIN.y }).success).toBe(true);
        for (let i = 0; i < 50; i++) BoardRunner.tick(100);
        const goblin = placeAt('fixture_drop_goblin', GOBLIN.x, GOBLIN.y);
        expect(flagDrop('r1', { x: 1600, y: GOBLIN.y }).success).toBe(true);
        let closest = Infinity;
        for (let t = 0; t < 20000; t += 100) {
            BoardRunner.tick(100);
            const body = HeroMotion.heroPointOf('r1');
            closest = Math.min(closest, Math.hypot(body.x - GOBLIN.x, body.y - GOBLIN.y));
            expect(Flags.ambusherOf('r1')).toBeNull();
        }
        expect(closest).toBeLessThan(Flags.flagRadius());
        expect(BoardState.getTokenById(goblin.id)).not.toBeNull();
    });
});
