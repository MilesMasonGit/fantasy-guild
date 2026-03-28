import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useEngine } from '../../hooks/useEngine.js';
import { cn } from '../../utils/cn.js';
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

    // Support both direct props and registry-injected props
    const heroId = props.hero?.id || card?.assignedHeroId || (card?.heroSlots ? Object.values(card.heroSlots)[0] : null);
    const hero = props.hero || (heroId ? engine.HeroManager.getHero(heroId) : null);
    const taskIcon = props.taskIcon || trait?.taskIcon || '❓';
    const isHeroWorking = props.isHeroWorking || card?.status === 'active' || card?.isWorking;
    const className = props.className;

    // We use a local state to explicitly handle entering/exiting the work cycle
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        setIsAnimating(!!isHeroWorking);
    }, [isHeroWorking]);

    if (!hero) {
        return (
            <div className={cn("w-full h-24 bg-black/40 rounded-lg border border-white/5 flex flex-col items-center justify-center gap-1", className)}>
                <motion.div
                    initial={{ scale: 0.9, opacity: 0.6 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                >
                    <ItemIcon item={taskIcon} size={64} />
                </motion.div>
                <span className="text-[10px] text-gray-500 font-pixel uppercase tracking-widest opacity-40">
                    Awaiting Assignment
                </span>
            </div>
        );
    }

    return (
        <div className={cn(
            "relative w-full h-24 overflow-visible",
            className
        )}>
            <div className="absolute inset-0 flex justify-center items-center gap-12">

                {/* Hero Avatar (Worker) */}
                <motion.div
                    className="flex flex-col items-center justify-center pointer-events-none"
                    animate={isAnimating ? {
                        x: [0, 32, 0, 0],
                        y: [0, -4, 0, 0],
                    } : { x: 0, y: 0 }}
                    transition={isAnimating ? {
                        duration: 3,
                        times: [0, 0.1, 0.5, 1], // 0.3s hit, 1.2s back, 1.5s pause
                        repeat: Infinity,
                        ease: "easeInOut"
                    } : { duration: 0.3 }}
                >
                    <ItemIcon item={hero} size={64} />
                </motion.div>

                {/* Task Target (Resource Node, Forge, Book, etc.) */}
                <motion.div
                    className="flex flex-col items-center justify-center"
                    animate={isAnimating ? {
                        scale: [1, 1.1, 1, 1],
                        rotate: [0, 5, 0, 0],
                    } : { scale: 1, rotate: 0 }}
                    transition={isAnimating ? {
                        duration: 3,
                        times: [0, 0.1, 0.2, 1], // Quick jolt when hit
                        repeat: Infinity,
                        ease: "easeOut"
                    } : { duration: 0.3 }}
                >
                    <ItemIcon item={taskIcon} size={64} />
                </motion.div>

            </div>
        </div>
    );
});

export default TaskDisplay;
