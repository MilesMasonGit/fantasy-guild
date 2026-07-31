import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { logger } from '../../utils/Logger.js';
import { CurrencyManager } from '../economy/CurrencyManager.js';
import { BinderManager } from './BinderManager.js';
import { UNIFIED_PACK } from '../../config/loopConstants.js';

/**
 * CollectionManager
 *
 * Handles card acquisition, pack generation, and the "Binder" (Library) logic.
 * All logic follows the "Pick 1 of 4" and "Unique Entity" rules.
 */
class CollectionManagerClass {

    // ==================================================================
    // Unified Booster Pack (Phase 5 §5F/§5G)
    //
    // One pack type whose pool spans every UNLOCKED area's card list
    // (concept §8A). Quests are never in the pool — area deckLists only
    // contain task/combat/station cards, and unlock quests are not cards
    // (§2G). No physical pack card is ever spawned.
    // ==================================================================

    /**
     * Cost of the next unified pack. One global curve over
     * `globalPacksBought` (placeholder numbers in loopConstants.js —
     * the old per-area curve has no meaning for an area-less pack).
     */
    getUnifiedPackCost() {
        const bought = GameState.collection?.globalPacksBought || 0;
        return UNIFIED_PACK.BASE_COST + bought * UNIFIED_PACK.COST_SCALING;
    }

    /**
     * Every templateId still obtainable from the unified pool: cards from
     * unlocked areas' deckLists whose playset is below its cap (§8B —
     * capped cards leave the pool permanently).
     */
    getUnifiedPool() {
        const unlocked = GameState.collection?.unlockedAreaSets || [];
        const pool = [];
        for (const areaId of unlocked) {
            // A card leaves its area's pool once every copy is owned (D-13),
            // so packs always deliver something still needed.
            for (const templateId of BinderManager.getIncompletePool(areaId)) {
                if (!pool.includes(templateId)) pool.push(templateId);
            }
        }
        return pool;
    }

    /** "Sold Out": nothing left to pull anywhere. */
    checkUnifiedExhaustion() {
        return this.getUnifiedPool().length === 0;
    }

    /**
     * Draw 4 unique options from the unified pool (fewer if the pool is
     * nearly exhausted).
     */
    generateUnifiedPackOptions() {
        const pool = this.getUnifiedPool();
        const options = [];
        for (let i = 0; i < 4 && pool.length > 0; i++) {
            const idx = Math.floor(Math.random() * pool.length);
            options.push(pool.splice(idx, 1)[0]);
        }
        logger.info('CollectionManager', `Generated unified pack: ${options.join(', ')}`);
        return options;
    }

    /**
     * Buy a unified pack: pay gold, bump the global counter, hand the 4
     * options to the UI. The player claims ONE via claimToCollection().
     * @returns {{ success: boolean, options?: string[], error?: string }}
     */
    buyUnifiedPack() {
        if (this.checkUnifiedExhaustion()) {
            return { success: false, error: 'SOLD_OUT' };
        }

        const cost = this.getUnifiedPackCost();
        if (GameState.currency.gold < cost) {
            return { success: false, error: 'INSUFFICIENT_GOLD' };
        }
        if (!CurrencyManager.spendGold(cost, 'Unified Booster Pack')) {
            return { success: false, error: 'TRANSACTION_FAILED' };
        }

        GameState.collection.globalPacksBought = (GameState.collection.globalPacksBought || 0) + 1;

        const options = this.generateUnifiedPackOptions();
        // Persist the pending options (CR-040): the gold is already spent, so
        // a crash/close before the player claims one must not vaporize the
        // pack. Mirrors how recruitment.candidates are held.
        GameState.collection.pendingPackOptions = options;
        EventBus.publish('collection_updated');
        logger.info('CollectionManager', `Unified pack purchased for ${cost}g (total bought: ${GameState.collection.globalPacksBought})`);
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

    /**
     * Claim one pack option into the Binder (§5F). The ownership count is
     * the ONLY state change — no card instance is spawned anywhere.
     */
    claimToCollection(templateId) {
        // Lands in the card's own area binder (D-3), capped at its authored
        // maxCopies (D-61) rather than a hardcoded 4.
        const { granted, owned, max } = BinderManager.grantCopy(templateId);
        if (granted < 1) {
            return { success: false, error: `Already have every copy (${owned}/${max})` };
        }

        // The pack is spent once a card is claimed (CR-040).
        GameState.collection.pendingPackOptions = [];

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
