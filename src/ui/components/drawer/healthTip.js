import { REGEN_CONFIG } from '../../../config/FormulaRegistry.js';
import { authoredStars } from '../../../config/guildUpgrades.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { GameState } from '../../../state/GameState.js';
import { regenContributions, regenShare, REGEN_FROM } from '../../../systems/hero/regen.js';
import { hallSourceOf } from '../../../systems/progression/hallModifiers.js';
import { toRoman } from '../../../utils/Formatters.js';
import { t } from '../../../i18n/index.js';

const round2 = (n) => Math.round(n * 100) / 100;

/** `+50%`, `-10%`, `+0%`: a Regen share. */
function percentText(fraction) {
    const n = round2(fraction * 100);
    return `${n < 0 ? '-' : '+'}${Math.abs(n).toLocaleString('en-US')}%`;
}

/** One contribution's amount as its bucket reads: `+25%`, `+1`, `x1.5`. */
function amountText({ bucket, value }) {
    if (bucket === 'flat') return `${value < 0 ? '-' : '+'}${Math.abs(round2(value)).toLocaleString('en-US')}`;
    if (bucket === 'multiplier') return `x${round2(value).toLocaleString('en-US')}`;
    return percentText(value);
}

/** Which line one contribution joins, and its name. */
function sourceOf(c) {
    if (c.from === REGEN_FROM.GUILD) {
        const star = hallSourceOf(c.modifier?.source);
        if (star) {
            const rank = Math.floor(Number(GameState.state?.progress?.guildUpgrades?.[star.starId]) || 0);
            const name = authoredStars().find(s => s.id === star.starId)?.name || star.starId;
            return { key: `star:${star.starId}`, name: t('effectBadges.source.star', { star: name, rank: toRoman(rank) }) };
        }
        return { key: `guild:${c.modifier?.source}`, name: c.modifier?.label || t('effectBadges.source.guild') };
    }
    const statement = c.statement || {};
    if (c.from === REGEN_FROM.GEAR) {
        const itemIds = statement.sourceItemIds || [];
        return { key: `gear:${itemIds.join(',')}`, name: itemIds.map(id => getItem(id)?.name || id).join(', ') };
    }
    const name = statement.effectTitle || statement.sourceEffectId || '';
    return { key: `${c.from}:${statement.sourceEffectId || name}`, name };
}

/**
 * The hero's health hover: how much they heal out of a fight, their Regen, and one line per
 * source of it (gear and perks first, then the guild's).
 * @returns {{ title: string, lines: string[] }}
 */
export function healthTipView(hero) {
    const contributions = regenContributions(hero);
    const share = contributions.length ? regenShare(contributions) : 0;
    const perInterval = REGEN_CONFIG.hp.amount * (1 + share);
    const lines = [
        t('heroPanel.health.heals', {
            hp: round2(Math.max(0, perInterval)).toLocaleString('en-US'),
            seconds: REGEN_CONFIG.hp.interval.toLocaleString('en-US')
        }),
        t('heroPanel.health.regen', { amount: percentText(share) })
    ];
    const bySource = new Map();
    for (const c of contributions) {
        const { key, name } = sourceOf(c);
        const line = bySource.get(key);
        if (line && line.bucket === c.bucket) line.value += c.value;
        else if (!line) bySource.set(key, { name, bucket: c.bucket, value: c.value });
        else bySource.set(`${key}:${c.bucket}`, { name, bucket: c.bucket, value: c.value });
    }
    for (const line of bySource.values()) {
        if (line.value === 0 && line.bucket !== 'multiplier') continue;
        lines.push(t('heroPanel.health.source', { source: line.name, amount: amountText(line) }));
    }
    return { title: t('heroPanel.health.title'), lines };
}
