import React from 'react';
import { cn } from '../../utils/cn.js';
import { ItemIcon } from '../base/ItemIcon.jsx';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { Package } from 'lucide-react';

export const CompactInputModule = React.memo(({ trait, card, template, ...props }) => {
    const rawInputs = props.inputs || trait?.inputs || card?.inputs || template?.inputs || card?.config?.inputs || template?.config?.inputs || [];
    
    if (!rawInputs || rawInputs.length === 0) return null;

    return (
        <div className={cn("flex flex-col gap-2 w-full mt-2", props.className)}>
            <div className="text-[10px] uppercase font-bold tracking-widest text-[#6B7280]">
                Input(s)
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
                {rawInputs.map((input, index) => {
                    const itemDef = input.itemId ? getItem(input.itemId) : null;
                    const name = input.name || itemDef?.name || input.itemId || 'Unknown';
                    const icon = input.icon || itemDef?.icon || <Package size={16} />;
                    const qty = input.quantity || 1;

                    return (
                        <div key={`${input.itemId}-${index}`} className="flex items-center gap-1.5 p-1 bg-gi-surface/50 border border-gi-border rounded" title={name}>
                            <ItemIcon item={itemDef || input} size={24} isDiscovered={true} className="bg-black/40 border border-white/5 rounded shadow-inner" />
                            <span className="text-pixel-sm font-bold text-gi-text pr-1">x{qty}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
});

export default CompactInputModule;
