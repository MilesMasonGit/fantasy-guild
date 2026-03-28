import React, { useState, useEffect } from 'react';
import GIModal from '../components/base/GIModal.jsx';
import { SaveManager } from '../../systems/core/SaveManager.js';
import { formatTimeAgo } from '../../utils/Formatters.js';
import { cn } from '../utils/cn.js';
import { Play, Plus, Trash2, AlertTriangle, X } from 'lucide-react';

/**
 * Format playtime seconds to readable string
 */
function formatPlaytime(seconds) {
    if (!seconds || seconds < 60) return '< 1 min';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
}

/**
 * SlotSelectionModal
 * The landing screen blocking game initialization until a save file is targeted.
 */
export const SlotSelectionModal = ({ isOpen, onSelect }) => {
    const [slots, setSlots] = useState([]);
    const [deleteAttemptIndex, setDeleteAttemptIndex] = useState(null);

    // Refresh slots when opened or when a deletion happens
    const refreshSlots = () => {
        setSlots(SaveManager.getAllSlotInfos());
        setDeleteAttemptIndex(null);
    };

    useEffect(() => {
        if (isOpen) {
            refreshSlots();
        }
    }, [isOpen]);

    const handleSelect = (index) => {
        if (onSelect) onSelect(index);
    };

    const handleDelete = (index) => {
        SaveManager.deleteSlot(index);
        refreshSlots();
    };

    if (!isOpen) return null;

    const renderSlotCard = (index) => {
        const slotInfo = slots[index] || null;
        const isEmpty = !slotInfo;
        const slotNumber = index + 1;

        if (isEmpty) {
            return (
                <div key={index} className="flex justify-between items-center p-4 bg-black/40 rounded-lg border border-dashed border-white/20 hover:border-gi-primary/50 transition-colors w-full">
                    <div className="flex flex-col">
                        <span className="font-pixel text-gray-500 font-bold uppercase tracking-widest text-sm">Slot {slotNumber} — Empty</span>
                        <span className="text-[10px] text-gray-600 uppercase tracking-widest">No save data</span>
                    </div>
                    <button
                        onClick={() => handleSelect(index)}
                        className="bg-gi-primary/20 hover:bg-gi-primary text-gi-primary hover:text-black font-bold py-2 px-6 rounded transition-colors flex items-center gap-2 font-pixel tracking-widest uppercase text-xs border border-gi-primary/50"
                    >
                        <Plus size={16} /> New Game
                    </button>
                </div>
            );
        }

        const { heroCount, playtime, lastSavedAt, version, isLastActive } = slotInfo;
        const timeAgo = lastSavedAt ? formatTimeAgo(lastSavedAt) : 'Unknown';
        const playtimeStr = formatPlaytime(playtime);
        const isPendingDelete = deleteAttemptIndex === index;

        return (
            <div key={index} className={cn(
                "relative flex flex-col md:flex-row justify-between md:items-center p-4 rounded-lg border-2 transition-all w-full gap-4 overflow-hidden group",
                isPendingDelete 
                    ? "bg-red-900/20 border-red-500 shadow-glow" 
                    : (isLastActive 
                        ? "bg-gi-primary/5 border-gi-primary shadow-[0_0_15px_rgba(46,204,113,0.1)]" 
                        : "bg-black/60 border-white/10 hover:border-white/30")
            )}>
                {/* Last Active Indicator */}
                {isLastActive && !isPendingDelete && (
                    <div className="absolute top-0 right-0 bg-gi-primary text-black px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest z-10 font-pixel">
                        Last Played
                    </div>
                )}

                <div className="flex flex-col">
                    <span className="font-pixel text-white font-bold tracking-widest mb-1 text-sm group-hover:text-gi-primary transition-colors">
                        Slot {slotNumber}
                        <span className="ml-2 text-[10px] text-gray-500 font-normal uppercase tracking-tighter">ver {version}</span>
                    </span>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                        <span className="flex items-center gap-1" title="Heroes in Vault">
                            <span className="text-blue-400">🦸</span> {heroCount || 0}
                        </span>
                        <span className="flex items-center gap-1" title="Total Playtime">
                            <span className="text-yellow-400">⏱️</span> {playtimeStr}
                        </span>
                        <span className="flex items-center gap-1" title="Last Saved">
                            <span className="text-green-400">💾</span> {timeAgo}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2 ml-auto">
                    {isPendingDelete ? (
                        <>
                            <div className="text-red-400 text-xs font-bold uppercase tracking-widest flex items-center gap-1 mr-2 px-2">
                                <AlertTriangle size={14} /> Delete Forever?
                            </div>
                            <button
                                onClick={() => handleDelete(index)}
                                className="bg-red-600 hover:bg-red-500 text-white font-bold py-1.5 px-3 rounded transition-colors text-xs font-pixel"
                            >
                                Confirm
                            </button>
                            <button
                                onClick={() => setDeleteAttemptIndex(null)}
                                className="bg-black/80 hover:bg-gray-800 border border-white/20 text-gray-300 py-1.5 px-3 rounded transition-colors text-xs font-pixel"
                            >
                                Cancel
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={() => handleSelect(index)}
                                className="bg-white/10 hover:bg-white text-white hover:text-black font-bold py-2 px-6 rounded transition-colors flex items-center gap-2 font-pixel tracking-widest uppercase text-xs border border-white/10"
                            >
                                <Play size={14} /> Load Sync
                            </button>
                            <button
                                onClick={() => setDeleteAttemptIndex(index)}
                                className="bg-black/40 border border-white/10 hover:border-red-500 text-gray-500 hover:text-red-500 p-2 rounded transition-colors"
                                title="Delete Save File"
                            >
                                <Trash2 size={16} />
                            </button>
                        </>
                    )}
                </div>
            </div>
        );
    };

    return (
        <GIModal
            isOpen={isOpen}
            hideClose={true}
            title="SYSTEM BOOT"
            className="w-full max-w-2xl bg-gray-900 border-gi-primary/50 text-white mt-[-10vh]"
        >
            <div className="flex flex-col gap-4 py-2 font-pixel">
                <p className="text-sm text-gray-400 mb-2 uppercase tracking-widest">Select a neural sync slot to continue:</p>
                <div className="flex flex-col gap-3">
                    {[0, 1, 2].map(renderSlotCard)}
                </div>
            </div>
        </GIModal>
    );
};

export default SlotSelectionModal;
