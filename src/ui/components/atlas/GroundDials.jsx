import { t } from '../../../i18n/index.js';
import { Tooltip } from '../base/Tooltip.jsx';
import { PAINT } from './worldPicture.js';

/** A dial's ring in art pixels: its outer and inner radius. Drawn at {@link DIAL_SCALE}. */
export const DIAL_R = 11;
const DIAL_HOLE = 7;
/** UI art draws at 2×. */
export const DIAL_SCALE = 2;
const DIAL_TRACK = 'rgba(0, 0, 0, 0.55)';

/** The three grounds in the order their dials stand, each in the world map's own paint for that land. */
export const GROUND_DIALS = Object.freeze([
    Object.freeze({ id: 'water', colour: PAINT.riverside.tones[0] }),
    Object.freeze({ id: 'grass', colour: PAINT.woodland.tones[0] }),
    Object.freeze({ id: 'stone', colour: PAINT.highland.tones[0] })
]);

/** Row runs of art pixels as one SVG path, a pixel `[x, y]` covering `x..x+1, y..y+1`. */
function runsPath(rows) {
    let d = '';
    rows.forEach((xs, y) => {
        let i = 0;
        while (i < xs.length) {
            let j = i;
            while (j + 1 < xs.length && xs[j + 1] === xs[j] + 1) j++;
            d += `M${xs[i]} ${y}h${j - i + 1}v1h${-(j - i + 1)}z`;
            i = j + 1;
        }
    });
    return d;
}

/**
 * A dial at `percent` as whole art pixels: `lit`, the ring's share from twelve o'clock clockwise, and
 * `track`, the rest, each one SVG path in art-pixel units over a box `2 × DIAL_R` square. A pixel is
 * on the ring when its middle lies between the two radii, and lit when its middle's angle does.
 */
export function dialPaths(percent) {
    const share = Math.min(1, Math.max(0, (Number(percent) || 0) / 100));
    const size = 2 * DIAL_R;
    const lit = Array.from({ length: size }, () => []);
    const track = Array.from({ length: size }, () => []);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const dx = x + 0.5 - DIAL_R;
            const dy = y + 0.5 - DIAL_R;
            const d2 = dx * dx + dy * dy;
            if (d2 < DIAL_HOLE * DIAL_HOLE || d2 > DIAL_R * DIAL_R) continue;
            let angle = Math.atan2(dx, -dy);
            if (angle < 0) angle += 2 * Math.PI;
            (angle < share * 2 * Math.PI ? lit : track)[y].push(x);
        }
    }
    return { lit: runsPath(lit), track: runsPath(track) };
}

/** One dial: the ring, the share in words under it, and the ground's name; its hover says what it counts. */
const GroundDial = ({ id, colour, percent }) => {
    const { lit, track } = dialPaths(percent);
    const size = 2 * DIAL_R;
    return (
        <Tooltip title={t(`worldMap.ground.${id}`)} lines={[t(`worldMap.ground.${id}Tip`)]} maxWidth={240}>
            <div data-world-dial={id} data-world-dial-percent={percent} className="flex flex-col items-center gap-0.5 cursor-help">
                <svg
                    width={size * DIAL_SCALE}
                    height={size * DIAL_SCALE}
                    viewBox={`0 0 ${size} ${size}`}
                    shapeRendering="crispEdges"
                    aria-hidden="true"
                    className="block"
                >
                    <path d={track} fill={DIAL_TRACK} />
                    <path d={lit} fill={colour} />
                </svg>
                <span className="font-pixel ui-text-body font-bold tabular-nums text-white">{percent}%</span>
                <span className="font-pixel ui-text-small text-white/60">{t(`worldMap.ground.${id}`)}</span>
            </div>
        </Tooltip>
    );
};

/**
 * The world map drawer's three ground dials, Water, Grass and Stone: how much of a place's mat each
 * covers, in whole percent that add up to 100 (`World.placeGround`).
 *
 * @param {{ shares: {water: number, grass: number, stone: number} }} props
 */
export const GroundDials = ({ shares }) => (
    <div data-world-ground className="grid grid-cols-3 gap-1">
        {GROUND_DIALS.map(({ id, colour }) => <GroundDial key={id} id={id} colour={colour} percent={shares?.[id] ?? 0} />)}
    </div>
);

export default GroundDials;
