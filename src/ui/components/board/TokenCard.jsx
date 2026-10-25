import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '../../utils/cn.js';
import { getTokenType, tokenName, getAllTokenTypes, productionRoutes, getProvidedTagsWithTiers } from '../../../config/registries/tokenRegistry.js';
import { getSkill } from '../../../config/registries/skillRegistry.js';
import { EntityRibbon } from '../base/EntityRibbon.jsx';
import { SkillIcon } from '../base/SkillIcon.jsx';
import { Tooltip } from '../base/Tooltip.jsx';
import { PixelGlyph } from '../base/PixelGlyph.jsx';
import { LandmarkBlock } from '../drawer/LandmarkBlock.jsx';
import { LeaveMatControl } from '../drawer/TokenInspection.jsx';
import { useTokenDetail } from './useTokenDetail.js';
import { subscribeToken } from './tokenEvents.js';
import { CARD_BLOCK, tokenCardModel, cycleText } from './tokenCard.js';
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
import { TokenSprite, TOKEN_SURFACE } from '../base/TokenSprite.jsx';

/** The card's width: the 256 px activity art at 1×, so it is never scaled off a whole pixel. */
export const CARD_ART_PX = 256;

/** Clocks move without events: the card re-reads them this often while open. */
const CARD_REFRESH_MS = 1000;

const TONE_COLOUR = {
    warning: 'var(--color-ui-gold)',
    danger: 'var(--color-ui-red)'
};

const skillName = (id) => getSkill(id)?.name || (id ? id.charAt(0).toUpperCase() + id.slice(1) : '');

/** A slightly see-through box, so text reads over the art. */
const Box = ({ children, className, ...rest }) => (
    <div className={cn('bg-black/65 px-2 py-1.5 flex flex-col gap-1', className)} {...rest}>
        {children}
    </div>
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

const Dot = () => <span className="text-gi-muted">·</span>;

const NameBlock = ({ name, onClose }) => (
    <div data-card-block="name" className="flex items-start gap-2">
        <Box className="flex-1 min-w-0">
            <h3 className="ui-text-title font-bold text-white leading-tight select-text">{name}</h3>
        </Box>
        {onClose && (
            <CloseX data-card-close onClick={(e) => { e.stopPropagation(); onClose(); }} />
        )}
    </div>
);

const WorkBlock = ({ skillId, level, xp }) => (
    <Box data-card-block="work" className="flex-row items-center gap-2 ui-text-body text-gi-text">
        <Stat
            icon={<SkillIcon skillId={skillId} size={16} />}
            text={level}
            tip={`${skillName(skillId)}: a hero needs level ${level} to work this`}
            data-card-skill={skillId}
        />
        {xp > 0 && (
            <>
                <Dot />
                <Stat text={`+${xp.toLocaleString('en-US')} XP`} tip={`${xp.toLocaleString('en-US')} ${skillName(skillId)} XP each time a round of work finishes`} />
            </>
        )}
    </Box>
);

const CycleBlock = ({ cycleMs, uses }) => (
    <Box data-card-block="cycle" className="flex-row items-center gap-2 ui-text-body text-gi-text">
        {cycleMs > 0 && (
            <Stat icon={<PixelGlyph name="clock" />} text={cycleText(cycleMs)} tip="One round of work takes this long" data-card-cycle />
        )}
        {cycleMs > 0 && <Dot />}
        <Stat
            icon={<PixelGlyph name="charges" />}
            text={uses == null ? '∞' : uses.toLocaleString('en-US')}
            tip={uses == null ? 'Charges: unlimited' : `Charges: ${uses.toLocaleString('en-US')} left. Each round of work uses one`}
            data-card-charges
        />
    </Box>
);

const RecipeBlock = ({ block, instanceId, onChangeRecipe }) => (
    <Box data-card-block="recipe">
        {block.recipeName && <span className="ui-text-body font-bold text-white">{block.recipeName}</span>}
        {block.change && !block.change.chosen && (
            <span className="ui-text-body" style={{ color: 'var(--color-ui-gold)' }}>
                {block.change.label === 'Change recipe' ? 'No recipe chosen' : 'Nothing chosen to build'}
            </span>
        )}
        {block.needs.length > 0 && (
            <div data-card-needs className="flex flex-col gap-1">
                <Heading>Needs</Heading>
                {block.needs.map(n => (
                    <EntityRibbon key={n.itemId} kind="item" id={n.itemId} have={n.have} required={n.need} size="sm" />
                ))}
            </div>
        )}
        {block.tools.length > 0 && (
            <div data-card-tools className="flex flex-col gap-1">
                <Heading>Tools</Heading>
                {block.tools.map(t => (
                    <EntityRibbon
                        key={t.typeId || t.itemId || t.name}
                        kind={t.typeId ? 'token' : 'item'}
                        id={t.typeId || t.itemId || undefined}
                        name={t.name}
                        size="sm"
                        countText=""
                        title={t.inHand ? `A Hero needs ${withArticle(t.name)} in hand to work this` : `Needs a ${t.name} nearby`}
                        data-card-tool={t.typeId || t.itemId || t.tag}
                        className="bg-transparent border-white/40"
                    />
                ))}
            </div>
        )}
        {block.makes.length > 0 && (
            <div data-card-makes className="flex flex-col gap-1">
                <Heading>Makes</Heading>
                {block.makes.map(m => (
                    <EntityRibbon
                        key={m.itemId}
                        kind="item"
                        id={m.itemId}
                        minQty={m.min}
                        maxQty={m.max}
                        chance={m.chance != null ? `${m.chance}%` : undefined}
                        size="sm"
                    />
                ))}
            </div>
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
    </Box>
);

const LifecycleBlock = ({ lines }) => (
    <Box data-card-block="lifecycle" className="ui-text-body text-gi-text">
        {lines.map((line, i) => (
            <div key={i} data-card-life={line.icon}>
                <Stat icon={<PixelGlyph name={line.icon} />} text={line.text} tip={line.tip} tone={line.tone} />
            </div>
        ))}
    </Box>
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

const SupportBlock = ({ boostedBy, boosts, floor }) => (
    <Box data-card-block="support">
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
    </Box>
);

const DropsBlock = ({ drops }) => (
    <Box data-card-block="drops">
        <Heading>Drops</Heading>
        {drops.map(d => (
            <EntityRibbon key={d.itemId} kind="item" id={d.itemId} minQty={d.min} maxQty={d.max} chance={`${d.chance}%`} size="sm" />
        ))}
    </Box>
);

const HpBlock = ({ cur, max }) => {
    const pct = Math.max(0, Math.min(100, (cur / Math.max(1, max)) * 100));
    return (
        <Box data-card-block="hp" className="flex-row items-center gap-2">
            <div className="h-1.5 flex-1 bg-black/60 overflow-hidden">
                <div data-card-hp-fill className="h-full bg-gi-hp" style={{ width: `${pct}%` }} />
            </div>
            <span data-card-hp-text className="shrink-0 ui-text-body tabular-nums text-white/90">
                {`${Math.round(cur).toLocaleString('en-US')}/${Math.round(max).toLocaleString('en-US')}`}
            </span>
        </Box>
    );
};

const CombatBlock = ({ skillId, level, xp }) => (
    <Box data-card-block="combat" className="flex-row items-center gap-2 ui-text-body text-gi-text">
        <Stat
            icon={<SkillIcon skillId={skillId} size={16} />}
            text={level}
            tip={`${skillName(skillId)}, level ${level}`}
            data-card-skill={skillId}
        />
        <Dot />
        <Stat text={`+${Number(xp).toLocaleString('en-US')} XP`} tip={`${Number(xp).toLocaleString('en-US')} XP for each one beaten`} />
    </Box>
);

/** What the card's layout has no block for yet: a landmark's challenge, a buff, the stations a tool drives. */
const MoreBlock = ({ typeId }) => {
    const def = getTokenType(typeId);
    if (!def) return null;
    return (
        <div data-card-block="more" className="flex flex-col gap-1.5">
            <LandmarkBlock def={def} />
            {def.buff && (
                <Box className="ui-text-body text-gi-text">
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
                </Box>
            )}
            {Object.keys(getProvidedTagsWithTiers(def)).length > 0 && <DrivesLine def={def} />}
        </div>
    );
};

const DrivesLine = ({ def }) => {
    const tags = new Set(Object.keys(getProvidedTagsWithTiers(def)));
    const driven = Object.keys(getAllTokenTypes()).filter(id =>
        productionRoutes(id).some(r => r.requiresContext.some(t => tags.has(t)))
    );
    return (
        <Box className="ui-text-body text-gi-text">
            <Tooltip title="Serves every nearby station, and wears once per cycle it serves">
                <span className="cursor-help">
                    <Heading>{def.isTool ? 'Tool for' : 'Drives'}</Heading>{' '}
                    {driven.length ? driven.map(tokenName).join(', ') : 'nothing yet'}
                </span>
            </Tooltip>
        </Box>
    );
};

/** Re-render each second while open, and on a fight's HP change. */
function useCardClock(instanceId, enemy) {
    const [, setNow] = useState(0);
    useEffect(() => {
        const timer = setInterval(() => setNow(n => n + 1), CARD_REFRESH_MS);
        return () => clearInterval(timer);
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

/** The whole multiple of the 256 px art that covers a card of this size. */
export const coverScale = (w, h) => Math.max(1, Math.ceil(Math.max(Number(w) || 0, Number(h) || 0) / CARD_ART_PX));

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

/** The art scale that covers the card as it is drawn now; re-measured after every render. */
function useCoverScale(ref, active) {
    const [scale, setScale] = useState(1);
    // No deps on purpose: the list's size follows its content (a search, a live count), and the
    // guard below settles it within one extra render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useLayoutEffect(() => {
        const el = ref.current;
        if (!active || !el) { if (scale !== 1) setScale(1); return; }
        const next = coverScale(el.offsetWidth, el.offsetHeight);
        if (next !== scale) setScale(next);
    });
    return scale;
}

/**
 * The Token card: the full-art card a click on a Token opens. Its activity's 256 px scene fills
 * the card behind the information (a plain card when it has none); the blocks follow
 * `tokenCardModel`, each in a see-through box, every icon and number explained on hover.
 */
export const TokenCard = ({ typeId, instanceId = null, onClose = null, onViewChange = null }) => {
    const def = getTokenType(typeId);
    const [view, setView] = useCardView(instanceId, onViewChange);
    const cardRef = useRef(null);
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
    const artScale = useCoverScale(cardRef, listing);
    if (!model) return null;
    const { art } = model;
    const artPx = CARD_ART_PX * artScale;

    const choose = (recipeId) => {
        // `setSelectedRecipe` is the only writer, and refuses an id outside this Token's pool.
        if (StationRecipe.setSelectedRecipe(BoardState.getTokenById(instanceId), recipeId, def)) setView('card');
    };

    return (
        <div
            ref={cardRef}
            data-token-card={model.enemy ? 'enemy' : 'token'}
            data-card-art={art ? art.source : 'none'}
            data-card-view={listing ? 'recipes' : 'card'}
            className={cn('relative', listing && 'overflow-hidden')}
            style={listing
                ? { width: 'max-content', minWidth: CARD_ART_PX, maxWidth: 'calc(100vw - 48px)', minHeight: art ? CARD_ART_PX : undefined }
                : { width: CARD_ART_PX, minHeight: art ? CARD_ART_PX : undefined }}
        >
            {art && (
                <img
                    data-card-art-img
                    data-card-art-scale={artScale}
                    src={art.path}
                    alt=""
                    draggable={false}
                    className="absolute top-0 left-0 max-w-none select-none pointer-events-none"
                    style={{ width: artPx, height: artPx, imageRendering: 'pixelated' }}
                />
            )}
            {listing ? (
                <div className="relative flex flex-col gap-1.5 p-1.5">
                    <NameBlock name={model.name} onClose={onClose} />
                    <RecipeList
                        def={def}
                        instanceId={instanceId}
                        selectedRecipeId={instance.selectedRecipeId || null}
                        workerId={BoardState.workerOf(instanceId) || null}
                        heroes={GameState.state?.heroes || []}
                        onChoose={choose}
                        onBack={() => setView('card')}
                    />
                </div>
            ) : (
                <div className="relative flex flex-col gap-1.5 p-1.5">
                    {model.blocks.map(block => {
                        switch (block.id) {
                            case CARD_BLOCK.NAME: return <NameBlock key="name" name={block.name} onClose={onClose} />;
                            case CARD_BLOCK.HP: return <HpBlock key="hp" cur={block.cur} max={block.max} />;
                            case CARD_BLOCK.COMBAT: return <CombatBlock key="combat" {...block} />;
                            case CARD_BLOCK.WORK: return <WorkBlock key="work" {...block} />;
                            case CARD_BLOCK.CYCLE: return <CycleBlock key="cycle" {...block} />;
                            case CARD_BLOCK.RECIPE: return <RecipeBlock key="recipe" block={block} instanceId={instanceId} onChangeRecipe={() => setView('recipes')} />;
                            case CARD_BLOCK.LIFECYCLE: return <LifecycleBlock key="lifecycle" lines={block.lines} />;
                            case CARD_BLOCK.SUPPORT: return <SupportBlock key="support" {...block} />;
                            case CARD_BLOCK.DROPS: return <DropsBlock key="drops" drops={block.drops} />;
                            case CARD_BLOCK.MORE: return <MoreBlock key="more" typeId={typeId} />;
                            default: return null;
                        }
                    })}
                    {instanceId != null && <LeaveMatControl instanceId={instanceId} />}
                </div>
            )}
        </div>
    );
};

export default TokenCard;
