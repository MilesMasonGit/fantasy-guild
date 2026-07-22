import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import * as SkillSystem from '../systems/hero/SkillSystem.js';
import * as EquipmentManager from '../systems/equipment/EquipmentManager.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { getItem } from '../config/registries/itemRegistry.js';
import { getPrimaryWeaponSlot } from '../config/registries/equipmentConstants.js';
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

        EquipmentManager.unequipItem(hero.id, 'chest');
        expect(hero.aggregator.query('DEFENSE')).toBe(0);
    });

    // --- Six equipment slots (Hero Dock Phase 1) ---

    it('should route an item to the slot instance matching its category', () => {
        const hero = generateHero();
        vi.spyOn(HeroManager, 'getHero').mockReturnValue(hero);
        vi.spyOn(InventoryManager, 'hasItem').mockReturnValue(true);

        EquipmentManager.equipItem(hero.id, 'iron_armor');

        expect(hero.equipment.chest).toBe('iron_armor');
        expect(hero.equipment.hand1).toBeNull();
    });

    it('should fill both hands left to right, then swap the first', () => {
        const hero = generateHero();
        vi.spyOn(HeroManager, 'getHero').mockReturnValue(hero);
        vi.spyOn(InventoryManager, 'hasItem').mockReturnValue(true);

        EquipmentManager.equipItem(hero.id, 'longsword_wooden');
        expect(hero.equipment.hand1).toBe('longsword_wooden');
        expect(hero.equipment.hand2).toBeNull();

        EquipmentManager.equipItem(hero.id, 'wooden_bow');
        expect(hero.equipment.hand1).toBe('longsword_wooden');
        expect(hero.equipment.hand2).toBe('wooden_bow');

        // Both hands full — the third weapon displaces hand1, not hand2.
        // (staff_rotten, like the other two, needs only level 1.)
        EquipmentManager.equipItem(hero.id, 'staff_rotten');
        expect(hero.equipment.hand1).toBe('staff_rotten');
        expect(hero.equipment.hand2).toBe('wooden_bow');
    });

    it('should stack damage from both hands', () => {
        const hero = generateHero();
        vi.spyOn(HeroManager, 'getHero').mockReturnValue(hero);
        vi.spyOn(InventoryManager, 'hasItem').mockReturnValue(true);

        EquipmentManager.equipItem(hero.id, 'longsword_wooden');
        EquipmentManager.equipItem(hero.id, 'wooden_bow');

        const expected = getItem('longsword_wooden').damage + getItem('wooden_bow').damage;
        expect(hero.aggregator.query('DAMAGE')).toBe(expected);
    });

    it('should treat the first occupied hand as the primary weapon', () => {
        const hero = generateHero();
        vi.spyOn(HeroManager, 'getHero').mockReturnValue(hero);
        vi.spyOn(InventoryManager, 'hasItem').mockReturnValue(true);

        // A bow alone fights ranged...
        EquipmentManager.equipItem(hero.id, 'wooden_bow');
        expect(getPrimaryWeaponSlot(hero)).toBe('hand1');
        expect(CombatFormulas.getHeroCombatStyle(hero)).toBe('ranged');

        // ...and a sword added to the off hand doesn't change that.
        EquipmentManager.equipItem(hero.id, 'longsword_wooden');
        expect(hero.equipment.hand2).toBe('longsword_wooden');
        expect(CombatFormulas.getHeroCombatStyle(hero)).toBe('ranged');

        // Emptying hand1 promotes hand2 to primary — now melee.
        EquipmentManager.unequipItem(hero.id, 'hand1');
        expect(getPrimaryWeaponSlot(hero)).toBe('hand2');
        expect(CombatFormulas.getHeroCombatStyle(hero)).toBe('melee');
    });

    it('should give every hero all six slots, and no retired ones', () => {
        const hero = generateHero();
        expect(Object.keys(hero.equipment).sort()).toEqual(
            ['chest', 'hand1', 'hand2', 'hat', 'trinket1', 'trinket2']
        );
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
        expect(from.equipment.hand1).toBe('longsword_wooden');

        // The failure mode this guards: equipment is a shared reference, so
        // equipping the target WITHOUT unequipping the source leaves the same
        // item on both heroes whenever the bank holds stock.
        EquipmentManager.equipItem(to.id, 'longsword_wooden');
        expect(from.equipment.hand1).toBe('longsword_wooden'); // still on the source!
        expect(to.equipment.hand1).toBe('longsword_wooden');

        // What the dock's drop handler actually does: source first, then target.
        EquipmentManager.unequipItem(from.id, 'hand1');
        EquipmentManager.equipItem(to.id, 'longsword_wooden');

        expect(from.equipment.hand1).toBeNull();
        expect(to.equipment.hand1).toBe('longsword_wooden');
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
