import React from 'react';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { ItemIcon } from '../base/ItemIcon.jsx';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { SLOT_ORDER, SLOT_INFO } from '../../../config/registries/equipmentConstants.js';

/**
 * DockEquipmentGrid — the pinned card's equipment section (concept §3 §2):
 * the six slots in 2 rows of 3, as 32px item sprites and nothing else. The
 * item's name and slot live in the hover tooltip so the grid stays a clean
 * block of icons at this width.
 *
 * Click-to-unequip and item drops land in Phase 6; for now a filled slot is
 * inert and shows its tooltip.
 */
export const DockEquipmentGrid = ({ heroId }) => {
    // Flat projection of the six slots — see the useGameState selector
    // contract; returning `hero.equipment` itself would share the live object
    // and this would silently stop updating.
    const equipment = useGameState(
        state => {
            const hero = (state.heroes || []).find(h => h.id === heroId);
            if (!hero) return null;
            return SLOT_ORDER.map(slot => hero.equipment?.[slot] || null).join('|');
        },
        ['heroes_updated', 'hero_equipment_changed'],
        null,
        { deps: [heroId] }
    );

    if (equipment === null) return null;
    const itemIds = equipment.split('|').map(id => (id === '' ? null : id));

    return (
        <div className="grid grid-cols-3 gap-1 px-2 py-1.5">
            {SLOT_ORDER.map((slot, i) => {
                const itemId = itemIds[i];
                const item = itemId ? getItem(itemId) : null;
                const slotLabel = SLOT_INFO[slot]?.label || slot;

                return (
                    <div
                        key={slot}
                        title={item ? `${item.name} — ${slotLabel}` : `${slotLabel} (empty)`}
                        className={cn(
                            'h-9 rounded border flex items-center justify-center',
                            item
                                ? 'border-gi-primary/40 bg-gi-primary/5'
                                : 'border-dashed border-gi-border/50 bg-black/20'
                        )}
                    >
                        {item ? (
                            <span style={{ imageRendering: 'pixelated' }}>
                                <ItemIcon item={item} size={32} />
                            </span>
                        ) : (
                            <span className="text-[9px] leading-none opacity-30">
                                {SLOT_INFO[slot]?.icon}
                            </span>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default DockEquipmentGrid;
