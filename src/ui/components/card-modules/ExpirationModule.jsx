import React from 'react';
import ProgressBar from '../base/ProgressBar.jsx';
import { Timer } from 'lucide-react';

/**
 * ExpirationModule - Displays a countdown progress bar for timed events.
 */
const ExpirationModule = React.memo(({ trait, card }) => {
    const timeRemaining = card.timeRemainingMs || 0;
    const totalDuration = trait.durationMs || 300000;
    const progress = Math.max(0, Math.min(100, (timeRemaining / totalDuration) * 100));

    // Color based on time left
    const color = progress < 25 ? 'danger' : progress < 50 ? 'warning' : 'primary';

    return (
        <div className="w-full mt-2 mb-1 px-1">
            <div className="flex items-center justify-between text-[10px] text-gi-muted uppercase tracking-tighter mb-1 font-bold font-mono">
                <div className="flex items-center gap-1">
                    <Timer size={10} className="text-gi-primary animate-pulse" />
                    <span>Time Remaining</span>
                </div>
                <span className="text-gi-base-content">{Math.ceil(timeRemaining / 1000)}s</span>
            </div>
            <ProgressBar 
                current={progress} 
                color={color} 
                size="xs"
                showGlow={progress > 0}
            />
        </div>
    );
});

export default ExpirationModule;
