import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '../../utils/cn.js';
import { getTokenType, tokenName } from '../../../config/registries/tokenRegistry.js';
import { getSkill } from '../../../config/registries/skillRegistry.js';
import { EntityRibbon } from '../base/EntityRibbon.jsx';
import { SkillIcon } from '../base/SkillIcon.jsx';
import { Tooltip } from '../base/Tooltip.jsx';
import { PixelGlyph } from '../base/PixelGlyph.jsx';
import { LandmarkBlock } from '../drawer/LandmarkBlock.jsx';
import { LeaveMatControl } from '../drawer/LeaveMatControl.jsx';
import { useTokenDetail } from './useTokenDetail.js';
import { subscribeToken } from './tokenEvents.js';
import { CARD_BLOCK, tokenCardModel, cycleText, drivenBy } from './tokenCard.js';
import { ArrowScrollList, PixelTriangle } from '../base/ArrowScrollList.jsx';
import { withArticle } from '../../../systems/effects/toolNames.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import { EventBus } from '../../../systems/core/EventBus.js';
import { UI_EVENTS } from '../../../systems/core/engineEvents.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as StationRecipe from '../../../systems/board/StationRecipe.js';
import { GameState } from '../../../state/GameState.js';
import { RecipeList } from './RecipeList.jsx';
import { takeRecipeListRequest, onRecipeListRequest } from './recipeFlip.js';
import { CloseX } from '../base/CloseX.jsx';
import { LimesBlurb } from '../limes/LimesBlurb.jsx';
import { StatCell } from '../base/StatCell.jsx';
import { TokenSprite, TOKEN_SURFACE } from '../base/TokenSprite.jsx';
import { lookUpRibbon, lookUpToken, lookUpRecipe, lookUpItem } from '../encyclopedia/encyclopediaLink.js';
import { t } from '../../../i18n/index.js';
import { onPoll } from './frameClock.js';

/** The activity scenes are 256 px square; they only ever draw at whole multiples of it. */
export const CARD_ART_PX = 256;

/** The card's width in screen pixels. */
export const CARD_WIDTH_PX = 320;

/** The window of art between the name and the panel. */
const CARD_ART_GAP_PX = 96;

/** How far an arrow press scrolls the card. */
const CARD_SCROLL_STEP_PX = 140;

/** The art's smallest scale on a card. */
const CARD_ART_MIN_SCALE = 2;

/** Clocks move without events: the card re-reads them this often while open. */
const CARD_REFRESH_MS = 1000;

const TONE_COLOUR = {
    warning: 'var(--color-ui-gold)',
    danger: 'var(--color-ui-red)'
};

const skillName = (id) => getSkill(id)?.name || (id ? id.charAt(0).toUpperCase() + id.slice(1) : '');

/** One section of the card's panel; a rule parts it from the one above. */
const Section = ({ children, className, ...rest }) => (
    <section className={cn('px-2 py-1.5 flex flex-col gap-1 border-t-2 border-white/15 first:border-t-0', className)} {...rest}>
        {children}
    </section>
);

const Heading = ({ children }) => (
    <span className="ui-text-small font-bold gi-caps tracking-wider text-gi-muted">{children}</span>
);

/** An icon and a number with a hover sentence. */
const Stat = ({ icon, text, tip, tone, ...rest }) => (
    <Tooltip title={tip}>
        <span className="inline-flex items-center gap-1 cursor-help" style={tone ? { color: TONE_COLOUR[tone] } : undefined} {...rest}>
            {icon}
            <span className="tabular-nums font-bold">{text}</span>
        </span>
    </Tooltip>
);

/** The book: this card's entry in the Encyclopedia. */
const LookUpButton = ({ onClick }) => (
    <button
        type="button"
        data-card-look-up
        title={t('encyclopedia.lookUp')}
        aria-label={t('encyclopedia.lookUp')}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        className="shrink-0 w-8 h-8 flex items-center justify-center text-gi-muted hover:text-white cursor-pointer"
    >
        <PixelGlyph name="book" />
    </button>
);

/** The header: the Token's name on its band; on a card opened from the mat, Limes, the book and the X at its right. */
const NameBlock = ({ name, onClose, onLookUp, className }) => (
    <header data-card-block="name" className={cn('flex items-center gap-1 pl-2 pr-1 py-1 bg-black/80 border-b-2 border-white/30', className)}>
        <h3 className="flex-1 min-w-0 ui-text-title font-bold text-white leading-tight select-text">{name}</h3>
        {onClose && <LimesBlurb spot="tokenCard" />}
        {onLookUp && <LookUpButton onClick={onLookUp} />}
        {onClose && (
            <CloseX data-card-close onClick={(e) => { e.stopPropagation(); onClose(); }} />
        )}
    </header>
);

const WorkCells = ({ skillId, level, xp }) => (
    <>
        <StatCell caption="Level">
            <Stat
                icon={<SkillIcon skillId={skillId} size={16} />}
                text={level}
                tip={`${skillName(skillId)}: a hero needs level ${level} to work this`}
                data-card-skill={skillId}
            />
        </StatCell>
        {xp > 0 && (
            <StatCell caption="XP">
                <Stat text={`+${xp.toLocaleString('en-US')}`} tip={`${xp.toLocaleString('en-US')} ${skillName(skillId)} XP each time a round of work finishes`} />
            </StatCell>
        )}
    </>
);

/** The cycle line's hover: the time and, when something nearby changes it, the time without it. */
const cycleTip = (cycleMs, baseMs) => {
    const shown = cycleText(cycleMs);
    const base = cycleText(baseMs);
    if (!baseMs || shown === base) return 'One round of work takes this long';
    return `One round of work takes this long: ${base} ${cycleMs < baseMs ? 'before speed-ups' : 'before slow-downs'}`;
};

const CycleCells = ({ cycleMs, baseMs, uses }) => (
    <>
        {cycleMs > 0 && (
            <StatCell caption="Time">
                <Stat icon={<PixelGlyph name="clock" />} text={cycleText(cycleMs)} tip={cycleTip(cycleMs, baseMs)} data-card-cycle />
            </StatCell>
        )}
        <StatCell caption="Charges">
            <Stat
                icon={<PixelGlyph name="charges" />}
                text={uses == null ? '∞' : uses.toLocaleString('en-US')}
                tip={uses == null ? 'Charges: unlimited' : `Charges: ${uses.toLocaleString('en-US')} left. Each round of work uses one`}
                data-card-charges
            />
        </StatCell>
    </>
);

const CombatCells = ({ skillId, level, xp }) => (
    <>
        <StatCell caption="Level">
            <Stat
                icon={<SkillIcon skillId={skillId} size={16} />}
                text={level}
                tip={`${skillName(skillId)}, level ${level}`}
                data-card-skill={skillId}
            />
        </StatCell>
        <StatCell caption="XP">
            <Stat text={`+${Number(xp).toLocaleString('en-US')}`} tip={`${Number(xp).toLocaleString('en-US')} XP for each one beaten`} />
        </StatCell>
    </>
);

const HpBar = ({ cur, max }) => {
    const pct = Math.max(0, Math.min(100, (cur / Math.max(1, max)) * 100));
    return (
        <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 bg-black/60 overflow-hidden">
                <div data-card-hp-fill className="h-full bg-gi-hp" style={{ width: `${pct}%` }} />
            </div>
            <span data-card-hp-text className="shrink-0 ui-text-body tabular-nums text-white/90">
                {`${Math.round(cur).toLocaleString('en-US')}/${Math.round(max).toLocaleString('en-US')}`}
            </span>
        </div>
    );
};

/** The basic information in one block: as many cells to a row as fit, the HP bar across the top. */
const StatsSection = ({ blocks }) => {
    const hp = blocks.find(b => b.id === CARD_BLOCK.HP);
    const cells = blocks.filter(b => b.id !== CARD_BLOCK.HP);
    return (
        <Section data-card-block="stats">
            {hp && <HpBar cur={hp.cur} max={hp.max} />}
            {cells.length > 0 && (
                <div className="grid gap-x-2 gap-y-1 grid-cols-[repeat(auto-fit,minmax(56px,1fr))]">
                    {cells.map(block => {
                        if (block.id === CARD_BLOCK.COMBAT) return <CombatCells key="combat" {...block} />;
                        if (block.id === CARD_BLOCK.WORK) return <WorkCells key="work" {...block} />;
                        return <CycleCells key="cycle" {...block} />;
                    })}
                </div>
            )}
        </Section>
    );
};

/** The recipe picked and the button that changes it. Nothing for a Token with no choice. */
const RecipeChoice = ({ block, instanceId, onChangeRecipe }) => {
    if (!block.recipeName && !block.change) return null;
    return (
        <Section data-card-block="recipe">
            {block.recipeName && (block.recipeId ? (
                <button
                    type="button"
                    data-card-recipe-link={block.recipeId}
                    title={t('encyclopedia.lookUp')}
                    onClick={(e) => { e.stopPropagation(); lookUpRecipe(block.recipeId); }}
                    className="self-start ui-text-body font-bold text-white hover:underline cursor-pointer text-left"
                >
                    {block.recipeName}
                </button>
            ) : <span className="ui-text-body font-bold text-white">{block.recipeName}</span>)}
            {block.change && !block.change.chosen && (
                <span className="ui-text-body" style={{ color: 'var(--color-ui-gold)' }}>
                    {block.change.empty}
                </span>
            )}
            {block.change && instanceId != null && (
                <button
                    type="button"
                    data-card-change-recipe
                    onClick={(e) => { e.stopPropagation(); onChangeRecipe?.(); }}
                    className="ui-frame-chamfer self-start px-3 py-1 ui-text-body font-bold cursor-pointer"
                    style={{ color: 'var(--color-ui-gold)' }}
                >
                    {block.change.label}
                </button>
            )}
        </Section>
    );
};

/** What the work takes: the tools a hero or the spot must have, and the items it uses up. */
const RequiresSection = ({ block }) => {
    if (!block.needs.length && !block.tools.length) return null;
    return (
        <Section data-card-block="requires">
            <Heading>Requires</Heading>
            {block.tools.length > 0 && (
                <div data-card-tools className="flex flex-col gap-1">
                    {block.tools.map(tool => (
                        <EntityRibbon
                            key={tool.typeId || tool.itemId || tool.name}
                            kind={tool.typeId ? 'token' : 'item'}
                            id={tool.typeId || tool.itemId || undefined}
                            name={tool.name}
                            size="sm"
                            wrap
                            countText=""
                            title={tool.inHand ? `A Hero needs ${withArticle(tool.name)} in hand to work this` : `Needs a ${tool.name} nearby`}
                            data-card-tool={tool.typeId || tool.itemId || tool.tag}
                            className="bg-transparent border-white/40"
                            onInspect={tool.typeId || tool.itemId ? lookUpRibbon : undefined}
                        />
                    ))}
                </div>
            )}
            {block.needs.length > 0 && (
                <div data-card-needs className="flex flex-col gap-1">
                    {block.needs.map(n => (
                        <EntityRibbon key={n.itemId} kind="item" id={n.itemId} have={n.have} required={n.need} size="sm" wrap onInspect={lookUpRibbon} />
                    ))}
                </div>
            )}
        </Section>
    );
};

const MakesSection = ({ makes }) => {
    if (!makes.length) return null;
    return (
        <Section data-card-block="makes">
            <Heading>Makes</Heading>
            <div data-card-makes className="flex flex-col gap-1">
                {makes.map(m => (
                    <EntityRibbon
                        key={m.rare ? `rare:${m.itemId}` : m.itemId}
                        kind="item"
                        id={m.itemId}
                        minQty={m.min}
                        maxQty={m.max}
                        chance={m.chance != null ? `${m.chance}%` : undefined}
                        size="sm"
                        wrap
                        onInspect={lookUpRibbon}
                    />
                ))}
            </div>
        </Section>
    );
};

// Each catch lands one, so the odds stand where a count would.
const CatchRibbons = ({ catches }) => catches.map(c => (
    <EntityRibbon key={c.itemId} kind="item" id={c.itemId} countText={`${c.chance}%`} size="sm" wrap onInspect={lookUpRibbon} />
));

/** A list that opens on a click, shut to begin with. */
const Collapsed = ({ label, children, ...rest }) => {
    const [open, setOpen] = useState(false);
    return (
        <div className="flex flex-col gap-1" {...rest}>
            <button
                type="button"
                data-card-collapse={open ? 'open' : 'shut'}
                aria-expanded={open}
                onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
                className="flex items-center gap-1.5 self-stretch text-left ui-text-body text-gi-text hover:text-white cursor-pointer"
            >
                <span className="inline-flex" style={open ? undefined : { transform: 'rotate(-90deg)' }}><PixelTriangle dir="down" /></span>
                <span className="font-bold">{label}</span>
            </button>
            {open && <div className="flex flex-col gap-1 pl-3">{children}</div>}
        </div>
    );
};

/** A water's catches: what the hero on it lands now, then the rest shut away by tool. */
const CatchSection = ({ catches: { heroName, setup, unable, groups } }) => (
    <Section data-card-block="catch">
        {setup && (
            <div data-card-catch-setup className="flex flex-col gap-1">
                <Heading>{heroName} catches</Heading>
                <span data-card-catch-gear className="ui-text-small text-gi-muted">
                    {setup.baitName ? `${setup.toolName} with ${setup.baitName}` : `${setup.toolName}, no bait`}
                </span>
                <CatchRibbons catches={setup.catches} />
            </div>
        )}
        {unable && (
            <span data-card-catch-unable className="ui-text-body" style={{ color: 'var(--color-ui-gold)' }}>
                {heroName} holds nothing that fishes here
            </span>
        )}
        {groups.length > 0 && <Heading>{setup ? 'With other gear' : 'Catches'}</Heading>}
        {groups.map(group => (
            <Collapsed key={group.tool} label={group.label} data-card-catch-tool={group.tool}>
                {group.pools.map(pool => (
                    <div key={pool.bait || 'plain'} data-card-catch-pool={pool.bait || 'plain'} className="flex flex-col gap-1">
                        <span className="ui-text-small text-gi-muted">{pool.baitName ? `With ${pool.baitName}` : 'No bait'}</span>
                        <CatchRibbons catches={pool.catches} />
                    </div>
                ))}
            </Collapsed>
        ))}
    </Section>
);

/** What a lifecycle line's icon reads as in the Events section, unless the line names itself. */
const EVENT_LABEL = { grow: 'Grows', regrow: 'Regrows', spawn: 'Spawns', turn: 'Turns', clock: 'Timer', reach: 'Reach' };

const EventsSection = ({ lines }) => (
    <Section data-card-block="lifecycle" className="ui-text-body text-gi-text">
        <Heading>Events</Heading>
        {lines.map((line, i) => (
            <div key={i} data-card-life={line.icon} className="flex items-baseline justify-between gap-2">
                <span className="text-gi-muted">{line.label || EVENT_LABEL[line.icon]}</span>
                <Stat icon={<PixelGlyph name={line.icon} />} text={line.text} tip={line.tip} tone={line.tone} />
            </div>
        ))}
    </Section>
);

/**
 * One Token in reach and what passes between: its art, its name and the effects in green. Its own
 * row rather than a ribbon, so a long name or tag wraps instead of being cut off.
 */
const SupportRow = ({ row, kind }) => (
    <Tooltip title={kind === 'by' ? `${row.name} gives this ${row.tags.join(', ')}` : `This gives ${row.name} ${row.tags.join(', ')}`}>
        <div
            data-card-support={kind}
            data-card-support-tags={row.tags.join('|')}
            className="flex items-center gap-2 border border-white/40 p-1 cursor-help"
        >
            <span className="w-8 h-8 shrink-0 flex items-center justify-center bg-black border border-white/10">
                <TokenSprite typeId={row.typeId} surface={TOKEN_SURFACE.CATALOGUE} alt={row.name} />
            </span>
            <span className="flex-1 min-w-0 flex flex-col leading-tight">
                <span className="text-xs font-bold text-gi-text">{row.name}</span>
                {row.tags.map(tag => (
                    <span key={tag} className="text-(length:--font-size-xs)" style={{ color: 'var(--color-ui-green)' }}>{tag}</span>
                ))}
            </span>
        </div>
    </Tooltip>
);

const SupportSection = ({ boostedBy, boosts, floor }) => (
    <Section data-card-block="support">
        {boostedBy.length > 0 && (
            <div data-card-boosted-by className="flex flex-col gap-1">
                <Heading>Boosted by</Heading>
                {boostedBy.map(r => <SupportRow key={r.id} row={r} kind="by" />)}
            </div>
        )}
        {floor.map(note => (
            <span key={note} data-card-floor className="ui-text-small" style={{ color: 'var(--color-ui-gold)' }}>{note}</span>
        ))}
        {boosts.length > 0 && (
            <div data-card-boosts className="flex flex-col gap-1">
                <Heading>Boosts</Heading>
                {boosts.map(r => <SupportRow key={r.id} row={r} kind="to" />)}
            </div>
        )}
    </Section>
);

const DropsSection = ({ drops }) => (
    <Section data-card-block="drops">
        <Heading>Drops</Heading>
        {drops.map(d => (
            <EntityRibbon key={d.rare ? `rare:${d.itemId}` : d.itemId} kind="item" id={d.itemId} minQty={d.min} maxQty={d.max} chance={`${d.chance}%`} size="sm" wrap onInspect={lookUpRibbon} />
        ))}
    </Section>
);

/** What the card's layout has no section of its own for: a landmark's challenge, a buff, the stations a tool drives. */
const MoreBlock = ({ typeId }) => {
    const def = getTokenType(typeId);
    if (!def) return null;
    return (
        <div data-card-block="more" className="flex flex-col border-t-2 border-white/15 first:border-t-0">
            <LandmarkBlock def={def} />
            {def.buff && (
                <Section className="ui-text-body text-gi-text">
                    <Heading>Buffs {def.buff.target === 'hero' ? 'the hero on it' : 'nearby Tokens'}</Heading>
                    {def.buff.modifiers.map((m, i) => (
                        <span key={i}>
                            {m.type.replace(/_/g, ' ').toLowerCase()}{' '}
                            <span className="tabular-nums" style={{ color: 'var(--color-ui-green)' }}>
                                {m.bucket === 'percentage'
                                    ? `${m.value > 0 ? '+' : ''}${Math.round(m.value * 100)}%`
                                    : `${m.value > 0 ? '+' : ''}${m.value}`}
                            </span>
                        </span>
                    ))}
                </Section>
            )}
            <DrivesLine def={def} />
        </div>
    );
};

/** What a tool or support Token serves; nothing at all for one nothing uses any more. */
const DrivesLine = ({ def }) => {
    const driven = drivenBy(def);
    if (!driven.length) return null;
    return (
        <Section className="ui-text-body text-gi-text">
            <Tooltip title="Serves every nearby station, and wears once per cycle it serves">
                <span className="cursor-help">
                    <Heading>{def.isTool ? 'Tool for' : 'Drives'}</Heading>{' '}
                    {driven.map(tokenName).join(', ')}
                </span>
            </Tooltip>
        </Section>
    );
};

/** Re-render each second while open, and on a fight's HP change. */
function useCardClock(instanceId, enemy) {
    const [, setNow] = useState(0);
    useEffect(() => {
        return onPoll(() => setNow(n => n + 1), CARD_REFRESH_MS);
    }, []);
    useEffect(() => {
        if (!enemy || instanceId == null) return undefined;
        let last = null;
        return subscribeToken(BOARD_EVENTS.PROGRESS, instanceId, (p) => {
            if (!p?.combat || p.enemyHp === last) return;
            last = p.enemyHp;
            setNow(n => n + 1);
        });
    }, [instanceId, enemy]);
}

/** The whole multiple of the 256 px art that covers a box of this size, `minScale` at least. */
export const coverScale = (w, h, minScale = 1) => Math.max(minScale, Math.ceil(Math.max(Number(w) || 0, Number(h) || 0) / CARD_ART_PX));

/** The art's scale and whole-pixel offsets to fill a box of this size, centred. */
export function artPlacement(w, h, minScale = CARD_ART_MIN_SCALE) {
    const scale = coverScale(w, h, minScale);
    const px = CARD_ART_PX * scale;
    return { scale, left: Math.round((w - px) / 2), top: Math.round((h - px) / 2) };
}

/**
 * Which face of the card shows: its blocks, or the recipe list Change recipe flips it to. A list
 * asked for before the card opened (the mat's recipe gear) opens it on the list.
 */
function useCardView(instanceId, onViewChange) {
    const [view, setViewState] = useState(() => (takeRecipeListRequest(instanceId) ? 'recipes' : 'card'));
    const setView = useCallback((next) => {
        setViewState(next);
        onViewChange?.(next);
    }, [onViewChange]);
    const first = useRef(true);
    useEffect(() => {
        if (first.current) { first.current = false; return; }
        setView(takeRecipeListRequest(instanceId) ? 'recipes' : 'card');
    }, [instanceId]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => onRecipeListRequest((id) => {
        if (id === instanceId && takeRecipeListRequest(id)) setView('recipes');
    }), [instanceId, setView]);
    return [view, setView];
}

/** A window onto the card's art, at a whole multiple and whole-pixel offsets however big it is. */
const ArtWindow = ({ art, className, style, children }) => {
    const ref = useRef(null);
    const [place, setPlace] = useState(() => artPlacement(0, 0));
    const fit = useCallback(() => {
        const el = ref.current;
        if (!el) return;
        const next = artPlacement(el.offsetWidth, el.offsetHeight);
        setPlace(prev => (prev.scale === next.scale && prev.left === next.left && prev.top === next.top ? prev : next));
    }, []);
    // Measured once before the first paint; after that the observer below follows the size, which
    // changes with the card's content, so the card's clock re-rendering it measures nothing.
    useLayoutEffect(fit, [fit]);
    useEffect(() => {
        const el = ref.current;
        if (!el || typeof ResizeObserver === 'undefined') return undefined;
        const ro = new ResizeObserver(fit);
        ro.observe(el);
        return () => ro.disconnect();
    }, [fit]);
    const px = CARD_ART_PX * place.scale;
    return (
        <div ref={ref} data-card-art-window className={cn('overflow-hidden', className)} style={style}>
            <img
                data-card-art-img
                data-card-art-scale={place.scale}
                src={art.path}
                alt=""
                draggable={false}
                className="absolute select-none pointer-events-none"
                // ⚠️ Inline: the page's image rule caps width at 100 % over a max-w class, squashing the art.
                style={{ left: place.left, top: place.top, width: px, height: px, maxWidth: 'none', imageRendering: 'pixelated' }}
            />
            {children}
        </div>
    );
};

/**
 * The card's body: the art behind the whole card, a window of it between the name and a
 * see-through panel. ⚠️ The height cap is on the card, not the list, so the arrow bars take their
 * room inside it and run over the art. A cap on the list alone puts them outside it, so a card
 * a few pixels over the cap gets bars taller than what they hide.
 */
const CardBody = ({ art, header, panel, listing }) => (
    <>
        {art && <ArtWindow art={art} className="absolute inset-0" />}
        <ArrowScrollList step={CARD_SCROLL_STEP_PX} compact className="relative min-h-0 flex flex-col" barClassName="relative">
            {header}
            {art && !listing && <div data-card-art-gap className="shrink-0" style={{ height: CARD_ART_GAP_PX }} />}
            <div data-card-panel className={cn('flex flex-col', art ? 'bg-black/70' : 'bg-gi-base')}>{panel}</div>
        </ArrowScrollList>
    </>
);

const STAT_BLOCKS = new Set([CARD_BLOCK.HP, CARD_BLOCK.COMBAT, CARD_BLOCK.WORK, CARD_BLOCK.CYCLE]);

/**
 * The Token card: the card a click on a Token opens. A header with the name, then one panel of
 * sections following `tokenCardModel`: the stat block, the recipe picked, Requires, Makes or a
 * water's catches, Events, Boosted by, Drops. A section with nothing to say is left out. Every
 * icon and number explains itself on hover.
 */
export const TokenCard = ({ typeId, instanceId = null, onClose = null, onViewChange = null }) => {
    const def = getTokenType(typeId);
    const [view, setView] = useCardView(instanceId, onViewChange);
    // Charges, a picked recipe, a hero arriving: re-read on this Token's own events.
    useTokenDetail(instanceId, def);
    useCardClock(instanceId, !!def?.enemy);

    // ⚠️ The engine cannot see a card open: this tells it, once per Token shown, and the
    // tutorial's "inspect an endgame site" step counts it (`QuestManager`).
    useEffect(() => {
        if (instanceId == null || !typeId) return;
        EventBus.publish(UI_EVENTS.TOKEN_INSPECTED, { instanceId, typeId });
    }, [instanceId, typeId]);

    const model = tokenCardModel(typeId, instanceId);
    const instance = instanceId != null ? BoardState.getTokenById(instanceId) : null;
    const canList = !!model && !!instance && model.blocks.some(b => b.id === CARD_BLOCK.RECIPE && b.change);
    const listing = view === 'recipes' && canList;
    if (!model) return null;
    const { art } = model;

    const choose = (recipeId) => {
        // `setSelectedRecipe` is the only writer, and refuses an id outside this Token's pool.
        if (StationRecipe.setSelectedRecipe(BoardState.getTokenById(instanceId), recipeId, def)) setView('card');
    };

    const stats = model.blocks.filter(b => STAT_BLOCKS.has(b.id));
    const sections = model.blocks.flatMap(block => {
        switch (block.id) {
            case CARD_BLOCK.RECIPE: return [
                <RecipeChoice key="recipe" block={block} instanceId={instanceId} onChangeRecipe={() => setView('recipes')} />,
                <RequiresSection key="requires" block={block} />,
                <MakesSection key="makes" makes={block.makes} />,
                block.catches ? <CatchSection key="catch" catches={block.catches} /> : null
            ];
            case CARD_BLOCK.LIFECYCLE: return [<EventsSection key="lifecycle" lines={block.lines} />];
            case CARD_BLOCK.SUPPORT: return [<SupportSection key="support" {...block} />];
            case CARD_BLOCK.DROPS: return [<DropsSection key="drops" drops={block.drops} />];
            case CARD_BLOCK.MORE: return [<MoreBlock key="more" typeId={typeId} />];
            default: return [];
        }
    });

    const header = <NameBlock name={model.name} onClose={onClose} onLookUp={onClose ? () => lookUpToken(typeId) : null} />;
    const panel = listing ? (
        <div className="p-1.5">
            <RecipeList
                def={def}
                instanceId={instanceId}
                selectedRecipeId={instance.selectedRecipeId || null}
                workerId={BoardState.workerOf(instanceId) || null}
                heroes={GameState.state?.heroes || []}
                onChoose={choose}
                onBack={() => setView('card')}
                onLookUp={onClose ? (itemId) => lookUpItem(itemId, { back: { recipesOf: instanceId } }) : undefined}
            />
        </div>
    ) : (
        <>
            {stats.length > 0 && <StatsSection blocks={stats} />}
            {sections}
            {instanceId != null && <LeaveMatControl instanceId={instanceId} />}
        </>
    );

    return (
        <div
            data-token-card={model.enemy ? 'enemy' : 'token'}
            data-card-art={art ? art.source : 'none'}
            data-card-view={listing ? 'recipes' : 'card'}
            className="relative overflow-hidden flex flex-col max-h-[75vh]"
            style={listing ? { width: 'max-content', minWidth: CARD_WIDTH_PX, maxWidth: 'calc(100vw - 48px)' } : { width: CARD_WIDTH_PX }}
        >
            <CardBody art={art} header={header} panel={panel} listing={listing} />
        </div>
    );
};
