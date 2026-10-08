import { ModifierAggregator } from '../../effects/ModifierAggregator.js';
import { skillSpeedBonus } from '../../../config/FormulaRegistry.js';
import { EFFECT_TYPES } from '../../effects/constants.js';
import { calculateHeroLevel } from '../HeroGenerator.js';
import { heroMaxHpFromSkills } from '../../../utils/CombatFormulas.js';
import { GameState } from '../../../state/GameState.js';
import { createEmptyEquipment } from '../../../config/registries/equipmentConstants.js';
import { STARTING_SKILL_IDS } from '../../../config/registries/skillRegistry.js';

/**
 * Hero Rehydration: Restores Logic (Aggregator) and Display data.
 */

/**
 * Move every banked STARTING skill back onto the hero's sheet, at its stored
 * level and XP. Only older saves can hold one, since promotion no longer banks
 * them. Villagers are left alone. A held copy wins over a banked one.
 *
 * @returns {string[]} the skill ids restored
 */
export function restoreBankedStarting(hero) {
    if (!hero || hero.isVillager || !hero.bankedSkills) return [];
    if (!hero.skills) hero.skills = {};
    const restored = [];
    for (const skillId of STARTING_SKILL_IDS) {
        const banked = hero.bankedSkills[skillId];
        if (!banked) continue;
        if (!hero.skills[skillId]) {
            hero.skills[skillId] = { ...banked };
            restored.push(skillId);
        }
        delete hero.bankedSkills[skillId];
    }
    return restored;
}

export function rehydrateHero(hero) {
    if (!hero) return;

    hero.aggregator = new ModifierAggregator(hero.id);

    hero.className = hero.isVillager ? 'Villager' : 'Adventurer';
    hero.traitName = '';
    if (!hero.spriteId) hero.spriteId = 'hero_recruit_0';
    if (!hero.icon) hero.icon = 'icon_recruit_0';

    // Older saves may hold Starting skills in the bank; put them back on the
    // sheet. Runs before the derived stats.
    restoreBankedStarting(hero);

    updateHeroSkillModifiers(hero);

    hero.level = calculateHeroLevel(hero.skills);
    updateHeroMaxHp(hero);

    // Older saves lack the key.
    if (!Array.isArray(hero.statuses)) hero.statuses = [];

    // Normalise the loadout grid to exactly GRID_SLOT_COUNT slots.
    //
    // ⚠️ Only the legacy named-slot object is collapsed into grid order. An array
    // is padded/truncated in place so each item keeps its index; re-packing it to
    // the front would silently move a saved loadout on every load.
    const equipment = createEmptyEquipment();
    if (Array.isArray(hero.equipment)) {
        hero.equipment.slice(0, equipment.length)
            .forEach((itemId, i) => { equipment[i] = itemId || null; });
    } else {
        // Legacy named-slot object: collapse its values into grid order.
        Object.values(hero.equipment || {}).filter(Boolean)
            .slice(0, equipment.length)
            .forEach((itemId, i) => { equipment[i] = itemId; });
    }
    hero.equipment = equipment;
    delete hero.lastEatenAt;
    delete hero.lastDrunkAt;

    // UI change counter.
    hero._rev = (hero._rev || 0) + 1;

    return hero;
}

/**
 * Recompute max HP from the hero's combat skill. Villagers keep their flat HP.
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

    for (const skillId of Object.keys(hero.skills)) {
        hero.aggregator.removeModifiersBySource(`skill:${skillId}`);
    }

    for (const [skillId, skillData] of Object.entries(hero.skills)) {
        const level = typeof skillData === 'number' ? skillData : (skillData.level || 0);
        if (level > 0) {
            hero.aggregator.addModifier({
                source: `skill:${skillId}`,
                type: EFFECT_TYPES.SPEED,
                // ⚠️ Lower-case: category ids are lower-case and `_forEachMatching`
                // compares them case-SENSITIVELY, so an upper-cased key is one no
                // reader could match and the query would silently return 0.
                target: { category: skillId },
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
    return GameState.heroes.find(h => h.id === heroId) || null;
}

