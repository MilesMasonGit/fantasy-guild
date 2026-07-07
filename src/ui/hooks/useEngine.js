import { useContext } from 'react';
import { EngineContext } from '../context/EngineContext';

/**
 * Convenience hook to access the game engine managers directly.
 * DO NOT use this to read state for rendering (use useGameState instead).
 * Use this ONLY to call mutative methods (e.g., engine.HeroManager.assignHero).
 */
export const useEngine = () => {
    const engine = useContext(EngineContext);
    if (!engine) {
        throw new Error('useEngine must be used within an EngineProvider');
    }
    return engine;
};
