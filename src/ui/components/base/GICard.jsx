import React from 'react';
import { cn } from '../../utils/cn.js';
import GISurface from './GISurface.jsx';

/**
 * GI-Card: The standardized base visual container for all Cards (Heroes, Quests, Items).
 * Supports rarity-based borders and standardized content padding.
 */
export const GICard = ({
    children,
    className,
    rarity = 'common',
    interactive = true,
    imageSrc,
    ...props
}) => {
    const rarityBorders = {
        common: "border-gi-border",
        rare: "border-gi-primary shadow-[0_0_10px_rgba(6,182,212,0.3)]",
        epic: "border-gi-accent shadow-[0_0_15px_rgba(168,85,247,0.4)]",
        legendary: "border-gi-warning shadow-[0_0_20px_rgba(245,158,11,0.5)]"
    };

    return (
        <GISurface
            className={cn(
                "w-64 min-h-80 flex flex-col p-2 relative overflow-hidden group transition-all duration-300",
                rarityBorders[rarity],
                className
            )}
            interactive={interactive}
            blur={true}
            {...props}
        >
            {/* Ambient inner glow tied to rarity */}
            <div className={cn(
                "absolute inset-0 opacity-5 pointer-events-none transition-opacity duration-500 group-hover:opacity-15 z-0",
                rarity === 'rare' ? "bg-gi-primary" : "",
                rarity === 'epic' ? "bg-gi-accent" : "",
                rarity === 'legendary' ? "bg-gi-warning" : ""
            )} />

            {/* Full-bleed Background Image */}
            {imageSrc && (
                <div
                    className="absolute inset-0 bg-cover bg-center bg-no-repeat z-0"
                    style={{ backgroundImage: `url(${imageSrc})` }}
                />
            )}

            {/* The content container ensures nothing overlaps the custom border */}
            <div className="relative z-10 flex flex-col h-full gap-2 w-full">
                {children}
            </div>
        </GISurface>
    );
};

export default GICard;
