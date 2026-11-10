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

/** The skill panel's width in screen px. */
export const SKILL_PANEL_W = 320;

/**
 * One skill in full, opened by a click on it in the hero drawer: a small framed panel standing over
 * the drawer, with its own close X (Escape closes it first). Its icon, name and level and the book;
 * what the skill is for; the exact XP numbers; every milestone perk, those held in gold, the rest
 * dimmed. Another skill clicked switches it.
 * @param {{ heroId: string, row: { id: string, name: string, level: number, xp: number }, onClose: () => void,
 *   onLookUp: () => void, style?: object }} props
 */
export const HeroSkillPanel = ({ heroId, row, onClose, onLookUp, style }) => {
    useEscapeLayer(true, onClose);
    const purpose = skillPurposeText(row.id);
    const perks = skillPerkTable(row.id, row.level);
    // The perk list gives up height while the panel would run past the screen's top (a short window).
    const headRef = useRef(null);
    const [perkMaxPx, setPerkMaxPx] = useState(PERK_LIST_MAX_PX);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useLayoutEffect(() => {
        const box = headRef.current?.closest('[data-hero-skill-panel]');
        if (!box) return;
        const room = box.getBoundingClientRect().top - SCREEN_MARGIN_PX;
        const next = Math.max(PERK_LIST_MIN_PX, Math.min(PERK_LIST_MAX_PX, Math.round(perkMaxPx + room)));
        if (next !== perkMaxPx) setPerkMaxPx(next);
    });
    return (
        <PixelFrame
            kind={FRAME_KIND.CHAMFER}
            data-hero-skill-panel={row.id}
            className="absolute pointer-events-auto"
            style={{ width: SKILL_PANEL_W, ...style }}
            frameClassName="p-2 flex flex-col gap-2 bg-gi-surface"
        >
            <div ref={headRef} className="flex items-center gap-2">
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
                <CloseX data-hero-skill-panel-close label={t('heroPanel.closeSkill')} onClick={onClose} />
            </div>
            {purpose && <p data-hero-skill-panel-purpose className="ui-text-body text-gi-text leading-snug">{purpose}</p>}
            <SkillNumbers heroId={heroId} row={row} />
            <div className="border-t border-white/10" />
            <SkillPerkList perks={perks} maxPx={perkMaxPx} />
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

/** The perk list's tallest, in screen px: about five rows, then it scrolls. */
export const PERK_LIST_MAX_PX = 140;
/** The least it shrinks to on a short screen: about two rows. */
const PERK_LIST_MIN_PX = 48;
/** How close to the screen's top edge the panel may come. */
const SCREEN_MARGIN_PX = 8;

/**
 * The panel's second part: every milestone perk, lowest first, one row each, `10/99  Even Heat: +10 %
 * Smithing XP`, its words the perk's own rule as the game renders it (`perkLines`). Held ones in
 * gold, the rest dimmed. A list taller than `maxPx` scrolls with the arrow bars.
 */
const SkillPerkList = ({ perks, maxPx = PERK_LIST_MAX_PX }) => {
    if (!perks.length) {
        return <p data-skill-perks="none" className="ui-text-small text-gi-muted">{t('heroPanel.noPerks')}</p>;
    }
    return (
        <div className="flex flex-col min-h-0">
            <ArrowScrollList
                step={56}
                compact
                className="flex flex-col gap-1 leading-tight"
                listProps={{ 'data-skill-perks': 'some', style: { maxHeight: maxPx } }}
            >
                {perks.map(p => (
                    <div
                        key={`${p.level}:${p.effectId}`}
                        data-skill-perk={p.effectId}
                        data-skill-perk-earned={p.earned ? 'true' : 'false'}
                        className={cn('flex items-baseline gap-2 ui-text-body', !p.earned && 'opacity-50')}
                    >
                        <span className={cn('shrink-0 font-bold tabular-nums', p.earned ? 'text-gi-gold' : 'text-gi-muted')}>
                            {skillLevelText(p.level)}
                        </span>
                        <span className={p.earned ? 'text-white' : 'text-gi-muted'}>
                            {t('heroPanel.perkRow', { name: p.title, rules: perkLines(p).join(', ') })}
                        </span>
                    </div>
                ))}
            </ArrowScrollList>
        </div>
    );
};

export default HeroSkillPanel;
