// the content rules for Crime: steal tables and Hideouts, shared by the boot audit and the CMS audit

import { HIDEOUT_KIND, CAUGHT_DEFAULTS } from '../../config/registries/crime.js';
import { stationKindOf } from '../effects/statements.js';

/**
 * Where Crime content is written in a way that cannot work (brief 810 K4): a steal table on a Token
 * that is no enemy, or on an enemy only a boss camp spawns (bosses are never robbed); a steal line
 * naming no item or one the game lacks, or a Token (a theft never makes one); a Crime level or XP
 * that is not a number the game reads; a caught curve on a Token that is no Hideout, or one out of
 * range; and a Hideout carrying its own outputs, rare table or Crime recipes, which never run (a
 * Hideout drops only what it steals).
 *
 * Pure: the caller hands in the catalogues. Tokens must be expanded (their statements present), or
 * a Hideout's `Works as` cannot be seen. `bossCampIds`: the camps the world tables name as a kit's
 * `bossCamps`.
 *
 * @param {{ tokens?: Record<string, object>, items?: Record<string, object>, recipes?: object[]|Record<string, object>, bossCampIds?: Iterable<string> }} content
 * @returns {{ entityType: 'Token'|'Recipe', entityId: string, entityName: string, message: string }[]}
 */
export function crimeFindings({ tokens = {}, items = {}, recipes = [], bossCampIds = [] } = {}) {
    const out = [];
    const push = (entityType, entityId, def, message) => out.push({ entityType, entityId, entityName: def?.name || entityId, message });
    const isEnemy = (def) => def?.enemy?.level != null;
    const bosses = new Set(bossCampIds || []);
    const all = Object.entries(tokens || {});

    // Which camps spawn each enemy, and whether any is not a boss's.
    const campsOf = new Map();
    for (const [id, def] of all) {
        for (const entry of Array.isArray(def?.spawner?.spawns) ? def.spawner.spawns : []) {
            if (!entry?.typeId) continue;
            if (!campsOf.has(entry.typeId)) campsOf.set(entry.typeId, []);
            campsOf.get(entry.typeId).push(def.id || id);
        }
    }

    for (const [key, def] of all) {
        const id = def?.id || key;
        const steal = def?.steal;
        if (steal != null) {
            if (typeof steal !== 'object' || Array.isArray(steal)) {
                push('Token', id, def, 'its steal table is not a table the game reads, so no thief takes anything from it');
            } else if (!isEnemy(def)) {
                push('Token', id, def, 'carries a steal table but is no enemy: only an enemy\'s camp is robbed, so it does nothing');
            } else {
                const camps = campsOf.get(id) || [];
                if (camps.length && camps.every(c => bosses.has(c))) {
                    push('Token', id, def, 'carries a steal table but only a boss camp spawns it, and bosses are never robbed: remove the table');
                }
                const lines = steal.outputs;
                if (lines != null && !Array.isArray(lines)) push('Token', id, def, 'its steal table\'s lines are not a list, so a theft takes none of them');
                for (const [i, line] of (Array.isArray(lines) ? lines : []).entries()) {
                    if (line?.tokenId) push('Token', id, def, `its steal line ${i + 1} names a Token, and a theft never makes one: name an item`);
                    else if (!line?.itemId) push('Token', id, def, `its steal line ${i + 1} names no item, so it takes nothing`);
                    else if (items && !items[line.itemId]) push('Token', id, def, `its steal line names the item "${line.itemId}", which the game does not have`);
                    if (line?.chance != null && !(Number(line.chance) > 0)) push('Token', id, def, `its steal line ${i + 1} has a chance of ${line.chance}, so it is never taken`);
                }
                for (const entry of Array.isArray(steal.rareTable?.entries) ? steal.rareTable.entries : []) {
                    if (entry?.itemId && items && !items[entry.itemId]) push('Token', id, def, `its steal table's rare find names the item "${entry.itemId}", which the game does not have`);
                }
                if (steal.crimeLevel != null && !(typeof steal.crimeLevel === 'number' && steal.crimeLevel >= 1)) {
                    push('Token', id, def, `its camp's Crime level is ${JSON.stringify(steal.crimeLevel)}; it must be a number from 1, or empty for the enemy's level`);
                }
                if (steal.xp != null && !(typeof steal.xp === 'number' && steal.xp >= 0)) {
                    push('Token', id, def, `its theft XP is ${JSON.stringify(steal.xp)}; it must be a number from 0, or empty for the Hideout's own`);
                }
            }
        }

        const hideout = stationKindOf(def) === HIDEOUT_KIND;
        if (def?.hideout != null && !hideout) {
            push('Token', id, def, 'carries a caught curve but is no Hideout (a Crime station of the Hideout kind), so nothing reads it');
        }
        if (hideout) {
            const curve = def.hideout && typeof def.hideout === 'object' ? def.hideout : {};
            for (const k of Object.keys(CAUGHT_DEFAULTS)) {
                const v = curve[k];
                if (v == null) continue;
                const limit = k === 'perLevel' ? v >= 0 : v >= 0 && v <= 100;
                if (typeof v !== 'number' || !limit) push('Token', id, def, `its caught curve's ${k} is ${JSON.stringify(v)}; ${k === 'perLevel' ? 'it must be a number from 0' : 'it must be a percent from 0 to 100'}`);
            }
            const min = curve.minChance ?? CAUGHT_DEFAULTS.minChance;
            const max = curve.maxChance ?? CAUGHT_DEFAULTS.maxChance;
            if (typeof min === 'number' && typeof max === 'number' && min > max) {
                push('Token', id, def, `its caught curve never goes under ${min}% but never over ${max}%: the floor reads as the ceiling`);
            }
            if (Array.isArray(def.config?.outputs) && def.config.outputs.length) {
                push('Token', id, def, 'is a Hideout with outputs of its own, which never land: a Hideout takes only what it steals');
            }
            if (def.rareTable) {
                push('Token', id, def, 'is a Hideout with a rare drop table of its own, which never rolls: put rare finds in an enemy\'s steal table');
            }
        }
    }

    for (const recipe of Array.isArray(recipes) ? recipes : Object.values(recipes || {})) {
        if (Array.isArray(recipe?.stationKinds) && recipe.stationKinds.includes(HIDEOUT_KIND)) {
            push('Recipe', recipe.id, recipe, 'is marked Made at Hideout, but a Hideout runs no recipe: it robs a camp');
        }
    }
    return out;
}
