import { useEscapeLayer } from '../../utils/escapeLayers.js';
import { cn } from '../../utils/cn.js';
import { Tooltip } from '../base/Tooltip.jsx';
import { EntityRibbon } from '../base/EntityRibbon.jsx';
import { ItemIcon } from '../base/ItemIcon.jsx';
import { TokenSprite, TOKEN_SURFACE } from '../base/TokenSprite.jsx';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { chanceText } from '../../../utils/Formatters.js';
import { lookUpRibbon } from '../encyclopedia/encyclopediaLink.js';
import { lastTheftText } from './hideoutCard.js';

/**
 * A Hideout's card (`hideoutCard.js` says what): the camp it robs with Change camp, a guard on it,
 * the odds the hero on it is caught, its last theft, and what a theft takes; and the list of camps
 * in reach the card flips to, as a station's card flips to its recipes.
 */

const GOLD = 'var(--color-ui-gold)';
const itemName = (id) => getItem(id)?.name || id;

const Section = ({ children, className, ...rest }) => (
    <section className={cn('px-2 py-1.5 flex flex-col gap-1 border-t-2 border-white/15 first:border-t-0', className)} {...rest}>
        {children}
    </section>
);

const Heading = ({ children }) => (
    <span className="ui-text-small font-bold gi-caps tracking-wider text-gi-muted">{children}</span>
);

/** One camp: its art, its name and the Crime level a thief is measured against. */
const CampName = ({ camp }) => (
    <span className="flex items-center gap-2 min-w-0">
        <span className="w-8 h-8 shrink-0 flex items-center justify-center bg-black border border-white/10">
            <TokenSprite typeId={camp.typeId} surface={TOKEN_SURFACE.CATALOGUE} alt="" />
        </span>
        <span className="flex flex-col min-w-0 leading-tight">
            <span className="ui-text-body font-bold text-white truncate">{camp.name}</span>
            {camp.crimeLevel != null && <span className="ui-text-small text-gi-muted">Crime {camp.crimeLevel}</span>}
        </span>
    </span>
);

/** The caught odds: the hero's, or the curve's even chance with nobody on it. */
const CaughtLine = ({ block }) => {
    if (!block.camp) return null;
    const { caught, curve, skillName } = block;
    if (caught) {
        const tip = `${caught.heroName}'s ${skillName} ${caught.thiefLevel} against the camp's ${caught.campLevel}: caught on ${chanceText(caught.chance)} of thefts. Below the camp's level often, above it rarely.`;
        return (
            <Tooltip title={tip}>
                <span data-card-theft-caught={caught.chance} className="ui-text-body text-gi-text cursor-help">
                    Caught <span className="font-bold tabular-nums" style={{ color: caught.chance > curve.evenChance ? GOLD : undefined }}>{chanceText(caught.chance)}</span>
                </span>
            </Tooltip>
        );
    }
    return (
        <span data-card-theft-caught="even" className="ui-text-small text-gi-muted">
            Caught {chanceText(curve.evenChance)} at the camp&apos;s own {skillName} level; more below it, less above
        </span>
    );
};

/** The theft: the camp it robs, its guard, the odds, the last theft, Change camp. */
export const TheftSection = ({ block, onChangeCamp }) => (
    <Section data-card-block="theft">
        <Heading>Robs</Heading>
        {block.camp
            ? <span data-card-theft-camp={block.camp.typeId}><CampName camp={block.camp} /></span>
            : (
                <span data-card-theft-none className="ui-text-body" style={{ color: GOLD }}>
                    {block.lost ? 'Its camp is out of reach' : 'No camp chosen'}
                </span>
            )}
        {block.guard && (
            <span data-card-theft-guard={block.guard.typeId} className="ui-text-body" style={{ color: GOLD }}>
                Guarded: a {block.guard.name} caught a thief and stands on it until beaten
            </span>
        )}
        <CaughtLine block={block} />
        {block.last && (
            <span data-card-theft-last={block.last.caught ? 'caught' : 'stole'} className="ui-text-small text-gi-muted">
                Last: {lastTheftText(block.last, itemName)}
            </span>
        )}
        {block.change && (
            <button
                type="button"
                data-card-change-camp
                onClick={(e) => { e.stopPropagation(); onChangeCamp?.(); }}
                className="ui-frame-chamfer self-start px-3 py-1 ui-text-body font-bold cursor-pointer"
                style={{ color: GOLD }}
            >
                {block.change.label}
            </button>
        )}
    </Section>
);

/** What a theft at the chosen camp takes, each line at its chance, then its rare finds. */
export const StealsSection = ({ block, rare }) => {
    if (!block.steals.length && !rare) return null;
    return (
        <Section data-card-block="steals">
            <Heading>Steals</Heading>
            {block.steals.map(s => (
                <EntityRibbon
                    key={s.itemId}
                    kind="item"
                    id={s.itemId}
                    minQty={s.min}
                    maxQty={s.max}
                    chance={chanceText(s.chance)}
                    data-card-steal={s.itemId}
                    size="sm"
                    wrap
                    onInspect={lookUpRibbon}
                />
            ))}
            {rare}
        </Section>
    );
};

/**
 * The camps in reach a Hideout can rob, nearest first: one click picks one. A guarded camp can be
 * picked (it is robbed once its guard is beaten) and says so.
 */
export const CampList = ({ block, onChoose, onBack }) => {
    useEscapeLayer(!!onBack, () => onBack?.());
    return (
        <div data-camp-list className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
                <span className="flex-1 ui-text-body font-bold text-white">Camps in reach</span>
                {onBack && (
                    <button
                        type="button"
                        data-camp-back
                        onClick={(e) => { e.stopPropagation(); onBack(); }}
                        className="shrink-0 bg-black/65 px-2 py-1 ui-text-body text-gi-muted hover:text-white cursor-pointer"
                    >
                        Back
                    </button>
                )}
            </div>
            <div className="bg-black/65 py-1 flex flex-col">
                {!block.options.length && (
                    <div data-camp-empty className="px-2 py-3 ui-text-body text-gi-muted">
                        No camp in reach to rob. Set the Hideout near an enemy camp; bosses are never robbed.
                    </div>
                )}
                {block.options.map(o => (
                    <button
                        key={o.id}
                        type="button"
                        data-camp-option={o.id}
                        data-camp-selected={o.id === block.camp?.id ? 'true' : undefined}
                        onClick={(e) => { e.stopPropagation(); onChoose(o.id); }}
                        className={cn(
                            'flex items-center gap-2 px-2 py-1 text-left cursor-pointer hover:bg-white/10',
                            o.id === block.camp?.id && 'outline outline-2 outline-white'
                        )}
                    >
                        <CampName camp={o} />
                        <span className="flex-1" />
                        {o.guarded && <span data-camp-guarded className="ui-text-small" style={{ color: GOLD }}>Guarded</span>}
                        <span className="flex items-center gap-0.5">
                            {o.steals.map(id => <ItemIcon key={id} item={id} size={24} title={itemName(id)} />)}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
};
