import { FLAG_PX } from './flagGeometry.js';
import { MAT_Z } from './matLayers.js';
import { bubblesFor } from './heroBubbles.js';
import { TICK_INTERVAL_MS } from '../../../config/loopConstants.js';

/**
 * ⭐ **Speech bubbles, above every hero's head.**
 *
 * One layer over the whole mat, so a bubble is never hidden by a Token, a flag
 * or another hero. Each bubble is placed from the same point `MatHero` uses and
 * glides with it for one tick while the hero walks, so it stays over the head.
 * Bubbles are not clickable: the pointer passes straight through to whatever is
 * beneath, so dragging a hero or their flag is never blocked.
 */
export const HeroBubbleLayer = ({ heroes }) => (
    <div
        data-hero-bubbles
        className="absolute left-0 top-0 w-0 h-0 pointer-events-none"
        style={{ zIndex: MAT_Z.HERO_BUBBLE }}
    >
        {heroes.map(h => {
            const bubbles = bubblesFor(h.heroId, heroes);
            if (!bubbles.length) return null;
            return (
                <div
                    key={h.heroId}
                    data-hero-bubble-stack={h.heroId}
                    className="absolute flex flex-col items-center justify-end gap-1 pointer-events-none"
                    style={{
                        left: h.x,
                        // The bottom of the stack sits on the top of the hero's box (`heroPlacement`'s
                        // top, without importing it back from MatBoard).
                        top: h.y - FLAG_PX / 2 + FLAG_PX * 0.2,
                        transform: 'translate(-50%, -100%)',
                        transition: h.moving
                            ? `left ${TICK_INTERVAL_MS}ms linear, top ${TICK_INTERVAL_MS}ms linear`
                            : 'none'
                    }}
                >
                    {bubbles.map(b => (
                        <div
                            key={b.id}
                            data-hero-bubble={b.id}
                            className="relative whitespace-nowrap px-2 py-1 rounded-md border border-yellow-500/70 bg-yellow-950/95 text-yellow-100 text-[11px] font-bold shadow-lg"
                        >
                            {b.text}
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 border-r border-b border-yellow-500/70 bg-yellow-950/95" />
                        </div>
                    ))}
                </div>
            );
        })}
    </div>
);

export default HeroBubbleLayer;
