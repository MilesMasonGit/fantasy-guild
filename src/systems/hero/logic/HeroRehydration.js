import { ModifierAggregator } from '../../effects/ModifierAggregator.js';
import { calculateHeroLevel } from '../HeroGenerator.js';
import { heroMaxHpFromSkills } from '../../combat/CombatFormulas.js';
import { GameState } from '../../../state/GameState.js';
import { createEmptyEquipment } from '../../../config/registries/equipmentConstants.js';
import { normaliseHeldCopies } from '../../equipment/heldCopies.js';
import { HERO_SKILL_IDS, RETIRED_SKILL_IDS } from '../../../config/registries/skillRegistry.js';
import { xpForLevel } from '../../../utils/XPCurve.js';
import { hasFixedSkills, isSummoned } from '../summoned.js';
import { getTokenType } from '../../../config/registries/tokenRegistry.js';
import { isSummonType, summonSkillSheet } from '../../../config/registries/summonRules.js';

/**
 * Hero Rehydration: Restores Logic (Aggregator) and Display data.
 */

/**
 * Bring a hero's sheet to today's shape, as every load and every new hero does: every skill in the
 * registry held, at level 1 where the hero has none. An older save's levels are kept: levels in a
 * cut skill (`RETIRED_SKILL_IDS`) are dropped, and the job is dropped. Villagers and Summoned workers are left alone: their sheet is their own.
 *
 * @returns {{ dropped: string[], added: string[] }} skill ids
 */
export function settleSkillSheet(hero) {
    const result = { dropped: [], added: [] };
    if (!hero || hasFixedSkills(hero)) return result;
    if (!hero.skills || typeof hero.skills !== 'object') hero.skills = {};
    for (const skillId of RETIRED_SKILL_IDS) {
        if (!hero.skills[skillId]) continue;
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
    else if (isSummoned(hero)) hero.className = 'Summoned';
    else delete hero.className;
    hero.traitName = '';
    if (!hero.spriteId) hero.spriteId = 'hn_recruit_por';
    if (!hero.icon) hero.icon = 'hn_recruit_icon_por';

    // Every skill on the sheet, an older save's job dropped. Runs before the derived stats.
    settleSkillSheet(hero);
    // A Summoned worker holds its kind's skills at their fixed levels, as the content says now.
    summonSheetFromContent(hero);

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
    // Heroes no longer have energy, a class, a trait, a recruitment stamp or a wound deadline (a
    // wound counts down `woundedRemainingMs`); older saves still carry the fields.
    delete hero.energy;
    delete hero.classId;
    delete hero.traitId;
    delete hero.createdAt;
    delete hero.woundedUntil;

    // UI change counter.
    hero._rev = (hero._rev || 0) + 1;

    return hero;
}

/**
 * A Summoned worker's skills, read again from its kind (`summonRules.summonSkillSheet`), so a level
 * the CMS changes reaches the ones already called. Kept as saved when its kind is gone from the data.
 */
function summonSheetFromContent(hero) {
    if (!isSummoned(hero)) return;
    const def = getTokenType(hero.summon.typeId);
    if (isSummonType(def)) hero.skills = summonSkillSheet(def);
}

/**
 * Recompute max HP from the hero's best combat skill.
 * Raising max keeps current HP as-is (level-ups grant headroom, not a heal);
 * lowering max clamps current down to it.
 */
export function updateHeroMaxHp(hero) {
    if (!hero || !hero.skills) return;
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

