import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../board/fx/pixelSteps.js';
import { GLIDE_MS, SETTLE, FIRST_FRAME_WAIT_MS, translateYOf } from '../board/HallCamera.jsx';

/** Where the camera is: on the mat, panning down to the world map, on the map, or back up. */
export const WORLD_CAMERA = Object.freeze({ MAT: 'mat', TO_WORLD: 'to-world', WORLD: 'world', TO_MAT: 'to-mat' });

const GLIDE_EASING = 'cubic-bezier(0.65, 0, 0.35, 1)';
const GLIDE_SPARE_MS = 250;

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
 * room height down. Opening the map glides the mat up and away and the map up into its place;
 * closing it glides back. The mat's top bar goes with the mat; the hero bar and the nav, outside
 * this room, stay. While it moves the wood table round the mat moves with it (a copy of the
 * table's background, lined up with it), so it reads as one look downward. A click or a key
 * finishes a glide; reduced motion swaps at once.
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
 * @param {{ current: HTMLElement | null }} [props.tableAnchor]  the element the wood is drawn on
 * @param {React.ReactNode} props.children  what lies on the mat's side
 */
export const WorldCamera = ({ open, away = false, world, table, tableAnchor, children }) => {
    const cameraRef = useRef(null);
    const glideRef = useRef(null);
    const [phase, setPhase] = useState(open ? WORLD_CAMERA.WORLD : WORLD_CAMERA.MAT);
    const [seen, setSeen] = useState({ open, away });
    if (seen.open !== open || seen.away !== away) {
        setSeen({ open, away });
        setPhase(p => (away && !open ? WORLD_CAMERA.MAT : worldCameraAfter(p, open, prefersReducedMotion())));
    }
    // Where the wood lies under the camera, so the moving copy lines up with the still one.
    const [woodAt, setWoodAt] = useState('0px 0px');

    const stopGlide = useCallback(() => {
        const glide = glideRef.current;
        if (!glide) return;
        glideRef.current = null;
        clearTimeout(glide.timer);
        cancelAnimationFrame(glide.frame);
        if (glide.anim) {
            glide.anim.onfinish = null;
            glide.anim.cancel();
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
        const height = el.offsetHeight;
        // Turning back: from where the camera is. A glide still waiting for its first frame has
        // not moved it, so it turns back where it started.
        const prior = glideRef.current;
        const moving = !!prior?.anim;
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
        const glide = { from, anim: null, timer: null, frame: 0 };
        glideRef.current = glide;
        const landBy = (wait) => {
            clearTimeout(glide.timer);
            glide.timer = setTimeout(() => arrive(glide), wait);
        };
        const start = () => {
            if (glideRef.current !== glide) return;
            glide.anim = el.animate(
                [{ transform: `translateY(${from}px)` }, { transform: `translateY(${to}px)` }],
                { duration: ms, easing: GLIDE_EASING, fill: 'forwards' }
            );
            glide.anim.onfinish = () => arrive(glide);
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

    const gliding = isGliding(phase);
    const worldSide = phase !== WORLD_CAMERA.MAT;
    const matSide = phase !== WORLD_CAMERA.WORLD;
    const back = phase === WORLD_CAMERA.TO_MAT;
    return (
        <div data-world-camera-room className="flex-1 flex min-h-0 relative overflow-clip">
            <div
                ref={cameraRef}
                data-world-camera={phase}
                className="flex-1 flex min-h-0 relative"
                style={gliding
                    ? { ...table, backgroundPosition: woodAt, transform: back ? 'translateY(-100%)' : 'translateY(0px)', willChange: 'transform' }
                    : undefined}
            >
                {matSide && children}
                {worldSide && (
                    <div data-world-stage className="absolute inset-x-0 z-10" style={{ top: gliding ? '100%' : 0, height: '100%' }}>
                        {world}
                    </div>
                )}
            </div>
            {gliding && (
                <div aria-hidden="true" data-world-skip className="absolute inset-0 z-20 pointer-events-auto" onPointerDown={finish} />
            )}
        </div>
    );
};

export default WorldCamera;
