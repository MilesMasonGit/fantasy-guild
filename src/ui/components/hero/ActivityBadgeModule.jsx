import React from 'react';
import { cn } from '../../utils/cn.js';
import { useEngine } from '../../hooks/useEngine.js';
import { useGameState } from '../../hooks/useGameState.js';

/**
 * ActivityBadgeModule
 * Displays the current working status of the hero (Idle, Working, Wounded, etc).
 * 
 * @param {Object} props
 * @param {Object} props.hero - The hero data object.
 * @param {Object} [props.card=null] - Optional override.
 */
export const ActivityBadgeModule = ({
    hero,
    card: propCard = null,
    className
}) => {
    const engine = useEngine();

    // 1. Resolve Card Data (from prop or engine)
    const card = useGameState(
        (state) => {
            if (propCard) return propCard;
            if (!hero?.assignedCardId) return null;
            // Fetch the assigned card directly from the engine's current state
            return engine.CardManager.getCard(hero.assignedCardId);
        },
        ['cards_updated', 'state_changed'],
        null,
        { deps: [hero?.assignedCardId, propCard] }
    );

    if (!hero) return null;

    // Evaluate the 4 states: Wounded, Idle, Working, Working-Idle
    const getStatusInfo = () => {
        // State 1: Wounded (HP < 25%) - RED
        const hpPercent = hero.hp?.max > 0 ? (hero.hp.current / hero.hp.max) : 1;
        if (hpPercent < 0.25 && !hero.isVillager) {
            return { variant: 'danger', text: 'WOUNDED', isPulsing: true };
        }

        // State 2: Idle (Not assigned) - BLUE
        if (!hero.assignedCardId) {
            return { variant: 'primary', text: 'IDLE', isPulsing: false };
        }

        // State 3 & 4 Require Card Knowledge
        if (!card) {
            return { variant: 'accent', text: 'TRAVELING', isPulsing: false };
        }

        // Clean name (remove [Blueprint] etc)
        const rawName = card.name || 'TASK';
        const taskName = rawName.replace(/\[.*?\]/g, '').trim();

        // State 3: Working (Actively ticking on a card) - GREEN
        if (card.status === 'active' || card.status === 'working') {
            return { variant: 'success', text: taskName.toUpperCase(), isPulsing: true };
        }

        // State 4: Working-Idle (Assigned but paused) - YELLOW
        return { variant: 'warning', text: taskName.toUpperCase(), isPulsing: false };
    };

    const statusInfo = getStatusInfo();

    const pipColorClass = {
        success: 'bg-gi-success',
        warning: 'bg-gi-warning',
        danger: 'bg-gi-danger',
        primary: 'bg-gi-primary',
        accent: 'bg-gi-accent',
        muted: 'bg-gi-border/60'
    }[statusInfo.variant] || 'bg-white/20';

    return (
        <div className={cn("flex justify-start items-center gap-1.5 h-4", className)}>
            {/* Status Pip (Colored Circle) */}
            <div className={cn(
                "w-1 h-1 rounded-full",
                pipColorClass,
                statusInfo.isPulsing && "animate-pulse shadow-[0_0_8px_currentColor]"
            )} style={{ color: `var(--color-gi-${statusInfo.variant})` }} />

            <span className={cn(
                "text-[10px] font-bold uppercase tracking-[0.12em] drop-shadow-sm transition-all duration-300",
                statusInfo.variant === 'danger' ? 'text-gi-danger brightness-125' : 
                statusInfo.variant === 'success' ? 'text-gi-success brightness-125' :
                'text-white/60'
            )}>
                {statusInfo.text}
            </span>
        </div>
    );
};

export default ActivityBadgeModule;
