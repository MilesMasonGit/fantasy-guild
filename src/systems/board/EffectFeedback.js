// Fantasy Guild — telling the player a named effect just did something (P3)

import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from './boardEvents.js';

/**
 * A named effect fired, and the player should see its name.
 *
 * ## Why the library was worth building, in one interaction
 * Before the effect library a rule had no name, so there was nothing to show.
 * Now every rule is a named thing, and the moment it acts is the moment that
 * name means something: *Shrimp Trawler II* floats off the tile, and the player
 * learns what their board is doing without opening anything.
 *
 * ## ⚠️ Only where ONE named effect discretely acted
 * This is the whole rule, and it is a restraint rather than an omission.
 *
 * A scalar axis is **merged before it is used**: `resolveAxis` gathers every
 * Yield contribution reaching a tile from every neighbour, sums them through the
 * three-bucket formula, and hands back one number. When a Double Loot proc lands
 * off that number there is no honest answer to "which effect did that" — three
 * Tokens may have contributed and the roll belongs to all of them. Naming one
 * would be a guess dressed as information.
 *
 * So the announcement happens at the three places where a single statement
 * demonstrably did a single thing:
 *
 * * a **triggered** statement firing (`TriggerSystem.fireStatement`),
 * * an **item grant** actually rolling and dropping (`BoardRunner`, `TriggerSystem`),
 * * a **status** actually landing on somebody (`BoardRunner`).
 *
 * A continuous `Provides` announces nothing, for the same reason it has no
 * charge cost by default: nothing *happened*, it is simply true (UE-13).
 *
 * ## The title, not the name
 * `effectTitle` carries the scale numeral — *Shrimp Trawler III* — because a
 * bearer's version is what fired, not the library entry in the abstract. It is
 * stamped onto every statement during expansion, so nothing here has to reach
 * back into the library to find it.
 */

/**
 * Announce that the effect behind `statement` acted on `tile`.
 *
 * Silent for anything with no title: a fixture authoring statements inline has
 * no library entry behind it, and a nameless pop would be worse than none.
 *
 * @param {number} tile
 * @param {object} statement an expanded statement, carrying `effectTitle`
 */
export function announce(tile, statement) {
    const title = statement?.effectTitle;
    if (!title || tile == null) return;
    EventBus.publish(BOARD_EVENTS.EFFECT_FIRED, { tile, title });
}
