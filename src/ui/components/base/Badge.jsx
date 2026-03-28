import React from 'react';
import { cn } from '../../utils/cn.js';
import { Zap } from 'lucide-react';

/**
 * Badge: Small, standardized graphical tag used in card corners 
 * for resource costs, level indicators, or status effects.
 */
export const Badge = ({
    icon,
    value,
    variant = 'neutral', // 'success', 'danger', 'warning', 'info', 'neutral', 'count', 'requirement', 'energy'
    size = 'sm', // 'sm' (8px), 'base' (16px)
    className,
    ...props
}) => {
    const variants = {
        neutral: "bg-gi-surface-hover border-gi-border text-gi-text",
        success: "bg-gi-success/20 border-gi-success/50 text-gi-success",
        warning: "bg-gi-warning/20 border-gi-warning/50 text-gi-warning",
        danger: "bg-gi-danger/20 border-gi-danger/50 text-gi-danger",
        info: "bg-gi-primary/20 border-gi-primary/50 text-gi-primary",
        count: "bg-black/40 border-white/10 text-white",
        requirement: "bg-black/20 border-transparent text-gi-muted",
        energy: "bg-yellow-400 border-yellow-500 text-black [text-shadow:none]"
    };

    const sizes = {
        sm: "text-[8px] px-1.5 py-0.5",
        base: "text-[16px] px-2.5 py-1"
    };

    const renderValue = () => {
        if (value === undefined) return null;

        // Special case for requirements: small x, large number
        if (variant === 'requirement' && typeof value === 'string' && value.startsWith('x')) {
            const num = value.substring(1);
            return (
                <span className="tracking-tight flex items-baseline">
                    <span className="text-[8px] mr-1">x</span>
                    <span className="text-[16px]">{num}</span>
                </span>
            );
        }

        return <span className="tracking-tight">{value}</span>;
    };

    return (
        <div
            className={cn(
                "inline-flex items-center justify-center gap-1 rounded border font-bold shadow-sm",
                variants[variant],
                sizes[size],
                className
            )}
            title={props.title}
            {...props}
        >
            {variant === 'energy' && <Zap size={size === 'base' ? 14 : 10} fill="currentColor" className="mr-0.5" />}
            {icon && <span className="flex-shrink-0">{icon}</span>}
            {renderValue()}
        </div>
    );
};

export default Badge;
