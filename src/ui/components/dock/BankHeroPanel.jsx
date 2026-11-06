import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '../../utils/cn.js';
import { useEscapeLayer } from '../../utils/escapeLayers.js';
import { useGameState } from '../../hooks/useGameState.js';
import { useEntityDrop } from '../../dnd/DndKit.jsx';
import { DND_SURFACE, DRAG_KIND } from '../../dnd/dragConstants.js';
import { HeroDockTab } from './HeroDockTab.jsx';
import { HeroInspectionSheet } from '../drawer/HeroInspectionSheet.jsx';
import { PixelFrame, FRAME_KIND } from '../base/PixelFrame.jsx';
import { CloseX } from '../base/CloseX.jsx';
import { ArrowScrollList } from '../base/ArrowScrollList.jsx';
import { HeroManager } from '../../../systems/hero/HeroManager.js';
import { reorderHeroInDock } from './dockReorder.js';
import { NOTIFICATION_COLUMN, columnWidthCss } from '../board/boardConstants.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';
import { Feather } from 'lucide-react';

/** The panel's fade/slide-out (`duration-200`), plus a little slack. */
const PANEL_CLOSE_MS = 250;

const NO_HEROES = Object.freeze([]);

/** About two tabs. */
const TAB_SCROLL_STEP_PX = 160;

/**
 * The hero panel: one full-height side panel on the notification side, opened from the hero
 * bar or from the Bank, always in the same box (the Bank's hero column). Its outer edge is a side
 * space, Bank open or not: close and edit stand at its top and, while the Bank is open
 * (`showTabs`), the heroes stand under them as tabs, since the bar is under the Bank.
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
        [ENGINE_EVENTS.HEROES_UPDATED, ENGINE_EVENTS.GAME_RESET]
    ) || NO_HEROES;

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
                e.target.closest('[data-bank-tab]') ||
                // Opening the Bank keeps the panel: it stays in the same place beside it.
                e.target.closest('#bank-bubble-target')
            ) {
                return;
            }
            onCloseHero?.();
        };

        document.addEventListener('pointerdown', handlePointerDown);
        return () => document.removeEventListener('pointerdown', handlePointerDown);
    }, [selectedHeroId, onCloseHero]);

    useEscapeLayer(!!selectedHeroId, () => onCloseHero?.());

    // The open panel's whole box is a drawer target: a hero dropped on it is a miss (they keep
    // their order) rather than an order onto the mat hidden under the panel.
    const recall = useEntityDrop({
        id: 'hero-panel-drop',
        surface: DND_SURFACE.DRAWER,
        accepts: p => !!p?.heroId && (p.kind === DRAG_KIND.FLAG || p.kind === DRAG_KIND.HERO),
        onDrop: () => null,
        disabled: !shownHeroId
    });

    const handleReorderHero = useCallback((sourceHeroId, targetHeroId) =>
        reorderHeroInDock(HeroManager, heroIds, sourceHeroId, targetHeroId), [heroIds]);

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
                'absolute inset-y-0 z-(--z-hero-panel) pointer-events-none',
                isLeft ? 'left-0' : 'right-0'
            )}
        >
            {shownHeroId && (
                <div
                    ref={recall.setNodeRef}
                    {...recall.droppableProps}
                    data-dnd-region={DND_SURFACE.DRAWER}
                    className={cn(
                        'absolute inset-0 transition-all duration-200 ease-out',
                        isOpen
                            ? 'opacity-100 translate-x-0 pointer-events-auto'
                            : cn('opacity-0 pointer-events-none', isLeft ? '-translate-x-full' : 'translate-x-full')
                    )}
                >
                    <PixelFrame
                        kind={FRAME_KIND.STUDS}
                        backdrop="hero"
                        className="h-full"
                        frameClassName={cn(
                            isLeft ? 'pl-20' : 'pr-20',
                            recall.valid && 'outline-2 outline-gi-success/70'
                        )}
                    >
                        <HeroInspectionSheet heroId={shownHeroId} />
                    </PixelFrame>
                    <div
                        data-hero-panel-controls
                        className={cn('absolute top-2 z-20 w-20 flex items-center justify-center gap-0.5', isLeft ? 'left-0' : 'right-0')}
                    >
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onEditHero?.(shownHeroId); }}
                            data-hero-panel-edit
                            aria-label="Edit hero"
                            className="w-7 h-7 flex items-center justify-center text-gi-muted hover:text-[var(--color-ui-white)] transition-colors cursor-pointer"
                        >
                            {/* ⚠️ Placeholder quill until the owner draws one. */}
                            <Feather size={16} />
                        </button>
                        <CloseX data-hero-panel-close onClick={(e) => { e.stopPropagation(); onCloseHero?.(); }} />
                    </div>
                </div>
            )}

            {showTabs && (
                <HeroColumn
                    heroIds={heroIds}
                    selectedHeroId={selectedHeroId}
                    onSelectHero={onSelectHero}
                    onDoubleClickHero={onDoubleClickHero}
                    onReorder={handleReorderHero}
                    isLeft={isLeft}
                />
            )}
        </aside>
    );
};

/**
 * The hero tabs down the side space, centred under close and edit (their room is kept whether or
 * not a hero is open, so the tabs never jump); arrows when they outgrow it.
 */
// Memoised: the panel around it holds a drop target, which dnd-kit redraws at every drag start,
// end and change of target, and the list measures itself at every redraw.
const HeroColumn = memo(function HeroColumn({ heroIds, selectedHeroId, onSelectHero, onDoubleClickHero, onReorder, isLeft }) {
    return (
        <div
            data-hero-column
            className={cn('absolute inset-y-0 w-20 z-10 flex flex-col pt-11 pb-2', isLeft ? 'left-0' : 'right-0')}
        >
            <ArrowScrollList compact step={TAB_SCROLL_STEP_PX} className="flex-1 min-h-0 flex flex-col" barClassName="pointer-events-auto">
                {/* ⚠️ Centred with auto margins: a centred flex list cuts off its first tabs once it scrolls. */}
                <div className="my-auto flex flex-col gap-1">
                    {heroIds.map((heroId, index) => (
                        <HeroDockTab
                            key={heroId}
                            heroId={heroId}
                            index={index}
                            heroIds={heroIds}
                            isSelected={selectedHeroId === heroId}
                            onSelect={onSelectHero}
                            onDoubleClick={onDoubleClickHero}
                            onReorder={onReorder}
                            isDockLeft={isLeft}
                        />
                    ))}
                </div>
            </ArrowScrollList>
        </div>
    );
});

export default BankHeroPanel;
