import React from 'react';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { GuildUpgradeManager } from '../../../systems/progression/GuildUpgradeManager.js';
import { RecruitmentSection } from '../drawer/RecruitmentSection.jsx';
import { FullScreenDrawer } from './FullScreenDrawer.jsx';
import { Castle, Coins, TrendingUp, Check, Hammer, Layers } from 'lucide-react';

/**
 * GuildHallScreen — full-screen Guild Hall (overhaul Phase 4, spec
 * §COMP-GUILD): the global upgrade tree + the Recruitment Center
 * (migrated out of the Heroes pane). Deliberately a rudimentary list
 * per the spec; gold-only costs (owner decision 2026-07-11), placeholder
 * curves in config/guildUpgrades.js.
 *
 * The tree is also the ONLY source of Outpost cards (D-34), so it carries a
 * second section for them. Those nodes are repeatable — rank N grants N copies
 * (D-37) — which is what supplies the additive aura stacking of D-23, so the
 * owned count has to be legible at a glance.
 */
export const GuildHallScreen = ({ onClose }) => {
    const gold = useGameState(state => state.currency?.gold || 0, ['currency_changed', 'state_changed']);
    // Rank signature so purchases re-render the list.
    useGameState(
        state => JSON.stringify(state.progress?.guildUpgrades || {}),
        ['guild_upgrades_updated', 'state_changed']
    );
    // Area unlocks reveal new nodes (D-36), so the list must re-derive on them.
    useGameState(
        state => (state.collection?.unlockedAreaSets || []).join(','),
        ['area_unlocked', 'collection_updated', 'state_changed']
    );
    const upgrades = GuildUpgradeManager.getDisplayList();
    const capacity = upgrades.filter(u => u.category === 'capacity');
    const outpostCards = upgrades.filter(u => u.category === 'outpost');
    const universalCards = upgrades.filter(u => u.category === 'universal');

    return (
        <FullScreenDrawer icon={Castle} title="Guild Hall" onClose={onClose}>
            <div className="max-w-3xl mx-auto p-6 flex flex-col gap-8">
                {/* Upgrades */}
                <section>
                    <div className="flex items-baseline justify-between mb-3">
                        <span className="flex items-center gap-1.5 text-[10px] font-bold text-gi-primary gi-caps tracking-widest">
                            <TrendingUp size={12} /> Guild Upgrades
                        </span>
                        <span className="flex items-center gap-1.5 text-xs font-bold text-gi-gold tabular-nums">
                            <Coins size={12} /> {gold.toLocaleString()}
                        </span>
                    </div>
                    <div className="flex flex-col gap-2">
                        {capacity.map(u => (
                            <UpgradeRow key={u.id} upgrade={u} gold={gold} />
                        ))}
                    </div>
                </section>

                {/* Outpost cards (D-34) — the tree is their only source. Nodes
                    for regions the player hasn't reached are absent, not
                    greyed out (D-36). */}
                <CardSection
                    icon={Hammer} tone="text-gi-gold" title="Outpost Cards"
                    hint="Each rank grants another copy — duplicates stack"
                    rows={outpostCards} gold={gold}
                />

                {/* Universal cards are a different system (D-51) — they go into
                    the Universal Bucket for any AREA deck, not onto an Outpost.
                    Same rank-grants-copies mechanism, so they sit alongside
                    rather than inside. */}
                <CardSection
                    icon={Layers} tone="text-gi-primary" title="Universal Cards"
                    hint="Playable in any area's deck"
                    rows={universalCards} gold={gold}
                />

                {/* Recruitment Center (spec: migrated from the Heroes pane) */}
                <RecruitmentSection />
            </div>
        </FullScreenDrawer>
    );
};

/** A titled block of rank-grants-copies nodes; renders nothing when empty. */
const CardSection = ({ icon: Icon, tone, title, hint, rows, gold }) => {
    if (!rows.length) return null;
    return (
        <section>
            <div className="flex items-baseline justify-between mb-3">
                <span className={cn('flex items-center gap-1.5 text-[10px] font-bold gi-caps tracking-widest', tone)}>
                    <Icon size={12} /> {title}
                </span>
                <span className="text-[9px] text-gi-muted italic">{hint}</span>
            </div>
            <div className="flex flex-col gap-2">
                {rows.map(u => <UpgradeRow key={u.id} upgrade={u} gold={gold} />)}
            </div>
        </section>
    );
};

const UpgradeRow = ({ upgrade, gold }) => {
    const affordable = upgrade.cost !== null && gold >= upgrade.cost;
    return (
        <div className="flex items-center gap-4 rounded-lg border border-gi-border bg-gi-surface/60 px-4 py-3">
            <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                    <span className="text-sm font-bold text-gi-text">{upgrade.name}</span>
                    <span className="text-[10px] text-gi-primary font-bold tabular-nums">{upgrade.statLabel}</span>
                    {/* Owned copies, called out because stacking is a real
                        strategic play and D-37 makes the count matter. */}
                    {upgrade.ownedCopies > 0 && (
                        <span
                            className="flex items-center gap-1 text-[9px] font-bold gi-caps tracking-wider text-gi-gold border border-gi-gold/40 rounded px-1.5 py-px"
                            title={`You own ${upgrade.ownedCopies} of this card`}
                        >
                            <Layers size={9} /> {upgrade.ownedCopies} owned
                        </span>
                    )}
                </div>
                <div className="text-[10px] text-gi-muted">{upgrade.description}</div>
                {/* Rank pips */}
                <div className="flex items-center gap-1 mt-1.5">
                    {Array.from({ length: upgrade.maxRank }, (_, i) => (
                        <span
                            key={i}
                            className={cn(
                                'h-1.5 rounded-full',
                                upgrade.maxRank > 10 ? 'w-2' : 'w-4',
                                i < upgrade.rank ? 'bg-gi-primary' : 'bg-white/10'
                            )}
                        />
                    ))}
                </div>
            </div>
            {upgrade.maxed ? (
                <span className="flex items-center gap-1 text-[10px] font-bold gi-caps text-gi-success shrink-0">
                    <Check size={12} /> Maxed
                </span>
            ) : (
                <button
                    onClick={() => GuildUpgradeManager.purchase(upgrade.id)}
                    disabled={!affordable}
                    className={cn(
                        'flex items-center gap-1.5 px-4 py-2 rounded border text-[11px] font-bold gi-caps tracking-wide transition-colors shrink-0 tabular-nums',
                        affordable
                            ? 'border-gi-gold/60 bg-gi-gold/15 text-gi-text hover:bg-gi-gold/25'
                            : 'border-gi-border/40 text-gi-muted/50 cursor-not-allowed'
                    )}
                >
                    <Coins size={11} className="text-gi-gold" /> {upgrade.cost.toLocaleString()}
                </button>
            )}
        </div>
    );
};

export default GuildHallScreen;
