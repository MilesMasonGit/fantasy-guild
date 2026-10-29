import { FlagTriangleRight } from 'lucide-react';
import { flagFill, isFlagColour } from '../../../systems/board/FlagColours.js';

/**
 * The flag's colours: filled with its hero's colour (`FLAG_FILLS`; pale bone for none), a
 * near-black edge, white round it when lit.
 */
export const MARKER_FILL = flagFill(null);
export const MARKER_EDGE = '#17110c';
export const MARKER_HOVER = '#ffffff';

/**
 * A hero's job flag: Lucide's `FlagTriangleRight`, a meta mark rather than a picture of the world
 * (`UI_STYLE.md`, Sprites and icons), filled with the hero's saved `flagColour` (`colour`, one of
 * `FLAG_COLOURS`; anything else is the pale base flag). A dark edge is drawn as a wider stroke
 * under the fill and, when lit (`outline` 'hover'), a white line under that.
 * Drawn by the board's `FlagLayer`, the drag ghost, the hero panel and the Atlas's 'you are here'
 * mark, so the flag looks the same everywhere. `size` is its box (`MARKER_ART_PX` art pixels on the
 * mat). The view is 30 units for that box (24 for the icon and 3 of margin each side), so one art
 * pixel is 2.5 units.
 */
export const FlagMark = ({ size, colour = null, outline = null, alt, className, style }) => {
    const layer = (stroke, width) => (
        <FlagTriangleRight
            size={size}
            strokeWidth={width}
            stroke={stroke}
            fill={stroke}
            strokeLinejoin="round"
            strokeLinecap="round"
            style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}
            viewBox="-3 -3 30 30"
            aria-hidden="true"
        />
    );
    const lit = outline === 'hover';
    return (
        <span
            data-flag-mark
            data-flag-colour={isFlagColour(colour) ? colour : undefined}
            data-sprite-outline={lit ? 'hover' : undefined}
            role={alt ? 'img' : undefined}
            aria-label={alt || undefined}
            aria-hidden={alt ? undefined : 'true'}
            className={className}
            style={{ position: className ? undefined : 'relative', display: 'block', width: size, height: size, flexShrink: 0, ...style }}
        >
            {lit && layer(MARKER_HOVER, 2 + 4 * 2.5)}
            {layer(MARKER_EDGE, 2 + 2 * 2.5)}
            {layer(flagFill(colour), 2)}
        </span>
    );
};

export default FlagMark;
