import { Hand, HardHat, Shirt, Gem, Drumstick, CupSoda, FlaskConical, CircleHelp } from 'lucide-react';

/**
 * The hero loadout slots' kind marks: Lucide, as the icon rule names the gear slot icons, one per
 * equip category (`equipmentCategories.js`). A category with no mark of its own gets the "?".
 */
export const SLOT_ICONS = Object.freeze({
    hand: Hand,
    hat: HardHat,
    chest: Shirt,
    trinket: Gem,
    food: Drumstick,
    drink: CupSoda,
    consumable: FlaskConical
});

export const SLOT_ICON_UNKNOWN = CircleHelp;

/** The mark for an equip category: its own, or the stand-in when it has none. */
export function slotIconOf(category) {
    return SLOT_ICONS[category] || SLOT_ICON_UNKNOWN;
}
