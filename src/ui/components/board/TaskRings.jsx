import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useMatSize } from '../../hooks/useMatSize.js';
import { useMatFit } from './MatFitContext.jsx';
import { boardScaleAt } from '../base/TokenSprite.jsx';
import { MAT_Z } from './matLayers.js';
import { MAT_EDGE } from './groundScreen.js';
import { onFrame, isDrawingPaused } from './frameClock.js';
import { prefersReducedMotion } from './fx/pixelSteps.js';
import {
    TASK_AREA_LAYERS, NO_RINGS, createTaskRingSet, taskRingTarget, dimRuns, fadeBands, fadeStrength, runsPath
} from './taskRing.js';

const NO_JOBS = Object.freeze([]);

const svgStyle = (z, blend) => (blend ? { zIndex: z, mixBlendMode: blend } : { zIndex: z });

/**
 * The paths the areas draw, in art pixels from the mat's corner: the merged shape's fade bands,
 * outermost first, then its core. Worked out again only when the areas change: once per frame
 * while one grows or shrinks, never at rest.
 */
function shapesOf(rings) {
    const { bands, core } = fadeBands(dimRuns(rings));
    return [...bands.map(runsPath), runsPath(core)];
}

/**
 * The job areas: the ground round every job in progress (`taskRing.taskJobsOf`) toned like old
 * parchment ({@link TASK_AREA_LAYERS}), the ground and every Token at rest inside it, never the
 * worked Tokens or a hero. No line, working or stuck: a stuck job is told by its "!" and its bubble.
 * * **One shape for all the areas** (`dimRuns`), so where areas overlap everything is toned once,
 * and only the merged shape's outer edge fades, in `TASK_FADE_STEPS` whole-art-pixel steps
 * (`fadeBands`), each weaker toward the outside. Each layer of the tone is one SVG, its blend
 * reaching everything below it; a band is that layer at its own strength. A Token half inside an
 * area is toned on that half only.
 * * **Every layer at `z`** (`matLayers.taskRingZ`): over the ground and the Tokens at rest, under
 * the worked Tokens and the heroes, as the action the area frames.
 * * **Drawn only when a job starts or ends** (a hero joins one, its Token moves, the mat's fit
 * changes): at rest there is no clock, no frame and no render. An area grows when its job starts
 * and shrinks when it ends, on the frame clock only while some area is moving. While drawing is
 * paused, under reduced motion, on mounting and after a reset (a load, a catch-up, travel:
 * `resets` counts them) every area jumps to its end, so a stall or a catch-up replays nothing.
 * Clipped to the mat's rounded edge, like the reach ring; never in the pointer's way.
 * ⚠️ Every layer here is a direct stacking sibling of the ground and the Tokens (the wrapper has
 * no z-index): a stacking context between them would cut the blend off from what it tones.
 * @param {{jobs?: {id: string, x: number, y: number, r: number}[], z?: number, resets?: number}} props
 *   the jobs in mat units, the same array while they are the same; the areas' z; how many resets
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
    const last = shapes.length - 1;
    return (
        <div
            data-task-rings
            data-task-jobs={rings.map(r => `${r.id}@${r.px}`).join(' ')}
            aria-hidden="true"
            className="absolute left-0 top-0 pointer-events-none overflow-hidden"
            style={{ width: mat.w, height: mat.h, borderRadius: MAT_EDGE.radius }}
        >
            {/* ⚠️ One z for every layer: their order here is their order on screen. */}
            {TASK_AREA_LAYERS.map((layer, i) => (
                <svg
                    key={i}
                    data-task-area-layer={layer.blend ?? 'shade'}
                    className="absolute left-0 top-0 overflow-visible"
                    width={mat.w}
                    height={mat.h}
                    style={svgStyle(z, layer.blend)}
                >
                    <g transform={scale} shapeRendering="crispEdges" fill={layer.fill}>
                        {shapes.map((d, k) => (d ? (
                            <path key={k} data-task-band={k === last ? 'core' : k} d={d} fillOpacity={layer.opacity * (k === last ? 1 : fadeStrength(k))} />
                        ) : null))}
                    </g>
                </svg>
            ))}
        </div>
    );
});
