import React from 'react';
import { cn } from '../../utils/cn.js';
import { HeroDockTab } from './HeroDockTab.jsx';
import { DockEquipmentGrid } from './DockEquipmentGrid.jsx';
import { DockSkillsGrid } from './DockSkillsGrid.jsx';
import { DOCK_TAB_W, DOCK_TAB_W_SMALL, DOCK_TAB_H, DOCK_CARD_BODY_H } from './dockConstants.js';
import { Pencil } from 'lucide-react';

/**
 * HeroDockCard — one hero's card in the dock, in both of its states
 * (concept §3, State A and State B).
 *
 * The card is a bottom-anchored column: the header sits on top, the body
 * (equipment + skills) hangs below it. Unpinned, the body simply isn't there,
 * so the card is exactly the header sitting on the dock line. Pinning mounts
 * the body, and because the column is anchored to its bottom edge the whole
 * card grows UPWARD — the "pull the card up out of your hand" motion, without
 * any transform juggling.
 *
 * The header is the very same `HeroDockTab` component in both states, which is
 * what makes the pull read as one continuous object rather than two different
 * widgets swapping places.
 */
export const HeroDockCard = ({ heroId, pinned = false, small = false, onToggle, onEdit }) => {
    // The strip reserves only the collapsed footprint in Small Mode; a pinned
    // card expands to full width over its neighbours, which is fine because
    // pinned cards carry the highest z-index in the strip.
    const slotWidth = small && !pinned ? DOCK_TAB_W_SMALL : DOCK_TAB_W;

    return (
        // The strip reserves only the header's footprint; the pinned body
        // overflows this box upward and is allowed to.
        <div className="relative" style={{ width: slotWidth, height: DOCK_TAB_H }}>
            <div
                className={cn(
                    'absolute bottom-0 left-0 flex flex-col',
                    pinned && 'rounded-t-xl shadow-[0_-10px_30px_rgba(0,0,0,0.6)]'
                )}
                style={{ width: slotWidth }}
            >
                <HeroDockTab
                    heroId={heroId}
                    onClick={onToggle}
                    pinned={pinned}
                    small={small}
                    // A pinned card must not also hover-lift: the lift would
                    // fight the pinned position and detach the header from
                    // the body it is sitting on.
                    lift={!pinned}
                />

                {pinned && (
                    <div
                        className={cn(
                            'relative border border-t-0 border-gi-primary/60 bg-gi-surface',
                            'animate-in fade-in slide-in-from-bottom-2 duration-200'
                        )}
                        style={{ height: DOCK_CARD_BODY_H }}
                    >
                        <DockEquipmentGrid heroId={heroId} />
                        <div className="mx-2 border-t border-gi-border/40" />
                        <DockSkillsGrid heroId={heroId} />

                        {/* Everything that isn't drag-and-drop lives behind
                            this button (roadmap D8): rename, portrait, retire. */}
                        <button
                            type="button"
                            onClick={onEdit}
                            title="Edit this hero — name, portrait, retire"
                            className={cn(
                                'absolute bottom-1 right-1 flex items-center gap-1 px-1.5 py-0.5 rounded',
                                'border border-gi-border/60 bg-black/50 text-gi-muted',
                                'text-[8px] font-bold gi-caps tracking-wider',
                                'hover:text-gi-text hover:border-gi-primary/60 transition-colors'
                            )}
                        >
                            <Pencil size={8} /> Edit
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default HeroDockCard;
