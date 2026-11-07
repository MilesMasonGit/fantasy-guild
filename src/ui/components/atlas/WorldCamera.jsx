import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { prefersReducedMotion } from '../board/fx/pixelSteps.js';
import { GLIDE_MS, SETTLE, FIRST_FRAME_WAIT_MS, translateYOf } from '../board/HallCamera.jsx';

/** Where the camera is: on the mat, panning down to the world map, on the map, or back up. */
export const WORLD_CAMERA = Object.freeze({ MAT: 'mat', TO_WORLD: 'to-world', WORLD: 'world', TO_MAT: 'to-mat' });

const GLIDE_EASING = 'cubic-bezier(0.65, 0, 0.35, 1)';
const GLIDE_SPARE_MS = 250;

/**
 * Whether the camera rests on the world map (true off any camera, as in a test): heavy drawing on
 * the map (a place's mat preview) waits for it, so it does not stall the glide's frames.
 */
const ArrivedContext = createContext(true);
export const useWorldArrived = () => useContext(ArrivedContext);

/**
 * Where the mat's room lies inside the full-screen map, as `{ left, top, right, bottom }` px from
 * each screen edge: the clear part between the nav, the hero bar and the screen's edges, which the
 * map centres in and the place panel sits in. All zero off any camera, and when the map is laid in
 * the room itself.
 */
export const NO_WORLD_INSETS = Object.freeze({ left: 0, top: 0, right: 0, bottom: 0 });
const InsetsContext = createContext(NO_WORLD_INSETS);
export const useWorldInsets = () => useContext(InsetsContext);

const sameInsets = (a, b) => a.left === b.left && a.top === b.top && a.right === b.right && a.bottom === b.bottom;

/** The room's box inside the screen's, as insets from each screen edge, in whole px. */
export function insetsOf(room, screen) {
    return {
        left: Math.round(room.left - screen.left),
        top: Math.round(room.top - screen.top),
        right: Math.round(screen.right - room.right),
        bottom: Math.round(screen.bottom - room.bottom)
    };
}

const isGliding = (phase) => phase === WORLD_CAMERA.TO_WORLD || phase === WORLD_CAMERA.TO_MAT;

/** Where the camera heads when the map opens (`open`) or closes; `still` is reduced motion. */
export function worldCameraAfter(phase, open, still) {
    if (open) {
        if (phase === WORLD_CAMERA.WORLD || phase === WORLD_CAMERA.TO_WORLD) return still ? WORLD_CAMERA.WORLD : phase;
        return still ? WORLD_CAMERA.WORLD : WORLD_CAMERA.TO_WORLD;
    }
    if (phase === WORLD_CAMERA.MAT || phase === WORLD_CAMERA.TO_MAT) return still ? WORLD_CAMERA.MAT : phase;
    return still ? WORLD_CAMERA.MAT : WORLD_CAMERA.TO_MAT;
}

/**
 * The camera over the mat's room that pans down to the world map: the map lies below the mat, one
 * screen height down. Opening the map glides the mat up and away and the map up into its place;
 * closing it glides back. The mat's top bar goes with the mat; the hero bar and the nav, outside
 * this room, stay. While it moves the wood table round the mat moves with it (a copy of the
 * table's background, lined up with it), so it reads as one look downward. A click or a key
 * finishes a glide; reduced motion swaps at once.
 *
 * The map runs under the whole screen, as the Guild Hall's sky does: it is laid in `tableAnchor`
 * (the screen's box, under the nav, this column and the hero bar), so nothing clips it at the
 * column's edge, and the room's place in it is handed down ({@link useWorldInsets}). While it
 * moves, that layer holds a copy of the wood above the map and glides by the same transform from
 * the same frame as the camera, a screen height, so the whole screen pans as one.
 *
 * At rest each side is drawn as it is without the camera: on the mat nothing of the map is
 * mounted; on the map the mat is gone, as on the Guild Hall's sky (`HallCamera`).
 *
 * ⚠️ It never glides while the Hall's camera does: it sits on the mat's side of that camera, so it
 * is not mounted while the Hall is open, and another view taking over (`away`, the Hall among
 * them) sets it on the mat at once, with no glide back.
 *
 * @param {object} props
 * @param {boolean} props.open  whether the world map is open
 * @param {boolean} [props.away]  another view replaced the map: no glide back to the mat
 * @param {React.ReactNode} props.world  the world map screen
 * @param {object} [props.table]  the wood's background style, as `tableAnchor` draws it
 * @param {{ current: HTMLElement | null }} [props.tableAnchor]  the element the wood is drawn on,
 *   the screen's box; without one the map is laid in the room
 * @param {React.ReactNode} props.children  what lies on the mat's side
 */
export const WorldCamera = ({ open, away = false, world, table, tableAnchor, children }) => {
    const roomRef = useRef(null);
    const cameraRef = useRef(null);
    const layerRef = useRef(null);
    const glideRef = useRef(null);
    const [phase, setPhase] = useState(open ? WORLD_CAMERA.WORLD : WORLD_CAMERA.MAT);
    const [seen, setSeen] = useState({ open, away });
    if (seen.open !== open || seen.away !== away) {
        setSeen({ open, away });
        setPhase(p => (away && !open ? WORLD_CAMERA.MAT : worldCameraAfter(p, open, prefersReducedMotion())));
    }
    // Where the wood lies under the camera, so the moving copy lines up with the still one.
    const [woodAt, setWoodAt] = useState('0px 0px');
    const [insets, setInsets] = useState(NO_WORLD_INSETS);

    const gliding = isGliding(phase);
    const worldSide = phase !== WORLD_CAMERA.MAT;
    const matSide = phase !== WORLD_CAMERA.WORLD;
    const back = phase === WORLD_CAMERA.TO_MAT;
    const screenHost = worldSide ? (tableAnchor?.current ?? null) : null;

    // The room's place in the screen: on every draw (the nav may have changed sides) and on resize.
    useLayoutEffect(() => {
        if (!screenHost) return undefined;
        const measure = () => {
            const room = roomRef.current;
            if (!room) return;
            const next = insetsOf(room.getBoundingClientRect(), screenHost.getBoundingClientRect());
            setInsets(prev => (sameInsets(prev, next) ? prev : next));
        };
        measure();
        window.addEventListener('resize', measure);
        const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
        if (ro) {
            ro.observe(roomRef.current);
            ro.observe(screenHost);
        }
        return () => {
            window.removeEventListener('resize', measure);
            ro?.disconnect();
        };
    });

    const stopGlide = useCallback(() => {
        const glide = glideRef.current;
        if (!glide) return;
        glideRef.current = null;
        clearTimeout(glide.timer);
        cancelAnimationFrame(glide.frame);
        for (const anim of glide.anims) {
            anim.onfinish = null;
            anim.cancel();
        }
    }, []);

    const arrive = useCallback((glide) => {
        if (glide && glideRef.current !== glide) return;
        setPhase(p => (p === WORLD_CAMERA.TO_WORLD ? WORLD_CAMERA.WORLD : p === WORLD_CAMERA.TO_MAT ? WORLD_CAMERA.MAT : p));
    }, []);

    const finish = useCallback(() => {
        if (glideRef.current) arrive(glideRef.current);
    }, [arrive]);

    useLayoutEffect(() => {
        const el = cameraRef.current;
        if (!el || !isGliding(phase)) {
            stopGlide();
            return;
        }
        const anchor = tableAnchor?.current;
        if (anchor) {
            const a = anchor.getBoundingClientRect();
            const b = el.parentElement.getBoundingClientRect();
            setWoodAt(`${Math.round(a.left - b.left)}px ${Math.round(a.top - b.top)}px`);
        }
        // A screen height while the map lies under the screen: the mat leaves the room wholly as
        // the map arrives, and the two layers move as one.
        const layer = layerRef.current;
        const height = layer && anchor ? anchor.offsetHeight : el.offsetHeight;
        // Turning back: from where the camera is. A glide still waiting for its first frame has
        // not moved it, so it turns back where it started.
        const prior = glideRef.current;
        const moving = !!prior?.anims.length;
        const from = prior
            ? (moving ? translateYOf(getComputedStyle(el).transform) : prior.from)
            : (phase === WORLD_CAMERA.TO_WORLD ? 0 : -height);
        stopGlide();
        const to = phase === WORLD_CAMERA.TO_WORLD ? -height : 0;
        const ms = height > 0 ? Math.round(GLIDE_MS * Math.min(1, Math.abs(to - from) / height)) : 0;
        if (typeof el.animate !== 'function' || ms <= 0) {
            arrive(null);
            return;
        }
        const glide = { from, anims: [], timer: null, frame: 0 };
        glideRef.current = glide;
        const landBy = (wait) => {
            clearTimeout(glide.timer);
            glide.timer = setTimeout(() => arrive(glide), wait);
        };
        const start = () => {
            if (glideRef.current !== glide) return;
            // Started in the same frame, the two run from the same start time.
            const keyframes = [{ transform: `translateY(${from}px)` }, { transform: `translateY(${to}px)` }];
            const timing = { duration: ms, easing: GLIDE_EASING, fill: 'forwards' };
            glide.anims = [el, layerRef.current].filter(Boolean).map(node => node.animate(keyframes, timing));
            glide.anims[0].onfinish = () => arrive(glide);
            landBy(ms + GLIDE_SPARE_MS);
        };
        if (moving) {
            start();
            return;
        }
        // ⚠️ As the Hall's glide: a fresh glide starts once the side just laid down has been
        // drawn and frames flow again (the map's first picture takes a moment to build), so it
        // does not run most of its course before the first frame shows.
        landBy(FIRST_FRAME_WAIT_MS);
        const asked = performance.now();
        let count = 0;
        let last = null;
        const settle = (time) => {
            if (glideRef.current !== glide) return;
            count++;
            const steady = last != null && time - last <= SETTLE.gapMs;
            last = time;
            if ((count >= SETTLE.frames && steady) || time - asked >= SETTLE.maxMs) start();
            else glide.frame = requestAnimationFrame(settle);
        };
        glide.frame = requestAnimationFrame(settle);
    }, [phase, stopGlide, arrive, tableAnchor]);

    useEffect(() => stopGlide, [stopGlide]);

    // A key finishes the glide; Escape on the way down is left to the map, which closes and turns
    // the camera back from where it is.
    useEffect(() => {
        if (!isGliding(phase)) return undefined;
        const onKey = (e) => {
            if (e.key === 'Escape' && phase === WORLD_CAMERA.TO_WORLD) return;
            finish();
        };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, [phase, finish]);

    const worldScreen = (
        <ArrivedContext.Provider value={phase === WORLD_CAMERA.WORLD}>
            <InsetsContext.Provider value={screenHost ? insets : NO_WORLD_INSETS}>{world}</InsetsContext.Provider>
        </ArrivedContext.Provider>
    );
    return (
        <div ref={roomRef} data-world-camera-room className="flex-1 flex min-h-0 relative overflow-clip">
            <div
                ref={cameraRef}
                data-world-camera={phase}
                className="flex-1 flex min-h-0 relative"
                style={gliding
                    ? { ...table, backgroundPosition: woodAt, transform: back ? 'translateY(-100%)' : 'translateY(0px)', willChange: 'transform' }
                    : undefined}
            >
                {matSide && children}
                {worldSide && !screenHost && (
                    <div data-world-stage className="absolute inset-x-0 z-10" style={{ top: gliding ? '100%' : 0, height: '100%' }}>
                        {worldScreen}
                    </div>
                )}
            </div>
            {gliding && (
                <div aria-hidden="true" data-world-skip className="absolute inset-0 z-20 pointer-events-auto" onPointerDown={finish} />
            )}
            {/* ⚠️ Clipped: the moved layer would otherwise make its host scrollable. Under the nav,
                this column and the hero bar: positioned with no layer of its own, it is drawn
                before the column (z 10) and the nav. */}
            {screenHost && createPortal(
                <div data-world-backdrop className="absolute inset-0 overflow-clip pointer-events-none">
                    <div
                        ref={layerRef}
                        data-world-table
                        className="absolute inset-x-0"
                        style={gliding
                            ? { top: 0, height: '200%', transform: back ? 'translateY(-50%)' : 'translateY(0px)', willChange: 'transform' }
                            : { top: 0, height: '100%' }}
                    >
                        {gliding && (
                            <div
                                data-world-wood
                                className="absolute inset-x-0"
                                style={{ ...table, backgroundPosition: '0px 0px', top: 0, height: '50%' }}
                            />
                        )}
                        <div data-world-stage className="absolute inset-x-0" style={{ top: gliding ? '50%' : 0, height: gliding ? '50%' : '100%' }}>
                            {worldScreen}
                        </div>
                    </div>
                    {/* Mid-glide a press anywhere on the moving screen lands it, as on the room. */}
                    {gliding && (
                        <div aria-hidden="true" data-world-skip-screen className="absolute inset-0 pointer-events-auto" onPointerDown={finish} />
                    )}
                </div>,
                screenHost
            )}
        </div>
    );
};

export default WorldCamera;
