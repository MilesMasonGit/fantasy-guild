import React from 'react';
import { cn } from '../../utils/cn.js';

/**
 * HeaderModule
 * Replaces the top section of the legacy HeroCard.
 * Responsible purely for the hero's identity: Portrait and Name.
 * 
 * @param {Object} props
 * @param {Object} props.hero - The hero data object.
 * @param {Function} [props.onCustomize] - Optional callback to edit the hero name/icon.
 */
export const HeaderModule = ({
    hero,
    onCustomize,
    className
}) => {
    if (!hero) return null;

    // Utilize the standard Game Engine fallback for icons if missing
    const icon = hero.icon || '👤';

    return (
        <div className={cn("flex items-center gap-3 relative z-10 w-full", className)}>

            {/* Portrait Container */}
            <div
                className={cn(
                    "w-12 h-12 rounded-md overflow-hidden bg-black/40 border border-white/10 flex-shrink-0 flex items-center justify-center text-3xl",
                    onCustomize && "cursor-pointer hover:border-white/30 transition-colors"
                )}
                onClick={onCustomize}
                title={onCustomize ? "Click to customize" : undefined}
            >
                {/* 
                    If the game uses 32px pixel sprites in the future, 
                    this wrapper is ready to swap the emoji for an <img /> 
                */}
                {icon}
            </div>

            {/* Identity Info Container */}
            <div className="flex-1 flex flex-col justify-center min-w-0">
                <div className="flex justify-between items-center w-full">
                    <span className="font-bold text-white text-sm tracking-wide font-pixel truncate">
                        {hero.name}
                    </span>

                    {/* If assigned, legacy had an unassign button here. We assume that's handled by generic ContextMenus now, but we leave space. */}
                </div>

                {/* 
                   We keep this placeholder text tiny so the InformationModule 
                   can sit directly underneath this component and look connected.
                */}
            </div>
        </div>
    );
};

export default HeaderModule;
