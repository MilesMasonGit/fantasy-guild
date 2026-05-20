import React, { useEffect, useState } from 'react';
import { useEngine } from '../../hooks/useEngine.js';
import { useGameState } from '../../hooks/useGameState.js';
import { cn } from '../../utils/cn.js';
import { resolveSpritePath } from '../../../utils/AssetManager.js';
import { ItemIcon } from '../base/ItemIcon.jsx';

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
export const TaskDisplay = React.memo(({ trait, card, isFirst, globalIndex, ...props }) => {
    const engine = useEngine();
    const [workStrike, setWorkStrike] = useState(false);

    // Subscribe to live hero data
    const heroId = props.hero?.id || card?.assignedHeroId;
    const hero = useGameState(
        state => heroId ? engine.HeroManager.getHero(heroId) : null,
        ['heroes_updated'],
        null,
        { deps: [heroId] }
    );

    const taskIcon = props.taskIcon || trait?.taskIcon || '❓';
    const isHeroWorking = props.isHeroWorking || card?.status === 'active' || card?.isWorking;
    const className = props.className;

    // Simulate "Work Strikes" (Lunging) when working
    useEffect(() => {
        if (!isHeroWorking) return;

        const interval = setInterval(() => {
            setWorkStrike(true);
            setTimeout(() => setWorkStrike(false), 300);
        }, 2000); // Lunge every 2 seconds

        return () => clearInterval(interval);
    }, [isHeroWorking]);

    const renderAvatar = (entity, fallbackIcon) => {
        const spritePath = resolveSpritePath(entity);
        const icon = entity?.icon || fallbackIcon;

        if (spritePath) {
            return (
                <div className="relative w-32 h-32 flex items-center justify-center">
                    <img 
                        src={spritePath} 
                        alt="Avatar"
                        className="w-full h-full object-contain pixel-art"
                    />
                </div>
            );
        }

        return (
            <div className="text-5xl select-none w-32 h-32 flex items-center justify-center">
                {icon}
            </div>
        );
    };

    if (!hero) {
        return (
            <div className={cn("w-full h-40 bg-black/40 rounded-lg border border-white/5 flex flex-col items-center justify-center gap-1", className)}>
                <div className="opacity-60 grayscale-[0.5] scale-90">
                    {renderAvatar(taskIcon, '❓')}
                </div>
                <span className="text-[10px] text-gray-500 font-pixel uppercase tracking-widest opacity-40">
                    Awaiting Assignment
                </span>
            </div>
        );
    }

    return (
        <div className={cn(
            "relative w-full h-40 overflow-hidden transition-all duration-300",
            className
        )}>
            <div className="absolute inset-0 flex justify-between items-center px-10">
                {/* Hero Avatar (Worker) */}
                <div className={cn(
                    "flex flex-col items-center justify-center transition-transform duration-150 z-10 animate-bob",
                    workStrike ? "translate-x-12 scale-110" : ""
                )}>
                    {renderAvatar(hero, '👤')}
                </div>

                {/* Task Target (Resource, Item, etc.) */}
                <div className="flex flex-col items-center justify-center animate-bob z-10" style={{ animationDelay: '0.5s' }}>
                    <div className={cn("transition-transform duration-75", workStrike && "animate-rattle")}>
                        {renderAvatar(taskIcon, '📦')}
                    </div>
                </div>
            </div>
        </div>
    );
});

export default TaskDisplay;
