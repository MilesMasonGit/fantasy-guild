// where a node may be built: its ground and what it must stand near

import { getTokenType, standsNearOf, standsOnOf, tokenName } from '../../config/registries/tokenRegistry.js';
import { STANDS_ON_CHOICES, needsText } from '../atlas/TerrainMap.js';
import { recipesForFoundation } from '../../config/registries/recipePoolRegistry.js';
import { withArticle } from '../effects/toolNames.js';
import * as BoardState from './BoardState.js';
import * as GroundRules from './GroundRules.js';
import { nearRadius } from './nearby.js';

/**
 * A Token type's site: the ground under its centre (its "Stands on", `GroundRules`) and, for a type
 * with a "Stands near" (`standsNear`), a Token of one of those types within Near of its centre (an
 * Arcane node in reach of a leyline). `MatPlacement` asks both of every spot; a Foundation asks
 * them of the Token it is set to build, at its own centre, so a mine is never built off its Stone.
 */

/** The sentence a spot with none of `typeIds` in reach is refused with: "Needs a Leyline or an Altar nearby." */
export function nearText(typeIds) {
    const names = typeIds.map(id => withArticle(tokenName(id)));
    const list = names.length < 2 ? names[0] || 'a Token' : `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
    return `Needs ${list} nearby.`;
}

/**
 * What the "Stands near" rule of `typeId` asks: `{ typeIds, reason }`, or null when it has none
 * (every shipped Token today, so a search asks nothing more per candidate).
 */
export function nearRulesFor(typeId) {
    const typeIds = standsNearOf(typeId);
    return typeIds.length ? { typeIds, reason: nearText(typeIds) } : null;
}

/**
 * The centres a "Stands near" rule can be met by on the board as it is now, skipping `excludeId`
 * (the Token being moved, or the Foundation being built on): read once per search.
 */
export function anchorsFor(rules, excludeId = null) {
    if (!rules) return null;
    const out = [];
    for (const t of BoardState.tokens()) {
        if (t.id === excludeId || !Number.isFinite(t.x) || !Number.isFinite(t.y)) continue;
        if (rules.typeIds.includes(t.typeId)) out.push({ x: t.x, y: t.y });
    }
    return out;
}

/** Whether one of `anchors` stands within `radius` of `(x, y)`. */
export function nearMetAt(anchors, x, y, radius = nearRadius()) {
    const r2 = radius * radius;
    for (const a of anchors) {
        const dx = a.x - x;
        const dy = a.y - y;
        if (dx * dx + dy * dy <= r2) return true;
    }
    return false;
}

/**
 * Why a Token of `typeId` may not stand with its centre at `point`, as far as its site goes (its
 * ground, then what it must stand near), or null when it may. Crowding is not asked.
 */
export function siteRefusal(typeId, point, { excludeId = null } = {}) {
    if (!typeId || !point) return null;
    if (!GroundRules.mayStandAt(typeId, point)) return GroundRules.refusalFor(typeId);
    const near = nearRulesFor(typeId);
    if (near && !nearMetAt(anchorsFor(near, excludeId), point.x, point.y)) return near.reason;
    return null;
}

/**
 * What a Token type's site asks, for a recipe row: `{ label, text }` ("Stone" and "Needs stone."),
 * or null when it may stand anywhere dry with nothing near.
 */
export function siteNeeds(typeId) {
    const standsOn = standsOnOf(typeId);
    const near = nearRulesFor(typeId);
    if (!standsOn.length && !near) return null;
    const labels = [];
    const texts = [];
    if (standsOn.length) {
        labels.push(STANDS_ON_CHOICES.filter(c => standsOn.includes(c.id)).map(c => c.label).join(' or '));
        texts.push(needsText(standsOn));
    }
    if (near) {
        labels.push(`Near ${near.typeIds.map(id => tokenName(id)).join(' or ')}`);
        texts.push(near.reason);
    }
    return { label: labels.join(', '), text: texts.join(' ') };
}

/** The Token a building recipe makes, or null. */
export function builtTypeOf(recipe) {
    return (recipe?.outputs || []).find(o => o?.tokenId)?.tokenId || null;
}

/**
 * The Token a Foundation on the mat is set to build, or null: a Foundation with a build chosen
 * stands under that Token's site rules when it is moved.
 */
export function siteTypeOf(instance) {
    const id = instance?.selectedRecipeId;
    if (!id) return null;
    const def = getTokenType(instance.typeId);
    if (!def?.foundation) return null;
    return builtTypeOf(recipesForFoundation(def).find(r => r.id === id));
}

/** Why the Foundation `instance` cannot build `typeId` where it stands, or null. */
export function buildRefusal(instance, typeId) {
    if (!instance || !typeId || !Number.isFinite(instance.x) || !Number.isFinite(instance.y)) return null;
    return siteRefusal(typeId, { x: instance.x, y: instance.y }, { excludeId: instance.id });
}
