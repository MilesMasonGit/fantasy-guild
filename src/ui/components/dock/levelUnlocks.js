import { listRecipes } from '../../../config/registries/recipePoolRegistry.js';
import { getAllTokenTypes, tokenName } from '../../../config/registries/tokenRegistry.js';
import { getAllItems } from '../../../config/registries/itemRegistry.js';
import { isEquipCategory } from '../../../config/registries/equipmentConstants.js';
import { gearRequirements, meetsGearRequirements } from '../../../config/registries/weaponStyles.js';
import { recipesUnlockedBy } from '../../../systems/notifications/recipeUnlocks.js';
import { workConfigOf } from '../../../systems/board/StationRecipe.js';
import { getHero } from '../../../systems/hero/HeroManager.js';
import { perksReachedBy } from './heroPerks.js';
import { t } from '../../../i18n/index.js';

/**
 * What one hero's level-up unlocks, as the level-up float and the hero bar's alert show it: the
 * perks reached, the recipes they can now make, the Tokens they can now work and the gear they can
 * now wear. Read off the rules the game itself runs (a recipe's `levelRequirement`, a Token's work
 * config, gear's level requirements), never a table of its own, so content changes need nothing here.
 * Counted on the hero's own level, not the guild's best: the guild's "New Recipe!" banner is that.
 */

const NONE = Object.freeze([]);

export const NO_UNLOCKS = Object.freeze({ perks: NONE, recipes: NONE, tokens: NONE, gear: NONE });

/**
 * The recipes, Tokens and gear a level-up from `fromLevel` to `toLevel` in `skillId` unlocks:
 * each one whose requirement in that skill sits above the old level and at or below the new.
 * Gear counts only when the hero, at the new level, meets every requirement it has.
 * @returns {{ recipes: object[], tokens: object[], gear: object[] }} lowest level first
 */
export function unlocksBetween({ skillId, fromLevel, toLevel, hero = null }, { recipes, tokenTypes, items }) {
    const from = Number(fromLevel) || 0;
    const to = Number(toLevel) || 0;
    if (!skillId || !(to > from)) return { recipes: [], tokens: [], gear: [] };
    const crosses = (level) => level > from && level <= to;
    const byLevel = (rows) => rows.sort((a, b) => a.level - b.level || a.order - b.order).map(r => r.row);

    const tokens = [];
    Object.values(tokenTypes || {}).forEach((def, order) => {
        const config = workConfigOf(def);
        const level = config?.skillRequired || 0;
        if (config?.skill === skillId && crosses(level)) tokens.push({ row: def, level, order });
    });

    const gear = [];
    if (!hero?.isVillager) {
        // The hero as they stand at the new level, whenever the level-up is read.
        const at = { ...(hero || {}), skills: { ...(hero?.skills || {}), [skillId]: { level: to } } };
        Object.values(items || {}).forEach((item, order) => {
            if (!isEquipCategory(item?.equipSlot)) return;
            const req = gearRequirements(item).find(r => r.skill === skillId && crosses(r.level));
            if (req && meetsGearRequirements(item, at)) gear.push({ row: item, level: req.level, order });
        });
    }

    return {
        recipes: recipesUnlockedBy(recipes, { skillId, oldLevel: from, newLevel: to }),
        tokens: byLevel(tokens),
        gear: byLevel(gear)
    };
}

const uniqueNames = (names) => [...new Set(names.filter(Boolean))];

/**
 * What a hero's level-up unlocks, by name: `{ perks, recipes, tokens, gear }`, each a list of
 * names, lowest level first.
 */
export function levelUpUnlocks(heroId, skillId, fromLevel, toLevel) {
    const reachedFrom = Number.isFinite(fromLevel) ? fromLevel : toLevel - 1;
    const u = unlocksBetween(
        { skillId, fromLevel: reachedFrom, toLevel, hero: heroId ? getHero(heroId) : null },
        { recipes: listRecipes(), tokenTypes: getAllTokenTypes(), items: getAllItems() }
    );
    return {
        perks: uniqueNames(perksReachedBy(skillId, reachedFrom, toLevel).map(p => p.title)),
        recipes: uniqueNames(u.recipes.map(r => r.name || r.id)),
        tokens: uniqueNames(u.tokens.map(d => tokenName(d.id) || d.name)),
        gear: uniqueNames(u.gear.map(i => i.name || i.id))
    };
}

/** Two level-ups' unlocks as one, the earlier first, each name once. */
export function mergeUnlocks(earlier = NO_UNLOCKS, later = NO_UNLOCKS) {
    const out = {};
    for (const kind of ['perks', 'recipes', 'tokens', 'gear']) {
        out[kind] = uniqueNames([...(earlier?.[kind] || NONE), ...(later?.[kind] || NONE)]);
    }
    return out;
}

/** Whether a level-up unlocked anything at all. */
export const hasUnlocks = (u) => !!u && (u.perks?.length || u.recipes?.length || u.tokens?.length || u.gear?.length) > 0;

/** The short version: the perks by name, the rest counted ("Clean Felling, +2 recipes"). */
export function unlockSummary(u) {
    if (!hasUnlocks(u)) return '';
    const parts = [...(u.perks || NONE)];
    for (const kind of ['recipes', 'tokens', 'gear']) {
        const count = u[kind]?.length || 0;
        if (count) parts.push(t(`levelUp.count.${kind}`, { count }));
    }
    return parts.join(', ');
}

/**
 * The whole list, grouped: `[{ kind, label, names }]` for the perks, recipes, Tokens and gear, in
 * that order, each kind that has any. The label is counted ("Recipe", "Recipes").
 */
export function unlockGroups(u) {
    if (!hasUnlocks(u)) return [];
    return ['perks', 'recipes', 'tokens', 'gear']
        .filter(kind => u[kind]?.length)
        .map(kind => ({ kind, label: t(`levelUp.group.${kind}`, { count: u[kind].length }), names: u[kind] }));
}
