import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

/**
 * FullScreenDrawer — the shared shell for the overhaul's full-screen
 * views (Phase 4, spec §SYS-01/§PRES-01): slides up to cover the whole
 * play area (the bubble column stays visible beside it), one open at a
 * time. Header carries the icon + title + close; content scrolls.
 */
export const FullScreenDrawer = ({ icon: Icon, title, onClose, children }) => (
    <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="absolute inset-0 z-[120] pointer-events-auto flex flex-col bg-gi-base/95 backdrop-blur-sm"
    >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-gi-primary/30 bg-gi-surface/80">
            <span className="flex items-center gap-2.5 font-display font-bold text-base gi-caps tracking-widest text-gi-text">
                {Icon && <Icon size={18} className="text-gi-primary" />}
                {title}
            </span>
            <button
                onClick={onClose}
                title="Close"
                className="p-1.5 rounded border border-gi-border text-gi-muted hover:text-gi-text hover:border-gi-muted transition-colors"
            >
                <X size={16} />
            </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
            {children}
        </div>
    </motion.div>
);

export default FullScreenDrawer;
