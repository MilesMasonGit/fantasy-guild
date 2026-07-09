import React, { useMemo, useState } from 'react';
import { useEngine } from '../../hooks/useEngine.js';
import { useGameState } from '../../hooks/useGameState.js';
import { cn } from '../../utils/cn.js';
import { getAreaSet } from '../../../config/registries/areaSetRegistry.js';
import { getCard } from '../../../config/registries/cardRegistry.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { getRecipe } from '../../../config/registries/recipeRegistry.js';
import { resolveSpritePath } from '../../../utils/AssetManager.js';
import { AREA_EVENTS } from '../../../systems/core/areaEvents.js';
import { getNativeDrag, readDropPayload } from '../../dnd/nativeDrag.js';
import { RefProgressBar } from './RefProgressBar.jsx';
import { DeckFocusView, EquipFocusView, RecipeFocusView } from './BannerFocusViews.jsx';
import {
    Play, Pause, ChevronUp, ChevronDown, Sword, Hammer, Skull, User,
    Layers, AlertTriangle, Utensils, Hourglass, Infinity as InfinityIcon
} from 'lucide-react';

/**
 * AreaBannerRow — one unlocked Area as a horizontal banner (concept §11).
 *
 * Layout (static pillars + flexible center, §11.A/B):
 *   [Control][Info][Hero] [ ... mode-dependent center ... ] [Station]
 *
 * The center is the 80/20 split banner (§11.C): the active mode's slice
 * holds the working UI, the inactive slice is a thin art strip that toggles
 * the mode when clicked.
 *
 * Reactivity (§2F): every subscription filters on this row's areaId; other
 * areas' events are ignored entirely. Progress animation is ref-driven
 * (§6D). Collapsed rows unmount all of this (§6E) — the parent renders
 * CollapsedRow instead.
 */

const STRUCTURAL_EVENTS = [
    AREA_EVENTS.STATUS_CHANGED,
    AREA_EVENTS.CARD_COMPLETED,
    AREA_EVENTS.DECK_UPDATED,
    AREA_EVENTS.HERO_CHANGED,
    AREA_EVENTS.MODE_SWITCHED,
    AREA_EVENTS.STATION_CHANGED,
    AREA_EVENTS.COMBAT_RESOLVED,
    AREA_EVENTS.CRAFT_COMPLETED
];

/** Structural snapshot of one area — primitive-ish so isEqual bails cheaply. */
function useAreaSnapshot(areaId) {
    return useGameState(
        state => {
            const a = state.areaStates?.[areaId];
            if (!a) return null;
            return {
                mode: a.mode,
                status: a.status,
                pausedReason: a.pausedReason || null,
                activeCardIndex: a.activeCardIndex,
                assignedHeroId: a.assignedHeroId,
                deckSig: (a.deckSlots || []).map(s => s.templateId || (s.hazard ? `hazard:${s.hazard.type}` : '_')).join(','),
                stationCardId: a.stationState?.activeStationCardId || null,
                stationStatus: a.stationState?.status || 'idle',
                selectedRecipeId: a.stationState?.selectedRecipeId || null,
                producedCount: a.stationState?.producedCount || 0,
                productionMode: a.stationState?.productionMode || 'infinite',
                productionLimit: a.stationState?.productionLimit || 0
            };
        },
        STRUCTURAL_EVENTS,
        data => !data?.areaId || data.areaId === areaId,
        { bypassClone: false }
    );
}

const STATUS_LABELS = {
    running: { label: 'Working', color: 'text-gi-success' },
    drawing: { label: 'Drawing…', color: 'text-gi-muted' },
    shuffling: { label: 'Shuffling…', color: 'text-gi-muted' },
    in_combat: { label: 'In Combat!', color: 'text-gi-danger' },
    injured: { label: 'Injured', color: 'text-gi-danger' },
    paused: { label: 'Paused', color: 'text-gi-muted' }
};

export const AreaBannerRow = ({ areaId, focus, onFocus, onCollapse }) => {
    const engine = useEngine();
    const snap = useAreaSnapshot(areaId);
    const areaSet = useMemo(() => getAreaSet(areaId), [areaId]);

    if (!snap) return null;

    const isFocused = focus?.areaId === areaId;
    const isDimmed = focus && !isFocused;

    // Focus views replace the whole row body (§11.D — inline morphing).
    if (isFocused) {
        return (
            <div className="rounded-xl border border-gi-primary/60 bg-gi-surface shadow-lg overflow-hidden">
                {focus.mode === 'deck' && <DeckFocusView areaId={areaId} onClose={() => onFocus(null)} />}
                {focus.mode === 'equip' && <EquipFocusView areaId={areaId} heroId={snap.assignedHeroId} onClose={() => onFocus(null)} />}
                {focus.mode === 'recipe' && <RecipeFocusView areaId={areaId} onClose={() => onFocus(null)} />}
            </div>
        );
    }

    const wilds = snap.mode === 'adventure';
    const areaArt = areaSet?.areaArt ? resolveSpritePath(areaSet.areaArt) : null;

    return (
        <div className={cn(
            'relative rounded-xl border border-gi-border bg-gi-surface overflow-hidden transition-opacity duration-300',
            isDimmed && 'opacity-30 pointer-events-none'
        )}>
            <div className="flex items-stretch min-h-[9.5rem]">
                <ControlPanel areaId={areaId} snap={snap} engine={engine} onCollapse={onCollapse} />
                <InfoPanel areaId={areaId} snap={snap} engine={engine} areaName={areaSet?.name || areaId} />
                <HeroSlotCell
                    areaId={areaId} snap={snap} engine={engine}
                    onOpenEquip={() => snap.assignedHeroId && onFocus({ areaId, mode: 'equip' })}
                />

                {/* ---- 80/20 split-banner center (§11.C) ---- */}
                <div className="flex-1 flex items-stretch min-w-0">
                    <div
                        className={cn('relative min-w-0 transition-all duration-500 ease-in-out overflow-hidden', wilds ? 'flex-[4]' : 'flex-[1] cursor-pointer group')}
                        style={areaArt ? { backgroundImage: `url(${areaArt.startsWith('/') ? areaArt : '/' + areaArt})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
                        onClick={!wilds ? () => engine.ModeManager.toggleMode(areaId) : undefined}
                        title={!wilds ? 'Head into the Wilds (Adventure Mode)' : undefined}
                    >
                        <div className={cn('absolute inset-0', wilds ? 'bg-black/60' : 'bg-black/75 group-hover:bg-black/60 transition-colors')} />
                        {wilds ? (
                            <AdventureCenter areaId={areaId} snap={snap} engine={engine} onFocus={onFocus} />
                        ) : (
                            <SliceLabel icon={<Sword size={14} />} text="The Wilds" />
                        )}
                    </div>

                    <div
                        className={cn('relative min-w-0 transition-all duration-500 ease-in-out overflow-hidden border-l border-gi-border/50', !wilds ? 'flex-[4]' : 'flex-[1] cursor-pointer group')}
                        onClick={wilds ? () => engine.ModeManager.toggleMode(areaId) : undefined}
                        title={wilds ? 'Retreat to the Outpost (Stationed Mode)' : undefined}
                    >
                        <div className={cn('absolute inset-0', !wilds ? 'bg-gi-base/90' : 'bg-gi-base/95 group-hover:bg-gi-base/80 transition-colors')} />
                        {!wilds ? (
                            <StationCenter areaId={areaId} snap={snap} engine={engine} onFocus={onFocus} />
                        ) : (
                            <SliceLabel icon={<Hammer size={14} />} text="Outpost" />
                        )}
                    </div>
                </div>

                <StationSlotCell areaId={areaId} snap={snap} engine={engine} onFocus={onFocus} />
            </div>
        </div>
    );
};

// ----------------------------------------------------------------------
// Static pillars
// ----------------------------------------------------------------------

const ControlPanel = ({ areaId, snap, engine, onCollapse }) => {
    const manuallyPaused = snap.pausedReason === 'manual';
    const canToggleRun = snap.mode === 'adventure' && snap.status !== 'injured' && snap.assignedHeroId;

    const handleRunToggle = () => {
        if (manuallyPaused) engine.LoopRunner.resumeArea(areaId);
        else engine.LoopRunner.pauseArea(areaId);
    };

    return (
        <div className="w-10 shrink-0 flex flex-col items-center justify-center gap-2 bg-gi-base/80 border-r border-gi-border/50">
            <button
                onClick={handleRunToggle}
                disabled={!canToggleRun}
                title={manuallyPaused ? 'Start the loop' : 'Stop the loop'}
                className={cn(
                    'p-1.5 rounded border transition-colors',
                    !canToggleRun ? 'border-gi-border/40 text-gi-muted/40 cursor-not-allowed'
                        : manuallyPaused ? 'border-gi-success/50 text-gi-success hover:bg-gi-success/10'
                            : 'border-gi-border text-gi-text hover:border-gi-danger hover:text-gi-danger'
                )}
            >
                {manuallyPaused ? <Play size={13} /> : <Pause size={13} />}
            </button>
            <button
                onClick={onCollapse}
                title="Hide this area"
                className="p-1.5 rounded border border-gi-border text-gi-muted hover:text-gi-text transition-colors"
            >
                <ChevronUp size={13} />
            </button>
        </div>
    );
};

const InfoPanel = ({ areaId, snap, engine, areaName }) => {
    // HP/Energy round to integers in the selector so regen ticks that don't
    // change the displayed value never re-render the panel.
    const vitals = useGameState(
        state => {
            const hero = snap.assignedHeroId ? state.heroes?.find(h => h.id === snap.assignedHeroId) : null;
            if (!hero) return null;
            return {
                name: hero.name,
                hp: Math.round(hero.hp?.current ?? 0), hpMax: hero.hp?.max ?? 100,
                energy: Math.round(hero.energy?.current ?? 0), energyMax: hero.energy?.max ?? 100
            };
        },
        ['heroes_updated'],
        null,
        { deps: [snap.assignedHeroId] }
    );

    const statusInfo = snap.mode === 'stationed'
        ? (snap.status === 'injured'
            ? STATUS_LABELS.injured
            : { crafting: { label: 'Crafting', color: 'text-gi-gold' }, paused_no_inputs: { label: 'No materials', color: 'text-gi-danger' }, paused_limit_reached: { label: 'Order complete', color: 'text-gi-success' }, idle: { label: 'Idle at Outpost', color: 'text-gi-muted' } }[snap.stationStatus] || STATUS_LABELS.paused)
        : (STATUS_LABELS[snap.status] || STATUS_LABELS.paused);
    const energyPaused = snap.pausedReason === 'energy';

    return (
        <div className="w-44 shrink-0 flex flex-col justify-center gap-1.5 px-3 py-2 bg-gi-base/60 border-r border-gi-border/50">
            <span className="text-xs font-bold text-gi-text uppercase tracking-wider truncate">{areaName}</span>
            <span className={cn('text-[10px] font-bold uppercase tracking-widest', statusInfo.color)}>
                {energyPaused ? 'Exhausted (resting)' : statusInfo.label}
            </span>
            {vitals ? (
                <div className="flex flex-col gap-1">
                    <VitalBar label="HP" value={vitals.hp} max={vitals.hpMax} barClass="bg-gi-danger" />
                    <VitalBar label="EN" value={vitals.energy} max={vitals.energyMax} barClass="bg-gi-gold" />
                </div>
            ) : (
                <span className="text-[10px] text-gi-muted italic">No hero assigned</span>
            )}
        </div>
    );
};

const VitalBar = ({ label, value, max, barClass }) => (
    <div className="flex items-center gap-1.5">
        <span className="text-[9px] font-bold text-gi-muted w-5">{label}</span>
        <div className="flex-1 h-1.5 bg-black/50 rounded-full overflow-hidden">
            <div className={cn('h-full transition-all duration-300', barClass)} style={{ width: `${Math.min(100, (value / Math.max(1, max)) * 100)}%` }} />
        </div>
        <span className="text-[9px] text-gi-muted tabular-nums">{value}</span>
    </div>
);

const HeroSlotCell = ({ areaId, snap, engine, onOpenEquip }) => {
    const hero = snap.assignedHeroId ? engine.HeroManager.getHero(snap.assignedHeroId) : null;
    const [dragOver, setDragOver] = useState(false);

    // Drop target (Phase 7): heroes assign/swap; items equip the assigned hero.
    const acceptsDrag = () => {
        const drag = getNativeDrag();
        return drag?.kind === 'hero' || (drag?.kind === 'item' && !!snap.assignedHeroId);
    };
    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        const payload = readDropPayload(e);
        if (payload?.kind === 'hero') {
            engine.HeroAssignmentManager.assignHeroToArea(payload.heroId, areaId);
        } else if (payload?.kind === 'item' && snap.assignedHeroId) {
            engine.EquipmentManager.equipItem(snap.assignedHeroId, payload.itemId);
        }
    };

    return (
        <div
            onDragOver={e => { if (acceptsDrag()) { e.preventDefault(); setDragOver(true); } }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={cn(
                'w-28 shrink-0 relative flex flex-col items-center justify-center gap-1 px-2 bg-gi-base/40 border-r border-gi-border/50 transition-colors',
                dragOver && 'bg-gi-primary/15'
            )}
        >
            {hero ? (
                <button onClick={onOpenEquip} title="Equipment & stats (Equip Focus)" className="flex flex-col items-center gap-1 group">
                    <div className={cn(
                        'w-12 h-12 rounded-full border-2 flex items-center justify-center text-lg font-black uppercase transition-colors',
                        snap.status === 'injured' || hero.status === 'wounded'
                            ? 'border-gi-danger text-gi-danger bg-gi-danger/10'
                            : 'border-gi-primary/60 text-gi-text bg-gi-primary/10 group-hover:border-gi-primary'
                    )}>
                        {hero.name?.[0] || <User size={18} />}
                    </div>
                    <span className="text-[10px] font-bold text-gi-text truncate max-w-full">{hero.name}</span>
                </button>
            ) : (
                <button
                    onClick={() => engine.EventBus.publish('ui:open_drawer', { tab: 'heroes' })}
                    title="Open the Heroes drawer — drag a hero here to deploy them"
                    className="flex flex-col items-center gap-1 text-gi-muted hover:text-gi-text transition-colors"
                >
                    <div className="w-12 h-12 rounded-full border-2 border-dashed border-gi-border flex items-center justify-center">
                        <User size={18} />
                    </div>
                    <span className="text-[10px] font-bold uppercase">Assign</span>
                </button>
            )}
        </div>
    );
};

const StationSlotCell = ({ areaId, snap, engine, onFocus }) => {
    const template = snap.stationCardId ? getCard(snap.stationCardId) : null;
    const art = template?.sprite ? resolveSpritePath(template.sprite) : null;
    const [dragOver, setDragOver] = useState(false);

    // Drop target (Phase 7): station cards from the drawer build here.
    const acceptsDrag = () => getNativeDrag()?.kind === 'card' && getNativeDrag()?.cardType === 'station';
    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        const payload = readDropPayload(e);
        if (payload?.kind === 'card' && payload.cardType === 'station') {
            const result = engine.StationSlotManager.slotStation(areaId, payload.templateId);
            if (!result.success) console.warn('[Banner] Station drop rejected:', result.error);
        }
    };

    // Empty slot click auto-opens the drawer filtered to stations (§12.B).
    const handleClick = () => {
        if (template) onFocus({ areaId, mode: 'recipe' });
        else engine.EventBus.publish('ui:open_drawer', {
            tab: 'cards',
            filter: { cardType: 'station', deployFilter: 'available' }
        });
    };

    return (
        <button
            onClick={handleClick}
            onDragOver={e => { if (acceptsDrag()) { e.preventDefault(); setDragOver(true); } }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            title={template ? `${template.name} — recipes & settings (Recipe Focus)` : 'No station built — open the Cards drawer and drag a station card here'}
            className={cn(
                'w-28 shrink-0 relative flex flex-col items-center justify-center gap-1 px-2 bg-gi-base/40 border-l border-gi-border/50 hover:bg-gi-base/70 transition-colors overflow-hidden',
                dragOver && 'bg-gi-gold/15'
            )}
        >
            {art && <div className="absolute inset-0 opacity-30" style={{ backgroundImage: `url(${art.startsWith('/') ? art : '/' + art})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />}
            <div className="relative flex flex-col items-center gap-1">
                <Hammer size={18} className={template ? 'text-gi-gold' : 'text-gi-muted'} />
                <span className="text-[10px] font-bold text-gi-text text-center leading-tight">
                    {template ? template.name : 'No Station'}
                </span>
            </div>
        </button>
    );
};

const SliceLabel = ({ icon, text }) => (
    <div className="relative h-full flex flex-col items-center justify-center gap-1 text-gi-muted">
        <span className="rotate-0">{icon}</span>
        <span className="text-[9px] font-bold uppercase tracking-widest [writing-mode:vertical-rl] rotate-180">{text}</span>
    </div>
);

// ----------------------------------------------------------------------
// Adventure center: Active Card + Upcoming Track + Deck Button (§11.B.1)
// ----------------------------------------------------------------------

const AdventureCenter = ({ areaId, snap, engine, onFocus }) => {
    const areaState = engine.GameState.areaStates?.[areaId];
    const slots = areaState?.deckSlots || [];
    const activeSlot = slots[snap.activeCardIndex];
    const activeCard = engine.LoopRunner.getActiveCardForArea(areaId);
    const activeTemplate = activeSlot?.templateId ? getCard(activeSlot.templateId) : null;

    const upcoming = useMemo(() => {
        if (!slots.length) return [];
        const items = [];
        for (let offset = 1; offset <= 3 && offset < slots.length; offset++) {
            const idx = (snap.activeCardIndex + offset) % slots.length;
            items.push({ idx, slot: slots[idx], wraps: idx <= snap.activeCardIndex });
        }
        return items;
    }, [snap.deckSig, snap.activeCardIndex, slots]);

    const filledCount = slots.filter(s => s.templateId || s.hazard).length;

    return (
        <div className="relative h-full flex items-stretch gap-2 px-2 py-2 min-w-0">
            {/* Active card (1.0 space) */}
            <div className="w-44 shrink-0 flex flex-col justify-center">
                <ActiveCardCell
                    areaId={areaId} snap={snap}
                    activeCard={activeCard} activeSlot={activeSlot} activeTemplate={activeTemplate}
                />
            </div>

            {/* Upcoming track (2.0 spaces, §11.B.1) */}
            <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-hidden">
                {upcoming.map(({ idx, slot, wraps }) => (
                    <UpcomingTile key={idx} slot={slot} index={idx} wraps={wraps} />
                ))}
            </div>

            {/* Deck button (1.0 space) */}
            <button
                onClick={() => onFocus({ areaId, mode: 'deck' })}
                title="Configure this area's deck (Deck Focus)"
                className="w-24 shrink-0 flex flex-col items-center justify-center gap-1 rounded-lg border border-gi-border/60 bg-black/40 hover:border-gi-primary transition-colors"
            >
                <Layers size={18} className="text-gi-primary" />
                <span className="text-[10px] font-bold text-gi-text uppercase">Deck</span>
                <span className="text-[9px] text-gi-muted">{filledCount}/{slots.length} slots</span>
            </button>
        </div>
    );
};

const ActiveCardCell = ({ areaId, snap, activeCard, activeSlot, activeTemplate }) => {
    // Rich card face while a real card is executing / fighting
    if ((snap.status === 'running' || snap.status === 'in_combat') && activeCard && activeTemplate) {
        return (
            <div className="flex flex-col gap-1">
                <div className="max-h-32 overflow-hidden rounded-lg border border-gi-border/60 bg-black/40 px-2 py-1.5">
                    <div className="flex items-center gap-2">
                        {activeTemplate.cardType === 'combat' ? <Skull size={16} className="text-gi-danger shrink-0" /> : <Sword size={16} className="text-gi-primary shrink-0" />}
                        <div className="min-w-0">
                            <div className="text-[11px] font-bold text-gi-text truncate">{activeTemplate.name}</div>
                            <div className="text-[9px] text-gi-muted truncate">
                                {snap.status === 'in_combat'
                                    ? `Fighting — ${Math.round(activeCard.combat?.enemyHp?.current ?? activeCard.combat?.stats?.enemyHp ?? 0) || 'in progress'}`
                                    : (activeTemplate.config?.actionLabel || 'Working…')}
                            </div>
                        </div>
                    </div>
                </div>
                {snap.status === 'running' && <RefProgressBar areaId={areaId} />}
            </div>
        );
    }

    if (snap.status === 'running' && activeSlot?.hazard) {
        return (
            <StatusPlacard icon={<AlertTriangle size={16} className="text-gi-danger" />} title={`${activeSlot.hazard.type || 'Hazard'}!`} sub={`-${activeSlot.hazard.damagePerPass} HP`} >
                <RefProgressBar areaId={areaId} barClassName="bg-gi-danger" />
            </StatusPlacard>
        );
    }

    if (snap.status === 'running' && activeTemplate?.cardType === 'consumable') {
        const item = getItem(activeTemplate.config?.itemId);
        return (
            <StatusPlacard icon={<Utensils size={16} className="text-gi-success" />} title={activeTemplate.name} sub={item ? `Eating (${item.name})` : 'Consuming…'}>
                <RefProgressBar areaId={areaId} barClassName="bg-gi-success" />
            </StatusPlacard>
        );
    }

    const idleMap = {
        drawing: { icon: <Hourglass size={16} className="text-gi-muted animate-pulse" />, title: 'Drawing…', sub: 'Next card' },
        shuffling: { icon: <Layers size={16} className="text-gi-muted animate-pulse" />, title: 'Shuffling…', sub: 'Loop restarting' },
        injured: { icon: <Skull size={16} className="text-gi-danger" />, title: 'Injured', sub: 'Recovering at the Outpost' },
        paused: { icon: <Pause size={16} className="text-gi-muted" />, title: 'Paused', sub: snap.pausedReason === 'energy' ? 'Waiting for energy' : (snap.assignedHeroId ? 'Press start' : 'Assign a hero') }
    };
    const info = idleMap[snap.status] || idleMap.paused;
    return <StatusPlacard icon={info.icon} title={info.title} sub={info.sub} />;
};

const StatusPlacard = ({ icon, title, sub, children }) => (
    <div className="flex flex-col gap-1">
        <div className="rounded-lg border border-gi-border/60 bg-black/40 px-2 py-1.5 flex items-center gap-2">
            {icon}
            <div className="min-w-0">
                <div className="text-[11px] font-bold text-gi-text truncate">{title}</div>
                <div className="text-[9px] text-gi-muted truncate">{sub}</div>
            </div>
        </div>
        {children}
    </div>
);

const UpcomingTile = ({ slot, index, wraps }) => {
    const template = slot.templateId ? getCard(slot.templateId) : null;
    const label = slot.hazard ? (slot.hazard.type || 'Hazard') : (template?.name || 'Empty');
    const icon = slot.hazard ? <AlertTriangle size={12} className="text-gi-danger" />
        : template?.cardType === 'combat' ? <Skull size={12} className="text-gi-danger" />
            : template?.cardType === 'consumable' ? <Utensils size={12} className="text-gi-success" />
                : template ? <Sword size={12} className="text-gi-primary" /> : null;

    return (
        <div className={cn(
            'w-20 shrink-0 rounded border border-gi-border/40 bg-black/30 px-1.5 py-1 opacity-60',
            !template && !slot.hazard && 'opacity-30'
        )} title={`Slot ${index + 1}${wraps ? ' (after shuffle)' : ''}: ${label}`}>
            <div className="flex items-center gap-1">
                {icon}
                <span className="text-[9px] text-gi-text truncate">{label}</span>
            </div>
        </div>
    );
};

// ----------------------------------------------------------------------
// Station center: Output + Controls + Inputs (§11.B.2)
// ----------------------------------------------------------------------

const StationCenter = ({ areaId, snap, engine, onFocus }) => {
    const recipe = snap.selectedRecipeId ? getRecipe(snap.selectedRecipeId) : null;
    const output = recipe?.outputs?.[0];
    const outputItem = output ? getItem(output.itemId || output.id) : null;
    const [limitDraft, setLimitDraft] = useState(String(snap.productionLimit || 10));

    if (!snap.stationCardId) {
        return (
            <div className="relative h-full flex items-center justify-center text-[11px] text-gi-muted italic px-4 text-center">
                No station built at this outpost — claim one from a Booster Pack and build it via the Collection Binder.
            </div>
        );
    }

    return (
        <div className="relative h-full flex items-stretch gap-2 px-2 py-2 min-w-0">
            {/* Output slot (§11.B.2) — click opens Recipe Focus */}
            <button
                onClick={() => onFocus({ areaId, mode: 'recipe' })}
                title="Choose recipe (Recipe Focus)"
                className="w-36 shrink-0 flex flex-col justify-center gap-1 rounded-lg border border-gi-border/60 bg-black/40 px-2 py-1.5 hover:border-gi-gold transition-colors"
            >
                {recipe ? (
                    <>
                        <span className="text-[11px] font-bold text-gi-text truncate">{outputItem?.name || recipe.name}</span>
                        <span className="text-[9px] text-gi-muted">Crafted: {snap.producedCount}</span>
                        {snap.stationStatus === 'crafting' && <RefProgressBar areaId={areaId} barClassName="bg-gi-gold" />}
                    </>
                ) : (
                    <span className="text-[10px] text-gi-muted">Select a recipe…</span>
                )}
            </button>

            {/* Crafting controls */}
            <div className="w-32 shrink-0 flex flex-col justify-center gap-1.5">
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => engine.StationSlotManager.setProductionMode(areaId, 'infinite')}
                        title="Craft forever"
                        className={cn('flex-1 py-1 rounded border text-[9px] font-bold uppercase flex items-center justify-center gap-1 transition-colors',
                            snap.productionMode === 'infinite' ? 'border-gi-gold/60 bg-gi-gold/15 text-gi-text' : 'border-gi-border text-gi-muted hover:text-gi-text')}
                    >
                        <InfinityIcon size={11} />
                    </button>
                    <button
                        onClick={() => engine.StationSlotManager.setProductionMode(areaId, 'limited', parseInt(limitDraft, 10) || 0)}
                        title="Craft a set amount"
                        className={cn('flex-1 py-1 rounded border text-[9px] font-bold uppercase transition-colors',
                            snap.productionMode === 'limited' ? 'border-gi-gold/60 bg-gi-gold/15 text-gi-text' : 'border-gi-border text-gi-muted hover:text-gi-text')}
                    >
                        Limit
                    </button>
                </div>
                <input
                    type="number" min="1" value={limitDraft}
                    onChange={e => setLimitDraft(e.target.value)}
                    onBlur={() => snap.productionMode === 'limited' && engine.StationSlotManager.setProductionMode(areaId, 'limited', parseInt(limitDraft, 10) || 0)}
                    className="w-full bg-black/40 border border-gi-border rounded px-2 py-0.5 text-[10px] text-gi-text outline-none"
                />
                {recipe && (
                    <span className="text-[9px] text-gi-muted">{((recipe.baseTickTime || 10000) / 1000).toFixed(1)}s / craft</span>
                )}
            </div>

            {/* Input slots — up to 6 ingredients with live bank counts */}
            <div className="flex-1 min-w-0 grid grid-cols-2 content-center gap-1">
                {(recipe?.inputs || []).slice(0, 6).map((input, i) => (
                    <InputChip key={i} input={input} engine={engine} />
                ))}
                {!recipe && <span className="col-span-2 text-[10px] text-gi-muted italic">No recipe selected</span>}
            </div>
        </div>
    );
};

const InputChip = ({ input, engine }) => {
    const itemId = input.itemId || input.id || null;
    const item = itemId ? getItem(itemId) : null;
    const label = item?.name || (input.tag ? `Any ${input.tag}` : '?');
    const need = input.quantity || 1;
    const have = itemId ? engine.InventoryManager.getItemCount(itemId) : null;
    const short = have !== null && have < need;
    return (
        <div className={cn('flex items-center justify-between gap-1 rounded border px-1.5 py-0.5', short ? 'border-gi-danger/60 bg-gi-danger/10' : 'border-gi-border/50 bg-black/30')}>
            <span className="text-[9px] text-gi-text truncate">{label}</span>
            <span className={cn('text-[9px] tabular-nums shrink-0', short ? 'text-gi-danger font-bold' : 'text-gi-muted')}>
                {have !== null ? `${have}/${need}` : `×${need}`}
            </span>
        </div>
    );
};

// ----------------------------------------------------------------------
// Collapsed row (§6E) — internals fully unmounted
// ----------------------------------------------------------------------

export const CollapsedRow = ({ areaId, onExpand }) => {
    const snap = useAreaSnapshot(areaId);
    const areaSet = getAreaSet(areaId);
    if (!snap) return null;
    const statusInfo = snap.mode === 'stationed'
        ? { label: snap.stationStatus === 'crafting' ? 'Crafting' : 'Outpost', color: 'text-gi-gold' }
        : (STATUS_LABELS[snap.status] || STATUS_LABELS.paused);
    return (
        <button
            onClick={onExpand}
            className="w-full flex items-center gap-3 rounded-lg border border-gi-border bg-gi-surface/70 px-3 py-1.5 hover:border-gi-primary/50 transition-colors"
        >
            <ChevronDown size={12} className="text-gi-muted" />
            <span className="text-[11px] font-bold text-gi-text uppercase tracking-wider">{areaSet?.name || areaId}</span>
            <span className={cn('text-[9px] font-bold uppercase tracking-widest', statusInfo.color)}>{statusInfo.label}</span>
            {snap.assignedHeroId && <User size={11} className="text-gi-muted ml-auto" />}
        </button>
    );
};

export default AreaBannerRow;
