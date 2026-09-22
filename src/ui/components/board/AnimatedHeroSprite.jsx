import { useEffect, useState } from 'react';
import { cn } from '../../utils/cn.js';

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
    className
}) => {
    const [frame, setFrame] = useState(0);

    // 8 FPS by default (125 ms a frame); a limping hero plays slower.
    useEffect(() => {
        const interval = setInterval(() => {
            setFrame(f => (f + 1) % 8);
        }, frameMs);
        return () => clearInterval(interval);
    }, [frameMs]);

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
