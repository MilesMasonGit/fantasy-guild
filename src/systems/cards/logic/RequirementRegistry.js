import * as HeroManager from '../../hero/HeroManager.js';
import { InventoryManager } from '../../inventory/InventoryManager.js';
import * as SkillSystem from '../../hero/SkillSystem.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { getCard as getCardTemplate } from '../../../config/registries/cardRegistry.js';

/**
 * Requirement handlers registry for evolutionary refactoring of card logic.
 */
const HANDLERS = {
    heroslot: (trait, card, heroId) => {
        if (!heroId || !trait.requirements) return null;
        const req = trait.requirements;
        if (req.skill && !SkillSystem.meetsRequirement(heroId, req)) {
            return `${trait.title || 'Hero'}: ${req.skill} Lv.${req.skillRequirement || req.level}`;
        }
        return null;
    },

    skillrequirement: (trait, card, heroId) => {
        if (!heroId) return null;
        if (!SkillSystem.meetsRequirement(heroId, { skill: trait.skill, level: trait.level || 1 })) {
            return trait.title || `${trait.skill} Lv.${trait.level || 1}`;
        }
        return null;
    },

    statrequirement: (trait, card, heroId) => {
        if (!heroId) return null;
        const heroData = HeroManager.getHero(heroId);
        if (trait.stat && heroData?.stats && (heroData.stats[trait.stat] || 0) < trait.value) {
            return trait.title || `${trait.stat} ${trait.value}+`;
        }
        return null;
    },

    inputslot: (trait, card) => {
        const template = getCardTemplate(card.templateId);
        const isProject = !!template?.isProject;
        const inputsToCheck = trait.inputs || [trait];
        const missing = [];

        for (let i = 0; i < inputsToCheck.length; i++) {
            const reqTrait = inputsToCheck[i];
            const slotIndex = trait.inputs ? i : (trait.slotIndex ?? 0);
            const assigned = card.assignedItems?.[slotIndex];
            const assignedItemId = assigned?.id || assigned;
            
            const totalRequired = reqTrait.quantity || 1;
            const quantityNeededToStart = isProject ? 1 : totalRequired;

            if (assignedItemId) {
                let isValid = false;
                if (reqTrait.itemId) {
                    isValid = (assignedItemId === reqTrait.itemId);
                } else if (reqTrait.acceptTag) {
                    const itemDef = getItem(assignedItemId);
                    isValid = !!(itemDef?.tags?.includes(reqTrait.acceptTag));
                } else {
                    isValid = true;
                }

                if (!isValid) {
                    missing.push(`Valid ${reqTrait.slotLabel || 'Item'}`);
                    continue;
                }

                if (isProject) {
                    const projectProgress = card.project?.progress || {};
                    const currentFed = projectProgress[assignedItemId] || 0;
                    if (currentFed >= totalRequired) continue;
                }

                const stackItemsOfThisType = card.stack?.filter(e => e.type === 'item' && e.id === assignedItemId).length || 0;
                const remainingNeeded = quantityNeededToStart - stackItemsOfThisType;

                if (remainingNeeded > 0) {
                    if (!InventoryManager.hasItem(assignedItemId, remainingNeeded)) {
                        const item = getItem(assignedItemId);
                        missing.push(`${item?.name || assignedItemId}`);
                    }
                }
            } else if (isProject) {
                // For Projects: If nothing is assigned but item is still needed, it's missing
                const projectProgress = card.project?.progress || {};
                const currentFed = projectProgress[reqTrait.itemId] || 0;
                const totalRequired = reqTrait.quantity || 1;
                
                if (currentFed < totalRequired) {
                    const reqLabel = reqTrait.itemId ? getItem(reqTrait.itemId)?.name : (reqTrait.slotLabel || reqTrait.acceptTag || 'Item');
                    missing.push(`${reqLabel}`);
                }
            } else {
                const reqLabel = reqTrait.itemId ? getItem(reqTrait.itemId)?.name : (reqTrait.slotLabel || reqTrait.acceptTag || 'Item');
                missing.push(`${reqLabel}`);
            }
        }
        return missing.length > 0 ? missing : null;
    },

    toolslot: (trait, card) => {
        const assignedToolId = card.assignedToolId;
        if (!assignedToolId) return trait.toolType || 'Tool';

        const tool = getItem(assignedToolId);
        if (!tool) return `Valid ${trait.toolType || 'Tool'}`;

        if (!InventoryManager.hasItem(assignedToolId)) return `${trait.toolType || 'Tool'} (Empty)`;

        const minTier = trait.minTier || 0;
        if ((tool.tier || 0) < minTier) return `${trait.toolType || 'Tool'} T${minTier}+`;

        if (trait.toolType && tool.toolType !== trait.toolType && !tool.tags?.includes(trait.toolType)) {
            return `Correct Tool Type`;
        }
        return null;
    }
};

/**
 * Validates a single trait requirement.
 * @returns {Array|String|null} Array of missing items, string error, or null if met.
 */
export function validate(trait, card) {
    const handler = HANDLERS[trait.type.toLowerCase()];
    if (!handler) return null;
    return handler(trait, card, card.assignedHeroId);
}
