import React from 'react';
import { cn } from '../../utils/cn.js';
import { getStatusEffect } from '../../../config/registries/statusRegistry.js';

/**
 * StatusPlacards — minimal debug presentation of active status effects
 * (status_effects_concept.md §7): icon + name + stack count, with layered
 * instances of the same status consolidated into one placard.
 */
export const StatusPlacards = ({ statuses, className }) => {
    if (!statuses || statuses.length === 0) return null;

    // Consolidate layered instances: one placard per status id, stacks summed
    const consolidated = new Map();
    for (const instance of statuses) {
        const def = getStatusEffect(instance.id);
        if (!def) continue;
        const entry = consolidated.get(instance.id) || { def, stacks: 0 };
        entry.stacks += instance.stacks || 0;
        consolidated.set(instance.id, entry);
    }
    if (consolidated.size === 0) return null;

    return (
        <div className={cn('flex flex-wrap gap-1 justify-center', className)}>
            {[...consolidated.values()].map(({ def, stacks }) => (
                <div
                    key={def.id}
                    title={def.description || def.name}
                    className={cn(
                        'px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-1 border',
                        def.category === 'debuff'
                            ? 'bg-red-950/60 border-red-500/40 text-red-100'
                            : 'bg-green-950/60 border-green-500/40 text-green-100'
                    )}
                >
                    <span>{def.icon}</span>
                    <span>{def.name}</span>
                    {stacks > 1 && <span className="opacity-80">x{stacks}</span>}
                </div>
            ))}
        </div>
    );
};

export default StatusPlacards;
