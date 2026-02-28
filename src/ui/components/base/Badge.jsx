import React from 'react';
import { cn } from '../../utils/cn.js';

/**
 * Badge: Small, standardized graphical tag used in card corners 
 * for resource costs, level indicators, or status effects.
 */
export const Badge = ({
    icon,
    value,
    variant = 'neutral', // 'success', 'danger', 'warning', 'info', 'neutral'
    className,
    ...props
}) => {
    const variants = {
        neutral: "bg-gi-surface-hover border-gi-border text-gi-text",
        success: "bg-gi-success/20 border-gi-success/50 text-gi-success",
        warning: "bg-gi-warning/20 border-gi-warning/50 text-gi-warning",
        danger: "bg-gi-danger/20 border-gi-danger/50 text-gi-danger",
        info: "bg-gi-primary/20 border-gi-primary/50 text-gi-primary"
    };

    return (
        <div
            className={cn(
                "inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold shadow-sm backdrop-blur-sm",
                variants[variant],
                className
            )}
            title={props.title}
            {...props}
        >
            {icon && <span className="flex-shrink-0">{icon}</span>}
            {value !== undefined && <span className="font-sans tracking-wide">{value}</span>}
        </div>
    );
};

export default Badge;
