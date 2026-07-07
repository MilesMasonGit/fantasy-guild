import { HeroTransferResolver } from './HeroTransferResolver.js';
import { getItem } from '../../../config/registries/index.js';

/**
 * AssignmentResolver - Handles Hero, Tool, and Item assignments to card slots.
 */
export const AssignmentResolver = {
    resolve(event, engine, activeData, overData) {
        const { over } = event;
        const entityId = activeData.id;
        const entityType = activeData.type;
        const overCardId = overData?.cardId || (overData?.type === 'card' ? overData.id : null);

        // 1. UNASSIGNMENT RESOLUTION (Drop over empty space)
        if (!over) {
            return this.resolveUnassignment(activeData, engine);
        }

        if (!overCardId && overData?.type !== 'hero') return { success: false, action: 'none' };

        // 2. CARD-TARGETED ASSIGNMENT (One Large Hitbox)
        if (overCardId && (overData?.targetType === 'card_area' || overData?.targetType === 'card' || overData?.type === 'card' || overData?.type?.includes('Slot'))) {
            const routedEntityType = entityType === 'card' ? activeData.cardType : entityType;
            
            // Special handling for Hero unassignment before re-assignment
            if (routedEntityType === 'hero') {
                HeroTransferResolver.ensureHeroUnassigned(entityId, engine);
            }
            
            const smartResult = engine.CardManager.smartAssignEntity(overCardId, routedEntityType, entityId);
            
            if (smartResult.success) {
                return { success: true, action: 'assign', type: routedEntityType };
            }
            
            return { success: false, action: 'assign_fail', error: smartResult.error };
        }

        // 4. ITEM ON HERO EQUIPPING
        if (overData?.type === 'hero' && entityType === 'item') {
            const itemDef = getItem(entityId);
            const isEquippable = itemDef && (itemDef.equipSlot || 
                                             itemDef.type === 'food' || 
                                             itemDef.type === 'drink' || 
                                             itemDef.type === 'weapon' || 
                                             itemDef.type === 'armor');
            if (isEquippable) {
                engine.EquipmentManager.equipItem(overData.id, entityId);
                return { success: true, action: 'equip' };
            }
        }

        return { success: false, action: 'none' };
    },

    /**
     * Handle unassignment if sourceCardId was provided.
     */
    resolveUnassignment(activeData, engine) {
        if (!activeData.sourceCardId) return { success: false, action: 'none' };
        
        const entityType = activeData.type;
        const sourceCardId = activeData.sourceCardId;

        if (entityType === 'hero') {
            engine.CardManager.unassignHero(sourceCardId);
        } else if (entityType === 'item') {
            if (activeData.isTool) {
                engine.CardManager.unassignTool(sourceCardId);
            } else {
                engine.CardManager.unassignItemFromSlot(sourceCardId, activeData.sourceSlotIndex);
            }
        } else if (entityType === 'card' && activeData.cardType === 'blueprint') {
            engine.CardManager.unassignBlueprint(sourceCardId);
        }
        
        return { success: true, action: 'unassign' };
    }
};
