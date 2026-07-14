import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/ui/utils/cn.js';
import { formatCompact } from '@/utils/Formatters.js';
import { EventBus } from '@/systems/core/EventBus.js';
import { AreaSystem } from '@/systems/area/AreaSystem.js';
import { GameState } from '@/state/GameState.js';

const TYPE_CONFIG = {
    success: { border: 'border-[var(--color-success)]/50', bg: 'bg-[var(--color-success)]/10', text: 'text-[var(--color-success)]' },
    info: { border: 'border-[var(--color-accent-primary)]/50', bg: 'bg-[var(--color-accent-primary)]/10', text: 'text-[var(--color-accent-primary)]' },
    warning: { border: 'border-yellow-400/50', bg: 'bg-yellow-400/10', text: 'text-yellow-400' },
    error: { border: 'border-red-500/50', bg: 'bg-red-500/10', text: 'text-red-500' },
    crisis: { border: 'border-red-500', bg: 'bg-red-950/90', text: 'text-white' }
};

/**
 * Toast
 * Visual primitive for a single pop-up notification.
 */
const Toast = ({ id, message, type = 'info', count = 1, added = 0, removed = 0, rate = 0, isLoss = false, aggregationKey = null, meta = {}, onClose }) => {
    const config = TYPE_CONFIG[type] || TYPE_CONFIG.info;
    const isLevelUp = aggregationKey?.startsWith('levelup_');

    // Track previous counts to determine glow color (Gain vs Loss)
    const prevAddedRef = useRef(added);
    const prevRemovedRef = useRef(removed);
    const isGaining = added > prevAddedRef.current;
    const isLosing = removed > prevRemovedRef.current;

    // Default to success green unless we explicitly detected a loss update
    const glowColor = isLosing ? 'rgba(239, 68, 68, 0.5)' : 'rgba(34, 197, 94, 0.5)';
    const glowBorder = isLosing ? 'border-red-500/30' : 'border-gi-success/30';

    useEffect(() => {
        prevAddedRef.current = added;
        prevRemovedRef.current = removed;
    });

    // Multi-stage formatting: Highlight "Level up!" in gold and "X > Y" in green
    const formattedMessage = message.split(/(Level up!|\d+ > \d+)/).map((part, i) => {
        if (part === 'Level up!') {
            return <span key={i} className="text-yellow-400 font-bold">Level up!</span>;
        }
        if (/\d+ > \d+/.test(part)) {
            return <span key={i} className="text-[var(--color-success)] font-mono font-bold">{part}</span>;
        }
        return part;
    });

    const handleNotificationClick = () => {
        if (aggregationKey === 'invasion_alert' && meta?.areaId) {
            const areaId = meta.areaId;
            if (GameState.state?.ui?.activeAreaId !== areaId) {
                AreaSystem.switchArea(areaId);
            }
            
            // Allow state to switch, then query for the card
            setTimeout(() => {
                const activeInvasionCard = GameState.state?.cards?.active?.find(
                    card => card.cardType === 'invasion' && card.areaId === areaId
                );
                
                if (activeInvasionCard && activeInvasionCard.position) {
                    EventBus.publish('focus_camera', {
                        x: activeInvasionCard.position.x,
                        y: activeInvasionCard.position.y
                    });
                }
            }, 50);
        }
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
            onClick={handleNotificationClick}
            className={`
                relative flex items-center gap-2 rounded-md border border-white/10 shadow-xl
                pointer-events-auto backdrop-blur-md transition-all duration-200
                ${aggregationKey === 'invasion_alert'
                    ? 'p-4 min-w-[360px] max-w-md bg-[#160d14]/95 border-red-500 border-2 shadow-[0_0_25px_rgba(239,68,68,0.25)] hover:border-red-500 hover:scale-[1.02] cursor-pointer animate-[toast-pulse_2s_infinite_ease-in-out]'
                    : 'px-2.5 py-1 min-w-[220px] max-w-sm bg-[#0f111a]/95'
                }
                ${type === 'crisis' && aggregationKey !== 'invasion_alert' ? 'animate-[toast-pulse_2s_infinite_ease-in-out] border-red-500 border-2 shadow-[0_0_20px_rgba(239,68,68,0.3)]' : ''}
            `}
        >

            <div className={cn(
                "text-xs flex-1 leading-tight pb-px flex gap-x-2",
                aggregationKey === 'invasion_alert' ? 'items-start flex-col gap-y-1' : 'items-baseline',
                type === 'crisis' ? 'font-bold text-white' : 'font-medium text-gray-200'
            )}>
                {aggregationKey && !isLevelUp && aggregationKey !== 'invasion_alert' && (
                    <div className="flex gap-x-1.5 shrink-0 select-none">
                        {added > 0 && (
                            <motion.span
                                key={`added-${added}`}
                                initial={{ scale: 1.2, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="font-mono font-bold text-[var(--color-success)]"
                            >
                                +{added}
                            </motion.span>
                        )}
                        {removed > 0 && (
                            <motion.span
                                key={`removed-${removed}`}
                                initial={{ scale: 1.2, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="font-mono font-bold text-red-400"
                            >
                                -{removed}
                            </motion.span>
                        )}
                    </div>
                )}
                
                <span className={cn(aggregationKey === 'invasion_alert' ? 'whitespace-pre-line break-words' : 'truncate')}>
                    {formattedMessage}
                </span>

                {rate !== 0 && (
                    <span className="text-[10px] font-mono text-gray-400 select-none tabular-nums shrink-0">
                        ({Math.abs(rate) < 1000 ? Math.floor(rate) : formatCompact(rate, 1)}/hr)
                    </span>
                )}
            </div>

            {aggregationKey !== 'invasion_alert' && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onClose(id);
                    }}
                    className="text-gray-500 hover:text-white transition-colors shrink-0 p-0.5 -mr-1 rounded-sm hover:bg-white/10"
                    aria-label="Close notification"
                >
                    <X size={13} />
                </button>
            )}

            {/* Dynamic Outward Glow for aggregated gains/losses */}
            {(added > 1 || removed > 0) && (
                <motion.div
                    key={`glow-${id}-${added}-${removed}`}
                    initial={{ opacity: 0, boxShadow: `0 0 0px ${isLosing ? 'rgba(239, 68, 68, 0)' : 'rgba(34, 197, 94, 0)'}` }}
                    animate={{ 
                        opacity: [0, 1, 0],
                        boxShadow: [
                            `0 0 0px ${isLosing ? 'rgba(239, 68, 68, 0)' : 'rgba(34, 197, 94, 0)'}`,
                            `0 0 15px ${glowColor}`,
                            `0 0 0px ${isLosing ? 'rgba(239, 68, 68, 0)' : 'rgba(34, 197, 94, 0)'}`
                        ]
                    }}
                    transition={{ duration: 0.6, ease: "easeInOut" }}
                    className={cn("absolute inset-0 rounded-md border pointer-events-none z-[-1]", glowBorder)}
                />
            )}

            {/* Subtle glow layer (stationary) */}
            <div className={`absolute inset-0 rounded-md pointer-events-none ${config.bg} opacity-20 z-[-1]`} />
        </motion.div>
    );
};

export default Toast;
