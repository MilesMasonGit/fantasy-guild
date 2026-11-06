import React from 'react';
import { t } from '../../../i18n/index.js';
import { categoryOfItem, getCategoryInfo } from '../../../config/registries/equipmentConstants.js';
import { toolOf, toolKindLabel, handsOf, HANDS } from '../../../config/registries/toolKinds.js';
import { weaponStyleOf, isOffHand } from '../../../config/registries/weaponStyles.js';
import { weaponDamageTypeOf, arrowOf, DAMAGE_GROUPS, DAMAGE_TYPES } from '../../../config/registries/damageTypes.js';
import { gearResistancesOf, gearDamageCutOf } from '../../../config/registries/gearDefence.js';
import { COMBAT_SKILL_IDS } from '../../../config/registries/skillRegistry.js';
import { getSkill } from '../../../config/registries/skillRegistry.js';
import { UNARMED_DAMAGE, ATTACK_SPEED_MS, DEFAULT_ATTACK_SPEED, attackSpeedMs } from '../../../config/FormulaRegistry.js';

/** What kind of item it is, in the player's words. */
export function itemTypeLabel(item) {
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

/** A weapon's swing: "Slow (4 s)". Anything but the three speeds fights at normal. */
function speedValue(item) {
    const speed = ATTACK_SPEED_MS[item?.speed] ? item.speed : DEFAULT_ATTACK_SPEED;
    return t('itemTip.stat.speedValue', {
        speed: t(`itemTip.speedName.${speed}`),
        time: t('fight.seconds', { n: attackSpeedMs(speed) / 1000 })
    });
}

/** A weapon's stat block, as `{ id, label, value }` rows; null for anything that is not a weapon. */
function weaponStats(item, style, hands) {
    if (!style) return null;
    const row = (id, value) => ({ id, label: t(`itemTip.stat.${id}`), value: String(value) });
    return [
        row('damage', Number(item.damage) > 0 ? Number(item.damage) : UNARMED_DAMAGE),
        row('type', t(`fight.types.${weaponDamageTypeOf(item, style)}`)),
        row('skill', getSkill(style)?.name || style),
        row('speed', speedValue(item)),
        ...(hands >= HANDS ? [row('hands', hands)] : [])
    ];
}

/**
 * Everything the tooltip says about an item, as plain facts (the component below draws them).
 * Mounted only while a tooltip is open, so nothing here runs per frame.
 */
export function itemTipFacts(item) {
    const category = categoryOfItem(item?.id);
    const tool = toolOf(item);
    const hands = handsOf(item);
    const style = weaponStyleOf(item);
    const arrow = arrowOf(item);
    return {
        type: itemTypeLabel(item),
        equippable: category ? getCategoryInfo(category).label : null,
        tool: tool ? t('itemTip.tool', { kind: toolKindLabel(tool.kind), tier: tool.tier }) : null,
        stats: weaponStats(item, style, hands),
        // What an arrow adds to a bow's shot: the damage and its type.
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
            : ''
    };
}

/**
 * The body of an item's hover tooltip; the name is the tooltip's title, its header. Under it the
 * count, then what kind of item it is (type, what it equips as, its tool) and its tags.
 * `details` adds everything else (weapon stats, arrow, resists, what it restores, description):
 * the Bank leaves them to its inspection window (`BankItemWindow`); the Encyclopedia, which has no
 * window, keeps them. `hint` is one extra muted line (select mode's click hint).
 */
export const ItemTipContent = ({ item, count = null, hint = null, details = true }) => {
    const facts = itemTipFacts(item);
    return (
        <div data-item-tip className="flex flex-col gap-1">
            {count != null && (
                <div data-item-tip-count className="tabular-nums font-bold text-white">{t('itemTip.count', { count: count.toLocaleString('en-US') })}</div>
            )}
            <ItemKindLines facts={facts} />
            {details && <ItemDetailLines facts={facts} />}
            {hint && <div className="ui-text-small text-white/55">{hint}</div>}
        </div>
    );
};

/** What kind of item it is: type, what it equips as, its tool, then its tags. */
export const ItemKindLines = ({ facts }) => (
    <>
        <div data-item-tip-type className="text-white/70">{facts.type}</div>
        {facts.equippable && (
            <div data-item-tip-equip className="text-white">{t('itemTip.equippable', { slot: facts.equippable })}</div>
        )}
        {facts.tool && <div data-item-tip-tool className="text-white">{facts.tool}</div>}
        {facts.tags.length > 0 && (
            <div data-item-tip-tags className="ui-text-small text-white/55">{facts.tags.join(' · ')}</div>
        )}
    </>
);

/** Everything past the kind: a weapon's stats, an arrow's shot, resists and cuts, what it restores, its description. */
export const ItemDetailLines = ({ facts }) => (
    <>
        {facts.stats && (
            <div data-item-tip-stats className="grid grid-cols-[48px_1fr] gap-x-3 gap-y-0.5">
                {facts.stats.map(({ id, label, value }) => (
                    <React.Fragment key={id}>
                        <span className="text-gi-muted">{label}</span>
                        <span className="text-white tabular-nums" data-item-tip-stat={id}>{value}</span>
                    </React.Fragment>
                ))}
            </div>
        )}
        {facts.arrow && <div data-item-tip-arrow className="text-white">{facts.arrow}</div>}
        {facts.offHand && <div data-item-tip-offhand className="text-white/70">{facts.offHand}</div>}
        {facts.resists.map(line => <div key={line} data-item-tip-resist className="text-white">{line}</div>)}
        {facts.cuts.map(line => <div key={line} data-item-tip-cut className="text-gi-danger">{line}</div>)}
        {facts.restores != null && (
            <div data-item-tip-restores className="text-white">{t('itemTip.restores', { amount: facts.restores })}</div>
        )}
        {facts.description && (
            <p data-item-tip-description className="text-white/85 leading-snug">{facts.description}</p>
        )}
    </>
);

export default ItemTipContent;
