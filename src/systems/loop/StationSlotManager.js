// Fantasy Guild - Station Slot Management (Deck Loop rework, Phase 4 §4D)

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { EventBatch } from '../core/EventBatch.js';
import { AREA_EVENTS } from '../core/areaEvents.js';
import { getCard as getCardTemplate } from '../../config/registries/cardRegistry.js';
import { CARD_TYPES } from '../../config/registries/cardConstants.js';
import { getRecipe } from '../../config/registries/recipeRegistry.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { ensureAreaState } from '../area/AreaStateManager.js';
import { getAreaAggregator, clearAllAreaAggregators } from './AreaModifiers.js';
import { logger } from '../../utils/Logger.js';

/**
 * StationSlotManager — owns which station card sits in each area's Station
 * Slot, the selected recipe, and the registration of station passive buffs
 * on the area's ModifierAggregator (§4G).
 *
 * Ownership model: a station card must be owned in `collection.playsets`
 * and, like action cards, each owned copy can only sit in one area at a
 * time. Stations only become obtainable via packs in Phase 5 (owner
 * decision — no default stations are pre-slotted); until then testing
 * grants copies via the dev console.
 */
export const StationSlotManager = {
    initialized: false,

    init() {
        if (this.initialized) return;
        this.initialized = true;
        // Area aggregators are runtime-only — rebuild them whenever a save
        // is loaded over the running game.
        EventBus.subscribe('game_loaded', () => this.rehydrateBuffs());
        logger.info('StationSlotManager', 'Ready (station slots + passive buff registry)');
    },

    // ------------------------------------------------------------------
    // Ownership / allocation queries
    // ------------------------------------------------------------------

    getOwnedCount(templateId) {
        return GameState.state.collection?.playsets?.[templateId] || 0;
    },

    /** How many copies of this station are slotted, optionally ignoring one area. */
    getSlottedCount(templateId, excludeAreaId = null) {
        let count = 0;
        const areaStates = GameState.areaStates || {};
        for (const [areaId, areaState] of Object.entries(areaStates)) {
            if (areaId === excludeAreaId) continue;
            if (areaState?.stationState?.activeStationCardId === templateId) count++;
        }
        return count;
    },

    // ------------------------------------------------------------------
    // Slot / unslot (§4D)
    // ------------------------------------------------------------------

    /**
     * Slot a station card into an area's Station Slot.
     * @returns {{ success: boolean, error?: string }}
     */
    slotStation(areaId, stationTemplateId) {
        const template = getCardTemplate(stationTemplateId);
        if (!template || template.cardType !== CARD_TYPES.STATION) {
            return { success: false, error: `"${stationTemplateId}" is not a station card` };
        }

        const owned = this.getOwnedCount(stationTemplateId);
        if (owned < 1) {
            return { success: false, error: 'You do not own this station card' };
        }
        if (this.getSlottedCount(stationTemplateId, areaId) >= owned) {
            return { success: false, error: 'All owned copies are already slotted in other areas' };
        }

        const areaState = ensureAreaState(areaId);

        // Swapping stations always resets the queue (§4D).
        if (areaState.stationState.activeStationCardId) {
            this._removeBuff(areaId, areaState.stationState.activeStationCardId);
        }

        areaState.stationState = {
            activeStationCardId: stationTemplateId,
            selectedRecipeId: null,
            progress: 0,
            productionMode: 'infinite',
            productionLimit: 0,
            producedCount: 0,
            drinkItemId: null,
            status: 'idle'
        };

        this._registerBuff(areaId, template);
        // A (de)registered buff changes card stats — recalc without a loop
        // reset (LoopRunner consumes this flag on its next tick, §3G).
        areaState._dirtyStats = true;

        EventBatch.queue(AREA_EVENTS.STATION_CHANGED, { areaId, stationTemplateId });
        logger.info('StationSlotManager', `Slotted "${stationTemplateId}" into ${areaId}`);
        return { success: true };
    },

    /**
     * Remove the station card from an area's Station Slot.
     * @returns {{ success: boolean, error?: string }}
     */
    unslotStation(areaId) {
        const areaState = GameState.areaStates?.[areaId];
        const current = areaState?.stationState?.activeStationCardId;
        if (!current) {
            return { success: false, error: 'No station slotted in this area' };
        }

        this._removeBuff(areaId, current);
        areaState._dirtyStats = true;

        areaState.stationState = {
            activeStationCardId: null,
            selectedRecipeId: null,
            progress: 0,
            productionMode: 'infinite',
            productionLimit: 0,
            producedCount: 0,
            drinkItemId: null,
            status: 'idle'
        };

        // Without a station there is nothing to do in Stationed Mode (§4D) —
        // unless the hero is benched injured, in which case they stay at the
        // outpost until recovered (Forced Retreat rule, §3F). The loop
        // auto-resumes from 'paused', matching Phase 3's no-start-button rule.
        if (areaState.mode === 'stationed' && areaState.status !== 'injured') {
            areaState.mode = 'adventure';
            areaState.status = 'paused';
            areaState.pausedReason = null;
            EventBatch.queue(AREA_EVENTS.MODE_SWITCHED, { areaId, mode: 'adventure' });
        }

        EventBatch.queue(AREA_EVENTS.STATION_CHANGED, { areaId, stationTemplateId: null });
        logger.info('StationSlotManager', `Unslotted "${current}" from ${areaId}`);
        return { success: true };
    },

    // ------------------------------------------------------------------
    // Recipe selection (§4C/§4D)
    // ------------------------------------------------------------------

    /**
     * Explicitly select which recipe the area's station crafts. Replaces the
     * old implicit matching from dragged items (gated in Phase 4 §4C).
     * @returns {{ success: boolean, error?: string }}
     */
    selectRecipe(areaId, recipeId) {
        const areaState = GameState.areaStates?.[areaId];
        const stationId = areaState?.stationState?.activeStationCardId;
        if (!stationId) {
            return { success: false, error: 'No station slotted in this area' };
        }

        const template = getCardTemplate(stationId);
        if (!template?.hasCraftingQueue) {
            return { success: false, error: 'This station has no crafting queue' };
        }

        const recipe = getRecipe(recipeId);
        if (!recipe) {
            return { success: false, error: `Unknown recipe "${recipeId}"` };
        }
        if (recipe.subskillId !== template.config?.recipeGroup) {
            return { success: false, error: 'Recipe does not belong to this station\'s recipe group' };
        }
        const skillCap = template.config?.skillCap || 90;
        if ((recipe.levelRequirement || 0) > skillCap) {
            return { success: false, error: `Recipe exceeds this station's skill cap (${skillCap})` };
        }

        areaState.stationState.selectedRecipeId = recipeId;
        areaState.stationState.progress = 0;
        areaState.stationState.status = 'idle';

        EventBatch.queue(AREA_EVENTS.STATION_CHANGED, { areaId, stationTemplateId: stationId });
        logger.info('StationSlotManager', `Recipe "${recipeId}" selected for ${areaId}`);
        return { success: true };
    },

    /**
     * Configure the production cap (§4F): 'infinite', or 'limited' with a
     * target quantity. Switching modes re-opens a limit-paused queue.
     */
    setProductionMode(areaId, mode, limit = 0) {
        const areaState = GameState.areaStates?.[areaId];
        const st = areaState?.stationState;
        if (!st) return { success: false, error: 'No station state for this area' };
        if (mode !== 'infinite' && mode !== 'limited') {
            return { success: false, error: `Unknown production mode "${mode}"` };
        }

        st.productionMode = mode;
        st.productionLimit = mode === 'limited' ? Math.max(0, limit) : 0;
        if (st.status === 'paused_limit_reached') st.status = 'idle'; // StationManager re-evaluates next tick
        return { success: true };
    },

    /**
     * Set (or clear, with null) the area's station Drink slot — the drink
     * auto-consumed to keep a low-energy hero crafting (owner design
     * 2026-07-16). Only stores a reference to a bank item; the stack stays in
     * the bank until StationManager sips from it.
     * @returns {{ success: boolean, error?: string }}
     */
    setStationDrink(areaId, itemId) {
        const st = GameState.areaStates?.[areaId]?.stationState;
        if (!st) return { success: false, error: 'No station state for this area' };
        if (itemId) {
            const item = getItem(itemId);
            const isDrink = item && (item.equipSlot === 'drink' || item.type === 'drink' || item.tags?.includes('drink'));
            if (!isDrink) return { success: false, error: 'Only drinks can go in the Drink slot' };
        }
        st.drinkItemId = itemId || null;
        if (st.status === 'paused_no_energy') st.status = 'idle'; // StationManager re-evaluates next tick
        EventBatch.queue(AREA_EVENTS.STATION_CHANGED, { areaId, stationTemplateId: st.activeStationCardId });
        return { success: true };
    },

    // ------------------------------------------------------------------
    // Passive buff registration (§4G)
    // ------------------------------------------------------------------

    _registerBuff(areaId, template) {
        if (!template.passiveBuff) return;
        const agg = getAreaAggregator(areaId);
        agg.removeModifiersBySource(template.id); // idempotent re-register
        agg.addModifier({
            ...template.passiveBuff,
            source: template.id
        });
        logger.info('StationSlotManager', `Passive buff from "${template.id}" active on ${areaId} (${template.passiveBuff.description || template.passiveBuff.type})`);
    },

    _removeBuff(areaId, templateId) {
        getAreaAggregator(areaId).removeModifiersBySource(templateId);
    },

    /**
     * Rebuild every area aggregator from persisted state. Called on boot and
     * after any save load (the aggregators themselves are never saved).
     */
    rehydrateBuffs() {
        clearAllAreaAggregators();
        const areaStates = GameState.areaStates || {};
        for (const [areaId, areaState] of Object.entries(areaStates)) {
            const stationId = areaState?.stationState?.activeStationCardId;
            if (!stationId) continue;
            const template = getCardTemplate(stationId);
            if (template) this._registerBuff(areaId, template);
            // Slotted stations affect card stats — flag for recalculation.
            areaState._dirtyStats = true;
        }
    }
};

export default StationSlotManager;
