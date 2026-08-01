// Fantasy Guild - Station Slot Management (Deck Loop rework, Phase 4 §4D)

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { EventBatch } from '../core/EventBatch.js';
import { AREA_EVENTS } from '../core/areaEvents.js';
import { getCard as getCardTemplate } from '../../config/registries/cardRegistry.js';
import { CARD_TYPES } from '../../config/registries/cardConstants.js';
import { getRecipe } from '../../config/registries/recipeRegistry.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { getOutpost, getOutposts } from './OutpostManager.js';
import { getAreaAggregator, clearAllAreaAggregators } from './AreaModifiers.js';
import { getGlobalAggregator, clearGlobalAggregator, auraSourceId, normalizeAuras } from './GlobalModifiers.js';
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
        for (const outpost of getOutposts()) {
            if (outpost.id === excludeAreaId) continue;
            if (outpost.activeStationCardId === templateId) count++;
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

        const areaState = getOutpost(areaId);
        if (!areaState) return { success: false, error: `Unknown outpost "${areaId}"` };

        // Swapping stations always resets the queue (§4D).
        if (areaState.activeStationCardId) {
            this._removeBuff(areaId, areaState.activeStationCardId);
        }

        Object.assign(areaState, {
            activeStationCardId: stationTemplateId,
            selectedRecipeId: null,
            progress: 0,
            productionMode: 'infinite',
            productionLimit: 0,
            producedCount: 0,
            status: 'idle'
        });

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
        const areaState = getOutpost(areaId);
        const current = areaState?.activeStationCardId;
        if (!current) {
            return { success: false, error: 'No station slotted in this area' };
        }

        this._removeBuff(areaId, current);
        areaState._dirtyStats = true;

        Object.assign(areaState, {
            activeStationCardId: null,
            selectedRecipeId: null,
            progress: 0,
            productionMode: 'infinite',
            productionLimit: 0,
            producedCount: 0,
            status: 'idle'
        });


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
        const areaState = getOutpost(areaId);
        const stationId = areaState?.activeStationCardId;
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

        areaState.selectedRecipeId = recipeId;
        areaState.progress = 0;
        areaState.status = 'idle';

        EventBatch.queue(AREA_EVENTS.STATION_CHANGED, { areaId, stationTemplateId: stationId });
        logger.info('StationSlotManager', `Recipe "${recipeId}" selected for ${areaId}`);
        return { success: true };
    },

    /**
     * Configure the production cap (§4F): 'infinite', or 'limited' with a
     * target quantity. Switching modes re-opens a limit-paused queue.
     */
    setProductionMode(areaId, mode, limit = 0) {
        const areaState = getOutpost(areaId);
        const st = areaState;
        if (!st) return { success: false, error: 'No station state for this area' };
        if (mode !== 'infinite' && mode !== 'limited') {
            return { success: false, error: `Unknown production mode "${mode}"` };
        }

        st.productionMode = mode;
        st.productionLimit = mode === 'limited' ? Math.max(0, limit) : 0;
        if (st.status === 'paused_limit_reached') st.status = 'idle'; // StationManager re-evaluates next tick
        return { success: true };
    },



    // ------------------------------------------------------------------
    // Passive buff registration (§4G)
    // ------------------------------------------------------------------

    /**
     * Register an installed Outpost card's aura on the GLOBAL aggregator
     * (D-16/D-23) — an Outpost reaches every area, so its buff has no single
     * area to live on. Sourced per-outpost so two copies stack additively and
     * removing one leaves the other standing.
     *
     * `passiveBuff` may be ONE modifier or an ARRAY of them. Aura strength is
     * deliberately free-form (owner call 2026-08-01: there are no power tiers —
     * a card may carry a 0.1% loot nudge or a +40% speed swing), and a card
     * that wants to do two things at once shouldn't need two cards.
     */
    _registerBuff(outpostId, template) {
        const buffs = normalizeAuras(template.passiveBuff);
        if (!buffs.length) return;

        const agg = getGlobalAggregator();
        const source = auraSourceId(outpostId, template.id);
        agg.removeModifiersBySource(source); // idempotent re-register
        for (const buff of buffs) agg.addModifier({ ...buff, source });

        const what = buffs.map(b => b.description || b.type).join(', ');
        logger.info('StationSlotManager', `Global aura from "${template.id}" active (${outpostId}: ${what})`);
    },

    _removeBuff(outpostId, templateId) {
        getGlobalAggregator().removeModifiersBySource(auraSourceId(outpostId, templateId));
    },

    /**
     * Rebuild the global aggregator from persisted state. Called on boot and
     * after any save load (aggregators themselves are never saved).
     *
     * Reads the OUTPOST list, not areaStates — stations moved off areas in
     * C-10, and an aggregator that silently rebuilds to empty is the classic
     * failure mode this method exists to prevent.
     */
    rehydrateBuffs() {
        clearGlobalAggregator();
        clearAllAreaAggregators();
        for (const outpost of getOutposts()) {
            const stationId = outpost?.activeStationCardId;
            if (!stationId) continue;
            const template = getCardTemplate(stationId);
            if (template) this._registerBuff(outpost.id, template);
            // An installed aura changes card stats — flag for recalculation.
            outpost._dirtyStats = true;
        }
        // Every area's cards re-resolve against the rebuilt global buckets.
        for (const areaState of Object.values(GameState.areaStates || {})) {
            areaState._dirtyStats = true;
        }
    }
};

export default StationSlotManager;
