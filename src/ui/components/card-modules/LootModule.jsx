import React from 'react';
import { cn } from '../../utils/cn.js';
// import { getItem } from '../../../config/registries/itemRegistry.js'; // Will be used when integrating real data
import { Package } from 'lucide-react';

/**
 * Helper to convert enemy drops array to loot table items
 */
export const formatEnemyDrops = (drops) => {
    if (!drops || !Array.isArray(drops)) return [];

    return drops.map(drop => ({
        ...drop, // Preserve original data
        min: drop.minQty || drop.min || 1,
        max: drop.maxQty || drop.max || 1,
        chance: drop.chance || 100
    }));
};

/**
 * Helper to convert task outputs array to loot table items
 */
export const formatTaskOutputs = (outputs) => {
    if (!outputs || !Array.isArray(outputs)) return [];

    return outputs.map(output => ({
        ...output, // Preserve original data
        chance: output.chance || 100
    }));
};

/**
 * Renders a single loot item
 */
const LootItem = ({ item, mode }) => {
    // Fallback display if full item def isn't available yet
    // In production, we'd lookup: const itemDef = item.itemId ? getItem(item.itemId) : null;
    const name = item.name || item.itemId || 'Unknown';
    const icon = item.icon || <Package size={16} />;

    // Build quantity text
    let qtyText = '1';
    if (mode === 'loot' && item.min !== undefined && item.max !== undefined) {
        // Loot ranges: "1-3" or "1"
        qtyText = item.min === item.max ? `${item.min}` : `${item.min}-${item.max}`;
    } else if (item.minQty !== undefined && item.maxQty !== undefined) {
        // Alternative format from enemy drops
        qtyText = item.minQty === item.maxQty ? `${item.minQty}` : `${item.minQty}-${item.maxQty}`;
    } else if (item.quantity !== undefined) {
        // Fixed quantity for task outputs
        qtyText = `${item.quantity}`;
    }

    // Chance display - always show percentage
    const chance = item.chance !== undefined ? item.chance : 100;
    const isRare = chance < 10;

    return (
        <div
            className="flex items-center gap-2 p-1.5 w-full bg-gi-surface/50 border border-gi-border hover:border-gi-primary/30 rounded backdrop-blur-sm transition-colors"
            title={name}
        >
            <div className="w-8 h-8 rounded flex items-center justify-center bg-black/40 border border-white/5 flex-shrink-0 text-gray-300">
                {icon}
            </div>
            <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-gi-text truncate">{name}</span>
                <div className="flex flex-col items-end flex-shrink-0">
                    <span className="text-xs font-bold text-gi-primary">×{qtyText}</span>
                    <span className={cn(
                        "text-[10px] font-bold uppercase tracking-wider",
                        isRare ? "text-gi-accent text-shadow-neon" : "text-gi-muted"
                    )}>
                        {chance}%
                    </span>
                </div>
            </div>
        </div>
    );
};

/**
 * LootModule
 * Reusable module for displaying drops/outputs across card types.
 * Works for both combat cards (enemy drops) and task cards (item outputs).
 * 
 * @param {Object} props
 * @param {Array} props.items - Array of items to display [{itemId, quantity, min, max, chance}]
 * @param {string} props.title - Module title (e.g., "Possible Loot", "Outputs")
 * @param {string} props.mode - Display mode: 'loot' (ranges) or 'output' (fixed quantities)
 */
export const LootModule = ({ items = [], title = 'Drops', mode = 'loot', className }) => {
    if (!items || items.length === 0) return null;

    return (
        <div className={cn("flex flex-col gap-2 w-full mt-2", className)}>
            <div className="text-[10px] uppercase font-bold tracking-widest text-[#6B7280] border-b border-white/10 pb-0.5">
                {title}
            </div>

            <div className="flex flex-col gap-1.5">
                {items.map((item, index) => (
                    <LootItem key={`${item.itemId}-${index}`} item={item} mode={mode} />
                ))}
            </div>
        </div>
    );
};

export default LootModule;
