import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { prefersReducedMotion } from './fx/pixelSteps.js';

/** Where the camera is: on the mat, gliding up to the Hall's sky, on the sky, or gliding back down. */
export const CAMERA = Object.freeze({ MAT: 'mat', TO_SKY: 'to-sky', SKY: 'sky', TO_MAT: 'to-mat' });

/** One whole glide, mat to sky or back; turning back mid-glide takes the share of it left. */
export const GLIDE_MS = 560;
const GLIDE_EASING = 'cubic-bezier(0.65, 0, 0.35, 1)';
/**
 * A fresh glide waits for frames to flow after the side just laid down: at least this many
 * frames, then one that follows the one before within the gap; at most this long.
 */
export const SETTLE = Object.freeze({ frames: 4, gapMs: 50, maxMs: 1000 });
/**
 * ⚠️ A hidden window draws no frames, so its glide never starts or reports done: a timer lands it
 * this long after a glide that has not started was asked for, or this much after the end of one
 * that has.
 */
export const FIRST_FRAME_WAIT_MS = 2000;
const GLIDE_SPARE_MS = 250;

const isGliding = (phase) => phase === CAMERA.TO_SKY || phase === CAMERA.TO_MAT;

/** Where the camera heads when the Hall opens (`open`) or closes; `still` is reduced motion. */
export function cameraAfter(phase, open, still) {
    if (open) {
        if (phase === CAMERA.SKY || phase === CAMERA.TO_SKY) return still ? CAMERA.SKY : phase;
        return still ? CAMERA.SKY : CAMERA.TO_SKY;
    }
    if (phase === CAMERA.MAT || phase === CAMERA.TO_MAT) return still ? CAMERA.MAT : phase;
    return still ? CAMERA.MAT : CAMERA.TO_MAT;
}

/** The vertical move in a computed `transform`, in px (0 for none). */
export function translateYOf(transform) {
    const m = /^matrix(3d)?\(([^)]+)\)$/.exec((transform || '').trim());
    if (!m) return 0;
    const v = m[2].split(',').map(Number);
    const y = m[1] ? v[13] : v[5];
    return Number.isFinite(y) ? y : 0;
}

/**
 * The camera over the mat's column: the Guild Hall's night sky lies above the wood table, one
 * column height up. Opening the Hall glides the camera up from the mat to the sky and closing
 * glides it back down. Two layers move, by the same compositor transform from the same frame:
 * this wrapper (the mat, and the Hall's screen laid above it) and the backdrop under the whole
 * screen (the sky over the wood), so the nav stays put over a world that moves. No layout and no
 * React render while they move: the mat is neither redrawn nor measured again. A click or a key
 * finishes a glide; reduced motion swaps at once.
 *
 * At rest each side is drawn as it is without the camera. On the mat nothing of the Hall is
 * mounted, styled or listening. On the sky the mat is gone, nothing is moved or promoted, and the
 * Hall's screen and its sky sit where they always have; they stay mounted through the arrival,
 * so the sky's drift runs on unbroken.
 *
 * @param {object} props
 * @param {boolean} props.open  whether the Hall screen is open
 * @param {boolean} [props.away]  another view replaced the Hall: no glide back to the mat
 * @param {React.ReactNode} props.sky  the Hall's sky, laid under the whole screen
 * @param {React.ReactNode} props.hall  the Hall's screen, laid over the column
 * @param {object} [props.table]  the wood's background style, as `tableAnchor` draws it
 * @param {{ current: HTMLElement | null }} [props.tableAnchor]  the element the wood is drawn on,
 *   as tall as this column; the moving backdrop is laid in it, under the nav and this column
 * @param {React.ReactNode} props.children  what lies on the mat's part of the table
 */
export const HallCamera = ({ open, away = false, sky, hall, table, tableAnchor, children }) => {
    const cameraRef = useRef(null);
    const tableRef = useRef(null);
    const glideRef = useRef(null);
    const [phase, setPhase] = useState(open ? CAMERA.SKY : CAMERA.MAT);
    const [seen, setSeen] = useState({ open, away });
    if (seen.open !== open || seen.away !== away) {
        setSeen({ open, away });
        setPhase(p => (away && !open ? CAMERA.MAT : cameraAfter(p, open, prefersReducedMotion())));
    }

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

    /** The glide in progress has arrived, or was skipped: rest where it was heading. */
    const arrive = useCallback((glide) => {
        if (glide && glideRef.current !== glide) return;
        setPhase(p => (p === CAMERA.TO_SKY ? CAMERA.SKY : p === CAMERA.TO_MAT ? CAMERA.MAT : p));
    }, []);

    const finish = useCallback(() => {
        if (glideRef.current) arrive(glideRef.current);
    }, [arrive]);

    useLayoutEffect(() => {
        const el = cameraRef.current;
        // At rest the rest style is committed already, so cancelling shows no in-between frame.
        if (!el || !isGliding(phase)) {
            stopGlide();
            return;
        }
        const height = el.offsetHeight;
        // Turning back: from where the camera is. A glide still waiting for its first frame has
        // not moved it, so it turns back where it started, which is where the new glide ends.
        const prior = glideRef.current;
        const moving = !!prior?.anims.length;
        const from = prior
            ? (moving ? translateYOf(getComputedStyle(el).transform) : prior.from)
            : (phase === CAMERA.TO_SKY ? 0 : height);
        stopGlide();
        const to = phase === CAMERA.TO_SKY ? height : 0;
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
            glide.anims = [el, tableRef.current].filter(Boolean).map(node => node.animate(keyframes, timing));
            glide.anims[0].onfinish = () => arrive(glide);
            landBy(ms + GLIDE_SPARE_MS);
        };
        if (moving) {
            start();
            return;
        }
        // ⚠️ A fresh glide starts once the side just laid down has been drawn and frames flow
        // again. The frames after a mount can stall (on a session's first open of the Hall the
        // browser readies the sky's new layers, ~0.3 s), and a glide started before that stall had
        // run most of its course when the first frame after it showed. Until it starts, the camera
        // holds where the glide starts.
        landBy(FIRST_FRAME_WAIT_MS);
        const asked = performance.now();
        let seen = 0;
        let last = null;
        const settle = (t) => {
            if (glideRef.current !== glide) return;
            seen++;
            const steady = last != null && t - last <= SETTLE.gapMs;
            last = t;
            if ((seen >= SETTLE.frames && steady) || t - asked >= SETTLE.maxMs) start();
            else glide.frame = requestAnimationFrame(settle);
        };
        glide.frame = requestAnimationFrame(settle);
    }, [phase, stopGlide, arrive]);

    useEffect(() => stopGlide, [stopGlide]);

    // A key finishes the glide; Escape on the way up is left to the Hall, which closes and turns
    // the camera back from where it is.
    useEffect(() => {
        if (!isGliding(phase)) return undefined;
        const onKey = (e) => {
            if (e.key === 'Escape' && phase === CAMERA.TO_SKY) return;
            finish();
        };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, [phase, finish]);

    const gliding = isGliding(phase);
    const skySide = phase !== CAMERA.MAT;
    const matSide = phase !== CAMERA.SKY;
    // Mid-glide the camera and the backdrop hold where the glide starts until the animation takes
    // over in the same frame; turning back, the animation in effect still holds them.
    const up = phase === CAMERA.TO_MAT;
    const tableHost = skySide ? tableAnchor?.current : null;
    return (
        <>
            {/* ⚠️ Clipped: the moved backdrop would otherwise make its host scrollable, and focus
                landing on the mat below would scroll the whole screen away. */}
            {tableHost && createPortal(
                <div aria-hidden="true" data-hall-backdrop className="absolute inset-0 overflow-clip pointer-events-none">
                    <div
                        ref={tableRef}
                        data-hall-table
                        className="absolute inset-x-0"
                        style={gliding
                            ? { top: '-100%', height: '200%', transform: up ? 'translateY(50%)' : 'translateY(0px)', willChange: 'transform' }
                            : { top: 0, height: '100%' }}
                    >
                        <div className="absolute inset-x-0" style={{ top: 0, height: gliding ? '50%' : '100%' }}>
                            {sky}
                        </div>
                        {gliding && (
                            <div
                                data-hall-wood
                                className="absolute inset-x-0"
                                style={{ ...table, backgroundPosition: '0px 0px', top: '50%', height: '50%' }}
                            />
                        )}
                    </div>
                </div>,
                tableHost
            )}
            <div
                ref={cameraRef}
                data-hall-camera={phase}
                className="flex-1 min-h-0 flex flex-col relative"
                style={gliding ? { transform: up ? 'translateY(100%)' : 'translateY(0px)', willChange: 'transform' } : undefined}
            >
                {/* The mat first: mid-glide both sides are laid, and code that looks up the board
                    by its marker (`data-board-origin`, which the upgrade web carries too) finds the mat. */}
                {matSide && children}
                {skySide && (
                    <div
                        data-hall-stage
                        className="absolute inset-x-0 flex"
                        style={{ top: gliding ? '-100%' : 0, height: '100%' }}
                    >
                        {hall}
                    </div>
                )}
            </div>
            {/* Over the moving camera, which is a stacking context of its own while it moves: a
                local layer of the column's, not a screen-level one. */}
            {gliding && (
                <div aria-hidden="true" data-hall-skip className="absolute inset-0 z-20 pointer-events-auto" onPointerDown={finish} />
            )}
        </>
    );
};

export default HallCamera;
