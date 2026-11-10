import { useGameState } from '../../hooks/useGameState.js';
import { Tooltip } from '../base/Tooltip.jsx';
import { SkillIcon } from '../base/SkillIcon.jsx';
import { CombatGlyph } from '../combat/CombatGlyph.jsx';
import { GLYPH_COLOUR } from '../combat/combatGlyphs.js';
import { HitParts, ResistChips, resistTip } from '../combat/CombatStatParts.jsx';
import { damageText, secondsText, styleName, levelText } from '../combat/fightView.js';
import * as HeroManager from '../../../systems/hero/HeroManager.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';
import { heroCombatStats } from './heroCombatStats.js';
import { t } from '../../../i18n/index.js';

/** How many stat rows stand in one column of the Combat view. */
export const COMBAT_ROWS_PER_COLUMN = 5;

/** What redraws the view: the hero's own changes, their gear, and the Bank (arrows, shared food). */
const COMBAT_VIEW_EVENTS = Object.freeze([
    ENGINE_EVENTS.HEROES_UPDATED, ENGINE_EVENTS.HERO_EQUIPMENT_CHANGED, ENGINE_EVENTS.INVENTORY_UPDATED,
    ENGINE_EVENTS.HERO_LEVELED, ENGINE_EVENTS.GAME_RESET
]);

const pct = (n) => `${Math.round(n * 100) / 100}%`;

/**
 * The hero drawer's Combat view: the hero's fighting numbers as a fight would use them
 * (`heroCombatStats`), one row a stat in columns of five, each with its tooltip. The loadout grid
 * beside it stays in view, so a swap shows here at once.
 */
export const HeroCombatView = ({ heroId }) => {
    // Flat projection: a string that changes only when a number drawn here changes.
    const signature = useGameState(
        () => JSON.stringify(heroCombatStats(HeroManager.getHero(heroId))),
        COMBAT_VIEW_EVENTS,
        null,
        { deps: [heroId] }
    );
    const s = signature ? JSON.parse(signature) : null;
    if (!s) return null;
    const style = styleName(s.style);
    return (
        <div
            data-hero-combat
            className="grid grid-flow-col gap-x-6 gap-y-1 ui-text-body"
            style={{ gridTemplateRows: `repeat(${COMBAT_ROWS_PER_COLUMN}, auto)` }}
        >
            <Row
                stat="style"
                label={t('heroPanel.combat.style')}
                tip={t('heroPanel.combat.styleTip')}
                lines={s.armed ? undefined : [t('heroPanel.combat.barehanded')]}
            >
                <SkillIcon skillId={s.style} size={16} />
                {style} {levelText(s.level)}
            </Row>
            <Row stat="hit" label={t('heroPanel.combat.hit')} tip={t('fight.tip.heroHit', { hit: damageText(s.hit) })} lines={s.hitLines}>
                {s.hitParts.length ? <HitParts parts={s.hitParts} /> : damageText(s.hit)}
            </Row>
            <Row
                stat="range"
                label={t('heroPanel.combat.range')}
                tip={t('heroPanel.combat.rangeTip')}
                lines={[
                    ...s.range.vs.map(v => t('heroPanel.combat.rangeVs', { style: styleName(v.style), n: damageText(v.hit) })),
                    t('heroPanel.combat.crit', { n: damageText(s.range.crit) })
                ]}
            >
                {s.range.low === s.range.high ? damageText(s.range.low) : `${damageText(s.range.low)}–${damageText(s.range.high)}`}
            </Row>
            <Row stat="swing" label={t('fight.window.swing')} tip={t('fight.tip.swing', { time: secondsText(s.swingMs) })}>
                <CombatGlyph name="clock" colour={GLYPH_COLOUR.text} />
                {secondsText(s.swingMs)}
            </Row>
            <Row stat="crit" label={t('heroPanel.combat.critChance')} tip={t('heroPanel.combat.critChanceTip')}>
                {pct(s.critChance)}
            </Row>
            <Row stat="accuracy" label={t('heroPanel.combat.accuracy')} tip={t('heroPanel.combat.accuracyTip')}>
                {pct(s.accuracy)}
            </Row>
            <Row stat="dodge" label={t('heroPanel.combat.dodge')} tip={t('heroPanel.combat.dodgeTip')}>
                {pct(s.dodge)}
            </Row>
            <Row stat="resists" label={t('heroPanel.combat.resists')} tip={t('fight.tip.heroResists', { name: HeroManager.getHero(heroId)?.name || '' })} lines={resistTip(s.resists)}>
                <ResistChips lines={s.resists} />
            </Row>
            <Row stat="cuts" label={t('heroPanel.combat.cuts')} tip={t('heroPanel.combat.cutsTip')}>
                {s.cuts.length === 0
                    ? <span className="text-gi-muted">–</span>
                    : s.cuts.map(c => (
                        <span key={c.style} data-hero-combat-cut={c.style} className="inline-flex items-center gap-0.5">
                            <SkillIcon skillId={c.style} size={16} />−{damageText(c.n)}%
                        </span>
                    ))}
            </Row>
            <Row stat="effects" label={t('heroPanel.combat.effects')} tip={t('heroPanel.combat.effectsTip')}>
                {s.effects.length === 0
                    ? <span className="text-gi-muted">–</span>
                    : s.effects.map(e => (
                        <Tooltip key={e.id} title={e.title} lines={[...e.lines, e.items.join(', ')]}>
                            <span data-hero-combat-effect={e.id} className="cursor-help underline decoration-dotted decoration-white/40">{e.title}</span>
                        </Tooltip>
                    ))}
            </Row>
        </div>
    );
};

/** One stat: its name, muted, then its value, bold, the tooltip on the value. Rows never boxed. */
const Row = ({ stat, label, tip, lines, children }) => (
    <div data-hero-combat-stat={stat} className="grid grid-cols-[112px_auto] items-center gap-2 min-h-[22px]">
        <span className="ui-text-small text-gi-muted">{label}</span>
        <Tooltip title={tip} lines={lines}>
            <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 font-bold tabular-nums text-white cursor-help max-w-[200px]">{children}</span>
        </Tooltip>
    </div>
);

export default HeroCombatView;
