import { cn } from '../../utils/cn.js';
import { useEscapeLayer } from '../../utils/escapeLayers.js';
import { PixelFrame, FRAME_KIND } from '../base/PixelFrame.jsx';
import { PixelGlyph } from '../base/PixelGlyph.jsx';
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
    return (
        <PixelFrame
            kind={FRAME_KIND.CHAMFER}
            data-hero-skill-panel={row.id}
            className="absolute pointer-events-auto"
            style={{ width: SKILL_PANEL_W, ...style }}
            frameClassName="p-2 flex flex-col gap-2 bg-gi-surface"
        >
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
                <CloseX data-hero-skill-panel-close label={t('heroPanel.closeSkill')} onClick={onClose} />
            </div>
            {purpose && <p data-hero-skill-panel-purpose className="ui-text-body text-gi-text leading-snug">{purpose}</p>}
            <SkillNumbers heroId={heroId} row={row} />
            <SkillPerkList perks={perks} />
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

/** Every milestone perk, lowest first: held ones in gold with what they do, the rest dimmed. Rows never boxed. */
const SkillPerkList = ({ perks }) => {
    if (!perks.length) {
        return <p data-skill-perks="none" className="ui-text-small text-gi-muted">{t('heroPanel.noPerks')}</p>;
    }
    return (
        <div data-skill-perks className="flex flex-col gap-1 leading-tight">
            {perks.map(p => (
                <div
                    key={`${p.level}:${p.effectId}`}
                    data-skill-perk={p.effectId}
                    data-skill-perk-earned={p.earned ? 'true' : 'false'}
                    className={cn('flex flex-col', !p.earned && 'opacity-50')}
                >
                    <span className={cn('ui-text-body font-bold', p.earned ? 'text-gi-gold' : 'text-gi-muted')}>
                        {t('heroPanel.perkAt', { level: skillLevelText(p.level), perk: p.title })}
                    </span>
                    {perkLines(p).map((line, i) => (
                        <span key={i} className="ui-text-small text-white/80">{line}</span>
                    ))}
                </div>
            ))}
        </div>
    );
};

export default HeroSkillPanel;
