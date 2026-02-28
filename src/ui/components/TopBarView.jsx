import React from 'react';
import { useGameState } from '../hooks/useGameState.js';
import { Coins, Crown, Flame, Settings } from 'lucide-react';
import { cn } from '../utils/cn.js';
import GIButton from './base/GIButton.jsx';

/**
 * TopBarView: The horizontal HUD that displays global resources and game time.
 * Reactively subscribes to specific slices of GameState to avoid over-rendering.
 */
export const TopBarView = ({ onSettingsClick }) => {
    // We use granular selectors to only re-render when these specific values change
    const gold = useGameState(state => state.currency?.gold || 0);
    const influence = useGameState(state => state.currency?.influence || 0);
    const activeInvasions = useGameState(state => state.threats?.activeInvasions?.length || 0);
    const isPaused = useGameState(state => state.time?.isPaused || false);

    return (
        <div className="sticky top-0 z-[100] w-full bg-gi-surface/80 backdrop-blur-md border-b border-gi-border shadow-lg">
            <div className="w-full flex items-center justify-between px-6 py-2">

                {/* Left: Branding & Status */}
                <div className="flex items-center gap-6">
                    <h1 className="font-display font-bold text-xl tracking-wider text-gi-text text-shadow-neon">
                        FANTASY GUILD
                    </h1>
                    {isPaused && (
                        <span className="text-xs font-bold text-gi-danger bg-gi-danger/10 px-2 py-1 rounded tracking-widest uppercase">
                            Paused
                        </span>
                    )}
                </div>

                {/* Center: Resources HUD */}
                <div className="flex items-center gap-8">
                    {/* Gold Resource */}
                    <div className="flex items-center gap-2" title="Guild Treasury (Gold)">
                        <div className="p-1.5 bg-yellow-500/20 rounded-full border border-yellow-500/30">
                            <Coins className="w-4 h-4 text-yellow-400" />
                        </div>
                        <span className="font-display font-bold tracking-wide text-gi-text">
                            {gold.toLocaleString()}
                        </span>
                    </div>

                    {/* Influence/Renown Resource */}
                    <div className="flex items-center gap-2" title="Guild Influence">
                        <div className="p-1.5 bg-gi-primary/20 rounded-full border border-gi-primary/30">
                            <Crown className="w-4 h-4 text-gi-primary" />
                        </div>
                        <span className="font-display font-bold tracking-wide text-gi-text">
                            {influence.toLocaleString()}
                        </span>
                    </div>

                    {/* Threat Indicator */}
                    <div className={cn(
                        "flex items-center gap-2 transition-opacity",
                        activeInvasions > 0 ? "opacity-100" : "opacity-30"
                    )} title="Active Threats">
                        <div className="p-1.5 bg-gi-danger/20 rounded-full border border-gi-danger/30">
                            <Flame className={cn("w-4 h-4 text-gi-danger", activeInvasions > 0 && "animate-pulse")} />
                        </div>
                        <span className={cn(
                            "font-display font-bold tracking-wide",
                            activeInvasions > 0 ? "text-gi-danger text-shadow-neon" : "text-gi-muted"
                        )}>
                            {activeInvasions}
                        </span>
                    </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-4">
                    <GIButton
                        variant="ghost"
                        onClick={onSettingsClick}
                        className="p-2 aspect-square rounded-full border border-transparent hover:border-gi-border"
                    >
                        <Settings className="w-5 h-5 text-gi-muted hover:text-gi-text transition-colors" />
                    </GIButton>
                </div>
            </div>
        </div>
    );
};

export default TopBarView;
