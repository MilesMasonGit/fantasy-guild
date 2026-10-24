import { useState, useEffect } from 'react';
import GIModal from '../components/base/GIModal.jsx';
import { SaveManager } from '../../systems/core/SaveManager.js';
import { EventBus, UI_LISTENER } from '../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';
import * as NotificationSystem from '../../systems/core/NotificationSystem.js';
import { formatTimeAgo } from '../../utils/Formatters.js';
import { cn } from '../utils/cn.js';
import { Play, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { KitButton, KIT_BUTTON_TONE } from '../components/base/KitButton.jsx';

/** A save slot's row: no box (UI_STYLE "rows are never boxed"); the list draws faint lines between. */
const ROW = 'relative flex justify-between items-center px-2 py-3 w-full';

/** Lifetime playtime, saved in milliseconds (the game clock's tick deltas), as `2h 5m`. */
export function formatPlaytime(ms) {
    const seconds = Math.floor((ms || 0) / 1000);
    if (seconds < 60) return '< 1 min';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
}

/** The newest plain message ("Slot 2 deleted", a save that could not be loaded), or null. */
function useSlotMessage() {
    const latest = () => NotificationSystem.getQueue().at(-1) || null;
    const [message, setMessage] = useState(latest);
    useEffect(() => {
        const sync = () => setMessage(latest());
        const offs = [ENGINE_EVENTS.NOTIFICATION_ADDED, ENGINE_EVENTS.NOTIFICATION_DISMISSED]
            .map(e => EventBus.subscribe(e, sync, UI_LISTENER));
        sync();
        return () => offs.forEach(off => off());
    }, []);
    return message;
}

/**
 * SlotSelectionModal
 * The landing screen blocking game initialization until a save file is targeted.
 */
export const SlotSelectionModal = ({ isOpen, onSelect }) => {
    const [slots, setSlots] = useState([]);
    const [deleteAttemptIndex, setDeleteAttemptIndex] = useState(null);
    const message = useSlotMessage();

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
                <div key={index} data-save-slot={slotNumber} className={`${ROW} hover:outline-2 hover:outline-solid hover:-outline-offset-2 hover:outline-[var(--color-ui-white)]`}>
                    <div className="flex flex-col">
                        <span className="text-gray-500 font-bold uppercase tracking-widest text-sm">Slot {slotNumber} — Empty</span>
                        <span className="ui-text-body text-gray-600 uppercase tracking-widest">No save data</span>
                    </div>
                    <KitButton
                        onClick={() => handleSelect(index)}
                        className="mr-1"
                        buttonClassName="gap-2 py-1.5 px-4 tracking-widest uppercase text-xs"
                    >
                        <Plus size={16} /> New Game
                    </KitButton>
                </div>
            );
        }

        const { heroCount, playtime, lastSavedAt, version, isLastActive } = slotInfo;
        const timeAgo = lastSavedAt ? formatTimeAgo(lastSavedAt) : 'Unknown';
        const playtimeStr = formatPlaytime(playtime);
        const isPendingDelete = deleteAttemptIndex === index;

        return (
            <div key={index} data-save-slot={slotNumber} className={cn(
                ROW, 'md:flex-row flex-col md:items-center gap-4 group',
                // Room for the Last Played tag above the buttons.
                isLastActive && !isPendingDelete && 'pt-7',
                isPendingDelete
                    ? 'outline-2 outline-solid -outline-offset-2 outline-[var(--color-ui-red)]'
                    : 'hover:outline-2 hover:outline-solid hover:-outline-offset-2 hover:outline-[var(--color-ui-white)]'
            )}>
                {isLastActive && !isPendingDelete && (
                    <div className="absolute top-0 right-0 bg-gi-primary text-black px-2 py-0.5 ui-text-small font-bold uppercase tracking-widest z-10">
                        Last Played
                    </div>
                )}

                <div className="flex flex-col">
                    <span className="text-white font-bold tracking-widest mb-1 text-sm group-hover:text-gi-primary transition-colors">
                        Slot {slotNumber}
                        <span className="ml-2 ui-text-body text-gray-500 font-normal uppercase tracking-tighter">ver {version}</span>
                    </span>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                        <span className="flex items-center gap-1" title="Heroes">
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
                            <KitButton
                                tone={KIT_BUTTON_TONE.DANGER}
                                onClick={() => handleDelete(index)}
                                buttonClassName="py-1 px-3 text-xs"
                            >
                                Confirm
                            </KitButton>
                            <KitButton
                                tone={KIT_BUTTON_TONE.PLAIN}
                                onClick={() => setDeleteAttemptIndex(null)}
                                className="mr-1"
                                buttonClassName="py-1 px-3 text-xs"
                            >
                                Cancel
                            </KitButton>
                        </>
                    ) : (
                        <>
                            <KitButton
                                onClick={() => handleSelect(index)}
                                buttonClassName="gap-2 py-1.5 px-6 tracking-widest uppercase text-xs"
                            >
                                <Play size={14} /> Load
                            </KitButton>
                            <button
                                onClick={() => setDeleteAttemptIndex(index)}
                                className="text-gray-500 hover:text-red-500 p-2 transition-colors cursor-pointer"
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
            title="Choose a Save"
            className="w-full max-w-2xl text-white mt-[-10vh]"
        >
            <div className="flex flex-col gap-4 py-2">
                <p className="text-sm text-gray-400 mb-2 uppercase tracking-widest">Pick a save slot to play:</p>
                <div className="flex flex-col divide-y divide-white/10">
                    {[0, 1, 2].map(renderSlotCard)}
                </div>
                {/* The slot screen's messages: a plain line, red for a problem. */}
                {message && (
                    <p
                        data-slot-message={message.type}
                        className={cn('text-sm', message.type === 'error' || message.type === 'warning' ? 'text-red-400' : 'text-gray-300')}
                    >
                        {message.message}
                    </p>
                )}
            </div>
        </GIModal>
    );
};

export default SlotSelectionModal;
