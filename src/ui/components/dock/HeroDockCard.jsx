import React from 'react';
import { cn } from '../../utils/cn.js';
import { useEngine } from '../../hooks/useEngine.js';
import { HeroDockTab } from './HeroDockTab.jsx';
import { DockEquipmentGrid } from './DockEquipmentGrid.jsx';
import { DockSkillsGrid } from './DockSkillsGrid.jsx';
import { DOCK_TAB_W, DOCK_TAB_W_SMALL, DOCK_TAB_H, DOCK_CARD_BODY_H } from './dockConstants.js';
import { useEntityDrop, ACCEPT_CLS, REJECT_CLS } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
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
export const HeroDockCard = ({
    heroId, pinned = false, small = false, onToggle, onEdit,
    bodyView = 'equipment', onToggleBodyView
}) => {
    const engine = useEngine();
    // The strip reserves only the collapsed footprint in Small Mode; a pinned
    // card expands to full width over its neighbours, which is fine because
    // pinned cards carry the highest z-index in the strip.
    const slotWidth = small && !pinned ? DOCK_TAB_W_SMALL : DOCK_TAB_W;

    // The header (HeroDockTab) is its own drop target for equipping while
    // COLLAPSED — but once pinned, the header is a thin strip sitting above
    // the equipment grid a player is actually aiming at, and the grid's own
    // slots don't register drops (equipItem always resolves its own target
    // slot, so per-slot precision isn't needed — just *a* drop zone over the
    // grid). Without this, dropping an item onto the visibly-open grid
    // silently did nothing (found 2026-08-02: reported as "can't equip food",
    // but the gap applies to every category — food was just the item being
    // tested by hand at the time).
    const bodyDrop = useEntityDrop({
        id: `dock-card-body-drop-${heroId}`,
        surface: DND_SURFACE.DRAWER,
        accepts: p => p.kind === DRAG_KIND.ITEM && p.fromHeroId !== heroId,
        onDrop: p => {
            if (p.fromHeroId && p.fromSlot) {
                engine.EquipmentManager.unequipItem(p.fromHeroId, p.fromSlot);
            }
            engine.EquipmentManager.equipItem(heroId, p.itemId);
        }
    });

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
                        ref={bodyDrop.setNodeRef}
                        className={cn(
                            'relative border border-t-0 border-gi-primary/60 bg-gi-surface',
                            'animate-in fade-in slide-in-from-bottom-2 duration-200',
                            bodyDrop.valid && ACCEPT_CLS,
                            bodyDrop.invalid && REJECT_CLS
                        )}
                        style={{ height: DOCK_CARD_BODY_H }}
                        {...bodyDrop.droppableProps}
                    >
                        {/* One section at a time. Rendering both stacked
                            overflowed the body and silently clipped the last
                            rows of skills (found 2026-08-02), and making the
                            card tall enough for both would have swallowed the
                            screen — so they share the space and the player
                            picks. The toggle is dock-wide, so two open cards
                            always compare like with like. */}
                        <DockBodyToggle
                            view={bodyView}
                            onToggle={onToggleBodyView}
                            onEdit={onEdit}
                        />

                        {bodyView === 'skills'
                            ? <DockSkillsGrid heroId={heroId} />
                            : <DockEquipmentGrid heroId={heroId} />}
                    </div>
                )}
            </div>
        </div>
    );
};

/**
 * DockBodyToggle — the card body's one control row: a two-segment Gear/Skills
 * switch plus the Edit button.
 *
 * Both labels stay visible with the active one filled, rather than a single
 * button naming the *other* side: at this size a lone "Skills" button is
 * genuinely ambiguous about whether it names what you're looking at or what
 * you'd get by pressing it.
 *
 * Edit sits here rather than floating over the bottom-right of the grid, where
 * it used to cover the ninth equipment slot. Putting every control in one row
 * also keeps the whole body below the concept's 300px expanded-card ceiling.
 */
const DockBodyToggle = ({ view, onToggle, onEdit }) => (
    <div className="flex items-stretch gap-0.5 px-2 pt-1.5 pb-0.5">
        {['equipment', 'skills'].map(id => {
            const active = view === id;
            return (
                <button
                    key={id}
                    type="button"
                    // Both segments call the same toggle: with exactly two
                    // options, pressing the active one is a no-op the player
                    // never notices, and this keeps the switch a single piece
                    // of state rather than a setter with an invalid third value.
                    onClick={active ? undefined : onToggle}
                    aria-pressed={active}
                    title={id === 'equipment'
                        ? 'Show this hero’s loadout'
                        : 'Show this hero’s skill levels'}
                    className={cn(
                        'flex-1 rounded px-1 py-0.5 border transition-colors',
                        'text-[8px] font-bold gi-caps tracking-wider',
                        active
                            ? 'border-gi-primary/60 bg-gi-primary/15 text-gi-text'
                            : 'border-gi-border/40 bg-black/30 text-gi-muted hover:text-gi-text'
                    )}
                >
                    {id === 'equipment' ? 'Gear' : 'Skills'}
                </button>
            );
        })}

        {/* Everything that isn't drag-and-drop lives behind this button
            (roadmap D8): rename, portrait, retire. */}
        <button
            type="button"
            onClick={onEdit}
            title="Edit this hero — name, portrait, retire"
            className={cn(
                'shrink-0 flex items-center justify-center px-1.5 rounded border',
                'border-gi-border/40 bg-black/30 text-gi-muted',
                'hover:text-gi-text hover:border-gi-primary/60 transition-colors'
            )}
        >
            <Pencil size={9} />
        </button>
    </div>
);

export default HeroDockCard;
