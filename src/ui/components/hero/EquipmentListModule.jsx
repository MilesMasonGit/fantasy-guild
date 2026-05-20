import React from 'react';
import { cn } from '../../utils/cn.js';
import { getItem } from '../../../config/registries/index.js';
import { X } from 'lucide-react';
import { useEngine } from '../../hooks/useEngine.js';
import { ItemIcon } from '../base/ItemIcon.jsx';
import { Badge } from '../base/Badge.jsx';
import { useGameState } from '../../hooks/useGameState.js';
import { formatCompact } from '../../../utils/Formatters.js';

const SLOT_INFO = {
    weapon: { icon: '⚔️', label: 'WEAPON' },
    armor: { icon: '🛡️', label: 'ARMOR' },
    food: { icon: '🍱', label: 'FOOD' },
    drink: { icon: '🍺', label: 'DRINK' }
};

/**
 * EquipmentListModule
 * Standardized vertical list for hero equipment slots (Weapon, Armor, Food, Drink).
 */
export const EquipmentListModule = ({ hero, className }) => {
    const engine = useEngine();
    
    // Subscribe to inventory updates to keep quantities fresh
    const inventory = useGameState(
        state => engine.InventoryManager.getAllItems(),
        ['inventory_updated']
    );
    
    if (!hero) return null;

    const slots = ['weapon', 'armor', 'food', 'drink'];

    return (
        <div className={cn("flex flex-col gap-1 p-2 bg-gi-surface/20", className)}>
            {slots.map(slot => {
                const itemId = hero.equipment?.[slot];
                const item = itemId ? getItem(itemId) : null;
                const slotInfo = SLOT_INFO[slot];
                const count = item ? engine.InventoryManager.getItemCount(item.id) : 0;

                return (
                    <div 
                        key={slot} 
                        className={cn(
                            "flex items-center justify-between p-1.5 rounded border transition-all group relative overflow-hidden",
                            item
                                ? "bg-gi-surface border-gi-border shadow-sm"
                                : "bg-black/10 border-gi-border/10 opacity-70"
                        )}
                        onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (item) {
                                engine.EquipmentManager.unequipItem(hero.id, slot);
                            }
                        }}
                    >
                        <div className="flex items-center gap-3 overflow-hidden">
                            <div className="relative flex-shrink-0">
                                <div className={cn(
                                    "w-8 h-8 flex items-center justify-center rounded bg-gi-base border border-gi-border/40 shadow-inner overflow-hidden",
                                    !item && "opacity-30 grayscale"
                                )}>
                                    {item ? (
                                        <ItemIcon item={item} size={32} />
                                    ) : (
                                        <span className="text-xl leading-none opacity-50">{slotInfo.icon}</span>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-col min-w-0 justify-center">
                                <div className={cn(
                                    "gi-text-16 font-bold truncate leading-none tracking-tight font-sans gi-outline-2",
                                    item ? "text-gi-text" : "text-gi-muted/40 uppercase"
                                )}>
                                    {item?.name || slotInfo.label}
                                </div>
                            </div>
                        </div>

                        {/* 2. Count Badge / Action */}
                        <div className="flex items-center gap-2">
                            {item ? (
                                <div className="flex items-center gap-2">
                                    <Badge
                                        value={formatCompact(count, 1)}
                                        variant="count"
                                        size="base"
                                        className="font-mono bg-gi-base/50"
                                        title={`Available in Guild Hall: ${count}`}
                                    />
                                </div>
                            ) : (
                                <div className="text-[10px] font-bold text-gi-muted/20 uppercase tracking-widest mr-1">
                                    EMPTY
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default EquipmentListModule;
