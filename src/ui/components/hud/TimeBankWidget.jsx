import React from 'react';
import { Hourglass, Square } from 'lucide-react';
import { cn } from '../../utils/cn.js';
import { EventBus } from '../../../systems/core/EventBus.js';
import { TimeBankManager } from '../../../systems/core/TimeBankManager.js';
import { TIME_BANK } from '../../../config/loopConstants.js';

/**
 * TimeBankWidget (Phase 8) — HUD control for the offline Time Bank.
 *
 * Shows how much offline time is banked and lets the player spend it by
 * fast-forwarding the live engine at a preset multiplier. Mounted in the
 * global HUD layer (provisional home — the TopBar it originally lived in
 * was retired). Minimal "essentials" UI — a polished treatment can come
 * with the later Time Bank pass.
 */
function formatBank(ms) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

export const TimeBankWidget = React.memo(() => {
    const [bankedMs, setBankedMs] = React.useState(() => TimeBankManager.getBankedMs());
    const [isSpending, setIsSpending] = React.useState(TimeBankManager.isSpending);
    const [multiplier, setMultiplier] = React.useState(TimeBankManager.activeMultiplier);

    React.useEffect(() => {
        const sync = () => {
            setBankedMs(TimeBankManager.getBankedMs());
            setIsSpending(TimeBankManager.isSpending);
            setMultiplier(TimeBankManager.activeMultiplier);
        };
        // time_bank_updated covers accrual + spend ticks; state_changed covers
        // save loads that land before the widget mounts.
        const subBank = EventBus.subscribe('time_bank_updated', sync);
        const subState = EventBus.subscribe('state_changed', sync);
        sync();
        return () => { subBank(); subState(); };
    }, []);

    const empty = bankedMs <= 0;

    return (
        <div
            className="flex items-center gap-2 px-3 py-1 bg-gi-surface border border-gi-border rounded-full mr-2"
            title="Time Bank — offline time you can spend by fast-forwarding the game (max 24h)"
        >
            <Hourglass className={cn('w-4 h-4', empty ? 'text-gi-muted' : 'text-gi-primary')} />
            <span className="text-xs font-bold tracking-wide text-gi-text tabular-nums min-w-[2.75rem]">
                {formatBank(bankedMs)}
            </span>

            {isSpending ? (
                <button
                    onClick={() => TimeBankManager.stopSpending()}
                    title="Stop fast-forward"
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-gi-danger/40 bg-gi-danger/10 hover:bg-gi-danger/20 text-gi-danger text-[10px] font-bold uppercase tracking-wide"
                >
                    <Square className="w-3 h-3" /> {multiplier}x
                </button>
            ) : (
                <div className="flex items-center gap-1">
                    {TIME_BANK.PRESETS.map(m => (
                        <button
                            key={m}
                            disabled={empty}
                            onClick={() => TimeBankManager.startSpending(m)}
                            title={empty ? 'Time bank is empty' : `Fast-forward at ${m}x`}
                            className={cn(
                                'px-1.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wide transition-colors',
                                empty
                                    ? 'border-gi-border opacity-40 cursor-not-allowed text-gi-muted'
                                    : 'border-gi-primary/40 bg-gi-primary/10 hover:bg-gi-primary/20 text-gi-primary'
                            )}
                        >
                            {m}x
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
});

export default TimeBankWidget;
