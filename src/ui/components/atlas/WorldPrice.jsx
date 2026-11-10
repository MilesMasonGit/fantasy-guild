import { t } from '../../../i18n/index.js';
import { CELL_STATE } from '../../../systems/world/frontier.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { SKILLS } from '../../../config/registries/skillRegistry.js';
import { formatCompact } from '../../../utils/Formatters.js';
import { cn } from '../../utils/cn.js';
import { ItemIcon } from '../base/ItemIcon.jsx';
import { SkillIcon } from '../base/SkillIcon.jsx';

const skillName = (id) => SKILLS[id]?.name || (id ? id.charAt(0).toUpperCase() + id.slice(1) : '');
const itemName = (id) => getItem(id)?.name || id;
const countCls = (short) => cn('tabular-nums', short ? 'text-[var(--color-ui-red)]' : 'text-white');

/** What a cell's price lacks, as words for the disabled Settle: "Short of 3 Copper Ore, Mining 5". */
export function shortWords(price) {
    const parts = [
        ...price.items.filter(r => r.short).map(r => `${(r.need - r.have).toLocaleString('en-US')} ${itemName(r.itemId)}`),
        ...price.skills.filter(r => r.short).map(r => `${skillName(r.skill)} ${r.need}`)
    ];
    return parts.length ? t('worldMap.short', { what: parts.join(', ') }) : null;
}

/** Why a cell's ring cannot be settled yet, as words naming its Guild Hall star, or null when it can. */
export function lockWords(lock) {
    if (!lock?.stars?.length) return null;
    return t('worldMap.ringLocked', { star: lock.stars.map(s => s.name).join(' or ') });
}

/** A have/need count in the 9.9k shorthand. */
const haveNeed = (have, need) => `${formatCompact(have)}/${formatCompact(need)}`;

/** The price as pills (sprite and have/need, red when short): the hover tip's. */
const PricePills = ({ price }) => {
    if (!price.items.length && !price.skills.length) return <div className="text-white/60">{t('worldMap.nothingAsked')}</div>;
    return (
        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
            {price.items.map(r => (
                <span key={r.itemId} data-world-price-item={r.itemId} className="flex items-center gap-1">
                    <ItemIcon item={r.itemId} size={32} title={null} />
                    <span className={countCls(r.short)}>{haveNeed(r.have, r.need)}</span>
                </span>
            ))}
            {price.skills.map(r => (
                <span key={r.skill} data-world-price-skill={r.skill} className="flex items-center gap-1">
                    <SkillIcon skillId={r.skill} size={32} />
                    <span className={countCls(r.short)}>{r.have}/{r.need}</span>
                </span>
            ))}
        </div>
    );
};

/** The price as rows (sprite, name, have/need), the drawer's. */
export const PriceRows = ({ price }) => {
    if (!price.items.length && !price.skills.length) return <div className="font-pixel ui-text-body text-white/60">{t('worldMap.nothingAsked')}</div>;
    const row = (key, attrs, icon, name, count, short) => (
        <div key={key} {...attrs} className="flex items-center gap-1.5 font-pixel ui-text-body">
            {icon}
            <span className="min-w-0 flex-1 text-white/85 break-words">{name}</span>
            <span className={cn('pl-2', countCls(short))}>{count}</span>
        </div>
    );
    return (
        <div className="flex flex-col gap-0.5">
            {price.items.map(r => row(r.itemId, { 'data-world-price-item': r.itemId }, <ItemIcon item={r.itemId} size={32} title={null} />, itemName(r.itemId), haveNeed(r.have, r.need), r.short))}
            {price.skills.map(r => row(r.skill, { 'data-world-price-skill': r.skill }, <SkillIcon skillId={r.skill} size={32} />, skillName(r.skill), `${r.have}/${r.need}`, r.short))}
        </div>
    );
};

/**
 * The hover over a cell (its title is the place's name, `Tooltip`'s): the kind of land under it,
 * then for a place not yet settled its price, and why it cannot be settled when it is out of reach
 * or its ring waits for a Guild Hall star.
 */
export const CellTip = ({ cell }) => (
    <div data-world-tip={cell.id} className="flex flex-col gap-1">
        <div data-world-tip-terrain className="text-white/70">{cell.terrain}</div>
        {cell.state !== CELL_STATE.SETTLED && <PricePills price={cell.price} />}
        {cell.state === CELL_STATE.BEYOND && <div className="ui-text-small text-white/55">{t('worldMap.beyond')}</div>}
        {cell.lock && <div data-world-tip-lock className="ui-text-small text-white/70">{lockWords(cell.lock)}</div>}
    </div>
);
