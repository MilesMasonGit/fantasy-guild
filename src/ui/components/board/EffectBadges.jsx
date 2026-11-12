import { cn } from '../../utils/cn.js';
import { Tooltip } from '../base/Tooltip.jsx';
import { PixelGlyph } from '../base/PixelGlyph.jsx';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { resolveSpritePath } from '../../../utils/AssetManager.js';
import { EFFECT_KEY, UNIT } from '../../../systems/board/EffectBreakdown.js';
import { t } from '../../../i18n/index.js';
import {
    EFFECT_GLYPH, TONE_COLOUR, badgeText, badgeTone, badgeTip, heroTipLines, amountColour, effectAmountText
} from './effectBadgeText.js';

/**
 * The Token card's effect badges (brief 600, the owner's look A): chips of an icon and a total,
 * laid out as a stat block three to a row, each hoverable for its sources. Everything shown comes
 * from `effectBreakdown`.
 */

/** Badges to a row: two rows hold a busy card's six. */
export const BADGE_COLUMNS = 3;

/** A chip inside a ribbon keeps the ribbon's click (its Encyclopedia link) to itself. */
const stop = (e) => e.stopPropagation();

const itemName = (id) => getItem(id)?.name || id;

const faceOf = (hero) => {
    const path = resolveSpritePath(hero?.icon || 'hn_recruit_icon_por') || resolveSpritePath(hero?.spriteId || 'hn_recruit_por');
    return path ? (path.startsWith('/') ? path : `/${path}`) : null;
};

/** One hover line: a name on the left, its amount on the right. */
const TipLine = ({ name, amount, colour, ...rest }) => (
    <div className="flex justify-between gap-4 ui-text-body" {...rest}>
        <span className="text-white/70">{name}</span>
        <span className="font-bold tabular-nums whitespace-nowrap" style={{ color: colour }}>{amount}</span>
    </div>
);

/** A badge's hover: one line per source, then the total, and the limit note when one holds it. */
const BadgeTipBody = ({ badge, extra }) => {
    const tip = badgeTip(badge);
    return (
        <div className="flex flex-col" data-badge-tip={badge.key}>
            {tip.lines.map(line => (
                <TipLine key={line.key} name={line.name} amount={line.amount} colour={amountColour(line.value)} data-badge-tip-source={line.key} />
            ))}
            <div className="flex justify-between gap-4 ui-text-body font-bold text-white border-t-2 border-white/15 mt-0.5 pt-0.5" data-badge-tip-total>
                <span>{t('effectBadges.card.total')}</span>
                <span className="tabular-nums" style={{ color: amountColour(tip.total.value) }}>{tip.total.amount}</span>
            </div>
            {tip.note && <span className="ui-text-small" style={{ color: TONE_COLOUR.held }} data-badge-tip-limit>{tip.note}</span>}
            {extra && <span className="ui-text-small text-white/70">{extra}</span>}
        </div>
    );
};

const TipTitle = ({ glyph, face, children }) => (
    <span className="inline-flex items-center gap-1.5">
        {face ? <Face src={face} /> : <PixelGlyph name={glyph} />}
        {children}
    </span>
);

const Face = ({ src }) => (
    <img
        src={src}
        alt=""
        width={16}
        height={16}
        draggable={false}
        className="block shrink-0 bg-black"
        style={{ imageRendering: 'pixelated', width: 16, height: 16, maxWidth: 'none', outline: '1px solid rgba(255,255,255,0.25)' }}
    />
);

/** Lucky's hover adds the rare table's chance before and with it. */
const luckyExtra = (badge) => (badge.key === EFFECT_KEY.LUCKY
    ? t('effectBadges.card.luckyBase', { base: effectAmountText(UNIT.CHANCE, badge.base), final: effectAmountText(UNIT.CHANCE, badge.final) })
    : null);

/**
 * One chip: the effect's icon and the amount that counts, gold when a limit holds it. `small` is
 * the item line's edition.
 */
export const EffectChip = ({ badge, small = false, className }) => {
    const tone = badgeTone(badge);
    return (
        <Tooltip title={<TipTitle glyph={EFFECT_GLYPH[badge.key]}>{badge.name}</TipTitle>} content={<BadgeTipBody badge={badge} extra={luckyExtra(badge)} />} maxWidth={360}>
            <span
                data-effect-badge={badge.key}
                data-effect-badge-item={badge.itemId}
                data-effect-badge-held={badge.held ? 'true' : undefined}
                // ⚠️ An empty title hides the native title of a ribbon the chip sits in.
                title=""
                onClick={stop}
                style={badge.held ? { borderColor: 'color-mix(in srgb, var(--color-ui-gold) 70%, transparent)' } : undefined}
                className={cn(
                    'inline-flex items-center bg-black/65 cursor-help tabular-nums font-bold whitespace-nowrap',
                    small ? 'gap-0.5 px-0.5 border ui-text-small shrink-0' : 'gap-1 pl-0.5 pr-1 border-2 ui-text-body min-w-0',
                    !badge.held && 'border-white/20',
                    className
                )}
            >
                <PixelGlyph name={EFFECT_GLYPH[badge.key] || 'unknown'} scale={small ? 1 : 2} className="text-white" />
                <span data-effect-badge-amount style={{ color: TONE_COLOUR[tone] }}>{badgeText(badge)}</span>
            </span>
        </Tooltip>
    );
};

/** The Hero Effects chip: the working hero's face; its hover lists what they have that works here. */
const HeroChip = ({ hero, heroDef, badgeOf }) => {
    const face = faceOf(heroDef);
    const lines = heroTipLines(hero, badgeOf, itemName);
    const content = (
        <div className="flex flex-col" data-badge-tip="hero">
            <span className="ui-text-small text-white/70">{t('effectBadges.card.heroSub', { hero: hero.name })}</span>
            {lines.map(line => (
                <TipLine key={line.key} name={line.name} amount={`${line.effect} ${line.amount}`} colour={amountColour(line.value)} data-badge-tip-source={line.key} />
            ))}
        </div>
    );
    return (
        <Tooltip title={<TipTitle face={face} glyph="unknown">{t('effectBadges.card.heroTitle')}</TipTitle>} content={content} maxWidth={360}>
            <span
                data-effect-badge="hero"
                data-effect-badge-hero={hero.heroId}
                title=""
                onClick={stop}
                className="inline-flex items-center justify-self-start self-start px-0.5 py-px bg-black/65 border-2 border-white/20 cursor-help"
            >
                {face ? <Face src={face} /> : <PixelGlyph name="unknown" className="text-white" />}
            </span>
        </Tooltip>
    );
};

/** Finds the badge a hero source counts in, for its unit. */
const badgeFinder = (breakdown) => (key, itemId) => {
    if (itemId) {
        const lines = key === EFFECT_KEY.EFFICIENCY ? breakdown.inputs : breakdown.outputs;
        return lines.find(l => l.itemId === itemId)?.effects.find(b => b.key === key) || null;
    }
    return breakdown.effects.find(b => b.key === key) || null;
};

/**
 * The badge row under the stats line: the Token's badges in the Effect names list's order, then
 * the Hero Effects chip. Nothing when nothing boosts the Token.
 */
export const EffectBadgeGrid = ({ breakdown, heroDef }) => {
    if (!breakdown) return null;
    const { effects, hero } = breakdown;
    if (!effects.length && !hero) return null;
    return (
        <div
            data-effect-badges
            className="grid gap-1 mt-0.5"
            style={{ gridTemplateColumns: `repeat(${BADGE_COLUMNS}, minmax(0, 1fr))` }}
        >
            {effects.map(badge => <EffectChip key={badge.key} badge={badge} />)}
            {hero && <HeroChip hero={hero} heroDef={heroDef} badgeOf={badgeFinder(breakdown)} />}
        </div>
    );
};

/** The item line's chips for one item (Double Item on an output, Efficiency on a need), or null. */
export const ItemBadges = ({ line }) => {
    if (!line?.effects?.length) return null;
    return (
        <span className="inline-flex items-center gap-1 shrink-0 mr-1" data-item-badges={line.itemId}>
            {line.effects.map(badge => <EffectChip key={badge.key} badge={badge} small />)}
        </span>
    );
};
