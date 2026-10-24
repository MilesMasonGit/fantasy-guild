// The QA panel's Guild Hall section: the sky's star states, one click away.
// ⚠️ DEV BUILDS ONLY: TestDashboard renders this behind `import.meta.env.DEV && …`.

import { useState } from 'react';
import { GameState } from '../../state/GameState.js';
import { EventBus } from '../../systems/core/EventBus.js';
import { GuildUpgradeManager } from '../../systems/progression/GuildUpgradeManager.js';
import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';
import { InventoryManager } from '../../systems/inventory/InventoryManager.js';
import { totalPrice } from '../../config/guildUpgrades.js';

const labelClass = 'ui-text-title font-bold uppercase tracking-wider text-gi-muted mb-1';
const buttonClass = 'px-2 py-1 rounded bg-gi-primary/10 hover:bg-gi-primary/20 border border-gi-primary/40 text-xs font-bold transition-colors';

/**
 * Every star state at once: Bunk Beds bought (The Hearth finished), the Notice Board and the
 * Wishing Well maxed (The Well finished), Bank Tabs locked, the rest buyable.
 */
export const SKY_SAMPLE_RANKS = { roster_size: 1, notice_board: 3, wishing_well: 10 };

/**
 * Write Guild Hall ranks straight into the save, as the roster helper in `TestDashboard` does:
 * a dev convenience, not a purchase, so no items are paid.
 */
export function devSetGuildRanks(ranks) {
    const progress = GameState.state?.progress;
    if (!progress) return;
    progress.guildUpgrades = { ...ranks };
    GuildUpgradeManager.recompute();
    EventBus.publish(ENGINE_EVENTS.GUILD_UPGRADES_UPDATED, {});
}

/** The stars the sample makes blue, by putting their next price in the Bank. */
export const SKY_SAMPLE_PAID = ['bank_slots', 'token_cap'];

/** Put each upgrade's next price in the Bank, so the Bank can pay for it now. */
export function devGiveNextPrice(ids) {
    for (const id of ids) {
        for (const { itemId, quantity } of totalPrice(GuildUpgradeManager.getNextCost(id))) {
            InventoryManager.addItem(itemId, quantity);
        }
    }
}

export function GuildHallDevSection() {
    const [status, setStatus] = useState('');
    const apply = (ranks, text) => {
        devSetGuildRanks(ranks);
        setStatus(text);
    };
    return (
        <div className="mb-3 pb-3 border-b border-gi-border space-y-2" data-testid="qa-guild-hall">
            <div className={labelClass}>Guild Hall sky (dev only)</div>
            <div className="flex flex-wrap gap-2">
                <button type="button" data-qa-sky-sample className={buttonClass} onClick={() => apply(SKY_SAMPLE_RANKS, 'Every star state')}>
                    Every star state
                </button>
                <button
                    type="button"
                    data-qa-sky-looks
                    className={buttonClass}
                    title="The sample ranks, and the next price of Bank Slots and Token Cap in the Bank"
                    onClick={() => {
                        devSetGuildRanks(SKY_SAMPLE_RANKS);
                        devGiveNextPrice(SKY_SAMPLE_PAID);
                        setStatus('Every star look: grey, blue and gold');
                    }}
                >
                    Every star look
                </button>
                <button type="button" data-qa-sky-reset className={buttonClass} onClick={() => apply({}, 'Every upgrade at rank 0')}>
                    Reset the sky
                </button>
            </div>
            {status && <div className="ui-text-body text-gi-muted">{status}</div>}
        </div>
    );
}

export default GuildHallDevSection;
