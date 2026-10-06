
import * as NotificationSystem from '../../../systems/core/NotificationSystem.js';

/**
 * Equip through the engine and report a refusal the way the mat and the bin already do
 * (`dropOnMat.js`'s `announce`, `DiscardBinPanel.jsx`'s `dropIntoBin`): a short notification
 * with the engine's own reason, and `false` so the drag system counts the drop as a miss: the
 * ghost flies back to where it came from and the equip sound does not play (`DndKit.jsx`'s
 * `handleDragEnd`).
 * Discarding `equipItem`'s result would make a refused equip (already carried, no free slot,
 * out of stock) look exactly like a successful one, with nothing on screen saying why.
 * @returns {boolean} whether the equip actually happened
 */
export function equipOrAnnounce(engine, heroId, itemId, preferredSlot = null) {
    const result = engine.EquipmentManager.equipItem(heroId, itemId, preferredSlot);
    if (!result?.success) {
        NotificationSystem.warning(result?.error || 'Could not equip that');
        return false;
    }
    return true;
}
