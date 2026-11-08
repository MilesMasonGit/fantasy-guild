import { useEffect, useState } from 'react';
import {
    burstFrames, burstMs, runSteps, constellationPictureSrc, constellationStars,
    CEREMONY_PX, BURST_FRAME_MS, RUN_LIGHT_ART_PX, STAGGER_MS, STILL_MS, GLOW_MS
} from './hallCeremony.js';
import { prefersReducedMotion } from './fx/pixelSteps.js';

const BURST_SIZE = { star: 34, opened: 24, constellation: 48 };

/**
 * One burst at a point: every frame is drawn once, hidden, and shown in turn by its own stepped
 * CSS animation (`.gi-burst-f`), so the burst runs without React. Under reduced motion only the
 * still frame shows, held (`.gi-burst-still`).
 */
const Burst = ({ x, y, kind, delay = 0 }) => {
    const frames = burstFrames(kind);
    const half = BURST_SIZE[kind] * CEREMONY_PX;
    const still = Math.min(1, frames.length - 1);
    return (
        <svg
            data-ceremony-burst={kind}
            className="absolute pointer-events-none overflow-visible"
            style={{ left: x - half, top: y - half }}
            width={half * 2}
            height={half * 2}
            shapeRendering="crispEdges"
        >
            {frames.map((f, i) => (
                <g
                    key={i}
                    className={i === still ? 'gi-burst-f gi-burst-still' : 'gi-burst-f'}
                    fill={f.colour}
                    style={{ animationDelay: `${delay + i * BURST_FRAME_MS}ms`, '--gi-burst-frame': `${BURST_FRAME_MS}ms` }}
                >
                    {f.px.map(([px, py]) => (
                        <rect key={`${px},${py}`} x={half + px * CEREMONY_PX - CEREMONY_PX / 2} y={half + py * CEREMONY_PX - CEREMONY_PX / 2} width={CEREMONY_PX} height={CEREMONY_PX} />
                    ))}
                </g>
            ))}
        </svg>
    );
};

/**
 * The light running from the bought star to one it opened: a short bright dash that hops along
 * the line in whole steps (`.gi-run-light`), from the bought star's edge to the far star's.
 * Under reduced motion the whole line shows lit, held, instead.
 */
const RunLight = ({ a, b, fromR, toR }) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const p = { x: Math.round(a.x + ux * fromR), y: Math.round(a.y + uy * fromR) };
    const q = { x: Math.round(b.x - ux * toR), y: Math.round(b.y - uy * toR) };
    const span = Math.max(1, Math.round(Math.hypot(q.x - p.x, q.y - p.y)));
    const dash = RUN_LIGHT_ART_PX * CEREMONY_PX;
    const { hops, ms } = runSteps(span);
    const box = { x: Math.min(p.x, q.x) - 4, y: Math.min(p.y, q.y) - 4, w: Math.abs(q.x - p.x) + 8, h: Math.abs(q.y - p.y) + 8 };
    return (
        <svg
            data-ceremony-run
            className="absolute pointer-events-none overflow-visible"
            style={{ left: box.x, top: box.y }}
            width={box.w}
            height={box.h}
            shapeRendering="crispEdges"
        >
            <line
                className="gi-run-light"
                x1={p.x - box.x} y1={p.y - box.y} x2={q.x - box.x} y2={q.y - box.y}
                stroke="#fffbe8"
                strokeWidth={CEREMONY_PX * 2}
                strokeDasharray={`${dash} ${span + dash}`}
                style={{
                    '--gi-run-from': `${dash}px`,
                    '--gi-run-to': `${-span}px`,
                    animationDuration: `${ms}ms`,
                    animationTimingFunction: `steps(${hops}, end)`
                }}
            />
            <line
                className="gi-run-still"
                x1={p.x - box.x} y1={p.y - box.y} x2={q.x - box.x} y2={q.y - box.y}
                stroke="#fff1c4"
                strokeWidth={CEREMONY_PX}
            />
        </svg>
    );
};

/** How long a ceremony plays, in ms, so it can be taken down after. */
export function ceremonyMs(ceremony, runMs = 0) {
    if (!ceremony) return 0;
    const kind = ceremony.finished.length ? 'constellation' : 'star';
    let end = burstMs(kind);
    if (ceremony.opened.length) end = Math.max(end, runMs + burstMs('opened'));
    for (const cid of ceremony.finished) {
        end = Math.max(end, GLOW_MS, constellationStars(cid).length * STAGGER_MS + burstMs('opened'));
    }
    return end;
}

/**
 * HallCeremony: a Guild Hall purchase played over the sky, once. The star bursts in hard pixels,
 * light runs along its lines to the stars it just opened, which pop as it arrives; finishing a
 * constellation bursts bigger and sparkles every star of it in turn (its lines flash in the
 * board's own line layer, `.gi-constellation-glow`).
 * Everything is drawn on mount and stepped by CSS, so nothing re-renders while it plays; the
 * board takes it down after {@link ceremonyMs} (`onDone`).
 * @param {object} props
 * @param {{id: string, opened: string[], finished: string[], seq: number}} props.ceremony from `ceremonyFor`
 * @param {(id: string) => {x: number, y: number}} props.at a node's centre on the board
 * @param {(id: string, bought: boolean) => number} props.radius a star's drawn half-size, where its light starts and ends
 * @param {() => void} props.onDone called once it has played
 */
export const HallCeremony = ({ ceremony, at, radius, onDone }) => {
    const still = prefersReducedMotion();
    const star = at(ceremony.id);
    const kind = ceremony.finished.length ? 'constellation' : 'star';
    const runs = ceremony.opened.map(id => {
        const b = at(id);
        const span = Math.max(1, Math.hypot(b.x - star.x, b.y - star.y) - radius(ceremony.id, true) - radius(id, false));
        return { id, b, ms: runSteps(span).ms };
    });
    const runMs = runs.reduce((m, r) => Math.max(m, r.ms), 0);
    const total = still ? Math.max(STILL_MS, GLOW_MS) : ceremonyMs(ceremony, runMs);

    useEffect(() => {
        const t = setTimeout(() => onDone?.(), total);
        return () => clearTimeout(t);
        // One ceremony, one timer: `seq` names it.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ceremony.seq]);

    const sparkles = ceremony.finished.flatMap(cid => constellationStars(cid)
        .filter(id => id !== ceremony.id)
        .map((id, i) => ({ id, delay: still ? 0 : (i + 1) * STAGGER_MS })));

    return (
        <div
            data-hall-ceremony={ceremony.id}
            data-ceremony-opened={ceremony.opened.join(',')}
            data-ceremony-finished={ceremony.finished.join(',')}
            className={still ? 'absolute inset-0 pointer-events-none gi-ceremony-still' : 'absolute inset-0 pointer-events-none'}
            style={{ '--gi-still-ms': `${STILL_MS}ms` }}
        >
            <Burst x={star.x} y={star.y} kind={kind} />
            {runs.map(r => (
                <RunLight key={`run-${r.id}`} a={star} b={r.b} fromR={radius(ceremony.id, true)} toR={radius(r.id, false)} />
            ))}
            {runs.map(r => {
                const p = r.b;
                return <Burst key={`pop-${r.id}`} x={p.x} y={p.y} kind="opened" delay={still ? 0 : r.ms} />;
            })}
            {sparkles.map(s => {
                const p = at(s.id);
                return <Burst key={`spark-${s.id}`} x={p.x} y={p.y} kind="opened" delay={s.delay} />;
            })}
        </div>
    );
};

/**
 * The owner's picture of a finished constellation, in the slot it will fill: drawn at 2× its own
 * size, centred on the constellation's stars, under the lines. It arrives in two hard steps when
 * the constellation is finished while the sky is open (`flash`) and stays. Until the art exists
 * (`constellationPictureSrc`) nothing is drawn.
 */
export const ConstellationPicture = ({ cid, centre, flash }) => {
    const [size, setSize] = useState(null);
    const [missing, setMissing] = useState(false);
    if (missing) return null;
    return (
        <img
            data-constellation-picture={cid}
            src={constellationPictureSrc(cid)}
            alt=""
            aria-hidden="true"
            onLoad={(e) => setSize({ w: e.currentTarget.naturalWidth * 2, h: e.currentTarget.naturalHeight * 2 })}
            onError={() => setMissing(true)}
            className={flash ? 'absolute pointer-events-none gi-constellation-picture-in' : 'absolute pointer-events-none'}
            style={size
                ? { left: Math.round(centre.x - size.w / 2), top: Math.round(centre.y - size.h / 2), width: size.w, height: size.h, imageRendering: 'pixelated' }
                : { visibility: 'hidden', left: 0, top: 0 }}
        />
    );
};
