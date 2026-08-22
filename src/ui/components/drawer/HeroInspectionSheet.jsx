import React, { useRef, useState, useEffect, useCallback } from 'react';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { resolveSpritePath } from '../../../utils/AssetManager.js';
import { getJob } from '../../../config/registries/jobRegistry.js';
import { getAllSkills, getSkill, isCombatSkill } from '../../../config/registries/skillRegistry.js';
import { DockEquipmentGrid } from '../dock/DockEquipmentGrid.jsx';
import { VitalBar } from '../base/VitalBar.jsx';
import { getXpProgress, xpForLevel } from '../../../utils/XPCurve.js';
import { useEntityDrag } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import { Pencil, X, ChevronUp, ChevronDown, Clock, TrendingUp } from 'lucide-react';
import { XpRateTracker } from '../../../systems/hero/XpRateTracker.js';
import { formatCompact } from '../../../utils/Formatters.js';

/**
 * HeroInspectionSheet — full detailed hero inspection sheet that neatly covers the Token Tray.
 * - Sits behind the Hero Dock tabs.
 * - Top: 128px Sprite on left; Name, Level, Job, HP, Edit & Close buttons on right.
 * - Body: 3x3 Inventory Grid, Active Skills with XP bars & expandable detail metrics, and Locked Skills.
 */
export const HeroInspectionSheet = ({ heroId, onClose, onEdit }) => {
    const scrollRef = useRef(null);
    const [canScrollUp, setCanScrollUp] = useState(false);
    const [canScrollDown, setCanScrollDown] = useState(false);
    const [expandedSkillId, setExpandedSkillId] = useState(null);

    const hero = useGameState(
        state => (state.heroes || []).find(h => h.id === heroId),
        ['heroes_updated', 'hero_equipment_changed', 'hero:status_changed', 'hero_leveled', 'state_changed'],
        null,
        { deepClone: true, deps: [heroId] }
    );

    const checkScroll = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        setCanScrollUp(el.scrollTop > 6);
        setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 6);
    }, []);

    useEffect(() => {
        checkScroll();
        const el = scrollRef.current;
        if (!el) return;
        el.addEventListener('scroll', checkScroll, { passive: true });
        window.addEventListener('resize', checkScroll);
        return () => {
            el.removeEventListener('scroll', checkScroll);
            window.removeEventListener('resize', checkScroll);
        };
    }, [checkScroll, hero, expandedSkillId]);

    const scrollUp = () => {
        scrollRef.current?.scrollBy({ top: -140, behavior: 'smooth' });
    };

    const scrollDown = () => {
        scrollRef.current?.scrollBy({ top: 140, behavior: 'smooth' });
    };

    const drag = useEntityDrag({
        id: `inspect-hero-drag-${heroId}`,
        sourceSurface: DND_SURFACE.DRAWER,
        kind: DRAG_KIND.HERO,
        payload: {
            kind: DRAG_KIND.HERO,
            heroId,
            name: hero?.name,
            spriteId: hero?.spriteId || hero?.icon || hero?.heroSprite || hero?.classId,
            from: { dock: true, inspection: true }
        }
    });

    if (!hero) return null;

    const fullSpritePath = resolveSpritePath(hero.spriteId || 'hero_recruit_0');
    const job = hero.jobId ? getJob(hero.jobId) : null;
    const jobTitle = job ? job.name : (hero.className || 'Recruit');
    const level = Math.floor(hero.level || 1);

    const activeSkillIds = Object.keys(hero.skills || {});
    const allSkills = getAllSkills();
    const lockedSkills = Object.values(allSkills).filter(s => !activeSkillIds.includes(s.id));

    const hp = Math.max(0, Math.round(hero.hp?.current ?? 0));
    const hpMax = Math.max(1, hero.hp?.max ?? 100);

    return (
        <div className="flex flex-col h-full bg-[#160f0b]/98 border-2 border-r-0 border-[#8a5d45] rounded-l-2xl shadow-[0_8px_35px_rgba(0,0,0,0.95)] p-3.5 pr-20 overflow-hidden text-gi-text select-none">
            {/* Top Identity Block: 128px Sprite on Left; Name, Level, Job, HP, Edit on Right */}
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-black/40 border border-[#5c3e2e]/60 shrink-0 mb-2.5">
                {/* Left: 128px Character Sprite (Draggable) */}
                <div
                    ref={drag.setNodeRef}
                    {...drag.handleProps}
                    className={cn(
                        "w-32 h-32 rounded-lg bg-black/50 border border-white/10 flex items-center justify-center overflow-hidden shrink-0 shadow-inner",
                        "cursor-grab active:cursor-grabbing hover:border-gi-gold/60 transition-colors",
                        drag.isDragging && "opacity-30"
                    )}
                    title="Drag hero to board tile"
                >
                    {fullSpritePath ? (
                        <img
                            src={fullSpritePath.startsWith('/') ? fullSpritePath : `/${fullSpritePath}`}
                            alt={hero.name}
                            className="w-32 h-32 object-contain pointer-events-none select-none"
                            style={{ imageRendering: 'pixelated' }}
                        />
                    ) : (
                        <span className="text-6xl pointer-events-none select-none">{hero.icon || '🧑'}</span>
                    )}
                </div>

                {/* Right: Name, Level, Job, HP, Edit & Close Buttons */}
                <div className="flex-1 flex flex-col justify-between h-32 py-0.5 min-w-0">
                    <div>
                        <div className="flex items-center justify-between gap-1">
                            <h3 className="text-sm font-bold text-white tracking-wide truncate" title={hero.name}>
                                {hero.name}
                            </h3>
                            <div className="flex items-center gap-1 shrink-0">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onEdit?.(heroId);
                                    }}
                                    className="p-1 rounded hover:bg-white/10 text-gi-muted hover:text-gi-gold transition-colors"
                                    title="Edit Hero Name"
                                >
                                    <Pencil size={12} />
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onClose?.();
                                    }}
                                    className="p-1 rounded hover:bg-white/10 text-gi-muted hover:text-red-400 transition-colors"
                                    title="Close Hero Inspection"
                                >
                                    <X size={15} />
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center gap-1.5 mt-1 text-xs text-gi-gold font-medium">
                            <span>Level {level}</span>
                            <span className="text-gi-muted">•</span>
                            <span className="truncate text-white/80">{jobTitle}</span>
                        </div>
                    </div>

                    {/* HP Bar */}
                    <div className="w-full space-y-1">
                        <VitalBar current={hp} max={hpMax} color="green" label="HP" />
                    </div>
                </div>
            </div>

            {/* Flat Scroll Arrow: Top */}
            {canScrollUp && (
                <button
                    onClick={scrollUp}
                    className="w-full py-1 bg-black/60 hover:bg-black/80 border border-white/10 hover:border-gi-gold/40 rounded-lg flex items-center justify-center text-gi-gold transition-colors shrink-0 mb-1.5 shadow active:scale-[0.99]"
                    title="Scroll up"
                >
                    <ChevronUp size={14} />
                </button>
            )}

            {/* Scrollable Body: 3x3 Inventory & Skills (Scrollbar hidden) */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto space-y-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            >
                {/* 3x3 Inventory Grid */}
                <div className="rounded-xl bg-black/40 border border-[#5c3e2e]/60 p-2.5">
                    <div className="flex items-center mb-1.5 px-1">
                        <span className="text-[10px] font-bold gi-caps tracking-widest text-gi-muted">
                            Inventory
                        </span>
                    </div>
                    <DockEquipmentGrid heroId={heroId} />
                </div>

                {/* Active Skills List */}
                <div className="rounded-xl bg-black/40 border border-[#5c3e2e]/60 p-2.5 space-y-2">
                    <div className="flex items-center px-1">
                        <span className="text-[10px] font-bold gi-caps tracking-widest text-gi-muted">
                            Active Skills
                        </span>
                    </div>

                    <div className="space-y-1.5">
                        {activeSkillIds.map((skillId) => {
                            const skillData = hero.skills[skillId];
                            const skillDef = getSkill(skillId);
                            const isCombat = isCombatSkill(skillId);
                            const skillLevel = skillData?.level || 1;
                            const currentXp = skillData?.xp || 0;
                            const prog = getXpProgress(currentXp);
                            const nextMilestoneXp = xpForLevel(prog.level + 1);
                            const isExpanded = expandedSkillId === skillId;

                            // Metric calculations for expanded view
                            const rate = XpRateTracker.getRate(heroId, skillId);
                            const xpRemaining = Math.max(0, prog.nextLevelXp - prog.currentXp);
                            const timeSecs = XpRateTracker.getTimeToNextLevelSeconds(heroId, skillId, xpRemaining);
                            const timeFormatted = XpRateTracker.formatDuration(timeSecs);
                            const rateFormatted = rate > 0 ? (rate < 1000 ? `${Math.round(rate)}` : formatCompact(rate, 1)) : '0';
                            const pctFormatted = `${Math.min(100, Math.round(prog.progress * 100))}%`;

                            return (
                                <div
                                    key={skillId}
                                    onClick={() => setExpandedSkillId(isExpanded ? null : skillId)}
                                    className={cn(
                                        "p-2 rounded-lg border flex flex-col gap-1 cursor-pointer transition-all duration-150 select-none",
                                        isCombat
                                            ? "bg-red-950/20 border-red-800/40 hover:border-red-600/60"
                                            : "bg-black/30 border-white/10 hover:border-gi-gold/50",
                                        isExpanded && "ring-1 ring-gi-gold/60 border-gi-gold/70 bg-[#1f1510]"
                                    )}
                                >
                                    <div className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-sm leading-none">{skillDef?.icon || '⚔️'}</span>
                                            <span className="font-bold text-gi-text">{skillDef?.name || skillId}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 font-mono">
                                            <span className="text-[11px] font-bold text-gi-gold">
                                                Lv. {skillLevel}
                                            </span>
                                            <span className="text-[10px] text-white/50">
                                                {pctFormatted}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="w-full h-1 bg-black/60 rounded-full overflow-hidden border border-white/5 my-0.5">
                                        <div
                                            className="h-full bg-gi-primary transition-all duration-300"
                                            style={{ width: `${Math.min(100, Math.round(prog.progress * 100))}%` }}
                                        />
                                    </div>

                                    {/* Expanded Details Panel */}
                                    {isExpanded && (
                                        <div className="mt-1 pt-1.5 border-t border-white/10 flex flex-col gap-1 text-[11px]">
                                            {/* Quantity of current total XP */}
                                            <div className="flex items-center justify-between text-gi-muted">
                                                <span>XP:</span>
                                                <span className="font-mono text-white/90 font-bold">
                                                    {formatCompact(currentXp)}
                                                </span>
                                            </div>

                                            {/* Milestone XP for next level */}
                                            <div className="flex items-center justify-between text-gi-muted">
                                                <span>Next Level:</span>
                                                <span className="font-mono text-white/90 font-bold">
                                                    {formatCompact(nextMilestoneXp)}
                                                </span>
                                            </div>

                                            {/* XP Gain Rate */}
                                            <div className="flex items-center justify-between text-gi-muted">
                                                <span className="flex items-center gap-1">
                                                    <TrendingUp size={11} className="text-gi-primary" />
                                                    Gain Rate:
                                                </span>
                                                <span className="font-mono text-gi-primary font-bold">
                                                    {rate > 0 ? `+${rateFormatted} XP/hr` : '--'}
                                                </span>
                                            </div>

                                            {/* Estimate to Next Level */}
                                            <div className="flex items-center justify-between text-gi-muted">
                                                <span className="flex items-center gap-1">
                                                    <Clock size={11} className="text-gi-gold" />
                                                    Est. to Level:
                                                </span>
                                                <span className="font-mono text-gi-gold font-bold">
                                                    {timeFormatted}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Locked Skills */}
                {lockedSkills.length > 0 && (
                    <div className="rounded-xl bg-black/40 border border-[#5c3e2e]/60 p-2.5 space-y-2">
                        <div className="flex items-center px-1">
                            <span className="text-[10px] font-bold gi-caps tracking-widest text-gi-muted">
                                Locked Skills
                            </span>
                        </div>

                        <div className="space-y-1.5">
                            {lockedSkills.map((skDef) => (
                                <div
                                    key={skDef.id}
                                    className="p-2 rounded-lg border border-white/5 bg-black/25 flex flex-col gap-1 grayscale opacity-50 select-none"
                                    title={`${skDef.name} — Requires promotion to unlock`}
                                >
                                    <div className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-sm leading-none">{skDef?.icon || '⚔️'}</span>
                                            <span className="font-bold text-gi-muted">{skDef?.name || skDef.id}</span>
                                        </div>
                                        <span className="font-mono text-[10px] font-bold text-gi-muted">
                                            Locked
                                        </span>
                                    </div>

                                    <div className="w-full h-1 bg-black/60 rounded-full overflow-hidden border border-white/5 my-0.5">
                                        <div className="h-full bg-white/10" style={{ width: '0%' }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Flat Scroll Arrow: Bottom */}
            {canScrollDown && (
                <button
                    onClick={scrollDown}
                    className="w-full py-1 bg-black/60 hover:bg-black/80 border border-white/10 hover:border-gi-gold/40 rounded-lg flex items-center justify-center text-gi-gold transition-colors shrink-0 mt-1.5 shadow active:scale-[0.99]"
                    title="Scroll down"
                >
                    <ChevronDown size={14} />
                </button>
            )}
        </div>
    );
};

export default HeroInspectionSheet;
