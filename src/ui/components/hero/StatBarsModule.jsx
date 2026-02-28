import React from 'react';
import { cn } from '../../utils/cn.js';
import GIProgressBar from '../base/GIProgressBar.jsx';

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
        <div className={cn("flex flex-col gap-1.5 w-full", className)}>
            {/* HP Bar */}
            <GIProgressBar
                current={hp.current}
                max={hp.max}
                color="danger"
                height="sm"
                showText={true}
                textLabel={`HP: ${Math.floor(hp.current)}/${hp.max}`}
            />

            {/* Energy Bar */}
            <GIProgressBar
                current={energy.current}
                max={energy.max}
                color="secondary" // Often a yellow/gold in our theme for energy
                height="sm"
                showText={true}
                textLabel={`EN: ${Math.floor(energy.current)}/${energy.max}`}
            />
        </div>
    );
};

export default StatBarsModule;
