import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEngine } from '../hooks/useEngine.js';
import { getAreaSet } from '../../config/registries/areaSetRegistry.js';
import { Sparkles, MapPin } from 'lucide-react';

/**
 * AreaUnlockOverlay
 * A high-fidelity, immersive experience for area discovery.
 * Features a B&W-to-Color transition with a "Shine" effect.
 */
export const AreaUnlockOverlay = () => {
    const engine = useEngine();
    const [unlockedArea, setUnlockedArea] = useState(null);
    const [stage, setStage] = useState('bw'); // 'bw' -> 'flash' -> 'color'

    useEffect(() => {
        const unsubscribe = engine.EventBus.subscribe('ui:open_area_unlock_overlay', ({ areaId }) => {
            const areaDef = getAreaSet(areaId);
            if (areaDef) {
                setUnlockedArea(areaDef);
                setStage('bw');
                
                // Sequence the animation
                setTimeout(() => setStage('flash'), 1000);
                setTimeout(() => setStage('color'), 1100);
            }
        });

        return () => unsubscribe();
    }, [engine]);

    const handleClose = () => {
        setUnlockedArea(null);
        setStage('bw');
    };

    if (!unlockedArea) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/90 backdrop-blur-md overflow-hidden pointer-events-auto"
            >
                {/* 1. Background Art Layer */}
                <div className="absolute inset-0 flex items-center justify-center opacity-60">
                    <motion.div
                        initial={{ scale: 1.2, filter: 'grayscale(1) brightness(0.4)' }}
                        animate={{ 
                            scale: 1,
                            filter: stage === 'color' ? 'grayscale(0) brightness(1)' : 'grayscale(1) brightness(0.4)',
                        }}
                        transition={{ duration: 2, ease: "easeOut" }}
                        className="w-full h-full bg-center bg-cover"
                        style={{ 
                            backgroundImage: `url('/assets/previews/${unlockedArea.areaArt || 'bg_world_map'}.png')` 
                        }}
                    />
                </div>

                {/* 2. Shine / Flash Layer */}
                <AnimatePresence>
                    {stage === 'flash' && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 2 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-white z-10 mix-blend-overlay"
                        />
                    )}
                </AnimatePresence>

                {/* 3. Text Content Container */}
                <div className="relative z-20 flex flex-col items-center gap-8 px-6 text-center max-w-2xl">
                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="flex flex-col items-center"
                    >
                        <div className="w-20 h-20 mb-4 bg-yellow-500/20 rounded-full flex items-center justify-center border border-yellow-500/40 shadow-[0_0_30px_rgba(234,179,8,0.2)]">
                            <Sparkles className="text-yellow-400 w-10 h-10 animate-pulse" />
                        </div>
                        <h4 className="font-pixel text-yellow-500/80 uppercase tracking-[0.3em] text-sm mb-2">New Region Discovered</h4>
                        <h1 className="font-silkscreen text-5xl md:text-7xl text-white gi-text-outline tracking-tighter uppercase leading-none">
                            {unlockedArea.name}
                        </h1>
                    </motion.div>

                    <motion.div
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ delay: 0.8, duration: 1 }}
                        className="h-1 w-full bg-gradient-to-r from-transparent via-yellow-500/50 to-transparent"
                    />

                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1.5 }}
                        className="font-pixel text-gray-300 text-lg leading-relaxed max-w-lg"
                    >
                        Your guild's map fragments have revealed the way to the <span className="text-white font-bold">{unlockedArea.name}</span>. 
                        New resources and challenges await in this uncharted territory.
                    </motion.p>

                    <motion.button
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 2.2 }}
                        onClick={handleClose}
                        className="mt-6 px-12 py-4 bg-white text-black font-silkscreen text-sm uppercase tracking-[0.2em] hover:bg-yellow-400 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.2)] group"
                    >
                        Begin Exploration
                    </motion.button>
                </div>

                {/* 4. Ambient Sparkles */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    {[...Array(20)].map((_, i) => (
                        <motion.div
                            key={i}
                            initial={{ 
                                opacity: 0, 
                                x: Math.random() * 100 + '%', 
                                y: Math.random() * 100 + '%' 
                            }}
                            animate={{ 
                                opacity: [0, 0.5, 0],
                                scale: [1, 1.5, 1],
                            }}
                            transition={{ 
                                duration: 2 + Math.random() * 3, 
                                repeat: Infinity,
                                delay: Math.random() * 2
                            }}
                            className="absolute w-1 h-1 bg-white rounded-full"
                        />
                    ))}
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default AreaUnlockOverlay;
