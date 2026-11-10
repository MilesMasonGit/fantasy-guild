import { useLayoutEffect, useRef, useState } from 'react';
import { cn } from '../../utils/cn.js';
import { useEscapeLayer } from '../../utils/escapeLayers.js';
import { PixelFrame, FRAME_KIND } from '../base/PixelFrame.jsx';
import { PixelGlyph } from '../base/PixelGlyph.jsx';
import { ArrowScrollList } from '../base/ArrowScrollList.jsx';
import { CloseX } from '../base/CloseX.jsx';
import { SkillIcon } from '../base/SkillIcon.jsx';
import { XpRateTracker } from '../../../systems/hero/XpRateTracker.js';
import { skillDetail, skillLevelText, skillPurposeText } from './heroPanelSkills.js';
import { skillPerkTable, perkLines } from './heroPerks.js';
import { t } from '../../../i18n/index.js';

/** The skill panel's left part (the skill and its numbers), in screen px. */
export const SKILL_INFO_W = 300;

/** The least the milestone list keeps, in screen px: about two rows. */
const PERK_LIST_MIN_PX = 48;

/**
 * One skill in full, opened by a click on it in the hero drawer: a small framed panel standing over
 * the drawer on the Hero drawer's teal backdrop, with its own close X (Escape closes it first;
 * another skill clicked switches it). Two parts side by side: on the left the skill (icon, name,
 * level, the book), what it is for and its exact XP numbers; on the right every milestone perk in
 * one scrolling list as tall as the left part, a row each on one line, `10  Even Heat: +10 % XP
 * (Smithing)`, held ones in gold, the rest dimmed.
 * @param {{ heroId: string, row: { id: string, name: string, level: number, xp: number }, onClose: () => void,
 *   onLookUp: () => void, style?: object }} props
 */
export const HeroSkillPanel = ({ heroId, row, onClose, onLookUp, style }) => {
    useEscapeLayer(true, onClose);
    const purpose = skillPurposeText(row.id);
    const perks = skillPerkTable(row.id, row.level);
    // The list is as tall as the left part, less its own heading: measured after every draw, set
    // only when it changes.
    const infoRef = useRef(null);
    const headRef = useRef(null);
    const [listMaxPx, setListMaxPx] = useState(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useLayoutEffect(() => {
        const info = infoRef.current?.offsetHeight || 0;
        const head = headRef.current?.offsetHeight || 0;
        const next = Math.max(PERK_LIST_MIN_PX, info - head - 4);
        if (info && next !== listMaxPx) setListMaxPx(next);
    });
    return (
        <PixelFrame
            kind={FRAME_KIND.CHAMFER}
            backdrop="hero"
            data-hero-skill-panel={row.id}
            className="absolute pointer-events-auto"
            style={{ maxWidth: 'calc(100vw - 16px)', ...style }}
            frameClassName="p-2 flex items-start gap-3"
        >
            <div ref={infoRef} data-hero-skill-panel-info className="shrink-0 flex flex-col gap-2" style={{ width: SKILL_INFO_W }}>
                <div className="flex items-center gap-2">
                    <SkillIcon skillId={row.id} size={32} />
                    <span className="min-w-0 ui-text-title font-bold text-white">{row.name}</span>
                    <span data-hero-skill-panel-level className="ui-text-body font-bold tabular-nums text-white">{skillLevelText(row.level)}</span>
                    <span className="flex-1" />
                    <button
                        type="button"
                        data-hero-skill-panel-book
                        title={t('heroPanel.lookUp')}
                        aria-label={t('heroPanel.lookUp')}
                        onClick={onLookUp}
                        className="ui-icon-button w-8 h-8 flex items-center justify-center text-gi-muted hover:text-white cursor-pointer"
                    >
                        <PixelGlyph name="book" />
                    </button>
                </div>
                {purpose && <p data-hero-skill-panel-purpose className="ui-text-body text-gi-text leading-snug">{purpose}</p>}
                <SkillNumbers heroId={heroId} row={row} />
            </div>
            <div aria-hidden className="self-stretch border-l border-white/10" />
            <div data-hero-skill-panel-milestones className="min-w-0 flex flex-col gap-1">
                <div ref={headRef} className="flex items-center gap-2">
                    <span className="ui-text-body font-bold text-gi-muted">{t('heroPanel.milestones')}</span>
                    <span className="flex-1" />
                    <CloseX data-hero-skill-panel-close label={t('heroPanel.closeSkill')} onClick={onClose} />
                </div>
                <SkillPerkList perks={perks} maxPx={listMaxPx || undefined} />
            </div>
        </PixelFrame>
    );
};

/** A skill's exact numbers, read as it draws (`skillDetail`): this level's XP, what is left, the total, the rate and the time to the next level. */
const SkillNumbers = ({ heroId, row }) => {
    const d = skillDetail(row.xp, XpRateTracker.getRate(heroId, row.id));
    const lines = [
        d.level && [t('heroPanel.xp'), d.level],
        d.toNext && [t('heroPanel.toNext'), d.toNext],
        [t('heroPanel.totalXp'), d.total],
        d.level && [t('heroPanel.xpRate'), d.rate || t('heroPanel.noRate')],
        d.eta && [t('heroPanel.nextLevel'), d.eta]
    ].filter(Boolean);
    return (
        <dl data-skill-detail className="grid grid-cols-2 gap-x-3 gap-y-1 leading-tight">
            {lines.map(([label, value]) => (
                <div key={label} className="min-w-0 flex flex-col">
                    <dt className="ui-text-small text-gi-muted">{label}</dt>
                    <dd className="ui-text-body tabular-nums text-white">{value}</dd>
                </div>
            ))}
        </dl>
    );
};

/**
 * Every milestone perk, lowest first, a row each on one line: the level alone in a column of its
 * own, right-aligned, then `Even Heat: +10 % XP (Smithing)`, its words the perk's own rule as the
 * game renders it (`perkLines`). Held ones in gold, the rest dimmed. Taller than `maxPx`, it scrolls
 * with the arrow bars.
 */
const SkillPerkList = ({ perks, maxPx }) => {
    if (!perks.length) {
        return <p data-skill-perks="none" className="ui-text-small text-gi-muted whitespace-nowrap">{t('heroPanel.noPerks')}</p>;
    }
    return (
        <ArrowScrollList
            step={48}
            compact
            className="flex flex-col gap-1.5 leading-tight pr-1"
            listProps={{ 'data-skill-perks': 'some', style: maxPx ? { maxHeight: maxPx } : undefined }}
        >
            {perks.map(p => (
                <div
                    key={`${p.level}:${p.effectId}`}
                    data-skill-perk={p.effectId}
                    data-skill-perk-earned={p.earned ? 'true' : 'false'}
                    className={cn('flex items-baseline gap-2 ui-text-body whitespace-nowrap', !p.earned && 'opacity-50')}
                >
                    <span data-skill-perk-level className={cn('w-6 shrink-0 text-right font-bold tabular-nums', p.earned ? 'text-gi-gold' : 'text-gi-muted')}>
                        {p.level}
                    </span>
                    <span className={p.earned ? 'text-white' : 'text-gi-muted'}>
                        {t('heroPanel.perkRow', { name: p.title, rules: perkLines(p).join(', ') })}
                    </span>
                </div>
            ))}
        </ArrowScrollList>
    );
};

export default HeroSkillPanel;
