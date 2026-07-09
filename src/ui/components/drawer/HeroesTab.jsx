import React, { useMemo, useState, useEffect } from 'react';
import { useEngine } from '../../hooks/useEngine.js';
import { useGameState } from '../../hooks/useGameState.js';
import { cn } from '../../utils/cn.js';
import { getClass } from '../../../config/registries/classRegistry.js';
import { getTrait } from '../../../config/registries/traitRegistry.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { getAreaSet } from '../../../config/registries/areaSetRegistry.js';
import { RecruitSystem } from '../../../systems/cards/RecruitSystem.js';
import { unequipItem } from '../../../systems/equipment/EquipmentManager.js';
import { previewRetirementInfluence } from '../../../utils/RetirementFormula.js';
import { beginNativeDrag, endNativeDrag } from '../../dnd/nativeDrag.js';
import { ItemIcon } from '../base/ItemIcon.jsx';
import {
    User, Users, Coins, MapPin, Bed, Sword, Save, Beer, Dices, AlertTriangle
} from 'lucide-react';

/**
 * Heroes tab (Phase 7) — absorbs the left sidebar (roster), the Tavern
 * drawer (bench + recruitment; owner decision 2026-07-08: the tavern is
 * retired outright), and HeroCustomizeModal (rename/avatar, in the
 * inspection panel).
 *
 * Center pane: active roster, bench, recruitment. Left pane: inspection
 * of the selected hero with every hero action (assign/bench/customize/
 * retire). Hero tiles are native drag sources for banner Hero Slots.
 */

const AVAILABLE_SPRITES = [
    { id: 'hero_adventure', name: 'Adventurer' },
    { id: 'hero_knight', name: 'Knight' },
    { id: 'hero_rogue', name: 'Rogue' },
    { id: 'hero_warlock', name: 'Warlock' },
    { id: 'hero_wizard', name: 'Wizard' },
];

export const HeroesTab = ({ filter }) => {
    const engine = useEngine();
    const [selectedHeroId, setSelectedHeroId] = useState(null);

    // Auto-open payloads can pre-select a hero (e.g. legacy customize event)
    useEffect(() => {
        if (filter?.heroId) setSelectedHeroId(filter.heroId);
    }, [filter]);

    const rosterIds = useGameState(state => (state.heroes || []).map(h => h.id), ['heroes_updated']);
    const benchIds = useGameState(state => (state.bench || []).map(h => h.id), ['heroes_updated']);
    const rosterLimit = useGameState(state => state.progress?.rosterLimit || 5, ['heroes_updated']);
    const influence = useGameState(state => state.currency?.influence || 0, ['currency_changed']);

    const selectedOnBench = benchIds.includes(selectedHeroId);

    return (
        <div className="flex h-full min-h-0">
            {/* Left: inspection panel */}
            <div className="w-80 shrink-0 border-r border-gi-border/50 bg-gi-base/40 overflow-y-auto custom-scrollbar">
                {selectedHeroId ? (
                    <HeroInspection
                        heroId={selectedHeroId}
                        onBench={selectedOnBench}
                        engine={engine}
                        onGone={() => setSelectedHeroId(null)}
                    />
                ) : (
                    <div className="h-full flex flex-col items-center justify-center gap-3 text-gi-muted/50 p-6 text-center">
                        <Users size={36} />
                        <span className="text-xs uppercase tracking-widest font-bold">Select a hero to inspect</span>
                    </div>
                )}
            </div>

            {/* Center: roster / bench / recruitment */}
            <div className="flex-1 min-w-0 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-5">
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
                                <HeroTile key={id} heroId={id} engine={engine} selected={selectedHeroId === id} onSelect={() => setSelectedHeroId(id)} />
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
                                <HeroTile key={id} heroId={id} engine={engine} benched selected={selectedHeroId === id} onSelect={() => setSelectedHeroId(id)} />
                            ))}
                        </div>
                    )}
                </section>

                {/* Recruitment (absorbs the Tavern) */}
                <RecruitmentSection influence={influence} />
            </div>
        </div>
    );
};

const SectionHeader = ({ icon, label, hint }) => (
    <div className="flex items-baseline gap-3 mb-2">
        <span className="flex items-center gap-1.5 text-[10px] font-bold text-gi-primary uppercase tracking-widest">{icon}{label}</span>
        {hint && <span className="text-[9px] text-gi-muted italic">{hint}</span>}
    </div>
);

const EmptyHint = ({ text }) => (
    <div className="px-3 py-4 rounded-lg border border-dashed border-gi-border/40 text-[11px] text-gi-muted italic">{text}</div>
);

/** One hero in the roster/bench grids — a native drag source (kind 'hero'). */
const HeroTile = ({ heroId, engine, benched = false, selected, onSelect }) => {
    // Value projection (not the raw hero object): vitals mutate in place, so
    // fresh primitives are what makes the staleness check useful.
    const hero = useGameState(
        state => {
            const h = (state.heroes || []).find(x => x.id === heroId) || (state.bench || []).find(x => x.id === heroId);
            if (!h) return null;
            return {
                name: h.name,
                className: h.className || getClass(h.classId)?.name || '',
                status: h.status,
                hp: Math.round(h.hp?.current ?? 0), hpMax: h.hp?.max ?? 100,
                energy: Math.round(h.energy?.current ?? 0), energyMax: h.energy?.max ?? 100
            };
        },
        ['heroes_updated'],
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
            className={cn(
                'flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors cursor-grab active:cursor-grabbing',
                selected ? 'border-gi-primary bg-gi-primary/10' : 'border-gi-border bg-gi-base/60 hover:border-gi-muted',
                benched && 'opacity-80'
            )}
        >
            <div className={cn(
                'w-10 h-10 rounded-full border-2 flex items-center justify-center text-base font-black uppercase shrink-0',
                wounded ? 'border-gi-danger text-gi-danger bg-gi-danger/10' : 'border-gi-primary/50 text-gi-text bg-gi-primary/10'
            )}>
                {hero.name?.[0] || <User size={14} />}
            </div>
            <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold text-gi-text truncate">{hero.name}</div>
                <div className="text-[9px] text-gi-muted truncate">{hero.className}</div>
                <div className="flex gap-1 mt-1">
                    <MiniBar value={hero.hp} max={hero.hpMax} barClass="bg-gi-danger" />
                    <MiniBar value={hero.energy} max={hero.energyMax} barClass="bg-gi-gold" />
                </div>
            </div>
            <div className="shrink-0 text-right">
                {wounded ? (
                    <span className="text-[9px] font-bold text-gi-danger uppercase">Injured</span>
                ) : areaName ? (
                    <span className="text-[9px] text-gi-primary flex items-center gap-0.5"><MapPin size={9} />{areaName}</span>
                ) : benched ? (
                    <span className="text-[9px] text-gi-muted uppercase">Benched</span>
                ) : (
                    <span className="text-[9px] text-gi-muted uppercase">Idle</span>
                )}
            </div>
        </button>
    );
};

const MiniBar = ({ value, max, barClass }) => (
    <div className="flex-1 h-1 bg-black/50 rounded-full overflow-hidden">
        <div className={cn('h-full', barClass)} style={{ width: `${Math.min(100, (value / Math.max(1, max)) * 100)}%` }} />
    </div>
);

// ----------------------------------------------------------------------
// Inspection panel — details + every hero action
// ----------------------------------------------------------------------

const HeroInspection = ({ heroId, onBench, engine, onGone }) => {
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
    const skills = Object.entries(hero.skillLevels).filter(([, level]) => level > 1).slice(0, 8);

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
                    <StatLine key={skillId} label={skillId} value={`Lv ${level}`} />
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

// ----------------------------------------------------------------------
// Recruitment — the drawer flow that replaces board recruit cards (§7)
// ----------------------------------------------------------------------

const RecruitmentSection = ({ influence }) => {
    const engine = useEngine();
    const candidates = useGameState(state => state.recruitment?.candidates || [], ['recruitment_updated']);
    const cost = RecruitSystem.getRecruitCost();
    const canAfford = influence >= cost;

    return (
        <section>
            <SectionHeader
                icon={<Beer size={12} />}
                label="Recruitment"
                hint={`Influence: ${influence} · next hire costs ${cost}`}
            />
            {candidates.length === 0 ? (
                <button
                    onClick={() => RecruitSystem.rollCandidates()}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gi-gold/50 bg-gi-gold/10 text-xs font-bold uppercase tracking-wide text-gi-text hover:bg-gi-gold/20 transition-colors"
                >
                    <Dices size={14} className="text-gi-gold" /> Find Candidates
                </button>
            ) : (
                <div className="flex flex-wrap gap-2">
                    {candidates.map(candidate => (
                        <CandidateCard
                            key={candidate.id}
                            candidate={candidate}
                            cost={cost}
                            canAfford={canAfford}
                            onHire={() => {
                                const result = RecruitSystem.hireCandidate(candidate.id);
                                if (!result.success) {
                                    engine.EventBus.publish('ui:notify', { message: result.error, type: 'error' });
                                }
                            }}
                        />
                    ))}
                    <span className="basis-full text-[9px] text-gi-muted italic">
                        Hiring one candidate dismisses the others.
                    </span>
                </div>
            )}
        </section>
    );
};

const CandidateCard = ({ candidate, cost, canAfford, onHire }) => {
    const className = getClass(candidate.classId)?.name || candidate.classId || 'Hero';
    const traitName = getTrait(candidate.traitId)?.name || '';
    const notableSkills = Object.entries(candidate.skills || {})
        .filter(([, s]) => (s?.level ?? 1) > 1)
        .sort((a, b) => (b[1].level || 0) - (a[1].level || 0))
        .slice(0, 3);

    return (
        <div className="w-48 rounded-lg border border-gi-border bg-gi-base/60 p-2.5 flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full border-2 border-gi-gold/50 bg-gi-gold/10 flex items-center justify-center text-sm font-black uppercase text-gi-text shrink-0">
                    {candidate.name?.[0] || <User size={13} />}
                </div>
                <div className="min-w-0">
                    <div className="text-[11px] font-bold text-gi-text truncate">{candidate.name}</div>
                    <div className="text-[9px] text-gi-muted truncate">{className}{traitName ? ` · ${traitName}` : ''}</div>
                </div>
            </div>
            {notableSkills.length > 0 && (
                <div className="flex flex-col gap-0.5">
                    {notableSkills.map(([skillId, s]) => (
                        <span key={skillId} className="text-[9px] text-gi-muted capitalize">{skillId} Lv {s.level}</span>
                    ))}
                </div>
            )}
            <button
                onClick={onHire}
                disabled={!canAfford}
                className={cn(
                    'mt-auto flex items-center justify-center gap-1 px-2 py-1.5 rounded border text-[10px] font-bold uppercase tracking-wide transition-colors',
                    canAfford
                        ? 'border-gi-gold/60 bg-gi-gold/15 text-gi-text hover:bg-gi-gold/25'
                        : 'border-gi-border/40 text-gi-muted/50 cursor-not-allowed'
                )}
            >
                <Coins size={10} className="text-gi-gold" /> Hire ({cost})
            </button>
        </div>
    );
};

export default HeroesTab;
