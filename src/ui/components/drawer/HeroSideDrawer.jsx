import React, { useMemo, useState, useEffect } from 'react';
import { useEngine } from '../../hooks/useEngine.js';
import { useGameState } from '../../hooks/useGameState.js';
import { cn } from '../../utils/cn.js';
import { ItemIcon } from '../base/ItemIcon.jsx';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { getClass } from '../../../config/registries/classRegistry.js';
import { getTrait } from '../../../config/registries/traitRegistry.js';
import { getAreaSet } from '../../../config/registries/areaSetRegistry.js';
import { SLOT_INFO } from '../../../config/registries/equipmentConstants.js';
import { beginNativeDrag, endNativeDrag, getNativeDrag, readDropPayload } from '../../dnd/nativeDrag.js';
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
export const HeroSideDrawer = ({ panel, side = 'left' }) => {
    const engine = useEngine();
    const [selectedId, setSelectedId] = useState(null);

    const roster = useGameState(state => (state.heroes || []).map(h => h.id), ['heroes_updated', 'state_changed']) || [];
    const bench = useGameState(state => (state.bench || []).map(h => h.id), ['heroes_updated', 'state_changed']) || [];

    // Honor a focus request (e.g. "customize hero" events), else keep a
    // valid selection.
    useEffect(() => {
        if (panel.focusHeroId) setSelectedId(panel.focusHeroId);
    }, [panel.focusHeroId]);
    const currentId = [...roster, ...bench].includes(selectedId) ? selectedId : roster[0] || bench[0] || null;

    if (!panel.isOpen) return null;

    return (
        <div
            className={cn(
                'absolute inset-y-0 z-[110] w-[30rem] max-w-[85vw] flex flex-col pointer-events-auto',
                'bg-gi-surface/90 backdrop-blur-md shadow-[0_0_40px_rgba(0,0,0,0.6)]',
                side === 'left' ? 'left-0 border-r border-gi-primary/30' : 'right-0 border-l border-gi-primary/30'
            )}
        >
            {/* Header */}
            <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-gi-border/50 bg-gi-base/60">
                <span className="flex items-center gap-2 text-[11px] font-bold gi-caps tracking-widest text-gi-text">
                    <Users size={13} className="text-gi-primary" /> Heroes
                    <span className="text-gi-muted font-normal normal-case">
                        {roster.length} active · {bench.length} benched
                    </span>
                </span>
                <button onClick={panel.close} title="Close" className="p-1 rounded text-gi-muted hover:text-gi-text transition-colors">
                    <X size={14} />
                </button>
            </div>

            {/* Split panes */}
            <div className="flex-1 min-h-0 flex">
                {/* Roster list */}
                <div className="w-44 shrink-0 border-r border-gi-border/40 overflow-y-auto custom-scrollbar p-2 flex flex-col gap-1.5">
                    {roster.map(id => (
                        <HeroListTile key={id} heroId={id} engine={engine} selected={id === currentId} onSelect={() => setSelectedId(id)} />
                    ))}
                    {bench.length > 0 && (
                        <div className="flex items-center gap-1.5 text-[9px] font-bold gi-caps tracking-widest text-gi-muted mt-2 mb-0.5 px-1">
                            <Bed size={10} /> Bench
                        </div>
                    )}
                    {bench.map(id => (
                        <HeroListTile key={id} heroId={id} engine={engine} benched selected={id === currentId} onSelect={() => setSelectedId(id)} />
                    ))}
                    {roster.length === 0 && bench.length === 0 && (
                        <span className="text-[10px] text-gi-muted italic p-2">
                            No heroes hired — recruit your first hero at the Guild Hall.
                        </span>
                    )}
                </div>

                {/* Hero sheet */}
                <div className="flex-1 min-w-0 overflow-y-auto custom-scrollbar">
                    {currentId
                        ? <HeroSheet key={currentId} heroId={currentId} engine={engine} benched={bench.includes(currentId)} />
                        : <div className="h-full flex items-center justify-center text-gi-muted/50 text-xs gi-caps tracking-widest">No hero selected</div>}
                </div>
            </div>
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

    return (
        <button
            onClick={onSelect}
            draggable={!benched}
            onDragStart={!benched ? (e => beginNativeDrag(e, { kind: 'hero', heroId })) : undefined}
            onDragEnd={!benched ? endNativeDrag : undefined}
            title={benched ? `${hero.name} (benched)` : `${hero.name} — drag onto an area's hero slot to deploy`}
            className={cn(
                'flex items-center gap-2 p-1.5 rounded-lg border text-left transition-colors w-full',
                selected ? 'border-gi-primary bg-gi-primary/10' : 'border-gi-border/50 bg-black/30 hover:border-gi-muted',
                benched && 'opacity-60',
                !benched && 'cursor-grab active:cursor-grabbing'
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

/** The selected hero's full sheet: portrait, vitals, gear, skills. */
const HeroSheet = ({ heroId, engine, benched }) => {
    const hero = useGameState(
        state => [...(state.heroes || []), ...(state.bench || [])].find(h => h.id === heroId) || null,
        ['heroes_updated', 'inventory_updated'],
        null,
        { deps: [heroId] }
    );
    const [dragOver, setDragOver] = useState(false);
    if (!hero) return null;

    const className = getClass(hero.classId)?.name || hero.classId || 'Hero';
    const traitName = hero.traitId ? (getTrait(hero.traitId)?.name || '') : '';
    const skills = Object.entries(hero.skills || {})
        .filter(([, s]) => (s?.level ?? 1) > 1)
        .sort((a, b) => (b[1].level || 0) - (a[1].level || 0))
        .slice(0, 8);

    // Item drops equip (same payload the banner hero slot accepts).
    const dropProps = {
        onDragOver: e => { if (getNativeDrag()?.kind === 'item') { e.preventDefault(); setDragOver(true); } },
        onDragLeave: () => setDragOver(false),
        onDrop: e => {
            e.preventDefault();
            setDragOver(false);
            const payload = readDropPayload(e);
            if (payload?.kind === 'item') engine.EquipmentManager.equipItem(heroId, payload.itemId);
        }
    };

    return (
        <div {...dropProps} className={cn('p-4 flex flex-col gap-4 min-h-full transition-colors', dragOver && 'bg-gi-primary/5')}>
            {/* Identity */}
            <div className="flex items-center gap-3">
                <div className="shrink-0 rounded-xl border border-gi-border bg-black/40 p-1.5" style={{ imageRendering: 'pixelated' }}>
                    <ItemIcon item={{ sprite: hero.spriteId, classId: hero.classId }} size={64} />
                </div>
                <div className="min-w-0">
                    <div className="text-sm font-bold text-gi-text truncate">{hero.name}</div>
                    <div className="text-[9px] text-gi-muted gi-caps">{className}{traitName ? ` · ${traitName}` : ''}</div>
                    <button
                        onClick={() => (benched ? engine.HeroManager.moveHeroToActive(heroId) : engine.HeroManager.moveHeroToBench(heroId))}
                        className="mt-1.5 px-2 py-0.5 rounded border border-gi-border text-[8px] font-bold gi-caps text-gi-muted hover:text-gi-text hover:border-gi-muted transition-colors"
                    >
                        {benched ? 'Move to roster' : 'Move to bench'}
                    </button>
                </div>
            </div>

            {/* Vitals */}
            <div className="flex flex-col gap-1.5">
                <SheetBar label="HP" value={Math.round(hero.hp?.current ?? 0)} max={hero.hp?.max ?? 100} barClass="bg-gi-danger" />
                <SheetBar label="EN" value={Math.round(hero.energy?.current ?? 0)} max={hero.energy?.max ?? 100} barClass="bg-gi-gold" />
            </div>

            {/* Gear — the four slots; click the X (or the filled slot) to unequip */}
            <div className="flex flex-col gap-1.5">
                <span className="text-[9px] font-bold gi-caps tracking-widest text-gi-muted">Gear</span>
                <div className="grid grid-cols-2 gap-1.5">
                    {Object.entries(SLOT_INFO).map(([slot, info]) => {
                        const itemId = hero.equipment?.[slot] || null;
                        const item = itemId ? getItem(itemId) : null;
                        return (
                            <div
                                key={slot}
                                title={item ? `${item.name} — click to unequip` : `${info.label} — drag an item from the Bank to equip`}
                                onClick={item ? () => engine.EquipmentManager.unequipItem(heroId, slot) : undefined}
                                className={cn(
                                    'flex items-center gap-2 p-1.5 rounded-lg border min-h-[44px] transition-colors',
                                    item
                                        ? 'border-gi-border bg-black/40 cursor-pointer hover:border-gi-danger/60 group'
                                        : 'border-dashed border-gi-border/40 bg-black/20'
                                )}
                            >
                                {item ? (
                                    <>
                                        <ItemIcon item={item} size={28} className="shrink-0" />
                                        <span className="text-[9px] font-bold text-gi-text truncate flex-1">{item.name}</span>
                                        <X size={10} className="text-gi-muted group-hover:text-gi-danger shrink-0" />
                                    </>
                                ) : (
                                    <>
                                        <span className="text-base opacity-40 shrink-0">{info.icon}</span>
                                        <span className="text-[8px] gi-caps text-gi-muted/60">{info.label}</span>
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Skills */}
            {skills.length > 0 && (
                <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-bold gi-caps tracking-widest text-gi-muted">Skills</span>
                    {skills.map(([id, s]) => (
                        <div key={id} className="flex items-center justify-between text-[10px]">
                            <span className="text-gi-muted capitalize">{id}</span>
                            <span className="text-gi-text font-bold tabular-nums">Lv {s.level}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const SheetBar = ({ label, value, max, barClass }) => (
    <div className="flex items-center gap-1.5">
        <span className="text-[9px] font-bold text-gi-muted w-5">{label}</span>
        <div className="flex-1 h-1.5 bg-black/50 rounded-full overflow-hidden">
            <div className={cn('h-full transition-all duration-300', barClass)} style={{ width: `${Math.min(100, (value / Math.max(1, max)) * 100)}%` }} />
        </div>
        <span className="text-[9px] text-gi-muted tabular-nums w-9 text-right">{value}/{max}</span>
    </div>
);

export default HeroSideDrawer;
