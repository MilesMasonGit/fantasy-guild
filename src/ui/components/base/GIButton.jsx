import React from 'react';
import { cn } from '../../utils/cn.js';

/**
 * GI-Button: Standardized cyber-guild button for all interactions.
 * Includes built-in hover scales, neon shadows, and sound-hook readiness.
 */
export const GIButton = ({
    children,
    variant = 'primary',
    size = 'md',
    className,
    onClick,
    ...props
}) => {
    // Standard tactile mechanical press
    const baseStyles = "inline-flex items-center justify-center font-bold tracking-wider uppercase rounded transition-all active:scale-95";

    const variants = {
        primary: "bg-gi-primary text-gi-base shadow-[0_0_15px_rgba(6,182,212,0.4)] hover:shadow-[0_0_25px_rgba(6,182,212,0.7)] hover:bg-[rgb(6,182,212,0.8)] border border-transparent",
        secondary: "bg-gi-surface-hover text-gi-text border border-gi-border hover:border-gi-primary",
        danger: "bg-gi-danger text-gi-text shadow-[0_0_15px_rgba(239,68,68,0.4)] hover:shadow-[0_0_25px_rgba(239,68,68,0.7)] hover:bg-[rgb(239,68,68,0.8)] border border-transparent",
        ghost: "bg-transparent text-gi-text hover:bg-gi-surface-hover border border-transparent"
    };

    const sizes = {
        sm: "px-3 py-1.5 text-xs",
        md: "px-6 py-2.5 text-sm",
        lg: "px-8 py-4 text-base"
    };

    return (
        <button
            className={cn(baseStyles, variants[variant], sizes[size], className)}
            onClick={(e) => {
                // Future Implementation: EventBus.publish('play-sound', 'click');
                if (onClick) onClick(e);
            }}
            {...props}
        >
            {children}
        </button>
    );
};

export default GIButton;
