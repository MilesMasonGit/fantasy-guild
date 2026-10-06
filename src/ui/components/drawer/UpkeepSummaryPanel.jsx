import { useEffect, useState } from 'react';
import { EventBus } from '../../../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import { computeUpkeepSummary, formatRate, formatRunsOut } from '../../../systems/board/UpkeepSummary.js';
import { cn } from '../../utils/cn.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';

/** Events after which the summary is worked out again (the top bar's Upkeep badge hears these too, B2.2). */
export const REFRESH_EVENTS = [ENGINE_EVENTS.INVENTORY_UPDATED, BOARD_EVENTS.TILE_CHANGED, BOARD_EVENTS.TOKEN_DEPLETED];
/** Spawner clocks and statement lapses move without an event; a slow poll catches them. */
export const POLL_MS = 2000;

const STATE_TEXT = { at_cap: 'at its cap', no_room: 'no room to spawn' };

/**
 * The Upkeep Summary (Token Lifecycle slice 8.2, TL-4): every ongoing cost per
 * item per minute, what the Bank holds, a rough runs-out, and who is waiting
 * unpaid, plus the trickle's income. Plain and functional — restyled by the
 * Token UI rework later. The maths lives in `systems/board/UpkeepSummary.js`.
 *
 * Shown in the hover popover of the mat's top-bar Upkeep badge (B2.2, FB-29);
 * it used to fill the Bank drawer behind a toggle. `className` sizes it for
 * its host (the popover gives it a max height, so it scrolls on its own).
 *
 * @param {{ className?: string }} props
 */
export const UpkeepSummaryPanel = ({ className = 'h-full' } = {}) => {
    const [summary, setSummary] = useState(() => computeUpkeepSummary());

    useEffect(() => {
        const refresh = () => setSummary(computeUpkeepSummary());
        const unsubs = REFRESH_EVENTS.map(e => EventBus.subscribe(e, refresh));
        const timer = setInterval(refresh, POLL_MS);
        return () => { unsubs.forEach(u => u()); clearInterval(timer); };
    }, []);

    const { items, idle, income } = summary;
    const nothing = !items.length && !idle.length && !income.length;

    return (
        <div data-testid="upkeep-summary" className={cn('overflow-y-auto custom-scrollbar p-3 flex flex-col gap-4 text-xs text-gi-text', className)}>
            {nothing && (
                <div className="text-gi-muted italic">Nothing on the mat costs upkeep or pays income.</div>
            )}

            {items.length > 0 && (
                <section className="flex flex-col gap-2">
                    <h4 className="text-[11px] font-bold uppercase tracking-wide text-gi-muted">Ongoing costs</h4>
                    {items.map(row => (
                        <div
                            key={row.itemId}
                            data-item-id={row.itemId}
                            className={cn(
                                'rounded border px-3 py-2 flex flex-col gap-1',
                                row.waiting.length ? 'border-gi-danger/50 bg-gi-danger/10' : 'border-gi-border bg-gi-base/60'
                            )}
                        >
                            <div className="flex items-center justify-between gap-2 font-bold">
                                <span>{row.name}{row.waiting.length > 0 && <span className="text-gi-danger"> — needed</span>}</span>
                                <span className="tabular-nums">{formatRate(row.perMinute)} / min</span>
                            </div>
                            <div className="flex flex-wrap gap-x-4 text-gi-muted tabular-nums">
                                <span>Bank: <b className="text-gi-text">{row.bank}</b></span>
                                {row.onMat > 0 && <span>On the mat: <b className="text-gi-text">{row.onMat}</b></span>}
                                {row.incomePerMinute > 0 && <span>Trickle: +{formatRate(row.incomePerMinute)} / min</span>}
                                <span>Runs out: <b className="text-gi-text">{formatRunsOut(row.runsOutMs)}</b></span>
                            </div>
                            <div className="text-gi-muted">
                                Used by: {row.consumers.map(c => `${c.name} (${formatRate(c.perMinute)}/min${c.source === 'rule' ? ', rule' : ''})`).join(', ')}
                            </div>
                            {row.waiting.length > 0 && (
                                <div className="text-gi-danger">
                                    Waiting unpaid: {row.waiting.map(w => w.name).join(', ')}
                                </div>
                            )}
                        </div>
                    ))}
                </section>
            )}

            {income.length > 0 && (
                <section className="flex flex-col gap-1">
                    <h4 className="text-[11px] font-bold uppercase tracking-wide text-gi-muted">Trickle income</h4>
                    {income.map(row => (
                        <div key={row.itemId} data-income-item-id={row.itemId} className="flex justify-between gap-2 px-3 py-1 rounded border border-gi-border bg-gi-base/60">
                            <span>{row.name} <span className="text-gi-muted">from {row.sources.map(s => s.name).join(', ')}</span></span>
                            <span className="tabular-nums font-bold">+{formatRate(row.perMinute)} / min</span>
                        </div>
                    ))}
                </section>
            )}

            {idle.length > 0 && (
                <section className="flex flex-col gap-1">
                    <h4 className="text-[11px] font-bold uppercase tracking-wide text-gi-muted">Idle spawners (paying nothing)</h4>
                    {idle.map(s => (
                        <div key={s.instanceId} className="px-3 py-1 rounded border border-gi-border/60 text-gi-muted">
                            {s.name}: {STATE_TEXT[s.state] || s.state} ({s.familyLabel} {s.count} / {s.cap})
                        </div>
                    ))}
                </section>
            )}
        </div>
    );
};

export default UpkeepSummaryPanel;
