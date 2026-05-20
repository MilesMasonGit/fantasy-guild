/**
 * InventoryResolver - Handles item sales and group reordering/moves.
 */
export const InventoryResolver = {
    resolve(event, engine, activeData, overData) {
        const { active, over } = event;
        const entityId = activeData.id;
        const entityType = activeData.type;

        // 1. INVENTORY MOVES (REORDER / GROUP MOVE / SELL)
        if (entityType === 'item') {
            const targetAction = overData?.action;
            if (targetAction === 'initiate-sell' || over?.id === 'sell-zone') {
                engine.EventBus.publish('dnd:sell-initiated', { itemId: entityId });
                return { success: true, action: 'sell' };
            }

            const targetGroupId = overData?.type === 'inventory_group' ? overData.id : overData?.groupId;
            if (targetGroupId) {
                const targetIndex = overData?.type === 'inventory_group' ? overData.itemCount : overData?.index;
                engine.InventoryGroupManager.moveItemToGroup(entityId, targetGroupId, targetIndex);
                return { success: true, action: 'inventory_move' };
            }
        }

        // 2. GROUP REORDERING
        if (entityType === 'inventory_group' && overData?.type === 'inventory_group') {
            if (entityId !== overData.id) {
                engine.InventoryGroupManager.reorderGroups(entityId, overData.id);
                return { success: true, action: 'group_reorder' };
            }
        }

        return { success: false, action: 'none' };
    }
};
