import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useViewport } from '../../context/ViewportContext.jsx';
import { useEngine } from '../../hooks/useEngine.js';
import { useGameState } from '../../hooks/useGameState.js';
import { AlertCircle } from 'lucide-react';
import { cn } from '../../utils/cn.js';
import { GRID_PITCH, PLAYMAT_PADDING } from '../../../config/registries/layoutConstants.js';

/**
 * OffScreenIndicators
 * Tracks Invasion and Event cards that are panned off-screen and renders
 * directional arrows at the screen edge to guide the player.
 */
export const OffScreenIndicators = ({ extents }) => {
    const { targetX, targetY, targetScale } = useViewport();
    const { GameState } = useEngine();
    const containerRef = useRef(null);
    const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver(entries => {
            for (const entry of entries) {
                setViewportSize({
                    width: entry.contentRect.width,
                    height: entry.contentRect.height
                });
            }
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);
    
    // Subscribe to active cards
    const trackedCards = useGameState(state => {
        const active = state.cards?.active || [];
        return active.filter(c => 
            (c.cardType === 'invasion' || c.cardType === 'event') && 
            c.position?.x !== null && 
            !c.isHidden
        ).map(c => ({
            id: c.id,
            type: c.cardType,
            x: c.position.x,
            y: c.position.y
        }));
        
        if (filtered.length > 0) {
            console.log(`[OffScreenIndicators] Tracking ${filtered.length} cards:`, filtered);
        }
        
        return filtered;
    }, ['cards_updated', 'area_switched']);

    // High-frequency transform logic
    // We use a local state or ref to avoid React re-renders for every pixel of pan
    // but since we want to show/hide based on visibility, we'll use a component with 
    // framer-motion or a simple interval/raf for the indicators.
    // Actually, for a premium feel, let's use a small Raf loop or just framer-motion.
    
    // To keep it performant, we'll calculate visibility in a separate effect or use useMemo with motion values
    // but motion values only work well for direct styling.
    
    // Let's use a simpler approach: a component that renders motion.divs for each card.
    
    return (
        <div ref={containerRef} className="absolute inset-0 pointer-events-none z-[200] overflow-hidden">
            {trackedCards.map(card => (
                <Indicator 
                    key={card.id} 
                    card={card} 
                    extents={extents} 
                    viewportSize={viewportSize}
                    targetX={targetX}
                    targetY={targetY}
                    targetScale={targetScale}
                />
            ))}
        </div>
    );
};

const Indicator = ({ card, extents, viewportSize, targetX, targetY, targetScale }) => {
    const [style, setStyle] = useState({ opacity: 0 });
    const lastStyleRef = useRef(style);

    useEffect(() => {
        const update = () => {
            const tx = targetX.get();
            const ty = targetY.get();
            const ts = targetScale.get();

            // Calculate world position in the playmat-surface-root
            const worldX = (card.x - extents.minX) * GRID_PITCH + PLAYMAT_PADDING;
            const worldY = (card.y - extents.minY) * GRID_PITCH + PLAYMAT_PADDING;

            // Calculate screen position
            const screenX = tx + worldX * ts;
            const screenY = ty + worldY * ts;

            const vw = viewportSize.width;
            const vh = viewportSize.height;

            if (vw === 0 || vh === 0) return;

            // "More than halfway off" = center is off-screen
            const isOffScreen = 
                screenX < 0 || 
                screenX > vw || 
                screenY < 0 || 
                screenY > vh;

            if (!isOffScreen) {
                if (lastStyleRef.current.opacity !== 0) {
                    const next = { opacity: 0 };
                    lastStyleRef.current = next;
                    setStyle(next);
                }
                return;
            }

            // Clamp to screen edges with padding
            const pad = 40;
            const clampedX = Math.min(Math.max(screenX, pad), vw - pad);
            const clampedY = Math.min(Math.max(screenY, pad), vh - pad);

            // Calculate rotation towards the card from screen center
            const angle = Math.atan2(screenY - (vh/2), screenX - (vw/2)) * (180 / Math.PI);

            const next = {
                opacity: 1,
                left: clampedX,
                top: clampedY,
                transform: `translate(-50%, -50%)`,
                rotation: angle,
                type: card.type
            };

            // Only update if visible properties changed significantly
            const diff = Math.abs(lastStyleRef.current.left - clampedX) + 
                         Math.abs(lastStyleRef.current.top - clampedY) + 
                         Math.abs(lastStyleRef.current.rotation - angle);
            
            if (lastStyleRef.current.opacity === 0 || diff > 0.5) {
                lastStyleRef.current = next;
                setStyle(next);
            }
        };

        let rafId;
        const loop = () => {
            update();
            rafId = requestAnimationFrame(loop);
        };
        rafId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(rafId);
    }, [card, extents, viewportSize, targetX, targetY, targetScale]);

    if (style.opacity === 0) return null;

    const isInvasion = style.type === 'invasion';
    const colorClass = isInvasion 
        ? "bg-red-600 border-black" 
        : "bg-orange-400 border-black";

    return (
        <div 
            className="absolute transition-opacity duration-300"
            style={{ 
                left: style.left, 
                top: style.top, 
                transform: style.transform,
                opacity: style.opacity
            }}
        >
            <div className="relative flex items-center justify-center">
                {/* Rotating Arrowhead (Orbits the bubble) */}
                <div 
                    className="absolute w-12 h-12 flex items-center justify-center"
                    style={{ 
                        transform: `rotate(${style.rotation}deg)`,
                    }}
                >
                    <svg 
                        viewBox="0 0 24 24" 
                        className={cn(
                            "absolute w-4 h-4 -right-3", // Pushes the arrowhead outside the bubble radius
                            isInvasion ? "fill-red-600 stroke-black" : "fill-orange-400 stroke-black"
                        )} 
                        strokeWidth="2"
                    >
                        {/* A sharp arrowhead path */}
                        <path d="M0 4l16 8-16 8z" />
                    </svg>
                </div>
                
                {/* Alert Circle with ! */}
                <div className={cn(
                    "relative w-10 h-10 rounded-full border-2 flex items-center justify-center shadow-xl z-10",
                    colorClass
                )}>
                    <span className={cn("font-pixel font-bold text-xl leading-none", isInvasion ? "text-white" : "text-black")}>!</span>
                </div>
            </div>
        </div>
    );
};

export default OffScreenIndicators;
