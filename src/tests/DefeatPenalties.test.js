import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import { applyDefeatPenalties } from '../systems/combat/DefeatPenalties.js';
import { DEFEAT_PENALTY } from '../config/loopConstants.js';

// Locks D-74: what losing a fight costs.
//
// Re-homed by the playmat rework (Phase 1). These rules lived in
// `LoopRunner._applyDeathPenalties`; the loop is deleted, the rules are not, so
// they moved to `systems/combat/DefeatPenalties.js` and this suite followed.
//
// The old "retreat path" block went with the loop — it asserted that a defeated
// hero left the AREA in a re-deployable state, and there are no areas. Its
// board successor (the hero leaves the tile, the tile idles until re-staffed)
// is Phase 6's to pin.

// `vi.hoisted` because vi.mock factories are hoisted above normal top-level
// consts — without it the item factory runs before TABLE exists and the card
// registry logs "Cannot access 'TABLE' before initialization" on load.
const { TABLE } = vi.hoisted(() => ({
    TABLE: {
        g_sword:  { id: 'g_sword',  name: 'Sword',  equipSlot: 'hand' },
        c_pie:    { id: 'c_pie',    name: 'Pie',    equipSlot: 'food' },
        c_ale:    { id: 'c_ale',    name: 'Ale',    equipSlot: 'drink' },
        c_potion: { id: 'c_potion', name: 'Potion', equipSlot: 'consumable' }
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
    // Only the weapon is gear; food and drink are sustenance on the same grid.
    isGearCategory: vi.fn((cat) => cat === 'hand'),
    // The Prep Phase class (potions/scrolls/runes) — mirrors the real registry,
    // where `consumable` is the only id of kind CONSUMABLE.
    isConsumableCategory: vi.fn((cat) => cat === 'consumable'),
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
            { index: 2, category: 'drink', itemId: 'c_ale' },
            { index: 3, category: 'consumable', itemId: 'c_potion' }
        ]
    };
    bank = { g_sword: 1, c_pie: 100, c_ale: 40, c_potion: 80 };
    GameState.state.heroes = [hero];
}

beforeEach(seed);

describe('Consumable loss walks the HERO GRID (D-19 + C-7/C-8)', () => {
    it('destroys a share of every carried consumable stack', () => {
        applyDefeatPenalties('hero_1');

        // 25% of each banked stack — and it finds them on the grid. Walking
        // deckSlots (the pre-C-7 behaviour) would have destroyed nothing.
        expect(bank.c_pie).toBe(75);
        expect(bank.c_ale).toBe(30);
    });

    it('scales with how much the hero carries', () => {
        hero._equipped = [{ index: 1, category: 'food', itemId: 'c_pie' }];
        applyDefeatPenalties('hero_1');

        expect(bank.c_pie).toBe(75);
        expect(bank.c_ale).toBe(40);        // not carried, so untouched
    });

    // Owner decision 2026-08-25 (CR2-079). The Consumable class is dormant:
    // nothing calls `consumeLoopConsumables` and nothing reads `loopEffect`, so
    // an equipped potion is never spent. Until the Prep Phase is wired, the slot
    // must not cost the player anything.
    it('exempts the dormant Consumable class from stack loss', () => {
        applyDefeatPenalties('hero_1');

        expect(bank.c_potion).toBe(80);
    });

    it('still taxes food and drink, which are not exempt', () => {
        applyDefeatPenalties('hero_1');

        expect(bank.c_pie).toBe(75);        // eaten for real by tryEat
        expect(bank.c_ale).toBe(30);        // dormant, but by its own D-183/184 decision
    });

    it('uses the tunable ratio rather than a hardcoded quarter', () => {
        expect(DEFEAT_PENALTY.CONSUMABLE_LOSS_RATIO).toBeGreaterThan(0);
        expect(DEFEAT_PENALTY.CONSUMABLE_LOSS_RATIO).toBeLessThan(1);
    });
});

describe('Gear loss (D-19)', () => {
    it('can permanently destroy an equipped gear piece', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0);      // always breaks
        applyDefeatPenalties('hero_1');

        expect(bank.g_sword).toBe(0);
        expect(hero._equipped.find(e => e.itemId === 'g_sword')).toBeUndefined();
        Math.random.mockRestore();
    });

    it('spares gear on a lucky roll', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.99);   // never breaks
        applyDefeatPenalties('hero_1');

        expect(bank.g_sword).toBe(1);
        Math.random.mockRestore();
    });

    it('never rolls consumables for breakage — they are already taxed', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0);      // everything breakable breaks
        applyDefeatPenalties('hero_1');

        // Punishing the same loss twice is the thing to avoid: the pie and ale
        // lost stack above, and must not ALSO be destroyed as equipment.
        expect(hero._equipped.some(e => e.itemId === 'c_pie')).toBe(true);
        expect(hero._equipped.some(e => e.itemId === 'c_ale')).toBe(true);
        Math.random.mockRestore();
    });
});
