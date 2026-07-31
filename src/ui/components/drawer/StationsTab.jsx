import React, { useMemo } from 'react';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { getCard } from '../../../config/registries/cardRegistry.js';
import CardFactory from '../../../systems/cards/logic/CardFactory.js';
import ActiveCardFace from '../ActiveCardFace.jsx';
import { StationSlotManager } from '../../../systems/loop/StationSlotManager.js';
import { useEntityDrag } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import { Hammer } from 'lucide-react';

/**
 * Stations pane — owned station cards, draggable onto an area's Station Slot.
 *
 * This replaces the old global **Cards** pane, which was retired with the
 * global binder (D-41/D-42): adventure cards now live in each area's own
 * binder, rendered beside the slots they feed. Stations are the one card class
 * still owned globally, so they keep a small pane of their own.
 *
 * **Temporary by design.** Outposts become standalone banners with their own
 * single card slot (D-16), and Outpost cards move onto the Guild Hall tree
 * (D-34). When C-10/C-12 land, this pane goes too.
 */
const StationTile = ({ templateId, owned, selected, onInspect }) => {
    const template = useMemo(() => getCard(templateId), [templateId]);
    const mock = useMemo(() => {
        const inst = CardFactory.createInstance(templateId, {});
        if (inst) { inst.id = `stationtile-${templateId}`; inst.status = 'idle'; }
        return inst;
    }, [templateId]);

    const slotted = StationSlotManager.getSlottedCount(templateId);
    const free = owned - slotted;

    const drag = useEntityDrag({
        id: `station-src-${templateId}`,
        kind: DRAG_KIND.CARD,
        payload: { templateId, cardType: 'station' },
        sourceSurface: DND_SURFACE.DRAWER,
        disabled: free < 1
    });

    if (!template) return null;

    return (
        <div
            ref={drag.setNodeRef}
            {...drag.handleProps}
            onClick={() => onInspect?.('card', templateId)}
            title={free < 1 ? 'Every copy is installed' : 'Drag onto an area\'s Station Slot'}
            className={cn(
                'relative shrink-0 rounded-lg transition-opacity',
                free < 1 ? 'opacity-40' : 'cursor-grab active:cursor-grabbing',
                drag.isDragging && 'opacity-40',
                selected && 'ring-2 ring-gi-primary rounded-lg'
            )}
        >
            {mock ? (
                <ActiveCardFace cardId={mock.id} cardState={mock} template={template} showActions={false} size="sm" width={100} />
            ) : (
                <div className="w-[100px] h-[128px] rounded border border-gi-border bg-gi-base" />
            )}
            <div className="text-center text-[10px] font-bold text-gi-muted mt-0.5">
                {free}/{owned} free
            </div>
        </div>
    );
};

export const StationsTab = ({ selectedTemplateId, onInspect }) => {
    // Stations are the last users of the legacy global ownership map.
    const playsets = useGameState(
        state => state.collection?.playsets || {},
        ['collection_updated'],
        undefined,
        { deepClone: true }
    ) || {};

    const stations = Object.keys(playsets)
        .filter(id => (playsets[id] || 0) > 0 && getCard(id)?.cardType === 'station');

    if (stations.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-gi-muted p-4 text-center">
                <Hammer size={28} className="opacity-40" />
                <span className="text-xs italic">No station cards yet.</span>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto p-2">
            <div className="flex flex-wrap gap-2 items-start">
                {stations.map(id => (
                    <StationTile
                        key={id}
                        templateId={id}
                        owned={playsets[id]}
                        selected={selectedTemplateId === id}
                        onInspect={onInspect}
                    />
                ))}
            </div>
        </div>
    );
};

export default StationsTab;
