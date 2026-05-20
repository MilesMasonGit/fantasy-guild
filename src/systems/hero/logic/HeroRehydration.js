import { ModifierAggregator } from '../../effects/ModifierAggregator.js';
import { getClass, CLASS_XP_BONUS } from '../../../config/registries/classRegistry.js';
import { getTrait, TRAIT_XP_BONUS } from '../../../config/registries/traitRegistry.js';
import { skillSpeedBonus } from '../../../config/FormulaRegistry.js';
import { EFFECT_TYPES } from '../../effects/constants.js';
import { calculateHeroLevel } from '../HeroGenerator.js';
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

    // 3. Inject Display Data
    hero.className = heroClass ? heroClass.name : (hero.isVillager ? 'Villager' : 'Adventurer');
    hero.traitName = heroTrait ? heroTrait.name : '';

    // 4. Re-apply Static Modifiers (Structural persistence)
    applyClassModifiers(hero, heroClass);
    applyTraitModifiers(hero, heroTrait);

    // 5. Skill-based Speed Modifiers (Dynamic)
    updateHeroSkillModifiers(hero);

    // 6. Derived Stats
    hero.level = calculateHeroLevel(hero.skills);
    
    // Performance Rev
    hero._rev = (hero._rev || 0) + 1;

    return hero;
}

export function updateHeroSkillModifiers(heroOrId) {
    const hero = typeof heroOrId === 'string' ? lookupHeroById(heroOrId) : heroOrId;
    if (!hero || !hero.aggregator) return;

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

function applyClassModifiers(hero, heroClass) {
    if (heroClass?.skillIds) {
        heroClass.skillIds.forEach(skillId => {
            hero.aggregator.addModifier({
                type: 'xp_gain',
                category: skillId,
                value: CLASS_XP_BONUS,
                source: `class:${heroClass.id}`,
                persistent: true
            });
        });
    }
}

function applyTraitModifiers(hero, heroTrait) {
    if (heroTrait?.bonusSkills) {
        heroTrait.bonusSkills.forEach(skillId => {
            hero.aggregator.addModifier({
                type: 'xp_gain',
                category: skillId,
                value: TRAIT_XP_BONUS,
                source: `trait:${heroTrait.id}`,
                persistent: true
            });
        });
    }

    if (heroTrait?.modifiers) {
        heroTrait.modifiers.forEach(mod => {
            hero.aggregator.addModifier({
                ...mod,
                source: `trait:${heroTrait.id}`,
                persistent: true
            });
        });
    }
}
