import React, { useCallback, useRef } from 'react';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { useEngine } from '../../hooks/useEngine.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import { tokenName, getTokenType } from '../../../config/registries/tokenRegistry.js';
import { TokenSprite, TOKEN_SURFACE, tokenSizeFor } from '../base/TokenSprite.jsx';
import { useEntityDrag, useEntityDrop } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as Placement from '../../../systems/board/Placement.js';
import * as Cartographer from '../../../systems/board/Cartographer.js';
import * as TokenBank from '../../../systems/board/TokenBank.js';
import * as SpriteLayer from '../../../systems/board/SpriteLayer.js';
import { TrayMiniBoard } from './TrayMiniBoard.jsx';
import * as NotificationSystem from '../../../systems/core/NotificationSystem.js';
import { Package, Archive } from 'lucide-react';

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
 *
 * ## A free surface, not a grid (D-223)
 * Tokens sit **wherever they are put**, may overlap freely, and stay there
 * between sessions. The 3-column grid this used to be is gone: a rack of snapped
 * cells was the last place in a Token's life that still read as a spreadsheet,
 * which is exactly what D-143 exists to prevent.
 *
 * ⚠️ **Capacity is still a count of 18, not an area** (D-228). Overlap is
 * unlimited, so "full" can never be a spatial fact — and capacity is load-bearing
 * in three places: D-156 (Maps live only here), D-158 (the overflow trigger) and
 * D-168 (Tray size is a Guild Upgrade). The `n / 18` header is now the only
 * signal that the Tray is filling up.
 */
export const Tray = ({ onInspectToken, onClearInspect, isVaultOpen = false }) => {
    const entries = useGameState(
        state => (state.board?.tray || []).map(t => ({
            typeId: t.typeId,
            usesRemaining: t.usesRemaining,
            x: t.x,
            y: t.y,
            isMap: !!getTokenType(t.typeId)?.mapId
        })),
        [BOARD_EVENTS.TILE_CHANGED, 'map_purchased', 'state_changed'],
        // ⚠️ `eventFilter`, not a default value — see the note in Board.jsx.
        null
    );

    const { EventBus } = useEngine();

    // The positioned surface. Its rect converts a drop point into the fractions
    // positions are stored as (D-226) — read at drop time only, never on render.
    const surfaceRef = useRef(null);

    /**
     * Where, in Tray fractions, a viewport point falls.
     *
     * Fractions are of the **placeable area** — the surface minus one sprite —
     * so 0 is flush against the left/top edge and 1 flush against the right/
     * bottom, and a Token can never be positioned half-off. Returns null if the
     * surface is not measurable, which makes the caller fall back to scattering.
     */
    const pointToFraction = useCallback((pointer) => {
        const node = surfaceRef.current;
        if (!node || !pointer) return null;

        const r = node.getBoundingClientRect();
        const spanX = r.width - TRAY_TOKEN_PX;
        const spanY = r.height - TRAY_TOKEN_PX;
        if (spanX <= 0 || spanY <= 0) return null;

        return {
            x: (pointer.x - r.left - TRAY_TOKEN_PX / 2) / spanX,
            y: (pointer.y - r.top - TRAY_TOKEN_PX / 2) / spanY
        };
    }, []);

    // The Tray is a drop target three ways: taking a Token out of play, and —
    // new with D-223 — moving one around within the Tray itself.
    const drop = useEntityDrop({
        id: 'tray',
        surface: DND_SURFACE.DRAWER,
        accepts: (p) =>
            p.kind === DRAG_KIND.TOKEN &&
            (p.from?.tile != null ||
             p.from?.traySlot != null ||
             p.from?.spriteId != null ||
             p.from?.boardMapId != null ||
             // Out of storage, and off the Cartographer's shelf (D-244).
             p.from?.vaultTypeId != null ||
             p.from?.buyMapId != null),
        onDrop: (p, info) => {
            const at = pointToFraction(info?.pointer);

            /**
             * Taking something out of an open drawer (D-244).
             *
             * ⚠️ **Both route through the system call, never around it.**
             * `buyMap` takes gold and materials only after every check has
             * passed — "a half-paid purchase destroys items for nothing" — and
             * `withdraw` picks the fullest copy (D-77). Reimplementing either
             * here to make the drop feel snappier would lose those guarantees.
             *
             * They land where they were dropped, like any Token the player
             * placed themselves (D-227).
             */
            if (p.from?.vaultTypeId != null) {
                withdrawToTray(p.from.vaultTypeId, at);
                EventBus?.publish(BOARD_EVENTS.TILE_CHANGED, {});
                return;
            }
            if (p.from?.buyMapId != null) {
                buyMapToTray(p.from.buyMapId, at);
                return;
            }

            // Already in the Tray: this is a reposition, not a transfer.
            if (p.from?.traySlot != null) {
                if (!at || !BoardState.setTrayPosition(p.from.traySlot, at.x, at.y)) return;
                EventBus?.publish('state_changed', {});
                return;
            }

            // Off the board map layer into the Tray
            if (p.from?.boardMapId != null) {
                const instance = BoardState.removeBoardMap(p.from.boardMapId);
                if (instance) {
                    BoardState.addToTray({ typeId: instance.typeId, usesRemaining: instance.usesRemaining }, undefined, at);
                    EventBus?.publish('state_changed', {});
                }
                return;
            }

            // Off the floor / floating sprite into the Tray
            if (p.from?.spriteId != null) {
                const instance = SpriteLayer.takeTokenSprite(p.from.spriteId);
                if (instance) {
                    BoardState.addToTray(instance, undefined, at);
                    EventBus?.publish('state_changed', {});
                }
                return;
            }

            // Off the board and into the Tray, landing where it was dropped
            // (D-227). A null `at` scatters instead, which is the right
            // fallback rather than a failure.
            Placement.returnTokenToTray(p.from.tile, at);
        }
    });

    const chestDrop = useEntityDrop({
        id: 'tray-chest-deposit',
        surface: DND_SURFACE.DRAWER,
        accepts: (p) => p.kind === DRAG_KIND.TOKEN && (p.from?.traySlot != null || p.from?.tile != null || p.from?.spriteId != null || p.from?.boardMapId != null),
        onDrop: (p) => {
            if (p.from?.traySlot != null) {
                const instance = BoardState.getTray()[p.from.traySlot];
                if (!instance) return;

                if (getTokenType(instance.typeId)?.mapId) {
                    NotificationSystem.warning('Maps cannot be stored — open it.');
                    return;
                }
                if (!TokenBank.deposit(instance)) {
                    NotificationSystem.warning('No room in the Vault');
                    return;
                }
                BoardState.takeFromTray(p.from.traySlot);
            } else if (p.from?.tile != null) {
                const res = Placement.returnTokenToVault(p.from.tile);
                if (!res.success && res.reason) {
                    NotificationSystem.warning(res.reason);
                }
            } else if (p.from?.boardMapId != null) {
                NotificationSystem.warning('Maps cannot be stored — open it.');
            } else if (p.from?.spriteId != null) {
                const instance = SpriteLayer.takeTokenSprite(p.from.spriteId);
                if (!instance) return;
                if (getTokenType(instance.typeId)?.mapId) {
                    NotificationSystem.warning('Maps cannot be stored — open it.');
                    SpriteLayer.addSprite('token', instance.typeId, 1, null, instance.usesRemaining);
                    return;
                }
                if (!TokenBank.deposit(instance)) {
                    NotificationSystem.warning('No room in the Vault');
                    SpriteLayer.addSprite('token', instance.typeId, 1, null, instance.usesRemaining);
                    return;
                }
                EventBus?.publish('state_changed', {});
            }
        }
    });

    const capacity = BoardState.TRAY_CAPACITY;

    return (
        <aside
            ref={drop.setNodeRef}
            {...drop.droppableProps}
            className={cn(
                'w-64 md:w-80 xl:w-[356px] shrink-0 flex flex-col min-h-0 bg-gi-base/50 border-l border-gi-border/40 pointer-events-auto transition-[width] duration-150',
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

            {isVaultOpen ? (
                <TrayMiniBoard />
            ) : (
                <>
            {/* `overflow-hidden`, never `overflow-y-auto`. Positions are stored
                as fractions of this box (D-226), so its contents always fit it
                whatever height the window leaves — and all 18 stay visible, which
                is what keeps the header count honest. */}
            <div ref={surfaceRef} className="flex-1 min-h-0 relative overflow-hidden">
                {entries.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center gap-2 text-gi-muted/50 text-center px-4">
                        <Package size={28} />
                        <span className="text-[10px] normal-case leading-snug">
                            Tokens waiting to be placed land here. Drag one onto a tile.
                        </span>
                    </div>
                ) : (
                    entries.map((entry, slot) => (
                        <TrayToken
                            key={`${entry.typeId}-${slot}`}
                            entry={entry}
                            slot={slot}
                            onBurst={() => burstFromTray(slot)}
                            onInspect={(e) => onInspectToken?.(entry.typeId, e.currentTarget.getBoundingClientRect())}
                            onClearInspect={onClearInspect}
                        />
                    ))
                )}
            </div>

            {/* Deposit Chest */}
            <div 
                ref={chestDrop.setNodeRef}
                {...chestDrop.droppableProps}
                className={cn(
                    "shrink-0 flex items-center justify-center p-4 border-t border-gi-border/40 bg-gi-base/80 transition-colors",
                    chestDrop.valid && "bg-gi-success/20 ring-2 ring-inset ring-gi-success/70",
                    chestDrop.invalid && "bg-gi-danger/20 ring-2 ring-inset ring-gi-danger/70"
                )}
            >
                <div className={cn(
                    "flex flex-col items-center justify-center text-gi-muted",
                    chestDrop.valid && "text-gi-success",
                    chestDrop.invalid && "text-gi-danger"
                )}>
                    <Archive size={24} />
                    <span className="text-[10px] mt-1 font-bold gi-caps tracking-widest">
                        Store in Vault
                    </span>
                </div>
            </div>

                </>
            )}
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

/**
 * Pull one copy out of the Vault and drop it where the player let go (D-244).
 *
 * `TokenBank.withdraw` picks the **fullest copy** (D-77), so a row showing ×7
 * hands over the healthiest one. If the Tray refuses it the copy goes straight
 * back — nothing is ever lost to a full container (D-138), and that includes
 * this path.
 */
function withdrawToTray(typeId, at) {
    const instance = TokenBank.withdraw(typeId);
    if (!instance) return;
    if (!BoardState.addToTray(instance, undefined, at)) {
        TokenBank.deposit(instance);
        NotificationSystem.warning('No room in the Tray');
    }
}

/**
 * Buy a Map by dropping it on the Tray (D-245) — outright, no confirmation.
 *
 * ⚠️ `buyMap` puts the Map in the Tray itself, so the position is applied
 * afterwards to the instance it returns. Reimplementing the purchase here to
 * place it directly would skip `canBuy`'s three refusals and the
 * check-everything-before-spending rule that stops a half-paid purchase.
 */
function buyMapToTray(mapId, at) {
    const result = Cartographer.buyMap(mapId);
    if (!result.success) {
        NotificationSystem.warning(result.reason);
        return;
    }
    if (at) {
        const slot = BoardState.getTray().indexOf(result.instance);
        if (slot >= 0) BoardState.setTrayPosition(slot, at.x, at.y);
    }
    NotificationSystem.success(`${tokenName(result.instance.typeId)} — double-click to tear it open.`);
}

/** Storage scale, and the size the fraction maths is expressed against. */
const TRAY_TOKEN_PX = tokenSizeFor(TOKEN_SURFACE.TRAY);

/**
 * One Token loose on the Tray surface: draggable onto a tile, or anywhere else
 * in the Tray.
 */
const TrayToken = ({ entry, slot, onBurst, onInspect, onClearInspect }) => {
    const drag = useEntityDrag({
        id: `tray-${slot}`,
        kind: DRAG_KIND.TOKEN,
        payload: { typeId: entry.typeId, from: { traySlot: slot } },
        sourceSurface: DND_SURFACE.DRAWER
    });

    React.useEffect(() => {
        if (drag.isDragging) {
            onClearInspect?.();
        }
    }, [drag.isDragging, onClearInspect]);

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
            // No frame (D-219), and no slot to sit in (D-223). The art is the
            // object here exactly as it is on a tile.
            className={cn(
                'absolute flex items-center justify-center cursor-grab active:cursor-grabbing',
                // Maps are not Tokens you place to produce (D-132), so they read
                // differently in the rack — a parcel among the tools. A tint
                // behind the art rather than a border around it.
                entry.isMap && 'rounded bg-gi-gold/10',
                drag.isDragging && 'opacity-40'
            )}
            style={{
                width: TRAY_TOKEN_PX,
                height: TRAY_TOKEN_PX,
                // Fractions of the placeable area, resolved by CSS rather than
                // by measuring (D-226). `calc()` re-evaluates on every resize, so
                // the arrangement squashes and stretches with the Tray for free —
                // no ResizeObserver, and nothing can end up off-surface.
                left: `calc(${clampFraction(entry.x)} * (100% - ${TRAY_TOKEN_PX}px))`,
                top: `calc(${clampFraction(entry.y)} * (100% - ${TRAY_TOKEN_PX}px))`,
                // Later arrivals sit on top. Overlap is expected and allowed
                // (D-224) — stacking is visual only, nothing merges.
                zIndex: slot
            }}
        >
            <TokenSprite typeId={entry.typeId} surface={TOKEN_SURFACE.TRAY} alt={label} />
            {entry.usesRemaining != null && !entry.isMap && (
                <span className="absolute bottom-0 right-0.5 text-[8px] font-bold text-white/70 tabular-nums pointer-events-none">
                    {entry.usesRemaining}
                </span>
            )}
        </div>
    );
};

/** Belt-and-braces against a bad saved value reaching CSS. */
const clampFraction = (v) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.5);

export default Tray;
