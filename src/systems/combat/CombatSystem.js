// Fantasy Guild - Combat System
// Phase 31: Combat System

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { getEnemy } from '../../config/registries/enemyRegistry.js';
import { getCard as getCardTemplate, CARD_TYPES } from '../../config/registries/cardRegistry.js';
import { getBiome } from '../../config/registries/biomeRegistry.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import * as CardManager from '../cards/CardManager.js';
import * as HeroManager from '../hero/HeroManager.js';
import * as SkillSystem from '../hero/SkillSystem.js';
import * as CombatFormulas from '../../utils/CombatFormulas.js';
import * as EquipmentManager from '../equipment/EquipmentManager.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import * as NotificationSystem from '../core/NotificationSystem.js';
import { logger } from '../../utils/Logger.js';

/**
 * CombatSystem - Handles combat card tick processing
 * 
 * Combat Mechanics (from GDD):
 * - Fully automated once hero is assigned
 * - Hero and Enemy have independent tick cycles (simultaneous attacks)
 * - Hit chance: 50 + (AttackerSkill - DefenderSkill) * 2 (capped 5%-95%)
 * - Damage based on weapon (hero) or enemy stats
 * - Auto-consume food/drink when HP/Energy < 20% (skips attack that tick)
 * - Victory: Enemy HP = 0 → drops loot, card resets for repeat
 * - Defeat: Hero HP = 0 → enters Wounded state
 */

const CombatSystem = {
    /** Track if system is initialized */
    initialized: false,

    /**
     * Initialize the combat system
     */
    init() {
        if (this.initialized) return;
        this.initialized = true;
        logger.info('CombatSystem', 'Combat system initialized');
    },

    // tick() method removed - handled by CardSystem

    /**
     * Standard tick processor for CardSystem
     * @param {Object} card 
     * @param {number} deltaTime 
     */
    processTick(card, deltaTime) {
        this.processCombatTick(card, deltaTime);
    },

    /**
     * Process a single combat tick for a card
     * @param {Object} card - Combat card instance
     * @param {number} deltaTime - Time in milliseconds
     */
    processCombatTick(card, deltaTime) {
        const hero = HeroManager.getHero(card.assignedHeroId);
        if (!hero) {
            logger.warn('CombatSystem', `No hero found for combat card ${card.id}`);
            return;
        }

        // Check if hero is wounded
        if (hero.status === 'wounded') {
            // Unassign wounded hero from combat
            CardManager.unassignHero(card.id);
            return;
        }

        const enemy = getEnemy(card.enemyId);
        if (!enemy) {
            logger.warn('CombatSystem', `No enemy found: ${card.enemyId}`);
            return;
        }

        // Set hero status to combat if not already
        if (hero.status !== 'combat') {
            HeroManager.setHeroStatus(hero.id, 'combat');
            card.status = 'active';
        }

        // Get hero's equipped weapon
        const weapon = this.getHeroWeapon(hero);

        // Check for auto-consume (consumes tick if triggered)
        if (this.checkAndConsumeFood(card, hero)) {
            // Hero is eating/drinking, skip attack this tick
            card.combatState.isHeroConsuming = true;
            // Still advance enemy tick while hero consumes
            this.processEnemyTick(card, hero, enemy, deltaTime);
            return;
        }
        card.combatState.isHeroConsuming = false;

        // Get equipment bonuses
        const bonuses = EquipmentManager.getEquipmentBonuses(hero.id);

        // Advance hero tick progress
        card.heroTickProgress += deltaTime;
        const heroAttackSpeed = CombatFormulas.getHeroAttackSpeed(bonuses.tickSpeedBonus);

        // Hero attacks when tick completes
        if (card.heroTickProgress >= heroAttackSpeed) {
            const energyCost = enemy.energyCost ?? 2;

            if (hero.energy.current >= energyCost) {
                HeroManager.modifyHeroEnergy(hero.id, -energyCost);
                this.processHeroAttack(card, hero, enemy, weapon, bonuses);
                card.heroTickProgress = 0;

                // Check for victory
                if (card.enemyHp.current <= 0) {
                    this.handleVictory(card, hero, enemy);
                    return;
                }
            }
        }

        // Process enemy tick
        this.processEnemyTick(card, hero, enemy, deltaTime, bonuses);

        // Check for defeat
        if (hero.hp.current <= 0) {
            this.handleDefeat(card, hero, enemy);
            return;
        }

        // Publish tick event for UI updates
        EventBus.publish('combat_tick', {
            cardId: card.id,
            heroId: hero.id,
            enemyId: card.enemyId,
            heroHp: hero.hp,
            heroEnergy: hero.energy,
            enemyHp: card.enemyHp,
            heroProgress: card.heroTickProgress,
            enemyProgress: card.enemyTickProgress,
            heroAttackSpeed: heroAttackSpeed,
            enemyAttackSpeed: enemy.attackSpeed
        });
    },

    /**
     * Process hero's attack on enemy
     */
    /**
     * Process hero's attack on enemy
     */
    processHeroAttack(card, hero, enemy, weapon, bonuses = {}) {
        const selectedStyle = card.selectedStyle || 'melee';
        const heroSkill = CombatFormulas.getHeroCombatSkill(hero, selectedStyle);

        // Roll for hit
        const didHit = CombatFormulas.rollHit(heroSkill, enemy.defenceSkill);
        card.combatState.lastHeroHit = didHit;

        if (didHit) {
            // Calculate and apply damage
            const damage = CombatFormulas.computeHeroDamage(hero, enemy, weapon, bonuses.damage ?? 0, selectedStyle);
            card.enemyHp.current = Math.max(0, card.enemyHp.current - damage);
            card.combatState.lastHeroDamage = damage;

            logger.debug('CombatSystem', `Hero hits ${enemy.name} for ${damage} damage (${card.enemyHp.current}/${card.enemyHp.max} HP)`);

            EventBus.publish('combat_hero_attack', {
                cardId: card.id,
                heroId: hero.id,
                enemyId: enemy.id,
                damage,
                hit: true,
                enemyHpRemaining: card.enemyHp.current
            });
        } else {
            card.combatState.lastHeroDamage = 0;
            logger.debug('CombatSystem', `Hero misses ${enemy.name}`);

            EventBus.publish('combat_hero_attack', {
                cardId: card.id,
                heroId: hero.id,
                enemyId: enemy.id,
                damage: 0,
                hit: false,
                enemyHpRemaining: card.enemyHp.current
            });
        }

        // Award combat XP on attack (hit or miss) based on SELECTED STYLE
        SkillSystem.addXP(hero.id, selectedStyle, enemy.xpAwarded || 5);
    },

    /**
     * Process enemy's tick and attack
     */
    /**
     * Process enemy's tick and attack
     */
    processEnemyTick(card, hero, enemy, deltaTime, bonuses = {}) {
        card.enemyTickProgress += deltaTime;

        // Enemy attacks when tick completes
        if (card.enemyTickProgress >= enemy.attackSpeed) {
            this.processEnemyAttack(card, hero, enemy, bonuses);
            card.enemyTickProgress = 0;
        }
    },

    /**
     * Process enemy's attack on hero
     */
    processEnemyAttack(card, hero, enemy, bonuses = {}) {
        const heroDefenceSkill = (hero.skills?.defence?.level ?? 1) + (bonuses.defense ?? 0);
        const heroStyle = card.selectedStyle || 'melee';

        // Roll for hit
        const didHit = CombatFormulas.rollHit(enemy.attackSkill, heroDefenceSkill);
        card.combatState.lastEnemyHit = didHit;

        if (didHit) {
            // Calculate and apply damage
            const damage = CombatFormulas.computeEnemyDamage(enemy, heroDefenceSkill, heroStyle);
            HeroManager.modifyHeroHp(hero.id, -damage);
            card.combatState.lastEnemyDamage = damage;

            logger.debug('CombatSystem', `${enemy.name} hits hero for ${damage} damage (${hero.hp.current}/${hero.hp.max} HP)`);

            EventBus.publish('combat_enemy_attack', {
                cardId: card.id,
                heroId: hero.id,
                enemyId: enemy.id,
                damage,
                hit: true,
                heroHpRemaining: hero.hp.current
            });
        } else {
            card.combatState.lastEnemyDamage = 0;
            logger.debug('CombatSystem', `${enemy.name} misses hero`);

            EventBus.publish('combat_enemy_attack', {
                cardId: card.id,
                heroId: hero.id,
                enemyId: enemy.id,
                damage: 0,
                hit: false,
                heroHpRemaining: hero.hp.current
            });
        }

        // Award defence XP when enemy completes attack tick
        const xpAmount = enemy.xpAwarded || 5;
        const result = SkillSystem.addXP(hero.id, 'defence', xpAmount);

        if (result.success) {
            EventBus.publish('combat_xp_gained', {
                cardId: card.id,
                heroId: hero.id,
                skillId: 'defence',
                amount: xpAmount
            });
        } else {
            logger.warn('CombatSystem', `Failed to award defence XP: ${result.error}`);
        }
    },

    /**
     * Handle victory (enemy defeated)
     */
    handleVictory(card, hero, enemy) {
        logger.info('CombatSystem', `Victory! ${hero.name} defeated ${enemy.name}`);

        EventBus.publish('combat_victory', {
            cardId: card.id,
            heroId: hero.id,
            enemyId: enemy.id,
            enemyName: enemy.name,
            drops: enemy.drops,           // Inline drops (preferred)
            dropTableId: enemy.dropTableId // Legacy fallback
        });

        // Handle differently based on card type
        if (card.cardType === 'area') {
            // Area Card: Decrement enemy group, track progress
            this.handleAreaCardVictory(card, hero, enemy);
        } else {
            // Combat Card: Reset for repeat battles (card persists per user spec)
            CardManager.resetCombatCard(card.id);
        }

        // Hero status back to idle until next tick starts combat again
        HeroManager.setHeroStatus(hero.id, 'idle');
    },

    /**
     * Handle Area Card enemy defeat - track group progress
     */
    handleAreaCardVictory(card, hero, enemy) {
        const enemyGroups = card.enemyGroups || [];
        const currentGroupIndex = card.currentGroupIndex ?? 0;
        const currentGroup = enemyGroups[currentGroupIndex];

        if (!currentGroup) {
            logger.warn('CombatSystem', 'No current enemy group found for Area Card');
            return;
        }

        // Decrement remaining enemies in group
        currentGroup.remaining = (currentGroup.remaining ?? currentGroup.total) - 1;
        logger.info('CombatSystem', `Area enemy defeated! ${currentGroup.remaining} remaining in group`);

        // Check if group is complete
        if (currentGroup.remaining <= 0) {
            this.completeAreaEnemyGroup(card, currentGroup);
        } else {
            // Reset enemy HP for next enemy in group
            card.enemyHp = { current: enemy.hp, max: enemy.hp };
            card.heroTickProgress = 0;
            card.enemyTickProgress = 0;
        }

        EventBus.publish('cards_updated');
    },

    /**
     * Complete an enemy group - pause for player to claim task
     */
    completeAreaEnemyGroup(card, group) {
        const taskId = group.unlocksTask;

        // Set awaiting task claim state
        card.awaitingTaskClaim = true;
        card.pendingTaskClaim = {
            taskId: taskId,
            groupIndex: card.currentGroupIndex ?? 0
        };

        // Unassign hero so combat pauses
        const heroId = card.assignedHeroId;
        if (heroId) {
            HeroManager.setHeroStatus(heroId, 'idle');
        }

        EventBus.publish('area_group_complete', {
            cardId: card.id,
            taskId: taskId,
            groupIndex: card.currentGroupIndex
        });

        // Trigger UI re-render to show "Claim Task" state
        EventBus.publish('cards_updated');

        logger.info('CombatSystem', `Enemy group complete! Awaiting task claim: ${taskId}`);
    },



    /**
     * Handle defeat (hero HP = 0)
     */
    handleDefeat(card, hero, enemy) {
        logger.info('CombatSystem', `Defeat! ${hero.name} was defeated by ${enemy.name}`);

        // Unassign hero from combat card
        CardManager.unassignHero(card.id);

        // Set hero to wounded state (WoundedSystem will handle recovery)
        HeroManager.setHeroStatus(hero.id, 'wounded');

        // Reset combat card (enemy HP resets)
        CardManager.resetCombatCard(card.id);

        EventBus.publish('combat_defeat', {
            cardId: card.id,
            heroId: hero.id,
            heroName: hero.name,
            enemyId: enemy.id,
            enemyName: enemy.name
        });
    },

    /**
     * Check if hero needs food/drink and consume if available
     * @returns {boolean} True if consumed (skips attack)
     */
    checkAndConsumeFood(card, hero) {
        const { needsFood, needsDrink } = CombatFormulas.checkAutoConsume(hero);

        // Check food first (HP recovery)
        if (needsFood && hero.equipment?.food) {
            const itemId = hero.equipment.food;
            const foodItem = getItem(itemId);
            if (foodItem && foodItem.restoreAmount) {
                HeroManager.modifyHeroHp(hero.id, foodItem.restoreAmount);
                logger.debug('CombatSystem', `${hero.name} ate ${foodItem.name}, restored ${foodItem.restoreAmount} HP`);

                EventBus.publish('combat_consumed', {
                    heroId: hero.id,
                    itemId: foodItem.id,
                    restoreType: 'hp',
                    amount: foodItem.restoreAmount
                });

                // Consume food item from inventory
                InventoryManager.removeItem(foodItem.id, 1);
                // Check if depleted and unequip if necessary
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
                logger.debug('CombatSystem', `${hero.name} drank ${drinkItem.name}, restored ${drinkItem.restoreAmount} Energy`);

                EventBus.publish('combat_consumed', {
                    heroId: hero.id,
                    itemId: drinkItem.id,
                    restoreType: 'energy',
                    amount: drinkItem.restoreAmount
                });

                // Consume drink item from inventory
                InventoryManager.removeItem(drinkItem.id, 1);
                // Check if depleted and unequip if necessary
                EquipmentManager.validateEquipment(hero.id);

                return true;
            }
        }

        return false;
    },

    /**
     * Get hero's equipped weapon
     * @param {Object} hero 
     * @returns {Object|null} Weapon item template or null
     */
    getHeroWeapon(hero) {
        const weaponId = hero.equipment?.weapon;
        if (!weaponId) return null;
        return getItem(weaponId);
    },

    /**
     * Get all combat cards with assigned heroes
     * Includes Combat Cards AND Area Cards in questing phase
     * @returns {Array}
     */
    getActiveCombatCards() {
        if (!GameState.cards?.active) return [];
        return GameState.cards.active.filter(c => {
            if (!c.assignedHeroId) return false;

            // Regular combat cards
            if (c.cardType === CARD_TYPES.COMBAT) return true;

            // Area cards in questing phase
            if (c.cardType === 'area' && c.phase === 'questing') return true;

            return false;
        });
    },

    /**
     * Get all combat cards
     * @returns {Array}
     */
    getAllCombatCards() {
        if (!GameState.cards?.active) return [];
        return GameState.cards.active.filter(c => c.cardType === CARD_TYPES.COMBAT);
    }
};

export { CombatSystem };
