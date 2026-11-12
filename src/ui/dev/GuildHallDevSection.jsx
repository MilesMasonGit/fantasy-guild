// The QA panel's Guild Hall section: the sky's star states, one click away.
// ⚠️ QA BUILDS ONLY: TestDashboard renders this behind `QA_TOOLS && …`.

import { useState } from 'react';
import { GameState } from '../../state/GameState.js';
import { EventBus } from '../../systems/core/EventBus.js';
import { GuildUpgradeManager } from '../../systems/progression/GuildUpgradeManager.js';
import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';
import { InventoryManager } from '../../systems/inventory/InventoryManager.js';
import { totalPrice } from '../../config/guildUpgrades.js';
import { planStarThatOpens, planConstellationOneShort } from './hallCeremonyDev.js';
import { installQaSky, stockForQaSky, setUpHallScene, woundSceneHero, payLapNow, hallReadout, playAway, lapNowText } from './hallStarsDev.js';
import * as PassiveProduction from '../../systems/board/PassiveProduction.js';

const labelClass = 'ui-text-title font-bold uppercase tracking-wider text-gi-muted mb-1';
const buttonClass = 'px-2 py-1 rounded bg-gi-primary/10 hover:bg-gi-primary/20 border border-gi-primary/40 text-xs font-bold transition-colors';

/**
 * Every star state at once: Bunk Beds bought, the Wishing Well maxed, Bank Tabs buyable, a star
 * beyond a bought one opened and one beyond an unbought one still locked.
 */
export const SKY_SAMPLE_RANKS = { roster_size: 1, wishing_well: 10 };

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
export const SKY_SAMPLE_PAID = ['bank_tabs'];

/** Put each upgrade's next price in the Bank, so the Bank can pay for it now. */
export function devGiveNextPrice(ids) {
    for (const id of ids) {
        for (const { itemId, quantity } of totalPrice(GuildUpgradeManager.getNextCost(id))) {
            InventoryManager.addItem(itemId, quantity);
        }
    }
}

/** Put the next `count` ranks' price of an upgrade in the Bank, so they can be bought at once. */
export function devGiveRanksPrice(id, count) {
    for (const { itemId, quantity } of GuildUpgradeManager.getRanksCost(id, count) || []) {
        InventoryManager.addItem(itemId, quantity);
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
                    title="The sample ranks, and the next price of Bank Tabs in the Bank"
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
            <div className={labelClass}>Upgrade drawer (dev only)</div>
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    data-qa-multi-rank
                    className={buttonClass}
                    title="Bank Tabs at rank 0, and the price of its first three ranks in the Bank"
                    onClick={() => {
                        devSetGuildRanks({ ...GuildUpgradeManager.getRanks(), bank_tabs: 0 });
                        devGiveRanksPrice('bank_tabs', 3);
                        setStatus('Bank Tabs at rank 0, with its first three ranks paid for in the Bank. Open the Guild Hall, click Bank Tabs, click rank III, hover Upgrade for the total, then Upgrade (+3 Ranks). Rank IV after it is short.');
                    }}
                >
                    Three ranks to buy at once
                </button>
            </div>
            <div className={labelClass}>Upgrade ceremony (dev only)</div>
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    data-qa-ceremony-opens
                    className={buttonClass}
                    title="Every rank to 0, and the price of a star that opens others in the Bank"
                    onClick={() => {
                        const r = planStarThatOpens();
                        if (!r.ok) { setStatus(r.error); return; }
                        devSetGuildRanks(r.ranks);
                        devGiveNextPrice([r.id]);
                        setStatus(`Every rank at 0, and ${r.name}'s price in the Bank. Open the Guild Hall, click ${r.name}, then Upgrade: it bursts and light runs to ${r.opens.join(', ')}.`);
                    }}
                >
                    A star that opens others
                </button>
                <button
                    type="button"
                    data-qa-ceremony-constellation
                    className={buttonClass}
                    title="A constellation lit but for one star, and that star's price in the Bank"
                    onClick={() => {
                        const r = planConstellationOneShort();
                        if (!r.ok) { setStatus(r.error); return; }
                        devSetGuildRanks(r.ranks);
                        devGiveNextPrice([r.id]);
                        setStatus(`${r.constellation} is lit but for ${r.name}, whose price is in the Bank. Open the Guild Hall, click ${r.name}, then Upgrade: the constellation is finished.`);
                    }}
                >
                    A constellation one star short
                </button>
            </div>
            <div className={labelClass}>Hall stars: every kind (dev only)</div>
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    data-qa-hall-scene
                    className={buttonClass}
                    title="The fixture sky, the Bank stocked for it, and a Copper Ore Vein with a miner and a Mining Camp right of the Hall"
                    onClick={() => {
                        const r = setUpHallScene();
                        setStatus(r.ok
                            ? `Fixture sky in (a Mining and a Forestry constellation, two more Hearth and Well stars), the Bank stocked, and right of the Hall a Copper Ore Vein that ${r.name} works and a Mining Camp. Open the Guild Hall: Miner’s Lore is buyable at once. Gone on reload.`
                            : r.error);
                    }}
                >
                    Star scene: sky, vein, miner
                </button>
                <button
                    type="button"
                    data-qa-hall-sky-only
                    className={buttonClass}
                    onClick={() => {
                        const r = installQaSky();
                        stockForQaSky();
                        setStatus(`Fixture sky in: ${r.constellations} constellations and ${r.stars} stars beside the built-in ones, the Bank stocked to buy them. Gone on reload.`);
                    }}
                >
                    Fixture sky only
                </button>
                <button
                    type="button"
                    data-qa-hall-wound
                    className={buttonClass}
                    onClick={() => {
                        const r = woundSceneHero();
                        setStatus(r.ok
                            ? `${r.name} is knocked out: the wound lasts ${Math.round(r.ms / 1000)} s (5 min, less the Infirmary). Their hero bar counts it down.`
                            : r.error);
                    }}
                >
                    Wound the miner
                </button>
                <button
                    type="button"
                    data-qa-hall-lap
                    className={buttonClass}
                    onClick={() => {
                        const r = payLapNow();
                        setStatus(r.ok ? 'The Hall pays its Passive Production in a second, beside it on the mat.' : r.error);
                    }}
                >
                    Pay a Hall lap now
                </button>
                <button
                    type="button"
                    data-qa-hall-readout
                    className={buttonClass}
                    onClick={() => setStatus(hallReadout().join(' · '))}
                >
                    What the stars do now
                </button>
            </div>
            <div className={labelClass}>The drop lap (dev only)</div>
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    data-qa-lap-away
                    className={buttonClass}
                    title="The real catch-up, as on a load, for 30 minutes; not saved"
                    onClick={async () => {
                        setStatus('Playing 30 minutes away…');
                        const r = await playAway(30);
                        setStatus(r.ok
                            ? `Played 30 minutes away at a lap of ${lapNowText()}: the summary lists what the Hall paid (Water and seeds at ${Math.floor(30 * 60000 / PassiveProduction.lapMs())} laps, give or take the lap already run). Not saved.`
                            : r.error);
                    }}
                >
                    Play 30 minutes away
                </button>
            </div>
            {status && <div className="ui-text-body text-gi-muted" data-qa-hall-status>{status}</div>}
        </div>
    );
}
