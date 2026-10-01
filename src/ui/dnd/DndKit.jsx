import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
    DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
    useDraggable, useDroppable, pointerWithin
} from '@dnd-kit/core';
import { snapCenterToCursor } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import { cn } from '../utils/cn.js';
import { EventBus } from '../../systems/core/EventBus.js';
import { DragGhost } from './DragGhost.jsx';
import { DND_SURFACE, DRAG_SFX, DRAG_KIND } from './dragConstants.js';
import { BOARD_EVENTS } from '../../systems/board/boardEvents.js';
import { displayPointOf } from '../../systems/board/BoardState.js';

/**
 * DndKit — the deck-loop drag-and-drop system (DnD rework, 2026-07-15).
 *
 * A fresh, pointer-tracked layer on dnd-kit, replacing the flat native-HTML5
 * drag the deck loop shipped with. dnd-kit gives us three things the browser's
 * built-in drag can't: a fully-animatable ghost (the DragOverlay), reliable
 * pointer tracking, and — via its drop animation — spring-back-to-origin for
 * free. Everything the owner picked is built on top of that:
 *
 *   • Bold-pop pickup, tilt + glow (the motion.div in the overlay).
 *   • Bloom on cross-over: compact ghost over a drawer, bold over the board,
 *     driven by hit-testing the cursor against `data-dnd-surface` regions.
 *   • Glide-and-settle into the slot on a valid drop; spring back on a miss.
 *   • Only the hovered slot reacts — accept glow vs red "no" (pointerWithin
 *     collision means at most one target is "over").
 *   • Pickup / drop / invalid SFX via the existing AudioSystem.
 *
 * Drop resolution is deliberately decentralised: each target declares what it
 * `accepts(payload)` and what to `onDrop(payload)`, so there's no central
 * router to grow stale (a lesson from the retired grid pipeline).
 */

const sfx = (clip) => EventBus.publish('audio:play', { clip });

/**
 * Collision: the pointer's containing targets, smallest-area first. This makes
 * a nested child target (e.g. a card tile) win over its parent (the list it
 * sits in) when the cursor is over the child, while the parent still resolves
 * over its own empty space. Board slots don't nest, so they're unaffected.
 */
// Exported for tests only (CR3-413); nothing else imports it.
export function smallestWithin(args) {
    const hits = pointerWithin(args);
    if (hits.length > 0) {
        if (hits.length === 1) return hits;

        const area = (c) => {
            const r = c?.data?.droppableContainer?.rect?.current;
            return r ? r.width * r.height : Number.MAX_SAFE_INTEGER;
        };
        const surfaceOf = (c) => c?.data?.droppableContainer?.data?.current?.surface;

        /**
         * ⚠️ Drawers beat the board where they overlap — the same rule
         * `surfaceAtPoint` states below, now applied to collision too.
         */
        const rank = (c) => (surfaceOf(c) === DND_SURFACE.DRAWER ? 0 : 1);

        return [...hits].sort((a, b) => rank(a) - rank(b) || area(a) - area(b));
    }

    // Proximity fallback: eliminates dead zones in buffer spaces between board tiles, margins, and the tray
    const { droppableContainers, pointerCoordinates } = args;
    if (!pointerCoordinates || !droppableContainers || droppableContainers.length === 0) {
        return [];
    }

    const { x: px, y: py } = pointerCoordinates;
    const candidates = droppableContainers.filter((c) => !c.disabled && c.rect?.current);
    if (candidates.length === 0) return [];

    let bestContainer = null;
    let minDistanceSq = Number.POSITIVE_INFINITY;

    for (const c of candidates) {
        const r = c.rect.current;
        const dx = Math.max(r.left - px, 0, px - r.right);
        const dy = Math.max(r.top - py, 0, py - r.bottom);
        const distSq = dx * dx + dy * dy;

        if (distSq < minDistanceSq) {
            minDistanceSq = distSq;
            bestContainer = c;
        }
    }

    // Proximity reach threshold: 240px buffer seamlessly bridges gaps between playmat tiles, tray, and borders
    if (bestContainer && minDistanceSq <= 240 * 240) {
        return [bestContainer];
    }

    return [];
}

/**
 * Which surface the pointer is over ('drawer' | 'board' | null), by rect
 * containment against the big `data-dnd-region` containers. Geometric rather
 * than elementFromPoint (which was flaky over the board's stacked overlays and
 * made the bloom miss). Drawers win over the board where they overlap.
 *
 * Queries the DOM fresh every call — kept for CR3-413's tests and for any
 * one-off caller. The provider's own per-pointer-move check does not call
 * this (CR3-403, below): it reuses a snapshot taken once at drag start.
 */
// Exported for tests only (CR3-413); nothing else imports it.
export function surfaceAtPoint(x, y) {
    if (typeof document === 'undefined') return null;
    return surfaceWithinRegions(x, y, snapshotDndRegions());
}

// Exported for tests only (CR3-403); nothing else imports it.
/** Every `[data-dnd-region]` element's surface and rect, read once. */
export function snapshotDndRegions() {
    if (typeof document === 'undefined') return [];
    const out = [];
    for (const el of document.querySelectorAll('[data-dnd-region]')) {
        out.push({ surface: el.getAttribute('data-dnd-region'), rect: el.getBoundingClientRect() });
    }
    return out;
}

/**
 * CR3-403: the same priority rule `surfaceAtPoint` applies (a drawer over the
 * board), against rects already measured instead of querying the DOM again.
 * Nothing can open, close or resize a drawer while the pointer is down
 * mid-drag, so a snapshot taken once at drag start stays exact for the
 * drag's whole duration — unlike the old per-move query (two whole-document
 * `querySelectorAll` calls plus a `getBoundingClientRect` per region, on
 * every single pointer move).
 */
// Exported for tests only (CR3-403); nothing else imports it.
export function surfaceWithinRegions(x, y, regions) {
    let board = null;
    for (const { surface, rect: r } of regions) {
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
            if (surface === DND_SURFACE.DRAWER) return DND_SURFACE.DRAWER;
            if (surface === DND_SURFACE.BOARD) board = DND_SURFACE.BOARD;
        }
    }
    return board;
}

const GLOW_BOLD = 'drop-shadow(0 10px 18px rgba(0,0,0,0.55))';
const GLOW_COMPACT = 'drop-shadow(0 4px 8px rgba(0,0,0,0.45))';

// CR3-404: static, so passing it to <DndContext> never counts as a changed
// prop. It used to be a fresh object literal on every DeckDndProvider render.
const AUTO_SCROLL = { enabled: true, threshold: { x: 0, y: 0.18 } };

/**
 * ⭐ Wave 5 (owner rulings Z §11): a carried Token, hero or flag casts the hard
 * pixel shadow `PixelArt` draws for `lifted` — a soft drop-shadow on top of it
 * would be a second, blurred shadow. Only a carried item (its card frame)
 * keeps the soft one.
 */
const SPRITE_KINDS = new Set([DRAG_KIND.TOKEN, DRAG_KIND.HERO, DRAG_KIND.FLAG]);
function overlayFilter(kind, bold) {
    const lift = 'brightness(1.15) saturate(1.25)';
    return SPRITE_KINDS.has(kind) ? lift : `${bold ? GLOW_BOLD : GLOW_COMPACT} ${lift}`;
}

export const DeckDndContext = React.createContext({ activePayload: null, isDragging: false });
export const useActiveDrag = () => React.useContext(DeckDndContext);

/**
 * Where the cursor is while a drag is live, in viewport coordinates — or null
 * when nothing is in the hand.
 *
 * ⚠️ **Its own context on purpose.** This changes on every animation frame, and
 * the board has ~80 Tokens reading `useActiveDrag`. Putting the pointer in that
 * context would re-render all of them 60 times a second for a value only the
 * range rings care about (FP-64). Consumers of this one are leaves.
 */
export const DragPointerContext = React.createContext(null);
export const useDragPointer = () => React.useContext(DragPointerContext);

/**
 * Which big region ('board' | 'drawer' | null) the pointer is
 * over while a drag is live — the same `surface` state that drives the
 * ghost's bloom, now readable by a drawer that needs to react to it too
 * (the Shop's slide-aside, CR3-402). Changes only when the pointer crosses a
 * region boundary, far less often than every frame, so a dedicated context
 * for it is cheap — unlike `DragPointerContext` above.
 */
export const DragSurfaceContext = React.createContext(undefined);
export const useDragSurface = () => React.useContext(DragSurfaceContext);
import { isElementOpaqueAtPoint } from '../utils/alphaHitTest.js';
import { isDisallowMode } from '../hooks/useDisallowMode.js';
import { isMatBankLocked } from '../hooks/useMatBankLock.js';

/**
 * CR3-404 — owns the per-frame cursor publish on its own, so a frame where
 * only the cursor moved re-renders just this component (and the context's
 * consumers, `MatRings`/`FlagLayer`), not `DeckDndProvider` itself.
 *
 * Before this split, `dragPointer` lived in `DeckDndProvider`, so every
 * per-frame update re-ran its whole render — recreating the `<DndContext>`
 * element it returns, which made dnd-kit redo its own work (collision,
 * overlay) a second time on top of the move it had already handled. Now
 * `DeckDndProvider` only re-renders at drag start/end or a surface crossing,
 * so the `children` it hands down (the `<DndContext>` tree) stays the exact
 * same element across every in-between frame. React bails out of
 * re-rendering an unchanged child element, so this component re-rendering
 * does not propagate into `children` at all.
 */
// Exported for tests only (CR3-404); DeckDndProvider is its one real caller.
export function DragPointerProvider({ activePayload, pointerRef, children }) {
    const [dragPointer, setDragPointer] = useState(null);
    const frameRef = useRef(0);

    useEffect(() => {
        if (!activePayload) {
            setDragPointer(null);
            return undefined;
        }
        // Seed immediately: handleDragStart already stamped pointerRef with
        // the activator event's coordinates before this effect can run.
        setDragPointer(pointerRef.current);
        const onMove = (e) => {
            pointerRef.current = { x: e.clientX, y: e.clientY };
            if (!frameRef.current && typeof requestAnimationFrame === 'function') {
                frameRef.current = requestAnimationFrame(() => {
                    frameRef.current = 0;
                    setDragPointer(pointerRef.current);
                });
            }
        };
        window.addEventListener('pointermove', onMove, { passive: true });
        return () => {
            window.removeEventListener('pointermove', onMove);
            if (frameRef.current && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frameRef.current);
            frameRef.current = 0;
        };
    }, [activePayload, pointerRef]);

    return (
        <DragPointerContext.Provider value={dragPointer}>
            {children}
        </DragPointerContext.Provider>
    );
}

export class AlphaPointerSensor extends PointerSensor {
    static activators = [
        {
            eventName: 'onPointerDown',
            handler: ({ nativeEvent: event }) => {
                if (!event.isPrimary || event.button !== 0) {
                    return false;
                }
                // B2.3 (FB-32): dragging ON THE MAT pauses in disallow mode —
                // Tokens, heroes and flags, which all live inside the mat's
                // `data-board-origin` box. The dock and the Bank still drag
                // (owner, 2026-09-27: mat only). A refused press stays a plain
                // click, which the mode turns into a flip.
                //
                // CR3-402 (owner ruling): while the Bank is open the mat is
                // not interactive at all, for the same reason and the same
                // box — nothing on the mat may even start a drag.
                if ((isDisallowMode() || isMatBankLocked()) && event.target?.closest?.('[data-board-origin]')) return false;
                const target = event.target;
                const alphaEl = target?.closest?.('[data-alpha-test]');
                if (alphaEl) {
                    if (!isElementOpaqueAtPoint(alphaEl, event.clientX, event.clientY)) {
                        return false;
                    }
                }
                return true;
            }
        }
    ];
}

export const DeckDndProvider = ({ children }) => {
    const [activePayload, setActivePayload] = useState(null);
    const [surface, setSurface] = useState(DND_SURFACE.BOARD);
    const pointerRef = useRef({ x: 0, y: 0 });
    const glideTargetRef = useRef(null);
    // CR3-403: the drawer/board regions, snapshotted once when this drag
    // starts (below) instead of queried from the DOM on every pointer move.
    const regionsRef = useRef([]);

    const sensors = useSensors(
        useSensor(AlphaPointerSensor, { activationConstraint: { distance: 8 } })
    );

    // While a drag is live, track which surface the cursor is over so the
    // ghost can bloom bold over the board and stay compact over a drawer.
    // CR3-404: the per-frame cursor publish itself lives in
    // `DragPointerProvider` below, so this effect (and this component)
    // re-renders only at drag start/end or a surface crossing — not once a
    // frame.
    useEffect(() => {
        if (!activePayload) return;
        regionsRef.current = snapshotDndRegions();
        const onMove = (e) => {
            const s = surfaceWithinRegions(e.clientX, e.clientY, regionsRef.current);
            if (s) setSurface(prev => (prev === s ? prev : s));
        };
        window.addEventListener('pointermove', onMove, { passive: true });
        return () => window.removeEventListener('pointermove', onMove);
    }, [activePayload]);

    const handleDragStart = useCallback((event) => {
        const payload = event.active?.data?.current || null;
        const a = event.activatorEvent;
        if (a && 'clientX' in a) pointerRef.current = { x: a.clientX, y: a.clientY };
        setSurface(payload?.sourceSurface || DND_SURFACE.BOARD);
        setActivePayload(payload);
        glideTargetRef.current = null;
        if (typeof document !== 'undefined') document.body.classList.add('gi-dnd-active');
        sfx(DRAG_SFX.pickup);

        // When starting a hero drag from the dock tab or inspection panel, if the hero is already
        // on the playmat, shoot a flying sprite particle from the playmat tile straight to the cursor
        if (payload?.kind === DRAG_KIND.HERO && payload.heroId && payload.from?.dock) {
            // The point the hero is drawn at, in mat units (slice 1.6c).
            const at = displayPointOf(payload.heroId);
            if (at) {
                const { x, y } = at;
                const toScreenX = a?.clientX ?? (typeof window !== 'undefined' ? window.innerWidth - 40 : 0);
                const toScreenY = a?.clientY ?? (typeof window !== 'undefined' ? window.innerHeight / 2 : 0);

                EventBus.publish(BOARD_EVENTS.SPRITE_COLLECTED, {
                    kind: 'hero',
                    refId: payload.heroId,
                    heroId: payload.heroId,
                    quantity: 1,
                    x,
                    y,
                    toScreenX,
                    toScreenY,
                    destination: 'cursor'
                });
            }
        }
    }, []);

    const finishDrag = useCallback(() => {
        setActivePayload(null);
        // dragPointer itself is cleared by DragPointerProvider's own effect,
        // which re-runs the moment activePayload goes null.
        if (typeof document !== 'undefined') document.body.classList.remove('gi-dnd-active');
    }, []);

    const handleDragEnd = useCallback((event) => {
        const { active, over } = event;
        const payload = active?.data?.current;
        let success = false;

        if (over && payload) {
            const data = over.data?.current;
            if (data?.accepts?.(payload)) {
                // Glide target = the drop target's live DOM rect (viewport coords,
                // matching the tracked cursor) so the ghost lands right on it.
                const node = document.querySelector(`[data-dnd-droppable-id="${over.id}"]`);
                if (node) {
                    const r = node.getBoundingClientRect();
                    glideTargetRef.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
                }
                // Hand the drop point to the target. Free-surface targets (the
                // Tray, D-223) need to know WHERE inside themselves the drop
                // landed, not just that it did — a drop has to land where it was
                // dropped (D-227). `pointerRef` is the live cursor in viewport
                // coordinates, already tracked for the glide animation above.
                // Every other target ignores the second argument.
                //
                // A target that can only tell at the moment of the drop that it
                // will not take it (the playmat, for a Token dropped well
                // outside the landing area — FP-93) returns `false`: the drop
                // counts as a miss, so the ghost flies back.
                success = data.onDrop?.(payload, { pointer: pointerRef.current }) !== false;
                if (!success) glideTargetRef.current = null;
            }
        }

        if (success) {
            sfx(DRAG_SFX.dropByKind[payload.kind] || DRAG_SFX.dropDefault);
        } else {
            if (payload.onMiss) {
                const target = payload.onMiss(payload);
                if (target) glideTargetRef.current = target;
                else glideTargetRef.current = null;
                sfx(DRAG_SFX.dropDefault);
            } else {
                glideTargetRef.current = null; 
                sfx(DRAG_SFX.invalid);
            }
        }

        finishDrag();
    }, [finishDrag]);

    const handleDragCancel = useCallback(() => {
        glideTargetRef.current = null;
        finishDrag();
    }, [finishDrag]);

    // Drop animation: on a MISS, spring the ghost back to where it came from.
    // On a SUCCESS, hand over to the destination instantly — see below.
    //
    // CR3-404: hoisted into a `useMemo` with no dependencies. `glideTargetRef`
    // and `pointerRef` are refs — stable objects whose `.current` is read
    // inside these closures at CALL time (when dnd-kit actually animates a
    // drop), not captured now, so memoising never serves a stale value. A
    // fresh object here every render was one more prop dnd-kit had to treat
    // as changed on every re-render of this component.
    const dropAnimation = React.useMemo(() => ({
        duration: 280,
        easing: 'cubic-bezier(0.2, 1.25, 0.5, 1)', // slight overshoot → settle
        keyframes({ transform }) {
            const t = glideTargetRef.current;
            const c = pointerRef.current;
            if (!t || !c) {
                return [
                    { transform: CSS.Transform.toString(transform.initial), opacity: 1 },
                    { transform: CSS.Transform.toString(transform.final), opacity: 1 }
                ];
            }
            // ⚠️ On a SUCCESSFUL drop the ghost must vanish at once, not glide.
            //
            // The drop has already happened — state updates synchronously in
            // `handleDragEnd`, so the real Token is on the tile within a frame.
            // The old behaviour cross-faded the ghost out over the full 280ms
            // **on top of the placed Token, in the same place**, because the
            // glide target IS the drop point. Measured: the tile drew its Token
            // at ~42ms and the ghost was still there at 282ms — a quarter of a
            // second of the same sprite drawn twice, dissolving into itself.
            // That is what made a drop read as awkward rather than as landing.
            //
            // The landing beat now belongs to the destination (D-230), which
            // starts raised and drops — exactly where the ghost was — so handing
            // over instantly is invisible.
            //
            // A MISS still animates: the branch above springs the ghost back to
            // where it came from, which is the one case where the ghost is the
            // only thing that can tell the story.
            return [{ opacity: 0 }, { opacity: 0 }];
        },
        sideEffects() { return () => { glideTargetRef.current = null; }; }
    }), []);

    const bold = surface === DND_SURFACE.BOARD;

    // Memoised: a fresh object here would re-render every drag consumer on the
    // provider's own per-frame pointer updates.
    const activeValue = React.useMemo(
        () => ({ activePayload, isDragging: !!activePayload }),
        [activePayload]
    );

    return (
        <DeckDndContext.Provider value={activeValue}>
            <DragSurfaceContext.Provider value={activePayload ? surface : null}>
            <DragPointerProvider activePayload={activePayload} pointerRef={pointerRef}>
            <DndContext
                sensors={sensors}
                collisionDetection={smallestWithin}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
                autoScroll={AUTO_SCROLL}
            >
                {children}

                <DragOverlay dropAnimation={dropAnimation} modifiers={[snapCenterToCursor]} zIndex={2000} className="pointer-events-none">
                    {activePayload ? (
                        <motion.div
                            initial={{ opacity: 0.6 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.15, ease: 'easeOut' }}
                            className="w-full h-full flex items-center justify-center origin-center will-change-transform"
                            style={{ filter: overlayFilter(activePayload.kind, bold) }}
                        >
                            <DragGhost payload={activePayload} bold={bold} />
                        </motion.div>
                    ) : null}
                </DragOverlay>
            </DndContext>
            </DragPointerProvider>
            </DragSurfaceContext.Provider>
        </DeckDndContext.Provider>
    );
};

// ----------------------------------------------------------------------
// Hooks + wrappers each drag surface uses
// ----------------------------------------------------------------------

/**
 * Make a node a drag source. `payload` is merged into the drag data under the
 * given `kind`; `sourceSurface` seeds the ghost's compact/bold state at pickup.
 */
export function useEntityDrag({ id, kind, payload, sourceSurface = DND_SURFACE.DRAWER, disabled = false }) {
    const rid = useId();
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: id || `${kind}-${rid}`,
        disabled,
        data: { kind, sourceSurface, ...payload }
    });
    return { setNodeRef, isDragging, handleProps: { ...listeners, ...attributes } };
}

/**
 * Make a node a drop target. Returns validity flags for the hovered state
 * (only the target under the cursor is ever `isOver`, via pointerWithin) plus
 * the props the provider needs to find and resolve the drop.
 */
export function useEntityDrop({ id, surface = DND_SURFACE.BOARD, accepts, onDrop, disabled = false }) {
    const { setNodeRef, isOver, active } = useDroppable({
        id,
        disabled,
        data: { surface, accepts, onDrop }
    });
    const payload = active?.data?.current || null;
    const canAccept = !!(payload && accepts?.(payload));
    return {
        setNodeRef,
        isOver,
        valid: isOver && canAccept,
        invalid: isOver && !canAccept,
        activePayload: payload,
        droppableProps: { 'data-dnd-droppable-id': id, 'data-dnd-surface': surface }
    };
}

/** Default hovered-target cues: green accept glow vs red "no". */
export const ACCEPT_CLS = 'ring-2 ring-gi-success/80 bg-gi-success/10';
export const REJECT_CLS = 'ring-2 ring-gi-danger/80 bg-gi-danger/10';

/** Convenience wrapper for pure drop targets (slots that aren't also draggable). */
export const DropTarget = ({
    id, surface, accepts, onDrop, disabled,
    as: Tag = 'div', className, acceptClassName = ACCEPT_CLS, rejectClassName = REJECT_CLS,
    style, children, ...rest
}) => {
    const { setNodeRef, valid, invalid, droppableProps } = useEntityDrop({ id, surface, accepts, onDrop, disabled });
    return (
        <Tag
            ref={setNodeRef}
            style={style}
            className={cn(className, valid && acceptClassName, invalid && rejectClassName)}
            {...droppableProps}
            {...rest}
        >
            {children}
        </Tag>
    );
};

/** Compose multiple refs (callback or object) onto one node — used by tiles
 *  that are both a drag source and a reorder drop target. */
export function mergeRefs(...refs) {
    return (node) => {
        for (const ref of refs) {
            if (typeof ref === 'function') ref(node);
            else if (ref && typeof ref === 'object') ref.current = node;
        }
    };
}
