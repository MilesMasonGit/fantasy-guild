import React, { useState, useEffect } from 'react';
import { useGameState } from '../../hooks/useGameState.js';
import { cn } from '../../utils/cn.js';
import { getClass } from '../../../config/registries/classRegistry.js';
import { getTrait } from '../../../config/registries/traitRegistry.js';
import { getSkill, getAllSkillIds } from '../../../config/registries/skillRegistry.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { getAreaSet } from '../../../config/registries/areaSetRegistry.js';
import { unequipItem } from '../../../systems/equipment/EquipmentManager.js';
import { previewRetirementInfluence } from '../../../utils/RetirementFormula.js';
import { getXpProgress } from '../../../utils/XPCurve.js';
import { ItemIcon } from '../base/ItemIcon.jsx';
import { Sword, AlertTriangle } from 'lucide-react';

/**
 * Inspection body — details + every hero action. Rendered by the shared
 * InspectionPanel (overhaul Phase 2).
 */
export const HeroInspection = ({ heroId, onBench, engine, onGone }) => {
    // Value projection — the raw hero object mutates in place, so selectors
    // must return primitives/fresh objects for change detection.
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
                skills: Object.fromEntries(
                    getAllSkillIds().map(skillId => {
                        const s = h.skills?.[skillId];
                        const progressInfo = getXpProgress(s?.xp ?? 0);
                        return [skillId, {
                            level: s?.level ?? 1,
                            progress: Math.round(progressInfo.progress * 100)
                        }];
                    })
                ),
                equipment: { ...(h.equipment || {}) }
            };
        },
        ['heroes_updated', 'hero_equipment_changed'],
        null,
        { deps: [heroId] }
    );

    const [confirmRetire, setConfirmRetire] = useState(false);

    useEffect(() => {
        setConfirmRetire(false);
    }, [heroId]);

    // Hero retired/removed while inspected — clear the selection upstream.
    useEffect(() => {
        if (!hero) onGone?.();
    }, [hero, onGone]);

    if (!hero) return null;

    const areaId = engine.HeroAssignmentManager.getAreaForHero?.(heroId);
    const areaName = areaId ? (getAreaSet(areaId)?.name || areaId) : null;
    const unlockedAreaIds = engine.GameState.collection?.unlockedAreaSets || [];
    // The payout formula wants the full hero object, not our display projection
    const retirePayout = previewRetirementInfluence(engine.HeroManager.getHero(heroId) || {});
    // All 15 skills, in registry order (combat first) — each levels independently.
    const skills = Object.entries(hero.skills);

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
            {/* Identity Header */}
            <div className="flex items-center gap-3 bg-black/20 border border-gi-border/30 rounded-xl p-3">
                {/* 64px Square Sprite */}
                <div className="w-20 h-20 rounded-xl border border-gi-border bg-black/40 p-2 flex items-center justify-center shrink-0" style={{ imageRendering: 'pixelated' }}>
                    <ItemIcon item={{ sprite: hero.spriteId, classId: hero.classId }} size={64} />
                </div>

                {/* Text details column */}
                <div className="min-w-0 flex-1 flex flex-col justify-between h-20 py-0.5">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-gi-text truncate">{hero.name}</span>
                    </div>
                    <div className="text-[10px] text-gi-muted truncate">
                        {hero.className}{hero.traitName ? ` · ${hero.traitName}` : ''}
                    </div>
                    <div className="text-[10px] text-gi-primary font-semibold truncate">
                        {hero.status === 'wounded' ? 'Injured' : (areaName ? `Deployed @ ${areaName}` : onBench ? 'Benched' : 'Idle')}
                    </div>
                </div>
            </div>

            {/* Vitals + status */}
            <div className="flex flex-col gap-1.5 pb-2 border-b border-gi-border/20">
                <StatLine label="Health" value={`${hero.hp} / ${hero.hpMax}`} />
                <StatLine label="Energy" value={`${hero.energy} / ${hero.energyMax}`} />
            </div>

            {/* Skills (3x5 Grid) */}
            <div className="flex flex-col gap-1.5 pb-2 border-b border-gi-border/20">
                <span className="text-[9px] font-bold text-gi-muted uppercase tracking-widest">Skills</span>
                <div className="grid grid-cols-3 gap-1.5">
                    {skills.map(([skillId, s]) => {
                        const skillName = getSkill(skillId)?.name || skillId;
                        return (
                            <div key={skillId} className="flex flex-col bg-black/20 border border-gi-border/30 rounded p-1.5 min-w-0">
                                <div className="flex items-center justify-between text-[9px] font-bold text-gi-text">
                                    <span className="truncate" title={skillName}>{skillName}</span>
                                    <span className="shrink-0 text-gi-primary tabular-nums">Lv {s.level}</span>
                                </div>
                                <div className="text-[8px] text-gi-muted mt-0.5 tabular-nums">
                                    {s.progress}% XP
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Equipment (click to unequip; drag items from the Bank tab to equip) */}
            <div className="flex flex-col gap-1.5">
                <span className="text-[9px] font-bold text-gi-muted uppercase tracking-widest">Gear (click to unequip)</span>
                <div className="grid grid-cols-2 gap-1.5">
                    {['weapon', 'armor'].map(slot => {
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

export default HeroInspection;
