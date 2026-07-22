// Fantasy Guild - Equipment Constants
// Hero Dock rework, Phase 1: two equipment slots became six.

/**
 * Equipment is modelled in two layers:
 *
 *  - **Categories** are what an ITEM declares via its `equipSlot` field:
 *    hand / hat / chest / trinket. An item knows what kind of thing it is,
 *    not which of the hero's slots it will end up in.
 *  - **Slot instances** are what a HERO carries. Two categories have two
 *    instances each (`hand1`/`hand2`, `trinket1`/`trinket2`), so a hero can
 *    wear two of them at once.
 *
 * `equipItem` resolves an item's category to the first free instance of that
 * category (see EquipmentManager.resolveTargetSlot).
 *
 * Two free hands, no main/off distinction: either hand takes any weapon and
 * their bonuses stack (hero_dock_roadmap_v1.md D2). Where combat needs to name
 * a single weapon — the style it drives, the durability it burns — that is the
 * PRIMARY weapon: the first occupied hand. See getPrimaryWeaponSlot below.
 *
 * Hero-carried food/drink were retired earlier (CR-029): consumables live in
 * deck card slots and the station Drink slot instead.
 */

/** The slot instances a hero carries, in dock-card display order (2 rows of 3). */
export const EQUIPMENT_SLOTS = {
    HAND_1: 'hand1',
    HAND_2: 'hand2',
    HAT: 'hat',
    CHEST: 'chest',
    TRINKET_1: 'trinket1',
    TRINKET_2: 'trinket2'
};

/** Display order for the 2x3 equipment grid on the Hero Dock card. */
export const SLOT_ORDER = ['hand1', 'hand2', 'hat', 'chest', 'trinket1', 'trinket2'];

/** What an item's `equipSlot` field may say. */
export const EQUIPMENT_CATEGORIES = {
    HAND: 'hand',
    HAT: 'hat',
    CHEST: 'chest',
    TRINKET: 'trinket'
};

/** slot instance -> the category of item it accepts. */
export const SLOT_CATEGORY = {
    hand1: 'hand',
    hand2: 'hand',
    hat: 'hat',
    chest: 'chest',
    trinket1: 'trinket',
    trinket2: 'trinket'
};

/** category -> its slot instances, in fill order. */
export const CATEGORY_SLOTS = {
    hand: ['hand1', 'hand2'],
    hat: ['hat'],
    chest: ['chest'],
    trinket: ['trinket1', 'trinket2']
};

/** The hand slots, in fill order — the ones a weapon can occupy. */
export const HAND_SLOTS = CATEGORY_SLOTS.hand;

/** Slot display info (icons and labels). Paired slots share a label. */
export const SLOT_INFO = {
    hand1: { icon: '⚔️', label: 'Hand' },
    hand2: { icon: '⚔️', label: 'Hand' },
    hat: { icon: '🎩', label: 'Hat' },
    chest: { icon: '🛡️', label: 'Chest' },
    trinket1: { icon: '💍', label: 'Trinket' },
    trinket2: { icon: '💍', label: 'Trinket' }
};

/** A fresh, fully-keyed equipment object — every slot present and empty. */
export function createEmptyEquipment() {
    return { hand1: null, hand2: null, hat: null, chest: null, trinket1: null, trinket2: null };
}

/**
 * The slot holding the hero's primary weapon — the first occupied hand, or
 * null when both are empty (unarmed).
 *
 * Combat asks for this in two places: the equipped weapon decides the hero's
 * combat style, and an attack burns durability on the weapon that swung. With
 * two hands those need a tie-break, and "first occupied" keeps single-weapon
 * behaviour identical to the old single `weapon` slot.
 */
export function getPrimaryWeaponSlot(hero) {
    return HAND_SLOTS.find(slot => hero?.equipment?.[slot]) || null;
}

/** The item id of the hero's primary weapon, or null when unarmed. */
export function getPrimaryWeapon(hero) {
    const slot = getPrimaryWeaponSlot(hero);
    return slot ? hero.equipment[slot] : null;
}

export default {
    EQUIPMENT_SLOTS,
    SLOT_ORDER,
    EQUIPMENT_CATEGORIES,
    SLOT_CATEGORY,
    CATEGORY_SLOTS,
    HAND_SLOTS,
    SLOT_INFO,
    createEmptyEquipment,
    getPrimaryWeaponSlot,
    getPrimaryWeapon
};
