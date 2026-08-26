import { ModifierAggregator } from '../../effects/ModifierAggregator.js';
import { skillSpeedBonus } from '../../../config/FormulaRegistry.js';
import { EFFECT_TYPES } from '../../effects/constants.js';
import { calculateHeroLevel } from '../HeroGenerator.js';
import { heroMaxHpFromSkills } from '../../../utils/CombatFormulas.js';
import { GameState } from '../../../state/GameState.js';
import { createEmptyEquipment } from '../../../config/registries/equipmentConstants.js';

/**
 * Hero Rehydration: Restores Logic (Aggregator) and Display data.
 */

export function rehydrateHero(hero) {
    if (!hero) return;

    // 1. Restore Logic (Aggregator)
    hero.aggregator = new ModifierAggregator(hero.id);

    // 2. Inject Display Data
    //    Classes and traits are retired (owner decision 2026-08-18): a hero's
    //    identity is their job, read from `jobRegistry` by the Dock and the
    //    inspection sheet. `classId` / `traitId` are left untouched on saved
    //    heroes so existing saves keep loading, but nothing looks them up any
    //    more, so there is no class or trait name to inject.
    hero.className = hero.isVillager ? 'Villager' : 'Adventurer';
    hero.traitName = '';
    if (!hero.spriteId) hero.spriteId = 'hero_recruit_0';
    if (!hero.icon) hero.icon = 'icon_recruit_0';

    // 4. Skill-based Speed Modifiers (Dynamic)
    updateHeroSkillModifiers(hero);

    // 5. Derived Stats
    hero.level = calculateHeroLevel(hero.skills);
    updateHeroMaxHp(hero);

    // 6. Status effects container (pre-status-system saves lack the key)
    if (!Array.isArray(hero.statuses)) hero.statuses = [];

    // 7. Normalize the loadout grid so every hero has exactly the current
    //    number of slots and nothing stale.
    //    The grid is nine generic slots now (D-7), so normalising means
    //    "an array of exactly GRID_SLOT_COUNT, keeping whatever was there".
    //
    //    ⚠️ CR2-040: this used to `filter(Boolean)` unconditionally and rewrite
    //    the survivors from index 0, which silently re-packed a saved grid to
    //    the front on every load — `[,,A,,B,,,,C]` came back as `[A,B,C,...]`.
    //    The collapse is a *legacy migration*, so it now runs only on the
    //    legacy named-slot object. An array is padded/truncated in place, each
    //    item keeping its own index.
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
                // ⚠️ Lower-case, and it matters (CR2-072). Every category id in
                // the game is lower-case (`TARGET_CATEGORIES.MINING === 'mining'`)
                // and `_forEachMatching` compares them case-SENSITIVELY, so the
                // old `skillId.toUpperCase()` filed this under a key no reader
                // could ever match — the query simply returned 0, silently.
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

