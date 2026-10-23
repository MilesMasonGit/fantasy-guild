import { EventBus } from '../../../systems/core/EventBus.js';
import { UI_EVENTS } from '../../../systems/core/engineEvents.js';

/**
 * Equip through the engine and say a refusal where it happened: a callout where the item was let
 * go (the hero's tab or panel), with the engine's own reason, never a notification. Returns `false`
 * so the drag system counts the drop as a miss: the ghost flies back to where it came from and the
 * equip sound does not play (`DndKit.jsx`'s `handleDragEnd`).
 * Discarding `equipItem`'s result would make a refused equip (already carried, no free slot,
 * out of stock) look exactly like a successful one, with nothing on screen saying why.
 *
 * `payload`: the drag's own payload. When it was lifted from another hero's slot, that hero's copy
 * is handed over rather than another taken from the Bank.
 * @returns {boolean} whether the equip actually happened
 */
export function equipOrAnnounce(equipment, heroId, itemId, preferredSlot = null, payload = null) {
    const from = payload?.fromHeroId != null && payload?.fromSlot != null
        ? { heroId: payload.fromHeroId, slot: payload.fromSlot }
        : null;
    const result = equipment.equipItem(heroId, itemId, preferredSlot, from);
    if (!result?.success) {
        EventBus.publish(UI_EVENTS.UI_SCREEN_CALLOUT, { text: result?.error || 'Could not equip that' });
        return false;
    }
    return true;
}

/**
 * Unequip through the engine and say a refusal (a full Bank keeps the copy with the hero) the same
 * way. Returns `false` so a drop on the Bank counts as a miss and the ghost flies back.
 * @returns {boolean} whether the item came off
 */
export function unequipOrAnnounce(equipment, heroId, slot) {
    const result = equipment.unequipItem(heroId, slot);
    if (!result?.success) {
        EventBus.publish(UI_EVENTS.UI_SCREEN_CALLOUT, { text: result?.error || 'Could not take that off' });
        return false;
    }
    return true;
}
