// Fantasy Guild - Station Crafting Tick Engine (Deck Loop rework, Phase 4 §4F)

import { GameState } from '../../state/GameState.js';
import { getActiveOutposts } from './OutpostManager.js';
import { EventBus } from '../core/EventBus.js';
import { EventBatch } from '../core/EventBatch.js';
import { AREA_EVENTS } from '../core/areaEvents.js';
import { getCard as getCardTemplate } from '../../config/registries/cardRegistry.js';
import { getRecipe } from '../../config/registries/recipeRegistry.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import * as SkillSystem from '../hero/SkillSystem.js';
import * as HeroManager from '../hero/HeroManager.js';
import { PROGRESS_EVENT_TICK_INTERVAL, DEFAULT_CRAFT_ENERGY } from '../../config/loopConstants.js';
import * as ConsumptionSystem from '../hero/ConsumptionSystem.js';
import { logger } from '../../utils/Logger.js';

/**
 * StationManager — ticks every OUTPOST banner holding a crafting station,
 * processing the selected recipe against the global bank.
 *
 * Outposts are standalone banners now (D-16), so this no longer scans areas
 * for a "stationed" mode that no longer exists.
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
     * Main tick — registered right after LoopRunner.
     * @param {number} delta - ms since last tick
     */
    tick(delta) {
        if (!delta || isNaN(delta)) return;
        if (!GameState.getIsInitialized()) return;

        this.tickCounter++;
        EventBatch.begin();
        try {
            // Outposts are standalone banners now (D-16), not a mode of an
            // area — so crafting ticks the outpost list rather than scanning
            // every area for a stationed one. Only banners on the playmat run
            // (D-59). An outpost IS its own station state, which is why the
            // same `_tickBanner` works on it unchanged.
            for (const outpost of getActiveOutposts()) {
                if (!outpost.activeStationCardId) continue;
                if (!outpost.assignedHeroId) {
                    // Crafting Stations need a body (D-22). An injured hero
                    // still counts — production runs while they recover.
                    outpost.status = 'idle';
                    continue;
                }

                this._tickBanner(outpost.id, outpost, outpost, delta);
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

    _tickBanner(areaId, areaState, st, delta) {
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

        // Start a fresh cycle if none is underway — each craft costs the hero
        // energy upfront (§4F, owner design 2026-07-16). If they're short, sip
        // the station Drink; with no drink left, pause until energy returns.
        if (st.progress <= 0) {
            const energyCost = recipe.energyCost ?? DEFAULT_CRAFT_ENERGY;
            const hero = HeroManager.getHero(areaState.assignedHeroId);
            let energy = hero?.energy?.current ?? 0;
            if (energy < energyCost) {
                // The station-side Drink slot is retired (D-4): a stationed
                // hero drinks from their OWN loadout grid, exactly as they do
                // in the wilds. One consumable model everywhere.
                ConsumptionSystem.tryDrink(hero?.id);
                energy = hero?.energy?.current ?? 0;
            }
            if (energy < energyCost) {
                this._setStatus(areaId, st, 'paused_no_energy');
                return;
            }
            HeroManager.modifyHeroEnergy(hero.id, -energyCost);
            EventBatch.queue('heroes_updated', {});
            // Add the previous cycle's overshoot (progress ≤ 0 here) so
            // fast-forwarded crafting loses nothing at cycle boundaries
            // (CR-022 remainder carry).
            const duration = recipe.baseTickTime || 10000;
            st.progress = duration + Math.min(0, st.progress);
            st._craftDuration = duration;
        }
        this._setStatus(areaId, st, 'crafting');

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
        // progress is ≤ 0 here; keep the overshoot as the next cycle's head
        // start (CR-022). The ≤ 0 value still means "no cycle underway" to
        // the start-of-cycle check above.

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

    /**
     * Sip one drink from the area's station Drink slot to top up a low-energy
     * hero (owner design 2026-07-16). Pulls the stack from the shared bank;
     * clears the slot when the bank runs dry. Returns whether a drink happened.
     */


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
