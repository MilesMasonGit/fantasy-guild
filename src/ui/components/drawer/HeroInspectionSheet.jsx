import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { resolveSpritePath } from '../../../utils/AssetManager.js';
import { getJob } from '../../../config/registries/jobRegistry.js';
import { getAllSkills, getSkill, isCombatSkill } from '../../../config/registries/skillRegistry.js';
import { DockEquipmentGrid } from '../dock/DockEquipmentGrid.jsx';
import { VitalBar } from '../base/VitalBar.jsx';
import { getXpProgress } from '../../../utils/XPCurve.js';
import { Pencil, Sparkles, Lock, X } from 'lucide-react';

/**
 * HeroInspectionSheet — full detailed hero inspection sheet that neatly covers the Token Tray.
 * - Sits behind the Hero Dock tabs.
 * - Top: 128px Sprite on left; Name, Level, Job, HP, Edit & Close buttons on right.
 * - Body: 3x3 Inventory Grid, Active Skills with XP bars, and Locked Skills.
 */
export const HeroInspectionSheet = ({ heroId, onClose, onEdit }) => {
    const hero = useGameState(
        state => (state.heroes || []).find(h => h.id === heroId),
        ['heroes_updated', 'hero_equipment_changed', 'hero:status_changed', 'state_changed'],
        null,
        { deps: [heroId] }
    );

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

    const equippedCount = Array.isArray(hero.equipment)
        ? hero.equipment.filter(Boolean).length
        : Object.values(hero.equipment || {}).filter(Boolean).length;

    return (
        <div className="flex flex-col h-full bg-[#160f0b]/98 border-2 border-r-0 border-[#8a5d45] rounded-l-2xl shadow-[0_8px_35px_rgba(0,0,0,0.95)] p-3.5 overflow-hidden text-gi-text select-none">
            {/* Top Identity Block: 128px Sprite on Left; Name, Level, Job, HP, Edit on Right */}
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-black/40 border border-[#5c3e2e]/60 shrink-0 mb-3">
                {/* Left: 128px Character Sprite */}
                <div className="w-32 h-32 rounded-lg bg-black/50 border border-white/10 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                    {fullSpritePath ? (
                        <img
                            src={fullSpritePath.startsWith('/') ? fullSpritePath : `/${fullSpritePath}`}
                            alt={hero.name}
                            className="w-32 h-32 object-contain"
                            style={{ imageRendering: 'pixelated' }}
                        />
                    ) : (
                        <span className="text-6xl">{hero.icon || '🧑'}</span>
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

            {/* Scrollable Body: 3x3 Inventory & Skills */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-3">
                {/* 3x3 Inventory Grid */}
                <div className="rounded-xl bg-black/40 border border-[#5c3e2e]/60 p-2.5">
                    <div className="flex items-center justify-between mb-1 px-1">
                        <span className="text-[10px] font-bold gi-caps tracking-widest text-gi-muted">
                            Inventory & Equipment
                        </span>
                        <span className="text-[10px] text-gi-gold font-mono">
                            {equippedCount}/9 Slots
                        </span>
                    </div>
                    <DockEquipmentGrid heroId={heroId} />
                </div>

                {/* Active Skills List */}
                <div className="rounded-xl bg-black/40 border border-[#5c3e2e]/60 p-2.5 space-y-2">
                    <div className="flex items-center gap-1.5 px-1">
                        <Sparkles size={12} className="text-gi-primary" />
                        <span className="text-[10px] font-bold gi-caps tracking-widest text-gi-muted">
                            Active Skills ({activeSkillIds.length})
                        </span>
                    </div>

                    <div className="space-y-1.5">
                        {activeSkillIds.map((skillId) => {
                            const skillData = hero.skills[skillId];
                            const skillDef = getSkill(skillId);
                            const isCombat = isCombatSkill(skillId);
                            const skillLevel = skillData?.level || 1;
                            const prog = getXpProgress(skillData?.xp || 0);

                            return (
                                <div
                                    key={skillId}
                                    className={cn(
                                        "p-2 rounded-lg border flex flex-col gap-1",
                                        isCombat
                                            ? "bg-red-950/20 border-red-800/40"
                                            : "bg-black/30 border-white/10"
                                    )}
                                >
                                    <div className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-sm leading-none">{skillDef?.icon || '⚔️'}</span>
                                            <span className="font-bold text-gi-text">{skillDef?.name || skillId}</span>
                                        </div>
                                        <span className="font-mono text-[11px] font-bold text-gi-gold">
                                            Lv. {skillLevel}
                                        </span>
                                    </div>

                                    <div className="w-full h-1 bg-black/60 rounded-full overflow-hidden border border-white/5">
                                        <div
                                            className="h-full bg-gi-primary transition-all duration-300"
                                            style={{ width: `${Math.min(100, Math.round(prog.progress * 100))}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Locked Skills */}
                {lockedSkills.length > 0 && (
                    <div className="rounded-xl bg-black/30 border border-white/10 p-2.5 space-y-2 opacity-75">
                        <div className="flex items-center gap-1.5 px-1">
                            <Lock size={12} className="text-gi-muted" />
                            <span className="text-[10px] font-bold gi-caps tracking-widest text-gi-muted">
                                Locked Skills ({lockedSkills.length})
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5">
                            {lockedSkills.map((skDef) => (
                                <div
                                    key={skDef.id}
                                    className="p-1.5 rounded bg-black/40 border border-white/5 flex items-center gap-1.5 text-gi-muted text-[10px] grayscale"
                                    title={`${skDef.name} — Requires promotion to unlock`}
                                >
                                    <span className="text-xs shrink-0">{skDef.icon}</span>
                                    <span className="truncate">{skDef.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default HeroInspectionSheet;
