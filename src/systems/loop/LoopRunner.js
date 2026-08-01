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
import { CARD_TYPES } from '../../config/registries/cardConstants.js';
import { getCardEffects, deriveCardType } from '../../config/cards/cardEffects.js';
import { hasEffect, findEffect, effectsForPhase, EFFECT_PHASES } from '../../config/cards/effectRegistry.js';
import { resolveOnActivate, resolveOnComplete } from '../cards/effects/effectResolvers.js';
import { CardFactory } from '../cards/logic/CardFactory.js';
import { completeWorkCycle } from '../cards/logic/WorkProcessor.js';
import { recalculateCardStats } from '../cards/logic/StatProcessor.js';
import { checkRequirements } from '../cards/logic/RequirementProcessor.js';
import { processCombat } from '../cards/logic/CombatProcessor.js';
import * as HeroManager from '../hero/HeroManager.js';
import * as EquipmentManager from '../equipment/EquipmentManager.js';
import { getEquippedEntries, isGearCategory } from '../../config/registries/equipmentConstants.js';
import * as StatusEffectSystem from '../effects/StatusEffectSystem.js';
import { applySlotTokensToCard, clearAreaTokens, clearAllSlotTokens } from '../effects/SlotTokens.js';
import { stampMutatorFromCard } from '../effects/MutatorStamping.js';
import { setSlotFailure, clearAreaFailures, clearAllSlotFailures } from './SlotFailures.js';
import { applyCardBuffs, consumePendingNextCardBuff, releaseNextCardBuff, clearLoopBuffs, clearAllLoopBuffs } from './LoopBuffs.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import { resetAreaLoop, getAreaForHero } from '../area/HeroAssignmentManager.js';
import * as ConsumptionSystem from '../hero/ConsumptionSystem.js';
import { logger } from '../../utils/Logger.js';

/**
 * A "consumption card" is one whose entire job is restoring the hero — it
 * restores and does nothing else. It skips the ephemeral-card/work-cycle
 * machinery and just runs its effects against the bank.
 *
 * Expressed as a capability question rather than a type check (D-60): a Rest
 * card that also yields something is a Task and takes the normal work path.
 *
 * @param {object[]} effects
 * @returns {boolean}
 */
function isConsumptionCard(effects) {
    return hasEffect(effects, 'restore')
        && !hasEffect(effects, 'work_output')
        && !hasEffect(effects, 'combat');
}

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
            // A loop reset ends the Cycle early, so its stamped Tokens go with
            // it (§8 / roadmap F3) — the same wipe the Cycle boundary does.
            clearAreaTokens(areaId);
            clearLoopBuffs(areaId);
            clearAreaFailures(areaId);
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

        // Tokens are runtime-only and never serialized (roadmap F3), so a
        // loaded game must start with none. Without this they would linger in
        // memory from the pre-load session and silently attach to the new one.
        EventBus.subscribe('game_loaded', () => { clearAllSlotTokens(); clearAllSlotFailures(); clearAllLoopBuffs(); });

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
                        if (areaState.executionTimer <= 0) {
                            const carry = areaState.executionTimer;
                            this._activateSlot(areaId, areaState, heroId);
                            this._applyTimerCarry(areaState, carry);
                        }
                        break;
                    case 'shuffling':
                        areaState.executionTimer -= delta;
                        this._publishProgress(areaId, areaState);
                        if (areaState.executionTimer <= 0) {
                            const carry = areaState.executionTimer;
                            this._beginDraw(areaId, areaState);
                            this._applyTimerCarry(areaState, carry);
                        }
                        break;
                    case 'in_combat':
                        this._tickCombat(areaId, areaState, heroId, delta);
                        break;
                    case 'running':
                        areaState.executionTimer -= delta;
                        this._publishProgress(areaId, areaState);
                        if (areaState.executionTimer <= 0) {
                            const carry = areaState.executionTimer;
                            this._completeActiveSlot(areaId, areaState, heroId);
                            this._applyTimerCarry(areaState, carry);
                        }
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
        return areaState.deckSlots.some(slot => slot.templateId);
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

        // Drink at the DRAW (D-27): energy is what pays to draw the next Task
        // card, so a thirsty hero drinks FIRST and then draws. Doing it here —
        // before the cost is checked — is what stops a hero stalling with a
        // full waterskin in their grid.
        ConsumptionSystem.tryDrink(heroId);

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

        // Effect-driven from here (D-60): what a card DOES comes from its
        // effect list, never from its authored `cardType`.
        const effects = getCardEffects(template);

        // Consumption card (§3E): a card whose whole job is restoring the
        // hero. Resolves against the bank at the end of the consumption
        // window; the 3s is spent whether or not stock exists.
        if (isConsumptionCard(effects)) {
            slot.status = 'active';
            areaState.status = 'running';
            areaState.executionTimer = CONSUMPTION_TIME_MS;
            areaState._activeDuration = CONSUMPTION_TIME_MS;
            EventBatch.queue(AREA_EVENTS.STATUS_CHANGED, { areaId, status: 'running' });
            return;
        }

        // A Next-Card buff armed by the PREVIOUS slot lands now, before this
        // card's stats are computed — that ordering is what makes it buff this
        // card and not the one that cast it (D-10).
        consumePendingNextCardBuff(areaId);

        const card = this._materializeCard(areaId, slot, heroId, template, areaState.activeCardIndex);
        if (!card) {
            this._advance(areaId, areaState);
            return;
        }

        // On-activate effects (hazards bite here, D-11 — once per execution).
        // Cards carrying none are unaffected.
        const onActivate = resolveOnActivate(effects, { heroId, areaId, card });
        if (onActivate.heroDied) {
            this._forcedRetreat(areaId, areaState, heroId, 'hazard damage');
            return;
        }

        // This card's own buffs, applied AFTER its stats are computed: an Aura
        // covers the *remainder* of the loop and a Next-Card buff arms for the
        // slot after this one, so neither buffs the card carrying it (D-10).
        applyCardBuffs(areaId, slot.templateId, areaState.activeCardIndex,
            effectsForPhase(effects, EFFECT_PHASES.ON_ACTIVATE).filter(e => e.kind === 'buff'));

        // Combat hand-off (§3I): pause the loop, delegate to CombatProcessor.
        // Derived, not authored (D-60) — and derivation encodes the legacy
        // ambush rule, so a card that fights AND yields loot stays on the task
        // path exactly as it does today.
        if (deriveCardType(effects) === CARD_TYPES.COMBAT) {
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
    _materializeCard(areaId, slot, heroId, template, slotIndex) {
        const card = CardFactory.createInstance(slot.templateId, { overrides: { areaId } });
        if (!card) return null;

        card._ephemeralLoopCard = true;
        // Hero lookup redirect (Phase 1 §1B, deferred to here): the hero
        // comes from the parent Area, not from a card-level assignment.
        card.assignedHeroId = heroId;
        this._resolveHeroTool(card, heroId, template);

        // Stamped Tokens (mutator roadmap F1): upcoming cards aren't objects,
        // so Tokens were stamped onto this SLOT. This is the moment they become
        // real modifiers on a live card. Must precede recalculateCardStats() so
        // the stat pass sees them, not the previous card's values.
        // (CardFactory.createInstance already gives every card an aggregator.)
        if (Number.isInteger(slotIndex)) {
            applySlotTokensToCard(card, areaId, slotIndex);
        }

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

        const template = slot?.templateId ? getCardTemplate(slot.templateId) : null;
        const effects = template ? getCardEffects(template) : [];

        // Consumption card: no ephemeral card, no work cycle — just resolve
        // its on-complete effects (the restore) and move on.
        if (isConsumptionCard(effects)) {
            resolveOnComplete(effects, { heroId, areaId });
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
            card = this._materializeCard(areaId, slot, heroId, template, slotIndex);
        }
        if (card) {
            // Only cards that actually DO work run the work pipeline. A card
            // authored purely as effects — a Boost, say — has no traits at
            // all, and `completeWorkCycle` dereferences `card.traits`
            // unguarded, so calling it would throw every tick and jam the loop
            // on that slot forever. Nothing is skipped by this: a card with no
            // workcycle has no outputs, XP or quest progress to award.
            const workTrait = card.traits?.find(t => t.type === 'workcycle');
            if (workTrait) completeWorkCycle(card, workTrait);

            // Mutator payoff (§15.5 / §15.15): a Mutator is an ordinary card
            // that takes normal Work Time; stamping is what it produces when
            // worked, the way loot is a task's payoff. No-ops for cards with
            // no `mutator` trait, so every other card is unaffected.
            // The card is discarded a few lines below, so the failure mark has
            // to live on the slot or the §12 stamp would never be seen.
            setSlotFailure(areaId, slotIndex, card.lastFailure);

            stampMutatorFromCard(areaId, areaState, card);

            this._discardActiveCard(areaId);
        }
        // A Next-Card buff only ever covers this one card, so it retires here.
        releaseNextCardBuff(areaId);

        this._recordCardUse(slot?.templateId);
        EventBatch.queue(AREA_EVENTS.CARD_COMPLETED, { areaId, slotIndex, templateId: slot?.templateId || null });
        this._advance(areaId, areaState);
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
            // === The Cycle boundary (mutator roadmap F2, §15.3/§7) ===
            // One full pass through the deck is over. EVERY stamped Token in
            // this area is wiped here, spent or not — surplus charges are never
            // carried into the next Cycle (§15.5). This is the single reset
            // point that lets SlotTokens stay out of GameState entirely (F3).
            clearAreaTokens(areaId);
            // In-loop buffs die with the Cycle too (D-10) — an Aura that
            // survived the wrap would compound silently every loop.
            clearLoopBuffs(areaId);

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
            if (!template || deriveCardType(getCardEffects(template)) !== CARD_TYPES.COMBAT) {
                areaState.status = 'paused';
                areaState.pausedReason = null;
                EventBatch.queue(AREA_EVENTS.STATUS_CHANGED, { areaId, status: 'paused' });
                return;
            }
            card = this._materializeCard(areaId, slot, heroId, template, areaState.activeCardIndex);
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
     * adventure loop, sideline the hero at the outpost as injured, apply the
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
        //
        // NOTE (C-9): this walks the DECK for item-backed restores. Once
        // consumables move onto the hero's 9-slot grid (D-17/D-20), this loop
        // must walk the grid instead — the deck will no longer hold them.
        for (const slot of areaState.deckSlots) {
            if (!slot.templateId) continue;
            const template = getCardTemplate(slot.templateId);
            const restore = findEffect(getCardEffects(template), 'restore');
            const itemId = restore?.itemId;
            if (!itemId) continue;
            const banked = InventoryManager.getItemCount(itemId);
            const loss = Math.ceil(banked * DEFEAT_PENALTY.CONSUMABLE_LOSS_RATIO);
            if (loss > 0) InventoryManager.removeItem(itemId, loss);
        }

        // Permanent Equipment Loss: each equipped GEAR piece can break (D-19).
        // Unequip + remove from the bank = gone forever.
        //
        // Gear only. The loadout grid holds food, drink and consumables too
        // now (D-7), and those are covered by the stack-loss penalty above —
        // rolling them here as well would punish the same loss twice.
        const hero = HeroManager.getHero(heroId);
        for (const entry of getEquippedEntries(hero)) {
            if (!isGearCategory(entry.category)) continue;
            if (DEFEAT_PENALTY.GEAR_LOSS_EXEMPT_SLOTS.includes(entry.category)) continue;
            if (Math.random() < DEFEAT_PENALTY.GEAR_LOSS_CHANCE) {
                const item = getItem(entry.itemId);
                EquipmentManager.unequipItem(heroId, entry.index);
                InventoryManager.removeItem(entry.itemId, 1);
                NotificationSystem.warning(`${item?.name || entry.itemId} was destroyed in the defeat!`);
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
     * Timer overshoot carry (CR-022): when a phase timer crosses zero, the
     * unspent remainder counts against the next phase instead of vanishing.
     * Only applies when the transition armed a fresh countdown — pause and
     * combat hand-offs (executionTimer 0) absorb nothing. Banked time spent
     * at 10x loses no value to phase-boundary rounding this way.
     */
    _applyTimerCarry(areaState, carry) {
        if (carry < 0 && areaState.executionTimer > 0) {
            areaState.executionTimer += carry;
        }
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
