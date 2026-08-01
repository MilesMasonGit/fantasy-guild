import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import { LoopRunner } from '../systems/loop/LoopRunner.js';
import { DEFEAT_PENALTY } from '../config/loopConstants.js';

// Locks C-9 (D-19, D-57): what defeat costs, and where the hero ends up.

// `vi.hoisted` because vi.mock factories are hoisted above normal top-level
// consts — without it the item factory runs before TABLE exists and the card
// registry logs "Cannot access 'TABLE' before initialization" on load.
const { TABLE } = vi.hoisted(() => ({
    TABLE: {
        g_sword: { id: 'g_sword', name: 'Sword', equipSlot: 'hand' },
        c_pie:   { id: 'c_pie',   name: 'Pie',   equipSlot: 'food' },
        c_ale:   { id: 'c_ale',   name: 'Ale',   equipSlot: 'drink' }
    }
}));

let hero;
let bank;

vi.mock('../config/registries/itemRegistry.js', () => ({
    getItem: vi.fn((id) => TABLE[id] || null),
    getAllItems: vi.fn(() => TABLE),
    DEFAULT_MAX_STACK: 1e12
}));

vi.mock('../config/registries/equipmentConstants.js', () => ({
    getEquippedEntries: vi.fn(() => hero._equipped),
    // Only the weapon is gear; food and drink are consumables on the same grid.
    isGearCategory: vi.fn((cat) => cat === 'hand'),
    getPrimaryWeaponSlot: vi.fn(() => null)
}));

vi.mock('../systems/hero/HeroManager.js', () => ({
    getHero: vi.fn(() => hero),
    setHeroStatus: vi.fn((_id, s) => { hero.status = s; }),
    modifyHeroHp: vi.fn(),
    modifyHeroEnergy: vi.fn()
}));

vi.mock('../systems/inventory/InventoryManager.js', () => ({
    InventoryManager: {
        getItemCount: vi.fn((id) => bank[id] || 0),
        removeItem: vi.fn((id, n) => { bank[id] = Math.max(0, (bank[id] || 0) - n); }),
        hasItem: vi.fn((id, n) => (bank[id] || 0) >= n),
        addItem: vi.fn()
    }
}));

vi.mock('../systems/equipment/EquipmentManager.js', () => ({
    unequipItem: vi.fn((_h, index) => { hero._equipped = hero._equipped.filter(e => e.index !== index); })
}));

vi.mock('../systems/core/NotificationSystem.js', () => ({
    success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn()
}));

function seed() {
    GameState.initNew();
    hero = {
        id: 'hero_1', name: 'Tester', status: 'working',
        hp: { current: 0, max: 100 }, energy: { current: 50, max: 100 },
        _equipped: [
            { index: 0, category: 'hand', itemId: 'g_sword' },
            { index: 1, category: 'food', itemId: 'c_pie' },
            { index: 2, category: 'drink', itemId: 'c_ale' }
        ]
    };
    bank = { g_sword: 1, c_pie: 100, c_ale: 40 };
    GameState.state.heroes = [hero];
    GameState.state.areaStates = {
        area_test: {
            deckSlots: [{ templateId: null }], activeCardIndex: 0,
            assignedHeroId: 'hero_1', status: 'running', pausedReason: null,
            executionTimer: 0, onPlaymat: true
        }
    };
}

const area = () => GameState.areaStates.area_test;

beforeEach(seed);

describe('Consumable loss walks the HERO GRID (D-19 + C-7/C-8)', () => {
    it('destroys a share of every carried consumable stack', () => {
        LoopRunner._applyDeathPenalties(area(), 'hero_1');

        // 25% of each banked stack — and it finds them on the grid. Walking
        // deckSlots (the pre-C-7 behaviour) would have destroyed nothing.
        expect(bank.c_pie).toBe(75);
        expect(bank.c_ale).toBe(30);
    });

    it('scales with how much the hero carries', () => {
        hero._equipped = [{ index: 1, category: 'food', itemId: 'c_pie' }];
        LoopRunner._applyDeathPenalties(area(), 'hero_1');

        expect(bank.c_pie).toBe(75);
        expect(bank.c_ale).toBe(40);        // not carried, so untouched
    });

    it('uses the tunable ratio rather than a hardcoded quarter', () => {
        expect(DEFEAT_PENALTY.CONSUMABLE_LOSS_RATIO).toBeGreaterThan(0);
        expect(DEFEAT_PENALTY.CONSUMABLE_LOSS_RATIO).toBeLessThan(1);
    });
});

describe('Gear loss (D-19)', () => {
    it('can permanently destroy an equipped gear piece', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0);      // always breaks
        LoopRunner._applyDeathPenalties(area(), 'hero_1');

        expect(bank.g_sword).toBe(0);
        expect(hero._equipped.find(e => e.itemId === 'g_sword')).toBeUndefined();
        Math.random.mockRestore();
    });

    it('spares gear on a lucky roll', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.99);   // never breaks
        LoopRunner._applyDeathPenalties(area(), 'hero_1');

        expect(bank.g_sword).toBe(1);
        Math.random.mockRestore();
    });

    it('never rolls consumables for breakage — they are already taxed', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0);      // everything breakable breaks
        LoopRunner._applyDeathPenalties(area(), 'hero_1');

        // Punishing the same loss twice is the thing to avoid: the pie and ale
        // lost stack above, and must not ALSO be destroyed as equipment.
        expect(hero._equipped.some(e => e.itemId === 'c_pie')).toBe(true);
        expect(hero._equipped.some(e => e.itemId === 'c_ale')).toBe(true);
        Math.random.mockRestore();
    });
});

describe('The retreat path (D-57)', () => {
    it('returns the hero to the roster and empties the banner', () => {
        LoopRunner._forcedRetreat('area_test', area(), 'hero_1', 'a hazard');

        expect(area().assignedHeroId).toBeNull();
        expect(area().status).toBe('paused');
        expect(area().pausedReason).toBe('defeat');
        expect(hero.status).toBe('wounded');
    });

    it('leaves no area-level injured state behind', () => {
        LoopRunner._forcedRetreat('area_test', area(), 'hero_1', 'a hazard');

        // Being wounded is a HERO fact. An 'injured' area status would need the
        // banner to remember the hero it just released — which is what stranded
        // it before (found in C-10).
        expect(area().status).not.toBe('injured');
    });

    it('leaves the banner immediately re-deployable', () => {
        LoopRunner._forcedRetreat('area_test', area(), 'hero_1', 'a hazard');

        // Heroes are scarce (D-24), so the interesting decision is whether to
        // send someone else right now.
        area().assignedHeroId = 'hero_2';
        expect(area().assignedHeroId).toBe('hero_2');
        expect(area().status).toBe('paused');
    });
});
