import React from 'react';
import { cn } from '../../utils/cn.js';

/**
 * GI-TitleModule: Standardized header component for cards and panels.
 * Supports visual variants specifically tailored for Heroes, UI Cards, and Items.
 */
export const GITitleModule = ({
    title,
    subtitle,
    icon,
    variant = 'standard', // 'hero', 'item', 'standard'
    className,
    ...props
}) => {
    const variants = {
        standard: "bg-gi-surface-hover border-b border-gi-border text-gi-text",
        hero: "bg-gradient-to-r from-gi-primary/20 to-transparent border-b border-gi-primary/50 text-gi-primary",
        item: "bg-gradient-to-r from-gi-accent/20 to-transparent border-b border-gi-accent/50 text-gi-accent"
    };

    return (
        <div
            className={cn(
                "flex items-center gap-3 p-3 w-full rounded-t-lg",
                variants[variant],
                className
            )}
            {...props}
        >
            {icon && (
                <div className="flex-shrink-0 w-10 h-10 rounded bg-gi-base flex items-center justify-center border border-gi-border/50 text-gi-text shadow-inner">
                    {icon}
                </div>
            )}
            <div className="flex flex-col flex-1 min-w-0">
                <h3 className="font-base font-bold text-xl leading-tight truncate tracking-wider uppercase drop-shadow-md">
                    {title}
                </h3>
                {subtitle && (
                    <span className="font-sans text-xs text-gi-muted uppercase tracking-widest truncate mt-0.5">
                        {subtitle}
                    </span>
                )}
            </div>
        </div>
    );
};

export default GITitleModule;
