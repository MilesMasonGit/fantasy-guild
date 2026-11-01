import { t } from '../../../i18n/index.js';
import { ItemIcon } from '../base/ItemIcon.jsx';
import { matCap } from '../../../systems/board/MatCap.js';
import { isMapItem, whatItWrites, MAP_TEXT } from '../../../systems/atlas/mapItems.js';
import { categoryOfItem, getCategoryInfo } from '../../../config/registries/equipmentConstants.js';
import { toolOf, toolKindLabel, handsOf, HANDS } from '../../../config/registries/toolKinds.js';
import { weaponStyleOf, isOffHand } from '../../../config/registries/weaponStyles.js';
import { weaponDamageTypeOf, arrowOf, DAMAGE_GROUPS, DAMAGE_TYPES } from '../../../config/registries/damageTypes.js';
import { gearResistancesOf, gearDamageCutOf } from '../../../config/registries/gearDefence.js';
import { COMBAT_SKILL_IDS } from '../../../config/registries/skillRegistry.js';
import { getSkill } from '../../../config/registries/skillRegistry.js';
import { UNARMED_DAMAGE } from '../../../config/FormulaRegistry.js';

/** What kind of item it is, in the player's words. */
export function itemTypeLabel(item) {
    if (MAP_TEXT.typeLabel[item?.type]) return MAP_TEXT.typeLabel[item.type];
    const key = `itemTip.type.${item?.type}`;
    const label = item?.type ? t(key) : null;
    return label && label !== key ? label : (item?.type || t('itemTip.type.item'));
}

/** A worn piece's resistance lines, groups before types: "Resists Physical 20%", "Weak to Fire 10%". */
function resistLines(item) {
    const lines = gearResistancesOf(item);
    return [...DAMAGE_GROUPS, ...DAMAGE_TYPES]
        .filter(({ id }) => lines[id])
        .map(({ id }) => t(lines[id] > 0 ? 'itemTip.resists' : 'itemTip.weakTo', {
            type: t(`fight.types.${id}`), n: Math.abs(lines[id])
        }));
}

/** A worn piece's damage cuts, in style order: "Magic damage −30%". */
function cutLines(item) {
    const cuts = gearDamageCutOf(item);
    return COMBAT_SKILL_IDS.filter(id => cuts[id])
        .map(id => t('itemTip.styleCut', { style: getSkill(id)?.name || id, n: cuts[id] }));
}

/**
 * Everything the tooltip says about an item, as plain facts (the component below draws them).
 * Mounted only while a tooltip is open, so nothing here runs per frame.
 */
export function itemTipFacts(item, { cap = undefined } = {}) {
    const category = categoryOfItem(item?.id);
    const tool = toolOf(item);
    const hands = handsOf(item);
    const style = weaponStyleOf(item);
    const arrow = arrowOf(item);
    return {
        type: itemTypeLabel(item),
        equippable: category ? getCategoryInfo(category).label : null,
        tool: tool ? t('itemTip.tool', { kind: toolKindLabel(tool.kind), tier: tool.tier }) : null,
        twoHanded: hands >= HANDS,
        // What a weapon hits with, and what an arrow adds to a bow's shot: the damage and its type.
        hits: style ? t('itemTip.weaponHits', {
            damage: Number(item.damage) > 0 ? Number(item.damage) : UNARMED_DAMAGE,
            type: t(`fight.types.${weaponDamageTypeOf(item, style)}`),
            style: getSkill(style)?.name || style
        }) : null,
        arrow: arrow ? t('itemTip.arrow', { damage: arrow.damage, type: t(`fight.types.${arrow.damageType}`) }) : null,
        offHand: isOffHand(item) ? t('itemTip.offHand') : null,
        // What a worn piece resists, and what it costs: the styles it cuts, shown red.
        resists: resistLines(item),
        cuts: cutLines(item),
        // A drink never heals, so its leftover restore amount is not offered as a promise.
        restores: item?.restoreAmount > 0 && category !== 'drink' ? item.restoreAmount : null,
        tags: Array.isArray(item?.tags) ? item.tags.filter(Boolean) : [],
        description: typeof item?.description === 'string'
            ? item.description.replace(/^["']|["']$/g, '').trim()
            : '',
        writes: isMapItem(item) ? whatItWrites(item, { cap: cap ?? matCap() }) : null
    };
}

/**
 * The body of an item's hover tooltip (the name is the tooltip's title): type and count, what it
 * equips as, its tool or what it restores, tags, description, and for a map what it writes.
 * `hint` is one extra muted line (select mode's click hint).
 */
export const ItemTipContent = ({ item, count = null, hint = null, cap }) => {
    const facts = itemTipFacts(item, { cap });
    return (
        <div data-item-tip className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-4 text-white/70">
                <span data-item-tip-type>{facts.type}</span>
                {count != null && (
                    <span className="tabular-nums text-white">{t('itemTip.count', { count: count.toLocaleString('en-US') })}</span>
                )}
            </div>
            {facts.equippable && (
                <div data-item-tip-equip className="text-white">{t('itemTip.equippable', { slot: facts.equippable })}</div>
            )}
            {facts.tool && <div className="text-white">{facts.tool}</div>}
            {facts.hits && <div data-item-tip-hits className="text-white">{facts.hits}</div>}
            {facts.arrow && <div data-item-tip-arrow className="text-white">{facts.arrow}</div>}
            {facts.offHand && <div data-item-tip-offhand className="text-white/70">{facts.offHand}</div>}
            {facts.resists.map(line => <div key={line} data-item-tip-resist className="text-white">{line}</div>)}
            {facts.cuts.map(line => <div key={line} data-item-tip-cut className="text-gi-danger">{line}</div>)}
            {facts.twoHanded && <div className="text-white/70">{t('itemTip.twoHanded')}</div>}
            {facts.restores != null && (
                <div className="text-white">{t('itemTip.restores', { amount: facts.restores })}</div>
            )}
            {facts.tags.length > 0 && (
                <div className="ui-text-small text-white/55">{facts.tags.join(' · ')}</div>
            )}
            {facts.description && (
                <p className="text-white/85 leading-snug">{facts.description}</p>
            )}
            {facts.writes && (
                <div data-map-writes className="flex flex-col gap-0.5 pt-1 mt-0.5 border-t border-white/10">
                    <div className="flex items-baseline justify-between gap-3">
                        <span className="ui-text-small text-white/55">{MAP_TEXT.whatItWrites}</span>
                        <span className="text-white text-right">{facts.writes.headline}</span>
                    </div>
                    {facts.writes.lines.map((line, i) => (
                        <div key={`${line.role}-${line.typeId}-${i}`} className="flex items-center gap-1.5">
                            <ItemIcon item={line.typeId} size={16} className="shrink-0" title={null} />
                            <span className="tabular-nums text-white/85">{line.text}</span>
                        </div>
                    ))}
                </div>
            )}
            {hint && <div className="ui-text-small text-white/55">{hint}</div>}
        </div>
    );
};

export default ItemTipContent;
