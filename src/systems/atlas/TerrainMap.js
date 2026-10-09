// the ground of a generated Region: a grid of terrain cells

/**
 * The ground is a grid of square cells, each one terrain; Tokens stand freely on top, and the cell
 * under a Token's centre is its terrain. Generation (`Layout.js`) makes the grid together with the
 * layout so the nodes and the ground agree; brief 80 paints it, and a later slice checks a Token's
 * terrain needs against it.
 *
 * Pure and seeded like the layout: arithmetic IEEE fixes exactly, no trigonometry, no `**`.
 */

/** The terrains the first three Base Maps write. Content may name others; nothing here forbids it. */
export const TERRAIN = Object.freeze({ GRASS: 'grass', ROCK: 'rock', SAND: 'sand', WATER: 'water' });

/** The ground where nothing says otherwise. */
export const DEFAULT_TERRAIN = TERRAIN.GRASS;

/** A cell's side in mat units: one ground art piece (8 chunky or 16 fine pixels). */
export const TERRAIN_CELL = 32;

/** The most of a mat water may cover, so a Coast always leaves land to build on. */
export const MAX_WATER_SHARE = 0.45;

/** How far a node's ground reaches into cells around it, in mat units; beyond, the Region's main ground. */
export const FOLLOW_REACH = 256;

/** Coastline shape: a depth knot every few cells, each up to this share deeper or shallower. */
const KNOT_CELLS = 6;
const WIGGLE = 0.35;

/** The grid over a mat: whole cells, the last row and column running past the edge. */
export function terrainGrid(mat) {
    return { cols: Math.ceil(mat.w / TERRAIN_CELL), rows: Math.ceil(mat.h / TERRAIN_CELL) };
}

/** The cell holding a mat point, clamped onto the grid. */
export function cellIndex(grid, x, y, cell = TERRAIN_CELL) {
    const c = Math.min(grid.cols - 1, Math.max(0, Math.floor(x / cell)));
    const r = Math.min(grid.rows - 1, Math.max(0, Math.floor(y / cell)));
    return r * grid.cols + c;
}

/** A cell's centre in mat units. */
export function cellCentre(grid, index) {
    const c = index % grid.cols;
    const r = (index - c) / grid.cols;
    return { x: (c + 0.5) * TERRAIN_CELL, y: (r + 0.5) * TERRAIN_CELL };
}

const smooth = (f) => f * f * (3 - 2 * f);

/**
 * Water along one edge of the mat, the edge picked by the seed: `share` of the cells, with a
 * coastline that wanders by smoothed seeded knots. A cell `keepDry(index)` says to keep is never
 * water (the Hall's clearing).
 *
 * @returns {Uint8Array} 1 for water, per cell, row by row
 */
export function carveWater(grid, share, random, keepDry = () => false) {
    const { cols, rows } = grid;
    const water = new Uint8Array(cols * rows);
    const s = Math.min(MAX_WATER_SHARE, Math.max(0, Number(share) || 0));
    if (!(s > 0)) return water;

    // 0 top, 1 right, 2 bottom, 3 left.
    const side = Math.floor(random() * 4);
    const along = side % 2 === 0 ? cols : rows;
    const across = side % 2 === 0 ? rows : cols;
    const mean = s * cols * rows / along;
    const knots = Array.from({ length: Math.ceil(along / KNOT_CELLS) + 2 }, () => random() * 2 - 1);

    for (let i = 0; i < along; i++) {
        const t = i / KNOT_CELLS;
        const j = Math.floor(t);
        const f = smooth(t - j);
        const wiggle = knots[j] * (1 - f) + knots[j + 1] * f;
        const depth = Math.max(0, Math.min(across, Math.round(mean * (1 + WIGGLE * wiggle))));
        for (let d = 0; d < depth; d++) {
            let c;
            let r;
            if (side === 0) { c = i; r = d; } else if (side === 1) { c = cols - 1 - d; r = i; } else if (side === 2) { c = i; r = rows - 1 - d; } else { c = d; r = i; }
            const index = r * cols + c;
            if (!keepDry(index)) water[index] = 1;
        }
    }
    return water;
}

/**
 * Each cell's distance to the nearest water cell in cells, a diagonal step counting as one, or -1
 * everywhere when there is no water.
 */
export function shoreDistance(grid, water) {
    const { cols, rows } = grid;
    const dist = new Int32Array(cols * rows).fill(-1);
    const queue = [];
    for (let i = 0; i < water.length; i++) {
        if (water[i]) {
            dist[i] = 0;
            queue.push(i);
        }
    }
    for (let head = 0; head < queue.length; head++) {
        const i = queue[head];
        const c = i % cols;
        const r = (i - c) / cols;
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                const nc = c + dc;
                const nr = r + dr;
                if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
                const n = nr * cols + nc;
                if (dist[n] === -1) {
                    dist[n] = dist[i] + 1;
                    queue.push(n);
                }
            }
        }
    }
    return dist;
}

/**
 * The ground a cell gets from the nodes round it: the nearest node within {@link FOLLOW_REACH} of
 * the cell's centre gives its terrain (the earliest placed wins a tie), else `fallback`.
 *
 * @param {{x: number, y: number, terrain: string, biome: string|null}[]} nodes  in placement order
 * @returns {{terrain: string, biome: string|null}}
 */
export function followNodes(centre, nodes, fallback) {
    let best = null;
    let bestD = FOLLOW_REACH * FOLLOW_REACH;
    for (const n of nodes) {
        const dx = centre.x - n.x;
        const dy = centre.y - n.y;
        const d = dx * dx + dy * dy;
        if (d < bestD || (d === bestD && !best)) {
            best = n;
            bestD = d;
        }
    }
    return best ? { terrain: best.terrain, biome: best.biome } : fallback;
}

/**
 * The stored form: one character per cell, row by row, each a base-36 index into `legend`. About
 * 2 KB for the shipped mat.
 *
 * @param {string[]} terrains  one terrain id per cell
 * @returns {{cell: number, cols: number, rows: number, legend: string[], cells: string}}
 */
export function encodeTerrain(grid, terrains) {
    const known = Object.values(TERRAIN);
    const extra = [...new Set(terrains)].filter(t => !known.includes(t)).sort();
    const legend = [...known, ...extra];
    const index = new Map(legend.map((t, i) => [t, i.toString(36)]));
    return { cell: TERRAIN_CELL, cols: grid.cols, rows: grid.rows, legend, cells: terrains.map(t => index.get(t)).join('') };
}

/** The terrain under a mat point on a stored terrain map. */
export function terrainAt(map, x, y) {
    const i = cellIndex({ cols: map.cols, rows: map.rows }, x, y, map.cell);
    return map.legend[parseInt(map.cells[i], 36)];
}
