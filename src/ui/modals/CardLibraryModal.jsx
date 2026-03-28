import React, { useState, useMemo } from 'react';
import { useEngine } from '../hooks/useEngine.js';
import { useGameState } from '../hooks/useGameState.js';
import { cn } from '../utils/cn.js';
import GIModal from '../components/base/GIModal.jsx';
import GISurface from '../components/base/GISurface.jsx';
import LibraryPip from '../components/library/LibraryPip.jsx';
import { getAllAreaSets, getAreaSet } from '../../config/registries/areaSetRegistry.js';
import { getCard } from '../../config/registries/cardRegistry.js';
import { getSetTotal } from '../../config/registries/areaSetRegistry.js';
import * as LibraryManager from '../../systems/cards/LibraryManager.js';
import { Book, Trophy } from 'lucide-react';

/**
 * CardLibraryModal: The "Binder". Displays all cards in the game (grouped by Area Set),
 * showing owned counts and exact locations for every copy via pips.
 */
const CardLibraryModal = ({ isOpen, onClose }) => {
    const engine = useEngine();
    const areaSets = useMemo(() => Object.values(getAllAreaSets()), []);
    const [selectedAreaId, setSelectedAreaId] = useState(areaSets[0]?.id || 'guild_hall_v1');

    // Subscribe to playsets and card changes to keep pips updated
    const playsets = useGameState(state => state.collection?.playsets || {}, ['state_changed', 'collection_updated']);
    // We also need to listen to card movements to re-reconcile locations
    const _cardsRevision = useGameState(state => state.cards?._rev || 0, ['cards_updated']);

    const currentArea = getAreaSet(selectedAreaId);
    const cardTemplates = useMemo(() => {
        if (!currentArea) return [];
        return currentArea.cardPool.map(entry => getCard(entry.cardId)).filter(Boolean);
    }, [selectedAreaId, currentArea]);

    const setTotal = getSetTotal(selectedAreaId);
    const foundInSet = useMemo(() => {
        if (!currentArea) return 0;
        let count = 0;
        Object.entries(currentArea.deckList || {}).forEach(([tid, max]) => {
            count += Math.min(playsets[tid] || 0, max);
        });
        return count;
    }, [currentArea, playsets]);

    const handleReclaim = (templateId, areaId) => {
        const result = LibraryManager.performReclaim(templateId, areaId);
        if (!result.success) {
            console.error('[Library] Reclaim failed:', result.error);
        }
    };

    const handleWithdraw = (templateId) => {
        if (!LibraryManager.canWithdraw(templateId)) return;

        const result = engine.CardManager.createCard(templateId);
        if (result.success) {
            engine.EventBus.publish('library_card_withdrawn', { templateId });
        } else {
            console.error('[Library] Withdraw failed:', result.error);
        }
    };

    return (
        <GIModal
            isOpen={isOpen}
            onClose={onClose}
            title="Collection Binder"
            maxWidth="max-w-5xl"
        >
            <div className="flex h-[70vh] gap-6">

                {/* Left Sidebar: Area Navigation */}
                <div className="w-48 flex flex-col gap-2 overflow-y-auto pr-2 border-r border-gi-border/20">
                    <div className="text-[10px] font-display font-bold text-gi-muted uppercase tracking-widest mb-2 px-2">
                        Area Sets
                    </div>
                    {areaSets.map(set => {
                        const isSelected = selectedAreaId === set.id;
                        return (
                            <button
                                key={set.id}
                                onClick={() => setSelectedAreaId(set.id)}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-left",
                                    isSelected
                                        ? "bg-gi-primary/20 border border-gi-primary/40 text-gi-primary shadow-[0_0_10px_rgba(6,182,212,0.15)]"
                                        : "hover:bg-gi-surface-hover text-gi-muted hover:text-gi-text"
                                )}
                            >
                                <span className="text-lg">{set.icon}</span>
                                <span className="text-xs font-display font-bold uppercase truncate">
                                    {set.name}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Right Content: Card Catalog */}
                <div className="flex-1 flex flex-col min-w-0">

                    {/* Mastery Stats Header */}
                    <div className="flex items-center justify-between mb-6 p-4 bg-gi-base/40 rounded-xl border border-gi-border/20 backdrop-blur-sm">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-gi-primary/10 rounded-lg border border-gi-primary/20">
                                <Trophy className="w-5 h-5 text-gi-primary" />
                            </div>
                            <div>
                                <h3 className="text-sm font-display font-bold text-gi-text uppercase tracking-wider">
                                    {currentArea?.name} Mastery
                                </h3>
                                <p className="text-xs text-gi-muted font-display">
                                    Set Completion: <span className="text-gi-text font-bold">{foundInSet}</span> / {setTotal}
                                </p>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-48 h-2 bg-gi-surface rounded-full overflow-hidden border border-gi-border/30">
                            <div
                                className="h-full bg-gi-primary shadow-[0_0_10px_rgba(6,182,212,0.5)] transition-all duration-500"
                                style={{ width: `${(foundInSet / setTotal) * 100}%` }}
                            />
                        </div>
                    </div>

                    {/* Card Grid */}
                    <div className="flex-1 overflow-y-auto pr-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {cardTemplates.map(template => {
                            const pips = LibraryManager.reconcileLocation(template.id);
                            const canPull = LibraryManager.canWithdraw(template.id);
                            const ownedCount = pips.filter(p => p.status !== 'undiscovered').length;

                            return (
                                <GISurface
                                    key={template.id}
                                    onClick={() => canPull && handleWithdraw(template.id)}
                                    className={cn(
                                        "flex gap-4 p-4 rounded-xl border border-gi-border/20 transition-all group",
                                        ownedCount === 0 ? "opacity-40 grayscale-[0.5]" : "hover:border-gi-primary/30",
                                        canPull ? "cursor-pointer hover:bg-gi-primary/5 shadow-sm active:scale-[0.98]" : "cursor-default"
                                    )}
                                >
                                    {/* Card Icon Container */}
                                    <div className="relative">
                                        <div className="w-14 h-14 bg-gi-surface rounded-lg border border-gi-border/50 flex items-center justify-center text-3xl shadow-inner group-hover:scale-110 transition-transform">
                                            {ownedCount > 0 ? template.icon : '?'}
                                        </div>
                                        {/* Quick Add Button */}
                                        {canPull && (
                                            <div
                                                className="absolute -top-2 -right-2 w-6 h-6 bg-gi-primary text-gi-base rounded-full flex items-center justify-center shadow-lg group-hover:bg-white group-hover:text-gi-primary transition-colors animate-in zoom-in duration-300"
                                                title="Withdraw to Board"
                                            >
                                                <Book size={12} className="fill-current" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Card Info */}
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-sm font-display font-bold text-gi-text truncate uppercase tracking-tight group-hover:text-gi-primary transition-colors">
                                            {ownedCount > 0 ? template.name : '???'}
                                        </h4>
                                        <div className="text-[10px] text-gi-muted font-display uppercase tracking-widest mb-2 flex items-center justify-between">
                                            <span>{template.cardType}</span>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    engine.EventBus.publish('ui:toggle_codex', { type: 'card', id: template.id });
                                                }}
                                                className="hover:text-gi-primary transition-colors p-1"
                                                title="View in Codex"
                                            >
                                                <Trophy size={10} className="inline mr-1 opacity-50" />
                                                Entry
                                            </button>
                                        </div>

                                        {/* Pips Row */}
                                        <div className="flex gap-2">
                                            {pips.map((pip, idx) => (
                                                <LibraryPip
                                                    key={idx}
                                                    status={pip.status}
                                                    areaId={pip.areaId}
                                                    onReclaim={(areaId) => handleReclaim(template.id, areaId)}
                                                    onWithdraw={() => handleWithdraw(template.id)}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </GISurface>
                            );
                        })}
                    </div>
                </div>
            </div>
        </GIModal>
    );
};

export default CardLibraryModal;
