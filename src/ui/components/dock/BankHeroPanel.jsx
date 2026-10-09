import { useEffect, useRef, useState } from 'react';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { useEngine } from '../../hooks/useEngine.js';
import { useEntityDrop } from '../../dnd/DndKit.jsx';
import { DND_SURFACE } from '../../dnd/dragConstants.js';
import { HeroDockTab } from './HeroDockTab.jsx';
import { HeroInspectionSheet } from '../drawer/HeroInspectionSheet.jsx';
import { HeroManager } from '../../../systems/hero/HeroManager.js';
import { reorderHeroInDock } from './dockReorder.js';
import { isRecallDrop, recallFromDrop } from './dockRecall.js';
import { NOTIFICATION_COLUMN, columnWidthCss } from '../board/boardConstants.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';

/** The panel's fade/slide-out (`duration-200`), plus a little slack. */
const PANEL_CLOSE_MS = 250;

/**
 * The hero panel: one full-height side panel on the notification side, opened from the hero
 * bar or from the Bank, always in the same box (the Bank's hero column). While the Bank is
 * open (`showTabs`) the heroes also stand as tabs along the outer edge, since the bar is
 * under the Bank.
 */
export const BankHeroPanel = ({
    menuRight,
    showTabs = true,
    selectedHeroId,
    onSelectHero,
    onDoubleClickHero,
    onCloseHero,
    onEditHero
}) => {
    const asideRef = useRef(null);
    const engine = useEngine();
    const [shownHeroId, setShownHeroId] = useState(selectedHeroId);

    // ⚠️ The loadout slots are live drop targets and dnd-kit ignores opacity and
    // pointer-events, so a closed panel must be unmounted (after its fade-out) or it refuses
    // mat drops inside its box.
    useEffect(() => {
        if (selectedHeroId) {
            setShownHeroId(selectedHeroId);
            return undefined;
        }
        const timer = setTimeout(() => setShownHeroId(null), PANEL_CLOSE_MS);
        return () => clearTimeout(timer);
    }, [selectedHeroId]);

    const heroIds = useGameState(
        state => (state.heroes || []).map(h => h.id),
        [ENGINE_EVENTS.HEROES_UPDATED, ENGINE_EVENTS.STATE_CHANGED]
    ) || [];

    useEffect(() => {
        if (!selectedHeroId) return undefined;

        const handlePointerDown = (e) => {
            if (asideRef.current && asideRef.current.contains(e.target)) return;
            if (
                // The bar's own click picks or toggles a hero.
                e.target.closest('[data-bottom-hero-dock]') ||
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
            // One Escape, one layer: while a drag is live, Escape only cancels it. dnd-kit's
            // Escape listener attaches at pointerdown, after this one, so the class is still
            // on the body when this runs.
            if (e.key === 'Escape' && !document.body.classList.contains('gi-dnd-active')) {
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

    // The open panel's whole box is a drawer target: a hero or flag dropped on it goes home,
    // and anything else is a miss rather than landing on the mat hidden under the panel.
    const recall = useEntityDrop({
        id: 'hero-panel-drop',
        surface: DND_SURFACE.DRAWER,
        accepts: isRecallDrop,
        onDrop: p => recallFromDrop(engine.BoardPlacement, p),
        disabled: !shownHeroId
    });

    const handleReorderHero = (sourceHeroId, targetHeroId) =>
        reorderHeroInDock(HeroManager, heroIds, sourceHeroId, targetHeroId);

    if (!showTabs && !shownHeroId) return null;

    const isOpen = Boolean(selectedHeroId);
    // The panel sits on the side opposite the nav.
    const isLeft = menuRight;

    return (
        <aside
            ref={asideRef}
            data-hero-panel="true"
            style={{ width: columnWidthCss(NOTIFICATION_COLUMN) }}
            className={cn(
                'absolute inset-y-0 z-[100] pointer-events-none',
                isLeft ? 'left-0' : 'right-0'
            )}
        >
            {shownHeroId && (
                <div
                    ref={recall.setNodeRef}
                    {...recall.droppableProps}
                    data-dnd-region={DND_SURFACE.DRAWER}
                    className={cn(
                        'absolute inset-0 bg-[#140e0b] shadow-[0_0_30px_rgba(0,0,0,0.7)] transition-all duration-200 ease-out',
                        isLeft ? 'border-r' : 'border-l',
                        recall.valid ? 'border-gi-success/70' : 'border-white/10',
                        showTabs && (isLeft ? 'pl-20' : 'pr-20'),
                        isOpen
                            ? 'opacity-100 translate-x-0 pointer-events-auto'
                            : cn('opacity-0 pointer-events-none', isLeft ? '-translate-x-full' : 'translate-x-full')
                    )}
                >
                    <HeroInspectionSheet
                        heroId={shownHeroId}
                        onClose={onCloseHero}
                        onEdit={onEditHero}
                    />
                </div>
            )}

            {showTabs && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 py-4 z-[110]">
                    {heroIds.map((heroId, index) => (
                        <div key={heroId} className="w-full h-[72px] relative">
                            <HeroDockTab
                                heroId={heroId}
                                index={index}
                                heroIds={heroIds}
                                isSelected={selectedHeroId === heroId}
                                onSelect={onSelectHero}
                                onDoubleClick={onDoubleClickHero}
                                onEdit={onEditHero}
                                onReorder={handleReorderHero}
                                isDockLeft={isLeft}
                            />
                        </div>
                    ))}
                </div>
            )}
        </aside>
    );
};

export default BankHeroPanel;
