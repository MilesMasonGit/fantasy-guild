import { GameState } from '../../state/GameState.js';
import { getAreaSet } from '../../config/registries/areaSetRegistry.js';
import { EventBus } from '../core/EventBus.js';
import { logger } from '../../utils/Logger.js';
import { CurrencyManager } from '../economy/CurrencyManager.js';
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
        const playsets = GameState.collection?.playsets || {};
        const unlocked = GameState.collection?.unlockedAreaSets || [];
        const pool = [];
        for (const areaId of unlocked) {
            const areaSet = getAreaSet(areaId);
            for (const [templateId, maxCount] of Object.entries(areaSet?.deckList || {})) {
                if ((playsets[templateId] || 0) < maxCount && !pool.includes(templateId)) {
                    pool.push(templateId);
                }
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
        EventBus.publish('collection_updated');
        logger.info('CollectionManager', `Unified pack purchased for ${cost}g (total bought: ${GameState.collection.globalPacksBought})`);
        return { success: true, options, cost };
    }

    /**
     * Claim one pack option into the Binder (§5F). The ownership count is
     * the ONLY state change — no card instance is spawned anywhere.
     */
    claimToCollection(templateId) {
        const playsets = GameState.collection.playsets;
        if ((playsets[templateId] || 0) >= 4) {
            return { success: false, error: 'Playset already complete (4/4)' };
        }
        playsets[templateId] = (playsets[templateId] || 0) + 1;

        EventBus.publish('collection_updated', { templateId });
        logger.info('CollectionManager', `Claimed "${templateId}" to collection (${playsets[templateId]}/4)`);
        return { success: true, count: playsets[templateId] };
    }

    /**
     * Discovery is implicit from ownership under the deck loop (§5H) — no
     * separate tracker.
     */
    isCardDiscovered(templateId) {
        return (GameState.collection?.playsets?.[templateId] || 0) >= 1;
    }
}

export const CollectionManager = new CollectionManagerClass();
