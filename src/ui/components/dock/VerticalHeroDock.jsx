import React, { useEffect } from 'react';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { useEngine } from '../../hooks/useEngine.js';
import { useEntityDrop } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import { HeroDockCard } from './HeroDockCard.jsx';
import { DOCK_SFX } from './dockConstants.js';

export const VerticalHeroDock = ({ dock }) => {
    const heroIds = useGameState(
        state => (state.heroes || []).map(h => h.id),
        ['heroes_updated', 'state_changed']
    ) || [];

    const engine = useEngine();
    const { pinned, togglePin, unpinAll } = dock;
    const hasPinned = pinned.length > 0;

    const recall = useEntityDrop({
        id: 'vertical-dock-recall',
        surface: DND_SURFACE.DRAWER,
        accepts: p => p.kind === DRAG_KIND.HERO && !!p.from?.areaId,
        onDrop: p => engine.HeroAssignmentManager.unassignHero(p.from?.areaId)
    });

    const handleToggle = (heroId, isPinned) => {
        engine.EventBus.publish('audio:play', {
            clip: isPinned ? DOCK_SFX.unpin : DOCK_SFX.pin
        });
        togglePin(heroId);
    };

    useEffect(() => {
        if (!hasPinned) return;
        const onPointerUp = (e) => {
            if (e.target.closest?.('[data-dnd-surface="vertical-dock"]')) return;
            unpinAll();
        };
        document.addEventListener('pointerup', onPointerUp, true);
        return () => document.removeEventListener('pointerup', onPointerUp, true);
    }, [hasPinned, unpinAll]);

    return (
        <aside
            ref={recall.setNodeRef}
            data-dnd-surface="vertical-dock"
            data-dnd-region={DND_SURFACE.DRAWER}
            className={cn(
                'w-64 md:w-80 xl:w-[356px] shrink-0 flex flex-col h-full bg-gi-surface/90 border-r border-gi-border/40 pointer-events-auto transition-[width] duration-150',
                'overflow-y-auto custom-scrollbar p-2 space-y-2',
                recall.valid && 'ring-2 ring-gi-success/70 bg-gi-success/5'
            )}
            {...recall.droppableProps}
        >
            <h2 className="text-[10px] font-bold gi-caps text-gi-muted tracking-widest text-center py-2 border-b border-gi-border/40 mb-2">
                Hero Roster
            </h2>
            {heroIds.map((heroId) => {
                const isPinned = pinned.includes(heroId);
                return (
                    <div
                        key={heroId}
                        role="listitem"
                        data-hero-id={heroId}
                        data-pinned={isPinned || undefined}
                        className="flex justify-center w-full"
                    >
                        <HeroDockCard
                            heroId={heroId}
                            pinned={isPinned}
                            vertical={true}
                            small={false}
                            onToggle={() => handleToggle(heroId, isPinned)}
                            onEdit={() => dock.openEdit(heroId)}
                            bodyView={dock.bodyView}
                            onToggleBodyView={dock.toggleBodyView}
                        />
                    </div>
                );
            })}
            {heroIds.length === 0 && (
                <div className="flex-1 flex items-center justify-center text-gi-muted text-xs">
                    No heroes yet
                </div>
            )}
        </aside>
    );
};

export default VerticalHeroDock;
