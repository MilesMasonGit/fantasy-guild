import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { resolveSpritePath } from '../../../utils/AssetManager.js';
import { getJob } from '../../../config/registries/jobRegistry.js';
import { DockEquipmentGrid } from '../dock/DockEquipmentGrid.jsx';
import { WorkRulesLink } from '../dock/WorkRulesDrawer.jsx';
import { SkillIcon } from '../base/SkillIcon.jsx';
import { useEntityDrag } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import { Pencil, X, ChevronRight } from 'lucide-react';
import {
    groupHeroSkills, skillLevelText, skillXpView,
    useStartingDrawerOpen, setStartingDrawerOpen
} from '../dock/heroPanelSkills.js';
import { ENGINE_EVENTS, ORPHAN_EVENTS } from '../../../systems/core/engineEvents.js';

/**
 * The hero panel's contents: name, job and HP; the loadout grid; the skills, class skills on
 * top and the Starting skills in a drawer below; skills set aside at a job change last.
 * A banked level is still the hero's: it shows with its level, because promotion is reversible
 * and the player has no other way to see it here.
 */
export const HeroInspectionSheet = ({ heroId, onClose, onEdit }) => {
    // Flat projection, per the useGameState selector contract: a string that changes only when
    // something drawn here changes.
    const signature = useGameState(
        state => {
            const h = (state.heroes || []).find(x => x.id === heroId);
            if (!h) return null;
            return JSON.stringify({
                name: h.name, jobId: h.jobId || null, className: h.className || null,
                spriteId: h.spriteId || null, icon: h.icon || null,
                hp: Math.max(0, Math.round(h.hp?.current ?? 0)), hpMax: Math.max(1, h.hp?.max ?? 100),
                skills: Object.fromEntries(Object.entries(h.skills || {}).map(([id, s]) => [id, { level: s?.level, xp: s?.xp }])),
                bankedSkills: Object.fromEntries(Object.entries(h.bankedSkills || {}).map(([id, s]) => [id, { level: s?.level, xp: s?.xp }]))
            });
        },
        [ENGINE_EVENTS.HEROES_UPDATED, ENGINE_EVENTS.HERO_LEVELED, ENGINE_EVENTS.HERO_PROMOTED, ORPHAN_EVENTS.HERO_STATUS_CHANGED, ENGINE_EVENTS.STATE_CHANGED],
        null,
        { deps: [heroId] }
    );
    const hero = signature ? JSON.parse(signature) : null;
    const { classRows, startingRows, bankedRows } = groupHeroSkills(hero);
    const startingOpen = useStartingDrawerOpen(classRows.length > 0);

    const drag = useEntityDrag({
        id: `inspect-hero-drag-${heroId}`,
        sourceSurface: DND_SURFACE.DRAWER,
        kind: DRAG_KIND.HERO,
        payload: {
            kind: DRAG_KIND.HERO,
            heroId,
            name: hero?.name,
            spriteId: hero?.spriteId || hero?.icon,
            from: { dock: true, inspection: true }
        }
    });

    if (!hero) return null;

    const spritePath = resolveSpritePath(hero.spriteId || 'hero_recruit_0');
    const job = hero.jobId ? getJob(hero.jobId) : null;
    const jobTitle = job ? job.name : (hero.className || 'Recruit');
    const hpPct = Math.min(100, Math.round((hero.hp / hero.hpMax) * 100));
    const hpTone = hpPct > 50 ? 'bg-emerald-500' : hpPct > 20 ? 'bg-amber-500' : 'bg-red-500';

    return (
        <div data-hero-panel-body={heroId} className="flex flex-col h-full min-h-0 text-gi-text select-none">
            <div className="flex items-center gap-3 px-3 pt-3 pb-2.5 shrink-0">
                <div
                    ref={drag.setNodeRef}
                    {...drag.handleProps}
                    className={cn(
                        'w-16 h-16 shrink-0 flex items-center justify-center overflow-hidden',
                        'cursor-grab active:cursor-grabbing',
                        drag.isDragging && 'opacity-30'
                    )}
                    title="Drag onto the mat to send out"
                >
                    {spritePath ? (
                        <img
                            src={spritePath.startsWith('/') ? spritePath : `/${spritePath}`}
                            alt={hero.name}
                            className="w-16 h-16 object-contain pointer-events-none"
                            style={{ imageRendering: 'pixelated' }}
                        />
                    ) : (
                        <span className="text-4xl pointer-events-none">{hero.icon || '🧑'}</span>
                    )}
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <div className="flex items-center gap-1">
                        <h3 className="flex-1 min-w-0 text-sm font-bold text-white truncate" title={hero.name}>
                            {hero.name}
                        </h3>
                        <button
                            onClick={(e) => { e.stopPropagation(); onEdit?.(heroId); }}
                            data-hero-panel-edit
                            className="p-1 rounded hover:bg-white/10 text-gi-muted hover:text-gi-gold transition-colors"
                            title="Edit: name, portrait, flag colour, job"
                        >
                            <Pencil size={12} />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onClose?.(); }}
                            data-hero-panel-close
                            className="p-1 rounded hover:bg-white/10 text-gi-muted hover:text-gi-text transition-colors"
                            title="Close (Esc)"
                        >
                            <X size={14} />
                        </button>
                    </div>
                    <span data-hero-panel-job className="text-xs text-gi-muted truncate">{jobTitle}</span>
                    <WorkRulesLink heroId={heroId} />
                    <div
                        data-hero-panel-hp
                        className="h-1.5 w-full bg-black/60 rounded-full overflow-hidden"
                        title={`${hero.hp.toLocaleString('en-US')} / ${hero.hpMax.toLocaleString('en-US')} HP`}
                    >
                        <div className={cn('h-full transition-all duration-300', hpTone)} style={{ width: `${hpPct}%` }} />
                    </div>
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto gi-scrollbar px-3 pb-3">
                <div className="py-2.5 border-t border-white/5 flex justify-center">
                    <DockEquipmentGrid heroId={heroId} />
                </div>

                {classRows.length > 0 && (
                    <div data-skill-group="class" className="py-2 border-t border-white/5 flex flex-col gap-1">
                        {classRows.map(r => <SkillRow key={r.id} row={r} />)}
                    </div>
                )}

                <div data-skill-group="starting" className="py-1 border-t border-white/5">
                    <button
                        type="button"
                        data-starting-toggle
                        aria-expanded={startingOpen}
                        onClick={() => setStartingDrawerOpen(!startingOpen)}
                        className="w-full flex items-center gap-1 py-1 text-[11px] font-bold gi-caps tracking-wider text-gi-muted hover:text-gi-text transition-colors"
                    >
                        <ChevronRight size={12} className={cn('transition-transform', startingOpen && 'rotate-90')} />
                        <span>Starting skills</span>
                        <span className="ml-auto tabular-nums font-normal">{startingRows.length}</span>
                    </button>
                    {startingOpen && (
                        <div className="flex flex-col gap-1 pt-1">
                            {startingRows.map(r => <SkillRow key={r.id} row={r} />)}
                        </div>
                    )}
                </div>

                {bankedRows.length > 0 && (
                    <div
                        data-skill-group="banked"
                        className="py-2 border-t border-white/5 flex flex-col gap-1"
                        title="Set aside at a job change, at the level they reached. A job that uses one again gets it back as it was."
                    >
                        <span className="text-[11px] font-bold gi-caps tracking-wider text-gi-muted">Set aside</span>
                        {bankedRows.map(r => <SkillRow key={r.id} row={r} banked />)}
                    </div>
                )}
            </div>
        </div>
    );
};

/** `[icon] Forestry 25/99` over a thin XP bar; the XP itself on hover. */
const SkillRow = ({ row, banked = false }) => {
    const xp = skillXpView(row.xp);
    const title = banked
        ? `${row.name} ${skillLevelText(row.level)}, set aside`
        : `${row.name}: ${xp.title}${row.mastered ? ', mastered (kept on every job)' : ''}`;
    return (
        <div
            data-skill-row={row.id}
            data-skill-banked={banked || undefined}
            data-skill-mastered={row.mastered || undefined}
            className={cn('flex items-center gap-2', banked && 'opacity-60 grayscale')}
            title={title}
        >
            <SkillIcon skillId={row.id} size={32} />
            <div className="flex-1 min-w-0 flex flex-col gap-1">
                <div className="flex items-baseline gap-1.5 text-xs leading-none">
                    <span className="truncate font-medium">{row.name}</span>
                    {row.mastered && (
                        // A star rather than a word, so a narrow panel never cuts the skill's name for it.
                        <span data-skill-mark="mastered" aria-label="Mastered" className="shrink-0 text-[11px] text-gi-gold">★</span>
                    )}
                    <span data-skill-level className="ml-auto tabular-nums font-bold">{skillLevelText(row.level)}</span>
                </div>
                {!banked && (
                    <div className="h-[3px] w-full bg-black/60 rounded-full overflow-hidden">
                        <div className="h-full bg-gi-primary" style={{ width: `${Math.round(xp.fill * 100)}%` }} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default HeroInspectionSheet;
