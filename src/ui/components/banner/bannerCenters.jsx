/**
 * The mode-dependent centre of a banner row: the Adventure cells (active
 * card, next preview, deck) and the Outpost cells (drink, inputs, output),
 * plus the hero and station slot pillars. Extracted from AreaBannerRow
 * (CR-001).
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
import {
    CardTitle, RowTemplateCard, RowHeroCard, RowDeckCard, RowEmptyCard, RowHazardCard,
    SlotCard, StatRow, VitalBar, FocusDivider, STATUS_LABELS, isConsumableItem
} from './bannerCards.jsx';
import { HeaderTaskProgress, HeaderEnemyProgress, taskVerbFor, progressColorFor } from './bannerHeader.jsx';
import { EnemyInfoPanel, useCombatantPanelTicks } from './bannerPanels.jsx';

export const NextCardPreviewCell = ({ nextTemplate, nextHazard, areaId }) => {
    if (nextTemplate) {
        return (
            <RowTemplateCard templateId={nextTemplate.id} areaId={areaId} dimmed={true} />
        );
    }
    if (nextHazard) {
        return (
            <RowHazardCard hazard={nextHazard} dimmed={true} />
        );
    }
    return (
        <RowEmptyCard
            icon={<Layers size={28} className="opacity-45" />}
            label="Next Card"
            sub="Deck is empty"
            faded
        />
    );
};

export const HeroSlotCell = ({ areaId, snap, engine, onOpenEquip }) => {
    const hero = snap.assignedHeroId ? engine.HeroManager.getHero(snap.assignedHeroId) : null;
    const areaArt = useMemo(() => {
        const as = getAreaSet(areaId);
        return as?.areaArt ? resolveSpritePath(as.areaArt) : null;
    }, [areaId]);

    // Drop target: a hero assigns/replaces here; an item equips the assigned hero.
    const drop = useEntityDrop({
        id: `heroslot-${areaId}`,
        surface: DND_SURFACE.BOARD,
        accepts: p => p.kind === DRAG_KIND.HERO || (p.kind === DRAG_KIND.ITEM && !!snap.assignedHeroId && !isConsumableItem(p.itemId)),
        onDrop: p => {
            if (p.kind === DRAG_KIND.HERO) engine.HeroAssignmentManager.assignHeroToArea(p.heroId, areaId);
            else if (p.kind === DRAG_KIND.ITEM && snap.assignedHeroId) engine.EquipmentManager.equipItem(snap.assignedHeroId, p.itemId);
        }
    });
    // Drag source: the assigned hero can be dragged out (carries `from`) to
    // recall (drop on the Heroes drawer) or move to another area's hero slot.
    const drag = useEntityDrag({
        id: `heroslot-src-${areaId}`,
        kind: DRAG_KIND.HERO,
        payload: hero ? { heroId: hero.id, name: hero.name, spriteId: hero.spriteId, classId: hero.classId, from: { areaId } } : {},
        sourceSurface: DND_SURFACE.BOARD,
        disabled: !hero
    });
    const cueClass = cn(drop.valid && ACCEPT_CLS, drop.invalid && REJECT_CLS);

    // The universal progress bar â€” one visual home for every hero state
    // (drawing, shuffling, task work, attack loop in combat). Floats above
    // the hero card, mirroring the enemy bar above the combat card.
    const areaState = engine.GameState.areaStates?.[areaId];
    const activeSlot = areaState?.deckSlots?.[snap.activeCardIndex];
    const activeCard = engine.LoopRunner.getActiveCardForArea(areaId);
    const activeTemplate = activeSlot?.templateId ? getCard(activeSlot.templateId) : null;

    const isAdventure = snap.mode === 'adventure';
    const descriptor = isAdventure ? taskVerbFor(activeCard, activeTemplate, snap.status) : (snap.stationStatus === 'crafting' ? 'Craftingâ€¦' : null);
    const missing = isAdventure ? activeCard?.missingRequirements?.[0] : null;
    const isWorking = snap.status === 'running' || snap.status === 'in_combat' || (snap.mode === 'stationed' && snap.stationStatus === 'crafting');
    const actionText = missing ? `Needs ${missing.replace(/^(Empty|Invalid)\s(Slot|Item):\s*/i, '')}` : descriptor;
    const actionTone = missing ? 'text-yellow-400' : (isWorking ? 'text-green-400' : 'text-gray-400');

    if (hero) {
        return (
            <div className="shrink-0 flex items-center">
                <div className="relative flex flex-col">
                    {snap.mode === 'adventure' && (
                        <div className="absolute left-0 right-0 bottom-full pb-1 px-0.5 z-20 pointer-events-none">
                            <HeaderTaskProgress
                                areaId={areaId}
                                color={progressColorFor(activeTemplate)}
                                activeCard={activeCard}
                                activeTemplate={activeTemplate}
                                status={snap.status}
                            />
                        </div>
                    )}
                    <RowHeroCard
                        hero={hero}
                        areaArt={areaArt}
                        injured={snap.status === 'injured' || hero.status === 'wounded'}
                        onClick={onOpenEquip}
                        innerRef={mergeRefs(drop.setNodeRef, drag.setNodeRef)}
                        dragProps={{ ...drag.handleProps, ...drop.droppableProps }}
                        cueClass={cn('cursor-grab active:cursor-grabbing', cueClass)}
                        combatCardId={snap.status === 'in_combat' ? activeCard?.id : null}
                        actionText={actionText}
                        actionTone={actionTone}
                    />
                </div>
            </div>
        );
    }
    return (
        <div
            ref={drop.setNodeRef}
            {...drop.droppableProps}
            className={cn('shrink-0 flex items-center rounded-xl', cueClass)}
        >
            <RowEmptyCard
                icon={<User size={28} />}
                label="Assign Hero"
                sub="Drag a hero here, or open the Heroes drawer"
                onClick={() => engine.EventBus.publish('ui:open_drawer', { tab: 'heroes' })}
            />
        </div>
    );
};

export const StationSlotCell = ({ areaId, snap, engine }) => {
    const template = snap.stationCardId ? getCard(snap.stationCardId) : null;

    // Drop target: a station card from the drawer builds here.
    const drop = useEntityDrop({
        id: `station-${areaId}`,
        surface: DND_SURFACE.BOARD,
        accepts: p => p.kind === DRAG_KIND.CARD && p.cardType === 'station' && !p.from,
        onDrop: p => {
            const result = engine.StationSlotManager.slotStation(areaId, p.templateId);
            if (!result.success) engine.EventBus.publish('ui:notify', { message: result.error || 'Station rejected', type: 'error' });
        }
    });
    // Drag source: the built station can be dragged out (carries `from.station`)
    // to reclaim it via the Cards drawer (un-builds the station).
    const drag = useEntityDrag({
        id: `station-src-${areaId}`,
        kind: DRAG_KIND.CARD,
        payload: template ? { templateId: snap.stationCardId, cardType: 'station', from: { areaId, station: true } } : {},
        sourceSurface: DND_SURFACE.BOARD,
        disabled: !template
    });
    const cueCls = cn(drop.valid && ACCEPT_CLS, drop.invalid && REJECT_CLS);

    if (template) {
        // Display only (owner design 2026-07-16): the Output card opens Recipe
        // focus now, not the station card. This card just shows the station and
        // can be dragged out to reclaim it.
        return (
            <div
                ref={mergeRefs(drop.setNodeRef, drag.setNodeRef)}
                {...drag.handleProps}
                {...drop.droppableProps}
                className={cn('shrink-0 flex items-center rounded-xl cursor-grab active:cursor-grabbing', cueCls, drag.isDragging && 'opacity-40')}
            >
                <RowTemplateCard
                    templateId={snap.stationCardId}
                    areaId={areaId}
                    title={`${template.name} â€” drag out to un-build this station`}
                />
            </div>
        );
    }
    return (
        <div ref={drop.setNodeRef} {...drop.droppableProps} className={cn('shrink-0 flex items-center rounded-xl', cueCls)}>
            <RowEmptyCard
                icon={<Hammer size={28} />}
                label="No Station"
                sub="Drag a station card here, or open the Cards drawer"
                onClick={() => engine.EventBus.publish('ui:open_drawer', {
                    tab: 'cards',
                    filter: { cardType: 'station', deployFilter: 'available' }
                })}
            />
        </div>
    );
};


// ----------------------------------------------------------------------
// Adventure center: Active Card + Upcoming Track + Deck Button (Â§11.B.1)
// ----------------------------------------------------------------------

export const AdventureCenter = ({ areaId, snap, engine, onFocus }) => {
    const areaState = engine.GameState.areaStates?.[areaId];
    const slots = areaState?.deckSlots || [];
    const activeSlot = slots[snap.activeCardIndex];
    const activeCard = engine.LoopRunner.getActiveCardForArea(areaId);
    const activeTemplate = activeSlot?.templateId ? getCard(activeSlot.templateId) : null;
    const areaArt = useMemo(() => {
        const as = getAreaSet(areaId);
        return as?.areaArt ? resolveSpritePath(as.areaArt) : null;
    }, [areaId]);

    const nextIndex = slots.length > 0 ? (snap.activeCardIndex + 1) % slots.length : -1;
    const nextSlot = nextIndex !== -1 ? slots[nextIndex] : null;
    const nextTemplate = nextSlot?.templateId ? getCard(nextSlot.templateId) : null;
    const nextHazard = nextSlot?.hazard || null;

    const filledCount = slots.filter(s => s.templateId || s.hazard).length;
    const hasHazard = slots.some(s => s.hazard);

    return (
        <div className="relative h-full flex items-end gap-4 min-w-0">
            {/* Active card â€” full-fidelity card face (Â§11.B.1) */}
            <div className="relative shrink-0 flex flex-col">
                {/* Enemy attack-loop bar â€” floats above the enemy (combat) card during
                    a fight. The hero's universal bar lives above the hero card. */}
                {snap.status === 'in_combat' && (
                    <div className="absolute left-0 right-0 bottom-full pb-1 px-0.5 z-20 pointer-events-none">
                        <HeaderEnemyProgress areaId={areaId} activeCard={activeCard} />
                    </div>
                )}
                <ActiveCardCell
                    areaId={areaId} snap={snap}
                    activeCard={activeCard} activeSlot={activeSlot} activeTemplate={activeTemplate}
                />
            </div>

            {/* Enemy Info (in combat) / Next Card Preview (not in combat) */}
            {snap.status === 'in_combat' ? (
                <EnemyInfoPanel areaId={areaId} snap={snap} engine={engine} />
            ) : (
                <NextCardPreviewCell nextTemplate={nextTemplate} nextHazard={nextHazard} areaId={areaId} />
            )}

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

export const ActiveCardCell = ({ areaId, snap, activeCard, activeSlot, activeTemplate }) => {
    const { size, width } = useCardTier();
    // Real card executing / fighting / consuming â†’ full-fidelity card face (Â§11.B.1).
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

    // Active hazard slot â†’ hazard card (still a full card space).
    if (snap.status === 'running' && activeSlot?.hazard) {
        return <RowHazardCard hazard={activeSlot.hazard} dimmed={false} />;
    }

    // Idle / transition states â†’ a full card-sized blank slot with the status,
    // so the slot never shrinks to a badge and nothing else reflows.
    const idleMap = {
        drawing: { icon: <Hourglass size={30} className="text-gi-muted animate-pulse" />, label: 'Drawingâ€¦', sub: 'Next card' },
        shuffling: { icon: <Layers size={30} className="text-gi-muted animate-pulse" />, label: 'Shufflingâ€¦', sub: 'Loop restarting' },
        injured: { icon: <Skull size={30} className="text-gi-danger" />, label: 'Injured', sub: 'Recovering at the Outpost' },
        paused: { icon: <Pause size={30} className="text-gi-muted" />, label: 'Paused', sub: snap.pausedReason === 'energy' ? 'Waiting for energy' : (snap.assignedHeroId ? 'Press start' : 'Assign a hero') }
    };
    const info = idleMap[snap.status] || idleMap.paused;
    return <RowEmptyCard icon={info.icon} label={info.label} sub={info.sub} faded />;
};

// ----------------------------------------------------------------------
// Station center: Output + Controls + Inputs (Â§11.B.2)
// ----------------------------------------------------------------------

export const StationCenter = ({ areaId, snap, engine, onFocus }) => {
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

    // Row order after the Hero slot (owner design 2026-07-16): Drink, Inputs,
    // Recipe/Output. The Station card is the far-right pillar (StationSlotCell,
    // rendered by the parent). Production run-count controls moved to the
    // outpost info card (StationInfoCard).
    return (
        <div className="relative h-full flex items-end gap-4 min-w-0">
            <StationDrinkCard areaId={areaId} snap={snap} engine={engine} />
            <StationInputsCard recipe={recipe} engine={engine} />
            <StationOutputCard areaId={areaId} snap={snap} recipe={recipe} onFocus={onFocus} />
        </div>
    );
};

/** Output slot card â€” the recipe's product; click opens Recipe Focus (Â§11.B.2). */
export const StationOutputCard = ({ areaId, snap, recipe, onFocus }) => {
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
                            Crafted: {snap.producedCount}{output?.quantity > 1 ? ` Â· Ã—${output.quantity}/craft` : ''}
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

/**
 * Station Drink slot (owner design 2026-07-16) — an area-level card holding a
 * drink, auto-sipped by StationManager to keep a low-energy hero crafting.
 * Drop a drink from the Bank; click to clear.
 */
export const StationDrinkCard = ({ areaId, snap, engine }) => {
    const { size, width, height } = useCardTier();
    const drinkId = snap.drinkId;
    const item = drinkId ? getItem(drinkId) : null;
    const count = useGameState(
        state => drinkId ? (state.inventory?.items?.[drinkId]?.quantity || 0) : 0,
        ['inventory_updated'],
        null,
        { deps: [drinkId] }
    );
    const drop = useEntityDrop({
        id: `stationdrink-${areaId}`,
        surface: DND_SURFACE.BOARD,
        accepts: p => {
            if (p.kind !== DRAG_KIND.ITEM) return false;
            const it = getItem(p.itemId);
            return !!(it && (it.equipSlot === 'drink' || it.type === 'drink' || it.tags?.includes('drink')));
        },
        onDrop: p => {
            const r = engine.StationSlotManager.setStationDrink(areaId, p.itemId);
            if (!r.success) engine.EventBus.publish('ui:notify', { message: r.error || 'Only drinks go here', type: 'error' });
        }
    });
    const iconSize = size === 'sm' ? 48 : 96;
    return (
        <div
            ref={drop.setNodeRef}
            {...drop.droppableProps}
            style={{ width, height }}
            className={cn(
                'shrink-0 rounded-xl border flex flex-col overflow-hidden bg-black/55 transition-colors',
                item ? 'border-gi-border' : 'border-dashed border-gi-border',
                drop.valid && ACCEPT_CLS, drop.invalid && REJECT_CLS
            )}
        >
            <div className="px-2 py-1 bg-black/30 border-b border-white/5 shrink-0">
                <span className="gi-card-title font-bold tracking-widest uppercase text-[10px] text-white truncate block">Drink</span>
            </div>
            <div
                onClick={item ? () => engine.StationSlotManager.setStationDrink(areaId, null) : undefined}
                title={item ? 'Click to clear the Drink slot' : undefined}
                className={cn('flex-1 flex flex-col items-center justify-center gap-1 p-2 text-center min-h-0', item && 'cursor-pointer')}
            >
                {item ? (
                    <>
                        <ItemIcon item={item} size={iconSize} />
                        <span className="text-[9px] text-gi-text font-bold truncate max-w-full">{item.name}</span>
                        <span className="text-[9px] text-gi-muted tabular-nums">{count} in bank</span>
                        <span className="text-[8px] text-gi-muted">click to clear</span>
                    </>
                ) : (
                    <>
                        <CupSoda size={iconSize} className="text-gi-muted/50" />
                        <span className="text-[9px] text-gi-muted">Drag a drink here</span>
                        <span className="text-[8px] text-gi-muted/70 normal-case">Auto-sipped for craft energy</span>
                    </>
                )}
            </div>
        </div>
    );
};

export const StationInputsCard = ({ recipe, engine }) => {
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

export const InputChip = ({ input, engine }) => {
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
                {have !== null ? `${have}/${need}` : `Ã—${need}`}
            </span>
        </div>
    );
};
