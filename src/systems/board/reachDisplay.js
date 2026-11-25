// which Tokens show a reach ring, and which Tokens its dots mark

import { getTokenType, getProvidedTagsWithTiers } from '../../config/registries/tokenRegistry.js';
import { recipesForToken, contextTagsOf } from '../../config/registries/recipePoolRegistry.js';
import { KEYWORD, caresAboutNeighbours, neighbourPartsOf, statementsOf } from '../effects/statements.js';
import { campOf } from '../../config/registries/tokenConstants.js';
import { reachRadius, isWithin, centreOf } from './nearby.js';
import { isStatementPaid, paidTestFor } from './BlockUpkeep.js';
import { matchesTokenTarget } from './TileModifiers.js';
import { supportPayloadOf, narrowingFits } from './supportLinks.js';
import { sourceMatches } from './TriggerSystem.js';
import { countsAgainst } from './Restrictions.js';
import { resolveRecipe, servesStation, providedBy } from './RecipeResolver.js';
import { validateSelection } from './StationRecipe.js';
import { buildTargetOf } from './Foundations.js';
import * as Camps from './Camps.js';
import { isEnemyCampType } from './SpawnerSystem.js';
import * as BoardState from './BoardState.js';

/**
 * Whether a Token shows the reach ring (and its dots) when hovered or dragged: an unbuilt
 * Foundation, a work camp, or a Token that acts on or depends on what is near it. A plain resource, a Map or the Guild Hall shows none, and nor does an enemy
 * camp (a spawner of enemies), whatever its rules: no enemy acts on what is near its camp.
 *
 * Three places say a Token cares, because content carries two generations of fields:
 * 1. its rules (`caresAboutNeighbours`)
 * 2. a legacy `provides` tool list
 * 3. a station recipe that needs context Tokens beside it
 */
export function showsNearRing(typeId) {
    const def = getTokenType(typeId);
    if (!def || isEnemyCampType(typeId)) return false;
    // A Foundation shows the reach of whatever it will become; a work camp hands out work in it.
    if (def.foundation || campOf(def)) return true;
    if (caresAboutNeighbours(def)) return true;
    if (Object.keys(getProvidedTagsWithTiers(def)).length > 0) return true;
    return recipesForToken(def).some(recipe => contextTagsOf(recipe).length > 0);
}

/**
 * The Tokens on the mat a Token of `typeId` acts on or depends on wherever it stands: the ones its
 * reach dots may mark. Worked out once for a hover or a drag; {@link reachDotsAt} then keeps those
 * within reach of where the ring is drawn. `self` is the Token itself when it is on the mat (hovered,
 * or carried across it): its upkeep, its demolition mark and its chosen recipe or building count,
 * and it never marks itself. A Token from the Shop has none of those yet.
 *
 * ⚠️ Every test here is one the engine runs itself (a camp's work, a rule's filter with a
 * support's narrowing, a moment's source, a count, a `Cannot`, a recipe's context, a Foundation's
 * chosen building), never a second list, so a dot cannot disagree with what the Token does. Which
 * parts of a rule are about its neighbours is `statements.neighbourPartsOf`, the same test that
 * decides the ring shows at all.
 * @param {string} typeId
 * @param {object|null} [self]
 * @returns {Array<{id: string, x: number, y: number}>}
 */
export function reachTargets(typeId, self = null) {
    const test = affectsTest(typeId, self);
    if (!test) return [];
    const out = [];
    for (const other of BoardState.tokens()) {
        if (other.id === self?.id) continue;
        const centre = centreOf(other);
        if (centre && test(other, getTokenType(other.typeId))) out.push({ id: other.id, x: centre.x, y: centre.y });
    }
    return out;
}

/**
 * The marks of `targets` ({@link reachTargets}) that wear an in-reach dot while a ring is drawn at
 * `point`. ⚠️ Measured with the engine's own distance test (`nearby.isWithin`, the one
 * `Camps.reaches` and every `nearby` rule measure with), so a dot never disagrees with what is
 * worked; never write a second distance test here. Heroes and floor loot are not Tokens on the
 * mat, so they never get one.
 * @returns {Array<{id: string, x: number, y: number}>}
 */
export function reachDotsAt(point, targets, radius = reachRadius()) {
    if (!point || !targets?.length) return [];
    return targets.filter(t => isWithin(point, t, radius));
}

/**
 * One test, `(other, otherDef) => boolean`, for whether a Token of `typeId` acts on or depends on
 * `other` when they stand within reach of each other, or null when it touches nothing.
 */
function affectsTest(typeId, self) {
    const def = getTokenType(typeId);
    if (!def) return null;
    const tests = [];

    // A Foundation marks what the building chosen on it will touch, a fresh Token where it stands.
    if (def.foundation) {
        const building = self ? buildTargetOf(validateSelection(self, def)) : null;
        const inner = building && building !== typeId ? affectsTest(building, null) : null;
        if (inner) tests.push(inner);
    }

    const camp = self ? Camps.campOfInstance(self) : campOf(def);
    if (camp) tests.push(other => Camps.handsOut(camp, other));

    for (const statement of statementsOf(def)) {
        // An unpaid rule is off until stock returns, wherever the engine reads it.
        if (self && !isStatementPaid(self, statement?.id)) continue;
        tests.push(...ruleTests(statement));
    }

    // A capability (`Acts as`, or a legacy `provides`): the stations whose chosen recipe wants it.
    const tags = Object.keys(getProvidedTagsWithTiers(def, self ? paidTestFor(self) : null));
    if (tags.length) tests.push(other => servesStation(tags, other));

    // A station whose chosen recipe wants Tokens beside it: the ones that hand it what it wants.
    const wanted = self ? contextTagsOf(resolveRecipe(self.id, self).recipe) : [];
    if (wanted.length) tests.push(other => Object.keys(providedBy(other)).some(tag => wanted.includes(tag)));

    if (!tests.length) return null;
    return (other, otherDef) => tests.some(test => test(other, otherDef));
}

/** The tests one rule adds: one for each of its parts about what is near its Token. */
function ruleTests(statement) {
    const parts = neighbourPartsOf(statement);
    if (!parts) return [];
    const ctxOf = (other) => ({ instance: other, tokenId: other.id });
    const out = [];
    // `Acts as` is read with the capabilities; `Requires` is retired and reads nothing.
    if (parts.keyword && statement.keyword === KEYWORD.CANNOT) {
        out.push((other, def) => countsAgainst(statement, def));
    }
    if (parts.source) out.push(other => sourceMatches(statement.when, other.typeId));
    if (parts.counted) out.push((other, def) => matchesTokenTarget(statement.counted, def, ctxOf(other)));
    if (parts.to) {
        const to = toTest(statement);
        if (to) out.push((other, def) => to(def, ctxOf(other)));
    }
    return out;
}

/** The test of a rule's own filter, as the engine reads it for that kind of rule, or null when it reaches nothing. */
function toTest(statement) {
    // A rule with a moment acts, as it fires, on the Tokens its filter names (`TileModifiers.filterTargets`).
    if (statement.when?.event) return (def, ctx) => matchesTokenTarget(statement.to, def, ctx);
    // A standing `Applies` that names no status or effect reaches nobody (`TileModifiers`' walk).
    if (statement.keyword === KEYWORD.APPLIES) {
        if (!statement.payload?.statusId && !statement.payload?.effectId) return null;
        return (def, ctx) => matchesTokenTarget(statement.to, def, ctx);
    }
    // A standing `Provides` or `Grants` is a support: only what its narrowing fits, as the card and
    // the drag's lit Tokens read it (`supportLinks`).
    const payload = supportPayloadOf(statement);
    if (!payload) return null;
    return (def, ctx) => narrowingFits(payload, def) && matchesTokenTarget(statement.to, def, ctx);
}

