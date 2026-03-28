import React from 'react';
import { useEngine } from '../hooks/useEngine.js';
import { useGameState } from '../hooks/useGameState.js';
import { cn } from '../utils/cn.js';
import { motion, AnimatePresence } from 'framer-motion';
import { getAllAreaSets, getAreaSet, getPackCost } from '../../config/registries/areaSetRegistry.js';
import GISurface from './base/GISurface.jsx';
import Button from './base/Button.jsx';
import { X, Map, Lock, Check, ShoppingBag } from 'lucide-react';

/**
 * WorldMapDrawer: Pull-up drawer showing Area Sets, Map Fragment progress,
 * and the Market for buying packs.
 */
const WorldMapDrawer = ({ isOpen, onClose }) => {
    const engine = useEngine();
    const unlockedAreas = useGameState(
        state => state.collection?.unlockedAreaSets || [],
        ['state_changed', 'deck_updated']
    );
    const mapFragments = useGameState(
        state => state.mapFragments || {},
        ['state_changed', 'map_fragment_found']
    );
    const packsBought = useGameState(
        state => state.collection?.packsBought || {},
        ['state_changed', 'pack_purchased']
    );
    const activeAreaId = useGameState(
        state => state.ui?.activeAreaId || 'guild_hall_v1',
        ['area_switched']
    );
    const gold = useGameState(state => state.currency?.gold || 0);

    const areaSetsObj = getAllAreaSets();
    const areaSets = Object.values(areaSetsObj);

    const handleBuyPack = (areaSetId) => {
        const result = engine.PackSystem.buyPack(areaSetId);
        if (!result.success) {
            console.warn('[WorldMap] Buy pack failed:', result.error);
        }
    };

    const handleSelectArea = (areaSetId) => {
        if (areaSetId === activeAreaId) return;  // Already there
        engine.AreaSystem.switchArea(areaSetId);
        onClose();  // Dismiss the drawer after switching
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    className="fixed bottom-0 left-0 right-0 z-[200] pointer-events-auto"
                >
                    <GISurface
                        className="w-full max-h-[60vh] overflow-y-auto rounded-t-2xl border-t border-x border-gi-border"
                        blur={true}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-gi-border/50 bg-gi-surface/50">
                            <div className="flex items-center gap-3">
                                <Map className="w-5 h-5 text-gi-primary" />
                                <h2 className="font-display font-bold text-lg text-gi-text tracking-wide">
                                    WORLD MAP
                                </h2>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-1.5 rounded-md text-gi-muted hover:text-gi-danger hover:bg-gi-danger/10 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Area Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 p-6">
                            {areaSets.map(areaSet => {
                                const isUnlocked = unlockedAreas.includes(areaSet.id);
                                const fragments = mapFragments[areaSet.id] || 0;
                                const totalFragments = areaSet.totalFragments || 1;
                                const isComplete = fragments >= totalFragments;
                                const progress = Math.min(1, fragments / totalFragments);
                                const cost = getPackCost(areaSet.id, packsBought[areaSet.id] || 0);
                                const canAfford = gold >= cost;

                                return (
                                    <motion.div
                                        key={areaSet.id}
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: 0.05 }}
                                    >
                                        <GISurface
                                            className={cn(
                                                "flex flex-col items-center p-4 rounded-xl relative overflow-hidden",
                                                "border transition-all duration-300",
                                                isUnlocked
                                                    ? areaSet.id === activeAreaId
                                                        ? "border-gi-primary ring-2 ring-gi-primary/30 cursor-default"  // Active highlight
                                                        : "border-gi-border hover:border-gi-primary/50 cursor-pointer"
                                                    : "border-gi-border/30 opacity-60 cursor-not-allowed"
                                            )}
                                            onClick={() => isUnlocked && handleSelectArea(areaSet.id)}
                                        >
                                            {/* Active Area Badge */}
                                            {isUnlocked && areaSet.id === activeAreaId && (
                                                <div className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded-full
                                                                bg-gi-primary/20 border border-gi-primary/40
                                                                text-[10px] font-bold font-display text-gi-primary
                                                                tracking-widest uppercase">
                                                    Active
                                                </div>
                                            )}
                                            {/* Area Icon / Art placeholder */}
                                            <div className={cn(
                                                "w-16 h-16 rounded-lg flex items-center justify-center text-3xl mb-3",
                                                "border transition-all",
                                                isUnlocked
                                                    ? "bg-gi-surface-hover border-gi-border"
                                                    : "bg-gi-base/50 border-gi-border/20"
                                            )}>
                                                {isUnlocked ? (
                                                    <span>{areaSet.icon || '🗺️'}</span>
                                                ) : (
                                                    <Lock className="w-6 h-6 text-gi-muted" />
                                                )}
                                            </div>

                                            {/* Area Name */}
                                            <div className="text-sm font-bold font-display text-gi-text text-center tracking-wide">
                                                {isUnlocked ? areaSet.name : '???'}
                                            </div>

                                            {/* Fragment Progress */}
                                            <div className="w-full mt-2">
                                                {isComplete ? (
                                                    <div className="flex items-center justify-center gap-1 text-xs text-emerald-400 font-display">
                                                        <Check className="w-3 h-3" />
                                                        <span>COMPLETE</span>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="w-full h-1.5 bg-gi-base rounded-full overflow-hidden">
                                                            <motion.div
                                                                className="h-full bg-gi-primary rounded-full"
                                                                initial={{ width: 0 }}
                                                                animate={{ width: `${progress * 100}%` }}
                                                                transition={{ duration: 0.5 }}
                                                            />
                                                        </div>
                                                        <div className="text-xs text-gi-muted text-center mt-1 font-display">
                                                            {fragments}/{totalFragments}
                                                        </div>
                                                    </>
                                                )}
                                            </div>

                                            {/* Market: Buy Pack Button (only for unlocked areas) */}
                                            {isUnlocked && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleBuyPack(areaSet.id);
                                                    }}
                                                    disabled={!canAfford}
                                                    className={cn(
                                                        "mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg",
                                                        "text-xs font-bold font-display tracking-wide transition-all",
                                                        "border",
                                                        canAfford
                                                            ? "bg-yellow-500/20 border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/30 hover:scale-105 cursor-pointer"
                                                            : "bg-gi-base/50 border-gi-border/30 text-gi-muted cursor-not-allowed opacity-50"
                                                    )}
                                                >
                                                    <ShoppingBag className="w-3 h-3" />
                                                    <span>{cost}g</span>
                                                </button>
                                            )}
                                        </GISurface>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </GISurface>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default WorldMapDrawer;
