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
import { displayPointOf } from '../../systems/board/BoardState.js';

/**
 * DndKit: drag-and-drop on dnd-kit.
 * Drop resolution is deliberately decentralised: each target declares what it
 * `accepts(payload)` and what to `onDrop(payload)`, so there is no central router to grow
 * stale.
 */

const sfx = (clip) => EventBus.publish(ENGINE_EVENTS.AUDIO_PLAY, { clip });

/**
 * Collision: the pointer's containing targets, smallest-area first, so a nested child target
 * (e.g. a card tile) wins over its parent while the parent still resolves over its own empty
 * space.
 */
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
         * ⚠️ Drawers beat the board where they overlap, the same rule `surfaceAtPoint` states
         * below.
         */
        const rank = (c) => (surfaceOf(c) === DND_SURFACE.DRAWER ? 0 : 1);

        return [...hits].sort((a, b) => rank(a) - rank(b) || area(a) - area(b));
    }

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

    if (bestContainer && minDistanceSq <= 240 * 240) {
        return [bestContainer];
    }

    return [];
}

/**
 * Which surface the pointer is over ('drawer' | 'board' | null), by rect containment against
 * the big `data-dnd-region` containers. Geometric because elementFromPoint was flaky over the
 * board's stacked overlays. Drawers win over the board where they overlap. Queries the DOM
 * fresh every call; the provider's per-move check uses a snapshot taken at drag start instead.
 */
export function surfaceAtPoint(x, y) {
    if (typeof document === 'undefined') return null;
    return surfaceWithinRegions(x, y, snapshotDndRegions());
}

export function snapshotDndRegions() {
    if (typeof document === 'undefined') return [];
    const out = [];
    for (const el of document.querySelectorAll('[data-dnd-region]')) {
        out.push({ surface: el.getAttribute('data-dnd-region'), rect: el.getBoundingClientRect() });
    }
    return out;
}

/**
 * The same priority rule as `surfaceAtPoint` (a drawer over the board), against rects already
 * measured. Nothing can open, close or resize a drawer mid-drag, so a snapshot taken at drag
 * start stays exact for the whole drag.
 */
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


// Static, so passing it to <DndContext> never counts as a changed prop.
const AUTO_SCROLL = { enabled: true, threshold: { x: 0, y: 0.18 } };

/**
 * Whatever is carried casts the hard pixel shadow `PixelArt` draws for `lifted`; a soft
 * drop-shadow on top would be a second, blurred shadow, so the overlay only brightens.
 */
export function overlayFilter() {
    return 'brightness(1.15) saturate(1.25)';
}

export const DeckDndContext = React.createContext({ activePayload: null, isDragging: false });
export const useActiveDrag = () => React.useContext(DeckDndContext);

/**
 * Where the cursor is while a drag is live, in viewport coordinates, or null when nothing is
 * in the hand.
 * ⚠️ Its own context on purpose: this changes every animation frame, and many board Tokens
 * read `useActiveDrag`, so putting the pointer there would re-render them all 60 times a
 * second for a value only the range rings care about. Consumers of this one are leaves.
 */
export const DragPointerContext = React.createContext(null);
export const useDragPointer = () => React.useContext(DragPointerContext);

/**
 * Which big region ('board' | 'drawer' | null) the pointer is over while a drag is live.
 * Changes only when the pointer crosses a region boundary, so a dedicated context is cheap,
 * unlike `DragPointerContext` above.
 */
export const DragSurfaceContext = React.createContext(undefined);
export const useDragSurface = () => React.useContext(DragSurfaceContext);
import { isElementOpaqueAtPoint } from '../utils/alphaHitTest.js';
import { isDisallowMode } from '../hooks/useDisallowMode.js';
import { isMatBankLocked } from '../hooks/useMatBankLock.js';
import { ENGINE_EVENTS, UI_EVENTS } from '../../systems/core/engineEvents.js';

/**
 * Owns the per-frame cursor publish, so a frame where only the cursor moved re-renders just
 * this component and the context's consumers, not `DeckDndProvider`. The `children` it hands
 * down stay the same element across in-between frames, and React bails out of re-rendering an
 * unchanged child element.
 */
export function DragPointerProvider({ activePayload, pointerRef, children }) {
    const [dragPointer, setDragPointer] = useState(null);
    const frameRef = useRef(0);

    useEffect(() => {
        if (!activePayload) {
            setDragPointer(null);
            return undefined;
        }
        // Seed immediately: handleDragStart already stamped pointerRef with the activator
        // event's coordinates before this effect can run.
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
                // Dragging ON THE MAT pauses in disallow mode: Tokens, heroes and flags all
                // live inside the mat's `data-board-origin` box. The dock and the Bank still
                // drag. A refused press stays a plain click, which the mode turns into a flip.
                // While the Bank is open the mat is not interactive at all, so nothing on it
                // may even start a drag.
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
    const regionsRef = useRef([]);

    const sensors = useSensors(
        useSensor(AlphaPointerSensor, { activationConstraint: { distance: 8 } })
    );

    // While a drag is live, track which surface the cursor is over so the ghost can bloom bold
    // over the board and stay compact over a drawer.
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

        // Starting a hero drag from the dock tab or inspection panel while the hero is already
        // on the playmat shoots a flying sprite from the playmat tile straight to the cursor.
        if (payload?.kind === DRAG_KIND.HERO && payload.heroId && payload.from?.dock) {
            const at = displayPointOf(payload.heroId);
            if (at) {
                const { x, y } = at;
                const toScreenX = a?.clientX ?? (typeof window !== 'undefined' ? window.innerWidth - 40 : 0);
                const toScreenY = a?.clientY ?? (typeof window !== 'undefined' ? window.innerHeight / 2 : 0);

                // A UI-only event: SPRITE_COLLECTED is the engine's, and quests count it.
                EventBus.publish(UI_EVENTS.UI_PARTICLE_FLY, {
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
        // dragPointer itself is cleared by DragPointerProvider's own effect, which re-runs the
        // moment activePayload goes null.
        if (typeof document !== 'undefined') document.body.classList.remove('gi-dnd-active');
    }, []);

    const handleDragEnd = useCallback((event) => {
        const { active, over } = event;
        const payload = active?.data?.current;
        let success = false;

        // A live target under the release point wins over dnd-kit's `over`, which can be stale.
        const live = payload ? liveDropTargetAt(payload, pointerRef.current) : null;
        if (payload && (live || over)) {
            const data = live || over.data?.current;
            if (data?.accepts?.(payload)) {
                const node = live ? live.node?.() : document.querySelector(`[data-dnd-droppable-id="${over.id}"]`);
                if (node) {
                    const r = node.getBoundingClientRect();
                    glideTargetRef.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
                }
                // Hand the drop point to the target. Free-surface targets need to
                // know WHERE inside themselves the drop landed; `pointerRef` is the live
                // cursor in viewport coordinates. Every other target ignores the second
                // argument. A target that can only tell at drop time that it will not take it
                // (the playmat, for a Token dropped well outside the landing area) returns
                // `false`: the drop counts as a miss and the ghost flies back.
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

    // Drop animation: on a MISS, spring the ghost back to where it came from; on a SUCCESS,
    // hand over to the destination instantly (see below). A `useMemo` with no dependencies:
    // `glideTargetRef` and `pointerRef` are read at CALL time, so memoising never serves a
    // stale value, and a fresh object every render would count as a changed prop for dnd-kit.
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
            // ⚠️ On a SUCCESSFUL drop the ghost must vanish at once, not glide. State updates
            // synchronously in `handleDragEnd`, so the real Token is already on the tile, and
            // a glide would draw the same sprite twice in the same place. The destination's
            // landing animation starts raised and drops where the ghost was, so the instant
            // handover is invisible. A MISS still animates: the branch above springs the ghost
            // back, the one case where the ghost is the only thing that can tell the story.
            return [{ opacity: 0 }, { opacity: 0 }];
        },
        sideEffects() { return () => { glideTargetRef.current = null; }; }
    }), []);

    const bold = surface === DND_SURFACE.BOARD;

    // Memoised so consumers re-render only when the active payload changes.
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
                            style={{ filter: overlayFilter() }}
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


/**
 * Make a node a drag source. `payload` is merged into the drag data under the given `kind`;
 * `sourceSurface` seeds the ghost's compact/bold state at pickup.
 * `keyboardAccessible` (default true): whether dnd-kit's own `attributes` (`role="button"`,
 * `tabIndex={0}`, aria text about pressing space bar) are spread onto the node. ⚠️ There is no
 * keyboard sensor registered (`DeckDndProvider` wires only `AlphaPointerSensor`), so that text
 * describes a drag that cannot happen. `MatToken` passes `false`, which drops the false
 * instructions and the Tab stop.
 */
export function useEntityDrag({
    id, kind, payload, sourceSurface = DND_SURFACE.DRAWER, disabled = false, keyboardAccessible = true
}) {
    const rid = useId();
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: id || `${kind}-${rid}`,
        disabled,
        data: { kind, sourceSurface, ...payload }
    });
    return {
        setNodeRef,
        isDragging,
        handleProps: keyboardAccessible ? { ...listeners, ...attributes } : { ...listeners }
    };
}

/**
 * Drop targets that answer for themselves at the moment of release, ahead of dnd-kit's `over`.
 * ⚠️ dnd-kit learns that a target was switched on only from React's passive effects, about
 * 25 ms after the pointer move that opened it, and its `over` lags further behind. A pop-out
 * target (the bin sidebar) is drawn open within ~5 ms of that move, so a release in between
 * landed on whatever `over` still named (the mat). A live target is asked directly, with the
 * live pointer, so what the player sees open is what takes the drop.
 * Each entry: `{ accepts(payload), contains(pointer), onDrop(payload, ctx), node() }`.
 */
const liveDropTargets = new Set();

/** Register a live drop target while the calling component is mounted (see above). */
export function useLiveDropTarget(target) {
    const ref = useRef(target);
    ref.current = target;
    useEffect(() => {
        const entry = { get: () => ref.current };
        liveDropTargets.add(entry);
        return () => { liveDropTargets.delete(entry); };
    }, []);
}

/** The live drop target that takes `payload` released at `pointer`, or null. */
export function liveDropTargetAt(payload, pointer) {
    if (!payload || !pointer) return null;
    for (const entry of liveDropTargets) {
        const target = entry.get();
        if (target?.accepts?.(payload) && target.contains?.(pointer)) return target;
    }
    return null;
}

/**
 * Make a node a drop target. Returns validity flags for the hovered state (only the target
 * under the cursor is ever `isOver`, via pointerWithin) plus the props the provider needs to
 * find and resolve the drop.
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

export const ACCEPT_CLS = 'ring-2 ring-gi-success/80 bg-gi-success/10';
export const REJECT_CLS = 'ring-2 ring-gi-danger/80 bg-gi-danger/10';

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

/** Compose multiple refs (callback or object) onto one node. */
export function mergeRefs(...refs) {
    return (node) => {
        for (const ref of refs) {
            if (typeof ref === 'function') ref(node);
            else if (ref && typeof ref === 'object') ref.current = node;
        }
    };
}
