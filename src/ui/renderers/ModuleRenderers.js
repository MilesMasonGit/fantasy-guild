// Fantasy Guild - Module Renderers
// Renders individual modular card traits

import { renderModuleWrapper } from '../components/ModuleWrapper.js';
import { renderProgressBarModule } from '../components/ProgressBarComponent.js';
import { getActionStatusLabel, formatSpeedVisual } from '../../systems/cards/ModuleHelpers.js';
import { renderHeroSlot } from '../components/HeroSlotComponent.js';
import { renderInputSlot, getTagIconData } from '../components/InputSlotComponent.js';
import { getEnemy } from '../../config/registries/enemyRegistry.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { getCard } from '../../config/registries/cardRegistry.js';
import { getProject } from '../../config/registries/projectRegistry.js';
import { resolveSpritePath, renderIcon } from '../../utils/AssetManager.js';
import { renderHeroGroup } from '../components/HeroGroupComponent.js';
import { renderEnemyGroup } from '../components/EnemyGroupComponent.js';
import { renderLootTableModule, formatEnemyDrops, formatTaskOutputs } from '../components/LootTableModule.js';

/**
 * Main dispatcher for module rendering
 */
export function renderTraitModule(trait, card) {
    const type = trait.type.toLowerCase();

    // Support for hiding modules dynamically
    if (trait.visibility === 'hidden') return '';

    // Computed visibility for quest completion state
    // If awaiting claim, ONLY show header and reward module
    if (card.awaitingTaskClaim) {
        if (type !== 'header' && type !== 'reward') {
            return '';
        }
    } else {
        // If NOT awaiting claim, hide reward module
        if (type === 'reward') {
            return '';
        }
    }

    let content = '';

    switch (type) {
        case 'header':
            content = renderHeaderModule(trait, card);
            break;
        case 'description':
            content = renderDescriptionModule(trait, card);
            break;
        case 'heroslot':
            // Skip if combat module exists - hero slots are rendered inside combat module's hero groups
            if (card.traits?.some(t => t.type === 'combat')) return '';
            // Otherwise render slot with simple title above (no wrapper)
            return renderHeroSlotModule(trait, card);
        case 'workcycle':
            content = renderWorkCycleModule(trait, card);
            break;
        case 'combat':
            // Skip wrapper - hero/enemy groups have their own styling
            return renderCombatModule(trait, card);
        case 'unifiedreward':
            content = renderUnifiedRewardModule(trait, card);
            break;
        case 'skillrequirement':
            content = renderRequirementModule(trait, card, 'skill');
            break;
        case 'statrequirement':
            content = renderRequirementModule(trait, card, 'stat');
            break;
        case 'inputslot':
            // Skip wrapper - render slot with simple title above
            return renderInputSlotModule(trait, card);
        case 'quest':
            content = renderQuestModule(trait, card);
            break;
        case 'exploreselector':
            content = renderExploreSelectorModule(trait, card);
            break;
        case 'discovery':
            content = renderDiscoveryModule(trait, card);
            break;
        case 'reward':
            // Quest completion reward claiming module
            content = renderRewardModule(trait, card);
            break;
        case 'loot':
            // Loot/output module - skip wrapper, has its own module styling
            return renderLootModule(trait, card);
        case 'projectpanel':
            content = renderProjectPanelModule(trait, card);
            break;
        default:
            content = `<div class="p-2 text-xs italic">Unknown Module: ${type}</div>`;
    }

    return renderModuleWrapper({
        moduleId: trait.id || `${type}_${Math.random().toString(36).substr(2, 5)}`,
        type: type,
        title: trait.title || '',
        visibility: trait.visibility || 'always',
        content: content
    });
}

/**
 * Header Module - Handles standard card header info if used as a module
 */
function renderHeaderModule(trait, card) {
    return `
        <div class="module-flex module-items-center module-gap-2">
            <span class="module-text-sm module-text-bold">${card.name}</span>
        </div>
    `;
}

/**
 * Description Module - Simple flavor text
 */
function renderDescriptionModule(trait, card) {
    return `<p class="card__description">${card.description || 'No description available.'}</p>`;
}

/**
 * Hero Slot Module - renders just the slot with title above (no wrapper)
 */
function renderHeroSlotModule(trait, card) {
    // Find our slot index by seeing which of the heroslot traits we are
    const heroSlots = card.traits?.filter(t => t.type === 'heroslot') || [];
    const slotIndex = heroSlots.findIndex(t => t.id === trait.id);

    const title = trait.title || 'Hero';
    const slotHtml = renderHeroSlot(card, null, slotIndex >= 0 ? slotIndex : 0);

    return `
        <div class="slot-module">
            <span class="slot-module__title">${title}</span>
            ${slotHtml}
        </div>
    `;
}

/**
 * Work Cycle Module - Time-based progress
 */
function renderWorkCycleModule(trait, card) {
    const durationMs = card.baseTickTime || 10000;
    const progressPercent = (card.progress || 0) / durationMs * 100;

    // Status label logic
    const statusLabel = getActionStatusLabel({
        status: card.status,
        assignedHeroId: card.assignedHeroId,
        missingItems: card.missingItems || [],
        missingRequirements: card.missingRequirements || [],
        defaultAction: trait.actionLabel || 'Working...'
    });

    const speedLabel = formatSpeedVisual(durationMs / 1000, card.currentTickTime / 1000);

    return renderProgressBarModule({
        cardId: card.id,
        moduleId: trait.id,
        type: 'time',
        progressPercent: progressPercent,
        actionLabel: statusLabel,
        speedLabel: speedLabel,
        isPaused: card.status === 'paused',
        durationSec: durationMs / 1000
    });
}

/**
 * Requirement Module (Skill/Stat)
 * For skill: displays "Req. [Skill Icon] X"
 */
function renderRequirementModule(trait, card, subType) {
    if (subType === 'skill') {
        const req = trait.requirement || trait;
        const skill = req.skill || 'melee';
        const level = req.level || 1;

        // Skill icons mapping
        const skillIcons = {
            melee: '⚔️',
            ranged: '🏹',
            magic: '✨',
            defence: '🛡️',
            nature: '🌿',
            industry: '🔨'
        };
        const icon = skillIcons[skill.toLowerCase()] || '⭐';

        // TODO: Check if hero meets requirement
        const isMet = true;
        const colorClass = isMet ? 'skill-req--met' : 'skill-req--unmet';

        return `
            <div class="skill-requirement ${colorClass}">
                <span class="skill-requirement__label">Req.</span>
                <span class="skill-requirement__icon">${icon}</span>
                <span class="skill-requirement__level">${level}</span>
            </div>
        `;
    }

    // Stat requirement fallback
    const req = trait.requirement || {};
    const label = `${req.stat} ${req.value}`;
    return `
        <div class="module-flex-between module-text-xs">
            <span>Required:</span>
            <span class="module-text-bold">${label}</span>
        </div>
    `;
}

/**
 * Unified Reward Module
 */
function renderUnifiedRewardModule(trait, card) {
    // Basic item preview list
    const items = trait.items || [];
    const xp = trait.xp || 0;

    return `
        <div class="module-flex-col module-gap-1">
            ${xp > 0 ? `<div class="module-text-xs module-text-xp">✨ +${xp} XP</div>` : ''}
            <div class="module-flex module-wrap module-gap-1">
                ${items.map(item => `
                    <div class="module-text-xs module-bg-dark module-p-1 module-rounded module-border">
                        ${item.id} x${item.amount}
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

/**
 * Input Slot Module - renders just the slot with title above (no wrapper)
 */
function renderInputSlotModule(trait, card) {
    // Get title: use slotLabel, or item name for fixed slots, or "Any [tag]" for open slots
    let title = trait.slotLabel || '';
    if (!title && trait.itemId) {
        const item = getItem(trait.itemId);
        title = item?.name || trait.itemId;
    } else if (!title && trait.acceptTag) {
        title = 'Any ' + trait.acceptTag;
    }

    const slotHtml = renderInputSlot(trait, card);

    return `
        <div class="slot-module">
            <span class="slot-module__title">${title}</span>
            ${slotHtml}
        </div>
    `;
}
/**
 * Combat Module - Renders Hero Groups and Enemy Groups
 * Layout: Heroes first (top), then Enemies (bottom)
 */
function renderCombatModule(trait, card) {
    const enemy = getEnemy(trait.enemyId || card.enemyId);
    if (!enemy) return `<div class="module-error">Enemy configuration missing</div>`;

    // Get selected combat style
    const selectedStyle = card.selectedStyle || 'melee';

    // Render hero groups (one per heroslot trait)
    const heroslotTraits = card.traits?.filter(t => t.type === 'heroslot') || [];
    const heroGroupsHtml = heroslotTraits.map((t, index) =>
        renderHeroGroup({
            card: card,
            slotIndex: index,
            selectedStyle: selectedStyle
        })
    ).join('');

    // If no explicit heroslots, render one default group for legacy support
    const finalHeroGroupsHtml = heroslotTraits.length > 0
        ? heroGroupsHtml
        : renderHeroGroup({ card: card, slotIndex: 0, selectedStyle: selectedStyle });

    // Render enemy group(s)
    // For now, single enemy per encounter. Future: support multiple enemies
    const enemyGroupHtml = renderEnemyGroup({
        card: card,
        enemy: enemy,
        enemyIndex: 0
    });

    // Combat style selector HTML
    const enemyType = enemy.combatType || 'melee';
    const styleIcons = { melee: '⚔️', ranged: '🏹', magic: '✨' };
    const isSelected = (style) => style === selectedStyle ? 'selected' : '';

    const combatStyleHtml = `
        <div class="combat-module__style-selector">
            <select class="combat-style-select" 
                    onchange="window.dispatchEvent(new CustomEvent('combat-style-change', { detail: { cardId: '${card.id}', style: this.value } }))">
                <option value="melee" ${isSelected('melee')}>⚔️ Melee</option>
                <option value="ranged" ${isSelected('ranged')}>🏹 Ranged</option>
                <option value="magic" ${isSelected('magic')}>✨ Magic</option>
            </select>
            <span class="combat-style-vs">VS</span>
            <span class="combat-style-enemy" title="Enemy uses ${enemyType} style">
                ${styleIcons[enemyType] || '❓'} ${enemyType.charAt(0).toUpperCase() + enemyType.slice(1)}
            </span>
        </div>
    `;

    return `
        <div class="combat-module">
            <div class="combat-module__heroes">
                ${finalHeroGroupsHtml}
            </div>
            ${combatStyleHtml}
            <div class="combat-module__enemies">
                ${enemyGroupHtml}
            </div>
        </div>
    `;
}

/**
 * Quest Module - Displays higher-level progress (Quotas)
 */
function renderQuestModule(trait, card) {
    if (trait.questType === 'collection') {
        const questProgress = card.questProgress || { inputProgress: {}, requirements: trait.requirements };
        const requirements = questProgress.requirements || {};
        const items = Object.entries(requirements).map(([key, required]) => {
            const current = questProgress.inputProgress?.[key]?.current || 0;
            const percent = required > 0 ? (current / required) * 100 : 100;

            // Handle tag: prefixed requirements (e.g., 'tag:key')
            let item, name, icon, spritePath;
            if (key.startsWith('tag:')) {
                const tagName = key.slice(4); // Remove 'tag:' prefix
                const tagData = getTagIconData(tagName);
                item = tagData.id ? getItem(tagData.id) : null;
                name = `Any ${tagName}`; // User-friendly name
                icon = tagData.icon || '📦';
                spritePath = tagData.id ? resolveSpritePath(item || tagData.id) : null;
            } else {
                item = getItem(key);
                name = item?.name || key;
                icon = item?.icon || '📦';
                spritePath = resolveSpritePath(item || key);
            }

            // Render icon with sprite fallback to emoji
            let iconHtml;
            if (spritePath && typeof spritePath === 'string') {
                iconHtml = `
                    <img src="${spritePath}" 
                         class="quest-item-sprite" 
                         style="width: 32px; height: 32px; vertical-align: middle; image-rendering: pixelated;"
                         onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='inline';">
                    <span style="display:none;">${icon}</span>
                `;
            } else {
                iconHtml = icon;
            }

            const isComplete = current >= required;
            const completeClass = isComplete ? 'quest-item--complete' : '';

            return `
                <div class="quest-item ${completeClass}">
                    <div class="quest-item__icon">${iconHtml}</div>
                    <div class="quest-item__info">
                        <div class="quest-item__header">
                            <span class="quest-item__name">${name}</span>
                            <span class="quest-item__count">${current}/${required}</span>
                        </div>
                        <div class="progress-bar progress-bar--small">
                            <div class="progress-bar__fill" style="width: ${percent}%"></div>
                        </div>
                    </div>
                </div>
            `;

        }).join('');

        return `<div class="module-flex-col module-gap-2">${items}</div>`;
    }

    if (trait.questType === 'combat') {
        const remaining = card.hordeCount ?? trait.count;
        const total = trait.count || 1;
        const defeated = total - remaining;
        const percent = (defeated / total) * 100;
        const isComplete = defeated >= total;
        const completeClass = isComplete ? 'quest-item--complete' : '';

        // Get enemy info for display
        const enemy = getEnemy(trait.enemyId || card.enemyId);
        const enemyName = enemy?.name || 'Enemies';
        const enemyIcon = enemy?.icon || '💀';
        const spritePath = resolveSpritePath(enemy);

        // Render icon with sprite fallback to emoji
        let iconHtml;
        if (spritePath && typeof spritePath === 'string') {
            iconHtml = `
                <img src="${spritePath}" 
                     class="quest-item-sprite" 
                     style="width: 32px; height: 32px; vertical-align: middle; image-rendering: pixelated;"
                     onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='inline';">
                <span style="display:none;">${enemyIcon}</span>
            `;
        } else {
            iconHtml = enemyIcon;
        }

        return `
            <div class="module-flex-col module-gap-2">
                <div class="quest-item ${completeClass}">
                    <div class="quest-item__icon">${iconHtml}</div>
                    <div class="quest-item__info">
                        <div class="quest-item__header">
                            <span class="quest-item__name">${enemyName}</span>
                            <span class="quest-item__count">${defeated}/${total}</span>
                        </div>
                        <div class="progress-bar progress-bar--small">
                            <div class="progress-bar__fill" style="width: ${percent}%"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Project resource consumption (similar to collection)
    if (trait.questType === 'project') {
        const projectProgress = card.projectProgress || { inputProgress: {}, requirements: trait.requirements };
        const requirements = projectProgress.requirements || {};
        const items = Object.entries(requirements).map(([key, required]) => {
            const current = projectProgress.inputProgress?.[key]?.current || 0;
            const percent = required > 0 ? (current / required) * 100 : 100;

            const item = getItem(key);
            const name = item?.name || key;
            const icon = item?.icon || '📦';
            const spritePath = resolveSpritePath(item || key);

            // Render icon with sprite fallback to emoji
            let iconHtml;
            if (spritePath && typeof spritePath === 'string') {
                iconHtml = `
                    <img src="${spritePath}" 
                         class="quest-item-sprite" 
                         style="width: 32px; height: 32px; vertical-align: middle; image-rendering: pixelated;"
                         onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='inline';">
                    <span style="display:none;">${icon}</span>
                `;
            } else {
                iconHtml = icon;
            }

            const isComplete = current >= required;
            const completeClass = isComplete ? 'quest-item--complete' : '';

            return `
                <div class="quest-item ${completeClass}">
                    <div class="quest-item__icon">${iconHtml}</div>
                    <div class="quest-item__info">
                        <div class="quest-item__header">
                            <span class="quest-item__name">${name}</span>
                            <span class="quest-item__count">${current}/${required}</span>
                        </div>
                        <div class="progress-bar progress-bar--small">
                            <div class="progress-bar__fill" style="width: ${percent}%"></div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        return `<div class="module-flex-col module-gap-2">${items}</div>`;
    }

    return '';
}

/**
 * Explore Selector Module
 */
function renderExploreSelectorModule(trait, card) {
    const unexplored = trait.options || []; // Biome IDs
    if (unexplored.length === 0) return '<div class="module-text-xs italic">No regions available</div>';

    const options = unexplored.map(id => {
        const label = id.charAt(0).toUpperCase() + id.slice(1);
        return `<option value="${id}" ${card.selectedBiomeId === id ? 'selected' : ''}>${label}</option>`;
    }).join('');

    return `
        <div class="module-flex-col module-gap-1">
            <select class="module-select module-text-xs" data-action="modular-select" data-card-id="${card.id}" data-module-id="${trait.id}">
                ${options}
            </select>
        </div>
    `;
}

/**
 * Discovery Module - Large action button
 */
function renderDiscoveryModule(trait, card) {
    if (!card.awaitingDiscovery) return '';

    const label = trait.label || 'Discover';
    const subtext = trait.subtext || '';

    return `
        <div class="module-flex-col module-items-center module-gap-2 module-p-2">
            ${subtext ? `<div class="module-text-xs module-text-center">${subtext}</div>` : ''}
            <button class="module-btn module-btn--primary" data-action="${trait.action || 'modular-discovery'}" data-card-id="${card.id}" data-module-id="${trait.id}">
                ${label}
            </button>
        </div>
    `;
}

/**
 * Reward Module - Quest completion claim UI
 * Shows when card.awaitingTaskClaim is true
 */
function renderRewardModule(trait, card) {
    const claimInfo = card.pendingTaskClaim || {};
    const taskId = claimInfo.taskId;
    const taskTemplate = taskId ? getCard(taskId) : null;
    const taskName = taskTemplate?.name || taskId || 'Unknown Task';

    const rewards = claimInfo.rewards || [];
    const xpRewards = claimInfo.xpRewards || [];

    // Build reward list HTML
    let rewardListHtml = '';

    // Task reward
    if (taskId) {
        // Resolve sprite for task:
        // 1. Explicit sprite on task card
        // 2. Icon from first output item (if available) - preferred by user for tasks like Wishing Well
        // 3. Task ID discovery (fallback)

        let entityForIcon = taskTemplate || taskId;
        let fallbackIcon = '📋';

        // Check if we should use output icon
        const outputs = taskTemplate?.outputs || taskTemplate?.config?.outputs || [];

        if (outputs && outputs.length > 0) {
            // outputs example: [{ itemId: 'drink_water', quantity: 1, ... }] 
            const firstOutput = outputs[0];
            const outputId = firstOutput.itemId || firstOutput.id || firstOutput;
            const outputItem = getItem(outputId);

            if (outputItem) {
                entityForIcon = outputItem;
                fallbackIcon = outputItem.icon || '📦';
            }
        }

        // Use renderIcon to handle both explicit sprites and discovery
        const iconHtml = renderIcon(entityForIcon, 'reward-item__icon-wrapper', { size: 32, icon: fallbackIcon });

        rewardListHtml += `
            <div class="reward-item reward-item--task">
                <div class="reward-item__icon">${iconHtml}</div>
                <span class="reward-item__text">Task: ${taskName}</span>
            </div>
        `;
    }

    // Item rewards
    rewards.forEach(reward => {
        const item = getItem(reward.itemId);
        const itemName = item?.name || reward.itemId;
        const count = reward.count || 1;
        const fallbackIcon = item?.icon || '📦';

        const iconHtml = renderIcon(item || reward.itemId, 'reward-item__icon-wrapper', { size: 32, icon: fallbackIcon });

        rewardListHtml += `
            <div class="reward-item reward-item--item">
                <div class="reward-item__icon">${iconHtml}</div>
                <span class="reward-item__text">${count}x ${itemName}</span>
            </div>
        `;
    });

    // XP rewards
    xpRewards.forEach(xpReward => {
        const skillName = xpReward.skill.charAt(0).toUpperCase() + xpReward.skill.slice(1);

        // Skill icons mapping
        const skillIcons = {
            melee: '⚔️',
            ranged: '🏹',
            magic: '✨',
            defence: '🛡️',
            nature: '🌿',
            industry: '🔨'
        };
        const icon = skillIcons[xpReward.skill.toLowerCase()] || '✨';

        rewardListHtml += `
            <div class="reward-item reward-item--xp">
                <span class="reward-item__icon">${icon}</span>
                <span class="reward-item__text">${xpReward.amount} ${skillName} XP</span>
            </div>
        `;
    });

    // Get quest progress info
    const unlockedCount = card.unlockedTasks?.length || 0;
    const totalGroups = card.enemyGroups?.length || 0;

    return `
        <div class="reward-module">
            <div class="reward-module__header">
                ✨ Quest Completed!
            </div>
            
            <div class="reward-module__rewards">
                <div class="reward-module__label">Rewards:</div>
                ${rewardListHtml}
            </div>
            
            <button class="reward-module__claim-btn" 
                    data-action="claim-area-task" 
                    data-card-id="${card.id}">
                📥 Claim Rewards
            </button>
            
            <div class="reward-module__progress">
                Quests: ${unlockedCount + 1}/${totalGroups}
            </div>
        </div>
    `;
}

/**
 * Loot Module - Displays loot/outputs from combat or tasks
 */
function renderLootModule(trait, card) {
    // Determine mode and items based on trait configuration
    const mode = trait.mode || 'loot';
    const title = trait.title || (mode === 'loot' ? 'Loot Table' : 'Outputs');

    let items = [];

    // Option 1: Items are directly specified in the trait
    if (trait.items && Array.isArray(trait.items)) {
        items = trait.items;
    }
    // Option 2: Outputs in trait (from task cards)
    else if (trait.outputs && Array.isArray(trait.outputs)) {
        items = formatTaskOutputs(trait.outputs);
    }
    // Option 3: Get from card's config outputs (task cards)
    else if (card.config?.outputs) {
        items = formatTaskOutputs(card.config.outputs);
    }
    // Option 4: Get from enemy drops (combat cards)
    else if (trait.source === 'enemy' || mode === 'loot') {
        const enemy = getEnemy(trait.enemyId || card.enemyId);
        if (enemy && enemy.drops) {
            items = formatEnemyDrops(enemy.drops);
        }
    }

    if (items.length === 0) return '';

    return renderLootTableModule({
        items,
        title,
        mode
    });
}

/**
 * Project Panel Module - Displays current project info, buff/reward, and completed projects
 */
function renderProjectPanelModule(trait, card) {
    const projectChain = card.projectChain || [];
    const currentProjectIndex = card.currentProjectIndex ?? 0;
    const projectId = projectChain[currentProjectIndex];
    const project = getProject(projectId);
    const completedProjects = card.completedProjects || [];

    if (!project) {
        return `<div class="project-panel"><div class="project-panel__empty">No project available</div></div>`;
    }

    // Project icon
    const projectIcon = project.icon || '🏗️';

    // Format buff/reward
    let buffHtml = '';
    if (project.provides) {
        const providesEntries = Array.isArray(project.provides) ? project.provides : [project.provides];
        buffHtml = providesEntries.map(p => {
            if (p.type === 'task') {
                const taskTemplate = getCard(p.taskId);
                return `<div class="project-panel__buff">📋 Unlocks: ${taskTemplate?.name || p.taskId}</div>`;
            } else if (p.type === 'buff') {
                return `<div class="project-panel__buff">✨ ${p.description || p.buffId}</div>`;
            } else if (p.type === 'area') {
                return `<div class="project-panel__buff">🗺️ Unlocks Area: ${p.areaId}</div>`;
            }
            return '';
        }).join('');
    }

    // Completed projects list
    let completedHtml = '';
    if (completedProjects.length > 0) {
        const completedItems = completedProjects.map(pId => {
            const p = getProject(pId);
            return `<span class="project-panel__completed-item">${p?.icon || '✅'} ${p?.name || pId}</span>`;
        }).join('');
        completedHtml = `
            <div class="project-panel__completed">
                <span class="project-panel__completed-label">Completed:</span>
                ${completedItems}
            </div>
        `;
    }

    return `
        <div class="project-panel">
            <div class="project-panel__header">
                <span class="project-panel__icon">${projectIcon}</span>
                <span class="project-panel__name">${project.name || projectId}</span>
                <span class="project-panel__counter">${currentProjectIndex + 1}/${projectChain.length}</span>
            </div>
            ${buffHtml}
            ${completedHtml}
        </div>
    `;
}

