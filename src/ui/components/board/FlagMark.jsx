import { FlagTriangleRight } from 'lucide-react';
import { PixelArt } from '../base/TokenSprite.jsx';
import { OutlinedGlyph } from '../base/PixelGlyph.jsx';
import { FLAG_PX } from './flagGeometry.js';

/** The one flag sprite every hero carries. */
export const PENNANT_SRC = '/assets/ui/u_flag_pennant.png';

/** The small job marker's colours: a pale bone flag with a near-black edge, white on hover. */
export const MARKER_FILL = '#e9dfc4';
export const MARKER_EDGE = '#17110c';
export const MARKER_HOVER = '#ffffff';

/**
 * The Lucide icon of the small marker. The plain triangle survives 20 px: the wavy `Flag`'s
 * folds close up into a blob once it has a dark edge (both are on the style sheet).
 */
export const MARKER_ICON = FlagTriangleRight;

/**
 * A Lucide flag as a marker: the icon filled pale, a dark edge drawn as a wider stroke under it
 * and, when lit, a white line under that. The view is 30 units for the 12-art-pixel box (24 for
 * the icon and 3 of margin each side), so one art pixel is 2.5 units.
 */
export const LucideMarker = ({ size, lit = false, Icon = MARKER_ICON, className, style }) => {
    const layer = (stroke, width) => (
        <Icon
            size={size}
            absoluteStrokeWidth={false}
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
    return (
        <span data-marker-look="lucide" data-sprite-outline={lit ? 'hover' : undefined} className={className} style={{ position: className ? undefined : 'relative', display: 'block', width: size, height: size, ...style }}>
            {lit && layer(MARKER_HOVER, 2 + 4 * 2.5)}
            {layer(MARKER_EDGE, 2 + 2 * 2.5)}
            {layer(MARKER_FILL, 2)}
        </span>
    );
};

/**
 * A hero's flag. By default the pennant, the same for every hero: 64 px (2× the 32 px art,
 * pixelated). Drawn by the board's `FlagLayer`, the drag ghost, the hero panel and the Atlas's
 * 'you are here' mark; the hero's saved `flagColour` is not drawn. On the mat it may instead be
 * one of the small job markers (`look` 'lucide' or 'pixel', the Mat Tuner's Job marker row),
 * `size` then being its 12-art-pixel box.
 */
export const FlagMark = ({ size = FLAG_PX, lifted = false, outline, alt = 'Flag', look = 'pennant', className, style }) => {
    if (look === 'lucide') {
        return <LucideMarker size={size} lit={outline === 'hover'} className={className} style={style} />;
    }
    if (look === 'pixel') {
        return (
            <OutlinedGlyph
                name="flag"
                px={size}
                fill={MARKER_FILL}
                edge={MARKER_EDGE}
                halo={outline === 'hover' ? MARKER_HOVER : null}
                data-marker-look="pixel"
                data-sprite-outline={outline === 'hover' ? 'hover' : undefined}
                className={className}
                style={style}
            />
        );
    }
    return (
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
};

export default FlagMark;
