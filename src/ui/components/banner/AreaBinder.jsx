import React, { useMemo } from 'react';
import { cn } from '../../utils/cn.js';
import { useEngine } from '../../hooks/useEngine.js';
import { getCard } from '../../../config/registries/cardRegistry.js';
import { getMaxCopies } from '../../../config/cards/cardEffects.js';
import { BinderManager } from '../../../systems/progression/BinderManager.js';
import { useEntityDrag } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import { RowTemplateCard } from './bannerCards.jsx';

/**
 * AreaBinder — an area's own card collection: pool-building plus the card
 * tile (`BinderCard`) used to render it.
 *
 * This is the rework's central UI change (D-41/D-42). The old binder was one
 * global pile organised into player-created tabs, opened from a drawer and
 * dragged across the whole screen. Now every area owns a small palette, and
 * that palette lives right next to the four slots it feeds — so deck-building
 * is a local act with no cross-UI journey.
 *
 * Only owned cards render (owner call 2026-08-01, supersedes D-44's "show
 * every uncollected card as a silhouette") — the binder-expansion view is a
 * working tool, not a collection tracker; that job belongs to the Collection
 * Binder modal instead.
 *
 * The actual layout (a flat row vs. the solitaire-stacked binder-expansion
 * view) lives with the caller — `DeckFocusRow` feeds `useAreaBinderEntries`
 * into `BinderStackPanel`. This file only owns the pool data and the card tile.
 */

/** One collected card — draggable into a deck slot when a copy is spare.
 *  Renders in grayscale once every owned copy is already deployed (still
 *  yours, just nothing left to drag). `onClick` (optional) loads it into an
 *  inspection view instead of/alongside dragging it. */
export const BinderCard = ({ areaId, templateId, owned, deployed, onClick, selected = false }) => {
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
        <div
            ref={drag.setNodeRef}
            {...drag.handleProps}
            onClick={onClick}
            data-binder-card={templateId}
            title={exhausted ? 'Every copy is already in the deck' : 'Drag into a slot'}
            className={cn(
                'shrink-0 transition-all rounded-xl',
                exhausted ? 'grayscale cursor-default' : 'cursor-grab active:cursor-grabbing',
                drag.isDragging && 'opacity-40',
                selected && 'ring-2 ring-gi-primary'
            )}
        >
            <RowTemplateCard templateId={templateId} areaId={areaId} />
        </div>
    );
};

/** Pool + ownership/deployment for one area's binder, as `{templateId, template, owned, deployed, max}`. */
export function useAreaBinderEntries(areaId) {
    const engine = useEngine();

    // The pool is authored content, so it only changes when the registry does.
    const pool = useMemo(() => BinderManager.getPool(areaId), [areaId]);

    return pool.map(templateId => {
        const template = getCard(templateId);
        const owned = BinderManager.getOwned(templateId, areaId);
        const deployed = engine.DeckSlotManager.getAllocations(templateId).slotted.length;
        return { templateId, template, owned, deployed, max: getMaxCopies(template) };
    });
}
