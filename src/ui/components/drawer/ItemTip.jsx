import React from 'react';
import { t } from '../../../i18n/index.js';
import { toolOf, toolKindLabel, handsOf, HANDS, neededToolOf, toolMeets } from '../../../config/registries/toolKinds.js';
import { getAllTokenTypes, tokenName } from '../../../config/registries/tokenRegistry.js';
import { weaponStyleOf, isOffHand, gearRequirements } from '../../../config/registries/weaponStyles.js';
import { weaponDamageTypeOf, arrowOf, DAMAGE_GROUPS, DAMAGE_TYPES } from '../../../config/registries/damageTypes.js';
import { gearResistancesOf, gearDamageCutOf } from '../../../config/registries/gearDefence.js';
import { COMBAT_SKILL_IDS } from '../../../config/registries/skillRegistry.js';
import { getSkill } from '../../../config/registries/skillRegistry.js';
import { UNARMED_DAMAGE, ATTACK_SPEED_MS, DEFAULT_ATTACK_SPEED, attackSpeedMs } from '../../../config/FormulaRegistry.js';
import { breakChanceOf } from '../../../config/registries/itemBreak.js';
import { lengthText, chanceFigure } from '../../../utils/Formatters.js';

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

/** A weapon's swing: "Slow (4s)". Anything but the three speeds fights at normal. */
function speedValue(item) {
    const speed = ATTACK_SPEED_MS[item?.speed] ? item.speed : DEFAULT_ATTACK_SPEED;
    return t('itemTip.stat.speedValue', {
        speed: t(`itemTip.speedName.${speed}`),
        time: lengthText(attackSpeedMs(speed))
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

const WORKS_SHOWN = 4;

/** "Works Iron Vein, Copper Vein and 2 more": the Tokens a tool lets a hero work, by the work check's own rule. */
function worksLine(tool) {
    if (!tool) return null;
    const names = Object.entries(getAllTokenTypes())
        .filter(([, def]) => { const need = neededToolOf(def); return need && toolMeets(tool, need); })
        .map(([id, def]) => def?.name || tokenName(id));
    if (!names.length) return null;
    const shown = names.slice(0, WORKS_SHOWN).join(', ');
    return names.length > WORKS_SHOWN
        ? t('itemTip.worksMore', { list: shown, n: names.length - WORKS_SHOWN })
        : t('itemTip.works', { list: shown });
}

/** "1% chance to break each cycle" (a tool) or "… each kill" (a weapon); null when it never breaks. */
function breakLine(item, tool) {
    const chance = breakChanceOf(item);
    if (!(chance > 0)) return null;
    const n = chanceFigure(chance).toLocaleString('en-US');
    return t(tool ? 'itemTip.breaksWork' : 'itemTip.breaksFight', { n });
}

/** "Needs Melee 15": every level the item asks of its wearer, the engine's own list; null for none. */
export function needsLine(item) {
    const levels = gearRequirements(item);
    if (!levels.length) return null;
    return t('itemTip.needs', { levels: levels.map(r => `${getSkill(r.skill)?.name || r.skill} ${r.level}`).join(', ') });
}

/**
 * Everything the tooltip says about an item, as plain facts (the component below draws them).
 * Mounted only while a tooltip is open, so nothing here runs per frame.
 */
export function itemTipFacts(item) {
    const tool = toolOf(item);
    const hands = handsOf(item);
    const style = weaponStyleOf(item);
    const arrow = arrowOf(item);
    return {
        type: itemTypeLabel(item),
        tool: tool ? t('itemTip.tool', { kind: toolKindLabel(tool.kind), tier: tool.tier }) : null,
        works: worksLine(tool),
        // Said before a drop is refused for it (`EquipmentValidator.canHeroEquip`).
        needs: needsLine(item),
        // A tool breaks at the end of a work cycle, a weapon at a kill (`Breakage.js`).
        breaks: breakLine(item, tool),
        stats: weaponStats(item, style, hands),
        // What an arrow adds to a bow's shot: the damage and its type.
        arrow: arrow ? t('itemTip.arrow', { damage: arrow.damage, type: t(`fight.types.${arrow.damageType}`) }) : null,
        offHand: isOffHand(item) ? t('itemTip.offHand') : null,
        // What a worn piece resists, and what it costs: the styles it cuts, shown red.
        resists: resistLines(item),
        cuts: cutLines(item),
        // Only food heals; a drink or potion is a buff, so a leftover amount is not offered as a promise.
        restores: item?.restoreAmount > 0 && item.equipSlot === 'food' ? item.restoreAmount : null,
        tags: Array.isArray(item?.tags) ? item.tags.filter(Boolean) : [],
        description: typeof item?.description === 'string'
            ? item.description.replace(/^["']|["']$/g, '').trim()
            : ''
    };
}

/**
 * The body of an item's hover tooltip; the name is the tooltip's title, its header. Under it the
 * count, then its tool, its chance to break and its tags. No type or "Equippable" line: the tags
 * say the kind. `details` adds everything else (weapon stats, arrow, resists, what it restores,
 * description): the Bank leaves them to its Item drawer (`ItemDrawer`); the Encyclopedia, which
 * has no drawer, keeps them. `hint` is one extra muted line (select mode's click hint).
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

/** What kind of item it is: its tool, its chance to break, then its tags. */
export const ItemKindLines = ({ facts }) => (
    <>
        <ItemToolLines facts={facts} />
        {facts.tags.length > 0 && (
            <div data-item-tip-tags className="ui-text-small text-white/55">{facts.tags.join(' · ')}</div>
        )}
    </>
);

/** Its tool, the level it needs and its chance to break (the Item drawer shows the tags as pills instead). */
export const ItemToolLines = ({ facts }) => (
    <>
        {facts.tool && <div data-item-tip-tool className="text-white">{facts.tool}</div>}
        {facts.works && <div data-item-tip-works className="text-white">{facts.works}</div>}
        {facts.needs && <div data-item-tip-needs className="text-white">{facts.needs}</div>}
        {facts.breaks && <div data-item-tip-breaks className="text-white">{facts.breaks}</div>}
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
