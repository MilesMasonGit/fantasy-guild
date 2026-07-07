import React, { useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../utils/cn.js';

/**
 * GUTooltip - Generic Unified Tooltip
 * Standardized "Vibrant Modern Retro" tooltip for all game elements.
 * Supports cursor following and custom content.
 */
export const GUTooltip = ({ 
    title, 
    description, 
    children, 
    mousePos, 
    color = "text-white",
    width = 240,
    offset = 20
}) => {
    const tooltipRef = useRef(null);

    // High-performance positioning logic
    useEffect(() => {
        if (!tooltipRef.current || !mousePos) return;
        
        const x = mousePos.x + offset;
        const y = mousePos.y + offset;
        
        // Ensure tooltip stays on screen (basic clamping)
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const rect = tooltipRef.current.getBoundingClientRect();
        
        let finalX = x;
        let finalY = y;
        
        if (x + rect.width > vw) finalX = mousePos.x - rect.width - offset;
        if (y + rect.height > vh) finalY = mousePos.y - rect.height - offset;
        
        tooltipRef.current.style.transform = `translate3d(${finalX}px, ${finalY}px, 0)`;
        tooltipRef.current.style.opacity = '1';
    }, [mousePos, offset]);

    if (!mousePos) return null;

    return createPortal(
        <div
            ref={tooltipRef}
            className="fixed top-0 left-0 z-[9999] pointer-events-none opacity-0 transition-opacity duration-150"
            style={{ 
                width: width === 'auto' ? 'auto' : `${width}px`,
                minWidth: width === 'auto' ? '180px' : 'none',
                maxWidth: '400px',
                willChange: 'transform'
            }}
        >
            <div className="bg-gi-base border-2 border-white/10 p-4 rounded-lg shadow-2xl relative">
                {/* Header */}
                {(title || color) && (
                    <div className={cn(
                        "gi-text-16 font-pixel font-bold uppercase mb-2 border-b border-white/10 pb-1 flex items-center gap-2",
                        color
                    )}>
                        <span className="text-white/40">»</span> {title}
                    </div>
                )}
                
                {/* Content */}
                {description && (
                    <div 
                        className="text-sm font-sans leading-relaxed text-gi-text/80 mb-2"
                        style={{ whiteSpace: 'pre-line' }}
                    >
                        {description}
                    </div>
                )}

                {/* Custom Slot (for stats, bonuses, etc) */}
                {children && (
                    <div className="flex flex-col gap-1.5 mt-2">
                        {children}
                    </div>
                )}
                
                {/* Decorative Pixel Corners (Outer Layer) */}
                <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-gi-primary z-10" />
                <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-gi-primary z-10" />
                <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-gi-primary z-10" />
                <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-gi-primary z-10" />
            </div>
        </div>,
        document.body
    );
};

export default GUTooltip;
