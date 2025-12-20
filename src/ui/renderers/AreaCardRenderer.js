// Fantasy Guild - Area Card Renderer (Reworked)
// Phase 25c: Full Combat UI for Questing Phase
// Refactored to use shared UI components

import * as HeroManager from '../../systems/hero/HeroManager.js';
import { getBiome } from '../../config/registries/biomeRegistry.js';
import { getEnemy } from '../../config/registries/enemyRegistry.js';
import { getProject } from '../../config/registries/projectRegistry.js';
import { getCard } from '../../config/registries/cardRegistry.js';
import { isCardExpanded } from '../components/CardExpansionManager.js';
import { renderHeroModule, renderEnemyModule, renderCombatStyleModule } from '../components/CombatModuleComponent.js';
import { renderHeroSlot } from '../components/HeroSlotComponent.js';
import { renderInputSlots } from '../components/InputSlotComponent.js';
import { renderGradualProgress } from '../components/GradualProgressComponent.js';
import { renderWorkCycleBar } from '../components/WorkCycleBarComponent.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { InventoryManager } from '../../systems/inventory/InventoryManager.js';
import * as CardMetadata from '../components/CardMetadataComponent.js';
import { WORK_CYCLE_DURATION } from '../../config/constants.js';
import { LootSystem } from '../../systems/combat/LootSystem.js';
import { renderRewardPreview } from '../components/RewardPreviewComponent.js';

/**
 * Renders area-type card body (Reworked)
 * @param {Object} cardInstance - The card instance from GameState
 * @param {Object} template - The card template (may be null for dynamic cards)
 * @returns {string} HTML string for area card body
 */
export function renderAreaBody(cardInstance, template) {
    // Route to phase-specific renderer
    switch (cardInstance.phase) {
        case 'questing':
            return renderQuestingPhase(cardInstance, template);
        case 'projects':
            return renderProjectsPhase(cardInstance, template);
        case 'complete':
            return renderCompletePhase(cardInstance, template);
        default:
            return renderQuestingPhase(cardInstance, template);
    }
}

/**
 * Render the questing phase with FULL Combat Card UI
 */
function renderQuestingPhase(cardInstance, template) {
    const biome = getBiome(cardInstance.biomeId);
    const enemyGroups = cardInstance.enemyGroups || [];
    const currentGroupIndex = cardInstance.currentGroupIndex ?? 0;
    const currentGroup = enemyGroups[currentGroupIndex];

    // Check if waiting for task claim
    if (cardInstance.awaitingTaskClaim) {
        return renderTaskClaimState(cardInstance, biome);
    }

    // Get hero and enemy
    const assignedHero = cardInstance.assignedHeroId
        ? HeroManager.getHero(cardInstance.assignedHeroId)
        : null;

    // Dispatch based on quest type
    const questType = currentGroup.type || 'combat';

    if (questType === 'collection') {
        return renderCollectionQuest(cardInstance, currentGroup, currentGroupIndex, enemyGroups.length);
    }

    // --- COMBAT QUEST RENDER ---
    const enemy = getEnemy(cardInstance.enemyId || currentGroup.enemyId);
    if (!enemy) {
        return `
            <div class="card__area-body">
                ${renderGroupProgress(cardInstance, currentGroup, currentGroupIndex, enemyGroups.length)}
                <p class="card__hint">No enemy found: ${cardInstance.enemyId}</p>
            </div>
        `;
    }

    // Calculate progress percentages for attack bars
    const heroAttackSpeed = 3000; // Base attack speed in ms
    const heroProgress = cardInstance.heroTickProgress || 0;
    const heroProgressPercent = Math.min(100, (heroProgress / heroAttackSpeed) * 100);

    const enemyProgress = cardInstance.enemyTickProgress || 0;
    const enemyProgressPercent = Math.min(100, (enemyProgress / enemy.attackSpeed) * 100);

    // Loot preview
    const possibleDrops = enemy.drops
        ? LootSystem.previewDropsFromArray(enemy.drops)
        : LootSystem.previewDrops(enemy.dropTableId);

    const unifiedDrops = possibleDrops.map(d => ({
        name: d.itemName,
        icon: d.itemIcon,
        min: d.minQty,
        max: d.maxQty,
        chance: d.chance,
        isRare: d.chance < 10
    }));

    const lootPreviewHtml = renderRewardPreview(unifiedDrops, 'loot');

    // Check if card is expanded
    const isExpanded = isCardExpanded(cardInstance.id);

    return `
        <div class="card__area-body">
            <p class="card__description" style="font-style: italic;">${biome?.description || 'Quest in this area to unlock tasks.'}</p>
            
            <!-- Hero Combat Module (same as Combat Cards) -->
            ${renderHeroModule(cardInstance, assignedHero, heroAttackSpeed, heroProgressPercent, enemy)}
            
            <!-- Enemy Combat Module (same as Combat Cards) -->
            ${renderEnemyModule(cardInstance, enemy, enemyProgressPercent)}
            
            <!-- Group Progress (Visible - under enemy) -->
            ${renderGroupProgress(cardInstance, currentGroup, currentGroupIndex, enemyGroups.length)}

            <!-- Expanded Section: Combat Style & Loot -->
            <div class="card__expanded" data-expanded-section="${cardInstance.id}" style="display: ${isExpanded ? 'block' : 'none'};">
                <!-- Combat Style Selection -->
                ${renderCombatStyleModule(cardInstance, assignedHero, enemy)}

                <!-- Loot Drops -->
                <div class="card__combat-loot" style="margin-top: 8px;">
                    <div class="card__combat-loot-header">Possible Loot</div>
                    ${lootPreviewHtml}
                </div>
            </div>
            
            <!-- Expand/Collapse Button -->
            <div class="card__expand-bar${isExpanded ? ' card__expand-bar--expanded' : ''}" data-expand-card="${cardInstance.id}" title="Click to ${isExpanded ? 'collapse' : 'expand'}">
                <span class="card__expand-icon">${isExpanded ? '▲' : '▼'}</span>
            </div>
        </div>
    `;
}

/**
 * Render the group progress header
 */
/**
 * Render the group progress header
 */
function renderGroupProgress(cardInstance, currentGroup, currentIndex, totalGroups) {
    if (!currentGroup) {
        return '<div class="area__group-progress">No enemy groups</div>';
    }

    // Determine type and progress data
    const type = currentGroup.type || 'combat';
    let name = '';
    let statusText = '';
    let progressPercent = 0;

    // Unlocking info
    const unlockInfoHtml = renderUnlockInfo(currentGroup);

    if (type === 'collection') {
        const requirements = currentGroup.requirements || {};
        const inputProgress = cardInstance.questProgress?.inputProgress || {};

        // Use item name(s) as the display name
        const itemNames = Object.keys(requirements).map(key => {
            if (key.startsWith('tag:')) {
                const tag = key.substring(4);
                return `Any ${tag.charAt(0).toUpperCase() + tag.slice(1)}`;
            }
            const item = getItem(key);
            return item?.name || key;
        });
        name = itemNames.join(', ');

        // Calculate collection progress

        let totalRequired = 0;
        let totalCurrent = 0;

        Object.entries(requirements).forEach(([key, required]) => {
            totalRequired += required;
            const current = inputProgress[key]?.current || 0;
            totalCurrent += current;
        });

        // Ensure we don't divide by zero
        progressPercent = totalRequired > 0 ? (totalCurrent / totalRequired) * 100 : 0;
        statusText = `${totalCurrent}/${totalRequired} collected`;

    } else {
        // Combat (default)
        const enemy = getEnemy(currentGroup.enemyId);
        name = enemy?.name || currentGroup.enemyId;

        const remaining = currentGroup.remaining ?? currentGroup.total;
        const total = currentGroup.total;

        progressPercent = total > 0 ? ((total - remaining) / total) * 100 : 0;
        statusText = `${total - remaining}/${total} defeated`;
    }

    return `
        <div class="area__group-progress">
            <div class="area__group-header">
                <span class="area__group-title">⚔️ Quest ${currentIndex + 1} of ${totalGroups}</span>
            </div>
            <div class="area__group-details" style="display: flex; justify-content: space-between; font-size: var(--font-size-xs); color: var(--color-text-muted); margin-bottom: 2px;">
                <span>${name}</span>
                <span>${statusText}</span>
            </div>
            <div class="area__group-bar">
                <div class="area__group-fill" style="width: ${progressPercent}%"></div>
            </div>
            <div class="area__group-unlock">
                ${unlockInfoHtml}
            </div>
        </div>
    `;
}

/**
 * Render "Claim Task" state between enemy groups
 */
function renderTaskClaimState(cardInstance, biome) {
    const claimInfo = cardInstance.pendingTaskClaim || {};
    const taskTemplate = getCard(claimInfo.taskId);
    const taskName = taskTemplate?.name || claimInfo.taskId;
    const taskIcon = taskTemplate?.icon || '📋';

    const unlockedCount = cardInstance.unlockedTasks?.length || 0;
    const totalGroups = cardInstance.enemyGroups?.length || 0;

    return `
        <div class="card__area-body area__claim-state">
            <div class="area__claim-header">
                ✨ Quest Completed!
            </div>
            
            <div class="area__claim-task">
                <span class="area__claim-icon">${taskIcon}</span>
                <div class="area__claim-info">
                    <span class="area__claim-label">New Task Unlocked:</span>
                    <span class="area__claim-name">${taskName}</span>
                </div>
            </div>

            ${renderClaimRewards(cardInstance.pendingTaskClaim?.rewards, cardInstance.pendingTaskClaim?.xpRewards)}
            
            <button class="area__claim-btn" 
                    data-action="claim-area-task" 
                    data-card-id="${cardInstance.id}">
                📥 Claim Rewards
            </button>
            
            <div class="area__claim-progress">
                Area Quests Completed: ${unlockedCount + 1}/${totalGroups}
            </div>
        </div>
    `;
}

/**
 * Render rewards section for claim state
 */
/**
 * Render rewards section for claim state
 */
/**
 * Render rewards section for claim state
 */
function renderClaimRewards(rewards, xpRewards) {
    const hasItems = rewards && rewards.length > 0;
    const hasXp = xpRewards && xpRewards.length > 0;

    if (!hasItems && !hasXp) return '';

    let html = '';

    // Item Rewards
    if (hasItems) {
        html += rewards.map(r => {
            const item = getItem(r.itemId);
            const name = item?.name || r.itemId;
            const icon = item?.icon || '🎁';

            return `
                <div class="area__claim-task" style="margin-top: 8px;">
                    <span class="area__claim-icon">${icon}</span>
                    <div class="area__claim-info">
                        <span class="area__claim-label">Item Reward:</span>
                        <span class="area__claim-name">${r.count}x ${name}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    // XP Rewards
    if (hasXp) {
        html += xpRewards.map(r => {
            const skillName = r.skill.charAt(0).toUpperCase() + r.skill.slice(1);
            return `
                <div class="area__claim-task" style="margin-top: 8px;">
                    <span class="area__claim-icon">⚔️</span>
                    <div class="area__claim-info">
                        <span class="area__claim-label">Party XP:</span>
                        <span class="area__claim-name">${r.amount} ${skillName} XP</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    return html;
}



/**
 * Render the projects phase with gradual resource consumption
 */
function renderProjectsPhase(cardInstance, template) {
    const biome = getBiome(cardInstance.biomeId);
    const projectChain = cardInstance.projectChain || [];
    const currentProjectIndex = cardInstance.currentProjectIndex ?? 0;
    const projectId = projectChain[currentProjectIndex];
    const project = getProject(projectId);

    const assignedHero = cardInstance.assignedHeroId
        ? HeroManager.getHero(cardInstance.assignedHeroId)
        : null;

    // Projects completed summary
    const completedProjects = cardInstance.completedProjects || [];
    const totalProjects = projectChain.length;
    const completedHtml = `Projects: ${completedProjects.length}/${totalProjects}`;

    // Status class
    const statusClass = cardInstance.status === 'paused' ? 'card--paused' : '';

    // Work cycle timing (must match AreaSystem.CYCLE_DURATION)
    const cycleDurationMs = WORK_CYCLE_DURATION;
    const cycleProgress = cardInstance.cycleProgress || 0;
    const cyclePercent = Math.min(100, (cycleProgress / cycleDurationMs) * 100);

    // Render item input slots for project resources
    const itemSlotsHtml = renderProjectInputSlots(project, cardInstance);

    // Get project progress
    const progressHtml = cardInstance.projectProgress
        ? renderProjectProgress(cardInstance.projectProgress, project)
        : renderInitialProjectProgress(project);

    return `
        <div class="card__area-body ${statusClass}">
            <div class="card__project-header">🏗️ ${project?.name || projectId || 'Project'}</div>
            
            <div class="card__slots-row card__slots-row--spaced">
                ${renderHeroSlot(cardInstance)}
                ${itemSlotsHtml}
            </div>
            
            <div class="card__progress" data-card-progress="${cardInstance.id}">
                ${renderWorkCycleBar({
        cardId: cardInstance.id,
        durationSec: cycleDurationMs / 1000,
        progressPercent: cyclePercent,
        isWorking: !cardInstance.status || cardInstance.status === 'active',
        isPaused: cardInstance.status === 'paused'
    })}
            </div>
            
            <div class="card__projects-section">
                ${cardInstance.projectProgress
            ? renderGradualProgress({
                progressData: cardInstance.projectProgress,
                cardInstance,
                showTitle: false // Projects section has its own list style usually, keeping it simple
            })
            : renderGradualProgress({
                progressData: {
                    requirements: project.resourceCost || {},
                    inputProgress: {},
                    percentComplete: 0
                },
                cardInstance,
                showTitle: false
            })
        }
            </div>
            
            <div class="card__projects-completed">
                ${completedHtml}
            </div>
            
            ${CardMetadata.renderHint(!assignedHero, 'Assign a hero to work on projects')}
            ${CardMetadata.renderHint(cardInstance.status === 'paused', '⚠️ No resources available!')}
        </div>
    `;
}

/**
 * Render item input slots for project requirements
 */
function renderProjectInputSlots(project, cardInstance) {
    if (!project?.resourceCost) {
        return '';
    }

    const inputProgress = cardInstance.projectProgress?.inputProgress || {};

    const slots = Object.entries(project.resourceCost).map(([itemId, required]) => {
        const item = getItem(itemId);
        const itemName = item?.name || itemId;
        const itemIcon = item?.icon || '📦';
        const inventoryCount = InventoryManager.getItemCount(itemId);
        const currentProgress = inputProgress[itemId]?.current || 0;
        const hasEnough = inventoryCount > 0 || currentProgress >= required;
        // Use same classes as Task Card fixed input slots
        const statusClass = hasEnough ? 'card__input-slot--available' : 'card__input-slot--missing';

        return `
            <div class="card__input-slot ${statusClass}" data-item-id="${itemId}" title="${itemName}: ${currentProgress}/${required} contributed (Have ${inventoryCount})">
                <span class="card__input-icon">${itemIcon}</span>
                <span class="card__input-count">${inventoryCount}</span>
            </div>
        `;
    }).join('');

    return slots;
}



/**
 * Render completed area
 */
function renderCompletePhase(cardInstance, template) {
    const biome = getBiome(cardInstance.biomeId);
    const completedProjects = cardInstance.completedProjects || [];
    const unlockedTasks = cardInstance.unlockedTasks || [];

    return `
        <div class="card__area-complete">
            <div class="card__area-complete-badge">
                ✨ Area Complete!
            </div>
            <div class="card__area-complete-stats">
                <p>${biome?.icon || '🗺️'} ${biome?.name || 'Unknown Area'}</p>
                <p>Tasks Unlocked: ${unlockedTasks.length}</p>
                <p>Projects Completed: ${completedProjects.length}</p>
            </div>
        </div>
    `;
}

/**
 * Render a collection quest (item delivery)
 */
function renderCollectionQuest(cardInstance, questGroup, currentIndex, totalGroups) {
    const assignedHero = cardInstance.assignedHeroId
        ? HeroManager.getHero(cardInstance.assignedHeroId)
        : null;

    // Status class
    const statusClass = cardInstance.status === 'paused' ? 'card--paused' : '';

    // Work cycle timing
    const cycleDurationMs = WORK_CYCLE_DURATION;
    const cycleProgress = cardInstance.cycleProgress || 0;
    const cyclePercent = Math.min(100, (cycleProgress / cycleDurationMs) * 100);

    // Prepare inputs for slot renderer
    const requirements = questGroup.requirements || {};
    const inputs = Object.entries(requirements).map(([key, required]) => {
        if (key.startsWith('tag:')) {
            const tag = key.substring(4);
            return {
                acceptTag: tag,
                quantity: 1,
                slotLabel: `Any ${tag.charAt(0).toUpperCase() + tag.slice(1)}`
            };
        } else {
            return {
                itemId: key,
                quantity: 1
            };
        }
    });

    const itemSlotsHtml = renderInputSlots(inputs, cardInstance);

    // Render progress bars
    const questProgress = cardInstance.questProgress || { inputProgress: {}, requirements };

    // We can reuse renderProjectProgress logic if we adapt the data slightly
    // Or just inline a simple version here
    const progressBars = Object.entries(questProgress.requirements).map(([key, required]) => {
        const current = questProgress.inputProgress?.[key]?.current || 0;
        const percent = required > 0 ? Math.min(100, Math.floor((current / required) * 100)) : 100;

        // Label logic
        let name = key;
        let icon = '📦';
        if (key.startsWith('tag:')) {
            const tag = key.substring(4);
            name = `Any ${tag.charAt(0).toUpperCase() + tag.slice(1)}`;
        } else {
            const item = getItem(key);
            name = item?.name || key;
            icon = item?.icon || '📦';
        }

        return `
            <div class="card__gradual-progress-item">
                <div class="card__gradual-progress-header">
                    <span class="card__gradual-progress-name">${icon} ${name}</span>
                    <span class="card__gradual-progress-count">${current}/${required}</span>
                </div>
                <div class="card__gradual-progress-bar-container">
                    <div class="card__gradual-progress-bar" style="width: ${percent}%"></div>
                </div>
            </div>
        `;
    }).join('');

    return `
        <div class="card__area-body ${statusClass}">
            <p class="card__description" style="margin-top: 8px;">${questGroup.description || 'Supply items to complete this task.'}</p>
            
            <div class="card__slots-row card__slots-row--spaced">
                ${renderHeroSlot(cardInstance)}
                ${itemSlotsHtml}
            </div>
            
            <div class="card__progress">
                ${renderWorkCycleBar({
        cardId: cardInstance.id,
        durationSec: cycleDurationMs / 1000,
        progressPercent: cyclePercent,
        isWorking: !cardInstance.status || cardInstance.status === 'active',
        isPaused: cardInstance.status === 'paused'
    })}
            </div>
            
            <!-- Unified Quest Header (Moved to Bottom) -->
            <div style="margin-top: auto; padding-top: 8px;">
                ${renderGroupProgress(cardInstance, questGroup, currentIndex, totalGroups)}
            </div>
            
            ${CardMetadata.renderHint(cardInstance.status === 'paused', '⚠️ No resources available!')}
        </div>
    `;
}

/**
 * Render rewards and unlocks for a quest group
 */
function renderUnlockInfo(group) {
    let html = '';

    // Render Unlocked Task
    if (group.unlocksTask) {
        const taskTemplate = getCard(group.unlocksTask);
        const taskName = taskTemplate?.name || group.unlocksTask;
        html += `<div>🎁 Task: <span class="area__unlock-task">${taskName}</span></div>`;
    }

    // Render Item Rewards
    if (group.rewards && group.rewards.length > 0) {
        const rewardsText = group.rewards.map(r => {
            const item = getItem(r.itemId);
            const name = item?.name || r.itemId;
            return `${r.count}x ${name}`;
        }).join(', ');

        html += `<div>🎁 Reward: <span class="area__unlock-task">${rewardsText}</span></div>`;
    }

    if (!html) return '';

    return `
        <div class="area__unlock-container">
            ${html}
        </div>
    `;
}

export default { renderAreaBody };
