import React, { useMemo, useState, useEffect } from 'react';
import { useEngine } from '../../hooks/useEngine.js';
import { useGameState } from '../../hooks/useGameState.js';
import { cn } from '../../utils/cn.js';
import { getClass } from '../../../config/registries/classRegistry.js';
import { getTrait } from '../../../config/registries/traitRegistry.js';
import { getSkill } from '../../../config/registries/skillRegistry.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { getAreaSet } from '../../../config/registries/areaSetRegistry.js';
import { unequipItem } from '../../../systems/equipment/EquipmentManager.js';
import { previewRetirementInfluence } from '../../../utils/RetirementFormula.js';
import { beginNativeDrag, endNativeDrag, getNativeDrag, readDropPayload } from '../../dnd/nativeDrag.js';
import { ItemIcon } from '../base/ItemIcon.jsx';
import {
    Users, MapPin, Bed, Sword, Save, AlertTriangle, GripVertical
} from 'lucide-react';

/**
 * Heroes pane (Phase 7, re-cut for overhaul Phase 2) — absorbs the left
 * sidebar (roster), the Tavern drawer (bench + recruitment; owner decision
 * 2026-07-08: the tavern is retired outright), and HeroCustomizeModal
 * (rename/avatar, in the inspection body).
 *
 * Overhaul Phase 2: this component is just the browsing grid now — the
 * inspection column moved to the drawer-wide shared InspectionPanel.
 * Selection is lifted: clicking a tile calls `onInspect('hero', id)`.
 * `HeroInspection` is exported for the shared panel to render.
 * Hero tiles are native drag sources for banner Hero Slots.
 */

const AVAILABLE_SPRITES = [
    { id: 'hero_adventure', name: 'Adventurer' },
    { id: 'hero_knight', name: 'Knight' },
    { id: 'hero_rogue', name: 'Rogue' },
    { id: 'hero_warlock', name: 'Warlock' },
    { id: 'hero_wizard', name: 'Wizard' },
];

export const HeroesTab = ({ filter, selectedHeroId, onInspect }) => {
    const engine = useEngine();

    // Auto-open payloads can pre-select a hero (e.g. legacy customize event)
    useEffect(() => {
        if (filter?.heroId) onInspect('hero', filter.heroId);
    }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

    const rosterIds = useGameState(state => (state.heroes || []).map(h => h.id), ['heroes_updated']);
    const benchIds = useGameState(state => (state.bench || []).map(h => h.id), ['heroes_updated']);
    // guild_upgrades_updated: the roster cap is a Guild Hall upgrade (Phase 4)
    const rosterLimit = useGameState(state => state.progress?.rosterLimit || 5, ['heroes_updated', 'guild_upgrades_updated']);

    return (
        <div className="h-full min-h-0 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-5">
                {/* Active roster */}
                <section>
                    <SectionHeader
                        icon={<Users size={12} />}
                        label={`Active Roster (${rosterIds.length}/${rosterLimit})`}
                        hint="Drag a hero onto an area's Hero Slot to deploy them"
                    />
                    {rosterIds.length === 0 ? (
                        <EmptyHint text="No heroes hired — recruit your first hero below." />
                    ) : (
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-2">
                            {rosterIds.map(id => (
                                <HeroTile key={id} heroId={id} engine={engine} selected={selectedHeroId === id} onSelect={() => onInspect('hero', id)} />
                            ))}
                        </div>
                    )}
                </section>

                {/* Bench */}
                <section>
                    <SectionHeader
                        icon={<Bed size={12} />}
                        label={`Bench (${benchIds.length})`}
                        hint="Benched heroes don't count toward the roster limit"
                    />
                    {benchIds.length === 0 ? (
                        <EmptyHint text="Bench empty." />
                    ) : (
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-2">
                            {benchIds.map(id => (
                                <HeroTile key={id} heroId={id} engine={engine} benched selected={selectedHeroId === id} onSelect={() => onInspect('hero', id)} />
                            ))}
                        </div>
                    )}
                </section>

                {/* Recruitment moved to the Guild Hall (overhaul Phase 4,
                    spec §COMP-HERO "No Recruitment"). */}
        </div>
    );
};

const SectionHeader = ({ icon, label, hint }) => (
    <div className="flex items-baseline gap-3 mb-2">
        <span className="flex items-center gap-1.5 text-[10px] font-bold text-gi-primary gi-caps tracking-widest">{icon}{label}</span>
        {hint && <span className="text-[9px] text-gi-muted italic">{hint}</span>}
    </div>
);

const EmptyHint = ({ text }) => (
    <div className="px-3 py-4 rounded-lg border border-dashed border-gi-border/40 text-[11px] text-gi-muted italic">{text}</div>
);

const GEAR_SLOTS = ['weapon', 'armor', 'food', 'drink'];

/**
 * One hero in the roster/bench grids (overhaul Phase 3, spec §COMP-HERO):
 * portrait + class + name + mini equipment slots + drag handle. NO vitals
 * (HP/EN live on inspection — owner decision). A native drag source
 * (kind 'hero') for banner Hero Slots, and a drop target for Bank items
 * (kind 'item') — drop gear/provisions on the card to equip (§COMP-BANK).
 */
const HeroTile = ({ heroId, engine, benched = false, selected, onSelect }) => {
    const [dragOver, setDragOver] = React.useState(false);
    // Value projection (not the raw hero object): heroes mutate in place, so
    // fresh primitives are what makes the staleness check useful.
    const hero = useGameState(
        state => {
            const h = (state.heroes || []).find(x => x.id === heroId) || (state.bench || []).find(x => x.id === heroId);
            if (!h) return null;
            return {
                name: h.name,
                classId: h.classId,
                spriteId: h.spriteId,
                className: h.className || getClass(h.classId)?.name || '',
                status: h.status,
                equipment: { ...(h.equipment || {}) }
            };
        },
        ['heroes_updated', 'hero_equipment_changed'],
        null,
        { deps: [heroId] }
    );
    if (!hero) return null;

    const areaId = engine.HeroAssignmentManager.getAreaForHero?.(heroId);
    const areaName = areaId ? (getAreaSet(areaId)?.name || areaId) : null;
    const wounded = hero.status === 'wounded';

    return (
        <button
            onClick={onSelect}
            draggable
            onDragStart={e => beginNativeDrag(e, { kind: 'hero', heroId })}
            onDragEnd={endNativeDrag}
            onDragOver={e => {
                if (getNativeDrag()?.kind === 'item') {
                    e.preventDefault();
                    setDragOver(true);
                }
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => {
                e.preventDefault();
                setDragOver(false);
                const payload = readDropPayload(e);
                if (payload?.kind === 'item') engine.EquipmentManager.equipItem(heroId, payload.itemId);
            }}
            title={`${hero.name} — drag onto an area to deploy; drop an item here to equip`}
            className={cn(
                'flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors cursor-grab active:cursor-grabbing',
                selected ? 'border-gi-primary bg-gi-primary/10' : 'border-gi-border bg-gi-base/60 hover:border-gi-muted',
                benched && 'opacity-80',
                dragOver && 'ring-2 ring-gi-primary border-gi-primary'
            )}
        >
            {/* Portrait */}
            <div className={cn(
                'w-10 h-10 rounded-full border-2 flex items-center justify-center shrink-0 overflow-hidden',
                wounded ? 'border-gi-danger bg-gi-danger/10' : 'border-gi-primary/50 bg-gi-primary/10'
            )}>
                <ItemIcon item={{ sprite: hero.spriteId || hero.classId, classId: hero.classId }} size={32} />
            </div>

            <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold text-gi-text truncate">{hero.name}</div>
                <div className="text-[9px] text-gi-muted truncate">{hero.className}</div>
                {/* Mini equipment slots */}
                <div className="flex gap-1 mt-1">
                    {GEAR_SLOTS.map(slot => {
                        const itemId = hero.equipment?.[slot];
                        const item = itemId ? getItem(itemId) : null;
                        return (
                            <span
                                key={slot}
                                title={item ? `${slot}: ${item.name}` : `${slot}: empty`}
                                className={cn(
                                    'w-5 h-5 rounded border flex items-center justify-center overflow-hidden',
                                    item ? 'border-gi-primary/40 bg-gi-primary/5' : 'border-dashed border-gi-border/50'
                                )}
                            >
                                {item && <ItemIcon item={item} size={16} />}
                            </span>
                        );
                    })}
                </div>
            </div>

            <div className="shrink-0 flex flex-col items-end gap-1">
                {wounded ? (
                    <span className="text-[9px] font-bold text-gi-danger gi-caps">Injured</span>
                ) : areaName ? (
                    <span className="text-[9px] text-gi-primary flex items-center gap-0.5"><MapPin size={9} />{areaName}</span>
                ) : benched ? (
                    <span className="text-[9px] text-gi-muted gi-caps">Benched</span>
                ) : (
                    <span className="text-[9px] text-gi-muted gi-caps">Idle</span>
                )}
                <GripVertical size={12} className="text-gi-muted/60" />
            </div>
        </button>
    );
};

// ----------------------------------------------------------------------
// Inspection body — details + every hero action. Rendered by the shared
// InspectionPanel (overhaul Phase 2), exported for it.
// ----------------------------------------------------------------------

export const HeroInspection = ({ heroId, onBench, engine, onGone }) => {
    // Value projection — see HeroTile for why the raw hero object won't do.
    const hero = useGameState(
        state => {
            const h = (state.heroes || []).find(x => x.id === heroId) || (state.bench || []).find(x => x.id === heroId);
            if (!h) return null;
            return {
                id: h.id,
                name: h.name,
                classId: h.classId,
                spriteId: h.spriteId,
                className: h.className || getClass(h.classId)?.name || 'Hero',
                traitName: h.traitName || getTrait(h.traitId)?.name || '',
                status: h.status,
                hp: Math.round(h.hp?.current ?? 0), hpMax: h.hp?.max ?? 100,
                energy: Math.round(h.energy?.current ?? 0), energyMax: h.energy?.max ?? 100,
                skillLevels: Object.fromEntries(Object.entries(h.skills || {}).map(([k, s]) => [k, s?.level ?? 1])),
                equipment: { ...(h.equipment || {}) }
            };
        },
        ['heroes_updated', 'hero_equipment_changed'],
        null,
        { deps: [heroId] }
    );

    const [nameDraft, setNameDraft] = useState('');
    const [spriteDraft, setSpriteDraft] = useState('');
    const [confirmRetire, setConfirmRetire] = useState(false);

    useEffect(() => {
        if (hero) {
            setNameDraft(hero.name || '');
            setSpriteDraft(hero.spriteId || hero.classId || 'hero_adventure');
            setConfirmRetire(false);
        }
    }, [heroId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Hero retired/removed while inspected — clear the selection upstream.
    useEffect(() => {
        if (!hero) onGone?.();
    }, [hero, onGone]);

    if (!hero) return null;

    const areaId = engine.HeroAssignmentManager.getAreaForHero?.(heroId);
    const areaName = areaId ? (getAreaSet(areaId)?.name || areaId) : null;
    const unlockedAreaIds = engine.GameState.collection?.unlockedAreaSets || [];
    const profileDirty = nameDraft.trim() && (nameDraft.trim() !== hero.name || spriteDraft !== (hero.spriteId || hero.classId));
    // The payout formula wants the full hero object, not our display projection
    const retirePayout = previewRetirementInfluence(engine.HeroManager.getHero(heroId) || {});
    // All 15 skills, in registry order (combat first) — each levels independently.
    const skills = Object.entries(hero.skillLevels);

    const handleRetire = () => {
        if (!confirmRetire) return setConfirmRetire(true);
        // Deck-loop assignment isn't hero.assignedCardId — free the area first.
        if (areaId) engine.HeroAssignmentManager.unassignHero(areaId);
        const result = engine.HeroManager.retireHero(heroId);
        if (!result.success) {
            engine.EventBus.publish('ui:notify', {
                message: result.reason || 'Retirement blocked', type: 'error'
            });
            setConfirmRetire(false);
        }
    };

    return (
        <div className="p-4 flex flex-col gap-4">
            {/* Identity + customize (absorbs HeroCustomizeModal) */}
            <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full border-2 border-gi-primary/60 bg-gi-primary/10 flex items-center justify-center shrink-0">
                    <ItemIcon item={{ sprite: spriteDraft, classId: spriteDraft }} size={44} />
                </div>
                <div className="min-w-0">
                    <input
                        value={nameDraft}
                        onChange={e => setNameDraft(e.target.value)}
                        className="w-full bg-black/40 border border-gi-border rounded px-2 py-1 text-sm font-bold text-gi-text outline-none focus:border-gi-primary transition-colors"
                    />
                    <div className="text-[10px] text-gi-muted mt-1 truncate">
                        {hero.className}{hero.traitName ? ` · ${hero.traitName}` : ''}
                    </div>
                </div>
            </div>

            {/* Avatar picker */}
            <div className="flex items-center gap-1.5">
                {AVAILABLE_SPRITES.map(sprite => (
                    <button
                        key={sprite.id}
                        onClick={() => setSpriteDraft(sprite.id)}
                        title={sprite.name}
                        className={cn(
                            'p-1 rounded border transition-colors',
                            spriteDraft === sprite.id ? 'border-gi-primary bg-gi-primary/15' : 'border-gi-border/50 opacity-60 hover:opacity-100'
                        )}
                    >
                        <ItemIcon item={{ sprite: sprite.id, classId: sprite.id }} size={28} />
                    </button>
                ))}
                {profileDirty && (
                    <button
                        onClick={() => engine.HeroManager.updateHeroProfile(heroId, { name: nameDraft.trim(), spriteId: spriteDraft })}
                        title="Save name & avatar"
                        className="ml-auto p-1.5 rounded border border-gi-success/50 text-gi-success hover:bg-gi-success/10 transition-colors"
                    >
                        <Save size={13} />
                    </button>
                )}
            </div>

            {/* Vitals + status */}
            <div className="flex flex-col gap-1.5">
                <StatLine label="Status" value={hero.status === 'wounded' ? 'Injured' : (areaName ? `Deployed @ ${areaName}` : onBench ? 'Benched' : 'Idle')} />
                <StatLine label="Health" value={`${hero.hp} / ${hero.hpMax}`} />
                <StatLine label="Energy" value={`${hero.energy} / ${hero.energyMax}`} />
                {skills.map(([skillId, level]) => (
                    <StatLine key={skillId} label={getSkill(skillId)?.name || skillId} value={`Lv ${level}`} />
                ))}
            </div>

            {/* Equipment (click to unequip; drag items from the Bank tab to equip) */}
            <div className="flex flex-col gap-1.5">
                <span className="text-[9px] font-bold text-gi-muted uppercase tracking-widest">Gear (click to unequip)</span>
                <div className="grid grid-cols-2 gap-1.5">
                    {['weapon', 'armor', 'food', 'drink'].map(slot => {
                        const itemId = hero.equipment?.[slot];
                        const item = itemId ? getItem(itemId) : null;
                        return (
                            <button
                                key={slot}
                                onClick={() => itemId && unequipItem(heroId, slot)}
                                disabled={!itemId}
                                title={item ? `${item.name} — click to unequip` : `${slot} (empty)`}
                                className={cn(
                                    'px-2 py-1.5 rounded border text-left transition-colors',
                                    itemId ? 'border-gi-primary/40 bg-gi-primary/5 hover:border-gi-danger' : 'border-dashed border-gi-border/50'
                                )}
                            >
                                <div className="text-[8px] font-bold text-gi-muted uppercase">{slot}</div>
                                <div className={cn('text-[10px] truncate', itemId ? 'text-gi-text font-bold' : 'text-gi-muted italic')}>
                                    {item?.name || 'Empty'}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-1.5 pt-2 border-t border-gi-border/40">
                {/* Deploy */}
                {!onBench && hero.status !== 'wounded' && (
                    <AreaAssignPicker heroId={heroId} areaId={areaId} unlockedAreaIds={unlockedAreaIds} engine={engine} />
                )}
                {areaId && (
                    <ActionButton onClick={() => engine.HeroAssignmentManager.unassignHero(areaId)} label={`Recall from ${areaName}`} />
                )}

                {/* Bench / activate */}
                {onBench ? (
                    <ActionButton
                        onClick={() => {
                            const result = engine.HeroManager.moveHeroToActive(heroId);
                            if (result && !result.success) {
                                engine.EventBus.publish('ui:notify', { message: 'Active roster is full!', type: 'error' });
                            }
                        }}
                        label="Move to Active Roster"
                    />
                ) : (
                    <ActionButton
                        onClick={() => {
                            if (areaId) engine.HeroAssignmentManager.unassignHero(areaId);
                            engine.HeroManager.moveHeroToBench(heroId);
                        }}
                        label="Move to Bench"
                    />
                )}

                {/* Retire */}
                <button
                    onClick={handleRetire}
                    onMouseLeave={() => setConfirmRetire(false)}
                    className={cn(
                        'flex items-center justify-center gap-1.5 px-2 py-1.5 rounded border text-[10px] font-bold uppercase tracking-wide transition-colors',
                        confirmRetire
                            ? 'border-gi-danger bg-gi-danger/20 text-gi-danger'
                            : 'border-gi-border text-gi-muted hover:text-gi-danger hover:border-gi-danger'
                    )}
                >
                    {confirmRetire ? <><AlertTriangle size={11} /> Confirm retire?</> : <>Retire (+{retirePayout} Influence)</>}
                </button>
            </div>
        </div>
    );
};

const StatLine = ({ label, value }) => (
    <div className="flex items-center justify-between gap-2 text-[10px]">
        <span className="text-gi-muted capitalize">{label}</span>
        <span className="text-gi-text font-bold tabular-nums">{value}</span>
    </div>
);

const ActionButton = ({ onClick, label }) => (
    <button
        onClick={onClick}
        className="px-2 py-1.5 rounded border border-gi-border text-[10px] font-bold uppercase tracking-wide text-gi-text hover:border-gi-primary transition-colors"
    >
        {label}
    </button>
);

const AreaAssignPicker = ({ heroId, areaId, unlockedAreaIds, engine }) => {
    const [open, setOpen] = useState(false);
    return (
        <div className="relative">
            <button
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded border border-gi-primary/40 bg-gi-primary/10 text-[10px] font-bold uppercase tracking-wide text-gi-text hover:bg-gi-primary/20 transition-colors"
            >
                <Sword size={11} /> {areaId ? 'Redeploy to…' : 'Deploy to Area…'}
            </button>
            {open && (
                <div className="mt-1 flex flex-col gap-1">
                    {unlockedAreaIds.map(id => (
                        <button
                            key={id}
                            disabled={id === areaId}
                            onClick={() => { engine.HeroAssignmentManager.assignHeroToArea(heroId, id); setOpen(false); }}
                            className="px-2 py-1 rounded border border-gi-border text-[10px] text-left text-gi-text hover:border-gi-primary transition-colors disabled:opacity-40"
                        >
                            {getAreaSet(id)?.name || id}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};


export default HeroesTab;
