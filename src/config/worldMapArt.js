// the world map's own art: which pictures the owner has drawn, and where each one lives

/**
 * The world map draws code stand-ins until the owner's art lands: a board tile per kind of land,
 * the rope along the ring lines, and the small symbols on the painted world. Each picture has a
 * fixed file name in `public/assets/ui/world/`. Once the file is there, add its name to
 * {@link DRAWN} (one line) and the map draws it instead of the stand-in.
 *
 * ⚠️ A list rather than probing for the files: probing a missing file logs a 404 error in the
 * console on every session.
 *
 * - `world_tile_<land>.png` (land: highland, woodland, plains, wetland, riverside, hall): the
 *   whole tile, about 84 x 78 art px: the top face is a flat-topped hex 84 px across and 73 high,
 *   the tile's side shows under it (5 px). Drawn at 2x, its middle on the cell's middle.
 * - `world_rope_flat.png`, `world_rope_rise.png` (/), `world_rope_fall.png` (\): one hex edge of
 *   rope, 42 art px long, drawn at 2x with its middle on the edge's middle. `world_rope_knot.png`
 *   sits on every corner where ring edges meet.
 * - `world_symbol_<land>.png` (8 x 8 art px): the painted world's small symbol for that land.
 */

export const WORLD_ART_DIR = '/assets/ui/world';

/** The pictures the owner has drawn so far, by file name without `.png`. */
export const DRAWN = Object.freeze([
    // 'world_tile_highland',
]);

/** The kinds of land with a tile; the Hall's cell is `hall`. */
export const TILE_LANDS = Object.freeze(['highland', 'woodland', 'plains', 'wetland', 'riverside', 'hall']);

/** The rope's pieces: an edge at each of the hex's three angles, and the knot. */
export const ROPE_PIECES = Object.freeze(['flat', 'rise', 'fall', 'knot']);

/** The lands with a painted symbol. */
export const SYMBOL_LANDS = Object.freeze(['highland', 'woodland', 'plains', 'wetland', 'riverside']);

const pathIfDrawn = (name, drawn) => (drawn.includes(name) ? `${WORLD_ART_DIR}/${name}.png` : null);

/** The owner's tile for `land`, or null while the stand-in draws. */
export const tileArt = (land, drawn = DRAWN) => pathIfDrawn(`world_tile_${land}`, drawn);

/** The owner's rope piece (`ROPE_PIECES`), or null while the stand-in draws. */
export const ropeArt = (piece, drawn = DRAWN) => pathIfDrawn(`world_rope_${piece}`, drawn);

/** The owner's 8 x 8 symbol for `land`, or null while the stand-in draws. */
export const symbolArt = (land, drawn = DRAWN) => pathIfDrawn(`world_symbol_${land}`, drawn);

/** Every file name the map would read, for the art list. */
export function expectedArt() {
    return [
        ...TILE_LANDS.map(l => `world_tile_${l}.png`),
        ...ROPE_PIECES.map(p => `world_rope_${p}.png`),
        ...SYMBOL_LANDS.map(l => `world_symbol_${l}.png`)
    ];
}
