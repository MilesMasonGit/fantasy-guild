import { EventBus } from '../../../systems/core/EventBus.js';
import { UI_EVENTS } from '../../../systems/core/engineEvents.js';

/**
 * Equip through the engine and say a refusal where it happened: a callout where the item was let
 * go (the hero's tab or panel), with the engine's own reason, never a notification. Returns `false`
 * so the drag system counts the drop as a miss: the ghost flies back to where it came from and the
 * equip sound does not play (`DndKit.jsx`'s `handleDragEnd`).
 * Discarding `equipItem`'s result would make a refused equip (already carried, no free slot,
 * out of stock) look exactly like a successful one, with nothing on screen saying why.
 * @returns {boolean} whether the equip actually happened
 */
export function equipOrAnnounce(equipment, heroId, itemId, preferredSlot = null) {
    const result = equipment.equipItem(heroId, itemId, preferredSlot);
    if (!result?.success) {
        EventBus.publish(UI_EVENTS.UI_SCREEN_CALLOUT, { text: result?.error || 'Could not equip that' });
        return false;
    }
    return true;
}
