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
import { getRecipe, getRecipesBySubskill } from '../../../config/registries/recipeRegistry.js';
import { resolveSpritePath } from '../../../utils/AssetManager.js';
import { AREA_EVENTS } from '../../../systems/core/areaEvents.js';
import { getNativeDrag, readDropPayload } from '../../dnd/nativeDrag.js';
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
    X, Trash2, Plus, Lock, CheckCircle2, Shield, Package, Boxes
} from 'lucide-react';

/** Resolve a sprite path into a CSS url() for a mat background. */
const matBgUrl = (p) => (p ? `url(${p.startsWith('/') ? p : '/' + p})` : undefined);

/**
 * AreaBannerRow — one unlocked Area as a horizontal banner (concept §11).
 *
 * Layout (static pillars + flexible center, §11.A/B):
 *   [Control][Info][Hero] [ ... mode-dependent center ... ] [Station]
 *
 * The center is the 80/20 split banner (§11.C): the active mode's slice
 * holds the working UI, the inactive slice is a thin art strip that toggles
 * the mode when clicked.
 *
 * Reactivity (§2F): every subscription filters on this row's areaId; other
 * areas' events are ignored entirely. Progress animation is ref-driven
 * (§6D). Collapsed rows unmount all of this (§6E) — the parent renders
 * CollapsedRow instead.
 */

const STRUCTURAL_EVENTS = [
    AREA_EVENTS.STATUS_CHANGED,
    AREA_EVENTS.CARD_COMPLETED,
    AREA_EVENTS.DECK_UPDATED,
    AREA_EVENTS.HERO_CHANGED,
    AREA_EVENTS.MODE_SWITCHED,
    AREA_EVENTS.STATION_CHANGED,
    AREA_EVENTS.COMBAT_RESOLVED,
    AREA_EVENTS.CRAFT_COMPLETED
];

/** Structural snapshot of one area — primitive-ish so isEqual bails cheaply. */
function useAreaSnapshot(areaId) {
    return useGameState(
        state => {
            const a = state.areaStates?.[areaId];
            if (!a) return null;
            return {
                mode: a.mode,
                status: a.status,
                pausedReason: a.pausedReason || null,
                activeCardIndex: a.activeCardIndex,
                assignedHeroId: a.assignedHeroId,
                deckSig: (a.deckSlots || []).map(s => s.templateId || (s.hazard ? `hazard:${s.hazard.type}` : '_')).join(','),
                stationCardId: a.stationState?.activeStationCardId || null,
                stationStatus: a.stationState?.status || 'idle',
                selectedRecipeId: a.stationState?.selectedRecipeId || null,
                producedCount: a.stationState?.producedCount || 0,
                productionMode: a.stationState?.productionMode || 'infinite',
                productionLimit: a.stationState?.productionLimit || 0
            };
        },
        STRUCTURAL_EVENTS,
        data => !data?.areaId || data.areaId === areaId,
        { bypassClone: false }
    );
}

const STATUS_LABELS = {
    running: { label: 'Working', color: 'text-gi-success' },
    drawing: { label: 'Drawing…', color: 'text-gi-muted' },
    shuffling: { label: 'Shuffling…', color: 'text-gi-muted' },
    in_combat: { label: 'In Combat!', color: 'text-gi-danger' },
    injured: { label: 'Injured', color: 'text-gi-danger' },
    paused: { label: 'Paused', color: 'text-gi-muted' }
};

export const AreaBannerRow = ({ areaId, focus, onFocus, onCollapse }) => {
    const engine = useEngine();
    const snap = useAreaSnapshot(areaId);
    const areaSet = useMemo(() => getAreaSet(areaId), [areaId]);
    const { height: cardH } = useCardTier();

    if (!snap) return null;

    const isFocused = focus?.areaId === areaId;
    const isDimmed = focus && !isFocused;

    // Focus views replace the whole row body (§11.D — inline morphing). All three
    // compose from the shared FocusScaffold (mat + header + card slots).
    if (isFocused) {
        if (focus.mode === 'deck') return <DeckFocusRow areaId={areaId} onClose={() => onFocus(null)} />;
        if (focus.mode === 'equip') return <HeroFocusRow areaId={areaId} heroId={snap.assignedHeroId} onClose={() => onFocus(null)} />;
        if (focus.mode === 'recipe') return <StationFocusRow areaId={areaId} onClose={() => onFocus(null)} />;
        return null;
    }

    const wilds = snap.mode === 'adventure';

    return (
        <div className={cn(
            'relative rounded-xl border border-gi-border overflow-hidden transition-opacity duration-300',
            isDimmed && 'opacity-30 pointer-events-none'
        )}>
            {/* Full-width Area Banner "mat" — the static full-bleed art the row of
                cards sits on. Wilds art is the base; the Outpost art covers it when
                stationed (see AreaMat — sharp, full colour, no sliding split). */}
            <AreaMat areaId={areaId} stationed={!wilds} />

            {/* Floating UI layer — header band + card row, laid on the mat */}
            <div className="relative z-10 flex flex-col">
                <BannerHeader areaName={areaSet?.name || areaId} areaId={areaId} snap={snap} engine={engine} />
                <div className="flex items-end gap-4 px-3" style={{ height: cardH + BANNER_BADGE_ROW_H }}>
                <ControlPanel areaId={areaId} snap={snap} engine={engine} onCollapse={onCollapse} />
                <InfoPanel areaId={areaId} snap={snap} engine={engine} areaName={areaSet?.name || areaId} />
                <HeroSlotCell
                    areaId={areaId} snap={snap} engine={engine}
                    onOpenEquip={() => snap.assignedHeroId && onFocus({ areaId, mode: 'equip' })}
                />

                {/* Center: the active mode's UI, full-width. Switching between the
                       Wilds (Adventure) and Outpost (Stationed) views is driven by the
                       toggle in the header (see BannerHeader / ModeToggle). */}
                <div className="flex-1 flex items-stretch min-w-0">
                    {wilds ? (
                        <AdventureCenter areaId={areaId} snap={snap} engine={engine} onFocus={onFocus} />
                    ) : (
                        <StationCenter areaId={areaId} snap={snap} engine={engine} onFocus={onFocus} />
                    )}
                </div>

                <StationSlotCell areaId={areaId} snap={snap} engine={engine} onFocus={onFocus} />
                </div>

                {/* Footer band — slim strip of extra space, keeping the row the same
                    height as focus views (which use it for the long-list scroll bar).
                    Empty in the regular row; the mat art shows through. */}
                <div style={{ height: BANNER_FOOTER_H }} />
            </div>
        </div>
    );
};

// ----------------------------------------------------------------------
// Row cards — every row cell renders on the shared 220×256 card frame
// ----------------------------------------------------------------------

/** Card title styled to match the real cards' CardHeaderModule (gi-card-title). */
const CardTitle = ({ children, sub, tone = 'text-white' }) => (
    <div className="flex flex-col items-center gap-0.5 bg-black/30 px-2 py-1 rounded-lg border border-white/5 relative z-10">
        <span className={cn('gi-card-title font-bold tracking-widest uppercase text-center leading-tight truncate max-w-full', tone)}>
            {children}
        </span>
        {sub && <span className="text-[8px] uppercase tracking-widest text-gi-muted">{sub}</span>}
    </div>
);

/** A real card template (task/combat/consumable/station) drawn on the card frame.
 *  Reuses ActiveCardFace with a CardFactory mock, exactly like the pack reveal. */
const RowTemplateCard = ({ templateId, areaId, dimmed = false, onClick, title, dragProps }) => {
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
const RowHeroCard = ({ hero, areaArt, injured, vitals, onClick, dragProps, dragOver }) => {
  const { size, width } = useCardTier();
  return (
    <div {...dragProps} className={cn('shrink-0 flex flex-col items-center rounded-xl transition-shadow', dragOver && 'ring-2 ring-gi-primary')}>
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
                <CardTitle sub={injured ? 'Injured' : (hero.classId || 'Hero')}>{hero.name}</CardTitle>
            </GICard.Header>
            <GICard.Main className="justify-center">
                <div className="flex items-center justify-center" style={{ imageRendering: 'pixelated' }}>
                    <ItemIcon item={{ sprite: hero.spriteId, classId: hero.classId }} size={size === 'sm' ? 64 : 128} />
                </div>
            </GICard.Main>
            <div className="mt-auto z-40 bg-black/50 border-t border-white/10 px-3 py-2 flex flex-col gap-1">
                <VitalBar label="HP" value={vitals?.hp ?? 0} max={vitals?.hpMax ?? 100} barClass="bg-gi-danger" />
                <VitalBar label="EN" value={vitals?.energy ?? 0} max={vitals?.energyMax ?? 100} barClass="bg-gi-gold" />
            </div>
        </GICard>
    </div>
  );
};

/** The area deck drawn on the card frame — area scene behind, slot count on top. */
const RowDeckCard = ({ areaArt, filled, total, hasHazard = false, onClick }) => {
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
const RowEmptyCard = ({ icon, label, sub, onClick, dragProps, dragOver, faded = false, badgeIds = [] }) => {
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
const RowHazardCard = ({ hazard, dimmed = true }) => {
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

// ----------------------------------------------------------------------
// Deck Focus (§11.D.1) — the whole row becomes the deck's slots as full cards,
// on the same mat, so it reads like regular mode (owner decision 2026-07-09).
// ----------------------------------------------------------------------

const DeckFocusRow = ({ areaId, onClose }) => {
    const engine = useEngine();
    const areaSet = getAreaSet(areaId);
    const areaArt = areaSet?.areaArt ? resolveSpritePath(areaSet.areaArt) : null;

    // Re-render on deck changes for this area.
    useGameState(
        state => (state.areaStates?.[areaId]?.deckSlots || []).map(s => s.templateId || (s.hazard ? 'hz' : '_')).join(','),
        [AREA_EVENTS.DECK_UPDATED, AREA_EVENTS.STATS_DIRTY],
        data => !data?.areaId || data.areaId === areaId
    );
    const slots = engine.GameState.areaStates?.[areaId]?.deckSlots || [];
    const filledCount = slots.filter(s => s.templateId || s.hazard).length;
    const hasHazard = slots.some(s => s.hazard);

    const dropOnSlot = (index, e) => {
        e.preventDefault();
        const payload = readDropPayload(e);
        if (payload?.kind === 'card' && payload.cardType !== 'station') {
            const r = engine.DeckSlotManager.slotCard(areaId, index, payload.templateId);
            if (!r.success) engine.EventBus.publish('ui:notify', { message: r.error || 'Card rejected', type: 'error' });
        }
    };

    return (
        <FocusScaffold areaId={areaId} title={`${areaSet?.name || areaId} — Deck`} onClose={onClose}>
            {/* Anchor card — the Deck this view configures */}
            <RowDeckCard areaArt={areaArt} filled={filledCount} total={slots.length} hasHazard={hasHazard} />
            <FocusDivider />
            {slots.map((slot, i) => (
                <DeckFocusSlot key={i} areaId={areaId} slot={slot} index={i} engine={engine} onDropHere={e => dropOnSlot(i, e)} />
            ))}
            {slots.length === 0 && (
                <span className="text-[11px] text-gi-muted italic px-3">This area has no deck slots.</span>
            )}
        </FocusScaffold>
    );
};

/** Vertical divider separating a focus view's anchor card from its slots. */
const FocusDivider = () => <div className="w-px self-stretch bg-white/15 mx-1 shrink-0" />;

const DeckFocusSlot = ({ areaId, slot, index, engine, onDropHere }) => {
    const template = slot.templateId ? getCard(slot.templateId) : null;

    // Environmental hazard / locked slot — part of the area, not editable.
    if (slot.hazard) return <RowHazardCard hazard={slot.hazard} dimmed={false} />;
    if (slot.isLocked) return <RowEmptyCard icon={<Lock size={28} />} label={`Slot ${index + 1}`} sub="Locked" faded />;

    // Filled slot — the card with a remove button.
    if (template) {
        return (
            <div className="relative shrink-0" onDragOver={e => e.preventDefault()} onDrop={onDropHere}>
                <RowTemplateCard templateId={slot.templateId} areaId={areaId} />
                <button
                    onClick={() => engine.DeckSlotManager.unslotCard(areaId, index)}
                    title="Remove from deck"
                    className="absolute top-1 right-1 z-20 p-1 rounded-full bg-black/60 text-gi-muted hover:text-gi-danger hover:bg-black/80 transition-colors"
                >
                    <Trash2 size={14} />
                </button>
            </div>
        );
    }

    // Empty slot — drop target + click to open the Cards drawer.
    return (
        <div onDragOver={e => e.preventDefault()} onDrop={onDropHere} className="shrink-0">
            <RowEmptyCard
                icon={<Plus size={28} />}
                label={`Slot ${index + 1}`}
                sub={slot.specializedTags?.length ? `${slot.specializedTags.join(', ')} only` : 'Add a card'}
                onClick={() => engine.EventBus.publish('ui:open_drawer', { tab: 'cards', filter: { deckSlot: { areaId, index } } })}
            />
        </div>
    );
};

/** Generic card-sized frame (empty-slot styling) for focus-view content cards. */
const SlotCard = ({ title, tone, onClick, selected, dropProps, children }) => {
    const { width, height } = useCardTier();
    return (
        <div
            onClick={onClick}
            {...dropProps}
            style={{ width, height }}
            className={cn(
                'shrink-0 rounded-xl border flex flex-col overflow-hidden transition-colors',
                selected ? 'border-gi-gold bg-gi-gold/10' : 'border-dashed border-gi-border bg-gi-base/30',
                onClick && 'cursor-pointer hover:border-gi-primary/60'
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

const StatRow = ({ label, value }) => (
    <div className="flex items-center justify-between gap-2 w-full text-[9px]">
        <span className="text-gi-muted capitalize truncate">{label}</span>
        <span className="text-gi-text font-bold tabular-nums shrink-0">{value}</span>
    </div>
);

// ----------------------------------------------------------------------
// Hero (Equip) Focus — anchor Hero card + Stats card + gear slots (§11.D.2),
// composed from the shared FocusScaffold so it matches Deck focus.
// ----------------------------------------------------------------------

const GEAR_SLOTS = ['weapon', 'armor', 'food', 'drink'];

const HeroFocusRow = ({ areaId, heroId, onClose }) => {
    const engine = useEngine();
    const { size } = useCardTier();
    const hero = useGameState(
        state => state.heroes?.find(h => h.id === heroId) || null,
        ['heroes_updated', 'hero_equipment_changed'],
        null,
        { deps: [heroId] }
    );
    if (!hero) {
        return <FocusScaffold areaId={areaId} title="Hero" onClose={onClose}><span className="text-[11px] text-gi-muted italic px-3">No hero assigned.</span></FocusScaffold>;
    }

    const vitals = {
        hp: Math.round(hero.hp?.current ?? 0), hpMax: hero.hp?.max ?? 100,
        energy: Math.round(hero.energy?.current ?? 0), energyMax: hero.energy?.max ?? 100
    };
    const skills = Object.entries(hero.skills || {}).filter(([, s]) => (s?.level ?? 1) > 1).slice(0, 5);
    const equipDrop = (e) => {
        e.preventDefault();
        const payload = readDropPayload(e);
        if (payload?.kind === 'item') engine.EquipmentManager.equipItem(heroId, payload.itemId);
    };

    return (
        <FocusScaffold areaId={areaId} title={`${hero.name} — Hero`} onClose={onClose}>
            {/* Anchor: the hero card */}
            <RowHeroCard hero={hero} areaArt={null} injured={hero.status === 'wounded'} vitals={vitals} />
            <FocusDivider />
            {/* Stats card */}
            <SlotCard title="Stats">
                <StatRow label="Health" value={`${vitals.hp}/${vitals.hpMax}`} />
                <StatRow label="Energy" value={`${vitals.energy}/${vitals.energyMax}`} />
                {skills.map(([id, s]) => <StatRow key={id} label={id} value={`Lv ${s.level}`} />)}
                <button
                    onClick={() => { engine.HeroAssignmentManager.unassignHero(areaId); onClose(); }}
                    className="mt-1 px-2 py-0.5 rounded border border-gi-border text-[8px] font-bold uppercase text-gi-muted hover:text-gi-danger hover:border-gi-danger transition-colors"
                >
                    Unassign
                </button>
            </SlotCard>
            <FocusDivider />
            {/* Gear slots — click to unequip, drop items from the Bank drawer */}
            {GEAR_SLOTS.map(slot => {
                const itemId = hero.equipment?.[slot];
                const item = itemId ? getItem(itemId) : null;
                return (
                    <SlotCard
                        key={slot}
                        title={slot}
                        onClick={itemId ? () => engine.EquipmentManager.unequipItem(heroId, slot) : undefined}
                        dropProps={{ onDragOver: e => { if (getNativeDrag()?.kind === 'item') e.preventDefault(); }, onDrop: equipDrop }}
                    >
                        {item ? (
                            <>
                                <ItemIcon item={item} size={size === 'sm' ? 32 : 64} />
                                <span className="text-[9px] text-gi-text font-bold truncate max-w-full">{item.name}</span>
                                <span className="text-[8px] text-gi-muted">click to unequip</span>
                            </>
                        ) : (
                            <>
                                <Plus size={size === 'sm' ? 18 : 26} className="text-gi-muted" />
                                <span className="text-[8px] text-gi-muted">empty</span>
                            </>
                        )}
                    </SlotCard>
                );
            })}
        </FocusScaffold>
    );
};

// ----------------------------------------------------------------------
// Station (Recipe) Focus — anchor Station card + recipe cards (§11.D.3).
// ----------------------------------------------------------------------

const StationFocusRow = ({ areaId, onClose }) => {
    const engine = useEngine();
    const { size } = useCardTier();
    useGameState(
        state => state.areaStates?.[areaId]?.stationState?.selectedRecipeId || null,
        [AREA_EVENTS.STATION_CHANGED],
        data => !data?.areaId || data.areaId === areaId
    );
    const areaState = engine.GameState.areaStates?.[areaId];
    const stationId = areaState?.stationState?.activeStationCardId;
    const template = stationId ? getCard(stationId) : null;

    if (!template) {
        return <FocusScaffold areaId={areaId} title="Station" onClose={onClose}><span className="text-[11px] text-gi-muted italic px-3">No station built here — claim one from a Booster Pack and build it via the Collection Binder.</span></FocusScaffold>;
    }

    const skillCap = template.config?.skillCap || 90;
    const recipes = template.hasCraftingQueue
        ? getRecipesBySubskill(template.config?.recipeGroup).filter(r => (r.levelRequirement || 0) <= skillCap)
        : [];
    const selectedId = areaState?.stationState?.selectedRecipeId;

    return (
        <FocusScaffold areaId={areaId} title={`${template.name} — Station`} onClose={onClose}>
            {/* Anchor: the station card */}
            <RowTemplateCard templateId={stationId} areaId={areaId} />
            <FocusDivider />
            {!template.hasCraftingQueue && (
                <span className="text-[10px] text-gi-muted italic self-center px-2 max-w-[12rem]">
                    No crafting queue{template.passiveBuff ? ' — its passive buff is always active while built.' : '.'}
                </span>
            )}
            {recipes.map(recipe => {
                const output = recipe.outputs?.[0];
                const outputItem = output ? getItem(output.itemId || output.id) : null;
                const isSelected = recipe.id === selectedId;
                return (
                    <SlotCard
                        key={recipe.id}
                        title={outputItem?.name || recipe.name}
                        tone={isSelected ? 'text-gi-gold' : 'text-white'}
                        selected={isSelected}
                        onClick={() => engine.StationSlotManager.selectRecipe(areaId, recipe.id)}
                    >
                        {outputItem && <ItemIcon item={outputItem} size={size === 'sm' ? 32 : 64} />}
                        <span className="text-[8px] text-gi-muted">Lv {recipe.levelRequirement || 1} · {((recipe.baseTickTime || 10000) / 1000).toFixed(1)}s</span>
                        {isSelected && <CheckCircle2 size={12} className="text-gi-gold" />}
                    </SlotCard>
                );
            })}
            {template.hasCraftingQueue && recipes.length === 0 && (
                <span className="text-[10px] text-gi-muted italic self-center px-2">No recipes known for this station.</span>
            )}
        </FocusScaffold>
    );
};

// ----------------------------------------------------------------------
// Banner header — full-width band on the mat: area name (left) + the active
// card's task progress bar, aligned to sit directly above the active card.
// ----------------------------------------------------------------------

const CONTROL_W = 40;   // ControlPanel w-10
const HERO_PAD = 16;    // HeroSlotCell wrapper px-2
const CENTER_PAD = 8;   // AdventureCenter px-2 (left)

/** Descriptor verb for a task (e.g. "Swimming…"), mirroring TaskStage. */
const taskVerbFor = (card, template, status) => {
    if (status === 'shuffling') return 'Shuffling…';
    if (status === 'drawing') return 'Drawing…';
    if (status === 'in_combat') return 'Fighting…';
    const skillId = card?.skill || template?.config?.skill || template?.skill;
    let verb = TASK_VERBS[skillId?.toLowerCase()];
    if (!verb) {
        const category = card?.taskCategory || template?.config?.taskCategory || 'Working';
        verb = category.charAt(0).toUpperCase() + category.slice(1);
    }
    return `${verb}…`;
};

/**
 * The on-card ProgressBar module, relocated to the header: the animated bar
 * (driven by `area:progress`, incl. draw/shuffle) plus the descriptor + task
 * time row (`base > modified`, colored), matching TaskStage 1:1.
 */
const HeaderTaskProgress = ({ areaId, color, activeCard, activeTemplate, status }) => {
    const [pct, setPct] = useState(0);
    useEffect(() => {
        const unsub = EventBus.subscribe(AREA_EVENTS.PROGRESS, (d) => {
            if (d?.areaId === areaId) setPct(d.percent);
        });
        return unsub;
    }, [areaId]);

    const descriptor = taskVerbFor(activeCard, activeTemplate, status);
    const missing = activeCard?.missingRequirements?.[0];
    const isWorking = status === 'running' || status === 'in_combat';
    const durationMs = activeCard?.baseTickTime || activeTemplate?.baseTickTime || activeTemplate?.config?.baseTickTime || 0;
    const currentMs = activeCard?.currentTickTime || durationMs;
    const showTime = durationMs > 0 && status !== 'drawing' && status !== 'shuffling';

    return (
        <div className="w-full bg-black/40 rounded-lg border border-white/10 px-2 py-1.5">
            <ProgressBar current={pct} max={100} color={color || 'task'} size="md" showText={false} />
            <div className="flex justify-between items-center text-gray-500 font-pixel mt-1 gi-description tracking-wide gap-2">
                <span
                    className={cn('text-pixel-base truncate', missing ? 'text-yellow-400' : (isWorking ? 'text-green-400' : 'text-gray-400'))}
                    style={{ textShadow: 'var(--text-shadow-base)' }}
                >
                    {missing ? `Needs ${missing.replace(/^(Empty|Invalid)\s(Slot|Item):\s*/i, '')}` : descriptor}
                </span>
                {showTime && (
                    <span className="text-pixel-base text-gray-400 shrink-0">
                        {Math.floor(durationMs / 1000)}<span className="text-pixel-sm">s</span> &gt; <span className={cn(
                            currentMs < durationMs ? 'text-green-400' : currentMs > durationMs ? 'text-red-400' : 'text-gray-400'
                        )}>
                            {Math.round(currentMs / 100) / 10}<span className="text-pixel-sm">s</span>
                        </span>
                    </span>
                )}
            </div>
        </div>
    );
};

// Header band: area name (left) + the Wilds/Outpost view toggle (right). The
// task progress bar lives in the AdventureCenter, floated directly above the
// active card (see below) so it always tracks the card regardless of spacing.
const BannerHeader = ({ areaName, areaId, snap, engine }) => (
    <div className="relative z-10 flex items-center justify-between gap-3 h-14 px-3">
        <span className="gi-card-title font-bold text-white tracking-widest uppercase truncate">{areaName}</span>
        <ModeToggle areaId={areaId} snap={snap} engine={engine} />
    </div>
);

/**
 * ModeToggle — the header control that switches an area between its two views:
 * the Wilds (Adventure) and the Outpost (Stationed). A segmented toggle; the
 * active view is highlighted. Either view can be selected freely — the Outpost
 * is viewable even with no station built or no hero assigned (owner request
 * 2026-07-10); those states just show the relevant empty cards. Transient blocks
 * (mid-combat, injured) are surfaced by ModeManager as warning toasts.
 */
const ModeToggle = ({ areaId, snap, engine }) => {
    const wilds = snap.mode === 'adventure';
    const goWilds = () => { if (!wilds) engine.ModeManager.toggleMode(areaId); };
    const goOutpost = () => { if (wilds) engine.ModeManager.toggleMode(areaId); };

    const segClass = (active, extra) => cn(
        'flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors',
        active ? 'text-white' : 'text-gi-muted hover:text-gi-text',
        extra
    );

    return (
        <div className="shrink-0 flex items-center rounded-md border border-white/15 bg-black/40 overflow-hidden">
            <button
                onClick={goWilds}
                title="Wilds — head into the Wilds (Adventure)"
                className={segClass(wilds, wilds && 'bg-gi-primary/25')}
            >
                <Sword size={12} /> Wilds
            </button>
            <button
                onClick={goOutpost}
                title="Outpost — retreat to the Outpost (Stationed)"
                className={segClass(!wilds, cn('border-l border-white/15', !wilds && 'bg-gi-gold/25'))}
            >
                <Hammer size={12} /> Outpost
            </button>
        </div>
    );
};

/** Skill/task color for the active card's progress bar. */
const progressColorFor = (template) =>
    template ? (template.skill || template.config?.skill || template.taskCategory || 'task') : 'primary';

// ----------------------------------------------------------------------
// Static pillars
// ----------------------------------------------------------------------

const ControlPanel = ({ areaId, snap, engine, onCollapse }) => {
    const manuallyPaused = snap.pausedReason === 'manual';
    const canToggleRun = snap.mode === 'adventure' && snap.status !== 'injured' && snap.assignedHeroId;

    const handleRunToggle = () => {
        if (manuallyPaused) engine.LoopRunner.resumeArea(areaId);
        else engine.LoopRunner.pauseArea(areaId);
    };

    return (
        <div className="w-10 shrink-0 self-stretch flex flex-col items-center justify-center gap-2 bg-black/35 border-r border-white/5">
            <button
                onClick={handleRunToggle}
                disabled={!canToggleRun}
                title={manuallyPaused ? 'Start the loop' : 'Stop the loop'}
                className={cn(
                    'p-1.5 rounded border transition-colors',
                    !canToggleRun ? 'border-gi-border/40 text-gi-muted/40 cursor-not-allowed'
                        : manuallyPaused ? 'border-gi-success/50 text-gi-success hover:bg-gi-success/10'
                            : 'border-gi-border text-gi-text hover:border-gi-danger hover:text-gi-danger'
                )}
            >
                {manuallyPaused ? <Play size={13} /> : <Pause size={13} />}
            </button>
            <button
                onClick={onCollapse}
                title="Hide this area"
                className="p-1.5 rounded border border-gi-border text-gi-muted hover:text-gi-text transition-colors"
            >
                <ChevronUp size={13} />
            </button>
        </div>
    );
};

const STATUS_ICONS = {
    running: <Play size={30} className="text-gi-success" />,
    in_combat: <Sword size={30} className="text-gi-danger" />,
    drawing: <Hourglass size={30} className="text-gi-muted animate-pulse" />,
    shuffling: <Layers size={30} className="text-gi-muted animate-pulse" />,
    injured: <Skull size={30} className="text-gi-danger" />,
    paused: <Pause size={30} className="text-gi-muted" />
};

// Info card — the area's live operational status, on the shared card frame
// (empty-slot styling). Vitals moved to the Hero card (owner decision 2026-07-09).
const InfoPanel = ({ areaId, snap, engine }) => {
    const { size, width, height } = useCardTier();
    const statusInfo = snap.mode === 'stationed'
        ? (snap.status === 'injured'
            ? STATUS_LABELS.injured
            : { crafting: { label: 'Crafting', color: 'text-gi-gold' }, paused_no_inputs: { label: 'No materials', color: 'text-gi-danger' }, paused_limit_reached: { label: 'Order complete', color: 'text-gi-success' }, idle: { label: 'Idle at Outpost', color: 'text-gi-muted' } }[snap.stationStatus] || STATUS_LABELS.paused)
        : (STATUS_LABELS[snap.status] || STATUS_LABELS.paused);
    const energyPaused = snap.pausedReason === 'energy';
    const label = energyPaused ? 'Exhausted' : statusInfo.label;
    const icon = STATUS_ICONS[energyPaused ? 'paused' : snap.status] || STATUS_ICONS.paused;

    return (
        <div className="shrink-0 flex flex-col items-center">
            <BadgeRow ids={[]} size={size} />
            <div
                style={{ width, height }}
                className="rounded-xl border border-dashed border-gi-border bg-gi-base/30 flex flex-col items-center justify-center gap-2 text-center px-4"
            >
                {icon}
                <span className={cn('gi-card-title font-bold tracking-widest uppercase leading-tight', statusInfo.color)}>{label}</span>
                <span className="text-[9px] text-gi-muted normal-case">
                    {snap.assignedHeroId ? (energyPaused ? 'Waiting for energy' : 'Status') : 'No hero assigned'}
                </span>
            </div>
        </div>
    );
};

const VitalBar = ({ label, value, max, barClass }) => (
    <div className="flex items-center gap-1.5">
        <span className="text-[9px] font-bold text-gi-muted w-5">{label}</span>
        <div className="flex-1 h-1.5 bg-black/50 rounded-full overflow-hidden">
            <div className={cn('h-full transition-all duration-300', barClass)} style={{ width: `${Math.min(100, (value / Math.max(1, max)) * 100)}%` }} />
        </div>
        <span className="text-[9px] text-gi-muted tabular-nums">{value}</span>
    </div>
);

const HeroSlotCell = ({ areaId, snap, engine, onOpenEquip }) => {
    const hero = snap.assignedHeroId ? engine.HeroManager.getHero(snap.assignedHeroId) : null;
    const [dragOver, setDragOver] = useState(false);
    const areaArt = useMemo(() => {
        const as = getAreaSet(areaId);
        return as?.areaArt ? resolveSpritePath(as.areaArt) : null;
    }, [areaId]);

    const vitals = useGameState(
        state => {
            const h = snap.assignedHeroId ? state.heroes?.find(h => h.id === snap.assignedHeroId) : null;
            if (!h) return null;
            return {
                hp: Math.round(h.hp?.current ?? 0), hpMax: h.hp?.max ?? 100,
                energy: Math.round(h.energy?.current ?? 0), energyMax: h.energy?.max ?? 100
            };
        },
        ['heroes_updated'],
        null,
        { deps: [snap.assignedHeroId] }
    );

    // Drop target (Phase 7): heroes assign/swap; items equip the assigned hero.
    const acceptsDrag = () => {
        const drag = getNativeDrag();
        return drag?.kind === 'hero' || (drag?.kind === 'item' && !!snap.assignedHeroId);
    };
    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        const payload = readDropPayload(e);
        if (payload?.kind === 'hero') {
            engine.HeroAssignmentManager.assignHeroToArea(payload.heroId, areaId);
        } else if (payload?.kind === 'item' && snap.assignedHeroId) {
            engine.EquipmentManager.equipItem(snap.assignedHeroId, payload.itemId);
        }
    };
    const dragProps = {
        onDragOver: e => { if (acceptsDrag()) { e.preventDefault(); setDragOver(true); } },
        onDragLeave: () => setDragOver(false),
        onDrop: handleDrop
    };

    if (hero) {
        return (
            <div className="shrink-0 flex items-center">
                <RowHeroCard
                    hero={hero}
                    areaArt={areaArt}
                    injured={snap.status === 'injured' || hero.status === 'wounded'}
                    vitals={vitals}
                    onClick={onOpenEquip}
                    dragProps={dragProps}
                    dragOver={dragOver}
                />
            </div>
        );
    }
    return (
        <div className="shrink-0 flex items-center px-2">
            <RowEmptyCard
                icon={<User size={28} />}
                label="Assign Hero"
                sub="Drag a hero here, or open the Heroes drawer"
                onClick={() => engine.EventBus.publish('ui:open_drawer', { tab: 'heroes' })}
                dragProps={dragProps}
                dragOver={dragOver}
            />
        </div>
    );
};

const StationSlotCell = ({ areaId, snap, engine, onFocus }) => {
    const template = snap.stationCardId ? getCard(snap.stationCardId) : null;
    const [dragOver, setDragOver] = useState(false);

    // Drop target (Phase 7): station cards from the drawer build here.
    const acceptsDrag = () => getNativeDrag()?.kind === 'card' && getNativeDrag()?.cardType === 'station';
    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        const payload = readDropPayload(e);
        if (payload?.kind === 'card' && payload.cardType === 'station') {
            const result = engine.StationSlotManager.slotStation(areaId, payload.templateId);
            if (!result.success) console.warn('[Banner] Station drop rejected:', result.error);
        }
    };
    const dragProps = {
        onDragOver: e => { if (acceptsDrag()) { e.preventDefault(); setDragOver(true); } },
        onDragLeave: () => setDragOver(false),
        onDrop: handleDrop
    };

    if (template) {
        return (
            <div className="shrink-0 flex items-center">
                <RowTemplateCard
                    templateId={snap.stationCardId}
                    areaId={areaId}
                    title={`${template.name} — recipes & settings (Recipe Focus)`}
                    onClick={() => onFocus({ areaId, mode: 'recipe' })}
                    dragProps={dragProps}
                />
            </div>
        );
    }
    return (
        <div className="shrink-0 flex items-center px-2 border-l border-gi-border/50">
            <RowEmptyCard
                icon={<Hammer size={28} />}
                label="No Station"
                sub="Drag a station card here, or open the Cards drawer"
                onClick={() => engine.EventBus.publish('ui:open_drawer', {
                    tab: 'cards',
                    filter: { cardType: 'station', deployFilter: 'available' }
                })}
                dragProps={dragProps}
                dragOver={dragOver}
            />
        </div>
    );
};

// ----------------------------------------------------------------------
// Adventure center: Active Card + Upcoming Track + Deck Button (§11.B.1)
// ----------------------------------------------------------------------

const AdventureCenter = ({ areaId, snap, engine, onFocus }) => {
    const areaState = engine.GameState.areaStates?.[areaId];
    const slots = areaState?.deckSlots || [];
    const activeSlot = slots[snap.activeCardIndex];
    const activeCard = engine.LoopRunner.getActiveCardForArea(areaId);
    const activeTemplate = activeSlot?.templateId ? getCard(activeSlot.templateId) : null;
    const areaArt = useMemo(() => {
        const as = getAreaSet(areaId);
        return as?.areaArt ? resolveSpritePath(as.areaArt) : null;
    }, [areaId]);

    const filledCount = slots.filter(s => s.templateId || s.hazard).length;
    const hasHazard = slots.some(s => s.hazard);

    return (
        <div className="relative h-full flex items-end gap-4 min-w-0">
            {/* Active card — full-fidelity card face (§11.B.1) */}
            <div className="relative shrink-0 flex flex-col">
                {/* Task progress module — floats directly above the active card, up into
                    the header band. Tracks the card's x regardless of gaps/sizing. */}
                <div className="absolute left-0 right-0 bottom-full pb-1 px-0.5 z-20 pointer-events-none">
                    <HeaderTaskProgress
                        areaId={areaId}
                        color={progressColorFor(activeTemplate)}
                        activeCard={activeCard}
                        activeTemplate={activeTemplate}
                        status={snap.status}
                    />
                </div>
                <ActiveCardCell
                    areaId={areaId} snap={snap}
                    activeCard={activeCard} activeSlot={activeSlot} activeTemplate={activeTemplate}
                />
            </div>

            {/* Upcoming preview cards are disabled for now (owner decision 2026-07-09):
                they were causing size/alignment drift; will return as a
                responsive, no-scroll bonus for extra-wide views only. */}

            {/* Area deck card */}
            <RowDeckCard
                areaArt={areaArt}
                filled={filledCount}
                total={slots.length}
                hasHazard={hasHazard}
                onClick={() => onFocus({ areaId, mode: 'deck' })}
            />
        </div>
    );
};

const ActiveCardCell = ({ areaId, snap, activeCard, activeSlot, activeTemplate }) => {
    const { size, width } = useCardTier();
    // Real card executing / fighting / consuming → full-fidelity card face (§11.B.1).
    // The task progress bar now lives in the banner header, above this card.
    if ((snap.status === 'running' || snap.status === 'in_combat') && activeCard && activeTemplate) {
        return (
            <div className="flex flex-col items-center">
                <BadgeRow ids={deriveCardBadgeIds(activeTemplate, activeCard)} size={size} />
                <ActiveCardFace
                    cardId={activeCard.id}
                    cardState={activeCard}
                    template={activeTemplate}
                    isHovered={false}
                    showActions={false}
                    size={size}
                    width={width}
                />
            </div>
        );
    }

    // Active hazard slot → hazard card (still a full card space).
    if (snap.status === 'running' && activeSlot?.hazard) {
        return <RowHazardCard hazard={activeSlot.hazard} dimmed={false} />;
    }

    // Idle / transition states → a full card-sized blank slot with the status,
    // so the slot never shrinks to a badge and nothing else reflows.
    const idleMap = {
        drawing: { icon: <Hourglass size={30} className="text-gi-muted animate-pulse" />, label: 'Drawing…', sub: 'Next card' },
        shuffling: { icon: <Layers size={30} className="text-gi-muted animate-pulse" />, label: 'Shuffling…', sub: 'Loop restarting' },
        injured: { icon: <Skull size={30} className="text-gi-danger" />, label: 'Injured', sub: 'Recovering at the Outpost' },
        paused: { icon: <Pause size={30} className="text-gi-muted" />, label: 'Paused', sub: snap.pausedReason === 'energy' ? 'Waiting for energy' : (snap.assignedHeroId ? 'Press start' : 'Assign a hero') }
    };
    const info = idleMap[snap.status] || idleMap.paused;
    return <RowEmptyCard icon={info.icon} label={info.label} sub={info.sub} faded />;
};

// ----------------------------------------------------------------------
// Station center: Output + Controls + Inputs (§11.B.2)
// ----------------------------------------------------------------------

const StationCenter = ({ areaId, snap, engine, onFocus }) => {
    const recipe = snap.selectedRecipeId ? getRecipe(snap.selectedRecipeId) : null;

    if (!snap.stationCardId) {
        return (
            <div className="relative h-full flex items-center min-w-0 px-3 py-2">
                <RowEmptyCard
                    icon={<Hammer size={40} />}
                    label="No Station"
                    sub="Claim one from a Booster Pack and build it in the Collection Binder."
                />
            </div>
        );
    }

    return (
        <div className="relative h-full flex items-end gap-4 min-w-0">
            <StationOutputCard areaId={areaId} snap={snap} recipe={recipe} onFocus={onFocus} />
            <StationControlsCard areaId={areaId} snap={snap} recipe={recipe} engine={engine} />
            <StationInputsCard recipe={recipe} engine={engine} />
        </div>
    );
};

/** Output slot card — the recipe's product; click opens Recipe Focus (§11.B.2). */
const StationOutputCard = ({ areaId, snap, recipe, onFocus }) => {
    const { size, width } = useCardTier();
    const output = recipe?.outputs?.[0];
    const outputItem = output ? getItem(output.itemId || output.id) : null;
    const iconSize = size === 'sm' ? 64 : 128;
    const crafting = snap.stationStatus === 'crafting';
    return (
        <GICard
            imageSrc={null} intent="area" onClick={() => onFocus({ areaId, mode: 'recipe' })}
            size={size} width={width}
            className="shrink-0 cursor-pointer bg-black/55 hover:border-gi-gold"
            title="Choose recipe (Recipe Focus)"
        >
            <GICard.Header>
                <CardTitle sub="Output">{recipe ? (outputItem?.name || recipe.name) : 'Recipe'}</CardTitle>
            </GICard.Header>
            <GICard.Main className="justify-center items-center gap-2">
                {recipe ? (
                    <>
                        <div className="flex items-center justify-center" style={{ imageRendering: 'pixelated' }}>
                            {outputItem
                                ? <ItemIcon item={outputItem} size={iconSize} />
                                : <Package size={iconSize} className="text-gi-gold" />}
                        </div>
                        <span className="text-[9px] uppercase tracking-widest text-gi-muted">
                            Crafted: {snap.producedCount}{output?.quantity > 1 ? ` · ×${output.quantity}/craft` : ''}
                        </span>
                    </>
                ) : (
                    <>
                        <Package size={iconSize} className="text-gi-muted/50" />
                        <span className="text-[10px] uppercase tracking-widest text-gi-muted">Select a recipe</span>
                    </>
                )}
            </GICard.Main>
            {recipe && crafting && (
                <div className="mt-auto z-40 bg-black/50 border-t border-white/10 px-3 py-2">
                    <RefProgressBar areaId={areaId} color="var(--color-gi-gold)" />
                </div>
            )}
        </GICard>
    );
};

/** Production controls card — infinite/limited run count (§11.B.2). */
const StationControlsCard = ({ areaId, snap, recipe, engine }) => {
    const { size, width } = useCardTier();
    const [limitDraft, setLimitDraft] = useState(String(snap.productionLimit || 10));
    const limited = snap.productionMode === 'limited';
    const commitLimit = () => engine.StationSlotManager.setProductionMode(areaId, 'limited', parseInt(limitDraft, 10) || 0);
    return (
        <GICard imageSrc={null} intent="area" size={size} width={width} className="shrink-0 bg-black/55">
            <GICard.Header>
                <CardTitle sub="Repeat">Production</CardTitle>
            </GICard.Header>
            <GICard.Main className="justify-center items-stretch gap-2 px-3">
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={() => engine.StationSlotManager.setProductionMode(areaId, 'infinite')}
                        title="Craft forever"
                        className={cn('flex-1 py-1.5 rounded border text-[10px] font-bold uppercase flex items-center justify-center gap-1 transition-colors',
                            !limited ? 'border-gi-gold/60 bg-gi-gold/15 text-gi-text' : 'border-gi-border text-gi-muted hover:text-gi-text')}
                    >
                        <InfinityIcon size={13} />
                    </button>
                    <button
                        onClick={commitLimit}
                        title="Craft a set amount"
                        className={cn('flex-1 py-1.5 rounded border text-[10px] font-bold uppercase transition-colors',
                            limited ? 'border-gi-gold/60 bg-gi-gold/15 text-gi-text' : 'border-gi-border text-gi-muted hover:text-gi-text')}
                    >
                        Limit
                    </button>
                </div>
                <div className="flex flex-col gap-1">
                    <span className="text-[8px] uppercase tracking-widest text-gi-muted">Run count</span>
                    <input
                        type="number" min="1" value={limitDraft}
                        onChange={e => setLimitDraft(e.target.value)}
                        onFocus={() => !limited && engine.StationSlotManager.setProductionMode(areaId, 'limited', parseInt(limitDraft, 10) || 0)}
                        onBlur={() => limited && commitLimit()}
                        className={cn('w-full bg-black/40 border rounded px-2 py-1 text-[12px] text-center text-gi-text outline-none tabular-nums transition-colors',
                            limited ? 'border-gi-gold/60' : 'border-gi-border opacity-60')}
                    />
                    {limited && (
                        <span className="text-[8px] uppercase tracking-widest text-gi-muted text-center">{snap.producedCount}/{snap.productionLimit} done</span>
                    )}
                </div>
                {recipe && (
                    <span className="text-[9px] text-gi-muted text-center mt-1">{((recipe.baseTickTime || 10000) / 1000).toFixed(1)}s / craft</span>
                )}
            </GICard.Main>
        </GICard>
    );
};

/** Input displays card — the recipe's ingredients with live bank counts (§11.B.2). */
const StationInputsCard = ({ recipe, engine }) => {
    const { size, width } = useCardTier();
    const inputs = (recipe?.inputs || []).slice(0, 6);
    return (
        <GICard imageSrc={null} intent="area" size={size} width={width} className="shrink-0 bg-black/55">
            <GICard.Header>
                <CardTitle sub="Materials">Inputs</CardTitle>
            </GICard.Header>
            <GICard.Main className="justify-center gap-1.5 px-2">
                {recipe ? (
                    inputs.length > 0 ? (
                        <div className="flex flex-col gap-1">
                            {inputs.map((input, i) => <InputChip key={i} input={input} engine={engine} />)}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-1 text-gi-muted">
                            <Boxes size={40} className="text-gi-muted/50" />
                            <span className="text-[9px] uppercase tracking-widest">No materials needed</span>
                        </div>
                    )
                ) : (
                    <div className="flex flex-col items-center gap-1 text-gi-muted">
                        <Boxes size={40} className="text-gi-muted/50" />
                        <span className="text-[9px] uppercase tracking-widest">No recipe selected</span>
                    </div>
                )}
            </GICard.Main>
        </GICard>
    );
};

const InputChip = ({ input, engine }) => {
    const itemId = input.itemId || input.id || null;
    const item = itemId ? getItem(itemId) : null;
    const label = item?.name || (input.tag ? `Any ${input.tag}` : '?');
    const need = input.quantity || 1;
    const have = itemId ? engine.InventoryManager.getItemCount(itemId) : null;
    const short = have !== null && have < need;
    return (
        <div className={cn('flex items-center justify-between gap-1.5 rounded border px-1.5 py-1', short ? 'border-gi-danger/60 bg-gi-danger/10' : 'border-gi-border/50 bg-black/30')}>
            <div className="flex items-center gap-1 min-w-0">
                {item && <ItemIcon item={item} size={16} className="shrink-0" />}
                <span className="text-[9px] text-gi-text truncate">{label}</span>
            </div>
            <span className={cn('text-[9px] tabular-nums shrink-0', short ? 'text-gi-danger font-bold' : 'text-gi-muted')}>
                {have !== null ? `${have}/${need}` : `×${need}`}
            </span>
        </div>
    );
};

// ----------------------------------------------------------------------
// Collapsed row (§6E) — internals fully unmounted
// ----------------------------------------------------------------------

export const CollapsedRow = ({ areaId, onExpand }) => {
    const snap = useAreaSnapshot(areaId);
    const areaSet = getAreaSet(areaId);
    if (!snap) return null;
    const statusInfo = snap.mode === 'stationed'
        ? { label: snap.stationStatus === 'crafting' ? 'Crafting' : 'Outpost', color: 'text-gi-gold' }
        : (STATUS_LABELS[snap.status] || STATUS_LABELS.paused);
    return (
        <button
            onClick={onExpand}
            className="w-full flex items-center gap-3 rounded-lg border border-gi-border bg-gi-surface/70 px-3 py-1.5 hover:border-gi-primary/50 transition-colors"
        >
            <ChevronDown size={12} className="text-gi-muted" />
            <span className="text-[11px] font-bold text-gi-text uppercase tracking-wider">{areaSet?.name || areaId}</span>
            <span className={cn('text-[9px] font-bold uppercase tracking-widest', statusInfo.color)}>{statusInfo.label}</span>
            {snap.assignedHeroId && <User size={11} className="text-gi-muted ml-auto" />}
        </button>
    );
};

export default AreaBannerRow;
