import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { useEngine } from '../../hooks/useEngine.js';
import { useEntityDrop, mergeRefs } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import { HeroDockTab } from './HeroDockTab.jsx';
import { HeroInspectionSheet } from '../drawer/HeroInspectionSheet.jsx';
import { BOARD_PX } from '../../../config/boardGeometry.js';
import { HeroManager } from '../../../systems/hero/HeroManager.js';

/**
 * RightmostHeroDock — vertical sliding tabs dock on the far right edge of the screen.
 * - Sized to BOARD_PX height so top hero lines up with playmat & tray, but
 *   capped to the window: the playmat scales down on short windows (CR2-179).
 * - Hero Dock tabs sit above the inspection sheet (z-30 vs z-20).
 * - Full hero inspection sheet renders tucked behind the dock at a fixed position covering the Tray.
 */
export const RightmostHeroDock = ({
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

            // When clicking or dragging inside a drawer (e.g. Item Bank) or on items, do not close hero inspection
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
        id: 'rightmost-dock-recall',
        surface: DND_SURFACE.DRAWER,
        accepts: p => p.kind === DRAG_KIND.HERO && (p.from?.tile != null || !!p.from?.areaId),
        onDrop: p => {
            if (p.from?.tile != null) {
                engine.Placement?.recallHero(p.from.tile);
            } else if (p.from?.areaId) {
                engine.HeroAssignmentManager?.unassignHero(p.from.areaId);
            }
        }
    });

    return (
        <aside
            ref={mergeRefs(recall.setNodeRef, asideRef)}
            data-dnd-region={DND_SURFACE.DRAWER}
            style={{ height: BOARD_PX, maxHeight: '100%' }}
            className={cn(
                'w-20 shrink-0 flex flex-col justify-start gap-2 pointer-events-auto select-none relative z-40 pr-0 overflow-visible',
                recall.valid && 'ring-2 ring-gi-success/70 bg-gi-success/5 rounded-l-xl'
            )}
            {...recall.droppableProps}
        >
            {/* Full-width Hero Inspection Sheet underlapping the hero dock tabs with smooth slide in/out */}
            <div
                style={{ height: BOARD_PX, maxHeight: '100%', top: 0 }}
                className={cn(
                    "absolute right-0 w-[368px] md:w-[400px] xl:w-[400px] 2xl:w-[420px] z-30 transition-all duration-200 ease-out",
                    isOpen
                        ? "translate-x-0 opacity-100 pointer-events-auto"
                        : "translate-x-full opacity-0 pointer-events-none"
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

            {/* Hero Dock Tabs (sitting above the inspection sheet with layout motion) */}
            {heroIds.map((heroId, index) => (
                <motion.div
                    key={heroId}
                    layout="position"
                    transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                    className="w-full flex justify-end overflow-visible relative"
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
        </aside>
    );
};

export default RightmostHeroDock;
