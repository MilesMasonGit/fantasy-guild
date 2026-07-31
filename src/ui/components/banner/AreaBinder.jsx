import React, { useMemo } from 'react';
import { HelpCircle } from 'lucide-react';
import { cn } from '../../utils/cn.js';
import { useEngine } from '../../hooks/useEngine.js';
import { getCard } from '../../../config/registries/cardRegistry.js';
import { getMaxCopies } from '../../../config/cards/cardEffects.js';
import { BinderManager } from '../../../systems/progression/BinderManager.js';
import { useEntityDrag } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import { useCardTier } from './BannerLayout.jsx';
import { GICard } from '../base/GICard.jsx';
import { CardPips } from '../card-modules/CardPips.jsx';
import { CardTitle, RowTemplateCard } from './bannerCards.jsx';

/**
 * AreaBinder — an area's own card collection, rendered beside its deck slots.
 *
 * This is the rework's central UI change (D-41/D-42). The old binder was one
 * global pile organised into player-created tabs, opened from a drawer and
 * dragged across the whole screen. Now every area owns a small palette, and
 * that palette lives right next to the four slots it feeds — so deck-building
 * is a local act with no cross-UI journey.
 *
 * The whole pool renders, not just what you own (D-44): uncollected cards show
 * as silhouettes so the finish line is always visible, which is what makes the
 * gap worth closing with a pack.
 */

/** One collected card — draggable into a deck slot, with its copy pips. */
const BinderCard = ({ areaId, templateId, owned, deployed, max }) => {
    const drag = useEntityDrag({
        id: `binder-${areaId}-${templateId}`,
        kind: DRAG_KIND.CARD,
        payload: { templateId, cardType: getCard(templateId)?.cardType },
        sourceSurface: DND_SURFACE.DRAWER,
        disabled: owned - deployed < 1
    });

    const spare = owned - deployed;
    const exhausted = spare < 1;

    return (
        <div className="shrink-0 flex flex-col items-center">
            <CardPips owned={owned} deployed={deployed} max={max} />
            <div
                ref={drag.setNodeRef}
                {...drag.handleProps}
                title={exhausted ? 'Every copy is already in the deck' : 'Drag into a slot'}
                className={cn(
                    'transition-opacity',
                    exhausted ? 'opacity-40 cursor-default' : 'cursor-grab active:cursor-grabbing',
                    drag.isDragging && 'opacity-40'
                )}
            >
                <RowTemplateCard templateId={templateId} areaId={areaId} />
            </div>
        </div>
    );
};

/** An uncollected card — a silhouette holding its place in the pool (D-44). */
const BinderSilhouette = ({ max }) => {
    const { size, width } = useCardTier();
    return (
        <div className="shrink-0 flex flex-col items-center">
            <CardPips owned={0} deployed={0} max={max} />
            <GICard imageSrc={null} intent="area" size={size} width={width} className="bg-black/60 opacity-60">
                <GICard.Header>
                    <CardTitle sub="Not collected">???</CardTitle>
                </GICard.Header>
                <GICard.Main className="justify-center items-center">
                    <HelpCircle size={44} className="text-white/25" />
                </GICard.Main>
            </GICard>
        </div>
    );
};

export const AreaBinder = ({ areaId }) => {
    const engine = useEngine();

    // The pool is authored content, so it only changes when the registry does.
    const pool = useMemo(() => BinderManager.getPool(areaId), [areaId]);

    const entries = pool.map(templateId => {
        const template = getCard(templateId);
        const owned = BinderManager.getOwned(templateId, areaId);
        const deployed = engine.DeckSlotManager.getAllocations(templateId).slotted.length;
        return { templateId, template, owned, deployed, max: getMaxCopies(template) };
    });

    if (entries.length === 0) {
        return (
            <span className="text-[11px] text-gi-muted italic px-3 self-center">
                No cards discovered here yet — buy a pack to start this area's collection.
            </span>
        );
    }

    return (
        <>
            {entries.map(e => (
                e.owned > 0
                    ? <BinderCard key={e.templateId} areaId={areaId} {...e} />
                    : <BinderSilhouette key={e.templateId} max={e.max} />
            ))}
        </>
    );
};

export default AreaBinder;
