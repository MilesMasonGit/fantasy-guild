import { memo, useState } from 'react';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { resolveSpritePath, resolveAnimationPath } from '../../../utils/AssetManager.js';
import { getJob } from '../../../config/registries/jobRegistry.js';
import { ART_PX } from '../../../config/matGeometry.js';
import { DockEquipmentGrid } from '../dock/DockEquipmentGrid.jsx';
import { SkillIcon } from '../base/SkillIcon.jsx';
import { boardArtSteps } from '../base/TokenSprite.jsx';
import { AnimatedHeroSprite } from '../board/AnimatedHeroSprite.jsx';
import { FlagMark } from '../board/FlagMark.jsx';
import { Tooltip } from '../base/Tooltip.jsx';
import { VitalBar, vitalTone } from '../base/VitalBar.jsx';
import { useLiveMatFit } from '../board/MatFitContext.jsx';
import { useEntityDrag } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import { Feather, ChevronRight } from 'lucide-react';
import { flagColourOf } from '../../../systems/board/FlagColours.js';
import { XpRateTracker } from '../../../systems/hero/XpRateTracker.js';
import {
    heroSkillList, skillLevelText, skillXpView, skillDetail, requiresText,
    useLockedListOpen, setLockedListOpen
} from '../dock/heroPanelSkills.js';
import { ENGINE_EVENTS, ORPHAN_EVENTS } from '../../../systems/core/engineEvents.js';
import { CloseX } from '../base/CloseX.jsx';

/** Advanced and Master rows' own backgrounds. */
const TIER_BG = {
    advanced: 'bg-sky-900/30',
    master: 'bg-fuchsia-900/30'
};

/**
 * The hero panel's contents: the hero idling at twice the mat size with their flag behind, name,
 * job and HP; the loadout grid; then one list of the skills held (combat, Starting, specialist),
 * skills set aside at a job change, and the skills never held, shut until opened. A row opens on
 * a click to its exact XP and rate.
 * A banked level is still the hero's: it shows with its level, because promotion is reversible
 * and the player has no other way to see it here.
 */
// Memoised: the panel around it holds a drop target, which dnd-kit redraws at every drag start,
// end and change of target.
export const HeroInspectionSheet = memo(function HeroInspectionSheet({ heroId, onClose, onEdit }) {
    // Flat projection, per the useGameState selector contract: a string that changes only when
    // something drawn here changes.
    const signature = useGameState(
        state => {
            const h = (state.heroes || []).find(x => x.id === heroId);
            if (!h) return null;
            return JSON.stringify({
                name: h.name, jobId: h.jobId || null, className: h.className || null,
                spriteId: h.spriteId || null, icon: h.icon || null, classId: h.classId || null,
                flagColour: flagColourOf(heroId),
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
    const { rows, bankedRows, lockedRows } = heroSkillList(hero);
    const lockedOpen = useLockedListOpen();
    const [expandedId, setExpandedId] = useState(null);
    const fit = useLiveMatFit();

    if (!hero) return null;

    const job = hero.jobId ? getJob(hero.jobId) : null;
    const jobTitle = job ? job.name : (hero.className || 'Recruit');
    const toggle = (id) => setExpandedId(prev => (prev === id ? null : id));

    return (
        <div data-hero-panel-body={heroId} className="flex flex-col h-full min-h-0 text-gi-text select-none">
            <div className="relative shrink-0 px-3 pt-2">
                <div className="absolute top-2 right-2 z-10 flex items-center gap-0.5">
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onEdit?.(heroId); }}
                        data-hero-panel-edit
                        aria-label="Edit hero"
                        className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-gi-muted hover:text-gi-gold transition-colors cursor-pointer"
                    >
                        {/* ⚠️ Placeholder quill until the owner draws one. */}
                        <Feather size={16} />
                    </button>
                    <CloseX data-hero-panel-close onClick={(e) => { e.stopPropagation(); onClose?.(); }} />
                </div>

                <HeroFigure
                    hero={hero}
                    heroId={heroId}
                    size={2 * ART_PX * boardArtSteps(fit)}
                />

                <div className="flex flex-col gap-1 pb-2.5">
                    <div className="flex items-baseline gap-2 min-w-0">
                        <h3 className="min-w-0 text-sm font-bold text-white truncate">{hero.name}</h3>
                        <span data-hero-panel-job className="ml-auto shrink-0 text-xs text-gi-muted truncate">{jobTitle}</span>
                    </div>
                    <VitalBar value={hero.hp} max={hero.hpMax} barClass={vitalTone(hero.hp, hero.hpMax)} />
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto gi-scrollbar px-3 pb-3">
                <div className="py-2.5 border-t border-white/5 flex justify-center">
                    <DockEquipmentGrid heroId={heroId} />
                </div>

                <div data-skill-group="held" className="py-2 border-t border-white/5 flex flex-col gap-0.5">
                    {rows.map(r => (
                        <SkillRow
                            key={r.id}
                            row={r}
                            heroId={heroId}
                            expanded={expandedId === r.id}
                            onToggle={() => toggle(r.id)}
                        />
                    ))}
                </div>

                {bankedRows.length > 0 && (
                    <div data-skill-group="banked" className="py-2 border-t border-white/5 flex flex-col gap-0.5">
                        <span className="text-(length:--font-size-sm) font-bold gi-caps tracking-wider text-gi-muted">Set aside</span>
                        {bankedRows.map(r => <SkillRow key={r.id} row={r} heroId={heroId} kind="banked" />)}
                    </div>
                )}

                {lockedRows.length > 0 && (
                    <div data-skill-group="locked" className="py-1 border-t border-white/5">
                        <button
                            type="button"
                            data-locked-toggle
                            aria-expanded={lockedOpen}
                            onClick={() => setLockedListOpen(!lockedOpen)}
                            className="w-full flex items-center gap-1 py-1 text-(length:--font-size-sm) font-bold gi-caps tracking-wider text-gi-muted hover:text-gi-text transition-colors cursor-pointer"
                        >
                            <ChevronRight size={12} className={cn('transition-transform', lockedOpen && 'rotate-90')} />
                            <span>Locked</span>
                            <span className="ml-auto tabular-nums font-normal">{lockedRows.length}</span>
                        </button>
                        {lockedOpen && (
                            <div className="flex flex-col gap-0.5 pt-1">
                                {lockedRows.map(r => <SkillRow key={r.id} row={r} heroId={heroId} kind="locked" />)}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
});

/**
 * The hero idling at `size` (twice the mat's art), their flag standing behind them. The figure
 * is the drag handle that sends the hero out, as the bar's figure is.
 */
// The sheet's drag source, in its own component: dnd-kit redraws the holder of a drag hook at
// every drag start, end and change of target, and the sheet around it is long.
const HeroFigure = ({ hero, heroId, size }) => {
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
    const sprite = hero.spriteId || hero.classId || null;
    const animArt = sprite ? resolveAnimationPath(sprite) : null;
    const staticArt = animArt ? null : resolveSpritePath(sprite || hero.icon || 'hn_recruit_por');
    // The flag's pole stands just behind the hero's shoulder, its cloth flying out to the right.
    const flagLeft = Math.round(size * 0.3);
    return (
        <div
            data-hero-panel-sprite
            data-hero-panel-sprite-px={size}
            className="relative mx-auto overflow-hidden pointer-events-none"
            style={{ width: '100%', maxWidth: size, height: size }}
        >
            <div
                data-hero-panel-flag={hero.flagColour || 'base'}
                className="absolute top-0"
                style={{ left: `calc(50% - ${size / 2}px + ${flagLeft}px)`, width: size, height: size }}
            >
                <FlagMark colour={hero.flagColour} size={size} alt="" />
            </div>
            <div
                data-hero-panel-figure
                ref={drag.setNodeRef}
                {...drag.handleProps}
                aria-label="Drag onto the mat to send out"
                className={cn(
                    'absolute top-0 pointer-events-auto cursor-grab active:cursor-grabbing',
                    drag.isDragging && 'opacity-30'
                )}
                style={{ left: `calc(50% - ${size / 2}px)`, width: size, height: size }}
            >
                {animArt ? (
                    <AnimatedHeroSprite src={animArt} heroId={heroId} alt={hero.name} size={size} animationState="idle" />
                ) : staticArt ? (
                    <img
                        src={staticArt.startsWith('/') ? staticArt : `/${staticArt}`}
                        alt={hero.name}
                        draggable={false}
                        style={{ width: size, height: size, maxWidth: 'none', imageRendering: 'pixelated' }}
                    />
                ) : null}
            </div>
        </div>
    );
};

/**
 * `[icon] Forestry 25/99` over a thin XP bar, the XP in the game's own tooltip on hover. A held
 * skill opens on a click to its exact numbers. `kind`: `held`, `banked` (set aside, with the level
 * it reached) or `locked` (never held).
 */
const SkillRow = ({ row, heroId, kind = 'held', expanded = false, onToggle }) => {
    const held = kind === 'held';
    const xp = skillXpView(row.xp);
    const tipLines = kind === 'banked'
        ? [`Set aside at ${skillLevelText(row.level)}.`, 'A job that uses it again gets it back as it was.']
        : kind === 'locked'
            ? [requiresText(row.id)]
            : [xp.title, ...(row.mastered ? ['Mastered: kept on every job.'] : [])];
    return (
        <Tooltip title={row.name} lines={tipLines}>
        <div
            data-skill-row={row.id}
            data-skill-tier={held && row.tier ? row.tier : undefined}
            data-skill-banked={kind === 'banked' || undefined}
            data-skill-locked={kind === 'locked' || undefined}
            aria-expanded={held ? expanded : undefined}
            onClick={held ? onToggle : undefined}
            className={cn(
                'flex flex-col gap-1 px-1 py-0.5 rounded-sm',
                held && 'cursor-pointer hover:bg-white/5',
                held && row.tier && TIER_BG[row.tier],
                kind === 'banked' && 'opacity-60 grayscale',
                kind === 'locked' && 'opacity-40 grayscale'
            )}
        >
            <div className="flex items-center gap-2">
                <SkillIcon skillId={row.id} size={32} title={null} />
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <div className="flex items-baseline gap-1.5 text-xs leading-none">
                        <span className="truncate font-medium">{row.name}</span>
                        {kind !== 'locked' && (
                            <span data-skill-level className="ml-auto tabular-nums font-bold">{skillLevelText(row.level)}</span>
                        )}
                    </div>
                    {held && (
                        <div className="h-[3px] w-full bg-black/60 rounded-full overflow-hidden">
                            <div className="h-full bg-gi-primary" style={{ width: `${Math.round(xp.fill * 100)}%` }} />
                        </div>
                    )}
                </div>
            </div>
            {held && expanded && <SkillDetail heroId={heroId} row={row} />}
        </div>
        </Tooltip>
    );
};

/** A held skill's exact numbers, read when the row opens (`skillDetail`). */
const SkillDetail = ({ heroId, row }) => {
    const d = skillDetail(row.xp, XpRateTracker.getRate(heroId, row.id));
    const lines = [
        d.level && ['XP', d.level],
        d.toNext && [`To ${d.nextLevel}`, d.toNext],
        ['Total XP', d.total],
        d.level && ['XP/h', d.rate || '–'],
        d.eta && ['Next level', d.eta]
    ].filter(Boolean);
    return (
        <dl data-skill-detail className="ml-1 mr-1 mb-1 grid grid-cols-2 gap-x-3 gap-y-1 leading-tight">
            {lines.map(([label, value], i) => (
                // The first line, this level's XP, is the longest: it takes the full width.
                <div key={label} className={cn('min-w-0 flex flex-col', i === 0 && d.level && 'col-span-2')}>
                    <dt className="truncate text-(length:--font-size-xs) text-gi-muted">{label}</dt>
                    <dd className="truncate text-(length:--font-size-sm) tabular-nums text-white/90">{value}</dd>
                </div>
            ))}
        </dl>
    );
};

export default HeroInspectionSheet;
