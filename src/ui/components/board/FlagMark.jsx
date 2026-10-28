import { PixelArt } from '../base/TokenSprite.jsx';
import { FLAG_PX } from './flagGeometry.js';

/** The one flag sprite every hero carries. */
export const PENNANT_SRC = '/assets/ui/u_flag_pennant.png';

/**
 * A hero's flag: the pennant, the same for every hero. 64 px by default (2× the 32 px art,
 * pixelated). Drawn by the board's `FlagLayer`, the drag ghost, the hero panel and the Atlas's
 * 'you are here' mark, so a flag looks the same everywhere. The hero's saved `flagColour` is not
 * drawn.
 */
export const FlagMark = ({ size = FLAG_PX, lifted = false, outline, alt = 'Flag', className, style }) => (
    <PixelArt
        src={PENNANT_SRC}
        alt={alt}
        size={size}
        lifted={lifted}
        outline={outline}
        className={className}
        style={style}
    />
);

export default FlagMark;
