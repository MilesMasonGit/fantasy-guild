import React, { useCallback } from 'react';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import { tokenName, tokenSpritePath, getTokenType } from '../../../config/registries/tokenRegistry.js';
import { useEntityDrag, useEntityDrop, mergeRefs } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as Placement from '../../../systems/board/Placement.js';
import * as Cartographer from '../../../systems/board/Cartographer.js';
import * as NotificationSystem from '../../../systems/core/NotificationSystem.js';
import { Package } from 'lucide-react';

/**
 * Tray — the permanent staging area beside the board (D-107).
 *
 * ## Load-bearing, not decorative
 * Opening a Bank **covers the board**, so Tokens cannot be dragged from Bank to
 * tile directly. The flow is **Bank → Tray → Board**: pull Tokens into the Tray,
 * close the Bank, place from the Tray onto the visible board. Remove the Tray
 * and placement stops working.
 *
 * It also catches everything the board pushes back out — a displaced Token
 * (D-134), a Token lifted off a tile — and it is where purchased Maps land
 * (D-156), which is why it is roomy from the start (~15–20 slots, D-168) so a
 * full Map burst always fits.
 */
export const Tray = ({ onInspectToken }) => {
    const entries = useGameState(
        state => (state.board?.tray || []).map(t => ({
            typeId: t.typeId,
            usesRemaining: t.usesRemaining,
            isMap: !!getTokenType(t.typeId)?.mapId
        })),
        [BOARD_EVENTS.TILE_CHANGED, 'map_purchased', 'state_changed'],
        // ⚠️ `eventFilter`, not a default value — see the note in Board.jsx.
        null
    );

    // The Tray is also a drop target: dragging a Token off the board and onto
    // it is how you take something out of play without destroying it.
    const drop = useEntityDrop({
        id: 'tray',
        surface: DND_SURFACE.DRAWER,
        accepts: (p) => p.kind === DRAG_KIND.TOKEN && p.from?.tile != null,
        onDrop: (p) => { Placement.returnTokenToTray(p.from.tile); }
    });

    const capacity = BoardState.TRAY_CAPACITY;

    return (
        <aside
            ref={drop.setNodeRef}
            {...drop.droppableProps}
            className={cn(
                'w-64 shrink-0 flex flex-col min-h-0 bg-gi-base/50 border-l border-gi-border/40 pointer-events-auto',
                drop.valid && 'ring-2 ring-inset ring-gi-success/70',
                drop.invalid && 'ring-2 ring-inset ring-gi-danger/70'
            )}
        >
            <div className="shrink-0 flex items-center justify-between px-3 py-1.5 border-b border-gi-border/40 bg-gi-base/60">
                <span className="flex items-center gap-2 text-[10px] font-bold gi-caps tracking-widest text-gi-muted">
                    <Package size={12} className="text-gi-primary" /> Tray
                </span>
                <span className="text-[10px] text-gi-muted tabular-nums">
                    {entries.length} / {capacity}
                </span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-2">
                {entries.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center gap-2 text-gi-muted/50 text-center px-4">
                        <Package size={28} />
                        <span className="text-[10px] normal-case leading-snug">
                            Tokens waiting to be placed land here. Drag one onto a tile.
                        </span>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-2">
                        {entries.map((entry, slot) => (
                            <TraySlot
                                key={`${entry.typeId}-${slot}`}
                                entry={entry}
                                slot={slot}
                                onBurst={() => burstFromTray(slot)}
                                onInspect={() => onInspectToken?.(entry.typeId)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </aside>
    );
};

/**
 * Open a Map straight out of the Tray, throwing its contents onto the grid
 * (D-155). The Map is consumed either way — a single burst, never a dispenser.
 */
function burstFromTray(slot) {
    const instance = BoardState.getTray()[slot];
    if (!instance || !Cartographer.isMap(instance)) return;

    BoardState.takeFromTray(slot);
    const result = Cartographer.openMap(instance, null);
    if (result.success) {
        NotificationSystem.success(`${tokenName(instance.typeId)} burst open — ${result.contents.length} things!`);
    } else {
        BoardState.addToTray(instance);   // never lose it to a failed open
    }
}

/** One Token in the Tray, draggable onto any tile. */
const TraySlot = ({ entry, slot, onBurst, onInspect }) => {
    const drag = useEntityDrag({
        id: `tray-${slot}`,
        kind: DRAG_KIND.TOKEN,
        payload: { typeId: entry.typeId, from: { traySlot: slot } },
        sourceSurface: DND_SURFACE.DRAWER
    });

    const label = tokenName(entry.typeId);

    return (
        <div
            ref={drag.setNodeRef}
            {...drag.handleProps}
            // **Double-click and it bursts open** (D-142). Deliberately not a
            // single click: the Tray's primary verb is drag-to-place, and a
            // one-click open would spend a Map every time a drag started badly.
            // ⚠️ Click to inspect (D-145). The Tray is where planning happens —
            // a player is deciding what to put down, which is exactly the moment
            // they need to know what it does, and hero-time is too scarce to
            // find out by placing it. dnd-kit's 8px activation distance is what
            // separates this from starting a drag.
            onClick={onInspect}
            onDoubleClick={entry.isMap ? onBurst : undefined}
            title={
                entry.isMap
                    ? `${label} — double-click to tear it open`
                    : `${label}${entry.usesRemaining != null ? ` — ${entry.usesRemaining} uses` : ' — unlimited'}`
            }
            className={cn(
                'relative aspect-square rounded border border-gi-border/60 bg-gi-surface/70',
                'flex items-center justify-center cursor-grab active:cursor-grabbing',
                'hover:border-gi-primary/60 transition-colors',
                // Maps are not Tokens you place to produce (D-132), so they read
                // differently in the rack — a parcel among the tools.
                entry.isMap && 'border-gi-gold/70 bg-gi-gold/10 hover:border-gi-gold',
                drag.isDragging && 'opacity-40'
            )}
        >
            <img
                src={tokenSpritePath(entry.typeId)}
                alt={label}
                draggable={false}
                className="pointer-events-none"
                style={{ width: 40, height: 40, imageRendering: 'pixelated' }}
            />
            {entry.usesRemaining != null && !entry.isMap && (
                <span className="absolute bottom-0 right-0.5 text-[8px] font-bold text-white/70 tabular-nums">
                    {entry.usesRemaining}
                </span>
            )}
        </div>
    );
};

export default Tray;
