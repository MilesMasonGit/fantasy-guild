// NOTE: dead component — nothing imports it (its original SLOT_INFO import
// never existed, so it could not have rendered). Kept for the Phase 9 sweep.
import React from 'react';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { InventoryManager } from '../../../systems/inventory/InventoryManager.js';
import { unequipItem } from '../../../systems/equipment/EquipmentManager.js';
import { getAssetPath } from '../../../utils/AssetManager.js';
import ItemDurabilityBar from '../vault/ItemDurabilityBar.jsx';

const SLOT_INFO = {
    weapon: { label: 'Weapon', icon: '⚔️' },
    armor: { label: 'Armor', icon: '🛡️' },
    food: { label: 'Food', icon: '🍱' },
    drink: { label: 'Drink', icon: '🍺' }
};

const EquipmentGrid = ({ heroId, equipment = {} }) => {
    const slots = ['weapon', 'armor', 'food', 'drink'];

    const handleRightClick = (e, slot, isFilled) => {
        if (!isFilled) return;
        e.preventDefault();
        // Direct system call — the old `window.gameEngine` global this used
        // to reference was never set, so unequip silently no-oped.
        unequipItem(heroId, slot);
    };

    return (
        <div className="grid grid-cols-2 gap-1 p-1 bg-black/40 rounded-md border border-[var(--color-bg-panel-inset)]">
            {slots.map(slot => {
                const itemId = equipment[slot];
                const slotInfo = SLOT_INFO[slot] || { label: slot, icon: '?' };

                if (itemId) {
                    const template = getItem(itemId);
                    const qty = InventoryManager.getItemCount(itemId);
                    const dur = InventoryManager.getDurability(itemId);

                    const name = template?.name || itemId;
                    const maxDur = template?.maxDurability;
                    const durText = dur !== null && maxDur ? ` (${dur}/${maxDur})` : '';
                    const titleText = `${name}${durText} - Right-click to unequip`;

                    const iconPath = template ? getAssetPath('icons', template.icon) : null;

                    const isMissing = qty === 0;
 
                    return (
                        <div
                            key={slot}
                            className={`relative flex items-center justify-center w-10 h-10 bg-[var(--color-bg-panel)] border rounded cursor-pointer hover:bg-[var(--color-bg-panel-inset)] transition-colors group ${
                                isMissing ? 'border-red-500/50 grayscale opacity-60' : 'border-[var(--color-rarity-rare)]/30'
                            }`}
                            title={titleText}
                            onContextMenu={(e) => handleRightClick(e, slot, true)}
                        >
                            {iconPath ? (
                                <img src={iconPath} alt={name} className="w-8 h-8 object-contain render-pixelated pointer-events-none" />
                            ) : (
                                <span className="text-sm">❓</span>
                            )}
 
                            {/* Quantity Badge */}
                            {qty > 1 && (
                                <div className="absolute -top-1 -right-1 bg-[var(--color-bg-panel-inset)] text-[var(--color-text-primary)] text-[0.55rem] font-bold px-1 rounded border border-[var(--color-text-secondary)]/30 pointer-events-none">
                                    {qty}
                                </div>
                            )}
 
                            {/* Durability Bar (Bottom) */}
                            {maxDur > 0 && (
                                <ItemDurabilityBar current={dur ?? 0} max={maxDur} />
                            )}
 
                            {/* Missing Overlay */}
                            {isMissing && (
                                <div className="absolute inset-0 flex items-center justify-center bg-red-900/20 pointer-events-none rounded">
                                    <span className="text-[10px] font-bold text-red-500/80 drop-shadow-sm uppercase">Empty</span>
                                </div>
                            )}
                        </div>
                    );
                }

                // Empty State
                return (
                    <div
                        key={slot}
                        className="relative flex items-center justify-center w-10 h-10 border border-dashed border-white/10 rounded opacity-50 transition-opacity empty-equipment-slot hover:opacity-100"
                        title={`${slotInfo.label} slot (empty)`}
                        onContextMenu={(e) => handleRightClick(e, slot, false)}
                        data-droppable-id={`equipment-${heroId}-${slot}`}
                    >
                        <span className="text-xl opacity-30 select-none grayscale">{slotInfo.icon}</span>
                    </div>
                );
            })}
        </div>
    );
};

export default EquipmentGrid;
