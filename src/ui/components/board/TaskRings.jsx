import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useMatSize } from '../../hooks/useMatSize.js';
import { useMatFit } from './MatFitContext.jsx';
import { boardScaleAt } from '../base/TokenSprite.jsx';
import { MAT_Z } from './matLayers.js';
import { MAT_EDGE } from './groundScreen.js';
import { onFrame, isDrawingPaused } from './frameClock.js';
import { prefersReducedMotion } from './fx/pixelSteps.js';
import {
    TASK_RING_COLOUR, TASK_DIM_LIGHT, TASK_DIM_GREY, NO_RINGS,
    createTaskRingSet, taskRingTarget, dimPath, ringPathOf
} from './taskRing.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';
import { EventBus, UI_LISTENER } from '../../../systems/core/EventBus.js';

const NO_JOBS = Object.freeze([]);
const RING_SHADOW = '#000';
/** Any grey: blended as `saturation`, only its lack of colour counts. */
const DRAIN_GREY = '#808080';

const svgStyle = (z, blend) => (blend ? { zIndex: z, mixBlendMode: blend } : { zIndex: z });

/**
 * The task rings: a work-green ring round every job in progress (`taskRing.taskJobsOf`), the
 * ground inside dimmed and drained toward grey, on the ground under every Token and hero.
 * * **One dim for all the rings**, cut to their union (`dimRuns`), so where rings overlap the
 * ground is dimmed once: a grey drawn as `mix-blend-mode: saturation` drains
 * {@link TASK_DIM_GREY} of the colour, then black takes the light down to {@link TASK_DIM_LIGHT}.
 * Both blend with whatever is below them (the ground and its ambient life), nothing above.
 * * **Drawn only when a job starts or ends** (or a hero joins one, its Token moves, the mat's fit
 * changes): at rest there is no clock, no frame and no render. A ring grows when its job starts
 * and shrinks when it ends, on the frame clock only while some ring is moving, the dim following
 * it. While drawing is paused, under reduced motion, on mounting and after a `GAME_RESET` (a load,
 * a catch-up, travel) every ring jumps to its end, so a stall or a catch-up replays nothing.
 * Clipped to the mat's rounded edge, like the reach ring; never in the pointer's way.
 * ⚠️ Every layer here is a direct stacking sibling of the ground (the wrapper has no z-index):
 * a stacking context between them would cut the blend off from the ground.
 * @param {{jobs?: {id: string, x: number, y: number, r: number}[]}} props the jobs in mat units,
 *   the same array while they are the same
 */
export const TaskRings = memo(function TaskRings({ jobs = NO_JOBS }) {
    const mat = useMatSize();
    const artScale = boardScaleAt(useMatFit());
    const [set] = useState(createTaskRingSet);
    const [rings, setRings] = useState(NO_RINGS);

    // A reset arrives with the new jobs in the same render: they jump instead of growing.
    const [resets, setResets] = useState(0);
    useEffect(() => EventBus.subscribe(ENGINE_EVENTS.GAME_RESET, () => setResets(n => n + 1), UI_LISTENER), []);
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

    const dim = useMemo(() => dimPath(rings), [rings]);
    if (!rings.length) return null;
    const scale = `scale(${artScale})`;
    return (
        <div
            data-task-rings
            aria-hidden="true"
            className="absolute left-0 top-0 pointer-events-none overflow-hidden"
            style={{ width: mat.w, height: mat.h, borderRadius: MAT_EDGE.radius }}
        >
            <svg data-task-dim="grey" className="absolute left-0 top-0 overflow-visible" width={mat.w} height={mat.h} style={svgStyle(MAT_Z.TASK_DIM, 'saturation')}>
                <path d={dim} transform={scale} fill={DRAIN_GREY} fillOpacity={TASK_DIM_GREY} shapeRendering="crispEdges" />
            </svg>
            <svg data-task-dim="dark" className="absolute left-0 top-0 overflow-visible" width={mat.w} height={mat.h} style={svgStyle(MAT_Z.TASK_DIM)}>
                <path d={dim} transform={scale} fill="#000" fillOpacity={1 - TASK_DIM_LIGHT} shapeRendering="crispEdges" />
            </svg>
            <svg data-task-ring-layer className="absolute left-0 top-0 overflow-visible" width={mat.w} height={mat.h} style={svgStyle(MAT_Z.TASK_RING)}>
                <g shapeRendering="crispEdges">
                    {/* Every shadow first, so no ring's shadow falls over another ring. */}
                    {rings.map(r => (
                        <path
                            key={`s${r.id}`}
                            d={ringPathOf(r.px)}
                            transform={`translate(${(r.cx + 1) * artScale} ${(r.cy + 1) * artScale}) ${scale}`}
                            fill={RING_SHADOW}
                        />
                    ))}
                    {rings.map(r => (
                        <path
                            key={r.id}
                            data-task-ring={r.id}
                            data-px={r.px}
                            d={ringPathOf(r.px)}
                            transform={`translate(${r.cx * artScale} ${r.cy * artScale}) ${scale}`}
                            fill={TASK_RING_COLOUR}
                        />
                    ))}
                </g>
            </svg>
        </div>
    );
});
