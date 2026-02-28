import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

const TYPE_CONFIG = {
    success: { icon: '✅', border: 'border-[var(--color-success)]/50', bg: 'bg-[var(--color-success)]/10', text: 'text-[var(--color-success)]' },
    info: { icon: 'ℹ️', border: 'border-[var(--color-accent-primary)]/50', bg: 'bg-[var(--color-accent-primary)]/10', text: 'text-[var(--color-accent-primary)]' },
    warning: { icon: '⚠️', border: 'border-yellow-400/50', bg: 'bg-yellow-400/10', text: 'text-yellow-400' },
    error: { icon: '❌', border: 'border-[var(--color-danger)]/50', bg: 'bg-[var(--color-danger)]/10', text: 'text-[var(--color-danger)]' }
};

/**
 * Toast
 * Visual primitive for a single pop-up notification.
 */
const Toast = ({ id, message, type = 'info', count = 1, onClose }) => {
    const config = TYPE_CONFIG[type] || TYPE_CONFIG.info;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, x: 50, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
            className={`
                relative flex items-center gap-3 p-3 min-w-[250px] max-w-sm
                bg-[#0f111a]/90 backdrop-blur-md rounded-lg shadow-lg border-l-4
                pointer-events-auto
                ${config.border}
            `}
        >
            <span className="text-xl shrink-0">{config.icon}</span>

            <p className="text-sm text-gray-200 flex-1 leading-tight font-medium pb-px">
                {message}
            </p>

            {count > 1 && (
                <motion.span
                    key={count} // Force re-animate on count change
                    initial={{ scale: 1.5, color: '#fff' }}
                    animate={{ scale: 1, color: 'var(--color-text-secondary)' }}
                    className="text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-black/50 text-gray-400"
                >
                    ×{count}
                </motion.span>
            )}

            <button
                onClick={() => onClose(id)}
                className="text-gray-500 hover:text-white transition-colors shrink-0 p-1 -mr-1 rounded-sm hover:bg-white/10"
                aria-label="Close notification"
            >
                <X size={16} />
            </button>

            {/* Subtle glow layer behind the card based on type */}
            <div className={`absolute inset-0 rounded-lg pointer-events-none ${config.bg} opacity-50`} />
        </motion.div>
    );
};

export default Toast;
