import { useEffect, useRef, useState } from 'react';
import { cn } from '../../utils/cn.js';
import { useEscapeLayer } from '../../utils/escapeLayers.js';
import { useEntityDrop } from '../../dnd/DndKit.jsx';
import { DND_SURFACE, DRAG_KIND } from '../../dnd/dragConstants.js';
import { HeroInspectionSheet } from '../drawer/HeroInspectionSheet.jsx';
import { PixelFrame, FRAME_KIND } from '../base/PixelFrame.jsx';
import { CloseX } from '../base/CloseX.jsx';
import { NOTIFICATION_COLUMN, columnWidthCss } from '../board/boardConstants.js';
import { DOCK_STRIP_PX } from './dockHeroView.js';
import { Feather } from 'lucide-react';

/** The panel's fade/slide-out (`duration-200`), plus a little slack. */
const PANEL_CLOSE_MS = 250;

/**
 * The hero panel: a side panel on the notification side, opened from the hero bar, from the top
 * of the screen down to the bar (which is drawn over the side drawers). Its outer edge is a side
 * space where close and edit stand.
 */
export const BankHeroPanel = ({
    menuRight,
    selectedHeroId,
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
        accepts: p => !!p?.heroId && p.kind === DRAG_KIND.FLAG,
        onDrop: () => null,
        disabled: !shownHeroId
    });

    if (!shownHeroId) return null;

    const isOpen = Boolean(selectedHeroId);
    // The panel sits on the side opposite the nav.
    const isLeft = menuRight;

    return (
        <aside
            ref={asideRef}
            data-hero-panel="true"
            style={{ width: columnWidthCss(NOTIFICATION_COLUMN), bottom: DOCK_STRIP_PX }}
            className={cn(
                'absolute top-0 z-(--z-hero-panel) pointer-events-none',
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
        </aside>
    );
};

export default BankHeroPanel;
