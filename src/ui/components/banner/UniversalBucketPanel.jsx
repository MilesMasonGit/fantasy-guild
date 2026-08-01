import React, { useMemo } from 'react';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { getCard } from '../../../config/registries/cardRegistry.js';
import { getMaxCopies } from '../../../config/cards/cardEffects.js';
import { BinderManager } from '../../../systems/progression/BinderManager.js';
import { DeckSlotManager } from '../../../systems/loop/DeckSlotManager.js';
import CardFactory from '../../../systems/cards/logic/CardFactory.js';
import ActiveCardFace from '../ActiveCardFace.jsx';
import { CardPips } from '../card-modules/CardPips.jsx';
import { useEntityDrag } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import { Globe } from 'lucide-react';

/**
 * UniversalBucketPanel — the Universal Bucket as a column beside the banners
 * (D-53).
 *
 * Universals (Rest, Campfire and similar) belong to no region: they are owned
 * globally, capped like any card, and the player decides which areas get them
 * (D-46). Because they apply to every banner they can't live inside one, so
 * they get a column of their own that scrolls independently of the banner
 * list — always reachable, whichever area you are looking at.
 *
 * The counter is deliberately global ("1 free of 2"): spending a copy in one
 * area must visibly reduce what's left for every other, since that allocation
 * choice is the whole mechanic.
 */
const UniversalCard = ({ templateId }) => {
    const template = useMemo(() => getCard(templateId), [templateId]);
    const mock = useMemo(() => {
        const inst = CardFactory.createInstance(templateId, {});
        if (inst) { inst.id = `universal-${templateId}`; inst.status = 'idle'; }
        return inst;
    }, [templateId]);

    const owned = BinderManager.getOwned(templateId);
    const deployed = DeckSlotManager.getAllocations(templateId).slotted.length;
    const free = owned - deployed;
    const max = getMaxCopies(template);

    const drag = useEntityDrag({
        id: `universal-src-${templateId}`,
        kind: DRAG_KIND.CARD,
        payload: { templateId, cardType: template?.cardType },
        sourceSurface: DND_SURFACE.DRAWER,
        disabled: free < 1
    });

    if (!template) return null;

    const title = owned < 1
        ? 'Not unlocked — buy a rank in the Guild Hall'
        : free < 1 ? 'Every copy is placed' : 'Drag onto any area\'s slot';

    return (
        <div className="flex flex-col items-center gap-0.5">
            <CardPips owned={owned} deployed={deployed} max={max} size="sm" />
            <div
                ref={drag.setNodeRef}
                {...drag.handleProps}
                title={title}
                className={cn(
                    'transition-opacity',
                    free < 1 ? 'opacity-40 cursor-default' : 'cursor-grab active:cursor-grabbing',
                    drag.isDragging && 'opacity-40'
                )}
            >
                {mock
                    ? <ActiveCardFace cardId={mock.id} cardState={mock} template={template} showActions={false} size="sm" width={96} />
                    : <div className="w-[96px] h-[122px] rounded border border-gi-border bg-gi-base" />}
            </div>
            <span className={cn(
                'text-[9px] font-bold uppercase tracking-wider',
                free > 0 ? 'text-gi-primary' : 'text-gi-muted'
            )}>
                {free} free of {owned}
            </span>
        </div>
    );
};

export const UniversalBucketPanel = () => {
    // Re-render whenever the bucket or any deck changes — a copy placed in one
    // area has to update the count shown for all of them.
    useGameState(
        state => {
            const bucket = state.collection?.universals || {};
            const owned = Object.keys(bucket).sort().map(id => `${id}:${bucket[id]}`).join(',');
            const decks = Object.entries(state.areaStates || {})
                .map(([id, a]) => `${id}:${(a.deckSlots || []).map(s => s.templateId || '_').join('|')}`)
                .join(';');
            return `${owned}#${decks}`;
        },
        ['collection_updated', 'state_changed', 'guild_upgrades_updated', 'area:deck_updated']
    );

    const pool = BinderManager.getUniversalPool();
    // Nothing authored yet, or nothing unlocked — stay out of the way.
    if (pool.length === 0) return null;
    const anyOwned = pool.some(id => BinderManager.getOwned(id) > 0);

    return (
        <aside
            data-dnd-surface="drawer"
            className="shrink-0 w-[124px] h-full overflow-y-auto custom-scrollbar border-l border-gi-primary/20 bg-black/25 pointer-events-auto"
        >
            <div className="sticky top-0 z-10 flex items-center gap-1.5 px-2 py-2 bg-black/60 backdrop-blur-sm border-b border-white/10">
                <Globe size={12} className="text-gi-primary shrink-0" />
                <span className="text-[9px] font-bold uppercase tracking-widest text-gi-muted leading-tight">
                    Universal
                </span>
            </div>

            <div className="flex flex-col items-center gap-3 p-2">
                {pool.map(id => <UniversalCard key={id} templateId={id} />)}
                {!anyOwned && (
                    <p className="text-[9px] text-gi-muted italic text-center leading-snug px-1">
                        Unlock these in the Guild Hall. They can be placed in any area.
                    </p>
                )}
            </div>
        </aside>
    );
};

export default UniversalBucketPanel;
