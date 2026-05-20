import { GameState } from '../../../state/GameState.js';
import { getCard as getCardTemplate } from '../../../config/registries/cardRegistry.js';
import { logger } from '../../../utils/Logger.js';
import { ensureModular } from '../CardAssembler.js';
import { AssignmentSystem } from '../../global/AssignmentSystem.js';
import { publishCardUpdate } from './CardManagerUtils.js';

/**
 * Project Logic - Handles Recipe evaluation and Blueprint syncing.
 */

export function evaluateBuildingRecipe(cardId) {
    const building = GameState.getCardById(cardId);
    if (!building) return;

    const template = getCardTemplate(building.templateId);
    if (!template) return;

    if (!template.config?.genericSlots && !building.config?.genericSlots) return;

    const recipePool = [];

    // 1. Spec Recipe from Blueprint
    if (building.assignedBlueprintId) {
        const blueprintInstance = GameState.getCardById(building.assignedBlueprintId);
        const blueprint = blueprintInstance ? getCardTemplate(blueprintInstance.templateId) : null;
        if (blueprint && blueprint.grantedRecipeTraits) {
            recipePool.push({ type: 'blueprint', recipe: blueprint.grantedRecipeTraits, priority: 1 });
        }
    }

    // 2. Native Recipe from Building
    if (template.nativeRecipeTraits) {
        recipePool.push({ type: 'native', recipe: template.nativeRecipeTraits, priority: 2 });
    }

    const currentItems = building.assignedItems ? Object.values(building.assignedItems).filter(Boolean) : [];
    let matchedRecipe = null;

    for (const entry of recipePool) {
        const reqs = entry.recipe.inputs || [];
        let isMatch = true;
        
        const availableItems = [...currentItems].map(itemOrId => {
            const id = itemOrId?.id || itemOrId;
            return GameState.getCardById(id)?.itemId || id;
        });

        for (const req of reqs) {
            const index = availableItems.indexOf(req.itemId);
            if (index !== -1) availableItems.splice(index, 1);
            else { isMatch = false; break; }
        }

        if (isMatch && reqs.length > 0) {
            matchedRecipe = entry.recipe;
            break;
        }
    }

    building.activeRecipe = matchedRecipe;
    ensureModular(building, template);
    publishCardUpdate(cardId, { source: 'evaluateBuildingRecipe' });
    
    logger.debug('ProjectProcessor', `Evaluated recipe for ${cardId}: ${matchedRecipe ? 'Match found' : 'No match'}`);
}

export function assignBlueprint(buildingCardId, blueprintCardId) {
    return AssignmentSystem.assignBlueprint(blueprintCardId, buildingCardId);
}

export function unassignBlueprint(buildingCardId) {
    return AssignmentSystem.unassignBlueprint(buildingCardId);
}
