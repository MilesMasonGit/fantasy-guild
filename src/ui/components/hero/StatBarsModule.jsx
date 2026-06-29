import React from 'react';
import { cn } from '../../utils/cn.js';
import ProgressBar from '../base/ProgressBar.jsx';

/**
 * StatBarsModule
 * Groups the Hero's HP and Energy bars ensuring perfect alignment.
 * 
 * @param {Object} props
 * @param {Object} props.hero - The hero data object containing hp and energy.
 */
export const StatBarsModule = ({
    hero,
    className
}) => {
    // Villagers do not have HP or Energy in this game design
    if (!hero || hero.isVillager) return null;

    const hp = hero.hp || { current: 0, max: 10 };
    const energy = hero.energy || { current: 0, max: 10 };

    return (
        <div className={cn("flex flex-col gap-2 w-full p-2 bg-gi-surface/30", className)}>
            {/* Health Bar Row */}
            <div className="flex items-center pb-0.5">
                <span className="w-10 text-[9px] font-black text-gi-hp uppercase tracking-tighter leading-none shrink-0">Health</span>
                <span className="text-[10px] font-mono font-bold text-gi-text/80 min-w-[42px] text-right mr-2 tracking-tighter">
                    {Math.floor(hp.current)}/{hp.max}
                </span>
                <ProgressBar
                    heroId={hero.id}
                    targetType="hero-hp"
                    current={hp.current}
                    max={hp.max}
                    color="hp"
                    size="sm"
                    showBloom={true}
                    showBitDrift={false}
                    className="flex-1"
                />
            </div>

            {/* Energy Bar Row */}
            <div className="flex items-center">
                <span className="w-10 text-[9px] font-black text-gi-warning uppercase tracking-tighter leading-none shrink-0">Energy</span>
                <span className="text-[10px] font-mono font-bold text-gi-text/80 min-w-[42px] text-right mr-2 tracking-tighter">
                    {Math.floor(energy.current)}/{energy.max}
                </span>
                <ProgressBar
                    heroId={hero.id}
                    targetType="hero-energy"
                    current={energy.current}
                    max={energy.max}
                    color="energy"
                    size="sm"
                    showBloom={true}
                    showBitDrift={false}
                    className="flex-1"
                />
            </div>
        </div>
    );
};

export default StatBarsModule;
