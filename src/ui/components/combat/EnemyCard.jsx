import { useActiveDrag } from '../../dnd/DndKit.jsx';
import { FloatingTip } from '../base/Tooltip.jsx';
import { SkillIcon } from '../base/SkillIcon.jsx';
import { enemyCardView, levelText, secondsText, styleName, damageText, damageTypeName } from './fightView.js';
import { CombatGlyph } from './CombatGlyph.jsx';
import { GLYPH_COLOUR, damageTypeGlyph } from './combatGlyphs.js';
import { t } from '../../../i18n/index.js';

/** One resistance or weakness: its glyph, the type's name and the step. */
const StepLine = ({ line }) => (
    <span className="inline-flex items-center gap-1" data-enemy-card-step={line.id}>
        <CombatGlyph name={damageTypeGlyph(line.id)} colour={line.value < 0 ? GLYPH_COLOUR.gold : GLYPH_COLOUR.text} />
        <span className="font-bold">{t('fight.card.step', { type: damageTypeName(line.id), n: Math.abs(line.value) })}</span>
    </span>
);

/** One move: its name, then the type it hits with, or a star and what its effect does. */
const MoveLine = ({ move }) => (
    <span className="inline-flex items-center gap-1 flex-wrap" data-enemy-card-move={move.name}>
        <span className="font-bold">{move.name}</span>
        <CombatGlyph name={move.hits ? damageTypeGlyph(move.type) : 'star'} colour={GLYPH_COLOUR.text} />
        <span className="ui-text-small text-gi-muted">
            {[move.hits ? damageTypeName(move.type) : null, move.effect].filter(Boolean).join(', ')}
        </span>
    </span>
);

/**
 * The enemy card's rows (owner, 2026-10-25, option B's table): level, style, health, hit with its
 * damage type (each of its moves' types), its moves when it has some (what each hits with or does),
 * what it resists and is weak to (rows only when it has some; "Nothing" when it has neither), swing,
 * and its kinds once the guild has fought one (until then "? fight one to learn").
 * No forecast: the player does the sums. `card` is `fightView.enemyCardView`'s.
 */
export const EnemyCardRows = ({ card }) => {
    const resists = (card.resists || []).filter(l => l.value > 0);
    const weak = (card.resists || []).filter(l => l.value < 0);
    const hitTypes = card.hitTypes?.length ? card.hitTypes : [card.hitType];
    return (
        <div data-enemy-card={card.typeId} className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 ui-text-body text-white" style={{ minWidth: 220 }}>
            <span className="text-gi-muted">{t('fight.card.level')}</span>
            <span className="font-bold tabular-nums" data-enemy-card-level>{levelText(card.level)}</span>
            <span className="text-gi-muted">{t('fight.card.style')}</span>
            <span className="inline-flex items-center gap-1 font-bold" data-enemy-card-style={card.style}>
                <SkillIcon skill={card.style} size={16} />
                {styleName(card.style)}
            </span>
            <span className="text-gi-muted">{t('fight.card.health')}</span>
            <span className="font-bold tabular-nums" data-enemy-card-hp>{card.hp}</span>
            <span className="text-gi-muted">{t('fight.card.hit')}</span>
            <span className="inline-flex items-center gap-1 font-bold tabular-nums" data-enemy-card-hit>
                {damageText(card.hit)}
                {hitTypes.map(type => <CombatGlyph key={type} name={damageTypeGlyph(type)} colour={GLYPH_COLOUR.text} />)}
                {hitTypes.length === 1 && <span className="ui-text-small font-normal text-gi-muted">{damageTypeName(hitTypes[0])}</span>}
            </span>
            {card.moves?.length > 0 && (
                <>
                    <span className="text-gi-muted">{t('fight.card.moves')}</span>
                    <span className="flex flex-col" data-enemy-card-moves>{card.moves.map((m, i) => <MoveLine key={`${m.name}-${i}`} move={m} />)}</span>
                </>
            )}
            {resists.length === 0 && weak.length === 0 && (
                <>
                    <span className="text-gi-muted">{t('fight.card.resists')}</span>
                    <span className="text-gi-muted" data-enemy-card-resists="none">{t('fight.card.noResists')}</span>
                </>
            )}
            {resists.length > 0 && (
                <>
                    <span className="text-gi-muted">{t('fight.card.resists')}</span>
                    <span className="flex flex-col" data-enemy-card-resists="some">{resists.map(l => <StepLine key={l.id} line={l} />)}</span>
                </>
            )}
            {weak.length > 0 && (
                <>
                    <span className="text-gi-muted">{t('fight.card.weakTo')}</span>
                    <span className="flex flex-col" style={{ color: 'var(--color-ui-gold)' }} data-enemy-card-weak="some">{weak.map(l => <StepLine key={l.id} line={l} />)}</span>
                </>
            )}
            <span className="text-gi-muted">{t('fight.card.swing')}</span>
            <span className="font-bold tabular-nums" data-enemy-card-swing>{t('fight.card.every', { time: secondsText(card.swingMs) })}</span>
            <span className="text-gi-muted">{t('fight.card.kinds')}</span>
            {card.kinds == null ? (
                <span className="text-gi-muted" data-enemy-card-kinds="unknown">{t('fight.panel.unknownKinds')}</span>
            ) : card.kinds.length === 0 ? (
                <span className="text-gi-muted" data-enemy-card-kinds="none">{t('fight.panel.noKinds')}</span>
            ) : (
                <span className="flex flex-col" data-enemy-card-kinds="known">
                    {card.kinds.map(k => (
                        <span key={k.id} data-enemy-card-kind={k.id}>
                            <span className="font-bold">{k.name}</span> <span className="text-gi-muted ui-text-small">{k.tip}</span>
                        </span>
                    ))}
                </span>
            )}
        </div>
    );
};

/**
 * The enemy card by the pointer while it rests on an enemy on the mat: the game's floating tooltip
 * (pointer-events none, so dragging and clicking the enemy work as before), hidden during a drag.
 */
export const EnemyCardTip = ({ typeId, instanceId = null }) => {
    const { isDragging } = useActiveDrag();
    const card = enemyCardView(typeId);
    if (!card || isDragging) return null;
    const anchor = typeof document !== 'undefined' && instanceId
        ? document.querySelector(`[data-token-art="true"][data-token-id="${instanceId}"]`)
        : null;
    return (
        <FloatingTip
            anchor={anchor}
            title={card.name}
            maxWidth={300}
            tipProps={{ 'data-enemy-card-tip': typeId }}
            content={<EnemyCardRows card={card} />}
        />
    );
};

export default EnemyCardTip;
