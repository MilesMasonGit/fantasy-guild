import { useActiveDrag } from '../../dnd/DndKit.jsx';
import { FloatingTip } from '../base/Tooltip.jsx';
import { SkillIcon } from '../base/SkillIcon.jsx';
import { enemyCardView, levelText, secondsText, styleName } from './fightView.js';
import { t } from '../../../i18n/index.js';

/**
 * The enemy card's rows (owner, 2026-10-25, option B's table): level, style, health, hit, armour
 * and swing, and its kinds once the guild has fought one (until then "? fight one to learn"). No
 * forecast: the player does the sums. `card` is `fightView.enemyCardView`'s.
 */
export const EnemyCardRows = ({ card }) => (
    <div data-enemy-card={card.typeId} className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 ui-text-body text-white" style={{ minWidth: 220 }}>
        <span className="text-gi-muted">{t('fight.card.level')}</span>
        <span className="font-bold tabular-nums" data-enemy-card-level>{levelText(card.level)}</span>
        <span className="text-gi-muted">{t('fight.card.style')}</span>
        <span className="inline-flex items-center gap-1 font-bold" data-enemy-card-style={card.style}>
            <SkillIcon skill={card.style} size={16} title={null} />
            {styleName(card.style)}
        </span>
        <span className="text-gi-muted">{t('fight.card.health')}</span>
        <span className="font-bold tabular-nums" data-enemy-card-hp>{card.hp}</span>
        <span className="text-gi-muted">{t('fight.card.hit')}</span>
        <span className="font-bold tabular-nums" data-enemy-card-hit>{card.hit}</span>
        <span className="text-gi-muted">{t('fight.card.armour')}</span>
        <span className="font-bold tabular-nums" data-enemy-card-armour>{card.armour}</span>
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
