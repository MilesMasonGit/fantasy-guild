import { ModifierAggregator } from '../../effects/ModifierAggregator.js';
import { calculateHeroLevel } from '../HeroGenerator.js';
import { heroMaxHpFromSkills } from '../../../utils/CombatFormulas.js';
import { GameState } from '../../../state/GameState.js';
import { createEmptyEquipment } from '../../../config/registries/equipmentConstants.js';
import { normaliseHeldCopies } from '../../equipment/heldCopies.js';
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

    hero.className = hero.isVillager ? 'Villager' : 'Recruit';
    hero.traitName = '';
    if (!hero.spriteId) hero.spriteId = 'hn_recruit_por';
    if (!hero.icon) hero.icon = 'hn_recruit_icon_por';

    // Older saves may hold Starting skills in the bank; put them back on the
    // sheet. Runs before the derived stats.
    restoreBankedStarting(hero);

    updateHeroFromSkills(hero);

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
        delete hero.heldCopies;
    }
    hero.equipment = equipment;
    normaliseHeldCopies(hero);
    delete hero.lastEatenAt;
    delete hero.lastDrunkAt;
    // Heroes no longer have energy; older saves still carry the field.
    delete hero.energy;

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

/** Max HP and hero level, both derived from skills. A skill level adds no work speed. */
export function updateHeroFromSkills(heroOrId) {
    const hero = typeof heroOrId === 'string' ? lookupHeroById(heroOrId) : heroOrId;
    if (!hero || !hero.aggregator) return;

    updateHeroMaxHp(hero);
    hero.level = calculateHeroLevel(hero.skills);
}

/**
 * Internal: Lookup helper that doesn't cause circular dependency with HeroLookup.js
 */
function lookupHeroById(heroId) {
    return GameState.heroes.find(h => h.id === heroId) || null;
}

