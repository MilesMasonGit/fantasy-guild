import { PixelArt } from '../base/TokenSprite.jsx';
import { flagSpritePath } from '../../../systems/board/FlagColours.js';
import { FLAG_PX } from './flagGeometry.js';

/**
 * A hero's flag, drawn with the owner's sprites (Free Playmat slice 1.5b-ii,
 * FP-77, FP-82): `hero_flag_<colour>.png`, or the plain base flag for a hero
 * with no colour. 128 px by default (2× the 64 px art, pixelated).
 *
 * Drawn by the board's `FlagLayer`, the drag ghost, the rules panel and the
 * Edit Hero colour swatches, so a flag looks the same everywhere.
 */
export const FlagMark = ({ colour = null, size = FLAG_PX, lifted = false, alt = 'Flag', className, style }) => (
    <PixelArt
        src={flagSpritePath(colour)}
        alt={alt}
        size={size}
        lifted={lifted}
        className={className}
        style={style}
    />
);

export default FlagMark;
