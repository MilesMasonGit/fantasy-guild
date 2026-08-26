import { registerItems } from '../../config/registries/itemRegistry.js';

/**
 * The item ids that used to be borrowed from shipped content (CR2-004).
 *
 * ## Why this file exists separately from `testTokens.js`
 *
 * Until 2026-08-26 the fixtures named three **live content** items directly —
 * `item_oak_wood`, `item_charcoal` and `item_copper_ore`. Renaming any of them
 * in the CMS took 24 engine assertions across 10 suites with it. That was
 * measured, not guessed: the whole suite was run with those three ids renamed
 * out of the registry.
 *
 * The obvious fix is to register stand-ins alongside the other fixture items in
 * `testTokens.js`. That works for suites which already import the fixture
 * Tokens, but four of the affected suites do not — `ItemRateTracker`,
 * `QuestSystem`, `SpriteLayerAbsorption`, `SpriteSweepEvents` and
 * `SaveContentAudit` each need an item id that *resolves* and have no use for
 * ~30 fixture Tokens. `SaveContentAudit` positively must not have them: it
 * audits authored content, and the fixtures would become part of what it walks.
 *
 * So the item half of the fixture set lives here and registers itself on
 * import. `testTokens.js` pulls these in with the rest; a suite that needs
 * nothing but a resolvable item id imports this file alone.
 *
 * ## What these are
 *
 * Instruments, not content. Every one carries `trueCost: 1` and `sellPrice: 1`
 * — which is exactly what the real items they replaced carried, so no
 * assertion changed value in the swap. Sprites are copied from the real items
 * so the sprite-layer suites still exercise a resolvable artwork path rather
 * than the missing-art branch.
 *
 * ⚠️ Do not give these ids to content, and do not tune them for balance.
 */

const DEFAULTS = {
    description: '', tags: [], stackable: true, restoreAmount: 0,
    restoreType: '', regen: 0, equipSlot: '', value: null,
    trueCost: 1, sellPrice: 1
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
