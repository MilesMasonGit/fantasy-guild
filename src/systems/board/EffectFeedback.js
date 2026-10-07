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
 * @param {string} instanceId the Token it acted on
 * @param {object} statement an expanded statement, carrying `effectTitle`
 */
export function announce(instanceId, statement) {
    const title = statement?.effectTitle;
    if (!title || instanceId == null) return;
    EventBus.publish(BOARD_EVENTS.EFFECT_FIRED, { instanceId, title });
}
