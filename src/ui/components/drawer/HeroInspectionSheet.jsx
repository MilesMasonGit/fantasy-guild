import { memo, useState } from 'react';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import { resolveSpritePath, resolveAnimationPath } from '../../../utils/AssetManager.js';
import { ART_PX } from '../../../config/matGeometry.js';
import { DockEquipmentGrid } from '../dock/DockEquipmentGrid.jsx';
import { SkillIcon } from '../base/SkillIcon.jsx';
import { boardArtSteps } from '../base/TokenSprite.jsx';
import { AnimatedHeroSprite } from '../board/AnimatedHeroSprite.jsx';
import { FlagMark } from '../board/FlagMark.jsx';
import { MARKER_ART_PX } from '../board/flagGeometry.js';
import { Tooltip } from '../base/Tooltip.jsx';
import { VitalBar, vitalTone } from '../base/VitalBar.jsx';
import { useLiveMatFit } from '../board/MatFitContext.jsx';
import { useEntityDrag } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import { Feather } from 'lucide-react';
import { XpRateTracker } from '../../../systems/hero/XpRateTracker.js';
import { skillPurpose } from '../../../config/registries/skillRegistry.js';
import { heroSkillList, skillLevelText, skillXpView, skillDetail } from '../dock/heroPanelSkills.js';
import { ENGINE_EVENTS, ORPHAN_EVENTS } from '../../../systems/core/engineEvents.js';
import { CloseX } from '../base/CloseX.jsx';

/** The specialist rows' own background. */
const TIER_BG = {
    specialist: 'bg-sky-900/30'
};

/**
 * The hero panel's contents: the hero idling at twice the mat size with their flag behind, name
 * and HP; the loadout grid; then one list of every skill (combat, Starting, specialist). A row
 * opens on a click to its exact XP and rate.
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
                name: h.name,
                spriteId: h.spriteId || null, icon: h.icon || null, classId: h.classId || null,
                flagColour: h.flagColour || null,
                hp: Math.max(0, Math.round(h.hp?.current ?? 0)), hpMax: Math.max(1, h.hp?.max ?? 100),
                skills: Object.fromEntries(Object.entries(h.skills || {}).map(([id, s]) => [id, { level: s?.level, xp: s?.xp }]))
            });
        },
        [ENGINE_EVENTS.HEROES_UPDATED, ENGINE_EVENTS.HERO_LEVELED, ORPHAN_EVENTS.HERO_STATUS_CHANGED, ENGINE_EVENTS.GAME_RESET],
        null,
        { deps: [heroId] }
    );
    const hero = signature ? JSON.parse(signature) : null;
    const { rows } = heroSkillList(hero);
    const [expandedId, setExpandedId] = useState(null);
    const fit = useLiveMatFit();

    if (!hero) return null;

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
                        className="w-7 h-7 flex items-center justify-center text-gi-muted hover:text-[var(--color-ui-white)] transition-colors cursor-pointer"
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
    // The job flag at its size on the mat beside a hero (12 of the hero's 64 art pixels), in the
    // top-right quarter of the hero's box, clear of their head, above their shoulder.
    const flagPx = Math.round((size * MARKER_ART_PX) / 64);
    return (
        <div
            data-hero-panel-sprite
            data-hero-panel-sprite-px={size}
            className="relative mx-auto overflow-hidden pointer-events-none"
            style={{ width: '100%', maxWidth: size, height: size }}
        >
            <div
                data-hero-panel-flag
                className="absolute"
                style={{ left: `calc(50% + ${Math.round(size * 0.12)}px)`, top: Math.round(size * 0.04), width: flagPx, height: flagPx }}
            >
                <FlagMark size={flagPx} colour={hero.flagColour} alt="" />
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
 * `[icon] Forestry 25/99` over a thin XP bar, the XP in the game's own tooltip on hover. A click
 * opens it to its exact numbers.
 */
const SkillRow = ({ row, heroId, expanded = false, onToggle }) => {
    const xp = skillXpView(row.xp);
    // What the skill is for comes first: the line the old Work Permissions headers carried.
    const purpose = skillPurpose(row.id);
    const tipLines = [...(purpose ? [purpose] : []), xp.title];
    return (
        <Tooltip title={row.name} lines={tipLines}>
        <div
            data-skill-row={row.id}
            data-skill-tier={row.tier || undefined}
            aria-expanded={expanded}
            onClick={onToggle}
            className={cn(
                'flex flex-col gap-1 px-1 py-0.5 cursor-pointer hover:bg-white/5',
                row.tier && TIER_BG[row.tier]
            )}
        >
            <div className="flex items-center gap-2">
                <SkillIcon skillId={row.id} size={32} title={null} />
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <div className="flex items-baseline gap-1.5 text-xs leading-none">
                        <span className="truncate font-medium">{row.name}</span>
                        <span data-skill-level className="ml-auto tabular-nums font-bold">{skillLevelText(row.level)}</span>
                    </div>
                    <div className="h-[3px] w-full bg-black/60 overflow-hidden">
                        <div className="h-full bg-gi-primary" style={{ width: `${Math.round(xp.fill * 100)}%` }} />
                    </div>
                </div>
            </div>
            {expanded && <SkillDetail heroId={heroId} row={row} />}
        </div>
        </Tooltip>
    );
};

/** A skill's exact numbers, read when the row opens (`skillDetail`). */
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
