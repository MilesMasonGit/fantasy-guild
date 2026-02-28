import React from 'react';
import { useGameState } from '../hooks/useGameState.js';
import { getItem, ITEM_TYPES } from '../../config/registries/index.js';
import GITabs from './base/GITabs.jsx';
import { Package, Sword, Apple, Box } from 'lucide-react';
import { cn } from '../utils/cn.js';

/**
 * Single Item Row Component
 */
const InvItemRow = ({ itemId, quantity }) => {
    const itemData = getItem(itemId);
    if (!itemData) return null;

    return (
        <div className="flex items-center justify-between p-2 rounded bg-gi-surface border border-gi-border hover:border-gi-primary/50 hover:bg-gi-surface-hover transition-colors group">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-gi-base border border-gi-border/50 flex items-center justify-center text-lg">
                    {itemData.icon || <Box className="w-4 h-4 text-gi-muted" />}
                </div>
                <div>
                    <div className="text-sm font-bold text-gi-text font-sans group-hover:text-gi-primary transition-colors">
                        {itemData.name}
                    </div>
                    {itemData.description && (
                        <div className="text-[10px] text-gi-muted truncate max-w-[140px]">
                            {itemData.description}
                        </div>
                    )}
                </div>
            </div>
            <div className="text-xs font-bold font-display px-2 py-1 rounded bg-gi-base text-gi-muted border border-gi-border">
                x{quantity}
            </div>
        </div>
    );
};

/**
 * InvView: The Right Panel rendering the Inventory and Vault.
 * Reactively subscribes to `state.inventory`.
 */
export const InvView = () => {
    const rawInventory = useGameState(state => state.inventory?.items || {});
    const capacityUsed = useGameState(state => state.inventory?.slots?.used || 0);
    const capacityMax = useGameState(state => state.inventory?.slots?.max || 20);

    // Hydrate the inventory object into an array with rich item data
    const inventoryList = Object.entries(rawInventory).map(([id, data]) => ({
        id,
        quantity: data.quantity,
        data: getItem(id) || {}
    })).filter(item => item.data && item.quantity > 0);

    // Categorize
    const materials = inventoryList.filter(i =>
        i.data.type === ITEM_TYPES.MATERIAL || i.data.type === ITEM_TYPES.DROP || i.data.type === ITEM_TYPES.CURRENCY
    );
    const consumables = inventoryList.filter(i =>
        i.data.type === ITEM_TYPES.FOOD || i.data.type === ITEM_TYPES.POTION
    );
    const gear = inventoryList.filter(i =>
        i.data.type === ITEM_TYPES.WEAPON || i.data.type === ITEM_TYPES.ARMOR || i.data.type === ITEM_TYPES.TOOL
    );

    const ItemList = ({ items, emptyMessage }) => (
        <div className="space-y-2 pb-6 pr-2">
            {items.length === 0 ? (
                <div className="text-center p-6 text-gi-muted/50 border-2 border-dashed border-gi-border/30 rounded-xl mt-4">
                    <p className="text-sm">{emptyMessage}</p>
                </div>
            ) : (
                items.map(item => (
                    <InvItemRow key={item.id} itemId={item.id} quantity={item.quantity} />
                ))
            )}
        </div>
    );

    return (
        <div className="w-80 h-full bg-gi-surface/90 backdrop-blur-md border-l border-gi-border flex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.5)] z-[90]">

            {/* Header */}
            <div className="p-4 border-b border-gi-border/50 bg-gi-base/50 flex items-center justify-between shadow-md">
                <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-gi-accent/20 rounded border border-gi-accent/30">
                        <Package className="w-5 h-5 text-gi-accent" />
                    </div>
                    <h2 className="font-display font-bold text-lg text-gi-text tracking-wider text-shadow-neon">VAULT</h2>
                </div>
                <div className={cn(
                    "text-xs font-bold px-2 py-1 rounded border",
                    capacityUsed >= capacityMax
                        ? "text-gi-danger bg-gi-danger/10 border-gi-danger/30"
                        : "text-gi-muted bg-gi-surface border-gi-border"
                )}>
                    {capacityUsed} / {capacityMax}
                </div>
            </div>

            {/* Content Tabs */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <GITabs
                    orientation="horizontal"
                    tabListClassName="mb-2 border-gi-border/30"
                    tabs={[
                        {
                            label: "Materials",
                            content: <ItemList items={materials} emptyMessage="No crafting materials." />
                        },
                        {
                            label: "Consumables",
                            content: <ItemList items={consumables} emptyMessage="No food or potions." />
                        },
                        {
                            label: "Gear",
                            content: <ItemList items={gear} emptyMessage="No weapons or armor." />
                        }
                    ]}
                />
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-gi-border/50 bg-gi-base/30 text-[10px] text-center text-gi-muted uppercase tracking-widest font-bold">
                Item limit managed by Guild Level
            </div>
        </div>
    );
};

export default InvView;
