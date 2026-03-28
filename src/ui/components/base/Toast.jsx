import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

const TYPE_CONFIG = {
    success: { icon: '✅', border: 'border-[var(--color-success)]/50', bg: 'bg-[var(--color-success)]/10', text: 'text-[var(--color-success)]' },
    info: { icon: 'ℹ️', border: 'border-[var(--color-accent-primary)]/50', bg: 'bg-[var(--color-accent-primary)]/10', text: 'text-[var(--color-accent-primary)]' },
    warning: { icon: '⚠️', border: 'border-yellow-400/50', bg: 'bg-yellow-400/10', text: 'text-yellow-400' },
    error: { icon: '❌', border: 'border-red-500/50', bg: 'bg-red-500/10', text: 'text-red-500' },
    crisis: { icon: '🚨', border: 'border-red-500', bg: 'bg-red-950/90', text: 'text-white' }
};

/**
 * Toast
 * Visual primitive for a single pop-up notification.
 */
const Toast = ({ id, message, type = 'info', count = 1, aggregationKey = null, onClose }) => {
    const config = TYPE_CONFIG[type] || TYPE_CONFIG.info;
    const isLevelUp = aggregationKey?.startsWith('levelup_');

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

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
            className={`
                relative flex items-center gap-3 p-3 min-w-[280px] max-w-sm
                bg-[#0f111a]/95 rounded-lg border-l-4 shadow-xl
                pointer-events-auto backdrop-blur-md
                ${config.border}
                ${type === 'crisis' ? 'animate-[pulse_2s_infinite_ease-in-out] border-2 shadow-[0_0_20px_rgba(239,68,68,0.3)]' : ''}
            `}
        >
            <span className="text-xl shrink-0">{config.icon}</span>

            <p className={`text-sm flex-1 leading-tight pb-px ${type === 'crisis' ? 'font-bold text-white' : 'font-medium text-gray-200'}`}>
                {aggregationKey && !isLevelUp && (
                    <motion.span
                        key={count}
                        initial={{ scale: 1.2, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="font-mono font-bold mr-1.5 text-[var(--color-success)]"
                    >
                        +{count}
                    </motion.span>
                )}
                {formattedMessage}
            </p>

            <button
                onClick={() => onClose(id)}
                className="text-gray-500 hover:text-white transition-colors shrink-0 p-1 -mr-1 rounded-sm hover:bg-white/10"
                aria-label="Close notification"
            >
                <X size={16} />
            </button>

            {/* Subtle glow layer */}
            <div className={`absolute inset-0 rounded-lg pointer-events-none ${config.bg} opacity-20`} />
        </motion.div>
    );
};

export default Toast;
