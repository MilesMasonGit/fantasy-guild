// the content rules for Science: mastery tracks and Laboratories, shared by the boot audit and the CMS audit

import { masteryTrackOf, laboratoryOf, LABORATORY_KIND, kindOfType } from '../../config/registries/mastery.js';
import { fieldOf } from '../../config/registries/tokenConstants.js';
import { getPaletteEntry } from '../../config/registries/modifierPalette.js';
import { statementsOf, stationKindOf, stationSkillOf, KEYWORD } from '../effects/statements.js';

/**
 * Where Science content is written in a way that cannot work (brief 810 K6; `mastery.js`):
 * - a track on something that is no node kind: a station, an enemy, a spawner, a Foundation, a
 *   Laboratory, a Stump (its kind is the tree it grows into), a recipe that is no crop;
 * - a rank that no study reaches (no points), or that names an effect the library lacks;
 * - a rank's effect with a rule mastery cannot carry on a Token: another keyword than Provides, a
 *   triggered one, a retired axis;
 * - a Laboratory block on a Token that is no Laboratory, or a level that is not a whole number.
 *
 * A row with no effect is a blank row, not a finding; a node with no track yet is unfinished
 * content, never named. It only reports: the game skips what cannot work (`masteryTrackOf`).
 *
 * Pure: the caller hands in the Tokens, recipes and effects, keyed by id (recipes may be a list).
 *
 * @param {{ tokens?: Record<string, object>, recipes?: object[]|Record<string, object>, effects?: Record<string, object> }} content
 * @returns {{ entityType: 'Token'|'Recipe', entityId: string, entityName: string, field: string, message: string }[]}
 */
export function masteryFindings({ tokens = {}, recipes = [], effects = {} } = {}) {
    const out = [];
    const lookup = (id) => tokens?.[id] || null;

    for (const [key, def] of Object.entries(tokens || {})) {
        const id = def?.id || key;
        const say = (field, message) => out.push({ entityType: 'Token', entityId: id, entityName: def?.name || id, field, message });
        const isLab = stationKindOf(def) === LABORATORY_KIND;

        if (def?.laboratory && typeof def.laboratory === 'object') {
            if (!isLab) say('laboratory', 'has a Laboratory block but does not work as a Laboratory (Works as Science, kind Laboratory), so it studies nothing: give it the rule, or remove the block.');
            const raw = def.laboratory.maxLevel;
            if (raw != null && raw !== '' && laboratoryOf(def).maxLevel == null) say('laboratory', `its Laboratory studies nodes up to "${raw}", which is not a whole level from 1: it reads as any level.`);
        }
        if (isLab && stationSkillOf(def) !== 'science') say('laboratory', `is a Laboratory of the skill "${stationSkillOf(def)}": a Laboratory is Science's, so its hero levels the wrong skill.`);

        if (!def?.mastery) continue;
        const notNode = notNodeWhy(def, id, lookup, isLab);
        if (notNode) say('mastery', notNode);
        trackFindings(def, effects, (message) => say('mastery', message));
    }

    for (const recipe of Array.isArray(recipes) ? recipes : Object.values(recipes || {})) {
        if (!recipe?.mastery) continue;
        const id = recipe.id || '';
        const say = (message) => out.push({ entityType: 'Recipe', entityId: id, entityName: recipe.name || id, field: 'mastery', message });
        if (!recipe.crop || typeof recipe.crop !== 'object') say('has a mastery track but is no crop: only a crop a Field grows is a node kind, so it is never studied. Move the track to the node it belongs to.');
        trackFindings(recipe, effects, say);
    }
    return out;
}

/** Why a Token with a track is no node kind, or null when it is one. */
function notNodeWhy(def, id, lookup, isLab) {
    if (isLab) return 'is a Laboratory, which studies nodes and is never one: its mastery track is never read.';
    if (def.enemy) return 'is an enemy, which is fought, never studied: its mastery track is never read.';
    if (def.spawner) return 'is a spawner, which is never studied (its trees or veins are): move the track to what it spawns.';
    if (def.foundation) return 'is a Foundation, which is never studied: its mastery track is never read.';
    if (fieldOf(def)) return 'is a Field: a Field\'s kind is the crop in its ground, so put the track on each crop recipe instead.';
    if (stationSkillOf(def)) return 'is a station, which is never studied: its mastery track is never read.';
    const kind = kindOfType(id, lookup);
    if (kind && kind !== id) return `grows into ${lookup(kind)?.name || kind}, whose kind it counts as: its own track is never read. Move it to ${lookup(kind)?.name || kind}.`;
    if (!def.config?.skill) return 'has no work of its own, so nobody can study it: its mastery track is never read.';
    return null;
}

/** A track's ranks: one no study reaches, one naming a missing effect, a rule mastery cannot carry. */
function trackFindings(holder, effects, say) {
    const rows = Array.isArray(holder?.mastery?.ranks) ? holder.mastery.ranks : [];
    const working = rows.filter(row => typeof row?.effectId === 'string' && row.effectId.trim());
    for (const row of working) {
        const points = Math.floor(Number(row.points));
        const effectId = row.effectId.trim();
        const effect = effects?.[effectId];
        if (!(points >= 1)) {
            say(`has a mastery rank (${effect?.name || effectId}) at "${row.points ?? ''}" points, which no study reaches: give it a whole number of points from 1.`);
            continue;
        }
        if (!effect) {
            say(`its mastery rank at ${points} points names the effect "${effectId}", which does not exist (renamed or deleted?): that rank gives nothing.`);
            continue;
        }
        for (const statement of statementsOf(effect)) {
            const name = effect.name || effectId;
            if (statement?.keyword !== KEYWORD.PROVIDES) {
                say(`its mastery rank at ${points} points (${name}) has a ${statement?.keyword || 'blank'} rule, which mastery cannot carry: only Provides rules reach the kind's Tokens.`);
            } else if (statement.when?.event) {
                say(`its mastery rank at ${points} points (${name}) has a triggered rule, which mastery cannot carry: only standing Provides rules reach the kind's Tokens.`);
            } else if (getPaletteEntry(statement.payload?.type)?.retired) {
                say(`its mastery rank at ${points} points (${name}) changes an axis the game no longer reads, so it does nothing.`);
            }
        }
    }
    if (!masteryTrackOf(holder) && working.length) say('has a mastery track no rank of which can be reached: the kind cannot be studied.');
}
