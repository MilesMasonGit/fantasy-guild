import React from 'react';
import { cn } from '../../utils/cn.js';
import { EventBus } from '../../../systems/core/EventBus.js';

/**
 * Button: Standardized cyber-guild button for all interactions.
 * Includes built-in hover scales, neon shadows, and sound-hook readiness.
 */
export const Button = ({
    children,
    variant = 'primary',
    size = 'md',
    disabled = false,
    className,
    onClick,
    ...props
}) => {
    // Standard tactile mechanical press, scale conditionally
    const canScale = !['nav', 'sidebar'].includes(variant) && !disabled;
    const baseStyles = "inline-flex items-center justify-center font-bold tracking-wider uppercase transition-all";

    const variants = {
        primary: "bg-gi-primary text-gi-primary-text hover:bg-gi-primary/90 border border-transparent rounded",
        secondary: "bg-gi-surface-hover text-gi-text border border-gi-border hover:border-gi-primary/50 rounded",
        danger: "bg-gi-danger text-gi-text hover:bg-gi-danger/90 border border-transparent rounded",
        ghost: "bg-transparent text-gi-text hover:bg-gi-surface-hover border border-transparent rounded",
        icon: "bg-transparent text-gi-muted hover:text-white hover:bg-gi-surface-hover border border-transparent aspect-square rounded",
        nav: "bg-transparent text-gi-muted hover:text-gi-primary border-b-2 border-transparent hover:border-b-gi-primary rounded-none",
        sidebar: "bg-gi-surface text-gi-text border border-gi-border hover:bg-gi-surface-hover hover:border-gi-primary uppercase tracking-widest rounded"
    };

    const sizes = {
        sm: variant === 'icon' ? "p-1.5 text-xs" : "px-3 py-1.5 text-xs",
        md: variant === 'icon' ? "p-2 text-sm" : "px-6 py-2.5 text-sm",
        lg: variant === 'icon' ? "p-3 text-base" : "px-8 py-4 text-base"
    };

    return (
        <button
            disabled={disabled}
            className={cn(
                baseStyles,
                variants[variant],
                sizes[size],
                canScale && "active:scale-95",
                disabled && "opacity-50 cursor-not-allowed hover:bg-inherit hover:shadow-none active:scale-100",
                className
            )}
            onClick={(e) => {
                EventBus.publish('audio:play', { clip: 'ui_click', type: 'ui' });
                if (onClick && !disabled) onClick(e);
            }}
            {...props}
        >
            {children}
        </button>
    );
};

export default Button;
