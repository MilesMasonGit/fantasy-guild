// Fantasy Guild - Module Processors
// Handles the logic/ticks for individual modular traits

import * as CardManager from './CardManager.js';
import { bumpCardRev } from './CardManager.js';
import { getCard as getCardTemplate } from '../../config/registries/cardRegistry.js';
import * as HeroManager from '../hero/HeroManager.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import * as SkillSystem from '../hero/SkillSystem.js';
import { EventBus } from '../core/EventBus.js';
import { logger } from '../../utils/Logger.js';
import * as CombatFormulas from '../../utils/CombatFormulas.js';
import * as EquipmentManager from '../equipment/EquipmentManager.js';
import { getEnemy } from '../../config/registries/enemyRegistry.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import * as GradualInputSystem from '../exploration/GradualInputSystem.js';
import { getBiome } from '../../config/registries/biomeRegistry.js';
import { EFFECT_TYPES } from '../effects/constants.js';
import { ModifierAggregator } from '../effects/ModifierAggregator.js';
import { ThreatSystem } from '../threat/ThreatSystem.js';
import * as NotificationSystem from '../core/NotificationSystem.js';
import { toolSpeedMultiplier } from '../../config/FormulaRegistry.js';
import * as TransactionProcessor from '../economy/TransactionProcessor.js';

/**
 * Main dispatcher for modular card ticks
 * @param {Object} card 
 * @param {number} deltaTime 
 */
export function processModularTick(card, deltaTime) {
    if (!card.traits) return;

    for (const trait of card.traits) {
        switch (trait.type.toLowerCase()) {
            case 'workcycle':
                processWorkCycle(card, trait, deltaTime);
                break;
            case 'combat':
                processCombat(card, trait, deltaTime);
                break;
            case 'quest':
                processQuest(card, trait, deltaTime);
                break;
            case 'expiration':
                processExpiration(card, trait, deltaTime);
                break;
            // Additional module processors go here
        }
    }
}

/**
 * Work Cycle Module Processor
 */
function processWorkCycle(card, trait, deltaTime) {
    // 1. Check if we have all required heroes
    const heroslotTraits = card.traits?.filter(t => t.type === 'heroslot') || [];
    const assignedHeroIds = heroslotTraits.map((t, idx) =>
        card.heroSlots?.[idx] || (idx === 0 ? card.assignedHeroId : null)
    ).filter(id => !!id);

    if (assignedHeroIds.length < heroslotTraits.length) {
        if (card.status !== 'idle') CardManager.setCardStatus(card.id, 'idle');
        return;
    }

    // Pick first hero for legacy requirement checks (will improve in step 2)
    const hero = HeroManager.getHero(assignedHeroIds[0]);
    if (!hero || card.awaitingDiscovery) return;

    // 2. Check Requirements (Inputs, Skills, Stats)
    const { met, missing } = checkRequirements(card, hero);
    card.missingRequirements = missing; // Store for UI

    if (!met) {
        if (card.status !== 'paused') CardManager.setCardStatus(card.id, 'paused');
        return;
    }

    // 3. Status Transitions
    if (card.status === 'idle' || card.status === 'paused') {
        CardManager.setCardStatus(card.id, 'active');
    }

    if (card.status !== 'active') return;

    // 4. Calculate Speed Multiplier using Unified Effect Engine
    const effectiveMultiplier = recalculateCardStats(card);
    
    // 5. Increment Progress
    const cycleDuration = card.baseTickTime || 10000;
    const increment = deltaTime * effectiveMultiplier;
    card.progress = (card.progress || 0) + increment;

    // 6. Completion
    if (card.progress >= cycleDuration) {
        completeWorkCycle(card, trait);
    }
}

/**
 * Recalculate speed stats for a specific card.
 * Used for immediate UI updates after a pulse.
 * @param {Object} card 
 * @returns {number} The current effective multiplier
 */
export function recalculateCardStats(card) {
    if (!card || !card.traits) return 1;

    const trait = card.traits.find(t => t.id === 'workcycle' || t.type === 'workcycle');
    if (!trait) return 1;

    // Ensure Aggregator exists and is healthy
    if (!card.aggregator || typeof card.aggregator.getMultiplier !== 'function') {
        card.aggregator = new ModifierAggregator(card.id);
    }

    let effectiveMultiplier = 1;
    try {
        // 1. Local Modifiers (from heroes, equipment, etc.)
        const localMult = card.aggregator.getMultiplier(EFFECT_TYPES.SPEED, trait.skill);
        
        // 2. Global Modifiers (from active Invasions/Threats)
        const globalMult = ThreatSystem.getGlobalMultiplier(EFFECT_TYPES.SPEED, trait.skill);
        
        // 3. Tool Multiplier (from FormulaRegistry)
        let toolMult = 1.0;
        if (card.assignedToolId) {
            const tool = getItem(card.assignedToolId);
            if (tool && tool.speedBonus) {
                toolMult = toolSpeedMultiplier(tool.speedBonus);
            }
        }

        // 4. Overall Multiplier
        effectiveMultiplier = localMult * globalMult * toolMult;
    } catch (err) {
        console.error(`[ModuleProcessors] Aggregator failure on card ${card.id}:`, err);
        effectiveMultiplier = 1;
    }
    
    // Store current calculated time for UI
    card.currentTickTime = (card.baseTickTime || 10000) / effectiveMultiplier;

    return effectiveMultiplier;
}

/**
 * Handle card expiration (self-destruction timer)
 */
function processExpiration(card, trait, deltaTime) {
    if (card.timeRemainingMs === undefined) {
        card.timeRemainingMs = trait.durationMs || 300000; // Default 5 mins
    }

    card.timeRemainingMs -= deltaTime;

    if (card.timeRemainingMs <= 0) {
        logger.info('ModuleProcessors', `Card ${card.id} (${card.name}) has expired.`);
        CardManager.discardCard(card.id);
        NotificationSystem.info(`${card.name} has finished.`);
    }
}

/**
 * Recalculate stats for all active cards.
 */
export function recalculateAllCardStats() {
    const activeCards = CardManager.getActiveCards();
    for (const card of activeCards) {
        recalculateCardStats(card);
    }
}

/**
 * Handle completion of a work cycle
 */
function completeWorkCycle(card, trait) {
    logger.info('ModuleProcessors', `Work cycle complete: ${card.id}`);
    console.log(`[ModuleProcessors] Work cycle complete on card ${card.id} (${card.name})`);

    // 1. Consume Tool Durability (if assigned)
    if (card.assignedToolId) {
        InventoryManager.decrementDurability(card.assignedToolId, 1);
    }

    // Check if this card transitions to a selection state (e.g. Explore Cards)
    const questSelectionTrait = card.traits.find(t => t.type === 'quest_selection');
    if (questSelectionTrait) {
        card.status = 'completed';
        card.progress = card.baseTickTime || 10000; // Keep progress full
    } else {
        // Normal reset
        card.progress = 0;
        card.status = 'idle';
    }

    // Link to Quest Module if it's a collection or project quest
    const questTrait = card.traits.find(t => t.type === 'quest' && (t.questType === 'collection' || t.questType === 'project'));
    if (questTrait) {
        incrementCollectionProgress(card);
    }

    const rewardTrait = card.traits.find(t => t.type.toLowerCase() === 'unifiedreward');
    if (rewardTrait) {
        applyUnifiedReward(card, rewardTrait);
    }

    // Grant outputs for Task cards (prioritize loot trait, then root outputs, then config)
    const lootTrait = card.traits.find(t => t.type === 'loot');
    const outputs = (lootTrait?.items?.length > 0 ? lootTrait.items : null) || 
                    (lootTrait?.drops?.length > 0 ? lootTrait.drops : null) || 
                    (card.outputs?.length > 0 ? card.outputs : null) || 
                    card.config?.outputs || [];

    if (outputs.length > 0) {
        logger.debug('ModuleProcessors', `Processing ${outputs.length} outputs for card ${card.id}`);
    }

    // Gather and consume inputs
    const consumedItems = [];
    const inputSlots = card.traits.filter(t => t.type === 'inputslot');
    const template = getCardTemplate(card.templateId);
    const isProject = !!template?.isProject;

    for (let i = 0; i < inputSlots.length; i++) {
        const inputSlotTrait = inputSlots[i];
        const inputsToConsume = inputSlotTrait.inputs || [inputSlotTrait];

        for (let j = 0; j < inputsToConsume.length; j++) {
            const reqTrait = inputsToConsume[j];
            const slotIndex = inputSlotTrait.inputs ? j : (inputSlotTrait.slotIndex ?? i);
            const itemId = card.assignedItems?.[slotIndex];
            
            // For Projects, we only consume 1 per cycle (GRADUAL FEEDING)
            // For Tasks, we consume the full requested quantity
            const totalRequired = reqTrait.quantity || 1;
            const projectProgress = isProject ? (card.progress?.[itemId] || 0) : 0;
            const quantityToConsume = isProject ? Math.min(1, totalRequired - projectProgress) : totalRequired;

            if (itemId && !reqTrait.isTool && quantityToConsume > 0) {
                // Actual consumption logic
                let consumedCount = 0;

                // 1. Try to consume from stack first
                if (card.stack) {
                    for (let k = card.stack.length - 1; k >= 0; k--) {
                        if (card.stack[k].type === 'item' && card.stack[k].id === itemId) {
                            card.stack.splice(k, 1);
                            consumedCount++;
                            if (consumedCount >= quantityToConsume) break;
                        }
                    }
                }

                // 2. Consume remainder from inventory
                const remainingToConsume = quantityToConsume - consumedCount;
                if (remainingToConsume > 0) {
                    const removed = InventoryManager.removeItem(itemId, remainingToConsume);
                    if (removed) {
                        consumedCount += remainingToConsume;
                    }
                }

                // 3. Only record for project/task progress if we actually consumed some
                if (consumedCount > 0) {
                    consumedItems.push({ itemId, quantity: consumedCount });
                    
                    if (consumedCount > remainingToConsume) { 
                        // Meaning at least some came from stack
                        bumpCardRev(card);
                        EventBus.publish('cards_updated', { cardId: card.id, source: 'stack_consumed' });
                    }
                    
                    logger.debug('ModuleProcessors', `Consumed ${consumedCount}x ${itemId} for ${isProject ? 'project' : 'task'}`);
                } else {
                    logger.warn('ModuleProcessors', `Failed to consume ${quantityToConsume}x ${itemId}: insufficient stock`);
                }
            } else if (!itemId && !reqTrait.isTool && !isProject) {
                // Dynamic unassigned fallback (Task only)
                if (card.stack) {
                    const stackIdx = card.stack.findIndex(e => e.type === 'item');
                    if (stackIdx > -1) {
                        card.stack.splice(stackIdx, 1);
                        bumpCardRev(card);
                        EventBus.publish('cards_updated', { cardId: card.id, source: 'stack_consumed' });
                    }
                }
            }
        }
    }

    // If it's a project, notify the project system
    if (template?.isProject && consumedItems.length > 0) {
        EventBus.publish('project_work_cycle_complete', { 
            templateId: card.templateId, 
            consumedInputs: consumedItems 
        });
    }
    // Grant outputs for Task cards (Weighted Pick - ONE reward per cycle)
    if (!template?.isProject && outputs.length > 0) {
        // 1. Calculate Total Weight (default to 100 if sum is lower)
        // If an output has no chance, we assume 100 (standard for tasks)
        const totalWeight = outputs.reduce((sum, o) => sum + (o.chance ?? 100), 0);
        const rollRange = Math.max(100, totalWeight);
        const roll = Math.random() * rollRange;
        
        logger.debug('ModuleProcessors', `Weighted Pick: roll=${roll.toFixed(1)} / ${rollRange} (total=${totalWeight})`);

        let cumulativeWeight = 0;
        for (const output of outputs) {
            cumulativeWeight += (output.chance ?? 100);
            
            if (roll <= cumulativeWeight) {
                // This is the chosen outcome
                logger.debug('ModuleProcessors', `Outcome selected: ${JSON.stringify(output)}`);

                // Handle combat triggers
                if (output.type === 'combat_trigger') {
                    logger.info('ModuleProcessors', `Combat trigger SUCCESS for card ${card.id}: enemy ${output.enemyId}`);
                    const result = CardManager.transformToCombat(card.id, output.enemyId);
                    if (result && result.success) return; // Transformation happened
                }

                // Handle items
                if (output.itemId) {
                    const quantity = output.quantity || 1;
                    InventoryManager.addItem(output.itemId, quantity);
                    logger.info('ModuleProcessors', `Granted reward: ${quantity}x ${output.itemId} from card ${card.id}`);
                } else if (output.type !== 'combat_trigger') {
                    logger.warn('ModuleProcessors', `Selected output has no itemId: ${JSON.stringify(output)}`);
                }
                
                return; // Stop after giving ONE reward
            }
        }
        
        logger.debug('ModuleProcessors', 'No reward selected (roll exceeded total weight)');
    }

    EventBus.publish('module_cycle_complete', { cardId: card.id, traitId: trait.id });
}

/**
 * Unified Reward Processor
 */
/**
 * Combat Module Processor
 */
function processCombat(card, trait, deltaTime) {
    const enemy = getEnemy(trait.enemyId || card.enemyId);
    if (!enemy) return;

    // Initialize state if needed
    if (!card.enemyHp) card.enemyHp = { current: enemy.hp, max: enemy.hp };
    if (!card.combatState) card.combatState = {};
    if (!card.heroTickProcesses) card.heroTickProcesses = {};
    if (card.enemyTickProgress === undefined) card.enemyTickProgress = 0;

    // Get assigned heroes across ALL heroslot traits
    const heroslotTraits = card.traits.filter(t => t.type === 'heroslot');
    const assignedHeroIds = heroslotTraits.map((t, idx) =>
        card.heroSlots?.[idx] || (idx === 0 ? card.assignedHeroId : null)
    ).filter(id => !!id);

    if (assignedHeroIds.length === 0) {
        if (card.status !== 'idle') CardManager.setCardStatus(card.id, 'idle');
        return;
    }

    // Phase 2: Intermission Timer
    if (card.combatState.intermissionTimer > 0) {
        card.combatState.intermissionTimer -= deltaTime;
        if (card.combatState.intermissionTimer <= 0) {
            card.combatState.intermissionTimer = 0;
            // Reset HP for next fight
            card.enemyHp = { current: enemy.hp, max: enemy.hp };
            card.status = 'active';
            bumpCardRev(card);
        }
        return;
    }

    // Phase 2: Fleeing Logic - REMOVED


    // Activate card if heroes are present
    if (card.status === 'idle') {
        CardManager.setCardStatus(card.id, 'active');
    }

    // 1. Hero Attacks
    const heroStatsForUi = [];

    for (const heroId of assignedHeroIds) {
        const hero = HeroManager.getHero(heroId);
        if (!hero || hero.status === 'wounded') continue;

        // Set status to combat
        if (hero.status !== 'combat') HeroManager.setHeroStatus(heroId, 'combat');

        // Ensure Aggregator exists (Safety for existing heroes)
        if (!hero.aggregator) {
            hero.aggregator = new ModifierAggregator(hero.id);
        }

        // Check for auto-consume (consumes tick if triggered)
        if (checkAndConsumeFoodModular(card, hero)) {
            // Hero is eating/drinking, skip attack this tick
            heroStatsForUi.push({
                id: hero.id,
                hp: hero.hp,
                energy: hero.energy,
                progress: 0,
                attackSpeed: 3000,
                isConsuming: true
            });
            continue;
        }

        card.heroTickProcesses[heroId] = (card.heroTickProcesses[heroId] || 0) + deltaTime;
        card.heroTickProgress = card.heroTickProcesses[heroId]; // Sync for modular UI components

        // Calculate attack speed using Unified Effect Engine
        const heroClass = HeroManager.getHeroClass(heroId);
        const combatStyle = heroClass?.combatStyle || 'melee';
        const heroSkillLevel = hero.skills?.[combatStyle]?.level ?? 1;
        const effectiveMultiplier = hero.aggregator.getMultiplier(EFFECT_TYPES.SPEED, combatStyle);
        const attackSpeed = CombatFormulas.getHeroAttackSpeed(heroSkillLevel, effectiveMultiplier - 1); 
        card.heroAttackSpeed = attackSpeed; // Persist for UI

        // Track stats for UI
        heroStatsForUi.push({
            id: hero.id,
            hp: hero.hp,
            energy: hero.energy,
            progress: card.heroTickProcesses[heroId],
            attackSpeed: attackSpeed,
            isFleeing: card.isFleeing
        });

        // Hero attacks (Skip if fleeing)
        if (!card.isFleeing && card.heroTickProcesses[heroId] >= attackSpeed) {
            // Energy check
            const energyCost = enemy.energyCost ?? 2;
            if (hero.energy.current < energyCost) {
                // Not enough energy, tick is wasted/paused for this hero until they eat/drink
                continue;
            }

            // Consume energy
            HeroManager.modifyHeroEnergy(heroId, -energyCost);

            // Weapon check
            const weaponId = hero.equipment?.weapon;
            const weapon = weaponId ? getItem(weaponId) : null;

            // Attack logic
            const bonuses = EquipmentManager.getEquipmentBonuses(heroId);
            const heroSkill = CombatFormulas.getHeroCombatSkill(hero, combatStyle);
            const didHit = CombatFormulas.rollHit(heroSkill, enemy.defenceSkill);

            if (didHit) {
                const damage = CombatFormulas.computeHeroDamage(hero, enemy, weapon, bonuses.damage ?? 0, combatStyle);
                card.enemyHp.current = Math.max(0, card.enemyHp.current - damage);

                // Phase 10: Enemy Traits (Thorns)
                if (enemy.traits) {
                    const thorns = enemy.traits.find(t => t.id === 'thorns');
                    if (thorns) {
                        const reflectionDamage = thorns.level || 1;
                        HeroManager.modifyHeroHp(heroId, -reflectionDamage);
                        EventBus.publish('combat_enemy_trait_trigger', {
                            cardId: card.id,
                            heroId: heroId,
                            traitId: 'thorns',
                            damage: reflectionDamage
                        });
                    }
                }

                EventBus.publish('combat_hero_attack', {
                    cardId: card.id, heroId: hero.id, enemyId: enemy.id, damage, hit: true,
                    enemyHpRemaining: card.enemyHp.current
                });
            } else {
                EventBus.publish('combat_hero_attack', {
                    cardId: card.id, heroId: hero.id, enemyId: enemy.id, damage: 0, hit: false,
                    enemyHpRemaining: card.enemyHp.current
                });
            }

            // XP - Use standardized Phase 2 award
            const xpAward = CombatFormulas.getCombatXpAward(enemy);
            SkillSystem.addXP(heroId, combatStyle, xpAward);
            
            // Phase 2: Durability
            EquipmentManager.reduceDurability(heroId, 'weapon');

            card.heroTickProcesses[heroId] = 0;

            // Victory check
            if (card.enemyHp.current <= 0) {
                const rewardTrait = card.traits.find(t => t.type.toLowerCase() === 'unifiedreward');
                if (rewardTrait) applyUnifiedReward(card, rewardTrait);

                // --- Phase 3: Invasion Horde Handling ---
                if (card.hordeCount > 1) {
                    card.hordeCount--;
                    // Reset HP for next enemy in horde
                    card.enemyHp.current = card.enemyHp.max;
                    
                    logger.debug('ModuleProcessors', `Horde member defeated on card ${card.id}. ${card.hordeCount} remaining.`);
                    
                    // Grant incremental drops (to avoid waiting for 100 kills)
                    EventBus.publish('combat_victory', {
                        cardId: card.id,
                        heroId: heroId,
                        enemyId: enemy.id,
                        enemyName: enemy.name,
                        drops: enemy.drops,
                        dropTableId: enemy.dropTableId,
                        isHordeMember: true
                    });

                    return; // CONTINUE COMBAT
                }

                // --- Dungeon Sequential Combat Handling ---
                if (card.cardType === 'dungeon') {
                    card.completedCount = (card.completedCount || 0) + 1;
                    
                    if (card.enemyQueue && card.enemyQueue.length > 0) {
                        const nextEnemyId = card.enemyQueue.shift();
                        const nextEnemy = getEnemy(nextEnemyId);
                        
                        if (nextEnemy) {
                            card.enemyId = nextEnemyId;
                            card.enemyHp = { current: nextEnemy.hp, max: nextEnemy.hp };
                            card.combatState.intermissionTimer = 2000;
                            card.status = 'victory'; // Small pause state
                            
                            logger.info('ModuleProcessors', `Dungeon floor cleared! Moving to next enemy: ${nextEnemy.name}`);
                            
                            // Grant incremental drops for the floor
                            EventBus.publish('combat_victory', {
                                cardId: card.id,
                                heroId: heroId,
                                enemyId: enemy.id,
                                enemyName: enemy.name,
                                drops: enemy.drops,
                                dropTableId: enemy.dropTableId
                            });
                            
                            bumpCardRev(card);
                            return; // CONTINUE TO NEXT FLOOR
                        }
                    } else {
                        // FINAL BOSS DEFEATED
                        logger.info('ModuleProcessors', `Dungeon CLEARED: ${card.name}`);
                        
                        // 1. Grant Final Rewards
                        if (card.finalRewards) {
                            card.finalRewards.forEach(r => {
                                InventoryManager.addItem(r.itemId, r.count || r.amount);
                            });
                        }
                        
                        // 2. Grant Final XP
                        if (card.finalXpRewards) {
                            card.finalXpRewards.forEach(xp => {
                                assignedHeroIds.forEach(hid => {
                                    SkillSystem.addXP(hid, xp.skill, xp.amount);
                                });
                            });
                        }
                        
                        // Standard victory flow continues below for final enemy
                    }
                }

                // Standard victory or final horde member
                if (card.cardType === 'invasion') {
                    const activeAreaId = GameState.state.ui.activeAreaId;
                    ThreatSystem.clearInvasion(activeAreaId);
                }

                // Phase 2: Intermission Timer instead of immediate reset
                card.combatState.intermissionTimer = 3000;
                card.status = 'victory';

                // Reset hero statuses (they stay temporarily idle/victory during intermission)
                const nextStatus = card.originalTraits ? 'working' : 'idle';
                assignedHeroIds.forEach(id => HeroManager.setHeroStatus(id, nextStatus));

                EventBus.publish('combat_victory', {
                    cardId: card.id,
                    heroId: heroId,
                    enemyId: enemy.id,
                    enemyName: enemy.name,
                    drops: enemy.drops,
                    dropTableId: enemy.dropTableId
                });

                // Phase 9: Handle Transformative Reversion
                if (card.originalTraits) {
                    logger.info('ModuleProcessors', `Victory achieved on transformative card ${card.id}. Reverting state.`);
                    CardManager.revertFromCombat(card.id);
                }

                return;
            }
        }
    }

    // 2. Enemy Attacks
    card.enemyTickProgress += deltaTime;
    const enemyAttackSpeed = enemy.attackSpeed || 3000;
    card.enemyAttackSpeed = enemyAttackSpeed; // Persist for UI
    if (card.enemyTickProgress >= enemyAttackSpeed) {
        const targetHeroId = assignedHeroIds[Math.floor(Math.random() * assignedHeroIds.length)];
        const targetHero = HeroManager.getHero(targetHeroId);

        if (targetHero && targetHero.status !== 'wounded') {
            const bonuses = EquipmentManager.getEquipmentBonuses(targetHeroId);
            const heroClass = HeroManager.getHeroClass(targetHeroId);
            const combatSpecialization = heroClass?.combatStyle || 'melee';
            
            // Hero's defense is based on their primary combat skill
            const heroDefenceSkill = (targetHero.skills?.[combatSpecialization]?.level ?? 1) + (bonuses.defense ?? 0);
            
            const didHit = CombatFormulas.rollHit(enemy.attackSkill, heroDefenceSkill);

            if (didHit) {
                const damage = CombatFormulas.computeEnemyDamage(enemy, heroDefenceSkill, combatSpecialization);
                HeroManager.modifyHeroHp(targetHeroId, -damage);

                EventBus.publish('combat_enemy_attack', {
                    cardId: card.id, heroId: targetHeroId, enemyId: enemy.id, damage, hit: true,
                    heroHpRemaining: targetHero.hp.current
                });

                if (targetHero.hp.current <= 0) {
                    HeroManager.setHeroStatus(targetHeroId, 'wounded');
                    // Unassign from the specific slot
                    const slotIdx = card.heroSlots ? Object.values(card.heroSlots).indexOf(targetHeroId) : -1;
                    if (slotIdx >= 0) {
                        CardManager.unassignHero(card.id, slotIdx);
                    } else if (card.assignedHeroId === targetHeroId) {
                        CardManager.unassignHero(card.id, 0);
                    }
                    NotificationSystem.warning(`${targetHero.name} has been wounded!`);
                }
            } else {
                EventBus.publish('combat_enemy_attack', {
                    cardId: card.id, heroId: targetHeroId, enemyId: enemy.id, damage: 0, hit: false,
                    heroHpRemaining: targetHero.hp.current
                });
            }

            // XP - Use standardized Phase 2 award (Defense XP also funnels to primary skill)
            const xpAmount = CombatFormulas.getCombatXpAward(enemy);
            SkillSystem.addXP(targetHeroId, combatSpecialization, xpAmount);

            // Phase 2: Armor Durability
            EquipmentManager.reduceDurability(targetHeroId, 'armor');
            const slots = ['head', 'body', 'hands', 'feet'];
            const randomSlot = slots[Math.floor(Math.random() * slots.length)];
            EquipmentManager.reduceDurability(targetHeroId, randomSlot);
        }
        card.enemyTickProgress = 0;
    }

    // 3. Publish tick for UI
    EventBus.publish('combat_tick', {
        cardId: card.id,
        enemyHp: card.enemyHp,
        enemyProgress: card.enemyTickProgress,
        enemyAttackSpeed: enemyAttackSpeed,
        heroes: heroStatsForUi // Richer payload for multi-hero UI
    });
}

/**
 * Check if hero needs food/drink and consume if available (Modular version)
 * @returns {boolean} True if consumed (skips attack)
 */
function checkAndConsumeFoodModular(card, hero) {
    const { needsFood, needsDrink } = CombatFormulas.checkAutoConsume(hero);

    // Check food first (HP recovery)
    if (needsFood && hero.equipment?.food) {
        const itemId = hero.equipment.food;
        const foodItem = getItem(itemId);
        if (foodItem && foodItem.restoreAmount) {
            HeroManager.modifyHeroHp(hero.id, foodItem.restoreAmount);
            logger.debug('ModuleProcessors', `${hero.name} ate ${foodItem.name}, restored ${foodItem.restoreAmount} HP`);

            EventBus.publish('combat_consumed', {
                heroId: hero.id,
                itemId: foodItem.id,
                restoreType: 'hp',
                amount: foodItem.restoreAmount
            });

            InventoryManager.removeItem(foodItem.id, 1);
            EquipmentManager.validateEquipment(hero.id);
            return true;
        }
    }

    // Check drink (Energy recovery)
    if (needsDrink && hero.equipment?.drink) {
        const itemId = hero.equipment.drink;
        const drinkItem = getItem(itemId);
        if (drinkItem && drinkItem.restoreAmount) {
            HeroManager.modifyHeroEnergy(hero.id, drinkItem.restoreAmount);
            logger.debug('ModuleProcessors', `${hero.name} drank ${drinkItem.name}, restored ${drinkItem.restoreAmount} Energy`);

            EventBus.publish('combat_consumed', {
                heroId: hero.id,
                itemId: drinkItem.id,
                restoreType: 'energy',
                amount: drinkItem.restoreAmount
            });

            InventoryManager.removeItem(drinkItem.id, 1);
            EquipmentManager.validateEquipment(hero.id);
            return true;
        }
    }

    return false;
}

function applyUnifiedReward(card, trait) {
    const heroId = card.assignedHeroId;
    logger.debug('ModuleProcessors', `applyUnifiedReward: heroId=${heroId}, xp=${trait.xp}`);

    // Build a transaction from the unified reward trait
    const entries = [];

    // XP entry
    if (trait.xp > 0) {
        const xpSkill = card.traits.find(t => t.type === 'workcycle')?.skill;
        if (xpSkill) {
            entries.push({ type: 'XP', skill: xpSkill, amount: trait.xp });
        }
    }

    // Item entries
    if (trait.items?.length > 0) {
        for (const item of trait.items) {
            entries.push({ type: 'ITEM', id: item.id, amount: item.amount || 1 });
        }
    }

    if (entries.length > 0) {
        TransactionProcessor.apply({ entries }, heroId);
    }
}

/**
 * Comprehensive requirement check for modular cards
 * @param {Object} card 
 * @param {Object} hero 
 * @returns {Object} { met: boolean, missing: Array }
 */
function checkRequirements(card, hero) {
    const missing = [];
    if (!card.traits) return { met: true, missing: [] };

    // Index heroes for lookup
    const heroslotTraits = card.traits.filter(t => t.type === 'heroslot');

    for (const trait of card.traits) {
        const type = trait.type.toLowerCase();

        // 1. Slot-Specific Hero Requirements
        if (type === 'heroslot') {
            const slotIndex = heroslotTraits.findIndex(t => t.id === trait.id);
            const heroId = card.heroSlots?.[slotIndex] || (slotIndex === 0 ? card.assignedHeroId : null);

            if (trait.requirements && heroId) {
                const req = trait.requirements;
                if (req.skill && !SkillSystem.meetsRequirement(heroId, req)) {
                    missing.push(`${trait.title || 'Hero'}: ${req.skill} Lv.${req.skillRequirement || req.level}`);
                }
            }
        }

        // 2. Global Skill/Stat Requirements (Checks Primary Hero/Slot 0)
        const primaryHeroId = card.heroSlots?.[0] || card.assignedHeroId;

        if (type === 'skillrequirement' && primaryHeroId) {
            if (trait.skill && !SkillSystem.meetsRequirement(primaryHeroId, { skill: trait.skill, level: trait.level || 1 })) {
                missing.push(trait.title || `${trait.skill} Lv.${trait.level || 1}`);
            }
        }

        if (type === 'statrequirement' && primaryHeroId) {
            const heroData = HeroManager.getHero(primaryHeroId);
            if (trait.stat && heroData?.stats && (heroData.stats[trait.stat] || 0) < trait.value) {
                missing.push(trait.title || `${trait.stat} ${trait.value}+`);
            }
        }

        // 3. Input Slots (Now strictly assignment-based)
        if (type === 'inputslot') {
            const template = getCardTemplate(card.templateId);
            const isProject = !!template?.isProject;

            const inputsToCheck = trait.inputs || [trait];
            for (let i = 0; i < inputsToCheck.length; i++) {
                const reqTrait = inputsToCheck[i];
                const slotIndex = trait.inputs ? i : (trait.slotIndex ?? 0);
                const assignedItemId = card.assignedItems?.[slotIndex];
                
                // For Projects, we only need 1 in inventory/stack to BEGIN a cycle
                // For Tasks, we need the full quantity
                const totalRequired = reqTrait.quantity || 1;
                const quantityNeededToStart = isProject ? 1 : totalRequired;

                if (assignedItemId) {
                    // Validation: Does the assigned item actually match the slot requirement?
                    let isValid = false;
                    if (reqTrait.itemId) {
                        isValid = (assignedItemId === reqTrait.itemId);
                    } else if (reqTrait.acceptTag) {
                        const itemDef = getItem(assignedItemId);
                        isValid = !!(itemDef?.tags?.includes(reqTrait.acceptTag));
                    } else {
                        // Open slot with no specific requirement
                        isValid = true;
                    }

                    if (!isValid) {
                        missing.push(`Valid ${reqTrait.slotLabel || 'Item'}`);
                        continue;
                    }

                    // For Projects: If we already hit the total goal for this item, it's NOT a missing requirement
                    if (isProject) {
                        const currentFed = card.progress?.[assignedItemId] || 0;
                        if (currentFed >= totalRequired) {
                            continue; // This item goal is met
                        }
                    }

                    // Check if we have the quantity (Stack first, then Inventory)
                    const stackItemsOfThisType = card.stack?.filter(e => e.type === 'item' && e.id === assignedItemId).length || 0;
                    const remainingNeeded = quantityNeededToStart - stackItemsOfThisType;

                    if (remainingNeeded > 0) {
                        if (!InventoryManager.hasItem(assignedItemId, remainingNeeded)) {
                            const item = getItem(assignedItemId);
                            missing.push(`${item?.name || assignedItemId}`);
                        }
                    }
                } else {
                    // Projects can remain idle without assignment, Tasks cannot.
                    // But if it's a project and we haven't met all goals, it's "missing" an input to proceed.
                    // Wait, if we don't assign it, it's just idle.
                    if (!isProject) {
                        const reqLabel = reqTrait.itemId ? getItem(reqTrait.itemId)?.name : (reqTrait.slotLabel || reqTrait.acceptTag || 'Item');
                        missing.push(`${reqLabel}`);
                    }
                }
            }
        }

        // 4. Tool Slots
        if (type === 'toolslot') {
            const assignedToolId = card.assignedToolId;
            if (!assignedToolId) {
                missing.push(trait.toolType || 'Tool');
                continue;
            }

            const tool = getItem(assignedToolId);
            if (!tool) {
                missing.push(`Valid ${trait.toolType || 'Tool'}`);
                continue;
            }

            // Ensure tool exists in inventory and has durability
            if (!InventoryManager.hasItem(assignedToolId)) {
                missing.push(`${trait.toolType || 'Tool'} (Empty)`);
                continue;
            }

            // Tier requirement
            const minTier = trait.minTier || 0;
            if ((tool.tier || 0) < minTier) {
                missing.push(`${trait.toolType || 'Tool'} T${minTier}+`);
                continue;
            }

            // Type requirement
            if (trait.toolType && tool.toolType !== trait.toolType && !tool.tags?.includes(trait.toolType)) {
                missing.push(`Correct Tool Type`);
                continue;
            }
        }
    }

    return {
        met: missing.length === 0,
        missing: missing
    };
}

// Global Listener for Combat Quests
EventBus.subscribe('combat_victory', (data) => {
    const { cardId } = data;
    const card = CardManager.getCard(cardId);
    if (!card || !card.traits) return;

    const questTrait = card.traits.find(t => t.type === 'quest' && t.questType === 'combat');
    if (!questTrait) return;

    // Direct decrement for combat quests
    if (card.hordeCount !== undefined) {
        card.hordeCount--;
        EventBus.publish('quest_progress_updated', { cardId: card.id, hordeCount: card.hordeCount });

        if (card.hordeCount <= 0) {
            EventBus.publish('quest_completed', { cardId: card.id, questId: questTrait.id });
        }
    }
});

// Subscribe to effect pulses for immediate stat updates (UI reactivity)
EventBus.subscribe('effects_pulsed', () => {
    recalculateAllCardStats();
});

/**
 * Quest Module Processor
 * Handles higher-level progress (Quotas)
 */
function processQuest(card, trait, deltaTime) {
    if (trait.questType === 'collection') {
        // Implementation for gradual item delivery
        if (!card.questProgress) {
            const requirements = trait.requirements || {};
            card.questProgress = {
                inputProgress: GradualInputSystem.initInputProgress(requirements),
                requirements: requirements
            };
        }

        // Resolver for item slots
        const itemResolver = (key) => {
            const index = Object.keys(card.questProgress.requirements).indexOf(key);
            // Check heroslots for assigned items (legacy fallback) or new inputslots
            return card.assignedItems?.[index];
        };

        // If active, we don't do much here - the workcycle completion increments progress
        // But we update the status based on requirements
        const { met } = checkRequirements(card, HeroManager.getHero(card.assignedHeroId));
        if (!met && card.status !== 'paused') {
            // CardManager.setCardStatus(card.id, 'paused');
        }
    }
}

/**
 * Explore Selector Module Processor
 */
function processExploreSelector(card, trait, deltaTime) {
    // Selection logic is usually event-driven from UI, so no tick logic needed yet
}

/**
 * Handle collection progress increment (formerly in AreaSystem)
 * This should be called by the workcycle completion if a collection quest is active
 */
export function incrementCollectionProgress(card, amount = 1) {
    const questTrait = card.traits.find(t => t.type === 'quest' && t.questType === 'collection');
    if (!questTrait || !card.questProgress) return;

    const itemResolver = (key) => {
        const index = Object.keys(card.questProgress.requirements).indexOf(key);
        return card.assignedItems?.[index];
    };

    const result = GradualInputSystem.processGradualInputCycle(
        card.questProgress.inputProgress,
        card.questProgress.requirements,
        itemResolver,
        card.stack
    );

    // If stack was consumed, publish cards_updated
    if (Object.keys(result.consumed).length > 0) {
        bumpCardRev(card);
        EventBus.publish('cards_updated', { cardId: card.id, source: 'stack_consumed' });
    }

    logger.debug('ModuleProcessors', 'incrementCollectionProgress result:', result);

    EventBus.publish('quest_progress_updated', { cardId: card.id, progress: card.questProgress });

    if (result.complete) {
        logger.debug('ModuleProcessors', 'Quest COMPLETE for card:', card.id);
        EventBus.publish('quest_completed', { cardId: card.id, questId: questTrait.id });
    }
}
