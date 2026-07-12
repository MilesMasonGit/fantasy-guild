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
import { Map, Play, Pause, User, Layers, TrendingUp, TrendingDown } from 'lucide-react';

/**
 * AreaManagerScreen — the Active Operations Dashboard (overhaul Phase 4,
 * spec §COMP-AREA). Pure text/dashboard, no map: thin area strips on the
 * left (`[Area] — [Hero] — [Active Card]` + status + Start/Stop), the
 * live Global Economy panel on the right (net items/hour from
 * ItemRateTracker's 5-minute window). Hovering a strip lists that area's
 * deck outputs (native tooltip — richer hover card is later polish).
 *
 * Adding/removing areas stays quest/banner-driven for now — the banner's
 * hide toggle is per-session local state, so "remove from playmat" from
 * here needs that state lifted first (flagged in the task list).
 */

const STATUS_LABELS = {
    running: { label: 'Working', tone: 'text-gi-success' },
    drawing: { label: 'Drawing…', tone: 'text-gi-muted' },
    shuffling: { label: 'Shuffling…', tone: 'text-gi-muted' },
    in_combat: { label: 'In Combat!', tone: 'text-gi-danger' },
    injured: { label: 'Injured', tone: 'text-gi-danger' },
    paused: { label: 'Paused', tone: 'text-gi-muted' }
};

export const AreaManagerScreen = ({ onClose }) => {
    const engine = useEngine();

    // One snapshot for every unlocked area — strips re-render on loop
    // status changes, hero moves, and deck edits.
    const areas = useGameState(
        state => (state.collection?.unlockedAreaSets || []).map(areaId => {
            const a = state.areaStates?.[areaId];
            if (!a) return { areaId, missing: true };
            const heroName = a.assignedHeroId
                ? (state.heroes?.find(h => h.id === a.assignedHeroId)?.name || '?')
                : null;
            const activeTemplateId = (a.deckSlots || [])[a.activeCardIndex]?.templateId || null;
            return {
                areaId,
                mode: a.mode,
                status: a.status,
                pausedReason: a.pausedReason || null,
                heroName,
                assignedHeroId: a.assignedHeroId,
                activeTemplateId,
                deckTemplateIds: (a.deckSlots || []).map(s => s.templateId).filter(Boolean)
            };
        }),
        ['area:status_changed', 'heroes_updated', 'area:deck_updated', 'state_changed']
    );

    return (
        <FullScreenDrawer icon={Map} title="Area Manager" onClose={onClose}>
            <div className="h-full flex gap-4 p-5">
                {/* Left: area summary strips */}
                <div className="flex-1 min-w-0 flex flex-col gap-2">
                    <PanelLabel>Active Operations</PanelLabel>
                    {areas.length === 0 && (
                        <div className="text-[11px] text-gi-muted italic px-1">No areas unlocked yet.</div>
                    )}
                    {areas.map(area => (
                        <AreaStrip key={area.areaId} area={area} engine={engine} />
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

/** Thin summary strip: [Area] — [Hero] — [Active Card] + status + run toggle. */
const AreaStrip = ({ area, engine }) => {
    const areaName = getAreaSet(area.areaId)?.name || area.areaId;
    if (area.missing) {
        return (
            <div className="rounded-lg border border-gi-border/40 bg-gi-surface/40 px-4 py-2.5 text-[11px] text-gi-muted italic">
                {areaName} — initializing…
            </div>
        );
    }

    const status = STATUS_LABELS[area.status] || { label: area.status || '—', tone: 'text-gi-muted' };
    const activeCardName = area.activeTemplateId ? (getCard(area.activeTemplateId)?.name || '?') : null;
    const manuallyPaused = area.pausedReason === 'manual';
    // Mirrors the banner ControlPanel's gate.
    const canToggleRun = area.mode === 'adventure' && area.status !== 'injured' && area.assignedHeroId;

    // Hover summary (spec: strip tooltip lists the area's outputs).
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
            className="flex items-center gap-3 rounded-lg border border-gi-border bg-gi-surface/60 px-4 py-2.5"
        >
            <span className="w-40 truncate text-xs font-bold text-gi-text">{areaName}</span>
            <span className="flex items-center gap-1 w-28 truncate text-[10px] text-gi-muted">
                <User size={10} className="shrink-0" /> {area.heroName || '— unassigned —'}
            </span>
            <span className="flex items-center gap-1 flex-1 min-w-0 truncate text-[10px] text-gi-muted">
                <Layers size={10} className="shrink-0" /> {activeCardName || '—'}
            </span>
            <span className={cn('w-20 text-right text-[10px] font-bold uppercase', status.tone)}>
                {manuallyPaused ? 'Stopped' : status.label}
            </span>
            <button
                onClick={() => manuallyPaused
                    ? engine.LoopRunner.resumeArea(area.areaId)
                    : engine.LoopRunner.pauseArea(area.areaId)}
                disabled={!canToggleRun}
                title={canToggleRun
                    ? (manuallyPaused ? 'Start the loop' : 'Stop the loop')
                    : 'Needs an assigned, healthy hero in Wilds mode'}
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
