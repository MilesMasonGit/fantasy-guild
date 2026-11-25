import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '../../utils/cn.js';
import { getTokenType, tokenName } from '../../../config/registries/tokenRegistry.js';
import { getSkill } from '../../../config/registries/skillRegistry.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { EntityRibbon } from '../base/EntityRibbon.jsx';
import { SkillIcon } from '../base/SkillIcon.jsx';
import { Tooltip } from '../base/Tooltip.jsx';
import { EffectName } from '../base/EffectName.jsx';
import { explainLinesOf } from '../base/effectExplain.js';
import { PixelGlyph } from '../base/PixelGlyph.jsx';
import { LandmarkBlock } from '../drawer/LandmarkBlock.jsx';
import { LeaveMatControl } from '../drawer/LeaveMatControl.jsx';
import { useTokenDetail } from './useTokenDetail.js';
import { subscribeToken } from './tokenEvents.js';
import { CARD_BLOCK, tokenCardModel, drivenBy } from './tokenCard.js';
import { lengthText, chanceText, oneInText } from '../../../utils/Formatters.js';
import { ArrowScrollList, PixelTriangle } from '../base/ArrowScrollList.jsx';
import { withArticle } from '../../../systems/effects/toolNames.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as StationRecipe from '../../../systems/board/StationRecipe.js';
import * as Summons from '../../../systems/board/Summons.js';
import { GameState } from '../../../state/GameState.js';
import { useGameState } from '../../hooks/useGameState.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';
import { RecipeList } from './RecipeList.jsx';
import { takeRecipeListRequest, onRecipeListRequest } from './recipeFlip.js';
import { CloseX } from '../base/CloseX.jsx';
import { LimesBlurb } from '../limes/LimesBlurb.jsx';
import { StatCell } from '../base/StatCell.jsx';
import { TokenSprite, TOKEN_SURFACE } from '../base/TokenSprite.jsx';
import { lookUpRibbon, lookUpToken, lookUpRecipe, lookUpItem } from '../encyclopedia/encyclopediaLink.js';
import { t } from '../../../i18n/index.js';
import { onPoll } from './frameClock.js';
import { EffectBadgeGrid, EffectChip, ItemBadges } from './EffectBadges.jsx';
import { chanceBreakdownText, effectTagOf, TONE_COLOUR as BADGE_COLOUR } from './effectBadgeText.js';
import { EFFECT_KEY } from '../../../systems/board/EffectBreakdown.js';
import { STAR_COLOUR } from './fx/rareTwinkle.js';
import { levelNeed, skillLevel } from '../../../systems/core/levelNeed.js';
import * as SpawnerSystem from '../../../systems/board/SpawnerSystem.js';
import * as Growth from '../../../systems/board/Growth.js';
import { problemOf, problemText, PROBLEM_COLOUR, PROBLEM_SPRITE } from './problemMark.js';
import { EnemyCardRows } from '../combat/EnemyCard.jsx';
import { TheftSection, StealsSection, CampList } from './HideoutCard.jsx';
import * as Hideouts from '../../../systems/board/Hideouts.js';

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

/**
 * What is wrong with the Token, said once: the reason behind its '!' on the mat (the mat itself
 * has no tooltips), in the mark's colour, read each time the card redraws. Nothing when nothing is
 * wrong; a choice waiting is the recipe list the card opens on.
 */
export const ProblemLine = ({ instanceId }) => {
    const instance = BoardState.getTokenById(instanceId);
    if (!instance) return null;
    const problem = problemOf({
        alert: instance.alert || null,
        spawner: SpawnerSystem.spawnerAlertOf(instanceId),
        growth: Growth.growthAlertOf(instanceId)
    });
    const text = problem ? problemText(problem, instanceId) : '';
    if (!text) return null;
    return (
        <Section data-card-block="problem" data-card-problem={problem.kind}>
            <span className="flex items-center gap-1.5 ui-text-body font-bold" style={{ color: PROBLEM_COLOUR[problem.severity] }}>
                <img src={PROBLEM_SPRITE[problem.severity]} alt="" draggable={false} className="w-4 h-4 shrink-0" style={{ imageRendering: 'pixelated' }} />
                {text}
            </span>
        </Section>
    );
};

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

/** A station with nothing chosen has no level (null) and no XP: neither cell shows. */
const WorkCells = ({ skillId, level, xp }) => (
    <>
        {level != null && (
            <StatCell caption="Level">
                <Stat
                    icon={<SkillIcon skillId={skillId} size={16} />}
                    text={level}
                    tip={levelNeed(skillId, level).text}
                    data-card-skill={skillId}
                />
            </StatCell>
        )}
        {xp > 0 && (
            <StatCell caption="XP">
                <Stat text={`+${xp.toLocaleString('en-US')}`} tip={`${xp.toLocaleString('en-US')} ${skillName(skillId)} XP each time a round of work finishes`} />
            </StatCell>
        )}
    </>
);

/** The cycle line's hover: the time and, when something nearby changes it, the time without it. */
const cycleTip = (cycleMs, baseMs) => {
    const shown = lengthText(cycleMs);
    const base = lengthText(baseMs);
    if (!baseMs || shown === base) return 'One round of work takes this long';
    return `One round of work takes this long: ${base} ${cycleMs < baseMs ? 'before speed-ups' : 'before slow-downs'}`;
};

/** The Ends cell's figure: the odds while they fit ("1 in 5", "1 in 25"), else the chance ("0.1%"). */
const endsCellText = (endChance) => (100 / endChance < 99.5 ? oneInText(endChance) : chanceText(endChance));

const CycleCells = ({ cycleMs, baseMs, uses, endChance }) => (
    <>
        {cycleMs > 0 && (
            <StatCell caption="Time">
                <Stat icon={<PixelGlyph name="clock" />} text={lengthText(cycleMs)} tip={cycleTip(cycleMs, baseMs)} data-card-cycle />
            </StatCell>
        )}
        {endChance != null ? (
            <StatCell caption="Ends">
                {/* No icon and the odds on one line: the cell is as narrow as a count's. */}
                <Stat
                    text={<span className="whitespace-nowrap">{endsCellText(endChance)}</span>}
                    tip={`Each round of work has a ${oneInText(endChance)} chance to be its last`}
                    data-card-ends
                />
            </StatCell>
        ) : (
            <StatCell caption="Charges">
                <Stat
                    icon={<PixelGlyph name="charges" />}
                    text={uses == null ? '∞' : uses.toLocaleString('en-US')}
                    tip={uses == null ? 'Charges: unlimited' : `Charges: ${uses.toLocaleString('en-US')} left. Each round of work uses one`}
                    data-card-charges
                />
            </StatCell>
        )}
    </>
);

const CombatCells = ({ skillId, level, xp }) => (
    <>
        <StatCell caption={t('fight.card.style')}>
            <Stat
                icon={<SkillIcon skillId={skillId} size={16} />}
                text={skillName(skillId)}
                tip={t('fight.card.styleTip', { style: skillName(skillId) })}
                data-card-style={skillId}
            />
        </StatCell>
        <StatCell caption="Level">
            <Stat
                icon={<SkillIcon skillId={skillId} size={16} />}
                text={level}
                tip={skillLevel(skillId, level).text}
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

/** The item line's badges for `itemId` in a breakdown's `outputs` or `inputs`, or nothing. */
const itemBadges = (lines, itemId) => {
    const line = (lines || []).find(l => l.itemId === itemId);
    return line ? <ItemBadges line={line} /> : undefined;
};

/**
 * The basic information in one block: as many cells to a row as fit, the HP bar across the top,
 * the effect badges under them.
 */
const StatsSection = ({ blocks, effects }) => {
    const hp = blocks.find(b => b.id === CARD_BLOCK.HP);
    const cells = blocks.filter(b => b.id !== CARD_BLOCK.HP && !(b.id === CARD_BLOCK.WORK && b.level == null && !(b.xp > 0)));
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
            <EffectBadgeGrid breakdown={effects} heroDef={effects?.heroId ? (GameState.state?.heroes || []).find(h => h?.id === effects.heroId) : null} />
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
            {instanceId != null && <CircleSummonLine instanceId={instanceId} />}
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

/** A Summoning Circle's Summoned worker and its charges left, while one it called stands. */
const CircleSummonLine = ({ instanceId }) => {
    const summon = useGameState(
        () => {
            const record = Summons.summonOfCircle(instanceId);
            return record ? { name: record.name, charges: Summons.chargesOf(record.id) } : null;
        },
        [BOARD_EVENTS.SUMMON_CHANGED, ENGINE_EVENTS.HEROES_UPDATED, ENGINE_EVENTS.GAME_RESET],
        null,
        { deps: [instanceId] }
    );
    if (!summon) return null;
    return (
        <span data-card-summon className="ui-text-body text-gi-gold">
            {t('summon.ofCircle', { name: summon.name, charges: t('summon.charges', { count: summon.charges }) })}
        </span>
    );
};

/** What the work takes: the tools a hero or the spot must have, and the items it uses up. */
const RequiresSection = ({ block, effects }) => {
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
                        <EntityRibbon
                            key={n.itemId}
                            kind="item"
                            id={n.itemId}
                            have={n.have}
                            required={n.need}
                            badge={itemBadges(effects?.inputs, n.itemId)}
                            size="sm"
                            wrap
                            onInspect={lookUpRibbon}
                        />
                    ))}
                </div>
            )}
        </Section>
    );
};

const MakesSection = ({ makes, bonus = [], effects }) => {
    if (!makes.length && !bonus.length) return null;
    return (
        <>
            {makes.length > 0 && (
                <Section data-card-block="makes">
                    <Heading>Loot</Heading>
                    <div data-card-makes className="flex flex-col gap-1">
                        {makes.map(m => (
                            <EntityRibbon
                                key={m.itemId}
                                kind="item"
                                id={m.itemId}
                                minQty={m.min}
                                maxQty={m.max}
                                chance={m.chance != null ? chanceText(m.chance) : undefined}
                                badge={itemBadges(effects?.outputs, m.itemId)}
                                size="sm"
                                wrap
                                onInspect={lookUpRibbon}
                            />
                        ))}
                    </div>
                </Section>
            )}
            {bonusSources(bonus).map(group => (
                <Section key={group.key} data-card-block="bonus" data-card-bonus-source={group.source}>
                    <div className="flex items-baseline justify-between gap-2">
                        <Heading>{group.source}</Heading>
                        <span data-card-bonus-hero-name className="ui-text-small text-gi-muted truncate">{group.heroName}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                        {group.rows.map((b, i) => (
                            <EntityRibbon
                                key={`${b.itemId}:${i}`}
                                kind="item"
                                id={b.itemId}
                                minQty={b.min}
                                maxQty={b.max}
                                chance={b.chance != null ? chanceText(b.chance) : undefined}
                                data-card-bonus={b.itemId}
                                data-card-bonus-hero={b.heroId}
                                size="sm"
                                wrap
                                onInspect={lookUpRibbon}
                            />
                        ))}
                    </div>
                </Section>
            ))}
        </>
    );
};

/** The bonus rows grouped by what brings them (a potion, a gear piece), in the order first met. */
function bonusSources(bonus) {
    const groups = new Map();
    for (const row of bonus) {
        const key = `${row.heroId}|${row.source}`;
        if (!groups.has(key)) groups.set(key, { key, source: row.source, heroName: row.heroName, rows: [] });
        groups.get(key).rows.push(row);
    }
    return [...groups.values()];
}

// Each catch lands one, so the odds stand where a count would.
const CatchRibbons = ({ catches, outputs }) => catches.map(c => (
    <EntityRibbon key={c.itemId} kind="item" id={c.itemId} countText={chanceText(c.chance)} badge={itemBadges(outputs, c.itemId)} size="sm" wrap onInspect={lookUpRibbon} />
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
const CatchSection = ({ catches: { heroName, setup, unable, groups }, effects }) => (
    <Section data-card-block="catch">
        {setup && (
            <div data-card-catch-setup className="flex flex-col gap-1">
                <Heading>{heroName} catches</Heading>
                <span data-card-catch-gear className="ui-text-small text-gi-muted">
                    {setup.baitName ? `${setup.toolName} with ${setup.baitName}` : `${setup.toolName}, no bait`}
                </span>
                <CatchRibbons catches={setup.catches} outputs={effects?.outputs} />
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

/** "Fishing Rod or Harpoon". */
const toolsSpoken = (names) => names.join(t('fishing.card.toolsJoin'));

/** A fish row's hover: what catches it, at what level, whether a hero has it yet, which lure picks it. */
function fishTip(row, skill, best, fishName) {
    const vars = { fish: fishName, tools: toolsSpoken(row.toolNames), skill, level: row.level, best };
    const caught = t(row.reachable ? 'fishing.card.tip' : 'fishing.card.tipOut', vars);
    return row.lureNames.length ? `${caught} ${t('fishing.card.tipLure', { lure: row.lureNames.join(', ') })}` : caught;
}

/**
 * A water's fish: every fish it can give where it stands, each with the tool that catches it, its
 * Fishing level (greyed while no hero has it) and the lure that picks it.
 */
const FishSection = ({ fish: { skillId, best, rows } }) => {
    const skill = skillName(skillId);
    return (
        <Section data-card-block="fish">
            <Heading>{t('fishing.card.heading')}</Heading>
            <div className="flex flex-col gap-1">
                {rows.map(row => {
                    const lure = row.lureNames.length ? t('fishing.card.lure', { lure: row.lureNames.join(', ') }) : null;
                    return (
                        // ⚠️ The lure stands on its own line: a ribbon's subtitle never wraps and would cut it off.
                        <div
                            key={row.itemId}
                            data-card-fish={row.itemId}
                            data-card-fish-reach={row.reachable ? 'in' : 'out'}
                            data-card-fish-lure={row.lures.join(' ') || undefined}
                            className={cn('flex flex-col gap-0.5', !row.reachable && 'opacity-50 grayscale')}
                        >
                            <EntityRibbon
                                kind="item"
                                id={row.itemId}
                                subtitle={toolsSpoken(row.toolNames)}
                                title={fishTip(row, skill, best, getItem(row.itemId)?.name || row.itemId)}
                                badge={<SkillIcon skillId={skillId} size={16} />}
                                countText={String(row.level)}
                                size="sm"
                                wrap
                                onInspect={lookUpRibbon}
                            />
                            {lure && <span data-card-fish-lure-name className="ui-text-small text-gi-muted pl-2 break-words">{lure}</span>}
                        </div>
                    );
                })}
            </div>
        </Section>
    );
};

/** What a lifecycle line's icon reads as in the Events section, unless the line names itself. */
const EVENT_LABEL = { grow: 'Grows', regrow: 'Respawns', spawn: 'Spawns', clock: 'Timer', reach: 'Reach' };

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
 * One Token in reach this one boosts: its art, its name and the effects as their badges write them,
 * green, or red for one that works against it. Its own row rather than a ribbon, so a long name or
 * tag wraps instead of being cut off.
 */
export const SupportRow = ({ row }) => (
    <Tooltip title={`This gives ${row.name} ${row.tags.map(tag => tag.text).join(', ')}`} lines={explainLinesOf(row.tags.map(tag => tag.type))}>
        <div
            data-card-support="to"
            data-card-support-tags={row.tags.map(tag => tag.text).join('|')}
            className="flex items-center gap-2 border border-white/40 p-1 cursor-help"
        >
            <span className="w-8 h-8 shrink-0 flex items-center justify-center bg-black border border-white/10">
                <TokenSprite typeId={row.typeId} surface={TOKEN_SURFACE.CATALOGUE} alt={row.name} />
            </span>
            <span className="flex-1 min-w-0 flex flex-col leading-tight">
                <span className="text-xs font-bold text-gi-text">{row.name}</span>
                {row.tags.map(tag => (
                    <span key={tag.text} className="text-(length:--font-size-xs)" style={{ color: BADGE_COLOUR[tag.against ? 'down' : 'up'] }}>{tag.text}</span>
                ))}
            </span>
        </div>
    </Tooltip>
);

const SupportSection = ({ boosts }) => (
    <Section data-card-block="support">
        <div data-card-boosts className="flex flex-col gap-1">
            <Heading>Boosts</Heading>
            {boosts.map(r => <SupportRow key={r.id} row={r} />)}
        </div>
    </Section>
);

const rareQty = (r) => (r.min === 1 && r.max === 1 ? undefined : r.min === r.max ? `×${r.min}` : `×${r.min}–${r.max}`);

/**
 * The rare drop table as one group: its chance in the twinkle's colour and the Lucky badge on its
 * heading; a click opens the list of what it can find, each at its odds, and another shuts it.
 * With Lucky counted, the hover says how the chance was reached.
 */
const RareFinds = ({ rare, lucky }) => {
    const [open, setOpen] = useState(false);
    const reached = chanceBreakdownText(lucky);
    return (
        <div data-card-rare={open ? 'open' : 'shut'} className="flex flex-col gap-1">
            <Tooltip title={t('effectBadges.card.rareFinds')} lines={reached ? [reached, t('effectBadges.card.rareTip')] : [t('effectBadges.card.rareTip')]}>
                <button
                    type="button"
                    data-card-rare-toggle
                    aria-expanded={open}
                    onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
                    className="flex items-center gap-1.5 self-stretch text-left ui-text-body text-gi-text hover:text-white cursor-pointer"
                >
                    <span className="inline-flex" style={open ? undefined : { transform: 'rotate(-90deg)' }}><PixelTriangle dir="down" /></span>
                    <span className="font-bold">{t('effectBadges.card.rareFinds')}</span>
                    <span data-card-rare-chance className="font-bold tabular-nums" style={{ color: STAR_COLOUR }}>{chanceText(rare.chance)}</span>
                    <span className="flex-1" />
                    {lucky && <EffectChip badge={lucky} small />}
                </button>
            </Tooltip>
            {open && (
                <div data-card-rare-list className="flex flex-col gap-1 pl-3">
                    {rare.rows.map(r => (
                        <EntityRibbon
                            key={r.itemId}
                            kind="item"
                            id={r.itemId}
                            subtitle={rareQty(r)}
                            countText={chanceText(r.chance)}
                            size="sm"
                            wrap
                            onInspect={lookUpRibbon}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

const luckyOf = (effects) => effects?.effects.find(b => b.key === EFFECT_KEY.LUCKY) || null;

/** An enemy's drops, or a Token's rare finds alone under the same heading. */
const DropsSection = ({ drops = [], rare, effects }) => (
    <Section data-card-block="drops">
        <Heading>{t('effectBadges.card.drops')}</Heading>
        {drops.map(d => (
            <EntityRibbon
                key={d.itemId}
                kind="item"
                id={d.itemId}
                minQty={d.min}
                maxQty={d.max}
                chance={chanceText(d.chance)}
                badge={itemBadges(effects?.outputs, d.itemId)}
                size="sm"
                wrap
                onInspect={lookUpRibbon}
            />
        ))}
        {rare && <RareFinds rare={rare} lucky={luckyOf(effects)} />}
    </Section>
);

/** An enemy in a fight: what it hits with, its moves, what it resists, how often it attacks, its kinds. */
const FightSection = ({ block }) => (
    <Section data-card-block="fight">
        <EnemyCardRows card={block} stats={false} />
    </Section>
);

/** What the card's layout has no section of its own for: a landmark's challenge, a buff, the stations a tool drives. */
export const MoreBlock = ({ typeId }) => {
    const def = getTokenType(typeId);
    if (!def) return null;
    return (
        <div data-card-block="more" className="flex flex-col border-t-2 border-white/15 first:border-t-0">
            <LandmarkBlock def={def} />
            {def.buff && (
                <Section className="ui-text-body text-gi-text">
                    <Heading>Buffs {def.buff.target === 'hero' ? 'the hero on it' : 'nearby Tokens'}</Heading>
                    {def.buff.modifiers.map((m, i) => {
                        const tag = effectTagOf(m);
                        return (
                            <span key={i} data-card-buff-tag className="tabular-nums" style={{ color: BADGE_COLOUR[tag.against ? 'down' : 'up'] }}>
                                <EffectName type={tag.type}>{tag.text}</EffectName>
                            </span>
                        );
                    })}
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
 * Which face of the card shows: its blocks, or the recipe list Change flips it to. A Token with
 * nothing chosen yet opens on the list, and so does one whose list was asked for before the card
 * opened (coming back from looking an item up).
 */
function useCardView(instanceId, onViewChange, unchosen) {
    const opensOnList = () => takeRecipeListRequest(instanceId) || unchosen;
    const [view, setViewState] = useState(() => (opensOnList() ? 'recipes' : 'card'));
    const setView = useCallback((next) => {
        setViewState(next);
        onViewChange?.(next);
    }, [onViewChange]);
    const first = useRef(true);
    useEffect(() => {
        if (first.current) { first.current = false; return; }
        setView(opensOnList() ? 'recipes' : 'card');
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
 * sections following `tokenCardModel`: the stat block with its effect badges, the recipe picked,
 * Requires, Loot and a section per bonus drop source, Rare finds or a water's fish and catches, Events, Boosts, an
 * enemy's fight, Drops. A section with nothing
 * to say is left out. Every icon and number explains itself on hover.
 */
/**
 * The warning a Summoning Circle's card gives before a pick that dismisses its Summoned worker
 * (`Summons.dismissWarning`): its name and charges, Change to go ahead, Keep to stay as it is.
 */
const SummonDismissConfirm = ({ warning, onConfirm, onKeep }) => (
    <div data-summon-dismiss={warning.heroId} className="mb-1.5 bg-black/75 border border-gi-gold/60 px-2 py-1.5 flex flex-col gap-1.5">
        <span className="ui-text-body text-white leading-tight">
            {t('summon.dismissWarning', { name: warning.name, charges: t('summon.charges', { count: warning.charges }) })}
        </span>
        <div className="flex gap-1.5 justify-end">
            <button
                type="button"
                data-summon-dismiss-keep
                onClick={(e) => { e.stopPropagation(); onKeep(); }}
                className="bg-black/65 px-2 py-0.5 ui-text-body text-gi-muted hover:text-white cursor-pointer"
            >
                {t('summon.dismissKeep')}
            </button>
            <button
                type="button"
                data-summon-dismiss-confirm
                onClick={(e) => { e.stopPropagation(); onConfirm(); }}
                className="bg-gi-gold/20 px-2 py-0.5 ui-text-body font-bold text-gi-gold hover:text-white cursor-pointer"
            >
                {t('summon.dismissConfirm')}
            </button>
        </div>
    </div>
);

export const TokenCard = ({ typeId, instanceId = null, onClose = null, onViewChange = null }) => {
    const def = getTokenType(typeId);
    const model = tokenCardModel(typeId, instanceId);
    const instance = instanceId != null ? BoardState.getTokenById(instanceId) : null;
    const choice = instance ? model?.blocks.find(b => b.id === CARD_BLOCK.RECIPE && b.change)?.change : null;
    // A Hideout's choice is the camp it robs: its list face is the camps in reach.
    const theft = instance ? model?.blocks.find(b => b.id === CARD_BLOCK.THEFT && b.change) : null;
    const canList = !!choice || !!theft;
    const [view, setView] = useCardView(instanceId, onViewChange, choice ? !choice.chosen : (!!theft && !theft.change.chosen));
    // Charges, a picked recipe, a hero arriving: re-read on this Token's own events.
    useTokenDetail(instanceId, def);
    useCardClock(instanceId, !!def?.enemy);

    // A Summoning Circle's pick that would dismiss its Summoned worker, held until the player says.
    const [dismissing, setDismissing] = useState(null);

    const listing = view === 'recipes' && canList;
    if (!model) return null;
    const { art } = model;

    const pick = (recipeId) => {
        setDismissing(null);
        // `setSelectedRecipe` is the only writer, and refuses an id outside this Token's pool.
        if (StationRecipe.setSelectedRecipe(BoardState.getTokenById(instanceId), recipeId, def)) setView('card');
    };
    // One summon per Circle: picking another kind asks first, since it dismisses the one standing.
    const choose = (recipeId) => {
        const warning = Summons.dismissWarning(BoardState.getTokenById(instanceId), recipeId);
        if (warning) setDismissing({ recipeId, ...warning });
        else pick(recipeId);
    };
    // `setTarget` is the only writer of a Hideout's camp, and refuses one not in its reach.
    const chooseCamp = (campId) => {
        if (Hideouts.setTarget(BoardState.getTokenById(instanceId), campId)) setView('card');
    };

    const { effects } = model;
    const stats = model.blocks.filter(b => STAT_BLOCKS.has(b.id));
    const sections = model.blocks.flatMap(block => {
        switch (block.id) {
            case CARD_BLOCK.RECIPE: return [
                <RecipeChoice key="recipe" block={block} instanceId={instanceId} onChangeRecipe={() => setView('recipes')} />,
                <RequiresSection key="requires" block={block} effects={effects} />,
                <MakesSection key="makes" makes={block.makes} bonus={block.bonus} effects={effects} />,
                block.rare ? <DropsSection key="rare" rare={block.rare} effects={effects} /> : null,
                block.fish ? <FishSection key="fish" fish={block.fish} /> : null,
                block.catches ? <CatchSection key="catch" catches={block.catches} effects={effects} /> : null
            ];
            case CARD_BLOCK.THEFT: return [
                <TheftSection key="theft" block={block} onChangeCamp={() => setView('recipes')} />,
                <StealsSection key="steals" block={block} rare={block.rare ? <RareFinds rare={block.rare} lucky={luckyOf(effects)} /> : null} />
            ];
            case CARD_BLOCK.LIFECYCLE: return [<EventsSection key="lifecycle" lines={block.lines} />];
            case CARD_BLOCK.SUPPORT: return [<SupportSection key="support" boosts={block.boosts} />];
            case CARD_BLOCK.FIGHT: return [<FightSection key="fight" block={block} />];
            case CARD_BLOCK.DROPS: return [<DropsSection key="drops" drops={block.drops} rare={block.rare} effects={effects} />];
            case CARD_BLOCK.MORE: return [<MoreBlock key="more" typeId={typeId} />];
            default: return [];
        }
    });

    const header = <NameBlock name={model.name} onClose={onClose} onLookUp={onClose ? () => lookUpToken(typeId) : null} />;
    const panel = listing && theft ? (
        <div className="p-1.5">
            <CampList key={instanceId} block={theft} onChoose={chooseCamp} onBack={() => setView('card')} />
        </div>
    ) : listing ? (
        <div className="p-1.5">
            {dismissing && (
                <SummonDismissConfirm
                    warning={dismissing}
                    onConfirm={() => pick(dismissing.recipeId)}
                    onKeep={() => setDismissing(null)}
                />
            )}
            {/* Keyed by Token: another station's list starts with an empty search, scrolled to its own recipe. */}
            <RecipeList
                key={instanceId}
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
            {instanceId != null && <ProblemLine instanceId={instanceId} />}
            {stats.length > 0 && <StatsSection blocks={stats} effects={effects} />}
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
