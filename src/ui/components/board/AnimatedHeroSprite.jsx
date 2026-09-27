import { useEffect, useState } from 'react';
import { cn } from '../../utils/cn.js';
import { heroFrameAt, heroPhaseMs } from './hitAnimations.js';

/**
 * Renders a 64x64 hero sprite sheet with 3 rows (Attack, Walk, Idle) and 8 frames per row.
 * 
 * Row 1 (index 0): Attack/Work
 * Row 2 (index 1): Walk
 * Row 3 (index 2): Idle
 */
export const AnimatedHeroSprite = ({
    src,
    alt,
    size = 64,
    animationState = 'idle', // 'idle', 'walk', 'attack'
    facingLeft = false,
    frameMs = 125,
    heroId = null,
    className
}) => {
    const clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const [frame, setFrame] = useState(() => heroFrameAt(clock(), heroId, frameMs));

    // 8 FPS by default (125 ms a frame); a limping hero plays slower.
    // ⭐ The frame is read from the clock, not counted (feedback Q4, FB-10):
    // the Token this hero works plays its hit on the strike frame, from the
    // same clock and the hero's own phase (`hitAnimations.js`), so the two
    // never drift apart. Each step waits for the next frame boundary.
    useEffect(() => {
        let timer = null;
        const step = () => {
            const now = clock();
            setFrame(heroFrameAt(now, heroId, frameMs));
            const intoFrame = ((now + heroPhaseMs(heroId)) % frameMs + frameMs) % frameMs;
            timer = setTimeout(step, frameMs - intoFrame + 1);
        };
        step();
        return () => clearTimeout(timer);
    }, [frameMs, heroId]);

    let rowOffset = 2; // Idle is row 3 (index 2)
    if (animationState === 'attack') rowOffset = 0;
    else if (animationState === 'walk') rowOffset = 1;

    return (
        <div
            className={cn('relative overflow-hidden select-none', className)}
            style={{
                width: size,
                height: size
            }}
            title={alt}
        >
            <div
                className="absolute inset-0"
                style={{ transform: facingLeft ? 'scaleX(-1)' : 'none' }}
            >
                <img
                    src={src}
                    alt={alt}
                    draggable={false}
                    className="absolute pointer-events-none"
                    style={{
                        width: `${size * 8}px`,
                        height: `${size * 3}px`,
                        maxWidth: 'none',
                        maxHeight: 'none',
                        imageRendering: 'pixelated',
                        transform: `translate(-${frame * size}px, -${rowOffset * size}px)`
                    }}
                />
            </div>
        </div>
    );
};

export default AnimatedHeroSprite;
