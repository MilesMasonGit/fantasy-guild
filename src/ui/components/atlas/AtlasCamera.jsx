import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { prefersReducedMotion } from './AtlasTome.jsx';

/** Where the camera is: on the mat, gliding up to the book, on the book, or gliding back down. */
export const CAMERA = Object.freeze({ MAT: 'mat', TO_BOOK: 'to-book', BOOK: 'book', TO_MAT: 'to-mat' });

/** One whole glide, mat to book or back; turning back mid-glide takes the share of it left. */
export const GLIDE_MS = 560;
const GLIDE_EASING = 'cubic-bezier(0.65, 0, 0.35, 1)';
/** ⚠️ A hidden window draws no frames, so its glide never reports done: a timer ends it this much later. */
const GLIDE_SPARE_MS = 250;

const isGliding = (phase) => phase === CAMERA.TO_BOOK || phase === CAMERA.TO_MAT;
const onBookSide = (phase) => phase === CAMERA.BOOK || phase === CAMERA.TO_MAT;

/** Where the camera heads when the Atlas opens (`open`) or closes; `still` is reduced motion. */
export function cameraAfter(phase, open, still) {
    if (open) {
        if (phase === CAMERA.BOOK || phase === CAMERA.TO_BOOK) return phase;
        return still ? CAMERA.BOOK : CAMERA.TO_BOOK;
    }
    if (phase === CAMERA.MAT || phase === CAMERA.TO_MAT) return phase;
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
 * Where the tiles start down the table layer, which is twice the table's height and begins one
 * table height above it. `50%` places the tile at half the room the layer has past one tile: the
 * table's height less half a tile. Half a tile more puts a tile edge at the table's top, where the
 * wood around the mat has one, at any window height.
 */
export function tableTileY(backgroundSize) {
    const tile = parseFloat(backgroundSize);
    return Number.isFinite(tile) && tile > 0 ? `calc(50% + ${tile / 2}px)` : '0px';
}

/**
 * The camera over the mat's column: the playmat and the Atlas book lie on one wood table, the book
 * one column height above the mat. Opening the Atlas glides the camera up to the book and closing
 * glides it back down. Two layers move, by the same compositor transform at the same moment: this
 * wrapper (what is on the mat, and the book above it) and the wood under the whole screen, so the
 * nav's buttons stay put over a table that moves. No layout and no React render while they move:
 * the mat is neither redrawn nor measured again. A click or a key finishes a glide; reduced motion
 * swaps at once.
 *
 * While the camera rests on the mat nothing of this is mounted, styled or listening: the book, the
 * moving table and the skip catcher exist only from the moment the Atlas opens until the camera is
 * back on the mat.
 *
 * @param {object} props
 * @param {boolean} props.open  whether the Atlas is open
 * @param {boolean} [props.away]  another full-screen view has the column: no glide back to the mat
 * @param {React.ReactNode} props.book  the Atlas screen
 * @param {object} [props.table]  the wood's background style, as `tableAnchor` draws it
 * @param {{ current: HTMLElement | null }} [props.tableAnchor]  the element the wood is drawn on, as
 *   tall as this column; the moving wood is laid in it, under the nav and this column
 * @param {(held: boolean) => React.ReactNode} [props.arrival]  what waits for the camera to be on the mat
 * @param {React.ReactNode} props.children  what lies on the mat's part of the table
 */
export const AtlasCamera = ({ open, away = false, book, table, tableAnchor, arrival, children }) => {
    const cameraRef = useRef(null);
    const tableRef = useRef(null);
    const glideRef = useRef(null);
    const [phase, setPhase] = useState(open ? CAMERA.BOOK : CAMERA.MAT);
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
        for (const anim of glide.anims) {
            anim.onfinish = null;
            anim.cancel();
        }
    }, []);

    /** The glide in progress has arrived, or was skipped: rest where it was heading. */
    const arrive = useCallback((glide) => {
        if (glide && glideRef.current !== glide) return;
        setPhase(p => (p === CAMERA.TO_BOOK ? CAMERA.BOOK : p === CAMERA.TO_MAT ? CAMERA.MAT : p));
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
        const from = glideRef.current ? translateYOf(getComputedStyle(el).transform) : (phase === CAMERA.TO_BOOK ? 0 : height);
        stopGlide();
        const to = phase === CAMERA.TO_BOOK ? height : 0;
        const ms = height > 0 ? Math.round(GLIDE_MS * Math.min(1, Math.abs(to - from) / height)) : 0;
        if (typeof el.animate !== 'function' || ms <= 0) {
            arrive(null);
            return;
        }
        // Started in the same frame, the two run from the same start time.
        const keyframes = [{ transform: `translateY(${from}px)` }, { transform: `translateY(${to}px)` }];
        const timing = { duration: ms, easing: GLIDE_EASING, fill: 'forwards' };
        const anims = [el, tableRef.current].filter(Boolean).map(node => node.animate(keyframes, timing));
        const glide = { anims, timer: null };
        glide.timer = setTimeout(() => arrive(glide), ms + GLIDE_SPARE_MS);
        anims[0].onfinish = () => arrive(glide);
        glideRef.current = glide;
    }, [phase, stopGlide, arrive]);

    useEffect(() => stopGlide, [stopGlide]);

    // A key finishes the glide; Escape on the way up is left to the Atlas, which closes and turns
    // the camera back from where it is.
    useEffect(() => {
        if (!isGliding(phase)) return undefined;
        const onKey = (e) => {
            if (e.key === 'Escape' && phase === CAMERA.TO_BOOK) return;
            finish();
        };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, [phase, finish]);

    const up = phase !== CAMERA.MAT;
    const tableHost = up ? tableAnchor?.current : null;
    return (
        <>
            {tableHost && createPortal(
                <div
                    ref={tableRef}
                    aria-hidden="true"
                    data-atlas-table
                    className="absolute inset-x-0 pointer-events-none"
                    style={{
                        ...table,
                        backgroundPosition: `0px ${tableTileY(table?.backgroundSize)}`,
                        top: '-100%',
                        height: '200%',
                        transform: onBookSide(phase) ? 'translateY(50%)' : 'translateY(0px)',
                        willChange: 'transform'
                    }}
                />,
                tableHost
            )}
            <div
                ref={cameraRef}
                data-atlas-camera={phase}
                className="flex-1 min-h-0 flex flex-col relative"
                style={up ? { transform: onBookSide(phase) ? 'translateY(100%)' : 'translateY(0px)', willChange: 'transform' } : undefined}
            >
                {up && (
                    <div data-atlas-stage className="absolute inset-x-0" style={{ top: '-100%', height: '100%' }}>
                        {book}
                    </div>
                )}
                {children}
            </div>
            {isGliding(phase) && (
                <div aria-hidden="true" data-atlas-skip className="absolute inset-0 z-[104] pointer-events-auto" onPointerDown={finish} />
            )}
            {arrival?.(up)}
        </>
    );
};

export default AtlasCamera;
