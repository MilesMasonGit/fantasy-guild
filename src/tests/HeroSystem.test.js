import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import * as SkillSystem from '../systems/hero/SkillSystem.js';
import * as EquipmentManager from '../systems/equipment/EquipmentManager.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { getItem } from '../config/registries/itemRegistry.js';
import { GRID_SLOT_COUNT } from '../config/registries/equipmentConstants.js';
import { ITEMS } from '../config/registries/itemRegistry.js';
import { GameState } from '../state/GameState.js';
import { INITIAL_STATE } from '../state/StateSchema.js';
import {
    FOUNDATION_SKILL_IDS,
    COMBAT_SKILL_IDS,
    SHARED_SKILL_IDS,
    SIGNATURE_SKILL_IDS
} from '../config/registries/skillRegistry.js';

describe('Hero System Enhancements', () => {
    beforeEach(() => {
        // Clear state or mock as needed
        vi.clearAllMocks();
    });

    it('generates a Recruit: the Foundation skills at level 1, and nothing else', () => {
        const hero = generateHero();

        // Derived, not a literal count — the list is expected to change.
        expect(Object.keys(hero.skills).sort()).toEqual([...FOUNDATION_SKILL_IDS].sort());
        for (const skill of Object.values(hero.skills)) {
            expect(skill.level).toBe(1);
        }
    });

    it('a Recruit holds NO combat skill, so they cannot fight', () => {
        const hero = generateHero();
        for (const combatId of COMBAT_SKILL_IDS) {
            expect(hero.skills[combatId]).toBeUndefined();
        }
    });

    it('a Recruit holds no specialist skill either — those come from promotion', () => {
        const hero = generateHero();
        for (const id of [...SHARED_SKILL_IDS, ...SIGNATURE_SKILL_IDS]) {
            expect(hero.skills[id]).toBeUndefined();
        }
    });

    // Was "should NOT apply class/trait modifiers (cosmetic only)", and passed
    // a rolled class and trait in. Classes and traits are retired (owner
    // decision 2026-08-18) so there is nothing left to pass; the assertion
    // itself is unchanged and still worth making — a fresh hero must start
    // with an empty modifier pool.
    it('gives a fresh hero no modifiers at all', () => {
        const hero = generateHero();
        const allModifiers = Array.from(hero.aggregator.modifiers.values()).flat();
        expect(allModifiers.length).toBe(0);
    });

    // --- The nine-slot loadout grid (D-7/D-54/D-55) ---

    it('gives every hero exactly GRID_SLOT_COUNT empty slots', () => {
        const hero = generateHero();
        expect(Array.isArray(hero.equipment)).toBe(true);
        expect(hero.equipment).toHaveLength(GRID_SLOT_COUNT);
        expect(hero.equipment.every(slot => slot === null)).toBe(true);
    });

    // D-7: gear and consumables share one pool of nine, so the ratio between
    // them is the player's decision, not a fixed layout.
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
});

// --- The bench, retired in the Hero Dock rework (Phase 3) ---

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

    // "should free a slot when a hero retires" was deleted with the retirement
    // mechanic (owner decision 2026-08-19, CR2-086). Nothing takes a hero off
    // the roster any more, so there is no slot-freeing path left to cover.

    it('should track the cap from the Guild Hall roster_size rank', () => {
        GameState.state.progress.rosterLimit = 3;
        HeroManager.addHero(generateHero());
        HeroManager.addHero(generateHero());
        expect(HeroManager.isRosterFull()).toBe(false);
        expect(HeroManager.addHero(generateHero())).not.toBeNull();
        expect(HeroManager.isRosterFull()).toBe(true);
    });

    it('refuses XP in a skill the hero does not hold', () => {
        const hero = generateHero();          // a Recruit: Foundation only
        vi.spyOn(HeroManager, 'getHero').mockReturnValue(hero);

        const result = SkillSystem.addXP(hero.id, COMBAT_SKILL_IDS[0], 100);
        expect(result.success).toBe(false);
        expect(result.error).toBe('SKILL_NOT_HELD');
    });

    it('levels each held skill independently', () => {
        const hero = generateHero();
        vi.spyOn(HeroManager, 'getHero').mockReturnValue(hero);

        const [first, second] = FOUNDATION_SKILL_IDS;
        SkillSystem.addXP(hero.id, first, 5000);

        expect(hero.skills[first].level).toBeGreaterThan(1);
        expect(hero.skills[second].level).toBe(1);
    });

    it('possession and level are different failures, and say so', () => {
        const hero = generateHero();
        vi.spyOn(HeroManager, 'getHero').mockReturnValue(hero);

        const held = FOUNDATION_SKILL_IDS[0];
        const notHeld = SIGNATURE_SKILL_IDS[0];

        expect(SkillSystem.requirementFailure(hero.id, { skill: held, level: 1 })).toBeNull();
        expect(SkillSystem.requirementFailure(hero.id, { skill: held, level: 50 })).toBe('LEVEL');
        expect(SkillSystem.requirementFailure(hero.id, { skill: notHeld, level: 1 })).toBe('POSSESSION');

        // The hole the Phase 0 baseline pinned: a zero requirement must STILL
        // check possession, or a hero works a skill they do not have.
        expect(SkillSystem.requirementFailure(hero.id, { skill: notHeld, level: 0 })).toBe('POSSESSION');
    });
});
