// Fantasy Guild - Area Deck Loop Engine (Deck Loop rework, Phase 3)

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { EventBatch } from '../core/EventBatch.js';
import { AREA_EVENTS } from '../core/areaEvents.js';
import * as NotificationSystem from '../core/NotificationSystem.js';
import {
    DRAW_TIME_MS,
    SHUFFLE_TIME_MS,
    CONSUMPTION_TIME_MS,
    ENERGY_DRAW_COST,
    DEFEAT_PENALTY,
    PROGRESS_EVENT_TICK_INTERVAL
} from '../../config/loopConstants.js';
import { getCard as getCardTemplate } from '../../config/registries/cardRegistry.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { CardFactory } from '../cards/logic/CardFactory.js';
import { completeWorkCycle } from '../cards/logic/WorkProcessor.js';
import { recalculateCardStats } from '../cards/logic/StatProcessor.js';
import { checkRequirements } from '../cards/logic/RequirementProcessor.js';
import { processCombat } from '../cards/logic/CombatProcessor.js';
import * as HeroManager from '../hero/HeroManager.js';
import * as EquipmentManager from '../equipment/EquipmentManager.js';
import * as StatusEffectSystem from '../effects/StatusEffectSystem.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import { resetAreaLoop, getAreaForHero } from '../area/HeroAssignmentManager.js';
import { logger } from '../../utils/Logger.js';

/**
 * LoopRunner — ticks every area's deck loop simultaneously (§3A).
 *
 * Fast-path design (roadmap Appendix B, pattern 3): 99% of ticks only
 * subtract delta from a countdown timer. The expensive work — completing a
 * card, materializing the next one, paying energy, combat hand-off — only
 * happens at the rare moment a timer hits zero.
 *
 * ## The ephemeral card model
 * [DECISION 2026-07-07, owner-approved] Deck slots are flyweights (§2E) —
 * just a templateId and runtime counters, never full card objects. But the
 * preserved execution engines (WorkProcessor, StatProcessor,
 * CombatProcessor) all operate on rich card instances. Bridge: when a slot
 * becomes active, ONE temporary card instance is built from the template
 * via CardFactory.createInstance() and kept in a runtime-only map (never in
 * cards.active, never cached, never saved). It is discarded when the slot
 * completes. At most one exists per area, so the flyweight memory rule
 * holds.
 *
 * ## Combat hand-off (§3I)
 * When the loop reaches a combat card, the area's status becomes
 * 'in_combat' and each tick is delegated to the LIVE combat engine
 * (cards/logic/CombatProcessor.processCombat — the path the old card_system
 * tick drove; systems/combat/CombatTickProcessor is a dormant parallel
 * implementation, flagged for the Phase 9 sweep). The loop advances only
 * when the fight resolves.
 *
 * ## Area status machine (persisted on areaState.status)
 *   paused    → not ticking. `pausedReason` distinguishes 'energy'
 *               (auto-resumes, §3D) from null/manual (waits for a start).
 *   drawing   → intermission before the next slot activates (§3C).
 *   running   → active slot's countdown (task time / hazard hold /
 *               consumption time).
 *   in_combat → delegated to CombatProcessor until victory or defeat.
 *   shuffling → wrap-around intermission before slot 0 (§3C).
 *   injured   → hero was defeated (Forced Retreat, §3F); cleared to
 *               'paused' when WoundedSystem publishes hero_recovered.
 */
export const LoopRunner = {
    initialized: false,
    tickCounter: 0,

    /**
     * Ephemeral runtime cards, one per area at most. Deliberately NOT part
     * of GameState — rebuilt on demand after a save load.
     * @type {Map<string, Object>}
     */
    _activeCards: new Map(),

    init() {
        if (this.initialized) return;
        this.initialized = true;

        // Loop Reset Rule: deck/hero/equipment changes reset the loop
        // (HeroAssignmentManager.resetAreaLoop publishes STATS_DIRTY). The
        // in-flight ephemeral card is stale at that point — discard it and
        // fall back to 'paused' so the next tick starts a fresh draw.
        EventBus.subscribe(AREA_EVENTS.STATS_DIRTY, ({ areaId }) => {
            const areaState = GameState.areaStates?.[areaId];
            if (!areaState) return;
            this._discardActiveCard(areaId);
            if (['running', 'drawing', 'shuffling', 'in_combat'].includes(areaState.status)) {
                const hero = areaState.assignedHeroId ? HeroManager.getHero(areaState.assignedHeroId) : null;
                if (hero && hero.status === 'combat') HeroManager.setHeroStatus(hero.id, 'idle');
                areaState.status = 'paused';
                areaState.pausedReason = null;
                areaState.executionTimer = 0;
                EventBatch.queue(AREA_EVENTS.STATUS_CHANGED, { areaId, status: 'paused' });
            }
        });

        // Forced Retreat recovery leg (§3F): when the wounded hero heals,
        // the area leaves 'injured'. It stays in Stationed Mode — re-entering
        // the wilds is a deliberate player action (mode toggle, Phase 4).
        EventBus.subscribe('hero_recovered', ({ heroId }) => {
            const areaId = getAreaForHero(heroId);
            const areaState = areaId ? GameState.areaStates?.[areaId] : null;
            if (areaState && areaState.status === 'injured') {
                areaState.status = 'paused';
                areaState.pausedReason = null;
                EventBatch.queue(AREA_EVENTS.STATUS_CHANGED, { areaId, status: 'paused' });
            }
        });

        logger.info('LoopRunner', 'Loop engine initialized (multi-area sequential runner)');
    },

    /**
     * Main tick — advances every eligible area independently (§3A).
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
                if (!areaState || !Array.isArray(areaState.deckSlots) || areaState.deckSlots.length === 0) continue;
                if (areaState.mode !== 'adventure') continue;
                const heroId = areaState.assignedHeroId;
                if (!heroId) continue;

                // Area-scoped dirty flag (§3G): recalculate only this area's
                // live card. Flag-on there are no per-slot card instances —
                // the ephemeral active card is the only stat carrier, so the
                // roadmap's recalculateAreaStats() collapses to this.
                if (areaState._dirtyStats) {
                    const activeCard = this._activeCards.get(areaId);
                    if (activeCard) recalculateCardStats(activeCard);
                    areaState._dirtyStats = false;
                }

                // Status DoT ticks can down a hero anywhere in the loop, not
                // just mid-fight — route 0 HP through the same Forced Retreat
                // ('in_combat' has its own check inside _tickCombat).
                if (['running', 'drawing', 'shuffling'].includes(areaState.status)) {
                    const loopHero = HeroManager.getHero(heroId);
                    if (loopHero && (loopHero.hp?.current ?? 1) <= 0) {
                        this._forcedRetreat(areaId, areaState, heroId, 'status damage');
                        continue;
                    }
                }

                switch (areaState.status) {
                    case 'paused':
                        this._tryAutoStart(areaId, areaState, heroId);
                        break;
                    case 'injured':
                        break; // WoundedSystem owns recovery; nothing to tick.
                    case 'drawing':
                        areaState.executionTimer -= delta;
                        this._publishProgress(areaId, areaState);
                        if (areaState.executionTimer <= 0) this._activateSlot(areaId, areaState, heroId);
                        break;
                    case 'shuffling':
                        areaState.executionTimer -= delta;
                        this._publishProgress(areaId, areaState);
                        if (areaState.executionTimer <= 0) this._beginDraw(areaId, areaState);
                        break;
                    case 'in_combat':
                        this._tickCombat(areaId, areaState, heroId, delta);
                        break;
                    case 'running':
                        areaState.executionTimer -= delta;
                        this._publishProgress(areaId, areaState);
                        if (areaState.executionTimer <= 0) this._completeActiveSlot(areaId, areaState, heroId);
                        break;
                    default:
                        // Unknown status (e.g. hand-edited save) — normalize.
                        areaState.status = 'paused';
                        areaState.pausedReason = null;
                }
            }
        } finally {
            EventBatch.flush();
        }
    },

    // ------------------------------------------------------------------
    // Loop phase transitions
    // ------------------------------------------------------------------

    /** Does this deck contain anything the loop can actually execute? */
    _hasActionableSlot(areaState) {
        return areaState.deckSlots.some(slot => slot.templateId || slot.hazard);
    },

    /**
     * 'paused' handling. Energy pauses retry the blocked draw once the hero
     * can pay (§3D). Fresh assignments auto-start — there is no start/stop
     * UI until Phase 6, and an assigned hero standing idle forever would
     * violate the "true idle game" vision.
     */
    _tryAutoStart(areaId, areaState, heroId) {
        const hero = HeroManager.getHero(heroId);
        if (!hero || hero.status === 'wounded') return;
        if (!this._hasActionableSlot(areaState)) return;

        if (areaState.pausedReason === 'energy') {
            if ((hero.energy?.current ?? 0) >= ENERGY_DRAW_COST) {
                areaState.pausedReason = null;
                this._activateSlot(areaId, areaState, heroId); // retry the blocked draw
            }
            return;
        }
        if (areaState.pausedReason) return; // manual pause — wait for the player

        this._beginDraw(areaId, areaState);
    },

    /** Enter the draw intermission for the slot at activeCardIndex (§3C). */
    _beginDraw(areaId, areaState) {
        areaState.status = 'drawing';
        areaState.executionTimer = DRAW_TIME_MS;
        areaState._activeDuration = DRAW_TIME_MS;
        areaState.pausedReason = null;
        EventBatch.queue(AREA_EVENTS.STATUS_CHANGED, { areaId, status: 'drawing' });
    },

    /**
     * Draw finished — the slot at activeCardIndex becomes the active card.
     * Branches: hazard (§2C-1), empty (skip), consumable (§3E),
     * combat (§3I hand-off), task (ephemeral card + WorkProcessor stats).
     */
    _activateSlot(areaId, areaState, heroId) {
        const slot = areaState.deckSlots[areaState.activeCardIndex];
        if (!slot) {
            this._advance(areaId, areaState);
            return;
        }

        // Environmental hazard slot: damage on entry, hold, advance (§2C-1).
        // No card, no energy cost — it's terrain, not an action.
        if (slot.hazard) {
            const damage = slot.hazard.damagePerPass || 0;
            if (damage > 0) {
                HeroManager.modifyHeroHp(heroId, -damage);
                const hero = HeroManager.getHero(heroId);
                if ((hero?.hp?.current ?? 1) <= 0) {
                    this._forcedRetreat(areaId, areaState, heroId, `${slot.hazard.type || 'hazard'} damage`);
                    return;
                }
            }
            slot.status = 'active';
            areaState.status = 'running';
            areaState.executionTimer = Math.max(1000, slot.hazard.tickTime || 2000);
            areaState._activeDuration = areaState.executionTimer;
            EventBatch.queue(AREA_EVENTS.STATUS_CHANGED, { areaId, status: 'running' });
            return;
        }

        // Empty player slot: nothing to do, move on (costs only the draw time).
        if (!slot.templateId) {
            this._advance(areaId, areaState);
            return;
        }

        const template = getCardTemplate(slot.templateId);
        if (!template) {
            logger.warn('LoopRunner', `Unknown template "${slot.templateId}" in ${areaId} slot ${areaState.activeCardIndex} — skipping`);
            this._advance(areaId, areaState);
            return;
        }

        // Energy draw cost (§3D): flat global cost per drawn card. Can't
        // pay → pause here; _tryAutoStart retries once regen catches up.
        const hero = HeroManager.getHero(heroId);
        if ((hero?.energy?.current ?? 0) < ENERGY_DRAW_COST) {
            this._discardActiveCard(areaId);
            areaState.status = 'paused';
            areaState.pausedReason = 'energy';
            EventBatch.queue(AREA_EVENTS.STATUS_CHANGED, { areaId, status: 'paused' });
            return;
        }
        HeroManager.modifyHeroEnergy(heroId, -ENERGY_DRAW_COST);

        // Consumable slot (§3E): resolves against the bank at the end of the
        // consumption window; the 3s is spent whether or not stock exists.
        if (template.cardType === 'consumable') {
            slot.status = 'active';
            areaState.status = 'running';
            areaState.executionTimer = CONSUMPTION_TIME_MS;
            areaState._activeDuration = CONSUMPTION_TIME_MS;
            EventBatch.queue(AREA_EVENTS.STATUS_CHANGED, { areaId, status: 'running' });
            return;
        }

        const card = this._materializeCard(areaId, slot, heroId, template);
        if (!card) {
            this._advance(areaId, areaState);
            return;
        }

        // Combat hand-off (§3I): pause the loop, delegate to CombatProcessor.
        if (template.cardType === 'combat') {
            slot.status = 'active';
            areaState.status = 'in_combat';
            areaState.executionTimer = 0;
            EventBatch.queue(AREA_EVENTS.STATUS_CHANGED, { areaId, status: 'in_combat' });
            return;
        }

        // Task-style card. Unmet requirements (skill level, tool, inputs)
        // skip the slot deterministically; Phase 6 UI will surface why.
        const { met, missing } = checkRequirements(card);
        if (!met) {
            logger.debug('LoopRunner', `Requirements unmet for ${slot.templateId} in ${areaId}: ${missing.join(', ')} — slot skipped`);
            this._discardActiveCard(areaId);
            this._advance(areaId, areaState);
            return;
        }

        slot.status = 'active';
        areaState.status = 'running';
        areaState.executionTimer = card.currentTickTime || card.baseTickTime || 10000;
        areaState._activeDuration = areaState.executionTimer;
        EventBatch.queue(AREA_EVENTS.STATUS_CHANGED, { areaId, status: 'running' });
    },

    /**
     * Build the ephemeral runtime card for a slot. Never registered in
     * cards.active or the card cache — it lives in _activeCards only.
     */
    _materializeCard(areaId, slot, heroId, template) {
        const card = CardFactory.createInstance(slot.templateId, { overrides: { areaId } });
        if (!card) return null;

        card._ephemeralLoopCard = true;
        // Hero lookup redirect (Phase 1 §1B, deferred to here): the hero
        // comes from the parent Area, not from a card-level assignment.
        card.assignedHeroId = heroId;
        this._resolveHeroTool(card, heroId, template);
        recalculateCardStats(card);
        this._activeCards.set(areaId, card);
        return card;
    },

    /**
     * Tool adaptation (Phase 1 §1B): instead of slotting a tool onto the
     * card and burning durability, the card borrows a matching tool from
     * the hero's equipment so requirement checks and speed bonuses work.
     */
    _resolveHeroTool(card, heroId, template) {
        const toolType = template.acceptedToolType || template.config?.acceptedToolType;
        if (!toolType) return;
        const equipment = EquipmentManager.getAllEquipment(heroId);
        for (const itemId of Object.values(equipment)) {
            if (!itemId) continue;
            const item = getItem(itemId);
            if (item && (item.toolType === toolType || item.tags?.includes(toolType))) {
                card.assignedToolId = itemId;
                return;
            }
        }
    },

    /**
     * The running countdown hit zero — resolve the active slot's payoff and
     * advance the loop cursor.
     */
    _completeActiveSlot(areaId, areaState, heroId) {
        const slotIndex = areaState.activeCardIndex;
        const slot = areaState.deckSlots[slotIndex];

        if (slot?.hazard) {
            // Damage already applied on entry; the hold time is the payoff.
            EventBatch.queue(AREA_EVENTS.CARD_COMPLETED, { areaId, slotIndex, templateId: null });
            this._advance(areaId, areaState);
            return;
        }

        const template = slot?.templateId ? getCardTemplate(slot.templateId) : null;
        if (template?.cardType === 'consumable') {
            this._resolveConsumable(heroId, template);
            this._recordCardUse(slot.templateId);
            EventBatch.queue(AREA_EVENTS.CARD_COMPLETED, { areaId, slotIndex, templateId: slot.templateId });
            this._advance(areaId, areaState);
            return;
        }

        // Task completion runs through the preserved WorkProcessor pipeline
        // (outputs, XP, quest progress). Rebuild the ephemeral card first if
        // a save/load dropped it mid-task.
        let card = this._activeCards.get(areaId);
        if (!card && template) {
            card = this._materializeCard(areaId, slot, heroId, template);
        }
        if (card) {
            const workTrait = card.traits?.find(t => t.type === 'workcycle');
            completeWorkCycle(card, workTrait);
            this._discardActiveCard(areaId);
        }
        this._recordCardUse(slot?.templateId);
        EventBatch.queue(AREA_EVENTS.CARD_COMPLETED, { areaId, slotIndex, templateId: slot?.templateId || null });
        this._advance(areaId, areaState);
    },

    /**
     * Consumable resolution (§3E): consume 1 unit from the global bank if
     * stocked, apply the restore effect; if the bank is empty the time was
     * the penalty and nothing happens. The slot stays in the deck either
     * way (banked inventory binding — resupply auto-resumes it).
     *
     * Note: no consumable card templates exist yet (they're authored in
     * Phase 5). itemId resolution is provisional until that schema lands.
     */
    _resolveConsumable(heroId, template) {
        const itemId = template.config?.itemId || template.itemId;
        if (!itemId || !InventoryManager.hasItem(itemId, 1)) return;

        const item = getItem(itemId);
        InventoryManager.removeItem(itemId, 1);
        const restore = item?.restoreAmount || 0;
        if (restore > 0) {
            if (item.tags?.includes('drink')) HeroManager.modifyHeroEnergy(heroId, restore);
            else HeroManager.modifyHeroHp(heroId, restore);
        }
    },

    /**
     * Lifetime completion tally per card template (Phase 7 — feeds the
     * Collection Binder's "times performed" stat). Hazards pass null and
     * are not counted. Defensive init: pre-Phase-7 saves lack the key.
     */
    _recordCardUse(templateId) {
        if (!templateId) return;
        const collection = GameState.state?.collection;
        if (!collection) return;
        if (!collection.cardUseCounts) collection.cardUseCounts = {};
        collection.cardUseCounts[templateId] = (collection.cardUseCounts[templateId] || 0) + 1;
    },

    /**
     * Move the loop cursor to the next slot: draw intermission between
     * slots, shuffle intermission on wrap-around (§3C).
     */
    _advance(areaId, areaState) {
        const currentSlot = areaState.deckSlots[areaState.activeCardIndex];
        if (currentSlot) {
            currentSlot.status = 'idle';
            currentSlot.progress = 0;
        }

        areaState.activeCardIndex = (areaState.activeCardIndex + 1) % areaState.deckSlots.length;
        if (areaState.activeCardIndex === 0) {
            areaState.status = 'shuffling';
            areaState.executionTimer = SHUFFLE_TIME_MS;
            areaState._activeDuration = SHUFFLE_TIME_MS;
            EventBatch.queue(AREA_EVENTS.STATUS_CHANGED, { areaId, status: 'shuffling' });
        } else {
            this._beginDraw(areaId, areaState);
        }
    },

    // ------------------------------------------------------------------
    // Combat hand-off (§3I)
    // ------------------------------------------------------------------

    /**
     * While 'in_combat' the loop countdown is suspended; each engine tick is
     * forwarded to the live combat engine, which runs its own attack-speed
     * counters and RNG exactly as it did on the old board.
     */
    _tickCombat(areaId, areaState, heroId, delta) {
        let card = this._activeCards.get(areaId);
        if (!card) {
            // Save/load dropped the ephemeral card mid-fight — restart the
            // encounter fresh (combat internals aren't persisted; the enemy
            // heals, the hero keeps whatever HP they saved with).
            const slot = areaState.deckSlots[areaState.activeCardIndex];
            const template = slot?.templateId ? getCardTemplate(slot.templateId) : null;
            if (!template || template.cardType !== 'combat') {
                areaState.status = 'paused';
                areaState.pausedReason = null;
                EventBatch.queue(AREA_EVENTS.STATUS_CHANGED, { areaId, status: 'paused' });
                return;
            }
            card = this._materializeCard(areaId, slot, heroId, template);
            if (!card) {
                areaState.status = 'paused';
                EventBatch.queue(AREA_EVENTS.STATUS_CHANGED, { areaId, status: 'paused' });
                return;
            }
        }

        const combatTrait = card.traits?.find(t => t.type === 'combat');
        if (!combatTrait) {
            logger.warn('LoopRunner', `Combat card ${card.templateId} has no combat trait — skipping slot`);
            this._discardActiveCard(areaId);
            this._advance(areaId, areaState);
            return;
        }

        processCombat(card, combatTrait, delta);
        this._publishCombatProgress(areaId, card, heroId);

        // Defeat: CombatProcessor's enemy attacks route 0-HP through
        // handleHeroWounded (hero.status = 'wounded'). Detect and retreat.
        const hero = HeroManager.getHero(heroId);
        if (!hero || hero.status === 'wounded' || (hero.hp?.current ?? 1) <= 0) {
            this._forcedRetreat(areaId, areaState, heroId, 'combat defeat');
            return;
        }

        // Victory: handleVictory applied XP/loot and set status 'victory'.
        // Resolve the hand-off before the processor's intermission timer can
        // reset the enemy for another round.
        if (card.status === 'victory') {
            this._recordCardUse(card.templateId);
            EventBatch.queue(AREA_EVENTS.COMBAT_RESOLVED, { areaId, outcome: 'victory' });
            EventBatch.queue(AREA_EVENTS.CARD_COMPLETED, {
                areaId,
                slotIndex: areaState.activeCardIndex,
                templateId: card.templateId
            });
            this._discardActiveCard(areaId);
            this._advance(areaId, areaState);
        }
    },

    // ------------------------------------------------------------------
    // Defeat & Forced Retreat (§3F)
    // ------------------------------------------------------------------

    /**
     * Hero hit 0 HP (combat or hazard — same routing, §3I). Halt the
     * adventure loop, bench the hero at the outpost as injured, apply the
     * death penalties. WoundedSystem handles the passive recovery timer.
     */
    _forcedRetreat(areaId, areaState, heroId, cause) {
        const hero = HeroManager.getHero(heroId);
        if (hero && hero.status !== 'wounded') {
            HeroManager.setHeroStatus(heroId, 'wounded'); // hazard path; combat path already did this
        }
        // Forced Retreat cleanses every status, buff or debuff (§6)
        StatusEffectSystem.clearAll(heroId);

        this._discardActiveCard(areaId);
        this._applyDeathPenalties(areaState, heroId);
        resetAreaLoop(areaId); // deck restarts from slot 0 after recovery

        areaState.mode = 'stationed';
        areaState.status = 'injured';
        areaState.pausedReason = null;
        areaState.executionTimer = 0;

        EventBatch.queue(AREA_EVENTS.STATUS_CHANGED, { areaId, status: 'injured' });
        EventBatch.queue(AREA_EVENTS.COMBAT_RESOLVED, { areaId, outcome: 'defeat' });
        EventBatch.queue(AREA_EVENTS.MODE_SWITCHED, { areaId, mode: 'stationed' });
        NotificationSystem.warning(`${hero?.name || 'Hero'} was defeated (${cause}) and retreats to the outpost, injured!`);
        logger.info('LoopRunner', `Forced Retreat in ${areaId}: ${heroId} defeated by ${cause}`);
    },

    /**
     * Death penalties (§3F). [DECISION 2026-07-07] Placeholder numbers in
     * loopConstants.js, owner-approved for later tuning.
     */
    _applyDeathPenalties(areaState, heroId) {
        // Loop Item Loss: a portion of each slotted consumable's banked
        // stack is destroyed (concept doc §10B).
        for (const slot of areaState.deckSlots) {
            if (!slot.templateId) continue;
            const template = getCardTemplate(slot.templateId);
            if (template?.cardType !== 'consumable') continue;
            const itemId = template.config?.itemId || template.itemId;
            if (!itemId) continue;
            const banked = InventoryManager.getItemCount(itemId);
            const loss = Math.ceil(banked * DEFEAT_PENALTY.CONSUMABLE_LOSS_RATIO);
            if (loss > 0) InventoryManager.removeItem(itemId, loss);
        }

        // Permanent Equipment Loss: each equipped gear piece can break
        // (concept doc §10B). Unequip + remove from the bank = gone forever.
        const equipment = EquipmentManager.getAllEquipment(heroId);
        for (const [slotName, itemId] of Object.entries(equipment)) {
            if (!itemId || DEFEAT_PENALTY.GEAR_LOSS_EXEMPT_SLOTS.includes(slotName)) continue;
            if (Math.random() < DEFEAT_PENALTY.GEAR_LOSS_CHANCE) {
                const item = getItem(itemId);
                EquipmentManager.unequipItem(heroId, slotName);
                InventoryManager.removeItem(itemId, 1);
                NotificationSystem.warning(`${item?.name || itemId} was destroyed in the defeat!`);
            }
        }
    },

    // ------------------------------------------------------------------
    // Plumbing
    // ------------------------------------------------------------------

    _discardActiveCard(areaId) {
        this._activeCards.delete(areaId);
    },

    /**
     * Player-driven stop (Phase 6 Control Panel). A manual pause survives
     * _tryAutoStart — only resumeArea (or a fresh hero assignment) clears it.
     * The in-flight card is discarded; the current slot re-draws on resume.
     */
    pauseArea(areaId) {
        const areaState = GameState.areaStates?.[areaId];
        if (!areaState) return { success: false, error: `Unknown area "${areaId}"` };
        if (areaState.status === 'in_combat') {
            return { success: false, error: 'Cannot pause mid-fight' };
        }
        if (areaState.status === 'injured') {
            return { success: false, error: 'Hero is recovering' };
        }
        this._discardActiveCard(areaId);
        const currentSlot = areaState.deckSlots?.[areaState.activeCardIndex];
        if (currentSlot) { currentSlot.status = 'idle'; currentSlot.progress = 0; }
        areaState.status = 'paused';
        areaState.pausedReason = 'manual';
        areaState.executionTimer = 0;
        EventBatch.queue(AREA_EVENTS.STATUS_CHANGED, { areaId, status: 'paused' });
        return { success: true };
    },

    /** Player-driven start — clears a manual pause; the loop auto-starts next tick. */
    resumeArea(areaId) {
        const areaState = GameState.areaStates?.[areaId];
        if (!areaState) return { success: false, error: `Unknown area "${areaId}"` };
        if (areaState.pausedReason === 'manual') areaState.pausedReason = null;
        return { success: true };
    },

    /** Runtime accessor for UI/debug — the area's live ephemeral card, if any. */
    getActiveCardForArea(areaId) {
        return this._activeCards.get(areaId) || null;
    },

    /**
     * Throttled high-frequency progress event for ref-based progress bars
     * (Phase 6 §D). Published directly — deliberately NOT batched: it's the
     * one event whose whole purpose is per-tick granularity.
     */
    _publishProgress(areaId, areaState) {
        if (this.tickCounter % PROGRESS_EVENT_TICK_INTERVAL !== 0) return;
        const duration = areaState._activeDuration || 0;
        if (duration <= 0) return;
        const percent = Math.min(100, Math.max(0, (1 - areaState.executionTimer / duration) * 100));
        EventBus.publish(AREA_EVENTS.PROGRESS, { areaId, percent });
    },

    /**
     * Combat variant of the progress event: `percent` carries the hero's
     * attack-loop fill (so the universal hero bar needs no special casing)
     * and `enemyPercent` the enemy's, for the combat-only enemy bar.
     */
    _publishCombatProgress(areaId, card, heroId) {
        if (this.tickCounter % PROGRESS_EVENT_TICK_INTERVAL !== 0) return;
        const combat = card.combat || {};
        const heroSpeed = combat.heroAttackSpeed || 0;
        const enemySpeed = combat.enemyAttackSpeed || 0;
        const heroProgress = combat.heroTickProcesses?.[heroId] ?? combat.heroTickProgress ?? 0;
        const percent = heroSpeed > 0 ? Math.min(100, (heroProgress / heroSpeed) * 100) : 0;
        const enemyPercent = enemySpeed > 0 ? Math.min(100, ((combat.enemyTickProgress || 0) / enemySpeed) * 100) : 0;
        EventBus.publish(AREA_EVENTS.PROGRESS, { areaId, percent, enemyPercent });
    }
};

export default LoopRunner;
