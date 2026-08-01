// Fantasy Guild — Outpost Banners (Area Deck Rework, C-10)

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { AREA_EVENTS } from '../core/areaEvents.js';
import { logger } from '../../utils/Logger.js';

/**
 * OutpostManager — Outposts as standalone banners (D-16).
 *
 * Outposts used to be a *mode* of an area: the same banner had an adventure
 * face and a stationed face, toggled by ModeManager. That is retired. An
 * Outpost is now its own banner sitting alongside the areas, holding exactly
 * ONE card (D-16) whose effect applies **globally** rather than to one region.
 *
 * ## Why the split
 * A mode toggle meant every area silently carried a second, mostly-unused
 * half, and an Outpost's reach was arbitrarily limited to the region it hid
 * behind. Separating them removes a whole class of "which face am I looking
 * at" confusion and lets Outpost choice become a guild-wide strategic layer
 * above the per-area loops.
 *
 * ## Scarce on purpose (D-21)
 * The player starts with ONE and unlocks a small handful (~3–4). Because the
 * effects are global, scarcity is the balancing force — picking a Smithy over
 * a Trade Post has to hurt.
 *
 * ## Shape
 * An outpost IS its own station state, not a wrapper around one. That keeps
 * `StationManager`'s crafting tick working on it almost unchanged — it always
 * wanted "a thing with a card, a hero, and production counters", which an
 * area only ever was by accident.
 */

/** Outposts the player has to start with (D-21). Grows via the guild tree. */
export const STARTING_OUTPOSTS = 1;

/** A fresh, empty Outpost banner. */
export function createOutpost(index) {
    return {
        id: `outpost_${index + 1}`,
        // Playmat membership (D-59): an outpost off the playmat does not run.
        onPlaymat: true,
        assignedHeroId: null,
        // The single installed card (D-16) — a Crafting Station or a Passive.
        activeStationCardId: null,
        // Production state, read by StationManager.
        selectedRecipeId: null,
        progress: 0,
        productionMode: 'infinite',   // infinite | limited
        productionLimit: 0,
        producedCount: 0,
        status: 'idle'                // idle | crafting | paused_no_inputs | paused_limit_reached | paused_no_energy
    };
}

/**
 * The live outpost list, seeded on first use.
 *
 * An EMPTY list counts as "not yet seeded", not as a valid state — the player
 * always has at least one Outpost (D-21), and `INITIAL_STATE` ships `outposts:
 * []`, so checking `Array.isArray` alone would accept that empty array and the
 * starting banner would never appear.
 */
export function getOutposts() {
    const state = GameState.state;
    if (!state) return [];
    if (!Array.isArray(state.outposts) || state.outposts.length === 0) {
        state.outposts = Array.from({ length: STARTING_OUTPOSTS }, (_, i) => createOutpost(i));
        logger.info('OutpostManager', `Initialized ${state.outposts.length} outpost banner(s)`);
    }
    return state.outposts;
}

/** One outpost by id, or null. */
export function getOutpost(outpostId) {
    return getOutposts().find(o => o.id === outpostId) || null;
}

/** Outposts currently on the playmat — the only ones that run (D-59). */
export function getActiveOutposts() {
    return getOutposts().filter(o => o.onPlaymat !== false);
}

/**
 * Unlock another Outpost banner (D-21), granting a card with it (D-35) so a
 * new banner is never an empty frame and the player is productive at once.
 *
 * @param {string} [grantCardId] Card installed in the new banner.
 * @returns {object} the new outpost.
 */
export function unlockOutpost(grantCardId = null) {
    const outposts = getOutposts();
    const outpost = createOutpost(outposts.length);
    if (grantCardId) outpost.activeStationCardId = grantCardId;
    outposts.push(outpost);

    EventBus.publish('outposts_updated', { outpostId: outpost.id, action: 'unlocked' });
    logger.info('OutpostManager', `Unlocked ${outpost.id}${grantCardId ? ` with "${grantCardId}"` : ''}`);
    return outpost;
}

/**
 * Assign (or clear, with null) the hero working an Outpost.
 * Most Outpost cards need a body (D-22); the exceptions run unstaffed.
 */
export function assignHero(outpostId, heroId) {
    const outpost = getOutpost(outpostId);
    if (!outpost) return { success: false, error: `Unknown outpost "${outpostId}"` };

    // A hero works one place at a time — pull them off wherever they were.
    if (heroId) {
        for (const other of getOutposts()) {
            if (other.id !== outpostId && other.assignedHeroId === heroId) other.assignedHeroId = null;
        }
        for (const areaState of Object.values(GameState.areaStates || {})) {
            if (areaState.assignedHeroId === heroId) areaState.assignedHeroId = null;
        }
    }

    outpost.assignedHeroId = heroId || null;
    EventBus.publish('outposts_updated', { outpostId, action: 'assign' });
    EventBus.publish('heroes_updated', { source: 'outpost_assign' });
    return { success: true };
}

/**
 * Put a banner on the playmat or take it off (D-59).
 *
 * Membership is what controls running: a banner ON the playmat may run, one
 * taken OFF stops and **returns its hero to the roster** (D-67). Nothing else
 * is lost — the installed card, recipe and progress all persist, waiting.
 *
 * Freeing the hero is the point: mothballing something you're done with hands
 * a scarce body (D-24) back for redeployment, which makes curation a strategic
 * act rather than housekeeping.
 */
export function setOnPlaymat(bannerId, onPlaymat) {
    const outpost = getOutpost(bannerId);
    const target = outpost || GameState.areaStates?.[bannerId];
    if (!target) return { success: false, error: `Unknown banner "${bannerId}"` };

    target.onPlaymat = onPlaymat !== false;

    if (!target.onPlaymat) {
        target.assignedHeroId = null;
        if (!outpost) {
            // An area also stops its adventure loop.
            target.status = 'paused';
            target.pausedReason = null;
            EventBus.publish(AREA_EVENTS.STATUS_CHANGED, { areaId: bannerId, status: 'paused' });
        } else {
            target.status = 'idle';
        }
        EventBus.publish('heroes_updated', { source: 'playmat_removed' });
    }

    EventBus.publish('outposts_updated', { outpostId: bannerId, action: 'playmat' });
    EventBus.publish('state_changed', {});
    logger.info('OutpostManager', `${bannerId} ${target.onPlaymat ? 'added to' : 'removed from'} the playmat`);
    return { success: true };
}

/** True when this banner is on the playmat (areas default to on). */
export function isOnPlaymat(bannerId) {
    const outpost = getOutpost(bannerId);
    const target = outpost || GameState.areaStates?.[bannerId];
    return !target || target.onPlaymat !== false;
}

/** The outpost a hero is working, or null. */
export function getOutpostForHero(heroId) {
    return getOutposts().find(o => o.assignedHeroId === heroId) || null;
}

// ----------------------------------------------------------------------
// Playmat order (D-58)
// ----------------------------------------------------------------------

/**
 * The player's banner running order — areas and Outposts interleaved in one
 * list, because Outposts are ordinary rows now, not a pinned section (D-16).
 *
 * Stored as a plain id array and *reconciled* against the live banners on
 * every read: ids that no longer exist are dropped, banners the player has
 * never seen are appended. That way unlocking an area or Outpost can't
 * corrupt the order, and a save written before this existed just works.
 */
export function getPlaymatOrder() {
    const state = GameState.state;
    if (!state) return [];

    const live = [
        ...(state.collection?.unlockedAreaSets || []),
        ...getOutposts().map(o => o.id)
    ];

    const stored = Array.isArray(state.playmatOrder) ? state.playmatOrder : [];
    const order = stored.filter(id => live.includes(id));
    for (const id of live) {
        if (!order.includes(id)) order.push(id);
    }

    state.playmatOrder = order;
    return order;
}

/**
 * Move a banner one step up or down the playmat.
 * @param {string} bannerId
 * @param {number} delta -1 for up, +1 for down.
 */
export function moveBanner(bannerId, delta) {
    const order = getPlaymatOrder();
    const from = order.indexOf(bannerId);
    const to = from + delta;
    if (from === -1 || to < 0 || to >= order.length) return { success: false };

    order.splice(to, 0, order.splice(from, 1)[0]);
    GameState.state.playmatOrder = order;

    EventBus.publish('outposts_updated', { outpostId: bannerId, action: 'reorder' });
    EventBus.publish('state_changed', {});
    return { success: true };
}

export const OutpostManager = {
    STARTING_OUTPOSTS, createOutpost, getOutposts, getOutpost, getActiveOutposts,
    unlockOutpost, assignHero, setOnPlaymat, isOnPlaymat, getOutpostForHero,
    getPlaymatOrder, moveBanner
};

export default OutpostManager;
