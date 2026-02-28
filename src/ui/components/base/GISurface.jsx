import React from 'react';
import { cn } from '../../utils/cn.js';

/**
 * GI-Surface: The standardized bounding container for all UI panels and cards.
 * It enforces the structural border, shadow, and glassmorphism (blur) aesthetics natively.
 * 
 * To implement mixed light/dark modes locally, parent components will be able to 
 * wrap this in a customized theme provider or local CSS variable override class.
 */
export const GISurface = ({ children, className, blur = true, interactive = false, ...props }) => {
    return (
        <div
            className={cn(
                "bg-gi-surface border border-gi-border rounded-xl text-gi-text shadow-[0_4px_20px_rgba(0,0,0,0.5)]",
                blur && "backdrop-blur-md",
                interactive && "hover:bg-gi-surface-hover transition-colors cursor-pointer",
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
};

export default GISurface;
