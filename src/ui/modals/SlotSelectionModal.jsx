import { useState, useEffect } from 'react';
import { SaveManager } from '../../systems/core/SaveManager.js';
import { EventBus, UI_LISTENER } from '../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';
import * as NotificationSystem from '../../systems/core/NotificationSystem.js';
import { formatTimeAgo, formatPlaytime } from '../../utils/Formatters.js';
import { cn } from '../utils/cn.js';
import { useEscapeLayer } from '../utils/escapeLayers.js';
import { Play, Plus, Trash2, AlertTriangle, Users, Clock, Save, Hourglass } from 'lucide-react';
import { KitButton, KIT_BUTTON_TONE } from '../components/base/KitButton.jsx';
import { PixelFrame, FRAME_KIND } from '../components/base/PixelFrame.jsx';
import { TitleScreen } from '../components/title/TitleScreen.jsx';
import { NewGameScreen } from '../components/title/NewGameScreen.jsx';
import { slotAwayText } from '../components/title/slotAway.js';
import { SaveFolderButton, useSaveFilesWatch } from '../components/title/SaveFolderButton.jsx';
import { t } from '../../i18n/index.js';
import { onPoll } from '../components/board/frameClock.js';

/** A save slot's row: no box (UI_STYLE "rows are never boxed"); the list draws faint lines between. */
const ROW = 'relative flex justify-between items-center px-2 py-3 w-full';
const HOVER_ROW = 'hover:outline-2 hover:outline-solid hover:-outline-offset-2 hover:outline-[var(--color-ui-white)]';

/**
 * The newest plain message ("Slot 2 deleted", a save that could not be loaded), or null. Listens
 * only while the screen is up (`active`): the modal stays mounted all game.
 */
function useSlotMessage(active) {
    const latest = () => NotificationSystem.getQueue().at(-1) || null;
    const [message, setMessage] = useState(latest);
    useEffect(() => {
        if (!active) return undefined;
        const sync = () => setMessage(latest());
        const offs = [ENGINE_EVENTS.NOTIFICATION_ADDED, ENGINE_EVENTS.NOTIFICATION_DISMISSED]
            .map(e => EventBus.subscribe(e, sync, UI_LISTENER));
        sync();
        return () => offs.forEach(off => off());
    }, [active]);
    return message;
}

/**
 * Whether a slot's time away replaces its last-saved stat (true) or stands beside it (false). The
 * two say the same span in different words; replaced, the away stat's tip keeps the last save.
 */
export const AWAY_REPLACES_LAST_SAVED = true;

/** Re-reads the clock while the screen is up, so a slot's time away keeps counting. */
function useMinuteClock(active) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (!active) return undefined;
        setNow(Date.now());
        return onPoll(() => setNow(Date.now()), 30000);
    }, [active]);
    return now;
}

/** One stat on a slot: a Lucide mark (UI_STYLE "the icon rule": the start screen is Lucide) and its value. */
const SlotStat = ({ icon: Icon, label, children, stat }) => (
    <span data-slot-stat={stat} className="flex items-center gap-1" title={label}>
        <Icon size={14} className="text-gi-muted shrink-0" aria-label={label} /> {children}
    </span>
);

/**
 * The title screen with the three save slots: load, a new game, delete with its confirm, and the
 * last message (a slot deleted, a save refused). It blocks the game until a slot is picked. An
 * empty slot's New Game opens the new-game screen first; its Begin starts the slot with the choices.
 */
export const SlotSelectionModal = ({ isOpen, onSelect }) => {
    const [slots, setSlots] = useState([]);
    const [deleteAttemptIndex, setDeleteAttemptIndex] = useState(null);
    const [newGameSlot, setNewGameSlot] = useState(null);
    const message = useSlotMessage(!!isOpen);
    const now = useMinuteClock(!!isOpen);
    // Nothing lies under the title screen for Escape to close.
    useEscapeLayer(!!isOpen, null);

    const refreshSlots = () => {
        setSlots(SaveManager.getAllSlotInfos());
        setDeleteAttemptIndex(null);
    };

    useEffect(() => {
        if (isOpen) {
            refreshSlots();
            setNewGameSlot(null);
        }
    }, [isOpen]);
    // The desktop build's save files, read again as they change.
    useSaveFilesWatch(!!isOpen, refreshSlots);

    const handleSelect = (index) => {
        if (onSelect) onSelect(index);
    };

    const handleDelete = (index) => {
        SaveManager.deleteSlot(index);
        refreshSlots();
    };

    if (!isOpen) return null;

    if (newGameSlot !== null) {
        return (
            <NewGameScreen
                slotIndex={newGameSlot}
                onBack={() => setNewGameSlot(null)}
                onBegin={(setup) => onSelect?.(newGameSlot, { setup })}
            />
        );
    }

    const slotButtons = (index, isPendingDelete) => (
        <div className="flex items-center gap-2 ml-auto shrink-0">
            {isPendingDelete ? (
                <>
                    <div className="text-red-400 text-xs font-bold uppercase tracking-widest flex items-center gap-1 mr-2 px-2">
                        <AlertTriangle size={14} /> {t('titleScreen.deleteConfirm')}
                    </div>
                    <KitButton tone={KIT_BUTTON_TONE.DANGER} onClick={() => handleDelete(index)} buttonClassName="py-1 px-3 text-xs">
                        {t('common.confirm')}
                    </KitButton>
                    <KitButton tone={KIT_BUTTON_TONE.PLAIN} onClick={() => setDeleteAttemptIndex(null)} className="mr-1" buttonClassName="py-1 px-3 text-xs">
                        {t('common.cancel')}
                    </KitButton>
                </>
            ) : (
                <>
                    <KitButton onClick={() => handleSelect(index)} buttonClassName="gap-2 py-1.5 px-6 tracking-widest uppercase text-xs">
                        <Play size={14} /> {t('titleScreen.load')}
                    </KitButton>
                    <button
                        data-slot-delete
                        onClick={() => setDeleteAttemptIndex(index)}
                        className="text-gray-500 hover:text-red-500 p-2 transition-colors cursor-pointer"
                        title={t('titleScreen.delete')}
                        aria-label={t('titleScreen.delete')}
                    >
                        <Trash2 size={16} />
                    </button>
                </>
            )}
        </div>
    );

    const renderSlotRow = (index) => {
        const slotInfo = slots[index] || null;
        const slotNumber = index + 1;
        const isPendingDelete = deleteAttemptIndex === index;
        const rowLook = isPendingDelete ? 'outline-2 outline-solid -outline-offset-2 outline-[var(--color-ui-red)]' : HOVER_ROW;

        if (!slotInfo) {
            return (
                <div key={index} data-save-slot={slotNumber} data-slot-state="empty" className={cn(ROW, HOVER_ROW)}>
                    <div className="flex flex-col">
                        <span className="text-gray-500 font-bold uppercase tracking-widest text-sm">{t('titleScreen.slotEmpty', { n: slotNumber })}</span>
                        <span className="ui-text-body text-gray-600 uppercase tracking-widest">{t('titleScreen.noSave')}</span>
                    </div>
                    <KitButton onClick={() => setNewGameSlot(index)} className="mr-1" buttonClassName="gap-2 py-1.5 px-4 tracking-widest uppercase text-xs" data-slot-new-game>
                        <Plus size={16} /> {t('titleScreen.newGame')}
                    </KitButton>
                </div>
            );
        }

        if (slotInfo.damaged) {
            return (
                <div key={index} data-save-slot={slotNumber} data-slot-state="damaged" className={cn(ROW, 'gap-4', rowLook)}>
                    <div className="flex flex-col min-w-0">
                        <span className="text-red-400 font-bold uppercase tracking-widest text-sm whitespace-nowrap">{t('titleScreen.slotDamaged', { n: slotNumber })}</span>
                        <span className="ui-text-body text-gray-500">{t('titleScreen.damagedHint')}</span>
                    </div>
                    {slotButtons(index, isPendingDelete)}
                </div>
            );
        }

        const { guildName, heroCount, playtime, lastSavedAt, version, isLastActive } = slotInfo;
        const timeAgo = lastSavedAt ? formatTimeAgo(lastSavedAt) : t('titleScreen.unknown');
        const away = slotAwayText(slotInfo, now);

        return (
            <div key={index} data-save-slot={slotNumber} data-slot-state="filled" className={cn(
                ROW, 'md:flex-row flex-col md:items-center gap-4 group',
                // Room for the Last Played tag above the buttons.
                isLastActive && !isPendingDelete && 'pt-7',
                rowLook
            )}>
                {isLastActive && !isPendingDelete && (
                    <div className="absolute top-0 right-0 bg-gi-primary text-black px-2 py-0.5 ui-text-small font-bold uppercase tracking-widest z-10">
                        {t('titleScreen.lastPlayed')}
                    </div>
                )}

                <div className="flex flex-col">
                    <span className="text-white font-bold tracking-widest mb-1 text-sm group-hover:text-gi-primary transition-colors">
                        {guildName ? <span data-slot-guild-name>{guildName}</span> : t('titleScreen.slot', { n: slotNumber })}
                        {guildName && <span className="ml-2 ui-text-body text-gray-500 font-normal uppercase tracking-tighter">{t('titleScreen.slot', { n: slotNumber })}</span>}
                        <span className="ml-2 ui-text-body text-gray-500 font-normal uppercase tracking-tighter">{t('titleScreen.version', { version })}</span>
                    </span>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                        <SlotStat stat="heroes" icon={Users} label={t('titleScreen.heroes')}>{heroCount || 0}</SlotStat>
                        <SlotStat stat="playtime" icon={Clock} label={t('titleScreen.playtime')}>{formatPlaytime(playtime)}</SlotStat>
                        {(!AWAY_REPLACES_LAST_SAVED || !away) && (
                            <SlotStat stat="saved" icon={Save} label={t('titleScreen.lastSaved')}>{timeAgo}</SlotStat>
                        )}
                        {away && (
                            <SlotStat stat="away" icon={Hourglass} label={t('titleScreen.awayTip', { ago: timeAgo })}>{away}</SlotStat>
                        )}
                    </div>
                </div>

                {slotButtons(index, isPendingDelete)}
            </div>
        );
    };

    return (
        <TitleScreen>
            <PixelFrame kind={FRAME_KIND.CHAMFER} frameClassName="flex flex-col">
                <div className="px-6 pt-5 pb-3 border-b border-gi-border/50">
                    <h2 className="m-0 ui-text-title font-bold text-gi-primary tracking-wide uppercase">{t('titleScreen.chooseSave')}</h2>
                </div>
                <div className="px-6 py-3 flex flex-col gap-3">
                    <div className="flex flex-col divide-y divide-white/10">
                        {[0, 1, 2].map(renderSlotRow)}
                    </div>
                    {/* The slot screen's messages: a plain line, red for a problem. */}
                    {message && (
                        <p
                            data-slot-message={message.type}
                            className={cn('m-0 text-sm', message.type === 'error' || message.type === 'warning' ? 'text-red-400' : 'text-gray-300')}
                        >
                            {message.message}
                        </p>
                    )}
                    <SaveFolderButton className="self-end" />
                </div>
            </PixelFrame>
        </TitleScreen>
    );
};

export default SlotSelectionModal;
