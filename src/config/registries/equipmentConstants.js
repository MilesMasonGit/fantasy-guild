// Fantasy Guild - Equipment Constants
// Phase 40: Equipment Architecture Evolution

// Equipment slot types
// Hero-carried food/drink slots retired (owner decision 2026-07-17, CR-029):
// consumables live in deck card slots and the station Drink slot instead.
export const EQUIPMENT_SLOTS = {
    WEAPON: 'weapon',
    ARMOR: 'armor'
};

// Slot display info (Icons and Labels)
export const SLOT_INFO = {
    weapon: { icon: '⚔️', label: 'Weapon' },
    armor: { icon: '🛡️', label: 'Armor' }
};

export default {
    EQUIPMENT_SLOTS,
    SLOT_INFO
};
