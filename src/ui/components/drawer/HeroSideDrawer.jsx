import React, { useMemo, useState, useEffect } from 'react';
import { useEngine } from '../../hooks/useEngine.js';
import { useGameState } from '../../hooks/useGameState.js';
import { cn } from '../../utils/cn.js';
import { ItemIcon } from '../base/ItemIcon.jsx';
import { getClass } from '../../../config/registries/classRegistry.js';
import { getAreaSet } from '../../../config/registries/areaSetRegistry.js';
import { useEntityDrag, DropTarget } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import { Users, X, Bed, MapPin, HeartCrack } from 'lucide-react';

/**
 * HeroSideDrawer — the Heroes pane as a full-height drawer sliding out of
 * the main (bubble) bar's side (owner design 2026-07-14; replaces the
 * bottom drawer's Heroes pane). Split-pane: roster + bench list on the
 * left, the selected hero's sheet on the right — portrait, vitals, the
 * four gear slots (weapon / armor / food / drink) with click-to-unequip,
 * and notable skills. Heroes drag out onto area hero slots; items drop
 * onto the sheet to equip.
 */
export const HeroSideDrawer = ({ panel, side = 'left', inspect, cardTier = 'md' }) => {
    const engine = useEngine();

    const roster = useGameState(state => (state.heroes || []).map(h => h.id), ['heroes_updated', 'state_changed']) || [];
    const bench = useGameState(state => (state.bench || []).map(h => h.id), ['heroes_updated', 'state_changed']) || [];

    // Auto-select first active hero when drawer opens
    useEffect(() => {
        if (panel.isOpen) {
            const firstHero = roster[0] || bench[0];
            if (firstHero && !inspect.selection) {
                inspect.set('hero', firstHero);
            }
        }
    }, [panel.isOpen, roster, bench, inspect]);

    // Honor a focus request (e.g. "customize hero" events)
    useEffect(() => {
        if (panel.focusHeroId) inspect.set('hero', panel.focusHeroId);
    }, [panel.focusHeroId, inspect]);

    const currentId = inspect.selection?.type === 'hero' ? inspect.selection.id : null;

    return (
        <div
            data-dnd-surface="drawer"
            data-dnd-region="drawer"
            className={cn(
                'absolute top-0 z-[110] w-80 max-w-[85vw] flex flex-col transition-transform duration-300 ease-in-out',
                'bg-gi-surface/90 backdrop-blur-md shadow-[0_0_40px_rgba(0,0,0,0.6)]',
                side === 'left' ? 'left-0 border-r border-gi-primary/30' : 'right-0 border-l border-gi-primary/30',
                panel.isOpen ? 'pointer-events-auto' : 'pointer-events-none',
                side === 'left'
                    ? (panel.isOpen ? 'translate-x-0' : '-translate-x-full')
                    : (panel.isOpen ? 'translate-x-0' : 'translate-x-full')
            )}
            style={{ bottom: cardTier === 'sm' ? 'calc(100vh - 208px)' : 'calc(100vh - 336px)' }}
        >
            {/* Header */}
            <div className="shrink-0 flex items-center justify-between px-3 py-2.5 border-b border-gi-border/50 bg-gi-base/60">
                <span className="flex items-center gap-1.5 text-[10px] font-bold gi-caps tracking-widest text-gi-text">
                    <Users size={12} className="text-gi-primary" /> Heroes
                </span>
                <button onClick={panel.close} title="Close" className="p-1 rounded text-gi-muted hover:text-gi-text transition-colors">
                     <X size={14} />
                </button>
            </div>

            {/* Roster list — also the recall target: drop a deployed hero here. */}
            <DropTarget
                id="hero-recall"
                surface={DND_SURFACE.DRAWER}
                accepts={p => p.kind === DRAG_KIND.HERO && !!p.from}
                onDrop={p => engine.HeroAssignmentManager.unassignHero(p.from.areaId)}
                acceptClassName="ring-1 ring-inset ring-gi-primary/60 bg-gi-primary/5"
                rejectClassName=""
                className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-2 flex flex-col gap-1.5"
            >
                {roster.map(id => (
                    <HeroListTile key={id} heroId={id} engine={engine} selected={id === currentId} onSelect={() => inspect.set('hero', id)} />
                ))}
                {bench.length > 0 && (
                    <div className="flex items-center gap-1.5 text-[9px] font-bold gi-caps tracking-widest text-gi-muted mt-2 mb-0.5 px-1">
                        <Bed size={10} /> Bench
                    </div>
                )}
                {bench.map(id => (
                    <HeroListTile key={id} heroId={id} engine={engine} benched selected={id === currentId} onSelect={() => inspect.set('hero', id)} />
                ))}
                {roster.length === 0 && bench.length === 0 && (
                    <span className="text-[10px] text-gi-muted italic p-2">
                        No heroes hired.
                    </span>
                )}
            </DropTarget>
        </div>
    );
};

/** Compact roster tile — click selects, drag deploys onto an area's hero slot. */
const HeroListTile = ({ heroId, engine, selected, benched = false, onSelect }) => {
    const hero = useGameState(
        state => [...(state.heroes || []), ...(state.bench || [])].find(h => h.id === heroId) || null,
        ['heroes_updated'],
        null,
        { deps: [heroId] }
    );
    if (!hero) return null;

    const areaId = engine.HeroAssignmentManager.getAreaForHero?.(heroId) || null;
    const areaName = areaId ? (getAreaSet(areaId)?.name || areaId) : null;
    const wounded = hero.status === 'wounded';

    // Drag source: deploy onto an area's hero slot (benched heroes can't deploy).
    const drag = useEntityDrag({
        id: `hero-src-${heroId}`,
        kind: DRAG_KIND.HERO,
        payload: { heroId, name: hero.name, spriteId: hero.spriteId, classId: hero.classId },
        sourceSurface: DND_SURFACE.DRAWER,
        disabled: benched
    });

    return (
        <button
            ref={drag.setNodeRef}
            onClick={onSelect}
            {...drag.handleProps}
            title={benched ? `${hero.name} (benched)` : `${hero.name} — drag onto an area's hero slot to deploy`}
            className={cn(
                'flex items-center gap-2 p-1.5 rounded-lg border text-left transition-colors w-full',
                selected ? 'border-gi-primary bg-gi-primary/10' : 'border-gi-border/50 bg-black/30 hover:border-gi-muted',
                benched && 'opacity-60',
                !benched && 'cursor-grab active:cursor-grabbing',
                drag.isDragging && 'opacity-40'
            )}
        >
            <div className="shrink-0" style={{ imageRendering: 'pixelated' }}>
                <ItemIcon item={{ sprite: hero.spriteId, classId: hero.classId }} size={32} />
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                    <span className="text-[11px] font-bold text-gi-text truncate">{hero.name}</span>
                    {wounded && <HeartCrack size={10} className="text-gi-danger shrink-0" />}
                </div>
                <div className="text-[8px] text-gi-muted gi-caps truncate flex items-center gap-1">
                    {getClass(hero.classId)?.name || hero.classId}
                    {areaName && (
                        <span className="flex items-center gap-0.5 text-gi-primary/80">
                            <MapPin size={8} /> {areaName}
                        </span>
                    )}
                </div>
            </div>
        </button>
    );
};

export default HeroSideDrawer;
