// Fantasy Guild - Area System (Reworked)
// Fantasy Guild - Area System (Reworked)
// Phase 25b: Built-in Combat Questing + Project Chain

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import * as CardManager from '../cards/CardManager.js';
import * as HeroManager from '../hero/HeroManager.js';
import * as NotificationSystem from '../core/NotificationSystem.js';
import { CurrencyManager } from '../economy/CurrencyManager.js';
import { RecruitSystem } from './RecruitSystem.js';
import { getCard, getAllCards } from '../../config/registries/cardRegistry.js'; // Added this import
import { CARD_TYPES, getEnemy, getBiome, getItem } from '../../config/registries/index.js'; // Modified this import
import { getProject } from '../../config/registries/projectRegistry.js';
import { getRegion, getRegionBiomes } from '../../config/registries/regionRegistry.js';
import { logger } from '../../utils/Logger.js';
import { WORK_CYCLE_DURATION } from '../../config/constants.js';
import * as EquipmentManager from '../equipment/EquipmentManager.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import { isModular } from './CardAssembler.js';
import * as CombatFormulas from '../../utils/CombatFormulas.js';
import * as GradualInputSystem from '../exploration/GradualInputSystem.js';
import * as SkillSystem from '../hero/SkillSystem.js';

const AreaSystem = {
    /** Track if system is initialized */
    initialized: false,

    /**
     * Initialize the area system
     */
    init() {
        if (this.initialized) return;
        this.initialized = true;
        logger.info('AreaSystem', 'Initialized (Modular Connection)');

        // Listen for modular quest completion
        EventBus.subscribe('quest_completed', (data) => {
            const card = CardManager.getCard(data.cardId);
            if (card && card.cardType === 'area') {
                this.handleQuestCompleted(card, data.questId);
            }
        });

        // Listen for modular cycle completion (for projects)
        EventBus.subscribe('module_cycle_complete', (data) => {
            const card = CardManager.getCard(data.cardId);
            if (card && card.cardType === 'area' && card.phase === 'projects') {
                // If it's a project cycle, we might need to handle gradual consumption
                // Actually, incrementCollectionProgress already called from ModuleProcessors
            }
        });
    },

    /**
     * Standard tick processor for CardSystem
     * @param {Object} card 
     * @param {number} deltaTime 
     */
    processTick(card, deltaTime) {
        if (!card.assignedHeroId) return;
        if (isModular(card)) return; // Handled by ModuleProcessors
        const hero = HeroManager.getHero(card.assignedHeroId);
        if (!hero) return;

        this.processAreaCard(card, hero, deltaTime);
    },

    /**
     * Process a single Area Card based on its current phase (Questing -> Projects -> Complete).
     * 
     * @param {Object} cardInstance - The area card data object
     * @param {Object} hero - The hero assigned to this card
     * @param {number} deltaTime - Time in seconds since last tick
     */
    processAreaCard(cardInstance, hero, deltaTime) {
        // Route to appropriate phase handler
        switch (cardInstance.phase) {
            case 'questing':
                this.processQuestingPhase(cardInstance, hero, deltaTime);
                break;
            case 'projects':
                this.processProjectsPhase(cardInstance, hero, deltaTime);
                break;
            case 'complete':
                // No processing needed
                break;
        }
    },

    // ========================================
    // QUESTING PHASE - Built-in Combat
    // ========================================

    /**
     * Process questing phase - fight enemies to unlock tasks
     * @param {Object} cardInstance 
     * @param {Object} hero 
     * @param {number} deltaTime - in milliseconds
     */
    processQuestingPhase(cardInstance, hero, deltaTime) {
        const deltaMs = deltaTime;

        // Check if waiting for claim - PAUSE PROCESSING
        if (cardInstance.awaitingTaskClaim) {
            return;
        }

        // Ensure modular traits are initialized for consistent UI (LootModule visibility)
        if (!cardInstance.traits) {
            this.updateModularTraitsForPhase(cardInstance);
        }

        // Get current enemy group
        const enemyGroups = cardInstance.enemyGroups || [];
        const currentGroup = enemyGroups[cardInstance.currentGroupIndex];

        if (!currentGroup || currentGroup.remaining <= 0) {
            // No more enemies in this group or no groups - advance
            this.advanceToNextGroup(cardInstance);
            return;
        }

        // Dispatch based on quest type
        // Default to 'combat' for backwards compatibility
        const questType = currentGroup.type || 'combat';

        if (questType === 'combat') {
            // Initialize combat state if not active or corrupt (missing enemyId)
            if (!cardInstance.combatState?.active || !cardInstance.enemyId) {
                this.initCombatForGroup(cardInstance, currentGroup);
            }

            // Ensure hero is in combat state
            if (hero.status !== 'combat') {
                HeroManager.setHeroStatus(hero.id, 'combat');
            }

            // Process combat tick
            this.processCombatTick(cardInstance, hero, deltaMs);

        } else if (questType === 'collection') {
            this.processCollectionQuest(cardInstance, hero, deltaTime, currentGroup);
        }
    },

    /**
     * Process a collection quest tick
     * @param {Object} cardInstance 
     * @param {Object} hero 
     * @param {number} deltaTime 
     * @param {Object} questGroup 
     */
    processCollectionQuest(cardInstance, hero, deltaTime, questGroup) {
        // Initialize quest progress if needed
        if (!cardInstance.questProgress) {
            this.initCollectionQuest(cardInstance, questGroup);
        }

        // Check if we can make progress
        const itemResolver = (key) => {
            const index = Object.keys(cardInstance.questProgress.requirements).indexOf(key);
            return cardInstance.assignedItems?.[index];
        };

        if (!GradualInputSystem.canMakeProgress(
            cardInstance.questProgress.inputProgress,
            cardInstance.questProgress.requirements,
            itemResolver,
            cardInstance.stack
        )) {
            if (cardInstance.status !== 'paused') {
                cardInstance.status = 'paused';
                EventBus.publish('cards_updated');
            }
            return;
        }

        cardInstance.status = 'active';

        // Accumulate time for cycle
        cardInstance.cycleProgress = (cardInstance.cycleProgress || 0) + deltaTime;

        if (cardInstance.cycleProgress >= WORK_CYCLE_DURATION) {
            cardInstance.cycleProgress -= WORK_CYCLE_DURATION;

            // Consume energy
            if (hero.energy.current >= 1) {
                HeroManager.modifyHeroEnergy(hero.id, -1);
            } else {
                return;
            }

            // Process gradual consumption
            const result = GradualInputSystem.processGradualInputCycle(
                cardInstance.questProgress.inputProgress,
                cardInstance.questProgress.requirements,
                itemResolver,
                cardInstance.stack
            );

            EventBus.publish('quest_progress', {
                cardId: cardInstance.id,
                inputProgress: cardInstance.questProgress.inputProgress
            });

            if (Object.keys(result.consumed).length > 0) {
                EventBus.publish('cards_updated', { source: 'collection_stack_consumed' });
            }

            if (result.complete) {
                this.completeCollectionQuest(cardInstance, questGroup);
            }
        }
    },

    /**
     * Initialize progress for a collection quest
     */
    initCollectionQuest(cardInstance, questGroup) {
        const requirements = questGroup.requirements || {};
        cardInstance.questProgress = {
            inputProgress: GradualInputSystem.initInputProgress(requirements),
            requirements: requirements
        };
        cardInstance.status = 'idle';
    },

    /**
     * Complete a collection quest
     */
    completeCollectionQuest(cardInstance, questGroup) {
        logger.info('AreaSystem', `Collection quest complete: ${questGroup.name} `);

        // Reset progress
        cardInstance.questProgress = null;

        // Treat like defeating an enemy group
        this.completeEnemyGroup(cardInstance, questGroup);
    },

    /**
     * Initialize combat state for a new enemy
     * @param {Object} cardInstance 
     * @param {Object} enemyGroup 
     */
    initCombatForGroup(cardInstance, enemyGroup) {
        const enemy = getEnemy(enemyGroup.enemyId);
        if (!enemy) {
            logger.warn('AreaSystem', `Unknown enemy: ${enemyGroup.enemyId} `);
            return;
        }

        cardInstance.enemyId = enemyGroup.enemyId;
        cardInstance.enemyHp = {
            current: enemy.hp,
            max: enemy.hp
        };
        cardInstance.heroTickProgress = 0;
        cardInstance.enemyTickProgress = 0;
        cardInstance.combatState = {
            active: true,
            lastHeroHit: false,
            lastHeroDamage: 0,
            lastEnemyHit: false,
            lastEnemyDamage: 0
        };
        cardInstance.status = 'active';

        logger.debug('AreaSystem', `Started combat with ${enemy.name} (${enemyGroup.remaining}/${enemyGroup.total} remaining)`);
    },

    /**
     * Process a single combat tick
     * Reuses logic from CombatSystem
     * @param {Object} card 
     * @param {Object} hero 
     * @param {number} deltaMs 
     */
    processCombatTick(card, hero, deltaMs) {
        const enemy = getEnemy(card.enemyId);
        if (!enemy) return;

        // Get hero weapon
        const weaponId = hero.equipment?.weapon;
        const weapon = weaponId ? getItem(weaponId) : null;

        // Get equipment bonuses
        const bonuses = EquipmentManager.getEquipmentBonuses(hero.id);

        // Hero attack processing
        card.heroTickProgress = (card.heroTickProgress || 0) + deltaMs;
        const heroAttackSpeed = CombatFormulas.getHeroAttackSpeed(bonuses.tickSpeedBonus || 0);

        if (card.heroTickProgress >= heroAttackSpeed) {
            const energyCost = enemy.energyCost ?? 2;

            if (hero.energy.current >= energyCost) {
                HeroManager.modifyHeroEnergy(hero.id, -energyCost);
                this.processHeroAttack(card, hero, enemy, weapon, bonuses);
                card.heroTickProgress = 0;

                // Check for victory
                if (card.enemyHp.current <= 0) {
                    this.handleCombatVictory(card, hero, enemy);
                    return;
                }
            }
        }

        // Enemy attack processing
        card.enemyTickProgress = (card.enemyTickProgress || 0) + deltaMs;

        if (card.enemyTickProgress >= enemy.attackSpeed) {
            this.processEnemyAttack(card, hero, enemy, bonuses);
            card.enemyTickProgress = 0;

            // Check for defeat
            if (hero.hp.current <= 0) {
                this.handleCombatDefeat(card, hero, enemy);
                return;
            }
        }

        // Publish combat tick event for UI
        EventBus.publish('area_combat_tick', {
            cardId: card.id,
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
    processHeroAttack(card, hero, enemy, weapon, bonuses) {
        const heroSkill = CombatFormulas.getHeroCombatSkill(hero, weapon);
        const didHit = CombatFormulas.rollHit(heroSkill, enemy.defenceSkill);
        card.combatState.lastHeroHit = didHit;

        if (didHit) {
            const damage = CombatFormulas.computeHeroDamage(hero, enemy, weapon, bonuses.damage ?? 0);
            card.enemyHp.current = Math.max(0, card.enemyHp.current - damage);
            card.combatState.lastHeroDamage = damage;
        } else {
            card.combatState.lastHeroDamage = 0;
        }

        EventBus.publish('combat_hero_attack', {
            cardId: card.id,
            damage: card.combatState.lastHeroDamage,
            hit: didHit
        });

        // Award combat XP on attack (hit or miss) based on SELECTED STYLE
        const selectedStyle = card.selectedStyle || 'melee';
        const xpAmount = enemy.xpAwarded || 5;
        SkillSystem.addXP(hero.id, selectedStyle, xpAmount);
    },

    /**
     * Process enemy's attack on hero
     */
    processEnemyAttack(card, hero, enemy, bonuses) {
        const heroDefenceSkill = (hero.skills?.defence?.level ?? 1) + (bonuses.defense ?? 0);
        const didHit = CombatFormulas.rollHit(enemy.attackSkill, heroDefenceSkill);
        card.combatState.lastEnemyHit = didHit;

        if (didHit) {
            const damage = CombatFormulas.computeEnemyDamage(enemy, heroDefenceSkill);
            HeroManager.modifyHeroHp(hero.id, -damage);
            card.combatState.lastEnemyDamage = damage;
        } else {
            card.combatState.lastEnemyDamage = 0;
        }

        EventBus.publish('combat_enemy_attack', {
            cardId: card.id,
            damage: card.combatState.lastEnemyDamage,
            hit: didHit
        });

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
        }
    },

    /**
     * Handle victory - enemy defeated
     */
    handleCombatVictory(card, hero, enemy) {
        const enemyGroups = card.enemyGroups;
        const currentGroup = enemyGroups[card.currentGroupIndex];

        // Decrement remaining enemies
        currentGroup.remaining--;

        logger.info('AreaSystem', `Enemy defeated! ${currentGroup.remaining}/${currentGroup.total} remaining`);

        // Reset combat state for next enemy
        card.combatState.active = false;

        // Drop loot from enemy (if any)
        if (enemy.drops) {
            this.processEnemyDrops(enemy.drops);
        }

        EventBus.publish('area_enemy_defeated', {
            cardId: card.id,
            enemyId: enemy.id,
            remaining: currentGroup.remaining
        });

        EventBus.publish('cards_updated');

        // Check if group is completely defeated
        if (currentGroup.remaining <= 0) {
            this.completeEnemyGroup(card, currentGroup);
        } else if (card.traits) {
            // Update modular quest count if present
            card.hordeCount = currentGroup.remaining;
        }

        // Reset hero status
        HeroManager.setHeroStatus(hero.id, 'idle');
    },

    /**
     * Handle defeat - hero HP = 0
     */
    handleCombatDefeat(card, hero, enemy) {
        logger.info('AreaSystem', `Hero ${hero.name} defeated by ${enemy.name}`);

        // Unassign hero and set wounded
        CardManager.unassignHero(card.id);
        HeroManager.setHeroStatus(hero.id, 'wounded');

        // Reset combat state but keep progress
        card.combatState.active = false;

        EventBus.publish('area_combat_defeat', {
            cardId: card.id,
            heroId: hero.id,
            enemyId: enemy.id
        });
    },

    /**
     * Process enemy loot drops
     */
    processEnemyDrops(drops) {
        for (const drop of drops) {
            if (Math.random() <= (drop.chance || 1)) {
                InventoryManager.addItem(drop.itemId, drop.quantity || 1);
            }
        }
    },

    /**
     * Complete an enemy group - spawn task card
     */
    /**
     * Complete an enemy group - pause for player to claim task
     */
    completeEnemyGroup(card, group) {
        const taskId = group.unlocksTask;

        // Set awaiting task claim state
        card.awaitingTaskClaim = true;
        card.pendingTaskClaim = {
            taskId: taskId,
            groupIndex: card.currentGroupIndex,
            rewards: group.rewards || [],
            xpRewards: group.xpRewards || [],
            unlocksExplore: group.unlocksExplore || null
        };

        // Ensure reward trait exists (for backwards compatibility with older cards)
        // Insert after description trait for correct positioning
        if (card.traits && !card.traits.find(t => t.type === 'reward')) {
            const descIndex = card.traits.findIndex(t => t.type === 'description');
            if (descIndex !== -1) {
                card.traits.splice(descIndex + 1, 0, { id: 'reward', type: 'reward' });
            } else {
                card.traits.push({ id: 'reward', type: 'reward' });
            }
        }

        // Unassign hero so combat pauses
        const heroId = card.assignedHeroId;
        if (heroId) {
            HeroManager.setHeroStatus(heroId, 'idle');
            // Notify card manager to update hero assignment state if needed
            // But CardManager.unassignHero does more cleanup, so maybe use that?
            // Actually, just setting status to idle is enough for the System, 
            // but the Card UI needs to reflect it. 
            // safely unassign:
            CardManager.unassignHero(card.id);
        }

        EventBus.publish('area_group_complete', {
            cardId: card.id,
            taskId: taskId,
            groupIndex: card.currentGroupIndex
        });

        // Trigger UI re-render to show "Claim Task" state
        EventBus.publish('cards_updated');

        logger.info('AreaSystem', `Enemy group complete! Awaiting task claim: ${taskId}`);
    },

    /**
     * Claim the unlocked task and advance
     * @param {string} cardId 
     */
    claimAreaTask(cardId) {
        const card = CardManager.getCard(cardId);
        if (!card || !card.awaitingTaskClaim) {
            logger.warn('AreaSystem', `Cannot claim task for card: ${cardId}`);
            return { success: false, error: 'No task to claim' };
        }

        const taskId = card.pendingTaskClaim?.taskId;

        if (!card.unlockedTasks) {
            card.unlockedTasks = [];
        }

        if (taskId && !card.unlockedTasks.includes(taskId)) {
            // Spawn the task card
            CardManager.createCard(taskId, {
                overrides: {
                    biomeId: card.biomeId,
                    regionId: card.regionId
                }
            });

            card.unlockedTasks.push(taskId);

            const taskTemplate = getCard(taskId);
            NotificationSystem.success(`Task claimed: ${taskTemplate?.name || taskId}!`);

            EventBus.publish('task_unlocked', {
                cardId: card.id,
                taskId: taskId
            });
        }

        // Grant item rewards
        const rewards = card.pendingTaskClaim?.rewards || [];
        rewards.forEach(reward => {
            InventoryManager.addItem(reward.itemId, reward.count || 1);
            const item = getItem(reward.itemId);
            NotificationSystem.success(`Reward: ${reward.count || 1}x ${item?.name || reward.itemId}`);
        });

        // Grant XP rewards to ALL heroes
        const xpRewards = card.pendingTaskClaim?.xpRewards || [];
        if (xpRewards.length > 0 && GameState.heroes.length > 0) {
            xpRewards.forEach(xpReward => {
                let totalXpGiven = 0;
                GameState.heroes.forEach(hero => {
                    SkillSystem.addXP(hero.id, xpReward.skill, xpReward.amount);
                    totalXpGiven += xpReward.amount;
                });
                NotificationSystem.success(`Party gained ${xpReward.amount} ${xpReward.skill} XP!`);
            });
        }

        // Spawn explore card if unlocksExplore is specified
        // unlocksExplore should be the explore card ID (e.g., 'explore_sunny_valley')
        const unlocksExplore = card.pendingTaskClaim?.unlocksExplore;
        if (unlocksExplore) {
            // Use the explore card template ID directly
            const exploreCardId = `explore_${unlocksExplore}`;
            CardManager.createCard(exploreCardId);

            const regionId = unlocksExplore;
            const region = getRegion(regionId);
            if (region) {
                NotificationSystem.success(`New region available: ${region.name}!`);
            }
        }

        // Clear claim state
        card.awaitingTaskClaim = false;
        card.pendingTaskClaim = null;

        // Advance to next group
        this.advanceToNextGroup(card);

        EventBus.publish('cards_updated');
        return { success: true };
    },

    /**
     * PHASE 4: THE DRAW MECHANIC
     * Instantly draws a card from the Area Deck onto the board.
     * Costs Gold, which escalates over time.
     * @param {string} cardId - The Area Hub card ID
     */
    drawCard(cardId) {
        const areaCard = CardManager.getCard(cardId);
        if (!areaCard || areaCard.cardType !== 'area') {
            return { success: false, error: 'Invalid card or not an Area' };
        }

        // 1. Check if deck is depleted
        if (!areaCard.deck || areaCard.deck.length === 0) {
            NotificationSystem.notify('This Area Deck is fully depleted!', 'error');
            return { success: false, error: 'DECK_DEPLETED' };
        }

        // 2. Validate and deduct Gold cost
        // Formula: BaseCost * CardsDrawnFromThisDeck * (1 + (TotalCardsDrawnOverall * 0.01))
        const baseCost = areaCard.drawCost || 0;
        let cost = 0;

        if (baseCost > 0) {
            const cardsDrawnHere = areaCard.cardsDrawn || 0;
            const globalCardsDrawn = GameState.exploration?.totalCardsDrawn || 0;
            cost = Math.floor(baseCost * cardsDrawnHere * (1 + (globalCardsDrawn * 0.01)));
        }

        if (cost > 0) {
            const hasGold = CurrencyManager.getCurrency('gold') >= cost;
            if (!hasGold) {
                NotificationSystem.notify(`Not enough Gold! Need ${cost}g.`, 'error');
                return { success: false, error: 'INSUFFICIENT_GOLD' };
            }
            CurrencyManager.addCurrency('gold', -cost);
        }

        // 3. Determine what to draw
        const drawnCardId = areaCard.deck.shift();

        // 4. Spawn the card if one was selected
        if (drawnCardId) {
            console.error('DEBUG: Total cards in registry:', Object.keys(getAllCards()).length); // Updated this line
            console.error('DEBUG: Attempting to spawn:', drawnCardId);

            const createResult = CardManager.createCard(drawnCardId, {
                overrides: {
                    biomeId: areaCard.biomeId,
                    regionId: areaCard.regionId
                }
            });

            if (createResult.success) {
                const template = getCard(drawnCardId);
                NotificationSystem.success(`Drawn: ${template?.name || drawnCardId}`);
            } else {
                // Put it back in the deck
                areaCard.deck.unshift(drawnCardId);
                // Refund gold
                if (cost > 0) CurrencyManager.addCurrency('gold', cost);

                NotificationSystem.notify(`Could not draw: ${createResult.error}`, 'error');
                return { success: false, error: createResult.error };
            }
        } else {
            // Failed to find anything to draw, refund and abort
            if (cost > 0) CurrencyManager.addCurrency('gold', cost);
            NotificationSystem.notify('The deck yielded nothing useful.', 'error');
            return { success: false, error: 'NO_VALID_DRAW' };
        }

        // 5. Escalation & Progress
        areaCard.cardsDrawn = (areaCard.cardsDrawn || 0) + 1;

        if (!GameState.exploration) GameState.exploration = {};
        GameState.exploration.totalCardsDrawn = (GameState.exploration.totalCardsDrawn || 0) + 1;

        // Check for depletion
        if (areaCard.deck.length === 0) {
            this.transitionToProjectsPhase(areaCard);
        }

        EventBus.publish('cards_updated');
        return { success: true };
    },

    /**
     * Helper to select a random task from a biome's taskPool based on weights
     */
    rollRandomTaskFromPool(biome) {
        if (!biome || !biome.taskPool || biome.taskPool.length === 0) {
            return null; // No tasks defined
        }

        // Sum weights
        const totalWeight = biome.taskPool.reduce((sum, task) => sum + (task.weight || 10), 0);
        let roll = Math.random() * totalWeight;

        for (const task of biome.taskPool) {
            const weight = task.weight || 10;
            if (roll < weight) {
                return task.taskId;
            }
            roll -= weight;
        }

        // Fallback to first
        return biome.taskPool[0].taskId;
    },

    /**
     * Advance to next enemy group or transition to projects
     */
    advanceToNextGroup(card) {
        card.currentGroupIndex++;

        if (card.currentGroupIndex >= card.enemyGroups.length) {
            // All groups defeated - transition to projects phase
            this.transitionToProjectsPhase(card);
        } else {
            // More groups to fight
            const nextGroup = card.enemyGroups[card.currentGroupIndex];
            const enemy = getEnemy(nextGroup.enemyId);

            // Reset combat state for new enemy
            card.hordeCount = nextGroup.count || 1;
            card.enemyId = nextGroup.enemyId;
            card.combatState = null;
            card.enemyHp = null;

            // Update traits to reflect new enemy
            this.updateModularTraitsForPhase(card);

            NotificationSystem.notify(`Next challenge: ${nextGroup.count || 1} ${enemy?.name || 'enemies'}`, 'info');
        }
    },

    /**
     * Transition from questing to projects phase
     */
    transitionToProjectsPhase(card) {
        card.phase = 'projects';
        card.combatState = { active: false };
        card.status = 'idle';

        // Initialize first project progress
        this.initProjectProgress(card);

        const biome = getBiome(card.biomeId);
        NotificationSystem.success(`All tasks unlocked in ${biome?.name}! Starting projects.`);

        EventBus.publish('area_phase_changed', {
            cardId: card.id,
            phase: 'projects'
        });

        EventBus.publish('cards_updated');

        // Swap traits for projects
        this.updateModularTraitsForPhase(card);
    },

    /**
     * Handle quest completion from modular system
     */
    handleQuestCompleted(card, questId) {
        const enemyGroups = card.enemyGroups || [];
        const currentGroup = enemyGroups[card.currentGroupIndex];

        if (!currentGroup) return;

        logger.info('AreaSystem', `Modular quest complete: ${questId}`);
        this.completeEnemyGroup(card, currentGroup);
    },

    /**
     * Update card traits based on current phase/group
     */
    updateModularTraitsForPhase(card) {
        // Removed guard clause: was preventing trait initialization for first quest

        if (card.phase === 'questing') {
            const group = card.enemyGroups[card.currentGroupIndex];
            const type = group.type || 'combat';

            if (type === 'combat') {
                const enemy = getEnemy(group.enemyId);
                card.traits = [
                    { id: 'header', type: 'header' },
                    { id: 'desc', type: 'description' },
                    { id: 'reward', type: 'reward' },
                    { id: 'hero', type: 'heroslot', title: 'Hero' },
                    { id: 'combat_logic', type: 'combat', enemyId: group.enemyId },
                    { id: 'quest_progress', type: 'quest', questType: 'combat', count: group.total },
                    { id: 'loot', type: 'loot', enemyId: group.enemyId }
                ];
                card.hordeCount = group.remaining;
            } else if (type === 'collection') {
                // Build input slots from requirements
                const inputSlots = Object.entries(group.requirements || {}).map(([key, qty], idx) => ({
                    id: `input_${idx}`,
                    type: 'inputslot',
                    itemId: key.startsWith('tag:') ? null : key,
                    acceptTag: key.startsWith('tag:') ? key.slice(4) : null,
                    quantity: 1,
                    locked: true,
                    slotLabel: key.startsWith('tag:') ? `Any ${key.slice(4)}` : null
                }));

                card.traits = [
                    { id: 'header', type: 'header' },
                    { id: 'desc', type: 'description' },
                    { id: 'hero', type: 'heroslot', title: 'Hero' },
                    ...inputSlots,
                    { id: 'work_module', type: 'workcycle', skill: group.skill || 'nature', actionLabel: 'Gathering...' },
                    { id: 'quest_progress', type: 'quest', questType: 'collection', requirements: group.requirements }
                ];
                // Ensure questProgress is initialized
                if (!card.questProgress) {
                    this.initCollectionQuest(card, group);
                }
            }
        } else if (card.phase === 'projects') {
            const projectChain = card.projectChain || [];
            const projectId = projectChain[card.currentProjectIndex];
            const project = getProject(projectId);

            // Build input slots from project resource cost
            const projectInputSlots = Object.entries(project.resourceCost || {}).map(([itemId, qty], idx) => ({
                id: `input_${idx}`,
                type: 'inputslot',
                itemId: itemId,
                quantity: 1,
                locked: true
            }));

            card.traits = [
                { id: 'header', type: 'header' },
                { id: 'desc', type: 'description' },
                { id: 'hero', type: 'heroslot', title: 'Hero' },
                ...projectInputSlots,
                { id: 'work_module', type: 'workcycle', skill: 'industry', actionLabel: 'Building...' },
                { id: 'quest_progress', type: 'quest', questType: 'project', requirements: project.resourceCost },
                { id: 'project_info', type: 'projectpanel' }
            ];

            // Ensure progress is initialized
            if (!card.projectProgress) {
                this.initProjectProgress(card);
            }
            // Sync questProgress with projectProgress for modular rendering
            card.questProgress = card.projectProgress;
        } else if (card.phase === 'complete') {
            card.traits = [
                { id: 'header', type: 'header' },
                { id: 'desc', type: 'description' }
            ];
        }

        EventBus.publish('cards_updated');
    },

    // ========================================
    // PROJECTS PHASE - Gradual Resource Consumption
    // ========================================

    /**
     * Process projects phase - consume resources to complete projects
     * @param {Object} cardInstance 
     * @param {Object} hero 
     * @param {number} deltaTime 
     */
    processProjectsPhase(cardInstance, hero, deltaTime) {
        // Check if projects are available
        if (!cardInstance.projectChain || cardInstance.projectChain.length === 0) {
            this.completeAreaCard(cardInstance);
            return;
        }

        const projectId = cardInstance.projectChain[cardInstance.currentProjectIndex];
        if (!projectId) {
            // All projects complete
            this.completeAreaCard(cardInstance);
            return;
        }

        const project = getProject(projectId);
        if (!project) {
            logger.warn('AreaSystem', `Unknown project: ${projectId}`);
            cardInstance.currentProjectIndex++;
            return;
        }

        // Initialize project progress if needed
        if (!cardInstance.projectProgress) {
            this.initProjectProgress(cardInstance);
        }

        // Check if we can make progress
        if (!GradualInputSystem.canMakeProgress(cardInstance.projectProgress.inputProgress, cardInstance.projectProgress.requirements, null, cardInstance.stack)) {
            if (cardInstance.status !== 'paused') {
                cardInstance.status = 'paused';
                EventBus.publish('cards_updated');
            }
            return;
        }

        cardInstance.status = 'active';

        // Accumulate time for cycle
        cardInstance.cycleProgress = (cardInstance.cycleProgress || 0) + deltaTime;

        if (cardInstance.cycleProgress >= WORK_CYCLE_DURATION) {
            cardInstance.cycleProgress -= WORK_CYCLE_DURATION;

            // Consume energy
            if (hero.energy.current >= 1) {
                HeroManager.modifyHeroEnergy(hero.id, -1);
            } else {
                return;
            }

            // Process gradual consumption
            const result = GradualInputSystem.processGradualInputCycle(
                cardInstance.projectProgress.inputProgress,
                cardInstance.projectProgress.requirements,
                null,
                cardInstance.stack
            );

            EventBus.publish('project_progress', {
                cardId: cardInstance.id,
                projectId: projectId,
                inputProgress: cardInstance.projectProgress.inputProgress
            });

            if (Object.keys(result.consumed).length > 0) {
                EventBus.publish('cards_updated', { source: 'project_stack_consumed' });
            }

            if (result.complete) {
                this.completeProject(cardInstance, project);
            }
        }
    },

    /**
     * Initialize progress tracking for current project
     */
    initProjectProgress(cardInstance) {
        const projectId = cardInstance.projectChain?.[cardInstance.currentProjectIndex];
        const project = getProject(projectId);

        if (!project) {
            cardInstance.projectProgress = null;
            return;
        }

        // Build requirements from project cost
        const requirements = {};
        if (project.resourceCost) {
            for (const [itemId, amount] of Object.entries(project.resourceCost)) {
                requirements[itemId] = amount;
            }
        }

        cardInstance.projectProgress = {
            inputProgress: GradualInputSystem.initInputProgress(requirements),
            requirements: requirements,
            projectId: projectId
        };
    },

    /**
     * Complete a project and apply rewards
     */
    completeProject(cardInstance, project) {
        logger.info('AreaSystem', `Project completed: ${project.name}`);

        // Apply project effects
        this.applyProjectEffect(project);

        // Mark as completed
        cardInstance.completedProjects.push(project.id);
        cardInstance.currentProjectIndex++;

        // Reset progress for next project
        cardInstance.projectProgress = null;
        this.initProjectProgress(cardInstance);

        // Check if all projects done
        if (cardInstance.currentProjectIndex >= cardInstance.projectChain.length) {
            this.completeAreaCard(cardInstance);
        } else {
            const nextProject = getProject(cardInstance.projectChain[cardInstance.currentProjectIndex]);
            NotificationSystem.success(`${project.name} complete! Next: ${nextProject?.name}`);
            EventBus.publish('cards_updated');
        }
    },

    /**
     * Complete the entire area card
     */
    completeAreaCard(cardInstance) {
        cardInstance.phase = 'complete';
        cardInstance.status = 'complete';

        const biome = getBiome(cardInstance.biomeId);
        NotificationSystem.success(`${biome?.name} fully developed!`);

        EventBus.publish('area_completed', {
            cardId: cardInstance.id,
            biomeId: cardInstance.biomeId
        });

        EventBus.publish('cards_updated');
    },

    // ========================================
    // PROJECT EFFECTS (Preserved from original)
    // ========================================

    /**
     * Apply the effect of a completed project
     * @param {Object} projectDef - Project definition from registry
     */
    applyProjectEffect(projectDef) {
        if (!projectDef || !projectDef.effectType) return;

        switch (projectDef.effectType) {
            case 'recruit_card': {
                const count = projectDef.effect?.count || 1;
                for (let i = 0; i < count; i++) {
                    RecruitSystem.createRecruitCard(true);
                }
                NotificationSystem.notify(`+${count} FREE Recruit Card!`, 'info');
                break;
            }

            case 'inventory_slots': {
                const slots = projectDef.effect?.slots || 0;
                GameState.inventory.slots.max += slots;
                NotificationSystem.notify(`+${slots} Inventory Slots!`, 'info');
                EventBus.publish('inventory_updated');
                break;
            }

            case 'max_stack': {
                const stackBonus = projectDef.effect?.stackBonus || 0;
                GameState.inventory.maxStackBonus = (GameState.inventory.maxStackBonus || 0) + stackBonus;
                NotificationSystem.notify(`+${stackBonus} Max Stack Size!`, 'info');
                break;
            }

            case 'double_items': {
                const chance = projectDef.effect?.chance || 0;
                const targetCategory = projectDef.effect?.targetCategory || null;

                if (!GameState.modifiers.doubleItemsChance) {
                    GameState.modifiers.doubleItemsChance = {};
                }

                if (targetCategory) {
                    GameState.modifiers.doubleItemsChance[targetCategory] =
                        (GameState.modifiers.doubleItemsChance[targetCategory] || 0) + chance;
                    NotificationSystem.notify(`+${Math.round(chance * 100)}% Double Items (${targetCategory})!`, 'info');
                } else {
                    GameState.modifiers.doubleItemsChance['all'] =
                        (GameState.modifiers.doubleItemsChance['all'] || 0) + chance;
                    NotificationSystem.notify(`+${Math.round(chance * 100)}% Double Items (all tasks)!`, 'info');
                }
                break;
            }

            case 'xp_bonus': {
                const bonus = projectDef.effect?.bonus || 0;
                const targetCategory = projectDef.effect?.targetCategory || null;

                if (!GameState.modifiers.xpBonus) {
                    GameState.modifiers.xpBonus = {};
                }

                if (targetCategory) {
                    GameState.modifiers.xpBonus[targetCategory] =
                        (GameState.modifiers.xpBonus[targetCategory] || 0) + bonus;
                    NotificationSystem.notify(`+${Math.round(bonus * 100)}% XP (${targetCategory})!`, 'info');
                } else {
                    GameState.modifiers.xpBonus['all'] =
                        (GameState.modifiers.xpBonus['all'] || 0) + bonus;
                    NotificationSystem.notify(`+${Math.round(bonus * 100)}% XP (all tasks)!`, 'info');
                }
                break;
            }

            case 'unlock_biome': {
                const biomeId = projectDef.effect?.biomeId;
                const biome = getBiome(biomeId);
                if (biomeId && !GameState.progress.unlockedBiomes.includes(biomeId)) {
                    GameState.progress.unlockedBiomes.push(biomeId);
                    NotificationSystem.notify(`🌍 New area unlocked: ${biome?.name || biomeId}!`, 'success');
                    EventBus.publish('biome_unlocked', { biomeId });
                }
                break;
            }

            case 'unlock_region': {
                // NEW: Unlock a new explore card for a region
                const regionId = projectDef.effect?.regionId;
                if (regionId) {
                    this.spawnExploreCard(regionId);
                }
                break;
            }

            default:
                logger.warn('AreaSystem', `Unknown effect type: ${projectDef.effectType}`);
        }
    },

    /**
     * Spawn an explore card for a new region
     */
    spawnExploreCard(regionId) {
        // const { getRegion, getRegionBiomes } = require('../../config/registries/regionRegistry.js');
        // Imports are now handled at top of file
        const region = getRegion(regionId);

        if (!region) {
            logger.warn('AreaSystem', `Unknown region: ${regionId}`);
            return;
        }

        const biomes = getRegionBiomes(regionId);
        const firstBiome = biomes[0] || null;

        const exploreCard = {
            id: CardManager.generateId('explore'),
            templateId: 'explore_dynamic',
            name: `Explore ${region.name}`,
            cardType: 'explore',
            description: `Explore the ${region.name} to discover new areas.`,
            icon: region.icon || '🗺️',

            regionId: regionId,
            selectedBiomeId: firstBiome,
            exploredBiomes: [],
            biomeProgress: {},

            assignedHeroId: null,
            status: 'idle',
            isUnique: true,
            createdAt: Date.now()
        };

        CardManager.addToStack(exploreCard);
        GameState.cacheCard(exploreCard);

        NotificationSystem.success(`New region available: ${region.name}!`);

        EventBus.publish('card_spawned', {
            cardId: exploreCard.id,
            cardType: 'explore',
            regionId: regionId
        });
    }
};

export default AreaSystem;
