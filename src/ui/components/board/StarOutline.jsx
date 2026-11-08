import { useEffect, useRef } from 'react';
import { drawOutline, outlineColour, OUTLINE_ART_PX, OUTLINE_PX } from './hallStarOutline.js';

/**
 * A Guild Hall star's item outline, over the star: the item's silhouette edge in the star's colour,
 * with a dark edge, at the sky's 2× art pixel. Drawn once on its canvas when the sky opens, and
 * again only when the star's look or state changes; nothing about it moves.
 */
export const StarOutline = ({ src, look, state }) => {
    const ref = useRef(null);
    const colour = outlineColour(look, state);
    useEffect(() => {
        if (ref.current) drawOutline(ref.current, src, colour);
    }, [src, colour]);
    return (
        <canvas
            ref={ref}
            aria-hidden="true"
            data-star-outline={src}
            width={OUTLINE_ART_PX}
            height={OUTLINE_ART_PX}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{ width: OUTLINE_PX, height: OUTLINE_PX, imageRendering: 'pixelated' }}
        />
    );
};
