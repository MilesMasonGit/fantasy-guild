import { useEffect, useState } from 'react';
import { EventBus, UI_LISTENER } from '../../../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import { computeUpkeepSummary, formatRate, formatRunsOut } from '../../../systems/board/UpkeepSummary.js';
import { cn } from '../../utils/cn.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';
import { EntityRibbon } from '../base/EntityRibbon.jsx';

/**
 * What can change what the summary shows, besides the Bank: a Token placed, moved, turned, run dry
 * or lifted (the mat and which spawners count), a spawner starting or stopping waiting (mat full,
 * no room), an enemy camp waking or sleeping with the arrival (`ATLAS_CHANGED`), a load, a reset,
 * a travel. ⚠️ Spawner clocks do not enter the summary, so nothing polls it: one of these events
 * comes with every change it can show, with one exception. A rule's upkeep lapsing (the Bank
 * short when its charge falls due) has no event of its own, so a "Waiting" line can appear only at
 * the next one of these, which on a working mat is the next item in or out of the Bank.
 */
export const MAT_EVENTS = Object.freeze([
    BOARD_EVENTS.TILE_CHANGED,
    BOARD_EVENTS.TOKEN_PLACED,
    BOARD_EVENTS.TOKEN_DEPLETED,
    BOARD_EVENTS.SPAWNER_ALERT_CHANGED,
    ENGINE_EVENTS.GUILD_UPGRADES_UPDATED,
    ENGINE_EVENTS.ATLAS_CHANGED,
    ENGINE_EVENTS.BOARD_SWAPPED,
    ENGINE_EVENTS.GAME_RESET,
    ENGINE_EVENTS.GAME_LOADED
]);

/** Events after which the summary is worked out again: {@link MAT_EVENTS} and every Bank change. */
export const REFRESH_EVENTS = Object.freeze([ENGINE_EVENTS.INVENTORY_UPDATED, ...MAT_EVENTS]);

/**
 * Everything the panel draws from a summary, as one string: two summaries with the same signature
 * draw the same panel, so a recompute that changed nothing visible is not drawn again.
 */
export function summarySignature(summary) {
    return JSON.stringify((summary?.items || []).map(row => [
        row.itemId, row.name, formatRate(row.perMinute), row.bank, row.onMat, formatRunsOut(row.runsOutMs),
        row.consumers.map(c => [c.name, formatRate(c.perMinute), c.source]),
        row.waiting.map(w => w.name)
    ]));
}

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
        const refresh = () => {
            const next = computeUpkeepSummary();
            const sig = summarySignature(next);
            setSummary(prev => (summarySignature(prev) === sig ? prev : next));
        };
        const unsubs = REFRESH_EVENTS.map(e => EventBus.subscribe(e, refresh, UI_LISTENER));
        return () => unsubs.forEach(u => u());
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
