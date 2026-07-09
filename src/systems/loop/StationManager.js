// Fantasy Guild - Station Crafting Tick Engine (Deck Loop rework, Phase 4 §4F)

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { EventBatch } from '../core/EventBatch.js';
import { AREA_EVENTS } from '../core/areaEvents.js';
import { getCard as getCardTemplate } from '../../config/registries/cardRegistry.js';
import { getRecipe } from '../../config/registries/recipeRegistry.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import * as SkillSystem from '../hero/SkillSystem.js';
import { PROGRESS_EVENT_TICK_INTERVAL } from '../../config/loopConstants.js';
import { logger } from '../../utils/Logger.js';

/**
 * StationManager — ticks every area that is in Stationed Mode with a slotted
 * crafting station, processing the selected recipe against the global bank.
 *
 * Same fast-path shape as LoopRunner (roadmap Appendix B, pattern 3): the
 * common tick is one input check + one timer decrement per stationed area;
 * the expensive work (deduct inputs, deposit outputs, award XP) only runs at
 * craft completion.
 *
 * Inputs and outputs use the SAME global bank Adventure Mode deposits into —
 * that is the inter-area supply chain: a hero gathering Copper Ore in one
 * area feeds the Smelting Furnace queue in another.
 *
 * `stationState.status` machine (persisted):
 *   idle                 → no recipe selected / prerequisites missing
 *   crafting             → counting down stationState.progress
 *   paused_no_inputs     → bank lacks an input; auto-resumes on resupply
 *   paused_limit_reached → limited production hit its cap
 */
export const StationManager = {
    tickCounter: 0,

    /**
     * Main tick — registered behind USE_DECK_LOOP right after LoopRunner.
     * @param {number} delta - ms since last tick
     */
    tick(delta) {
        if (!delta || isNaN(delta)) return;
        if (!GameState.getIsInitialized()) return;

        this.tickCounter++;
        EventBatch.begin();
        try {
            const areaStates = GameState.areaStates || {};
            for (const areaId in areaStates) {
                const areaState = areaStates[areaId];
                const st = areaState?.stationState;
                if (!st || !st.activeStationCardId) continue;
                if (areaState.mode !== 'stationed') continue;
                if (!areaState.assignedHeroId) {
                    // Both modes require a hero (§4H). An injured hero still
                    // counts — crafting runs while they recover (§4H).
                    st.status = 'idle';
                    continue;
                }

                this._tickArea(areaId, areaState, st, delta);
            }
        } finally {
            EventBatch.flush();
        }
    },

    /** Set stationState.status, announcing structural changes once (Phase 6 UI). */
    _setStatus(areaId, st, status) {
        if (st.status === status) return;
        st.status = status;
        EventBatch.queue(AREA_EVENTS.STATUS_CHANGED, { areaId, status });
    },

    _tickArea(areaId, areaState, st, delta) {
        const template = getCardTemplate(st.activeStationCardId);
        if (!template?.hasCraftingQueue) {
            this._setStatus(areaId, st, 'idle'); // buff-only station: nothing to craft
            return;
        }
        if (!st.selectedRecipeId) {
            this._setStatus(areaId, st, 'idle');
            return;
        }
        const recipe = getRecipe(st.selectedRecipeId);
        if (!recipe) {
            logger.warn('StationManager', `Unknown recipe "${st.selectedRecipeId}" in ${areaId} — clearing selection`);
            st.selectedRecipeId = null;
            this._setStatus(areaId, st, 'idle');
            return;
        }

        // Production cap (§4F). Re-checked every tick so switching the mode
        // back to infinite (or raising the limit) auto-resumes.
        if (st.productionMode === 'limited' && st.producedCount >= st.productionLimit) {
            this._setStatus(areaId, st, 'paused_limit_reached');
            return;
        }

        // Bank must hold every input for the craft to progress. Pausing (not
        // resetting) preserves partial progress until resupply.
        if (!this._hasAllInputs(recipe.inputs || [])) {
            this._setStatus(areaId, st, 'paused_no_inputs');
            return;
        }

        // Start a fresh cycle if none is underway.
        if (st.status !== 'crafting' || st.progress <= 0) {
            if (st.progress <= 0) {
                st.progress = recipe.baseTickTime || 10000;
                st._craftDuration = st.progress;
            }
            this._setStatus(areaId, st, 'crafting');
        }

        st.progress -= delta;
        this._publishProgress(areaId, st);
        if (st.progress <= 0) {
            this._completeCraft(areaId, areaState, st, recipe);
        }
    },

    // ------------------------------------------------------------------
    // Craft completion (§4F step 7)
    // ------------------------------------------------------------------

    _completeCraft(areaId, areaState, st, recipe) {
        // Deduct inputs from the bank (availability was gated every tick).
        for (const input of recipe.inputs || []) {
            const quantity = input.quantity || 1;
            const itemId = input.itemId || input.id || this._resolveTagInput(input.tag, quantity);
            if (itemId) InventoryManager.removeItem(itemId, quantity);
        }

        // Deposit outputs (honoring per-output chance rolls, if any).
        for (const output of recipe.outputs || []) {
            const itemId = output.itemId || output.id;
            if (!itemId) continue;
            const chance = output.chance ?? 1;
            if (chance < 1 && Math.random() > chance) continue;
            InventoryManager.addItem(itemId, output.quantity || 1, st.activeStationCardId);
        }

        // Award XP to the stationed hero. The skill comes from the recipe's
        // subskill's parent (already resolved onto the station template).
        const xp = recipe.xpAwarded || recipe.xp || 0;
        const template = getCardTemplate(st.activeStationCardId);
        const skill = recipe.skill || template?.config?.skill;
        if (xp > 0 && skill && areaState.assignedHeroId) {
            SkillSystem.addXP(areaState.assignedHeroId, skill, xp);
        }

        st.producedCount++;
        st.progress = 0; // next tick re-checks inputs/limit and starts the next cycle

        // Lifetime craft tally on the station card (Phase 7 binder stats).
        const collection = GameState.state?.collection;
        if (collection && st.activeStationCardId) {
            if (!collection.cardUseCounts) collection.cardUseCounts = {};
            collection.cardUseCounts[st.activeStationCardId] = (collection.cardUseCounts[st.activeStationCardId] || 0) + 1;
        }

        if (st.productionMode === 'limited' && st.producedCount >= st.productionLimit) {
            this._setStatus(areaId, st, 'paused_limit_reached');
        }

        EventBatch.queue('inventory_updated', {});
        EventBatch.queue('heroes_updated', {});
        EventBatch.queue(AREA_EVENTS.CRAFT_COMPLETED, { areaId, recipeId: recipe.id });
        logger.debug('StationManager', `Craft complete in ${areaId}: ${recipe.id} (total ${st.producedCount})`);
    },

    // ------------------------------------------------------------------
    // Input resolution
    // ------------------------------------------------------------------

    /**
     * Check the bank holds every recipe input. Tag inputs (e.g. `Fuel`)
     * match any banked item carrying that tag.
     */
    _hasAllInputs(inputs) {
        for (const input of inputs) {
            const quantity = input.quantity || 1;
            if (input.itemId || input.id) {
                if (!InventoryManager.hasItem(input.itemId || input.id, quantity)) return false;
            } else if (input.tag) {
                if (!this._resolveTagInput(input.tag, quantity)) return false;
            }
        }
        return true;
    },

    /**
     * Find a banked itemId satisfying a tag input (first match wins).
     * @returns {string|null}
     */
    _resolveTagInput(tag, quantity) {
        if (!tag) return null;
        const banked = InventoryManager.getAllItems();
        for (const [itemId, entry] of Object.entries(banked)) {
            if ((entry?.quantity || 0) < quantity) continue;
            const item = getItem(itemId);
            if (item && (item.tags?.includes(tag) || item.toolType === tag)) return itemId;
        }
        return null;
    },

    // ------------------------------------------------------------------
    // Plumbing
    // ------------------------------------------------------------------

    /**
     * Throttled crafting progress for the Phase 6 ref-based bars — same
     * event and cadence as LoopRunner's adventure progress; `mode` on the
     * area state disambiguates what the bar is showing.
     */
    _publishProgress(areaId, st) {
        if (this.tickCounter % PROGRESS_EVENT_TICK_INTERVAL !== 0) return;
        const duration = st._craftDuration || 0;
        if (duration <= 0) return;
        const percent = Math.min(100, Math.max(0, (1 - st.progress / duration) * 100));
        EventBus.publish(AREA_EVENTS.PROGRESS, { areaId, percent });
    }
};

export default StationManager;
