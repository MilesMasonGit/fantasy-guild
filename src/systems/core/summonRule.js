// the content rules for Summoned workers: shared by the boot audit and the CMS audit

import { summonOf, isSummonType, SUMMONING_SKILL } from '../../config/registries/summonRules.js';
import { isEnemyDef } from '../../config/registries/enemyProfile.js';
import { getSkill, isSkillId, isGatheringSkill, SKILL_TRADES } from '../../config/registries/skillRegistry.js';
import { MAX_SKILL_LEVEL } from '../../utils/XPCurve.js';
import { stationSkillOf } from '../effects/statements.js';

/**
 * Where Summoned worker content is written in a way that cannot work, or against the owner's
 * rulings for summons (gathering only, one trait each): a summon with no skill, a skill the game
 * lacks or one that is not gathering, a level out of range, a trait or copied enemy that does not exist, a
 * summon no Summoning recipe calls, a recipe calling one outside Summoning or making something
 * besides, and a Circle setting on a Token that does not work as Summoning.
 *
 * Pure: the caller hands in the catalogues. Tokens must be expanded (their statements present), or a
 * Circle's `Works as` cannot be seen.
 *
 * @param {{ tokens?: Record<string, object>, recipes?: object[]|Record<string, object>, effects?: Record<string, object> }} content
 * @returns {{ entityType: 'Token'|'Recipe', entityId: string, entityName: string, message: string }[]}
 */
export function summonFindings({ tokens = {}, recipes = [], effects = {} } = {}) {
    const out = [];
    const push = (entityType, entityId, def, message) =>
        out.push({ entityType, entityId, entityName: def?.name || entityId, message });
    const recipeList = Array.isArray(recipes) ? recipes : Object.values(recipes || {});
    const skillName = (id) => getSkill(id)?.name || id;

    const calledBy = new Map();
    for (const recipe of recipeList) {
        const summonsHere = (recipe?.outputs || []).filter(o => isSummonType(tokens?.[o?.tokenId]));
        if (!summonsHere.length) continue;
        const rid = recipe.id || '';
        for (const o of summonsHere) {
            if (!calledBy.has(o.tokenId)) calledBy.set(o.tokenId, []);
            calledBy.get(o.tokenId).push(rid);
        }
        if (recipe.skill && recipe.skill !== SUMMONING_SKILL) {
            push('Recipe', rid, recipe, `calls a Summoned worker but is a ${skillName(recipe.skill)} recipe: only a Summoning Circle calls one, so make it a Summoning recipe`);
        }
        if (summonsHere.length > 1) {
            push('Recipe', rid, recipe, 'calls more than one Summoned worker: a Circle charges one, so only the first is called');
        }
        const others = (recipe.outputs || []).filter(o => !isSummonType(tokens?.[o?.tokenId]));
        if (others.length) {
            push('Recipe', rid, recipe, 'calls a Summoned worker and makes something besides: a summon recipe makes nothing else, so remove its other outputs');
        }
    }

    for (const [key, def] of Object.entries(tokens || {})) {
        const id = def?.id || key;
        if (isSummonType(def)) {
            const summon = summonOf(def);
            const raw = def.summon.skills && typeof def.summon.skills === 'object' ? def.summon.skills : {};
            for (const [skillId, level] of Object.entries(raw)) {
                if (!isSkillId(skillId)) {
                    push('Token', id, def, `is a Summoned worker whose skill "${skillId}" the game does not have, so it never works that`);
                    continue;
                }
                const n = Number(level && typeof level === 'object' ? level.level : level);
                if (!(Number.isInteger(n) && n >= 1 && n <= MAX_SKILL_LEVEL)) {
                    push('Token', id, def, `is a Summoned worker whose ${skillName(skillId)} level is not a whole number from 1 to ${MAX_SKILL_LEVEL}${summon.skills[skillId] ? `, read as ${summon.skills[skillId]}` : ', so it does not hold the skill'}`);
                }
                if (!isGatheringSkill(skillId)) {
                    const what = getSkill(skillId)?.trade === SKILL_TRADES.CRAFTING ? 'a making skill' : 'which is not a gathering skill';
                    push('Token', id, def, `is a Summoned worker that works ${skillName(skillId)}, ${what}: summons work only Mining, Forestry, Fishing or Farming, so heroes still make everything`);
                }
            }
            if (!Object.keys(summon.skills).length) {
                push('Token', id, def, 'is a Summoned worker with no skill, so it can work nothing: give it one, at a level');
            }
            if (!summon.trait) {
                push('Token', id, def, 'is a Summoned worker with no trait: each summon carries one, a library effect');
            } else if (!effects?.[summon.trait.effectId]) {
                push('Token', id, def, `is a Summoned worker whose trait points at the effect "${summon.trait.effectId}", which does not exist, so it carries none`);
            }
            if (!summon.of) {
                push('Token', id, def, 'is a Summoned worker that names no enemy it is a recolour of');
            } else if (!isEnemyDef(tokens?.[summon.of])) {
                push('Token', id, def, `is a Summoned worker named a recolour of "${summon.of}", which is not an enemy`);
            }
            if (!calledBy.has(id)) {
                push('Token', id, def, 'is a Summoned worker no Summoning recipe calls, so it is never summoned: give a Summoning recipe it as its output');
            }
        }
        if (def?.summonCircle && stationSkillOf(def) !== SUMMONING_SKILL) {
            push('Token', id, def, 'has a Summoning Circle charge setting but does not work as Summoning, so nothing reads it');
        }
    }
    return out;
}
