import React, { useState } from 'react';
import { cn } from '../../utils/cn.js';
import { getCard } from '../../../config/registries/cardRegistry.js';
import { getAreaSet } from '../../../config/registries/areaSetRegistry.js';
import { ensureAreaState } from '../../../systems/area/AreaStateManager.js';
import { DeckSlotManager } from '../../../systems/loop/DeckSlotManager.js';
import { StationSlotManager } from '../../../systems/loop/StationSlotManager.js';
import { CARD_TYPES } from '../../../config/registries/cardConstants.js';
import { Plus, Minus, MapPin, CheckCircle2 } from 'lucide-react';

/**
 * Deployment Map + Add/Remove controls (§5D). Shows where each owned copy
 * sits and moves copies in/out of area decks (or the Station Slot for
 * station cards) via buttons — the no-drag path alongside Phase 7's
 * drag-and-drop. Lived in CollectionBinderModal until Phase 7 moved all
 * gameplay card management into the Bottom Drawer's Cards tab.
 */
export const DeploymentPanel = ({ templateId, unlockedAreaIds, engine }) => {
    const template = getCard(templateId);
    const alloc = DeckSlotManager.getAllocations(templateId);
    const isStation = template?.cardType === CARD_TYPES.STATION;
    const [showAreaPicker, setShowAreaPicker] = useState(false);

    if (!template) return null;

    const areaName = (areaId) => getAreaSet(areaId)?.name || areaId;

    // Where could one more copy go?
    const addTargets = unlockedAreaIds.map(areaId => {
        ensureAreaState(areaId);
        if (isStation) {
            const occupied = engine.GameState.areaStates[areaId]?.stationState?.activeStationCardId;
            return { areaId, ok: alloc.available > 0 && occupied !== templateId, note: occupied ? 'replaces current station' : null };
        }
        const areaState = engine.GameState.areaStates[areaId];
        const inDeck = (areaState.deckSlots || []).some(s => s.templateId === templateId);
        if (inDeck) return { areaId, ok: false, note: 'already in this deck' };
        const slotIndex = (areaState.deckSlots || []).findIndex(s => !s.templateId && !s.isLocked && !s.hazard);
        if (slotIndex === -1) return { areaId, ok: false, note: 'no empty slot' };
        return { areaId, ok: alloc.available > 0, slotIndex };
    });

    const handleAdd = (target) => {
        const result = isStation
            ? StationSlotManager.slotStation(target.areaId, templateId)
            : DeckSlotManager.slotCard(target.areaId, target.slotIndex, templateId);
        if (!result.success) console.warn('[Deployment] Add to deck failed:', result.error);
        setShowAreaPicker(false);
    };

    const handleRemove = (deployment) => {
        const result = deployment.slotIndex === 'station'
            ? StationSlotManager.unslotStation(deployment.areaId)
            : DeckSlotManager.unslotCard(deployment.areaId, deployment.slotIndex);
        if (!result.success) console.warn('[Deployment] Remove from deck failed:', result.error);
    };

    return (
        <div className="shrink-0 bg-gi-base rounded-xl border border-gi-border/20 p-3 flex flex-col gap-2 max-h-[40%] overflow-y-auto custom-scrollbar">
            <span className="text-[10px] font-bold text-gi-muted uppercase tracking-widest">Deployment Map</span>

            {/* One line per owned copy (§5D) */}
            {alloc.owned === 0 ? (
                <span className="text-xs text-gi-muted italic">Not owned — pull it from a Booster Pack.</span>
            ) : (
                <div className="flex flex-col gap-1">
                    {alloc.slotted.map((dep, i) => (
                        <div key={`${dep.areaId}-${dep.slotIndex}`} className="flex items-center gap-2 text-xs text-gi-text">
                            <MapPin size={12} className="text-gi-primary shrink-0" />
                            <span className="truncate">
                                Copy {i + 1}: {areaName(dep.areaId)} {dep.slotIndex === 'station' ? '(Station Slot)' : `Slot ${dep.slotIndex + 1}`}
                            </span>
                            <button
                                onClick={() => handleRemove(dep)}
                                title="Remove from deck"
                                className="ml-auto p-1 rounded border border-gi-border text-gi-muted hover:text-gi-danger hover:border-gi-danger transition-colors"
                            >
                                <Minus size={12} />
                            </button>
                        </div>
                    ))}
                    {Array.from({ length: Math.max(0, alloc.available) }).map((_, i) => (
                        <div key={`avail-${i}`} className="flex items-center gap-2 text-xs text-gi-muted">
                            <CheckCircle2 size={12} className="text-gi-success shrink-0" />
                            <span>Copy {alloc.slotted.length + i + 1}: Available</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Add to Deck */}
            {alloc.available > 0 && (
                <div className="flex flex-col gap-1.5 pt-1 border-t border-gi-border/30">
                    <button
                        onClick={() => setShowAreaPicker(v => !v)}
                        className="flex items-center justify-center gap-2 px-2 py-1.5 rounded text-xs font-bold uppercase tracking-wide border border-gi-primary/40 bg-gi-primary/10 text-gi-text hover:bg-gi-primary/20 transition-colors"
                    >
                        <Plus size={12} /> {isStation ? 'Build at Outpost' : 'Add to Deck'}
                    </button>
                    {showAreaPicker && (
                        <div className="flex flex-col gap-1">
                            {addTargets.map(t => (
                                <button
                                    key={t.areaId}
                                    disabled={!t.ok}
                                    onClick={() => handleAdd(t)}
                                    className={cn(
                                        "flex items-center justify-between px-2 py-1 rounded text-xs border transition-colors",
                                        t.ok ? "border-gi-border text-gi-text hover:border-gi-primary" : "border-gi-border/40 text-gi-muted/60 cursor-not-allowed"
                                    )}
                                >
                                    <span>{areaName(t.areaId)}</span>
                                    {t.note && <span className="text-[9px] italic opacity-70">{t.note}</span>}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
            {alloc.owned > 0 && alloc.available === 0 && (
                <span className="text-[10px] text-gi-muted uppercase tracking-wide pt-1 border-t border-gi-border/30">
                    Fully deployed — remove a copy to redeploy it.
                </span>
            )}
        </div>
    );
};

export default DeploymentPanel;
