// the `Applies` keyword, board side

import { getStatusEffect } from '../../config/registries/statusRegistry.js';
import * as StatusEffectSystem from '../effects/StatusEffectSystem.js';
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

/**
 * `Applies`: content putting a status on somebody.
 *
 * ⚠️ A filter selects Tokens, a status lands on a person. `Applies` uses the same filter as every
 * other keyword, so a filter selecting Tokens resolves to the people working them: a Token holds at
 * most one hero, and an enemy Token at most one live fight. `statementText.js` renders it as
 * Applies Well Fed to heroes on nearby Coast Tokens, which is literally what happens. A filter that
 * selects a Token nobody is working reaches nobody: not a failure, the same as a buff aimed at an
 * empty spot.
 *
 * Two moments, matching `Grants`: untriggered (the neighbour finishing a cycle) and triggered
 * (whenever the `When` clause fires). A status is a stack applied at an instant, so there is
 * deliberately no continuously-reapplied form: it would put a fresh stack on the hero every tick
 * and pin every DoT at maximum.
 *
 * ⚠️ A library effect reaches an enemy by the SAME occupant rule. `occupantOf` resolves
 * hero-first-else-enemy, and `liveBearerOf` is the same rule returning a `LiveEffects` bearer, so
 * the two halves of `Applies` (a status and a named effect) cannot resolve targets differently.
 */

/**
 * Who is working Token `instanceId`, as something a status can be applied to.
 *
 * @returns {{apply: () => void}|null}
 */
function occupantOf(instanceId) {
    // A Token's `Applies` names Tokens and resolves to whoever is on them: the hero if somebody is
    // working it, otherwise the live enemy. The hero wins, because a hero working an enemy Token is
    // the person the filter meant.
    // ⚠️ There is no prefer-the-enemy reading. A rule that means the creature a hero is fighting
    // says so with the enemy role and is resolved by `applyToRole`, by hero, never by Token. The
    // old `payload.target` flag is converted on load and ignored here if one slips through.
    const heroId = BoardState.workerOf(instanceId);
    if (heroId) {
        return { apply: (statusId, stacks) => StatusEffectSystem.applyToHero(heroId, statusId, stacks) };
    }

    const instance = BoardState.getTokenById(instanceId);
    if (!instance || !BoardCombat.isEnemyToken(instance)) return null;
    const fight = BoardCombat.getFight(instanceId);
    // Only a fight in progress: an enemy nobody has engaged has no status
    // list to put anything on, and inventing one here would make a status
    // that survives being ignored.
    if (!fight) return null;
    return { apply: (statusId, stacks) => StatusEffectSystem.applyToEnemy(fight, statusId, stacks) };
}

/**
 * Who is working Token `instanceId`, as something a library effect can be carried by. The mirror of
 * `occupantOf`, written beside it with the same hero-first reading.
 */
function liveBearerOf(instanceId) {
    const heroId = BoardState.workerOf(instanceId);
    if (heroId) {
        const hero = HeroManager.getHero(heroId);
        return hero ? LiveEffects.heroBearer(hero) : null;
    }
    return BoardCombat.enemyBearerOfToken(instanceId);
}

/** Whether a payload names a status the engine has, with a roll that hit. */
function rolls(payload, random = Math.random) {
    if (!payload?.statusId || !getStatusEffect(payload.statusId)) return false;
    return rollsChance(payload, random);
}

/** The chance roll alone, for payloads that name something other than a status. */
function rollsChance(payload, random = Math.random) {
    const chance = payload.chance ?? 100;
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
    // A library effect rather than a status: an `Applies` naming an `effectId` attaches a live
    // instance of an ordinary library entry, with a clock on it.
    if (payload?.effectId) {
        if (!rollsChance(payload, random)) return false;
        const bearer = liveBearerOf(instanceId);
        if (!bearer) return false;
        return LiveEffects.applyTo(bearer, payload, payload.sourceEffectId || null, fireLive);
    }

    if (!rolls(payload, random)) return false;
    const target = occupantOf(instanceId);
    if (!target) return false;
    target.apply(payload.statusId, Math.max(1, payload.stacks || 1));
    return true;
}

/**
 * Put one `Applies` statement onto the role it aims at, instead of its filter.
 *
 * Only `the enemy` is allowed (`KEYWORDS`' allowlist), and it is found by hero, never by Token. A
 * role outside the allowlist reaches nobody rather than guessing. This is the ONLY way an `Applies`
 * reaches the enemy: the old `target: 'enemy'` flag is converted to this role on load
 * (`migrateAppliesTargets`).
 *
 * @returns {number} how many received it (0 or 1)
 */
export function applyToRole(statement, roles, random = Math.random) {
    if (statement?.target?.role !== ROLE.OPPONENT) return 0;
    const payload = statement?.payload;

    if (payload?.effectId) {
        if (!rollsChance(payload, random)) return 0;
        const bearer = BoardCombat.opponentBearerOf(statement, roles);
        if (!bearer) return 0;
        return LiveEffects.applyTo(bearer, payload, statement.sourceEffectId || null, fireLive) ? 1 : 0;
    }

    if (!rolls(payload, random)) return 0;
    const fight = BoardCombat.opponentFightOf(statement, roles);
    if (!fight) return 0;
    StatusEffectSystem.applyToEnemy(fight, payload.statusId, Math.max(1, payload.stacks || 1));
    return 1;
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

    // ⚠️ A library effect rather than a status: `rolls` below insists on a `statusId`, so without
    // this branch a triggered `Applies` naming an effect would return zero and be inert.
    if (payload?.effectId) {
        if (!rollsChance(payload, random)) return 0;
        let landed = 0;
        for (const id of filterTargets(sourceId, statement, fallbackPoint)) {
            const bearer = liveBearerOf(id);
            if (bearer && LiveEffects.applyTo(bearer, payload, statement.sourceEffectId || null, fireLive)) {
                landed += 1;
            }
        }
        return landed;
    }

    if (!rolls(payload, random)) return 0;

    let reached = 0;

    // The outbound filter loop lives in `TileModifiers.filterTargets`, shared with `TriggerSystem`.
    for (const id of filterTargets(sourceId, statement, fallbackPoint)) {
        const target = occupantOf(id);
        if (!target) continue;
        target.apply(payload.statusId, Math.max(1, payload.stacks || 1));
        reached += 1;
    }

    return reached;
}
