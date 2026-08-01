import React, { useState, useEffect, useMemo } from 'react';
import { cn } from '../../utils/cn.js';
import { useEngine } from '../../hooks/useEngine.js';
import { useGameState } from '../../hooks/useGameState.js';
import { getAreaSet } from '../../../config/registries/areaSetRegistry.js';
import { getCard } from '../../../config/registries/cardRegistry.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { buildProductionData } from '../../modals/library/binderCatalog.js';
import { ItemRateTracker } from '../../../systems/inventory/ItemRateTracker.js';
import { FullScreenDrawer } from './FullScreenDrawer.jsx';
import { ItemIcon } from '../base/ItemIcon.jsx';
import { getPlaymatOrder, getOutposts, setOnPlaymat, moveBanner } from '../../../systems/loop/OutpostManager.js';
import { outpostName } from '../banner/OutpostBannerRow.jsx';
import { Map, Play, Pause, User, Layers, TrendingUp, TrendingDown, ChevronUp, ChevronDown, Eye, EyeOff, Hammer } from 'lucide-react';

/**
 * AreaManagerScreen — the Active Operations Dashboard (overhaul Phase 4,
 * spec §COMP-AREA). Pure text/dashboard, no map: thin area strips on the
 * left (`[Area] — [Hero] — [Active Card]` + status + Start/Stop), the
 * live Global Economy panel on the right (net items/hour from
 * ItemRateTracker's 5-minute window). Hovering a strip lists that area's
 * deck outputs (native tooltip — richer hover card is later polish).
 *
 * This is also where **playmat membership and order** live (D-58/D-59):
 * every banner — areas AND Outposts — can be moved up/down or taken off the
 * mat entirely. Taking one off stops its work and returns its hero to the
 * roster (D-67); nothing else is lost, so putting it back restores the deck,
 * binder and progress intact.
 */

const STATUS_LABELS = {
    running: { label: 'Working', tone: 'text-gi-success' },
    drawing: { label: 'Drawing…', tone: 'text-gi-muted' },
    shuffling: { label: 'Shuffling…', tone: 'text-gi-muted' },
    in_combat: { label: 'In Combat!', tone: 'text-gi-danger' },
    injured: { label: 'Injured', tone: 'text-gi-danger' },
    paused: { label: 'Paused', tone: 'text-gi-muted' }
};

/** Outposts craft rather than quest, so they read from their own vocabulary. */
const OUTPOST_STATUS_LABELS = {
    crafting: { label: 'Crafting', tone: 'text-gi-gold' },
    paused_no_inputs: { label: 'No materials', tone: 'text-gi-danger' },
    paused_no_energy: { label: 'Exhausted', tone: 'text-gi-danger' },
    paused_limit_reached: { label: 'Order done', tone: 'text-gi-success' },
    idle: { label: 'Idle', tone: 'text-gi-muted' },
    unstaffed: { label: 'Needs a hero', tone: 'text-gi-danger' },
    active: { label: 'Aura active', tone: 'text-gi-gold' }
};

export const AreaManagerScreen = ({ onClose }) => {
    const engine = useEngine();

    // One snapshot per banner, in playmat order — areas and Outposts together,
    // including the ones currently OFF the mat (this screen is how they get
    // put back). Strips re-render on status changes, hero moves, deck edits
    // and playmat changes.
    const banners = useGameState(
        state => getPlaymatOrder().map(bannerId => {
            const heroNameOf = (heroId) =>
                heroId ? (state.heroes?.find(h => h.id === heroId)?.name || '?') : null;

            if (bannerId.startsWith('outpost_')) {
                const o = getOutposts().find(x => x.id === bannerId);
                if (!o) return { bannerId, missing: true, outpost: true };
                return {
                    bannerId,
                    outpost: true,
                    onPlaymat: o.onPlaymat !== false,
                    status: o.status || 'idle',
                    heroName: heroNameOf(o.assignedHeroId),
                    assignedHeroId: o.assignedHeroId,
                    activeTemplateId: o.activeStationCardId || null,
                    deckTemplateIds: o.activeStationCardId ? [o.activeStationCardId] : []
                };
            }

            const a = state.areaStates?.[bannerId];
            if (!a) return { bannerId, missing: true };
            return {
                bannerId,
                outpost: false,
                onPlaymat: a.onPlaymat !== false,
                status: a.status,
                pausedReason: a.pausedReason || null,
                heroName: heroNameOf(a.assignedHeroId),
                assignedHeroId: a.assignedHeroId,
                activeTemplateId: (a.deckSlots || [])[a.activeCardIndex]?.templateId || null,
                deckTemplateIds: (a.deckSlots || []).map(s => s.templateId).filter(Boolean)
            };
        }),
        ['area:status_changed', 'heroes_updated', 'area:deck_updated', 'state_changed', 'outposts_updated']
    );

    return (
        <FullScreenDrawer icon={Map} title="Area Manager" onClose={onClose}>
            <div className="h-full flex gap-4 p-5">
                {/* Left: area summary strips */}
                <div className="flex-1 min-w-0 flex flex-col gap-2">
                    <PanelLabel>Playmat</PanelLabel>
                    {banners.length === 0 && (
                        <div className="text-[11px] text-gi-muted italic px-1">No banners yet.</div>
                    )}
                    {banners.map((banner, i) => (
                        <AreaStrip
                            key={banner.bannerId}
                            area={banner}
                            engine={engine}
                            isFirst={i === 0}
                            isLast={i === banners.length - 1}
                        />
                    ))}
                </div>

                {/* Right: global economy */}
                <div className="w-80 shrink-0 flex flex-col gap-2">
                    <PanelLabel>Global Economy</PanelLabel>
                    <EconomyPanel />
                </div>
            </div>
        </FullScreenDrawer>
    );
};

const PanelLabel = ({ children }) => (
    <span className="text-[10px] font-bold text-gi-primary uppercase tracking-widest">{children}</span>
);

/**
 * Thin summary strip: [Banner] — [Hero] — [Active Card] + status, with the
 * playmat controls (reorder, on/off) and — for areas — the run toggle.
 */
const AreaStrip = ({ area, engine, isFirst, isLast }) => {
    const bannerName = area.outpost
        ? outpostName(area.bannerId, area.activeTemplateId)
        : (getAreaSet(area.bannerId)?.name || area.bannerId);

    if (area.missing) {
        return (
            <div className="rounded-lg border border-gi-border/40 bg-gi-surface/40 px-4 py-2.5 text-[11px] text-gi-muted italic">
                {bannerName} — initializing…
            </div>
        );
    }

    const status = (area.outpost ? OUTPOST_STATUS_LABELS : STATUS_LABELS)[area.status]
        || { label: area.status || '—', tone: 'text-gi-muted' };
    const activeCardName = area.activeTemplateId ? (getCard(area.activeTemplateId)?.name || '?') : null;
    const manuallyPaused = area.pausedReason === 'manual';
    // Mirrors the banner ControlPanel's gate. An Outpost has no run toggle —
    // crafting runs whenever it has a hero, a recipe and materials.
    const canToggleRun = !area.outpost && area.onPlaymat
        && area.status !== 'injured' && area.assignedHeroId;

    // Hover summary (spec: strip tooltip lists the banner's outputs).
    const outputs = useMemo(() => {
        const names = new Set();
        area.deckTemplateIds.forEach(id => {
            const template = getCard(id);
            if (!template) return;
            (buildProductionData(template).outputs || []).forEach(out => {
                names.add(out.name || getItem(out.id)?.name || out.id);
            });
        });
        return [...names];
    }, [area.deckTemplateIds]);

    return (
        <div
            title={outputs.length ? `Outputs: ${outputs.join(', ')}` : 'No production outputs configured'}
            className={cn(
                'flex items-center gap-3 rounded-lg border px-4 py-2.5 transition-opacity',
                area.outpost ? 'border-gi-gold/30' : 'border-gi-border',
                'bg-gi-surface/60',
                !area.onPlaymat && 'opacity-45'
            )}
        >
            {/* Reorder — the playmat is the player's own running order (D-58) */}
            <div className="flex flex-col shrink-0">
                <button
                    onClick={() => moveBanner(area.bannerId, -1)}
                    disabled={isFirst}
                    title="Move up"
                    className={cn('leading-none', isFirst ? 'text-gi-muted/25 cursor-not-allowed' : 'text-gi-muted hover:text-gi-text')}
                >
                    <ChevronUp size={12} />
                </button>
                <button
                    onClick={() => moveBanner(area.bannerId, 1)}
                    disabled={isLast}
                    title="Move down"
                    className={cn('leading-none', isLast ? 'text-gi-muted/25 cursor-not-allowed' : 'text-gi-muted hover:text-gi-text')}
                >
                    <ChevronDown size={12} />
                </button>
            </div>

            {area.outpost && <Hammer size={11} className="text-gi-gold shrink-0" title="Outpost" />}
            <span className="w-40 truncate text-xs font-bold text-gi-text">{bannerName}</span>
            <span className="flex items-center gap-1 w-28 truncate text-[10px] text-gi-muted">
                <User size={10} className="shrink-0" /> {area.heroName || '— unassigned —'}
            </span>
            <span className="flex items-center gap-1 flex-1 min-w-0 truncate text-[10px] text-gi-muted">
                <Layers size={10} className="shrink-0" /> {activeCardName || '—'}
            </span>
            <span className={cn('w-24 text-right text-[10px] font-bold uppercase', status.tone)}>
                {!area.onPlaymat ? 'Off playmat' : manuallyPaused ? 'Stopped' : status.label}
            </span>

            {/* Playmat membership (D-59) — off the mat, work halts and the hero
                goes back to the roster (D-67). Everything else is preserved. */}
            <button
                onClick={() => setOnPlaymat(area.bannerId, !area.onPlaymat)}
                title={area.onPlaymat
                    ? 'Take off the playmat — stops work and frees the hero. Deck and progress are kept.'
                    : 'Put back on the playmat'}
                className="p-1.5 rounded border border-gi-border text-gi-muted hover:text-gi-text hover:border-gi-primary transition-colors shrink-0"
            >
                {area.onPlaymat ? <Eye size={12} /> : <EyeOff size={12} />}
            </button>

            <button
                onClick={() => manuallyPaused
                    ? engine.LoopRunner.resumeArea(area.bannerId)
                    : engine.LoopRunner.pauseArea(area.bannerId)}
                disabled={!canToggleRun}
                title={canToggleRun
                    ? (manuallyPaused ? 'Start the loop' : 'Stop the loop')
                    : (area.outpost ? 'Outposts craft whenever they have a hero, a recipe and materials' : 'Needs an assigned, healthy hero on the playmat')}
                className={cn(
                    'p-1.5 rounded border transition-colors shrink-0',
                    canToggleRun
                        ? 'border-gi-border text-gi-text hover:border-gi-primary'
                        : 'border-gi-border/40 text-gi-muted/40 cursor-not-allowed'
                )}
            >
                {manuallyPaused ? <Play size={12} /> : <Pause size={12} />}
            </button>
        </div>
    );
};

/**
 * Live net item rates. ItemRateTracker is a sliding window with no
 * events, so poll it — 3s keeps the panel honest without cost.
 */
const EconomyPanel = () => {
    const [rates, setRates] = useState(() => ItemRateTracker.getAllRates());
    useEffect(() => {
        const timer = setInterval(() => setRates(ItemRateTracker.getAllRates()), 3000);
        return () => clearInterval(timer);
    }, []);

    const entries = Object.entries(rates)
        .map(([itemId, rate]) => ({ itemId, rate, template: getItem(itemId) }))
        .filter(e => e.template)
        .sort((a, b) => Math.abs(b.rate) - Math.abs(a.rate));

    return (
        <div className="rounded-lg border border-gi-border bg-gi-surface/60 p-3 flex flex-col gap-1.5 min-h-[10rem]">
            {entries.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-[10px] text-gi-muted italic text-center px-4">
                    Nothing produced in the last 5 minutes — deploy heroes and the live rates appear here.
                </div>
            ) : entries.map(({ itemId, rate, template }) => (
                <div key={itemId} className="flex items-center gap-2 text-[11px]">
                    <ItemIcon item={template} size={18} className="shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-gi-text">{template.name}</span>
                    <span className={cn(
                        'flex items-center gap-1 font-bold tabular-nums',
                        rate >= 0 ? 'text-gi-success' : 'text-gi-danger'
                    )}>
                        {rate >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                        {rate >= 0 ? '+' : ''}{Math.abs(rate) < 10 ? rate.toFixed(1) : Math.round(rate)}/hr
                    </span>
                </div>
            ))}
        </div>
    );
};

export default AreaManagerScreen;
