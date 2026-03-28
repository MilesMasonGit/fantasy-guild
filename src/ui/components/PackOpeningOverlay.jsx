import React from 'react';
import { cn } from '../utils/cn.js';
import { motion, AnimatePresence } from 'framer-motion';
import { getCard } from '../../config/registries/cardRegistry.js';
import GISurface from './base/GISurface.jsx';
import Button from './base/Button.jsx';
import { Sparkles, Star, ArrowRight } from 'lucide-react';

/**
 * PackOpeningOverlay: Fullscreen animated overlay showing 3 cards from a pack.
 * Displays NEW! badges, playset counters, mastery effects, and duplicate info.
 */
const PackOpeningOverlay = ({ results, onClose }) => {
    if (!results || results.length === 0) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[350] flex flex-col items-center justify-center pointer-events-auto"
            >
                {/* Backdrop */}
                <div className="absolute inset-0 bg-black/85" onClick={onClose} />

                {/* Content */}
                <motion.div
                    className="relative z-10 flex flex-col items-center gap-6 p-8"
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                >
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-2">
                        <Sparkles className="w-6 h-6 text-yellow-400 animate-pulse" />
                        <h2 className="font-display font-bold text-2xl text-gi-text tracking-widest uppercase">
                            Pack Opened!
                        </h2>
                        <Sparkles className="w-6 h-6 text-yellow-400 animate-pulse" />
                    </div>

                    {/* Cards Row */}
                    <motion.div
                        className="flex gap-6"
                        variants={{
                            show: { transition: { staggerChildren: 0.15 } }
                        }}
                        initial="hidden"
                        animate="show"
                    >
                        {results.map((result, index) => (
                            <PackCard key={index} result={result} index={index} />
                        ))}
                    </motion.div>

                    {/* Close Button */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                    >
                        <Button
                            onClick={onClose}
                            className="mt-4 px-8 py-2 bg-gi-primary/20 border border-gi-primary/40 text-gi-primary hover:bg-gi-primary/30 font-display tracking-wide"
                        >
                            Continue
                        </Button>
                    </motion.div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

/**
 * Individual card reveal in the pack opening.
 */
const PackCard = ({ result, index }) => {
    const template = result.cardId ? getCard(result.cardId) : null;

    return (
        <motion.div
            variants={{
                hidden: { opacity: 0, y: 60, rotateY: 90, scale: 0.8 },
                show: { opacity: 1, y: 0, rotateY: 0, scale: 1 }
            }}
            transition={{ type: 'spring', stiffness: 200, damping: 18 }}
            className="relative"
        >
            <GISurface
                className={cn(
                    "w-44 min-h-60 flex flex-col items-center justify-center p-4 relative overflow-hidden",
                    "border rounded-xl transition-all",
                    result.isMastery
                        ? "border-yellow-500/60"
                        : result.isNew
                            ? "border-gi-primary/50"
                            : "border-gi-border"
                )}
                blur={true}
            >
                {/* NEW badge */}
                {result.isNew && !result.isDuplicate && (
                    <div className="absolute top-2 left-2 z-20 px-2 py-0.5 rounded-full text-xs font-bold font-display bg-gi-primary/30 text-gi-primary border border-gi-primary/40">
                        NEW!
                    </div>
                )}

                {/* Mastery badge */}
                {result.isMastery && (
                    <div className="absolute top-2 left-2 z-20 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold font-display bg-yellow-500/30 text-yellow-400 border border-yellow-500/40">
                        <Star className="w-3 h-3" />
                        MASTERY
                    </div>
                )}

                {/* Card icon */}
                <div className="text-4xl mb-3">
                    {template?.icon || '📜'}
                </div>

                {/* Card name */}
                <div className="text-sm font-bold font-display text-gi-text text-center tracking-wide">
                    {template?.name || result.cardId || 'Unknown'}
                </div>

                {/* Card type */}
                <div className="text-xs text-gi-muted font-display uppercase tracking-widest mt-1">
                    {template?.cardType || 'card'}
                </div>

                {/* Playset counter */}
                {!result.isDuplicate && (
                    <div className="mt-3 flex items-center gap-1 text-xs font-display text-gi-muted">
                        <span className={cn(
                            result.isMastery ? "text-yellow-400" : "text-gi-primary"
                        )}>
                            {result.playsetCount}
                        </span>
                        <span>/</span>
                        <span>{result.maxCopies}</span>
                    </div>
                )}

                {/* Duplicate replacement indicator */}
                {result.isDuplicate && (
                    <div className="mt-3 flex flex-col items-center gap-1">
                        <ArrowRight className="w-4 h-4 text-gi-warning" />
                        <div className="text-xs font-display font-bold text-gi-warning tracking-wide uppercase">
                            → {result.replacement}
                        </div>
                        <div className="text-xs text-gi-muted italic">
                            (Duplicate)
                        </div>
                    </div>
                )}
            </GISurface>
        </motion.div>
    );
};

export default PackOpeningOverlay;
