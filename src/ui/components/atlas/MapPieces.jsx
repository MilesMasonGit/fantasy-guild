import { mapSpritePath, MAP_OUTLINE_POINTS } from './mapArt.js';

/** A map sprite and a Cartography slot, in screen px: the 64 px art at 1×, as the Bank draws items. */
export const MAP_PX = 64;
export const SLOT_PX = 68;

/** A map's own picture at 1× (or `size`). */
export const MapSprite = ({ recipe, size = MAP_PX }) => (
    <img
        src={mapSpritePath(recipe)}
        alt=""
        draggable={false}
        className="pointer-events-none select-none"
        style={{ width: size, height: size, maxWidth: 'none', imageRendering: 'pixelated' }}
    />
);

/** An empty slot's mark: a faint dashed outline of a map. */
export const MapOutline = () => (
    <svg width={MAP_PX} height={MAP_PX} viewBox={`0 0 ${MAP_PX} ${MAP_PX}`} shapeRendering="crispEdges" aria-hidden="true" data-slot-outline>
        <polygon points={MAP_OUTLINE_POINTS} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={1} strokeDasharray="3 2" />
    </svg>
);
