import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { useEngine } from '../../hooks/useEngine.js';
import { useEntityDrop, mergeRefs } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import { HeroDockTab } from './HeroDockTab.jsx';
import { HeroInspectionSheet } from '../drawer/HeroInspectionSheet.jsx';
import { HeroManager } from '../../../systems/hero/HeroManager.js';
import { isRecallDrop, recallFromDrop } from './dockRecall.js';

/**
 * Whether the horizontal hero dock shows under the main surface. It shows on
 * the playmat and is left out of the Guild Hall upgrade screen (Token
 * Lifecycle feedback Q7, FB-47). `fullscreenView` is `ui.fullscreen.view`.
 */
export function showsBottomHeroDock(fullscreenView) {
    return fullscreenView !== 'guild';
}

export const BottomHeroDock = ({
    isBankOpen = false,
    selectedHeroId,
    onSelectHero,
    onDoubleClickHero,
    onCloseHero,
    onEditHero
}) => {
    const asideRef = useRef(null);
    const [displayedHeroId, setDisplayedHeroId] = useState(selectedHeroId);

    const forceExpandTabs = Boolean(isBankOpen && !selectedHeroId);

    useEffect(() => {
        if (selectedHeroId) {
            setDisplayedHeroId(selectedHeroId);
        }
    }, [selectedHeroId]);

    const isOpen = Boolean(selectedHeroId);

    const heroIds = useGameState(
        state => (state.heroes || []).map(h => h.id),
        ['heroes_updated', 'state_changed']
    ) || [];

    const handleReorderHero = (sourceHeroId, targetHeroId) => {
        if (sourceHeroId === targetHeroId) return;
        const targetIndex = heroIds.indexOf(targetHeroId);
        if (targetIndex !== -1) {
            HeroManager.reorderHero(sourceHeroId, targetIndex);
        }
    };

    const engine = useEngine();

    useEffect(() => {
        if (!selectedHeroId) return;

        const handlePointerDown = (e) => {
            if (asideRef.current && asideRef.current.contains(e.target)) return;
            if (
                e.target.closest('[data-dnd-surface="drawer"]') ||
                e.target.closest('[data-dnd-region="drawer"]') ||
                e.target.closest('[data-item-id]') ||
                e.target.closest('[data-bank-tab]')
            ) {
                return;
            }
            onCloseHero?.();
        };

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onCloseHero?.();
            }
        };

        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [selectedHeroId, onCloseHero]);

    const recall = useEntityDrop({
        id: 'bottom-dock-recall',
        surface: DND_SURFACE.DRAWER,
        accepts: p => isRecallDrop(p) || (p.kind === DRAG_KIND.HERO && !!p.from?.areaId),
        onDrop: p => {
            if (isRecallDrop(p)) {
                recallFromDrop(engine.BoardPlacement, p);
            } else if (p.from?.areaId) {
                engine.HeroAssignmentManager?.unassignHero(p.from.areaId);
            }
        }
    });

    return (
        <aside
            ref={mergeRefs(recall.setNodeRef, asideRef)}
            data-dnd-region={DND_SURFACE.DRAWER}
            className={cn(
                'w-full shrink-0 flex flex-row items-end justify-center gap-2 pointer-events-auto select-none relative z-40 pb-4 pt-0 overflow-visible min-h-[88px]',
                recall.valid && 'ring-2 ring-gi-success/70 bg-gi-success/5 rounded-t-xl'
            )}
            {...recall.droppableProps}
        >
            {/* Full-width Hero Inspection Sheet sliding UP from the dock */}
            <div
                className={cn(
                    "absolute bottom-[80px] left-1/2 -translate-x-1/2 w-[368px] md:w-[400px] xl:w-[400px] 2xl:w-[420px] h-[700px] max-h-[75vh] z-30 transition-all duration-200 ease-out",
                    isOpen
                        ? "translate-y-0 opacity-100 pointer-events-auto"
                        : "translate-y-8 opacity-0 pointer-events-none"
                )}
            >
                {displayedHeroId && (
                    <HeroInspectionSheet
                        heroId={displayedHeroId}
                        onClose={onCloseHero}
                        onEdit={onEditHero}
                    />
                )}
            </div>

            {/* Hero Dock Tabs (sitting below the inspection sheet) */}
            <div className="flex flex-row justify-center gap-2 relative z-40">
                {heroIds.map((heroId, index) => (
                    <motion.div
                        key={heroId}
                        layout="position"
                        transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                        className="h-[72px] flex flex-col justify-end overflow-visible relative"
                    >
                        <HeroDockTab
                            heroId={heroId}
                            index={index}
                            heroIds={heroIds}
                            forceExpanded={forceExpandTabs}
                            isSelected={selectedHeroId === heroId}
                            onSelect={onSelectHero}
                            onDoubleClick={onDoubleClickHero}
                            onEdit={onEditHero}
                            onReorder={handleReorderHero}
                        />
                    </motion.div>
                ))}
            </div>
        </aside>
    );
};

export default BottomHeroDock;
