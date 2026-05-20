import React from 'react';
import { cn } from '../../utils/cn.js';
import { getClass } from '../../../config/registries/index.js';
import { resolveSpritePath } from '../../../utils/AssetManager.js';
import ActivityBadgeModule from './ActivityBadgeModule.jsx';

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

    const heroClass = getClass(hero.classId);
    const assetPath = resolveSpritePath(hero);
    const icon = hero.icon || '👤';
    const classNameDisplay = hero.className || heroClass?.name || 'Adventurer';

    return (
        <div className={cn("flex items-center gap-4 relative z-10 w-full p-2 bg-gi-surface/50 rounded-t-lg", className)}>

            {/* Portrait Container - 64px Large */}
            <div
                className={cn(
                    "w-16 h-16 rounded-lg overflow-hidden bg-gi-base border border-gi-border flex-shrink-0 flex items-center justify-center text-4xl shadow-inner",
                    onCustomize && "cursor-pointer hover:border-gi-primary/50 transition-all hover:scale-105 active:scale-95"
                )}
                onPointerDown={(e) => {
                    if (onCustomize) {
                        e.stopPropagation();
                        e.preventDefault();
                        onCustomize(e);
                    }
                }}
                title={onCustomize ? "Click to customize" : undefined}
            >
                {assetPath ? (
                    <img 
                        src={assetPath} 
                        alt={hero.name} 
                        className="w-full h-full object-contain render-pixelated" 
                    />
                ) : (
                    icon
                )}
            </div>

            {/* Identity Info Container */}
            <div className="flex-1 flex flex-col justify-center min-w-0 gap-1.5 py-1">
                <div className="flex justify-between items-center w-full">
                    <span className="font-base font-black text-white text-base tracking-widest uppercase truncate drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
                        {hero.name}
                    </span>
                    <span className="text-xs font-black text-gi-primary font-mono bg-gi-primary/10 px-1.5 py-0.5 rounded border border-gi-primary/20 shadow-sm">
                        LV {Math.floor(hero.level || 1)}
                    </span>
                </div>

                {/* 2. Identity Subtitle: [Trait] [Class] */}
                <div className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.15em] leading-none">
                    {hero.traitName && (
                        <span className="text-gi-accent brightness-125 drop-shadow-sm">
                            {hero.traitName}
                        </span>
                    )}
                    <span className="text-gi-accent brightness-125 opacity-90 drop-shadow-sm">
                        {classNameDisplay}
                    </span>
                </div>

                {/* 3. Status Badge (Moved here for space efficiency) */}
                <div className="mt-1 sticky left-0 w-fit">
                    <ActivityBadgeModule hero={hero} />
                </div>
            </div>
        </div>
    );
};

export default HeaderModule;
