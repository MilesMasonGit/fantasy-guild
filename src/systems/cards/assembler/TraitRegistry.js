import { CARD_TYPES } from '../../../config/registries/cardRegistry.js';
import { getItem } from '../../../config/registries/itemRegistry.js';

/**
 * Trait Registry: Pure generators for card UI traits.
 */

export function generateTaskTraits(card, template) {
    const traits = [];
    const config = template?.config || card?.config || {};

    traits.push({ id: 'header', type: 'header' });
    traits.push({ id: 'desc', type: 'description' });

    if (config.skill) {
        traits.push({
            id: 'skill_req',
            type: 'skillrequirement',
            skill: config.skill,
            level: template?.levelRequired || config.levelRequired || 1
        });
    }

    traits.push({ id: 'hero', type: 'heroslot', title: 'Worker' });

    if (template?.acceptsBlueprints || card?.acceptsBlueprints || template?.acceptedBlueprints || card?.acceptedBlueprints) {
        traits.push({
            id: 'blueprint',
            type: 'blueprintslot',
            acceptedBlueprints: template?.acceptedBlueprints || card?.acceptedBlueprints || []
        });
    }

    const acceptedToolType = template?.acceptedToolType || card?.acceptedToolType || config.acceptedToolType;
    if (acceptedToolType) {
        traits.push({
            id: 'tool',
            type: 'toolslot',
            toolType: acceptedToolType,
            minTier: template?.minToolTier || card?.minToolTier || config.minToolTier || 0
        });
    }

    if (config.genericSlots) {
        config.genericSlots.forEach((slot, index) => {
            traits.push({
                id: `input_${index}`,
                type: 'inputslot',
                slotIndex: index,
                acceptTags: slot.acceptTags || [],
                slotLabel: slot.slotLabel
            });
        });
    } else if (config.inputs && config.inputs.length > 0) {
        traits.push({ id: 'inputs', type: 'inputslot', inputs: config.inputs });
    }

    let taskIcon = template?.icon || card?.icon || '📜';
    const primaryOutput = config.outputs?.[0];
    if (primaryOutput) {
        taskIcon = primaryOutput.itemId;
        if (!card.icon || ['📜', '🃏', '❓'].includes(card.icon)) {
            const item = getItem(taskIcon);
            if (item?.icon) card.icon = item.icon;
        }
    }

    traits.push({
        id: 'workcycle',
        type: 'workcycle',
        taskIcon: taskIcon,
        skill: config.skill,
        taskCategory: config.taskCategory || null
    });

    if (config.outputs && config.outputs.length > 0) {
        traits.push({ id: 'loot', type: 'loot', outputs: config.outputs });
    }

    if (config.xp > 0) {
        traits.push({ id: 'reward', type: 'unifiedreward', xp: config.xp });
    }

    return traits;
}

export function generateBlueprintTraits(card, template) {
    const skillName = (template.requiredSkill || "unknown").charAt(0).toUpperCase() + (template.requiredSkill || "unknown").slice(1);
    return [
        { id: 'header', type: 'header' },
        { id: 'img', type: 'sprite' },
        { id: 'desc', type: 'description', text: `For ${skillName} tasks.` },
        { id: 'draggable', type: 'draggable' }
    ];
}

export function generateCombatTraits(card, template) {
    return [
        { id: 'header', type: 'header' },
        { id: 'desc', type: 'description' },
        { id: 'hero', type: 'heroslot', title: 'Fighter' },
        { id: 'combat', type: 'combat', enemyId: card.enemyId || template?.enemyId || template?.config?.enemyId },
        { id: 'loot', type: 'loot' }
    ];
}

export function generateInvasionTraits(card, template) {
    return [
        { id: 'header', type: 'header' },
        { id: 'desc', type: 'description' },
        { id: 'invasion', type: 'invasionpanel' },
        { id: 'hero', type: 'heroslot', title: 'Defender' },
        { id: 'combat', type: 'combat', enemyId: card.enemyId || template?.enemyId || template?.config?.enemyId }
    ];
}

export function generateDungeonTraits(card, template) {
    return [
        { id: 'header', type: 'header' },
        { id: 'desc', type: 'description' },
        { id: 'dungeon', type: 'dungeon' },
        { id: 'hero', type: 'heroslot', title: 'Fighter' },
        { id: 'combat', type: 'combat', enemyId: card.enemyId },
        { id: 'loot', type: 'loot', label: 'Final Reward' }
    ];
}

export function generateProjectTraits(card, template) {
    const traits = generateTaskTraits(card, template);
    const initialTier = template.tiers?.[0] || template.tiers?.["0"];
    if (initialTier?.requirements) {
        Object.entries(initialTier.requirements).forEach(([itemId, qty], index) => {
            traits.push({
                id: `project_input_${index}`,
                type: 'inputslot',
                slotIndex: index,
                itemId: itemId,
                quantity: qty,
                slotLabel: 'Supplies'
            });
        });
    }
    traits.push({ id: 'project_progress', type: 'projectpanel' });
    return traits;
}
