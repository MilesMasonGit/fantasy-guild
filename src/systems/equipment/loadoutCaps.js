// how many of one loadout kind a hero may carry, with the guild's Loadout Slots

import { getCategoryCap } from '../../config/registries/equipmentCategories.js';
import { getGlobalAggregator } from '../effects/GuildModifiers.js';
import { EFFECT_TYPES } from '../effects/constants.js';

/**
 * A category's cap (`equipmentCategories.js`: a Trinket 2, a Food 1) raised by the guild's Loadout
 * Slots for that category (a Guild Hall star). An uncapped category (Consumable) stays uncapped and
 * an unknown one stays 0; never below 0. Every hero alike: the rule is the guild's.
 */
export function loadoutCapOf(category) {
    const base = getCategoryCap(category);
    if (!base || !Number.isFinite(base)) return base;
    const extra = Math.floor(getGlobalAggregator().getFlat(EFFECT_TYPES.LOADOUT_SLOTS, category));
    return Math.max(0, base + extra);
}
