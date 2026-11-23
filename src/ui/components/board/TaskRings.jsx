import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useMatSize } from '../../hooks/useMatSize.js';
import { useMatFit } from './MatFitContext.jsx';
import { boardScaleAt } from '../base/TokenSprite.jsx';
import { MAT_Z } from './matLayers.js';
import { MAT_EDGE } from './groundScreen.js';
import { onFrame, isDrawingPaused } from './frameClock.js';
import { prefersReducedMotion } from './fx/pixelSteps.js';
import {
    TASK_RING_COLOUR, TASK_RING_STUCK_COLOUR, TASK_DIM_LIGHT, TASK_DIM_GREY, NO_RINGS,
    createTaskRingSet, taskRingTarget, dimRuns, edgeRuns, insideRuns, ringEdgePaths, runsPath
} from './taskRing.js';

const NO_JOBS = Object.freeze([]);
const RING_SHADOW = '#000';
/** Any grey: blended as `saturation`, only its lack of colour counts. */
const DRAIN_GREY = '#808080';

const svgStyle = (z, blend) => (blend ? { zIndex: z, mixBlendMode: blend } : { zIndex: z });

/** Working rings first, stuck ones last: where a stuck ring crosses a working one, the cells they share are amber. */
const byStuckLast = (rings) => (rings.some(r => r.stuck) ? [...rings.filter(r => !r.stuck), ...rings.filter(r => r.stuck)] : rings);

/**
 * The shapes the rings draw, in art pixels from the mat's corner: the dim inside them all, the outer
 * edge of their merged shape (the shadow) and each ring's own part of that edge. Worked out again
 * only when the rings change: once per frame while one grows or shrinks, never at rest.
 */
function shapesOf(rings) {
    const rows = dimRuns(rings);
    const edge = edgeRuns(rows);
    return { dim: runsPath(insideRuns(rows, edge)), shadow: runsPath(edge), edges: ringEdgePaths(rings, edge) };
}

/**
 * The task rings: a ring round every job in progress (`taskRing.taskJobsOf`), work green, or the
 * warning amber while the job is stuck (its Token shows its "!"), with everything inside dimmed
 * and drained toward grey: the ground and every Token at rest, never the worked Tokens or a hero.
 * * **One dim for all the rings**, cut to the inside of their merged shape (`dimRuns`, less its
 * edge), so where rings overlap everything is dimmed once: a grey drawn as `mix-blend-mode:
 * saturation` drains {@link TASK_DIM_GREY} of the colour, then black takes the light down to
 * {@link TASK_DIM_LIGHT}. Both blend with everything below them. A Token half inside a ring is
 * dimmed on that half only.
 * * **Only the outer edge** of the merged shape is drawn (`edgeRuns`): where rings cross, no arc
 * runs through the shared dim. Each ring draws its own part of that edge in its own colour, all
 * on one black shadow, drawn after the dim, so the line keeps its colour and crosses the art of a
 * Token at rest it runs over.
 * * **Every layer at `z`** (`matLayers.taskRingZ`): over the ground and the Tokens at rest, under
 * the worked Tokens and the heroes, who stand on the line, as the action the ring frames.
 * * **Drawn only when a job starts or ends** (or turns stuck or unstuck, a hero joins one, its
 * Token moves, the mat's fit changes): at rest there is no clock, no frame and no render. A ring
 * grows when its job starts and shrinks when it ends, on the frame clock only while some ring is
 * moving, the dim and the edge following it. While drawing is paused, under reduced motion, on
 * mounting and after a reset (a load, a catch-up, travel: `resets` counts them) every ring jumps to its
 * end, so a stall or a catch-up replays nothing.
 * Clipped to the mat's rounded edge, like the reach ring; never in the pointer's way.
 * ⚠️ Every layer here is a direct stacking sibling of the ground and the Tokens (the wrapper has
 * no z-index): a stacking context between them would cut the blend off from what it dims.
 * @param {{jobs?: {id: string, x: number, y: number, r: number, stuck?: boolean}[], z?: number, resets?: number}} props
 *   the jobs in mat units, the same array while they are the same; the rings' z; how many resets
 *   the mat has heard
 */
export const TaskRings = memo(function TaskRings({ jobs = NO_JOBS, z = MAT_Z.STANDING_HERO, resets = 0 }) {
    const mat = useMatSize();
    const artScale = boardScaleAt(useMatFit());
    const [set] = useState(createTaskRingSet);
    const [rings, setRings] = useState(NO_RINGS);

    // A reset's jobs jump instead of growing. ⚠️ `resets` must come in the same render as those jobs
    // (the mat reads both in one update): a reset seen in a render of its own is spent there.
    const seenResets = useRef(null);

    useLayoutEffect(() => {
        const snap = seenResets.current !== resets || isDrawingPaused() || prefersReducedMotion();
        seenResets.current = resets;
        const now = performance.now();
        set.aim(jobs.map(j => taskRingTarget(j, artScale)), now, snap);
        setRings(set.at(now));
        if (!set.moving(now)) return undefined;
        // `performance.now()`, as the reach ring: the tweens started on it.
        let stop = onFrame(() => {
            const t = performance.now();
            setRings(set.at(t));
            if (!set.moving(t) && stop) {
                stop();
                stop = null;
            }
        });
        return () => {
            if (stop) stop();
            stop = null;
        };
    }, [jobs, resets, artScale, set]);

    const shapes = useMemo(() => shapesOf(rings), [rings]);
    if (!rings.length) return null;
    const scale = `scale(${artScale})`;
    return (
        <div
            data-task-rings
            aria-hidden="true"
            className="absolute left-0 top-0 pointer-events-none overflow-hidden"
            style={{ width: mat.w, height: mat.h, borderRadius: MAT_EDGE.radius }}
        >
            {/* ⚠️ One z for all three: their order here is their order on screen. */}
            <svg data-task-dim="grey" className="absolute left-0 top-0 overflow-visible" width={mat.w} height={mat.h} style={svgStyle(z, 'saturation')}>
                <path d={shapes.dim} transform={scale} fill={DRAIN_GREY} fillOpacity={TASK_DIM_GREY} shapeRendering="crispEdges" />
            </svg>
            <svg data-task-dim="dark" className="absolute left-0 top-0 overflow-visible" width={mat.w} height={mat.h} style={svgStyle(z)}>
                <path d={shapes.dim} transform={scale} fill="#000" fillOpacity={1 - TASK_DIM_LIGHT} shapeRendering="crispEdges" />
            </svg>
            <svg data-task-ring-layer className="absolute left-0 top-0 overflow-visible" width={mat.w} height={mat.h} style={svgStyle(z)}>
                <g shapeRendering="crispEdges">
                    <path data-task-ring-shadow d={shapes.shadow} transform={`translate(${artScale} ${artScale}) ${scale}`} fill={RING_SHADOW} />
                    {byStuckLast(rings).map(r => (
                        <path
                            key={r.id}
                            data-task-ring={r.id}
                            data-px={r.px}
                            data-stuck={r.stuck ? 'true' : undefined}
                            d={shapes.edges.get(r.id)}
                            transform={scale}
                            fill={r.stuck ? TASK_RING_STUCK_COLOUR : TASK_RING_COLOUR}
                        />
                    ))}
                </g>
            </svg>
        </div>
    );
});
