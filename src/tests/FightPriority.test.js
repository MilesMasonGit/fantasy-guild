import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as Flags from '../systems/board/Flags.js';
import * as FlagRules from '../systems/board/FlagRules.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { placeAt, clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * The Combat rule ranks against work skills exactly like a work skill does: the flag's chooser
 * sorts enemies and work Tokens together by the hero's priority for each, so a Work Permissions
 * Combat cell in priority mode means what it says.
 */

registerTokenTypes({
    fp_peaceful: {
        id: 'fp_peaceful', name: 'Peaceful Beast', tokenType: 'enemy',
        rarity: 'common', theme: 'fixture', uses: 1, sprite: 's_occult',
        enemy: { level: 1, style: 'melee', budgetScale: 0.3 },
        config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
    }
});

const FLAG = { x: 800, y: 500 };

/** A Recruit who logs and holds no combat skill, so fights as a level 1 fighter. */
const recruit = (id) => ({ id, name: id, status: 'idle', level: 1, skills: { forestry: { level: 10, xp: 0 } }, hp: { current: 100, max: 100 } });

/** A producer right under the flag and a peaceful enemy further off, both within reach. */
function layout() {
    const producer = placeAt('fixture_producer', FLAG.x + 60, FLAG.y);
    const enemy = placeAt('fp_peaceful', FLAG.x + 220, FLAG.y);
    return { producer, enemy };
}

const claimed = (heroId) => BoardState.claimOfHero(heroId)?.instanceId ?? null;

beforeAll(() => { Flags.init(); BoardCombat.init(); });
afterAll(() => { Flags.teardown(); resetMatTuning(); });

beforeEach(() => {
    resetMatTuning();
    setMatTuning('flagRadius', 300);
    setMatTuning('potterRadius', 0);
    setMatTuning('enemyPotterRadius', 0);
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    clearMat();
    GameState.state.heroes = [recruit('r1')];
});

describe('the Combat rule takes a priority the chooser honours', () => {
    it('at equal priority the nearer work wins', () => {
        const { producer } = layout();
        Flags.plant('r1', FLAG);
        expect(claimed('r1')).toBe(producer.id);
    });

    it('Combat at 1 over Forestry at 2 sends the hero to the further enemy', () => {
        const { enemy } = layout();
        expect(Flags.setRule('r1', FlagRules.FIGHT, { allowed: true, priority: 1 }).success).toBe(true);
        Flags.setRule('r1', 'forestry', { allowed: true, priority: 2 });
        Flags.plant('r1', FLAG);
        expect(FlagRules.ruleOf('r1', FlagRules.FIGHT)).toEqual({ allowed: true, priority: 1 });
        expect(claimed('r1')).toBe(enemy.id);
    });

    it('Combat switched off keeps the hero on work even when Combat outranks it', () => {
        const { producer } = layout();
        Flags.setRule('r1', 'forestry', { allowed: false });
        Flags.setRule('r1', FlagRules.FIGHT, { allowed: false });
        Flags.plant('r1', FLAG);
        expect(claimed('r1')).toBeNull();
        Flags.setRule('r1', 'forestry', { allowed: true, priority: 5 });
        Flags.assignHero('r1');
        expect(claimed('r1')).toBe(producer.id);
    });
});
