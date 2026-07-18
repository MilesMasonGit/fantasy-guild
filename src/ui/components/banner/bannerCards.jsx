/**
 * Shared banner primitives — every cell in an area banner row renders on one
 * of these card frames. Extracted from AreaBannerRow (code review CR-001).
 */
import React, { useMemo, useState, useEffect } from 'react';
import { useEngine } from '../../hooks/useEngine.js';
import { EventBus } from '../../../systems/core/EventBus.js';
import ProgressBar from '../base/ProgressBar.jsx';
import { TASK_VERBS } from '../card-modules/TaskStage.jsx';
import { useGameState } from '../../hooks/useGameState.js';
import { cn } from '../../utils/cn.js';
import { getAreaSet } from '../../../config/registries/areaSetRegistry.js';
import { getCard } from '../../../config/registries/cardRegistry.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { getEnemy } from '../../../config/registries/enemyRegistry.js';
import { getRecipe, getRecipesBySubskill } from '../../../config/registries/recipeRegistry.js';
import { resolveSpritePath } from '../../../utils/AssetManager.js';
import { AREA_EVENTS } from '../../../systems/core/areaEvents.js';
import { useEntityDrag, useEntityDrop, mergeRefs, ACCEPT_CLS, REJECT_CLS } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import * as CombatFormulas from '../../../utils/CombatFormulas.js';
import StatusPlacards from '../combat/StatusPlacards.jsx';
import { useCombatFeedback, DamageFloaters } from '../combat/combatFeedback.jsx';
import { RefProgressBar } from './RefProgressBar.jsx';
import { ActiveCardFace } from '../ActiveCardFace.jsx';
import { GICard } from '../base/GICard.jsx';
import { ItemIcon } from '../base/ItemIcon.jsx';
import CardFactory from '../../../systems/cards/logic/CardFactory.js';
import { useCardTier, BANNER_FOOTER_H, BANNER_BADGE_ROW_H } from './BannerLayout.jsx';
import { FocusScaffold } from './FocusScaffold.jsx';
import { AreaMat } from './AreaMat.jsx';
import { BadgeRow, deriveCardBadgeIds, deriveHeroBadgeIds, deriveDeckBadgeIds } from '../card-modules/CardBadges.jsx';
import {
    Play, Pause, ChevronUp, ChevronDown, Sword, Hammer, Skull, User,
    Layers, AlertTriangle, Utensils, Hourglass, Infinity as InfinityIcon,
    X, Trash2, Plus, Lock, CheckCircle2, Shield, Package, Boxes, CupSoda
} from 'lucide-react';

/** Resolve a sprite path into a CSS url() for a mat background. */
export const matBgUrl = (p) => (p ? `url(${p.startsWith('/') ? p : '/' + p})` : undefined);

/** Food/drink consumables no longer equip to heroes (owner design 2026-07-16) —
 *  they belong in deck card slots (food) or the station Drink slot (drink). */
export const isConsumableItem = (itemId) => {
    const it = itemId ? getItem(itemId) : null;
    return !!(it && (it.equipSlot === 'food' || it.equipSlot === 'drink'
        || it.type === 'food' || it.type === 'drink'
        || it.tags?.includes('food') || it.tags?.includes('drink')));
};


export const STATUS_LABELS = {
    running: { label: 'Working', color: 'text-gi-success' },
    drawing: { label: 'Drawing…', color: 'text-gi-muted' },
    shuffling: { label: 'Shuffling…', color: 'text-gi-muted' },
    in_combat: { label: 'In Combat!', color: 'text-gi-danger' },
    injured: { label: 'Injured', color: 'text-gi-danger' },
    paused: { label: 'Paused', color: 'text-gi-muted' }
};

// ----------------------------------------------------------------------
// Row cards — every row cell renders on the shared 220×256 card frame
// ----------------------------------------------------------------------

/** Card title styled to match the real cards' CardHeaderModule (gi-card-title). */
export const CardTitle = ({ children, sub, tone = 'text-white', subTone = 'text-gi-muted' }) => (
    <div className="flex flex-col items-center gap-0.5 bg-black/30 w-full py-2 px-3 rounded-t-xl border-b border-white/10 relative z-10">
        <span className={cn('gi-card-title font-bold tracking-widest uppercase text-center leading-tight truncate max-w-full', tone)}>
            {children}
        </span>
        {sub && <span className={cn('text-[8px] uppercase tracking-widest truncate max-w-full font-bold', subTone)}>{sub}</span>}
    </div>
);

/** A real card template (task/combat/consumable/station) drawn on the card frame.
 *  Reuses ActiveCardFace with a CardFactory mock, exactly like the pack reveal. */
export const RowTemplateCard = ({ templateId, areaId, dimmed = false, onClick, title, dragProps }) => {
    const { size, width } = useCardTier();
    const template = useMemo(() => getCard(templateId), [templateId]);
    const mock = useMemo(() => {
        const inst = CardFactory.createInstance(templateId, { overrides: { areaId } });
        if (inst) { inst.id = `preview-${templateId}`; inst.status = 'idle'; }
        return inst;
    }, [templateId, areaId]);
    if (!template || !mock) return null;
    return (
        <div
            onClick={onClick}
            title={title}
            {...dragProps}
            className={cn('shrink-0 flex flex-col items-center transition-opacity', onClick && 'cursor-pointer', dimmed && 'opacity-50 hover:opacity-80')}
        >
            <BadgeRow ids={deriveCardBadgeIds(template, mock)} size={size} />
            <ActiveCardFace cardId={mock.id} cardState={mock} template={template} showActions={false} size={size} width={width} />
        </div>
    );
};

/** The assigned hero drawn on the card frame — area scene behind, portrait on top. */
export const RowHeroCard = ({ hero, areaArt, injured, onClick, dragProps, innerRef, cueClass, combatCardId = null, actionText = null, actionTone = 'text-gi-muted' }) => {
  const { size, width } = useCardTier();
  // Vitals (HP/EN) live on the hero info panel, not the card (owner design 2026-07-14).
  // In combat the hero's half of the split theatre plays here: lunge right
  // (toward the enemy card) on attack, rattle + damage floater when struck.
  const { attacking, struck, floaters } = useCombatFeedback(combatCardId, 'hero');
  return (
    <div ref={innerRef} {...dragProps} className={cn('relative shrink-0 flex flex-col items-center rounded-xl transition-shadow', cueClass)}>
        <BadgeRow ids={deriveHeroBadgeIds({ injured })} size={size} />
        <GICard
            imageSrc={null}
            intent={injured ? 'combat' : 'area'}
            onClick={onClick}
            size={size}
            width={width}
            className={cn('cursor-pointer bg-black/55', onClick && 'hover:border-white/40')}
        >
            <GICard.Header>
                <CardTitle sub={actionText || (injured ? 'Injured' : null)} subTone={actionText ? actionTone : (injured ? 'text-gi-danger' : 'text-gi-muted')}>{hero.name}</CardTitle>
            </GICard.Header>
            <GICard.Main className="justify-center">
                <div
                    className={cn(
                        'flex items-center justify-center transition-transform duration-100',
                        combatCardId && 'animate-bob',
                        attacking && 'translate-x-5 scale-110',
                        struck && 'animate-rattle'
                    )}
                    style={{ imageRendering: 'pixelated' }}
                >
                    <ItemIcon item={{ sprite: hero.spriteId, classId: hero.classId }} size={size === 'sm' ? 64 : 128} />
                </div>
            </GICard.Main>
        </GICard>
        <DamageFloaters floaters={floaters} />
    </div>
  );
};

/** The area deck drawn on the card frame — area scene behind, slot count on top. */
export const RowDeckCard = ({ areaArt, filled, total, hasHazard = false, onClick }) => {
  const { size, width } = useCardTier();
  return (
    <div className="shrink-0 flex flex-col items-center">
        <BadgeRow ids={deriveDeckBadgeIds({ hasHazard })} size={size} />
        <GICard imageSrc={null} intent="area" onClick={onClick} size={size} width={width} className={cn('bg-black/55', onClick && 'cursor-pointer hover:border-white/40')}>
            <GICard.Header>
                <CardTitle>Deck</CardTitle>
            </GICard.Header>
            <GICard.Main className="justify-center items-center gap-2">
                <Layers size={48} className="text-gi-primary drop-shadow" />
                <span className="text-xs font-bold text-white drop-shadow">{filled}/{total} slots</span>
                <span className="text-[9px] uppercase tracking-widest text-gi-muted">Configure</span>
            </GICard.Main>
        </GICard>
    </div>
  );
};

/** Empty card frame — Assign a Hero, No Station, or an empty upcoming slot.
 *  Carries a (usually empty) badge strip on top so it stays aligned with the
 *  badged cards in the same row. */
export const RowEmptyCard = ({ icon, label, sub, onClick, dragProps, dragOver, faded = false, badgeIds = [] }) => {
  const { size, width, height } = useCardTier();
  return (
    <div className="shrink-0 flex flex-col items-center">
      <BadgeRow ids={badgeIds} size={size} />
      <div
        onClick={onClick}
        {...dragProps}
        style={{ width, height }}
        className={cn(
            'rounded-xl border border-dashed flex flex-col items-center justify-center gap-2 text-center px-4 transition-colors',
            faded ? 'border-gi-border/40 bg-black/20 text-gi-muted/50' : 'border-gi-border bg-gi-base/30 text-gi-muted',
            onClick && 'cursor-pointer hover:text-gi-text hover:border-gi-primary/60',
            dragOver && 'border-gi-primary bg-gi-primary/15 text-gi-text'
        )}
      >
        {icon}
        <span className="text-[11px] font-bold uppercase tracking-wider">{label}</span>
        {sub && <span className="text-[9px] text-gi-muted normal-case">{sub}</span>}
      </div>
    </div>
  );
};

/** Locked hazard slot drawn on the card frame. */
export const RowHazardCard = ({ hazard, dimmed = true }) => {
  const { size, width } = useCardTier();
  return (
    <div className={cn('shrink-0 flex flex-col items-center', dimmed && 'opacity-60')}>
        <BadgeRow ids={['hazard']} size={size} />
        <GICard imageSrc={null} intent="combat" size={size} width={width}>
            <GICard.Header>
                <CardTitle sub="Environmental" tone="text-gi-danger">{hazard.type || 'Hazard'}</CardTitle>
            </GICard.Header>
            <GICard.Main className="justify-center items-center gap-2">
                <AlertTriangle size={48} className="text-gi-danger" />
                <span className="text-xs font-bold text-gi-danger">-{hazard.damagePerPass} HP / pass</span>
            </GICard.Main>
        </GICard>
    </div>
  );
};


/** Vertical divider separating a focus view's anchor card from its slots. */
export const FocusDivider = () => <div className="w-px self-stretch bg-white/15 mx-1 shrink-0" />;



export const SlotCard = ({ title, tone, onClick, selected, dropProps, innerRef, cueClass, children }) => {
    const { width, height } = useCardTier();
    return (
        <div
            ref={innerRef}
            onClick={onClick}
            {...dropProps}
            style={{ width, height }}
            className={cn(
                'shrink-0 rounded-xl border flex flex-col overflow-hidden transition-colors',
                selected ? 'border-gi-gold bg-gi-gold/10' : 'border-dashed border-gi-border bg-gi-base/30',
                onClick && 'cursor-pointer hover:border-gi-primary/60',
                cueClass
            )}
        >
            {title && (
                <div className="px-2 py-1 bg-black/30 border-b border-white/5 shrink-0">
                    <span className={cn('gi-card-title font-bold tracking-widest uppercase text-[10px] truncate block', tone || 'text-white')}>{title}</span>
                </div>
            )}
            <div className="flex-1 flex flex-col items-center justify-center gap-1 p-2 text-center min-h-0 overflow-hidden">
                {children}
            </div>
        </div>
    );
};

export const StatRow = ({ label, value }) => (
    <div className="flex items-center justify-between gap-2 w-full text-[9px]">
        <span className="text-gi-muted capitalize truncate">{label}</span>
        <span className="text-gi-text font-bold tabular-nums shrink-0">{value}</span>
    </div>
);



export const VitalBar = ({ label, value, max, barClass }) => (
    <div className="flex items-center gap-1.5">
        <span className="text-[9px] font-bold text-gi-muted w-5">{label}</span>
        <div className="flex-1 h-1.5 bg-black/50 rounded-full overflow-hidden">
            <div className={cn('h-full transition-all duration-300', barClass)} style={{ width: `${Math.min(100, (value / Math.max(1, max)) * 100)}%` }} />
        </div>
        <span className="text-[9px] text-gi-muted tabular-nums">{value}</span>
    </div>
);
