import { useLayoutEffect, useRef, useState } from 'react';
import { useEscapeLayer } from '../../utils/escapeLayers.js';
import { cn } from '../../utils/cn.js';
import { ItemIcon } from '../base/ItemIcon.jsx';
import { TokenSprite, TOKEN_SURFACE } from '../base/TokenSprite.jsx';
import { Tooltip } from '../base/Tooltip.jsx';
import { PixelGlyph } from '../base/PixelGlyph.jsx';
import { recipeListFor, ENTRY } from '../../../systems/board/RecipeList.js';
import { skillLabel } from './recipeText.js';
import { recipeRowOf } from './recipeRows.js';
import { cycleText } from './tokenCard.js';
import { skillLevelText } from '../dock/heroPanelSkills.js';
import { resolveSpritePath } from '../../../utils/AssetManager.js';
import { fieldOf, cropTermsOf } from '../../../config/registries/tokenConstants.js';
import { formatClock } from '../drawer/lifecycleLines.js';

/**
 * The recipe list a station's or Foundation's card flips to: one row per recipe, level first,
 * a hero-face divider at each permitted hero's level, the next locked recipes as "???", and a
 * search over inputs and outputs. One click on a row chooses it. Rows never wrap or cut off: the
 * card grows to the widest row, and the card's scroller takes the height.
 */

const WHITE = 'var(--color-ui-white)';
const GOLD = 'var(--color-ui-gold)';
const RED = 'var(--color-ui-red)';

/** A hero's face: the 16 px head shot at 2×. */
const FACE_PX = 32;

const qtyText = (min, max) => (min === max ? `${min}` : `${min}–${max}`);

const faceOf = (hero) => {
    const path = resolveSpritePath(hero?.icon || 'hn_recruit_icon_por') || resolveSpritePath(hero?.spriteId || 'hn_recruit_por');
    return path ? (path.startsWith('/') ? path : `/${path}`) : null;
};

const OutputIcon = ({ out, dim = false }) => (
    out.tokenId
        ? <TokenSprite typeId={out.tokenId} surface={TOKEN_SURFACE.CATALOGUE} alt="" className={dim ? 'opacity-60' : undefined} />
        : <ItemIcon item={out.itemId} size={32} title={null} className={dim ? 'opacity-60' : undefined} />
);

/** An input: sprite and have/need, red when short; its hover names it. */
const InputPill = ({ input }) => (
    <Tooltip title={input.name} lines={[`Have ${input.have.toLocaleString('en-US')}, need ${input.need.toLocaleString('en-US')}`]}>
        <span data-recipe-input={input.itemId} data-short={input.short ? 'true' : undefined} className="inline-flex items-center gap-0.5 tabular-nums">
            <ItemIcon item={input.itemId} size={32} title={null} />
            <span style={{ color: input.short ? RED : undefined }}>{input.have.toLocaleString('en-US')}/{input.need.toLocaleString('en-US')}</span>
        </span>
    </Tooltip>
);

/** A tool, beside-it Token or Foundation rung: the card's hollow bar, red when unmet. */
const RequirementBar = ({ req }) => {
    const unmet = req.met === false;
    return (
        <Tooltip title={req.name} lines={[unmet ? 'Not beside this station' : 'Needed beside the station']}>
            <span
                data-recipe-requirement={req.key}
                data-unmet={unmet ? 'true' : undefined}
                className="inline-flex items-center gap-1 h-8 px-1.5 border"
                style={{ borderColor: unmet ? RED : 'rgba(255,255,255,0.4)', color: unmet ? RED : undefined }}
            >
                {req.typeId && <TokenSprite typeId={req.typeId} surface={TOKEN_SURFACE.CATALOGUE} alt="" />}
                <span>{req.name}</span>
            </span>
        </Tooltip>
    );
};

const OutputHeadline = ({ out }) => (
    <Tooltip title={out.name}>
        <span data-recipe-output={out.itemId || out.tokenId} className="inline-flex items-center gap-1 font-bold text-white">
            <OutputIcon out={out} />
            <span className="tabular-nums">{qtyText(out.min, out.max)}</span>
            <span>{out.name}</span>
        </span>
    </Tooltip>
);

const Byproduct = ({ out }) => (
    <Tooltip title={out.name} lines={out.chance != null ? [`${out.chance}% chance each craft`] : undefined}>
        <span data-recipe-byproduct={out.itemId || out.tokenId} className="inline-flex items-center gap-0.5 ui-text-small text-gi-muted">
            <OutputIcon out={out} dim />
            <span>{out.name}</span>
            {out.chance != null && <span className="tabular-nums">{out.chance}%</span>}
        </span>
    </Tooltip>
);

/** A crop's grow time and how many harvests it gives once ripe. */
const CropTerms = ({ crop }) => {
    const harvests = `${crop.load.toLocaleString('en-US')} ${crop.load === 1 ? 'harvest' : 'harvests'}`;
    return (
        <Tooltip title="Once sown" lines={[`Grows for ${formatClock(crop.growMs)}, then gives ${harvests}`]}>
            <span data-recipe-crop className="inline-flex items-center gap-1 ui-text-small text-gi-muted tabular-nums">
                <PixelGlyph name="grow" />{formatClock(crop.growMs)}
                <span data-recipe-harvests>{harvests}</span>
            </span>
        </Tooltip>
    );
};

const RecipeRow = ({ row, crop = null, selected, onChoose }) => {
    const [hover, setHover] = useState(false);
    return (
        <button
            type="button"
            data-recipe-id={row.id}
            data-recipe-selected={selected ? 'true' : undefined}
            onClick={(e) => { e.stopPropagation(); onChoose(row.id); }}
            onPointerEnter={() => setHover(true)}
            onPointerLeave={() => setHover(false)}
            className={cn('flex items-center gap-2 px-1.5 py-0.5 text-left whitespace-nowrap cursor-pointer ui-text-body text-gi-text', selected && 'bg-gi-gold/15')}
            style={{
                outline: hover ? `2px solid ${WHITE}` : (selected ? `2px solid ${GOLD}` : 'none'),
                outlineOffset: -2
            }}
        >
            <span data-recipe-level className="w-6 shrink-0 text-right tabular-nums font-bold" style={selected ? { color: GOLD } : undefined}>{row.level}</span>
            {row.inputs.map(i => <InputPill key={i.itemId} input={i} />)}
            {row.requirements.map(r => <RequirementBar key={r.key} req={r} />)}
            {(row.inputs.length > 0 || row.requirements.length > 0) && <span className="text-gi-muted">→</span>}
            {row.main && <OutputHeadline out={row.main} />}
            {row.byproducts.map(b => <Byproduct key={b.itemId || b.tokenId} out={b} />)}
            <span className="flex-1" />
            {crop && <CropTerms crop={crop} />}
            {row.xp > 0 && <span data-recipe-xp className="ui-text-small text-gi-muted tabular-nums">+{row.xp.toLocaleString('en-US')} XP</span>}
            {row.durationMs > 0 && (
                <span data-recipe-time className="inline-flex items-center gap-1 ui-text-small text-gi-muted tabular-nums">
                    <PixelGlyph name="clock" />{cycleText(row.durationMs)}
                </span>
            )}
        </button>
    );
};

/** A recipe no one in the guild can run yet: its level and a "???" silhouette. Not choosable. */
const LockedRow = ({ entry }) => {
    const out = (entry.recipe?.outputs || []).find(o => o?.itemId || o?.tokenId);
    return (
        <div data-recipe-locked={entry.level} aria-disabled="true" className="flex items-center gap-2 px-1.5 py-0.5 whitespace-nowrap ui-text-body text-gi-muted">
            <span className="w-6 shrink-0 text-right tabular-nums font-bold">{entry.level}</span>
            {out && (
                <span style={{ filter: 'brightness(0)', opacity: 0.7 }} className="inline-flex">
                    {out.tokenId
                        ? <TokenSprite typeId={out.tokenId} surface={TOKEN_SURFACE.CATALOGUE} alt="" />
                        : <ItemIcon item={out.itemId} size={32} title={null} />}
                </span>
            )}
            <span className="font-bold">???</span>
        </div>
    );
};

/** A thin line with the faces of the permitted heroes whose level is here; the worker's ringed gold. */
const HeroDivider = ({ entry, heroesById, skill }) => (
    <div data-recipe-divider={entry.level} className="flex items-center gap-1 px-1.5 py-0.5">
        {entry.heroes.map(h => {
            const hero = heroesById.get(h.heroId);
            const face = faceOf(hero);
            const lines = [`${skillLabel(skill)} ${skillLevelText(h.level)}`];
            if (h.isWorker) lines.push('Working this station');
            return (
                <Tooltip key={h.heroId} title={hero?.name || h.heroId} lines={lines}>
                    <span
                        data-recipe-face={h.heroId}
                        data-worker={h.isWorker ? 'true' : undefined}
                        className="inline-flex shrink-0 rounded-full overflow-hidden"
                        style={{ width: FACE_PX, height: FACE_PX, boxShadow: h.isWorker ? `0 0 0 2px ${GOLD}` : undefined }}
                    >
                        {face && (
                            <img
                                src={face}
                                alt=""
                                draggable={false}
                                className="select-none pointer-events-none"
                                style={{ width: FACE_PX, height: FACE_PX, imageRendering: 'pixelated' }}
                            />
                        )}
                    </span>
                </Tooltip>
            );
        })}
        <div className="h-0.5 flex-1 min-w-4 bg-white/30" />
    </div>
);

/**
 * @param {{ def: object, instanceId?: string|null, selectedRecipeId?: string|null,
 *   workerId?: string|null, heroes?: object[], onChoose: (id: string) => void,
 *   onBack?: () => void }} props
 */
export const RecipeList = ({ def, instanceId = null, selectedRecipeId = null, workerId = null, heroes = [], onChoose, onBack }) => {
    const [query, setQuery] = useState('');
    const rootRef = useRef(null);
    const { skill, entries } = recipeListFor(def, { workerId, heroes, query });
    const heroesById = new Map((heroes || []).map(h => [h?.id, h]));
    const isField = !!fieldOf(def);

    // Opens scrolled to the current recipe, in whichever arrow-bar list holds the card.
    useLayoutEffect(() => {
        const root = rootRef.current;
        const row = root?.querySelector('[data-recipe-selected="true"]');
        const scroller = root?.closest('[data-scroll-list]');
        if (!row || !scroller) return;
        const r = row.getBoundingClientRect();
        const s = scroller.getBoundingClientRect();
        scroller.scrollTop += (r.top + r.height / 2) - (s.top + s.height / 2);
    }, []);

    // Escape goes back to the card, one layer at a time, before the card's own Escape closes it.
    useEscapeLayer(!!onBack, () => onBack?.());

    const hasRecipes = entries.some(e => e.kind === ENTRY.RECIPE || e.kind === ENTRY.LOCKED);

    return (
        <div ref={rootRef} data-recipe-list className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
                <input
                    type="text"
                    data-recipe-search
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search"
                    aria-label="Search recipes"
                    className="flex-1 min-w-0 bg-black/65 border border-white/30 focus:border-white px-2 py-1 ui-text-body text-white outline-none"
                />
                {onBack && (
                    <button
                        type="button"
                        data-recipe-back
                        onClick={(e) => { e.stopPropagation(); onBack(); }}
                        className="shrink-0 bg-black/65 px-2 py-1 ui-text-body text-gi-muted hover:text-white cursor-pointer"
                    >
                        Back
                    </button>
                )}
            </div>
            <div className="bg-black/65 py-1 flex flex-col">
                {!hasRecipes && !query && (
                    <div data-recipe-empty className="px-2 py-3 ui-text-body text-gi-muted">
                        No {skillLabel(skill)} recipes yet.
                    </div>
                )}
                {query && !entries.some(e => e.kind === ENTRY.RECIPE) && (
                    <div data-recipe-no-match className="px-2 py-1 ui-text-body text-gi-muted">Nothing matches.</div>
                )}
                {entries.map(entry => {
                    if (entry.kind === ENTRY.HEROES) {
                        return <HeroDivider key={`h${entry.level}`} entry={entry} heroesById={heroesById} skill={skill} />;
                    }
                    if (entry.kind === ENTRY.LOCKED) return <LockedRow key={`l${entry.key}`} entry={entry} />;
                    const row = recipeRowOf(entry.recipe, entry.level, instanceId);
                    return <RecipeRow key={row.id} row={row} crop={isField ? cropTermsOf(entry.recipe) : null} selected={row.id === selectedRecipeId} onChoose={onChoose} />;
                })}
            </div>
        </div>
    );
};

export default RecipeList;
