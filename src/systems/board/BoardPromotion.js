// promotion on the board

import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS, ALERT } from './boardEvents.js';
import { getTokenType } from '../../config/registries/tokenRegistry.js';
import { getJob } from '../../config/registries/jobRegistry.js';
import { KEYWORD, promotedJobOf, statementsWith } from '../effects/statements.js';
import * as Charges from './Charges.js';
import * as PromotionSystem from '../hero/PromotionSystem.js';
import * as HeroManager from '../hero/HeroManager.js';
import * as BoardState from './BoardState.js';
import * as NotificationSystem from '../core/NotificationSystem.js';
import { logger } from '../../utils/Logger.js';

/**
 * Promotion on the board: the Token is the price, the tile is the ceremony. The job is read from
 * the Token's Promotes rule (Promotes the hero to Knight).
 *
 * Stand a qualified hero on a Token whose rule names a job and they train for a cycle; when it
 * completes the game asks, and only then does anything change. Confirm and the hero takes the job
 * and the Token pays the rule's price. Decline and nothing is spent. The offer comes after the
 * training because dropping a hero on a Token is starting the work, not a commitment.
 *
 * Declining costs nothing and moves nobody: the Token keeps its charges and the hero stays on the
 * tile. The tile goes `promotionPaused` and does not restart, since re-asking every thirty seconds
 * is nagging. Picking the hero up and putting them back asks again.
 *
 * ⚠️ Pause lives on the instance, which is saved board state, so a declined offer survives a
 * reload.
 *
 * Training does not start unless the promotion could actually happen: a hero who already holds the
 * job gets no alert (it makes the Token inert after a promotion with no extra state); an unmet
 * skill gate shows `ALERT.UNSKILLED`/`ALERT.ACCESS`; a Token that cannot pay shows `ALERT.CHARGES`,
 * so a price of 2 on a Token with 1 charge never trains a hero toward an offer that could never be
 * accepted.
 *
 * ⚠️ Tokens only: this reads `getTokenType` and nothing else, so an item carrying a Promotes rule
 * never reaches it.
 */

/** The job a tile's Token promotes to, resolved — or null. */
export function jobFor(instance) {
    const jobId = promotedJobOf(getTokenType(instance?.typeId));
    // A job the registry no longer has reads as "not a promotion Token", so the
    // tile falls back to whatever else it is rather than crashing a tick.
    return jobId ? getJob(jobId) || null : null;
}

/** Whether a Token promotes a hero. */
export function isPromotionToken(instance) {
    return jobFor(instance) !== null;
}

/**
 * What accepting costs this Token, in charges, read from the rule itself the same way the CMS cost
 * strip does (`Charges.statementChargeDelta`). A positive delta would restore charges on a
 * promotion; it is refused as a price of nothing rather than a refund.
 */
export function priceOf(instance) {
    const def = getTokenType(instance?.typeId);
    const job = jobFor(instance);
    if (!job) return 0;
    const statement = statementsWith(def, KEYWORD.PROMOTES).find(st => st?.payload?.jobId === job.id);
    const delta = Charges.statementChargeDelta(statement);
    return delta < 0 ? -delta : 0;
}

/**
 * Why this tile cannot train this hero — or null if it can.
 *
 * @returns {{ alert: string|null, reason: string }|null}
 */
export function blockedReason(heroId, jobId) {
    const verdict = PromotionSystem.canPromote(heroId, jobId);
    if (verdict.ok) return null;

    // Already this job: done, not broken. No mark.
    if (verdict.reason === PromotionSystem.REFUSAL.SAME_JOB) {
        return { alert: null, reason: verdict.reason };
    }

    if (verdict.reason === PromotionSystem.REFUSAL.SKILL_TOO_LOW) {
        // Holding none of it at all is a different problem from holding too
        // little, and the board already draws them differently.
        const holdsNone = (verdict.missing || []).some(m => m.have === 0);
        return { alert: holdsNone ? ALERT.UNSKILLED : ALERT.ACCESS, reason: verdict.reason };
    }

    // A Villager, or a job that no longer exists. Nothing the player can act on
    // from here, so mark it unskilled rather than inventing vocabulary.
    return { alert: ALERT.UNSKILLED, reason: verdict.reason };
}

/** Whether this tile is holding a declined or unanswered offer. */
export function isPaused(instance) {
    return instance?.promotionPaused === true;
}

/**
 * Clear an offer, so the tile will train again. Called when the tile's hero changes: putting a
 * different hero down, or the same one back, is the gesture that means ask me again.
 */
export function clearPause(instance) {
    if (!instance || instance.promotionPaused == null) return;
    delete instance.promotionPaused;
    delete instance.promotionHeroId;
    delete instance.promotionDeclined;
}

/** Whether the player already answered "not yet" to the offer on this tile. */
export function isDeclined(instance) {
    return instance?.promotionDeclined === true;
}

/**
 * Training time when a Promotion Token's author has not set one. Deliberately long: this is the
 * only cycle on the board whose payoff is a different hero.
 */
export const DEFAULT_TRAINING_MS = 30000;

/**
 * Advance a promotion tile. Mirrors `BoardCombat.tickToken`: called every tick whether or not a
 * hero is on it, because this also owns stopping.
 *
 * @returns {{ alert: string|null }}
 */
export function tickToken(instance, delta, heroId) {
    const job = jobFor(instance);
    if (!job) return { alert: null };

    // Nobody here. Reset the cycle so the next hero starts from zero rather than inheriting a
    // stranger's progress.
    // ⚠️ The offer is NOT dropped: under flags a tick with nobody here is not the player's gesture
    // (a claim can lapse for a tick on its own), and clearing on it would re-ask a player who said
    // not yet. An offer is cleared only by a DIFFERENT hero claiming the Token, or by a flag being
    // planted on it (`Flags.plant`).
    if (!heroId) {
        instance.cycleElapsedMs = 0;
        return { alert: null };
    }

    // A different hero arrived — the gesture that re-asks the question.
    if (instance.promotionHeroId && instance.promotionHeroId !== heroId) {
        clearPause(instance);
        instance.cycleElapsedMs = 0;
    }

    const blocked = blockedReason(heroId, job.id);
    if (blocked) {
        instance.cycleElapsedMs = 0;
        return { alert: blocked.alert };
    }

    // An offer is standing. Not an alert: the player chose to leave it.
    if (isPaused(instance)) return { alert: null };

    // A Token that could never pay must not train toward an offer.
    if (!Charges.canAfford(instance, priceOf(instance))) {
        instance.cycleElapsedMs = 0;
        return { alert: ALERT.CHARGES };
    }

    const def = getTokenType(instance.typeId);
    const cycleMs = def?.config?.cycleTimeMs || DEFAULT_TRAINING_MS;

    instance.cycleElapsedMs = (instance.cycleElapsedMs || 0) + delta;

    EventBus.publish(BOARD_EVENTS.PROGRESS, {
        instanceId: instance.id,
        percent: Math.max(0, Math.min(100, (instance.cycleElapsedMs / cycleMs) * 100))
    });

    if (instance.cycleElapsedMs < cycleMs) return { alert: null };

    // Training done. Ask — and hold here until the player answers.
    instance.cycleElapsedMs = 0;
    instance.promotionPaused = true;
    instance.promotionHeroId = heroId;

    EventBus.publish(BOARD_EVENTS.PROMOTION_READY, {
        instanceId: instance.id,
        heroId,
        jobId: job.id,
        typeId: instance.typeId
    });

    return { alert: null };
}

/**
 * The player said yes. Everything that costs something happens here and nowhere else. The offer is
 * named by the Token's instance id, so it is found wherever the Token has been moved to.
 */
export function accept(instanceId) {
    const instance = BoardState.getTokenById(instanceId);
    const job = jobFor(instance);
    const heroId = instance?.promotionHeroId;
    if (!instance || !job || !heroId || !isPaused(instance) || isDeclined(instance)) {
        return { success: false, reason: 'NO_OFFER' };
    }

    // Re-check rather than trusting the offer: the ceremony may have sat open
    // while something changed the hero or the Token underneath it, and a stale
    // offer must not become a free promotion.
    const blocked = blockedReason(heroId, job.id);
    if (blocked) return { success: false, reason: blocked.reason };

    const price = priceOf(instance);
    if (!Charges.canAfford(instance, price)) return { success: false, reason: 'NO_CHARGES' };

    const result = PromotionSystem.promote(heroId, job.id);
    if (!result.success) return result;

    clearPause(instance);
    instance.cycleElapsedMs = 0;

    EventBus.publish(BOARD_EVENTS.CYCLE_COMPLETE, {
        instanceId: instance.id, typeId: instance.typeId, heroId, failed: false
    });

    // Spend the price. `applyDelta` also removes a Token its last charge empties, as a depleted
    // Forest or Bear leaves.
    if (price > 0) Charges.applyDelta(instance, -price, { heroId });

    const hero = HeroManager.getHero(heroId);
    NotificationSystem.success(`${hero?.name || 'Your hero'} is now a ${job.name}!`);
    logger.info('BoardPromotion', `Token ${instance.id}: ${heroId} → ${job.id} (spent ${price})`);

    return { success: true, jobId: job.id, spent: price, ...result };
}

/**
 * The player said no.
 *
 * Nothing is spent and nobody moves. The tile holds, and asks again when a hero
 * is picked up and put back down.
 */
export function decline(instanceId) {
    const instance = BoardState.getTokenById(instanceId);
    if (!instance || !isPaused(instance) || isDeclined(instance)) return { success: false, reason: 'NO_OFFER' };

    instance.cycleElapsedMs = 0;
    // ⚠️ Recorded, not just implied by the pause: an unanswered offer and a declined one both hold
    // the tile paused, and after a reload the UI re-draws a standing offer. Without this flag it
    // could not tell the two apart and would re-ask a player who already said not yet.
    instance.promotionDeclined = true;

    EventBus.publish(BOARD_EVENTS.PROGRESS, { instanceId: instance.id, percent: 0 });
    logger.info('BoardPromotion', `Token ${instance.id}: offer declined, holding`);

    return { success: true };
}

/**
 * The live offer on Token `instanceId`, for the UI to render — or null.
 *
 * A declined offer is not live: the player answered it, and it waits for the
 * hero to be picked up and put back rather than asking again.
 */
export function getOffer(instanceId) {
    const instance = BoardState.getTokenById(instanceId);
    if (!isPaused(instance) || isDeclined(instance) || !instance?.promotionHeroId) return null;
    const job = jobFor(instance);
    if (!job) return null;
    return { instanceId: instance.id, heroId: instance.promotionHeroId, jobId: job.id, typeId: instance.typeId };
}

export function init() {
    logger.info('BoardPromotion', 'Board promotion ready');
}
