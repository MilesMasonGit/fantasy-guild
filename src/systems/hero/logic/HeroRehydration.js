import { ModifierAggregator } from '../../effects/ModifierAggregator.js';
import { getClass } from '../../../config/registries/classRegistry.js';
import { getTrait } from '../../../config/registries/traitRegistry.js';
import { skillSpeedBonus } from '../../../config/FormulaRegistry.js';
import { EFFECT_TYPES } from '../../effects/constants.js';
import { calculateHeroLevel } from '../HeroGenerator.js';
import { heroMaxHpFromSkills } from '../../../utils/CombatFormulas.js';
import { GameState } from '../../../state/GameState.js';

/**
 * Hero Rehydration: Restores Logic (Aggregator) and Display data.
 */

export function rehydrateHero(hero) {
    if (!hero) return;

    // 1. Restore Logic (Aggregator)
    hero.aggregator = new ModifierAggregator(hero.id);

    // 2. Lookup Template Data
    const heroClass = hero.classId ? getClass(hero.classId) : null;
    const heroTrait = hero.traitId ? getTrait(hero.traitId) : null;

    // 3. Inject Display Data (classes/traits are cosmetic — no modifiers)
    hero.className = heroClass ? heroClass.name : (hero.isVillager ? 'Villager' : 'Adventurer');
    hero.traitName = heroTrait ? heroTrait.name : '';

    // 4. Skill-based Speed Modifiers (Dynamic)
    updateHeroSkillModifiers(hero);

    // 5. Derived Stats
    hero.level = calculateHeroLevel(hero.skills);
    updateHeroMaxHp(hero);

    // 6. Status effects container (pre-status-system saves lack the key)
    if (!Array.isArray(hero.statuses)) hero.statuses = [];

    // 7. Hero-carried food/drink retired (CR-029) — strip the legacy slots
    //    from older saves before equipment modifiers are recalculated (any
    //    equipped consumable stack stays in the shared bank untouched).
    if (hero.equipment) {
        delete hero.equipment.food;
        delete hero.equipment.drink;
    }
    delete hero.lastEatenAt;
    delete hero.lastDrunkAt;

    // Performance Rev
    hero._rev = (hero._rev || 0) + 1;

    return hero;
}

/**
 * Recompute max HP from combat skills (30·G(CL) + 20·G(Defense)).
 * Villagers keep their flat HP — they don't fight.
 * Raising max keeps current HP as-is (level-ups grant headroom, not a heal);
 * lowering max clamps current down to it.
 */
export function updateHeroMaxHp(hero) {
    if (!hero || hero.isVillager || !hero.skills) return;
    const maxHp = heroMaxHpFromSkills(hero.skills);
    if (!hero.hp) hero.hp = { current: maxHp, max: maxHp };
    hero.hp.max = maxHp;
    hero.hp.current = Math.min(hero.hp.current, maxHp);
}

export function updateHeroSkillModifiers(heroOrId) {
    const hero = typeof heroOrId === 'string' ? lookupHeroById(heroOrId) : heroOrId;
    if (!hero || !hero.aggregator) return;

    // Combat-skill level-ups change max HP and hero level
    updateHeroMaxHp(hero);
    hero.level = calculateHeroLevel(hero.skills);

    // Clear existing skill modifiers first
    for (const skillId of Object.keys(hero.skills)) {
        hero.aggregator.removeModifiersBySource(`skill:${skillId}`);
    }

    // Add fresh modifiers
    for (const [skillId, skillData] of Object.entries(hero.skills)) {
        const level = typeof skillData === 'number' ? skillData : (skillData.level || 0);
        if (level > 0) {
            hero.aggregator.addModifier({
                source: `skill:${skillId}`,
                type: EFFECT_TYPES.SPEED,
                target: { category: skillId.toUpperCase() },
                value: skillSpeedBonus(level),
                persistent: true
            });
        }
    }
}

/**
 * Internal: Lookup helper that doesn't cause circular dependency with HeroLookup.js
 */
function lookupHeroById(heroId) {
    return GameState.heroes.find(h => h.id === heroId) || 
           GameState.bench.find(h => h.id === heroId) || 
           null;
}

