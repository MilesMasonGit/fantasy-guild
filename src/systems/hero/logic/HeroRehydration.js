import { ModifierAggregator } from '../../effects/ModifierAggregator.js';
import { calculateHeroLevel } from '../HeroGenerator.js';
import { heroMaxHpFromSkills } from '../../../utils/CombatFormulas.js';
import { GameState } from '../../../state/GameState.js';
import { createEmptyEquipment } from '../../../config/registries/equipmentConstants.js';
import { normaliseHeldCopies } from '../../equipment/heldCopies.js';
import { HERO_SKILL_IDS, isSkillId } from '../../../config/registries/skillRegistry.js';
import { xpForLevel } from '../../../utils/XPCurve.js';

/**
 * Hero Rehydration: Restores Logic (Aggregator) and Display data.
 */

/**
 * Bring a hero's sheet to today's shape, as every load and every new hero does: every skill in the
 * registry held, at level 1 where the hero has none. An older save's levels are kept: skills set
 * aside at a job change (`bankedSkills`) come back (a held copy wins), levels in a skill the game
 * no longer has are dropped, and the job is dropped. Villagers are left alone.
 *
 * @returns {{ restored: string[], dropped: string[], added: string[] }} skill ids
 */
export function settleSkillSheet(hero) {
    const result = { restored: [], dropped: [], added: [] };
    if (!hero || hero.isVillager) return result;
    if (!hero.skills || typeof hero.skills !== 'object') hero.skills = {};
    for (const [skillId, banked] of Object.entries(hero.bankedSkills || {})) {
        if (!banked || !isSkillId(skillId) || hero.skills[skillId]) continue;
        hero.skills[skillId] = { ...banked };
        result.restored.push(skillId);
    }
    delete hero.bankedSkills;
    for (const skillId of Object.keys(hero.skills)) {
        if (isSkillId(skillId)) continue;
        delete hero.skills[skillId];
        result.dropped.push(skillId);
    }
    for (const skillId of HERO_SKILL_IDS) {
        if (hero.skills[skillId]) continue;
        hero.skills[skillId] = { xp: xpForLevel(1), level: 1 };
        result.added.push(skillId);
    }
    delete hero.jobId;
    return result;
}

export function rehydrateHero(hero) {
    if (!hero) return;

    hero.aggregator = new ModifierAggregator(hero.id);

    if (hero.isVillager) hero.className = 'Villager';
    else delete hero.className;
    hero.traitName = '';
    if (!hero.spriteId) hero.spriteId = 'hn_recruit_por';
    if (!hero.icon) hero.icon = 'hn_recruit_icon_por';

    // Every skill on the sheet, an older save's job and banked skills folded in. Runs before the
    // derived stats.
    settleSkillSheet(hero);

    updateHeroFromSkills(hero);

    hero.level = calculateHeroLevel(hero.skills);
    updateHeroMaxHp(hero);

    // The old status engine's list. Statuses now ride on `effects` and end with their fight, so
    // whatever an older save holds here (a Poison that outlasted its fight) is dropped. The empty
    // list stays so a hero record reads as it always has (the bench fingerprints it).
    hero.statuses = [];

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
 * Recompute max HP from the hero's best combat skill. Villagers keep their flat HP.
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

