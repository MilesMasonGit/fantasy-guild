import { useCallback, useEffect, useRef, useState } from 'react';
import { Users, Trees, Skull, Gem, Search, SlidersHorizontal } from 'lucide-react';
import { PixelFrame, FRAME_KIND } from '../base/PixelFrame.jsx';
import { Tooltip } from '../base/Tooltip.jsx';
import { cn } from '../../utils/cn.js';
import { useEscapeLayer } from '../../utils/escapeLayers.js';
import { t } from '../../../i18n/index.js';
import { EventBus } from '../../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';
import { DOCK_STRIP_PX } from '../dock/dockHeroView.js';
import { MAP_MODE, setMapMode } from '../../hooks/useMapMode.js';
import {
    FIND_CATEGORY, useMatFind, useFindText, setFindCategory, setFindText, clearMatFind
} from '../../hooks/useMatFind.js';
import {
    DemolishToggle, useMapModeEnds, CONTROL_ICON_PX, CONTROL_ROW_CLS, CONTROL_OFF_CLS, MODE_ON_CLS
} from './MatModeControls.jsx';

/**
 * The Find rows, in order. Lucide placeholders until the owner draws the icons
 * (owner_art_list.md): swap a picture here.
 */
export const FIND_BUTTONS = Object.freeze([
    { category: FIND_CATEGORY.HEROES, Icon: Users, labelKey: 'matControls.findHeroes', tipKey: 'matControls.findHeroesTip' },
    { category: FIND_CATEGORY.TOKENS, Icon: Trees, labelKey: 'matControls.findTokens', tipKey: 'matControls.findTokensTip' },
    { category: FIND_CATEGORY.ENEMIES, Icon: Skull, labelKey: 'matControls.findEnemies', tipKey: 'matControls.findEnemiesTip' },
    { category: FIND_CATEGORY.ITEMS, Icon: Gem, labelKey: 'matControls.findItems', tipKey: 'matControls.findItemsTip' }
]);

/** The Controls button: square, the hero bar's height. */
export const CONTROLS_BUTTON_PX = DOCK_STRIP_PX;
/** The panel's width, px: the rows' words and the search box fit on one line each. */
export const CONTROLS_PANEL_PX = 216;

const LIT_CLS = 'bg-black/50 border-[var(--color-ui-white)] text-white';
const click = () => EventBus.publish(ENGINE_EVENTS.AUDIO_PLAY, { clip: 'button_click' });

/** One Find row: every match on the mat lights while it is hovered (or focused). */
const FindRow = ({ category, Icon, labelKey, tipKey, lit }) => {
    const on = () => setFindCategory(category);
    const off = () => setFindCategory(null);
    return (
        <Tooltip title={t(labelKey)} lines={[t(tipKey)]}>
            <button
                type="button"
                data-find-category={category}
                data-lit={lit ? 'true' : 'false'}
                onPointerEnter={on}
                onPointerLeave={off}
                onFocus={on}
                onBlur={off}
                className={cn(CONTROL_ROW_CLS, lit ? LIT_CLS : CONTROL_OFF_CLS)}
            >
                <span className="shrink-0 flex items-center justify-center" style={{ width: CONTROL_ICON_PX, height: CONTROL_ICON_PX }}>
                    <Icon aria-hidden="true" size={20} strokeWidth={2.5} />
                </span>
                <span>{t(labelKey)}</span>
            </button>
        </Tooltip>
    );
};

/** The search box: names and what Tokens make light while it holds text; Esc or emptying it ends it. */
const FindSearch = () => {
    const text = useFindText();
    useEscapeLayer(text.length > 0, () => setFindText(''));
    return (
        <Tooltip title={t('matControls.search')} lines={[t('matControls.searchTip')]}>
            <label
                data-find-search
                className={cn('w-full flex items-center gap-2 px-2 border-2 cursor-text transition-colors', text ? LIT_CLS : CONTROL_OFF_CLS)}
                style={{ height: CONTROL_ICON_PX + 4 }}
            >
                <Search aria-hidden="true" size={18} strokeWidth={2.5} className="shrink-0" />
                <input
                    type="text"
                    data-find-search-input
                    value={text}
                    onChange={(e) => setFindText(e.target.value)}
                    placeholder={t('matControls.searchPlaceholder')}
                    aria-label={t('matControls.search')}
                    spellCheck={false}
                    autoComplete="off"
                    className="flex-1 w-0 min-w-0 bg-transparent outline-none border-0 p-0 ui-text-body text-amber-100 placeholder:text-amber-100/50"
                />
            </label>
        </Tooltip>
    );
};

/** The panel, opened upward from the button: Demolish, then Find's four rows and the search box. */
const ControlsPanel = () => {
    const find = useMatFind();
    return (
        <PixelFrame
            kind={FRAME_KIND.CHAMFER}
            data-mat-controls-panel
            role="group"
            aria-label={t('matControls.label')}
            className="absolute left-0 bottom-full mb-2 pointer-events-auto"
            style={{ width: CONTROLS_PANEL_PX }}
            frameClassName="flex flex-col gap-1.5 p-2 ui-text-title"
        >
            <DemolishToggle />
            <span aria-hidden="true" className="mt-1 px-1 ui-text-small text-amber-100/70">{t('matControls.find')}</span>
            {FIND_BUTTONS.map(b => <FindRow key={b.category} {...b} lit={find?.category === b.category} />)}
            <FindSearch />
        </PixelFrame>
    );
};

/**
 * The Controls button, at the bottom left under the mat, the hero bar's height. It lies over the
 * screen's foot and takes no width from the hero bar, which stays centred as if it were not there.
 * A click opens the panel upward over the mat's corner: Demolish (the map mode), Find's Heroes,
 * Tokens, Enemies and Items (each lights every match while hovered) and the search box (lights
 * what it names while it has text; `matFind.js` says what matches). A second click, Esc or a
 * click outside closes it, and closing ends any find. Demolish stays on with the panel closed:
 * the button then wears the mode's colour.
 * `away` (the Guild Hall or the World Map open): hidden, its panel closed, the mode and the find
 * ended.
 * @param {{ away?: boolean }} props
 */
export const MatControls = ({ away = false }) => {
    const mode = useMapModeEnds();
    const [open, setOpen] = useState(false);
    const rootRef = useRef(null);

    const close = useCallback(() => {
        setOpen(false);
        clearMatFind();
    }, []);

    useEscapeLayer(open, close);

    // A press anywhere outside the button and its panel closes it.
    useEffect(() => {
        if (!open) return undefined;
        const onDown = (e) => {
            if (rootRef.current && !rootRef.current.contains(e.target)) close();
        };
        document.addEventListener('pointerdown', onDown, true);
        return () => document.removeEventListener('pointerdown', onDown, true);
    }, [open, close]);

    useEffect(() => {
        if (!away) return;
        close();
        setMapMode(null);
    }, [away, close]);
    useEffect(() => () => clearMatFind(), []);

    const modeOn = mode === MAP_MODE.DEMOLISH;
    return (
        <div
            ref={rootRef}
            data-mat-controls
            data-away={away ? 'true' : undefined}
            className="absolute left-0 bottom-0 z-(--z-hero-bar) select-none"
            style={{ visibility: away ? 'hidden' : undefined }}
        >
            {open && !away && <ControlsPanel />}
            <Tooltip title={t('matControls.button')} lines={[modeOn ? t('matControls.buttonModeOnTip') : t('matControls.buttonTip')]} disabled={open}>
                <button
                    type="button"
                    data-mat-controls-button
                    data-open={open ? 'true' : 'false'}
                    data-mode-on={modeOn ? 'true' : 'false'}
                    aria-expanded={open}
                    aria-label={t('matControls.button')}
                    onClick={() => { click(); if (open) close(); else setOpen(true); }}
                    className={cn(
                        'pointer-events-auto flex items-center justify-center border-2 cursor-pointer transition-colors',
                        modeOn ? MODE_ON_CLS[MAP_MODE.DEMOLISH] : (open ? LIT_CLS : CONTROL_OFF_CLS)
                    )}
                    style={{ width: CONTROLS_BUTTON_PX, height: CONTROLS_BUTTON_PX }}
                >
                    <SlidersHorizontal aria-hidden="true" size={28} strokeWidth={2.5} />
                </button>
            </Tooltip>
        </div>
    );
};

export default MatControls;
