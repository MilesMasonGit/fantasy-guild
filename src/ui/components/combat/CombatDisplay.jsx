import React, { useEffect, useState } from 'react';
import { cn } from '../../utils/cn.js';

/**
 * CombatDisplay
 * A purely visual flavor component that sits at the top of the Combat Stage. 
 * Shows the Hero and Enemy avatars facing each other, triggering CSS animations when attacks occur.
 * 
 * @param {Object} props
 * @param {Object} props.hero - The active hero.
 * @param {Object} props.enemy - The active enemy.
 * @param {Boolean} props.isHeroAttacking - Flag indicating the hero is striking this frame
 * @param {Boolean} props.isEnemyAttacking - Flag indicating the enemy is striking this frame
 */
export const CombatDisplay = ({
    hero,
    enemy,
    isHeroAttacking = false,
    isEnemyAttacking = false,
    className
}) => {
    // We use local state to trigger full animation cycles even if the props pulse fast
    const [heroAttackAnim, setHeroAttackAnim] = useState(false);
    const [enemyAttackAnim, setEnemyAttackAnim] = useState(false);

    // Watch props and trigger local state that resets after standard animation length
    useEffect(() => {
        if (isHeroAttacking) {
            setHeroAttackAnim(true);
            const timer = setTimeout(() => setHeroAttackAnim(false), 300); // 300ms lunge animation
            return () => clearTimeout(timer);
        }
    }, [isHeroAttacking]);

    useEffect(() => {
        if (isEnemyAttacking) {
            setEnemyAttackAnim(true);
            const timer = setTimeout(() => setEnemyAttackAnim(false), 300); // 300ms lunge animation
            return () => clearTimeout(timer);
        }
    }, [isEnemyAttacking]);

    if (!hero || !enemy) {
        return (
            <div className={cn("w-full h-24 bg-black/40 rounded-lg border border-white/5 flex items-center justify-center text-xs text-gray-600 font-pixel", className)}>
                Awaiting Combatants...
            </div>
        );
    }

    // Attempt to load 32px sprites if available, fallback to emojis or generic icons
    // For now we use the provided data icons. The 'hero' and 'enemy' objects will eventually contain actual asset paths
    const renderAvatar = (entity, fallbackIcon) => {
        const icon = entity?.icon || fallbackIcon;
        // If it's a string, we just render it as text (emoji). If it's an image path, we could render an img tag.
        return (
            <div className="text-4xl filter drop-shadow-md">
                {icon}
            </div>
        );
    };

    return (
        <div className={cn(
            "relative w-full h-32 rounded-lg border border-gi-border overflow-hidden",
            "bg-gradient-to-t from-black/80 to-transparent",
            className
        )}>
            {/* Background Texture / Arena lines */}
            <div className="absolute inset-0 opacity-10"
                style={{ backgroundImage: 'repeating-linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%, #000), repeating-linear-gradient(45deg, #000 25%, #222 25%, #222 75%, #000 75%, #000)', backgroundPosition: '0 0, 10px 10px', backgroundSize: '20px 20px' }}>
            </div>

            <div className="absolute inset-0 flex justify-between items-center px-12">

                {/* Hero Avatar Container */}
                <div className={cn(
                    "flex flex-col items-center justify-center transition-transform duration-100",
                    heroAttackAnim ? "translate-x-4 scale-110 drop-shadow-[0_0_15px_rgba(6,182,212,0.8)]" : "drop-shadow-[0_0_8px_rgba(6,182,212,0.3)]"
                )}>
                    {renderAvatar(hero, '👤')}
                    <div className="mt-2 w-16 h-2 bg-black/40 rounded-[100%] blur-[2px]"></div> {/* Ground shadow */}
                </div>

                {/* Clash Indicator (Optional "VS" or impact spark) */}
                <div className="flex items-center justify-center z-10 w-8 h-8 rounded-full">
                    {(heroAttackAnim || enemyAttackAnim) && (
                        <div className="absolute font-pixel text-xl text-yellow-400 font-bold animate-ping opacity-75">
                            💥
                        </div>
                    )}
                </div>

                {/* Enemy Avatar Container */}
                <div className={cn(
                    "flex flex-col items-center justify-center transition-transform duration-100",
                    // Enemy scales slightly up and lunges left when attacking
                    enemyAttackAnim ? "-translate-x-4 scale-110 drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]" : "drop-shadow-[0_0_8px_rgba(239,68,68,0.3)]"
                )}>
                    {renderAvatar(enemy, '👹')}
                    <div className="mt-2 w-16 h-2 bg-black/40 rounded-[100%] blur-[2px]"></div> {/* Ground shadow */}
                </div>

            </div>

            {/* Screen shake wrapper (optional CSS class applied to root if we wanted true impact feeling) */}
            {/* If we strictly need screen shake, we could conditionally apply an animate-shake class to the whole root div here */}
        </div>
    );
};

export default CombatDisplay;
