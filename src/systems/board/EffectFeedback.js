// telling the player a named effect just did something

import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from './boardEvents.js';

/**
 * A named effect fired, and the player should see its name.
 *
 * ⚠️ Announce only where ONE named effect discretely acted. A scalar axis is merged before use
 * (`resolveAxis` sums every contribution reaching a tile), so a proc off that number has no single
 * effect to name. The announce sites are a triggered statement firing, an item grant rolling and
 * dropping, and a status landing. A continuous `Provides` announces nothing: nothing happened.
 *
 * `effectTitle` carries the scale numeral because the bearer's version is what fired.
 */

/**
 * Announce that the effect behind `statement` acted on Token `instanceId`. Silent for anything with
 * no title: a fixture authoring statements inline has no library entry behind it.
 *
 * The mat draws two more things from it when it can: a spark from the Token whose rule reached
 * here (`statement.fromTokenId`, set by `TileModifiers` on a neighbour's rule) and a rising `+N` for
 * what landed (`amount`, passed only where the caller knows the grant really dropped).
 *
 * @param {string} instanceId the Token it acted on
 * @param {object} statement an expanded statement, carrying `effectTitle`
 * @param {{amount?: number}} [extra]
 */
export function announce(instanceId, statement, { amount = null } = {}) {
    const title = statement?.effectTitle;
    if (!title || instanceId == null) return;
    const payload = { instanceId, title };
    if (statement.fromTokenId != null) payload.fromTokenId = statement.fromTokenId;
    if (amount > 0) payload.amount = amount;
    EventBus.publish(BOARD_EVENTS.EFFECT_FIRED, payload);
}

/**
 * A support's bonus just landed on Token `instanceId` (an item came out doubled, a Field ripened
 * with extra harvests): the mat draws its quiet pop, a spark from the support and a rising `+N`
 * (`matFx`), with no name said over it, since several supports merge into one number.
 *
 * ⚠️ Silent, and does no work, during a catch-up (a quiet bus): `sourceOf`, which looks the support
 * up, is asked only when the pop will be drawn.
 *
 * @param {string} instanceId
 * @param {number} amount what the bonus added
 * @param {(() => string|null)|null} [sourceOf] the support the spark starts from
 */
export function popBonus(instanceId, amount, sourceOf = null) {
    if (instanceId == null || !(amount > 0) || EventBus.isQuiet()) return;
    const payload = { instanceId, amount, bonus: true };
    const from = sourceOf?.() ?? null;
    if (from != null) payload.fromTokenId = from;
    EventBus.publish(BOARD_EVENTS.EFFECT_FIRED, payload);
}
