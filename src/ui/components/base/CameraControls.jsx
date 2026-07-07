import React, { useState } from 'react';
import { Minus, Plus, Home } from 'lucide-react';
import { motion, useMotionValueEvent } from 'framer-motion';
import { cn } from '../../utils/cn.js';

/**
 * CameraControls - Floating UI for manual zoom and recentering.
 */
const CameraControls = ({ onZoomIn, onZoomOut, onRecenter, scale }) => {
    const [displayScale, setDisplayScale] = useState(1);
    const lastUpdate = React.useRef(0);

    useMotionValueEvent(scale, "change", (latest) => {
        const now = performance.now();
        // Throttle to ~60fps (16ms) to prevent React from choking on 165Hz updates
        // This stops the UI controls from re-rendering and re-blurring on every single frame.
        if (now - lastUpdate.current > 16) {
            setDisplayScale(latest);
            lastUpdate.current = now;
        }
    });

    const zoomPercent = Math.round(displayScale * 100);

    return (
        <div className="absolute top-6 left-6 z-[100] flex flex-col gap-2 items-center">
            {/* Zoom Controls */}
            <div className="flex flex-col gap-1 bg-black/60 border border-white/20 rounded-lg p-1 shadow-lg">
                <button
                    onClick={onZoomIn}
                    className="w-10 h-10 rounded-md text-white flex items-center justify-center hover:bg-gi-primary/40 transition-all active:scale-95 group"
                    title="Zoom In"
                >
                    <Plus className="w-5 h-5 group-hover:text-gi-primary transition-colors" />
                </button>

                <div className="h-px bg-white/10 mx-2" />

                <button
                    onClick={onZoomOut}
                    className="w-10 h-10 rounded-md text-white flex items-center justify-center hover:bg-gi-primary/40 transition-all active:scale-95 group"
                    title="Zoom Out"
                >
                    <Minus className="w-5 h-5 group-hover:text-gi-primary transition-colors" />
                </button>
            </div>

            {/* Zoom Percentage Bubble */}
            <div className="px-3 py-1 bg-black/60 border border-white/20 rounded-full shadow-lg">
                <span className="text-[11px] font-bold font-mono text-white/80 tabular-nums">
                    {zoomPercent}%
                </span>
            </div>

            {/* Recenter Button */}
            <button
                onClick={onRecenter}
                className="w-10 h-10 rounded-lg bg-black/60 border border-white/20 text-white flex items-center justify-center hover:bg-gi-primary/40 transition-all active:scale-95 shadow-lg group"
                title="Recenter"
            >
                <Home className="w-5 h-5 group-hover:text-gi-primary transition-colors" />
            </button>
        </div>
    );
};

export default React.memo(CameraControls);
