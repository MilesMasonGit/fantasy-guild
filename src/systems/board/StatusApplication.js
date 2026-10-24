// the `Applies` keyword, board side

import * as LiveEffects from '../effects/LiveEffects.js';

/**
 * How an instantly-applied effect runs its statements.
 *
 * ⚠️ Injected, not imported: `TriggerSystem` imports this module, so importing it back would be a
 * static cycle. The board owns running a statement; this module only knows who to run it on. Null
 * until the board wires it, and a chained apply does nothing until then.
 */
let fireLive = null;

/** Wired once by `TriggerSystem.init`. */
export function setStatementRunner(fn) {
    fireLive = fn;
}
import { filterTargets } from './TileModifiers.js';
import * as BoardState from './BoardState.js';
import * as BoardCombat from './BoardCombat.js';
import * as HeroManager from '../hero/HeroManager.js';
import { ROLE } from '../../config/registries/roleRegistry.js';
import { momentSupplies } from '../../config/registries/triggerRegistry.js';

/**
 * `Applies`: content putting a library effect on somebody, a status (Poison, Burn) included.
 *
 * ⚠️ A filter selects Tokens, an effect lands on a person. `Applies` uses the same filter as every
 * other keyword, so a filter selecting Tokens resolves to the people working them: a Token holds at
 * most one hero, and an enemy Token at most one live fight. `statementText.js` renders it as
 * Applies Well Fed to heroes on nearby Coast Tokens, which is literally what happens. A filter that
 * selects a Token nobody is working reaches nobody: not a failure, the same as a buff aimed at an
 * empty spot.
 *
 * Two moments, matching `Grants`: untriggered (the neighbour finishing a cycle) and triggered
 * (whenever the `When` clause fires).
 *
 * ⚠️ A payload naming a retired `statusId` (the old status engine's) and no `effectId` reaches
 * nobody: statuses are library effects now, and `ContentAudit` names such a rule.
 */

/**
 * Who is working Token `instanceId`, as something a library effect can be carried by: the hero if
 * somebody is working it, otherwise the live enemy. The hero wins, because a hero working an enemy
 * Token is the person the filter meant.
 *
 * ⚠️ There is no prefer-the-enemy reading. A rule that means the creature a hero is fighting says
 * so with the enemy role and is resolved by `applyToRole`, by hero, never by Token.
 */
function liveBearerOf(instanceId) {
    const heroId = BoardState.workerOf(instanceId);
    if (heroId) {
        const hero = HeroManager.getHero(heroId);
        return hero ? LiveEffects.heroBearer(hero) : null;
    }
    return BoardCombat.enemyBearerOfToken(instanceId);
}

/** The chance roll, rolled with the shared `Math.random` only when it is not "always". */
function rollsChance(payload, random = Math.random) {
    const chance = payload?.chance ?? 100;
    return chance >= 100 || random() * 100 < chance;
}

/**
 * Put one `Applies` payload onto whoever is working Token `instanceId`.
 *
 * Used by the ambient path: the statement was collected by
 * `TileModifiers.collectStatusApplications`, which already matched the filter against this Token.
 *
 * @returns {boolean} whether anybody actually received it
 */
export function applyAt(instanceId, payload, random = Math.random) {
    if (!payload?.effectId) return false;
    if (!rollsChance(payload, random)) return false;
    const bearer = liveBearerOf(instanceId);
    if (!bearer) return false;
    return LiveEffects.applyTo(bearer, payload, payload.sourceEffectId || null, fireLive);
}

/**
 * The bearer a role names, or null. `the enemy` is found by hero, never by Token; `the hero` is
 * the moment's hero. Each only on a moment that supplies it.
 */
function roleBearerOf(statement, roles) {
    const role = statement?.target?.role;
    if (role === ROLE.OPPONENT) return BoardCombat.opponentBearerOf(statement, roles);
    if (role === ROLE.ACTOR) {
        if (!momentSupplies(statement?.when?.event, ROLE.ACTOR)) return null;
        const hero = roles?.actor ? HeroManager.getHero(roles.actor) : null;
        return hero ? LiveEffects.heroBearer(hero) : null;
    }
    return null;
}

/**
 * Put one `Applies` statement onto the role it aims at, instead of its filter.
 *
 * Only `the enemy` and `the hero` are allowed (`KEYWORDS`' allowlist). A role outside the
 * allowlist reaches nobody rather than guessing.
 *
 * @returns {number} how many received it (0 or 1)
 */
export function applyToRole(statement, roles, random = Math.random) {
    const payload = statement?.payload;
    if (!payload?.effectId) return 0;
    if (!rollsChance(payload, random)) return 0;
    const bearer = roleBearerOf(statement, roles);
    if (!bearer) return 0;
    return LiveEffects.applyTo(bearer, payload, statement.sourceEffectId || null, fireLive) ? 1 : 0;
}

/**
 * Put one `Applies` statement onto the people working the neighbours it names.
 *
 * Used by the triggered path, where the statement is read from the Token carrying it rather than
 * the Token receiving it, so the filter has to be matched here.
 *
 * @param {string} sourceId the Token carrying the statement (instance id)
 * @param {object} statement
 * @param {() => number} [random]
 * @param {{x:number,y:number}|null} [fallbackPoint] where the bearer stood, if
 *        it has already left the mat (a rule on its own depletion)
 * @returns {number} how many people received it
 */
export function applyToNeighbours(sourceId, statement, random = Math.random, fallbackPoint = null) {
    const payload = statement?.payload;
    if (!payload?.effectId) return 0;
    if (!rollsChance(payload, random)) return 0;

    let landed = 0;
    // The outbound filter loop lives in `TileModifiers.filterTargets`, shared with `TriggerSystem`.
    for (const id of filterTargets(sourceId, statement, fallbackPoint)) {
        const bearer = liveBearerOf(id);
        if (bearer && LiveEffects.applyTo(bearer, payload, statement.sourceEffectId || null, fireLive)) {
            landed += 1;
        }
    }
    return landed;
}
