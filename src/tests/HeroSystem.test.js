import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import * as SkillSystem from '../systems/hero/SkillSystem.js';
import * as EquipmentManager from '../systems/equipment/EquipmentManager.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { getItem } from '../config/registries/itemRegistry.js';
import { getPrimaryWeaponSlot, GRID_SLOT_COUNT } from '../config/registries/equipmentConstants.js';
import { ITEMS } from '../config/registries/itemRegistry.js';
import * as CombatFormulas from '../utils/CombatFormulas.js';
import { GameState } from '../state/GameState.js';
import { INITIAL_STATE } from '../state/StateSchema.js';
import { RecruitSystem } from '../systems/cards/RecruitSystem.js';

describe('Hero System Enhancements', () => {
    beforeEach(() => {
        // Clear state or mock as needed
        vi.clearAllMocks();
    });

    it('should generate a hero with all 15 skills at level 1', () => {
        const hero = generateHero();
        const skillCount = Object.keys(hero.skills).length;
        expect(skillCount).toBe(15);
        for (const skill of Object.values(hero.skills)) {
            expect(skill.level).toBe(1);
        }
    });

    it('should NOT apply class/trait modifiers (cosmetic only)', () => {
        const hero = generateHero({ traitId: 'nimble', classId: 'wizard' });
        const allModifiers = Array.from(hero.aggregator.modifiers.values()).flat();
        expect(allModifiers.length).toBe(0);
    });

    it('should add modifiers when equipping an item', () => {
        const hero = generateHero();
        // Mock HeroManager.getHero to return our test hero
        vi.spyOn(HeroManager, 'getHero').mockReturnValue(hero);
        vi.spyOn(InventoryManager, 'hasItem').mockReturnValue(true);

        EquipmentManager.equipItem(hero.id, 'iron_armor');
        
        const defenseBonus = hero.aggregator.query('DEFENSE');
        const itemTemplate = getItem('iron_armor');
        expect(defenseBonus).toBe(itemTemplate.defense);
    });

    it('should remove modifiers when unequipping an item', () => {
        const hero = generateHero();
        vi.spyOn(HeroManager, 'getHero').mockReturnValue(hero);
        vi.spyOn(InventoryManager, 'hasItem').mockReturnValue(true);

        EquipmentManager.equipItem(hero.id, 'iron_armor');
        expect(hero.aggregator.query('DEFENSE')).toBeGreaterThan(0);

        EquipmentManager.unequipItem(hero.id, 0);
        expect(hero.aggregator.query('DEFENSE')).toBe(0);
    });

    // --- The nine-slot loadout grid (D-7/D-54/D-55) ---

    it('places an item in the first free grid slot, whatever its category', () => {
        const hero = generateHero();
        vi.spyOn(HeroManager, 'getHero').mockReturnValue(hero);
        vi.spyOn(InventoryManager, 'hasItem').mockReturnValue(true);

        EquipmentManager.equipItem(hero.id, 'iron_armor');

        expect(hero.equipment[0]).toBe('iron_armor');
        expect(hero.equipment[1]).toBeNull();
    });

    it('fills successive slots, then displaces the oldest once the cap is hit', () => {
        const hero = generateHero();
        vi.spyOn(HeroManager, 'getHero').mockReturnValue(hero);
        vi.spyOn(InventoryManager, 'hasItem').mockReturnValue(true);

        // `hand` caps at 2 (D-55).
        EquipmentManager.equipItem(hero.id, 'longsword_wooden');
        expect(hero.equipment[0]).toBe('longsword_wooden');

        EquipmentManager.equipItem(hero.id, 'wooden_bow');
        expect(hero.equipment[1]).toBe('wooden_bow');

        // At the cap, a third weapon replaces the EARLIEST one rather than
        // taking a new slot — the old "swaps hand1" behaviour, without hands.
        EquipmentManager.equipItem(hero.id, 'staff_rotten');
        expect(hero.equipment[0]).toBe('staff_rotten');
        expect(hero.equipment[1]).toBe('wooden_bow');
    });

    it('should stack damage from both weapons', () => {
        const hero = generateHero();
        vi.spyOn(HeroManager, 'getHero').mockReturnValue(hero);
        vi.spyOn(InventoryManager, 'hasItem').mockReturnValue(true);

        EquipmentManager.equipItem(hero.id, 'longsword_wooden');
        EquipmentManager.equipItem(hero.id, 'wooden_bow');

        const expected = getItem('longsword_wooden').damage + getItem('wooden_bow').damage;
        expect(hero.aggregator.query('DAMAGE')).toBe(expected);
    });

    it('treats the first weapon in grid order as the primary', () => {
        const hero = generateHero();
        vi.spyOn(HeroManager, 'getHero').mockReturnValue(hero);
        vi.spyOn(InventoryManager, 'hasItem').mockReturnValue(true);

        // A bow alone fights ranged...
        EquipmentManager.equipItem(hero.id, 'wooden_bow');
        expect(getPrimaryWeaponSlot(hero)).toBe(0);
        expect(CombatFormulas.getHeroCombatStyle(hero)).toBe('ranged');

        // ...and a sword in a later slot doesn't change that.
        EquipmentManager.equipItem(hero.id, 'longsword_wooden');
        expect(hero.equipment[1]).toBe('longsword_wooden');
        expect(CombatFormulas.getHeroCombatStyle(hero)).toBe('ranged');

        // Emptying the first promotes the next weapon — now melee.
        EquipmentManager.unequipItem(hero.id, 0);
        expect(getPrimaryWeaponSlot(hero)).toBe(1);
        expect(CombatFormulas.getHeroCombatStyle(hero)).toBe('melee');
    });

    it('gives every hero exactly GRID_SLOT_COUNT empty slots', () => {
        const hero = generateHero();
        expect(Array.isArray(hero.equipment)).toBe(true);
        expect(hero.equipment).toHaveLength(GRID_SLOT_COUNT);
        expect(hero.equipment.every(slot => slot === null)).toBe(true);
    });

    // D-7: gear and consumables share one pool of nine, so the ratio between
    // them is the player's decision, not a fixed layout.
    it('holds gear and consumables in the same grid', () => {
        const hero = generateHero();
        vi.spyOn(HeroManager, 'getHero').mockReturnValue(hero);
        vi.spyOn(InventoryManager, 'hasItem').mockReturnValue(true);

        EquipmentManager.equipItem(hero.id, 'iron_armor');
        const food = Object.values(ITEMS).find(i => i.equipSlot === 'food');
        if (food) {
            expect(EquipmentManager.equipItem(hero.id, food.id).success).toBe(true);
            expect(hero.equipment).toContain(food.id);
        }
        expect(hero.equipment).toContain('iron_armor');
    });

    // D-55: the cap is a property of the CATEGORY.
    it('refuses nothing outright — a capped category displaces instead', () => {
        const hero = generateHero();
        vi.spyOn(HeroManager, 'getHero').mockReturnValue(hero);
        vi.spyOn(InventoryManager, 'hasItem').mockReturnValue(true);

        EquipmentManager.equipItem(hero.id, 'iron_armor');
        const otherChest = Object.values(ITEMS).find(
            i => i.equipSlot === 'chest' && i.id !== 'iron_armor'
        );
        if (otherChest) {
            EquipmentManager.equipItem(hero.id, otherChest.id);
            // chest caps at 1, so only one is ever carried.
            const chestCount = hero.equipment.filter(
                id => id && getItem(id)?.equipSlot === 'chest'
            ).length;
            expect(chestCount).toBe(1);
        }
    });

    // D-18: carrying the same item twice buffs nothing, so it is refused.
    it('refuses a duplicate of an item already equipped', () => {
        const hero = generateHero();
        vi.spyOn(HeroManager, 'getHero').mockReturnValue(hero);
        vi.spyOn(InventoryManager, 'hasItem').mockReturnValue(true);

        expect(EquipmentManager.equipItem(hero.id, 'iron_armor').success).toBe(true);
        const second = EquipmentManager.equipItem(hero.id, 'iron_armor');
        expect(second.success).toBe(false);
        expect(second.error).toMatch(/already equipped/i);
    });
});

// --- Bench retirement (Hero Dock Phase 3) ---

describe('Roster cap without a bench', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        GameState.state = structuredClone(INITIAL_STATE);
        GameState.state.progress.rosterLimit = 2;
    });

    it('should have no bench in the initial state', () => {
        expect(INITIAL_STATE.bench).toBeUndefined();
        expect(GameState.state.bench).toBeUndefined();
    });

    it('should refuse a hero once the roster is at its cap', () => {
        expect(HeroManager.addHero(generateHero())).not.toBeNull();
        expect(HeroManager.addHero(generateHero())).not.toBeNull();
        expect(HeroManager.isRosterFull()).toBe(true);

        // The third is refused outright — no bench to overflow onto.
        expect(HeroManager.addHero(generateHero())).toBeNull();
        expect(GameState.state.heroes.length).toBe(2);
    });

    it('should free a slot when a hero retires', () => {
        const first = generateHero();
        // Retirement is refused unless the payout beats the recruit cost, so
        // this hero needs some investment behind them to be retirable at all.
        Object.values(first.skills).forEach(skill => { skill.level = 5; });

        HeroManager.addHero(first);
        HeroManager.addHero(generateHero());
        expect(HeroManager.isRosterFull()).toBe(true);

        expect(HeroManager.retireHero(first.id).success).toBe(true);
        expect(HeroManager.isRosterFull()).toBe(false);
        expect(HeroManager.addHero(generateHero())).not.toBeNull();
    });

    it('should track the cap from the Guild Hall roster_size rank', () => {
        GameState.state.progress.rosterLimit = 3;
        HeroManager.addHero(generateHero());
        HeroManager.addHero(generateHero());
        expect(HeroManager.isRosterFull()).toBe(false);
        expect(HeroManager.addHero(generateHero())).not.toBeNull();
        expect(HeroManager.isRosterFull()).toBe(true);
    });

    it('hero-to-hero transfer must strip the source first (Hero Dock Phase 6)', () => {
        const from = generateHero();
        const to = generateHero();
        HeroManager.addHero(from);
        HeroManager.addHero(to);
        vi.spyOn(InventoryManager, 'hasItem').mockReturnValue(true);

        EquipmentManager.equipItem(from.id, 'longsword_wooden');
        expect(from.equipment[0]).toBe('longsword_wooden');

        // The failure mode this guards: equipment is a shared reference, so
        // equipping the target WITHOUT unequipping the source leaves the same
        // item on both heroes whenever the bank holds stock.
        EquipmentManager.equipItem(to.id, 'longsword_wooden');
        expect(from.equipment[0]).toBe('longsword_wooden'); // still on the source!
        expect(to.equipment[0]).toBe('longsword_wooden');

        // What the dock's drop handler actually does: source first, then target.
        EquipmentManager.unequipItem(from.id, 0);
        EquipmentManager.equipItem(to.id, 'longsword_wooden');

        expect(from.equipment[0]).toBeNull();
        expect(to.equipment[0]).toBe('longsword_wooden');
    });

    it('should refuse to hire at the cap WITHOUT charging Influence', () => {
        HeroManager.addHero(generateHero());
        HeroManager.addHero(generateHero());

        GameState.state.currency.influence = 99999;
        const candidate = generateHero();
        GameState.state.recruitment.candidates = [candidate];

        const before = GameState.state.currency.influence;
        const result = RecruitSystem.hireCandidate(candidate.id);

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/roster full/i);
        expect(GameState.state.currency.influence).toBe(before);
        // The candidate survives, so the player can retire someone and retry.
        expect(GameState.state.recruitment.candidates.length).toBe(1);
    });

    it('should allow XP gain for the defense skill', () => {
        const hero = generateHero();
        vi.spyOn(HeroManager, 'getHero').mockReturnValue(hero);

        const result = SkillSystem.addXP(hero.id, 'defense', 100);
        expect(result.success).toBe(true);
        expect(result.targetSkillId).toBe('defense');
    });

    it('should level all 15 skills independently', () => {
        const hero = generateHero();
        vi.spyOn(HeroManager, 'getHero').mockReturnValue(hero);

        SkillSystem.addXP(hero.id, 'labor', 5000);
        expect(hero.skills.labor.level).toBeGreaterThan(1);
        // Other skills are untouched
        expect(hero.skills.forge.level).toBe(1);
        expect(hero.skills.melee.level).toBe(1);
    });

    it('should funnel sub-skill XP into the new parents', () => {
        const hero = generateHero();
        vi.spyOn(HeroManager, 'getHero').mockReturnValue(hero);

        const result = SkillSystem.addXP(hero.id, 'mining', 100);
        expect(result.success).toBe(true);
        expect(result.targetSkillId).toBe('labor');

        const result2 = SkillSystem.addXP(hero.id, 'fishing', 100);
        expect(result2.targetSkillId).toBe('aquatic');
    });
});
