// a Region's own rules: in force all over its mat while the guild is there

import { EventBus } from '../core/EventBus.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';
import { KEYWORD } from '../effects/statements.js';
import { getGlobalAggregator, auraSourceId } from '../effects/GuildModifiers.js';
import { activeRegion } from './Atlas.js';

/**
 * A Region's rules (`region.rules`, copied from its maps when it was settled) hold everywhere on
 * its mat while the guild is there, and nowhere else. Today a rule is a `Provides`: it registers in
 * the guild-wide aggregator (`GuildModifiers.js`), which every Token's axes already read
 * (`TileModifiers.resolveAxis`), narrowed to a skill by its `category` as a Token's own would be.
 *
 * ⚠️ The aggregator is not saved. {@link apply} puts the active Region's rules back whenever the
 * board may have changed under it: a load, a travel, a new game. It takes out only what it put in,
 * so anything else registered there stays.
 *
 * A rule the aggregator cannot carry is skipped and reported by {@link modifiersOf}, never widened:
 * another keyword, a triggered rule (`when.event`), or one aimed at some Tokens only (`to`), since
 * the guild-wide aggregator reaches every Token alike.
 */

/** The aggregator source ids this module registered, so it removes exactly those. */
let installed = [];

/** Whether a rule names only some Tokens: by id, type or tag, or through a filter. */
function narrowed(statement) {
    const to = statement?.to;
    if (!to || typeof to !== 'object') return false;
    return (!!to.mode && to.mode !== 'all') || (Array.isArray(to.filters) && to.filters.length > 0);
}

/**
 * The modifiers a Region's rules register, each under its own source: two copies of one map stack,
 * as two copies of a buffing Token do.
 *
 * @param {object[]} rules  the Region's `rules`
 * @param {string} regionId
 * @returns {{modifiers: object[], ignored: {index: number, reason: string}[]}}
 */
export function modifiersOf(rules, regionId) {
    const modifiers = [];
    const ignored = [];
    (Array.isArray(rules) ? rules : []).forEach((statement, index) => {
        const skip = (reason) => ignored.push({ index, reason });
        if (statement?.keyword !== KEYWORD.PROVIDES) return skip('not a Provides');
        if (statement.when?.event) return skip('triggered');
        if (narrowed(statement)) return skip('aimed at some Tokens only');
        const payload = statement.payload;
        if (!payload?.type || !Number.isFinite(Number(payload.value))) return skip('no axis or value');
        // As `TileModifiers.rebuildToken` registers a Token's own: the payload's flat `category`
        // becomes the aggregator's nested `target.category`.
        const { category, ...rest } = payload;
        modifiers.push({
            ...rest,
            value: Number(payload.value),
            source: auraSourceId(`region:${regionId}#${index}`, statement.id || 'rule'),
            ...(category ? { target: { category } } : {})
        });
    });
    return { modifiers, ignored };
}

/**
 * Make the guild-wide aggregator hold exactly the active Region's rules: take out what this module
 * put in, then register the rules of the Region the guild is in now.
 *
 * @returns {string[]} the source ids now registered
 */
export function apply() {
    const guild = getGlobalAggregator();
    for (const source of installed) guild.removeModifiersBySource(source);
    installed = [];
    const region = activeRegion();
    if (!region) return [];
    for (const modifier of modifiersOf(region.rules, region.id).modifiers) {
        guild.addModifier(modifier);
        if (!installed.includes(modifier.source)) installed.push(modifier.source);
    }
    return [...installed];
}

/** The source ids this module has registered. */
export function installedSources() {
    return [...installed];
}

let unsubscribers = [];

/**
 * Listen for every moment the active Region may have changed. `GAME_RESET` covers a new game,
 * which neither loads nor travels and must not keep the last game's rules.
 */
export function init() {
    teardown();
    for (const event of [ENGINE_EVENTS.GAME_LOADED, ENGINE_EVENTS.BOARD_SWAPPED, ENGINE_EVENTS.GAME_RESET]) {
        unsubscribers.push(EventBus.subscribe(event, () => apply()));
    }
}

export function teardown() {
    for (const off of unsubscribers) off();
    unsubscribers = [];
}
