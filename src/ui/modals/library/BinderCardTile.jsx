import React, { useMemo } from 'react';
import { cn } from '../../utils/cn.js';
import { getBiome } from '../../../config/registries/biomeRegistry.js';
import { getAreaSet } from '../../../config/registries/areaSetRegistry.js';
import { resolveSpritePath } from '../../../utils/AssetManager.js';
import { beginNativeDrag, endNativeDrag } from '../../dnd/nativeDrag.js';
import { HelpCircle } from 'lucide-react';

/**
 * One card in a binder-style grid: art (silhouetted when unowned, §5H),
 * ownership pips (owned/4), and a deployed-count badge.
 *
 * Shared between the Collection Binder (gallery) and the Bottom Drawer's
 * Cards tab (Phase 7). Pass `draggable` to make it a native drag source for
 * banner-row slots — only cards with an available copy actually drag.
 */
export const BinderCardTile = ({ entry, isSelected, onSelect, draggable = false }) => {
    const { template, owned, alloc } = entry;
    const spritePath = useMemo(() => {
        const bgId = template.sprite || template.background || getBiome(template.areaId)?.backgroundImage || getAreaSet(template.areaSet)?.areaArt;
        return bgId ? resolveSpritePath(bgId) : null;
    }, [template]);

    const fullyDeployed = owned > 0 && alloc.available === 0;
    const canDrag = draggable && owned > 0 && alloc.available > 0;

    return (
        <button
            onClick={onSelect}
            draggable={canDrag}
            onDragStart={canDrag ? (e => beginNativeDrag(e, { kind: 'card', templateId: entry.id, cardType: template.cardType })) : undefined}
            onDragEnd={canDrag ? endNativeDrag : undefined}
            title={canDrag ? `${template.name} — drag onto an area's deck to slot it` : template.name}
            className={cn(
                "relative flex flex-col rounded-lg border overflow-hidden text-left transition-all group",
                isSelected ? "border-gi-primary shadow-[0_0_12px_rgba(255,255,255,0.15)]" : "border-gi-border hover:border-gi-muted",
                owned === 0 && "opacity-60",
                canDrag && "cursor-grab active:cursor-grabbing"
            )}
        >
            {/* Art */}
            <div className="relative aspect-[4/3] bg-gi-base overflow-hidden">
                {spritePath ? (
                    <img
                        src={spritePath.startsWith('/') ? spritePath : `/${spritePath}`}
                        alt={template.name}
                        className={cn(
                            "w-full h-full object-cover pixel-art transition-all",
                            owned === 0 && "grayscale brightness-[0.35]" // silhouette (§5H)
                        )}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gi-muted">
                        <HelpCircle size={24} />
                    </div>
                )}
                {fullyDeployed && (
                    <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-gi-primary/80 text-[9px] font-bold uppercase text-black">
                        Deployed
                    </span>
                )}
                {alloc.slotted.length > 0 && !fullyDeployed && (
                    <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-black/70 text-[9px] font-bold text-gi-text">
                        {alloc.slotted.length} in use
                    </span>
                )}
            </div>

            {/* Name + pips */}
            <div className="p-2 bg-gi-surface flex flex-col gap-1.5">
                <span className="text-xs font-bold text-gi-text truncate">{template.name}</span>
                <div className="flex items-center gap-1">
                    {[0, 1, 2, 3].map(i => (
                        <span
                            key={i}
                            className={cn(
                                "w-2 h-2 rounded-full border",
                                i < owned ? "bg-gi-gold border-gi-gold" : "border-gi-border bg-transparent"
                            )}
                        />
                    ))}
                    <span className="ml-auto text-[9px] text-gi-muted uppercase">{template.cardType}</span>
                </div>
            </div>
        </button>
    );
};

export default BinderCardTile;
