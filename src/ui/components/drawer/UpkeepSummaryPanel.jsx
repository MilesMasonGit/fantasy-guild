import { useEffect, useState } from 'react';
import { EventBus, UI_LISTENER } from '../../../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import { computeUpkeepSummary, formatRate, formatRunsOut } from '../../../systems/board/UpkeepSummary.js';
import { cn } from '../../utils/cn.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';
import { EntityRibbon } from '../base/EntityRibbon.jsx';

/**
 * Events after which the summary is worked out again (the top bar's Upkeep badge hears these
 * too).
 */
export const REFRESH_EVENTS = [ENGINE_EVENTS.INVENTORY_UPDATED, BOARD_EVENTS.TILE_CHANGED, BOARD_EVENTS.TOKEN_DEPLETED];
/** Spawner clocks and statement lapses move without an event; a slow poll catches them. */
export const POLL_MS = 2000;

/**
 * The Upkeep Summary: only what consumes. One item bar per item with its items per minute, and
 * under it what the Bank and the mat hold, a rough runs-out, who uses it and who is waiting
 * unpaid. No Passive Production, no idle spawners (the Token Summary shows those). Rows are not
 * boxed. The maths lives in `systems/board/UpkeepSummary.js`.
 * Shown in the hover popover of the mat's top-bar Upkeep badge. `className` sizes it for its
 * host (the popover gives it a max height, so it scrolls on its own).
 * @param {{ className?: string }} props
 */
export const UpkeepSummaryPanel = ({ className = 'h-full' } = {}) => {
    const [summary, setSummary] = useState(() => computeUpkeepSummary());

    useEffect(() => {
        const refresh = () => setSummary(computeUpkeepSummary());
        const unsubs = REFRESH_EVENTS.map(e => EventBus.subscribe(e, refresh, UI_LISTENER));
        const timer = setInterval(refresh, POLL_MS);
        return () => { unsubs.forEach(u => u()); clearInterval(timer); };
    }, []);

    const { items } = summary;

    return (
        <div data-testid="upkeep-summary" className={cn('overflow-y-auto custom-scrollbar p-1 flex flex-col gap-1.5 leading-snug text-white', className)}>
            <div>
                <div className="ui-text-title font-bold text-gi-gold">Upkeep</div>
                <div className="ui-text-small text-white/60">Items the mat uses each minute</div>
            </div>
            {!items.length && <div className="ui-text-body text-white/60">Nothing on the mat costs upkeep.</div>}
            {items.map(row => (
                <div key={row.itemId} data-item-id={row.itemId} className="flex flex-col gap-0.5">
                    <EntityRibbon
                        kind="item"
                        id={row.itemId}
                        name={row.name}
                        size="sm"
                        title={null}
                        countText={<span data-upkeep-rate>{formatRate(row.perMinute)}/min</span>}
                    />
                    <div className="ui-text-small px-1 flex flex-wrap gap-x-3 text-white/60 tabular-nums">
                        <span>Bank <b className="text-white">{row.bank}</b></span>
                        {row.onMat > 0 && <span>On the mat <b className="text-white">{row.onMat}</b></span>}
                        <span>Runs out <b className="text-white">{formatRunsOut(row.runsOutMs)}</b></span>
                    </div>
                    <div className="ui-text-small px-1 text-white/60">
                        {row.consumers.map(c => `${c.name} ${formatRate(c.perMinute)}/min${c.source === 'rule' ? ' (rule)' : ''}`).join(', ')}
                    </div>
                    {row.waiting.length > 0 && (
                        <div className="ui-text-small px-1" style={{ color: 'var(--color-ui-red)' }}>Waiting: {row.waiting.map(w => w.name).join(', ')}</div>
                    )}
                </div>
            ))}
        </div>
    );
};

export default UpkeepSummaryPanel;
