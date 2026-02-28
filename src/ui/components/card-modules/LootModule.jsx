import React from 'react';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { getAssetPath } from '../../../utils/AssetManager.js';

/**
 * Helper to convert enemy drops array to loot table items
 * @param {Array} drops - Enemy drops array [{itemId, minQty, maxQty, chance}]
 * @returns {Array} Formatted items array
 */
export const formatEnemyDrops = (drops) => {
    if (!drops || !Array.isArray(drops)) return [];
    return drops.map(drop => ({
        itemId: drop.itemId,
        min: drop.minQty || drop.min || 1,
        max: drop.maxQty || drop.max || 1,
        chance: drop.chance || 100
    }));
};

/**
 * Helper to convert task outputs array to loot table items
 * @param {Array} outputs - Task outputs array [{itemId, quantity, chance}]
 * @returns {Array} Formatted items array
 */
export const formatTaskOutputs = (outputs) => {
    if (!outputs || !Array.isArray(outputs)) return [];
    return outputs.map(output => ({
        itemId: output.itemId,
        quantity: output.quantity || 1,
        chance: output.chance || 100
    }));
};

const GILootModule = ({ items = [], title = 'Drops', mode = 'loot' }) => {
    if (!items || items.length === 0) return null;

    return (
        <div className="flex flex-col gap-1 w-full bg-[var(--color-bg-panel-inset)] rounded border border-white/5 p-2">
            <h4 className="text-[0.65rem] uppercase tracking-wider font-bold text-[var(--color-primary-neon)] mb-1 opacity-80">
                {title}
            </h4>
            <div className="grid grid-cols-2 gap-2">
                {items.map((item, index) => {
                    const itemDef = getItem(item.itemId);
                    const name = itemDef?.name || item.itemId;
                    const iconPath = itemDef ? getAssetPath('icons', itemDef.icon) : null;

                    // Format Quantity Text based on mode
                    let qtyText = '';
                    if (mode === 'loot' && item.min !== undefined && item.max !== undefined) {
                        qtyText = item.min === item.max ? `${item.min}` : `${item.min}-${item.max}`;
                    } else if (item.quantity !== undefined) {
                        qtyText = `${item.quantity}`;
                    } else {
                        qtyText = '1';
                    }

                    // Format Chance Text
                    const chance = item.chance !== undefined ? item.chance : 100;
                    const isRare = chance < 10;

                    return (
                        <div key={`${item.itemId}-${index}`} className="flex items-center gap-2 group relative">
                            {iconPath ? (
                                <img src={iconPath} alt={name} className="w-6 h-6 object-contain render-pixelated" title={name} />
                            ) : (
                                <div className="w-6 h-6 flex items-center justify-center bg-black/50 text-[10px] rounded" title={name}>
                                    📦
                                </div>
                            )}

                            <div className="flex flex-col leading-none">
                                <span className="text-[0.65rem] font-semibold text-[var(--color-text-primary)] truncate max-w-[80px]" title={name}>
                                    {name}
                                </span>
                                <div className="flex items-center gap-1">
                                    <span className="text-[0.6rem] text-[var(--color-text-secondary)]">
                                        x{qtyText}
                                    </span>
                                    {mode === 'loot' && (
                                        <span className={`text-[0.55rem] ${isRare ? 'text-[var(--color-rarity-epic)]' : 'text-[var(--color-primary-neon)] opacity-60'}`}>
                                            ({chance}%)
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default GILootModule;
