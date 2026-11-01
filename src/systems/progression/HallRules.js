// the Guild Hall's stars: their rules held guild-wide while their ranks are

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';
import { authoredStars } from '../../config/guildUpgrades.js';
import { getGlobalAggregator, setAimedModifiers } from '../effects/GuildModifiers.js';
import * as TileModifiers from '../board/TileModifiers.js';
import { hallRulesOf } from './hallModifiers.js';

/**
 * Every authored star's held rank puts its rules in force for the whole guild, wherever it is and
 * wherever the Guild Hall stands: a skill boost in the guild-wide aggregator, a Token upgrade on
 * each Token it names (`hallModifiers.js`). Ranks are the save's (`progress.guildUpgrades`);
 * nothing here is saved.
 *
 * ⚠️ The aggregator is not saved. `GuildUpgradeManager.recompute` calls {@link apply} on every load
 * and purchase, and this module listens for a new game, a travel and a catch-up (`GAME_RESET`). It
 * takes out only what it put in, so a Region's rules stay.
 */

/** The aggregator source ids this module registered, so it removes exactly those. */
let installed = [];
/** What the aimed rules were last made of, so the mat is rebuilt only when they change. */
let aimedKey = '';

const OWNER = 'hall';

function keyOf(aimed) {
    return aimed.map(({ to, modifier }) => `${modifier.source}:${modifier.type}:${modifier.value}:${JSON.stringify(to)}`).join('|');
}

/**
 * Make the guild hold exactly the rules of the ranks held now.
 * @param {Record<string, number>} [ranks] the guild's ranks (the save's when absent)
 * @returns {{ sources: string[], aimed: number, ignored: object[] }}
 */
export function apply(ranks = GameState.state?.progress?.guildUpgrades || {}) {
    const guild = getGlobalAggregator();
    for (const source of installed) guild.removeModifiersBySource(source);
    installed = [];

    const { modifiers, aimed, ignored } = hallRulesOf(authoredStars(), ranks);
    for (const modifier of modifiers) {
        guild.addModifier(modifier);
        if (!installed.includes(modifier.source)) installed.push(modifier.source);
    }

    const key = keyOf(aimed);
    setAimedModifiers(OWNER, aimed);
    if (key !== aimedKey) {
        aimedKey = key;
        // A Token's own aggregator is a cache rebuilt on board changes; a star bought is not one.
        TileModifiers.rebuildAll();
    }
    return { sources: [...installed], aimed: aimed.length, ignored };
}

/** The source ids this module has registered in the guild aggregator. */
export function installedSources() {
    return [...installed];
}

let unsubscribers = [];

/** Listen for a new game, a travel and a catch-up: the ranks or the mat may have changed under the rules. */
export function init() {
    teardown();
    unsubscribers.push(EventBus.subscribe(ENGINE_EVENTS.GAME_RESET, () => apply()));
}

export function teardown() {
    for (const off of unsubscribers) off();
    unsubscribers = [];
}
