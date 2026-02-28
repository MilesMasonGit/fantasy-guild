import React, { useEffect, useState } from 'react';
import { cn } from '../../utils/cn.js';

/**
 * TaskDisplay
 * A purely visual flavor component used on Task Cards. 
 * Shows the Hero avatar visually interacting with a static Task icon/object.
 * 
 * @param {Object} props
 * @param {Object} props.hero - The assigned hero.
 * @param {String|ReactNode} props.taskIcon - Visual representation of the task/item (e.g., '🌲')
 * @param {Boolean} props.isHeroWorking - Triggers the rhythmic working animation loop
 */
export const TaskDisplay = ({
    hero,
    taskIcon = '❓',
    isHeroWorking = false,
    className
}) => {
    // We use a local state to explicitly handle entering/exiting the work cycle
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        setIsAnimating(isHeroWorking);
    }, [isHeroWorking]);

    if (!hero) {
        return (
            <div className={cn("w-full h-24 bg-black/40 rounded-lg border border-white/5 flex items-center justify-center text-xs text-gray-500 font-pixel", className)}>
                Awaiting Assignment...
            </div>
        );
    }

    const renderAvatar = (entity, fallbackIcon) => {
        const icon = entity?.icon || fallbackIcon;
        return (
            <div className="text-4xl filter drop-shadow-md">
                {icon}
            </div>
        );
    };

    return (
        <div className={cn(
            "relative w-full h-32 rounded-lg border border-gi-border overflow-hidden",
            "bg-gradient-to-t from-gi-surface-glass/80 to-transparent",
            className
        )}>
            {/* Background Texture (Softer, less aggressive than the Combat arena) */}
            <div className="absolute inset-0 opacity-5"
                style={{ backgroundImage: 'radial-gradient(circle at center, #fff 1px, transparent 1px)', backgroundSize: '16px 16px' }}>
            </div>

            <div className="absolute inset-0 flex justify-center items-center gap-12 px-12">

                {/* Hero Avatar (Worker) */}
                <div className={cn(
                    "flex flex-col items-center justify-center transition-all duration-300",
                    isAnimating ? "animate-bounce drop-shadow-[0_0_12px_rgba(6,182,212,0.8)]" : "drop-shadow-[0_0_8px_rgba(6,182,212,0.3)] opacity-80"
                )}>
                    {renderAvatar(hero, '👤')}
                    <div className="mt-2 w-16 h-2 bg-black/40 rounded-[100%] blur-[2px]"></div>
                </div>

                {/* Task Target (Resource Node, Forge, Book, etc.) */}
                <div className={cn(
                    "flex flex-col items-center justify-center transition-transform",
                    isAnimating ? "scale-105 drop-shadow-[0_0_15px_rgba(251,191,36,0.6)]" : "scale-100 opacity-80 backdrop-grayscale"
                )}>
                    {/* Render standard string emojis or pass through custom ReactNode icons */}
                    <div className="text-5xl filter drop-shadow-md">
                        {taskIcon}
                    </div>
                    <div className="mt-2 w-20 h-2 bg-black/50 rounded-[100%] blur-[2px]"></div>
                </div>

            </div>

            {/* Optional: Add flying particles or 'Zzz' icons when idle by checking !isAnimating */}
        </div>
    );
};

export default TaskDisplay;
