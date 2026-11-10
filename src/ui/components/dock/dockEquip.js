import { EventBus } from '../../../systems/core/EventBus.js';
import { UI_EVENTS } from '../../../systems/core/engineEvents.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { getSkill } from '../../../config/registries/skillRegistry.js';
import { unmetGearRequirement } from '../../../config/registries/weaponStyles.js';
import { getHero } from '../../../systems/hero/HeroManager.js';
import { InventoryManager } from '../../../systems/inventory/InventoryManager.js';
import { takesCopy } from '../../../systems/equipment/heldCopies.js';
import { formatCompact } from '../../../utils/Formatters.js';
import { t } from '../../../i18n/index.js';
import { announceEquip } from './equipBubbles.js';
import { SPEECH_TONE } from '../board/speechTone.js';

/** What the words read from the game; a test passes its own. */
const GAME = Object.freeze({
    itemOf: (itemId) => getItem(itemId),
    // The engine's own requirement check, so the numbers are the ones it refused on.
    unmetOf: (heroId, itemId) => {
        const hero = getHero(heroId);
        const item = getItem(itemId);
        return hero && item ? unmetGearRequirement(item, hero) : null;
    },
    skillName: (skillId) => getSkill(skillId)?.name || skillId,
    // Gear takes a copy of its own; food and drink stay linked to the Bank's whole stack.
    isStack: (itemId) => !takesCopy(itemId),
    bankCount: (itemId) => InventoryManager.getItemCount(itemId)
});

const withStop = (text) => (/[.!?)]$/.test(text) ? text : `${text}.`);

/** "Can't equip Mythril Scimitar. Melee skill too low. (12/40)", or the engine's own reason. */
export function equipRefusalText(heroId, itemId, error, game = GAME) {
    const item = game.itemOf(itemId)?.name || 'that';
    const unmet = game.unmetOf(heroId, itemId);
    const reason = unmet
        ? t('heroBar.skillTooLow', { skill: game.skillName(unmet.skill), have: unmet.have, need: unmet.level })
        : withStop(error || 'Could not equip that');
    return t('heroBar.cantEquip', { item, reason });
}

/** "Equipped Iron Woodaxe"; a stack linked to the Bank with its short count, "Equipped Shrimp x4.6k". */
export function equipSuccessText(itemId, game = GAME) {
    const item = game.itemOf(itemId)?.name || itemId;
    return game.isStack(itemId)
        ? t('heroBar.equippedStack', { item, count: formatCompact(game.bankCount(itemId), 1) })
        : t('heroBar.equipped', { item });
}

/** "Unequipped Iron Woodaxe": the hero an item was handed from. */
export function unequipText(itemId, game = GAME) {
    return t('heroBar.unequipped', { item: game.itemOf(itemId)?.name || itemId });
}

/**
 * Whether an equip under way is a hand-over from one hero to another: the hero panel stays on the
 * hero it shows rather than turning to the one who took the item (`useHeroSheetRequests`). True
 * only inside the engine's equip call, whose events are published synchronously.
 */
let handingOver = false;
export const isHandingOver = () => handingOver;

/**
 * Equip through the engine and say what happened over that hero on the hero bar
 * (`equipBubbles.js`): what was equipped, or the refusal with the exact reason and numbers, never a
 * notification. A refusal returns `false` so the drag system counts the drop as a miss: the ghost
 * flies back to where it came from and the equip sound does not play (`DndKit.jsx`'s
 * `handleDragEnd`).
 *
 * `payload`: the drag's own payload. Lifted from this hero's own slot and dropped on another of
 * theirs, it moves there and swaps with what is there (a success says nothing: nothing new is
 * equipped). Lifted from another hero's slot, it is handed over rather than another taken from the
 * Bank: the taker says what was equipped, the giver what was unequipped, and the hero panel stays
 * where it is ({@link isHandingOver}).
 * @returns {boolean} whether the equip actually happened
 */
export function equipOrAnnounce(equipment, heroId, itemId, preferredSlot = null, payload = null, game = GAME) {
    const from = payload?.fromHeroId != null && payload?.fromSlot != null
        ? { heroId: payload.fromHeroId, slot: payload.fromSlot }
        : null;
    const isMove = from?.heroId === heroId && preferredSlot !== null;
    const isHandover = !!from && from.heroId !== heroId;
    let result;
    handingOver = isHandover;
    try {
        result = isMove
            ? equipment.moveItem(heroId, itemId, from.slot, preferredSlot)
            : equipment.equipItem(heroId, itemId, preferredSlot, from);
    } finally {
        handingOver = false;
    }
    if (!result?.success) {
        const text = isMove
            ? t('heroBar.cantEquip', { item: game.itemOf(itemId)?.name || 'that', reason: withStop(result?.error || 'Could not move that') })
            : equipRefusalText(heroId, itemId, result?.error, game);
        announceEquip(heroId, text, SPEECH_TONE.CANT);
        return false;
    }
    if (!isMove) announceEquip(heroId, equipSuccessText(itemId, game), SPEECH_TONE.PLAIN);
    // Handed over: the hero it came from says so too.
    if (isHandover) announceEquip(from.heroId, unequipText(itemId, game), SPEECH_TONE.PLAIN);
    return true;
}

/**
 * Unequip through the engine and say a refusal (a full Bank keeps the copy with the hero) as a
 * callout where the item was let go. Returns `false` so a drop on the Bank counts as a miss and
 * the ghost flies back.
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
