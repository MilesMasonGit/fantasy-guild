import { memo, useLayoutEffect, useRef, useState } from 'react';
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
import { heroSkillList, skillLevelText, skillXpView, skillTipView, SKILLS_PER_COLUMN } from '../dock/heroPanelSkills.js';
import { HeroSkillPanel } from '../dock/HeroSkillPanel.jsx';
import { HeroCombatView } from '../dock/HeroCombatView.jsx';
import { CombatGlyph } from '../combat/CombatGlyph.jsx';
import { GLYPH_COLOUR } from '../combat/combatGlyphs.js';
import { FRAME_BAND_PX } from '../base/PixelFrame.jsx';
import { HERO_DRAWER_PAD_TOP_PX } from '../dock/dockHeroView.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';
import { openEncyclopedia } from '../encyclopedia/encyclopediaLink.js';
import { t } from '../../../i18n/index.js';

/** The specialist rows' own background. */
const TIER_BG = {
    specialist: 'bg-sky-900/30'
};

/** The right-hand block's two views. */
export const HERO_VIEW = Object.freeze({ SKILLS: 'skills', COMBAT: 'combat' });

/** The gap between the skill panel and the drawer's top edge, in screen px. */
const SKILL_PANEL_GAP_PX = 6;

/**
 * How far the job flag's near edge stands left of the hero's middle, as a share of the art: at the
 * shoulder, as on the bar (`rosterFlagPlace`), so the hero's body covers its pole.
 */
export const SHEET_FLAG_OFFSET = 0.12;

/**
 * The hero drawer's contents: a header across the top (the name over the hero's column, the HP bar
 * over the rest), then three blocks left to right: the hero idling at twice the mat's size with
 * their flag behind; their loadout grid, always in view; and a switch between the Skills grid
 * (columns of four, in the sheet's order) and the Combat view. Hovering a skill gives its XP;
 * clicking it opens the skill panel over the drawer. The close X and the edit quill stand in the
 * drawer's own top right corner (`HeroDrawer`).
 */
// Memoised: the drawer around it holds a drop target, which dnd-kit redraws at every drag start,
// end and change of target.
export const HeroInspectionSheet = memo(function HeroInspectionSheet({ heroId, onClose, headerEndPx = 0 }) {
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
    const [view, setView] = useState(HERO_VIEW.SKILLS);
    const [openSkillId, setOpenSkillId] = useState(null);
    const fit = useLiveMatFit();
    // The skills grid's width, kept for the Combat view, so switching never moves the blocks.
    const skillsRef = useRef(null);
    const [detailMinPx, setDetailMinPx] = useState(0);
    // Measured after every draw (the text size setting moves it with no prop changing); it sets
    // only a changed width, so it settles in one extra draw.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useLayoutEffect(() => {
        const w = Math.ceil(skillsRef.current?.getBoundingClientRect().width || 0);
        if (w && w !== detailMinPx) setDetailMinPx(w);
    });

    if (!hero) return null;

    const openRow = view === HERO_VIEW.SKILLS ? rows.find(r => r.id === openSkillId) : null;
    const toggleSkill = (id) => setOpenSkillId(prev => (prev === id ? null : id));
    const showView = (next) => {
        setView(next);
        setOpenSkillId(null);
    };
    const lookUp = () => {
        openEncyclopedia();
        onClose?.();
    };

    const figurePx = 2 * ART_PX * boardArtSteps(fit);
    const summaryPx = Math.max(figurePx, SUMMARY_MIN_PX);

    return (
        // `relative`: the skill panel stands over the drawer's top edge, from this box's right.
        <div data-hero-panel-body={heroId} className="relative flex flex-col gap-2 text-gi-text select-none">
            {/* The header across the drawer: the name over the hero's column, the HP over the rest. */}
            <header data-hero-drawer-header className="flex items-center gap-6" style={{ paddingRight: headerEndPx }}>
                <h3
                    data-hero-panel-name
                    className="shrink-0 ui-text-display font-bold text-white text-center break-words leading-none"
                    style={{ width: summaryPx }}
                >
                    {hero.name}
                </h3>
                <VitalBar data-hero-panel-hp style={{ flex: '1 1 0%' }} value={hero.hp} max={hero.hpMax} height={22} textClass="ui-text-body" />
            </header>

            <div className="flex items-start gap-6">
                <section data-hero-drawer-block="summary" className="shrink-0 flex justify-center" style={{ width: summaryPx }}>
                    <HeroFigure hero={hero} heroId={heroId} size={figurePx} />
                </section>

                <section data-hero-drawer-block="equipment" className="shrink-0 flex flex-col gap-2">
                    <h4 data-hero-drawer-inventory className="flex items-center gap-1 pb-1 border-b-2 border-transparent ui-text-body font-bold text-gi-muted">
                        {/* The glyph's height, so the label stands on the tabs' line. */}
                        <span aria-hidden className="inline-block w-0 h-4" />
                        {t('heroPanel.inventory')}
                    </h4>
                    <DockEquipmentGrid heroId={heroId} />
                </section>

                <section data-hero-drawer-block="detail" className="shrink-0 flex flex-col gap-2" style={{ minWidth: detailMinPx || undefined }}>
                    <div role="tablist" className="flex items-end gap-4">
                        <ViewTab id={HERO_VIEW.SKILLS} glyph="star" label={t('heroPanel.tabSkills')} view={view} onShow={showView} />
                        <ViewTab id={HERO_VIEW.COMBAT} glyph="fight" label={t('heroPanel.tabCombat')} view={view} onShow={showView} />
                    </div>
                    {view === HERO_VIEW.SKILLS ? (
                        <div
                            ref={skillsRef}
                            data-skill-group="held"
                            className="grid grid-flow-col gap-x-2 gap-y-1"
                            style={{ gridTemplateRows: `repeat(${SKILLS_PER_COLUMN}, auto)` }}
                        >
                            {rows.map(r => (
                                <SkillCell key={r.id} heroId={heroId} row={r} open={openSkillId === r.id} onToggle={() => toggleSkill(r.id)} />
                            ))}
                        </div>
                    ) : (
                        <HeroCombatView heroId={heroId} />
                    )}
                </section>
            </div>
            {openRow && (
                <HeroSkillPanel
                    heroId={heroId}
                    row={openRow}
                    onClose={() => setOpenSkillId(null)}
                    onLookUp={lookUp}
                    // Over the drawer's top edge, its right on the blocks' right: this box's top is the
                    // frame's band and the padding below it.
                    style={{ right: 0, bottom: `calc(100% + ${FRAME_BAND_PX + HERO_DRAWER_PAD_TOP_PX + SKILL_PANEL_GAP_PX}px)` }}
                />
            )}
        </div>
    );
});

/** One of the right-hand block's two tabs: glyph and word, the open one bright over a gold line. */
const ViewTab = ({ id, glyph, label, view, onShow }) => {
    const on = id === view;
    return (
        <button
            type="button"
            role="tab"
            aria-selected={on}
            data-hero-view-tab={id}
            onClick={() => onShow(id)}
            className={cn(
                'flex items-center gap-1 pb-1 cursor-pointer ui-text-body font-bold border-b-2',
                on ? 'text-white border-[var(--color-ui-gold)]' : 'text-gi-muted border-transparent hover:text-white'
            )}
        >
            <CombatGlyph name={glyph} colour={on ? GLYPH_COLOUR.gold : GLYPH_COLOUR.text} />
            {label}
        </button>
    );
};

// The name in the display size: the owner asked for it larger than a panel title (2026-11-10).
/** The hero block's narrowest, in screen px: room for a short name on one line at the display size. */
const SUMMARY_MIN_PX = 176;

/**
 * The hero idling at `size` (twice the mat's art), their flag standing behind their shoulder. The
 * figure is the drag handle that sends the hero out, as the bar's figure is.
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
    // behind their shoulder on the same side as on the bar (`rosterFlagPlace`).
    const flagPx = Math.round((size * MARKER_ART_PX) / 64);
    return (
        <div
            data-hero-panel-sprite
            data-hero-panel-sprite-px={size}
            className="relative overflow-hidden pointer-events-none"
            style={{ width: size, height: size }}
        >
            <div
                data-hero-panel-flag
                className={cn('absolute', drag.isDragging && 'invisible')}
                style={{ left: Math.round(size / 2 - size * SHEET_FLAG_OFFSET) - flagPx, top: Math.round(size * 0.04), width: flagPx, height: flagPx }}
            >
                <FlagMark size={flagPx} colour={hero.flagColour} alt="" />
            </div>
            <div
                data-hero-panel-figure
                ref={drag.setNodeRef}
                {...drag.handleProps}
                aria-label={t('heroPanel.sendOut')}
                className={cn(
                    'absolute inset-0 pointer-events-auto cursor-grab active:cursor-grabbing',
                    drag.isDragging && 'opacity-30'
                )}
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

/** A skill's icon in the grid: its 16-pixel art at 3x. */
export const SKILL_ICON_PX = 48;

/**
 * `[icon] Mining 25/99` over a thin XP bar, the icon large and the name on the cell: hovering gives the game's
 * tooltip with the name and level, the XP, what is left and the rate; a click opens the skill panel.
 */
const SkillCell = ({ heroId, row, open = false, onToggle }) => {
    const xp = skillXpView(row.xp);
    return (
        <Tooltip title={`${row.name} ${skillLevelText(row.level)}`} content={<SkillTip heroId={heroId} row={row} />}>
            <div
                data-skill-row={row.id}
                data-skill-tier={row.tier || undefined}
                aria-expanded={open}
                onClick={onToggle}
                className={cn(
                    'flex items-center gap-1.5 p-0.5 pr-1.5 cursor-pointer hover:bg-white/5',
                    row.tier && TIER_BG[row.tier],
                    open && 'bg-white/10'
                )}
            >
                <SkillIcon skillId={row.id} size={SKILL_ICON_PX} />
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <span data-skill-name className="ui-text-small leading-none text-white whitespace-nowrap">{row.name}</span>
                    <span data-skill-level className="ui-text-body leading-none tabular-nums font-bold whitespace-nowrap">
                        {skillLevelText(row.level)}
                    </span>
                    <div className="h-[3px] w-full bg-black/60 overflow-hidden">
                        <div className="h-full bg-gi-primary" style={{ width: `${Math.round(xp.fill * 100)}%` }} />
                    </div>
                </div>
            </div>
        </Tooltip>
    );
};

/** A skill's hover tip under its name and level: its XP, what is left to the next level and the rate, read as it shows. */
const SkillTip = ({ heroId, row }) => {
    const v = skillTipView(row.xp, XpRateTracker.getRate(heroId, row.id));
    const lines = [
        [t('heroPanel.xp'), v.xp],
        v.toNext && [t('heroPanel.toNext'), v.toNext],
        [t('heroPanel.xpRate'), v.rate || t('heroPanel.noRate')]
    ].filter(Boolean);
    return (
        <dl data-skill-tip={row.id} className="grid grid-cols-[auto_auto] gap-x-3 leading-tight">
            {lines.map(([label, value]) => [
                <dt key={`${label}:l`} className="ui-text-small text-gi-muted">{label}</dt>,
                <dd key={`${label}:v`} className="ui-text-small tabular-nums text-white text-right">{value}</dd>
            ])}
        </dl>
    );
};
