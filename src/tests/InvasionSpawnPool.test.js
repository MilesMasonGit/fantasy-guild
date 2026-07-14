import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import { spawnInvasionCard } from '../systems/cards/logic/EventProcessor.js';
import { processCombat } from '../systems/cards/logic/CombatProcessor.js';
import { getAreaSet, getEnemy } from '../config/registries/index.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import * as CombatFormulas from '../utils/CombatFormulas.js';

describe('Invasion Spawning Pool and Scaling Logic', () => {
    beforeEach(() => {
        GameState.initNew();
        // Clear active cards and hero list
        GameState.state.cards.active = [];
        GameState.state.heroes = [];
        GameState.state.bench = [];

        vi.spyOn(CombatFormulas, 'rollHit').mockReturnValue(true);
        vi.spyOn(CombatFormulas, 'computeHeroDamage').mockReturnValue(100);
    });

    it('should scale horde size equal to the highest combat level hero (or default to 1 if no heroes)', () => {
        // 1. Check with no heroes (defaults to 1)
        let card = spawnInvasionCard('area_guild_hall');
        expect(card).not.toBeNull();
        expect(card.hordeCount).toBe(1);
        expect(card.hordeTotal).toBe(1);

        // Remove the card
        GameState.state.cards.active = [];

        // 2. Add some heroes with levels.
        // Combat Level = average of the 4 combat skills (melee/ranged/magic/defense).
        const hero1 = generateHero();
        hero1.skills.melee.level = 8; // CL = (8+1+1+1)/4 ≈ 3
        GameState.state.heroes.push(hero1);

        const hero2 = generateHero();
        hero2.skills.magic.level = 17; // CL = (1+1+17+1)/4 = 5
        GameState.state.bench.push(hero2); // Benched hero still counts!

        card = spawnInvasionCard('area_guild_hall');
        expect(card).not.toBeNull();
        expect(card.hordeCount).toBe(5);
        expect(card.hordeTotal).toBe(5);
    });

    it('should select a random enemy from the area invasionSpawnPool', () => {
        const areaSet = getAreaSet('area_guild_hall');
        expect(areaSet.invasionSpawnPool).toBeDefined();
        expect(areaSet.invasionSpawnPool.length).toBeGreaterThan(0);

        const card = spawnInvasionCard('area_guild_hall');
        expect(areaSet.invasionSpawnPool).toContain(card.enemyId);
        const combatTrait = card.traits.find(t => t.type === 'combat');
        expect(combatTrait.enemyId).toBe(card.enemyId);
    });

    it('should preserve the same enemy type on sequential defeats and clear the invasion on final defeat', () => {
        // Setup a hero at Combat Level 3 (all 4 combat skills at 3), so horde has 3 members
        const hero = generateHero();
        for (const skillId of ['melee', 'ranged', 'magic', 'defense']) {
            hero.skills[skillId].level = 3;
        }
        GameState.state.heroes.push(hero);

        const card = spawnInvasionCard('area_guild_hall');
        expect(card.hordeCount).toBe(3);

        const areaSet = getAreaSet('area_guild_hall');
        const initialEnemyId = card.enemyId;

        // Assign hero to the card for combat processing
        card.assignedHeroId = hero.id;

        // Force initialize combat namespace
        card.combat = {
            enemyHp: { current: 1, max: 10 },
            state: { intermissionTimer: 0 },
            heroTickProcesses: { [hero.id]: 3000 },
            stats: { attackSpeed: 3000 }
        };

        // Process combat - this should defeat the current enemy because enemy HP is 1 and hero attacks
        processCombat(card, card.traits.find(t => t.type === 'combat'), 0);

        // hordeCount should be decremented to 2
        expect(card.hordeCount).toBe(2);
        // The enemy ID should still be the same
        expect(card.enemyId).toBe(initialEnemyId);

        // Prepare for the second kill
        card.combat.enemyHp = { current: 1, max: 10 };
        card.combat.heroTickProcesses[hero.id] = 3000;
        card.status = 'active';

        processCombat(card, card.traits.find(t => t.type === 'combat'), 0);
        expect(card.hordeCount).toBe(1);
        expect(card.enemyId).toBe(initialEnemyId);

        // Third and final kill
        card.combat.enemyHp = { current: 1, max: 10 };
        card.combat.heroTickProcesses[hero.id] = 3000;
        card.status = 'active';

        // Clear the invasion threat in the area state so we can verify it gets reset
        const areaState = GameState.state.areaStates['area_guild_hall'];
        if (areaState) {
            areaState.activeInvasionId = card.invasionId;
            areaState.invasionThreat = 50;
        }

        processCombat(card, card.traits.find(t => t.type === 'combat'), 0);
        expect(card.hordeCount).toBe(0);

        // Invasion should be cleared in area state
        if (areaState) {
            expect(areaState.activeInvasionId).toBeNull();
            expect(areaState.invasionThreat).toBe(0);
        }
    });
});
