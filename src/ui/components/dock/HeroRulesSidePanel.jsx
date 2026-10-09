import { useEffect, useState } from 'react';
import { cn } from '../../utils/cn.js';
import { useEngine } from '../../hooks/useEngine.js';
import { useEntityDrop } from '../../dnd/DndKit.jsx';
import { DND_SURFACE } from '../../dnd/dragConstants.js';
import { FlagRulesPanel } from '../drawer/FlagRulesPanel.jsx';
import { isRecallDrop, recallFromDrop } from './dockRecall.js';
import { NOTIFICATION_COLUMN, columnWidthCss } from '../board/boardConstants.js';

/** The panel's fade/slide-out (`duration-200`), plus a little slack. */
const PANEL_CLOSE_MS = 250;

/**
 * A hero's work rules, in the hero panel's box on the notification side (`BankHeroPanel`), over
 * the mat. Opened from the gear on a hero in the bar (or a flag's gear); open until closed by
 * Escape or its X, so the player can watch the mat while changing rules.
 */
export const HeroRulesSidePanel = ({ menuRight, heroId, onClose }) => {
    const engine = useEngine();
    const [shownHeroId, setShownHeroId] = useState(heroId);

    // ⚠️ Unmounted after its fade-out: dnd-kit ignores opacity and pointer-events, so a closed
    // panel left mounted would still catch drops inside its box.
    useEffect(() => {
        if (heroId) {
            setShownHeroId(heroId);
            return undefined;
        }
        const timer = setTimeout(() => setShownHeroId(null), PANEL_CLOSE_MS);
        return () => clearTimeout(timer);
    }, [heroId]);

    useEffect(() => {
        if (!heroId) return undefined;
        const onKeyDown = (e) => {
            // One Escape, one layer: while a drag is live, Escape only cancels it.
            if (e.key === 'Escape' && !document.body.classList.contains('gi-dnd-active')) onClose?.();
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [heroId, onClose]);

    // As the hero panel: a hero or flag dropped on the open box goes home, anything else is a
    // miss rather than landing on the mat hidden under the panel.
    const recall = useEntityDrop({
        id: 'hero-rules-drop',
        surface: DND_SURFACE.DRAWER,
        accepts: isRecallDrop,
        onDrop: p => recallFromDrop(engine.BoardPlacement, p),
        disabled: !shownHeroId
    });

    if (!shownHeroId) return null;

    const isOpen = Boolean(heroId);
    const isLeft = menuRight;

    return (
        <aside
            data-hero-rules-panel={shownHeroId}
            style={{ width: columnWidthCss(NOTIFICATION_COLUMN) }}
            className={cn('absolute inset-y-0 z-[100] pointer-events-none', isLeft ? 'left-0' : 'right-0')}
        >
            <div
                ref={recall.setNodeRef}
                {...recall.droppableProps}
                data-dnd-region={DND_SURFACE.DRAWER}
                className={cn(
                    'absolute inset-0 bg-[#140e0b] shadow-[0_0_30px_rgba(0,0,0,0.7)] transition-all duration-200 ease-out',
                    isLeft ? 'border-r' : 'border-l',
                    recall.valid ? 'border-gi-success/70' : 'border-white/10',
                    isOpen
                        ? 'opacity-100 translate-x-0 pointer-events-auto'
                        : cn('opacity-0 pointer-events-none', isLeft ? '-translate-x-full' : 'translate-x-full')
                )}
            >
                <FlagRulesPanel heroId={shownHeroId} onClose={onClose} />
            </div>
        </aside>
    );
};

export default HeroRulesSidePanel;
