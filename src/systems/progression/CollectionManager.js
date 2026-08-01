import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { logger } from '../../utils/Logger.js';
import { CurrencyManager } from '../economy/CurrencyManager.js';
import { BinderManager } from './BinderManager.js';
import { AREA_PACK } from '../../config/loopConstants.js';
import { getAreaSet } from '../../config/registries/areaSetRegistry.js';

/**
 * CollectionManager
 *
 * Handles card acquisition, pack generation, and the "Binder" (Library) logic.
 * All logic follows the "Pick 1 of 4" and "Unique Entity" rules.
 */
class CollectionManagerClass {

    // ==================================================================
    // Per-area Booster Packs (Area Deck Rework, C-14 — D-13/D-32/D-46)
    //
    // Packs are per AREA, not global: each area has its own price curve over
    // its own purchase count, and its pool contains only that area's native
    // cards. Universals are excluded entirely (D-46) — they come from the
    // guild tree, so including them here would dilute every regional pool.
    //
    // No physical pack card is ever spawned; buying mutates counters and
    // hands the UI a list of options to claim from.
    // ==================================================================

    /** Packs bought in one area (the x-axis of its own curve). */
    getPacksBought(areaId) {
        return GameState.collection?.areaPacksBought?.[areaId] || 0;
    }

    /**
     * First-pack price for an area. Tier is expressed as PRICE (D-32), so this
     * is the dial that separates the Farmlands from the Astral Volcano.
     *
     * Reads an authored `packBaseline` when one exists; otherwise every area
     * shares the placeholder until C-15 derives it from tier index (D-65).
     */
    getAreaBaseline(areaId) {
        return getAreaSet(areaId)?.packBaseline || AREA_PACK.DEFAULT_BASELINE;
    }

    /** Cost of the next pack in this area: baseline × growth^bought (D-32). */
    getPackCost(areaId) {
        const bought = this.getPacksBought(areaId);
        return Math.round(this.getAreaBaseline(areaId) * Math.pow(AREA_PACK.GROWTH, bought));
    }

    /**
     * This area's remaining pool, weighted by copies still owed.
     *
     * Rarity is emergent (owner call 2026-08-01, supersedes D-14): a Boost is
     * a single copy against a regular card's four, so it is naturally four
     * times rarer with no rarity table and no pity counter. See
     * `BinderManager.getWeightedPool`.
     */
    getAreaPool(areaId) {
        return BinderManager.getWeightedPool(areaId);
    }

    /** True once every card in this area is maxed — its packs stop selling (D-13). */
    isAreaExhausted(areaId) {
        return this.getAreaPool(areaId).length === 0;
    }

    /**
     * Draw up to N DISTINCT options from the area's weighted pool.
     *
     * Distinct by card, weighted by copies: a card owing 4 copies is four
     * times likelier to appear than one owing 1, but it never appears twice in
     * the same pack — seeing the same card in two slots would just waste an
     * option.
     */
    generatePackOptions(areaId) {
        let pool = this.getAreaPool(areaId);
        const options = [];

        while (options.length < AREA_PACK.OPTIONS_PER_PACK && pool.length > 0) {
            const pick = pool[Math.floor(Math.random() * pool.length)];
            options.push(pick);
            pool = pool.filter(id => id !== pick);   // drop every copy of it
        }

        logger.info('CollectionManager', `Generated ${areaId} pack: ${options.join(', ')}`);
        return options;
    }

    /**
     * Buy a pack for one area: pay gold, bump that area's counter, hand the
     * options to the UI. The player claims ONE via claimToCollection().
     * @returns {{ success: boolean, options?: string[], cost?: number, error?: string }}
     */
    buyAreaPack(areaId) {
        if (!areaId) return { success: false, error: 'NO_AREA' };
        if (!(GameState.collection?.unlockedAreaSets || []).includes(areaId)) {
            return { success: false, error: 'AREA_LOCKED' };
        }
        if (this.isAreaExhausted(areaId)) {
            return { success: false, error: 'SOLD_OUT' };
        }

        const cost = this.getPackCost(areaId);
        if (GameState.currency.gold < cost) {
            return { success: false, error: 'INSUFFICIENT_GOLD' };
        }
        if (!CurrencyManager.spendGold(cost, `Booster Pack: ${areaId}`)) {
            return { success: false, error: 'TRANSACTION_FAILED' };
        }

        const collection = GameState.collection;
        if (!collection.areaPacksBought) collection.areaPacksBought = {};
        collection.areaPacksBought[areaId] = this.getPacksBought(areaId) + 1;

        const options = this.generatePackOptions(areaId);
        // Persist the pending options (CR-040): the gold is already spent, so
        // a crash/close before the player claims one must not vaporize the
        // pack. The areaId rides along so the UI can reopen the right pack.
        collection.pendingPackOptions = options;
        collection.pendingPackAreaId = areaId;

        EventBus.publish('collection_updated');
        logger.info('CollectionManager', `${areaId} pack purchased for ${cost}g (bought there: ${collection.areaPacksBought[areaId]})`);
        return { success: true, options, cost };
    }

    /**
     * Options from a bought-but-unclaimed pack, if any (CR-040). The UI
     * re-opens the pack overlay from this on load.
     * @returns {string[]}
     */
    getPendingPackOptions() {
        return GameState.collection?.pendingPackOptions || [];
    }

    /** Which area a bought-but-unclaimed pack belongs to, if any. */
    getPendingPackAreaId() {
        return GameState.collection?.pendingPackAreaId || null;
    }

    /**
     * Claim one pack option into the Binder (§5F). The ownership count is
     * the ONLY state change — no card instance is spawned anywhere.
     */
    claimToCollection(templateId) {
        // Lands in the card's own area binder (D-3), capped at its authored
        // maxCopies (D-61) rather than a hardcoded 4.
        const { granted, owned, max } = BinderManager.grantCopy(templateId);
        if (granted < 1) {
            const reason = owned >= max
                ? `Already have every copy (${owned}/${max})`
                : `Unknown card "${templateId}"`;
            return { success: false, error: reason };
        }

        // The pack is spent once a card is claimed (CR-040).
        GameState.collection.pendingPackOptions = [];
        GameState.collection.pendingPackAreaId = null;

        EventBus.publish('collection_updated', { templateId });
        logger.info('CollectionManager', `Claimed "${templateId}" (${owned}/${max})`);
        return { success: true, count: owned };
    }

    /**
     * Discovery is implicit from ownership under the deck loop (§5H) — no
     * separate tracker.
     */
    isCardDiscovered(templateId) {
        return BinderManager.getOwned(templateId) >= 1;
    }
}

export const CollectionManager = new CollectionManagerClass();
