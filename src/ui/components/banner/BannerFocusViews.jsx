import React, { useMemo, useState } from 'react';
import { useEngine } from '../../hooks/useEngine.js';
import { useGameState } from '../../hooks/useGameState.js';
import { cn } from '../../utils/cn.js';
import { getCard } from '../../../config/registries/cardRegistry.js';
import { getItem, getAllItems } from '../../../config/registries/itemRegistry.js';
import { getRecipe, getRecipesBySubskill } from '../../../config/registries/recipeRegistry.js';
import { getAreaSet } from '../../../config/registries/areaSetRegistry.js';
import { AREA_EVENTS } from '../../../systems/core/areaEvents.js';
import { unequipItem } from '../../../systems/equipment/EquipmentManager.js';
import {
    X, Plus, Trash2, Sword, Skull, Utensils, AlertTriangle, Lock, GripVertical,
    User, Shield, CheckCircle2
} from 'lucide-react';

/**
 * Inline Focus Views (concept §11.D): clicking a banner component morphs the
 * row into a configuration surface. All of them are plain row-height panels
 * with horizontal overflow scrolling; the container dims the other rows.
 */

const FocusShell = ({ title, onClose, children }) => (
    <div className="flex flex-col">
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-gi-border/50 bg-gi-base/60">
            <span className="text-[10px] font-bold text-gi-primary uppercase tracking-widest">{title}</span>
            <button onClick={onClose} className="p-1 rounded text-gi-muted hover:text-gi-text transition-colors" title="Close">
                <X size={14} />
            </button>
        </div>
        <div className="overflow-x-auto custom-scrollbar px-3 py-3">
            {children}
        </div>
    </div>
);

// ----------------------------------------------------------------------
// Deck Focus (§11.D.1) — the slot chain, with §5E drag interactions
// ----------------------------------------------------------------------

export const DeckFocusView = ({ areaId, onClose }) => {
    const engine = useEngine();
    const [pickerSlot, setPickerSlot] = useState(null);
    const [dragFrom, setDragFrom] = useState(null);

    // Re-render on deck changes for this area
    useGameState(
        state => (state.areaStates?.[areaId]?.deckSlots || []).map(s => s.templateId || (s.hazard ? 'hz' : '_')).join(','),
        [AREA_EVENTS.DECK_UPDATED, AREA_EVENTS.STATS_DIRTY],
        data => !data?.areaId || data.areaId === areaId
    );

    const areaState = engine.GameState.areaStates?.[areaId];
    const slots = areaState?.deckSlots || [];
    const areaName = getAreaSet(areaId)?.name || areaId;

    const handleDropOnSlot = (targetIndex) => {
        if (dragFrom === null || dragFrom === targetIndex) return setDragFrom(null);
        const result = engine.DeckSlotManager.swapSlots(areaId, dragFrom, targetIndex);
        if (!result.success) console.warn('[DeckFocus] swap rejected:', result.error);
        setDragFrom(null);
    };

    const handleDropOnTrash = () => {
        if (dragFrom === null) return;
        engine.DeckSlotManager.unslotCard(areaId, dragFrom);
        setDragFrom(null);
    };

    return (
        <FocusShell title={`${areaName} — Deck`} onClose={onClose}>
            <div className="flex items-stretch gap-2 min-w-max pb-1">
                {slots.map((slot, i) => (
                    <DeckSlotTile
                        key={i}
                        areaId={areaId}
                        slot={slot}
                        index={i}
                        engine={engine}
                        isDragging={dragFrom === i}
                        onDragStart={() => setDragFrom(i)}
                        onDragEnd={() => setDragFrom(null)}
                        onDropHere={() => handleDropOnSlot(i)}
                        pickerOpen={pickerSlot === i}
                        setPickerOpen={open => setPickerSlot(open ? i : null)}
                    />
                ))}

                {/* §5E: dragging a card out of the row unslots it */}
                <div
                    onDragOver={e => { e.preventDefault(); }}
                    onDrop={handleDropOnTrash}
                    className={cn(
                        'w-24 shrink-0 rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-colors',
                        dragFrom !== null ? 'border-gi-danger/70 text-gi-danger bg-gi-danger/5' : 'border-gi-border/40 text-gi-muted/50'
                    )}
                >
                    <Trash2 size={16} />
                    <span className="text-[9px] font-bold uppercase text-center leading-tight">Drop to remove</span>
                </div>
            </div>
        </FocusShell>
    );
};

const cardIcon = (template, slot) => {
    if (slot?.hazard) return <AlertTriangle size={14} className="text-gi-danger" />;
    if (!template) return null;
    if (template.cardType === 'combat') return <Skull size={14} className="text-gi-danger" />;
    if (template.cardType === 'consumable') return <Utensils size={14} className="text-gi-success" />;
    return <Sword size={14} className="text-gi-primary" />;
};

const DeckSlotTile = ({ areaId, slot, index, engine, isDragging, onDragStart, onDragEnd, onDropHere, pickerOpen, setPickerOpen }) => {
    const template = slot.templateId ? getCard(slot.templateId) : null;

    // Environmental hazard / locked slots are part of the area, not the player's deck
    if (slot.hazard || slot.isLocked) {
        return (
            <div className="w-32 shrink-0 rounded-lg border border-gi-danger/40 bg-gi-danger/5 px-2 py-2 flex flex-col gap-1" title="Environmental slot — cannot be changed">
                <div className="flex items-center gap-1.5">
                    <Lock size={11} className="text-gi-danger" />
                    <span className="text-[9px] font-bold text-gi-danger uppercase">Slot {index + 1}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <AlertTriangle size={14} className="text-gi-danger" />
                    <span className="text-[10px] font-bold text-gi-text capitalize">{slot.hazard?.type || 'Locked'}</span>
                </div>
                {slot.hazard && <span className="text-[9px] text-gi-muted">-{slot.hazard.damagePerPass} HP per pass</span>}
            </div>
        );
    }

    return (
        <div
            className="relative w-32 shrink-0"
            onDragOver={e => e.preventDefault()}
            onDrop={onDropHere}
        >
            {template ? (
                <div
                    draggable
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                    className={cn(
                        'h-full rounded-lg border bg-black/40 px-2 py-2 flex flex-col gap-1 cursor-grab active:cursor-grabbing transition-opacity',
                        isDragging ? 'opacity-40 border-gi-primary' : 'border-gi-border/60 hover:border-gi-primary/60'
                    )}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold text-gi-muted uppercase flex items-center gap-1">
                            <GripVertical size={9} /> Slot {index + 1}
                        </span>
                        <button
                            onClick={() => engine.DeckSlotManager.unslotCard(areaId, index)}
                            title="Remove from deck"
                            className="p-0.5 rounded text-gi-muted hover:text-gi-danger transition-colors"
                        >
                            <Trash2 size={11} />
                        </button>
                    </div>
                    <div className="flex items-center gap-1.5">
                        {cardIcon(template, slot)}
                        <span className="text-[10px] font-bold text-gi-text leading-tight">{template.name}</span>
                    </div>
                    <span className="text-[9px] text-gi-muted capitalize">{template.cardType}</span>
                </div>
            ) : (
                <button
                    onClick={() => setPickerOpen(!pickerOpen)}
                    className="w-full h-full min-h-[4.5rem] rounded-lg border-2 border-dashed border-gi-border/50 flex flex-col items-center justify-center gap-1 text-gi-muted hover:text-gi-text hover:border-gi-primary/50 transition-colors"
                >
                    <Plus size={14} />
                    <span className="text-[9px] font-bold uppercase">Slot {index + 1}</span>
                    {slot.specializedTags?.length > 0 && (
                        <span className="text-[8px] text-gi-gold">{slot.specializedTags.join(', ')} only</span>
                    )}
                </button>
            )}

            {pickerOpen && (
                <SlotCardPicker
                    areaId={areaId}
                    slotIndex={index}
                    engine={engine}
                    onClose={() => setPickerOpen(false)}
                />
            )}
        </div>
    );
};

const SlotCardPicker = ({ areaId, slotIndex, engine, onClose }) => {
    const options = engine.DeckSlotManager.getAvailableCardsForSlot(areaId, slotIndex);
    return (
        <div className="absolute z-50 top-full left-0 mt-1 w-48 max-h-52 overflow-y-auto custom-scrollbar rounded-lg border border-gi-border bg-gi-base shadow-2xl p-1.5 flex flex-col gap-1">
            {options.length === 0 && (
                <span className="text-[10px] text-gi-muted italic px-1 py-2">No available cards — pull more from Booster Packs or free up copies.</span>
            )}
            {options.map(templateId => {
                const t = getCard(templateId);
                return (
                    <button
                        key={templateId}
                        onClick={() => { engine.DeckSlotManager.slotCard(areaId, slotIndex, templateId); onClose(); }}
                        className="flex items-center gap-1.5 px-2 py-1 rounded border border-transparent hover:border-gi-primary/50 hover:bg-gi-primary/10 text-left transition-colors"
                    >
                        {cardIcon(t, null)}
                        <span className="text-[10px] text-gi-text">{t?.name || templateId}</span>
                    </button>
                );
            })}
        </div>
    );
};

// ----------------------------------------------------------------------
// Equip Focus (§11.D.2)
// ----------------------------------------------------------------------

export const EquipFocusView = ({ areaId, heroId, onClose }) => {
    const engine = useEngine();
    const hero = useGameState(
        state => state.heroes?.find(h => h.id === heroId) || null,
        ['heroes_updated', 'hero_equipment_changed'],
        null,
        { deps: [heroId] }
    );

    const equippableByBank = useMemo(() => {
        const banked = engine.InventoryManager.getAllItems();
        return Object.keys(banked)
            .map(id => getItem(id))
            .filter(item => item && (item.equipSlot || item.type === 'food' || item.type === 'drink'))
            .filter(item => (banked[item.id]?.quantity || 0) > 0);
    }, [hero?.equipment, engine]);

    if (!hero) return <FocusShell title="Equipment" onClose={onClose}><span className="text-xs text-gi-muted">No hero assigned.</span></FocusShell>;

    const skills = Object.entries(hero.skills || {}).filter(([, s]) => (s?.level ?? 1) > 1).slice(0, 6);

    return (
        <FocusShell title={`${hero.name} — Equipment`} onClose={onClose}>
            <div className="flex items-start gap-5 min-w-max">
                {/* Identity + vitals */}
                <div className="flex flex-col items-center gap-1.5 w-28">
                    <div className="w-14 h-14 rounded-full border-2 border-gi-primary/60 bg-gi-primary/10 flex items-center justify-center text-xl font-black text-gi-text uppercase">
                        {hero.name?.[0] || <User size={20} />}
                    </div>
                    <span className="text-[11px] font-bold text-gi-text">{hero.name}</span>
                    <span className="text-[9px] text-gi-muted uppercase">{hero.status}</span>
                    <button
                        onClick={() => { engine.HeroAssignmentManager.unassignHero(areaId); onClose(); }}
                        className="mt-1 px-2 py-1 rounded border border-gi-border text-[9px] font-bold uppercase text-gi-muted hover:text-gi-danger hover:border-gi-danger transition-colors"
                    >
                        Unassign
                    </button>
                </div>

                {/* Equipment slots */}
                <div className="flex flex-col gap-1.5">
                    <span className="text-[9px] font-bold text-gi-muted uppercase tracking-widest">Gear (click to unequip)</span>
                    <div className="grid grid-cols-2 gap-1.5">
                        {['weapon', 'armor', 'food', 'drink'].map(slot => {
                            const itemId = hero.equipment?.[slot];
                            const item = itemId ? getItem(itemId) : null;
                            return (
                                <button
                                    key={slot}
                                    onClick={() => itemId && unequipItem(heroId, slot)}
                                    disabled={!itemId}
                                    title={item ? `${item.name} — click to unequip` : `${slot} (empty)`}
                                    className={cn(
                                        'w-24 px-2 py-1.5 rounded border text-left transition-colors',
                                        itemId ? 'border-gi-primary/40 bg-gi-primary/5 hover:border-gi-danger' : 'border-dashed border-gi-border/50'
                                    )}
                                >
                                    <div className="text-[8px] font-bold text-gi-muted uppercase">{slot}</div>
                                    <div className={cn('text-[10px] truncate', itemId ? 'text-gi-text font-bold' : 'text-gi-muted italic')}>
                                        {item?.name || 'Empty'}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Equip from bank */}
                <div className="flex flex-col gap-1.5 w-52">
                    <span className="text-[9px] font-bold text-gi-muted uppercase tracking-widest flex items-center gap-1"><Shield size={10} /> Equip from Bank</span>
                    <div className="max-h-28 overflow-y-auto custom-scrollbar flex flex-col gap-1 pr-1">
                        {equippableByBank.length === 0 && <span className="text-[10px] text-gi-muted italic">Nothing equippable in the bank.</span>}
                        {equippableByBank.map(item => (
                            <button
                                key={item.id}
                                onClick={() => engine.EquipmentManager.equipItem(heroId, item.id)}
                                className="flex items-center justify-between gap-2 px-2 py-1 rounded border border-gi-border/50 hover:border-gi-primary/60 text-left transition-colors"
                            >
                                <span className="text-[10px] text-gi-text truncate">{item.name}</span>
                                <span className="text-[9px] text-gi-muted uppercase shrink-0">{item.equipSlot || item.type}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Stats */}
                <div className="flex flex-col gap-1 w-40">
                    <span className="text-[9px] font-bold text-gi-muted uppercase tracking-widest">Stats</span>
                    <StatLine label="Health" value={`${Math.round(hero.hp?.current ?? 0)} / ${hero.hp?.max ?? 100}`} />
                    <StatLine label="Energy" value={`${Math.round(hero.energy?.current ?? 0)} / ${hero.energy?.max ?? 100}`} />
                    {skills.map(([skillId, s]) => (
                        <StatLine key={skillId} label={skillId} value={`Lv ${s.level}`} />
                    ))}
                </div>
            </div>
        </FocusShell>
    );
};

const StatLine = ({ label, value }) => (
    <div className="flex items-center justify-between gap-2 text-[10px]">
        <span className="text-gi-muted capitalize">{label}</span>
        <span className="text-gi-text font-bold tabular-nums">{value}</span>
    </div>
);

// ----------------------------------------------------------------------
// Recipe Focus (§11.D.3)
// ----------------------------------------------------------------------

export const RecipeFocusView = ({ areaId, onClose }) => {
    const engine = useEngine();
    useGameState(
        state => state.areaStates?.[areaId]?.stationState?.selectedRecipeId || null,
        [AREA_EVENTS.STATION_CHANGED],
        data => !data?.areaId || data.areaId === areaId
    );

    const areaState = engine.GameState.areaStates?.[areaId];
    const stationId = areaState?.stationState?.activeStationCardId;
    const template = stationId ? getCard(stationId) : null;

    if (!template) {
        return (
            <FocusShell title="Station" onClose={onClose}>
                <span className="text-xs text-gi-muted italic">
                    No station built here. Claim a station card from a Booster Pack, then use the Collection Binder's "Build at Outpost" button.
                </span>
            </FocusShell>
        );
    }

    const skillCap = template.config?.skillCap || 90;
    const recipes = template.hasCraftingQueue
        ? getRecipesBySubskill(template.config?.recipeGroup).filter(r => (r.levelRequirement || 0) <= skillCap)
        : [];
    const selectedId = areaState?.stationState?.selectedRecipeId;

    return (
        <FocusShell title={`${template.name} — Recipes`} onClose={onClose}>
            <div className="flex items-stretch gap-2 min-w-max pb-1">
                {!template.hasCraftingQueue && (
                    <span className="text-[11px] text-gi-muted italic self-center">
                        This station has no crafting queue{template.passiveBuff ? ` — its passive buff (${template.passiveBuff.description || template.passiveBuff.type}) is always active while built` : ''}.
                    </span>
                )}
                {recipes.map(recipe => {
                    const output = recipe.outputs?.[0];
                    const outputItem = output ? getItem(output.itemId || output.id) : null;
                    const isSelected = recipe.id === selectedId;
                    return (
                        <button
                            key={recipe.id}
                            onClick={() => engine.StationSlotManager.selectRecipe(areaId, recipe.id)}
                            className={cn(
                                'w-40 shrink-0 rounded-lg border px-2 py-2 flex flex-col gap-1 text-left transition-colors',
                                isSelected ? 'border-gi-gold bg-gi-gold/10' : 'border-gi-border/60 bg-black/30 hover:border-gi-gold/50'
                            )}
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-gi-text truncate">{outputItem?.name || recipe.name}</span>
                                {isSelected && <CheckCircle2 size={12} className="text-gi-gold shrink-0" />}
                            </div>
                            <span className="text-[9px] text-gi-muted">Lv {recipe.levelRequirement || 1} · {((recipe.baseTickTime || 10000) / 1000).toFixed(1)}s · {recipe.xpAwarded || 0} XP</span>
                            <div className="flex flex-col gap-0.5">
                                {(recipe.inputs || []).slice(0, 3).map((input, i) => {
                                    const item = input.itemId || input.id ? getItem(input.itemId || input.id) : null;
                                    return (
                                        <span key={i} className="text-[9px] text-gi-muted truncate">
                                            • {input.quantity || 1}× {item?.name || (input.tag ? `any ${input.tag}` : '?')}
                                        </span>
                                    );
                                })}
                            </div>
                        </button>
                    );
                })}
                {template.hasCraftingQueue && recipes.length === 0 && (
                    <span className="text-[11px] text-gi-muted italic self-center">No recipes known for this station.</span>
                )}

                {/* Station management */}
                <div className="w-32 shrink-0 flex flex-col items-stretch justify-center gap-1.5 border-l border-gi-border/40 pl-3">
                    <button
                        onClick={() => { engine.StationSlotManager.unslotStation(areaId); onClose(); }}
                        className="px-2 py-1.5 rounded border border-gi-border text-[9px] font-bold uppercase text-gi-muted hover:text-gi-danger hover:border-gi-danger transition-colors"
                    >
                        Dismantle Station
                    </button>
                    {template.passiveBuff && (
                        <span className="text-[9px] text-gi-gold leading-snug">{template.passiveBuff.description || template.passiveBuff.type}</span>
                    )}
                </div>
            </div>
        </FocusShell>
    );
};

// ----------------------------------------------------------------------
// Hero Picker — assign / swap heroes without the (Phase 7) drawer
// ----------------------------------------------------------------------

export const HeroPicker = ({ areaId, onClose }) => {
    const engine = useEngine();
    const heroes = engine.HeroManager.getAllHeroes?.() || engine.GameState.heroes || [];

    const rows = heroes.map(hero => {
        const currentArea = engine.HeroAssignmentManager.getAreaForHero(hero.id);
        return { hero, currentArea, areaName: currentArea ? (getAreaSet(currentArea)?.name || currentArea) : null };
    });

    return (
        <div className="absolute z-50 top-full left-0 mt-1 w-52 max-h-56 overflow-y-auto custom-scrollbar rounded-lg border border-gi-border bg-gi-base shadow-2xl p-1.5 flex flex-col gap-1">
            {rows.length === 0 && (
                <span className="text-[10px] text-gi-muted italic px-1 py-2">No heroes — recruit one at the Tavern.</span>
            )}
            {rows.map(({ hero, currentArea, areaName }) => (
                <button
                    key={hero.id}
                    onClick={() => { engine.HeroAssignmentManager.assignHeroToArea(hero.id, areaId); onClose(); }}
                    disabled={currentArea === areaId}
                    className="flex items-center justify-between gap-2 px-2 py-1 rounded border border-transparent hover:border-gi-primary/50 hover:bg-gi-primary/10 text-left transition-colors disabled:opacity-40"
                >
                    <span className="text-[10px] font-bold text-gi-text truncate">{hero.name}</span>
                    <span className="text-[9px] text-gi-muted shrink-0">
                        {hero.status === 'wounded' ? 'Injured' : areaName ? `@ ${areaName}` : 'Idle'}
                    </span>
                </button>
            ))}
        </div>
    );
};
