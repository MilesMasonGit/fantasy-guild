// Fantasy Guild — the `Applies` keyword, board side (effect grammar Phase 2)

import { getStatusEffect } from '../../config/registries/statusRegistry.js';
import * as StatusEffectSystem from '../effects/StatusEffectSystem.js';
import * as LiveEffects from '../effects/LiveEffects.js';

/**
 * How an instantly-applied effect runs its statements.
 *
 * ⚠️ **Injected, not imported.** `TriggerSystem` imports this module, so
 * importing it back would be a static cycle. The board owns "run a statement";
 * this module only knows *who* to run it on. Same shape as `LiveEffects.tick`,
 * which takes its firer as an argument for the same reason.
 *
 * Null until the board wires it, and a chained apply simply does nothing until
 * then — which is the honest answer outside a running board.
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
 * `Applies` — content putting a status on somebody.
 *
 * Seven statuses exist and work, and `StatusEffectSystem` has applied them
 * correctly since it was built — but **only combat ever called it**. Nothing a
 * person could author reached them. This is that wire.
 *
 * ## ⚠️ The honest part: a filter selects Tokens, a status lands on a person
 * The owner ruled that `Applies` uses the same filter as every other keyword,
 * so the grammar has one targeting concept rather than two. That is the right
 * call for authoring and it leaves exactly one thing to resolve honestly: what
 * does *"nearby Coast Tokens"* mean when the thing being applied cannot land
 * on a Token at all?
 *
 * **The only reading that is true of something real: the people working them.**
 * A Token holds at most one hero, and an enemy Token holds at most one live
 * fight. So a filter selecting Tokens resolves to that set of occupants, and
 * `statementText.js` renders the sentence as *"Applies Well Fed to heroes on
 * nearby Coast Tokens"* — which is literally what happens, rather than a
 * shorter sentence that would leave the reader guessing.
 *
 * A filter that selects a Token nobody is working reaches nobody. That is not a
 * failure; it is the same as a buff aimed at an empty spot, and it is why the
 * sentence says *heroes on* rather than *Tokens*.
 *
 * ## By instance id (Free Playmat slice 1.6b)
 * Every Token here is named by its **instance id**; there are no tiles.
 *
 * ## Two moments, matching `Grants` exactly
 * * **Untriggered** — the neighbour finishing a cycle. It is the only ambient
 *   instant at which a status could land on the person who was working, and it
 *   is the same moment `Grants` uses, so the two keywords read alike.
 * * **Triggered** — whenever the `When` clause fires.
 *
 * A status is a stack applied at an instant, not a field that hangs in the air,
 * so there is deliberately **no** continuously-reapplied form. One would put a
 * fresh stack on the hero every tick and pin every DoT at maximum forever.
 *
 * ## ⚠️ A library effect reaches an enemy by the SAME occupant rule
 * `occupantOf` has always resolved hero-first-else-enemy, but the two
 * library-effect branches below asked who was on the Token directly and stopped
 * there — so a `Applies Poison` naming an effect could never land on a monster,
 * while the identical rule naming a status could. `liveBearerOf` is the same
 * rule again, returning a `LiveEffects` bearer instead of a status target, so
 * the two halves of `Applies` cannot resolve targets differently.
 */

/**
 * Who is working Token `instanceId`, as something a status can be applied to.
 *
 * @returns {{apply: () => void}|null}
 */
function occupantOf(instanceId) {
    /**
     * A Token's `Applies` names Tokens and resolves to whoever is on them —
     * hero if somebody is working it, otherwise the live enemy — and the hero
     * wins, because a hero working an enemy Token is the person the filter
     * meant.
     *
     * ⚠️ **There is no "prefer the enemy" reading any more** (V10b). A rule that
     * means the creature a hero is fighting says so with the enemy role and is
     * resolved by `applyToRole`, by hero, never by Token (G-43). The old
     * `payload.target` flag is converted on load and ignored here if one slips
     * through — `ContentAudit` names it.
     */
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
 * Who is working Token `instanceId`, as something a **library effect** can be
 * carried by.
 *
 * The mirror of `occupantOf`, deliberately written beside it with the same
 * hero-first reading, so both halves of `Applies` resolve a Token identically.
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
 * Used by the **ambient** path: the statement was collected by
 * `TileModifiers.collectStatusApplications`, which already matched the filter
 * against this Token, so the targeting question is settled by the time this is
 * called.
 *
 * @returns {boolean} whether anybody actually received it
 */
export function applyAt(instanceId, payload, random = Math.random) {
    /**
     * ⭐ A library effect rather than a status (V6). This is the branch that
     * makes `statusRegistry` deletable: an `Applies` naming an `effectId`
     * attaches a live instance of an ordinary library entry, with a clock on it.
     */
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
 * Put one `Applies` statement onto the **role** it aims at, instead of its
 * filter (G-42).
 *
 * Only `the enemy` is allowed (`KEYWORDS`' allowlist), and it is found by hero,
 * never by Token (G-43). Nothing else resolves here: a role outside the
 * allowlist reaches nobody rather than guessing.
 *
 * ⭐ Since V10b this is the ONLY way an `Applies` reaches the enemy: the old
 * `target: 'enemy'` flag is converted to this role on load
 * (`migrateAppliesTarget`).
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
 * Used by the **triggered** path, where the statement is read from the Token
 * carrying it rather than from the Token receiving it, so the filter has to be
 * matched here.
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

    /**
     * ⚠️ A **library effect** rather than a status (V6). `rolls` below insists
     * on a `statusId`, so without this branch a triggered `Applies` naming an
     * effect returned zero and the rule was inert — the same gap the ambient
     * path had.
     */
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

    // The outbound filter loop lives in `TileModifiers.filterTargets` since
    // Effects Robustness P1 — it used to be written out here, and being written
    // out here once was why `TriggerSystem` never got a copy and a triggered
    // `Grants` ignored its filter for the whole of Unified Effects.
    for (const id of filterTargets(sourceId, statement, fallbackPoint)) {
        const target = occupantOf(id);
        if (!target) continue;
        target.apply(payload.statusId, Math.max(1, payload.stacks || 1));
        reached += 1;
    }

    return reached;
}
