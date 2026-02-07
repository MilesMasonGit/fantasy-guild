// Fantasy Guild - Module Processors
// Handles the logic/ticks for individual modular traits

import * as CardManager from './CardManager.js';
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
import ExploreSystem from './ExploreSystem.js';
import { getBiome } from '../../config/registries/biomeRegistry.js';

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
            case 'exploreselector':
                processExploreSelector(card, trait, deltaTime);
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

    // 4. Calculate Speed Multiplier
    // Pilot Phase: Simplified skill bonus (0.5% per level)
    let multiplier = 1.0;
    const skill = trait.skill;
    if (skill && hero.skills[skill]) {
        const level = typeof hero.skills[skill] === 'number' ? hero.skills[skill] : (hero.skills[skill].level || 0);
        multiplier += (level * 0.005);
    }

    // Store current calculated time for UI
    card.currentTickTime = (card.baseTickTime || 10000) / multiplier;

    // 5. Increment Progress
    const cycleDuration = card.baseTickTime || 10000;
    const increment = deltaTime * multiplier;
    card.progress = (card.progress || 0) + increment;

    // 6. Completion
    if (card.progress >= cycleDuration) {
        completeWorkCycle(card, trait);
    }
}

/**
 * Handle completion of a work cycle
 */
function completeWorkCycle(card, trait) {
    logger.info('ModuleProcessors', `Work cycle complete: ${card.id}`);

    // Reset progress
    card.progress = 0;
    card.status = 'idle';

    // Link to Quest Module if it's a collection or project quest
    const questTrait = card.traits.find(t => t.type === 'quest' && (t.questType === 'collection' || t.questType === 'project'));
    if (questTrait) {
        incrementCollectionProgress(card);
    }

    const rewardTrait = card.traits.find(t => t.type.toLowerCase() === 'unifiedreward');
    if (rewardTrait) {
        applyUnifiedReward(card, rewardTrait);
    }

    // Grant outputs for Task cards (from loot trait or config.outputs)
    const lootTrait = card.traits.find(t => t.type === 'loot');
    const outputs = lootTrait?.items || card.config?.outputs || [];

    if (outputs.length > 0) {
        // First consume inputs (locked slots are just non-swappable, items still get consumed)
        const inputSlots = card.traits.filter(t => t.type === 'inputslot');
        for (let i = 0; i < inputSlots.length; i++) {
            const slot = inputSlots[i];
            const itemId = slot.itemId || card.assignedItems?.[i];
            const quantity = slot.quantity || 1;
            if (itemId && !slot.isTool) {
                InventoryManager.removeItem(itemId, quantity);
                logger.debug('ModuleProcessors', `Consumed ${quantity}x ${itemId}`);
            }
        }

        // Then grant outputs
        for (const output of outputs) {
            // Check drop chance
            if (output.chance && output.chance < 100) {
                if (Math.random() * 100 > output.chance) continue;
            }
            const quantity = output.quantity || 1;
            InventoryManager.addItem(output.itemId, quantity);
            logger.debug('ModuleProcessors', `Granted ${quantity}x ${output.itemId}`);
        }
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

        // Calculate attack speed
        const bonuses = EquipmentManager.getEquipmentBonuses(heroId);
        const selectedStyle = card.selectedStyle || 'melee';
        const heroSkillLevel = hero.skills?.[selectedStyle]?.level ?? 1;
        const attackSpeed = CombatFormulas.getHeroAttackSpeed(heroSkillLevel, bonuses.tickSpeedBonus);

        // Track stats for UI
        heroStatsForUi.push({
            id: hero.id,
            hp: hero.hp,
            energy: hero.energy,
            progress: card.heroTickProcesses[heroId],
            attackSpeed: attackSpeed
        });

        if (card.heroTickProcesses[heroId] >= attackSpeed) {
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
            const heroSkill = CombatFormulas.getHeroCombatSkill(hero, selectedStyle);
            const didHit = CombatFormulas.rollHit(heroSkill, enemy.defenceSkill);

            if (didHit) {
                const damage = CombatFormulas.computeHeroDamage(hero, enemy, weapon, bonuses.damage ?? 0, selectedStyle);
                card.enemyHp.current = Math.max(0, card.enemyHp.current - damage);

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

            // XP
            SkillSystem.addXP(heroId, selectedStyle, enemy.xpAwarded || 5);
            card.heroTickProcesses[heroId] = 0;

            // Victory check
            if (card.enemyHp.current <= 0) {
                const rewardTrait = card.traits.find(t => t.type.toLowerCase() === 'unifiedreward');
                if (rewardTrait) applyUnifiedReward(card, rewardTrait);

                // Reset card for next fight (modular combat persists)
                card.enemyHp = { current: enemy.hp, max: enemy.hp };
                card.heroTickProcesses = {};
                card.enemyTickProgress = 0;
                card.status = 'idle';

                // Reset hero statuses
                assignedHeroIds.forEach(id => HeroManager.setHeroStatus(id, 'idle'));

                EventBus.publish('combat_victory', {
                    cardId: card.id,
                    heroId: heroId,
                    enemyId: enemy.id,
                    enemyName: enemy.name,
                    drops: enemy.drops,
                    dropTableId: enemy.dropTableId
                });
                return;
            }
        }
    }

    // 2. Enemy Attacks
    card.enemyTickProgress += deltaTime;
    const enemyAttackSpeed = enemy.attackSpeed || 3000;
    if (card.enemyTickProgress >= enemyAttackSpeed) {
        const targetHeroId = assignedHeroIds[Math.floor(Math.random() * assignedHeroIds.length)];
        const targetHero = HeroManager.getHero(targetHeroId);

        if (targetHero && targetHero.status !== 'wounded') {
            const bonuses = EquipmentManager.getEquipmentBonuses(targetHeroId);
            const heroDefenceSkill = (targetHero.skills?.defence?.level ?? 1) + (bonuses.defense ?? 0);
            const didHit = CombatFormulas.rollHit(enemy.attackSkill, heroDefenceSkill);

            if (didHit) {
                const heroStyle = card.selectedStyle || 'melee';
                const damage = CombatFormulas.computeEnemyDamage(enemy, heroDefenceSkill, heroStyle);
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

            SkillSystem.addXP(targetHeroId, 'defence', enemy.xpAwarded || 5);
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

    // 1. Grant XP
    if (trait.xp > 0 && heroId) {
        const xpTrait = card.traits.find(t => t.type === 'workcycle')?.skill;
        if (xpTrait) {
            SkillSystem.addXP(heroId, xpTrait, trait.xp);
        }
    }

    // 2. Grant Items
    if (trait.items && trait.items.length > 0) {
        for (const item of trait.items) {
            InventoryManager.addItem(item.id, item.amount);
        }
    }

    // 3. Handle late consumption (Pilot phase: simple)
    // Consume inputs from workcycle if any
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
                    missing.push(`${trait.title || 'Hero'}: ${req.skill} Lv.${req.skillRequirement}`);
                }
            }
        }

        // 2. Global Skill/Stat Requirements (Checks Primary Hero/Slot 0)
        const primaryHeroId = card.heroSlots?.[0] || card.assignedHeroId;

        if (type === 'skillrequirement' && primaryHeroId) {
            const req = trait.requirement;
            if (req && !SkillSystem.meetsRequirement(primaryHeroId, req)) {
                missing.push(trait.title || `${req.skill} Lv.${req.level}`);
            }
        }

        if (type === 'statrequirement' && primaryHeroId) {
            const heroData = HeroManager.getHero(primaryHeroId);
            const req = trait.requirement;
            if (req && heroData?.stats && (heroData.stats[req.stat] || 0) < req.value) {
                missing.push(trait.title || `${req.stat} ${req.value}+`);
            }
        }

        // 3. Input Slots (locked just means non-swappable, not blocked)
        if (type === 'inputslot') {
            const itemId = trait.itemId || card.assignedItems?.[trait.slotIndex || 0];
            const quantity = trait.quantity || 1;

            if (!itemId || !InventoryManager.hasItem(itemId, quantity)) {
                const item = itemId ? getItem(itemId) : null;
                missing.push(item?.name || trait.title || trait.slotLabel || 'Required Item');
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
        itemResolver
    );

    logger.debug('ModuleProcessors', 'incrementCollectionProgress result:', result);

    EventBus.publish('quest_progress_updated', { cardId: card.id, progress: card.questProgress });

    if (result.complete) {
        logger.debug('ModuleProcessors', 'Quest COMPLETE for card:', card.id);
        EventBus.publish('quest_completed', { cardId: card.id, questId: questTrait.id });

        // For explore cards, trigger discovery
        if (card.cardType === 'explore' && card.selectedBiomeId) {
            logger.debug('ModuleProcessors', 'Calling ExploreSystem.completeExploration...');
            ExploreSystem.completeExploration(card, card.selectedBiomeId);
        }
    }
}
