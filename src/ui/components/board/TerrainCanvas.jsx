/**
 * The playmat's ground, drawn under everything else.
 *
 * ⚠️ Draws nothing yet. The ground plan exists (`TerrainSurface.buildGroundPlan` over the active
 * Region's `regionGround`); the screen pass that puts it on the mat does not. Never mounted while
 * `TERRAIN_ENABLED` is false.
 */
export const TerrainCanvas = () => null;

export default TerrainCanvas;
