import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { useEngine } from '../../hooks/useEngine.js';
import { useEntityDrop } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import { HeroDockTab } from './HeroDockTab.jsx';
import { HeroInspectionSheet } from '../drawer/HeroInspectionSheet.jsx';
import { BOARD_PX } from '../board/boardConstants.js';

/**
 * RightmostHeroDock — vertical sliding tabs dock on the far right edge of the screen.
 * - Sized to BOARD_PX height so top hero lines up with playmat & tray, but
 *   capped to the window: the playmat scales down on short windows (CR2-179).
 * - Hero Dock tabs sit above the inspection sheet (z-30 vs z-20).
 * - Full hero inspection sheet renders tucked behind the dock at a fixed position covering the Tray.
 */
export const RightmostHeroDock = ({
    selectedHeroId,
    onSelectHero,
    onDoubleClickHero,
    onCloseHero,
    onEditHero
}) => {
    const heroIds = useGameState(
        state => (state.heroes || []).map(h => h.id),
        ['heroes_updated', 'state_changed']
    ) || [];

    const engine = useEngine();

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
            ref={recall.setNodeRef}
            data-dnd-surface="rightmost-dock"
            data-dnd-region={DND_SURFACE.DRAWER}
            style={{ height: BOARD_PX, maxHeight: '100%' }}
            className={cn(
                'w-20 shrink-0 flex flex-col justify-start gap-1.5 pointer-events-auto select-none relative z-30 pr-0 overflow-visible',
                recall.valid && 'ring-2 ring-gi-success/70 bg-gi-success/5 rounded-l-xl'
            )}
            {...recall.droppableProps}
        >
            {/* Fixed-position Hero Inspection Sheet tucked behind the hero dock tabs (z-20) */}
            {selectedHeroId && (
                <div
                    style={{ height: BOARD_PX, maxHeight: '100%', top: 0 }}
                    className="absolute right-full w-72 md:w-80 xl:w-[320px] 2xl:w-[340px] z-20 pointer-events-auto animate-in fade-in slide-in-from-right-4 duration-200"
                >
                    <HeroInspectionSheet
                        heroId={selectedHeroId}
                        onClose={onCloseHero}
                        onEdit={onEditHero}
                    />
                </div>
            )}

            {/* Hero Dock Tabs (z-30, sitting above the inspection sheet) */}
            {heroIds.map((heroId) => (
                <HeroDockTab
                    key={heroId}
                    heroId={heroId}
                    isSelected={selectedHeroId === heroId}
                    onSelect={onSelectHero}
                    onDoubleClick={onDoubleClickHero}
                    onEdit={onEditHero}
                />
            ))}
        </aside>
    );
};

export default RightmostHeroDock;
