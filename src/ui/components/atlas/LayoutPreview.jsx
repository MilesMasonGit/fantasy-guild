import { HALL_CLEARING } from '../../../systems/atlas/Layout.js';
import { ROLE } from '../../../systems/atlas/Budget.js';
import { tokenName } from '../../../config/registries/tokenRegistry.js';

/** One colour per budget role, shared with the Node Summary's dots. */
export const ROLE_COLOUR = Object.freeze({
    [ROLE.NODE]: '#6ee7b7',
    [ROLE.CAMP]: '#f87171',
    [ROLE.TREASURE]: '#fbbf24'
});

/** The ground, drawn faint under the dots. */
const GROUND_COLOUR = Object.freeze({ grass: '#3f7a3a', rock: '#7a756c', sand: '#b8a165', water: '#2f6496' });
const GROUND_OPACITY = 0.45;

/** Dots are drawn this size in mat units, whatever a Token's art: the preview reads where, not how big. */
const DOT_RADIUS = 28;

/**
 * Each terrain row as runs of one ground, so a 50 × 30 grid is a few dozen rectangles rather than
 * 1,500.
 */
export function terrainRuns(terrain) {
    if (!terrain?.cells || !terrain.cols || !terrain.rows) return [];
    const runs = [];
    for (let r = 0; r < terrain.rows; r++) {
        let start = 0;
        for (let c = 1; c <= terrain.cols; c++) {
            const here = terrain.cells[r * terrain.cols + start];
            if (c < terrain.cols && terrain.cells[r * terrain.cols + c] === here) continue;
            runs.push({ row: r, col: start, length: c - start, ground: terrain.legend?.[parseInt(here, 36)] });
            start = c;
        }
    }
    return runs;
}

/**
 * A small drawing of a generated layout (`plan.layout`): the mat's shape, its ground faint
 * underneath, the Hall's clearing in the middle, and each Token a dot coloured by its role.
 */
export const LayoutPreview = ({ layout, className = '' }) => {
    if (!layout?.mat) {
        return <div data-layout-preview="empty" className={`aspect-[16/10] w-full bg-white/5 ${className}`} />;
    }
    const { mat, hall, nodes = [], terrain } = layout;
    const cell = terrain?.cell || 32;
    return (
        <svg
            data-layout-preview
            viewBox={`0 0 ${mat.w} ${mat.h}`}
            preserveAspectRatio="xMidYMid meet"
            className={`w-full h-auto block bg-[#1a1612] ${className}`}
            role="img"
            aria-label="Layout preview"
        >
            <g opacity={GROUND_OPACITY} shapeRendering="crispEdges">
                {terrainRuns(terrain).map(run => (
                    <rect
                        key={`${run.row}:${run.col}`}
                        x={run.col * cell}
                        y={run.row * cell}
                        width={run.length * cell}
                        height={cell}
                        fill={GROUND_COLOUR[run.ground] || GROUND_COLOUR.grass}
                    />
                ))}
            </g>
            {hall && (
                <g data-preview-hall>
                    <circle cx={hall.x} cy={hall.y} r={HALL_CLEARING} fill="#000" fillOpacity={0.25} stroke="#fff" strokeOpacity={0.35} strokeWidth={6} strokeDasharray="24 18" />
                    <rect x={hall.x - 40} y={hall.y - 40} width={80} height={80} fill="#c4b5fd" />
                </g>
            )}
            {nodes.map((n, i) => (
                <circle
                    key={i}
                    data-preview-node={n.role}
                    cx={n.x}
                    cy={n.y}
                    r={DOT_RADIUS}
                    fill={ROLE_COLOUR[n.role] || ROLE_COLOUR.node}
                    stroke="#000"
                    strokeWidth={6}
                >
                    <title>{tokenName(n.typeId) || n.typeId}</title>
                </circle>
            ))}
            <rect x={0} y={0} width={mat.w} height={mat.h} fill="none" stroke="#fff" strokeOpacity={0.25} strokeWidth={8} />
        </svg>
    );
};

export default LayoutPreview;
