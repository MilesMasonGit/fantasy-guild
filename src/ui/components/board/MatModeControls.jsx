import { useEffect } from 'react';
import { EventBus } from '../../../systems/core/EventBus.js';
import { CAP_EVENTS, useRefreshOn } from './MatCapBadge.jsx';
import {
    MAP_MODE, useMapMode, toggleMapMode, setMapMode, markedCount, cancelAllMarks
} from '../../hooks/useMapMode.js';
import { Tooltip } from '../base/Tooltip.jsx';
import { cn } from '../../utils/cn.js';
import { useEscapeLayer } from '../../utils/escapeLayers.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';
import { mapModeIconSrc, mapModeIconPx } from './mapModeCursor.js';
import { t } from '../../../i18n/index.js';

/** The banner's batch button: square, a 1-art-pixel line, white on hover. */
const BUTTON_CLS = 'flex items-center gap-1.5 px-3 py-1.5 border-2 whitespace-nowrap cursor-pointer transition-colors';
const OFF_CLS = 'bg-black/30 border-[#2a1d15] text-amber-100 hover:border-[var(--color-ui-white)] hover:text-white';

/**
 * The Controls panel's rows (`MatControls`): a square icon well and the row's word, a 1-art-pixel
 * line, white on hover or while lit.
 */
export const CONTROL_ICON_PX = 32;
export const CONTROL_ROW_CLS = 'w-full flex items-center gap-2 pr-2 border-2 cursor-pointer transition-colors whitespace-nowrap';
export const CONTROL_OFF_CLS = 'bg-black/30 border-[#2a1d15] text-amber-100 hover:border-[var(--color-ui-white)] hover:text-white';
/** A mode's toggle while it is on, in the mode's colour. */
export const MODE_ON_CLS = {
    [MAP_MODE.DEMOLISH]: 'bg-black/50 border-[var(--color-ui-red)] text-[var(--color-ui-red)]'
};

/**
 * What the mode's banner says while it is on (concept_map_tools.md, the owner's wording). The
 * Demolish banner is the one warning that nothing comes back: it shows on entering, and the clicks
 * after it mark and unmark without asking, because a mark can be cancelled until the hero
 * finishes.
 */
export const MODE_BANNER_TEXT = Object.freeze({
    [MAP_MODE.DEMOLISH]: 'Demolish mode: click Tokens to mark them. A Construction hero takes them down. Nothing is refunded.'
});

const click = () => EventBus.publish(ENGINE_EVENTS.AUDIO_PLAY, { clip: 'button_click' });

/** A mode's pixel glyph, the same picture as its cursor over a Token. */
export const ModeIcon = ({ mode }) => {
    const px = mapModeIconPx(mode);
    return (
        <img
            data-map-mode-icon={mode}
            src={mapModeIconSrc(mode)}
            alt=""
            aria-hidden="true"
            draggable={false}
            width={px}
            height={px}
            className="shrink-0 select-none pointer-events-none"
            style={{ imageRendering: 'pixelated' }}
        />
    );
};

/**
 * The Demolish toggle, a row of the Controls panel: a second press, or Esc, ends the mode.
 */
export const DemolishToggle = () => {
    const on = useMapMode() === MAP_MODE.DEMOLISH;
    return (
        <Tooltip title={t('matControls.demolish')} lines={[on ? t('matControls.demolishOnTip') : t('matControls.demolishTip')]}>
            <button
                type="button"
                data-map-mode-toggle={MAP_MODE.DEMOLISH}
                data-on={on ? 'true' : 'false'}
                aria-pressed={on}
                onClick={() => { click(); toggleMapMode(MAP_MODE.DEMOLISH); }}
                className={cn(CONTROL_ROW_CLS, on ? MODE_ON_CLS[MAP_MODE.DEMOLISH] : CONTROL_OFF_CLS)}
            >
                <span className="shrink-0 flex items-center justify-center" style={{ width: CONTROL_ICON_PX, height: CONTROL_ICON_PX }}>
                    <ModeIcon mode={MAP_MODE.DEMOLISH} />
                </span>
                <span>{t('matControls.demolish')}</span>
            </button>
        </Tooltip>
    );
};

/**
 * The map mode's life outside the toggle, held by whatever stays mounted while the player is on
 * the playmat (the Controls button): Esc ends a mode that is on, and the holder going away (leaving
 * the playmat) ends it too. The toggle itself may come and go with its panel.
 */
export function useMapModeEnds() {
    const mode = useMapMode();
    useEscapeLayer(!!mode, () => setMapMode(null));
    useEffect(() => () => setMapMode(null), []);
    return mode;
}

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
 * The banner for `mode`, drawn without reading the live mode.
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
        <CancelAllMarksButton />
    </div>
);
