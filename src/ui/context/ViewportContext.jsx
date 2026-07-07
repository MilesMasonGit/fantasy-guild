import React, { createContext, useContext, useMemo } from 'react';
import { useMotionValue } from 'framer-motion';

/**
 * ViewportContext
 * Provides shared high-frequency motion values for the playmat and UI.
 * This allows the Dnd system to know the current zoom/pan of the viewport
 * without triggering React re-renders for every pixel of movement.
 */
const ViewportContext = createContext(null);

export const ViewportProvider = ({ children }) => {
    // Shared Motion Values (Instant, bypass React render loop)
    const targetX = useMotionValue(0);
    const targetY = useMotionValue(0);
    const targetScale = useMotionValue(1);

    const value = useMemo(() => ({
        targetX,
        targetY,
        targetScale
    }), [targetX, targetY, targetScale]);

    return (
        <ViewportContext.Provider value={value}>
            {children}
        </ViewportContext.Provider>
    );
};

export const useViewport = () => {
    const context = useContext(ViewportContext);
    if (!context) {
        throw new Error('useViewport must be used within a ViewportProvider');
    }
    return context;
};
