import React, { useMemo } from 'react';
import { cn } from '../../utils/cn.js';
import { getBiome } from '../../../config/registries/biomeRegistry.js';
import { getAreaSet } from '../../../config/registries/areaSetRegistry.js';
import { resolveSpritePath } from '../../../utils/AssetManager.js';
import { beginNativeDrag, endNativeDrag } from '../../dnd/nativeDrag.js';
import { GICard, CARD_TIERS } from '../../components/base/GICard.jsx';

/**
 * One owned card in the binder grid, rendered on the standard GICard frame
 * at the `sm` tier (owner design 2026-07-14: the binder stores cards you
 * HAVE — like items in the bank — so there are no unowned silhouettes).
 * Shows card art, name, ownership pips (owned/4) and deployment state.
 *
 * Memoized on the entry's display-relevant fields so search/filter/scroll
 * in the binder doesn't re-render (and flicker) unchanged tiles.
 */
export const BinderCardTile = React.memo(({ entry, isSelected, onSelect, draggable = false }) => {
    const { template, owned, alloc } = entry;
    const spritePath = useMemo(() => {
        const bgId = template.sprite || template.background || getBiome(template.areaId)?.backgroundImage || getAreaSet(template.areaSet)?.areaArt;
        const p = bgId ? resolveSpritePath(bgId) : null;
        return p ? (p.startsWith('/') ? p : `/${p}`) : null;
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
                'relative rounded-xl transition-all',
                isSelected && 'ring-2 ring-gi-primary',
                canDrag && 'cursor-grab active:cursor-grabbing'
            )}
        >
            <GICard
                imageSrc={spritePath}
                intent={template.cardType?.toLowerCase()}
                isUnique={template.isUnique}
                size="sm"
                width={CARD_TIERS.sm.w}
                className="bg-black/55"
            >
                <GICard.Header>
                    <div className="w-full bg-black/40 border-b border-white/10 px-1.5 py-1 relative z-10">
                        <span className="gi-card-title font-bold text-white tracking-wide uppercase text-center truncate block">
                            {template.name}
                        </span>
                    </div>
                </GICard.Header>

                {/* Deployment badge */}
                {fullyDeployed ? (
                    <span className="absolute top-8 right-1 z-20 px-1 py-0.5 rounded bg-gi-primary/80 text-[8px] font-bold gi-caps text-black">
                        Deployed
                    </span>
                ) : alloc.slotted.length > 0 && (
                    <span className="absolute top-8 right-1 z-20 px-1 py-0.5 rounded bg-black/70 text-[8px] font-bold text-gi-text">
                        {alloc.slotted.length} in use
                    </span>
                )}

                {/* Ownership pips — pinned to the card's bottom edge */}
                <div className="mt-auto z-10 bg-black/50 border-t border-white/10 px-1.5 py-1 flex items-center justify-center gap-1">
                    {[0, 1, 2, 3].map(i => (
                        <span
                            key={i}
                            className={cn(
                                'w-1.5 h-1.5 rounded-full border',
                                i < owned ? 'bg-gi-gold border-gi-gold' : 'border-white/25 bg-transparent'
                            )}
                        />
                    ))}
                    <span className="text-[8px] font-bold text-gi-muted tabular-nums ml-1">{Math.min(owned, 4)}/4</span>
                </div>
            </GICard>
        </button>
    );
}, (a, b) =>
    a.entry.id === b.entry.id
    && a.entry.owned === b.entry.owned
    && a.entry.alloc.available === b.entry.alloc.available
    && a.entry.alloc.slotted.length === b.entry.alloc.slotted.length
    && a.isSelected === b.isSelected
    && a.draggable === b.draggable
);

export default BinderCardTile;
