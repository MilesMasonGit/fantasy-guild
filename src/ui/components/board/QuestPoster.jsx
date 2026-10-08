import { PixelArt } from '../base/TokenSprite.jsx';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { resolveSpritePath } from '../../../utils/AssetManager.js';
import { lootSpriteMatPx } from '../../utils/lootFlight.js';

/**
 * Where the quest billboard's blank poster is centred in its 64 px art: the poster spans x 14-49
 * and y 19-42, so (32, 31).
 */
export const POSTER_CENTRE = Object.freeze({ x: 32, y: 31 });
const ART = 64;

/**
 * Where the target item's sprite sits inside the quest Token's box, in mat units: centred on the
 * poster. The item is drawn at the size an item lies on the floor (`lootSpriteMatPx`: 32 px art,
 * the same pixel density as the 64 px billboard), so it is a whole multiple of its own pixels
 * on screen like everything else on the mat.
 * @param {number} boxPx  the Token's box
 * @param {number} artPx  the billboard's art, drawn
 * @param {number} fit    the mat's live fit
 */
export function posterItemLayout(boxPx, artPx, fit = 1) {
    const size = lootSpriteMatPx(fit);
    const k = artPx / ART;
    const inset = (boxPx - artPx) / 2;
    return {
        size,
        left: inset + POSTER_CENTRE.x * k - size / 2,
        top: inset + POSTER_CENTRE.y * k - size / 2
    };
}

/** The item a quest wants, drawn on its billboard's poster. Nothing for a quest without one. */
export function QuestPosterItem({ itemId, boxPx, artPx, fit }) {
    if (!itemId) return null;
    const item = getItem(itemId);
    const src = item ? resolveSpritePath(item) : null;
    if (!src) return null;
    const { size, left, top } = posterItemLayout(boxPx, artPx, fit);
    return (
        <PixelArt
            src={src}
            alt={item.name || itemId}
            size={size}
            className="absolute"
            style={{ left, top }}
        />
    );
}
