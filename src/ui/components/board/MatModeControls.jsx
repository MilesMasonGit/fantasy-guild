import { useEffect } from 'react';
import { EventBus } from '../../../systems/core/EventBus.js';
import * as Flags from '../../../systems/board/Flags.js';
import { CAP_EVENTS, useRefreshOn } from './MatCapBadge.jsx';
import {
    MAP_MODE, useMapMode, toggleMapMode, setMapMode, disallowedCount, markedCount, cancelAllMarks
} from '../../hooks/useMapMode.js';
import { Tooltip } from '../base/Tooltip.jsx';
import { cn } from '../../utils/cn.js';
import { useEscapeLayer } from '../../utils/escapeLayers.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';

/** The bar's buttons: square, a 1-art-pixel line, white on hover. */
const BUTTON_CLS = 'flex items-center gap-1.5 px-3 py-1.5 border-2 whitespace-nowrap cursor-pointer transition-colors';
const OFF_CLS = 'bg-black/30 border-[#2a1d15] text-amber-100 hover:border-[var(--color-ui-white)] hover:text-white';
/** A mode's toggle while it is on, in the mode's colour: muted grey, red. */
const ON_CLS = {
    [MAP_MODE.DISALLOW]: 'bg-black/50 border-[var(--color-ui-muted)] text-white',
    [MAP_MODE.DEMOLISH]: 'bg-black/50 border-[var(--color-ui-red)] text-[var(--color-ui-red)]'
};

/**
 * What each mode's banner says while it is on (concept_map_tools.md, the owner's wording). The
 * Demolish banner is the one warning that nothing comes back: it shows on entering, and the clicks
 * after it mark and unmark without asking, because a mark can be cancelled until the hero
 * finishes.
 */
export const MODE_BANNER_TEXT = Object.freeze({
    [MAP_MODE.DISALLOW]: 'Disallow mode: click a Token so heroes won’t work it. Click again to allow.',
    [MAP_MODE.DEMOLISH]: 'Demolish mode: click Tokens to mark them. A Construction hero takes them down. Nothing is refunded.'
});

const TOGGLES = [
    { mode: MAP_MODE.DISALLOW, label: 'Disallow', icon: '⊘', tip: 'Click Tokens so heroes won’t work them. Shift-click for every Token of a type.' },
    { mode: MAP_MODE.DEMOLISH, label: 'Demolish', icon: '✕', tip: 'Click Tokens to mark them for demolition.' }
];

const click = () => EventBus.publish(ENGINE_EVENTS.AUDIO_PLAY, { clip: 'button_click' });

/**
 * One mode's toggle: on turns the other mode off; a second press, or Esc, ends it.
 */
const ModeToggle = ({ mode, label, icon, tip, on }) => (
    <Tooltip title={label} lines={[on ? 'Press again or Esc to finish.' : tip]}>
        <button
            type="button"
            data-map-mode-toggle={mode}
            data-on={on ? 'true' : 'false'}
            aria-pressed={on}
            onClick={() => { click(); toggleMapMode(mode); }}
            className={cn(BUTTON_CLS, on ? ON_CLS[mode] : OFF_CLS)}
        >
            <span aria-hidden="true">{icon}</span>
            <span>{label}</span>
        </button>
    </Tooltip>
);

/**
 * The bar's right end: the Disallow and Demolish toggles, side by side. While a mode is on, Esc
 * ends it, and so does this going away with the bar (leaving the playmat for the Guild Hall).
 */
export const MapModeToggles = () => {
    const mode = useMapMode();

    useEscapeLayer(!!mode, () => setMapMode(null));

    // Off the playmat, the mode is off: the bar is only drawn there.
    useEffect(() => () => setMapMode(null), []);

    return (
        <>
            {TOGGLES.map(t => <ModeToggle key={t.mode} {...t} on={mode === t.mode} />)}
        </>
    );
};

/**
 * **Allow all**: every disallowed Token on the mat allowed again, at once, no confirm. With none
 * it stays and does nothing. The count is read on the cap badge's events (`Flags.setDisallowed`
 * publishes `TILE_CHANGED`), so it follows every click in the mode.
 */
export const AllowAllButton = () => {
    useRefreshOn(CAP_EVENTS, true, disallowedCount);
    const count = disallowedCount();
    return (
        <Tooltip title={count ? 'Let heroes work every Token again' : 'No Token is disallowed'}>
            <button
                type="button"
                data-allow-all={count}
                onClick={() => { if (!count) return; click(); Flags.allowAll(); }}
                className={cn(BUTTON_CLS, OFF_CLS)}
            >
                Allow all{count ? ` (${count})` : ''}
            </button>
        </Tooltip>
    );
};

/**
 * **Cancel all marks**: every Token marked for demolition unmarked at once, no confirm (the
 * Tokens stay; only the half-done work is lost). With none it stays and does nothing.
 */
export const CancelAllMarksButton = () => {
    useRefreshOn(CAP_EVENTS, true, markedCount);
    const count = markedCount();
    return (
        <Tooltip title={count ? 'Keep every marked Token' : 'No Token is marked'}>
            <button
                type="button"
                data-cancel-all-marks={count}
                onClick={() => { if (!count) return; click(); cancelAllMarks(); }}
                className={cn(BUTTON_CLS, OFF_CLS)}
            >
                Cancel all marks{count ? ` (${count})` : ''}
            </button>
        </Tooltip>
    );
};

/**
 * The bar's centre while a mode is on: what a click does, in plain words, and the mode's batch
 * control. Demolish's in red. While no mode is on, `fallback` (the Token cap and Upkeep), so the
 * mode's words get the whole centre.
 * @param {{ fallback?: React.ReactNode }} props
 */
export const MapModeBanner = ({ fallback = null }) => {
    const mode = useMapMode();
    if (!mode) return fallback;
    return <ModeBannerView mode={mode} />;
};

/**
 * The banner for `mode`, drawn without reading the live mode (the style sheet page shows it too).
 * ⚠️ The words wrap, up to three lines, rather than being cut: Demolish's last sentence is the
 * warning, and the bar is only as wide as the mat, so its centre is narrower than one line of it.
 * In a small window (1366 px) even three lines cannot hold it and the rest is on hover.
 */
export const ModeBannerView = ({ mode }) => (
    <div data-map-mode-banner={mode} className="flex items-center justify-center gap-2 min-w-0 h-full">
        <Tooltip title={MODE_BANNER_TEXT[mode]} maxWidth={360}>
            <span
                data-map-mode-banner-text
                className="ui-text-title min-w-0 leading-5 line-clamp-3 text-center"
                style={{ color: mode === MAP_MODE.DEMOLISH ? 'var(--color-ui-red)' : undefined }}
            >
                {MODE_BANNER_TEXT[mode]}
            </span>
        </Tooltip>
        {mode === MAP_MODE.DISALLOW ? <AllowAllButton /> : <CancelAllMarksButton />}
    </div>
);

export default MapModeToggles;
