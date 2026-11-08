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
import { VitalBar } from '../base/VitalBar.jsx';
import { useLiveMatFit } from '../board/MatFitContext.jsx';
import { useEntityDrag } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE, rosterFlagPayload } from '../../dnd/dragConstants.js';
import { XpRateTracker } from '../../../systems/hero/XpRateTracker.js';
import { skillPurpose } from '../../../config/registries/skillRegistry.js';
import { heroSkillList, skillLevelText, skillXpView, skillDetail } from '../dock/heroPanelSkills.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';
import { ArrowScrollList } from '../base/ArrowScrollList.jsx';
import { skillPerkView, perkLines } from '../dock/heroPerks.js';
import { t } from '../../../i18n/index.js';

/** The specialist rows' own background. */
const TIER_BG = {
    specialist: 'bg-sky-900/30'
};

/** Two rows of skills, about what one press of a scroll arrow moves. */
const SCROLL_STEP_PX = 80;

/** How far the flag's near edge stands from the hero's middle, as a share of the art. */
const SHEET_FLAG_OFFSET = 0.04;

/**
 * The hero panel's contents: the hero idling at twice the mat size with their flag behind, name
 * and HP; the loadout grid; then every skill (combat, Starting, specialist), two side by side. A
 * skill opens on a click to its exact XP and rate, across both columns. Close and edit stand in
 * the side space beside it (`BankHeroPanel`).
 */
// Memoised: the panel around it holds a drop target, which dnd-kit redraws at every drag start,
// end and change of target.
export const HeroInspectionSheet = memo(function HeroInspectionSheet({ heroId }) {
    // Flat projection, per the useGameState selector contract: a string that changes only when
    // something drawn here changes.
    const signature = useGameState(
        state => {
            const h = (state.heroes || []).find(x => x.id === heroId);
            if (!h) return null;
            return JSON.stringify({
                name: h.name,
                spriteId: h.spriteId || null, icon: h.icon || null,
                flagColour: h.flagColour || null,
                hp: Math.max(0, Math.round(h.hp?.current ?? 0)), hpMax: Math.max(1, h.hp?.max ?? 100),
                skills: Object.fromEntries(Object.entries(h.skills || {}).map(([id, s]) => [id, { level: s?.level, xp: s?.xp }]))
            });
        },
        [ENGINE_EVENTS.HEROES_UPDATED, ENGINE_EVENTS.HERO_LEVELED, ENGINE_EVENTS.GAME_RESET],
        null,
        { deps: [heroId] }
    );
    const hero = signature ? JSON.parse(signature) : null;
    const { rows } = heroSkillList(hero);
    const [expandedId, setExpandedId] = useState(null);
    const fit = useLiveMatFit();

    if (!hero) return null;

    const toggle = (id) => setExpandedId(prev => (prev === id ? null : id));

    // An opened skill's numbers go under the pair of skills it stands in.
    const opened = rows.findIndex(r => r.id === expandedId);
    const pairEnd = opened < 0 ? -1 : Math.min(opened | 1, rows.length - 1);

    return (
        <div data-hero-panel-body={heroId} className="flex flex-col h-full min-h-0 text-gi-text select-none">
            <div className="shrink-0 px-2 pt-2">
                <HeroFigure
                    hero={hero}
                    heroId={heroId}
                    size={2 * ART_PX * boardArtSteps(fit)}
                />

                <div className="flex flex-col gap-1 pb-2.5">
                    <div className="flex items-baseline gap-2 min-w-0">
                        <h3 className="min-w-0 text-sm font-bold text-white truncate">{hero.name}</h3>
                    </div>
                    <VitalBar data-hero-panel-hp value={hero.hp} max={hero.hpMax} height={18} textClass="ui-text-body" />
                </div>
            </div>

            <ArrowScrollList step={SCROLL_STEP_PX} className="flex-1 min-h-0 px-2 pb-2">
                <div className="py-2.5 border-t border-white/5 flex justify-center">
                    <DockEquipmentGrid heroId={heroId} />
                </div>

                <div data-skill-group="held" className="py-2 border-t border-white/5 grid grid-cols-2 gap-1">
                    {rows.flatMap((r, i) => {
                        const cell = (
                            <SkillCell
                                key={r.id}
                                row={r}
                                expanded={expandedId === r.id}
                                onToggle={() => toggle(r.id)}
                            />
                        );
                        return i === pairEnd
                            ? [cell, <SkillOpened key={`${r.id}:opened`} row={rows[opened]} heroId={heroId} />]
                            : [cell];
                    })}
                </div>
            </ArrowScrollList>
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
        kind: DRAG_KIND.FLAG,
        payload: rosterFlagPayload(heroId, hero?.name, { dock: true, inspection: true })
    });
    const sprite = hero.spriteId || null;
    const animArt = sprite ? resolveAnimationPath(sprite) : null;
    const staticArt = animArt ? null : resolveSpritePath(sprite || hero.icon || 'hn_recruit_por');
    // The job flag at its size on the mat beside a hero (12 of the hero's 64 art pixels), standing
    // behind their head on the same side as on the bar (`rosterFlagPlace`).
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
                className={cn('absolute', drag.isDragging && 'invisible')}
                style={{ left: `calc(50% - ${Math.round(size * SHEET_FLAG_OFFSET) + flagPx}px)`, top: Math.round(size * 0.04), width: flagPx, height: flagPx }}
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

/** `10/99 Clean Felling`: one perk as the sheet names it. */
const perkAtText = (p) => t('heroPanel.perkAt', { level: skillLevelText(p.level), perk: p.title });

/**
 * `[icon] 25/99` over a thin XP bar. The icon alone says which skill: its name, what it is for, the
 * XP and its milestone perks (those held, then the next) are in the game's own tooltip on hover.
 */
const SkillCell = ({ row, expanded = false, onToggle }) => {
    const xp = skillXpView(row.xp);
    // What the skill is for comes first: the line the old Work Permissions headers carried.
    const purpose = skillPurpose(row.id);
    const perks = skillPerkView(row.id, row.level);
    const levelText = skillLevelText(row.level);
    const slash = levelText.indexOf('/');
    const tipLines = [
        ...(purpose ? [purpose] : []),
        xp.title,
        ...perks.earned.map(perkAtText),
        ...perks.next.map(p => t('heroPanel.nextPerk', { perk: perkAtText(p) }))
    ];
    return (
        <Tooltip title={`${row.name} ${levelText}`} lines={tipLines}>
            <div
                data-skill-row={row.id}
                data-skill-tier={row.tier || undefined}
                aria-expanded={expanded}
                onClick={onToggle}
                className={cn(
                    'min-w-0 flex items-center gap-1 p-0.5 cursor-pointer hover:bg-white/5',
                    row.tier && TIER_BG[row.tier],
                    expanded && 'bg-white/10'
                )}
            >
                <SkillIcon skillId={row.id} size={32} />
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <span data-skill-level className="text-xs leading-none tabular-nums font-bold whitespace-nowrap">
                        {levelText.slice(0, slash)}
                        {/* ⚠️ `/99` does not fit beside the icon in a narrow window; the tip has it. */}
                        <span className="max-[1539px]:hidden">{levelText.slice(slash)}</span>
                    </span>
                    <div className="h-[3px] w-full bg-black/60 overflow-hidden">
                        <div className="h-full bg-gi-primary" style={{ width: `${Math.round(xp.fill * 100)}%` }} />
                    </div>
                </div>
            </div>
        </Tooltip>
    );
};

/** An opened skill, across both columns: its name, exact numbers and perks. */
const SkillOpened = ({ row, heroId }) => (
    <div data-skill-opened={row.id} className="col-span-2 p-1 flex flex-col gap-1 bg-white/10">
        <span className="ui-text-body font-bold text-white">{row.name}</span>
        <SkillDetail heroId={heroId} row={row} />
        <SkillPerks perks={skillPerkView(row.id, row.level)} />
    </div>
);

/** A skill's exact numbers, read when it opens (`skillDetail`). */
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
        <dl data-skill-detail className="grid grid-cols-2 gap-x-3 gap-y-1 leading-tight">
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

/** An opened skill's milestone perks: each held one with what it does, then the next. Rows never boxed. */
const SkillPerks = ({ perks }) => {
    if (!perks.earned.length && !perks.next.length) return null;
    return (
        <div data-skill-perks className="flex flex-col gap-1 leading-tight">
            {perks.earned.length > 0 && (
                <span className="text-(length:--font-size-xs) text-gi-muted">{t('heroPanel.perks')}</span>
            )}
            {perks.earned.map(p => (
                <div key={`${p.level}:${p.effectId}`} data-skill-perk={p.effectId} className="flex flex-col">
                    <span className="text-(length:--font-size-sm) font-bold text-gi-gold">{perkAtText(p)}</span>
                    {perkLines(p).map((line, i) => (
                        <span key={i} className="text-(length:--font-size-xs) text-white/80">{line}</span>
                    ))}
                </div>
            ))}
            {perks.next.map(p => (
                <span key={`${p.level}:${p.effectId}`} data-skill-next-perk={p.effectId} className="text-(length:--font-size-xs) text-gi-muted">
                    {t('heroPanel.nextPerk', { perk: perkAtText(p) })}
                </span>
            ))}
        </div>
    );
};
