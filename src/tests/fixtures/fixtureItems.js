import { registerItems } from '../../config/registries/itemRegistry.js';

/**
 * The item ids that used to be borrowed from shipped content.
 *
 * ⚠️ Do not give these ids to content, and do not tune them for balance.
 */

const DEFAULTS = {
    description: '', tags: [], stackable: true, restoreAmount: 0,
    restoreType: '', regen: 0, equipSlot: '', value: 1
};

function standIn(id, name, sprite) {
    return { ...DEFAULTS, id, name, type: 'material', sprite };
}

export const FIXTURE_STANDIN_ITEMS = {
    fixture_oak_wood: standIn('fixture_oak_wood', 'Fixture Oak Wood', 'wood_oak'),
    fixture_charcoal: standIn('fixture_charcoal', 'Fixture Charcoal', 'wood_charcoal'),
    fixture_copper_ore: standIn('fixture_copper_ore', 'Fixture Copper Ore', 'ore_copper'),

    /**
     * A plain "this id resolves" control, for suites asserting that a *known*
     * item is not reported as missing. Named for the job so nobody reads it as
     * standing in for a particular piece of content.
     */
    fixture_control_item: standIn('fixture_control_item', 'Fixture Control Item', 'wood_oak')
};

registerItems(FIXTURE_STANDIN_ITEMS);
