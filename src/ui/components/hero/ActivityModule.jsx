import React from 'react';
import { cn } from '../../utils/cn.js';

/**
 * ActivityModule
 * Displays the current working status of the hero (Idle, Working, Wounded, etc).
 * Implements the 4-state logic check replacing the legacy status line.
 * 
 * @param {Object} props
 * @param {Object} props.hero - The hero data object.
 * @param {Object} [props.card=null] - The card the hero is assigned to, if any.
 */
export const ActivityModule = ({
    hero,
    card = null,
    className
}) => {
    if (!hero) return null;

    // Evaluate the 4 states: Wounded, Idle, Working, Working-Idle
    const getStatusInfo = () => {
        // State 1: Wounded (HP < 25%)
        const hpPercent = hero.hp?.max > 0 ? (hero.hp.current / hero.hp.max) : 1;
        if (hpPercent < 0.25 && !hero.isVillager) {
            return { colorClass: 'bg-gi-danger', textClass: 'text-gi-danger', text: 'Wounded', isPulsing: true };
        }

        // State 2: Idle (Not assigned)
        if (!hero.assignedCardId) {
            return { colorClass: 'bg-gi-primary text-opacity-50', textClass: 'text-gray-500', text: 'Idle', isPulsing: false };
        }

        // State 3 & 4 Require Card Knowledge
        if (!card) {
            // Fallback if we know they're assigned but the card object wasn't passed down
            return { colorClass: 'bg-gi-warning', textClass: 'text-gi-warning', text: 'Assigned', isPulsing: false };
        }

        const taskName = card.name || 'Task';

        // State 3: Working (Actively ticking on a card)
        if (card.status === 'active' || card.status === 'working') {
            return { colorClass: 'bg-gi-success', textClass: 'text-gi-success', text: taskName, isPulsing: true };
        }

        // State 4: Working-Idle (Assigned but paused due to missing resourcs, etc)
        return { colorClass: 'bg-gi-warning', textClass: 'text-gi-warning', text: `Paused - ${taskName}`, isPulsing: false };
    };

    const statusInfo = getStatusInfo();

    return (
        <div className={cn("flex items-center gap-1.5 text-[9px] uppercase tracking-widest font-bold opacity-80", className)}>
            <div className={cn(
                "w-1.5 h-1.5 rounded-full flex-shrink-0",
                statusInfo.colorClass,
                statusInfo.isPulsing && "animate-pulse shadow-glow"
            )}></div>
            <span className={cn("truncate", statusInfo.textClass)}>
                {statusInfo.text}
            </span>
        </div>
    );
};

export default ActivityModule;
